#!/usr/bin/env node
/**
 * Lightweight syntax gate / 轻量语法检查
 *
 * Parses every source module with Node's own parser. No external linter
 * dependency, so `npm run lint` works on a clean clone with no install.
 * 用 Node 自带解析器检查每个源模块，无需外部 linter，克隆后即可运行。
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (['.js', '.mjs'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const files = [
  ...await walk(join(ROOT, 'src')),
  ...await walk(join(ROOT, 'scripts')),
  ...await walk(join(ROOT, 'tests')),
];

let failed = 0;
for (const f of files) {
  const code = await readFile(f, 'utf8');
  try {
    new vm.SourceTextModule(code, { identifier: f });
    console.log(`  ok    ${f.replace(ROOT, '.')}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${f.replace(ROOT, '.')}\n        ${err.message}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} modules parsed cleanly.`);
process.exit(failed ? 1 : 0);
