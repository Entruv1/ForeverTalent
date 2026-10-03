# -*- coding: utf-8 -*-
"""数字对账：保证中文译文里的数字挂在「和英文同一个单位」上。

背景
----
第一轮自动解析里有一道「Wowhead 数字搬运」——把旧译文的数字按**位置**换成新数字。
只要中英文把数字排在不同位置（几乎总是如此），结果就是数字换错了单位：

    英文  causing 108 Shadow damage over 18 sec
    中文  在108秒内造成18点暗影伤害      <- 108 和 18 互换了

这类错误语法通顺、数值也在合理范围，肉眼与「有没有汉字」的判据都抓不到，
只有把数字连它后面的单位一起比才看得出来。

为什么必须带子类
----------------
中英的从句顺序常常相反，光按单位类别比会「修坏」本来正确的句子：

    英文  every 5 seconds for 20 sec      （间隔在前、持续在后）
    中文  在20秒内每5秒                     （持续在前、间隔在后）

所以时间单位再分「间隔(every/per)」「持续(for/over/lasts)」两个子类，
两边各归各的，才不会把 5 和 20 对调。

本模块提供
----------
`classes(text, lang)`  —— 抽出每个数字 + 它挂的单位类别 / 子类
`audit_pair(en, zh)`   —— 只报告不修改，返回问题列表
`fix_pair(en, zh)`     —— 在**安全条件**下换回正确数字，返回新中文

安全条件（必须同时满足，否则一个字都不改）
------------------------------------------
1. 中文与英文的**数字多重集完全相同** —— 只允许重排，不允许凭空造数；
2. 只有「该类在两侧都**恰好一个**数字」时才动手 —— 一个类别里有两个以上数字时，
   中英文的先后顺序没有保证，任何按位置配对都可能把对的改错。

搬不动的情况原样返回，交给人工补译表处理。
"""
import re
import difflib
import collections

# 千分位要整体吃掉：否则 "1,330" 会被拆成 1 和 330 两个数，
# 两个配对又可能写到同一个位置上（"在1秒内消耗自身330,15点生命值"就是这么崩的）。
NUM = re.compile(r'\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d*\.?\d+')

# ---------------------------------------------------------------- 英文
EN_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
EN_UNIT = {
    'sec': 'SEC', 'secs': 'SEC', 'second': 'SEC', 'seconds': 'SEC',
    'min': 'MIN', 'mins': 'MIN', 'minute': 'MIN', 'minutes': 'MIN',
    'hr': 'HOUR', 'hrs': 'HOUR', 'hour': 'HOUR', 'hours': 'HOUR',
    'yd': 'YARD', 'yds': 'YARD', 'yard': 'YARD', 'yards': 'YARD',
    'mana': 'MANA', 'rage': 'RAGE', 'health': 'HEALTH', 'damage': 'DAMAGE',
    'level': 'LEVEL', 'levels': 'LEVEL',
    'time': 'TIMES', 'times': 'TIMES',
    'stack': 'STACK', 'stacks': 'STACK',
    # charges 单独成类，别并进 STACK：中文「60次充能」往后扫时先命中「次」(TIMES)，
    # 若英文给 STACK 就会报「同值不同单位」的假指纹（v3 毒药条目一次冒 31 条）。
    'charge': 'CHARGE', 'charges': 'CHARGE',
    'point': 'POINT', 'points': 'POINT',
    'energy': 'ENERGY', 'armor': 'ARMOR', 'armour': 'ARMOR',
    'resistance': 'RESIST', 'resistances': 'RESIST',
    'threat': 'THREAT',
}
# HTML 注释标记。里面的数字是机读数据，不参与对账，也不能改写。
_MARK = re.compile(r'<!--.*?-->|<\\u0021--.*?-->', re.S)

TIME_SUB = {'SEC', 'MIN'}
# 同义单位：英文治疗类法术常写 "Heals the target of 408 damage"，
# 中文写「恢复408点生命值」——数值挂的是同一个概念，比对上要当作一类。
# CHARGE 单独立类是为了抢在「次」(TIMES) 前面命中中文的「N次充能」，
# 但英文的 "charges" 在中文里也被写成「N层」（"Each block expends a charge. 4 charges."
# →「每次格挡消耗一层效果。共4层。」），所以比对上要把 CHARGE 并回 STACK，
# 否则每条带层数的圣盾类文案都会报一条 en=CHARGE zh=STACK 的假指纹
# （2026-10-03 就是它把指纹从 50 顶到 51，卡住构建）。
EQ = {'HEALTH': 'DAMAGE', 'ARMOUR': 'ARMOR', 'CHARGE': 'STACK'}
# 数字前面出现这些词 -> 间隔；出现这些词 -> 持续
EN_BEFORE_I = {'every', 'per', 'each'}
EN_BEFORE_D = {'for', 'over', 'within', 'lasts', 'lasting', 'during', 'after'}
# 速率：数字后紧跟 "a second / a minute"。注意只认 a/an —— "every 5 sec" 是**间隔**
# 不是速率，那个走 EN_BEFORE_I，别在这里抢。
_EN_RATE = re.compile(r'\s*a(?:n)?\s+(?:sec|secs|second|seconds|min|mins|minute|minutes)\b', re.I)
# 允许插在数字与单位之间的词（不会自己当单位的形容词/冠词/介词/伤害学派）。
# 刻意收窄 —— 每多一个词就多一份「把 A 的数当成 B 的单位」的风险：
# 例如 'by' 会让 "Rank 3 by level 38" 的 3 误判成 LEVEL，"by up to 3 damage" 同理。
EN_MOD = {
    'shadow', 'holy', 'fire', 'frost', 'nature', 'arcane', 'physical',
    'magical', 'magic', 'melee', 'ranged', 'weapon',
    'additional', 'extra', 'total', 'combined', 'bonus',
    'increased', 'decreased', 'reduced', 'maximum', 'minimum', 'max',
    'of', 'the', 'a', 'an', 'his', 'her', 'their', 'your', 'its',
}

# ---------------------------------------------------------------- 中文
# 单位名词前允许 0~3 个汉字（点 / 点暗影 / 点额外 / 总值 …）。
# 标点不在 \u4e00-\u9fff 里，天然成为截断点，所以放宽到 3 个仍然安全。
def _z(*names):
    return re.compile(r'\s*(?:[\u4e00-\u9fff]{0,3})?(?:%s)' % '|'.join(names))

ZH_A = [
    ('PCT',    re.compile(r'\s*%')),
    ('SEC',    _z('秒')),
    ('MIN',    _z('分钟')),
    ('HOUR',   _z('小时')),
    ('YARD',   _z('码')),
    ('MANA',   _z('法力')),
    ('RAGE',   _z('怒气')),
    ('ENERGY', _z('能量')),
    ('HEALTH', _z('生命')),
    ('ARMOR',  _z('护甲')),
    ('RESIST', _z('抗性')),
    ('THREAT', _z('威胁')),
    ('DAMAGE', _z('伤害')),
    ('LEVEL',  _z('级')),
    # 「充能」要排在「次」前面：中文「60次充能」两者都能匹配，语义单位是 CHARGE。
    ('CHARGE', _z('充能')),
    ('TIMES',  _z('次')),
    ('STACK',  _z('层')),
    ('POINT',  re.compile(r'\s*点')),
]


def _en_cls(text, m):
    """英文里数字 m 挂的单位。往后逐词扫：命中单位就用，遇修饰词继续，否则放弃。

    "112 to 130 Arcane damage" 这种区间，区间起点自己没有单位，
    就借终点的单位（"to" 后面紧跟数字时跳过终点继续看）。
    """
    # 「N a second / a minute」是**速率**写法（"drains 1.25 a second"），
    # 中文写「每秒流失 1.25 点」——数字在英文侧挂时间、在中文侧挂「点」。
    # 两侧一起归 RATE，否则每来一条速率文案就多一条 en=SEC zh=POINT 的假指纹。
    if _EN_RATE.match(text, m.end()):
        return 'RATE'
    t = m.end()
    for _ in range(4):
        while t < len(text) and text[t] in ' \t':
            t += 1
        if t < len(text) and text[t] == '%':
            return 'PCT'
        # 区间起点：跳过 "to 130" 里的终点数字
        low_rest = text[t:t + 3].lower()
        if low_rest.startswith('to '):
            t += 3
            while t < len(text) and text[t] in ' \t':
                t += 1
            d = NUM.match(text, t)
            if d:
                t = d.end()
                continue
        w = EN_WORD.match(text, t)
        if not w:
            return None
        low = w.group(0).lower().strip("'")
        if low in EN_UNIT:
            cls = EN_UNIT[low]
            if cls not in TIME_SUB:
                return cls
            prev = EN_WORD.findall(text[:m.start()])
            prev = prev[-1].lower() if prev else ''
            if prev in EN_BEFORE_I:
                return cls + '_I'
            if prev in EN_BEFORE_D:
                return cls + '_D'
            return cls
        if low in EN_MOD:
            t = w.end()
            continue
        return None
    return None


# 中文常把单位写在数字**前面**：「生命值为 5 的石肤图腾」「法力值为 120 的…」。
# 只往数字后面找单位会让这个 5 变成「无单位」，掉进零头池后按位置错配，
# 把本来正确的「降低 16 点」改成「降低 5 点」（石肤图腾族就这么被改坏的）。
_ZH_BEFORE = re.compile(r'(生命|法力|怒气|能量|护甲|威胁)值?\s*(?:为|是|达)$')
_ZH_BEFORE_CLS = {'生命': 'HEALTH', '法力': 'MANA', '怒气': 'RAGE',
                  '能量': 'ENERGY', '护甲': 'ARMOR', '威胁': 'THREAT'}
# 速率：「每秒 N 点」= 英文的 "N a second"。只认「每」后面**直接**跟时间词（不夹数字）——
# 「每 0.1 秒回复 1 点」里的 1 是数值不是间隔，夹了数字就不算，那个 0.1 由 EN_BEFORE_I 管。
# 末尾的 \s* 让「（每分钟 75 点）」也能命中。
_ZH_RATE_PRE = re.compile(r'每(?:秒|分钟|分)\s*[^，。；、！？）)]{0,6}$')


def _zh_cls(text, m):
    # 先往前看：「生命值为 5 的…」「法力值为 120 的…」—— 单位写在数字前面。
    # 「X值为/为 N」是无歧义的系表结构，比往后扫可靠得多：往后扫为了兼容
    # 「点暗影伤害」这类写法允许跨 0~3 个汉字，于是「生命值为 5 的火焰抗性图腾」
    # 会把「的火焰」吃掉、命中「抗性」，把 5 当成抗性值。
    # 标点天然是截断点（`\s*` 不含「，」「。」），不会误命中上一句。
    b = _ZH_BEFORE.search(text[:m.start()].rstrip(' '))
    if b:
        return _ZH_BEFORE_CLS[b.group(1)]

    # 速率：「每秒流失 1.25 点」「即每秒 10 点」「（每分钟 75 点）」。
    # 要求数字后面**就是**「点」且其后不是汉字 —— 「每秒造成 20 点伤害」里的 20
    # 后面跟的是「伤害」，仍按 DAMAGE 处理，不能在这里被抢成 RATE。
    if _ZH_RATE_PRE.search(text[:m.start()].rstrip(' ')):
        t0 = m.end()
        while t0 < len(text) and text[t0] == ' ':
            t0 += 1
        if text[t0:t0 + 1] == '点' and not re.match(r'[\u4e00-\u9fff]', text[t0 + 1:t0 + 2] or '_'):
            return 'RATE'

    t = m.end()
    # 区间起点：「112到130点奥术伤害」里的 112 借 130 的单位
    while True:
        while t < len(text) and text[t] == ' ':
            t += 1
        if text[t:t + 1] in ('到', '至', '~', '-', '—'):
            j = t + 1
            while j < len(text) and text[j] == ' ':
                j += 1
            d = NUM.match(text, j)
            if d:
                t = d.end()
                continue
        break
    cls = None
    for name, rx in ZH_A:
        if rx.match(text, t):
            cls = name
            break
    if cls in TIME_SUB:
        before = text[:m.start()].rstrip()
        after = text[m.end():]
        if before.endswith('每'):
            return cls + '_I'
        if after[:1] == '内' or before.endswith('持续') or before.endswith('续'):
            return cls + '_D'
        if before.endswith('在'):
            return cls + '_D'
    return cls


def classes(text, lang):
    """返回 [{'s':起点,'e':终点,'v':数字,'cls':单位}]，cls 可能为 None。

    注释标记（`<!--sp435884:0-->`、`<!--cooldown:435884:6 sec cooldown-->`）里的数字
    **必须排除**：它们是给渲染器看的机读数据，改了会把页面搞坏
    （曾把 `<!--sp435884-->` 改成 `<!--sp2-->`、把冷却值改成 435884 秒）。
    """
    text = _mask(text)
    if lang == 'en':
        return [{'s': m.start(), 'e': m.end(), 'v': m.group(0), 'cls': _en_cls(text, m)}
                for m in NUM.finditer(text)]
    return [{'s': m.start(), 'e': m.end(), 'v': m.group(0), 'cls': _zh_cls(text, m)}
            for m in NUM.finditer(text)]


def _mask(text):
    """把 HTML 注释标记的**内部**挖空（保留长度，索引不变）。"""
    if '<!--' not in text and '<\\u0021' not in text:
        return text
    out = list(text)
    for m in _MARK.finditer(text):
        for i in range(m.start(), m.end()):
            if out[i] != '\n':
                out[i] = ' '
    return ''.join(out)


def _key_strict(cls):
    """严：时间单位保留间隔/持续子类。"""
    if cls is None:
        return None
    return EQ.get(cls, cls)


def _key_base(cls):
    """松：时间子类归一（SEC_I / SEC_D -> SEC）。

    中英对「间隔」与「持续」的标注并不总是一致（英文 for 30 sec 中文写「30秒」），
    归一之后才配得上；风险由「零头两侧取值相同就不配零头」这条闸兜住 ——
    「每5秒…持续20秒」这种真需要区分的形态，两侧取值恰好是同一批。
    """
    if cls is None:
        return None
    c = EQ.get(cls, cls)
    return c.split('_')[0]


def _absorb(big, small, none_big, bump):
    """把「只有大桶那一侧没单位」的数字并进缺口的那个桶。

    英文常整句省掉单位（"healing all party members within 10 yards for 49 to 57"
    里的 49/57 既没 damage 也没 health），中文却写全了「恢复49到57点生命值」。
    两侧个数于是对不上，整条会被 skip_count 丢掉（圣光爆炸族 33 条就是这么漏的）。

    只在**唯一解**时才动：另一侧恰好只有一个桶有缺口，且缺口数正好等于无单位
    数字的个数。有一丝多解可能（两个桶都缺、或反方向也缺）就原样返回。
    返回 True = 已并入或无需并入；False = 放弃了，调用方要把数字放回无单位池，
    否则池大小会对不上而漏修（治疗链族就是这么被 `_absorb` 干掉过的）。
    """
    if not none_big:
        return True
    deficit = {}
    for k in set(big) | set(small):
        if k is None:                        # 另一侧的无单位桶不参与缺口计算
            continue
        d = len(small.get(k, [])) - len(big.get(k, []))
        if d > 0:
            deficit[k] = d
        elif d < 0:
            return False                     # 反方向也有缺口，不能靠猜测补
    if len(deficit) != 1:
        return False
    k, d = next(iter(deficit.items()))
    if d != len(none_big):
        return False
    big[k] = sorted(big.get(k, []) + none_big, key=lambda x: x['s'])
    bump('absorbed')
    none_big.clear()
    return True


def _put(repl, zz, val, bump):
    """写入一条改写；同一个位置被要求改成两个不同的值 = 自相矛盾，直接放弃。"""
    old = repl.get(zz['s'])
    if old is not None and old[1] != val:
        bump('skip_conflict')
        return False
    repl[zz['s']] = (zz['e'], val)
    return True


def _pair_all(pe, pz, keyfn, stats, absorb=True):
    """按单位配对。返回 repl 字典或 None（放弃）。

    三类单位分别处理（这条最要紧，写错会**把对的改错**）：
      · 两侧都有的单位：个数相同才配；个数 > 1 且两侧就是同一批取值 —— 先后顺序
        无从判断，**放着不动**（不是放弃整条，别的单位还要照常处理）。
        个数不同说明结构不一样，整条放弃。
      · 只有一侧有的单位：进零头池，按**原文位置**和另一侧的零头配对。
      · 没有单位的数字：同上进零头池。

    零头池必须按位置排序再配，不能按单位分组 —— 曾把 "降低50%，提高10%" 里的
    PCT 零头和另一个 DAMAGE 零头按类别顺序错配，产出「降低10%，提高3%」。

    无单位数字**必须留在池里**，不能单独挑出来丢掉：两侧的无单位个数经常不等
    （英文常整句省单位 "healing all party members within 10 yards for 49 to 57"，
    中文却写全了「恢复49到57点生命值」），丢掉一侧会让池大小对不上、整条漏修；
    只丢一侧更糟 —— 剩下的会按位置错配，石肤图腾族「降低 16 点」被改成
    「降低 5 点」就是这么来的。
    """
    def bump(k):
        if stats is not None:
            stats[k] = stats.get(k, 0) + 1

    ge, gz = collections.defaultdict(list), collections.defaultdict(list)
    for x in pe:
        ge[keyfn(x['cls'])].append(x)
    for x in pz:
        gz[keyfn(x['cls'])].append(x)
    if absorb:
        # 先把「只有一侧没单位」的数字并进唯一有缺口的桶；并不动就放回池里，
        # 保持池大小两侧一致（丢一边会漏修，只丢一边会错配）。
        ne, nz = ge.pop(None, []), gz.pop(None, [])
        if not _absorb(ge, gz, ne, bump):
            ge[None] += ne
        if not _absorb(gz, ge, nz, bump):
            gz[None] += nz
    repl = {}
    pool_e, pool_z = [], []
    for k in set(ge) | set(gz):
        a, b = ge.get(k, []), gz.get(k, [])
        if a and b:
            if len(a) != len(b):
                bump('skip_count')
                return None
            if len(a) == 1 or sorted(x['v'] for x in a) != sorted(x['v'] for x in b):
                for zz, ee in zip(b, a):
                    if zz['v'] != ee['v'] and not _put(repl, zz, ee['v'], bump):
                        return None
            continue
        pool_e += a
        pool_z += b
    if len(pool_e) != len(pool_z):
        bump('skip_leftcount')
        return None
    pool_e.sort(key=lambda x: x['s'])
    pool_z.sort(key=lambda x: x['s'])
    ve = [x['v'] for x in pool_e]
    vz = [x['v'] for x in pool_z]
    if len(set(ve)) != len(ve) or len(set(vz)) != len(vz):
        bump('skip_leftdup')
        return None
    # 两侧零头就是同一批数值 -> 只是先后不同，谁配谁无从判断，**零头这一小段不配**。
    # 但只放弃零头，桶内已经确定的配对要照常保留 ——
    # 早先这里直接 return None（整条放弃），把圣光爆炸族已经配好的伤害/码数
    # 一起丢掉了，33 条全部漏修。
    if ve and sorted(ve) == sorted(vz):
        bump('skip_leftsame')
        return repl
    for zz, ee in zip(pool_z, pool_e):
        if zz['v'] != ee['v']:
            if not _put(repl, zz, ee['v'], bump):
                return None
            if stats is not None:
                stats['pool_nums'] = stats.get('pool_nums', 0) + 1
    return repl


def fix_pair(en, zh, stats=None, absorb=True):
    """在安全条件下把中文数字换回「英文同单位」的值。返回新中文（可能原样）。

    为什么不能整句按位置配：中文常把从句顺序倒过来，按位置配会把对的改错。
    所以先按**单位**把数字分桶，再在桶内配对。

    安全闸（不过就整条原样返回，一个字都不改）
    -----------------------------------------
    1. 两侧**数字多重集完全相同** —— 只许重排，不许增删；
    2. 同一单位桶内个数相同；个数 > 1 时两侧取值不能是同一批
       （「每5秒…持续20秒」这类两侧取值相同的形态，先后顺序无解）；
    3. 对不上的零头必须**两边个数相同且取值两两不同**，才允许按先后配对；
       两侧零头是同一批取值时，零头不配（但桶内已定的配对保留）；
    4. 先严后松：先用带时间子类的口径试，不行再用归一化口径试。

    这套闸是在 i18n 全量数据上标定的，改动前务必跑 `_numaudit.py` 复核。
    """
    def bump(k, n=1):
        if stats is not None:
            stats[k] = stats.get(k, 0) + n

    pe, pz = classes(en, 'en'), classes(zh, 'zh')
    # 闸 1
    if collections.Counter(x['v'] for x in pe) != collections.Counter(x['v'] for x in pz):
        bump('skip_multiset')
        return zh
    repl = None
    for keyfn, tag in ((_key_strict, 'fixed'), (_key_base, 'fixed_base')):
        sub = {}
        r = _pair_all(pe, pz, keyfn, sub, absorb)
        if r is not None:
            repl = r
            bump(tag)
            if stats is not None:
                for k, v in sub.items():
                    stats[k] = stats.get(k, 0) + v
            break
        bump('tryfail_' + tag)
    if repl is None:
        bump('skip_pair')
        return zh
    if not repl:
        bump('nochange')
        return zh
    out, last = [], 0
    for s in sorted(repl):
        e, nv = repl[s]
        out.append(zh[last:s])
        out.append(nv)
        last = e
    out.append(zh[last:])
    bump('fixed_nums', len(repl))
    return ''.join(out)


def _base(cls):
    """时间子类归一，用于指纹比对（SEC_I 与 SEC_D 差异是翻译口径，不是错位）。"""
    return None if cls is None else EQ.get(cls, cls).split('_')[0]


def list_swapped(table):
    """全表扫「同值不同单位」指纹：同一个数值两侧都只出现一次，却挂了不同单位。

    这是「按位置搬数字」留下的特征 —— 数值本身没被改动，只是换错了单位。
    一侧识别不出单位的（英文常把形容词插在数字和单位之间）不算，避免误报。
    """
    out = []
    for en, zh in table.items():
        pe, pz = classes(en, 'en'), classes(zh, 'zh')
        ce = collections.Counter(x['v'] for x in pe)
        cz = collections.Counter(x['v'] for x in pz)
        bad = []
        for v in sorted(set(ce) & set(cz)):
            if ce[v] != 1 or cz[v] != 1:
                continue
            a = next(_base(x['cls']) for x in pe if x['v'] == v)
            b = next(_base(x['cls']) for x in pz if x['v'] == v)
            if a and b and a != b:
                bad.append('%s: en=%s zh=%s' % (v, a, b))
        if bad:
            out.append((en, zh, '; '.join(bad)))
    return out


def count_swapped(table):
    return len(list_swapped(table))


def digits(text):
    """文本里（注释标记之外）的数字，排序后返回 —— 用于断言「只重排、不增删」。"""
    return sorted(NUM.findall(_mask(text)))


def markers(text):
    """HTML 注释标记列表 —— 用于断言对账没碰机读数据。"""
    return _MARK.findall(text)
