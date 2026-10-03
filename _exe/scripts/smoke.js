#!/usr/bin/env node
/**
 * 冒烟自检：以 TF_SMOKE=1 启动 Electron，窗口不显示，加载完成后在渲染进程里跑探针，
 * 把结果打到 stdout 再退出。用来在打包前后确认 app:// + 内嵌页面真的能起来。
 *
 * 用法：node scripts/smoke.js
 * 退出码：0 = 探针有输出且无 JS 错误，1 = 失败
 */

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const electronExe = require('electron'); // 在纯 Node 里 require 返回的是 exe 绝对路径

if (typeof electronExe !== 'string') {
  console.error('[smoke] 拿不到 electron 可执行文件路径，请先执行 node node_modules/electron/install.js');
  process.exit(1);
}

const env = { ...process.env, TF_SMOKE: '1' };
// 某些环境会全局设置 ELECTRON_RUN_AS_NODE，导致 Electron 退化成纯 Node 进程
delete env.ELECTRON_RUN_AS_NODE;
delete env.TF_RELAUNCHED;

const started = Date.now();
const res = spawnSync(electronExe, ['.'], { cwd: root, env, encoding: 'utf8', timeout: 120000 });
const out = (res.stdout || '') + (res.stderr || '');
const line = out.split(/\r?\n/).find((l) => l.startsWith('SMOKE '));

if (!line) {
  console.error(out.trim() || '(没有任何输出)');
  console.error('\n[smoke] 没有拿到探针输出，退出码 = ' + res.status);
  process.exit(1);
}

const data = JSON.parse(line.slice('SMOKE '.length));
const errs = data.consoleErrors || [];

console.log('app:// 自检  （耗时 %d ms）', Date.now() - started);
console.log('  源            : %s', data.origin);
console.log('  重定向后地址  : %s', data.url);
console.log('  标题          : %s', data.title);
console.log('  职业按钮      : %s 个  %s', data.classButtons, (data.classNames || []).join(' '));
console.log('  天赋节点      : %s 个', data.talents);
console.log('  内联图片      : %s 个', data.dataImages);
console.log('  安全上下文    : %s', data.secureContext);
console.log('  localStorage  : %s', data.localStorage);
console.log('  剪贴板 API    : %s', data.clipboard);
console.log('  分享链接      : %s', data.share);
console.log('  首天赋        : %s', data.firstTalent);
console.log('  树名          : %s', (data.treeNames || []).join(' / '));
console.log('  横幅职业      : %s', data.banner);
console.log('  天赋标签抽样  : %s', (data.labelSample || []).join(' | '));
console.log('  种族卡        : %s 个  (%s)', data.raceCards, data.raceCnt);
console.log('  传承专长节点  : %s 个  %s', data.legacyTalents, (data.legacyTitles || []).join(' / '));
console.log('  更新内容抽屉  : %s  条目 %s 条', data.drawerOpen ? '已打开' : '未打开', data.logItems);
console.log('  抽屉首条      : %s', data.logFirst);
console.log('  前后对比图    : %s 张', data.shotImgs);
console.log('  图标缺失      : %s 个（数据引用的名字在 __ICONS 里找不到）', data.iconMissingCount);
(data.iconMissing || []).forEach((s) => console.log('      ? ' + s));
console.log('  坏图          : %s 个（data: 图但解不开）', data.brokenImgCount);
(data.brokenImgs || []).forEach((s) => console.log('      ? ' + s));
console.log('  提示框        : %s  %s', data.tipOpen ? '已弹出' : '未弹出', (data.tipText || '').slice(0, 70));
console.log('  新按钮        : 直播布局=%s 对比经典旧世=%s 年度总结=%s', data.hasStreamBtn, data.hasCmpBtn, data.hasGiftBtn);
console.log('  热门方案载入  : %s  %s → %s',
  data.loadFound ? '找到按钮' : '没找到按钮',
  JSON.stringify(data.loadBefore || null), JSON.stringify(data.loadAfter || null));
console.log('  载入后地址    : %s  （页面首段：%s）', data.loadStillHere, data.loadHead);
console.log('  载入后分享链接: %s', data.loadShare);
console.log('  可见英文残留  : %s 行', data.enCount);
(data.enLines || []).forEach((s) => console.log('      ? ' + s.slice(0, 110)));
if ((data.enWhere || []).length) {
  console.log('  ---- 英文残留的出处（outerHTML）----');
  (data.enWhere || []).forEach((s) => console.log('      @ ' + s.slice(0, 300)));
}
console.log('  混排里的英文词: %s 行', data.strayCount);
(data.strayLines || []).forEach((s) => console.log('      ? ' + s.slice(0, 110)));
console.log('  JS 错误       : %s', errs.length);
errs.forEach((e) => console.log('      ! ' + e.split('\n')[0]));

const CJK = /[\u4e00-\u9fff]/;
const problems = [];
console.log('  数据里的英文  : %s 处', data.enDataCount);
(data.enData || []).forEach((s) => console.log('      ! ' + s));
if (data.enDataCount) problems.push('产物的天赋数据里还有英文：' + (data.enData || []).slice(0, 3).join(' | '));
if (!/^app:\/\//.test(String(data.origin))) problems.push('origin 不是 app:// 协议');
if (data.classButtons !== 9) problems.push('职业按钮数量异常');
if (!(data.classNames || []).every((n) => CJK.test(n))) {
  problems.push('职业导航不是中文：' + (data.classNames || []).join(' '));
}
if (!(data.talents >= 50)) problems.push('战士天赋节点太少，实际 ' + data.talents);
if (!data.dataImages) problems.push('没有内联图片');
if (data.localStorage !== true) problems.push('localStorage 不可用');
if (data.secureContext !== true) problems.push('不是安全上下文（剪贴板会受限）');
if (!/^https:\/\/talentsforever\.com\//.test(String(data.share))) problems.push('分享链接不是线上可访问地址：' + data.share);
if (!CJK.test(String(data.firstTalent))) problems.push('天赋名不是中文：' + data.firstTalent);
if (!(data.treeNames || []).length || !(data.treeNames || []).every((n) => CJK.test(n))) {
  problems.push('天赋树名不是中文：' + (data.treeNames || []).join(' / '));
}
if (data.banner !== '战士') problems.push('横幅职业名应为「战士」，实际 ' + data.banner);
if (data.labelsAllCjk !== true) problems.push('有天赋节点标签不是中文（疑似回退到英文数据）');
if (!data.raceCards) problems.push('种族天赋面板没有渲染出种族卡');
if (!data.legacyTalents) problems.push('传承专长面板没有渲染出专长节点');
if (data.drawerOpen !== true) problems.push('「更新内容」抽屉点不开');
if (!data.logItems) problems.push('「更新内容」抽屉没有条目');
if (data.logFirst && !CJK.test(data.logFirst)) problems.push('「更新内容」首条不是中文：' + data.logFirst);
if (data.tipCjk !== true) problems.push('天赋提示框没有中文正文：' + data.tipText);
// 图标完整性：2026-10-03 用户截图报的「战士·狂怒 两个图标缺失」就是这条漏掉的
if (data.iconCheckErr) problems.push('图标完整性检查抛异常：' + data.iconCheckErr);
if (data.iconMissingCount) {
  problems.push('有 ' + data.iconMissingCount + ' 处图标缺失：' + (data.iconMissing || []).slice(0, 5).join(' | '));
}
if (data.brokenImgCount) {
  problems.push('有 ' + data.brokenImgCount + ' 张内联图解不开：' + (data.brokenImgs || []).slice(0, 5).join(' | '));
}
if (!data.hasStreamBtn || !data.hasCmpBtn) problems.push('v2 的「直播布局 / 对比经典旧世」按钮缺失');
// 热门方案的「载入」：必须是页内载入 + 页面还在
if (!data.loadFound) problems.push('热门方案里没有找到带 data-code 的「载入」按钮');
if (data.loadHref && !/^https:\/\/talentsforever\.com\//.test(data.loadHref)) {
  problems.push('「载入」按钮的 href 不是线上绝对地址（离线会 404）：' + data.loadHref);
}
if (data.loadErr) problems.push('点「载入」抛异常：' + data.loadErr);
if (data.loadBefore && data.loadAfter && data.loadBefore.left === data.loadAfter.left) {
  problems.push('点「载入」后天赋点没变化，方案没被应用：' + JSON.stringify(data.loadBefore));
}
if (data.loadStillHere && !/\/index\.html$/.test(String(data.loadStillHere))) {
  problems.push('点「载入」后页面被导航走了：' + data.loadStillHere);
}
if (/not found/i.test(String(data.loadHead))) problems.push('页面被 404 文本顶掉了：' + data.loadHead);
if (data.fatal) problems.push('探针抛异常：' + data.fatal);

const warnings = [];
if (data.enCount) warnings.push('还有 ' + data.enCount + ' 行可见英文（见上方 ? 行）');

if (data.strayCount) {
  problems.push('中文界面里混着英文词 ' + data.strayCount + ' 行：' + (data.strayLines || []).join(' | '));
}

if (problems.length || errs.length) {
  console.error('\n[smoke] 未通过：');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if (warnings.length) {
  console.log('\n[smoke] 通过（有提醒）');
  warnings.forEach((w) => console.log('  - ' + w));
} else {
  console.log('\n[smoke] 通过');
}
