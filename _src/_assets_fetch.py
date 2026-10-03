# -*- coding: utf-8 -*-
"""
补齐 dl/ 里缺的资源（图标 / 对比图 / 背景图）。

为什么需要它：dl/ 是当初一次性抓下来的。上游后来加了新天赋、新截图，
本地就静默缺文件 —— build_html.py 的 img_sub() 遇到取不到的键会**回退成 1x1 透明像素**
（不报错、不中断），于是界面上就是「只有天赋名缩写、没有图标」的空块。
2026-10-03 用户截图报的就是这个（战士·狂怒 两个天赋）。

用法：
    python _assets_fetch.py            # 只体检，不改动磁盘
    python _assets_fetch.py --write    # 体检并下载缺失项到 dl/

数据来源（按优先级）：
  1. https://talentsforever.com/assets/<rel>      —— 和已有 699 张同源，优先
  2. https://render.worldofwarcraft.com/us/icons/56/<name>.jpg  —— 暴雪官方 56px
     （上游偶尔 404：例如 ability_hunter_aspectmastery 上游就没有，
       但暴雪 CDN 有，且同样 56x56，可直接顶替）
"""
import io, os, re, sys, json, struct, subprocess, collections, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

SITE = 'https://talentsforever.com/assets/'
BLIZZ = 'https://render.worldofwarcraft.com/us/icons/56/'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

KINDS = ('icons', 'bg', 'changes')

NODE = shutil_node = None


def node_exe():
    """找一个可用的 node（构建链本来就要用它）。"""
    global NODE
    if NODE:
        return NODE
    import shutil
    NODE = shutil.which('node') or os.environ.get('TF_NODE')
    if not NODE:
        for p in (r'C:\Users\Entruv\.workbuddy\binaries\node\versions\22.22.2-2\node.exe',
                  r'C:\Program Files\nodejs\node.exe'):
            if os.path.exists(p):
                NODE = p
                break
    if not NODE:
        raise SystemExit('找不到 node，_data_refs.js 跑不了')
    return NODE



def jpeg_size(buf):
    """从 JPEG 字节流里读宽高（不依赖 Pillow）。"""
    i, n = 2, len(buf)
    while i < n - 9:
        if buf[i] != 0xFF:
            i += 1
            continue
        m = buf[i + 1]
        if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack('>HH', buf[i + 5:i + 9])
            return w, h
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        i += 2 + struct.unpack('>H', buf[i + 2:i + 4])[0]
    return None


def have(kind):
    d = os.path.join('dl', kind)
    return {f.rsplit('.', 1)[0] for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))}


def scan():
    """跑 _data_refs.js（Node）走真实数据对象，返回 {kind: {name: 引用次数}}。

    早先这里是 python 正则扫 zh_data.js 的 `"icon":"xxx"`，会漏掉
    数组第 3 元素形状（RACIALS/CLASS_ABILITIES/CLASS_RACIALS）与
    SPELLBOOK_ICONS 这种「值是图标名」的映射表 —— 实测漏 195 个引用、
    其中 2 个是真缺文件。别再改回正则。
    """
    r = subprocess.run([node_exe(), '_data_refs.js'], capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise SystemExit('_data_refs.js 失败：%s' % (r.stderr or r.stdout)[:400])
    refs = json.loads(r.stdout)
    return {k: collections.Counter({n: 1 for n in refs.get(k, [])}) for k in KINDS}



def fetch(urls, want_icon=False):
    """按顺序试 urls，返回 (bytes, url)。

    校验：必须是非空的真 JPEG（\xff\xd8 开头）—— 上游 404 会返回 200 + HTML 页面，
    光看状态码会把 404 页面当图片存下来。
    图标另外要求是正方形且边长 32~256：站点自己的图标就是 56/64 混用（实测 578 张 56、
    126 张 64、1 张 72），所以**不能**写死 56 —— 曾经把上游合法的 64x64 误拒成「不合格」。
    """
    last = ''
    for u in urls:
        try:
            req = urllib.request.Request(u, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                if r.status != 200:
                    last = 'HTTP %d' % r.status
                    continue
                buf = r.read()
        except urllib.error.HTTPError as e:
            last = 'HTTP %d' % e.code
            continue
        except Exception as e:
            last = str(e)[:80]
            continue
        if not buf:
            last = '空响应'
            continue
        if buf[:2] != b'\xff\xd8':
            last = '不是 JPEG（上游返回了 404 页面？）'
            continue
        if want_icon:
            wh = jpeg_size(buf)
            if not wh or wh[0] != wh[1] or not (32 <= wh[0] <= 256):
                last = '图标尺寸异常 %s' % (wh,)
                continue
        return buf, u
    return None, last


def main():
    write = '--write' in sys.argv
    refs = scan()
    onDisk = {k: have(k) for k in KINDS}

    todo = []
    for kind in KINDS:
        for name, cnt in sorted(refs[kind].items()):
            if name not in onDisk[kind]:
                todo.append((kind, name, cnt))

    print('dl 现状：' + '  '.join('%s %d' % (k, len(onDisk[k])) for k in KINDS))
    print('被引用：' + '  '.join('%s %d' % (k, len(refs[k])) for k in KINDS))
    if not todo:
        print('缺失 0 项 —— 资源完整 ✓')
        return 0
    print('缺失 %d 项：' % len(todo))
    for kind, name, cnt in todo:
        print('   %-8s %-32s x%d' % (kind, name, cnt))

    if not write:
        print('\n（只体检，未下载。加 --write 落地）')
        return 1

    print('\n开始下载 ...')
    fail = []
    for kind, name, cnt in todo:
        rel = '%s/%s.jpg' % (kind, name)
        urls = [SITE + rel]
        if kind == 'icons':
            urls.append(BLIZZ + name + '.jpg')
        buf, src = fetch(urls, want_icon=(kind == 'icons'))
        if buf is None:
            fail.append((rel, src))
            print('   ✗ %-40s %s' % (rel, src))
            continue
        dst = os.path.join('dl', kind, name + '.jpg')
        with open(dst, 'wb') as f:
            f.write(buf)
        print('   ✓ %-40s %7d B  来自 %s' % (rel, len(buf), src.split('/')[2]))

    if fail:
        print('\n仍缺 %d 项：' % len(fail))
        for rel, why in fail:
            print('   ✗ %-40s %s' % (rel, why))
        return 1
    print('\n全部补齐 ✓')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
