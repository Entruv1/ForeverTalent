# -*- coding: utf-8 -*-
"""永恒天赋计算器 —— v2 站点的界面汉化表与结构性补丁。

三个层次：
  IDX      按 _ui_review.tsv 的序号，对「整段字符串/模板字面量」做整串替换
           （原文从 _ui_review.tsv 取，保证与源码逐字节一致）
  FRAG     零散片段的整串替换，直接写原文即可
  STRUCT_S app 脚本里的代码级补丁（资源基址、离线路由、复数后缀等）
  STRUCT_B 正文里的结构性补丁（head/meta/lang）
  EXTRA_B  正文的整句替换（含保留 href / <a> / <kbd> 等标签）
"""
import os, re

SRC = os.path.dirname(os.path.abspath(__file__))
PIXEL = ('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
SITE = 'https://talentsforever.com'


def unesc(s):
    return s.replace('\\n', '\n').replace('\\t', '\t')


# ============================================================ 1. 整段字面量（键即源码原文，含定界符）
# 用「完整的字面量」做键，替换时绝不会碰到标识符或 class 名。
IDX = {
    "'To be added in future patch content'": "'将于后续补丁中加入'",
    '`Requires ${t.gate} points in ${tree.name}`': '`需要在${tree.name}中投入 ${t.gate} 点`',
    '`Requires ${need} points in ${tree.name} Talents`': '`需要在${tree.name}天赋中投入 ${need} 点`',
    "`Requires ${tree.talents[p].max} point${tree.talents[p].max>1?'s':''} in ${t.req}`": '`需要先点满 ${t.req}（${tree.talents[p].max} 点）`',
    "`All ${pool(cls)} ${cls === 'Legacy' ? 'Legacy ' : ''}points spent. Take one back from another ${cls === 'Legacy' ? 'perk' : 'talent'} to move it.`": "`已用尽${cls === 'Legacy' ? '传承' : ''}点数 ${pool(cls)} 点。要从其他${cls === 'Legacy' ? '专长' : '天赋'}上取回一点才能移动它。`",
    '`Talented ${tr}/5 in your Legacy perks: talent points start at level ${10 - tr}. `': '`传承专长「天赋异禀」已点 ${tr}/5：天赋点从等级 ${10 - tr} 起算。 `',
    "'In the order the points were placed. Take a point back and add it again to move it later in the order.'": "'按投入点数的顺序排列。取回一点再重新加上，就能把它移到顺序中的更后面。'",
    "'This build came without an order, so it is listed tree by tree, row by row. Place points yourself and the order follows your clicks.'": "'该方案没有携带加点顺序，因此按天赋树逐行列出。你自己点击加点，顺序就会跟随你的点击生成。'",
    '`27 account-wide perks. ${lTotal()} / ${L.points} spent.`': '`27 个账号通用专长。已投入 ${lTotal()} / ${L.points} 点。`',
    '`27 account-wide perks, ${L.points} points.`': '`27 个账号通用专长，共 ${L.points} 点。`',
    '`next unlock at ${next}`': '`下一项解锁于 ${next}`',
    '`${t.name}, rank ${r} of ${t.max}`': '`${t.name}，等级 ${r}/${t.max}`',
    '`is a new spell${r.level ? ` <span class="soft">(from level ${r.level})</span>` : \'\'}`': '`是一个新增法术${r.level ? ` <span class="soft">（从等级 ${r.level} 起）</span>` : \'\'}`',
    '`takes ${esc(r.before)}\'s spot in ${esc(r.tree)}${r.row ? ` <span class="soft">from level ${lv(r.row)}</span>` : \'\'}${r.desc ? ` <span class="soft">${esc(r.desc.replace(/\\.$/, \'\'))}</span>` : \'\'}`': '`取代了 ${esc(r.before)} 在 ${esc(r.tree)} 中的位置${r.row ? ` <span class="soft">从等级 ${lv(r.row)} 起</span>` : \'\'}${r.desc ? ` <span class="soft">（${esc(r.desc.replace(/\\.$/, \'\'))}）</span>` : \'\'}`',
    '`is new for ${esc(r.tree)}`': '`是 ${esc(r.tree)} 的新增天赋`',
    '`is new in ${esc(r.tree)}, row ${r.row} <span class="soft">(from level ${lv(r.row)})</span>`': '`是 ${esc(r.tree)} 的新增天赋，第 ${r.row} 行 <span class="soft">（从等级 ${lv(r.row)} 起）</span>`',
    '`is gone from ${esc(r.tree)}`': '`已从 ${esc(r.tree)} 中移除`',
    '`moved from ${esc(r.fromTree)} to ${esc(r.tree)}`': '`从 ${esc(r.fromTree)} 移到了 ${esc(r.tree)}`',
    '`moved from row ${r.fromRow} to row ${r.row} in ${esc(r.tree)} <span class="soft">(reachable from level ${lv(r.row)} instead of ${lv(r.fromRow)})</span>`': '`在 ${esc(r.tree)} 中从第 ${r.fromRow} 行移到第 ${r.row} 行 <span class="soft">（从等级 ${lv(r.row)} 起可达，而非 ${lv(r.fromRow)}）</span>`',
    '`slid along row ${r.row} in ${esc(r.tree)}`': '`在 ${esc(r.tree)} 第 ${r.row} 行内移动了列`',
    '`now needs ${esc(r.req)} first`': '`现在需要先点出 ${esc(r.req)}`',
    '`no longer needs ${esc(r.oldReq)}`': '`不再需要先点出 ${esc(r.oldReq)}`',
    '`<li class="under"><i>&#9707;</i><span class="txt">Under the hood: ${plural(k.icon, \'icon\')} refreshed. Icons only; open Every change to see each one.</span></li>`': '`<li class="under"><i>&#9707;</i><span class="txt">底层改动：刷新了 ${plural(k.icon, \'icon\')}。只是图标替换；展开「全部改动」可逐条查看。</span></li>`',
    '`<div class="bp-words"><h4>In plain words</h4><ul>${out.join(\'\')}</ul><p class="mmkey"><i class="k1"></i> new or replaced <i class="k2"></i> gone <i class="k3"></i> moved</p></div>`': '`<div class="bp-words"><h4>白话说明</h4><ul>${out.join(\'\')}</ul><p class="mmkey"><i class="k1"></i> 新增或替换 <i class="k2"></i> 移除 <i class="k3"></i> 移动</p></div>`',
    '`${k.gone} removed`': '`${k.gone} 项移除`',
    '`${k.moved} moved`': '`${k.moved} 项移动`',
    '`<details class="bsec" open><summary>What moved in the trees<small>${majors.length}</small></summary><ul class="brows major">${majors.join(\'\')}</ul></details>`': '`<details class="bsec" open><summary>天赋树中的位置变动<small>${majors.length}</small></summary><ul class="brows major">${majors.join(\'\')}</ul></details>`',
    '`<div class="chips"><i class="quiet">No data changes</i></div>`': '`<div class="chips"><i class="quiet">数据无变化</i></div>`',
    '`<li class="since"><b>Since you were here</b> (${nice(seen)}): ${fresh.length ? `${plural(fresh.length, \'build\')} checked, ${nfresh ? plural(nfresh, \'change\') + \' on the site\' : \'nothing changed on the site\'}.` : \'no new builds.\'}</li>`': '`<li class="since"><b>自你上次访问以来</b>（${nice(seen)}）：${fresh.length ? `${plural(fresh.length, \'build\')} 已核对，${nfresh ? plural(nfresh, \'change\') + \' 于站点\' : \'站点无变化\'}。` : \'没有新构建。\'}</li>`',
    '`<li class="since"><b>Every beta build</b> is checked against the site the day it lands. This is what each one changed.</li>`': '`<li class="since"><b>每个测试版构建</b>在发布当天都会与本站点核对。这里记录的就是每个构建带来的改动。</li>`',
    '`<li class="bkey"><i class="k-new">+ new</i><i class="k-gone">&minus; gone</i><i class="k-moved">&#8644; moved</i><i class="k-prereq">&#8627; arrow</i><i class="k-text">&#9998; text</i><i class="k-icon">&#9707; icon</i></li>`': '`<li class="bkey"><i class="k-new">+ 新增</i><i class="k-gone">&minus; 移除</i><i class="k-moved">&#8644; 移动</i><i class="k-prereq">&#8627; 前置</i><i class="k-text">&#9998; 文本</i><i class="k-icon">&#9707; 图标</i></li>`',
    '`<span class="dot"></span>Beta build <b>${esc(UPD[0].build)}</b> · checked ${nice(UPD[0].date)} <i>&rsaquo;</i>`': '`<span class="dot"></span>测试版构建 <b>${esc(UPD[0].build)}</b> · 核对于 ${nice(UPD[0].date)} <i>&rsaquo;</i>`',
    '`<button type="button" class="tile site" data-go="site"><span class="tk"><span class="tic" aria-hidden="true"><img src="/assets/book-round.png" alt=""></span>On the site${siteFresh ? \'<i class="dot"></i>\' : \'\'}</span><span class="tb">${nSite ? nSite + \' new\' : (seen ? \'Up to date\' : weekN + \' this week\')}</span><span class="ts">${esc(LOG[0].title)}</span>${spark}</button>`': '`<button type="button" class="tile site" data-go="site"><span class="tk"><span class="tic" aria-hidden="true"><img src="/assets/book-round.png" alt=""></span>站点${siteFresh ? \'<i class="dot"></i>\' : \'\'}</span><span class="tb">${nSite ? nSite + \' 项新增\' : (seen ? \'已是最新\' : weekN + \' 项本周\')}</span><span class="ts">${esc(LOG[0].title)}</span>${spark}</button>`',
    '\'<p class="hl">No beta build checked yet.</p>\'': '\'<p class="hl">尚未核对任何测试版构建。</p>\'',
    '`<div class="sum"><div class="sumhead"><b>${n}</b><span>change${n === 1 ? \'\' : \'s\'} for players across ${T.sentence(where).replace(/\\.$/, \'\')}</span></div>`': '`<div class="sum"><div class="sumhead"><b>${n}</b><span> 项改动，涉及 ${T.sentence(where).replace(/\\.$/, \'\')}</span></div>`',
    '`<details class="deeper" id="gameLines"><summary><span>Every change</span><small>${nAll}${nIcon ? `, ${nIcon} of them icons` : \'\'}</small></summary><div class="lines">${lines(e)}</div></details>`': '`<details class="deeper" id="gameLines"><summary><span>全部改动</span><small>${nAll}${nIcon ? `，其中 ${nIcon} 项为图标` : \'\'}</small></summary><div class="lines">${lines(e)}</div></details>`',
    "'before / after'": "'改动前 / 改动后'",
    '`<p class="dayhead"><span><b>${chosen.length}</b> update${chosen.length === 1 ? \'\' : \'s\'} on ${day(dayf)}</span><button type="button" class="reset">Show the latest</button></p>`': '`<p class="dayhead"><span><b>${chosen.length}</b> 项更新于 ${day(dayf)}</span><button type="button" class="reset">显示最新</button></p>`',
    '`<p class="dayhead"><span><b>${weekN}</b> updates in the last seven days${nSite ? `, <b>${nSite}</b> since your last visit` : \'\'}. The latest:</span></p>`': '`<p class="dayhead"><span><b>${weekN}</b> 项更新发生在最近七天。最新：</span></p>`',
    '`<ol class="ents">${chosen.map(entCard).join(\'\')}</ol><details class="deeper" id="siteDeep"${keepOpen ? \' open\' : \'\'}><summary><span>Everything new</span><small>${LOG.length} entries</small></summary><ol class="ents all">${LOG.map(entCard).join(\'\')}</ol></details>`': '`<ol class="ents">${chosen.map(entCard).join(\'\')}</ol><details class="deeper" id="siteDeep"${keepOpen ? \' open\' : \'\'}><summary><span>全部新内容</span><small>${LOG.length} 条</small></summary><ol class="ents all">${LOG.map(entCard).join(\'\')}</ol></details>`',
    "'No tooltip video for this class yet'": "'尚未收录该职业的提示框录像'",
    '`<p>No ${tree.name} tooltips captured yet. Record this tree and it fills in.</p>`': '`<p>尚未收录${tree.name}的天赋提示框。录制该天赋树后即会自动补全。</p>`',
    '`<b>No longer a talent</b>`': '`<b>已不再是天赋</b>`',
    '`<div class="n">${x.name}</div><div class="r">Classic talent, ${x.max} rank${x.max>1?\'s\':\'\'}</div><div class="d">${x.text}</div>`': '`<div class="n">${x.name}</div><div class="r">经典旧世天赋，${x.max} 点</div><div class="d">${x.text}</div>`',
    '`<div class="cl"><b>Baseline in Forever.</b> Every ${cls} learns it from the trainer now: it sits in the ${base.tab} tab of the ${sb.source === \'beta\' ? \'spellbook below\' : `level ${sb.level} demo spellbook${base.rank ? ` at ${base.rank}` : \'\'}`}.</div>`': '`<div class="cl"><b>在「永恒」中为职业技能。</b>现在每个 ${cls} 都可以从训练师处学习：它位于${sb.source === \'beta\' ? \'下方法术书\' : `等级 ${sb.level} 试玩法术书`}的 ${base.tab} 页签中${base.rank ? `（${base.rank}）` : \'\'}。</div>`',
    '`<div class="cl"><b>Not in Forever.</b> This talent was removed or folded into another one.</div>`': '`<div class="cl"><b>「永恒」中已无此天赋。</b>该天赋已被移除或并入其他天赋。</div>`',
    '`next row at ${next}`': '`下一行需 ${next} 点`',
    "'WoW Forever Talent Calculator | Talents Forever'": "'魔兽世界：永恒 天赋计算器 | 永恒天赋'",
    '`<span class="hint">No points spent. ${matchMedia(\'(hover: none)\').matches ? \'Tap\' : \'Click\'} a talent to start your build.</span>`': '`<span class="hint">尚未投入天赋点。${matchMedia(\'(hover: none)\').matches ? \'轻点\' : \'点击\'}一个天赋开始搭配你的方案。</span>`',
    '`${shown.length} of ${(allRanks ? t.spells : maxOnly(t.spells)).length} shown`': '`${shown.length} / ${(allRanks ? t.spells : maxOnly(t.spells)).length} 已显示`',
    "`${names} spell${names === 1 ? '' : 's'}, ${shown.length} ranks`": '`${names} 个法术，${shown.length} 个等级`',
    "`${shown.length} spell${shown.length === 1 ? '' : 's'}`": '`${shown.length} 个法术`',
    "' · small numbers: level each rank is learned at'": "' · 小数字：各等级的学习等级'",
    "' · small numbers: level each rank is trained at, your rank lit'": "' · 小数字：各等级的学习等级，当前等级高亮'",
    '`<li class="none">Nothing ${filt === \'new\' ? \'new\' : \'new or reworked\'} in this tab.</li>`': '`<li class="none">此页签中没有${filt === \'new\' ? \'新增\' : \'新增或重做\'}内容。</li>`',
    '`<label class="allr"><input type="checkbox" id="allRanks"${allRanks ? \' checked\' : \'\'}> Show all ranks</label>`': '`<label class="allr"><input type="checkbox" id="allRanks"${allRanks ? \' checked\' : \'\'}> 显示所有等级</label>`',
    '`<div class="bkctl"><div class="seg" role="group" aria-label="How to read it"><button type="button" data-view="book" aria-pressed="true">The book</button><button type="button" data-view="level" aria-pressed="false">By level</button></div><div class="seg filt" role="group" aria-label="Which spells"><button type="button" data-filt="all" aria-pressed="true">All</button><button type="button" data-filt="changed" aria-pressed="false">New and reworked</button><button type="button" data-filt="new" aria-pressed="false">New only</button></div></div>`': '`<div class="bkctl"><div class="seg" role="group" aria-label="阅读方式"><button type="button" data-view="book" aria-pressed="true">法术书</button><button type="button" data-view="level" aria-pressed="false">按等级</button></div><div class="seg filt" role="group" aria-label="筛选法术"><button type="button" data-filt="all" aria-pressed="true">全部</button><button type="button" data-filt="changed" aria-pressed="false">新增与重做</button><button type="button" data-filt="new" aria-pressed="false">仅新增</button></div></div>`',
    "'Comes with the talent'": "'随天赋获得'",
    "'Tome or quest'": "'书籍或任务'",
    "`${known} of ${all} learned by level ${myLv}${next ? ` · next at level ${next}` : ' · that is all of them'}`": "`${known} / ${all} 已在等级 ${myLv} 前学会${next ? ` · 下一项在等级 ${next}` : ' · 已全部列出'}`",
    '`<div class="lvhead"><label>I\'m level <b id="lvNum">${myLv}</b><input type="range" id="lvRange" min="1" max="60" value="${myLv}" aria-label="Your level"></label><span class="lvsum"></span></div>`': '`<div class="lvhead"><label>我的等级 <b id="lvNum">${myLv}</b><input type="range" id="lvRange" min="1" max="60" value="${myLv}" aria-label="你的等级"></label><span class="lvsum"></span></div>`',
    '`<p class="crs">Nothing ${filt === \'new\' ? \'new\' : \'new or reworked\'} for this class.</p>`': '`<p class="crs">该职业没有${filt === \'new\' ? \'新增\' : \'新增或重做\'}内容。</p>`',
    '`<div class="sttd muted">No tooltip read for this one yet.</div>`': '`<div class="sttd muted">尚未读取该法术的提示框。</div>`',
    '`<div class="sttl lv"><span>${esc(d.lv)} in Classic</span><span></span></div>`': '`<div class="sttl lv"><span>经典旧世中 ${esc(d.lv)}</span><span></span></div>`',
    '`<div class="sttl nt"><span>Racial spell: ${esc(onlyFor.join(\' and \'))} ${esc(c)}s only.</span><span></span></div>`': '`<div class="sttl nt"><span>种族法术：仅限 ${esc(onlyFor.join(\'、\'))} 的${esc(c)}。</span><span></span></div>`',
    "' Checked in game.'": "' 已在游戏中核对。'",
    '`<div class="sttl nt"><span>Classic called this ${esc(d.was)}. Same spell, new name.</span><span></span></div>`': '`<div class="sttl nt"><span>经典旧世中名为${esc(d.was)}。同一法术，改了名字。</span><span></span></div>`',
    '`<div class="cl"><b>Same as Classic.</b></div>`': '`<div class="cl"><b>与经典旧世相同。</b></div>`',
    '`<div class="stts ok">Forever text from the beta client, numbers at level 60 with no gear.</div>`': '`<div class="stts ok">「永恒」文本来自测试版客户端，数值为等级 60 且不穿装备。</div>`',
    '`<div class="stts ok">Real Forever text, read off BlizzCon demo footage${d.src ? \': \' + esc(d.src) : \'\'}</div>`': '`<div class="stts ok">真实的「永恒」文本，读取自暴雪嘉年华演示录像${d.src ? \'：\' + esc(d.src) : \'\'}</div>`',
    '`<div class="stts">Classic text${d.r && d.r !== sub ? \' (\' + esc(d.r) + \')\' : \'\'}, shown for reference. Nobody has read this one on Forever footage yet, so it may have changed.</div>`': '`<div class="stts">经典旧世文本${d.r && d.r !== sub ? \'（\' + esc(d.r) + \'）\' : \'\'}，仅作参考。尚未有人在「永恒」录像中读到过这一条，因此可能已有改动。</div>`',
    '`${shown} of ${total} races`': '`${shown} / ${total} 个种族`',
    '`<details class="legacy fold" id="${id}"${open?\' open\':\'\'}><summary>${fan(icons)}<span class="ltitle"><strong>${title}</strong><span>${sub}</span></span><span class="lpill"><span class="show">Show</span><span class="hide">Hide</span></span></summary>${body}</details>`': '`<details class="legacy fold" id="${id}"${open ? \' open\' : \'\'}><summary>${fan(icons)}<span class="ltitle"><strong>${title}</strong><span>${sub}</span></span><span class="lpill"><span class="show">展开</span><span class="hide">收起</span></span></summary>${body}</details>`',
    '`<p class="crs">Not opened on stream: ${sb.missing.join(\', \')}${sb.trainer ? \' (filled in from the trainer list where possible)\' : \'\'}.</p>`': '`<p class="crs">未在直播中打开：${sb.missing.join(\'、\')}${sb.trainer ? \'（已尽可能从训练师列表补全）\' : \'\'}。</p>`',
    '`<p class="crs"><b>Small numbers</b> under a spell are the level each rank is learned at.</p>`': '`<p class="crs"><b>小数字</b>是各等级的学习等级。</p>`',
    '`<p class="crs"><b>Small numbers</b> under a spell are the level each rank is trained at, your rank lit. A ? is a rank the trainer list didn\'t show. ${sb.levelsSource || \'\'}</p>`': '`<p class="crs"><b>小数字</b>是各等级的学习等级，当前等级高亮。问号表示训练师列表中未列出的等级。${sb.levelsSource || \'\'}</p>`',
    '`Most popular ${lead.name} build, #${b.rank} overall`': '`最热门的${lead.name}方案，总榜第 ${b.rank} 名`',
    '`#${b.rank} most popular ${cls} build`': '`最热门的 ${cls} 方案第 ${b.rank} 名`',
    '`<b>Top ${lead.name} build</b> · `': '`<b>最热门的${lead.name}方案</b> · `',
    '` · viewed ${b.views}`': '` · 浏览 ${b.views} 次`',
    '` · <b title="shares, saves and opens of every complete build within four points of this one">across ${b.variants + 1} close builds</b>`': '` · <b title="与该方案相差四点以内的所有完整方案，其分享、保存与打开次数之和">涵盖 ${b.variants + 1} 套相近方案</b>`',
    '`Popular ${cls} builds`': '`热门 ${cls} 方案`',
    '`What people planned here for level 60, ${mdy(pop.window || POPULAR.window)}.`': '`大家在站点上为 60 级规划出的方案，${mdy(pop.window || POPULAR.window)}。`',
    '`<div class="pophead"><span><b>${pop.builds.toLocaleString()}</b> ${pop.buildsLabel || \'builds shared, saved or opened\'}</span><span><b>${pop.full.toLocaleString()}</b> with all 51 points</span><span><b>${pop.shared.toLocaleString()}</b> shared</span><span><b>${pop.saved.toLocaleString()}</b> saved</span><span><b>${pop.opened.toLocaleString()}</b> build links opened</span></div>`': '`<div class="pophead"><span><b>${pop.builds.toLocaleString()}</b> ${pop.buildsLabel || \'次方案分享、保存或打开\'}</span><span><b>${pop.full.toLocaleString()}</b> 套点满 51 点</span><span><b>${pop.shared.toLocaleString()}</b> 次分享</span><span><b>${pop.saved.toLocaleString()}</b> 次保存</span><span><b>${pop.opened.toLocaleString()}</b> 次打开方案链接</span></div>`',
    '`${cls} spellbook at level ${sb.level}`': '`演示中 ${cls} 在等级 ${sb.level} 拥有的全部法术，按页签逐个列出，并标注等级。`',
    "`Every ${cls} trainer spell to 60, every rank. ${sb.checked ? 'Checked against the game files and in game.' : 'Checked against the game files.'}`": "`${cls} 训练师可教至 60 级的全部法术，每个等级。${sb.checked ? '已对照游戏文件并在游戏中核对。' : '已对照游戏文件核对。'}`",
    "'an ability a talent grants. It shows in your book once you take the talent'": "'天赋授予的技能。点出该天赋后就会出现在你的法术书里'",
    "'a Forever talent this character had taken, not a trainer spell'": "'该角色已点出的「永恒」天赋，而非训练师法术'",
    "`Numbers are the beta client's at level 60 with no gear on, so your in-game tooltip will read a bit higher. Show all ranks works like the checkbox in the game's book. The General tab still comes from the demo spellbook.`": '`数值为测试版客户端在等级 60 且不穿装备时的数据，因此游戏内提示框会略高一些。「显示所有等级」与游戏法术书中的勾选框用法一致。「通用」页签仍取自演示法术书。`',
    "`Read frame by frame off stream footage (${sb.seen}). Characters were capped at ${sb.level}, so anything trained later isn't here.`": '`逐帧读取自直播录像（${sb.seen}）。角色等级上限为 ${sb.level}，因此之后训练的内容不在此列。`',
    '`New ${cls} abilities`': '`新增 ${cls} 技能`',
    '`, ${ren.length} renamed`': '`，改名 ${ren.length} 项`',
    '`, ${gone.length} gone`': '`，移除 ${gone.length} 项`',
    '`${cls} racial spells`': '`${cls} 种族法术`',
    "'Other perks depend on this point'": "'其他专长依赖此点'",
    "'Other talents depend on this point'": "'其他天赋依赖此点'",
    '`<div class="gn">${t.name}<span>Rank ${r}/${t.max} · <b>${cls === \'Legacy\' ? Math.max(0, pool(cls) - totalPts(cls)) : $(\'#ptsLeft\').textContent}</b> left</span></div>`': '`<div class="gn">${t.name}<span>等级 ${r}/${t.max} · 剩余 <b>${cls === \'Legacy\' ? Math.max(0, pool(cls) - totalPts(cls)) : $(\'#ptsLeft\').textContent}</b></span></div>`',
    '`<div class="gx"><span class="lab">Next rank</span><span>${linkNames(nxt.text, cls, t.name, found)}</span></div>`': '`<div class="gx"><span class="lab">下一等级</span><span>${linkNames(nxt.text, cls, t.name, found)}</span></div>`',
    '`<div class="ge">Rank ${est.join(\' and \')} value${est.length>1?\'s\':\'\'} estimated from the rank shown in the video.</div>`': '`<div class="ge">等级 ${est.join(\'、\')} 的数值为依照录像所示等级推算的结果。</div>`',
    '`renamed from ${c.renamed}`': '`原名 ${c.renamed}`',
    '`was ${c.tree} row ${c.row}, col ${c.col}`': '`原为 ${c.tree} 第 ${c.row} 行第 ${c.col} 列`',
    "`was ${c.max} rank${c.max>1?'s':''}, now ${t.max}`": '`原为 ${c.max} 点，现为 ${t.max} 点`',
    '`<div class="cl"><b>Changed from Classic</b>${meta}<div class="diff"><span class="lab">Classic</span><div class="old">${d.oldH}</div><span class="lab">Forever</span><div class="new">${d.newH}</div></div></div>`': '`<div class="cl"><b>相较经典旧世有改动</b>${meta}<div class="diff"><span class="lab">经典旧世</span><div class="old">${d.oldH}</div><span class="lab">永恒</span><div class="new">${d.newH}</div></div></div>`',
    '`<div class="t">Classic rank 1: ${c.text}</div>`': '`<div class="t">经典旧世第 1 级：${c.text}</div>`',
    "'Tap a talent to add a point. Tap its − to take one back. Hold to read first.'": "'点击天赋加一点。轻点其「−」取回一点，长按可先看说明。'",
    "'<i>New in Forever</i> \\u00b7 '": "'永恒新增 ·'",
    "'Talent \\u00b7 '": "'天赋 ·'",
    "'Talent · '": "'天赋 ·'",
    '`<button type="button" class="refgo" data-ref="${n.replace(/"/g, \'&quot;\')}">Show it in the tree</button>`': '`<button type="button" class="refgo" data-ref="${n.replace(/"/g, \'&quot;\')}">在天赋树中显示</button>`',
    '`Rank ${r} of ${t.max}`': '`等级 ${r}/${t.max}`',
    '`<div class="est">Rank ${r} value estimated from the rank shown in the video.</div>`': '`<div class="est">等级 ${r} 的数值为依照录像所示等级推算的结果。</div>`',
    '`<div class="next">Next rank</div>`': '`<div class="next">下一等级</div>`',
    '`<div class="est">Rank ${r+1} value estimated from the rank shown in the video.</div>`': '`<div class="est">等级 ${r + 1} 的数值为依照录像所示等级推算的结果。</div>`',
    '`<div class="cta">Click to learn${r > 0 ? \'<small>Right-click to unlearn</small>\' : \'\'}</div>`': '`<div class="cta">点击学习${r > 0 ? \'<small>右键点击取消学习</small>\' : \'\'}</div>`',
    '`<div class="cta no">Max rank</div>`': '`<div class="cta no">已满级</div>`',
    '`<div class="hd"><div class="n">${t.name}</div><div class="r">Rank ${r}/${t.max}${t.passive ? \' · Passive\' : \'\'}${t.cost ? \' · \' + t.cost : \'\'}</div></div>`': '`<div class="hd"><div class="n">${t.name}</div><div class="r">等级 ${r}/${t.max}${t.passive ? \' · 被动\' : \'\'}${t.cost ? \' · \' + t.cost : \'\'}</div></div>`',
    '`<details class="nxd"><summary>Next rank</summary><div class="d">${nxt.text}</div></details>`': '`<details class="nxd"><summary>下一等级</summary><div class="d">${nxt.text}</div></details>`',
    '`<div class="est">Rank ${est.join(\' and \')} value${est.length>1?\'s\':\'\'} estimated from the rank shown in the video.</div>`': '`<div class="est">等级 ${est.join(\'、\')} 的数值为依照录像所示等级推算的结果。</div>`',
    '`<details class="cl nxd" open><summary><b>Changed from Classic</b></summary><div class="diff"><span class="lab">Classic</span><div class="old">${d.oldH}</div><span class="lab">Forever</span><div class="new">${d.newH}</div></div></details>`': '`<details class="cl nxd" open><summary><b>相较经典旧世有改动</b></summary><div class="diff"><span class="lab">经典旧世</span><div class="old">${d.oldH}</div><span class="lab">永恒</span><div class="new">${d.newH}</div></div></details>`',
    "`Tap a name to load it, × to remove it. Kept on this device only${list.length >= 400 ? `, ${list.length} of 500` : ''}. Back up copies them all as links.`": "`轻点名称即可载入，轻点 × 可移除。仅保存在本设备${list.length >= 400 ? `，${list.length} / 500` : ''}。备份会把它们全部复制为链接。`",
    "`My builds${list.length ? ` (${list.length})` : ''}`": "`我的方案${list.length ? `（${list.length}）` : ''}`",
    '`Loaded "${b.name}"`': '`已载入「${b.name}」`',
    "'500 builds saved on this device. Remove one to save another.'": "'本设备已保存 500 套方案。要再保存一套，请先移除一套。'",
    '`Replaced your ${state.cls} build "${name}"`': '`已替换你的 ${state.cls} 方案「${name}」`',
    '`Saved "${name}" on this device`': '`已在本设备保存「${name}」`',
    "`Copied ${store.get('tf_builds', []).length} builds as links. Paste them somewhere safe.`": "`已把 ${store.get('tf_builds', []).length} 套方案复制为链接。请粘贴到安全的地方。`",
    "`Added ${added} build${added === 1 ? '' : 's'}${full ? ', stopped at 500' : ''}`": "`已添加 ${added} 套方案${full ? '，已达 500 上限' : ''}`",
    '`Removed "${b.name}"`': '`已移除「${b.name}」`',
    '`Picked up your last ${cls} build. Reset clears it.`': '`已载入你上次的 ${cls} 方案。点击「重置」可清除。`',
    '\'Stream layout on. Grab "drag to move" to slide the page clear of your cam, "drag to resize" to shrink or grow it.\'': "'直播布局已开启。拖动「drag to move」把页面移开摄像头区域，拖动「drag to resize」缩小或放大页面。'",
    "'; (est) marks text estimated from a lower rank'": "'；（推算）标记的是依据较低等级推算出的文本'",
    "'Build copied with full talent text. Paste it into your AI with a question.'": "'已复制包含完整天赋文本的方案。粘贴到你的 AI 并附上问题即可。'",
    "`${spec ? spec.textContent : cls} build ${pts.join('/')} · Talents Forever`": "`${spec ? spec.textContent : cls} 方案 ${pts.join('/')} · 永恒天赋`",
    '`${cls} talents for WoW Forever · Talents Forever`': '`魔兽世界：永恒 ${cls} 天赋 · 永恒天赋`',
    '`<details class="bp-more"><summary>By class<small>${plural(e.counts.talents, \'talent change\')}${ns ? `, ${plural(ns, \'spell change\')}` : \'\'}</small></summary>${strip(e, id)}${byClass(e, id)}</details>`': '`<details class="bp-more"><summary>按职业<small>${plural(e.counts.talents, \'talent change\')}${ns ? `，${plural(ns, \'spell change\')}` : \'\'}</small></summary>${strip(e, id)}${byClass(e, id)}</details>`',
    '`<header class="bp-hero"><span class="eyebrow">Beta build tracker</span><h2>What\'s changed in WoW Forever</h2><p class="lede">Every beta build Blizzard ships gets checked against this site the day it lands. What each one changed, in plain words first, with every detail behind it.</p>`': '`<header class="bp-hero"><span class="eyebrow">测试版构建追踪</span><h2>魔兽世界：永恒 的改动</h2><p class="lede">暴雪发布的每个测试版构建，都会在当天与本站点核对。每个构建改了什么，先用白话说明，后面附上全部细节。</p>`',
    '`<span class="you">Since you were here (${nice(seen)}): ${fresh.length ? plural(fresh.length, \'build\') + \' checked, \' + (nfresh ? plural(nfresh, \'change\') : \'nothing changed\') : \'no new builds\'}.</span>`': '`<span class="you">自你上次访问以来（${nice(seen)}）：${fresh.length ? plural(fresh.length, \'build\') + \' 已核对，\' + (nfresh ? plural(nfresh, \'change\') : \'无变化\') : \'没有新构建\'}。</span>`',
    "'WoW Forever Beta Build Changes | Talents Forever'": "'魔兽世界：永恒 测试版构建改动 | 永恒天赋'",
    '`Viewing a shared ${state.cls} build. Tweak it, or hit Reset to start your own.`': '`正在查看一套分享的 ${state.cls} 方案。你可以直接修改，或点击「重置」从头开始。`',
    '`<div class="pact"${p.kind === \'link\' ? \' style="margin-top:12px"\' : \'\'}>${p.kind === \'link\' ? `<a class="pgo plink" href="${esc(p.href)}">${esc(p.cta || \'Open\')}</a>` : `<a class="pgo" href="${U(cls.toLowerCase())}#spellbook">Open the ${esc(cls)} spellbook</a>`}<button class="pmore" type="button">What\'s new</button><button class="poff" type="button">Don\'t show again</button></div>`': '`<div class="pact"${p.kind === \'link\' ? \' style="margin-top:12px"\' : \'\'}>${p.kind === \'link\' ? `<a class="pgo plink" href="${esc(p.href)}">${esc(p.cta || \'打开\')}</a>` : `<a class="pgo" href="${U(cls.toLowerCase())}#spellbook">打开${esc(CN(cls))}法术书</a>`}<button class="pmore" type="button">更新内容</button><button class="poff" type="button">不再显示</button></div>`',
    "'Max rank'": "'已满级'",
    "'all unlocked'": "'已全部解锁'",
    "'Nothing on the site changed.'": "'站点内容没有变化。'",
    "'new talent'": "'新增天赋'",
    "'rank cap'": "'等级上限'",
    "'No tree changes.'": "'天赋树无变化。'",
    "'rule changes'": "'规则调整'",
    "'read from the trainer list, not the spellbook'": "'读取自训练师列表，而非法术书'",
    "'Portal trainer'": "'传送门训练师'",
    "'Learned at'": "'学习等级'",
    "'Comes with the talent. No trainer sells it, taking the talent puts it in your book.'": "'随天赋获得。没有训练师出售，点出该天赋后就会出现在你的法术书里。'",
    "'Taught by a portal trainer, not the class trainer.'": "'由传送门训练师教授，而非职业训练师。'",
    "'Not sold by the class trainer. Comes from a tome, a quest or a drop.'": "'职业训练师不出售。来自书籍、任务或掉落。'",
    "'Scales with '": "'法强加成：'",
    "'Same spell, new numbers'": "'同一法术，数值调整'",
    "'Reworked since Classic'": "'相较经典旧世已重做'",
    "' · from a talent'": "' · 来自天赋'",
    "'New in Forever'": "'永恒新增'",
    "'Same as Classic'": "'与经典旧世相同'",
    "'Moved, same effect'": "'位置变动，效果相同'",
    "'Changed from Classic'": "'相较经典旧世有改动'",
    "'No unspent talent points'": "'没有未使用的天赋点'",
    "'Kept on this device. Come back any time and pick it up here.'": "'保存在本设备，随时回来都可以在这里取用。'",
    '\'<option value="" disabled>Nothing saved yet. Use Save this build below.</option>\'': "'尚未保存任何方案。请使用下方的「保存此方案」。'",
    "'Spend some points first'": "'请先投入一些点数'",
    "'Select all and copy'": "'请全选后复制'",
    "'No build links found in that text'": "'该文本中没有找到方案链接'",
    "'Stream layout off'": "'直播布局已关闭'",
    "'Link copied'": "'链接已复制'",
    "'Select and copy the link'": "'请选中并复制链接'",
    "'Could not copy'": "'复制失败'",
    "' on the site.'": "' 于站点。'",
    "'Nothing changed for players.'": "'玩家可见的内容没有变化。'",
    "`Replaces Classic's ${c.replaces.slice(0, -1).join(', ')} and ${c.replaces[c.replaces.length - 1]}, merged into one talent.`": "`取代经典旧世的 ${c.replaces.slice(0, -1).join('、')} 与 ${c.replaces[c.replaces.length - 1]}，合并为一个天赋。`",
    "'No Classic talent with this name.'": "'经典旧世没有同名天赋。'",
    "`${esc(a.arrow)}'s arrow now`": '`${esc(a.arrow)} 的箭头现在指向它`',
    '`taken by ${a.rate}% of ${who}`': '`${who}中 ${a.rate}% 都选了它`',
    '`${a.n} more in <b>${tn(a.ti, a.i)}</b> <small>the open ${esc(trees[a.ti].name)} talent most ${who} take, ${a.rate}%</small>`': '`${a.n} 点加在 <b>${tn(a.ti, a.i)}</b> <small>这是 ${esc(trees[a.ti].name)} 中${who}最常选的开放天赋，${a.rate}%</small>`',
    "`${f.left} point${f.left === 1 ? ' stays' : 's stay'} yours to place${f.noData ? ', nothing in the pick rates to place it by' : ''}.`": "`剩余 ${f.left} 点由你自由分配${f.noData ? '，没有选取率可供参考' : ''}。`",
    "`${b.pts === 1 ? 'goes' : 'go'} with the rest: it needs ${road.n} in ${tn(road.ti, road.i)} now, which ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}`": '`已并入其余点数：现在需要 ${road.n} 点在 ${tn(road.ti, road.i)}，而那里 ${road.rate ? `只有 ${road.rate}% 的${who}选了它` : `没有任何${who}选它`}`',
    "`would need ${need} more point${need === 1 ? '' : 's'} in ${esc(trees[b.ti].name)} first`": '`还需要先在 ${esc(trees[b.ti].name)} 中多投 ${need} 点`',
    "`would take ${short} more free point${short === 1 ? '' : 's'} than there ${short === 1 ? 'is' : 'are'}`": '`需要多出 ${short} 点自由点数，当前不够`',
    "`can't go back with what came back`": '`已回退的部分无法再退回`',
    '`ranks ${rs[0]} to ${rs[rs.length - 1]}`': '`等级 ${rs[0]} 至 ${rs[rs.length - 1]}`',
    '`is the new name of ${esc(r.before)}`': '`是 ${esc(r.before)} 的新名称`',
    '`is gone from the spellbook`': '`已从法术书中移除`',
    '`<del>${esc(o)}</del> is now <ins>${esc(n)}</ins>`': '`<del>${esc(o)}</del> 改为 <ins>${esc(n)}</ins>`',
    "' and reworded'": "'，措辞亦有调整'",
    "'a word changed'": "'措辞有改动'",
    '`<del>${esc(bare(P[0][0]))}</del> is now <ins>${esc(bare(P[0][1]))}</ins>`': '`<del>${esc(bare(P[0][0]))}</del> 改为 <ins>${esc(bare(P[0][1]))}</ins>`',
    '`<details class="wn"${open ? \' open\' : \'\'}><summary class="src file"><i><img class="sc" src="${ICON(\'inv_scroll_03\')}" alt="" width="18" height="18"></i><b>In the tooltip</b><span class="lpill"><span class="show">Show</span><span class="hide">Hide</span></span></summary>${textOf(r)}</details>`': '`<details class="wn"${open ? \' open\' : \'\'}><summary class="src file"><i><img class="sc" src="${ICON(\'inv_scroll_03\')}" alt="" width="18" height="18"></i><b>提示框文本</b><span class="lpill"><span class="show">展开</span><span class="hide">收起</span></span></summary>${textOf(r)}</details>`',
    "'Plays differently'": "'玩法有变'",
    '"Blizzard says it plays this way now. The tooltip doesn\'t say so."': '"暴雪称它现在的玩法就是这样，但提示框里没写。"',
    "'How it works'": "'机制说明'",
    "'How the game handles it, from Blizzard.'": "'来自暴雪，说明游戏里实际怎么处理。'",
    "'Blizzard fixed it in the game.'": "'已修复'",
    "'In a later build'": "'后续构建中'",
    '"In Blizzard\'s notes for this build, in the game files from a later build."': '"见暴雪对本构建的说明，实际存在于后续构建的游戏文件里。"',
    "'Known bugs'": "'已知问题'",
    '"On Blizzard\'s known issues list for this build."': '"在暴雪针对本构建公布的已知问题清单中。"',
    "'New talents'": "'新增天赋'",
    '"In Blizzard\'s notes, not in this build\'s game files yet."': '"见暴雪说明，但本构建的游戏文件里还没有。"',
    '"In Blizzard\'s notes for this build, in the game as server hotfixes and not in its files. The trees here carry them."': '"见暴雪对本构建的说明，已作为服务器热修上线，但不在其文件中。此处的天赋树已包含这些改动。"',
    "'plays differently'": "'玩法有变'",
    "'play differently'": "'玩法有变'",
    "'how it works'": "'机制说明'",
    "'in a later build'": "'后续构建中'",
    "'known bug'": "'已知问题'",
    "'known bugs'": "'已知问题'",
    "'not in the game files yet'": "'游戏文件中还没有'",
    "'in the game by hotfix'": "'已作为热修上线'",
    '` <small class="nlater">in build ${esc(bshort(o.b))}</small>`': '` <small class="nlater">在构建 ${esc(bshort(o.b))} 中</small>`',
    "'Not in the game files yet'": "'游戏文件中还没有'",
    "'In the game by hotfix'": "'已作为热修上线'",
    "'Every class'": "'全职业'",
    "'Leveling, items and the world'": "'练级、物品与世界'",
    '`<details class="ynotes"><summary><i class="bflag">${SVG.flag}</i><b>Blizzard\'s notes</b><small>not in a tooltip</small>${chips(all)}</summary>`': '`<details class="ynotes"><summary><i class="bflag">${SVG.flag}</i><b>暴雪说明</b><small>不在提示框里</small>${chips(all)}</summary>`',
    '`<div class="nevery"><p class="nev">Every class</p>${nbody(every, e.notes)}</div>`': '`<div class="nevery"><p class="nev">全职业</p>${nbody(every, e.notes)}</div>`',
    "'New or gone'": "'新增或移除'",
    "'In the trees'": "'天赋树中'",
    "' · cost line'": "' · 消耗行'",
    "'with talents added'": "'新增的天赋'",
    "'with talents removed'": "'移除的天赋'",
    "'with talents moved'": "'移动的天赋'",
    "'with talents under new rules'": "'规则变化的天赋'",
    "'with numbers changed'": "'数值有改动的'",
    "'with wording changed'": "'措辞有改动的'",
    "'new talents and spells'": "'新增的天赋与法术'",
    "'talents and spells taken out'": "'被移除的天赋与法术'",
    "'talents in a new row or tree'": "'换了行或换了天赋树的'",
    "'arrows, rank caps and tab names'": "'箭头、等级上限与页签名'",
    "'a number in the tooltip changed'": "'提示框里的数字变了'",
    "'the words changed, no number did'": "'只改了措辞，没动数字'",
    "'Icons only'": "'仅图标'",
    '`<button type="button" class="tile game" data-go="game"><span class="tk"><span class="tic logo" aria-hidden="true"><img src="/assets/wow-forever.png" alt=""></span>In the game${gameFresh ? \'<i class="dot"></i>\' : \'\'}</span><span class="tb">${gameBig}</span><span class="ts">${UPD0 ? `${matchMedia(\'(max-width:640px)\').matches ? \'\' : \'latest: \'}${esc(bname(UPD0.build))} · ${day(UPD0.date)}` : \'\'}</span>${bspark}</button>`': '`<button type="button" class="tile game" data-go="game"><span class="tk"><span class="tic logo" aria-hidden="true"><img src="/assets/wow-forever.png" alt=""></span>游戏内${gameFresh ? \'<i class="dot"></i>\' : \'\'}</span><span class="tb">${gameBig}</span><span class="ts">${UPD0 ? `${matchMedia(\'(max-width:640px)\').matches ? \'\' : \'最新：\'}${esc(bname(UPD0.build))} · ${day(UPD0.date)}` : \'\'}</span>${bspark}</button>`',
    '`<p class="pick lens-hint">Tap a class, a race or Legacy to see its changes</p>`': '`<p class="pick lens-hint">轻点某个职业、种族或传承，查看它的改动</p>`',
    '`${esc(p)} talent and spell`': '`${esc(p)}天赋与法术`',
    "'Legacy perk'": "'传承专长'",
    "`${n} change${n === 1 ? '' : 's'} in ${esc(bname(e.build))}${isCls ? ': ' + parts : ''}`": "`${n} 项变化于 ${esc(bname(e.build))}${isCls ? '：' + parts : ''}`",
    '`nothing changed in ${esc(bname(e.build))}`': '`${esc(bname(e.build))} 无变化`',
    '`Only the ${BWORD[kf]} rows are shown; clear the filter above for all of it.`': '`只显示「${BWORD[kf]}」的行；清掉上方筛选即可看全部。`',
    "`That's every ${what} ${esc(bname(e.build))} touched, compared with ${esc(bname(prev.build))}.`": '`这是 ${esc(bname(e.build))} 相比 ${esc(bname(prev.build))} 触及的全部${what}。`',
    '`Every ${what} reads the same as in ${esc(bname(prev.build))}.`': '`每一处${what}都与 ${esc(bname(prev.build))} 相同。`',
    '`Compared with what the BlizzCon demo showed; the spellbooks came whole with this build.`': '`与暴雪嘉年华演示版对比；法术书随本构建一并给出。`',
    '` <a class="more" href="#" data-lines="${esc(p)}">Every ${esc(p)} line &rsaquo;</a>`': '` <a class="more" href="#" data-lines="${esc(p)}">全部 ${esc(p)} 明细 &rsaquo;</a>`',
    "'in Legacy'": "'中传承专长'",
    "' for players'": "' 对玩家可见'",
    '`<div class="sum quiet"><div class="sumhead"><b>0</b><span>changes for players in ${esc(bname(e.build))}. Checked file by file.</span></div></div>`': '`<div class="sum quiet"><div class="sumhead"><b>0</b><span>${esc(bname(e.build))} 对玩家可见的变化。已逐文件核对。</span></div></div>`',
    '`<details class="deeper" id="gameNotes"><summary><span>Beyond the tooltips</span><small>${e.notes.lines.length} from Blizzard\'s notes</small></summary>${T.notes(e)}</details>`': '`<details class="deeper" id="gameNotes"><summary><span>提示框之外</span><small>${e.notes.lines.length} 条来自暴雪说明</small></summary>${T.notes(e)}</details>`',
    "'the Legacy tree'": "'传承天赋树'",
    '`<div class="sum quiet"><div class="sumhead"><b>0</b><span>changes for players in ${esc(bname(e.build))}. ${tot(e)} icon swap${tot(e) === 1 ? \'\' : \'s\'}, nothing that plays differently.</span></div></div>`': '`<div class="sum quiet"><div class="sumhead"><b>0</b><span>${esc(bname(e.build))} 对玩家可见的变化。${tot(e)} 处图标替换，没有影响玩法的改动。</span></div></div>`',
    '`<p class="whyold">The latest, ${esc(bname(UPD0.build))}, changed nothing for players. This is ${esc(bname(e.build))}, the last one that did.</p>`': '`<p class="whyold">最新的 ${esc(bname(UPD0.build))} 对玩家没有可见变化。最近一次有变化的是 ${esc(bname(e.build))}。</p>`',
    "`Beta client ${esc(e.build)}${prevB ? `, compared with ${esc(prevB.build)}` : ''}, read file by file.`": "`测试版客户端 ${esc(e.build)}${prevB ? `，对比 ${esc(prevB.build)}` : ''}，逐文件核对。`",
    '` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${T.SVG.flag}</i>Blizzard\'s notes for this build &rsaquo;</a>`': '` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${T.SVG.flag}</i>暴雪对本构建的说明 &rsaquo;</a>`',
    '`<details class="deeper" id="gameNotes"><summary><span>Beyond the tooltips</span><small>${nN} from Blizzard\'s notes</small></summary>${T.notes(e)}</details>`': '`<details class="deeper" id="gameNotes"><summary><span>提示框之外</span><small>${nN} 条来自暴雪说明</small></summary>${T.notes(e)}</details>`',
    "'Gone. It read:'": "'原文已移除：'",
    "'Reads now:'": "'现在为：'",
    "'Back to the full panels'": "'返回完整面板'",
    '`<div class="mh"><img src="/assets/book-round.png" alt=""><div><div class="mt">Get this by email</div><div class="ms">One email when a beta build moves the trees: what moved, your classes first, then a link to the rest.</div></div></div>`': '`<div class="mh"><img src="/assets/book-round.png" alt=""><div><div class="mt">用邮件接收更新</div><div class="ms">当测试版构建改动了天赋树时发一封邮件：改了什么、先看你的职业，然后附上其余内容的链接。</div></div></div>`',
    '`<form novalidate><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="Your email"><button type="submit">Send me the next one</button></form>`': '`<form novalidate><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="你的邮箱"><button type="submit">给我发下一封</button></form>`',
    '`<p class="mo" aria-live="polite"></p><p class="mf">One click in the first message confirms it, and the same link in every message stops it. A ticked class also gets one email when its guide is up. <a href="/privacy#alerts">How it\'s kept</a>.</p>`': '`<p class="mo" aria-live="polite"></p><p class="mf">第一封邮件里点一下即可确认，每封邮件里的同一个链接都可以退订。勾选的职业在其指南上线时也会收到一封邮件。<a href="/privacy#alerts">我们如何使用这些信息</a>。</p>`',
    "'That does not look like an email address.'": "'这看起来不像一个邮箱地址。'",
    "'Sending the link…'": "'正在发送链接…'",
    '`<b>Check your inbox.</b> One click on the link in it and you are set. Not there in a minute? Look in junk, and mark it not junk so the next one lands.`': '`<b>请查收邮件。</b>点一下邮件里的链接即可完成。一分钟内没收到？看看垃圾邮件，并把它标为「非垃圾邮件」，下一封才进得来。`',
    "'That did not go through. Try again in a minute.'": "'发送失败，请稍后再试。'",
    '`<b>${p.email}</b> is signed in, with news off. <a href="/account">Switch it on</a> and the next build alert comes to you.`': '`<b>${p.email}</b> 已登录，但订阅已关闭。<a href="/account">开启订阅</a>后，下一次构建更新就会发给你。`',
    "' at level '": "'，等级 '",
    "'next up'": "'接下来'",
    "'Classic trainer level'": "'经典旧世训练师等级'",
    '`<div class="cl"><b>New in Forever.</b> ${esc(d.cn ? d.cn.replace(/^New in Forever\\.\\s*/, \'\') : \'No Classic spell with this name and rank.\')}</div>`': '`<div class="cl"><b>永恒新增。</b> ${esc(d.cn ? d.cn.replace(/^New in Forever\\.\\s*/, \'\') : \'经典旧世没有同名同等级的法术。\')}</div>`',
    '`<div class="stts ok">Forever text as the server\'s hotfix of ${+hf[3]} ${[\'Jan\',\'Feb\',\'Mar\',\'Apr\',\'May\',\'Jun\',\'Jul\',\'Aug\',\'Sep\',\'Oct\',\'Nov\',\'Dec\'][+hf[2] - 1]} has it, read from the beta\'s hotfix cache by other readers and checked against Blizzard\'s notes; the client\'s files do not carry it. Numbers at level 60 with no gear.</div>`': '`<div class="stts ok">永恒版文本取自服务器 ${+hf[3]} 年 ${+hf[2]} 月的热修，由其他读者从测试版的热修缓存中读取，并与暴雪说明核对过；客户端的文件里没有这段。数值为 60 级、无装备时。</div>`',
    "'Almost everyone takes'": "'几乎人人都选'",
    "'Almost nobody takes'": "'几乎没人选'",
    "` ${pop.stale.toLocaleString()} complete build${pop.stale === 1 ? '' : 's'} from before the trees changed ${pop.stale === 1 ? 'is' : 'are'} left out, since the game would not take ${pop.stale === 1 ? 'it' : 'them'} now.`": '` 有 ${pop.stale.toLocaleString()} 套完整方案在天赋树改动之前就已生成，故被排除，因为游戏现在已不会接受它们。`',
    '` Racial spells are in the ${cls} racial spells fold.`': '` 种族法术在${CN(cls)}种族法术折叠区中。`',
    '`New or changed since Classic.`': '`经典旧世以来的新增或改动。`',
    '"the Dwarves\'"': '"矮人的"',
    "'Fear Ward'": "'Fear Ward'",
    '"the Undead\'s"': '"亡灵的"',
    "'Devouring Plague'": "'Devouring Plague'",
    '`<div class="h">${im ? `<img src="${im.src}" alt="">` : \'\'}<div><b>${s.dataset.name}</b><span>${s.dataset.lv ? \'Level \' + s.dataset.lv + \' · \' : \'\'}every ${cls}\'s now</span></div></div><div class="d">${s.dataset.tip}</div>`': '`<div class="h">${im ? `<img src="${im.src}" alt="">` : \'\'}<div><b>${s.dataset.name}</b><span>${s.dataset.lv ? \'等级 \' + s.dataset.lv + \' · \' : \'\'}现在每个${CN(cls)}都有</span></div></div><div class="d">${s.dataset.tip}</div>`',
    "'Close all'": "'全部收起'",
    "'Open all'": "'全部展开'",
    '`<b>${esc(r.talent)}</b> moved from ${esc(r.fromTree)} to ${esc(r.tree)}`': '`<b>${esc(r.talent)}</b> 从 ${esc(r.fromTree)} 移到 ${esc(r.tree)}`',
    '`<b>${esc(r.talent)}</b> moved from row ${r.fromRow} to row ${r.row}`': '`<b>${esc(r.talent)}</b> 从第 ${r.fromRow} 行移到第 ${r.row} 行`',
    '`<b>${esc(r.talent)}</b> now needs ${esc(r.req)} first`': '`<b>${esc(r.talent)}</b> 现在需要先点出 ${esc(r.req)}`',
    '`<b>${esc(r.talent)}</b> no longer needs ${esc(r.oldReq)}`': '`<b>${esc(r.talent)}</b> 不再需要 ${esc(r.oldReq)}`',
    '`<b>${esc(r.talent)}</b> is gone`': '`<b>${esc(r.talent)}</b> 已被移除`',
    "`<b>${esc(r.talent)}</b> took ${esc(r.before)}'s place`": '`<b>${esc(r.talent)}</b> 取代了 ${esc(r.before)}`',
    '`one of its points is back in your pool`': '`其中一点已退回你的点数池`',
    '`${s.n} of its points are back in your pool`': '`其中 ${s.n} 点已退回你的点数池`',
    "' The link you share from here will be the current one.'": "' 你从这里分享出去的链接将指向当前版本。'",
    "`${span(ent)} hotfixes to build ${esc(ent.build.replace(/ hotfixes$/, '').replace(/^1\\.60\\.1\\./, ''))}`": "`${span(ent)} 热修，对应于构建 ${esc(ent.build.replace(/ hotfixes$/, '').replace(/^1\\.60\\.1\\./, ''))}`",
    '`${when(ent.date)} beta build (${esc(ent.build)})`': '`${when(ent.date)} 测试版构建（${esc(ent.build)}）`',
    '`Made before the ${bname}, so ${its}.${share}`': '`生成于${bname}之前，所以${its}。${share}`',
    '`The trees have changed since it was made, so ${its}.${share}`': '`生成之后天赋树已改动，所以${its}。${share}`',
    '`gone from ${esc(t.tree)}`': '`已从 ${esc(t.tree)} 移除`',
    '`${a.n} in <b>${tn(a.ti, a.i)}</b> <small class="soft" style="margin:0">(${a.rate}% take it)</small>`': '`${a.n} 点加在 <b>${tn(a.ti, a.i)}</b> <small class="soft" style="margin:0">（${a.rate}% 的人选它）</small>`',
    "`<b>${tn(b.ti, b.i)}</b> stayed out, its road (${road.n} in ${tn(road.ti, road.i)}) is one ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}`": '`<b>${tn(b.ti, b.i)}</b> 被排除在外，它的前置（${road.n} 点在 ${tn(road.ti, road.i)}）${road.rate ? `只有 ${road.rate}% 的${who}选了它` : `没有任何${who}选它`}`',
    "`<b>${tn(b.ti, b.i)}</b> needs ${need ? `${need} more in ${esc(trees[b.ti].name)}` : short ? `${short} more free point${short === 1 ? '' : 's'}` : 'more in the tree'} first`": "`<b>${tn(b.ti, b.i)}</b> 需要先在${need ? `${esc(trees[b.ti].name)}中多投 ${need} 点` : short ? `多出 ${short} 点自由点数` : '天赋树中投入更多点数'}`",
    '`<div><h5>Filled in</h5><p>${s.n === 1 ? \'The point is\' : Math.min(f.used, s.n) === s.n ? `All ${s.n}` : `${Math.min(f.used, s.n)} of the ${s.n}`} placed${f.used > s.n ? ` (with ${f.used - s.n} of your free points on the arrows)` : \'\'}: ${list(went)}.${f.left > 0 ? ` ${f.left} still yours${f.noData ? \', nothing in the pick rates to place it by\' : \'\'}.` : \'\'}${cant.length ? ` ${list(cant)}.` : \'\'}</p>${same ? `<button class="un" type="button">Undo</button>` : \'\'}</div>`': '`<div><h5>已补上的点</h5><p>${s.n === 1 ? \'这一点\' : Math.min(f.used, s.n) === s.n ? `全部 ${s.n} 点` : `${s.n} 点中的 ${Math.min(f.used, s.n)} 点`}已分配${f.used > s.n ? `（其中 ${f.used - s.n} 点取自你在箭头上的自由点数）` : \'\'}：${list(went)}。${f.left > 0 ? ` 剩余 ${f.left} 点仍归你${f.noData ? \'，没有选取率可供参考\' : \'\'}。` : \'\'}${cant.length ? ` ${list(cant)}。` : \'\'}</p>${same ? `<button class="un" type="button">撤销</button>` : \'\'}</div>`',
    '`<p class="soft rg">Ringed in orange below; ${TOUCH ? \'tap\' : \'hover\'} one for why.</p>`': '`<p class="soft rg">下方以橙色圈出；${TOUCH ? \'轻点\' : \'悬停\'}可查看原因。</p>`',
    "'Puts the point back'": "'把这一点放回去'",
    '`Puts ${placed === s.n ? `all ${s.n}` : `${placed} of ${s.n}`} back`': '`放回 ${placed === s.n ? `全部 ${s.n} 点` : `${s.n} 点中的 ${placed} 点`}`',
    "`, ${f.left} stay${f.left === 1 ? 's' : ''} yours`": '`，其中 ${f.left} 点仍归你`',
    "`${tal(b).name} skipped: its road, ${road.n} in ${tn(road.ti, road.i)}, is one ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}`": '`${tal(b).name} 被跳过：它的前置（${road.n} 点在 ${tn(road.ti, road.i)}）${road.rate ? `只有 ${road.rate}% 的${who}选了它` : `没有任何${who}选它`}`',
    "`${tal(b).name} needs ${need ? `${need} more in ${DATA[cls].trees[b.ti].name}` : short ? `${short} more free point${short === 1 ? '' : 's'}` : 'more in the tree'} first`": "`${tal(b).name} 需要先在${need ? `${DATA[cls].trees[b.ti].name}中多投 ${need} 点` : short ? `多出 ${short} 点自由点数` : '天赋树中投入更多点数'}`",
    "`${tal(b).name} needs ${need || short ? (need || short) + ' more' : 'more'} first`": "`${tal(b).name} 还需要${need || short ? (need || short) + ' 点' : '更多点数'}`",
    "'out of reach'": "'无法触及'",
    "`${nSkip} talent${nSkip === 1 ? '' : 's'} skipped`": '`已跳过 ${nSkip} 个天赋`',
    '`${nFar} out of reach`': '`${nFar} 个无法触及`',
    '`${cameCol}<div><h5>Put them back</h5><p class="fitline" data-v="${esc(JSON.stringify(variants))}">${esc(variants[0])}</p><button class="go" type="button">Fill it in for me</button></div>`': '`${cameCol}<div><h5>把它们放回去</h5><p class="fitline" data-v="${esc(JSON.stringify(variants))}">${esc(variants[0])}</p><button class="go" type="button">帮我补上</button></div>`',
    '`${cameCol}${fitCol}<details class="more"><summary><span class="o">More</span><span class="c">Less</span></summary>${movedCol}${nearCol}</details>`': '`${cameCol}${fitCol}<details class="more"><summary><span class="o">更多</span><span class="c">收起</span></summary>${movedCol}${nearCol}</details>`',
    '`<button class="x" type="button" aria-label="Hide this note">&times;</button><h4><i aria-hidden="true"></i>This build is older than the trees</h4><p class="lead">${lead}</p>${body}`': '`<button class="x" type="button" aria-label="隐藏此说明">&times;</button><h4><i aria-hidden="true"></i>这套方案比当前天赋树更早</h4><p class="lead">${lead}</p>${body}`',
    '`<div class="gw">This build had ${w.pts} point${w.pts === 1 ? \'\' : \'s\'} here. ${w.why.replace(/ Talents$/, \'\')} now, so ${w.pts === 1 ? \'it is\' : \'they are\'} back in your pool.</div>`': '`<div class="gw">这套方案曾在此投入 ${w.pts} 点。现在${w.why.replace(/ Talents$/, \'\')}，所以这 ${w.pts} 点已退回你的点数池。</div>`',
    '`<div class="cl"><b>New in Forever.</b> ${replacesLine(c)}</div>`': '`<div class="cl"><b>永恒新增。</b> ${replacesLine(c)}</div>`',
    '`All ${N(pp.complete)} complete ${cls} builds`': '`全部 ${N(pp.complete)} 套完整的${CN(cls)}方案`',
    '`All complete ${cls} builds`': '`全部完整的${CN(cls)}方案`',
    '`The ${N(sn[t.name])} builds that lead in ${t.name}`': '`${t.name} 中最主流的 ${N(sn[t.name])} 套方案`',
    '`<b>${all}%</b> of ${cls} builds`': '`<b>${all}%</b> 的${CN(cls)}方案`',
    "`<b>${by[own][ti][i]}%</b> of ${own} builds${lead === own ? ' like yours' : ''}`": "`<b>${by[own][ti][i]}%</b> 的${own}方案${lead === own ? '，与你的相似' : ''}`",
    '`<b>${by[lead][ti][i]}%</b> of ${lead} builds like yours`': '`<b>${by[lead][ti][i]}%</b> 的${lead}方案与你的相似`',
    '`<div class="pk">Taken by ${parts.length > 2 ? parts.slice(0, -1).join(\', \') + \', and \' + parts[parts.length - 1] : parts.join(\' and \')}.</div>`': '`<div class="pk">选取比例：${parts.length > 2 ? parts.slice(0, -1).join(\'、\') + \'，以及 \' + parts[parts.length - 1] : parts.join(\' 和 \')}。</div>`',
    '`<div class="cl"><b>New in Forever.</b>${c.replaces ? \' \' + replacesLine(c) : \'\'}</div>`': '`<div class="cl"><b>永恒新增。</b>${c.replaces ? \' \' + replacesLine(c) : \'\'}</div>`',
    "`All ${total} talents and every one of their ranks come from the beta client's own data${hot.length ? `, except the ${hotList} trees, which carry the server's hotfixes as other readers logged them from the beta's hotfix cache, checked against Blizzard's notes` : ''}. Nothing is estimated.`": "`全部 ${total} 个天赋及其所有等级均来自测试版客户端自身的数据${hot.length ? `，但 ${hotList} 天赋树除外：它们承载的是服务器热修，由其他读者从测试版的热修缓存中读取，并与暴雪说明核对过` : ''}。没有任何估测。`",
    '` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${TRACK.SVG.flag}</i>Blizzard\'s notes for this build &rsaquo;</a>`': '` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${TRACK.SVG.flag}</i>暴雪对本构建的说明 &rsaquo;</a>`',
    "'spell change'": "'法术改动'",
    '`<details class="bp-more"><summary>Beyond the tooltips<small>${e.notes.lines.length} from Blizzard\'s notes</small></summary>${TRACK.notes(e)}</details>`': '`<details class="bp-more"><summary>提示框之外<small>${e.notes.lines.length} 条来自暴雪说明</small></summary>${TRACK.notes(e)}</details>`',
    '`${esc(f.spec)} builds`': '`${esc(f.spec)} 方案`',
    '`${cls} builds`': '`${CN(cls)} 方案`',
    "' reworded'": "' 措辞有调整'",
    "' refreshed'": "' 已刷新'",
    "' changed'": "' 已改动'",
    "' renamed'": "' 已改名'",
    "'flip through'": "'逐页翻阅'",
    "'tap to read'": "'轻点阅读'",
    "'tap to close'": "'轻点关闭'",
    "'No builds yet'": "'尚无方案'",
    "'No changes'": "'无改动'",
    "'the other '": "'其他 '",
}

# （短字面量已并入 IDX；这里留空占位）
FRAG = {
}

# 长模板里只改可见文字的局部替换（在 apply_ui 之后执行）
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
    ('b.innerHTML = `<img src="${ICON(DATA[c].icon)}" alt=""><span>${c}</span>`', 'b.innerHTML = `<img src="${ICON(DATA[c].icon)}" alt=""><span>${CN(c)}</span>`'),
    ('b.textContent.trim()===cls));', 'b.textContent.trim()===CN(cls)));'),
    ("$('#bannerName').textContent = cls;", "$('#bannerName').textContent = CN(cls);"),
    ("$('#raceCls').textContent = 'a ' + cls;", "$('#raceCls').textContent = CN(cls);"),
    ('`WoW Forever ${cls} Talent Calculator | Talents Forever`', '`魔兽世界：永恒 ${CN(cls)} 天赋计算器 | 永恒天赋`'),
    ('<span class="spec">${label} ${cls}</span>', '<span class="spec">${label} ${CN(cls)}</span>'),
    ('<span class="cn">${c}</span>', '<span class="cn">${CN(c)}</span>'),
    ('<b>${c}</b><small>${m.length}</small>', '<b>${CN(c)}</b><small>${m.length}</small>'),
    ('alt="${c}"></a>', 'alt="${CN(c)}"></a>'),
    ('big.map(([c, n]) => `${c} (${n})`)', 'big.map(([c, n]) => `${CN(c)} (${n})`)'),
    ('title="${c} spellbook"', 'title="${CN(c)} 法术书"'),
    ('a.textContent = `Open the ${fr.cls} book`;', 'a.textContent = `打开${CN(fr.cls)}法术书`;'),
    ('的${esc(c)}。', '的${esc(CN(c))}。'),
    ('isBeta ? `${cls} spellbook`', 'isBeta ? `${CN(cls)} 法术书`'),
    ('`新增 ${cls} 技能`', '`新增 ${CN(cls)} 技能`'),
    ("`${spec ? spec.textContent : cls} 方案 ${pts.join('/')} · 永恒天赋`", "`${spec ? spec.textContent : CN(cls)} 方案 ${pts.join('/')} · 永恒天赋`"),
    ('`魔兽世界：永恒 ${cls} 天赋 · 永恒天赋`', '`魔兽世界：永恒 ${CN(cls)} 天赋 · 永恒天赋`'),
    ('${i + 1} of ${n}', '第 ${i + 1} 页 / 共 ${n} 页'),
    ("WoW Forever ${cls} talent build: ${pts.join('/')} (${trees.map(t=>t.name).join(' / ')}), level ${state.level}, ${spent} points spent. Built on talentsforever.com; talent text comes from the WoW Forever beta client, so treat it as the beta build, not the final game.", "《魔兽世界：永恒》${CN(cls)} 天赋方案：${pts.join('/')}（${trees.map(t=>t.name).join(' / ')}），等级 ${state.level}，已投入 ${spent} 点。构建于 talentsforever.com；天赋文案取自《魔兽世界：永恒》测试版客户端，请以测试版为准，正式上线后可能仍有改动。"),
    ('lines.push(`${t.name} (${pts[ti]} points)`)', 'lines.push(`${t.name}（${pts[ti]} 点）`)'),
    ('`Notes: each line is the in-game tooltip at the rank chosen', '`说明：每一行都是所选等级下的游戏内提示框原文'),
    ("' (est)'", "'（推算）'"),
    ('<b>talent</b> tag = ', '<b>talent</b> 标记 = '),
    ("Every spell ${/^[AEIOU]/.test(sb.race) ? 'an' : 'a'} ${sb.race} ${cls} had at level ${sb.level} in the demo, tab by tab, with ranks.", '${sb.race}${CN(cls)} 在演示版等级 ${sb.level} 时拥有的全部法术，按页签排列，含每个等级。'),
    ("grp('Racials', '', e.racials)", "grp('种族天赋', '', e.racials)"),
    ("grp('Legacy', '', e.legacy)", "grp('传承专长', '', e.legacy)"),
    ("grp('Renamed', ren)", "grp('已改名', ren)"),
    ('<p class="pick">Beta builds</p>', '<p class="pick">测试版构建</p>'),
    ('aria-label="Beta builds, latest first"', 'aria-label="测试版构建，最新在前"'),
    ("<summary>Developers' notes</summary>", '<summary>开发者说明</summary>'),
    ('<b>Sources</b>', '<b>出处</b>'),
    (' Show pick rates on the trees</label>', ' 在天赋树上显示选择率</label>'),
    ('title="Popularity next to the #1 build"', 'title="相对第 1 名方案的热度"'),
    ('title="No icon yet: no build\'s game files carry this talent"', 'title="暂无图标：没有哪个构建的游戏文件包含这个天赋"'),
    ('title="This page on its own">Link to this &rsaquo;</a>', 'title="单独打开这一页">本页链接 &rsaquo;</a>'),
    ('<span>Latest: ${', '<span>最新：${'),
    ("Maxed: ${maxed.join(', ')}", "已满：${maxed.join('、')}"),
    ('<h4><b>From the trainer</b><small>level not read in game yet</small></h4>', '<h4><b>来自训练师</b><small>游戏内尚未读到等级</small></h4>'),
    ('>Open the full breakdown, build by build &rsaquo;</a>', '>查看逐版本完整明细 &rsaquo;</a>'),
    ('<h5>What people make now</h5>', '<h5>现在大家都怎么点</h5>'),
    ('The closest Popular build is ', '最接近的热门方案是 '),
    ('<h5>Put them back</h5>', '<h5>把它们加回来</h5>'),
    ('<h5>What the fill does</h5>', '<h5>自动填充会做什么</h5>'),
    ('>Fill it in for me</button>', '>帮我填好</button>'),
    ('<h5>What moved</h5>', '<h5>挪了位置的天赋</h5>'),
    ('<h5>What came back</h5>', '<h5>回归的天赋</h5>'),
    ('<small>Your classes</small>', '<small>你的职业</small>'),
    ('<span class="o">More</span><span class="c">Less</span>', '<span class="o">展开</span><span class="c">收起</span>'),
    ('>reader catch</i>', '>读者发现</i>'),
    ("<b>You're on the list</b> as ", '<b>你已在名单中</b>，邮箱 '),
    ('title="The level Classic\'s trainer taught it at; a Forever trainer visit will confirm it"', 'title="经典旧世训练师教授的等级；与《永恒》训练师确认后即可确定"'),
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
    ('<b>From your talents</b><small>when you spend the point</small>', '<b>来自你的天赋</b><small>当你投入该点天赋时</small>'),
    ('<b>Level ${L}</b>', '<b>等级 ${L}</b>'),
    ('<span class="hint">tap to read</span>', '<span class="hint">轻点阅读</span>'),
    ('Classic called it ${d.was}. Same spell, new name.', '经典旧世中名为 ${d.was}。同一法术，换了名字。'),
    ('title="${nice(days[i])}: ${n} update${n === 1 ? \'\' : \'s\'}"', 'title="${nice(days[i])}：${n} 条更新"'),
    ('<span class="lab">Next rank</span>', '<span class="lab">下一等级</span>'),
    ("'Page: https://talentsforever.com' + location.pathname + location.search + location.hash + '\\n\\nWhat I noticed:\\n'", "'页面：' + $('#shareLink').value + '\\n\\n我发现的问题：\\n'"),
    ("o.textContent = 'Level ' + l;", "o.textContent = '等级 ' + l;"),
    ('<h3>${fac}</h3>', '<h3>${CNFAC[String(fac).toLowerCase()] || fac}</h3>'),
    ("{name: 'General', spells: sb.general", "{name: '通用', spells: sb.general"),
    ("if(t.name === 'General'){", "if(t.name === '通用'){"),
    ("if(sub !== 'Passive' || !TRAINER_TAUGHT.has(n)", "if(sub !== '被动' || !TRAINER_TAUGHT.has(n)"),
    ("tab: 'Trainer', note:", "tab: '训练师', note:"),
    ('<small>Book &middot; ${bookPage} of ${bookPages}</small>', '<small>法术书 &middot; 第 ${bookPage} / ${bookPages} 页</small>'),
    ('&middot; ${page + 1} of ${pages}</b>', '&middot; 第 ${page + 1} / ${pages} 页</b>'),
    ("t.passive ? 'Passive' : ''", "t.passive ? '被动' : ''"),
    ("${short ? 'Builds' : ", "${short ? '方案' : "),
    ('>Load</a>', '>载入</a>'),
    ('`${tr.name}, row ${t.row}`', '`${tr.name}，第 ${t.row} 行`'),
    ('>Hold <kbd>${REFKEY}</kbd> to explain ', '>按住 <kbd>${REFKEY}</kbd> 可说明'),
    ("${rest === 1 ? 'name' : rest + ' names'}", "${rest === 1 ? '名称' : rest + ' 个名称'}"),
    ("} ${pts.join('/')} (level ${state.level}, ${spent} points)", "} 方案 ${pts.join('/')}（等级 ${state.level}，${spent} 点）"),
    ('现在每个 ${cls} 都可以从训练师处学习', '现在每个 ${CN(cls)} 都可以从训练师处学习'),
    ('最热门的 ${cls} 方案第 ${b.rank} 名', '最热门的 ${CN(cls)} 方案第 ${b.rank} 名'),
    ('热门 ${cls} 方案', '热门 ${CN(cls)} 方案'),
    ('${cls} 训练师可教至 60 级的全部法术', '${CN(cls)} 训练师可教至 60 级的全部法术'),
    ('${cls} 种族法术', '${CN(cls)} 种族法术'),
    ('已载入你上次的 ${cls} 方案。', '已载入你上次的 ${CN(cls)} 方案。'),
    ('${cls} ${split}', '${CN(cls)} ${split}'),
    ("where: `${cls} spell${rk ? ', ' + rk.toLowerCase() : ''}`", "where: `${CN(cls)} 法术${rk ? '（' + rk + '）' : ''}`"),
    ('打开${esc(f0.cls)}法术书', '打开${esc(CN(f0.cls))}法术书'),
    ('alt="${c}" title="${c}">', 'alt="${CN(c)}" title="${CN(c)}">'),
    ('<optgroup label="${c}">', '<optgroup label="${CN(c)}">'),
    ('<b>${c}</b><small>', '<b>${CN(c)}</b><small>'),
    ("row(r, 'Racial')", "row(r, '种族天赋')"),
    ("row(r, 'Legacy')", "row(r, '传承专长')"),
    ('<b>Racials.</b>', '<b>种族天赋。</b>'),
    ('<b>Legacy.</b>', '<b>传承专长。</b>'),
    ('<span class="lab">Before</span><img loading="lazy" src="${c.before}" alt="Before" ${mw(c.w)}><span class="lab a">After</span><img loading="lazy" src="${c.after}" alt="After" ${mw(c.w)}>', '<span class="lab">改动前</span><img loading="lazy" src="${c.before}" alt="改动前" ${mw(c.w)}><span class="lab a">改动后</span><img loading="lazy" src="${c.after}" alt="改动后" ${mw(c.w)}>'),
    ("playerN(UPD0)} change${playerN(UPD0) === 1 ? '' : 's'}", 'playerN(UPD0)} 项改动'),
    ("short = b => String(b).replace(/^1\\.60\\.1\\./, ''), bname = b => / hotfixes$/.test(b) ? `the ${short(b)}` : `build ${short(b)}`", "short = b => String(b).replace(/^1\\.60\\.1\\./, '').replace(/ hotfixes$/, ' 热修'), bname = b => / hotfixes$/.test(b) ? `${short(b)}` : `构建 ${short(b)}`"),
    ("pickRow('Class', clsItems, p, 'cls')", "pickRow('职业', clsItems, p, 'cls')"),
    ("pickRow(side, rs.filter(x => x && x.race).map(raceItem), p, 'inl')", "pickRow(CNFAC[String(side).toLowerCase()] || side, rs.filter(x => x && x.race).map(raceItem), p, 'inl')"),
    ("pickRow('Legacy',", "pickRow('传承专长',"),
    ("? 'rules' : BWORD[k]", "? '规则' : BWORD[k]"),
    ('(${BWORD[kf]} only)', '（仅${BWORD[kf]}）'),
    ('Builds within a few points of each other count as one, and the rows are ranked by how often people shared, saved or opened them.', '点数相近的方案会合并算作一个，排序依据是人们分享、保存或打开它的次数。'),
    (" Since the ${(d => { const [y,m,dd] = d.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + +dd; })(pop.epoch.date)} patch: ${pop.epoch.complete.toLocaleString()} complete ${cls} build${pop.epoch.complete === 1 ? '' : 's'} so far. At ${pop.epoch.need.toLocaleString()} this list will rank those alone.", " 自 ${(d => { const [y,m,dd] = d.split('-'); return `${+m} 月 ${+dd} 日`; })(pop.epoch.date)} 补丁以来：已完成 ${pop.epoch.complete.toLocaleString()} 套 ${CN(cls)} 方案。达到 ${pop.epoch.need.toLocaleString()} 套后，本列表将只对它们排名。"),
    ('${news.length} new in Forever', '${news.length} 项为《永恒》新增'),
    (". From the beta's game files, compared with Classic by spell id.", '。直接对比自测试服游戏文件，按法术 ID 与经典旧世逐一核对。'),
    ("const hotList = hot.length > 1 ? `${hot.slice(0, -1).join(', ')} and ${hot[hot.length - 1]}` : hot[0];", "const hotList = hot.length > 1 ? `${hot.slice(0, -1).map(CN).join('、')} 与 ${CN(hot[hot.length - 1])}` : CN(hot[0]);"),
    ("const day = d => nice(d).replace(/ \\d{4}$/, '')", "const day = d => { const [y,m,dd] = d.split('-'); return `${+m} 月 ${+dd} 日`; }"),
    ('<span class="lv">Lv ${start+k}</span>', '<span class="lv">${start+k} 级</span>'),
    ('title="Rank ${k + 1}', 'title="第 ${k + 1}'),
    ("cls.map(c => grp(c, T.cicon(c), T.classRows(e, c))).join('')", "cls.map(c => grp(CN(c), T.cicon(c), T.classRows(e, c))).join('')"),
]

# 需要限定上下文的替换（正则，最后执行）。
# 只动 plural(n, 'unit') 的第二个参数：同一串字面量在别处是事件名或分类名，
# 裸替换会把 addEventListener('change') / r.kind === 'icon' 一起改坏。
RE_S = [
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'build'", "\\1'个构建'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'change'", "\\1'项变化'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'talent\\ change'", "\\1'项天赋改动'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'arrow'", "\\1'个前置'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'tab'", "\\1'个页签'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'tooltip'", "\\1'处提示框'"),
    ("(plural\\([^()]*(?:\\([^()]*\\)[^()]*)*,\\s*)'icon'", "\\1'处图标'"),
    ('href="/(?=[a-z])([a-zA-Z0-9._/#-]*)"', 'href="https://talentsforever.com/\\1"'),
]


# ============================================================ 2. app 脚本的代码级补丁
def struct_s(PIXEL):
    return [
        # 职业中文名。v2 的代码整体重写过，不再有 dn() 一类的映射函数，
        # 而 CLASSES 是 TALENT_DATA 的英文键（也是 URL 里的那段），
        # 所以渲染层统一走 CN()，键本身保持英文不动。
        ("const DATA = window.TALENT_DATA, CLASSES = Object.keys(DATA);",
         "const DATA = window.TALENT_DATA, CLASSES = Object.keys(DATA);\n"
         "  const CNCLS = {Warrior: '战士', Paladin: '圣骑士', Hunter: '猎人', Rogue: '潜行者',"
         " Priest: '牧师', Shaman: '萨满祭司', Mage: '法师', Warlock: '术士', Druid: '德鲁伊'};\n"
         "  const CN = c => CNCLS[c] || c;\n"
         "  const CNFAC = {horde: '部落', alliance: '联盟'};"),
        # 离线路由：不写地址栏，分享链接指回线上站点
        ("const ENTRY_PATH = location.pathname.replace(/\\/$/, '');",
         "const ENTRY_PATH = '';\n"
         "const SITE_ORIGIN = '%s';\n"
         "try{ const __rs = history.replaceState.bind(history); history.replaceState = "
         "function(){ try{ return __rs.apply(history, arguments); }catch(e){ return; } }; }catch(e){}" % SITE),
        # 图标 / 背景图：改为从内联表取，取不到就给透明像素
        # 站内路径统一由 U(...) 拼出（站方改成这种写法，好让脚本里不再有以 '/' 开头的
        # 引号字符串，免得被爬虫当 URL 抓）。离线版让它直接指向线上站点。
        ("const U = (...parts) => ['', ...parts].join('/');",
         "const U = (...parts) => SITE_ORIGIN + ['', ...parts].join('/');"),
        ("const ICON = n => `/assets/icons/${n}.jpg?i=2`;",
         "const ICON = n => (window.__ICONS && window.__ICONS[n]) || '%s';" % PIXEL),
        ("const BG = id => `/assets/bg/${id}.jpg`;",
         "const BG = id => (window.__BGS && window.__BGS[id]) || '';"),
        # data URI 不会加载失败，重试逻辑只会把 data URI 弄坏
        ("window.iconRetry = function(img){ const n = (+img.dataset.try || 0) + 1; if(n > 2){ img.remove(); return; } img.dataset.try = n; const base = img.src.split('?')[0]; setTimeout(() => { img.src = base + '?r=' + n + '_' + Date.now(); }, 1500 * n); };",
         "window.iconRetry = function(img){ img.remove(); };"),
        # 分享链接：指向线上站点，而不是本地文件路径
        ("    if(location.pathname.startsWith('/index.html')) history.replaceState(null,'', location.pathname + '#' + encode());\n"
         "    else history.replaceState(null,'', spent > 0 ? '/' + encode() : (state.picked ? '/' + cls.toLowerCase() : (typeof sectionPath === 'string' && sectionPath) || '/'));\n"
         "    $('#shareLink').value = location.href;",
         "    $('#shareLink').value = SITE_ORIGIN + (spent > 0 ? '/' + encode() : (state.picked ? '/' + cls.toLowerCase() : '/'));"),
        # 中文名取前两字做缩写
        ("const abbrev = n => { const w = n.replace(/[^A-Za-z ]/g,'').split(/\\s+/).filter(Boolean); return w.length===1 ? w[0].slice(0,3) : w.slice(0,3).map(x=>x[0]).join(''); };",
         "const abbrev = n => { const s0 = String(n).replace(/\\s/g,''); "
         "if(/[\\u3400-\\u9fff]/.test(s0)) return s0.slice(0, 2); "
         "const w = n.replace(/[^A-Za-z ]/g,'').split(/\\s+/).filter(Boolean); "
         "return w.length===1 ? w[0].slice(0,3) : w.slice(0,3).map(x=>x[0]).join(''); };"),
        # 中文没有复数，去掉后缀
        ("const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;",
         "const plural = (n, w) => `${n} ${w}`;"),
        # 把若干分句拼成一句话：中文用顿号/逗号，不用 " and "
        ("const sentence = parts => parts.length === 1 ? parts[0] + '.' : "
         "parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] + '.';",
         "const sentence = parts => parts.length === 1 ? parts[0] + '。' : "
         "parts.slice(0, -1).join('、') + '，' + parts[parts.length - 1] + '。';"),
        # 日期：一律用「2026年9月19日」这种写法，而不是「19 9月 2026」
        ("return `${+dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`; }",
         "return `${y}年${+m}月${+dd}日`; }"),
        # 改动分类标签
        ("const KIND = {new: 'New', replaced: 'Replaced', renamed: 'Renamed', gone: 'Gone', moved: 'Moved', prereq: 'Arrow', ranks: 'Ranks', text: 'Text', icon: 'Icon', tree: 'Tab'};",
         "const KIND = {new: '新增', replaced: '替换', renamed: '改名', gone: '移除', moved: '移动', prereq: '前置', ranks: '等级', text: '文本', icon: '图标', tree: '页签'};"),
        ("BWORD = {added: 'added', removed: 'removed', moved: 'moved', rules: 'rule changes', numbers: 'numbers', wording: 'wording'};",
         "BWORD = {added: '新增', removed: '移除', moved: '移动', rules: '规则调整', numbers: '数值', wording: '措辞'};"),
        ("const TOPIC = {talents: ['Talents',",
         "const TOPIC = {talents: ['天赋',"),
        ("spells: ['Spells',", "spells: ['法术',"),
        ("builds: ['Builds',", "builds: ['方案',"),
        ("site: ['The site',", "site: ['站内其他',"),
        # 传承专长：按中文名查表
        ("LBG = {Adventure: 181, Resourcefulness: 381, Professions: 81}",
         "LBG = {'\\u5192\\u9669': 181, '\\u8db3\\u667a\\u591a\\u8c0b': 381, '\\u4e13\\u4e1a\\u6280\\u80fd': 81}"),
        ("t.name === 'Adventure'", "t.name === '\\u5192\\u9669'"),
        ("t.name === 'Talented'", "t.name === '\\u5929\\u8d4b\\u5f02\\u7980'"),
        # 展开 / 收起
        ("textContent = w ? 'Shrink' : 'Expand'", "textContent = w ? '\\u6536\\u7a84' : '\\u5c55\\u5f00'"),
        # 法术书改动徽标
        ("k === 'new' ? '<i class=\"chg new\">New</i>' : k === 'ren' ? '<i class=\"chg ren\">Renamed</i>' : k === 'rw' ? '<i class=\"chg rw\">Reworked</i>'",
         "k === 'new' ? '<i class=\"chg new\">\\u65b0\\u589e</i>' : k === 'ren' ? '<i class=\"chg ren\">\\u6539\\u540d</i>' : k === 'rw' ? '<i class=\"chg rw\">\\u91cd\\u505a</i>'"),
        # ---------- 离线路由：所有站内链接都不许导航 ----------
        # app:// 下点 <a href="/warrior/60/…"> 会去请求一个不存在的路径，协议处理器回 404 纯文本，
        # 应用页面直接被顶掉（实测：热门方案里的「载入」按钮，href="/warrior/60/…"）。
        # 策略：能页内完成的（载入方案、切职业看法术书）一律页内完成；
        # 其余站内页面一律指向线上站点，点开就是系统浏览器里的真实页面。
        ('href="/builds"', 'href="%s/builds"' % SITE),
        ("a.href = '/' + fr.cls.toLowerCase() + '#spellbook';",
         "a.href = SITE_ORIGIN + '/' + fr.cls.toLowerCase() + '#spellbook';"),
        # 职业导航：Ctrl/中键点击打开线上职业页，普通点击仍是页内切换
        ("b.href = '/' + c.toLowerCase();", "b.href = SITE_ORIGIN + '/' + c.toLowerCase();"),
        ("if(c !== state.cls) history.pushState(null, '', b.href);",
         "if(c !== state.cls){ try{ history.pushState(null, '', '/' + c.toLowerCase()); }catch(e){} }"),
        # 热门方案的「载入」：带 data-code，点它直接在页内解码
        ('<a class="load" href="${U(b.code)}">',
         '<a class="load" href="${U(b.code)}" data-code="${b.code}" '
         'title="直接在当前页面载入这套方案">'),
        # 上面的链接由这段委托处理器接住
        ("  addEventListener('hashchange', () => {",
         "  // ---------- 离线版：站内链接一律页内处理 ----------\n"
         "  document.addEventListener('click', ev => {\n"
         "    if(ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;\n"
         "    const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null; if(!a) return;\n"
         "    const code = a.getAttribute('data-code');\n"
         "    if(code){\n"
         "      ev.preventDefault(); decode(code); lv.value = state.level; sheetAt = null;\n"
         "      $('#sheet').hidden = true; render();\n"
         "      track('build_loaded', {class: state.cls, src: 'popular'});\n"
         "      toast('已载入这套热门方案，可以直接在天赋树上继续调整。', 3200);\n"
         "      return;\n"
         "    }\n"
         "    const href = a.getAttribute('href') || '';\n"
         "    if(href.slice(-10) === '#spellbook'){\n"
         "      const want = href.replace(/^.*\\//, '').split('#')[0].toLowerCase();\n"
         "      const target = CLASSES.find(x => x.toLowerCase() === want);\n"
         "      if(target){ ev.preventDefault(); window.__wantBook = true; goClass(target, 'spellbook_link'); }\n"
         "    }\n"
         "  });\n"
         "  addEventListener('hashchange', () => {"),
        ('href="/account">Your alerts</a>', 'href="%s/account">你的订阅</a>' % SITE),
        ("location.origin", "SITE_ORIGIN"),
        # 日期：mdy() 输出里的英文月份缩写换成「9月」这种写法
        ("mdy = w => String(w || '').replace(new RegExp(`(\\\\d{1,2}) to (\\\\d{1,2}) ${MON} (\\\\d{4})`), '$3 $1 to $2, $4').replace(new RegExp(`(\\\\d{1,2}) ${MON}\\\\b`, 'g'), '$2 $1').replace(new RegExp(`(${MON} \\\\d{1,2}(?: to ${MON} \\\\d{1,2})?) (\\\\d{4})`), '$1, $4');",
         "_mdy0 = w => String(w || '').replace(new RegExp(`(\\\\d{1,2}) to (\\\\d{1,2}) ${MON} (\\\\d{4})`), '$3 $1 to $2, $4').replace(new RegExp(`(\\\\d{1,2}) ${MON}\\\\b`, 'g'), '$2 $1').replace(new RegExp(`(${MON} \\\\d{1,2}(?: to ${MON} \\\\d{1,2})?) (\\\\d{4})`), '$1, $4'); const CNMON = {Jan:'1月',Feb:'2月',Mar:'3月',Apr:'4月',May:'5月',Jun:'6月',Jul:'7月',Aug:'8月',Sep:'9月',Oct:'10月',Nov:'11月',Dec:'12月'}, mdy = w => _mdy0(w).replace(/\x08(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\x08/g, m => CNMON[m]);"),
        # ---------- v5：两张「键是英文、值是界面文字」的小表 ----------
        # 种族复数表：键是 RACIALS 数据里的英文种族名，值才是界面上的字。
        ("const PL = {Orc: 'Orcs', Undead: 'Undead', Tauren: 'Tauren', Troll: 'Trolls', Human: 'Humans', Dwarf: 'Dwarves', 'Night Elf': 'Night Elves', Gnome: 'Gnomes'};",
         "const PL = {Orc: '兽人', Undead: '亡灵', Tauren: '牛头人', Troll: '巨魔', Human: '人类', Dwarf: '矮人', 'Night Elf': '暗夜精灵', Gnome: '侏儒'};"),
        # 训练师被动技能表：键要与数据里的中文法术名对齐，否则查不到、整行不显示。
        ("const TRAINER_PASSIVE = {Warrior: {Parry: [6, 'game'], 'Dual Wield': [20, 'classic']}, Rogue: {'Dual Wield': [10, 'classic'], Parry: [12, 'classic']}, Hunter: {Parry: [8, 'classic'], 'Dual Wield': [20, 'classic']}, Paladin: {Parry: [8, 'classic']}}, TRAINER_TAUGHT = new Set(['Dual Wield', 'Parry']);",
         "const TRAINER_PASSIVE = {Warrior: {'招架': [6, 'game'], '双武器': [20, 'classic']}, Rogue: {'双武器': [10, 'classic'], '招架': [12, 'classic']}, Hunter: {'招架': [8, 'classic'], '双武器': [20, 'classic']}, Paladin: {'招架': [8, 'classic']}}, TRAINER_TAUGHT = new Set(['双武器', '招架']);"),
    ]


# ============================================================ 3. 正文结构补丁
STRUCT_B = [
    ('<html lang="en">', '<html lang="zh-CN">'),
    ('<title>WoW Forever Talent Calculator | Talents Forever</title>',
     '<title>魔兽世界：永恒 天赋计算器</title>'),
    ('<meta name="description" content="Free WoW Forever talent calculator for all nine classes, '
     'with every talent and rank from the WoW Forever beta client. Plan a build, share it by link, '
     'check racials and compare every talent to Classic.">',
     '<meta name="description" content="九大职业的《魔兽世界：永恒》天赋计算器，'
     '每个天赋与等级均读取自测试版客户端。搭配方案、用链接分享、查看种族天赋，并与经典旧世逐条对比。">'),
    ('<meta property="og:title" content="WoW Forever talent calculator, all nine classes">',
     '<meta property="og:title" content="魔兽世界：永恒 天赋计算器 · 九大职业">'),
    ('<meta property="og:description" content="Plan a WoW Forever build for any of the nine classes, '
     'with every talent and rank straight from the beta client. Share it with a link, check the racials, '
     'and see what changed from Classic.">',
     '<meta property="og:description" content="为九大职业任意搭配《魔兽世界：永恒》方案，'
     '每个天赋与等级都直接读取自测试版客户端。用链接分享，查看种族天赋，对比经典旧世的变化。">'),
    ('<meta name="apple-mobile-web-app-title" content="Talents Forever">',
     '<meta name="apple-mobile-web-app-title" content="永恒天赋计算器">'),
    ('<meta property="og:site_name" content="Talents Forever">',
     '<meta property="og:site_name" content="永恒天赋计算器">'),
    ('<meta property="og:image:alt" content="Talents Forever, the WoW Forever talent calculator">',
     '<meta property="og:image:alt" content="永恒天赋计算器，魔兽世界：永恒的天赋计算器">'),

    # ---- v5 新增：masthead 的「回到职业」按钮 ----
    # 它是页面里**另一段独立的 <script>**（站方把「Back to Class 入口」拆出来自成一节），
    # 因此不在 `_v2app.js` 里 —— `_gen_ui2.py` 的 IDX 表只覆盖「最大的那段脚本」，
    # `_audit5/_audit6` 也只审计那一段，整块漏掉时界面会直接露出一个英文按钮
    # （右上角「Back to Class」+ 悬停提示 + 横幅里的「<职业> changes guide」）。
    # 顺带把它的站内链接补成绝对地址：`a.href='/guides'` 用 JS 赋值，
    # 离线时会解析成 file:///guides 或 app://talents/guides，不会命中 FORBID 里的 `href="/`。
    ('(function(){var ON=["mage","warlock"],N='
     '{"warrior":"Warrior","paladin":"Paladin","hunter":"Hunter","rogue":"Rogue","priest":"Priest",'
     '"shaman":"Shaman","mage":"Mage","warlock":"Warlock","druid":"Druid"}',
     '(function(){var SOF=\'%s\';var ON=["mage","warlock"],N='
     '{"warrior":"战士","paladin":"圣骑士","hunter":"猎人","rogue":"潜行者","priest":"牧师",'
     '"shaman":"萨满祭司","mage":"法师","warlock":"术士","druid":"德鲁伊"}' % SITE),
    ("a.href=live?'/'+k+'/'+'changes':'/guides#'+k;",
     "a.href=SOF+(live?'/'+k+'/'+'changes':'/guides#'+k);"),
    ("a.href='/guides';a.title='Back to Class: what changed for your class since Classic';",
     "a.href=SOF+'/guides';a.title='回到职业：自经典旧世以来，你的职业都改了什么';"),
    ("'<b>'+N[k]+' changes guide</b><span>since Classic</span>'",
     "'<b>'+N[k]+'改动指南</b><span>经典旧世以来</span>'"),
    ("'<b>'+N[k]+' changes guide</b><span>coming soon</span><em>tell me when</em>'",
     "'<b>'+N[k]+'改动指南</b><span>即将上线</span><em>上线时通知我</em>'"),
    ('<span class="gt">Back to Class</span>', '<span class="gt">回到职业</span>'),

    # ---- v5 新增：/lab/ 实验层的阶段标记 ----
    # 与早先删掉的 <link>/<script src="/lab/…"> 是同一套东西：给 <html> 挂一个
    # `lab-on-hub` 类、并置 `window.__tfStage=1`。产物里没有任何 CSS / JS 引用这两个值
    # （全文件只出现这一次），属于实验层被剥掉后留下的孤儿引导脚本，一并删掉。
    ('<script>window.__tfStage=1;document.documentElement.classList.add(\'lab-on-hub\')</script>', ''),
]

# ============================================================ 4. 正文整句替换
EXTRA_B = {
    # ---- 顶部拖动条 ----
    'title="Grab anywhere on this bar to move the page. Sideways or down, wherever your cam isn\'t.">&#10021; drag to move</span>':
        'title="拖动此栏任意位置即可移动页面，左右或向下，避开你的摄像头画面。">&#10021; 拖动以移动</span>',
    '<span class="dmid">Stream layout <small>&middot; position remembered on this browser &middot; <a href="#" id="dreset">reset</a></small></span>':
        '<span class="dmid">直播布局 <small>&middot; 位置由本浏览器记忆 &middot; <a href="#" id="dreset">重置</a></small></span>',
    'title="Drag to make the page wider or narrower">&#8596; drag to resize</span>':
        'title="拖动可让页面变宽或变窄">&#8596; 拖动以缩放</span>',

    '<span class="lpill"><span class="show">Show</span><span class="hide">Hide</span></span>':
        '<span class="lpill"><span class="show">展开</span><span class="hide">收起</span></span>',

    # ---- 品牌与标题 ----

    '<div class="mtext"><div class="brand">Talents Forever</div><h1 class="tag"><b>WoW Forever talent calculator</b>, talents from the beta client</h1></div>':
        '<div class="mtext"><div class="brand">永恒天赋计算器</div><h1 class="tag"><b>魔兽世界：永恒 天赋计算器</b> · 数据读取自测试版客户端</h1></div>',
    '>What\'s new<i class="dot" aria-hidden="true"></i></button>': '>更新内容<i class="dot" aria-hidden="true"></i></button>',

    # ---- 抽屉 ----
    '<aside class="drawer" id="logDrawer" hidden aria-label="What\'s new">':
        '<aside class="drawer" id="logDrawer" hidden aria-label="更新内容">',
    '<div class="dhead"><b>What\'s new</b><button class="x" id="logClose" type="button" aria-label="Close">':
        '<div class="dhead"><b>更新内容</b><button class="x" id="logClose" type="button" aria-label="关闭">',
    'title="Wider"><i>&lsaquo;</i><span>Expand</span></button>':
        'title="加宽"><i>&lsaquo;</i><span>展开</span></button>',

    # ---- 顶栏 ----
    '<nav class="classes" id="classes" aria-label="Class"></nav>':
        '<nav class="classes" id="classes" aria-label="职业"></nav>',
    '<label><span class="lvl-word">Level</span> <select id="level" aria-label="Level"></select></label>':
        '<label><span class="lvl-word">等级</span> <select id="level" aria-label="等级"></select></label>',
    '<button class="btn" id="reset">Reset</button>': '<button class="btn" id="reset">重置</button>',
    '<button class="btn" id="copy">Copy link</button>':
        '<button class="btn" id="copy">复制链接</button>',
    '<select id="loadBuild" aria-label="Load a saved build"><option value="">My builds</option></select>':
        '<select id="loadBuild" aria-label="载入已保存的方案"><option value="">我的方案</option></select>',
    'title="Streaming? Move and resize the page so your cam never covers a talent. Turns off on every visit; your position is remembered on this browser.">':
        'title="在直播？移动并缩放页面，让你的摄像头画面不会挡住天赋。每次访问都默认关闭；位置由本浏览器记忆。">',
    ' Stream layout</button>': ' 直播布局</button>',
    'title="Highlight what changed from the original Classic trees">Compare to Classic</button>':
        'title="高亮显示与经典旧世原始天赋树相比的改动">对比经典旧世</button>',

    # ---- 横幅 ----
    '<div class="bsite" aria-hidden="true"><span class="bs1">talentsforever.com</span><span class="bs2">WoW Forever talent calculator</span></div>':
        '<div class="bsite" aria-hidden="true"><span class="bs1">talentsforever.com</span><span class="bs2">魔兽世界：永恒 天赋计算器</span></div>',

    # ---- 状态行与图例 ----
    '<div class="status"><strong>Talents</strong><button class="btn sreset" id="reset2" type="button" title="Clear every point in this build and start over">&#8635; Reset build</button><div class="r"><b id="split">0/0/0</b><span class="left">Points left: <b id="ptsLeft">51</b></span><span class="lvl">Level needed: <b id="lvlneed">10</b></span></div></div>':
        '<div class="status"><strong>天赋</strong><button class="btn sreset" id="reset2" type="button" title="清空此方案的全部点数，重新开始">&#8635; 重置方案</button><div class="r"><b id="split">0/0/0</b><span class="left">剩余点数：<b id="ptsLeft">51</b></span><span class="lvl">需要等级：<b id="lvlneed">10</b></span></div></div>',
    '<div class="legend"><span><i style="background:#4ade80"></i>New in Forever</span><span><i style="background:#fbbf24"></i>Changed (text, ranks or position)</span><span><i style="background:#60a5fa"></i>Moved, same effect</span><span>Dimmed = unchanged from Classic</span><span>Classic text appears in each tooltip; removed Classic talents are listed under each tree.</span></div>':
        '<div class="legend"><span><i style="background:#4ade80"></i>永恒新增</span><span><i style="background:#fbbf24"></i>有改动（文本、等级或位置）</span><span><i style="background:#60a5fa"></i>位置变动，效果相同</span><span>变暗 = 与经典旧世相同</span><span>每个提示框内都列出经典旧世文本；已移除的经典天赋列在各天赋树下方。</span></div>',

    # ---- 升级顺序 ----

    # ---- 我的方案 / 分享 / 理论研究 ----
    '<section class="yours" id="yours" aria-label="Save and share this build">':
        '<section class="yours" id="yours" aria-label="保存并分享此方案">',
    '<div class="yrow"><span class="ylab">My builds</span><button class="btn primary" id="saveBuild">Save this build</button>':
        '<div class="yrow"><span class="ylab">我的方案</span><button class="btn primary" id="saveBuild">保存此方案</button>',
    'maxlength="40" aria-label="Build name" placeholder="Name this build">':
        'maxlength="40" aria-label="方案名称" placeholder="为此方案命名">',
    'id="bnameOk" type="button">Save</button>': 'id="bnameOk" type="button">保存</button>',
    'id="bnameNo" type="button">Cancel</button>': 'id="bnameNo" type="button">取消</button>',
    '<span class="bhint" id="buildHint">Kept on this device. Come back any time and pick it up here.</span>':
        '<span class="bhint" id="buildHint">保存在本设备，随时回来都可以在这里取用。</span>',
    'id="copyBuilds" type="button" hidden>Back up</button>':
        'id="copyBuilds" type="button" hidden>备份</button>',
    'id="addBuilds" type="button">Restore</button>': 'id="addBuilds" type="button">恢复</button>',
    'aria-label="Paste build links, one per line" placeholder="Paste your backup here, or any build links, one per line. A name before a link is kept: Deep Prot https://talentsforever.com/warrior/60/...">':
        'aria-label="粘贴方案链接，每行一条" placeholder="在此粘贴你的备份，或任意方案链接，每行一条。链接前面的名称会被保留：深防战 https://talentsforever.com/warrior/60/...">',
    'id="pasteOk" type="button">Add builds</button>': 'id="pasteOk" type="button">添加方案</button>',
    'id="pasteNo" type="button">Cancel</button>': 'id="pasteNo" type="button">取消</button>',
    '<span class="ylab">Share</span><input id="shareLink" readonly aria-label="Shareable link">':
        '<span class="ylab">分享</span><input id="shareLink" readonly aria-label="可分享的链接">',
    '<button class="btn" id="copy2">Copy link</button>':
        '<button class="btn" id="copy2">复制链接</button>',
    '<button class="btn" id="shareNative" hidden>Send to a friend</button>':
        '<button class="btn" id="shareNative" hidden>发送给朋友</button>',
    '<span class="ylab">Theorycraft</span>': '<span class="ylab">理论研究</span>',
    'alt="">Copy build for AI</button>': 'alt="">复制方案给 AI</button>',
    'title="This class as plain JSON: every talent at every rank, spellbook, tooltips, racials">Raw data</a>':
        'title="该职业的纯 JSON 数据：各等级天赋、法术书、提示框、种族天赋">原始数据</a>',

    # ---- 种族天赋 ----
    '<div class="rh"><strong>Racials</strong><label><input type="checkbox" id="allRaces"> Show races that can\'t be <span id="raceCls">this class</span></label>':
        '<div class="rh"><strong>种族天赋</strong><label><input type="checkbox" id="allRaces"> 显示不能选择<span id="raceCls">该职业</span>的种族</label>',

    # ---- 传承专长 ----
    '<span class="ltitle"><strong>Legacy perks</strong><span id="legacySub">27 account-wide perks, 16 points.</span></span>':
        '<span class="ltitle"><strong>传承专长</strong><span id="legacySub">27 个账号通用专长，共 16 点。</span></span>',

    # ---- 使用说明 ----
    '<span class="rk">0/5</span></span><small>open</small>': '<span class="rk">0/5</span></span><small>未学习</small>',
    '<span class="rk">3/5</span></span><small>learning</small>': '<span class="rk">3/5</span></span><small>学习中</small>',
    '<span class="rk">5/5</span></span><small>maxed</small>': '<span class="rk">5/5</span></span><small>已满</small>',
    '<span class="rk">0/3</span></span><small>locked</small>': '<span class="rk">0/3</span></span><small>锁定</small>',
    '<li class="desk"><b>Add a point</b> left-click. <b>Remove</b> right-click or <kbd>Shift</kbd>+click.</li>':
        '<li class="desk"><b>加点</b>：左键点击天赋。<b>取消</b>：右键点击，或按住 <kbd>Shift</kbd> 点击。</li>',
    '<li class="mob"><b>Tap</b> to read a talent, <b>tap again</b> to add a point, <b>hold</b> to remove one.</li>':
        '<li class="mob"><b>轻点</b>天赋查看说明，<b>再轻点</b>加一点，<b>长按</b>取消一点。</li>',
    '<li><b>Rows</b> open every 5 points in a tree. An <b>arrow</b> means the talent above has to be maxed first.</li>':
        '<li><b>行解锁</b>：与游戏一致，在天赋树中每投入 5 点解锁下一行。<b>箭头</b>表示必须先点满上方天赋。</li>',
    '<li><b>Level</b> sets your points: one per level from 10, so 51 at 60. <b>Level needed</b> tells you when the build is complete.</li>':
        '<li><b>等级</b>决定你的点数：从 10 级起每级 1 点，60 级共 51 点。<b>需要等级</b>告诉你这套方案什么时候能点完。</li>',
    '<li><b>Copy link</b> shares the exact build. <b>Save this build</b> keeps it on this device under My builds.</li>':
        '<li><b>复制链接</b>可分享完全相同的方案。<b>保存此方案</b>会把它保存在本设备的「我的方案」中。</li>',
    '<li><b>Compare to Classic</b> colours what is new, changed or moved since the original trees.</li>':
        '<li><b>对比经典旧世</b>会用颜色标出相对原始天赋树的新增、改动与位置变动。</li>',
    '<b>From the beta client</b>':
        '<b>来自测试版客户端</b>',
    '<div><b>Readers catch the rest</b><span>Corrections come in on Reddit and Discord, get checked against the beta client, and are credited in</span>':
        '<div><b>读者帮忙补全其余部分</b><span>Reddit 与 Discord 上收到的更正，都会与测试版客户端核对，并在</span>',
    'aria-controls="logDrawer">What\'s new<i aria-hidden="true"></i></button>':
        'aria-controls="logDrawer">更新内容<i aria-hidden="true"></i></button>',

    # ---- 关于 ----
    '<p><b>The beta runs until 21 October</b>, and the game launches 4 November. The site follows every beta build, and What\'s new lists what changed.</p>':
        '<p><b>测试版将持续到 10 月 21 日</b>，游戏将于 11 月 4 日正式上线。本站会跟进每一个测试版构建，「更新内容」中列出了所有改动。</p>',
    '<p class="fine">Calculators: <a href="/warrior">Warrior</a> · <a href="/paladin">Paladin</a> · <a href="/hunter">Hunter</a> · <a href="/rogue">Rogue</a> · <a href="/priest">Priest</a> · <a href="/shaman">Shaman</a> · <a href="/mage">Mage</a> · <a href="/warlock">Warlock</a> · <a href="/druid">Druid</a>.</p>':
        '<p class="fine">各职业计算器：<a href="/warrior">战士</a> &middot; <a href="/paladin">圣骑士</a> · <a href="/hunter">猎人</a> · <a href="/rogue">潜行者</a> · <a href="/priest">牧师</a> · <a href="/shaman">萨满祭司</a> · <a href="/mage">法师</a> · <a href="/warlock">术士</a> · <a href="/druid">德鲁伊</a>。</p>',
    '<p class="fine"><b>Raw data:</b> <a href="/data.json">talentsforever.com/data.json</a> has all of it as JSON. Use it however you like, <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a>, just credit the site with a link.</p>':
        '<p class="fine"><b>原始数据：</b><a href="/data.json">talentsforever.com/data.json</a> 以 JSON 形式包含全部数据。你可以随意使用，遵循 <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a> 协议，只需附上本站链接即可。</p>',
    '<p class="fine"><b>Made by Chris Baldwin.</b> If you enjoyed this, give me a follow on <a href="https://x.com/baldwinbuilds" target="_blank" rel="noopener" onclick="track(\'x_clicked\')">X, @baldwinbuilds</a>.</p>':
        '<p class="fine"><b>由 Chris Baldwin 制作。</b>如果你喜欢这个站点，欢迎在 <a href="https://x.com/baldwinbuilds" target="_blank" rel="noopener" onclick="track(\'x_clicked\')">X 上关注 @baldwinbuilds</a>。</p>',
    ' alt="" width="20" height="20">Featured in PC Gamer</a>: "a tremendous bit of work."</p>':
        ' alt="" width="20" height="20">PC Gamer 报道</a>：“非常了不起的工作。”</p>',

    # ---- 反馈卡 / 赞助卡 / 页脚 ----
    '<div class="ftext"><strong>Spotted something off?</strong><span>A wrong rank, a missing spell, or something you wish the site did. Reddit is the fastest way to reach me and I read all of it.</span></div>':
        '<div class="ftext"><strong>发现了问题？</strong><span>等级有误、法术缺失，或是你希望站点具备的某个功能。在 Reddit 上联系我是最快的途径，每一条我都会看。</span></div>',
    '" target="_blank" rel="noopener">Message on Reddit</a>':
        '" target="_blank" rel="noopener">在 Reddit 上留言</a>',
    '</svg>Contribute</a>': '</svg>赞助</a>',
    '<span class="fwm">Talents Forever</span><span class="fsub">WoW Forever talent calculator · open since BlizzCon 2026</span>':
        '<span class="fwm">永恒天赋计算器</span><span class="fsub">魔兽世界：永恒 天赋计算器 &middot; 自 2026 暴雪嘉年华起开放</span>',

    # ---- 底部抽屉按钮 ----
    '<button class="x" id="sheetClose" aria-label="Close">×</button>':
        '<button class="x" id="sheetClose" aria-label="关闭">×</button>',
    '<button class="rem" id="sheetRem">− Unlearn</button>':
        '<button class="rem" id="sheetRem">− 取消学习</button>',
    '<button class="add" id="sheetAdd">+ Learn</button>':
        '<button class="add" id="sheetAdd">＋ 学习</button>',

    # ---- v4 新壳新增的正文段落（键取自新 index.html，逐字节一致）----
    '<a class="gift addon" id="addonBtn" href="/ideas" title="The in-game addon is out. Get it on CurseForge, free."><span class="pico"><img src="/assets/icons/trade_engineering.jpg?i=2" alt="" width="28" height="28"></span><span class="gt">Get the in-game addon</span></a>':
        '<a class="gift addon" id="addonBtn" href="/ideas" title="游戏内插件已发布，可在 CurseForge 免费获取。"><span class="pico"><img src="/assets/icons/trade_engineering.jpg?i=2" alt="" width="28" height="28"></span><span class="gt">获取游戏内插件</span></a>',
    '<p class="dfoot">The in-game addon is out: <a href="/ideas">get it, and say what would help</a>. Spotted something off? <a id="logFeed" href="https://www.reddit.com/message/compose/?to=baldwinbuilds&amp;subject=Talents%20Forever" target="_blank" rel="noopener">Message me on Reddit</a>.</p>':
        '<p class="dfoot">游戏内插件已发布：<a href="/ideas">去获取，并说说你希望它有什么</a>。发现了问题？<a id="logFeed" href="https://www.reddit.com/message/compose/?to=baldwinbuilds&amp;subject=Talents%20Forever" target="_blank" rel="noopener">在 Reddit 上私信我</a>。</p>',
    '<span class="ltitle"><strong>Leveling order</strong><span>Your points, level by level.</span></span>':
        '<span class="ltitle"><strong>加点顺序</strong><span>你的每一点，逐级列出。</span></span>',
    '<span class="ltitle"><strong>How it works</strong></span>':
        '<span class="ltitle"><strong>使用说明</strong></span>',
    '<p class="crs">Source: the Forever beta client, build 1.60.1.70170. Positions, prerequisites, point gates and every rank\'s text are the client\'s; the rules will be checked in game.</p>':
        '<p class="crs">数据来源：《魔兽世界：永恒》测试版客户端，构建 1.60.1.70170。位置、前置条件、点数门槛以及每个等级的文本都取自客户端；规则将在游戏内核对。</p>',
    '<p class="fine">On this site: <a href="/racials">racials</a> · <a href="/abilities">new abilities</a> · <a href="/legacy">Legacy perks</a> · <a href="/talents">every talent in words</a> · <a href="/ideas">ideas and the addon</a> · <a href="/">calculator</a>.</p>':
        '<p class="fine">站内其他页面：<a href="/racials">种族天赋</a> · <a href="/abilities">新增技能</a> · <a href="/legacy">传承专长</a> · <a href="/talents">逐个天赋的文字说明</a> · <a href="/ideas">想法与插件</a> · <a href="/">计算器</a>。</p>',
    '<p class="fine">Fan-made. Not affiliated with Blizzard Entertainment. <a href="/about">About</a> &middot; <a href="/contact">Contact</a> &middot; <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a>.</p>':
        '<p class="fine">粉丝作品，与暴雪娱乐无隶属关系。<a href="/about">关于</a> &middot; <a href="/contact">联系</a> &middot; <a href="/terms">条款</a> &middot; <a href="/privacy">隐私</a>。</p>',
    '<span class="bubble"><strong>Time is money, friend.</strong><span>Free, built by one person. A coffee keeps the servers up and the Claude Code addiction fed.</span></span>':
        '<span class="bubble"><strong>时间就是金钱，朋友。</strong><span>免费使用，由一个人开发。一杯咖啡能让服务器继续运转。</span></span>',
    '<span class="bhint">This copies the build with every talent\'s full text, so you can paste it into an AI and ask it something.</span>':
        '<span class="bhint">这会把方案连同每个天赋的完整文本一起复制，方便你粘贴给 AI 提问。</span>',
    "<p><b>Talents, every rank, the racials and the Legacy perks come from the WoW Forever beta client</b>, build 1.60.1.70170, with the 1 to 2 Oct server hotfixes on the Warrior trees and three Warrior spells (Whirlwind, Bloodthirst and Berserker Rage): those are not in the client's files, so they were read from the beta's hotfix cache by other readers and checked against Blizzard's notes. The spellbooks come from the same files, every trainer spell to level 60. Icons and art are Blizzard's.</p>":
        '<p><b>天赋（含每个等级）、种族天赋与传承专长都来自《魔兽世界：永恒》测试版客户端</b>，构建 1.60.1.70170，并包含 10 月 1 日至 2 日针对战士天赋树与三个战士法术（旋风斩、嗜血、狂暴之怒）的服务器热修：这些内容不在客户端的文件里，而是由其他读者从测试版的热修缓存中读取，并与暴雪说明核对过。法术书来自同一批文件，包含训练师可教的全部 60 级法术。图标与美术素材版权归暴雪所有。</p>',
    '<p class="fine"><b>From the archive:</b> <a href="/wrapped">Pre-beta Wrapped</a>, the site\'s first week in numbers, before the beta opened.</p>':
        '<p class="fine"><b>存档回顾：</b><a href="/wrapped">测试版前回顾</a>，以数字回顾站点上线第一周，那时测试版还没开放。</p>',

    # ---- v5 新壳新增 ----
    '<button class="btn" id="prBtn" aria-pressed="false" title="Show on every talent how many complete builds made here take it. Green is 60% or more, grey under 15%. The icons pick which builds are counted: all of the class, or the builds that lead in one tree.">Pick rates</button>':
        '<button class="btn" id="prBtn" aria-pressed="false" title="在每个天赋上显示：这里生成的完整方案中有多少选了它。绿色为 60% 及以上，灰色低于 15%。图标用于选择计入的方案：整个职业，或在某一天赋树中最主流的方案。">选取率</button>',
    '<span class="prset" id="prset" role="group" aria-label="Which builds are counted">':
        '<span class="prset" id="prset" role="group" aria-label="计入哪些方案">',
    '<button type="button" class="btn raceall" id="raceAll" hidden>Open all</button>':
        '<button type="button" class="btn raceall" id="raceAll" hidden>全部展开</button>',
    'title="Copies this build with every talent\'s full text, for pasting into an AI"><img class="tcico"':
        'title="会把方案连同每个天赋的完整文本一起复制，方便粘贴给 AI"><img class="tcico"',

    # ---- 站点把页眉/页脚的装饰图换成了 /lab/ 实验层的 webp（离线没有），改回本地已有的图 ----
    '<img class="mbook" src="/lab/assets/book-108.webp" srcset="/lab/assets/book-108.webp 2x, /lab/assets/book-162.webp 3x" alt="" width="54" height="54">':
        '<img class="mbook" src="/assets/book-round.png" alt="" width="54" height="54">',
    '<div class="fbrand"><img src="/lab/assets/book-108.webp" alt="" width="40" height="40">':
        '<div class="fbrand"><img src="/assets/book-round.png" alt="" width="40" height="40">',

}


# ============================================================ 5. 正文正则补丁
# 正文里有十几条写死的站内链接（职业页、种族天赋、新增技能、传承专长、想法与插件、
# 原始数据、隐私政策……）。离线打开时 href="/warrior" 会被解析到 app:// 或文件系统根目录，
# 一律指向线上站点，点开就是系统浏览器里的真实页面。
RE_B = [
    # href="/warrior" ~ href="/druid"、/racials、/abilities、/legacy、/ideas、/wrapped、
    # /privacy、/data.json、/data/warrior.json 之类
    (r'href="/([a-z][a-z0-9._/-]*)"', r'href="%s/\1"' % SITE),
    (r'href="/"', r'href="%s/"' % SITE),
]


def _load_ui():
    """IDX / FRAG 展开成 {原文: 译文}，原文与源码逐字节一致。"""
    ui = dict(IDX)
    for en, zh in FRAG.items():
        ui[en] = zh
    return ui


# 与 build_html.py 的 import 对齐
extra_s = list(EXTRA_S)

UI = _load_ui()
