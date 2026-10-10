/**
 * Wheel tracks / 车辙痕迹
 *
 * Two parallel rut ribbons with a chevron tread pattern, laid segment by
 * segment between successive rover positions so they follow terrain relief.
 *
 * The material is a plain ShaderMaterial on purpose: a lit material renders
 * almost black under the deliberately near-zero lunar ambient light, which
 * made the ruts invisible. Brightness is driven by the sun-angle uniform.
 *
 * 两道带人字花纹的平行压痕，在相邻位置之间逐段铺设，因此能贴合地形起伏。
 * 刻意使用不参与光照的 ShaderMaterial：受光材质在月面极低环境光下几乎全黑，
 * 会导致辙印不可见。明暗由太阳角度 uniform 驱动。
 */

import * as THREE from 'three';
import { cvs, RND } from '../scene/textures.js';

/**
 * @param {THREE.Scene} scene
 * @param {(x:number,z:number)=>number} groundAt
 * @param {THREE.Clock} clock
 * @param {number} aniso - max anisotropy
 * @returns {{tracks:THREE.InstancedMesh, material:THREE.ShaderMaterial,
 *            layTrack:(cx:number,cz:number,fx:number,fz:number)=>void,
 *            fadeTracks:(now:number)=>void}}
 */
export function createTracks(scene, groundAt, clock, aniso = 8){
  /* 车辙贴图：中间压暗的凹槽 + 人字形胎纹 + 两侧挤出的亮边月壤 */
  function trackTexture(w=128,h=256){
    const c=cvs(w); c.height=h; const g=c.getContext('2d');
    g.clearRect(0,0,w,h);
    // 基础压痕：中间深、边缘浅
    const grd=g.createLinearGradient(0,0,w,0);
    grd.addColorStop(0.00,'rgba(0,0,0,0)');
    grd.addColorStop(0.07,'rgba(196,192,183,0.30)');   // 挤出的亮边（窄而含蓄）
    grd.addColorStop(0.15,'rgba(26,25,23,0.74)');      // 槽壁阴影（深）
    grd.addColorStop(0.50,'rgba(40,39,36,0.60)');      // 槽底
    grd.addColorStop(0.85,'rgba(26,25,23,0.74)');
    grd.addColorStop(0.93,'rgba(196,192,183,0.30)');
    grd.addColorStop(1.00,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.fillRect(0,0,w,h);
    // 人字形胎纹（chevron）：与车轮的 grouser 对应
    g.lineCap='round';
    for(let i=0;i<22;i++){
      const y=(i+0.5)*(h/22);
      g.strokeStyle='rgba(14,13,12,0.56)'; g.lineWidth=5.0;
      g.beginPath();
      g.moveTo(w*0.17, y-6); g.lineTo(w*0.5, y+6); g.lineTo(w*0.83, y-6);
      g.stroke();
      // 花纹受光的一侧略亮，增强立体感
      g.strokeStyle='rgba(178,175,167,0.22)'; g.lineWidth=1.6;
      g.beginPath();
      g.moveTo(w*0.17, y-9.5); g.lineTo(w*0.5, y+2.5); g.lineTo(w*0.83, y-9.5);
      g.stroke();
    }
    // 细碎月壤颗粒扰动，避免花纹过于规整
    for(let i=0;i<900;i++){
      const x=w*0.12+RND()*w*0.76, y=RND()*h, r=RND()*2.1+0.3;
      g.fillStyle = RND()<0.58 ? `rgba(18,17,16,${RND()*0.3})`
                               : `rgba(198,195,187,${RND()*0.17})`;
      g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
    }
    const t=new THREE.CanvasTexture(c);
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=aniso;
    return t;
  }
  const TRACK_TEX = trackTexture();

  const TRACK_MAX = 150;                 // 每侧的条带段数
  const TRACK_W   = 0.34;                // 辙印宽度（略宽于车轮）
  /* 条带网格：沿长度方向细分，使其能贴合地形起伏 */
  const trackGeo = new THREE.PlaneGeometry(TRACK_W, 1, 1, 4);
  trackGeo.rotateX(-Math.PI/2);          // 平铺于地面(XZ)，长度沿 +Z
  /* 车辙材质：不参与光照（月面环境光极低，受光材质会全黑），
     直接按太阳强度调制"压暗槽 + 挤出亮边"，贴合真实压痕观感 */
  const trackMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide,
    defines:{ USE_INSTANCING_COLOR:'' },
    polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6,
    uniforms:{
      uMap:{ value: TRACK_TEX },
      uLit:{ value: 1.0 }          // 随太阳角度变化的明暗（创建后由 trackLit 同步）
    },
    vertexShader:`
      varying vec2 vUv;
      varying vec3 vInst;
      void main(){
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vInst = instanceColor;
        #else
          vInst = vec3(1.0);
        #endif
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform sampler2D uMap;
      uniform float uLit;
      varying vec2 vUv;
      varying vec3 vInst;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        if(t.a < 0.02) discard;
        // 贴图已包含暗槽与亮边；按太阳强度与渐隐系数调制
        vec3 col = t.rgb * uLit * vInst.r;
        gl_FragColor = vec4(col, t.a * 0.80 * vInst.r);
      }`
  });
  const tracks = new THREE.InstancedMesh(trackGeo, trackMat, TRACK_MAX*2);
  tracks.frustumCulled=false;
  tracks.receiveShadow=true;
  tracks.count=0;
  scene.add(tracks);
  // 逐实例不透明度：用 instanceColor 作为亮度/渐隐通道
  tracks.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(TRACK_MAX*2*3).fill(1), 3);

  let trackPtr=0, trackFilled=0;
  const _tm=new THREE.Matrix4(), _tq=new THREE.Quaternion(), _te=new THREE.Euler();
  const _tpos=new THREE.Vector3(), _tscale=new THREE.Vector3();
  const _trkC=new THREE.Color();
  // 记录每段的落位时间，用于渐隐
  const trackAge=new Float32Array(TRACK_MAX).fill(-1);
  let lastLeft=null, lastRight=null;   // 上一次左右辙印的落点

  /* 在 (from -> to) 之间铺一段贴合地形的辙印 */
  function layTrackSegment(slot, side, from, to){
    const dx=to.x-from.x, dz=to.z-from.z;
    const len=Math.hypot(dx,dz);
    if(len<1e-4) return;
    const mx=(from.x+to.x)*0.5, mz=(from.z+to.z)*0.5;
    // 取段内若干采样点，让条带整体贴合地形高度
    let hy=-1e9;
    for(let k=0;k<=3;k++){
      const x=from.x+dx*(k/3), z=from.z+dz*(k/3);
      hy=Math.max(hy, groundAt(x,z));
    }
    // 条带长度方向为局部 +Z，需绕 Y 对齐 (dx,dz)
    const ang=Math.atan2(dx,dz);
    _te.set(0,ang,0); _tq.setFromEuler(_te);
    _tpos.set(mx, hy+0.028, mz);
    _tscale.set(1, 1, len*1.06);          // 轻微重叠，避免段间缝隙
    _tm.compose(_tpos,_tq,_tscale);
    tracks.setMatrixAt(slot, _tm);
  }

  function layTrack(cx,cz,fx,fz){
    // 以前进方向的左右法向偏移出两道轮距
    const fl=Math.hypot(fx,fz)||1;
    const nx=-fz/fl, nz=fx/fl;             // 左法向
    const half=0.80;                       // 轮距半宽，与 WHEEL_POS 的 z=±0.80 一致
    const L={ x:cx+nx*half, z:cz+nz*half };
    const R={ x:cx-nx*half, z:cz-nz*half };
    if(lastLeft){
      layTrackSegment(trackPtr*2,   -1, lastLeft,  L);
      layTrackSegment(trackPtr*2+1,  1, lastRight, R);
      trackAge[trackPtr]=clock.elapsedTime;
      trackPtr=(trackPtr+1)%TRACK_MAX;
      trackFilled=Math.min(trackFilled+1,TRACK_MAX);
      tracks.count=trackFilled*2;
      tracks.instanceMatrix.needsUpdate=true;
    }
    lastLeft=L; lastRight=R;
  }

  /* 旧辙印缓慢变淡（月面无风，衰减极慢，仅用于循环复用时不突变） */
  function fadeTracks(now){
    let dirty=false;
    for(let i=0;i<trackFilled;i++){
      if(trackAge[i]<0) continue;
      const age=now-trackAge[i];
      // 前 60 秒几乎不变，之后缓慢压暗，循环覆盖前已很淡
      const k=THREE.MathUtils.clamp(1-(age-60)/120, 0.25, 1);
      _trkC.setScalar(k);
      tracks.setColorAt(i*2,   _trkC);
      tracks.setColorAt(i*2+1, _trkC);
      dirty=true;
    }
    if(dirty && tracks.instanceColor) tracks.instanceColor.needsUpdate=true;
  }


  return { tracks, material: trackMat, layTrack, fadeTracks };
}
