#!/usr/bin/env node
/**
 * 从 zh_data.js 里抽出**全部被引用到的资源名**（图标 / 背景 / 对比图），打印成 JSON。
 *
 * 为什么不让 python 用正则扫源码：图标的引用方式有好几种，正则一定会漏 ——
 *   "icon":"xxx"                       ← 最常见
 *   ["技能名","说明","图标名"]          ← RACIALS / CLASS_ABILITIES / CLASS_RACIALS（数组第 3 元素）
 *   SPELLBOOK_ICONS: {"名字":"图标名"}   ← 值才是图标名
 *   SPELLBOOKS[cls].icons: {"名字":"图标名"}
 *   "bg":161                          ← 数字，运行时拼 /assets/bg/161.jpg
 *   "/assets/changes/xxx.jpg"          ← 完整路径
 * 2026-10-03 就吃了一次亏：正则版漏掉了 ability_rogue_slaughterfromtheshadows 与
 * ability_vehicle_sonicshockwave，是 Electron 探针把它们揪出来的。
 * 所以这里**直接跑真实数据对象**，不猜结构。
 *
 * 用法：node _data_refs.js            → stdout 一行 JSON
 *       node _data_refs.js --list    → 顺便打印人可读清单
 */
'use strict';

global.window = global;
require('./zh_data.js');
const W = global;

const icons = new Set();
const bgs = new Set();
const changes = new Set();

const addIcon = (n) => { if (typeof n === 'string' && /^[A-Za-z0-9_]{3,}$/.test(n)) icons.add(n); };
const addBg = (n) => { if (n !== '' && n != null) bgs.add(String(n)); };
const addPath = (p) => {
  if (typeof p !== 'string') return;
  const m = /\/assets\/(icons|bg|changes)\/([A-Za-z0-9_.\-]+?)\.(?:jpg|png)/.exec(p);
  if (!m) return;
  ({ icons, bg: bgs, changes }[m[1]]).add(m[2]);
};

// 兜底：整份数据里凡是写成 /assets/... 路径的都收进来
const raw = require('node:fs').readFileSync('./zh_data.js', 'utf8');
for (const m of raw.matchAll(/\/assets\/(icons|bg|changes)\/([A-Za-z0-9_.\-]+?)\.(?:jpg|png)/g)) addPath(m[0]);

// ---- TALENT_DATA
for (const [cls, cv] of Object.entries(W.TALENT_DATA || {})) {
  if (!cv) continue;
  addIcon(cv.icon);
  for (const tr of cv.trees || []) {
    addIcon(tr.icon);
    addBg(tr.bg);
    for (const t of tr.talents || []) addIcon(t.icon);
  }
}

// ---- 种族天赋： abilities 是 [名, 说明, 图标]
for (const side of Object.values(W.RACIALS || {})) {
  for (const r of Array.isArray(side) ? side : []) {
    if (!r) continue;
    addIcon(r.icon);
    for (const a of r.abilities || []) addIcon(a && a[2]);
  }
}

// ---- 职业专属种族法术： races[种族] = [[名, 说明, 图标], ...]
for (const o of Object.values(W.CLASS_RACIALS || {})) {
  for (const arr of Object.values((o && o.races) || {})) {
    for (const a of arr || []) addIcon(a && a[2]);
  }
}

// ---- 职业新增技能： [[名, 说明, 图标], ...]
for (const arr of Object.values(W.CLASS_ABILITIES || {})) {
  for (const a of arr || []) addIcon(a && a[2]);
}

// ---- 法术书：全局图标表 + 各职业自己的图标表
for (const v of Object.values(W.SPELLBOOK_ICONS || {})) addIcon(v);
for (const sb of Object.values(W.SPELLBOOKS || {})) {
  for (const v of Object.values((sb && sb.icons) || {})) addIcon(v);
}

// ---- 传承专长
for (const tr of ((W.LEGACY || {}).trees || [])) {
  addIcon(tr.icon);
  for (const p of tr.perks || []) addIcon(p && p.icon);
}

// ---- 更新内容：每行可能带新图标与旧图标
for (const e of W.UPDATES || []) {
  for (const rows of Object.values((e && e.talents) || {})) {
    for (const r of rows || []) { addIcon(r.icon); addIcon(r.beforeIcon); }
  }
}

// ---- 前后对比图
for (const cs of Object.values(W.CHANGESHOTS || {})) {
  for (const k of ['before', 'after', 'src']) addPath(cs && cs[k]);
  for (const m of (cs && cs.more) || []) for (const k of ['before', 'after', 'src']) addPath(m && m[k]);
}

const out = {
  icons: [...icons].sort(),
  bg: [...bgs].sort(),
  changes: [...changes].sort(),
};
process.stdout.write(JSON.stringify(out));

if (process.argv.includes('--list')) {
  const fs = require('node:fs');
  const onDisk = (d) => new Set(fs.readdirSync(d).map((f) => f.replace(/\.[a-z0-9]+$/i, '')));
  const have = { icons: onDisk('dl/icons'), bg: onDisk('dl/bg'), changes: onDisk('dl/changes') };
  for (const k of ['icons', 'bg', 'changes']) {
    const miss = out[k].filter((n) => !have[k].has(n));
    process.stderr.write(`${k}: 引用 ${out[k].length} / 磁盘 ${have[k].size} / 缺 ${miss.length}` +
      (miss.length ? '  -> ' + miss.join(', ') : '') + '\n');
  }
}
