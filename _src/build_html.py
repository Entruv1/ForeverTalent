# -*- coding: utf-8 -*-
"""Assemble the single-file, Chinese, offline build of the talent calculator.

v2（站点改版）：新增 popular / updates / changeshots 三块数据与 98 张前后对比图，
页面结构整体换了一版，因此补丁清单重写。全部 UI 文案放在 ui_zh.py。
"""
import base64, json, os, re, sys

SRC = os.path.dirname(os.path.abspath(__file__))
os.chdir(SRC)
OUT = os.path.join(os.path.dirname(SRC), '永恒天赋计算器.html')

PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
DATA_SCRIPTS = r'<script src="/(talents|racials|spellbooks|spelldesc|legacy|popular|updates|changeshots|changelog|populardata)\.js\?[^"]*"></script>\s*'

def datauri(path, mime=None):
    ext = os.path.splitext(path)[1].lower()
    if mime is None:
        mime = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
                # v5 新增 /assets/blizzard.svg（暴雪官方旗帜小图）。
                # 不加这一条会退化成 application/octet-stream，浏览器拒绝当图片渲染。
                '.svg': 'image/svg+xml'}.get(ext, 'application/octet-stream')
    with open(path, 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode('ascii'))

def load_dir(d):
    out = {}
    for fn in sorted(os.listdir(d)):
        p = os.path.join(d, fn)
        if os.path.isfile(p):
            out[os.path.splitext(fn)[0]] = datauri(p)
    return out

ICONS = load_dir('dl/icons')
BGS = load_dir('dl/bg')
CHANGES = load_dir('dl/changes')
# misc 是一批独立命名的图片（带扩展名），按完整文件名替换。
# 支持 dl/misc/<子目录>/<文件名> —— 键保留子目录（如 /assets/ideas/addon-home.jpg），
# v3 新增的 addon 截图就走这条。
MISC = {}
for root, _dirs, files in os.walk('dl/misc'):
    for fn in sorted(files):
        p = os.path.join(root, fn)
        rel = os.path.relpath(p, 'dl/misc').replace(os.sep, '/')
        MISC['/assets/' + rel] = datauri(p)
print('icons %d  backgrounds %d  changeshots %d  misc %d' % (len(ICONS), len(BGS), len(CHANGES), len(MISC)))

report = []
def note(kind, msg):
    report.append((kind, msg))

# ================================================================ 1. 资源 -> data URI
# 注意：这一步放在文案补丁之后。脚本里的模板字符串含有 /assets/xxx.png，
# 若先内联，这些字面量就不再与补丁清单逐字节一致。
html = open('index.html', encoding='utf-8').read()

# /lab/ 是站方的本地实验层：lab.js 自述「Branch polish-lab, local only, never deployed」，
# 页面上会在左下角挂一个 Lab 调试面板，默认状态下页面等于线上站点。离线交付物不要它 ——
# 把它的 <link> 与 <script> 整条去掉（等价于「所有开关关闭」），省下 ~850KB 图集。
_lab_n = len(re.findall(r'<(?:link|script)[^>]*/lab/[^>]*>', html))
html = re.sub(r'<link[^>]*href="/lab/[^"]*"[^>]*>[ \t]*\r?\n?', '', html)
html = re.sub(r'<script[^>]*src="/lab/[^"]*"[^>]*></script>[ \t]*\r?\n?', '', html)
note('ok  ', 'drop %d /lab/ 标签（实验层，非交付内容）' % _lab_n)

missing_img = []

def img_sub(m):
    kind, name, ext = m.group(1), m.group(2), m.group(3)
    tbl = {'icons': ICONS, 'bg': BGS, 'changes': CHANGES}.get(kind)
    if tbl and name in tbl:
        return tbl[name]
    missing_img.append(m.group(0))
    return PIXEL

ASSET_RX = re.compile(r'/assets/(changes|icons|bg)/([A-Za-z0-9_.\-]+)\.(jpg|png)(\?[^"\'`)\s\\]*)?')

# 独立命名的图常带缓存串（`/assets/blizzard.svg?v=c16b77d5`）。裸 replace 会把
# `?v=…` 留在 data URI 尾巴上 —— `data:image/svg+xml;base64,AAA?v=c16b77d5` 直接加载失败
# （base64 里出现 `?` 即为非法）。所以这里连缓存串一起吃掉。
MISC_RX = [(re.compile(re.escape(k) + r'(?:\?[^"\'`)\s\\]*)?'), k) for k in
           sorted(MISC, key=len, reverse=True)]


def inline_assets(text):
    text = ASSET_RX.sub(img_sub, text)
    for rx, key in MISC_RX:
        text = rx.sub(MISC[key].replace('\\', '\\\\'), text)
    return text

# ================================================================ 2. 去掉统计与广告
for needle in ('posthog.init', 'window.dataLayer', 'adsbygoogle'):
    guard = 0
    while needle in html and guard < 10:
        guard += 1
        j = html.index(needle)
        a = html.rindex('<script', 0, j)
        b = html.index('</script>', j)
        html = html[:a] + html[b + len('</script>'):]
        note('ok  ', 'dropped inline script with ' + needle)

for rx in [
    re.compile(r'<script async src="https://www\.googletagmanager\.com.*?</script>', re.S),
    re.compile(r'<script[^>]*src="https://pagead2\.googlesyndication\.com.*?</script>', re.S),
    re.compile(r'<script>window\.dataLayer.*?</script>', re.S),
    re.compile(r'<script type="application/ld\+json">.*?</script>', re.S),
    re.compile(r'<script[^>]*posthog[^>]*>.*?</script>', re.S),
    re.compile(r'<ins class="adsbygoogle".*?</ins>', re.S),
    re.compile(r'<link rel="icon"[^>]*>'),
    re.compile(r'<link rel="apple-touch-icon"[^>]*>'),
    re.compile(r'<link rel="manifest"[^>]*>'),
    re.compile(r'<link rel="canonical"[^>]*>'),
]:
    html, k = rx.subn('', html)
    note('ok  ' if k else 'none', 'drop %s x%d' % (rx.pattern[:48], k))

# 广告相关的注释块/占位（新版页面用注释标注了广告位）
html, k = re.subn(r'<!--[^>]*ad[^>]*-->', '', html, flags=re.I)
if k:
    note('ok  ', 'drop %d ad comment blocks' % k)

# ================================================================ 3. 字体内联
fonts = open('fonts.css', encoding='utf-8').read()
old_font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Cinzel:wght@600;700&display=swap">'
if old_font in html:
    html = html.replace(old_font, '<style>\n' + fonts + '\n</style>')
    note('ok  ', 'inline Google Fonts')
else:
    note('MISS', 'inline Google Fonts')

# ================================================================ 4. 切出 app 脚本
anchor = '(function(){\n  const DATA = window.TALENT_DATA'
i = html.index(anchor)
sstart = html.rindex('<script>', 0, i)
send = html.index('</script>', i)
script = html[sstart + len('<script>'):send]
body = html[:sstart] + '\n@@APP@@\n' + html[send + len('</script>'):]
assert 120000 < len(script) < 3000000, len(script)   # 内联图标/bg 后脚本会膨胀到 1MB 上下
body, k = re.subn(DATA_SCRIPTS, '', body)
note('ok  ', 'drop %d external data script tags' % k)
if k != 9:
    note('MISS', 'external data script tags: expected 9, got %d' % k)

# ================================================================ 5. 结构性补丁
from ui_zh import UI, EXTRA_B, extra_s
import ui_zh

# ---- 闸门 1：整段字面量补丁的键与值必须是同一种定界符 ----
# 值漏掉包裹的反引号会把 `…` 模板字面量变成裸 HTML，整段脚本直接语法错误。
_bad_q = [(q, en[:70], zh[:70]) for en, zh in UI.items()
          for q in (en[:1],) if q in '`\'"' and
          (not en.endswith(q) or not (zh.startswith(q) and zh.endswith(q)))]
if _bad_q:
    for q, en, zh in _bad_q:
        print('!! 定界符不一致 %s %r -> %r' % (q, en, zh))
    raise SystemExit('ui_zh.py 的整段字面量补丁定界符不一致，拒绝构建')

_bad_dots = [(en[:70], zh[:70]) for en, zh in UI.items() if '...' in zh and '...' not in en]
if _bad_dots:
    for en, zh in _bad_dots:
        print('!! 疑似占位符残留 %r -> %r' % (en, zh))
    raise SystemExit('ui_zh.py 里有占位符残留，拒绝构建')

def apply_pairs(text, pairs, tag):
    for find, repl in pairs:
        c = text.count(find)
        if c == 0:
            note('MISS', tag + ' ' + find[:100].replace('\n', ' '))
            continue
        text = text.replace(find, repl)
        note('ok  ', '%s %dx %s' % (tag, c, find[:66].replace('\n', ' ')))
    return text

def apply_ui(text, ui):
    hit = {}
    for en in sorted(ui, key=len, reverse=True):
        c = text.count(en)
        if c:
            text = text.replace(en, ui[en])
            hit[en] = c
    return text, hit

script = apply_pairs(script, ui_zh.struct_s(PIXEL), 'S')
script, hs = apply_ui(script, UI)
body, hb = apply_ui(body, UI)
for en in UI:
    n = hs.get(en, 0) + hb.get(en, 0)
    if n == 0:
        note('MISS', 'UI ' + repr(en[:95]))
    else:
        note('ok  ', 'UI %dx %s' % (n, en[:60].replace('\n', ' ')))

# 正文结构性补丁（单独处理，因为含 head/meta）
body = apply_pairs(body, ui_zh.STRUCT_B, 'B')
body, hbx = apply_ui(body, EXTRA_B)
for en in EXTRA_B:
    if hbx.get(en, 0) == 0:
        note('MISS', 'B ' + repr(en[:95]))

# 长模板里只改可见文字的局部替换（必须在 apply_ui 之后）
script = apply_pairs(script, ui_zh.EXTRA_S, 'X')

def apply_res(text, pairs, tag):
    """需要限定上下文的替换：正则里带捕获组，只动真正该动的那一处。"""
    for pat, repl in pairs:
        text, n = re.subn(pat, repl, text)
        note('ok  ' if n else 'MISS', '%s %dx %s' % (tag, n, pat[:70]))
    return text

# 单位词只改 plural(n, 'unit') 的第二个参数（同一串字面量在别处是事件名 / 分类名）
script = apply_res(script, ui_zh.RE_S, 'R')
# 正文里写死的站内链接 → 线上站点
body = apply_res(body, ui_zh.RE_B, 'RB')

# ================================================================ 5.5 资源内联（正文 + 脚本）
script = inline_assets(script)
body = inline_assets(body)
if missing_img:
    print('!! unresolved asset refs:', sorted(set(missing_img))[:20], '(共 %d 种)' % len(set(missing_img)))

# ================================================================ 6. 拼装
img_js = ('window.__ICONS=' + json.dumps(ICONS, ensure_ascii=False) + ';\n'
          'window.__BGS=' + json.dumps(BGS, ensure_ascii=False) + ';')
data_js = open('zh_data.js', encoding='utf-8').read()

def js_img(m):
    kind, name, ext = m.group(1), m.group(2), m.group(3)
    tbl = {'changes': CHANGES, 'icons': ICONS, 'bg': BGS}[kind]
    return tbl.get(name, PIXEL)

data_js = re.sub(r'/assets/(changes|icons|bg)/([A-Za-z0-9_.\-]+)\.(jpg|png)(\?[^"\'`)\s\\]*)?', js_img, data_js)
# data_js 里也可能引用 misc（独立命名 / 带子目录）的图，
# 例如 v3 的 /assets/ideas/addon-*.jpg —— 必须和正文一样走 MISC 映射。
for key, uri in MISC.items():
    data_js = data_js.replace(key, uri)
left = re.findall(r'/assets/[A-Za-z0-9_./\-]+', data_js)
if left:
    note('MISS', 'leftover asset paths in zh_data.js: %s' % sorted(set(left))[:5])

for blob in (img_js, data_js, script):
    assert '</script' not in blob.lower(), blob[:200]
data_js = data_js.replace('<!--', '<\\u0021--')
script = script.replace('<!--', '<\\u0021--')
out_html = body.replace('@@APP@@', '<script>\n' + img_js + '\n' + data_js + '\n' + script + '\n</script>')
open(OUT, 'w', encoding='utf-8').write(out_html)

miss = [r for r in report if r[0] == 'MISS']
print('\n---- patch report ----')
for r in miss:
    print('  MISS  ' + r[1])
print('patches applied: %d, missed: %d' % (len(report) - len(miss), len(miss)))
print('output: %s  (%.2f MB)' % (OUT, os.path.getsize(OUT) / 1048576))

# ================================================================ 7. 语法闸门
# 补丁是纯文本替换，一旦哪条补丁截断了 JS 字面量（历史事故：把整块 <div class="prog">…</div>
# 换成了 8 个字），只有真正跑起来才会崩。这里用 node --check 直接卡住。
import shutil, subprocess, tempfile
node = shutil.which('node')
if not node:
    print('!! 找不到 node，跳过语法自检')
else:
    # v4 起页面里有 6 段内联脚本（站方把「Back to Class 入口」「lab 阶段标记」等拆成了独立
    # <script>）。原先「第一段到最后一整段」的切法会把 HTML 一起吃进来，必须逐段检查。
    bodies = [m.group(1) for m in
              re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out_html, flags=re.S)]
    bodies = [b for b in bodies if b.strip()]
    bad = []
    total = 0
    for k, js in enumerate(bodies):
        total += len(js)
        fd, tmp = tempfile.mkstemp(suffix='.js', dir=os.getcwd())
        os.close(fd)
        try:
            with open(tmp, 'w', encoding='utf-8', newline='') as f:
                f.write(js)
            r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
            if r.returncode != 0:
                bad.append((k, (r.stderr or r.stdout).strip()[:1200]))
        finally:
            os.remove(tmp)
    if bad:
        for k, msg in bad:
            print('!! 第 %d 段内联脚本语法错误：\n%s' % (k, msg))
        raise SystemExit('内联脚本语法错误，拒绝产出')
    print('语法自检通过（node --check，%d 段内联脚本 / 共 %d 字节）' % (len(bodies), total))
