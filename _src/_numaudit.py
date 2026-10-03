# -*- coding: utf-8 -*-
"""数字对账审计（只读，不改任何文件）。

用法：
    python _numaudit.py            # 概览
    python _numaudit.py -v         # 列出仍报「锚点错位」的条目
    python _numaudit.py -v -n 40   # 只列前 40 条
    python _numaudit.py --fix      # 试算 numfix 会改多少（dry-run，不落盘）

背景见 numfix.py 顶部注释：第一轮自动解析把中文数字**按位置**换成了新数字，
中英从句顺序相反时就换错了单位（「在108秒内造成18点暗影伤害」）。
"""
import io
import json
import sys
import collections

import numfix


def main():
    verbose = '-v' in sys.argv
    lim = 0
    if '-n' in sys.argv:
        lim = int(sys.argv[sys.argv.index('-n') + 1])

    D = json.load(io.open('i18n.json', encoding='utf-8'))
    DESC = D['descs']
    print('descs 条目        : %d' % len(DESC))

    # ① numfix 会动手改的条目
    stats = {}
    changed = []
    for en, zh in DESC.items():
        nz = numfix.fix_pair(en, zh, stats)
        if nz != zh:
            changed.append((en, zh, nz))
    print('对账会修正        : %d 条' % len(changed))
    print('  分派            : %s' % dict(sorted(stats.items())))

    # ② 修完仍报「同值不同单位」的（多为翻译换词，不是错位）
    rest = numfix.list_swapped(DESC)
    print('残留错位指纹      : %d 条' % len(rest))
    kinds = collections.Counter(d for _, _, d in rest)
    for k, n in kinds.most_common(12):
        print('   %4d  %s' % (n, k))

    val = json.load(io.open('_num_baseline.json', encoding='utf-8')) if \
        __import__('os').path.exists('_num_baseline.json') else {}
    if val:
        print('基线              : %s' % val)

    if verbose:
        if changed:
            print('\n--- 对账会改的（前 %d 条）---' % (lim or 20))
            for i, (en, zh, nz) in enumerate(changed):
                if lim and i >= lim:
                    print('... 其余省略')
                    break
                print('\n EN: %s' % en[:180])
                print(' -  : %s' % zh[:180])
                print(' +  : %s' % nz[:180])
        if rest:
            print('\n--- 修完仍报错位的（前 %d 条）---' % (lim or 20))
            for i, (en, zh, d) in enumerate(rest):
                if lim and i >= lim:
                    print('... 其余省略')
                    break
                print('\n !! %s\n EN: %s\n ZH: %s' % (d, en[:150], zh[:150]))


if __name__ == '__main__':
    main()
