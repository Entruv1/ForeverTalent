// 打包后自检：直接读 dist/win-unpacked/resources/app.asar，断言内嵌的 app.html
// 与源文件逐字节一致、版本号正确。等价于「跑过一次 exe」。
// 便携版 exe 不吃 TF_SMOKE（NSIS 启动器直接 exit 0），所以只能这样验打包产物。
'use strict';
const asar = require('@electron/asar');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const A = path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');
if (!fs.existsSync(A)) {
  console.error('[verify-dist] 找不到 ' + A + '（先跑 node scripts/dist.js）');
  process.exit(1);
}
const norm = (p) => p.replace(/^[\\/]+/, '').split(/[\\/]/).join('/');
const list = asar.listPackage(A).map(norm);
const find = (name) => list.find((p) => p === name || p.endsWith('/' + name));

const appPath = find('app.html');
const buf = asar.extractFile(A, appPath);
const src = fs.readFileSync(path.join(root, 'app.html'));
const same = buf.length === src.length && buf.equals(src);

const pkgPath = find('package.json');
const ver = JSON.parse(asar.extractFile(A, pkgPath).toString('utf8')).version;
const want = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

console.log('[verify-dist] asar            : %s', A);
console.log('[verify-dist] 条目数          : %d', list.length);
console.log('[verify-dist] app.html        : %s  %d 字节 / 源 %d 字节', appPath, buf.length, src.length);
console.log('[verify-dist] 与源逐字节一致  : %s', same ? '是' : '否');
console.log('[verify-dist] package version : %s（期望 %s）', ver, want);

let bad = 0;
if (!same) { console.error('[verify-dist] ✗ app.html 与源文件不一致'); bad++; }
if (ver !== want) { console.error('[verify-dist] ✗ 版本号不一致'); bad++; }
if (bad) process.exit(1);
console.log('[verify-dist] 通过');
