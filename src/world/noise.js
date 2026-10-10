/**
 * Procedural noise utilities / 程序化噪声工具
 *
 * Pure functions with no Three.js or DOM dependency, so they can be unit
 * tested directly in Node. All scene geometry and textures are generated
 * from these primitives — the project ships no binary assets.
 *
 * 纯函数，不依赖 Three.js 或 DOM，可在 Node 中直接单元测试。
 * 场景中所有几何体与贴图都由这些基础函数生成，项目不包含任何二进制素材。
 */

/**
 * Deterministic xorshift32 PRNG factory.
 * 确定性 xorshift32 伪随机数生成器。
 *
 * @param {number} seed - Non-zero 32-bit seed / 非零 32 位种子
 * @returns {() => number} Generator returning floats in [0, 1)
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // avoid the degenerate all-zero state
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/** Smoothstep-style fade curve used by the gradient noise. */
export const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Build a 512-entry permutation table from a seeded RNG.
 * 用带种子的随机源构建 512 项置换表。
 *
 * @param {() => number} rng
 * @returns {Uint8Array} length 512
 */
export function buildPermutation(rng) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

function grad2(hash, x, y) {
  switch (hash & 7) {
    case 0: return  x + y;
    case 1: return  x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return  x;
    case 5: return -x;
    case 6: return  y;
    default: return -y;
  }
}

/**
 * Create a noise sampler bound to one permutation table.
 * 创建绑定到某个置换表的噪声采样器。
 *
 * @param {Uint8Array} perm - 512-entry table from {@link buildPermutation}
 */
export function createNoise(perm) {
  /** 2D gradient noise, output roughly in [-1, 1]. */
  function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y],     ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const x1 = lerp(grad2(aa, xf, yf),     grad2(ba, xf - 1, yf),     u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  /** Fractal Brownian motion (summed octaves), normalised to ~[-1, 1]. */
  function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * noise2(x * f, y * f);
      norm += a;
      a *= gain;
      f *= lac;
    }
    return sum / norm;
  }

  /** Ridged multifractal — used for foil creases and distant hills. */
  function ridged(x, y, oct = 4) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * (1 - Math.abs(noise2(x * f, y * f)));
      norm += a;
      a *= 0.5;
      f *= 2.07;
    }
    return sum / norm;
  }

  return { noise2, fbm, ridged };
}

/** Default seed used by the shipped scene (keeps the world reproducible). */
export const DEFAULT_SEED = 20261010;
