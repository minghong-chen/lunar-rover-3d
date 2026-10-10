/**
 * Lunar terrain height field & crater field / 月球地形高度场与陨石坑
 *
 * The height function is shared by the terrain mesh, the rock scatter, the
 * rover's wheel-contact solver and the wheel-track placement, so there is a
 * single source of truth for "where is the ground".
 *
 * 地形网格、岩石散布、探测车贴地求解与车辙铺设都共用同一个高度函数，
 * 保证"地面在哪里"只有唯一答案。
 */

import { makeRng, buildPermutation, createNoise, DEFAULT_SEED } from './noise.js';

/** Terrain extent in metres (square, centred on the origin). */
export const TERRAIN_SIZE = 1100;
/** Plane subdivisions per side. */
export const TERRAIN_SEG = 320;
/** Radius of the closed driving loop, in metres. */
export const PATH_RADIUS = 46;

/**
 * Generate the crater field.
 * 生成陨石坑分布。
 *
 * Large craters are kept clear of the driving path so the rover never has to
 * climb an impossible rim; small ones may sit close to it.
 * 大坑会避开行驶路径，小坑允许靠近。
 *
 * @param {() => number} rnd - seeded RNG
 * @returns {Array<{x:number,z:number,R:number,depth:number,rim:number}>}
 */
export function generateCraters(rnd) {
  const craters = [];

  for (let i = 0; i < 78; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.pow(rnd(), 0.55) * TERRAIN_SIZE * 0.46;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const dPath = Math.abs(Math.hypot(x, z) - PATH_RADIUS);
    let R = 5 + Math.pow(rnd(), 2.0) * 52;
    if (dPath < R * 1.25) R = Math.min(R, Math.max(2.4, dPath * 0.7));
    if (R < 2.2) continue;
    craters.push({ x, z, R, depth: R * (0.13 + rnd() * 0.1), rim: 0.3 + rnd() * 0.22 });
  }

  // Extra small craters near the camera start so the view always has detail.
  // 近景补充小坑，保证镜头里一定有坑。
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2, rr = 12 + rnd() * 78;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const R = 2.6 + rnd() * 7.5;
    const dPath = Math.abs(Math.hypot(x, z) - PATH_RADIUS);
    if (dPath < R * 1.1) continue;
    craters.push({ x, z, R, depth: R * (0.15 + rnd() * 0.11), rim: 0.34 + rnd() * 0.2 });
  }

  return craters;
}

/**
 * Build the terrain height sampler.
 * 构建地形高度采样器。
 *
 * @param {object} [opts]
 * @param {number} [opts.seed=DEFAULT_SEED]
 * @returns {{height:(x:number,z:number)=>number, craters:Array, noise:object, rng:()=>number}}
 */
export function createTerrain(opts = {}) {
  const seed = opts.seed ?? DEFAULT_SEED;
  const rng = makeRng(seed);
  const noise = createNoise(buildPermutation(rng));
  const craters = opts.craters ?? generateCraters(rng);
  const { fbm } = noise;

  /**
   * Terrain height at a world XZ position, in metres.
   * 世界坐标 XZ 处的地形高度（米）。
   */
  function height(x, z) {
    // Large-scale rolling hills, then progressively finer detail.
    let h  = fbm(x * 0.0045, z * 0.0045, 5) * 11.0;
    h += fbm(x * 0.016, z * 0.016, 4) * 2.9;
    h += fbm(x * 0.062, z * 0.062, 3) * 0.56;
    h += fbm(x * 0.23,  z * 0.23,  2) * 0.1;   // regolith graininess

    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const dx = x - c.x, dz = z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const outer = c.R * 1.42;
      if (d > outer) continue;
      const t = d / c.R;
      if (t < 1) {
        // Smooth parabolic bowl.
        const bowl = (1 - t * t);
        h -= c.depth * bowl * bowl * 1.18;
        // Raised rim, lifting from t = 0.66 outward.
        if (t > 0.66) {
          const k = (t - 0.66) / 0.34;
          h += c.depth * c.rim * Math.sin(k * Math.PI * 0.95) * 1.5;
        }
      } else {
        // Ejecta apron outside the rim.
        const k = (d - c.R) / (outer - c.R);
        h += c.depth * c.rim * 1.5 * Math.pow(1 - k, 2.1) * 0.72;
      }
    }
    return h;
  }

  return { height, craters, noise, rng };
}
