'use strict';

/**
 * electron-builder 打包后钩子：精简 Electron 运行时里用不到的东西。
 *
 * 主要收益是语言包——Electron 自带五六十个 locale，这个应用只用中文界面，
 * 保留 zh-CN / zh-TW / en-US 即可，能省下十几 MB。
 * 授权文件（LICENSE.electron.txt / LICENSES.chromium.html）按 Electron 的许可要求保留。
 */

const fs = require('node:fs');
const path = require('node:path');

const KEEP_LOCALES = /^(zh-CN|zh-TW|en-US)\.pak$/;

function rm(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

exports.default = async function afterPack(context) {
  const appDir = context.appOutDir;
  let saved = 0;
  let localesRemoved = 0;

  const localeDir = path.join(appDir, 'locales');
  if (fs.existsSync(localeDir)) {
    for (const file of fs.readdirSync(localeDir)) {
      if (KEEP_LOCALES.test(file)) continue;
      const full = path.join(localeDir, file);
      try {
        saved += fs.statSync(full).size;
        fs.unlinkSync(full);
        localesRemoved++;
      } catch {
        /* 单个删不掉不影响整体 */
      }
    }
  }

  // 开发期用来跑「没打包的应用」的默认壳，正式包里是多余的
  const defaultApp = path.join(appDir, 'resources', 'default_app.asar');
  if (fs.existsSync(defaultApp)) {
    saved += fs.statSync(defaultApp).size;
    rm(defaultApp);
  }

  console.log(
    `  • afterPack: 移除 ${localesRemoved} 个语言包 + default_app.asar，节省约 ${(saved / 1048576).toFixed(1)} MB`
  );
};
