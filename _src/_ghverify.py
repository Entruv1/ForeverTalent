# -*- coding: utf-8 -*-
"""
白名单复现验证：确认仓库里那份文件**真的能构建出同一个交付物**。

为什么必须有这一步：`.gitignore` 是白名单式（先 `/*` 排除一切再逐条放行），
「构建脚本里新加了一个输入文件，但忘了在 .gitignore 里放行」是**静默**的 ——
本地什么都不会报，只有别人 clone 下来才会在某个 `open()` 上 FileNotFoundError。
2026-10-03 实测就是这样漏掉了 `_src/fonts.css`（仓库推送时全绿地发不出去）。

做法：`git ls-files -co --exclude-standard` 拿「仓库真实会包含的文件」，
按结构复制到临时目录，跑完整构建链，与本地交付物比 md5。

用法（在 _src/ 下）：
    python _ghverify.py            # 复制到 _ghverify_tmp 并跑全部
    python _ghverify.py --keep     # 保留临时目录方便排查
"""
import io, os, sys, hashlib, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # 项目根
TMP = os.path.join(os.path.dirname(ROOT), '_ghverify_tmp')
OUT = os.path.join(ROOT, '永恒天赋计算器.html')


def git(*args):
    return subprocess.run(('git',) + args, cwd=ROOT, capture_output=True, text=True,
                          encoding='utf-8').stdout


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def main():
    keep = '--keep' in sys.argv
    files = [l.strip() for l in git('ls-files', '-co', '--exclude-standard').splitlines() if l.strip()]
    if not files:
        raise SystemExit('git ls-files 没返回任何文件')

    # --- 覆盖性检查：构建脚本引用的输入是否都在名单里
    import re
    scripts = ['gen_i18n.py', 'numfix.py', 'build_data.js', '_gen_ui2.py', 'build_html.py',
               '_data_refs.js', '_assets_fetch.py', '_v3_req.py', '_numcanary.py',
               '_numaudit.py', '_scan.js']
    generated = {'zh_data.js', 'i18n.json', '_missing_i18n.txt', '_new_names.json',
                 '_new_descs.json', '_num_baseline.json'}
    lst = set(files)
    absent = []
    for s in scripts:
        p = os.path.join(HERE, s)
        if not os.path.exists(p):
            continue
        src = io.open(p, encoding='utf-8', errors='replace').read()
        for m in set(re.findall(r'''['"\`]([A-Za-z0-9_./\u4e00-\u9fff-]+\.(?:tsv|json|js|html|css|txt|py))['"\`]''', src)):
            if m.startswith('http') or os.path.basename(m) in generated:
                continue
            cand = '_src/' + m.lstrip('./')
            if os.path.exists(os.path.join(ROOT, cand)) and cand not in lst:
                absent.append((s, cand))
    if absent:
        print('!! 构建脚本引用了这些文件，但它们不在仓库名单里：')
        for s, c in sorted(set(absent)):
            print('   %-16s %s   -> 在 .gitignore 里加  !%s' % (s, c, c))
        return 1
    print('覆盖性检查：构建脚本引用的输入全部在名单里 ✓（%d 个文件）' % len(files))

    # --- 复制
    if os.path.exists(TMP):
        shutil.rmtree(TMP, ignore_errors=True)
    for rel in files:
        src = os.path.join(ROOT, rel.replace('/', os.sep))
        dst = os.path.join(TMP, rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    print('已复制 %d 个文件 -> %s' % (len(files), TMP))

    # --- 跑构建链
    py, node = sys.executable, shutil.which('node')
    steps = [(py, 'gen_i18n.py'), (node, 'build_data.js'), (py, '_gen_ui2.py'), (py, 'build_html.py')]
    for exe, name in steps:
        r = subprocess.run([exe, name], cwd=os.path.join(TMP, '_src'),
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
        tail = (r.stdout or '').strip().splitlines()[-1:] or ['(无输出)']
        print('   %-16s rc=%d  %s' % (name, r.returncode, tail[0][:80]))
        if r.returncode != 0:
            print((r.stdout or '')[-2000:])
            print((r.stderr or '')[-2000:])
            print('!! %s 失败 —— 仓库缺文件或脚本不自足' % name)
            return 1

    made = os.path.join(TMP, '永恒天赋计算器.html')
    a, b = md5(OUT), md5(made)
    print('本地产物 %s' % a)
    print('副本产物 %s' % b)
    if a != b:
        print('!! 不一致 —— 白名单缺文件（本地有的输入没进仓库），或存在未纳入的环境差异')
        return 1
    print('逐字节一致 ✓  仓库可独立复现')

    if not keep:
        shutil.rmtree(TMP, ignore_errors=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
