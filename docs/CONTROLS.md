# Controls reference / 操作参考

## Mouse & touch / 鼠标与触控

| Input | Action | 操作 |
|---|---|---|
| Left-drag / one finger | Orbit | 旋转视角 |
| Scroll / pinch | Zoom (1.6 m – 220 m) | 缩放 |
| Right-drag / two fingers | Pan | 平移 |

Damping (`enableDamping`) is on, so motion eases out after you release.
The camera cannot go below the horizon (`maxPolarAngle`).

已启用阻尼（`enableDamping`），松手后视角会缓慢停止。
相机不会穿到地平线以下（由 `maxPolarAngle` 限制）。

## Panel / 控制面板

### 跟随视角 / 自由视角 — Follow vs. free camera

Follow mode smoothly re-centres the orbit target on the rover while leaving
orbit and zoom fully under your control. Free mode leaves the target fixed, so
the rover drives out of frame — useful for inspecting terrain.

跟随模式会把轨道中心平滑移到探测车上，同时完全保留你的旋转与缩放自由。
自由模式下中心固定，探测车会驶出画面 —— 便于观察地形。

### ⏸ 暂停行驶 — Pause / resume

Freezes forward motion, wheel rotation, rut laying and dust emission. The
camera mast and robotic arm keep their slow idle motion, and all camera
interaction stays live.

冻结前进、车轮转动、车辙铺设与扬尘。相机桅杆与机械臂保持缓慢的待机动作，
相机交互仍然可用。

### 行驶速度 — Speed, 0.05× – 3×

Multiplies the 0.42 m/s base cruise speed. Wheel rotation always matches
ground speed exactly (no-slip), so even at 3× the wheels do not skid visually.
Realistic rovers move at the low end; 1× is the intended look.

对 0.42 m/s 基准速度做倍率缩放。车轮转速始终与地速精确匹配（纯滚动），
因此即使 3× 也不会出现视觉打滑。真实探测车处于低速端，1× 是设计观感。

### 太阳高度 — Sun elevation, 2° – 70°

The single most dramatic control. It adjusts sun position, intensity, colour
temperature, tone-mapping exposure **and** rut contrast together.

- **2°–10°** — grazing light, very long shadows, maximum surface texture and
  the most visible wheel ruts. Closest to the Apollo surface photographs.
- **15°–25°** — the default range; balanced detail.
- **40°–70°** — near-overhead, short shadows, flatter and brighter.

影响最显著的控件。它会同时调整太阳位置、强度、色温、色调映射曝光**以及**辙印对比度。

- **2°–10°** —— 掠射光，极长阴影，表面质感与车辙最明显，最接近阿波罗任务的实拍照片
- **15°–25°** —— 默认区间，细节均衡
- **40°–70°** —— 接近正午，阴影短，画面更平更亮

### 星空亮度 — Star brightness, 0% – 150%

Scales per-star colour. At 0% the sky is pure black (the Moon has no airglow,
and real surface photographs often show no stars at all because of exposure).
Above 100% is artistic licence.

缩放每颗星的颜色。0% 时天空纯黑（月球没有气辉，且真实月面照片因曝光原因
常常完全看不到星星）。高于 100% 属于艺术化处理。

## HUD / 状态显示

Bottom-left:

| Field | Meaning |
|---|---|
| 行驶距离 | Cumulative odometer in metres |
| 速度 | Current ground speed, m/s |
| 视角模式 | 跟随 (follow) or 自由 (free) |
| 帧率 | Measured frame rate; one decimal below 10 so slow environments are honest |

If 帧率 reads below ~5 on a desktop machine, your browser is almost certainly
falling back to software rendering — check `chrome://gpu`.

若在桌面机器上帧率低于约 5，几乎可以确定浏览器回退到了软件渲染 ——
请检查 `chrome://gpu`。
