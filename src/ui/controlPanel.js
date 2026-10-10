/**
 * Control panel bindings / 控制面板绑定
 *
 * Wires the translucent HUD panel to scene state. Kept free of Three.js
 * specifics so the panel can be reasoned about (and tested) independently.
 * 将半透明控制面板与场景状态连接。不含 Three.js 细节，便于独立理解与测试。
 */

/**
 * Format helpers kept pure so they can be unit tested.
 * 纯格式化函数，便于单元测试。
 */
export const fmt = {
  speed: (v) => `${v.toFixed(2)}×`,
  sun:   (v) => `${v.toFixed(0)}°`,
  star:  (v) => `${(v * 100).toFixed(0)}%`,
  /** FPS gets one decimal below 10 so very low frame rates stay honest. */
  fps:   (f) => (f < 10 ? f.toFixed(1) : f.toFixed(0)),
  dist:  (v) => v.toFixed(1),
  vel:   (v) => v.toFixed(2),
};

/**
 * @param {object} state - mutable scene state
 * @param {object} hooks - { updateSun, applyStarBrightness, onFollowChange }
 * @returns {{el:Record<string,HTMLElement>, setHud:Function}}
 */
export function bindControlPanel(state, hooks) {
  const $ = (id) => document.getElementById(id);

  const el = {
    bFollow: $('bFollow'), bFree: $('bFree'), bDrive: $('bDrive'),
    rSpeed: $('rSpeed'), rSun: $('rSun'), rStar: $('rStar'),
    vSpeed: $('vSpeed'), vSun: $('vSun'), vStar: $('vStar'),
    hDist: $('hDist'), hVel: $('hVel'), hMode: $('hMode'), hFps: $('hFps'),
  };

  el.bFollow.onclick = () => {
    state.followMode = true;
    el.bFollow.classList.add('on');
    el.bFree.classList.remove('on');
    el.hMode.textContent = '跟随';
    hooks.onFollowChange?.(true);
  };

  el.bFree.onclick = () => {
    state.followMode = false;
    el.bFree.classList.add('on');
    el.bFollow.classList.remove('on');
    el.hMode.textContent = '自由';
    hooks.onFollowChange?.(false);
  };

  el.bDrive.onclick = () => {
    state.driving = !state.driving;
    el.bDrive.textContent = state.driving ? '⏸ 暂停行驶' : '▶ 继续行驶';
    el.bDrive.classList.toggle('on', state.driving);
  };

  el.rSpeed.oninput = (e) => {
    state.speedScale = parseFloat(e.target.value);
    el.vSpeed.textContent = fmt.speed(state.speedScale);
  };

  el.rSun.oninput = (e) => {
    const v = parseFloat(e.target.value);
    hooks.updateSun(v);
    el.vSun.textContent = fmt.sun(v);
  };

  el.rStar.oninput = (e) => {
    const v = parseFloat(e.target.value) / 100;
    hooks.applyStarBrightness(v);
    el.vStar.textContent = fmt.star(v);
  };

  /** Push live telemetry into the HUD. */
  function setHud({ distance, velocity, fps }) {
    if (fps != null) el.hFps.textContent = fmt.fps(fps);
    if (distance != null) el.hDist.textContent = fmt.dist(distance);
    if (velocity != null) el.hVel.textContent = fmt.vel(velocity);
  }

  return { el, setHud };
}
