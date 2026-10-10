/**
 * Starfield & Milky Way band / 星空与银河带
 *
 * Thousands of stars drawn with a single InstancedMesh, with per-star size
 * and colour-temperature variation. Brightness is adjustable at runtime.
 * 用单个 InstancedMesh 绘制数千颗星，每颗的大小与色温都有差异，亮度可实时调节。
 */

import * as THREE from 'three';
import { makeRng, DEFAULT_SEED } from '../world/noise.js';

const RND = makeRng(DEFAULT_SEED + 31);

/**
 * @param {THREE.Scene} scene
 * @returns {{stars:THREE.InstancedMesh, applyStarBrightness:(v:number)=>void}}
 */
export function createStarfield(scene){
  const STAR_COUNT = 4200;
  const starGeo = new THREE.SphereGeometry(1, 5, 4);
  const starMat = new THREE.MeshBasicMaterial({ color:0xffffff, toneMapped:false });
  const stars = new THREE.InstancedMesh(starGeo, starMat, STAR_COUNT);
  stars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const starBaseColor = new Float32Array(STAR_COUNT*3);
  {
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3();
    const col=new THREE.Color();
    const R=6200;
    for(let i=0;i<STAR_COUNT;i++){
      // 球面均匀分布，略偏上半球
      const u=RND()*2-1, th=RND()*Math.PI*2;
      const sr=Math.sqrt(1-u*u);
      p.set(sr*Math.cos(th), Math.abs(u)*0.92+0.04, sr*Math.sin(th)).multiplyScalar(R);
      const mag = Math.pow(RND(), 2.6);           // 少数亮星，多数暗星
      const size = 2.2 + mag*17;
      s.set(size,size,size);
      m.compose(p,q,s);
      stars.setMatrixAt(i,m);
      // 恒星色温：蓝白 → 黄 → 橙红
      const hue = RND()<0.74 ? 0.58+RND()*0.07 : (RND()<0.6 ? 0.12+RND()*0.05 : 0.03+RND()*0.03);
      const sat = RND()<0.6 ? 0.06+RND()*0.17 : 0.22+RND()*0.3;
      col.setHSL(hue, sat, 0.56+mag*0.42);
      starBaseColor[i*3]=col.r; starBaseColor[i*3+1]=col.g; starBaseColor[i*3+2]=col.b;
      stars.setColorAt(i,col);
    }
    stars.instanceMatrix.needsUpdate = true;
    if(stars.instanceColor) stars.instanceColor.needsUpdate = true;
  }
  stars.frustumCulled = false;
  scene.add(stars);

  function applyStarBrightness(v){
    const col=new THREE.Color();
    for(let i=0;i<STAR_COUNT;i++){
      col.setRGB(starBaseColor[i*3]*v, starBaseColor[i*3+1]*v, starBaseColor[i*3+2]*v);
      stars.setColorAt(i,col);
    }
    if(stars.instanceColor) stars.instanceColor.needsUpdate=true;
  }

  // 淡淡的银河带
  {
    const n=2600;
    const pos=new Float32Array(n*3), colA=new Float32Array(n*3);
    const c=new THREE.Color();
    for(let i=0;i<n;i++){
      const a=RND()*Math.PI*2;
      const band=(RND()+RND()+RND())/3-0.5;
      const v=new THREE.Vector3(Math.cos(a), band*0.42+0.25, Math.sin(a)).normalize().multiplyScalar(6000);
      pos[i*3]=v.x; pos[i*3+1]=Math.abs(v.y); pos[i*3+2]=v.z;
      c.setHSL(0.6+RND()*0.08, 0.3, 0.3+RND()*0.3);
      colA[i*3]=c.r; colA[i*3+1]=c.g; colA[i*3+2]=c.b;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    g.setAttribute('color', new THREE.BufferAttribute(colA,3));
    const mw=new THREE.PointsMaterial({ size:14, sizeAttenuation:true, vertexColors:true,
      transparent:true, opacity:0.5, depthWrite:false, toneMapped:false });
    const milky=new THREE.Points(g,mw);
    milky.frustumCulled=false;
    scene.add(milky);
  }


  return { stars, applyStarBrightness };
}
