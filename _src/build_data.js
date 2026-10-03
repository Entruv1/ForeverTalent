'use strict';
const fs = require('fs');
const vm = require('vm');

// ---------- load the original English data ----------
// v2：站点改版后新增 popular / updates / changeshots 三块数据
const FILES = ['talents.js', 'racials.js', 'spellbooks.js', 'spelldesc.js', 'legacy.js',
  'changelog.js', 'popular.js', 'updates.js', 'changeshots.js'];
const ctx = { window: {}, console, document: { querySelector: () => null, addEventListener: () => {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const W = ctx.window;

const I18N = JSON.parse(fs.readFileSync('i18n.json', 'utf8'));
const NAMES = I18N.names, DESCS = I18N.descs, EXTRA = I18N.extra || {};

// ---------- 由形态生成的短文案 ----------
const SCHOOL = { Physical: '物理', Holy: '神圣', Fire: '火焰', Frost: '冰霜', Nature: '自然', Shadow: '暗影', Arcane: '奥术' };
const PET = {
  Bat: '蝙蝠', 'Carrion Bird': '食腐鸟', Cat: '猫', Crab: '螃蟹', Owl: '猫头鹰', Raptor: '迅猛龙',
  Scorpid: '蝎子', Bear: '熊', Boar: '野猪', Hyena: '土狼', Tallstrider: '陆行鸟', Wolf: '狼',
  'Wind Serpent': '风蛇', Spider: '蜘蛛', Moth: '飞蛾', Turtle: '乌龟', Crocolisk: '鳄鱼', Gorilla: '猩猩',
  Dragonhawk: '龙鹰', 'Warp Stalker': '迁跃兽', Ravager: '掠食者', Serpent: '蛇',
};
const CO = { direct: '直接', heal: '治疗', 'per tick': '每跳' };
const UNIT = { Mana: '法力值', Rage: '怒气', Energy: '能量值', Focus: '集中值', Health: '生命值' };
// 1.60.1 数据里有一处被截断的施法材料名（原站自身的问题），补全后按原样译出
const FIXES = { 'ing Powder': '致盲粉' };

// "42.9% of spell power (direct)" / 两段用 ", " 连接
function spellPower(s) {
  const one = /^(\d+(?:\.\d+)?)% of spell power \((direct|heal|per tick)\)$/;
  const parts = s.split(', ');
  const out = [];
  for (const p of parts) {
    const m = one.exec(p);
    if (!m) return null;
    out.push(m[1] + '% 法术强度（' + CO[m[2]] + '）');
  }
  return out.join('、');
}

const rules = s => {
  let m;
  if ((m = /^Rank (\d+)$/.exec(s))) return '等级 ' + m[1];
  if ((m = /^Page (\d+)$/.exec(s))) return '第 ' + m[1] + ' 页';
  if ((m = /^([\d.]+)-([\d.]+) yd range$/.exec(s))) return m[1] + '-' + m[2] + ' 码射程';
  if ((m = /^Learned at level (\d+)$/.exec(s))) return '在等级 ' + m[1] + ' 学习';
  if ((m = /^(\d[\d,]*) (Mana|Rage|Energy|Focus|Health)$/.exec(s))) return m[1] + ' ' + UNIT[m[2]];
  if ((m = /^(\d+(?:\.\d+)?)% of base mana$/.exec(s))) return '基础法力值的 ' + m[1] + '%';
  // 法术学派，可能是 "Fire, Nature, Frost"
  if (/^[A-Z][a-z]+(, [A-Z][a-z]+)*$/.test(s)) {
    const parts = s.split(', ');
    if (parts.every(p => SCHOOL[p])) return parts.map(p => SCHOOL[p]).join('、');
  }
  if (/spell power/.test(s)) { const r = spellPower(s); if (r) return r; }
  if ((m = /^Pet: (.+)$/.exec(s))) {
    const parts = m[1].split(', ');
    if (parts.every(p => PET[p])) return '宠物：' + parts.map(p => PET[p]).join('、');
  }
  if (FIXES[s]) return FIXES[s];
  return null;
};

const untranslated = new Set();
// 另一类漏译：「键有译文，译文里却还是英文」。
// 典型来路是上一轮的自动解析只换掉了 "sec" → 「秒」，句子主体没人翻，
// 于是 is_missing 那种「值 == 键」的判据抓不到它，界面上就露出中英混杂。
const halfBaked = new Map();
const CNCH = /[\u4e00-\u9fff]/g;
const ENW = /[A-Za-z][A-Za-z'-]{2,}/g;
const KEEP_EN = /Savix|Xaryu|Soda|Zevzve|Esfand|Reddit|Wowhead|Ko-fi|Baldwin|Talents Forever|WoW|Warcraft/;
const check = (v, src) => {
  if (typeof v !== 'string' || !v || KEEP_EN.test(v)) return v;
  const cn = (v.match(CNCH) || []).length;
  if ((v.match(ENW) || []).length >= 3 && cn <= 2) halfBaked.set(src, v);
  return v;
};
const look = (s, order) => {
  for (const m of order) if (m[s] !== undefined) return check(m[s], s);
  const r = rules(s);
  if (r) return check(r, s);
  untranslated.add(s);
  return s;
};
const N = s => (typeof s !== 'string' || !s) ? s : look(s, [NAMES, EXTRA, DESCS]);
const T = s => (typeof s !== 'string' || !s) ? s : look(s, [DESCS, EXTRA, NAMES]);

// ---------- the site's own rank scaler (kept identical so estimates match) ----------
function scaleText(text, from, to, t) {
  const fixed = new Set((t && t.fixed) || []);
  const idxOnly = t && t.scaleIdx ? new Set(t.scaleIdx) : null;
  const chanceOverflow = [...text.matchAll(/(\d+(?:\.\d+)?)%\s+chance/gi)].some(m => parseFloat(m[1]) * to / from > 100);
  const hasChance = !chanceOverflow && /\d+(?:\.\d+)?%\s+chance/i.test(text);
  let i = -1;
  return text.replace(/(\b(?:by an additional|by up to|by|an additional|a|an|up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)\s+)?(\d+(?:\.\d+)?)(%)?(\s+chance)?/gi, (m, pre, num, pct, chance) => {
    i++;
    const tok = num + (pct || '');
    let ok;
    if (idxOnly) ok = idxOnly.has(i);
    else {
      if (fixed.has(tok)) return m;
      if (chanceOverflow && chance) return m;
      const p = (pre || '').trim().toLowerCase();
      if (/^(up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)$/.test(p)) return m;
      if (hasChance) ok = !!chance;
      else ok = !!pct || /\./.test(num) || /^by/.test(p);
    }
    if (!ok) return m;
    let v = parseFloat(num) * to / from; if (pct && Math.abs(v - 100) <= 1.5) v = 100; if (pct && v > 100) v = 100;
    const out = Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1);
    return (pre || '') + out + (pct || '') + (chance || '');
  });
}
const NUM = /\d+(?:\.\d+)?/g;
// Numbers keep their order between the English and the Chinese text only sometimes,
// so align by value: the k-th "15" in English is the k-th "15" in Chinese.
// Tokens that do not scale keep their own value either way, so a mismatch there is harmless.
function transferNumbers(enBase, enScaled, zh) {
  const a = enBase.match(NUM) || [], b = enScaled.match(NUM) || [], z = zh.match(NUM) || [];
  if (a.length !== b.length || a.length !== z.length) return null;
  const pos = (arr, v) => { const r = []; arr.forEach((x, i) => { if (x === v) r.push(i); }); return r; };
  const inv = {};
  for (const v of new Set(a)) {
    const ea = pos(a, v), za = pos(z, v);
    for (let k = 0; k < Math.min(ea.length, za.length); k++) inv[za[k]] = ea[k];
  }
  let k = -1;
  return zh.replace(NUM, m => { k++; const i = inv[k]; return i === undefined ? m : b[i]; });
}

// ---------- 1. work out which (talent, rank) pairs need an estimated higher rank ----------
const pending = [];
const D0 = W.TALENT_DATA;
for (const cls of Object.keys(D0)) {
  D0[cls].trees.forEach((tree, ti) => {
    tree.talents.forEach((t, i) => {
      const d = t.desc;
      if (!d || Array.isArray(d)) return;
      const known = Object.keys(d).map(Number).sort((x, y) => x - y);
      if (!known.length) return;
      for (let r = 1; r <= t.max; r++) {
        if (d[r] !== undefined) continue;
        if (t.est && t.est[r] !== undefined) continue;
        const base = known.reduce((b, k) => Math.abs(k - r) < Math.abs(b - r) ? k : b, known[0]);
        pending.push({ cls, ti, i, r, base, enBase: d[base], enScaled: scaleText(d[base], base, r, t) });
      }
    });
  });
}
console.log('estimated ranks to precompute:', pending.length);

// ---------- 2. translate the tree in place ----------
const out = {};
out.TALENT_DATA = {};
for (const cls of Object.keys(D0)) {
  const cv = D0[cls];
  const trees = cv.trees.map(tree => {
    const nt = { ...tree, name: N(tree.name) };
    if (nt.source) nt.source = T(nt.source);
    if (nt.note) nt.note = T(nt.note);
    nt.talents = tree.talents.map(t => {
      const o = { ...t };
      o.name = N(t.name);
      if (t.req) o.req = N(t.req);
      if (t.reqText) o.reqText = T(t.reqText);
      if (t.note) o.note = T(t.note);
      if (t.cost) o.cost = T(t.cost);
      if (t.asis) o.asis = T(t.asis);   // v5：与正式服文件一致性的说明（当前渲染层未用，仍译出）
      if (Array.isArray(t.desc)) o.desc = t.desc.map(T);
      else if (t.desc && typeof t.desc === 'object') { o.desc = {}; for (const k of Object.keys(t.desc)) o.desc[k] = T(t.desc[k]); }
      if (t.est && typeof t.est === 'object') { o.est = {}; for (const k of Object.keys(t.est)) o.est[k] = T(t.est[k]); }
      if (t.classic) {
        const c = { ...t.classic };
        if (c.text) c.text = T(c.text);
        if (c.tree) c.tree = N(c.tree);
        if (c.renamed) c.renamed = N(c.renamed);
        if (c.note) c.note = T(c.note);
        // v5 新增：replaces 是被这个新天赋取代掉的经典旧世天赋名数组。
        // 渲染层 `replacesLine` 会把它拼成「取代经典旧世的 A、B 与 C，合并为一个天赋。」
        // 不走 N() 就会在中文句子里露出英文天赋名。
        if (Array.isArray(c.replaces)) c.replaces = c.replaces.map(N);
        o.classic = c;
      }
      return o;
    });
    if (Array.isArray(tree.removed)) nt.removed = tree.removed.map(x => ({ ...x, name: N(x.name), text: x.text ? T(x.text) : x.text }));
    return nt;
  });
  // 职业级 source（出处说明）与树级 source 同名不同层，两层都要译
  out.TALENT_DATA[cls] = { ...cv, source: cv.source ? T(cv.source) : cv.source, trees };
}

// ---------- 3. fill in the precomputed estimated ranks, now in Chinese ----------
// A handful of descriptions gained or lost a numeral in translation, so the value
// alignment cannot run. These are written out by hand instead.
const OVERRIDES = {
  'Rogue|2|7|2': '使用伏击、锁喉或偷袭技能时，有 66% 的几率为你的目标额外增加 1 个连击点数。',
  'Rogue|2|7|3': '使用伏击、锁喉或偷袭技能时，有 100% 的几率为你的目标额外增加 1 个连击点数。',
  'Mage|2|16|2': '使你的冰寒效果有30%的几率赋予你寒冰之指效果，使你下一次施放法术时视目标为被冻结状态。持续15秒。',
  'Warlock|0|5|2': '使你的吸取生命和吸取灵魂法术造成的伤害或吸取的生命值提高4%，每多一个你施加在目标身上的痛苦系效果，就再提高4%，最多提高12%。当你的吸取灵魂对生命值低于20%的目标造成伤害时，该加成提高三倍。此外，你的吸取生命射程延长6码。',
  'Druid|1|5|2': '在熊形态、豹形态、巨熊形态或枭兽形态下，你每级获得 1 点额外的基础护甲，并且防御技能每超出你等级的五倍 1 点，再获得 1.3 点基础护甲。该数值还可由这些形态的加成进一步放大。',
  'Druid|1|5|3': '在熊形态、豹形态、巨熊形态或枭兽形态下，你每级获得 1 点额外的基础护甲，并且防御技能每超出你等级的五倍 1 点，再获得 2.0 点基础护甲。该数值还可由这些形态的加成进一步放大。',
};
let filled = 0;
const skipped = [];
for (const p of pending) {
  const t = out.TALENT_DATA[p.cls].trees[p.ti].talents[p.i];
  const key = [p.cls, p.ti, p.i, p.r].join('|');
  let res = OVERRIDES[key] || null;
  if (res === null) {
    const zh = t.desc && t.desc[p.base];
    res = zh ? transferNumbers(p.enBase, p.enScaled, zh) : null;
  }
  if (res === null) { skipped.push(p); continue; }
  if (!t.est) t.est = {};
  t.est[p.r] = res; filled++;
}
console.log('estimated ranks filled:', filled, '| skipped (number mismatch):', skipped.length);
for (const p of skipped) {
  const t = out.TALENT_DATA[p.cls].trees[p.ti].talents[p.i];
  console.log('   ', p.cls, p.ti, p.i, t.name, 'base', p.base, '-> rank', p.r);
  console.log('      EN base :', p.enBase);
  console.log('      EN scal :', p.enScaled);
  console.log('      ZH      :', t.desc[p.base]);
}

out.RACIALS = {};
for (const fac of Object.keys(W.RACIALS)) {
  out.RACIALS[fac] = W.RACIALS[fac].map(r => ({ ...r, race: N(r.race), abilities: r.abilities.map(a => [N(a[0]), T(a[1]), a[2]]) }));
}

// ---------- SPELLBOOKS ----------
// v2 新增：build / checked / levels / talents / icons / gone
out.SPELLBOOKS = {};
for (const cls of Object.keys(W.SPELLBOOKS)) {
  const sb = W.SPELLBOOKS[cls];
  const mapSpells = arr => arr.map(([n, s]) => [N(n), s ? N(s) : s]);
  const o = { ...sb, race: N(sb.race) };
  o.seen = T(sb.seen);
  if (sb.levelsSource) o.levelsSource = T(sb.levelsSource);
  o.missing = (sb.missing || []).map(N);
  o.notes = (sb.notes || []).map(T);
  o.general = mapSpells(sb.general || []);
  // tabs[].note 会渲染成页面标题旁的「· 说明」（该页是什么），必须译
  o.tabs = sb.tabs.map(t => ({ ...t, name: N(t.name), note: t.note ? T(t.note) : t.note, spells: mapSpells(t.spells) }));
  if (sb.trainer) o.trainer = { ...sb.trainer, name: N(sb.trainer.name), spells: mapSpells(sb.trainer.spells) };
  if (sb.levels) { o.levels = {}; for (const k of Object.keys(sb.levels)) o.levels[N(k)] = sb.levels[k]; }
  // 法术书里还带天赋才给的法术，以及 Classic 里被删掉的法术
  if (sb.talents) o.talents = sb.talents.map(N);
  if (sb.gone) o.gone = sb.gone.map(N);
  // icons 的键是法术名（键要跟着翻译，值/图标名不动）——渲染器用译文去查它
  if (sb.icons) {
    o.icons = {};
    for (const k of Object.keys(sb.icons)) {
      const parts = k.split('|');
      o.icons[parts.length > 1 ? N(parts[0]) + '|' + (parts[1] ? N(parts[1]) : '') : N(parts[0])] = sb.icons[k];
    }
  }
  // checked: zone 会显示给用户；date / rows / game_build 是机器可读值；npc / lacked 不渲染
  if (sb.checked) {
    const c = { ...sb.checked };
    if (c.zone) c.zone = N(c.zone);
    o.checked = c;
  }
  out.SPELLBOOKS[cls] = o;
}

out.SPELLBOOK_ICONS = {};
for (const k of Object.keys(W.SPELLBOOK_ICONS)) out.SPELLBOOK_ICONS[N(k)] = W.SPELLBOOK_ICONS[k];

// ---------- SPELL_DESC ----------
// v2 新增：sc(学派) / cs(与 Classic 的关系) / ck / cl(Classic 消耗行) / cn(变化说明) /
//          cd(Classic 原文) / co(法强加成) / was(Classic 旧名) / nt
const SD_RAW = new Set(['s', 'cs', 'ck', 'nt', 'id']);   // 逻辑标记/枚举，保持英文
out.SPELL_DESC = {};
for (const k of Object.keys(W.SPELL_DESC)) {
  const parts = k.split('|');
  const nk = [parts[0], N(parts[1]), parts[2] ? N(parts[2]) : parts[2]].join('|');
  const v = W.SPELL_DESC[k];
  const o = { ...v };
  if (v.d) o.d = T(v.d);
  if (v.lv) o.lv = T(v.lv);
  if (v.src) o.src = T(v.src);
  if (v.r) o.r = N(v.r);
  if (v.sc) o.sc = N(v.sc);          // 学派名，可能是 "Fire, Nature, Frost"
  if (v.co) o.co = T(v.co);          // "42.9% of spell power (direct)"
  if (v.cc) o.cc = T(v.cc);          // 同上但另一路字段，规则表能直译成「法术强度42.9%（直接）」
  if (v.cn) o.cn = T(v.cn);          // 变化说明
  if (v.cd) o.cd = T(v.cd);          // Classic 原文，用来做逐词 diff
  // v5 新增：fx 是「游戏文件与天赋行数的说明」整句，cx 是「与 Classic 的额外差异」短句，
  // 渲染层分别用 esc(d.fx) / esc(d.cx) 直接显示 —— 不译就会整句露英文。
  if (v.fx) o.fx = T(v.fx);
  if (v.cx) o.cx = T(v.cx);
  if (v.asis) o.asis = T(v.asis);    // 与正式服文件一致性的说明（当前渲染层未用，仍译出）
  if (v.was) o.was = N(v.was);       // Classic 里的旧名
  if (Array.isArray(v.l)) o.l = v.l.map(p => [p[0] ? N(p[0]) : p[0], p[1] ? T(p[1]) : p[1]]);
  if (Array.isArray(v.cl)) o.cl = v.cl.map(p => [p[0] ? N(p[0]) : p[0], p[1] ? T(p[1]) : p[1]]);
  out.SPELL_DESC[nk] = o;
}

// ---------- LEGACY ----------
// v2 形状：{note, points, source, trees:[{id,name,icon,perks:[{name,max,row,col,icon,ranks:[...],gate}]}]}
{
  const L = W.LEGACY;
  out.LEGACY = {
    note: T(L.note),
    points: L.points,
    source: L.source ? T(L.source) : L.source,
    trees: L.trees.map(t => ({
      ...t,
      name: N(t.name),
      perks: t.perks.map(p => {
        if (Array.isArray(p)) return [N(p[0]), p[1], T(p[2]), p[3]];   // 旧形状兜底
        // `req` 是**同树里另一个 perk 的名字**，渲染层拿它做查表（idx(tree, t.req) 比的是 name）
        // 与提示框文案（`Requires N points in ${t.req}`）。name 译了而 req 不译 → 中英文对不上，
        // 前置判定整条失效（6 个传承专长：以物易物 / 丰饶收获 / 野外指南 / 美食家 / 生死一线 / 充分休息）。
        return {
          ...p,
          name: N(p.name),
          req: p.req ? N(p.req) : p.req,
          ranks: (p.ranks || []).map(T),
        };
      }),
    })),
  };
}

// v2 的「更新内容」里有几张置顶卡片（pin），字段（eyebrow/label/title/line/cta）不在
// i18n 表里，这里按 pin.id 补译；结构（id/kind/href/color/icon/until）保持原样。
// 上游新增 pin 时，未列在这里的会回落到英文，属于已知边界。
const PIN_ZH = {
  'addon-ask': {
    eyebrow: '开发中', label: '游戏内插件', title: '游戏内插件正在开发中',
    line: '免费、无广告，登录后你的方案会跟着你走。它的功能由你说了算，填完大约一分钟。',
    cta: '说说你希望它有什么',
  },
  'full-spellbooks': {
    eyebrow: '法术 · 新增', label: '法术书', title: '完整的法术书已上线',
    line: '每个职业、到 60 级的每个等级，全部直接来自游戏自身的文件。选一个职业即可打开它的法术书。',
  },
};

out.CHANGELOG = W.CHANGELOG.map(e => {
  const o = { ...e, title: N(e.title), text: T(e.text) };
  if (o.pin && PIN_ZH[o.pin.id]) o.pin = { ...o.pin, ...PIN_ZH[o.pin.id] };
  return o;
});

out.CLASS_RACIALS = {};
for (const cls of Object.keys(W.CLASS_RACIALS)) {
  const cr = W.CLASS_RACIALS[cls];
  const races = {};
  for (const k of Object.keys(cr.races)) races[N(k)] = cr.races[k].map(a => [N(a[0]), T(a[1]), a[2]]);
  out.CLASS_RACIALS[cls] = { note: T(cr.note), sources: cr.sources ? T(cr.sources) : cr.sources, races };
}

out.CLASS_ABILITIES = {};
for (const cls of Object.keys(W.CLASS_ABILITIES)) out.CLASS_ABILITIES[cls] = W.CLASS_ABILITIES[cls].map(a => [N(a[0]), T(a[1]), a[2]]);

// ---------- POPULAR ----------
// spec 的键是天赋树名（渲染器用译文树名去查），top[].code 是分享链接的片段，保持原样
out.POPULAR = {};
{
  const P = W.POPULAR;
  const cls2 = {};
  for (const c of Object.keys(P.classes)) {
    const w = P.classes[c];
    const spec = {};
    for (const k of Object.keys(w.spec)) spec[N(k)] = w.spec[k];
    cls2[c] = {
      ...w,
      window: w.window ? T(w.window) : w.window,
      buildsLabel: w.buildsLabel ? T(w.buildsLabel) : w.buildsLabel,
      note: w.note ? T(w.note) : w.note,
      spec,
      // pick 是按"树序号 + 天赋序号"索引的三层数组，没有文案
      pick: w.pick,
      most: w.most.map(r => [r[0], N(r[1]), N(r[2])]),
      least: w.least.map(r => [r[0], N(r[1]), N(r[2])]),
    };
  }
  out.POPULAR = { generated: P.generated, window: T(P.window), pageviews: P.pageviews, classes: cls2 };
}

// ---------- UPDATES ----------
// 每行的字段按 kind 决定语义：icon 行里的 before/beforeIcon/icon 是图标名，不翻译
const UPD_FIELDS = ['talent', 'tree', 'fromTree', 'req', 'oldReq'];
function updRow(r) {
  const o = { ...r };
  for (const f of UPD_FIELDS) if (o[f]) o[f] = N(o[f]);
  if (o.text) o.text = T(o.text);
  if (o.desc) o.desc = T(o.desc);
  // v5：replaced 行携带 beforeDesc（被顶替天赋的原文说明），渲染层虽走 r.desc，
  // 但字段仍会进产物，补齐以保证数据层不留英文。
  if (o.beforeDesc) o.beforeDesc = T(o.beforeDesc);
  if (o.afterDesc) o.afterDesc = T(o.afterDesc);
  if (o.kind === 'text') {
    if (o.before) o.before = T(o.before);
    if (o.after) o.after = T(o.after);
  } else if (o.kind === 'replaced') {
    if (o.before) o.before = N(o.before);   // 被顶替的天赋名
    // beforeIcon / icon 是图标名，原样保留
  }
  // kind === 'icon' / 'gone' / 'moved' / 'new' / 'prereq' / 'ranks' / 'tree'：
  // before（若有）是图标名或已在别处出现的名字，保持原样
  if (o.kind === 'gone' || o.kind === 'moved' || o.kind === 'new') o.before = r.before;
  return o;
}
out.UPDATES = W.UPDATES.map(u => ({
  build: u.build,
  date: u.date,
  title: T(u.title),
  note: T(u.note),
  counts: u.counts,
  // v5 新增：「提示框之外」（暴雪的开发说明）。整块由渲染层直接读 notes.lines。
  // p 是查表用的地点键（all / world / 职业英文键 / race:XXX），k 是枚举，i 是图标名 —— 都不翻译。
  notes: u.notes ? {
    url: u.notes.url,
    title: T(u.notes.title),
    pending: T(u.notes.pending),
    hotfixed: T(u.notes.hotfixed),
    groups: Object.fromEntries(Object.entries(u.notes.groups || {}).map(([k, v]) => [N(k), T(v)])),
    lines: (u.notes.lines || []).map(l => {
      const o = { p: l.p, k: l.k, n: T(l.n), i: l.i };
      if (l.t) o.t = T(l.t);
      if (l.d) o.d = T(l.d);
      if (l.b) o.b = l.b;
      if (l.s) o.s = l.s;
      return o;
    }),
  } : undefined,
  talents: Object.fromEntries(Object.entries(u.talents || {}).map(([c, rows]) => [c, rows.map(updRow)])),
  racials: (u.racials || []).map(updRow),
  legacy: (u.legacy || []).map(updRow),
}));

// ---------- CHANGESHOTS ----------
// 键是 CHANGELOG 的标题（所以用 N 保持与上面一致）；src 是资源路径，稍后由 build_html 内联
out.CHANGESHOTS = {};
for (const k of Object.keys(W.CHANGESHOTS)) {
  const v = W.CHANGESHOTS[k];
  const o = { ...v, cap: T(v.cap) };
  if (v.hand) o.hand = T(v.hand);   // 「这张图是手工加的」注记
  if (Array.isArray(v.more)) o.more = v.more.map(m => ({ ...m, cap: T(m.cap) }));
  if (v.flip) {
    o.flip = {
      ...v.flip,
      cap: T(v.flip.cap),
      // frames[].cls 用来拼 "/warrior#spellbook" 这样的链接，保持英文
      frames: (v.flip.frames || []).map(fr => ({ ...fr, label: N(fr.label) })),
    };
  }
  out.CHANGESHOTS[N(k)] = o;
}

// ---------- report ----------
if (untranslated.size) {
  const list = [...untranslated].sort();
  fs.writeFileSync('_missing_i18n.txt', list.join('\n'), 'utf8');
  console.log('!! strings with no translation:', list.length, '(written to _missing_i18n.txt)');
  for (const s of list) console.log('   ' + JSON.stringify(s));
} else console.log('every string has a translation');

if (halfBaked.size) {
  console.log('!! 译文里仍是英文（自动解析留下的半成品，需补进 _src/zh2_tdesc.tsv）:', halfBaked.size);
  let n = 0;
  for (const [en, zh] of halfBaked) {
    console.log('   ' + JSON.stringify(en.slice(0, 95)));
    console.log('      -> ' + zh.slice(0, 95));
    if (++n >= 20) break;
  }
}

const js = Object.keys(out).map(k => `window.${k}=${JSON.stringify(out[k])};`).join('\n');
fs.writeFileSync('zh_data.js', js, 'utf8');
console.log('wrote zh_data.js', (js.length / 1024).toFixed(0) + ' KB');
if (untranslated.size || halfBaked.size) process.exit(1);
