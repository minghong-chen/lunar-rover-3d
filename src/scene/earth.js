/**
 * Distant Earth with atmospheric limb glow / 远处地球与大气边缘辉光
 *
 * Earth hangs above the horizon as seen from the lunar surface. The limb glow
 * is a Fresnel shader on a slightly larger back-face sphere.
 * 地球悬挂在月面地平线上方，边缘辉光由一层略大的背面球体上的菲涅尔着色器实现。
 */

import * as THREE from 'three';

/**
 * @param {THREE.Scene} scene
 * @param {Record<string, THREE.Texture>} TEX
 * @returns {THREE.Group}
 */
export function createEarth(scene, TEX){
  const earthGroup = new THREE.Group();
  {
    const R=215;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 48),
      new THREE.MeshStandardMaterial({ map:TEX.earth, roughness:0.82, metalness:0.0,
        emissive:0x0a1a33, emissiveIntensity:0.25 })
    );
    globe.rotation.y = 2.1;
    earthGroup.add(globe);

    // 内层大气薄壳
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R*1.035, 48, 32),
      new THREE.MeshBasicMaterial({ color:0x5d9ae8, transparent:true, opacity:0.14,
        side:THREE.BackSide, depthWrite:false, toneMapped:false })
    );
    earthGroup.add(atmo);

    // 边缘辉光 —— 自定义 shader 菲涅尔
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(R*1.19, 48, 32),
      new THREE.ShaderMaterial({
        transparent:true, side:THREE.BackSide, depthWrite:false, blending:THREE.AdditiveBlending,
        uniforms:{ uColor:{ value:new THREE.Color(0x6fb0ff) } },
        vertexShader:`varying vec3 vN; varying vec3 vP;
          void main(){ vN=normalize(normalMatrix*normal);
            vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz;
            gl_Position=projectionMatrix*mv; }`,
        fragmentShader:`uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
          void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(-vP))),2.6);
            gl_FragColor=vec4(uColor, f*0.85); }`
      })
    );
    earthGroup.add(glow);

    earthGroup.position.set(-980, 300, -2950);
    scene.add(earthGroup);
  }


  return earthGroup;
}
