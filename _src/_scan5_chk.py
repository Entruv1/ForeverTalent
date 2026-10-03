# 从 _scan5.json（产物里所有字符串/模板字面量，已归一化）里挑出「像英文句子但没译文」的候选。
# 这是 smoke 探针的补充：探针只覆盖它能渲染到的状态，这里覆盖所有代码路径。
import io, json, re, sys

CJK = re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]')
WORD = re.compile(r"[A-Za-z][A-Za-z'-]{2,}")

# 允许保留：品牌 / 来源 / 键名 / 枚举值 / DOM 与 CSS 标识
OK = re.compile(
    r'(Reddit|Wowhead|Xaryu|Baldwin|PC Gamer|Wowhead|World of Warcraft|WoW Forever|WoW|'
    r'Legacy System Explained|Talents Forever|talentsforever\.com|Discord|Ko-fi|'
    r'Shift|Ctrl|Alt|Cmd|Mac|iPhone|iPad|Windows|Chrome|Edge|Firefox|Safari|'
    r'Mozilla|AppleWebKit|Gecko|en-US|utf-8|UTF-8|http|https|www|'
    r'noreferrer|noopener|_blank|px|em|rem|svg|png|jpg|jpeg|webp|gif|avif|'
    r'polyfill|JSON|XMLHttpRequest|addEventListener)')

data = json.load(io.open(sys.argv[1], encoding='utf-8'))
items = data if isinstance(data, list) else data.get('candidates', [])

hits = []
for it in items:
    s = it if isinstance(it, str) else it.get('text') or it.get('s') or ''
    if not s or CJK.search(s):
        continue
    ws = WORD.findall(s)
    if len(ws) < 3:
        continue
    # 图标名 / DOM 标识：没有空格、全小写（ability_druid_bash 之类）
    if ' ' not in s:
        continue
    if OK.search(s):
        continue
    hits.append(s)

print('候选总数 %d，其中「>=3 个英文词且无汉字」的 %d 条：' % (len(items), len(hits)))
for s in hits[:120]:
    print('  *', s[:150])
