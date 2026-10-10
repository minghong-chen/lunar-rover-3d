/**
 * Terrain mesh & rock scatter / 地形网格与岩石散布
 *
 * Builds the displaced ground plane from the shared height function, plus a
 * low-poly outer ring that pushes the horizon far away while keeping it sharp.
 * Rocks use InstancedMesh in three size classes.
 *
 * 用共享高度函数生成起伏地面，并加一圈低模外环把地平线推远且保持锐利。
 * 岩石分三个尺寸档，使用 InstancedMesh 绘制。
 */

import * as THREE from 'three';
import { TERRAIN_SIZE, TERRAIN_SEG, PATH_RADIUS } from '../world/terrain.js';

/**
 * @param {THREE.Scene} scene
 * @param {Record<string, THREE.Material>} MAT
 * @param {(x:number,z:number)=>number} terrainHeight - shared height sampler
 * @param {object} noise - { fbm } from createNoise()
 * @param {() => number} RND - seeded RNG for rock placement
 * @returns {{ground:THREE.Mesh}}
 */
export function createTerrainMesh(scene, MAT, terrainHeight, noise, RND){
  const { fbm } = noise;
  // --- 地形网格 ---
  const groundGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEG, TERRAIN_SEG);
  groundGeo.rotateX(-Math.PI/2);
  {
    const p = groundGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
    }
    p.needsUpdate = true;
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, MAT.ground);
  ground.receiveShadow = true;
  scene.add(ground);

  // --- 远景低模外环地形，把地平线推远并保持锐利 ---
  {
    const far = new THREE.Mesh(
      new THREE.RingGeometry(TERRAIN_SIZE*0.49, 9000, 96, 10),
      new THREE.MeshStandardMaterial({ color:0x9b9a96, roughness:1.0, metalness:0.0 })
    );
    far.rotation.x = -Math.PI/2;
    const fp = far.geometry.attributes.position;
    for(let i=0;i<fp.count;i++){
      const x=fp.getX(i), y=fp.getY(i);
      const d=Math.hypot(x,y);
      fp.setZ(i, fbm(x*0.0016,y*0.0016,4)*22 * Math.min(1,(d-TERRAIN_SIZE*0.49)/900) - 1.2);
    }
    fp.needsUpdate=true; far.geometry.computeVertexNormals();
    far.receiveShadow = false;
    scene.add(far);
  }


  return { ground };
}

/**
 * Scatter rocks as three InstancedMesh size classes.
 * 以三个尺寸档的 InstancedMesh 散布岩石。
 *
 * @param {THREE.Scene} scene
 * @param {Record<string, THREE.Material>} MAT
 * @param {(x:number,z:number)=>number} terrainHeight
 * @param {object} noise
 * @param {() => number} RND
 * @returns {THREE.InstancedMesh[]}
 */
export function createRocks(scene, MAT, terrainHeight, noise, RND){
  const { fbm } = noise;
  const makeRng = (s) => { let v=s>>>0; return ()=>{ v^=v<<13; v>>>=0; v^=v>>17; v^=v<<5; v>>>=0; return v/4294967296; }; };
  const meshes = [];
  function rockGeometry(seed, detail){
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const r = makeRng(seed);
    const off = r()*100;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const n = fbm(x*1.5+off, z*1.5+off, 4)*0.34 + fbm(y*3.1+off, x*3.1, 3)*0.2;
      const k = 1 + n;
      // 轻微压扁，像风化卧石
      p.setXYZ(i, x*k*(1+0.22*fbm(y*2,z*2,2)), y*k*0.74, z*k*(1+0.2*fbm(x*2,y*2,2)));
    }
    p.needsUpdate=true; g.computeVertexNormals();
    return g;
  }
  const ROCK_SETS = [
    { geo: rockGeometry(11, 2), count: 620, min:0.1,  max:0.42 },  // 碎石
    { geo: rockGeometry(29, 2), count: 260, min:0.4,  max:1.25 },  // 中石
    { geo: rockGeometry(47, 3), count: 74,  min:1.3,  max:4.2  }   // 大漂石
  ];
  ROCK_SETS.forEach((set, si)=>{
    const inst = new THREE.InstancedMesh(set.geo, MAT.rock, set.count);
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(),
          s=new THREE.Vector3(), pos=new THREE.Vector3();
    let placed=0, guard=0;
    while(placed<set.count && guard<set.count*40){
      guard++;
      const a=RND()*Math.PI*2;
      // 近景密集、远景稀疏
      const rr = si===0 ? 4+Math.pow(RND(),0.8)*150
               : si===1 ? 6+Math.pow(RND(),0.75)*260
                        : 14+Math.pow(RND(),0.7)*420;
      const x=Math.cos(a)*rr, z=Math.sin(a)*rr;
      const sc = set.min + RND()*(set.max-set.min);
      // 不要压在行驶路径上
      if(Math.abs(Math.hypot(x,z)-PATH_RADIUS) < sc*2.2 + 1.5) continue;
      const y = terrainHeight(x,z) - sc*0.3;      // 半埋入月壤
      pos.set(x,y,z);
      e.set(RND()*0.5-0.25, RND()*Math.PI*2, RND()*0.5-0.25);
      q.setFromEuler(e);
      s.set(sc*(0.78+RND()*0.5), sc*(0.6+RND()*0.45), sc*(0.78+RND()*0.5));
      m.compose(pos,q,s);
      inst.setMatrixAt(placed,m);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
    meshes.push(inst);
  });


  return meshes;
}
