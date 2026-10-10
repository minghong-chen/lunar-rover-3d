/**
 * Entry point / 程序入口
 *
 * Assembles the lunar scene from the feature modules and runs the main loop.
 * 由各功能模块装配月面场景并驱动主循环。
 */

/**
 * RUNTIME ASSUMPTION — WebGL hardware / 运行环境假设 —— WebGL 硬件
 *
 * This scene assumes a GPU-backed WebGL context (hardware acceleration on).
 * It renders ~6 shadow-casting instanced groups, a 320x320 displaced terrain,
 * 4,200 instanced stars and several 512-1024px procedural canvas textures.
 *
 * On a mid-range laptop GPU this is a 60 fps workload. Under a SOFTWARE
 * rasteriser (headless CI, `--disable-gpu`, remote desktop, or a VM with no
 * passthrough) the same frame costs seconds rather than milliseconds, and the
 * first frame alone — shader compile plus texture upload — can take minutes.
 * That is an environment limitation, not a defect in this code.
 *
 * If the scene loads but crawls, verify chrome://gpu reports hardware
 * acceleration for WebGL before tuning any scene parameter.
 *
 * 本场景假设使用由 GPU 支持的 WebGL 上下文（已启用硬件加速）。
 * 在中端笔记本独显/集显上为 60fps 量级负载；若运行在软件光栅化环境
 * （无头 CI、--disable-gpu、远程桌面、无显卡直通的虚拟机），
 * 单帧耗时会从毫秒级退化到秒级，仅首帧的着色器编译与贴图上传就可能耗时数分钟。
 * 这属于环境限制而非代码缺陷。如画面能加载但极慢，
 * 请先在 chrome://gpu 确认 WebGL 为硬件加速，再考虑调整场景参数。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { makeRng, buildPermutation, createNoise, DEFAULT_SEED } from './world/noise.js';
import { createTerrain, TERRAIN_SIZE } from './world/terrain.js';
import { createTerrainMesh, createRocks } from './world/terrainMesh.js';
import { createPath, BASE_SPEED } from './world/path.js';
import { createTracks } from './world/tracks.js';
import { createDust } from './world/dust.js';

import { createTextures } from './scene/textures.js';
import { createMaterials } from './scene/materials.js';
import { buildEnvironment } from './scene/environment.js';
import { createLighting } from './scene/lighting.js';
import { createStarfield } from './scene/starfield.js';
import { createEarth } from './scene/earth.js';

import { buildRover } from './rover/buildRover.js';
import {
  headingFromTangent, localToWorldOffset, leftNormal,
  solveAttitude, WHEEL_RADIUS,
} from './rover/kinematics.js';

import { bindControlPanel } from './ui/controlPanel.js';

/* ---------------- renderer / scene / camera ---------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 20000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 1.6;
controls.maxDistance = 220;
controls.maxPolarAngle = Math.PI * 0.496;   // never look from below ground

/* ---------------- procedural assets ---------------- */
const TEX = createTextures(renderer);
const MAT = createMaterials(TEX);
const ENV = buildEnvironment();

// Per-material reflection strength: metals obvious, coatings and regolith restrained.
// 逐材质反射强度：金属明显，涂装与月壤克制。
[['polished', 0.85], ['mesh', 0.8], ['steel', 0.8], ['darkSteel', 0.6], ['foil', 1.0],
 ['carbon', 0.55], ['solar', 0.75], ['glass', 1.0], ['paint', 0.3], ['darkPaint', 0.3],
 ['warnRed', 0.2], ['warnYellow', 0.2], ['navy', 0.2], ['cable', 0.25],
 ['solarBack', 0.25], ['ground', 0.14], ['rock', 0.14],
].forEach(([k, v]) => {
  if (MAT[k]) { MAT[k].envMap = ENV; MAT[k].envMapIntensity = v; MAT[k].needsUpdate = true; }
});

/* ---------------- world ---------------- */
const terrain = createTerrain({ seed: DEFAULT_SEED });
const groundAt = (x, z) => terrain.height(x, z);
const rockRng = makeRng(DEFAULT_SEED + 101);

createTerrainMesh(scene, MAT, terrain.height, terrain.noise, rockRng);
createRocks(scene, MAT, terrain.height, terrain.noise, rockRng);

const lighting = createLighting(scene, renderer);
const starfield = createStarfield(scene);
const { applyStarBrightness } = starfield;
const earthGroup = createEarth(scene, TEX);
scene.add(earthGroup);

const { curve: PATH, length: PATH_LEN } = createPath();

const clock = new THREE.Clock();
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const { layTrack, fadeTracks, material: trackMat } = createTracks(scene, groundAt, clock, aniso);
// Register the track material so sun-angle changes reach its uniform.
// 注册车辙材质，使太阳角度变化能同步到其 uniform。
lighting.setTrackMaterial(trackMat);

const { emitDust, updateDust } = createDust(scene, groundAt);

/* ---------------- rover ---------------- */
const roverParts = buildRover(MAT, ENV);
const { rover, wheels, mastYaw, mastHead, armJ1, armJ3, BODY_H } = roverParts;
scene.add(rover);

/* ---------------- state ---------------- */
const state = { followMode: true, driving: true, speedScale: 1.0 };
let pathT = 0;
let distance = 0;
let wheelSpin = 0;
let smPitch = 0, smRoll = 0;
let fpsAcc = 0, fpsFrames = 0, lastFrameMs = performance.now();
const lastTrackPos = new THREE.Vector3(1e9, 0, 1e9);
const _followTarget = new THREE.Vector3();

const panel = bindControlPanel(state, {
  updateSun: (v) => lighting.updateSun(v),
  applyStarBrightness,
  onFollowChange: () => {},
});

/* ---------------- rover placement ---------------- */
/**
 * Place the rover on the path for this frame and solve its attitude.
 * 将探测车按本帧位置放置到路径上并求解姿态。
 *
 * @returns {{heading:number, fx:number, fz:number}}
 */
function placeRover(dt) {
  const p = PATH.getPointAt(pathT);
  const tangent = PATH.getTangentAt(pathT);

  // Body length is local +X, so align +X to the tangent. Using atan2(tx, tz)
  // here would align +Z instead and make the rover drive sideways.
  // 车身长轴为 +X，故将 +X 对齐切线；若用 atan2(tx,tz) 会对齐 +Z 而导致横着走。
  const heading = headingFromTangent(tangent.x, tangent.z);

  const contacts = [];
  for (const w of wheels) {
    const off = localToWorldOffset(w.worldX, w.worldZ, heading);
    const gy = groundAt(p.x + off.x, p.z + off.z);
    w.groundY = gy;
    contacts.push({ lx: w.worldX, lz: w.worldZ, groundY: gy });
  }

  const { avgY, pitchZ, rollX } = solveAttitude(contacts);

  rover.position.x = p.x;
  rover.position.z = p.z;
  rover.position.y += (avgY - rover.position.y) * Math.min(1, dt * 3.4);

  // Heading tracks the tangent exactly (no lag in turns); only the
  // terrain-induced pitch/roll is damped, which is the suspension behaviour.
  // 航向严格跟随切线（转弯不滞后）；只对地形引起的俯仰/侧倾做悬挂阻尼。
  smPitch += (pitchZ - smPitch) * Math.min(1, dt * 3.0);
  smRoll  += (rollX  - smRoll)  * Math.min(1, dt * 3.0);
  rover.quaternion.setFromEuler(new THREE.Euler(smRoll, heading, smPitch, 'YXZ'));

  // Independent rocker travel per leg.
  for (const w of wheels) {
    const target = THREE.MathUtils.clamp((w.groundY - avgY) * 0.55, -0.1, 0.1);
    w.leg.position.y += ((-BODY_H / 2 + 0.06 + target) - w.leg.position.y) * Math.min(1, dt * 4.5);
  }

  return { heading, fx: tangent.x, fz: tangent.z };
}

/* ---------------- main loop ---------------- */
function animate() {
  requestAnimationFrame(animate);

  const dtRaw = clock.getDelta();
  const dt = Math.min(dtRaw, 0.05);   // clamp so tab-switches don't teleport
  const t = clock.elapsedTime;

  const vel = state.driving ? BASE_SPEED * state.speedScale : 0;
  if (vel > 0) {
    pathT = (pathT + (vel * dt) / PATH_LEN) % 1;
    distance += vel * dt;
    wheelSpin += (vel * dt) / WHEEL_RADIUS;
  }

  const nav = placeRover(dt);
  const heading = nav.heading;

  for (const w of wheels) w.mesh.rotation.z = -wheelSpin;

  // Slow instrument motion keeps the scene alive without looking frantic.
  mastYaw.rotation.y = Math.sin(t * 0.16) * 0.62;
  if (mastHead) mastHead.rotation.z = -0.1 + Math.sin(t * 0.1) * 0.09;
  armJ1.rotation.y = -0.45 + Math.sin(t * 0.08) * 0.16;
  armJ3.rotation.z = 1.5 + Math.sin(t * 0.11) * 0.1;

  if (vel > 0 && rover.position.distanceTo(lastTrackPos) > 0.30) {
    layTrack(rover.position.x, rover.position.z, nav.fx, nav.fz);
    lastTrackPos.copy(rover.position);

    const cosH = Math.cos(heading), sinH = Math.sin(heading);
    for (const w of wheels) {
      if (w.worldX < -0.4) {   // rear wheels only
        const wx = rover.position.x + w.worldX * cosH + w.worldZ * sinH;
        const wz = rover.position.z - w.worldX * sinH + w.worldZ * cosH;
        emitDust(wx, w.groundY, wz, Math.atan2(nav.fz, nav.fx), 2);
      }
    }
  }

  updateDust(dt);
  fadeTracks(t);

  // Shadow camera follows the rover to keep hard, high-resolution shadows.
  const sunAngle = lighting.getSunAngle();
  lighting.sun.target.position.copy(rover.position);
  const sunRad = THREE.MathUtils.degToRad(sunAngle);
  lighting.sun.position.copy(rover.position).add(new THREE.Vector3(
    Math.cos(sunRad) * 28,
    Math.sin(sunRad) * 46,
    Math.cos(sunRad) * 35,
  ));
  lighting.sun.target.updateMatrixWorld();
  // Faint blue fill from Earthshine.
  // 来自地球反照的微弱蓝色补光。
  lighting.earthShine.position.copy(earthGroup.position).normalize();

  if (state.followMode) {
    // Follow mode only re-centres the orbit target on the rover, so the user
    // keeps full freedom to orbit and zoom while tracking stays smooth.
    // 跟随模式只把轨道中心平滑移到探测车上，用户仍可自由旋转与缩放。
    _followTarget.set(rover.position.x, rover.position.y + 0.9, rover.position.z);
    controls.target.lerp(_followTarget, Math.min(1, dt * 2.6));
  }

  controls.update();

  // Keep the starfield centred on the camera so it reads as infinitely far.
  // 星空随相机平移，呈现无限远效果。
  starfield.stars.position.copy(camera.position);

  renderer.render(scene, camera);

  // FPS from real wall-clock time, not the clamped simulation delta.
  // 帧率用真实墙钟时间统计，避免被 dt 钳制放大。
  const nowMs = performance.now();
  fpsAcc += (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;
  fpsFrames++;
  if (fpsAcc > 0.5) {
    panel.setHud({ fps: fpsFrames / fpsAcc, distance, velocity: vel });
    fpsAcc = 0; fpsFrames = 0;
  }
}

/* ---------------- bootstrap ---------------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
});

// Initial camera pose and sun angle.
const p0 = PATH.getPointAt(0);
rover.position.set(p0.x, groundAt(p0.x, p0.z), p0.z);
camera.position.set(p0.x + 6.4, rover.position.y + 3.1, p0.z + 6.8);
controls.target.set(p0.x, rover.position.y + 0.85, p0.z);
lighting.updateSun(18);
applyStarBrightness(1.0);

renderer.compile(scene, camera);
const loader = document.getElementById('loader');
if (loader) loader.style.display = 'none';

animate();
