# RetroSkinner

**语言:** 简体中文 | [English](README.md)



**Figma 插件 + Python 命令行工具**，用于为 [Manic EMU](https://github.com/Manic-EMU/ManicEMU) 和 [Delta](https://github.com/rileytestut/Delta) 模拟器生成游戏手柄皮肤 —— 直接基于 Figma 设计稿。

---

## 为什么做这个

为 Manic EMU 或 Delta 模拟器创建自定义皮肤一直是个痛苦的过程。设计师需要手动编写复杂的 `info.json` 配置文件，为每个按键和屏幕元素手动计算像素坐标，单独导出每个资源，最后将所有内容打包成正确的存档格式。JSON 中的一个错字或一个坐标错位，都可能导致整个皮肤失效。

**RetroSkinner** 消除了所有的手动工作。您只需在 Figma 中使用简单的命名规范设计皮肤布局，该工具会处理其余所有事情 —— 读取图层位置、计算相对坐标、生成正确的 `info.json`、将所有资源导出为 PDF，并打包最终的 `.manicskin` 或 `.deltaskin` 文件。

该项目是 Manic EMU 团队在制作大量原始皮肤的经验基础上诞生的。我们将设计过程提炼为一套命名规范并实现自动化工具，让其他设计师能够专注于创意工作，而不是与配置文件“搏斗”。

---

## 功能特性

- **视觉优先的工作流程** —— 在 Figma 中设计皮肤，一键导出
- **自动生成 `info.json`** —— 坐标、尺寸和映射关系从 Figma 布局中自动计算
- **两种使用方式** —— 交互式 Figma 插件，或用于 CI/CD 的无头 Python 命令行工具
- **支持 Manic EMU 和 Delta** —— 可根据皮肤类型切换，导出行为不同
- **资源去重** —— 通过资产复用配置在多个按键间共享 PDF
- **实时预览** —— 导出前可预览生成的 `info.json`
- **皮肤打包** —— 导出即装即用的 `.manicskin` / `.deltaskin` 归档文件

---

## 项目结构

```
RetroSkinner/
├── Figma Plugin/               # Figma 插件
│   ├── code.ts                 # 插件 TypeScript 源代码
│   ├── ui.html                 # 插件 UI 源代码 (HTML/CSS/JS)
│   ├── jszip.min.js            # JSZip 库 (构建时内联)
│   ├── build-ui.js             # 构建脚本: 将 JSZip 内联到 ui.built.html
│   ├── manifest.json           # Figma 插件清单
│   ├── tsconfig.json           # TypeScript 配置
│   └── package.json            # Node.js 依赖和脚本
│
├── Python CLI/                 # Python 命令行工具
│   ├── gen_skin.py             # Python CLI 入口点
│   └── skin_common.py          # 共享的 Python 逻辑
│
└── README.md
```

| 方式 | 技术栈 | 最佳适用场景 |
|------|--------|-------------|
| **Figma 插件** | TypeScript + Figma 插件 API | 交互式设计、实时预览、一键导出 |
| **Python 命令行工具** | Python + Figma REST API | CI/CD、批量处理、自动化 |

---

## 快速开始

### 前置要求

**Figma 插件**

| 工具 | 版本 | 用途 |
|------|------|------|
| [Figma 桌面应用](https://www.figma.com/downloads/) | 最新版 | 运行插件 |
| [Node.js](https://nodejs.org/) | 18+ | 构建 Figma 插件 |

**Python 命令行工具**

| 工具 | 版本 | 用途 |
|------|------|------|
| [Python](https://www.python.org/) | 3.8+ | 运行命令行工具 |

### 方式 A：Figma 插件（推荐）

#### 1. 构建插件

```bash
cd RetroSkinner/Figma Plugin
npm install
npm run build
```

这会编译 `code.ts` → `code.js` 并将 JSZip 内联到 `ui.built.html` 中。

#### 2. 在 Figma 中安装

1. 打开 **Figma 桌面应用**
2. 进入 **Plugins** → **Development** → **Import plugin from manifest...**
3. 选择 `RetroSkinner/Figma Plugin/manifest.json`
4. 插件将出现在 **Plugins** → **Development** → **RetroSkinner** 下

#### 3. 使用插件

1. 在 Figma 中打开您的皮肤设计页面
2. 运行插件 —— 它会自动发现图层并读取配置
3. 在 **Config** 标签页编辑皮肤元数据
4. 在 **Info Preview** 标签页预览生成的 `info.json`
5. 点击 **Export Skin** 下载 `.manicskin` 或 `.deltaskin` 文件

> 我们计划将来将 RetroSkinner 发布到 Figma 社区插件市场，届时将无需构建步骤。

### 方式 B：Python 命令行工具

#### 1. 安装依赖

```bash
pip install requests
```

#### 2. 设置 Figma API 令牌

```bash
export FIGMA_TOKEN="your-figma-personal-access-token"
```

或者通过 `--token` 参数传递：

```bash
python gen_skin.py "https://..." --token "your-token"
```

#### 3. 生成皮肤

```bash
python gen_skin.py "https://www.figma.com/design/<file-key>/Skin?node-id=<node-id>"
```

#### 命令行选项

| 选项 | 默认值 | 描述 |
|------|--------|------|
| `--output-dir <dir>` | 当前目录 | 输出目录 |
| `--token <token>` | `$FIGMA_TOKEN` | Figma 个人访问令牌 |
| `--skin-type <type>` | `manic` | 皮肤类型：`manic` 或 `delta` |

#### 输出

```
My Skin (manic)/
├── info.json
├── iphone_edgetoedge_portrait_background.pdf
├── iphone_edgetoedge_landscape_background.pdf
├── items_thumbstick_1.pdf
├── items_dpad_1.pdf
├── items_button_a.pdf
└── ...

My Skin (manic).manicskin    # 即装即用的 ZIP 归档文件
```

---

## Figma 设计规范

为了更好地帮助您理解以下规范，我们准备了一份 Figma 设计草稿：[3DS Retro Skin](https://www.figma.com/community/file/1619596469903626183/3ds-retro-skin)。您可以在阅读规范时参考此草稿，甚至可以直接使用它来测试和调整 RetroSkinner。

要使用此工具，您的 Figma 设计必须遵循以下命名规范。工具通过**精确名称匹配**来发现图层 —— 所有名称均为小写，单词间用下划线分隔。

### 功能图层

顶层 Frame 或 Component 图层，定义了每种设备/方向的变体：

| 图层名称 | 设备 | 屏幕类型 | 方向 |
|-----------|--------|-------------|-------------|
| `iphone_edgetoedge_portrait` | iPhone | 全屏 | 竖屏 |
| `iphone_edgetoedge_landscape` | iPhone | 全屏 | 横屏 |
| `iphone_standard_portrait` | iPhone | 标准 | 竖屏 |
| `iphone_standard_landscape` | iPhone | 标准 | 横屏 |
| `ipad_standard_portrait` | iPad | 标准 | 竖屏 |
| `ipad_standard_landscape` | iPad | 标准 | 横屏 |

您只需包含皮肤支持的变体即可。

### 背景图层

顶层 Frame，命名为 `<feature_name>_background`：

```
iphone_edgetoedge_portrait_background
iphone_edgetoedge_landscape_background
iphone_standard_portrait_background
...
```

- **Manic EMU 皮肤**：这些独立的背景图层会被导出为背景资源
- **Delta 皮肤**：功能图层本身被用作背景（不需要单独的 `_background` 图层）

### 控件图层（位于功能图层内部）

控件是每个功能图层内的子节点。它们可以嵌套在组或子 Frame 中 —— 工具会搜索整个子树（不包括组件实例内部）。

| 模式 | 示例 | 描述 |
|---------|---------|-------------|
| `items_thumbstick_\d+` | `items_thumbstick_1` | 摇杆（模拟摇杆） |
| `items_dpad_\d+` | `items_dpad_1` | 方向键 |
| `items_button_<name>` | `items_button_a`, `items_button_menu` | 单个按键 |
| `items_touchScreen_\d+` | `items_touchScreen_1` | 触摸屏输入区域 |
| `screen_\d+` | `screen_1`, `screen_2` | 游戏屏幕显示区域 |

`\d+` 后缀决定了顺序。按键名称映射到输入标识符。

### 摇杆背景（可选）

对于 Delta 皮肤，摇杆可以有独立的背景资源：

```
items_thumbstick_1_background
```

它可以作为功能图层的子节点放置，也可以作为顶层的页面节点放置。

---

## skinInfo 配置

在 Figma 页面根节点处名为 `skinInfo` 的文本节点，用于保存皮肤元数据（JSON 格式）。如果不存在该节点，当您点击 **"Update skinInfo to Figma"** 时，Figma 插件会自动创建一个。

### 完整结构

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

### 字段说明

| 字段 | 类型 | 是否必需 | 描述 |
|-------|------|----------|-------------|
| `name` | `string` | 是 | 皮肤的显示名称 |
| `identifier` | `string` | 是 | 唯一包标识符（例如 `com.example.myskin`） |
| `gameTypeIdentifier` | `string` | 是 | 目标模拟器核心（例如 `com.delta.coreGame`） |
| `debug` | `boolean` | 否 | 启用调试模式（默认值：`false`） |
| `thumbstickConfig` | `boolean[]` | 否 | 每个摇杆的分配：`true` = 左，`false` = 右。索引映射到摇杆编号。 |
| `assetReuseConfig` | `string[][]` | 否 | 资源去重组。第一项为主资源，其余项共享其 PDF。仅限 Manic EMU。 |
| `inputFrameConfig` | `object[]` | 否 | 每个屏幕的输入框：`{ x, y, width, height }`。按索引映射到 `screen_\d+` 节点。 |

### 游戏类型标识符

`gameTypeIdentifier` 的常用值：

Manic EMU 参考[这里](https://manicemu.site/Homemade-Skin-Guide-CN/)

Delta 参考[这里](https://noah978.gitbook.io/delta-docs/skins)

---

## 皮肤类型

### Manic EMU

- 为每个功能使用单独的 `_background` 图层
- 方向键和按键有指向 PDF 文件的 `asset.normal`
- 资产复用配置允许在多个按键槽位之间共享 PDF
- 导出：背景 + 方向键 + 按键 + 摇杆

### Delta

- 使用功能图层本身作为背景（`<feature>.pdf`）
- 方向键和按键**没有** `asset` 字段（不应用皮肤）
- 仅导出：功能背景 + 摇杆
- 资产复用配置被忽略

---

## 生成的 info.json 格式

该工具会生成如下结构的 `info.json` 文件：

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

所有坐标值（`frame`、`outputFrame`、`mappingSize`）都是从 Figma 布局自动计算的。`mappingSize` 等于功能图层的尺寸；`frame` 值是相对于功能图层的位置。

---

## 开发

### 构建 Figma 插件

```bash
cd RetroSkinner
npm install
npm run build       # 编译 TypeScript + 内联 JSZip
npm run watch       # 保存时自动重新编译 TypeScript
npm run build:ui    # 仅重建 ui.built.html
```

### TypeScript 编译

该插件编译到 **ES2015**，以确保与 Figma 嵌入式 JavaScript 引擎的兼容性。以下语法由编译器自动处理：

- 对象展开（`{ ...obj }`） → `Object.assign()`
- `for...of` → 兼容的迭代方式
- `async/await` → 保留（Figma 支持）

UI（`ui.html`）使用原生的 ES5 JavaScript，因为它运行在 Figma 的嵌入式浏览器 iframe 中。

### Lint 和类型检查

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript 类型检查
```

---

## 故障排除

| 问题 | 解决方案 |
|---------|----------|
| **未找到 "skinInfo" 文本节点** | 插件将显示一个空表单 —— 填写后点击 "Update skinInfo to Figma" 即可创建该节点 |
| **未找到功能图层** | 确保图层名称**完全匹配**所需的名称（区分大小写，小写加下划线） |
| **导出 PDF 失败** | 目标节点必须是 Frame 或 Component |
| **JSZip 未加载** | 运行 `npm run build` 将 JSZip 内联到 `ui.built.html` |
| **插件 UI 响应慢** | 检查代码更改后是否运行了 `npm run build` —— 过时的 `code.js` 可能缺少优化 |
| **字体加载错误** | 插件会自动检测并加载 `skinInfo` 文本节点中使用的字体 |
| **items 或 screens 为空** | 验证控件图层是否在功能图层内部（或嵌套在其中），而不是放在外部 |

---

## 贡献

欢迎贡献！如果您想改进该工具。