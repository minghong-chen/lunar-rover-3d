/**
 * Procedural reflection environment / 程序化反射环境
 *
 * Fully metallic PBR surfaces render near-black with nothing to reflect.
 * The Moon has no sky glow, so we synthesise a minimal equirectangular
 * environment: black space, a hard sun spot, a faint Earth and a bright
 * regolith half-dome (the real dominant bounce light on the lunar surface).
 *
 * 全金属材质没有可反射的环境时会发黑。月面无天空散射，
 * 因此合成一张极简环境贴图：黑色太空 + 硬太阳亮斑 + 微弱地球 + 明亮月壤半球。
 */

import * as THREE from 'three';
import { cvs, RND } from './textures.js';

/**
 * @returns {THREE.Texture} equirectangular reflection texture
 */
export function buildEnvironment(){
  const w=512,h=256;
  const c=cvs(w); c.height=h; const g=c.getContext('2d');
  // 上半：深空（近黑）
  const sky=g.createLinearGradient(0,0,0,h*0.5);
  sky.addColorStop(0,'#000000'); sky.addColorStop(1,'#05070c');
  g.fillStyle=sky; g.fillRect(0,0,w,h*0.5);
  // 太阳亮斑（强、小、硬）
  const sx=w*0.3, sy=h*0.2;
  const sg=g.createRadialGradient(sx,sy,0,sx,sy,34);
  sg.addColorStop(0,'rgba(255,255,255,1)');
  sg.addColorStop(0.18,'rgba(255,250,236,0.85)');
  sg.addColorStop(0.5,'rgba(120,118,112,0.2)');
  sg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=sg; g.beginPath(); g.arc(sx,sy,34,0,6.283); g.fill();
  // 地球微弱蓝斑
  const eg=g.createRadialGradient(w*0.72,h*0.3,0,w*0.72,h*0.3,20);
  eg.addColorStop(0,'rgba(95,150,225,0.5)'); eg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=eg; g.beginPath(); g.arc(w*0.72,h*0.3,20,0,6.283); g.fill();
  // 下半：被阳光照亮的月壤反照（主要补光来源）
  const grd=g.createLinearGradient(0,h*0.5,0,h);
  grd.addColorStop(0,'#2a2927'); grd.addColorStop(0.3,'#6d6b66');
  grd.addColorStop(1,'#8e8c86');
  g.fillStyle=grd; g.fillRect(0,h*0.5,w,h*0.5);
  // 地平线锐利分界
  g.fillStyle='rgba(150,148,142,.5)'; g.fillRect(0,h*0.5-1,w,2);

  // 轻量方案：直接作为等距圆柱反射贴图使用，避免 PMREM 预滤波开销
  const tex=new THREE.CanvasTexture(c);
  tex.mapping=THREE.EquirectangularReflectionMapping;
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.generateMipmaps=true;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}
