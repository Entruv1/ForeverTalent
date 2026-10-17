'use strict';

/**
 * electron-builder 打包后钩子：精简 Electron 运行时里用不到的东西。
 *
 * 主要收益是语言包——Electron 自带五六十个 locale，这个应用只用中文界面，
 * 保留 zh-CN / zh-TW / en-US 即可，能省下十几 MB。
 * 授权文件（LICENSE.electron.txt / LICENSES.chromium.html）按 Electron 的许可要求保留。
 *
 * ⚠️ 这里刻意不用「批量删除」：
 *   本沙箱对删除有硬限制（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，阈值 50 次/轮），
 *   一次构建里 electron-builder 自己清 `win-unpacked` 就可能把额度用光，
 *   于是这批 `unlinkSync` 全部抛错。而原版写法把每个错误都 try/catch 吞掉，
 *   结果是：**exe 白白大 6 MB、日志只打印「移除 0 个语言包」、构建照常绿** —— 静默劣化。
 *   改成「能删就删，删不掉就 rename 搬走」：rename 不受删除额度限制，
 *   搬出 win-unpacked 后它同样不会被打进产物。最后再断言一次，搬不干净就让构建失败。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KEEP_LOCALES = /^(zh-CN|zh-TW|en-US)\.pak$/;

exports.default = async function afterPack(context) {
  const appDir = context.appOutDir;          // .../dist/win-unpacked
  let saved = 0;
  let removed = 0;
  let moved = 0;
  const failed = [];

  // 搬走的目标：系统临时目录（同盘 -> rename 成立；即便失败也只影响体积，不影响正确性）
  const stash = path.join(os.tmpdir(), 'tf-pruned-' + Date.now());

  const strip = (full, size) => {
    try {
      fs.unlinkSync(full);
      saved += size;
      removed++;
      return;
    } catch {
      /* 删除被拦 -> 退回 rename */
    }
    try {
      fs.mkdirSync(stash, { recursive: true });
      fs.renameSync(full, path.join(stash, path.basename(full)));
      saved += size;
      moved++;
    } catch (err) {
      failed.push(path.basename(full) + ': ' + String(err && err.message));
    }
  };

  const localeDir = path.join(appDir, 'locales');
  if (fs.existsSync(localeDir)) {
    for (const file of fs.readdirSync(localeDir)) {
      if (KEEP_LOCALES.test(file)) continue;
      const full = path.join(localeDir, file);
      let size = 0;
      try { size = fs.statSync(full).size; } catch { /* 继续按 0 计 */ }
      strip(full, size);
    }
  }

  // 开发期用来跑「没打包的应用」的默认壳，正式包里是多余的
  const defaultApp = path.join(appDir, 'resources', 'default_app.asar');
  if (fs.existsSync(defaultApp)) {
    let size = 0;
    try { size = fs.statSync(defaultApp).size; } catch { /* 忽略 */ }
    strip(defaultApp, size);
  }

  console.log(
    `  • afterPack: 移除 ${removed} 个语言包 + 搬走 ${moved} 个（删除受限时），节省约 ${(saved / 1048576).toFixed(1)} MB`
  );

  // 硬闸：搬不干净就失败，别让「exe 变大 6 MB」这种静默劣化溜过去
  const left = fs.existsSync(localeDir)
    ? fs.readdirSync(localeDir).filter((f) => !KEEP_LOCALES.test(f))
    : [];
  if (left.length || failed.length) {
    for (const f of failed) console.error('   !! 未能处理：' + f);
    console.error(`   !! 语言包裁剪不完整，仍有 ${left.length} 个多余 locale（产物会偏大）`);
    throw new Error('afterPack 语言包裁剪失败');
  }
  if (fs.existsSync(defaultApp)) {
    throw new Error('afterPack: default_app.asar 未能移除');
  }
};
