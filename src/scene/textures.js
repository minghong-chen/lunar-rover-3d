/**
 * Procedural canvas textures / 程序化 canvas 贴图
 *
 * Part of the lunar-rover-3d procedural scene. All textures and geometry in
 * this module are generated at runtime from code — no binary assets.
 * 本模块的贴图与几何体全部在运行时由代码生成，不依赖任何二进制素材。
 */

import * as THREE from 'three';
import { makeRng, buildPermutation, createNoise, DEFAULT_SEED } from '../world/noise.js';

const RND = makeRng(DEFAULT_SEED + 7);
const { fbm, ridged } = createNoise(buildPermutation(makeRng(DEFAULT_SEED)));

/** Allocate a square (or custom-height) offscreen canvas. */
function cvs(size){ const c=document.createElement('canvas'); c.width=c.height=size; return c; }


/* --- 月壤漫反射贴图：灰白底 + 噪点 + 微陨石麻点 --- */
function regolithMap(size=1024){
  const c=cvs(size), g=c.getContext('2d');
  g.fillStyle='#8d8b86'; g.fillRect(0,0,size,size);
  const img=g.getImageData(0,0,size,size), d=img.data;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const n = fbm(x/58, y/58, 5)*0.5 + fbm(x/13, y/13, 3)*0.3 + (RND()-0.5)*0.26;
    const v = THREE.MathUtils.clamp(0.60 + n*0.30, 0.18, 1);
    d[i]  =255*v*0.995; d[i+1]=255*v*0.995; d[i+2]=255*v*0.985; d[i+3]=255;
  }
  g.putImageData(img,0,0);
  // 微小暗坑麻点
  for(let i=0;i<2600;i++){
    const x=RND()*size, y=RND()*size, r=RND()*RND()*7+0.6;
    const a=0.05+RND()*0.17;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(28,26,24,${a})`);
    grd.addColorStop(0.72,`rgba(60,58,54,${a*0.4})`);
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
  }
  // 浅色溅射亮斑
  for(let i=0;i<420;i++){
    const x=RND()*size, y=RND()*size, r=RND()*10+2;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(255,253,246,${0.05+RND()*0.1})`);
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
/* --- 由高度场生成法线贴图 --- */
function normalFromHeight(hf, size, strength=2.6){
  const c=cvs(size), g=c.getContext('2d');
  const img=g.createImageData(size,size), d=img.data;
  const at=(x,y)=>hf[((y+size)%size)*size + ((x+size)%size)];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const dx=(at(x+1,y)-at(x-1,y))*strength;
    const dy=(at(x,y+1)-at(x,y-1))*strength;
    let nx=-dx, ny=-dy, nz=1;
    const l=Math.hypot(nx,ny,nz); nx/=l; ny/=l; nz/=l;
    const i=(y*size+x)*4;
    d[i]=(nx*0.5+0.5)*255; d[i+1]=(ny*0.5+0.5)*255; d[i+2]=(nz*0.5+0.5)*255; d[i+3]=255;
  }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function regolithNormal(size=512){
  const hf=new Float32Array(size*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++)
    hf[y*size+x]= fbm(x/19,y/19,5)*0.6 + fbm(x/5,y/5,3)*0.4 + (RND()-0.5)*0.25;
  return normalFromHeight(hf,size,3.1);
}

/* --- 太阳能电池板贴图：蓝紫电池片 + 分格栅线 + 汇流条 --- */
function solarPanelMap(w=512,h=512,cols=8,rows=12){
  const c=cvs(w); c.height=h; const g=c.getContext('2d');
  g.fillStyle='#0a1430'; g.fillRect(0,0,w,h);
  const cw=w/cols, ch=h/rows;
  for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
    const x=i*cw, y=j*ch;
    const tint=0.82+RND()*0.18;
    const grd=g.createLinearGradient(x,y,x+cw,y+ch);
    grd.addColorStop(0,  `rgb(${18*tint|0},${40*tint|0},${96*tint|0})`);
    grd.addColorStop(0.5,`rgb(${30*tint|0},${62*tint|0},${140*tint|0})`);
    grd.addColorStop(1,  `rgb(${12*tint|0},${28*tint|0},${74*tint|0})`);
    g.fillStyle=grd; g.fillRect(x+1.6,y+1.6,cw-3.2,ch-3.2);
    // 汇流细银线
    g.strokeStyle='rgba(205,220,240,.5)'; g.lineWidth=1;
    for(let k=1;k<4;k++){ g.beginPath();
      g.moveTo(x+cw*k/4, y+2.4); g.lineTo(x+cw*k/4, y+ch-2.4); g.stroke(); }
    g.strokeStyle='rgba(225,235,250,.62)'; g.lineWidth=1.8;
    g.beginPath(); g.moveTo(x+2.4,y+ch*0.5); g.lineTo(x+cw-2.4,y+ch*0.5); g.stroke();
    // 边缘高光
    g.strokeStyle='rgba(150,185,235,.3)'; g.lineWidth=1;
    g.strokeRect(x+1.6,y+1.6,cw-3.2,ch-3.2);
  }
  // 面板骨架格栅
  g.strokeStyle='rgba(188,196,206,.85)'; g.lineWidth=3.2;
  for(let i=0;i<=cols;i++){ g.beginPath(); g.moveTo(i*cw,0); g.lineTo(i*cw,h); g.stroke(); }
  for(let j=0;j<=rows;j++){ g.beginPath(); g.moveTo(0,j*ch); g.lineTo(w,j*ch); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

/* --- 车体哑光白漆面板：分缝线 + 铆钉 + 轻微污渍 --- */
function hullPaintMap(size=1024){
  const c=cvs(size), g=c.getContext('2d');
  g.fillStyle='#e8e6e1'; g.fillRect(0,0,size,size);
  // 噪声污渍
  for(let i=0;i<1500;i++){
    const x=RND()*size,y=RND()*size,r=RND()*26+4;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(150,148,142,${0.02+RND()*0.05})`);
    grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
  }
  // 面板分缝
  const step=size/8;
  g.strokeStyle='rgba(92,90,88,.72)'; g.lineWidth=2.4;
  for(let i=1;i<8;i++){
    g.beginPath(); g.moveTo(i*step,0); g.lineTo(i*step,size); g.stroke();
    g.beginPath(); g.moveTo(0,i*step); g.lineTo(size,i*step); g.stroke();
  }
  g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1;
  for(let i=1;i<8;i++){
    g.beginPath(); g.moveTo(i*step+2.2,0); g.lineTo(i*step+2.2,size); g.stroke();
    g.beginPath(); g.moveTo(0,i*step+2.2); g.lineTo(size,i*step+2.2); g.stroke();
  }
  // 铆钉：沿缝线排布
  function rivet(x,y,r){
    const grd=g.createRadialGradient(x-r*0.3,y-r*0.3,0,x,y,r);
    grd.addColorStop(0,'rgba(255,255,255,.95)');
    grd.addColorStop(0.55,'rgba(168,166,160,.9)');
    grd.addColorStop(1,'rgba(74,72,70,.85)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
  }
  for(let i=0;i<=8;i++) for(let t=0;t<=size;t+=step/4){
    rivet(i*step, t, 3.2); rivet(t, i*step, 3.2);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function hullNormal(size=512){
  const hf=new Float32Array(size*size);
  const step=size/8;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    let h = fbm(x/40,y/40,3)*0.12;
    const dx=Math.min(Math.abs(x%step), step-Math.abs(x%step));
    const dy=Math.min(Math.abs(y%step), step-Math.abs(y%step));
    if(dx<2.4||dy<2.4) h-=0.85;                      // 凹缝
    // 铆钉凸起
    const rx=Math.round(x/(step/4))*(step/4), ry=Math.round(y/(step/4))*(step/4);
    const onSeamX = Math.abs(rx%step)<1 , onSeamY = Math.abs(ry%step)<1;
    if(onSeamX||onSeamY){
      const d=Math.hypot(x-rx,y-ry);
      if(d<3.4) h+=0.9*Math.cos(d/3.4*1.57);
    }
    hf[y*size+x]=h;
  }
  return normalFromHeight(hf,size,2.0);
}

/* --- 隔热金箔皱褶法线 --- */
function foilNormal(size=512){
  const hf=new Float32Array(size*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++)
    hf[y*size+x]= ridged(x/26,y/26,4)*0.9 + fbm(x/9,y/9,3)*0.35;
  return normalFromHeight(hf,size,3.4);
}

/* --- 碳纤维编织贴图 --- */
function carbonMap(size=256){
  const c=cvs(size), g=c.getContext('2d');
  g.fillStyle='#14161a'; g.fillRect(0,0,size,size);
  const cell=size/16;
  for(let i=0;i<16;i++) for(let j=0;j<16;j++){
    const dark=((i+j)&1)===0;
    const grd=g.createLinearGradient(i*cell,j*cell,(i+1)*cell,(j+1)*cell);
    if(dark){ grd.addColorStop(0,'#2b2f36'); grd.addColorStop(1,'#101216'); }
    else    { grd.addColorStop(0,'#0e1014'); grd.addColorStop(1,'#272b32'); }
    g.fillStyle=grd; g.fillRect(i*cell,j*cell,cell,cell);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

/* --- 地球贴图：蓝白大陆云带 --- */
function earthMap(size=512){
  const c=cvs(size*2); c.height=size; const g=c.getContext('2d');
  const w=size*2,h=size;
  const oc=g.createLinearGradient(0,0,0,h);
  oc.addColorStop(0,'#cfe6f5'); oc.addColorStop(0.17,'#12418f');
  oc.addColorStop(0.5,'#0a3f9c'); oc.addColorStop(0.84,'#0e3d86'); oc.addColorStop(1,'#dbeaf6');
  g.fillStyle=oc; g.fillRect(0,0,w,h);
  // 大陆
  for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2){
    const n=fbm(x/92,y/92,5)+0.34*fbm(x/26,y/26,3);
    if(n>0.13){
      const g2=THREE.MathUtils.clamp(0.42+n*0.5,0,1);
      g.fillStyle=`rgb(${(74+n*70)|0},${(96+g2*72)|0},${(56+n*34)|0})`;
      g.fillRect(x,y,2.4,2.4);
    }
  }
  // 云带
  for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2){
    const n=fbm(x/50+120,y/22+60,4);
    if(n>0.18) { g.fillStyle=`rgba(255,255,255,${Math.min((n-0.18)*2.1,0.9)})`; g.fillRect(x,y,2.6,2.6); }
  }
  // 极冠
  g.fillStyle='rgba(255,255,255,.93)';
  g.fillRect(0,0,w,h*0.045); g.fillRect(0,h*0.962,w,h*0.04);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return t;
}


/**
 * Build every texture the scene needs.
 * 生成场景所需的全部贴图。
 *
 * @param {THREE.WebGLRenderer} renderer - used for max anisotropy lookup
 */
export function createTextures(renderer){
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const TEX = {
    regolith:  regolithMap(1024),
    regolithN: regolithNormal(512),
    solar:     solarPanelMap(512,512),
    paint:     hullPaintMap(1024),
    paintN:    hullNormal(512),
    foilN:     foilNormal(512),
    carbon:    carbonMap(256),
    earth:     earthMap(512),
  };
  for(const k of Object.keys(TEX)) if(TEX[k]) TEX[k].anisotropy = aniso;
  return TEX;
}

export { regolithMap, regolithNormal, solarPanelMap, hullPaintMap,
         hullNormal, foilNormal, carbonMap, earthMap, normalFromHeight, cvs, RND, fbm, ridged };
