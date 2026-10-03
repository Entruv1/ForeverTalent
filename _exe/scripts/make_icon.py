#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成 Windows 应用图标 `_exe/icon.ico`。

图形直接复刻站点自带的 favicon（内联 SVG）：
    深色圆角方块底 #121212 + 金黄色 #ffd100 圆角描边 + 中心金点。
用 Pillow 按 4 倍超采样绘制再降采样，边缘比浏览器渲染 SVG 更干净，
并且能一次导出 ICO 需要的全部尺寸（256/128/64/48/32/16）。
"""

import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
EXE_DIR = os.path.dirname(HERE)
OUT = os.path.join(EXE_DIR, "icon.ico")

# favicon SVG 的原始坐标系是 64x64
CYCLE = 64.0
BG = (18, 18, 18, 255)      # #121212
GOLD = (255, 209, 0, 255)   # #ffd100

SIZES = [256, 128, 64, 48, 32, 16]
SS = 4  # 超采样倍数


def render(size):
    """按 64x64 逻辑坐标绘制，放大 SS 倍后再降采样。"""
    S = size * SS
    u = S / CYCLE
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底板：圆角 12，铺满
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=12 * u, fill=BG)

    # 描边：inset 10、圆角 8、线宽 5
    inset = 10 * u
    d.rounded_rectangle(
        [inset, inset, S - 1 - inset, S - 1 - inset],
        radius=8 * u,
        outline=GOLD,
        width=max(1, int(round(5 * u))),
    )

    # 中心点：cx=cy=32、r=9
    c = 32 * u
    r = 9 * u
    d.ellipse([c - r, c - r, c + r, c + r], fill=GOLD)

    return img.resize((size, size), Image.LANCZOS)


def main():
    master = render(256)
    frames = [render(s) for s in SIZES if s != 256]

    # Pillow 的 ICO 保存会从主图重采样出各尺寸，这里显式给出已降采样好的帧
    master.save(OUT, format="ICO", sizes=[(s, s) for s in SIZES], append_images=frames)

    im = Image.open(OUT)
    got = sorted(im.ico.sizes())
    print("wrote %s  (%d bytes)" % (OUT, os.path.getsize(OUT)))
    print("sizes in ico:", got)

    # 顺带导出一份 PNG 预览，方便肉眼核对
    png = os.path.join(EXE_DIR, "build", "icon-preview.png")
    os.makedirs(os.path.dirname(png), exist_ok=True)
    sheet = Image.new("RGBA", (256 + 3 * 64 + 40, 256), (30, 30, 34, 255))
    x = 0
    for s in [256, 64, 32, 16]:
        f = render(s)
        sheet.alpha_composite(f, (x, (256 - s) // 2))
        x += s + 10
    sheet.convert("RGB").save(png)
    print("preview:", png)

    if len(got) < 4:
        sys.exit("ICO 尺寸数量异常：%s" % got)


if __name__ == "__main__":
    main()
