#!/usr/bin/env node
/**
 * 一键准备应用资源：
 *   1) 从项目根目录的交付物 永恒天赋计算器.html 生成 app.html（并打上桌面版专用补丁）
 *   2) 生成 icon.ico
 *
 * 用法：npm run prepare-app
 *
 * 说明：两个生成器是 Python（图标要 Pillow 才能一次导出多尺寸 ICO），这里只做调度。
 */

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERE = __dirname;
const EXE_DIR = path.join(HERE, '..');
const SRC_HTML = path.join(EXE_DIR, '..', '永恒天赋计算器.html');

function findPython() {
  const candidates = [
    process.env.PYTHON,
    path.join(os.homedir(), '.workbuddy', 'binaries', 'python', 'envs', 'default', 'Scripts', 'python.exe'),
    'python',
    'python3',
  ].filter(Boolean);

  for (const exe of candidates) {
    const r = spawnSync(exe, ['-c', 'import sys, PIL; print(sys.version_info[0])'], { encoding: 'utf8' });
    if (r.status === 0 && (r.stdout || '').trim() === '3') return exe;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error('[prepare-app] 找不到可用的 Python 3 + Pillow。');
  console.error('  请先安装 Pillow，例如：');
  console.error('  "C:/Users/<你>/.workbuddy/binaries/python/envs/default/Scripts/python.exe" -m pip install pillow');
  process.exit(1);
}

if (!fs.existsSync(SRC_HTML)) {
  console.error('[prepare-app] 找不到源文件：' + SRC_HTML);
  console.error('  请先在项目根目录构建单文件 HTML（_src 下的构建链）。');
  process.exit(1);
}

for (const script of ['build_app_html.py', 'make_icon.py']) {
  console.log('\n=== ' + script + ' ===');
  const r = spawnSync(python, [path.join(HERE, script)], { cwd: EXE_DIR, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('\n[prepare-app] ' + script + ' 失败，退出码 ' + r.status);
    process.exit(r.status || 1);
  }
}

console.log('\n[prepare-app] 完成：app.html + icon.ico 已就绪');
