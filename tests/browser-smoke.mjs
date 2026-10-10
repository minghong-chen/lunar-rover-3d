#!/usr/bin/env node
/**
 * Browser smoke test / 浏览器冒烟测试
 *
 * Boots the static server, loads the modular build in a real browser, and
 * fails if the page logs any error or the HUD never starts advancing.
 *
 * Playwright is OPTIONAL and intentionally not a dependency of this project
 * (it downloads ~400 MB of browsers). If it is missing, this script exits 0
 * with a clear SKIPPED notice rather than failing the suite.
 *
 * 启动静态服务器，在真实浏览器中加载模块化版本，
 * 若页面出现任何错误或 HUD 里程不前进则失败。
 *
 * Playwright 是可选的，刻意未列为本项目依赖（需下载约 400MB 浏览器）。
 * 缺失时脚本以 0 退出并给出明确的 SKIPPED 提示，不会使测试套件失败。
 *
 * Enable it with:  npm i -D playwright && npx playwright install chromium
 * 启用方式：       npm i -D playwright && npx playwright install chromium
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 8766);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('\n  SKIPPED: playwright is not installed.');
  console.log('  This is expected on a fresh clone and does not indicate a failure.');
  console.log('  To enable the browser smoke test:');
  console.log('    npm i -D playwright && npx playwright install chromium\n');
  process.exit(0);
}

const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), '--port', String(PORT)], {
  cwd: ROOT, stdio: 'ignore',
});
const stopServer = () => { try { server.kill(); } catch {} };
process.on('exit', stopServer);

await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// Software rendering in CI can be very slow; raise the default budget.
// CI 环境常为软件渲染，速度很慢，故放宽默认超时。
page.setDefaultTimeout(240000);
page.setDefaultNavigationTimeout(240000);

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
});
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));

let exitCode = 0;
try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });

  // The loader hides once the first frame has been compiled and rendered.
  await page.waitForFunction(
    () => { const l = document.getElementById('loader'); return l && l.style.display === 'none'; },
    { timeout: 240000, polling: 1000 },
  );
  console.log('  ok    scene initialised (loader dismissed)');

  // WebGL context must actually exist.
  const hasGl = await page.evaluate(() => {
    const c = document.getElementById('scene');
    return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
  });
  if (!hasGl) throw new Error('no WebGL context on #scene');
  console.log('  ok    WebGL context present');

  // Odometer must advance, proving the main loop is running.
  const read = () => page.evaluate(() => document.getElementById('hDist')?.textContent ?? '');
  const first = await read();
  await page.waitForTimeout(12000);
  const second = await read();
  if (parseFloat(second) <= parseFloat(first)) {
    throw new Error(`odometer did not advance (${first} -> ${second}); main loop may be stalled`);
  }
  console.log(`  ok    main loop running (odometer ${first} -> ${second} m)`);

  // Controls must be wired.
  await page.click('#bFree');
  const mode = await page.evaluate(() => document.getElementById('hMode')?.textContent);
  if (!mode || !mode.includes('自由')) throw new Error(`view-mode toggle did not apply (got "${mode}")`);
  console.log('  ok    view-mode toggle works');

  if (problems.length) throw new Error(`page reported problems:\n    ${problems.join('\n    ')}`);
  console.log('  ok    no console errors or warnings\n');
  console.log('  BROWSER SMOKE TEST PASSED\n');
} catch (err) {
  exitCode = 1;
  console.error(`\n  BROWSER SMOKE TEST FAILED\n  ${err.message}\n`);
} finally {
  await browser.close().catch(() => {});
  stopServer();
}

process.exit(exitCode);
