/**
 * Material library / 材质库
 *
 * Distinguishes polished metal, matte coating, multi-layer insulation (gold
 * foil), carbon fibre and glass via metalness/roughness/clearcoat so the
 * rover reads as real hardware rather than uniform plastic.
 * 通过 metalness / roughness / clearcoat 区分抛光金属、哑光涂层、
 * 隔热金箔、碳纤维与玻璃，使探测车呈现真实硬件质感。
 */

import * as THREE from 'three';

/**
 * @param {Record<string, THREE.Texture>} TEX - from createTextures()
 * @returns {Record<string, THREE.Material>}
 */
export function createMaterials(TEX){
  const MAT = {};
  // 抛光金属（铝合金结构件）
  MAT.polished = new THREE.MeshPhysicalMaterial({
    color:0xc9ced6, metalness:1.0, roughness:0.14, clearcoat:0.5, clearcoatRoughness:0.1 });
  // 哑光浅色涂层（主舱）
  MAT.paint = new THREE.MeshPhysicalMaterial({
    map:TEX.paint, normalMap:TEX.paintN, normalScale:new THREE.Vector2(1.25,1.25),
    color:0xf2f0ec, metalness:0.22, roughness:0.58, clearcoat:0.34, clearcoatRoughness:0.42 });
  // 深灰哑光（仪器箱）
  MAT.darkPaint = new THREE.MeshStandardMaterial({
    map:TEX.paint, normalMap:TEX.paintN, color:0x4b5058, metalness:0.38, roughness:0.62 });
  // 隔热金箔（高反射金色 MLI）
  MAT.foil = new THREE.MeshPhysicalMaterial({
    color:0xffc04e, metalness:1.0, roughness:0.26,
    normalMap:TEX.foilN, normalScale:new THREE.Vector2(1.7,1.7),
    clearcoat:0.72, clearcoatRoughness:0.3, sheen:0.4, sheenColor:0xfff0c0 });
  // 碳纤维
  MAT.carbon = new THREE.MeshPhysicalMaterial({
    map:TEX.carbon, color:0xffffff, metalness:0.52, roughness:0.38,
    clearcoat:0.85, clearcoatRoughness:0.14 });
  // 丝网车轮金属
  MAT.mesh = new THREE.MeshStandardMaterial({
    color:0xb6bcc4, metalness:1.0, roughness:0.3,
    side:THREE.DoubleSide });
  // 暗色机械件
  MAT.steel = new THREE.MeshStandardMaterial({ color:0x6d737b, metalness:1.0, roughness:0.4 });
  MAT.darkSteel = new THREE.MeshStandardMaterial({ color:0x2e3238, metalness:0.9, roughness:0.52 });
  // 太阳能板
  MAT.solar = new THREE.MeshPhysicalMaterial({
    map:TEX.solar, metalness:0.62, roughness:0.17,
    clearcoat:1.0, clearcoatRoughness:0.07, side:THREE.DoubleSide });
  MAT.solarBack = new THREE.MeshStandardMaterial({ color:0xd8d4cc, metalness:0.3, roughness:0.72 });
  // 相机镜头玻璃
  MAT.glass = new THREE.MeshPhysicalMaterial({
    color:0x0a1420, metalness:0.1, roughness:0.03,
    clearcoat:1.0, clearcoatRoughness:0.0,
    transmission:0.25, ior:1.6, reflectivity:1.0,
    emissive:0x16304e, emissiveIntensity:0.45 });
  // 警示色块
  MAT.warnRed = new THREE.MeshStandardMaterial({ color:0xc8302a, metalness:0.3, roughness:0.5 });
  MAT.warnYellow = new THREE.MeshStandardMaterial({ color:0xd8a318, metalness:0.3, roughness:0.48 });
  MAT.navy = new THREE.MeshStandardMaterial({ color:0x1b3a6b, metalness:0.35, roughness:0.46 });
  // 线缆
  MAT.cable = new THREE.MeshStandardMaterial({ color:0x24262b, metalness:0.42, roughness:0.72 });
  // 月壤地形
  MAT.ground = new THREE.MeshStandardMaterial({
    map:TEX.regolith, normalMap:TEX.regolithN, normalScale:new THREE.Vector2(0.3,0.3),
    color:0xbdbcb7, metalness:0.0, roughness:0.97 });
  TEX.regolith.repeat.set(30,30); TEX.regolithN.repeat.set(60,60);
  // 岩石
  MAT.rock = new THREE.MeshStandardMaterial({
    map:TEX.regolith, normalMap:TEX.regolithN, color:0x918f8b, metalness:0.0, roughness:0.93 });
  
  return MAT;
}
