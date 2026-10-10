/**
 * Rover assembly / 探测车装配
 *
 * Everything is composed from primitive geometries at runtime: six wire-mesh
 * wheels, rocker-bogie suspension, solar array, high-gain dish, whip antenna,
 * stereo camera mast, multi-joint robotic arm, instrument boxes and cabling.
 *
 * AXIS CONVENTION: body length runs along local +X (nose at +X, left at +Z).
 * See src/rover/kinematics.js for why this matters.
 *
 * 全部由基础几何体在运行时组合而成。注意：车身长轴沿局部 +X（车头 +X、左侧 +Z），
 * 原因见 src/rover/kinematics.js。
 */

import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * @param {Record<string, THREE.Material>} MAT
 * @param {THREE.Texture} ENV - reflection environment
 * @returns {{rover:THREE.Group, wheels:Array, mastYaw:THREE.Group,
 *            mastHead:THREE.Group, armJ1:THREE.Group, armJ3:THREE.Group,
 *            BODY_H:number, WHEEL_R:number}}
 */
export function buildRover(MAT, ENV){
  const rover = new THREE.Group();
  // Caller adds the rover to the scene. / 由调用方加入场景。

  /* 共享小几何体（减少 draw-call 开销与内存） */
  const G = {
    bolt:   new THREE.CylinderGeometry(0.012,0.012,0.012,8),
    boltHead:new THREE.CylinderGeometry(0.016,0.016,0.009,6),
    rivet:  new THREE.SphereGeometry(0.011,8,6),
    slat:   new THREE.BoxGeometry(1,1,1),
    rod:    new THREE.CylinderGeometry(1,1,1,10)
  };
  /* 将 group 内静态网格按材质合并，大幅降低 draw call */
  function mergeByMaterial(src){
    const buckets=new Map();
    src.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(src.matrixWorld).invert();
    src.traverse(o=>{
      if(!o.isMesh || !o.geometry) return;
      const key=o.material.uuid;
      if(!buckets.has(key)) buckets.set(key,{mat:o.material, geos:[]});
      const g=o.geometry.clone();
      const m=new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      // 统一属性集，保证可合并
      for(const name of Object.keys(g.attributes))
        if(!['position','normal','uv'].includes(name)) g.deleteAttribute(name);
      if(!g.attributes.uv){
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      }
      if(!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      buckets.get(key).geos.push(g);
    });
    const out=new THREE.Group();
    buckets.forEach(b=>{
      const merged = b.geos.length===1 ? b.geos[0] : BGU.mergeGeometries(b.geos, false);
      if(!merged) return;
      const mesh=new THREE.Mesh(merged, b.mat);
      mesh.castShadow=true; mesh.receiveShadow=true;
      out.add(mesh);
    });
    return out;
  }

  function mk(geo, mat, x=0,y=0,z=0, shadow=true){
    const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
    m.castShadow=shadow; m.receiveShadow=shadow; return m;
  }
  function box(w,h,d,mat,x,y,z,shadow=true){
    return mk(new THREE.BoxGeometry(w,h,d), mat, x,y,z, shadow);
  }
  function cyl(rt,rb,h,seg,mat,x,y,z,shadow=true){
    return mk(new THREE.CylinderGeometry(rt,rb,h,seg), mat, x,y,z, shadow);
  }
  /* 螺栓阵列 */
  function boltRow(parent, n, from, to, mat=MAT.polished, rot=null, scale=1){
    for(let i=0;i<n;i++){
      const t=n===1?0.5:i/(n-1);
      const b=new THREE.Mesh(G.boltHead, mat);
      b.position.lerpVectors(from,to,t);
      b.scale.setScalar(scale);
      if(rot) b.rotation.copy(rot);
      b.castShadow=true;
      parent.add(b);
    }
  }
  /* 管状线缆束（Catmull 曲线 → TubeGeometry） */
  function cableRun(points, radius=0.012, mat=MAT.cable, seg=28){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const t=new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, 7, false), mat);
    t.castShadow=true;
    return t;
  }

  /* ---------- 9.1 主舱体 ---------- */
  const BODY_L=2.06, BODY_W=1.30, BODY_H=0.52;
  const chassis = new THREE.Group();
  chassis.position.y = 0.70;
  rover.add(chassis);

  // 主舱（倒角箱体）
  {
    const hull = box(BODY_L, BODY_H, BODY_W, MAT.paint, 0, 0, 0);
    hull.material = MAT.paint;
    chassis.add(hull);

    // 顶部与底部的抛光金属加强框
    chassis.add(box(BODY_L*1.012, 0.032, BODY_W*1.012, MAT.polished, 0,  BODY_H/2+0.014, 0));
    chassis.add(box(BODY_L*1.012, 0.028, BODY_W*1.012, MAT.polished, 0, -BODY_H/2-0.012, 0));

    // 四条竖向角柱（面板分缝的视觉锚点）
    for(const sx of [-1,1]) for(const sz of [-1,1]){
      chassis.add(box(0.05, BODY_H*1.02, 0.05, MAT.polished,
        sx*(BODY_L/2-0.016), 0, sz*(BODY_W/2-0.016)));
    }

    // 侧面水平加强筋 + 铆钉带
    for(const sz of [-1,1]){
      const z=sz*(BODY_W/2+0.008);
      chassis.add(box(BODY_L*0.94, 0.026, 0.016, MAT.polished, 0,  0.15, z));
      chassis.add(box(BODY_L*0.94, 0.026, 0.016, MAT.polished, 0, -0.15, z));
      boltRow(chassis, 11,
        new THREE.Vector3(-BODY_L*0.45, 0.205, z+sz*0.004),
        new THREE.Vector3( BODY_L*0.45, 0.205, z+sz*0.004), MAT.polished,
        new THREE.Euler(Math.PI/2,0,0), 0.9);
      boltRow(chassis, 11,
        new THREE.Vector3(-BODY_L*0.45, -0.205, z+sz*0.004),
        new THREE.Vector3( BODY_L*0.45, -0.205, z+sz*0.004), MAT.polished,
        new THREE.Euler(Math.PI/2,0,0), 0.9);
    }

    // 隔热金箔包覆（下腹部 MLI 毯）
    const foil = box(BODY_L*0.93, 0.2, BODY_W*0.97, MAT.foil, 0, -BODY_H/2+0.085, 0);
    chassis.add(foil);
    // 金箔侧裙
    for(const sz of [-1,1]){
      const skirt = box(BODY_L*0.88, 0.17, 0.012, MAT.foil, 0, -0.12, sz*(BODY_W/2+0.014));
      chassis.add(skirt);
    }

    // ---------- 散热格栅（前后各一组，细叶片） ----------
    function grille(px, pz, w, h, slats, horizontal, rotY){
      const grp=new THREE.Group();
      const frame = box(w+0.05, h+0.05, 0.03, MAT.darkSteel, 0,0,0);
      grp.add(frame);
      grp.add(box(w, h, 0.012, MAT.darkPaint, 0,0,0.012));
      for(let i=0;i<slats;i++){
        const t=(i+0.5)/slats;
        if(horizontal){
          const s=box(w*0.97, h/slats*0.52, 0.026, MAT.polished, 0, (t-0.5)*h, 0.022);
          s.rotation.x = -0.42;
          grp.add(s);
        } else {
          const s=box(w/slats*0.5, h*0.97, 0.026, MAT.polished, (t-0.5)*w, 0, 0.022);
          s.rotation.y = 0.4;
          grp.add(s);
        }
      }
      grp.position.set(px, 0.02, pz);
      grp.rotation.y = rotY;
      return grp;
    }
    // 车体后部散热格栅（朝 -X）
    chassis.add(grille(-BODY_L/2-0.016, 0.0, 0.42, 0.3, 9, true, -Math.PI/2));
    // 两侧小格栅
    chassis.add(grille(0.46,  BODY_W/2+0.014, 0.3, 0.22, 7, true, 0));
    chassis.add(grille(0.46, -BODY_W/2-0.014, 0.3, 0.22, 7, true, Math.PI));

    // ---------- 顶面设备与分格面板 ----------
    const deck = box(BODY_L*0.97, 0.02, BODY_W*0.96, MAT.carbon, 0, BODY_H/2+0.038, 0);
    chassis.add(deck);
    // 顶面纵横细筋
    for(let i=-2;i<=2;i++)
      chassis.add(box(BODY_L*0.95, 0.014, 0.018, MAT.polished, 0, BODY_H/2+0.05, i*0.24));
    for(let i=-3;i<=3;i++)
      chassis.add(box(0.016, 0.012, BODY_W*0.93, MAT.polished, i*0.28, BODY_H/2+0.05, 0));

    // ---------- 警示标识色块 ----------
    // 车体侧面红白警示条
    for(const sz of [-1,1]){
      const z=sz*(BODY_W/2+0.016);
      for(let i=0;i<5;i++){
        chassis.add(box(0.075, 0.075, 0.006,
          i%2 ? MAT.warnYellow : MAT.warnRed, -0.72+i*0.078, 0.02, z, false));
      }
      // 蓝色机构标识块
      chassis.add(box(0.26, 0.12, 0.006, MAT.navy, 0.30, 0.02, z, false));
      // 白色小方块（铭牌）
      chassis.add(box(0.1, 0.07, 0.006, MAT.polished, 0.60, 0.02, z, false));
    }
    // 车顶警示红块
    chassis.add(box(0.18,0.008,0.18, MAT.warnRed, -0.82, BODY_H/2+0.052, 0.36, false));

    // ---------- 侧面仪器箱 ----------
    function instrumentBox(w,h,d,x,y,z,mat){
      const g=new THREE.Group();
      g.add(box(w,h,d,mat,0,0,0));
      // 箱盖螺栓
      for(const sx of [-1,1]) for(const sy of [-1,1]){
        const b=new THREE.Mesh(G.boltHead, MAT.polished);
        b.position.set(sx*(w/2-0.022), sy*(h/2-0.022), d/2+0.004);
        b.rotation.x=Math.PI/2; b.scale.setScalar(1.1); b.castShadow=true;
        g.add(b);
      }
      // 散热鳍片
      for(let i=0;i<5;i++)
        g.add(box(w*0.86, 0.01, 0.02, MAT.polished, 0, -h/2+0.03+i*((h-0.06)/4), d/2+0.014));
      g.position.set(x,y,z);
      return g;
    }
    chassis.add(instrumentBox(0.34,0.26,0.12, -0.34, -0.03,  BODY_W/2+0.072, MAT.darkPaint));
    chassis.add(instrumentBox(0.26,0.2, 0.1,   0.22, -0.05, -BODY_W/2-0.062, MAT.darkPaint));
    chassis.add(instrumentBox(0.2, 0.2, 0.2,  -0.80,  0.0,   0.0,            MAT.darkPaint));

    // 前部光谱仪筒
    const spectro = cyl(0.07,0.07,0.2,16, MAT.polished, BODY_L/2+0.04, -0.08, 0.34);
    spectro.rotation.z=Math.PI/2; chassis.add(spectro);
    chassis.add(cyl(0.075,0.075,0.02,16, MAT.darkSteel, BODY_L/2+0.14, -0.08, 0.34).rotateZ(Math.PI/2));

    // RTG 同位素电源（尾部带鳍片圆柱）
    const rtg=new THREE.Group();
    rtg.add(cyl(0.085,0.085,0.42,20, MAT.darkSteel,0,0,0));
    for(let i=0;i<8;i++){
      const f=box(0.012,0.1,0.4, MAT.polished, 0,0,0);
      f.rotation.y = i/8*Math.PI*2;
      f.position.set(Math.cos(i/8*Math.PI*2)*0.1, 0, Math.sin(i/8*Math.PI*2)*0.1);
      f.lookAt(0,0,0); f.castShadow=true;
      rtg.add(f);
    }
    rtg.rotation.z=Math.PI/2;
    rtg.rotation.x=0.18;
    rtg.position.set(-BODY_L/2-0.14, 0.06, -0.3);
    chassis.add(rtg);

    // ---------- 线缆束 ----------
    chassis.add(cableRun([
      [-0.34, 0.1,  BODY_W/2+0.072],[-0.1, 0.19, BODY_W/2+0.05],
      [ 0.26, 0.2,  BODY_W/2+0.03],[ 0.62, 0.1,  BODY_W/2+0.02]], 0.016));
    chassis.add(cableRun([
      [-0.34, 0.08, BODY_W/2+0.09],[-0.06, 0.16, BODY_W/2+0.075],
      [ 0.3,  0.17, BODY_W/2+0.055],[ 0.6,  0.06, BODY_W/2+0.03]], 0.011));
    chassis.add(cableRun([
      [ 0.22, 0.06, -BODY_W/2-0.062],[0.02, 0.2, -BODY_W/2-0.04],
      [-0.4,  0.22, -BODY_W/2-0.03],[-0.78, 0.1, -BODY_W/2-0.02]], 0.014));
    chassis.add(cableRun([
      [ BODY_L/2-0.1, 0.26, 0.3],[BODY_L/2-0.3, 0.3, 0.42],
      [ BODY_L/2-0.6, 0.29, 0.5],[BODY_L/2-0.9, 0.27, 0.46]], 0.01));
    // 线缆固定卡箍
    for(const p of [[-0.1,0.19,BODY_W/2+0.05],[0.26,0.2,BODY_W/2+0.03],[-0.4,0.22,-BODY_W/2-0.03]]){
      const cl=cyl(0.026,0.026,0.016,10, MAT.polished, p[0],p[1],p[2]);
      cl.rotation.x=Math.PI/2; chassis.add(cl);
    }
  }

  /* ---------- 9.2 金属丝网车轮（阿波罗 LRV / VIPER 风格） ---------- */
  const WHEEL_R = 0.325, WHEEL_W = 0.235;

  function buildWheel(){
    const w = new THREE.Group();
    const AX = new THREE.Vector3(0,0,1);          // 轮轴 = Z
    const UPY = new THREE.Vector3(0,1,0);         // 圆柱/箱体默认长轴 = Y

    // 把一个长轴为 Y 的物体对齐到任意方向
    function aim(mesh, dir){
      mesh.quaternion.setFromUnitVectors(UPY, dir.clone().normalize());
    }

    // --- 经向细钢丝环：轮盘平面 = XY，环法线 = Z（无需旋转）---
    const WIRES = 30;
    const wireGeo = new THREE.TorusGeometry(WHEEL_R, 0.0072, 5, 30);
    for(let i=0;i<WIRES;i++){
      const t = WIRES===1 ? 0.5 : i/(WIRES-1);
      const ring=new THREE.Mesh(wireGeo, MAT.mesh);
      ring.position.z=(t-0.5)*WHEEL_W*0.94;
      // 丝网中部受压略微外凸，形成真实的轮胎鼓形
      const bulge = 1 - Math.pow((t-0.5)*2, 2)*0.055;
      ring.scale.set(bulge, bulge, 1);
      ring.castShadow=true;
      w.add(ring);
    }

    // --- 交叉编织钢丝：长轴沿轮轴方向，并在切平面内左右倾斜 ---
    const XW = 26;
    const chordGeo = new THREE.CylinderGeometry(0.0058,0.0058,WHEEL_W*1.06,5);
    for(let i=0;i<XW;i++){
      const a=i/XW*Math.PI*2;
      const tangent=new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      for(const sgn of [1,-1]){
        const c=new THREE.Mesh(chordGeo, MAT.mesh);
        // 轴向为主 + 切向倾斜 → 菱形网格
        const dir=new THREE.Vector3().copy(AX).multiplyScalar(0.9)
                   .addScaledVector(tangent, sgn*0.42);
        aim(c, dir);
        c.position.set(Math.cos(a)*WHEEL_R*0.992, Math.sin(a)*WHEEL_R*0.992, 0);
        c.castShadow=true;
        w.add(c);
      }
    }

    // --- 人字形抓地胎面条：贴附轮面，沿轴向横跨 ---
    for(let i=0;i<18;i++){
      const a=i/18*Math.PI*2;
      const radial=new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const tangent=new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      for(const half of [-1,1]){
        // 薄片：Y 为长边（轴向横跨），X/Z 为厚度
        const gr=new THREE.Mesh(new THREE.BoxGeometry(0.016, WHEEL_W*0.46, 0.026), MAT.polished);
        const dir=new THREE.Vector3().copy(AX).multiplyScalar(1.0)
                   .addScaledVector(tangent, half*0.26);     // 人字倾角
        aim(gr, dir);
        gr.position.copy(radial).multiplyScalar(WHEEL_R+0.009);
        gr.position.z = half*WHEEL_W*0.235;
        gr.castShadow=true;
        w.add(gr);
      }
    }

    // --- 轮缘环（两侧）---
    for(const sz of [-1,1]){
      const rim=new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R*1.004, 0.015, 7, 40), MAT.polished);
      rim.position.z=sz*WHEEL_W/2;
      rim.castShadow=true;
      w.add(rim);
    }
    // 内侧缓冲衬环
    const inner=new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R*0.70, 0.024, 8, 32), MAT.darkSteel);
    inner.castShadow=true; w.add(inner);
    // 中段加强环
    const midRing=new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R*0.88, 0.0075, 6, 34), MAT.mesh);
    midRing.castShadow=true; w.add(midRing);

    // --- 轮毂（轴沿 Z）---
    const hub=cyl(0.082,0.082,WHEEL_W*0.5,20, MAT.polished,0,0,0);
    hub.rotation.x=Math.PI/2; w.add(hub);
    const hubCap=cyl(0.06,0.05,0.028,16, MAT.foil,0,0,WHEEL_W*0.27);
    hubCap.rotation.x=Math.PI/2; w.add(hubCap);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      const b=new THREE.Mesh(G.boltHead, MAT.darkSteel);
      b.position.set(Math.cos(a)*0.045, Math.sin(a)*0.045, WHEEL_W*0.29);
      b.rotation.x=Math.PI/2; b.scale.setScalar(1.3); b.castShadow=true;
      w.add(b);
    }

    // --- 双层 V 形辐条：位于轮盘平面内，径向展开 ---
    const SPOKES=14;
    for(let i=0;i<SPOKES;i++){
      const a=i/SPOKES*Math.PI*2;
      const len=WHEEL_R-0.082;
      for(const sz of [-1,1]){
        const sp=cyl(0.0078,0.0105,len,6, MAT.polished,0,0,0);
        // 长轴沿径向
        sp.rotation.z=a-Math.PI/2;
        sp.position.set(Math.cos(a)*(0.082+len/2), Math.sin(a)*(0.082+len/2), sz*WHEEL_W*0.2);
        sp.castShadow=true;
        w.add(sp);
      }
    }

    // 合并为极少数网格，显著降低 draw call
    return mergeByMaterial(w);
  }

  /* ---------- 9.3 rocker-bogie 悬挂 ---------- */
  // 轮位：X 前后，Z 左右；6 轮独立
  const WHEEL_POS = [
    { x: 0.86, z: 0.80, role:'front' },
    { x: 0.00, z: 0.80, role:'mid'   },
    { x:-0.86, z: 0.80, role:'rear'  },
    { x: 0.86, z:-0.80, role:'front' },
    { x: 0.00, z:-0.80, role:'mid'   },
    { x:-0.86, z:-0.80, role:'rear'  }
  ];
  const wheels = [];
  const legs = [];

  WHEEL_POS.forEach((wp, idx)=>{
    const side = Math.sign(wp.z);

    // 腿部组（挂在 chassis 下方，支点在车体侧）
    const leg = new THREE.Group();
    leg.position.set(wp.x*0.52, -BODY_H/2+0.06, wp.z*0.42);
    chassis.add(leg);
    legs.push(leg);

    // --- 摇臂连杆：从车体支点斜向外下连到轮轴 ---
    const axleLocal = new THREE.Vector3(wp.x - wp.x*0.52, -0.70+BODY_H/2-0.06+WHEEL_R, wp.z - wp.z*0.42);

    function strut(from, to, r1, r2, mat){
      const dir=new THREE.Vector3().subVectors(to,from);
      const len=dir.length();
      const m=cyl(r1,r2,len,10, mat, 0,0,0);
      m.position.copy(from).addScaledVector(dir,0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      return m;
    }

    const pivot = new THREE.Vector3(0,0,0);
    const kneeA = new THREE.Vector3(axleLocal.x*0.46, axleLocal.y*0.44, axleLocal.z*0.72);
    const kneeB = new THREE.Vector3(axleLocal.x*0.82, axleLocal.y*0.8,  axleLocal.z*0.94);

    // 主摇臂（上段，较粗）
    leg.add(strut(pivot, kneeA, 0.034, 0.028, MAT.polished));
    // 转向节段
    leg.add(strut(kneeA, kneeB, 0.027, 0.023, MAT.polished));
    // 下段至轮轴
    leg.add(strut(kneeB, axleLocal, 0.024, 0.02, MAT.carbon));
    // 平行辅助拉杆（bogie 三角形）
    const braceTop = new THREE.Vector3(axleLocal.x*0.12, 0.085, axleLocal.z*0.3);
    leg.add(strut(braceTop, kneeB, 0.014, 0.012, MAT.darkSteel));
    leg.add(strut(braceTop, pivot, 0.012, 0.012, MAT.darkSteel));
    // 前/后轮额外的差动连杆，强化 rocker-bogie 观感
    if(wp.role !== 'mid'){
      const diff = new THREE.Vector3(axleLocal.x*0.3, 0.12, axleLocal.z*0.55);
      leg.add(strut(diff, kneeA, 0.011, 0.011, MAT.darkSteel));
    }

    // 关节：支点与膝部的圆柱轴套
    [pivot, kneeA, kneeB].forEach((pt,i)=>{
      const j=cyl(0.042-i*0.006, 0.042-i*0.006, 0.062, 14, MAT.darkSteel, pt.x,pt.y,pt.z);
      j.rotation.x=Math.PI/2;
      leg.add(j);
      // 关节端盖金箔
      const cap=cyl(0.03-i*0.004,0.026-i*0.004,0.016,12, MAT.foil, pt.x,pt.y,pt.z+side*0.038);
      cap.rotation.x=Math.PI/2;
      leg.add(cap);
    });

    // 转向作动器（前后轮）
    if(wp.role!=='mid'){
      const act=cyl(0.03,0.03,0.12,12, MAT.darkSteel, axleLocal.x, axleLocal.y+0.1, axleLocal.z);
      leg.add(act);
      const rodm=cyl(0.012,0.012,0.08,8, MAT.polished, axleLocal.x, axleLocal.y+0.185, axleLocal.z);
      leg.add(rodm);
    }

    // 轮毂电机壳
    const motor=cyl(0.062,0.062,0.1,16, MAT.darkSteel, axleLocal.x, axleLocal.y, axleLocal.z - side*0.1);
    motor.rotation.x=Math.PI/2;
    leg.add(motor);

    // 腿部线缆（沿摇臂走线）
    leg.add(cableRun([
      [braceTop.x, braceTop.y+0.02, braceTop.z],
      [kneeA.x, kneeA.y+0.03, kneeA.z],
      [kneeB.x, kneeB.y+0.025, kneeB.z],
      [axleLocal.x, axleLocal.y+0.05, axleLocal.z]], 0.008));

    // 车轮本体
    const wheel = buildWheel();
    wheel.position.copy(axleLocal);
    leg.add(wheel);
    wheels.push({ mesh:wheel, data:wp, leg, axleLocal:axleLocal.clone(),
                  worldX: wp.x, worldZ: wp.z });
  });

  /* ---------- 9.4 顶部太阳能板阵列（略微倾斜） ---------- */
  const solarRig = new THREE.Group();
  solarRig.position.set(-0.12, BODY_H/2 + 0.2, 0);
  chassis.add(solarRig);
  {
    // 支撑立柱
    for(const sx of [-1,1]) for(const sz of [-1,1]){
      solarRig.add(cyl(0.018,0.018,0.2,10, MAT.polished, sx*0.52, -0.1, sz*0.42));
    }
    // 主板（倾斜 10°，朝向太阳侧）
    const panelGrp = new THREE.Group();
    panelGrp.rotation.z = -0.175;           // ~10°
    panelGrp.rotation.x = 0.055;
    solarRig.add(panelGrp);

    function panel(w,d,x,z,rotY=0,rotZ=0){
      const g=new THREE.Group();
      // 电池片正面
      const face=box(w,0.012,d, MAT.solar, 0,0.008,0);
      g.add(face);
      // 背板
      g.add(box(w*0.995,0.01,d*0.995, MAT.solarBack, 0,-0.004,0));
      // 蜂窝边框
      g.add(box(w+0.024,0.026,0.022, MAT.polished, 0,0, d/2+0.011));
      g.add(box(w+0.024,0.026,0.022, MAT.polished, 0,0,-d/2-0.011));
      g.add(box(0.022,0.026,d+0.024, MAT.polished,  w/2+0.011,0,0));
      g.add(box(0.022,0.026,d+0.024, MAT.polished, -w/2-0.011,0,0));
      // 背面加强桁架
      for(let i=-1;i<=1;i++) g.add(box(w*0.96,0.016,0.014, MAT.polished, 0,-0.016,i*d*0.3));
      g.position.set(x,0,z);
      g.rotation.y=rotY; g.rotation.z=rotZ;
      return g;
    }
    // 中央主板
    panelGrp.add(panel(1.16, 1.0, 0, 0));
    // 左右侧展开翼板（略微上折）
    const wingL = panel(0.56, 0.94, 0, 0.98, 0, 0);
    wingL.rotation.x = 0.14;  panelGrp.add(wingL);
    const wingR = panel(0.56, 0.94, 0, -0.98, 0, 0);
    wingR.rotation.x = -0.14; panelGrp.add(wingR);
    // 翼板铰链
    for(const sz of [1,-1]){
      const h=cyl(0.016,0.016,0.5,10, MAT.darkSteel, 0,-0.012, sz*0.52);
      h.rotation.z=Math.PI/2; h.rotation.y=Math.PI/2;
      panelGrp.add(h);
    }
  }

  /* ---------- 9.5 高增益碟形天线 + 鞭状天线 ---------- */
  const dishRig = new THREE.Group();
  dishRig.position.set(-0.74, BODY_H/2+0.1, 0.4);
  chassis.add(dishRig);
  {
    // 双轴万向支座
    dishRig.add(cyl(0.05,0.062,0.1,14, MAT.darkSteel, 0,0.05,0));
    dishRig.add(cyl(0.028,0.028,0.26,12, MAT.polished, 0,0.22,0));
    const gimbal=cyl(0.038,0.038,0.07,14, MAT.darkSteel, 0,0.37,0);
    gimbal.rotation.z=Math.PI/2; dishRig.add(gimbal);

    const dishGroup=new THREE.Group();
    dishGroup.position.y=0.4;
    dishGroup.rotation.set(-0.72, 0.5, 0.18);          // 指向地球方向
    dishRig.add(dishGroup);

    // 碟面（抛物面：用 LatheGeometry 旋成）
    const pts=[];
    for(let i=0;i<=16;i++){
      const r=i/16*0.30;
      pts.push(new THREE.Vector2(r, r*r*1.5));
    }
    const dish=new THREE.Mesh(new THREE.LatheGeometry(pts, 48),
      new THREE.MeshPhysicalMaterial({ color:0xf0f2f5, metalness:0.92, roughness:0.17,
        clearcoat:0.6, side:THREE.DoubleSide,
        envMap:ENV, envMapIntensity:1.0 }));
    dish.castShadow=true; dish.receiveShadow=true;
    dishGroup.add(dish);
    // 碟背加强辐条
    for(let i=0;i<10;i++){
      const a=i/10*Math.PI*2;
      const sp=cyl(0.006,0.006,0.3,6, MAT.polished, Math.cos(a)*0.15, -0.02, Math.sin(a)*0.15);
      sp.rotation.z=Math.PI/2; sp.rotation.y=-a;
      dishGroup.add(sp);
    }
    // 碟缘环
    const edge=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.008,6,44), MAT.polished);
    edge.rotation.x=Math.PI/2; edge.position.y=0.135; dishGroup.add(edge);
    // 馈源与三脚支架
    dishGroup.add(cyl(0.022,0.016,0.07,12, MAT.foil, 0,0.33,0));
    for(let i=0;i<3;i++){
      const a=i/3*Math.PI*2;
      const t=cyl(0.005,0.005,0.34,6, MAT.polished, Math.cos(a)*0.1, 0.17, Math.sin(a)*0.1);
      t.lookAt(0,0.33,0);
      t.position.set(Math.cos(a)*0.1, 0.17, Math.sin(a)*0.1);
      dishGroup.add(t);
    }
    // 鞭状天线（细长锥，顶端小球）
    const whip=cyl(0.0035,0.007,1.25,6, MAT.polished, 0.06, 0.0, -0.34);
    whip.position.set(0.06, 0.62, -0.34);
    whip.rotation.z=0.1; whip.rotation.x=-0.07;
    dishRig.add(whip);
    dishRig.add(cyl(0.02,0.024,0.05,10, MAT.darkSteel, 0.06, 0.02, -0.34));
    const tip=mk(new THREE.SphereGeometry(0.014,10,8), MAT.warnRed, 0.1, 1.24, -0.42);
    dishRig.add(tip);
    // 第二根短鞭天线
    const whip2=cyl(0.003,0.005,0.62,6, MAT.polished, -0.1, 0.34, -0.2);
    whip2.rotation.z=-0.22; dishRig.add(whip2);
  }

  /* ---------- 9.6 桅杆式相机云台（可摆动） ---------- */
  const mastYaw = new THREE.Group();          // 水平摆动节点
  mastYaw.position.set(0.70, BODY_H/2+0.06, -0.3);
  chassis.add(mastYaw);
  let mastHead = null;
  {
    // 桅杆基座
    mastYaw.add(cyl(0.062,0.072,0.08,16, MAT.darkSteel, 0,0.04,0));
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      const b=new THREE.Mesh(G.boltHead, MAT.polished);
      b.position.set(Math.cos(a)*0.056, 0.082, Math.sin(a)*0.056);
      b.scale.setScalar(1.2); b.castShadow=true;
      mastYaw.add(b);
    }
    // 两段桅杆（下粗上细）
    mastYaw.add(cyl(0.032,0.038,0.5,14, MAT.polished, 0,0.33,0));
    mastYaw.add(cyl(0.024,0.03,0.42,12, MAT.carbon,  0,0.78,0));
    // 桅杆上的线缆
    mastYaw.add(cableRun([[0.04,0.1,0.02],[0.05,0.4,0.03],[0.04,0.72,0.02],[0.02,0.98,0.0]],0.007));
    // 桅杆中段卡箍
    for(const y of [0.2,0.46,0.72]){
      const cl=cyl(0.04,0.04,0.018,12, MAT.darkSteel, 0,y,0);
      mastYaw.add(cl);
    }

    // 相机头（俯仰节点）
    mastHead = new THREE.Group();
    mastHead.position.y = 1.03;
    mastYaw.add(mastHead);

    // 云台俯仰轴
    const pitchAxis=cyl(0.026,0.026,0.2,12, MAT.darkSteel,0,0,0);
    pitchAxis.rotation.x=Math.PI/2; mastHead.add(pitchAxis);

    // 相机横梁
    mastHead.add(box(0.1,0.1,0.44, MAT.darkPaint, 0,0.04,0));
    mastHead.add(box(0.106,0.02,0.45, MAT.polished, 0,0.095,0));
    // 遮光罩 + 两个立体相机镜头
    for(const sz of [-1,1]){
      const z=sz*0.155;
      // 镜筒
      const barrel=cyl(0.038,0.042,0.11,18, MAT.polished, 0.07,0.04,z);
      barrel.rotation.z=Math.PI/2; mastHead.add(barrel);
      // 遮光罩（略外张）
      const hood=cyl(0.05,0.04,0.05,18, MAT.darkSteel, 0.145,0.04,z);
      hood.rotation.z=Math.PI/2; mastHead.add(hood);
      // 玻璃镜片（有反射质感）
      const lens=cyl(0.034,0.034,0.012,22, MAT.glass, 0.158,0.04,z);
      lens.rotation.z=Math.PI/2; mastHead.add(lens);
      // 镜片中央高光小球
      const pupil=mk(new THREE.SphereGeometry(0.016,14,10), MAT.glass, 0.162,0.04,z);
      mastHead.add(pupil);
      // 镜筒散热环
      for(let i=0;i<3;i++){
        const r=cyl(0.044,0.044,0.006,16, MAT.darkSteel, 0.03+i*0.03,0.04,z);
        r.rotation.z=Math.PI/2; mastHead.add(r);
      }
    }
    // 顶部激光诱导击穿光谱仪小窗
    mastHead.add(box(0.07,0.05,0.07, MAT.foil, 0.02,0.115,0));
    const laser=cyl(0.016,0.016,0.04,12, MAT.glass, 0.06,0.115,0);
    laser.rotation.z=Math.PI/2; mastHead.add(laser);
    // 相机头警示小块
    mastHead.add(box(0.012,0.03,0.03, MAT.warnRed, -0.052,0.04,0.1, false));
  }

  /* ---------- 9.7 多关节机械臂（末端取样铲 + 钻头） ---------- */
  const armBase = new THREE.Group();
  armBase.position.set(0.88, -BODY_H/2+0.04, 0.46);
  chassis.add(armBase);
  const armJ1 = new THREE.Group();   // 肩部 yaw
  const armJ2 = new THREE.Group();   // 大臂 pitch
  const armJ3 = new THREE.Group();   // 小臂 pitch
  const armJ4 = new THREE.Group();   // 手腕
  {
    // 肩座
    armBase.add(cyl(0.056,0.066,0.07,16, MAT.darkSteel,0,0,0));
    armBase.add(armJ1);
    armJ1.add(cyl(0.046,0.046,0.08,14, MAT.polished,0,0.06,0));
    armJ1.add(armJ2);
    armJ2.position.y=0.1;

    // 大臂（箱型桁架 + 两侧加强）
    const upperLen=0.52;
    armJ2.add(cyl(0.034,0.03,upperLen,12, MAT.polished, 0,upperLen/2,0));
    armJ2.add(box(0.016,upperLen*0.9,0.05, MAT.carbon, 0.034,upperLen/2,0));
    armJ2.add(cableRun([[0.02,0.02,0.02],[0.03,0.2,0.03],[0.02,0.42,0.02]],0.006));
    // 大臂作动筒
    const act1=cyl(0.02,0.02,0.2,10, MAT.darkSteel, -0.04,0.16,0);
    act1.rotation.z=-0.2; armJ2.add(act1);

    armJ2.add(armJ3);
    armJ3.position.y=upperLen;
    // 肘关节
    const elbow=cyl(0.036,0.036,0.072,14, MAT.darkSteel,0,0,0);
    elbow.rotation.x=Math.PI/2; armJ3.add(elbow);
    const elbowCap=cyl(0.026,0.022,0.014,12, MAT.foil,0,0,0.044);
    elbowCap.rotation.x=Math.PI/2; armJ3.add(elbowCap);

    // 小臂
    const foreLen=0.42;
    armJ3.add(cyl(0.026,0.023,foreLen,12, MAT.polished, 0,foreLen/2,0));
    armJ3.add(box(0.012,foreLen*0.85,0.038, MAT.carbon, 0.027,foreLen/2,0));
    armJ3.add(cableRun([[0.018,0.02,0.015],[0.024,0.18,0.02],[0.016,0.36,0.014]],0.005));

    armJ3.add(armJ4);
    armJ4.position.y=foreLen;
    // 手腕转盘
    const wrist=cyl(0.03,0.03,0.05,14, MAT.darkSteel,0,0,0);
    armJ4.add(wrist);
    // 末端执行器转塔
    const turret=cyl(0.044,0.044,0.07,16, MAT.polished,0,0.055,0);
    armJ4.add(turret);

    // --- 取样铲（梯形铲斗）---
    const scoop=new THREE.Group();
    scoop.position.set(0.0,0.1,0.05);
    scoop.rotation.x=0.5;
    // 铲面
    const blade=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.058,0.09,16,1,true,0,Math.PI),
      new THREE.MeshPhysicalMaterial({ color:0xd2d6dc, metalness:1.0, roughness:0.2,
        side:THREE.DoubleSide, clearcoat:0.4, envMap:ENV, envMapIntensity:0.9 }));
    blade.rotation.z=Math.PI/2;
    blade.castShadow=true;
    scoop.add(blade);
    // 铲侧壁
    for(const sz of [-1,1]){
      const side=new THREE.Mesh(new THREE.CircleGeometry(0.058,16,0,Math.PI),
        new THREE.MeshStandardMaterial({color:0xc8ccd2, metalness:1.0, roughness:0.22,
          side:THREE.DoubleSide, envMap:ENV, envMapIntensity:0.9}));
      side.position.set(sz*0.045,0,0);
      side.rotation.y=Math.PI/2;
      side.castShadow=true;
      scoop.add(side);
    }
    // 铲刃（锐利前缘）
    scoop.add(box(0.1,0.006,0.02, MAT.polished, 0,-0.056,0));
    // 铲齿
    for(let i=0;i<5;i++)
      scoop.add(box(0.008,0.018,0.012, MAT.polished, -0.04+i*0.02,-0.066,0));
    armJ4.add(scoop);

    // --- 岩芯钻头（转塔另一侧）---
    const drill=new THREE.Group();
    drill.position.set(0.055,0.07,-0.03);
    drill.rotation.z=-0.42;
    drill.add(cyl(0.022,0.022,0.09,14, MAT.darkSteel,0,0,0));
    // 螺旋钻杆：小圆环堆叠成螺旋
    for(let i=0;i<14;i++){
      const t=i/14;
      const f=new THREE.Mesh(new THREE.TorusGeometry(0.014,0.0035,5,14), MAT.polished);
      f.position.y=-0.05-t*0.12;
      f.rotation.x=Math.PI/2;
      f.rotation.z=t*7.0;
      f.scale.set(1,1,0.5);
      f.castShadow=true;
      drill.add(f);
    }
    drill.add(cyl(0.001,0.012,0.05,10, MAT.polished, 0,-0.2,0));
    armJ4.add(drill);

    // --- 显微成像相机（转塔第三面）---
    const micro=cyl(0.016,0.016,0.05,12, MAT.darkSteel, -0.05,0.06,0.02);
    micro.rotation.z=0.5; armJ4.add(micro);
    armJ4.add(mk(new THREE.SphereGeometry(0.012,10,8), MAT.glass, -0.072,0.045,0.02));

    // 初始姿态：收拢在车体前方（巡航姿态）
    armJ1.rotation.y = -0.45;
    armJ2.rotation.z = -0.95;
    armJ3.rotation.z = 1.5;
    armJ4.rotation.z = 0.5;
  }


  return { rover, wheels, mastYaw, mastHead, armJ1, armJ3,
           BODY_L, BODY_W, BODY_H, WHEEL_R, WHEEL_W };
}
