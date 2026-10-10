/**
 * Lighting rig / 光照系统
 *
 * The Moon has no atmosphere: one hard directional sun, almost no ambient
 * fill, and a weak regolith bounce. This is what produces the characteristic
 * pitch-black shadows with razor-sharp edges.
 * 月球无大气：一束强硬平行光、几乎没有环境光、加一点月壤反照。
 * 这正是月面标志性的"纯黑硬边阴影"的来源。
 */

import * as THREE from 'three';

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{sun:THREE.DirectionalLight, earthShine:THREE.DirectionalLight,
 *            updateSun:(deg:number)=>void, getSunAngle:()=>number,
 *            setTrackMaterial:(m:THREE.ShaderMaterial)=>void}}
 */
export function createLighting(scene, renderer){
  const sun = new THREE.DirectionalLight(0xfff6e8, 5.0);
  sun.castShadow = true;
  const SHADOW_RES = (devicePixelRatio>1.5 || innerWidth>1600) ? 2048 : 1536;
  sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  const SH = 16;
  sun.shadow.camera.left=-SH; sun.shadow.camera.right=SH;
  sun.shadow.camera.top=SH;   sun.shadow.camera.bottom=-SH;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.022;
  scene.add(sun, sun.target);

  // 极弱环境光 —— 阴影保持极黑极硬
  const amb = new THREE.AmbientLight(0x1c222e, 0.13);
  scene.add(amb);
  // 月壤反照微弱补光（来自地面的二次反射）
  const bounce = new THREE.DirectionalLight(0x75736d, 0.26);
  bounce.position.set(-0.4,-1,0.3);
  scene.add(bounce);
  // 地球反照蓝色微光
  const earthShine = new THREE.DirectionalLight(0x3a62a8, 0.1);
  scene.add(earthShine);

  let sunAngle = 18;
  let trackLit = 1.0;          // 车辙受光系数
  let trackMatRef = null;      // 车辙材质引用（创建后回填）
  function updateSun(deg){
    sunAngle = deg;
    const r = THREE.MathUtils.degToRad(deg);
    const d = 46;
    sun.position.set(Math.cos(r)*d*0.62, Math.sin(r)*d, Math.cos(r)*d*0.78);
    // 低太阳角 → 更暖更弱；高角 → 更白更强
    const t = THREE.MathUtils.clamp((deg-2)/68, 0, 1);
    sun.intensity = 3.5 + t*2.4;
    // 月球无大气散射：阳光近乎纯白，仅极低太阳角时带一丝暖意
    sun.color.setHSL(0.10 - t*0.04, 0.085 - t*0.07, 0.5);
    renderer.toneMappingExposure = 1.04 - t*0.16;
    // 车辙明暗随太阳角度联动（车辙材质可能尚未创建，故先存值后同步）
    trackLit = 0.85 + t*0.5;
    if(trackMatRef) trackMatRef.uniforms.uLit.value = trackLit;
  }
  updateSun(18);


  return {
    sun, earthShine, amb, bounce,
    updateSun,
    getSunAngle: () => sunAngle,
    /** Track material is created later; register it so sun changes reach it. */
    setTrackMaterial(m){ trackMatRef = m; if(m) m.uniforms.uLit.value = trackLit; },
  };
}
