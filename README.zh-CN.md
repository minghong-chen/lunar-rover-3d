# 🌙 月面探测车 3D

> 本文件是 [README.md](README.md) 中文部分的独立版本，内容与其一致。
> 完整的中英对照文档请见 [README.md](README.md)。

一个基于 [Three.js](https://threejs.org/) 的交互式 **全程序化** 3D 月面场景。
一台高细节六轮探测车在写实月球表面缓慢行驶，在身后压出带人字花纹的车辙。

**所有画面都由代码生成** —— 不含任何贴图、模型、字体或二进制素材。

## 三十秒上手

```bash
# 方式一：免安装，直接打开单文件版本（需要网络以加载 CDN 上的 Three.js）
open dist/lunar-rover-standalone.html

# 方式二：模块化源码版本
npm install && npm start      # 打开 http://127.0.0.1:8080

# 方式三：完全离线
npm install && npm run vendor && npm start
#                              打开 http://127.0.0.1:8080/index.offline.html
```

## 运行环境要求

- **支持 WebGL 2 的浏览器**：Chrome 90+ / Firefox 90+ / Safari 15+ / Edge 90+
- **必须启用硬件加速**。场景在普通显卡上为 60fps 量级负载，但在软件光栅化环境
  （无头 CI、`--disable-gpu`、部分远程桌面、无显卡直通的虚拟机）下，
  仅首帧就可能耗时数分钟。若画面能加载但极度卡顿，请先在 `chrome://gpu`
  确认 WebGL 为硬件加速。
- **Node.js ≥ 18**：仅用于开发服务器与测试，运行场景本身不需要。

## 为什么模块化版本需要服务器

ES 模块无法通过 `file://` 协议加载（浏览器的 CORS 限制）。
`npm start` 会启动一个零依赖的 Node 静态服务器。
如果你只想看效果，直接打开 `dist/lunar-rover-standalone.html` 即可，无此限制。

## 操作方式

| 操作 | 效果 |
|---|---|
| 左键拖动 | 旋转视角 |
| 滚轮 / 双指捏合 | 缩放 |
| 右键拖动 | 平移 |
| 跟随视角 / 自由视角 | 切换相机模式 |
| ⏸ 暂停行驶 | 暂停 / 继续 |
| 行驶速度 | 0.05×–3× |
| 太阳高度 | 2°–70°，改变阴影长度与辙印可见度 |
| 星空亮度 | 0–150% |

## 常用命令

```bash
npm start              # 开发服务器
npm start -- --port 3000
npm test               # 单元测试（48 项）
npm run lint           # 模块语法检查
npm run vendor         # 离线化 three.js
npm run test:browser   # 浏览器冒烟测试（需 playwright + GPU）
```

## 场景参数调整

多数可调参数集中在以下位置：

| 想改什么 | 改哪里 |
|---|---|
| 随机种子（换一片月面） | `src/world/noise.js` 的 `DEFAULT_SEED` |
| 地形大小、路径半径 | `src/world/terrain.js` 顶部常量 |
| 行驶基准速度 | `src/world/path.js` 的 `BASE_SPEED` |
| 陨石坑数量与尺寸 | `src/world/terrain.js` 的 `generateCraters()` |
| 岩石数量与分布 | `src/world/terrainMesh.js` 的 `ROCK_SETS` |
| 星辰数量 | `src/scene/starfield.js` 的 `STAR_COUNT` |
| 车辙花纹与深浅 | `src/world/tracks.js` 的 `trackTexture()` |
| 材质质感 | `src/scene/materials.js` |

`examples/scene.config.example.json` 列出了这些参数的推荐取值，可作对照。

## 性能调优

若在你的机器上帧率不理想，按以下顺序调整收益最大：

1. 降低阴影分辨率：`src/scene/lighting.js` 的 `SHADOW_RES`（2048 → 1024）
2. 减少地形细分：`src/world/terrain.js` 的 `TERRAIN_SEG`（320 → 192）
3. 减少星辰数量：`STAR_COUNT`（4200 → 1500）
4. 降低像素比上限：`src/main.js` 中 `setPixelRatio` 的上限（2 → 1.5）

## 许可

MIT —— 见 [LICENSE](LICENSE)。
