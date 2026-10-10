# Architecture / 架构说明

## Design principle: zero binary assets / 设计原则：零二进制素材

Every surface in this scene is drawn into an offscreen `<canvas>` at startup and
every mesh is composed from Three.js primitives. There are no `.glb`, `.png`,
`.hdr` or font files anywhere in the repository.

本场景的所有表面都在启动时绘制到离屏 `<canvas>`，所有网格都由 Three.js
基础几何体组合而成。仓库中不存在任何 `.glb`、`.png`、`.hdr` 或字体文件。

This has two consequences worth knowing:

- The repo is tiny and can never suffer a broken asset path.
- Startup does real work — texture synthesis and shader compilation happen
  before the first frame. On a GPU this is well under a second; under software
  rendering it can take minutes.

## Module graph / 模块依赖

```
main.js
├── world/noise.js          (pure — no three, no DOM)
├── world/terrain.js        → noise
├── world/terrainMesh.js    → terrain, three
├── world/path.js           → terrain, three
├── world/tracks.js         → scene/textures, three
├── world/dust.js           → rover/kinematics, scene/textures, three
├── rover/kinematics.js     (pure — no three, no DOM)
├── rover/buildRover.js     → three, BufferGeometryUtils
├── scene/textures.js       → noise, three  (needs DOM canvas)
├── scene/materials.js      → three
├── scene/environment.js    → scene/textures, three
├── scene/lighting.js       → three
├── scene/starfield.js      → noise, three
├── scene/earth.js          → three
└── ui/controlPanel.js      (pure except DOM lookups)
```

The two **pure** modules (`noise.js`, `kinematics.js`) carry the logic most
likely to harbour subtle bugs, which is exactly why they are dependency-free
and directly unit tested in Node.

两个**纯函数**模块（`noise.js`、`kinematics.js`）承载了最容易出现隐蔽缺陷的逻辑，
这正是它们不依赖任何外部库、并在 Node 中直接单元测试的原因。

## The axis convention (important) / 轴约定（重要）

The rover's body length runs along **local +X**:

```
        +Y (up)
         │
         │     +X  nose / 车头（相机桅杆、机械臂一侧）
         │    ╱
         │   ╱
         └──────── +Z  left side / 车辆左侧
```

For a yaw rotation `h` about +Y:

```
local (1,0,0) → world ( cos h, 0, −sin h)
local (0,0,1) → world ( sin h, 0,  cos h)
```

Aligning the nose to a tangent `(tx, tz)` therefore needs
`h = atan2(−tz, tx)`.

Because the nose is +X, **pitch rotates about Z** and **roll about X** — not the
other way round. Both of these were real defects during development; see
`tests/kinematics.test.mjs`.

车身长轴为局部 +X。因此俯仰绕 Z 轴、侧倾绕 X 轴 —— 不能对调。
这两点在开发期都曾是真实缺陷，相关断言见 `tests/kinematics.test.mjs`。

## Rendering decisions worth explaining / 几个值得解释的渲染决策

### Why the wheel ruts use a plain ShaderMaterial

The lunar ambient light is deliberately near zero so shadows read as pitch
black. A lit material (`MeshStandardMaterial`) on the ground plane therefore
renders almost black too, which made the ruts **completely invisible**. The
track material is an unlit `ShaderMaterial` whose brightness is driven by a
`uLit` uniform wired to the sun-angle slider.

月面环境光被刻意压到接近零，以获得纯黑阴影。因此地面上的受光材质
（`MeshStandardMaterial`）也几乎全黑，导致辙印**完全不可见**。
车辙改用不受光的 `ShaderMaterial`，其明暗由与太阳角度滑块联动的 `uLit` uniform 驱动。

### Why there is a synthetic reflection environment

Fully metallic PBR surfaces reflect their environment; with nothing to reflect
they render black. The Moon has no sky glow, so `scene/environment.js`
synthesises a minimal equirectangular map — black space, a hard sun spot, a
faint Earth, and a bright regolith half-dome, which is the real dominant bounce
source on the lunar surface.

全金属 PBR 表面依赖环境反射；没有可反射内容时会渲染为黑色。
月面没有天空散射，因此 `scene/environment.js` 合成一张极简环境贴图 ——
黑色太空、硬太阳亮斑、微弱地球，以及明亮的月壤半球（月面上真正的主要反照来源）。

### Why PMREM is not used

`PMREMGenerator` prefilters the environment for physically correct roughness
response, but its compute cost stalled startup badly on weak GPUs. The
equirectangular texture is used directly with mipmaps instead — visually
sufficient here and essentially free.

`PMREMGenerator` 会对环境贴图做预滤波以获得物理正确的粗糙度响应，
但其计算开销在弱 GPU 上会严重拖慢启动。此处直接使用带 mipmap 的
等距圆柱贴图 —— 视觉上足够，且开销几乎为零。

### Why wheel geometry is merged

Each wire-mesh wheel is built from ~200 small meshes (wires, chords, grousers,
spokes, bolts). Left as a group that is ~200 draw calls per wheel, or ~1,200
for six. `mergeByMaterial()` in `buildRover.js` merges them per material,
cutting this to a handful.

每个丝网车轮由约 200 个小网格构成（经纬钢丝、胎刺、辐条、螺栓）。
若保持为组，单轮约 200 次 draw call，六轮约 1,200 次。
`buildRover.js` 中的 `mergeByMaterial()` 按材质合并，将其降至个位数。

### Why FPS is measured on wall-clock time

The simulation delta is clamped (`Math.min(dt, 0.05)`) so that a backgrounded
tab does not teleport the rover. An earlier build derived the FPS readout from
that clamped value, which inflated the number. It now uses `performance.now()`
deltas, and keeps one decimal below 10 fps so a genuinely slow environment
reports `0.2` rather than `0`.

仿真时间步长被钳制（`Math.min(dt, 0.05)`），以免切换标签页后探测车瞬移。
早期版本用这个被钳制的值计算帧率，导致读数虚高。现在改用
`performance.now()` 的真实差值，并在低于 10fps 时保留一位小数，
使极慢环境显示 `0.2` 而非 `0`。
