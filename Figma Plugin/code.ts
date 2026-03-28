// RetroSkinner - Figma Plugin for Delta Skin Generation

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEATURE_NAMES = [
  "iphone_edgetoedge_portrait",
  "iphone_edgetoedge_landscape",
  "iphone_standard_portrait",
  "iphone_standard_landscape",
  "ipad_standard_portrait",
  "ipad_standard_landscape",
];

figma.skipInvisibleInstanceChildren = true;

// ---------------------------------------------------------------------------
// Traverse helpers
// ---------------------------------------------------------------------------

function findChildren(node: BaseNode, predicate: (n: BaseNode) => boolean): BaseNode[] {
  const results: BaseNode[] = [];
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      if (predicate(child)) results.push(child);
    }
  }
  return results;
}

/**
 * Deep search that skips INSTANCE internals.
 * In Figma Plugin API, INSTANCE nodes duplicate the entire component subtree.
 * REST API doesn't do this, which is why the Python version works with deep search.
 * We replicate REST API behavior by not descending into INSTANCE children.
 */
function findNodesSkipInstances(node: BaseNode, predicate: (n: BaseNode) => boolean): BaseNode[] {
  const results: BaseNode[] = [];
  const stack: BaseNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (predicate(current)) results.push(current);
    if ("children" in current && current.type !== "INSTANCE") {
      const children = (current as ChildrenMixin).children;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }
  return results;
}

function findAllDescendants(node: BaseNode, predicate: (n: BaseNode) => boolean): BaseNode[] {
  const results: BaseNode[] = [];
  const stack: BaseNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (predicate(current)) results.push(current);
    if ("children" in current) {
      const children = (current as ChildrenMixin).children;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }
  return results;
}

function matchByPattern(node: BaseNode, pattern: RegExp): BaseNode[] {
  return findNodesSkipInstances(node, n => pattern.test(n.name));
}

function parseFeatureName(name: string): [string, string, string] | [null, null, null] {
  const parts = name.toLowerCase().split("_");
  if (parts.length !== 3) return [null, null, null];
  let [device, dtype, orientation] = parts;
  if (dtype === "edgetoedge") dtype = "edgeToEdge";
  return [device, dtype, orientation];
}

// ---------------------------------------------------------------------------
// Discover feature & background layers (top-level only, very fast)
// ---------------------------------------------------------------------------

function discoverLayers() {
  const featureLayers = new Map<string, FrameNode>();
  const backgroundLayers = new Map<string, FrameNode>();

  const currentPage = figma.currentPage;
  for (const child of currentPage.children) {
    if (child.type !== "FRAME" && child.type !== "COMPONENT") continue;
    const cname: string = child.name.toLowerCase();
    for (const fn of FEATURE_NAMES) {
      if (cname === fn) {
        featureLayers.set(fn, child as FrameNode);
      } else if (cname === `${fn}_background`) {
        backgroundLayers.set(fn, child as FrameNode);
      }
    }
  }

  return { featureLayers, backgroundLayers };
}

// ---------------------------------------------------------------------------
// Read skinInfo text node
// ---------------------------------------------------------------------------

function readSkinInfo(): { node: TextNode; data: any } | null {
  const currentPage = figma.currentPage;
  for (const child of currentPage.children) {
    if (child.type === "TEXT" && child.name === "skinInfo") {
      try {
        const data = JSON.parse((child as TextNode).characters);
        return { node: child as TextNode, data };
      } catch (_e) {
        return null;
      }
    }
  }
  // Check one level deeper (inside groups/frames)
  for (const child of currentPage.children) {
    if ("children" in child) {
      for (const grandchild of (child as ChildrenMixin).children) {
        if (grandchild.type === "TEXT" && grandchild.name === "skinInfo") {
          try {
            const data = JSON.parse((grandchild as TextNode).characters);
            return { node: grandchild as TextNode, data };
          } catch (_e) {
            return null;
          }
        }
      }
    }
  }
  return null;
}

const DEFAULT_SKIN_INFO = {
  name: "",
  identifier: "",
  gameTypeIdentifier: "",
  debug: false,
  thumbstickConfig: [],
  assetReuseConfig: [],
  inputFrameConfig: [],
};

// ---------------------------------------------------------------------------
// Build items for one feature
// ---------------------------------------------------------------------------

function buildItems(featureNode: FrameNode, skinInfo: any, skinType: string) {
  const thumbstickConfig = skinInfo.thumbstickConfig || [];
  const isDelta = skinType === "delta";

  const reuseMap = new Map<string, string>();
  if (!isDelta) {
    for (const group of skinInfo.assetReuseConfig || []) {
      if (group.length >= 2) {
        const primary = group[0];
        for (let i = 1; i < group.length; i++) {
          reuseMap.set(group[i], primary);
        }
      }
    }
  }

  const items: any[] = [];

  // Thumbsticks
  const tsNodes = matchByPattern(featureNode, /^items_thumbstick_\d+$/)
    .sort((a, b) => parseInt((a.name.match(/\d+/) || [])[0] || "0") - parseInt((b.name.match(/\d+/) || [])[0] || "0"));

  for (const tsNode of tsNodes) {
    const ts = tsNode as FrameNode;
    const idx = parseInt((ts.name.match(/\d+/) || [])[0] || "1");
    const tsBox = ts.absoluteBoundingBox;
    const pdfName = `${ts.name}.pdf`;

    const isLeft = (thumbstickConfig[idx - 1] !== undefined ? thumbstickConfig[idx - 1] : true) as boolean;
    const prefix = isLeft ? "left" : "right";

    items.push({
      thumbstick: {
        name: pdfName,
        width: Math.round((tsBox && tsBox.width) || 0),
        height: Math.round((tsBox && tsBox.height) || 0),
      },
      inputs: {
        up: `${prefix}ThumbstickUp`,
        down: `${prefix}ThumbstickDown`,
        left: `${prefix}ThumbstickLeft`,
        right: `${prefix}ThumbstickRight`,
      },
      frame: makeFrame(ts, featureNode),
      extendedEdges: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  }

  // D-pads
  const dpNodes = matchByPattern(featureNode, /^items_dpad_\d+$/)
    .sort((a, b) => parseInt((a.name.match(/\d+/) || [])[0] || "0") - parseInt((b.name.match(/\d+/) || [])[0] || "0"));

  for (const dpNode of dpNodes) {
    const dp = dpNode as FrameNode;
    const pdfName = `${dp.name}.pdf`;

    const entry: any = {
      inputs: { up: "up", down: "down", left: "left", right: "right" },
      frame: makeFrame(dp, featureNode),
      extendedEdges: { top: 0, bottom: 0, left: 0, right: 0 },
    };

    if (!isDelta) {
      entry.asset = { normal: pdfName };
    }

    items.push(entry);
  }

  // Buttons
  const btnNodes = matchByPattern(featureNode, /^items_button_.+$/);

  for (const btnNode of btnNodes) {
    const btn = btnNode as FrameNode;
    const btnName = btn.name;
    const parts = btnName.split("_");
    const inputName = parts[parts.length - 1];

    const entry: any = {
      inputs: [inputName],
      frame: makeFrame(btn, featureNode),
      extendedEdges: { top: 0, bottom: 0, left: 0, right: 0 },
    };

    if (!isDelta) {
      const reuseTarget = reuseMap.get(btnName);
      const pdfName = reuseTarget ? `${reuseTarget}.pdf` : `${btnName}.pdf`;
      entry.asset = { normal: pdfName };
    }

    items.push(entry);
  }

  // Touch screens
  const touchNodes = matchByPattern(featureNode, /^items_touchScreen_\d+$/)
    .sort((a, b) => parseInt((a.name.match(/\d+/) || [])[0] || "0") - parseInt((b.name.match(/\d+/) || [])[0] || "0"));

  for (const tNode of touchNodes) {
    const t = tNode as FrameNode;
    items.push({
      inputs: { x: "touchScreenX", y: "touchScreenY" },
      frame: makeFrame(t, featureNode),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Build screens for one feature
// ---------------------------------------------------------------------------

function buildScreens(featureNode: FrameNode, skinInfo: any) {
  const inputFrameConfig = skinInfo.inputFrameConfig || [];
  const screenNodes = matchByPattern(featureNode, /^screen_\d+$/)
    .sort((a, b) => parseInt((a.name.match(/\d+/) || [])[0] || "0") - parseInt((b.name.match(/\d+/) || [])[0] || "0"));

  return screenNodes.map((scr, i): any => {
    const s = scr as FrameNode;
    const entry: any = { outputFrame: makeFrame(s, featureNode) };
    if (inputFrameConfig[i]) {
      entry.inputFrame = inputFrameConfig[i];
    }
    return entry;
  });
}

// ---------------------------------------------------------------------------
// Build complete info.json
// ---------------------------------------------------------------------------

function buildInfoJson(skinInfo: any, featureLayers: Map<string, FrameNode>, backgroundLayers: Map<string, FrameNode>, skinType: string) {
  const info: any = {
    debug: skinInfo.debug || false,
    gameTypeIdentifier: skinInfo.gameTypeIdentifier || "",
    identifier: skinInfo.identifier || "",
    name: skinInfo.name || "",
    representations: {},
  };

  const isDelta = skinType === "delta";

  for (const [featureName, featureNode] of featureLayers) {
    const [device, dtype, orientation] = parseFeatureName(featureName);
    if (!device) continue;

    const fbox = featureNode.absoluteBoundingBox;

    const rep: any = {
      assets: { resizable: "" },
      mappingSize: {
        width: Math.round((fbox && fbox.width) || 0),
        height: Math.round((fbox && fbox.height) || 0),
      },
      translucent: false,
      items: [],
      screens: [],
    };

    if (isDelta) {
      rep.assets.resizable = `${featureName}.pdf`;
    } else {
      const bgNode = backgroundLayers.get(featureName);
      if (bgNode) {
        rep.assets.resizable = `${featureName}_background.pdf`;
      }
    }

    rep.items = buildItems(featureNode, skinInfo, skinType);
    rep.screens = buildScreens(featureNode, skinInfo);

    if (!info.representations[device]) info.representations[device] = {};
    if (!info.representations[device][dtype]) info.representations[device][dtype] = {};
    info.representations[device][dtype][orientation] = rep;
  }

  return info;
}

// ---------------------------------------------------------------------------
// Collect exportable resources (pre-computed, cached at init)
// ---------------------------------------------------------------------------

interface ResourceDescriptor {
  nodeId: string;
  name: string;
  type: string;
  feature: string;
}

function buildCachedResourceDescriptors(
  featureLayers: Map<string, FrameNode>,
  backgroundLayers: Map<string, FrameNode>,
  skinInfo: any
): ResourceDescriptor[] {
  const descriptors: ResourceDescriptor[] = [];

  for (const [featureName, featureNode] of featureLayers) {
    // Manic background
    const bgNode = backgroundLayers.get(featureName);
    if (bgNode) {
      descriptors.push({ nodeId: bgNode.id, name: `${featureName}_background.pdf`, type: "background", feature: featureName });
    }
    // Delta background
    descriptors.push({ nodeId: featureNode.id, name: `${featureName}.pdf`, type: "deltaBackground", feature: featureName });

    // Thumbsticks
    const tsNodes = matchByPattern(featureNode, /^items_thumbstick_\d+$/);
    for (const ts of tsNodes) {
      const bgName = `${ts.name}_background`;
      // Search within feature subtree (skip instances), then page-level
      let tsBgNode: BaseNode | undefined;
      const featureBg = findNodesSkipInstances(featureNode, n => n.name === bgName);
      if (featureBg.length > 0) {
        tsBgNode = featureBg[0];
      } else {
        for (const child of figma.currentPage.children) {
          if (child.name === bgName) {
            tsBgNode = child;
            break;
          }
        }
      }
      descriptors.push({
        nodeId: (tsBgNode || ts).id,
        name: `${ts.name}.pdf`,
        type: "thumbstick",
        feature: featureName,
      });
    }

    // D-pads
    const dpNodes = matchByPattern(featureNode, /^items_dpad_\d+$/);
    for (const dp of dpNodes) {
      descriptors.push({ nodeId: dp.id, name: `${dp.name}.pdf`, type: "dpad", feature: featureName });
    }

    // Buttons (with reuse resolution)
    const btnNodes = matchByPattern(featureNode, /^items_button_.+$/);
    const reuseMap = new Map<string, string>();
    for (const group of skinInfo.assetReuseConfig || []) {
      if (group.length >= 2) {
        const primary = group[0];
        for (let i = 1; i < group.length; i++) {
          reuseMap.set(group[i], primary);
        }
      }
    }
    for (const btn of btnNodes) {
      const reuseTarget = reuseMap.get(btn.name);
      let exportNodeId = btn.id;
      if (reuseTarget) {
        const primaryNodes = findNodesSkipInstances(featureNode, n => n.name === reuseTarget);
        if (primaryNodes.length > 0) exportNodeId = primaryNodes[0].id;
      }
      descriptors.push({
        nodeId: exportNodeId,
        name: reuseTarget ? `${reuseTarget}.pdf` : `${btn.name}.pdf`,
        type: "button",
        feature: featureName,
      });
    }
  }

  return descriptors;
}

function filterResources(descriptors: ResourceDescriptor[], skinType: string): ResourceDescriptor[] {
  const isDelta = skinType === "delta";
  return descriptors.filter(desc => {
    if (isDelta) {
      return desc.type === "deltaBackground" || desc.type === "thumbstick";
    } else {
      return desc.type !== "deltaBackground";
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: relative frame
// ---------------------------------------------------------------------------

function makeFrame(itemNode: SceneNode, featureNode: SceneNode) {
  const ib = itemNode.absoluteBoundingBox;
  const fb = featureNode.absoluteBoundingBox;
  return {
    x: Math.round(((ib && ib.x) || 0) - ((fb && fb.x) || 0)),
    y: Math.round(((ib && ib.y) || 0) - ((fb && fb.y) || 0)),
    width: Math.round((ib && ib.width) || 0),
    height: Math.round((ib && ib.height) || 0),
  };
}

// ---------------------------------------------------------------------------
// Font loading helper
// ---------------------------------------------------------------------------

async function loadFontsForTextNode(node: TextNode): Promise<void> {
  if (node.characters.length === 0) return;
  const fontNames = node.getRangeAllFontNames(0, node.characters.length);
  await Promise.all(fontNames.map(f => figma.loadFontAsync(f)));
}

// ---------------------------------------------------------------------------
// Create skinInfo TEXT node when it doesn't exist
// ---------------------------------------------------------------------------

async function createSkinInfoNode(data: any): Promise<TextNode> {
  const font: FontName = { family: "Inter", style: "Regular" };
  await figma.loadFontAsync(font);
  const textNode = figma.createText();
  textNode.name = "skinInfo";
  textNode.fontName = font;
  textNode.fontSize = 12;
  textNode.characters = JSON.stringify(data, null, 2);
  textNode.visible = false;
  return textNode;
}

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

let currentSkinInfo: any = null;
let currentSkinInfoNode: TextNode | null = null;
let currentFeatureLayers = new Map<string, FrameNode>();
let currentBackgroundLayers = new Map<string, FrameNode>();
let currentSkinType = "manic";
let cachedInfoJson: any = null;
let cachedResourceDescriptors: ResourceDescriptor[] = [];
let nodeIdMap = new Map<string, SceneNode>();

function buildNodeIdMap(featureLayers: Map<string, FrameNode>, backgroundLayers: Map<string, FrameNode>) {
  const map = new Map<string, SceneNode>();
  for (const [, node] of featureLayers) {
    map.set(node.id, node);
    const descendants = findAllDescendants(node, () => true);
    for (const d of descendants) {
      if ("id" in d) map.set(d.id, d as SceneNode);
    }
  }
  for (const [, node] of backgroundLayers) {
    map.set(node.id, node);
  }
  for (const child of figma.currentPage.children) {
    map.set(child.id, child);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Shared init logic
// ---------------------------------------------------------------------------

function doInit() {
  const { featureLayers, backgroundLayers } = discoverLayers();
  currentFeatureLayers = featureLayers;
  currentBackgroundLayers = backgroundLayers;
  nodeIdMap = buildNodeIdMap(featureLayers, backgroundLayers);
  cachedResourceDescriptors = buildCachedResourceDescriptors(featureLayers, backgroundLayers, currentSkinInfo || DEFAULT_SKIN_INFO);
  cachedInfoJson = buildInfoJson(currentSkinInfo || DEFAULT_SKIN_INFO, currentFeatureLayers, currentBackgroundLayers, currentSkinType);
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

figma.showUI(__html__, { width: 480, height: 720 });

figma.ui.onmessage = async (msg: { type: string; payload?: any }) => {
  const { type, payload } = msg;

  switch (type) {
    case "init": {
      try {
        const result = readSkinInfo();
        if (result) {
          currentSkinInfoNode = result.node;
          currentSkinInfo = result.data;
        } else {
          // No skinInfo found — use defaults, UI will allow creating it
          currentSkinInfoNode = null;
          currentSkinInfo = { ...DEFAULT_SKIN_INFO };
        }

        doInit();

        const resources = filterResources(cachedResourceDescriptors, currentSkinType);
        figma.ui.postMessage({
          type: "initResult",
          skinInfo: currentSkinInfo,
          skinInfoExists: result !== null,
          featureNames: Array.from(currentFeatureLayers.keys()),
          backgroundNames: Array.from(currentBackgroundLayers.keys()),
          resources,
          skinType: currentSkinType,
          infoJson: cachedInfoJson,
        });
      } catch (err) {
        console.error("RetroSkinner init error:", err);
        figma.ui.postMessage({ type: "initResult", error: String(err) });
      }
      break;
    }

    case "setSkinType": {
      currentSkinType = payload as string;
      cachedInfoJson = buildInfoJson(currentSkinInfo, currentFeatureLayers, currentBackgroundLayers, currentSkinType);
      const resources = filterResources(cachedResourceDescriptors, currentSkinType);
      figma.ui.postMessage({
        type: "resourcesUpdated",
        resources,
        skinType: currentSkinType,
        infoJson: cachedInfoJson,
      });
      break;
    }

    case "updateSkinInfo": {
      const newData = payload;
      currentSkinInfo = newData;

      // Rebuild caches since skinInfo affects resource descriptors (assetReuseConfig)
      cachedResourceDescriptors = buildCachedResourceDescriptors(currentFeatureLayers, currentBackgroundLayers, currentSkinInfo);
      cachedInfoJson = buildInfoJson(currentSkinInfo, currentFeatureLayers, currentBackgroundLayers, currentSkinType);

      try {
        if (!currentSkinInfoNode) {
          // Create the skinInfo text node
          currentSkinInfoNode = await createSkinInfoNode(newData);
        } else {
          await loadFontsForTextNode(currentSkinInfoNode);
          currentSkinInfoNode.characters = JSON.stringify(newData, null, 2);
        }
        figma.ui.postMessage({ type: "skinInfoUpdated", ok: true, infoJson: cachedInfoJson, created: true });
      } catch (e) {
        figma.ui.postMessage({ type: "skinInfoUpdated", ok: false, error: String(e) });
      }
      break;
    }

    case "previewInfoJson": {
      if (!cachedInfoJson) break;
      figma.ui.postMessage({ type: "infoJsonPreview", info: cachedInfoJson });
      break;
    }

    case "exportSkin": {
      figma.ui.postMessage({ type: "exportStarted", mode: "skin" });

      const resources = filterResources(cachedResourceDescriptors, currentSkinType);
      const files: { name: string; bytes: number[] }[] = [];
      const exported = new Set<string>();

      for (const res of resources) {
        if (exported.has(res.name)) continue;
        exported.add(res.name);
        try {
          const node = nodeIdMap.get(res.nodeId) as FrameNode | undefined;
          if (!node) {
            console.warn(`Node not found for ${res.name} (id: ${res.nodeId})`);
            continue;
          }
          const bytes = await node.exportAsync({ format: "PDF" });
          files.push({ name: res.name, bytes: Array.from(bytes) });
        } catch (e) {
          console.error(`Failed to export ${res.name}:`, e);
        }
      }

      const infoStr = JSON.stringify(cachedInfoJson, null, 2);
      const infoBytes = new Uint8Array(infoStr.length);
      for (let i = 0; i < infoStr.length; i++) infoBytes[i] = infoStr.charCodeAt(i);
      files.push({ name: "info.json", bytes: Array.from(infoBytes) });

      figma.ui.postMessage({
        type: "exportFiles",
        mode: "skin",
        files,
        skinName: (currentSkinInfo && currentSkinInfo.name) || "skin",
        skinType: currentSkinType,
      });
      break;
    }
  }
};
