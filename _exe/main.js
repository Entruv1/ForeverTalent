'use strict';

/**
 * 永恒天赋计算器 — Electron 主进程
 *
 * 要点：
 *  1. 用自定义协议 app:// 提供内嵌的 app.html，而不是 file://。
 *     这样页面处于一个「标准 + 安全」的源里：localStorage 稳定持久（方案能记住）、
 *     剪贴板 API 可用、相对路径解析规则与线上一致。
 *  2. 全站零网络请求（图标/背景/字体在构建时已内联成 data URI）。
 *     万一有外链被点击，一律交给系统默认浏览器打开，绝不在应用窗口里导航走。
 *  3. 视觉上是一个正常的桌面应用窗口：无菜单栏、无地址栏、自带图标与任务栏分组。
 */

// ---------------------------------------------------------------- 启动模式防护

/**
 * 若环境里存在 ELECTRON_RUN_AS_NODE（某些 IDE / CI / 终端会全局设置），Electron 会退化成
 * 纯 Node 进程：require('electron') 只返回一个 exe 路径字符串，后面全部逻辑都会崩。
 * 这里检测到就清掉该变量重新拉起自己一次，用户侧无感。
 */
if (typeof require('electron') === 'string') {
  if (process.env.TF_RELAUNCHED) {
    console.error('[永恒天赋] 无法脱离 ELECTRON_RUN_AS_NODE 模式启动，请清除该环境变量后重试。');
    process.exit(1);
  }
  const env = { ...process.env, TF_RELAUNCHED: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  // 必须用 spawnSync：异步 spawn 的话模块体会继续往下跑，还没等到子进程起来就先崩了。
  // 同步等待还顺带保证了 stdio 与退出码原样透传（便携版启动器会等主进程结束才清理临时目录）。
  const res = require('node:child_process').spawnSync(process.execPath, process.argv.slice(1), {
    env,
    stdio: 'inherit',
  });
  if (res.error) {
    console.error('[永恒天赋] 重新启动失败：' + res.error.message);
    process.exit(1);
  }
  process.exit(res.status === null ? 1 : res.status);
}

const { app, BrowserWindow, Menu, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SCHEME = 'app';
const HOST = 'talents';
const ORIGIN = `${SCHEME}://${HOST}`;
const INDEX_URL = `${ORIGIN}/index.html`;
// 站内链接失效时的去处：线上站点（离线版把站内链接改写成绝对地址，这里只是兜底）
const SITE_ONLINE = 'https://talentsforever.com';

// 自检模式：不显示窗口、不读写窗口状态，只跑探针
const SMOKE = !!process.env.TF_SMOKE;
// TF_SHOW=1：自检时也把窗口显示出来。隐藏窗口下 Chrome 可能不绘制大块内容
// （天赋树整块空白），截图会失真，需要肉眼核对时用这个开关。
const SHOW_WHILE_SMOKE = !!process.env.TF_SHOW;

// 必须在 app ready 之前登记：standard 让 URL 解析/相对路径正常，secure 让剪贴板与
// crypto 等 API 被视为安全上下文。scheme 名不能带连字符，故用 "app"。
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

// 单实例：重复双击时聚焦已有窗口，而不是开第二个。
// 自检模式（TF_SMOKE）下跳过：用户正开着应用时拿不到锁，探针会静默退出，
// 那种「没有输出、退出码 0」最难查 —— 直接绕开。
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ---------------------------------------------------------------- 窗口状态记忆

const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  const fallback = { width: 1500, height: 1000 };
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    const ok = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
    const st = {
      width: ok(raw.width, 900, 10000) ? Math.round(raw.width) : fallback.width,
      height: ok(raw.height, 640, 10000) ? Math.round(raw.height) : fallback.height,
    };
    if (ok(raw.x, -32000, 32000) && ok(raw.y, -32000, 32000)) {
      st.x = Math.round(raw.x);
      st.y = Math.round(raw.y);
    }
    if (raw.maximized === true) st.maximized = true;
    return st;
  } catch {
    return fallback;
  }
}

let saveTimer = null;
function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const b = win.getNormalBounds();
      fs.writeFileSync(
        STATE_FILE(),
        JSON.stringify(
          { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() },
          null,
          0
        ),
        'utf8'
      );
    } catch {
      /* 记不住就算了，不该因此报错 */
    }
  }, 400);
}

// ---------------------------------------------------------------- 右键菜单

function popupContextMenu(win, params) {
  const items = [];
  if (params.isEditable) {
    items.push({ label: '撤销', role: 'undo', enabled: params.editFlags.canUndo });
    items.push({ label: '重做', role: 'redo', enabled: params.editFlags.canRedo });
    items.push({ type: 'separator' });
    items.push({ label: '剪切', role: 'cut', enabled: params.editFlags.canCut });
    items.push({ label: '复制', role: 'copy', enabled: params.editFlags.canCopy });
    items.push({ label: '粘贴', role: 'paste', enabled: params.editFlags.canPaste });
    items.push({ type: 'separator' });
    items.push({ label: '全选', role: 'selectAll' });
  } else if (params.selectionText && params.selectionText.trim()) {
    items.push({ label: '复制', role: 'copy' });
    items.push({ type: 'separator' });
    items.push({ label: '全选', role: 'selectAll' });
  } else {
    items.push({ label: '全选', role: 'selectAll' });
  }
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------------------------------------------------------------- 主窗口

let win = null;

// 缩放级别（Ctrl +/-/0）；默认菜单被移除后浏览器自带的缩放快捷键也没了，这里补回来
const ZOOM_STEPS = [0.67, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

function stepZoom(win, dir) {
  const cur = win.webContents.getZoomFactor();
  let i = 0;
  let best = Infinity;
  ZOOM_STEPS.forEach((z, k) => {
    const d = Math.abs(z - cur);
    if (d < best) {
      best = d;
      i = k;
    }
  });
  const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir));
  win.webContents.setZoomFactor(ZOOM_STEPS[next]);
}

function wireShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    if (!mod) return;
    const k = String(input.key || '');
    if (k === '+' || k === '=' || k === 'Add') {
      stepZoom(win, +1);
      event.preventDefault();
    } else if (k === '-' || k === '_' || k === 'Subtract') {
      stepZoom(win, -1);
      event.preventDefault();
    } else if (k === '0') {
      win.webContents.setZoomFactor(1);
      event.preventDefault();
    }
  });
}

function createWindow() {
  const st = SMOKE ? { width: 1500, height: 1000 } : loadWindowState();
  const SMOKE_VISIBLE = SMOKE && SHOW_WHILE_SMOKE;

  win = new BrowserWindow({
    x: SMOKE ? undefined : st.x,
    y: SMOKE ? undefined : st.y,
    width: st.width,
    height: st.height,
    minWidth: 900,
    minHeight: 640,
    title: '永恒天赋计算器',
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  // 彻底没有菜单栏（autoHideMenuBar 只是隐藏，按 Alt 还会冒出来）
  Menu.setApplicationMenu(null);

  if (st.maximized && !SMOKE) win.maximize();

  win.once('ready-to-show', () => {
    if (SMOKE && !SHOW_WHILE_SMOKE) return;
    win.show();
    win.focus();
  });

  if (!SMOKE) {
    win.on('resize', () => saveWindowState(win));
    win.on('move', () => saveWindowState(win));
    win.on('maximize', () => saveWindowState(win));
    win.on('unmaximize', () => saveWindowState(win));
    win.on('close', () => saveWindowState(win));
  }
  win.on('closed', () => {
    win = null;
  });

  // 外链一律交给系统浏览器，应用窗口本身绝不导航离开。
  // app:// 下只允许 /index.html 本身；任何别的 app:// 路径都是失效的站内链接
  // （历史事故：热门方案的「载入」href="/warrior/60/…" 请求到协议处理器，
  //  拿到 404 纯文本，整页面被顶掉，只能重启）。这里兜底：
  // 遇到这种地址就 preventDefault，并到系统浏览器里打开线上对应页面。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    else if (url.startsWith(ORIGIN)) shell.openExternal(SITE_ONLINE + url.slice(ORIGIN.length));
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === INDEX_URL || url.startsWith(INDEX_URL + '#')) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    } else if (url.startsWith(ORIGIN)) {
      const rest = url.slice(ORIGIN.length);
      // 只剩查询串/锚点的话就当是同一页，放行
      if (rest === '' || rest === '/' || rest.startsWith('?') || rest.startsWith('#')) return;
      shell.openExternal(SITE_ONLINE + rest);
    }
  });

  win.webContents.on('context-menu', (_event, params) => popupContextMenu(win, params));

  wireShortcuts(win);

  if (SMOKE) runSmoke(win);

  // 自检要可复现：先清掉上一次留下的 localStorage（否则会恢复上次的方案，探针结果漂移）
  if (SMOKE) {
    Promise.resolve(win.webContents.session.clearStorageData({ storages: ['localstorage'] }))
      .catch(() => {})
      .then(() => win.loadURL(INDEX_URL));
  } else {
    win.loadURL(INDEX_URL);
  }
}

// ---------------------------------------------------------------- 自检模式

/**
 * TF_SMOKE=1 时：窗口加载完成后在渲染进程里跑一段探针，把结果打到 stdout 再退出。
 * 用途是每次重新打包前确认「app:// 协议 + 内嵌页面」真的能起来，而不是靠肉眼开窗口看。
 */
const SMOKE_JS = `(() => {
  const out = {};
  const q = (s) => document.querySelector(s);
  out.origin = location.origin;
  out.url = location.href;
  out.title = document.title;
  out.talents = document.querySelectorAll('#trees .talent').length;
  // v2 的职业导航是真链接（中键可新开标签页），不再是 button
  out.classButtons = document.querySelectorAll('#classes a').length;
  out.classNames = Array.from(document.querySelectorAll('#classes a span'))
    .map((e) => e.textContent.trim()).filter(Boolean);
  out.dataImages = (document.documentElement.outerHTML.match(/data:image/g) || []).length;
  const sl = q('#shareLink');
  out.share = sl ? sl.value : null;
  try {
    localStorage.setItem('__tf_probe', '1');
    out.localStorage = localStorage.getItem('__tf_probe') === '1';
    localStorage.removeItem('__tf_probe');
  } catch (e) { out.localStorage = 'ERR ' + e.message; }
  out.clipboard = !!(navigator.clipboard && navigator.clipboard.writeText);
  out.secureContext = window.isSecureContext === true;
  try {
    const a = document.createElement('a');
    a.href = 'https://example.com/x';
    out.externalHrefResolved = a.href;
  } catch (e) {}
  // 中文数据是否真的加载进来了：天赋节点带 aria-label，树名在 .thead .n，横幅带职业名
  const t = q('#trees .talent');
  out.firstTalent = t ? (t.getAttribute('aria-label') || '') : null;
  out.treeNames = Array.from(document.querySelectorAll('#trees .thead .n'))
    .map((e) => ((e.childNodes[0] && e.childNodes[0].textContent) || '').trim())
    .filter(Boolean);
  out.banner = q('#bannerName') ? q('#bannerName').textContent.trim() : null;
  const labels = Array.from(document.querySelectorAll('#trees .talent'))
    .map((e) => e.getAttribute('aria-label') || '');
  out.labelSample = labels.slice(0, 3);
  out.labelsAllCjk = labels.length > 0 && labels.every((s) => /[\\u4e00-\\u9fff]/.test(s));

  // ---------------- v2 新增面板 ----------------
  const CJK = /[\\u4e00-\\u9fff]/;
  const txt = (s) => { const e = q(s); return e ? e.textContent.trim() : null; };
  // 种族天赋：阵营分组里的种族卡
  out.raceCards = document.querySelectorAll('#factions .race').length;
  out.raceCnt = txt('#raceCnt');
  // 传承专长：展开 details 后应有专长树
  const lg = q('#legacy');
  if (lg) { try { lg.open = true; } catch (e) {} }
  out.legacyTalents = document.querySelectorAll('#legacyTrees .talent').length;
  out.legacyTitles = Array.from(document.querySelectorAll('#legacyTrees .thead .n'))
    .map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4);
  // 更新内容抽屉：点一下表头按钮，抽屉应打开且条目为中文
  const wn = q('#whatsNew');
  if (wn) { try { wn.click(); } catch (e) {} }
  const dr = q('#logDrawer');
  out.drawerOpen = dr ? !dr.hidden : null;
  out.logItems = document.querySelectorAll('#logList li').length;
  out.logFirst = (() => {
    const li = q('#logList li');
    return li ? li.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120) : null;
  })();
  // 前后对比图 / 法术书翻页（v2 的大头）
  out.shotImgs = document.querySelectorAll('img.solo, .shots img, .fbbar ~ img').length;

  // ---------------- 图标完整性 ----------------
  // 2026-10-03 用户截图报「战士·狂怒 两个天赋图标缺失」：dl/ 是当初一次性抓的，
  // 上游后来新增了天赋与截图 → 本地**静默缺文件**，构建全绿，界面上只剩天赋名缩写。
  // 两条独立断言：
  //   (1) 数据里引用到的每个图标名，必须真的以键存在于 window.__ICONS（内联表）。
  //       —— 直接盯住「名字对但图没有」这一整类问题，不依赖图片真的去解码。
  //   (2) 页面上任何 data: 图片若 complete 但 naturalWidth === 0，就是真的解不开。
  try {
    const IC = window.__ICONS || {};
    const miss = [];
    const need = (n, where) => { if (n && !IC[n]) miss.push(where + ' -> ' + n); };
    Object.entries(window.TALENT_DATA || {}).forEach(([cls, cv]) => {
      ((cv && cv.trees) || []).forEach((tr) => {
        need(tr.icon, cls + '/' + tr.name + '/tree');
        (tr.talents || []).forEach((t) => need(t.icon, cls + '/' + (t.name || '?')));
      });
    });
    Object.values(window.RACIALS || {}).forEach((side) => (Array.isArray(side) ? side : []).forEach((r) => {
      if (!r) return;
      need(r.icon, 'race/' + r.race);
      (r.abilities || []).forEach((a) => need(a && a[2], 'race/' + r.race + '/' + (a && a[0])));
    }));
    Object.entries(window.CLASS_RACIALS || {}).forEach(([cls, o]) => {
      Object.entries((o && o.races) || {}).forEach(([race, arr]) => {
        (arr || []).forEach((a) => need(a && a[2], cls + '/racial/' + race));
      });
    });
    Object.entries(window.CLASS_ABILITIES || {}).forEach(([cls, arr]) => {
      (arr || []).forEach((a) => need(a && a[2], cls + '/ability'));
    });
    Object.entries(window.SPELLBOOK_ICONS || {}).forEach(([nm, ic]) => need(ic, 'book/' + nm));
    ((window.LEGACY || {}).trees || []).forEach((tr) => {
      need(tr.icon, 'legacy/' + tr.name + '/tree');
      (tr.perks || []).forEach((p) => need(p && p.icon, 'legacy/' + tr.name + '/' + (p && p.name)));
    });
    (window.UPDATES || []).forEach((e) => {
      Object.values((e && e.talents) || {}).forEach((rows) => {
        (rows || []).forEach((r) => {
          need(r.icon, 'upd/' + e.build + '/' + r.talent);
          need(r.beforeIcon, 'upd/' + e.build + '/' + r.talent + '/before');
        });
      });
    });
    out.iconMissingCount = miss.length;
    out.iconMissing = miss.slice(0, 30);
  } catch (e) { out.iconCheckErr = e.message; }
  try {
    const bad = [];
    document.querySelectorAll('img').forEach((im) => {
      if (!/^data:image/.test(im.getAttribute('src') || '')) return;
      if (im.complete && im.naturalWidth === 0) {
        const host = im.closest('[data-name]') || im.parentElement;
        bad.push((host && (host.getAttribute('data-name') || host.title)) || im.outerHTML.slice(0, 70));
      }
    });
    out.brokenImgCount = bad.length;
    out.brokenImgs = bad.slice(0, 20);
  } catch (e) { out.brokenImgErr = e.message; }

  // 天赋提示框：桌面版走悬停（触屏才用 #sheet），这里派发 mouseenter 后读 #tip
  try {
    const tk = document.querySelector('#trees .talent');
    if (tk) tk.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 420, clientY: 320 }));
  } catch (e) {}
  const tp = q('#tip');
  out.tipOpen = tp ? !tp.hidden : null;
  out.tipText = tp ? tp.textContent.replace(/\\s+/g, ' ').trim().slice(0, 180) : null;
  out.tipCjk = !!(tp && CJK.test(tp.textContent));
  out.hasStreamBtn = !!q('#streamMode');
  out.hasCmpBtn = !!q('#cmp');
  out.hasGiftBtn = !!q('#giftBtn');

  // ---------------- 热门方案的「载入」按钮 ----------------
  // 历史故障：href="/warrior/60/…" 在 app:// 下会请求到一个不存在的路径，
  // 协议处理器回 404 文本，整个应用页面被顶掉。这里点一下确认是页内载入。
  try {
    const loadA = document.querySelector('a.load[data-code]');
    out.loadFound = !!loadA;
    out.loadHref = loadA ? loadA.getAttribute('href') : null;
    out.loadCode = loadA ? loadA.getAttribute('data-code') : null;
    const pointsLeft = () => (q('#ptsLeft') ? q('#ptsLeft').textContent.trim() : null);
    const split = () => (q('#split') ? q('#split').textContent.trim() : null);
    out.loadBefore = { left: pointsLeft(), split: split() };
    if (loadA) loadA.click();
    out.loadAfter = { left: pointsLeft(), split: split() };
    out.loadShare = q('#shareLink') ? q('#shareLink').value : null;
    out.loadStillHere = location.origin + location.pathname;
    out.loadHead = document.body.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40);
  } catch (e) { out.loadErr = e.message; }

  // ---------------- 可见英文残留扫描 ----------------
  // 只看「含 ASCII 单词且整行无汉字」的行；DOM id / class / 事件名不会进入 innerText
  // 先把所有折叠区展开：<details> 收起时里面的 innerText 读不到（Chrome 不渲染），
  // 折叠标题「New Warrior abilities」「Beyond the tooltips」这类英文会被整个漏掉。
  let openedFolds = 0;
  try {
    document.querySelectorAll('details').forEach((d) => {
      if (!d.open) { d.open = true; openedFolds++; }
    });
  } catch (e) {}
  out.foldsOpened = openedFolds;
  const BRAND = /^(Reddit|Discord|X|PC Gamer|Wowhead|WoW|World of Warcraft|Talents Forever|talentsforever\\.com|Legacy System Explained|Chris Baldwin|Shift|Ctrl|Alt|AI|GA|Ko-fi)$/i;
  const scan = (root) => {
    const raw = (root && root.innerText) || '';
    return raw.split(/\\n+/).map((s) => s.trim())
      .filter((s) => s && /[A-Za-z]{2}/.test(s) && !CJK.test(s))
      .filter((s) => !BRAND.test(s));
  };
  const en = new Set(scan(document.body));
  if (dr && !dr.hidden) scan(dr).forEach((s) => en.add(s));
  out.enLines = Array.from(en).slice(0, 60);
  out.enCount = en.size;

  // 每条英文残留 → 产生它的那层元素。innerText 会带上 CSS text-transform 的结果
  // （>Class< 在界面上是 CLASS），光靠 grep 产物找不到源头，这里直接给出 outerHTML。
  // 从后往前扫，取最内层的那个元素。
  const whereOf = (line) => {
    const els = document.querySelectorAll('body *');
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const t = (el.innerText || '').trim();
      if (t === line) return el.outerHTML.replace(/\\s+/g, ' ').slice(0, 220);
    }
    return null;
  };
  out.enWhere = (out.enLines || []).slice(0, 40)
    .map((l) => l + '  ==>  ' + (whereOf(l) || '(未定位)'));

  // 上面那套只抓「整行没有汉字」的情况，所以「热门 Warrior 方案」这类中英混排是漏的。
  // 再按「绝不该出现在中文界面里的英文词」扫一遍（职业键 + 几个容易漏译的词）。
  const STRAY = /\\b(Warrior|Paladin|Hunter|Rogue|Priest|Shaman|Mage|Warlock|Druid|Racial|Racials|Spells|Talents|Builds|Popular|Baseline|Spellbook|Theorycraft|Wording)\\b/;
  const OK_STRY = /《Legacy System Explained》|Legacy System Explained|WoW Forever|PC Gamer|Wowhead|Reddit/;
  const straySet = new Set();
  const strayScan = (root) => {
    const raw = (root && root.innerText) || '';
    raw.split(/\\n+/).map((s) => s.trim())
      .filter((s) => s && STRAY.test(s) && !OK_STRY.test(s))
      .forEach((s) => straySet.add(s));
  };
  strayScan(document.body);
  if (dr && !dr.hidden) strayScan(dr);
  out.strayLines = Array.from(straySet).slice(0, 30);
  out.strayCount = straySet.size;

  // ---------------- 数据里的英文（desc / 天赋名 / 树名） ----------------
  // 编译期 build_data.js 已经查过一遍，这里再从**产物**里查一次：
  // 万一哪次构建把旧的 zh_data.js 内联进来，只有这里能发现。
  // 判据是「含 2 个以上英文词」而不是「整句没有汉字」—— 中英混杂（"… for 12秒."）正是这么漏的。
  out.enData = [];
  (function () {
    const ENW = /[A-Za-z][A-Za-z'-]{2,}/g;
    const OKD = /Savix|Xaryu|Soda|Zevzve|Esfand|Reddit|Wowhead|Ko-fi|Baldwin|Talents Forever|WoW|Warcraft/;
    const push = (s) => { if (out.enData.length < 20) out.enData.push(s); };
    const looksEn = (s) => !OKD.test(s) && (s.match(ENW) || []).length >= 2;
    const D = window.TALENT_DATA || {};
    for (const cls of Object.keys(D)) {
      for (const tree of D[cls].trees || []) {
        if (tree.name && looksEn(tree.name)) push('TREE ' + tree.name);
        for (const tl of tree.talents || []) {
          const nm = tl.name || '';
          if (looksEn(nm)) push('NAME ' + nm);
          const d = tl.desc;
          const vals = !d ? [] : (Array.isArray(d) ? d : Object.values(d));
          for (const s of vals) if (typeof s === 'string' && looksEn(s)) push(nm + ' :: ' + s.slice(0, 80));
        }
        for (const rm of tree.removed || []) {
          if (rm.name && looksEn(rm.name)) push('REMOVED ' + rm.name);
          if (typeof rm.text === 'string' && looksEn(rm.text)) push('REMOVED ' + rm.name + ' :: ' + rm.text.slice(0, 80));
        }
      }
    }
  })();
  out.enDataCount = out.enData.length;

  // ---------------- 布局几何（天赋树曾经渲染出 0 高度） ----------------
  const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const tr = q('#trees');
  out.treesBox = box(tr);
  out.treesKids = tr ? tr.children.length : null;
  out.treesStyle = tr ? { display: getComputedStyle(tr).display, cols: getComputedStyle(tr).gridTemplateColumns } : null;
  out.firstTreeBox = box(q('#trees > *'));
  out.firstTalentBox = box(q('#trees .talent'));
  out.firstTalentStyle = (() => {
    const e = q('#trees .talent'); if (!e) return null;
    const s = getComputedStyle(e);
    return { display: s.display, visibility: s.visibility, opacity: s.opacity, w: s.width, h: s.height };
  })();
  out.legendBox = box(q('.states'));
  out.treesTop = tr ? Math.round(tr.getBoundingClientRect().top + scrollY) : null;
  out.treesParent = tr && tr.parentElement ? tr.parentElement.className || tr.parentElement.tagName : null;
  out.treesHtmlLen = tr ? tr.innerHTML.length : null;
  out.treeImgCount = document.querySelectorAll('#trees .talent img').length;
  out.treeImgSrc0 = (() => { const i = q('#trees .talent img'); return i ? String(i.src).slice(0, 40) : null; })();
  out.treeImgLoaded0 = (() => { const i = q('#trees .talent img'); return i ? { complete: i.complete, nw: i.naturalWidth } : null; })();
  out.treesRect = tr ? { top: Math.round(tr.getBoundingClientRect().top), left: Math.round(tr.getBoundingClientRect().left) } : null;
  return out;
})()`;

/** 新老版本 Electron 的 console-message 事件参数不同，这里统一归一化。 */
function consoleLevelToInt(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const map = { verbose: 0, debug: 1, info: 1, log: 1, warning: 2, warn: 2, error: 3 };
    const k = map[v.toLowerCase()];
    return k === undefined ? 1 : k;
  }
  return 1;
}

/** 打包前 Electron 一定会抱怨的告警，不算问题 */
const IGNORED_CONSOLE = [/Autofill/i, /Electron Security Warning/i, /Insecure Content-Security-Policy/i];

function runSmoke(win) {
  const errors = [];
  // 用 rest 参数接收：这样在 Electron 看来不是「旧的 5 参数签名」，不会触发弃用告警
  win.webContents.on('console-message', (...args) => {
    const first = args[0];
    const newStyle = args[1] === undefined;
    const level = newStyle ? first && first.level : args[1];
    const message = newStyle ? (first && first.message) || '' : args[2] || '';
    if (consoleLevelToInt(level) < 2) return;
    if (IGNORED_CONSOLE.some((re) => re.test(message))) return;
    errors.push(message);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.log('SMOKE_GONE ' + JSON.stringify(details));
    app.exit(1);
  });
  win.webContents.once('did-finish-load', async () => {
    let payload;
    try {
      payload = await win.webContents.executeJavaScript(SMOKE_JS);
    } catch (err) {
      payload = { fatal: String(err && err.message) };
    }
    payload.consoleErrors = errors;
    // 便携版（NSIS 自解压）启动器不转发子进程 stdout，所以同时支持写文件
    const outFile = process.env.TF_SMOKE_OUT;
    if (outFile) {
      try {
        fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
      } catch (err) {
        console.log('SMOKE_OUT_FAIL ' + String(err && err.message));
      }
    }
    // 可选：把渲染结果截图存盘，用来肉眼核对打包后的界面。
    // TF_SHOT_JS 可以先注入一小段脚本做交互（例如悬停出提示框）再截图。
    const shot = process.env.TF_SHOT;
    if (shot) {
      try {
        const setup = process.env.TF_SHOT_JS;
        if (setup) await win.webContents.executeJavaScript(setup, true);
        // 隐藏窗口下必须多等一会儿让合成器完成绘制
        const delay = Number(process.env.TF_SHOT_DELAY || (SMOKE_VISIBLE ? 1200 : 500));
        await new Promise((r) => setTimeout(r, delay));
        // 截图时再量一次几何：与探针时刻不一致就说明是渲染时序问题
        try {
          const now = await win.webContents.executeJavaScript(
            "JSON.stringify({trees: (e => e && [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().top)])(document.querySelector('#trees')), scrollY: Math.round(scrollY), innerH: innerHeight})"
          );
          console.log('SMOKE_SHOT_AT ' + now);
        } catch (e) {}
        const img = await win.webContents.capturePage();
        const png = img.toPNG();
        fs.writeFileSync(shot, png);
        console.log('SMOKE_SHOT ' + shot + ' ' + png.length + 'B ' + img.getSize().width + 'x' + img.getSize().height);
      } catch (err) {
        console.log('SMOKE_SHOT_FAIL ' + String(err && err.message));
      }
    }
    console.log('SMOKE ' + JSON.stringify(payload));
    app.exit(payload.fatal || errors.length ? 1 : 0);
  });
}

// ---------------------------------------------------------------- 协议处理

function registerAppProtocol() {
  const htmlPath = path.join(__dirname, 'app.html');
  const icoPath = path.join(__dirname, 'icon.ico');

  let htmlBuf = null;
  try {
    htmlBuf = fs.readFileSync(htmlPath);
  } catch (err) {
    // 资源缺失时给一个可读的提示页，而不是白屏
    const msg = `找不到 app.html：${htmlPath}\n\n${String(err && err.message)}`;
    protocol.handle(SCHEME, () =>
      new Response(
        `<!doctype html><meta charset="utf-8"><body style="font:14px/1.6 system-ui;padding:40px;background:#121212;color:#eee">` +
          `<h2>应用资源缺失</h2><pre style="white-space:pre-wrap">${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre></body>`,
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      )
    );
    return;
  }

  protocol.handle(SCHEME, (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('bad request', { status: 400 });
    }

    let p = url.pathname;
    try {
      p = decodeURIComponent(p);
    } catch {
      /* 保留原样 */
    }

    if (p === '/' || p === '/index.html' || p === '') {
      return new Response(new Uint8Array(htmlBuf), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }

    if (p === '/favicon.ico' || p === '/icon.ico') {
      try {
        return new Response(new Uint8Array(fs.readFileSync(icoPath)), {
          headers: { 'content-type': 'image/x-icon', 'cache-control': 'no-store' },
        });
      } catch {
        return new Response('', { status: 404 });
      }
    }

    return new Response('not found: ' + p, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  });
}

// ---------------------------------------------------------------- 生命周期

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.entruv.talentsforever.cn');
  registerAppProtocol();
  createWindow();
});
