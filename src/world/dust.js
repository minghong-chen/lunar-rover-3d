/**
 * Ballistic lunar dust / 弹道式月尘
 *
 * With no atmosphere, ejected regolith follows pure parabolic arcs and
 * settles immediately on contact — it never billows or drifts like Earth dust.
 * 没有大气，抛起的月壤走纯抛物线并一触即停，不会像地球扬尘那样翻滚飘散。
 */

import * as THREE from 'three';
import { MOON_GRAVITY } from '../rover/kinematics.js';
import { RND } from '../scene/textures.js';

/**
 * @param {THREE.Scene} scene
 * @param {(x:number,z:number)=>number} groundAt
 * @returns {{points:THREE.Points, emitDust:Function, updateDust:(dt:number)=>void}}
 */
export function createDust(scene, groundAt){
  const DUST_N = 180;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_N*3);
  const dustVel = new Float32Array(DUST_N*3);
  const dustLife = new Float32Array(DUST_N);
  const dustAlpha = new Float32Array(DUST_N);
  for(let i=0;i<DUST_N;i++){ dustLife[i]=-1; dustPos[i*3+1]=-999; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos,3));
  dustGeo.setAttribute('aAlpha',  new THREE.BufferAttribute(dustAlpha,1));
  const dustMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.NormalBlending,
    uniforms:{ uSize:{value: 3.0 * Math.min(devicePixelRatio,2)} },
    vertexShader:`attribute float aAlpha; varying float vA; uniform float uSize;
      void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize = uSize * (34.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying float vA;
      void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d);
        if(r>0.5) discard;
        float a=vA*(1.0-r*1.6);
        gl_FragColor=vec4(0.72,0.70,0.66, a); }`
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled=false;
  scene.add(dust);
  let dustPtr=0;
  const MOON_G = MOON_GRAVITY;
  /* dirAngle: 前进方向的世界方位角，约定 cos->x, sin->z（即 atan2(fz,fx)）*/
  function emitDust(x,y,z,dirAngle,count){
    for(let k=0;k<count;k++){
      const i=dustPtr; dustPtr=(dustPtr+1)%DUST_N;
      dustPos[i*3]=x+(RND()-0.5)*0.12;
      dustPos[i*3+1]=y+0.02;
      dustPos[i*3+2]=z+(RND()-0.5)*0.12;
      // 弹道式：向后上方抛出，无空气阻力
      const back=dirAngle+Math.PI+(RND()-0.5)*0.7;
      const sp=0.45+RND()*0.85;
      dustVel[i*3]  =Math.cos(back)*sp;
      dustVel[i*3+1]=0.5+RND()*1.15;
      dustVel[i*3+2]=Math.sin(back)*sp;
      dustLife[i]=0.9+RND()*1.5;
    }
  }
  function updateDust(dt){
    let changed=false;
    for(let i=0;i<DUST_N;i++){
      if(dustLife[i]<=0){ if(dustAlpha[i]!==0){ dustAlpha[i]=0; changed=true; } continue; }
      dustLife[i]-=dt;
      dustVel[i*3+1]-=MOON_G*dt;                 // 只受重力，抛物线落回
      dustPos[i*3]  +=dustVel[i*3]*dt;
      dustPos[i*3+1]+=dustVel[i*3+1]*dt;
      dustPos[i*3+2]+=dustVel[i*3+2]*dt;
      const gy=groundAt(dustPos[i*3], dustPos[i*3+2]);
      if(dustPos[i*3+1]<=gy+0.005){               // 落地即停（无悬浮）
        dustPos[i*3+1]=gy+0.005; dustLife[i]=Math.min(dustLife[i],0.18);
        dustVel[i*3]*=0.1; dustVel[i*3+1]=0; dustVel[i*3+2]*=0.1;
      }
      dustAlpha[i]=THREE.MathUtils.clamp(dustLife[i],0,1)*0.6;
      changed=true;
    }
    if(changed){
      dustGeo.attributes.position.needsUpdate=true;
      dustGeo.attributes.aAlpha.needsUpdate=true;
    }
  }


  return { points: dust, emitDust, updateDust };
}
