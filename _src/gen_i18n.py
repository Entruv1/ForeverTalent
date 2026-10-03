# -*- coding: utf-8 -*-
"""把各来源的译文合并成 i18n.json。

来源（后者覆盖前者）：
  1. 旧 i18n.json  —— 上一轮已完成的 1005 名词 / 1782 描述，本轮继续沿用
  2. _resolved.json —— 自动解析（stat 规则 / Wowhead 官方 / Wowhead 数字搬运 / 旧译本搬运）
  3. t2_names + zh2_names / t2_desc_N + zh2_desc_N —— 本轮人工翻译的族代表串

仍未被覆盖的串走「同族数字搬运」：把同形（数字归一化后相同）的已译串当模板，
按位换上目标串的数字。搬不动的会打印出来。
"""
import json, re, glob, sys, os

NUM = re.compile(r'\d+(?:\.\d+)?')
def norm(s): return NUM.sub('N', s)
def nums(s): return NUM.findall(s)

def subst(en_base, en_target, zh):
    """把中文模板 zh 里的数字换成 en_target 的数字。

    关键是「按值对齐」而不是「按位替换」：中文的数字个数常常与英文不同
    （英文 "per level the attacker is above you" 中文写成「攻击者每比你高 1 级」，
    凭空多一个数字），按位替换会错位甚至越界。
    所以先由 en_base（zh 的英文底本）与 en_target 建立「第几个数 → 新值」，
    再只在「中文与底本都出现过的值」上做替换。
    """
    a, b, z = nums(en_base), nums(en_target), nums(zh)
    if not b: return zh
    if len(a) != len(b): return None
    pa = {}
    for i, v in enumerate(a): pa.setdefault(v, []).append(i)
    # 值 → 目标值。只有当该值在底本里出现多次、对应的是同一个目标值时才能这么用
    # （中文的表达方式常与英文不同：英文 "by 4%" 只出现一次，
    #   中文却写成「提高4%…就再提高4%」，按位置对齐会漏掉第二处）。
    vmap = {}
    for v, idxs in pa.items():
        vals = set(b[i] for i in idxs)
        if len(vals) == 1:
            vmap[v] = vals.pop()
    # 少数值在底本里出现多次却对应不同目标值：这部分退回按位置对齐
    pz = {}
    for i, v in enumerate(z): pz.setdefault(v, []).append(i)
    pos = {}
    for v, idxs in pa.items():
        if v in vmap: continue
        for ea, za in zip(idxs, pz.get(v, [])):
            pos[za] = b[ea]
    i = -1
    def rep(m):
        nonlocal i
        i += 1
        if i in pos: return pos[i]
        return vmap.get(m.group(0), m.group(0))
    return NUM.sub(rep, zh)

def unesc(s):
    return s.replace('\\\\', '\x00').replace('\\n', '\n').replace('\x00', '\\')

def load(paths):
    """TSV: `键<TAB>值`，多行文本存成字面反斜杠-n。"""
    d = {}
    for p in paths:
        for ln in open(p, encoding='utf-8-sig'):
            ln = ln.rstrip('\r\n')
            if not ln:
                continue
            k, _, v = ln.partition('\t')
            d[k] = v
    return d

def batch_no(p):
    return int(re.search(r'_(\d+)\.tsv$', p).group(1))

# ---------------- 1. 旧 i18n ----------------
OLD = json.load(open('i18n.json', encoding='utf-8'))
NAME = {unesc(k): unesc(v) for k, v in OLD.get('names', {}).items()}
DESC = {unesc(k): unesc(v) for k, v in OLD.get('descs', {}).items()}
extra = {unesc(k): unesc(v) for k, v in (OLD.get('extra') or {}).items()}
print('旧 i18n   names=%d descs=%d extra=%d' % (len(NAME), len(DESC), len(extra)))

# ---------------- 2. 自动解析 ----------------
RES = json.load(open('_resolved.json', encoding='utf-8'))
DESC.update({unesc(k): unesc(v) for k, v in RES.items() if isinstance(v, str)})
print('自动解析  +%d' % len(RES))
# 第二轮（v2 新增字段）的自动解析结果
if os.path.exists('_res3_resolved.json'):
    RES3 = json.load(open('_res3_resolved.json', encoding='utf-8'))
    DESC.update({unesc(k): unesc(v) for k, v in RES3.items() if isinstance(v, str)})
    print('自动解析2 +%d' % len(RES3))

# ---------------- 3. 人工翻译的族代表 ----------------
def merge(t_en, t_zh, target):
    en, zh = load([t_en]), load([t_zh])
    assert set(en) == set(zh), (t_en, set(en) ^ set(zh))
    n = 0
    for k, e in en.items():
        target[unesc(e)] = unesc(zh[k])
        n += 1
    return n

n_names = merge('t2_names.tsv', 'zh2_names.tsv', NAME)
n_desc = 0
desc_batches = sorted(glob.glob('t2_desc_*.tsv'), key=batch_no)
for tp in desc_batches:
    zp = 'zh2' + tp[len('t2'):]
    n_desc += merge(tp, zp, DESC)
print('人工翻译  names +%d (共 %d 批) / descs +%d' % (n_names, len(desc_batches), n_desc))

# 第二轮（v2 新增字段）的人工族代表
n3_names = 0
if os.path.exists('t3_names.tsv'):
    n3_names = merge('t3_names.tsv', 'zh3_names.tsv', NAME)
n3_desc = 0
b3 = sorted(glob.glob('t3_desc_*.tsv'), key=batch_no)
for tp in b3:
    zp = 'zh3' + tp[len('t3'):]
    n3_desc += merge(tp, zp, DESC)
print('人工翻译2 names +%d / descs +%d (共 %d 批)' % (n3_names, n3_desc, len(b3)))

# 第三轮（v3 = beta 1.60.1.70009）的人工族代表
n4_names = 0
if os.path.exists('t4_names.tsv'):
    n4_names = merge('t4_names.tsv', 'zh4_names.tsv', NAME)
n4_desc = 0
b4 = sorted(glob.glob('t4_desc_*.tsv'), key=batch_no)
for tp in b4:
    zp = 'zh4' + tp[len('t4'):]
    n4_desc += merge(tp, zp, DESC)
print('人工翻译3 names +%d / descs +%d (共 %d 批)' % (n4_names, n4_desc, len(b4)))

# 第四轮（v4 = beta 1.60.1.70170，1–2 Oct 战士服务器热修；缺口 178 条
# —— 客户端把一批战士提示框改了措辞，旧译文的键与新原文不再同形，同族搬运接不上）
n5_names = 0
if os.path.exists('t5_names.tsv'):
    n5_names = merge('t5_names.tsv', 'zh5_names.tsv', NAME)
n5_desc = 0
b5 = sorted(glob.glob('t5_desc_*.tsv'), key=batch_no)
for tp in b5:
    zp = 'zh5' + tp[len('t5'):]
    n5_desc += merge(tp, zp, DESC)
print('人工翻译4 names +%d / descs +%d (共 %d 批)' % (n5_names, n5_desc, len(b5)))

# ---------------- 3b. 人工兜底 ----------------
# 极少数串没法靠"同族数字搬运"补上：旧译本里的中文比英文多一个数字
# （例如「每吸收1点伤害消耗2.0点法力值」），数字个数对不上，subst() 会放弃。
# 这类串在 zh2_manual.tsv 里逐条写死。格式：`英文<TAB>中文`，可含字面反斜杠-n。
for _ln in open('zh2_manual.tsv', encoding='utf-8-sig'):
    _ln = _ln.rstrip('\r\n')
    if not _ln:
        continue
    _k, _, _v = _ln.partition('\t')
    DESC.setdefault(unesc(_k), unesc(_v))
print('人工兜底  %d 条' % sum(1 for L in open('zh2_manual.tsv', encoding='utf-8') if L.strip()))

# ---------------- 3c. 零星人工补充 ----------------
# 原站渲染器里直接写死的短句（例如图文说明的标题），既不进缺口表也不算名词，
# 单列一份 `英文<TAB>中文` 的清单；格式与 zh2_manual.tsv 相同。
if os.path.exists('extra_manual.tsv'):
    _n = 0
    for _ln in open('extra_manual.tsv', encoding='utf-8-sig'):
        _ln = _ln.rstrip('\r\n')
        if not _ln:
            continue
        _k, _, _v = _ln.partition('\t')
        DESC.setdefault(unesc(_k), unesc(_v))
        _n += 1
    print('零星补充  %d 条' % _n)

# ---------------- 3d. 天赋描述补译 ----------------
# 站点改版后有一批天赋描述被改写了（多一个 "Wrack"、damage → damaging 之类），
# 上一轮的译文与之不再同形，同族搬运接不上；旧 i18n 里这些键的值又恰好是英文原文，
# 于是界面上就露出英文。这里逐条给出新译文（`英文<TAB>中文`），
# 同一串的其他等级仍由第 4 节的同族搬运生成。
if os.path.exists('zh2_tdesc.tsv'):
    _n = 0
    for _ln in open('zh2_tdesc.tsv', encoding='utf-8-sig'):
        _ln = _ln.rstrip('\r\n')
        if not _ln:
            continue
        _k, _, _v = _ln.partition('\t')
        DESC[unesc(_k)] = unesc(_v)
        _n += 1
    print('天赋补译  %d 条' % _n)

# ---------------- 3e. 数字对账 ----------------
# 第一轮自动解析里有一道「Wowhead 数字搬运」，把旧译文的数字**按位置**换成新数字。
# 中英的从句顺序常常相反，于是数字换错了单位（"causing 108 damage over 18 sec"
# 变成「在108秒内造成18点暗影伤害」）。这类错误语法通顺、数值也合理，
# 肉眼和「有没有汉字」的判据都抓不到，只有把数字连单位一起比才看得出来。
# numfix 按单位分桶重配，四个安全闸都过才动手，过不了就原样返回。
import numfix


def reconcile(table, label):
    """对账 + 三条硬校验（校验不过直接中断构建）。"""
    n = 0
    for k in list(table):
        v = table[k]
        nv = numfix.fix_pair(k, v)
        if nv == v:
            continue
        # ① 幂等：再对一次不能再变（不幂等说明配对在打转，会把对的改错）
        assert numfix.fix_pair(k, nv) == nv, '数字对账不幂等: %r' % k[:80]
        # ② 只许重排数字，不许增删
        assert numfix.digits(nv) == numfix.digits(v), '数字多重集被改动: %r' % k[:80]
        # ③ 机读注释标记原样保留（改坏会连页面一起搞坏）
        assert numfix.markers(v) == numfix.markers(nv), '注释标记被改动: %r' % k[:80]
        table[k] = nv
        n += 1
    print('%s 数字对账 修正 %d 条' % (label, n))
    return n


reconcile(DESC, 'descs')

# ---------------- 3f. 数字修补表 ----------------
# 极少数条目的数字被搬得**结构都坏了**（千分位被拆开："1,330" -> "330,15"），
# 数字多重集对不上，numfix 会放弃。这类逐条写死，放在对账之后覆盖。
if os.path.exists('zh2_numwell.tsv'):
    _n = 0
    for _ln in open('zh2_numwell.tsv', encoding='utf-8-sig'):
        _ln = _ln.rstrip('\r\n')
        if not _ln:
            continue
        _k, _, _v = _ln.partition('\t')
        DESC[unesc(_k)] = unesc(_v)
        _n += 1
    print('数字修补  %d 条' % _n)

# ---------------- 4. 校验：新数据要求的串是否全覆盖 ----------------
req_names = json.load(open('_new_names.json', encoding='utf-8'))
req_descs = json.load(open('_new_descs.json', encoding='utf-8'))
ALL = {}
for d in (NAME, DESC, extra):
    for k, v in d.items():
        ALL.setdefault(k, v)

# 「键存在，但译文与英文原文一模一样」= 上一轮压根没翻到，同样算缺口。
# 只认「像句子」的串，免得把 "Savix 5:01:52" 这种本来就不译的标注也算进来。
WORD = re.compile(r'[A-Za-z]{3}')
CN = re.compile(r'[\u4e00-\u9fff]')
# 「要翻译」的判据之外的豁免：有些串本来就该保持原样，翻不了也不该翻译。
#   * 图标 / 资源名（全小写下划线，如 ability_warrior_victoryrush）——
#     _v3_req.py 会把 SPELLBOOKS.icons 的**键**也收进名字表，但界面上不显示它们；
#   * 版本号与 ISO 时间戳（1.60.1.70170 / 2026-10-03T01:22:54.939Z）；
#   * 单字母键（个别数据里用 'n' / 'r' 当字段名）。
# 不豁免的话构建末尾的 undone 永远非空，那道「全表覆盖」的闸门等于形同虚设
# —— 上一轮就是这样带着 87 条 undone 一路往下走的。
ASSET = re.compile(r'^(?:ability|inv|spell|classic|trade|temp|racial|hunter|item|ui)_[a-z0-9_]+$')
STAMP = re.compile(r'^[\d.\-:TZ+]+$')
def is_asset(s):
    return bool(ASSET.match(s)) or bool(STAMP.match(s)) or len(s) < 2
def is_sentence(s):
    return len(s) > 40 and len(WORD.findall(s)) >= 4
def is_missing(s):
    if is_asset(s): return False
    v = ALL.get(s)
    if v is None: return True
    if v == s and is_sentence(s): return True
    # 半成品译文：自动解析只把 "sec" 换成了「秒」之类，句子主体还是英文，
    # 这种「值 != 键」的条目最容易被漏掉（界面上是中英混杂）。
    return len(CN.findall(v)) <= 2 and len(WORD.findall(v)) >= 3

miss_n = [x for x in req_names if is_missing(x)]
miss_d = [x for x in req_descs if is_missing(x)]
print('缺口  names=%d descs=%d' % (len(miss_n), len(miss_d)))

# 同族数字搬运。模板只取「译文确实含中文」的条目 ——
# 否则英文自映射的键会先被当成模板，把英文原样搬回去。
fam = {}
for k, v in ALL.items():
    if CN.search(v):
        fam.setdefault(norm(k), (k, v))
derived = 0
undone = []
for s in miss_n + miss_d:
    t = fam.get(norm(s))
    if t:
        z = subst(t[0], s, t[1])
        if z is not None:
            ALL[s] = z
            (NAME if s in req_names else DESC)[s] = z
            derived += 1
            continue
    undone.append(s)
print('同族搬运  +%d   仍缺 %d' % (derived, len(undone)))
for x in undone[:25]:
    print('   ?', repr(x[:110]))
json.dump(undone, open('_i18n_undone.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

# ---------------- 4b. 刚搬运出来的串也要对账 + 闸门 ----------------
reconcile(DESC, 'descs(搬运后)')

# 闸门：全表过一遍「同值不同单位」指纹。这个数字只降不升 ——
# 站点再改版、或新加译文时如果又出现数字错位，这里会直接拦住构建。
BASELINE = '_num_baseline.json'
n_bad = numfix.count_swapped(DESC)
old = None
if os.path.exists(BASELINE):
    old = json.load(open(BASELINE, encoding='utf-8')).get('descs')
print('数字错位指纹  %d 条（基线 %s）' % (n_bad, old))
if old is not None and n_bad > old:
    for en, zh, d in numfix.list_swapped(DESC)[:15]:
        print('   !! %s\n      EN %s\n      ZH %s' % (d, en[:110], zh[:110]))
    print('数字错位比基线多了，先修再构建（确认无误后删掉 %s 重新生成）' % BASELINE)
    sys.exit(1)
json.dump({'descs': n_bad}, open(BASELINE, 'w', encoding='utf-8'))

# 多余的键（新数据里用不到）统计一下，便于发现过时译文
extra_keys = [k for k in DESC if k not in req_descs and k not in NAME]
print('descs 中未被新数据引用的键: %d（多为旧版残留或被并入其他表，可忽略）' % len(extra_keys))

json.dump({'names': NAME, 'descs': DESC, 'extra': extra},
          open('i18n.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('wrote i18n.json  names=%d descs=%d extra=%d' % (len(NAME), len(DESC), len(extra)))
if undone:
    sys.exit(1)
