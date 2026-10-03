#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
从交付用的 `永恒天赋计算器.html`（浏览器/离线单文件版）派生出 Electron 桌面版要用的
`_exe/app.html`。两份文件只差「少数几条与运行环境相关的文案/链接」，其余逐字节一致。

设计原则
--------
1. 交付物 `永恒天赋计算器.html` **绝不改动**，桌面版的所有差异都在这里做。
2. 每条补丁都必须**恰好命中一次**，任何一条落空就报错退出（避免上游文案改了却静默漏改）。
3. `CHECKS` 里的每一串都必须恰好出现一次、`FORBID` 里的每一串都必须一次都不出现，
   用来在上游改动时立刻失败，而不是悄悄产出一个坏包。
4. 只在「web 版会失真、桌面版必须不同」的地方动手，不做无谓的样式/结构改动。

桌面版与 web 版的差异
--------------------
* 关于区块补一句说明，告诉用户这是离线桌面版。
* 分享链接与反馈邮件正文**无需补丁**：`_src/ui_zh.py` 已把 `ENTRY_PATH` 归零、注入
  `SITE_ORIGIN`，并把反馈正文改成「页面：<分享链接>」，web 版自身就是对的。
  这一点由 `CHECKS` 里的两条守住（上游一旦改回去就会立刻报错）。
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXE_DIR = os.path.dirname(HERE)
ROOT = os.path.dirname(EXE_DIR)

SRC = os.path.join(ROOT, "永恒天赋计算器.html")
DST = os.path.join(EXE_DIR, "app.html")

# ---------------------------------------------------------------------------
# 补丁清单：(说明, 查找串, 替换串)
# ---------------------------------------------------------------------------

PATCHES = [
    (
        # v5 改写了整段页脚，锚点跟着换：以「隐私」链接结尾的那句为准。
        "关于区块补一句离线桌面版说明",
        '<a href="https://talentsforever.com/privacy">隐私</a>。</p>',
        '<a href="https://talentsforever.com/privacy">隐私</a>。</p>\n'
        '      <p class="fine">当前为<b>离线桌面版</b>：全部图标、背景与字体都已内嵌，'
        "断网也能完整使用；天赋方案保存在本机，关闭窗口后再打开会自动恢复。</p>",
    ),
]

# 必须恰好出现一次的串（上游漂移检测；命中漂移不会静默产出坏包）
CHECKS = [
    ("在线地址常量", "const SITE_ORIGIN = 'https://talentsforever.com';"),
    ("入口路径已归零", "const ENTRY_PATH = '';"),
    ("分享链接为线上绝对地址", "$('#shareLink').value = SITE_ORIGIN + "),
    # 站内链接必须是绝对地址，否则 app:// 下会 404 并把整页面顶掉。
    # v5 起改走 `U()` 助手（内部就是 SITE_ORIGIN + 路径），锚点跟着换成 U(b.code)。
    ("载入按钮带 data-code", 'class="load" href="${U(b.code)}" data-code="${b.code}"'),
    # 反馈邮件正文已经在 web 版里改成了「页面：<分享链接>」，桌面版无需再补，
    # 但必须确认它还在（否则说明上游又改回去了）。
    ("反馈正文取分享链接", "'页面：' + $('#shareLink').value + '\\n\\n我发现的问题：\\n'"),
]

# 必须一次都不出现的串（桌面版下必然失效的写法）
FORBID = [
    ("依赖真实地址栏 location.href", "location.href"),
    ("外部脚本引用", "<script src="),
    ("未内联的图标路径", "/assets/icons/"),
    ("未内联的背景路径", "/assets/bg/"),
    ("在线统计 gtag", "googletagmanager"),
    ("在线广告", "adsbygoogle"),
    # 相对站内链接：会落到 app://talents/warrior 这种不存在的路径上
    ("相对站内 href", 'href="/'),
    ("裸单位词被误替换成事件名", "addEventListener('项变化'"),
    ("分类名 icon 被误翻译", "r.kind === '处图标'"),
]


def main():
    if not os.path.exists(SRC):
        sys.exit("找不到源文件：%s" % SRC)

    html = io.open(SRC, encoding="utf-8").read()
    orig_len = len(html)

    problems = []

    for label, find, repl in PATCHES:
        n = html.count(find)
        if n != 1:
            problems.append("MISS  %-40s 命中 %d 次" % (label, n))
            continue
        html = html.replace(find, repl, 1)
        print("  ok    %s" % label)
        if repl != find and html.count(repl) == 0:   # 理论不可能，纯防守
            problems.append("MISS  %-40s 替换后找不到结果" % label)

    for label, needle in CHECKS:
        n = html.count(needle)
        if n != 1:
            problems.append("CHK   %-40s 命中 %d 次" % (label, n))
        else:
            print("  check %s" % label)

    for label, needle in FORBID:
        n = html.count(needle)
        if n:
            problems.append("BAD   %-40s 出现 %d 次" % (label, n))

    if problems:
        print()
        for p in problems:
            print(p)
        sys.exit("\n上游文案可能已变更，请同步 _exe/scripts/build_app_html.py 的 PATCHES / CHECKS")

    assert "<!doctype html" in html.lower(), "缺少 doctype"

    io.open(DST, "w", encoding="utf-8", newline="").write(html)
    print()
    print("wrote %s" % DST)
    print("  %d bytes -> %d bytes  (+%d)" % (orig_len, len(html), len(html) - orig_len))
    print("  补丁 %d/%d 全部命中，%d 项防漂移检查通过" % (len(PATCHES), len(PATCHES), len(CHECKS) + len(FORBID)))


if __name__ == "__main__":
    main()
