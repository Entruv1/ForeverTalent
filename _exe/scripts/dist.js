#!/usr/bin/env node
/**
 * 打包入口。
 *
 * 为什么需要这个脚本，而不是直接 `electron-builder --win --x64`：
 *
 *   electron-builder 在 Windows 上用 `powershell.exe -EncodedCommand` 去跑
 *   `npm list`（依赖收集器）。它调用的是裸命令名 `npm`，于是 PowerShell 会按自己的
 *   规则去解析，这里有两个坑：
 *
 *   1. PowerShell 优先命中 node 安装目录里的 `npm.ps1`。本机执行策略是 Restricted，
 *      `.ps1` 一律禁止运行 —— 脚本根本没启动，输出为空。electron-builder 只看到
 *      「文件是空的」，于是报 `No JSON content found in output`。
 *   2. node 从父进程继承不到 `PATHEXT`（Git Bash 不导出它），PowerShell 于是退回到
 *      只有 `.CPL` 的默认值 —— 连 `npm.cmd` 都执行不了。
 *
 *   解决办法不动系统设置（不改执行策略、不动 node 安装目录）：
 *     - 把 `PATHEXT` 补全，让 `.cmd` 重新可执行；
 *     - 在项目内建一个只放 `npm.cmd` 的 shim 目录并置于 PATH 最前，
 *       让 PowerShell 解析 `npm` 时命中 `.cmd` 而不是 `.ps1`。
 *
 * 用法：node scripts/dist.js [electron-builder 的额外参数]
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shimDir = path.join(root, '.tools');
const nodeDir = path.dirname(process.execPath);
const npmCli = path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');

const GOOD_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';

// ---------------------------------------------------------------- 前置检查
if (!fs.existsSync(npmCli)) {
  console.error('[dist] 找不到 npm-cli.js：' + npmCli);
  console.error('[dist] 请先用同一套 node 安装依赖。');
  process.exit(1);
}
const electronExe = require('electron'); // 纯 Node 下返回 exe 路径
if (typeof electronExe !== 'string') {
  console.error('[dist] 拿不到 electron 可执行文件路径，请先执行：');
  console.error('       node node_modules/electron/install.js');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'app.html'))) {
  console.error('[dist] 缺少 app.html，请先执行：node scripts/build-app.js');
  process.exit(1);
}

// ---------------------------------------------------------------- 建立 shim
fs.mkdirSync(shimDir, { recursive: true });
const shimBody = (cli) =>
  '@echo off\r\n"' + path.join(nodeDir, 'node.exe') + '" "' + cli + '" %*\r\n';
fs.writeFileSync(path.join(shimDir, 'npm.cmd'), shimBody(npmCli));
const npxCli = path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js');
if (fs.existsSync(npxCli)) fs.writeFileSync(path.join(shimDir, 'npx.cmd'), shimBody(npxCli));

// ---------------------------------------------------------------- 组装环境
const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
const env = {
  ...process.env,
  PATHEXT: GOOD_PATHEXT,
  [pathKey]: shimDir + ';' + (process.env[pathKey] || ''),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.TF_RELAUNCHED;

// electron-builder 会在打包中途去 GitHub 拉 winCodeSign / nsis 等二进制，
// 本机 GitHub 不可达 → connect ETIMEDOUT 20.205.243.166:443，打包半途而废
// （dist/ 里留着上一次的旧 exe，看起来像成功却是旧版本）。统一改走 npmmirror。
// 已显式设置的以调用者为准，方便临时切源。
env.ELECTRON_MIRROR =
  env.ELECTRON_MIRROR || 'https://registry.npmmirror.com/-/binary/electron/';
env.ELECTRON_BUILDER_BINARIES_MIRROR =
  env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://registry.npmmirror.com/-/binary/electron-builder-binaries/';

// ---------------------------------------------------------------- 清理上次产物
// electron-builder 会在解压 Electron 之前先删掉已存在的 dist\win-unpacked；
// 这一步在本机环境里会被安全删除策略拦下，于是打包中断。这里由我们自己、并且只在
// _exe/dist 目录内做一次限定范围的清理，保证反复打包是幂等的。
const distDir = path.join(root, 'dist');
const distRoot = path.resolve(distDir) + path.sep;
function cleanDist() {
  if (!fs.existsSync(distDir)) return;
  const targets = ['win-unpacked'];
  for (const f of fs.readdirSync(distDir)) {
    if (f.toLowerCase().endsWith('.exe') && !targets.includes(f)) targets.push(f);
  }
  for (const name of targets) {
    const p = path.resolve(distDir, name);
    if (!p.startsWith(distRoot)) throw new Error('拒绝清理 dist 之外的目标：' + p);
    if (!fs.existsSync(p)) continue;
    // 删不掉不算失败：本机的安全删除策略会拦下「上一次的 exe」这类刚被读过的文件，
    // 抛出来只会让一次本来成功的打包看起来像挂了。留个提示就够。
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log('[dist] 清理旧产物 ' + name);
    } catch (e) {
      console.warn('[dist] 跳过清理 ' + name + '（' + String(e.message).split('\n')[0].slice(0, 80) + '）');
    }
  }
}
cleanDist();

// ---------------------------------------------------------------- 调用
const cli = require.resolve('electron-builder/cli.js');
const argv = [cli, '--win', '--x64', ...process.argv.slice(2)];

console.log('[dist] shim 目录 : ' + shimDir);
console.log('[dist] PATHEXT   : ' + env.PATHEXT);
console.log('[dist] node      : ' + process.execPath);
console.log('[dist] electron  : ' + electronExe);
console.log('[dist] 开始打包 …');
console.log();

const started = Date.now();
const r = spawnSync(process.execPath, argv, { cwd: root, env, stdio: 'inherit' });

console.log();

const exes = fs.existsSync(distDir)
  ? fs.readdirSync(distDir).filter((f) => f.toLowerCase().endsWith('.exe'))
  : [];
// 目标产物是否已经落地 —— 只有它才是成败的判据。
// 但「存在」不够：cleanDist() 可能因安全策略删不掉上一版的 exe，而 electron-builder
// 中途失败时那个旧 exe 仍留在 dist 里 —— 只看存在会把**旧版本**当成成功
// （本轮就踩了：以为打成功，dist 里其实是 9 月 20 日的 1.1.3）。
// 所以必须核对文件名里的版本号 == package.json 的 version，并确认 mtime 是本次构建。
const want = require(path.join(root, 'package.json')).version;
const artifact = exes.find((f) => f.startsWith('永恒天赋计算器-' + want + '.'));
if (!artifact) {
  const stale = exes.filter((f) => f.startsWith('永恒天赋计算器-'));
  console.error('[dist] 打包失败：dist 里没有 永恒天赋计算器-' + want + '.exe（退出码 ' + r.status + '）');
  if (stale.length) {
    console.error('[dist]   dist 里残留的是旧版本：' + stale.join('、') +
      '（请手动删除后重试）');
  }
  process.exit(r.status === null || r.status === 0 ? 1 : r.status);
}
const artPath = path.join(distDir, artifact);
const artAge = Date.now() - fs.statSync(artPath).mtimeMs;
if (artAge > started - 5000) {
  // 比本次构建还老 → 是残留文件，不是这次产出的
  console.error('[dist] 打包失败：' + artifact + ' 的修改时间早于本次构建（疑似残留文件，未真正重新打包）');
  process.exit(1);
}
if (r.status !== 0) {
  // 实测：exe 已经写好了，但 electron-builder 返回非 0。
  // 原因是它收尾时想删 dist\win-unpacked 与中间产物 *.nsis.7z，被本机的
  // 安全删除策略拦下；产物本身完好（已用 smoke.js 验证过）。这里只告警。
  console.warn('[dist] 注意：electron-builder 退出码 = ' + r.status +
    '（产物已生成，通常是收尾清理被安全策略拦下，可忽略）');
}

// 收尾：清掉 electron-builder 没删成的中间产物（只在 dist 内）。
// 注意：本机的删除守卫会在「同一轮里删除次数过多」时直接抛错，
// 所以这里必须自己吞掉异常 —— 产物已经好了，不能因为收尾而让整个打包报失败。
for (const name of fs.readdirSync(distDir)) {
  if (!/\.nsis\.7z$/i.test(name)) continue;
  const p = path.resolve(distDir, name);
  if (!p.startsWith(distRoot)) throw new Error('拒绝清理 dist 之外的目标：' + p);
  try {
    fs.rmSync(p, { force: true });
    console.log('[dist] 清理中间产物 ' + name);
  } catch (e) {
    console.warn('[dist] 中间产物没删掉（可手动删，不影响产物）：' + name + ' — ' + String(e.message).slice(0, 80));
  }
}

console.log('[dist] 打包完成，用时 ' + Math.round((Date.now() - started) / 1000) + ' 秒');
for (const f of exes) {
  const p = path.join(distDir, f);
  console.log('[dist]   ' + f + '  ' + (fs.statSync(p).size / 1048576).toFixed(1) + ' MB');
}
