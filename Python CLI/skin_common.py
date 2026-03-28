"""
skin_common.py - Shared logic for Delta Skin generation.

Provides constants, URL parsing, node traversal, geometry helpers,
and info.json building that both web API and local MCP versions share.

All functions operate on a common node dict format:
{
    "name": str,
    "id": str,
    "absoluteBoundingBox": {"x": float, "y": float, "width": float, "height": float},
    "children": [...],
    "characters": str  (optional, for text nodes)
}
"""

import re
import urllib.parse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURE_NAMES = [
    "iphone_edgetoedge_portrait",
    "iphone_edgetoedge_landscape",
    "iphone_standard_portrait",
    "iphone_standard_landscape",
    "ipad_standard_portrait",
    "ipad_standard_landscape",
]


# ---------------------------------------------------------------------------
# Figma URL parsing
# ---------------------------------------------------------------------------


def parse_figma_url(url):
    """Extract file_key and node_id from a Figma design URL."""
    match = re.search(r"/design/([^/]+)/[^?]*\?.*node-id=([^&]+)", url)
    if not match:
        raise ValueError(f"Cannot parse Figma URL: {url}")
    file_key = match.group(1)
    node_id = urllib.parse.unquote(match.group(2)).replace("-", ":")
    return file_key, node_id


# ---------------------------------------------------------------------------
# Feature name parsing
# ---------------------------------------------------------------------------


def parse_feature_name(name):
    """'iphone_edgetoedge_landscape' -> ('iphone', 'edgeToEdge', 'landscape')"""
    parts = name.lower().split("_")
    if len(parts) != 3:
        return None, None, None
    device, dtype, orientation = parts
    if dtype == "edgetoedge":
        dtype = "edgeToEdge"
    return device, dtype, orientation


# ---------------------------------------------------------------------------
# Node tree traversal
# ---------------------------------------------------------------------------


def find_nodes(node, predicate, results=None):
    """Recursively collect nodes where *predicate(node)* is truthy."""
    if results is None:
        results = []
    if predicate(node):
        results.append(node)
    for child in node.get("children", []):
        find_nodes(child, predicate, results)
    return results


def find_by_name(node, name):
    return find_nodes(node, lambda n: n.get("name") == name)


def find_by_pattern(node, pattern):
    rx = re.compile(pattern)
    return find_nodes(node, lambda n: rx.match(n.get("name", "")))


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def abs_box(node):
    """Return absoluteBoundingBox as a dict with x, y, width, height."""
    box = node.get("absoluteBoundingBox", {})
    return {
        "x": box.get("x", 0),
        "y": box.get("y", 0),
        "width": box.get("width", 0),
        "height": box.get("height", 0),
    }


def relative_frame(item_node, feature_node):
    """Item position & size relative to the feature layer."""
    ib = abs_box(item_node)
    fb = abs_box(feature_node)
    return {
        "x": round(ib["x"] - fb["x"]),
        "y": round(ib["y"] - fb["y"]),
        "width": round(ib["width"]),
        "height": round(ib["height"]),
    }


# ---------------------------------------------------------------------------
# Build items list for one feature
# ---------------------------------------------------------------------------


def build_items(feature_node, skin_info, export_fn, skin_type="manic", root_node=None):
    """
    Return the items list for one feature representation.

    export_fn(node, pdf_name): exports the node as PDF with given filename.
    Called only once per unique pdf_name (deduplication handled here).

    skin_type: "manic" (default) or "delta".
    In delta mode, d-pads and buttons have no asset.normal and are not exported.
    """
    thumbstick_config = skin_info.get("thumbstickConfig", [])
    is_delta = (skin_type == "delta")

    reuse_map = {}
    if not is_delta:
        for group in skin_info.get("assetReuseConfig", []):
            if len(group) >= 2:
                primary = group[0]
                for secondary in group[1:]:
                    reuse_map[secondary] = primary

    exported = set()
    items = []

    # --- Thumbsticks ---
    ts_nodes = find_by_pattern(feature_node, r"^items_thumbstick_\d+$")
    ts_nodes.sort(key=lambda n: int(re.search(r"\d+", n["name"]).group()))
    for ts_node in ts_nodes:
        idx = int(re.search(r"\d+", ts_node["name"]).group())
        ts_box = abs_box(ts_node)
        pdf_name = f"{ts_node['name']}.pdf"

        # Export from _background suffix node if it exists, otherwise from the node itself
        bg_name = f"{ts_node['name']}_background"
        bg_nodes = find_by_name(feature_node, bg_name)
        if not bg_nodes and root_node is not None:
            bg_nodes = find_by_name(root_node, bg_name)
        export_node = bg_nodes[0] if bg_nodes else ts_node

        if pdf_name not in exported:
            export_fn(export_node, pdf_name)
            exported.add(pdf_name)

        is_left = thumbstick_config[idx - 1] if idx - 1 < len(thumbstick_config) else True
        prefix = "left" if is_left else "right"

        items.append({
            "thumbstick": {
                "name": pdf_name,
                "width": round(ts_box["width"]),
                "height": round(ts_box["height"]),
            },
            "inputs": {
                "up": f"{prefix}ThumbstickUp",
                "down": f"{prefix}ThumbstickDown",
                "left": f"{prefix}ThumbstickLeft",
                "right": f"{prefix}ThumbstickRight",
            },
            "frame": relative_frame(ts_node, feature_node),
            "extendedEdges": {"top": 0, "bottom": 0, "left": 0, "right": 0},
        })

    # --- D-pads ---
    dp_nodes = find_by_pattern(feature_node, r"^items_dpad_\d+$")
    dp_nodes.sort(key=lambda n: int(re.search(r"\d+", n["name"]).group()))
    for dp_node in dp_nodes:
        pdf_name = f"{dp_node['name']}.pdf"
        if not is_delta and pdf_name not in exported:
            export_fn(dp_node, pdf_name)
            exported.add(pdf_name)

        entry = {
            "inputs": {"up": "up", "down": "down", "left": "left", "right": "right"},
            "frame": relative_frame(dp_node, feature_node),
            "extendedEdges": {"top": 0, "bottom": 0, "left": 0, "right": 0},
        }
        if not is_delta:
            entry["asset"] = {"normal": pdf_name}
        items.append(entry)

    # --- Buttons ---
    btn_nodes = find_by_pattern(feature_node, r"^items_button_.+$")
    for btn_node in btn_nodes:
        btn_name = btn_node["name"]
        input_name = btn_name.rsplit("_", 1)[-1]

        if not is_delta:
            if btn_name in reuse_map:
                pdf_name = f"{reuse_map[btn_name]}.pdf"
            else:
                pdf_name = f"{btn_name}.pdf"

            if pdf_name not in exported:
                export_node = btn_node
                if btn_name in reuse_map:
                    primary_nodes = find_by_name(feature_node, reuse_map[btn_name])
                    if primary_nodes:
                        export_node = primary_nodes[0]
                export_fn(export_node, pdf_name)
                exported.add(pdf_name)

            items.append({
                "inputs": [input_name],
                "frame": relative_frame(btn_node, feature_node),
                "extendedEdges": {"top": 0, "bottom": 0, "left": 0, "right": 0},
                "asset": {"normal": pdf_name},
            })
        else:
            items.append({
                "inputs": [input_name],
                "frame": relative_frame(btn_node, feature_node),
                "extendedEdges": {"top": 0, "bottom": 0, "left": 0, "right": 0},
            })

    # --- Touch screens ---
    touch_nodes = find_by_pattern(feature_node, r"^items_touchScreen_\d+$")
    touch_nodes.sort(key=lambda n: int(re.search(r"\d+", n["name"]).group()))
    for t_node in touch_nodes:
        items.append({
            "inputs": {"x": "touchScreenX", "y": "touchScreenY"},
            "frame": relative_frame(t_node, feature_node),
        })

    return items


# ---------------------------------------------------------------------------
# Build screens list for one feature
# ---------------------------------------------------------------------------


def build_screens(feature_node, skin_info):
    """Return the screens list for one feature representation."""
    input_frame_config = skin_info.get("inputFrameConfig", [])

    screen_nodes = find_by_pattern(feature_node, r"^screen_\d+$")
    screen_nodes.sort(key=lambda n: int(re.search(r"\d+", n["name"]).group()))

    screens = []
    for i, scr_node in enumerate(screen_nodes):
        entry = {"outputFrame": relative_frame(scr_node, feature_node)}
        if input_frame_config and i < len(input_frame_config):
            entry["inputFrame"] = input_frame_config[i]
        screens.append(entry)
    return screens


# ---------------------------------------------------------------------------
# Discover feature & background layers from root children
# ---------------------------------------------------------------------------


def discover_layers(root_node):
    """
    Scan root_node children for feature and background layers.
    Returns (feature_layers, background_layers) dicts keyed by feature name.
    """
    children = root_node.get("children", [])
    feature_layers = {}
    background_layers = {}

    for child in children:
        cname = child.get("name", "").lower()
        for fn in FEATURE_NAMES:
            if cname == fn:
                feature_layers[fn] = child
            elif cname == f"{fn}_background":
                background_layers[fn] = child

    return feature_layers, background_layers


# ---------------------------------------------------------------------------
# Build complete info.json structure
# ---------------------------------------------------------------------------


def build_info(skin_info, feature_layers, background_layers, export_fn, skin_type="manic", root_node=None):
    """
    Build the complete info.json dict.

    export_fn(node, pdf_name): exports node as PDF.

    skin_type: "manic" (default) or "delta".
    In delta mode, the feature root layer is used as background (named <feature>.pdf),
    not a separate _background layer. D-pads and buttons have no asset field.
    """
    info = {
        "debug": skin_info.get("debug", False),
        "gameTypeIdentifier": skin_info.get("gameTypeIdentifier", ""),
        "identifier": skin_info.get("identifier", ""),
        "name": skin_info.get("name", ""),
        "representations": {},
    }

    is_delta = (skin_type == "delta")

    for feature_name, feature_node in feature_layers.items():
        device, dtype, orientation = parse_feature_name(feature_name)
        if device is None:
            continue

        fbox = abs_box(feature_node)
        print(f"\n  [{feature_name}] {round(fbox['width'])}x{round(fbox['height'])}")

        reps = info["representations"]
        reps.setdefault(device, {}).setdefault(dtype, {})

        rep = {}

        # Background
        if is_delta:
            # Delta: feature root layer IS the background
            bg_pdf = f"{feature_name}.pdf"
            export_fn(feature_node, bg_pdf)
            rep["assets"] = {"resizable": bg_pdf}
        else:
            # Manic: separate _background layer
            bg_pdf = f"{feature_name}_background.pdf"
            if feature_name in background_layers:
                bg_node = background_layers[feature_name]
                export_fn(bg_node, bg_pdf)
                rep["assets"] = {"resizable": bg_pdf}
            else:
                rep["assets"] = {"resizable": ""}

        # Mapping size
        rep["mappingSize"] = {
            "width": round(fbox["width"]),
            "height": round(fbox["height"]),
        }

        # Translucent
        rep["translucent"] = False

        # Items
        rep["items"] = build_items(feature_node, skin_info, export_fn, skin_type, root_node)

        # Screens
        rep["screens"] = build_screens(feature_node, skin_info)

        reps[device][dtype][orientation] = rep

    return info
