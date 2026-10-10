/**
 * Driving path / 行驶路径
 *
 * A gently meandering closed CatmullRom loop. The radius undulates slightly
 * so the route never looks like a perfect circle, and it stays well inside
 * the terrain bounds so the rover never reaches an edge.
 * 平缓蜿蜒的闭合 CatmullRom 曲线。半径轻微起伏以避免完美圆形，
 * 且始终留在地形范围内，探测车永远走不到边缘。
 */

import * as THREE from 'three';
import { PATH_RADIUS } from './terrain.js';

/**
 * @returns {{curve:THREE.CatmullRomCurve3, length:number}}
 */
export function createPath(){
  const curve = (function(){
    const pts=[];
    const N=14;
    for(let i=0;i<N;i++){
      const a=i/N*Math.PI*2;
      // 半径围绕 PATH_RADIUS 轻微起伏，形成平缓蜿蜒
      const r=PATH_RADIUS + Math.sin(a*2.0)*7.5 + Math.cos(a*3.0)*4.2;
      pts.push(new THREE.Vector3(Math.cos(a)*r, 0, Math.sin(a)*r));
    }
    const c=new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    return c;
  })();

  return { curve, length: curve.getLength() };
}

/** Base cruise speed in m/s — matches a real planetary rover's slow crawl. */
export const BASE_SPEED = 0.42;
