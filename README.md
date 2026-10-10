# 🌙 Lunar Rover 3D · 月面探测车

An interactive, fully **procedural** 3D lunar scene built with [Three.js](https://threejs.org/).
A high-detail six-wheeled rover crawls across a realistic Moon surface, pressing
chevron-tread ruts into the regolith behind it.

一个基于 [Three.js](https://threejs.org/) 的交互式 **全程序化** 3D 月面场景。
一台高细节六轮探测车在写实月球表面缓慢行驶，在身后压出带人字花纹的车辙。

> **Every pixel is generated from code.** No textures, models, fonts or binary
> assets are downloaded or bundled — all surfaces come from procedural canvas
> textures and all geometry from primitive composition.
>
> **所有画面都由代码生成。** 不含任何贴图、模型、字体或二进制素材 ——
> 表面全部来自程序化 canvas 贴图，几何体全部由基础体素组合而成。

**[English](#english) · [中文](#中文)**

---

<a name="english"></a>

## English

### Features

**The rover** — assembled from ~40 primitive geometries, no imported model:

- Six wire-mesh wheels with raised grousers (the real cleats that give traction in dust)
- Rocker-bogie suspension; each leg travels independently over terrain relief
- Articulated solar array, high-gain parabolic dish, whip antenna
- Stereo camera mast that pans slowly, plus a multi-joint sampling arm
- Instrument boxes, multi-layer insulation (gold foil), carbon-fibre panels, cabling and warning decals
- Materials distinguish polished metal / matte coating / foil / carbon / glass via metalness, roughness and clearcoat

**The world:**

- Terrain from layered fBm noise — rolling hills down to regolith graininess
- ~100 craters with parabolic bowls, **raised rims** and ejecta aprons; large craters avoid the driving path
- Scattered rocks in three size classes, drawn with `InstancedMesh`
- 4,200 instanced stars with per-star size and colour-temperature variation
- Earth above the horizon with a Fresnel atmospheric limb glow
- Physically-motivated lighting: one hard directional sun, near-zero ambient, faint regolith bounce — producing the Moon's signature pitch-black, razor-edged shadows

**Simulation detail:**

- Wheel tracks are **ribbons laid between successive positions**, so they follow terrain relief instead of floating or sinking
- Ruts fade very slowly — there is no wind on the Moon
- Dust follows **pure ballistic arcs** under lunar gravity (1.62 m/s²) and settles on contact; it never billows
- Wheels roll at the no-slip rate for the distance travelled

### Requirements

| | |
|---|---|
| Browser | Any with **WebGL 2** — Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **Hardware acceleration** | **Required for usable frame rate** (see note below) |
| Node.js | ≥ 18 — only to run the dev server and tests |
| Network | Only for the CDN build; see [Offline use](#offline-use) |

> ⚠️ **GPU note.** The scene renders a 320×320 displaced terrain, several
> shadow-casting instanced groups, 4,200 stars and multiple 512–1024 px
> procedural textures. On a normal GPU this is a 60 fps workload. Under a
> **software rasteriser** (headless CI, `--disable-gpu`, some remote desktops,
> VMs without GPU passthrough) the first frame alone can take minutes. If the
> scene loads but crawls, check `chrome://gpu` and confirm WebGL is
> hardware-accelerated before changing any scene parameter.

### Quick start

The fastest route — **no install, no server**:

```bash
# Just open the self-contained file in a browser
open dist/lunar-rover-standalone.html      # macOS
xdg-open dist/lunar-rover-standalone.html  # Linux
start dist\lunar-rover-standalone.html     # Windows
```

That single HTML file contains the entire scene. It loads Three.js from a CDN,
so it needs a network connection on first open.

For the **modular source build** (recommended for development):

```bash
git clone https://github.com/minghong-chen/lunar-rover-3d.git
cd lunar-rover-3d
npm install          # installs three (dev only, for tests + offline bundle)
npm start            # serves at http://127.0.0.1:8080
```

Then open <http://127.0.0.1:8080/index.html>.

> ES modules cannot be loaded over `file://`, so the modular build **must** be
> served over HTTP. `npm start` runs a zero-dependency Node server. The
> standalone file in `dist/` has no such restriction.

<a name="offline-use"></a>

### Offline use

To run with **no network at all**, vendor Three.js into the repo:

```bash
npm install
npm run vendor       # copies three into vendor/ and writes index.offline.html
npm start
```

Then open <http://127.0.0.1:8080/index.offline.html>.

### Controls

| Input | Action |
|---|---|
| **Left-drag** | Orbit the camera |
| **Scroll / pinch** | Zoom |
| **Right-drag** | Pan |
| **跟随视角 / 自由视角** | Toggle follow vs. free camera |
| **⏸ 暂停行驶** | Pause / resume driving |
| **行驶速度** | Speed multiplier, 0.05×–3× |
| **太阳高度** | Sun elevation 2°–70° — changes shadow length, contrast and rut visibility |
| **星空亮度** | Star brightness 0–150% |

The HUD (bottom-left) reports odometer, speed, camera mode and frame rate.

### Project layout

```
lunar-rover-3d/
├── index.html                  Modular entry point (serve over HTTP)
├── dist/
│   └── lunar-rover-standalone.html   Self-contained single file, no build step
├── src/
│   ├── main.js                 Assembly + main loop; GPU assumptions documented here
│   ├── world/
│   │   ├── noise.js            Seeded PRNG, gradient noise, fBm, ridged  (pure, tested)
│   │   ├── terrain.js          Height field + crater generation          (pure, tested)
│   │   ├── terrainMesh.js      Terrain mesh, far ring, rock scatter
│   │   ├── path.js             Closed CatmullRom driving loop            (tested)
│   │   ├── tracks.js           Chevron-tread wheel ruts
│   │   └── dust.js             Ballistic dust particles
│   ├── rover/
│   │   ├── buildRover.js       All rover geometry
│   │   └── kinematics.js       Heading / attitude maths                  (pure, tested)
│   ├── scene/
│   │   ├── textures.js         Procedural canvas textures
│   │   ├── materials.js        Material library
│   │   ├── environment.js      Synthetic reflection environment
│   │   ├── lighting.js         Sun, ambient, bounce, Earthshine
│   │   ├── starfield.js        Instanced stars
│   │   └── earth.js            Earth with limb glow
│   └── ui/
│       └── controlPanel.js     HUD bindings + formatters                 (tested)
├── tests/                      Node unit tests + optional browser smoke test
├── scripts/                    Dev server, syntax gate, vendor helper
├── examples/                   Example scene config (no secrets)
├── docs/                       Architecture and controls reference
└── .github/workflows/ci.yml    Lint + unit tests on push
```

### Scripts

```bash
npm start            # dev server (default http://127.0.0.1:8080)
npm start -- --port 3000
npm test             # Node unit tests (48 tests)
npm run lint         # parse every module as an ES module
npm run vendor       # vendor three.js for offline use
npm run test:browser # browser smoke test — needs playwright + a GPU
```

### Testing

Unit tests cover the pure logic — noise determinism, terrain geometry, path
continuity, rover kinematics and HUD formatting:

```bash
npm test
```

Several tests exist specifically to lock bugs that occurred during development:

- **The rover drove sideways.** The heading formula aligned local **+Z** to the
  path tangent, but the body's long axis is **+X**. `tests/kinematics.test.mjs`
  asserts `forward · tangent ≈ 1` for every direction, and separately asserts
  that the old formula really is perpendicular — so the regression cannot return.
- **Pitch and roll were swapped,** tilting the chassis the wrong way over
  craters. A pure front-up tilt must now move only pitch, and a pure left-up
  tilt only roll.
- **Low frame rates displayed as `0`.** The HUD formatter keeps one decimal
  below 10 fps.

The browser smoke test (`npm run test:browser`) drives a real browser and
asserts the scene initialises, a WebGL context exists, the odometer advances and
no console errors appear. Playwright is **deliberately not a dependency**; the
script exits cleanly with a `SKIPPED` notice when it is absent.

### Security

This project is a static front-end scene. It has **no API keys, tokens,
credentials or network calls** beyond optionally fetching Three.js from a CDN.
`.env.example` exists only to document dev-server ports, and `.gitignore`
excludes `.env`, keys and certificates.

### License

MIT — see [LICENSE](LICENSE). Three.js is MIT licensed and is not redistributed
unless you run `npm run vendor`.

---

<a name="中文"></a>

## 中文

### 功能特性

**探测车** —— 由约 40 个基础几何体组合而成，不含任何导入模型：

- 六个金属丝网车轮，带凸起的 grouser 胎刺（真实探测车用于在月壤中获得抓地力的结构）
- rocker-bogie 摇臂悬挂，每条腿独立随地形起伏运动
- 可动太阳能板阵列、高增益抛物面碟形天线、鞭状天线
- 缓慢摆动的立体相机桅杆，以及多关节取样机械臂
- 仪器舱、多层隔热金箔、碳纤维板、线缆与警示贴标
- 材质通过 metalness / roughness / clearcoat 区分抛光金属、哑光涂层、隔热金箔、碳纤维与玻璃

**月面世界：**

- 多层 fBm 噪声生成地形 —— 从大尺度丘陵到月壤颗粒感
- 约 100 个陨石坑，含抛物线坑底、**抬升的坑沿**与坑外溅射裙；大坑自动避开行驶路径
- 三个尺寸档的散落岩石，使用 `InstancedMesh` 绘制
- 4,200 颗实例化星辰，每颗的大小与色温均有差异
- 地平线上方悬挂地球，带菲涅尔大气边缘辉光
- 符合物理直觉的光照：一束强硬平行太阳光、几乎为零的环境光、微弱月壤反照 —— 由此产生月面标志性的纯黑硬边阴影

**仿真细节：**

- 车辙是**在相邻位置之间铺设的条带**，因此贴合地形起伏，不会悬空或陷入地下
- 辙印衰减极慢 —— 月球上没有风
- 尘埃在月球重力（1.62 m/s²）下走**纯弹道抛物线**，触地即停，不会翻滚飘散
- 车轮按行驶距离以纯滚动（无滑移）速率转动

### 运行环境

| | |
|---|---|
| 浏览器 | 支持 **WebGL 2** 的浏览器 —— Chrome 90+、Firefox 90+、Safari 15+、Edge 90+ |
| **硬件加速** | **必需，否则帧率不可用**（见下方说明） |
| Node.js | ≥ 18 —— 仅用于运行开发服务器与测试 |
| 网络 | 仅 CDN 版本需要；见 [离线使用](#离线使用) |

> ⚠️ **关于 GPU。** 场景需绘制 320×320 的起伏地形、多个投射阴影的实例化组、
> 4,200 颗星辰以及多张 512–1024 px 程序化贴图。在普通独显/集显上这是 60fps 量级负载。
> 但在**软件光栅化**环境下（无头 CI、`--disable-gpu`、部分远程桌面、
> 无显卡直通的虚拟机），仅首帧就可能耗时数分钟。
> 若画面能加载但极度卡顿，请先在 `chrome://gpu` 确认 WebGL 为硬件加速，
> 再考虑调整场景参数。

### 快速开始

最快方式 —— **免安装、免服务器**：

```bash
# 直接在浏览器中打开自包含文件
open dist/lunar-rover-standalone.html      # macOS
xdg-open dist/lunar-rover-standalone.html  # Linux
start dist\lunar-rover-standalone.html     # Windows
```

这个单 HTML 文件包含完整场景。它从 CDN 加载 Three.js，首次打开需要网络连接。

使用**模块化源码版本**（推荐用于开发）：

```bash
git clone https://github.com/minghong-chen/lunar-rover-3d.git
cd lunar-rover-3d
npm install          # 安装 three（仅开发用：测试与离线打包）
npm start            # 启动于 http://127.0.0.1:8080
```

然后打开 <http://127.0.0.1:8080/index.html>。

> ES 模块无法通过 `file://` 加载，因此模块化版本**必须**经 HTTP 提供。
> `npm start` 会启动一个零依赖的 Node 服务器。`dist/` 中的单文件版本没有此限制。

<a name="离线使用"></a>

### 离线使用

要做到**完全不需要网络**，将 Three.js 落地到仓库中：

```bash
npm install
npm run vendor       # 复制 three 到 vendor/ 并生成 index.offline.html
npm start
```

然后打开 <http://127.0.0.1:8080/index.offline.html>。

### 操作方式

| 操作 | 效果 |
|---|---|
| **左键拖动** | 旋转视角 |
| **滚轮 / 双指捏合** | 缩放 |
| **右键拖动** | 平移 |
| **跟随视角 / 自由视角** | 切换相机跟随与自由模式 |
| **⏸ 暂停行驶** | 暂停 / 继续行驶 |
| **行驶速度** | 速度倍率，0.05×–3× |
| **太阳高度** | 太阳仰角 2°–70° —— 改变阴影长度、对比度与辙印可见度 |
| **星空亮度** | 星空亮度 0–150% |

左下角 HUD 显示行驶里程、速度、视角模式与帧率。

### 目录结构

见上方 [Project layout](#project-layout)。各模块职责：

| 路径 | 职责 |
|---|---|
| `src/main.js` | 装配各模块、主循环；GPU 假设在此文件头部说明 |
| `src/world/noise.js` | 带种子的 PRNG、梯度噪声、fBm、ridged（纯函数，已测试） |
| `src/world/terrain.js` | 地形高度场与陨石坑生成（纯函数，已测试） |
| `src/world/terrainMesh.js` | 地形网格、远景外环、岩石散布 |
| `src/world/path.js` | 闭合 CatmullRom 行驶路径（已测试） |
| `src/world/tracks.js` | 带人字花纹的车辙 |
| `src/world/dust.js` | 弹道式尘埃粒子 |
| `src/rover/buildRover.js` | 探测车全部几何体 |
| `src/rover/kinematics.js` | 航向与姿态数学（纯函数，已测试） |
| `src/scene/*` | 贴图、材质、环境、光照、星空、地球 |
| `src/ui/controlPanel.js` | HUD 绑定与格式化（已测试） |

### 可用命令

```bash
npm start            # 开发服务器（默认 http://127.0.0.1:8080）
npm start -- --port 3000
npm test             # Node 单元测试（48 项）
npm run lint         # 以 ES 模块方式解析所有模块
npm run vendor       # 将 three.js 落地以便离线使用
npm run test:browser # 浏览器冒烟测试 —— 需要 playwright 与 GPU
```

### 测试说明

单元测试覆盖纯逻辑部分：噪声确定性、地形几何、路径连续性、
探测车运动学与 HUD 格式化：

```bash
npm test
```

其中若干测试专门用于锁定开发期出现过的真实缺陷：

- **探测车横着走。** 航向公式把局部 **+Z** 对齐路径切线，而车身长轴是 **+X**。
  `tests/kinematics.test.mjs` 对所有方向断言 `前进向量 · 切线 ≈ 1`，
  并单独断言旧公式确实是垂直的 —— 确保该缺陷无法复现。
- **俯仰与侧倾接错了轴**，导致过坑时车身歪向错误方向。
  现在纯车头抬起只应改变俯仰，纯左侧抬起只应改变侧倾。
- **低帧率显示为 `0`。** HUD 格式化在低于 10fps 时保留一位小数。

浏览器冒烟测试（`npm run test:browser`）驱动真实浏览器，断言场景完成初始化、
WebGL 上下文存在、里程递增且无控制台错误。Playwright **刻意未列为依赖**；
缺失时脚本以 `SKIPPED` 提示正常退出。

### 安全性

本项目是纯静态前端场景，**不含任何 API 密钥、令牌、凭据**，
除可选地从 CDN 获取 Three.js 外没有任何网络调用。
`.env.example` 仅用于说明开发服务器端口；`.gitignore` 已排除 `.env`、密钥与证书文件。

### 许可

MIT —— 见 [LICENSE](LICENSE)。Three.js 采用 MIT 许可，
除非运行 `npm run vendor`，否则本仓库不再分发其代码。
