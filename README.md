# RetroSkinner

**Language:** English | [简体中文](README.zh-CN.md)



**Figma Plugin + Python CLI** for generating game controller skins for [Manic EMU](https://github.com/Manic-EMU/ManicEMU) and [Delta](https://github.com/rileytestut/Delta) emulators — directly from Figma designs.

---

## Why

Creating custom skins for Manic EMU or Delta emulators has always been a painful process. Designers must hand-author complex `info.json` configuration files, manually calculate pixel coordinates for every button and screen element, export each asset individually, and bundle everything into the correct archive format. A single typo in the JSON or a misaligned frame coordinate can break the entire skin.

**RetroSkinner** eliminates all of that manual work. Design your skin layout in Figma using a simple naming convention, and the tool handles everything else — it reads your layer positions, computes relative coordinates, generates a correct `info.json`, exports all assets as PDFs, and packages the final `.manicskin` or `.deltaskin` bundle.

This project is the result of the Manic EMU team's experience creating dozens of original skins. We distilled the design process into a set of conventions and automated tools so that other designers can focus on the creative work instead of fighting configuration files.

---

## Features

- **Visual-first workflow** — design skins in Figma, export with one click
- **Automatic `info.json` generation** — coordinates, sizes, and mappings computed from your Figma layout
- **Two approaches** — interactive Figma plugin or headless Python CLI for CI/CD
- **Manic EMU & Delta support** — toggle between skin types with different export behaviors
- **Asset deduplication** — share PDFs across button slots via Asset Reuse Config
- **Live preview** — inspect the generated `info.json` before exporting
- **Skin bundle packaging** — exports `.manicskin` / `.deltaskin` archives ready to install

---

## Project Structure

```
RetroSkinner/
├── Figma Plugin/               # Figma Plugin
│   ├── code.ts                 # Plugin TypeScript source
│   ├── ui.html                 # Plugin UI source (HTML/CSS/JS)
│   ├── jszip.min.js            # JSZip library (inlined at build time)
│   ├── build-ui.js             # Build script: inlines JSZip into ui.built.html
│   ├── manifest.json           # Figma plugin manifest
│   ├── tsconfig.json           # TypeScript config
│   └── package.json            # Node.js dependencies & scripts
│
├── Python CLI/                 # Python CLI
│   ├── gen_skin.py             # Python CLI entry point
│   └── skin_common.py          # Shared Python logic
│
└── README.md
```

| Approach | Technology | Best For |
|----------|-----------|----------|
| **Figma Plugin** | TypeScript + Figma Plugin API | Interactive design, real-time preview, one-click export |
| **Python CLI** | Python + Figma REST API | CI/CD, batch processing, automation |

---

## Getting Started

### Prerequisites

**Figma Plugin**

| Tool | Version | Purpose |
|------|---------|---------|
| [Figma Desktop App](https://www.figma.com/downloads/) | Latest | Run the plugin |
| [Node.js](https://nodejs.org/) | 18+ | Build the Figma plugin |

**Python CLI**

| Tool                                                         | Version | Purpose          |
| ------------------------------------------------------------ | ------- | ---------------- |
| [[Python](https://www.python.org/)](https://www.figma.com/downloads/) | 3.8+    | Run the CLI tool |

### Option A: Figma Plugin (Recommended)

#### 1. Build the plugin

```bash
cd RetroSkinner/Figma Plugin
npm install
npm run build
```

This compiles `code.ts` → `code.js` and inlines JSZip into `ui.built.html`.

#### 2. Install in Figma

1. Open **Figma Desktop App**
2. Go to **Plugins** → **Development** → **Import plugin from manifest...**
3. Select `RetroSkinner/Figma Plugin/manifest.json`
4. The plugin appears under **Plugins** → **Development** → **RetroSkinner**

#### 3. Use the plugin

1. Open your skin design page in Figma
2. Run the plugin — it discovers layers and reads configuration automatically
3. Edit skin metadata in the **Config** tab
4. Preview the generated `info.json` in the **Info Preview** tab
5. Click **Export Skin** to download the `.manicskin` or `.deltaskin` bundle

> We plan to publish RetroSkinner to the Figma Community plugin marketplace in the future, which will eliminate the build step entirely.

### Option B: Python CLI

#### 1. Install dependencies

```bash
pip install requests
```

#### 2. Set up Figma API token

```bash
export FIGMA_TOKEN="your-figma-personal-access-token"
```

Or pass it with `--token`:

```bash
python gen_skin.py "https://..." --token "your-token"
```

#### 3. Generate a skin

```bash
python gen_skin.py "https://www.figma.com/design/<file-key>/Skin?node-id=<node-id>"
```

#### CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--output-dir <dir>` | Current directory | Output directory |
| `--token <token>` | `$FIGMA_TOKEN` | Figma personal access token |
| `--skin-type <type>` | `manic` | Skin type: `manic` or `delta` |

#### Output

```
My Skin (manic)/
├── info.json
├── iphone_edgetoedge_portrait_background.pdf
├── iphone_edgetoedge_landscape_background.pdf
├── items_thumbstick_1.pdf
├── items_dpad_1.pdf
├── items_button_a.pdf
└── ...

My Skin (manic).manicskin    # ZIP archive ready to install
```

---

## Figma Design Specification

To help you better understand the specifications below, we've prepared a Figma design draft: [3DS Retro Skin](https://www.figma.com/community/file/1619596469903626183/3ds-retro-skin). You can refer to this draft while reading through the guidelines, or even use it directly to test and adjust RetroSkinner.

To use this tool, your Figma design must follow the naming conventions below. The tool discovers layers by **exact name matching** — all names are lowercase with underscores.

### Feature Layers

Top-level Frame or Component layers defining each device/orientation variant:

| Layer Name | Device | Screen Type | Orientation |
|-----------|--------|-------------|-------------|
| `iphone_edgetoedge_portrait` | iPhone | Edge to Edge | Portrait |
| `iphone_edgetoedge_landscape` | iPhone | Edge to Edge | Landscape |
| `iphone_standard_portrait` | iPhone | Standard | Portrait |
| `iphone_standard_landscape` | iPhone | Standard | Landscape |
| `ipad_standard_portrait` | iPad | Standard | Portrait |
| `ipad_standard_landscape` | iPad | Standard | Landscape |

You only need to include the variants your skin supports.

### Background Layers

Top-level frames named `<feature_name>_background`:

```
iphone_edgetoedge_portrait_background
iphone_edgetoedge_landscape_background
iphone_standard_portrait_background
...
```

- **Manic EMU skins**: these separate background layers are exported as the background asset
- **Delta skins**: the feature layer itself is used as background (no separate `_background` layer needed)

### Item Layers (inside feature layers)

Items are child nodes within each feature layer. They can be nested inside groups or sub-frames — the tool searches the entire subtree (excluding component instance internals).

| Pattern | Example | Description |
|---------|---------|-------------|
| `items_thumbstick_\d+` | `items_thumbstick_1` | Thumbstick (analog stick) |
| `items_dpad_\d+` | `items_dpad_1` | D-pad (directional pad) |
| `items_button_<name>` | `items_button_a`, `items_button_menu` | Individual button |
| `items_touchScreen_\d+` | `items_touchScreen_1` | Touch screen input area |
| `screen_\d+` | `screen_1`, `screen_2` | Game screen display area |

The `\d+` suffix determines the ordering. Button names map to input identifiers.

### Thumbstick Background (optional)

For delta skins, a thumbstick can have a separate background asset:

```
items_thumbstick_1_background
```

This can be placed as a child of the feature layer or as a top-level page node.

---

## skinInfo Configuration

A text node named `skinInfo` at the root of the Figma page holds the skin metadata as JSON. If it doesn't exist, the Figma plugin will create one automatically when you click **"Update skinInfo to Figma"**.

### Full Schema

```json
{
  "name": "My Skin Name",
  "identifier": "com.example.myskin",
  "gameTypeIdentifier": "com.delta.coreGame",
  "debug": false,
  "thumbstickConfig": [true, true],
  "assetReuseConfig": [
    ["items_button_a", "items_button_x"],
    ["items_button_b", "items_button_y"]
  ],
  "inputFrameConfig": [
    { "x": 0, "y": 0, "width": 400, "height": 240 },
    { "x": 0, "y": 240, "width": 400, "height": 300 }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name of the skin |
| `identifier` | `string` | Yes | Unique bundle identifier (e.g. `com.example.myskin`) |
| `gameTypeIdentifier` | `string` | Yes | Target emulator core (e.g. `com.delta.coreGame`) |
| `debug` | `boolean` | No | Enable debug mode (default: `false`) |
| `thumbstickConfig` | `boolean[]` | No | Per-stick assignment: `true` = left, `false` = right. Index maps to thumbstick number. |
| `assetReuseConfig` | `string[][]` | No | Asset deduplication groups. First item is primary, rest share its PDF. Manic EMU only. |
| `inputFrameConfig` | `object[]` | No | Per-screen input frame: `{ x, y, width, height }`. Maps by index to `screen_\d+` nodes. |

### Game Type Identifiers

Common values for `gameTypeIdentifier`:

Manic EMU: Refer to [this guide](https://manicemu.site/Homemade-Skin-Guide-EN/).

Delta: Refer to [this documentation](https://noah978.gitbook.io/delta-docs/skins).

---

## Skin Types

### Manic EMU

- Uses separate `_background` layers for each feature
- D-pads and buttons have `asset.normal` pointing to PDF files
- Asset Reuse Config allows sharing PDFs across multiple button slots
- Exports: backgrounds + d-pads + buttons + thumbsticks

### Delta

- Uses the feature layer itself as the background (`<feature>.pdf`)
- D-pads and buttons have **no** `asset` field (not skinned)
- Only exports: feature backgrounds + thumbsticks
- Asset Reuse Config is ignored

---

## Generated info.json Format

The tool generates an `info.json` file with the following structure:

```json
{
  "debug": false,
  "gameTypeIdentifier": "com.delta.coreGame",
  "identifier": "com.example.myskin",
  "name": "My Skin Name",
  "representations": {
    "iphone": {
      "edgeToEdge": {
        "portrait": {
          "assets": {
            "resizable": "iphone_edgetoedge_portrait_background.pdf"
          },
          "mappingSize": { "width": 750, "height": 1624 },
          "translucent": false,
          "items": [
            {
              "thumbstick": {
                "name": "items_thumbstick_1.pdf",
                "width": 120,
                "height": 120
              },
              "inputs": {
                "up": "leftThumbstickUp",
                "down": "leftThumbstickDown",
                "left": "leftThumbstickLeft",
                "right": "leftThumbstickRight"
              },
              "frame": { "x": 100, "y": 200, "width": 120, "height": 120 },
              "extendedEdges": { "top": 0, "bottom": 0, "left": 0, "right": 0 }
            },
            {
              "inputs": { "up": "up", "down": "down", "left": "left", "right": "right" },
              "asset": { "normal": "items_dpad_1.pdf" },
              "frame": { "x": 50, "y": 400, "width": 150, "height": 150 },
              "extendedEdges": { "top": 0, "bottom": 0, "left": 0, "right": 0 }
            }
          ],
          "screens": [
            {
              "outputFrame": { "x": 0, "y": 0, "width": 750, "height": 500 },
              "inputFrame": { "x": 0, "y": 0, "width": 400, "height": 240 }
            }
          ]
        }
      }
    }
  }
}
```

All coordinate values (`frame`, `outputFrame`, `mappingSize`) are computed automatically from the Figma layout. The `mappingSize` equals the feature layer's dimensions; `frame` values are positions relative to the feature layer.

---

## Development

### Build the Figma Plugin

```bash
cd RetroSkinner
npm install
npm run build       # Compile TypeScript + inline JSZip
npm run watch       # Auto-rebuild TypeScript on save
npm run build:ui    # Rebuild ui.built.html only
```

### TypeScript Compilation

The plugin compiles to **ES2015** for compatibility with Figma's embedded JavaScript engine. The following syntax is handled automatically by the compiler:

- Object spread (`{ ...obj }`) → `Object.assign()`
- `for...of` → compatible iteration
- `async/await` → preserved (supported by Figma)

The UI (`ui.html`) uses vanilla ES5 JavaScript since it runs in Figma's embedded browser iframe.

### Lint & Type Check

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"skinInfo text node not found"** | The plugin will show an empty form — fill it in and click "Update skinInfo to Figma" to create the node |
| **No feature layers found** | Ensure layer names **exactly match** the required names (case-sensitive, lowercase with underscores) |
| **Export PDF fails** | Target node must be a Frame or Component |
| **JSZip not loaded** | Run `npm run build` to inline JSZip into `ui.built.html` |
| **Plugin UI is slow** | Check that `npm run build` was run after code changes — stale `code.js` may lack optimizations |
| **Font loading error** | The plugin automatically detects and loads fonts used in the `skinInfo` text node |
| **Empty items or screens** | Verify item layers are inside (or nested within) the feature layer, not placed outside it |

---

## Contributing

Contributions are welcome! If you'd like to improve the tool

