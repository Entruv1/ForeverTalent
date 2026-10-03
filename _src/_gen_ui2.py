# -*- coding: utf-8 -*-
"""生成 ui_zh.py 的 IDX / FRAG / EXTRA_S / RE_S 四个块，并就地重写 ui_zh.py。

IDX      键 = 源码里的完整字面量（含定界符）→ 替换绝不会碰坏标识符
FRAG     额外的短字面量（同样带定界符）
EXTRA_S  长模板里只改可见文字的局部替换（在 apply_ui 之后执行）
RE_S     需要限定上下文的替换（正则），用于 plural(n, 'unit') 这类单位词
"""
import io, json, os, re

os.chdir(os.path.dirname(os.path.abspath(__file__)))
import ui_zh

SCRIPT = io.open('_v2app.js', encoding='utf-8').read()
BODY = io.open('_body_markup.html', encoding='utf-8').read()
HAY = SCRIPT + '\n' + BODY

raws = {}
for line in io.open('_ui_review.tsv', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line:
        continue
    _k, idx, _s, raw = line.split('\t', 3)
    raws[int(idx)] = ui_zh.unesc(raw)

# 翻译结果里如果有占位符省略号之类的残留，这里直接报出来
for line in io.open('_remap_all.tsv', encoding='utf-8'):
    _tag, _i, _s, _r, _zh = line.rstrip('\n').split('\t')
    if '...' in _zh and '...' not in _r:
        print('?? 可疑译文（占位符残留）%s: %r' % (_i, _zh[:70]))

RAWS_ALL = []
for r in json.load(open('_ui_raw.json', encoding='utf-8')):
    v = ui_zh.unesc(r['raw'])
    if v not in RAWS_ALL:
        RAWS_ALL.append(v)


FALLBACK = []


def resolve(key):
    if key[:1] in '\'"`' and key in HAY:
        return key
    bare = key.strip('\'"`').strip()
    for r in RAWS_ALL:
        if r in HAY and r[:1] in '\'"`' and r[-1:] == r[:1] and r[1:-1].strip() == bare:
            FALLBACK.append(('ok', key, r))
            return r
    # 退一步：正文里包含该片段的最短字面量
    cand = [r for r in RAWS_ALL if r in HAY and r[:1] in '\'"`' and bare in r[1:-1]]
    if cand:
        FALLBACK.append(('fuzzy', key, min(cand, key=len)))
        return min(cand, key=len)
    FALLBACK.append(('fail', key, None))
    return None


def wrap_zh(key, zh):
    q = key[:1]
    if q not in '\'"`':
        return zh
    z = zh.strip('\'"`')
    if q == '"':
        return '"' + z.replace('"', '\\"') + '"'
    if q == "'":
        return "'" + z.replace("'", "\\'") + "'"
    return q + z + q


# v4：_remap_all.tsv 已改为「完全按原文键控」的完整表（见 _remap_v4.py），
# 旧壳那套「按序号」的 DROP / ALIGN 也随之作废 —— 序号会随上游改动整体位移。
DROP = set()
OVR = {}
ALIGN = []

pairs = {}
for line in io.open('_remap_all.tsv', encoding='utf-8'):
    _tag, i, _s, r, zh = line.rstrip('\n').split('\t')
    i = int(i)
    if i in DROP:
        continue
    key = resolve(r)
    if key is None:
        print('!! 无法解析 %d %r' % (i, r[:60]))
        continue
    if key in pairs:
        continue
    pairs[key] = wrap_zh(key, zh)

IDX_OLD = json.load(open('_idx_old.json', encoding='utf-8'))
for i in ALIGN:
    key = raws[i]
    pairs[key] = wrap_zh(key, OVR.get(i, IDX_OLD[str(i)]))

# v5：_remap_fix5.tsv 由 _mk6.py 生成（新壳上线后新出现的 / 之前一直没翻的界面文案）。
# 放在 _remap_all.tsv 之后读，因此同键时它的译文优先。
if os.path.exists('_remap_fix5.tsv'):
    n5 = 0
    for line in io.open('_remap_fix5.tsv', encoding='utf-8'):
        line = line.rstrip('\n')
        if not line:
            continue
        _tag, i, _st, r, zh = line.split('\t')
        key = resolve(r) or resolve(ui_zh.unesc(r))
        if key is None:
            print('!! fix5 无法解析 %s %r' % (i, r[:70]))
            continue
        pairs[key] = wrap_zh(key, zh)
        n5 += 1
    print('v5 界面补译并入 %d 条' % n5)

# LOCAL 是「局部文案替换」，不是整段字面量替换。
# 教训：整段替换必须给出与原文等价的完整字面量，否则会把整段 JS 截断成一句短文案
# （曾经把 <div class="prog">…</div> 整块替换掉）。所以这里一律用「只改可见文字」的子串替换。
# 注意：LOCAL 的查找串是 struct_s + IDX 跑完之后的样子。
LOCAL = [
    # ---------------- 职业名（v2 无映射函数，统一走 struct_s 注入的 CN()） ----------------
    ('b.innerHTML = `<img src="${ICON(DATA[c].icon)}" alt=""><span>${c}</span>`',
     'b.innerHTML = `<img src="${ICON(DATA[c].icon)}" alt=""><span>${CN(c)}</span>`'),
    ('b.textContent.trim()===cls));', 'b.textContent.trim()===CN(cls)));'),
    ("$('#bannerName').textContent = cls;", "$('#bannerName').textContent = CN(cls);"),
    ("$('#raceCls').textContent = 'a ' + cls;", "$('#raceCls').textContent = CN(cls);"),
    ('`WoW Forever ${cls} Talent Calculator | Talents Forever`',
     '`魔兽世界：永恒 ${CN(cls)} 天赋计算器 | 永恒天赋`'),
    ('<span class="spec">${label} ${cls}</span>', '<span class="spec">${label} ${CN(cls)}</span>'),
    ('<span class="cn">${c}</span>', '<span class="cn">${CN(c)}</span>'),
    ('<b>${c}</b><small>${m.length}</small>', '<b>${CN(c)}</b><small>${m.length}</small>'),
    ('data-cls="${c}" title="${c}: ', 'data-cls="${c}" title="${CN(c)}: '),
    ('alt="${c}">${k ?', 'alt="${CN(c)}">${k ?'),
    ('alt="${c}"></a>', 'alt="${CN(c)}"></a>'),
    ('<b>${spot}.</b>', '<b>${CN(spot)}.</b>'),
    ('<b>${c}.</b> ${sentence(', '<b>${CN(c)}.</b> ${sentence('),
    ('big.map(([c, n]) => `${c} (${n})`)', 'big.map(([c, n]) => `${CN(c)} (${n})`)'),
    ('title="${c} spellbook"', 'title="${CN(c)} 法术书"'),
    ("a.textContent = `Open the ${fr.cls} book`;", "a.textContent = `打开${CN(fr.cls)}法术书`;"),
    ('的${esc(c)}。', '的${esc(CN(c))}。'),
    ("isBeta ? `${cls} spellbook`", "isBeta ? `${CN(cls)} 法术书`"),
    ('`新增 ${cls} 技能`', '`新增 ${CN(cls)} 技能`'),
    ("`${spec ? spec.textContent : cls} 方案 ${pts.join('/')} · 永恒天赋`",
     "`${spec ? spec.textContent : CN(cls)} 方案 ${pts.join('/')} · 永恒天赋`"),
    ('`魔兽世界：永恒 ${cls} 天赋 · 永恒天赋`', '`魔兽世界：永恒 ${CN(cls)} 天赋 · 永恒天赋`'),
    # 法术书翻页
    ('${i + 1} of ${n}', '第 ${i + 1} 页 / 共 ${n} 页'),
    ('${shown} of ${total} races', '${shown} / ${total} 个种族'),

    # ---------------- 复制给 AI 的正文 ----------------
    ('WoW Forever ${cls} talent build: ${pts.join(\'/\')} (${trees.map(t=>t.name).join(\' / \')}), '
     'level ${state.level}, ${spent} points spent. Built on talentsforever.com; talent text comes '
     'from the WoW Forever beta client, so treat it as the beta build, not the final game.',
     '《魔兽世界：永恒》${CN(cls)} 天赋方案：${pts.join(\'/\')}（${trees.map(t=>t.name).join(\' / \')}），'
     '等级 ${state.level}，已投入 ${spent} 点。构建于 talentsforever.com；'
     '天赋文案取自《魔兽世界：永恒》测试版客户端，请以测试版为准，正式上线后可能仍有改动。'),
    ('lines.push(`${t.name} (${pts[ti]} points)`)', 'lines.push(`${t.name}（${pts[ti]} 点）`)'),
    ('`Notes: each line is the in-game tooltip at the rank chosen',
     '`说明：每一行都是所选等级下的游戏内提示框原文'),
    ("' (est)'", "'（推算）'"),
    ('<b>talent</b> tag = ', '<b>talent</b> 标记 = '),
    ('Every spell ${/^[AEIOU]/.test(sb.race) ? \'an\' : \'a\'} ${sb.race} ${cls} had at level '
     '${sb.level} in the demo, tab by tab, with ranks.',
     '${sb.race}${CN(cls)} 在演示版等级 ${sb.level} 时拥有的全部法术，按页签排列，含每个等级。'),

    # ---------------- 更新内容 / 测试版构建抽屉 ----------------
    ("grp('Racials', '', e.racials)", "grp('种族天赋', '', e.racials)"),
    ("grp('Legacy', '', e.legacy)", "grp('传承专长', '', e.legacy)"),
    ("grp('Renamed', ren)", "grp('已改名', ren)"),
    # v5 重写了「更新内容」抽屉：下面这批键在 v4 的壳里根本不存在（旧键
    # `Beta builds · tap one to see what it changed` 已 0 命中、成了空转项，删掉）。
    # 这一块是 v5 唯一还在露英文的地方 —— IDX 是「整段字面量」通道，模板一改就整体失配，
    # 只有 EXTRA_S 这种局部子串替换还能咬住。
    ('<p class="pick">Beta builds</p>', '<p class="pick">测试版构建</p>'),
    ('aria-label="Beta builds, latest first"', 'aria-label="测试版构建，最新在前"'),
    ("<summary>Developers' notes</summary>", '<summary>开发者说明</summary>'),
    ('<b>Sources</b>', '<b>出处</b>'),
    (' Show pick rates on the trees</label>', ' 在天赋树上显示选择率</label>'),
    ('title="Popularity next to the #1 build"', 'title="相对第 1 名方案的热度"'),
    ('title="No icon yet: no build\'s game files carry this talent"',
     'title="暂无图标：没有哪个构建的游戏文件包含这个天赋"'),
    ('title="This page on its own">Link to this &rsaquo;</a>',
     'title="单独打开这一页">本页链接 &rsaquo;</a>'),
    ('<span>Latest: ${', '<span>最新：${'),
    ('Maxed: ${maxed.join(\', \')}', '已满：${maxed.join(\'、\')}'),
    ('<h4><b>From the trainer</b><small>level not read in game yet</small></h4>',
     '<h4><b>来自训练师</b><small>游戏内尚未读到等级</small></h4>'),
    ('>Open the full breakdown, build by build &rsaquo;</a>',
     '>查看逐版本完整明细 &rsaquo;</a>'),
    ('<h5>What people make now</h5>', '<h5>现在大家都怎么点</h5>'),
    ('The closest Popular build is ', '最接近的热门方案是 '),
    ('<h5>Put them back</h5>', '<h5>把它们加回来</h5>'),
    ('<h5>What the fill does</h5>', '<h5>自动填充会做什么</h5>'),
    ('>Fill it in for me</button>', '>帮我填好</button>'),
    ('<h5>What moved</h5>', '<h5>挪了位置的天赋</h5>'),
    ('<h5>What came back</h5>', '<h5>回归的天赋</h5>'),
    ('<small>Your classes</small>', '<small>你的职业</small>'),
    ('<span class="o">More</span><span class="c">Less</span>',
     '<span class="o">展开</span><span class="c">收起</span>'),
    # 只改可见文字：title 属性由下面既有的 `"A reader caught this one"` 那条先译掉，
    # 这里若把 title 一起写进键，前一条跑完后本键就永远匹配不上（实测空转）。
    ('>reader catch</i>', '>读者发现</i>'),
    ("<b>You're on the list</b> as ", '<b>你已在名单中</b>，邮箱 '),
    ('title="The level Classic\'s trainer taught it at; a Forever trainer visit will confirm it"',
     'title="经典旧世训练师教授的等级；与《永恒》训练师确认后即可确定"'),
    ('Last seven days · tap a day', '最近七天 · 轻点某一天'),
    ('Wording and icon changes', '措辞与图标改动'),
    ('Every change', '全部改动'),
    ('Legacy perks', '传承专长'),
    ('<b>Racials</b>', '<b>种族天赋</b>'),
    ('Gone since Classic', '经典旧世中已移除'),
    ("'all rows open'", "'全部行已解锁'"),
    ("'nothing here'", "'此处无改动'"),
    ("'no changes'", "'无改动'"),
    ("'latest'", "'最新'"),
    ('<span>build</span>', '<span>构建</span>'),
    ('<b>From your talents</b><small>when you spend the point</small>',
     '<b>来自你的天赋</b><small>当你投入该点天赋时</small>'),
    ('<b>Level ${L}</b>', '<b>等级 ${L}</b>'),
    ('<span class="hint">tap to read</span>', '<span class="hint">轻点阅读</span>'),
    ('Classic called it ${d.was}. Same spell, new name.',
     '经典旧世中名为 ${d.was}。同一法术，换了名字。'),
    ('title="${nice(days[i])}: ${n} update${n === 1 ? \'\' : \'s\'}"',
     'title="${nice(days[i])}：${n} 条更新"'),

    # ---------------- 提示框 ----------------
    ('<span class="lab">Next rank</span>', '<span class="lab">下一等级</span>'),

    # ---------------- 反馈邮件正文（HTML 版与桌面版共用同一段逻辑） ----------------
    ("'Page: https://talentsforever.com' + location.pathname + location.search + location.hash + "
     "'\\n\\nWhat I noticed:\\n'",
     "'页面：' + $('#shareLink').value + '\\n\\n我发现的问题：\\n'"),

    # ---------------- 其余局部文案 ----------------
    # 等级下拉
    ("o.textContent = 'Level ' + l;", "o.textContent = '等级 ' + l;"),
    # 种族面板的阵营标题（RACIALS 的键是 HORDE / ALLIANCE）
    ('<h3>${fac}</h3>', '<h3>${CNFAC[String(fac).toLowerCase()] || fac}</h3>'),
    # 法术书的「通用」页签
    ("{name: 'General', spells: sb.general", "{name: '通用', spells: sb.general"),
    # v5 起页签判定改成 `if(t.name === 'General'){`（旧壳是 `... return;`，键已失效）。
    # 这一对必须成对改：数据里的 Page 名已译成「通用」，判定留在英文就永远不成立，
    # 「练级顺序」里的训练师被动技能（双武器 / 招架）会整块不显示。
    ("if(t.name === 'General'){", "if(t.name === '通用'){"),
    ("if(t.name === 'General') return;", "if(t.name === '通用') return;"),
    # 数据里的 sub 字段是「被动」，判定也要跟着走，否则整块 return 掉。
    ("if(sub !== 'Passive' || !TRAINER_TAUGHT.has(n)", "if(sub !== '被动' || !TRAINER_TAUGHT.has(n)"),
    # 这一行右侧的页签名会渲染出来
    ("tab: 'Trainer', note:", "tab: '训练师', note:"),
    # 法术书翻页
    ("<small>Book &middot; ${bookPage} of ${bookPages}</small>",
     "<small>法术书 &middot; 第 ${bookPage} / ${bookPages} 页</small>"),
    ("&middot; ${page + 1} of ${pages}</b>", "&middot; 第 ${page + 1} / ${pages} 页</b>"),
    # 热门方案列表里的「载入」
    # 提示框里的「被动」
    ("t.passive ? 'Passive' : ''", "t.passive ? '被动' : ''"),
    # 「我的方案」下拉的第一项（窄屏用短标签）
    ("${short ? 'Builds' : ", "${short ? '方案' : "),
    (">Load</a>", ">载入</a>"),
    (" All other classes get double verified this weekend.",
     " 其余所有职业将在本周末完成二次核对。"),
    ("<span>Double verified in game: <b>${doneCls.length} of ${nAll}</b>",
     "<span>已在游戏内二次核对：<b>${doneCls.length} / ${nAll}</b>"),
    ("(${doneCls.join(', ')})", "（${doneCls.join('、')}）"),
    (": ''}.${left ? ", ": ''}。${left ? "),
    ("`${tr.name}, row ${t.row}`", "`${tr.name}，第 ${t.row} 行`"),
    (">Hold <kbd>${REFKEY}</kbd> to explain ", ">按住 <kbd>${REFKEY}</kbd> 可说明"),
    ("${rest === 1 ? 'name' : rest + ' names'}", "${rest === 1 ? '名称' : rest + ' 个名称'}"),
    ("} ${pts.join('/')} (level ${state.level}, ${spent} points)",
     "} 方案 ${pts.join('/')}（等级 ${state.level}，${spent} 点）"),
    ("Classes with talents ${BWORD[kf]", "有天赋改动的职业 ${BWORD[kf]"),
    # ---------------- 职业名渲染成中文 ----------------
    # CLASSES / TALENT_DATA 的一级键是英文（URL 与查表要用），渲染层由 CN() 转中文。
    # 下面这些位置原先直接插 ${cls} / ${c} / esc(cls)，界面上会出现「热门 Warrior 方案」。
    ("现在每个 ${cls} 都可以从训练师处学习", "现在每个 ${CN(cls)} 都可以从训练师处学习"),
    ("的 ${cls} 训练师一致", "的 ${CN(cls)} 训练师一致"),
    ("${doneCls[0]} 训练师在", "${CN(doneCls[0])} 训练师在"),
    ("${doneCls.join('、')}", "${doneCls.map(CN).join('、')}"),
    ("最热门的 ${cls} 方案第 ${b.rank} 名", "最热门的 ${CN(cls)} 方案第 ${b.rank} 名"),
    ("热门 ${cls} 方案", "热门 ${CN(cls)} 方案"),
    ("${cls} 法术书（等级 ${sb.level}）", "${CN(cls)} 法术书（等级 ${sb.level}）"),
    ("${cls} 训练师可教至 60 级的全部法术", "${CN(cls)} 训练师可教至 60 级的全部法术"),
    ("${cls} 种族法术", "${CN(cls)} 种族法术"),
    ("已载入你上次的 ${cls} 方案。", "已载入你上次的 ${CN(cls)} 方案。"),
    ("${cls} ${split}", "${CN(cls)} ${split}"),          # 自动起的方案名
    ("where: `${cls} spell${rk ? ', ' + rk.toLowerCase() : ''}`",
     "where: `${CN(cls)} 法术${rk ? '（' + rk + '）' : ''}`"),
    ("打开${esc(f0.cls)}法术书", "打开${esc(CN(f0.cls))}法术书"),
    ('alt="${c}" title="${c}">', 'alt="${CN(c)}" title="${CN(c)}">'),
    ('<optgroup label="${c}">', '<optgroup label="${CN(c)}">'),
    ('<b>${c}</b><small>', '<b>${CN(c)}</b><small>'),
    ("title=\"${c}: from the game's own files", 'title="${CN(c)}：直接读取自游戏自身文件'),
    # 更新内容里按职业展开的明细行：<small>Warrior · 武器</small>
    ("const where = cls ? `<small>${esc(cls)} · ", "const where = cls ? `<small>${esc(CN(cls))} · "),
    ("row(r, 'Racial')", "row(r, '种族天赋')"),
    ("row(r, 'Legacy')", "row(r, '传承专长')"),
    ("<b>Racials.</b>", "<b>种族天赋。</b>"),
    ("<b>Legacy.</b>", "<b>传承专长。</b>"),
    ('<span class="lab">Before</span><img loading="lazy" src="${c.before}" alt="Before" ${mw(c.w)}>'
     '<span class="lab a">After</span><img loading="lazy" src="${c.after}" alt="After" ${mw(c.w)}>',
     '<span class="lab">改动前</span><img loading="lazy" src="${c.before}" alt="改动前" ${mw(c.w)}>'
     '<span class="lab a">改动后</span><img loading="lazy" src="${c.after}" alt="改动后" ${mw(c.w)}>'),

    # ---------------- v5 第二批：新渲染层的可见英文 ----------------
    # v5 重写了「游戏内 / 选择镜头 / 热门方案 / 新增技能」几块，模板整体换过一遍，
    # 旧的整段 IDX 全部失配（键 = 源码完整字面量，模板一改就整体对不上），
    # 只剩下面这些「只改可见文字」的局部替换还咬得住。全部由 smoke 探针逐条揪出来。
    # ⚠️ LOCAL 的查找串是 struct_s + IDX 跑完之后的样子：短字面量（'No builds yet'、
    #    'Icons only'、', N renamed' …）早已被 IDX 单独译掉，写「整行原文」必成空转键。
    #    所以这里一律只钉住 IDX 之后仍然露英文的那一小段。
    #
    # (1) 首页「游戏内」磁贴的副标题：只剩数字 + change 这一截
    ("playerN(UPD0)} change${playerN(UPD0) === 1 ? '' : 's'}",
     "playerN(UPD0)} 项改动"),
    # (2) build 名：`1.60.1.70170 hotfixes` → `70170 热修`；普通版 → `构建 70170`。
    #     原来 short() 只剥前缀，` hotfixes` 后缀原样露出来（smoke：<b>70170 hotfixes</b>）。
    ("short = b => String(b).replace(/^1\\.60\\.1\\./, ''), bname = b => / hotfixes$/.test(b) ? `the ${short(b)}` : `build ${short(b)}`",
     "short = b => String(b).replace(/^1\\.60\\.1\\./, '').replace(/ hotfixes$/, ' 热修'), bname = b => / hotfixes$/.test(b) ? `${short(b)}` : `构建 ${short(b)}`"),
    # (3) 选择镜头的三行行首标签（界面上是 CSS 大写后的 CLASS / HORDE / ALLIANCE / LEGACY）
    ("pickRow('Class', clsItems, p, 'cls')", "pickRow('职业', clsItems, p, 'cls')"),
    ("pickRow(side, rs.filter(x => x && x.race).map(raceItem), p, 'inl')",
     "pickRow(CNFAC[String(side).toLowerCase()] || side, rs.filter(x => x && x.race).map(raceItem), p, 'inl')"),
    ("pickRow('Legacy',", "pickRow('传承专长',"),
    # (4) 九宫格图例：`'rule changes'` 这个字面量早先已被整段译成 `'规则调整'`，
    #     于是 `BWORD[k] === '规则调整'` 恒真，把英文短形 `'rules'` 顶出来了。
    ("? 'rules' : BWORD[k]", "? '规则' : BWORD[k]"),
    ("(${BWORD[kf]} only)", "（仅${BWORD[kf]}）"),
    # (5) 热门方案的说明段（首句 + epoch 那句）。中间那句 stale 早有整段 IDX 覆盖。
    ("Builds within a few points of each other count as one, and the rows are ranked by how often people shared, saved or opened them.",
     "点数相近的方案会合并算作一个，排序依据是人们分享、保存或打开它的次数。"),
    (" Since the ${(d => { const [y,m,dd] = d.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + +dd; })(pop.epoch.date)} patch: ${pop.epoch.complete.toLocaleString()} complete ${cls} build${pop.epoch.complete === 1 ? '' : 's'} so far. At ${pop.epoch.need.toLocaleString()} this list will rank those alone.",
     " 自 ${(d => { const [y,m,dd] = d.split('-'); return `${+m} 月 ${+dd} 日`; })(pop.epoch.date)} 补丁以来：已完成 ${pop.epoch.complete.toLocaleString()} 套 ${CN(cls)} 方案。达到 ${pop.epoch.need.toLocaleString()} 套后，本列表将只对它们排名。"),
    # (6) 「新增技能」折叠区的说明行：IDX 只译掉了 `, N renamed` / `, N gone` 两小截
    #     （见 <div class="ltrees one"> 那一段），头尾两句仍是英文。
    ("${news.length} new in Forever", "${news.length} 项为《永恒》新增"),
    (". From the beta's game files, compared with Classic by spell id.",
     "。直接对比自测试服游戏文件，按法术 ID 与经典旧世逐一核对。"),
    # (7) 「How it works」里「全部 N 个天赋…」那句：hotList 存的是英文职业键。
    ("const hotList = hot.length > 1 ? `${hot.slice(0, -1).join(', ')} and ${hot[hot.length - 1]}` : hot[0];",
     "const hotList = hot.length > 1 ? `${hot.slice(0, -1).map(CN).join('、')} 与 ${CN(hot[hot.length - 1])}` : CN(hot[0]);"),
    # (8) nice() 上一轮已改成「2026年10月2日」，day() 原来靠 `/ \\d{4}$/` 剥年份，
    #     现在剥不掉了 → 紧凑的构建列表里会顶出一长串。这里补回短写法。
    ("const day = d => nice(d).replace(/ \\d{4}$/, '')",
     "const day = d => { const [y,m,dd] = d.split('-'); return `${+m} 月 ${+dd} 日`; }"),

    # ---------------- v5 第三批：折叠区展开后才露出来的英文 ----------------
    # smoke 探针原来只扫「已经展开」的部分，<details> 收起时里面的 innerText 读不到
    # （Chrome 不渲染），折叠标题一类的英文就被整体漏掉。给探针加了「先把所有折叠区
    # 展开再扫」之后，多出下面这些 —— 全是 Lv 10…57 这种等级标签与折叠区标题里的职业名。
    ('<span class="lv">Lv ${start+k}</span>', '<span class="lv">${start+k} 级</span>'),
    # 等级点上的悬停说明。`' at level '` 那半截已被整段 IDX 译成 `'，等级 '`，
    # 只剩行首的 Rank 还露着 —— 所以这里只钉 `title="Rank ${k + 1}` 这一小段。
    ('title="Rank ${k + 1}', 'title="第 ${k + 1}'),
    # 更新内容抽屉里「按职业折叠」的标题：<b> 里直接插的是英文职业键。
    # （<b>${c}</b><small> 那半截已有既有的 LOCAL 覆盖，这里只管 grp(title,...) 那条路）
    ("cls.map(c => grp(c, T.cicon(c), T.classRows(e, c))).join('')",
     "cls.map(c => grp(CN(c), T.cicon(c), T.classRows(e, c))).join('')"),
]
LOCAL_KEYS = set(a for a, _ in LOCAL)


def pick(cands, zh):
    for k in cands:
        if k in HAY:
            pairs[k] = wrap_zh(k, zh) if k[:1] in '\'"`' else zh
            return True
    return False


# 复数单位词必须「只改 plural(n, 'unit') 里的那一个参数」。
# 千万不能用裸的引号字面量做全局替换 —— 实测踩到三次：
#   'change' 也是 document.addEventListener('change', …) 的事件名；
#   'icon'   也是 r.kind === 'icon' 与 ORDER 数组里的分类名（分类名由 KIND 映射成中文标签）。
# 所以这里走正则通道（RE_S），锚定在 plural( 的第一个参数之后。
# plural(total(latest), 'change') 的第一个参数可能自带括号，故允许一层括号。
UNIT = [
    ('build', '个构建'),
    ('change', '项变化'),
    ('talent change', '项天赋改动'),
    ('arrow', '个前置'),
    ('tab', '个页签'),
    ('tooltip', '处提示框'),
    ('icon', '处图标'),
]
RE_S = [(r"(plural\([^()]*(?:\([^()]*\)[^()]*)*,\s*)%s" % re.escape("'" + en + "'"),
         "\\1'" + zh + "'")
        for en, zh in UNIT]
# v5 新增：**脚本里**的站内链接。与正文的 RE_B 同一条思路，但 RE_B 只跑正文 ——
# 离线打开 href="/privacy" 会解析成 file:///privacy 或 app://talents/privacy：
# 浏览器版跳进文件系统根目录，exe 版命中协议处理器拿 404 纯文本、整页被顶掉。
# 实测三条：<a href="/privacy#alerts">、<a href="/account">、选择器 a[href="/wrapped"]。
# 字符集必须带 `#`，否则匹配不到 `href="/privacy#alerts"` 那条（会静默漏掉）；
# 选择器里的 `a[href="/wrapped"]` 也要一起改，才能和正文 RE_B 改过的地址对得上。
RE_S.append(('href="/(?=[a-z])([a-zA-Z0-9._/#-]*)"',
             'href="%s/\\1"' % ui_zh.SITE))

for cands, zh in [
    (["' reworded'"], ' 措辞有调整'),
    (["' refreshed'"], ' 已刷新'),
    (["' changed'"], ' 已改动'),
    (["' renamed'"], ' 已改名'),
    (["'flip through'"], '逐页翻阅'),
    (["'tap to read'"], '轻点阅读'),
    (["'tap to close'"], '轻点关闭'),
    (["'No points spent.'"], '尚未投入天赋点。'),
    (["'Show the latest'"], '显示最新'),
    (["'Everything new'"], '全部新内容'),
    (["'No builds yet'"], '尚无方案'),
    (["'No changes'"], '无改动'),
    (["'Up to date'"], '已是最新'),
    (["'this week'", "' this week'"], '本周'),
    (["'Nothing in this tab.'"], '此页签中没有内容。'),
    (["'Nothing for this class.'"], '该职业没有内容。'),
    (["'the other '"], '其他 '),
    (["'spellbook below'"], '下方法术书'),
    (["'Show'"], '展开'),
    (["'Hide'"], '收起'),
    (["'Open'"], '展开'),
    (["'Good'"], '好'),
    (["'My builds'"], '我的方案'),
    (["'Stream layout'"], '直播布局'),
    (["'Compare to Classic'"], '对比经典旧世'),
    (["'Copy link'", "'Copy link'"], '复制链接'),
    (["'Reset'"], '重置'),
    (["'Reset build'"], '重置方案'),
    (["'Level needed'"], '需要等级'),
    (["'Points left'"], '剩余点数'),
    (["'Level'"], '等级'),
    (["'Save this build'"], '保存此方案'),
    (["'Back up'"], '备份'),
    (["'Restore'"], '恢复'),
    (["'Add builds'"], '添加方案'),
    (["'Send to a friend'"], '发送给朋友'),
    (["'Copy build for AI'"], '复制方案给 AI'),
    (["'Raw data'"], '原始数据'),
    (["'Theorycraft'"], '理论研究'),
    (["'Share'"], '分享'),
    (["'What\\\'s new'"], '更新内容'),
    (["'Repeated talents'"], '重复天赋'),
]:
    pick(cands, zh)

EXTRA_S = [
    (' · new</span><img class="solo"', ' · 新增</span><img class="solo"'),
    (' · slide right for after</span>', ' · 向右滑动查看改动后</span>'),
    ('aria-label="Drag to compare before and after"', 'aria-label="拖动以对比改动前后"'),
    ('>Show before</button>', '>看作改动前</button>'),
    ('>Show after</button>', '>看作改动后</button>'),
    (' · real pages, tap the arrows</span>', ' · 真实页面，轻点箭头翻页</span>'),
    ('aria-label="Previous page"', 'aria-label="上一页"'),
    ('aria-label="Next page"', 'aria-label="下一页"'),
    ('<small>1 of ${fl.frames.length}</small>', '<small>第 1 页 / 共 ${fl.frames.length} 页</small>'),
    ('>Open the ${esc(f0.cls)} book</a>', '>打开${esc(f0.cls)}法术书</a>'),
    ('title="Opens with pictures"', 'title="点开后可看图片"'),
    ("bits.join(', ') + '.'", "bits.join('、') + '。'"),
    ("' ' + soft.join(' and ') + '.'", "'，' + soft.join('、') + '。'"),
    ('` Most touched: ', '` 改动最多：'),
    (").join(', ')}.", ").join('、')}."),
    ('"A reader caught this one"', '"一位读者发现了这一条"'),
]
EXTRA_S = [(a, b) for a, b in EXTRA_S if a in HAY]
EXTRA_S = EXTRA_S + LOCAL   # LOCAL 不过 HAY 过滤：它的查找串是翻译之后才出现的

# ------------------------------------------------------------------ 空转键剪枝
# 模拟 build_html.py 的顺序：struct_s -> IDX(长键优先) -> EXTRA_S，
# 把轮到自己时已经找不到的键删掉（它们只是被更长的键吞掉了）。
def simulate():
    tmp_s, tmp_b = SCRIPT, BODY
    for a, b in ui_zh.struct_s(ui_zh.PIXEL):
        tmp_s = tmp_s.replace(a, b)
    dead = []
    for k in sorted(pairs, key=len, reverse=True):
        n = tmp_s.count(k) + tmp_b.count(k)
        if not n:
            dead.append(k)
            continue
        tmp_s = tmp_s.replace(k, pairs[k])
        tmp_b = tmp_b.replace(k, pairs[k])
    dead_x = []
    for a, b in EXTRA_S:
        if tmp_s.count(a) + tmp_b.count(a):
            tmp_s = tmp_s.replace(a, b)
            tmp_b = tmp_b.replace(a, b)
        else:
            dead_x.append(a)
    return dead, dead_x


dead, dead_x = simulate()
for k in dead:
    pairs.pop(k, None)
if dead_x:
    EXTRA_S = [(a, b) for a, b in EXTRA_S if a not in dead_x]
print('剪掉空转键 IDX %d 条 / EXTRA_S %d 条' % (len(dead), len(dead_x)))
for k in dead:
    print('   - %s' % repr(k[:80]))
for k in dead_x:
    print('   %s %s' % ('!! LOCAL 空转:' if k in LOCAL_KEYS else '[X]', repr(k[:80])))

print('resolve 兜底：fuzzy %d / fail %d / 精确 %d'
      % (sum(1 for t, _, _ in FALLBACK if t == 'fuzzy'),
         sum(1 for t, _, _ in FALLBACK if t == 'fail'),
         len(pairs) - len(FALLBACK)))
for t, k, r in FALLBACK:
    if t != 'ok':
        print('   %-6s %r -> %r' % (t, k[:60], (r or '')[:60]))

# ---- 自检 1：IDX 的键与值的定界符必须一致（键 `…` 的值也必须是 `…`）----
bad_q = []
for en, zh in pairs.items():
    q = en[:1]
    if q not in '`\'"':
        continue
    if not en.endswith(q) or not (zh.startswith(q) and zh.endswith(q)):
        bad_q.append((q, en, zh))
if bad_q:
    print('!! 定界符不一致 %d 条：' % len(bad_q))
    for q, en, zh in bad_q:
        print('   %s %r -> %r' % (q, en[:70], zh[:70]))
else:
    print('定界符自检通过（%d 条）' % len(pairs))

# ---- 自检 2：值里不许出现占位符省略号 ----
for en, zh in pairs.items():
    if '...' in zh and '...' not in en:
        print('!! 疑似占位符残留: %r -> %r' % (en[:60], zh[:60]))
for a, b in EXTRA_S:
    if '...' in b and '...' not in a:
        print('!! 疑似占位符残留: %r -> %r' % (a[:60], b[:60]))


def py_dict(name, d, comment):
    out = [comment, '%s = [' % name] if not isinstance(d, dict) else [comment, '%s = {' % name]
    items = d.items() if isinstance(d, dict) else d
    for it in items:
        k, v = it if isinstance(d, dict) else it
        out.append('    %s: %s,' % (repr(k), repr(v)) if isinstance(d, dict)
                   else '    (%s, %s),' % (repr(k), repr(v)))
    out.append(']' if not isinstance(d, dict) else '}')
    return '\n'.join(out)


src = io.open('ui_zh.py', encoding='utf-8').read()
m1 = src.index('# ============================================================ 1. 整段字面量')
m2 = src.index('# ============================================================ 2. app 脚本的代码级补丁')
head, tail = src[:m1], src[m2:]
tail = tail[:tail.index('def _load_ui():')] + '''def _load_ui():
    """IDX / FRAG 展开成 {原文: 译文}，原文与源码逐字节一致。"""
    ui = dict(IDX)
    for en, zh in FRAG.items():
        ui[en] = zh
    return ui


# 与 build_html.py 的 import 对齐
extra_s = list(EXTRA_S)

UI = _load_ui()
'''

blocks = '\n\n'.join([
    py_dict('IDX', pairs,
            '# ============================================================ 1. 整段字面量（键即源码原文，含定界符）\n'
            '# 用「完整的字面量」做键，替换时绝不会碰到标识符或 class 名。'),
    py_dict('FRAG', {}, '# （短字面量已并入 IDX；这里留空占位）'),
    py_dict('EXTRA_S', EXTRA_S, '# 长模板里只改可见文字的局部替换（在 apply_ui 之后执行）'),
    py_dict('RE_S', RE_S,
            '# 需要限定上下文的替换（正则，最后执行）。\n'
            '# 只动 plural(n, \'unit\') 的第二个参数：同一串字面量在别处是事件名或分类名，\n'
            '# 裸替换会把 addEventListener(\'change\') / r.kind === \'icon\' 一起改坏。'),
])
io.open('ui_zh.py', 'w', encoding='utf-8').write(head + blocks + '\n\n\n' + tail)
print('IDX %d 条 / EXTRA_S %d 条 / RE_S %d 条' % (len(pairs), len(EXTRA_S), len(RE_S)))
