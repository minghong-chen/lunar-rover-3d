#!/usr/bin/env node
/**
 * Vendor three.js into the repo for offline use / 将 three.js 落地到仓库以供离线使用
 *
 * Copies three.module.js plus the two addons this project uses into
 * `vendor/three/`, then writes `index.offline.html` whose import map points at
 * those local files. The result runs with no network access.
 *
 * 把 three.module.js 及本项目用到的两个附加模块复制到 vendor/three/，
 * 并生成 index.offline.html，其 import map 指向这些本地文件，无需联网即可运行。
 *
 * Usage: npm install && node scripts/vendor-three.mjs
 */

import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TM = join(ROOT, 'node_modules/three');
const OUT = join(ROOT, 'vendor/three');

try {
  await access(join(TM, 'build/three.module.js'));
} catch {
  console.error('\n  ERROR: three is not installed. Run `npm install` first.\n');
  process.exit(1);
}

await mkdir(join(OUT, 'addons/controls'), { recursive: true });
await mkdir(join(OUT, 'addons/utils'), { recursive: true });

const files = [
  ['build/three.module.js', 'three.module.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
];

for (const [from, to] of files) {
  await copyFile(join(TM, from), join(OUT, to));
  console.log(`  vendored  vendor/three/${to}`);
}

// Addons import bare 'three'; rewrite those to the local relative path.
for (const rel of ['addons/controls/OrbitControls.js', 'addons/utils/BufferGeometryUtils.js']) {
  const p = join(OUT, rel);
  const depth = rel.split('/').length - 1;          // addons/<dir>/file.js
  const back = '../'.repeat(depth);
  let code = await readFile(p, 'utf8');
  code = code.replace(/from\s*['"]three['"]/g, `from '${back}three.module.js'`);
  await writeFile(p, code, 'utf8');
}
console.log('  rewrote   bare "three" specifiers to local paths');

// Generate the offline entry page from index.html.
const src = await readFile(join(ROOT, 'index.html'), 'utf8');
const offlineMap = `<script type="importmap">
{
  "imports": {
    "three": "./vendor/three/three.module.js",
    "three/addons/": "./vendor/three/addons/"
  }
}
</script>`;

const out = src.replace(/<script type="importmap">[\s\S]*?<\/script>/, offlineMap);
if (out === src) {
  console.error('  ERROR: could not rewrite the import map in index.html');
  process.exit(1);
}
await writeFile(join(ROOT, 'index.offline.html'), out, 'utf8');
console.log('  wrote     index.offline.html  (serve it to run with no network)\n');
