# -*- coding: utf-8 -*-
"""数字对账金丝雀：改动 numfix.py 后**先跑这个**。

用法：
    python _numcanary.py        # 全部通过则 exit 0

这些样例都是从真实数据里挑出来的「曾经出过错」的形态，覆盖：
  · 时间子类互换（「每5秒恢复40点」曾变成「每40秒恢复5点」）
  · 区间起点借终点单位（「对10码内…造成26到30点」）
  · 中文单位写在数字前面（「生命值为 5 的火焰抗性图腾」）
  · 英文整句省单位（「healing … for 49 to 57」）
  · 千分位、HTML 注释标记、以及「无解时宁可不动」的几条

任何一条不符就报错退出 —— 这些是安全闸的标定点，动闸之前先看这里。
"""
import io
import json
import sys

import numfix

# (名字, 英文, 输入中文, 期望的片段列表, 期望「原样不动」?)
CASES = [
    ('智慧祝福(用户报的)',
     'Places a Blessing on the friendly target, restoring 40 mana every 5 seconds for 1 hour. '
     'Players may only have one Blessing on them per Paladin at any one time.',
     '对友方目标施加祝福，每40秒恢复5点法力值，持续1小时。每名圣骑士一次只能对一名玩家施加一个祝福。',
     ['每5秒恢复40点法力值'], False),

    ('暗影伤害(时间子类)',
     'The enemy target is swarmed by insects, decreasing their chance to hit with attacks by 2% '
     'and causing 186 Nature damage over 12 sec.',
     '敌方目标被虫群包围，其攻击命中几率降低2%，并在186秒内受到12点自然伤害。',
     ['并在12秒内受到186点自然伤害'], False),

    ('圣光爆炸(区间+省单位)',
     'Causes an explosion of holy light around the caster, causing 26 to 30 Holy damage to all '
     'enemy targets within 10 yards and healing all party members within 10 yards for 49 to 57. '
     'These effects cause no threat.',
     '在施法者周围引发圣光爆炸，对26码内的所有敌方目标造成30到10点神圣伤害，'
     '并为10码内的所有队友恢复49到57点生命值。这些效果不会产生威胁值。',
     ['对10码内的所有敌方目标造成26到30点神圣伤害'], False),

    ('熔岩图腾(间隔/持续)',
     'Summons a Magma Totem with 5 health at the feet of the caster for 20 sec that causes 52 '
     'Fire damage to creatures within 8 yards every 2 seconds.',
     '在施法者脚下召唤一个生命值为 5 的熔岩图腾，持续 20 秒，每 52 秒对 8 码内的生物造成 2 点火焰伤害。',
     ['每 2 秒对 8 码内的生物造成 52 点'], False),

    ('治疗之泉图腾(省单位)',
     'Summons a Healing Stream Totem with 5 health at the feet of the caster for 5 min that heals '
     'group members within 30 yards for 5 every 2 seconds.',
     '在施法者脚下召唤一个生命值为5的治疗之泉图腾，持续5分钟，每30秒为5码内的小队成员回复2点生命值。',
     ['每2秒为30码内的小队成员回复5点'], False),

    ('治疗链(省单位)',
     'Heals a friendly target for 165 to 187 and another 154 over 21 sec.',
     '为友方目标恢复165到187点生命值，并在154秒内额外恢复21点。',
     ['并在21秒内额外恢复154点'], False),

    ('神圣之光(间隔/持续)',
     'Launches a volley of holy light at the target, causing 81 Holy damage to an enemy, or 184 '
     'healing to an ally, instantly and every 1 sec for 2 sec.',
     '向目标发射一轮神圣之光，立即对敌人造成81点神圣伤害，或为友方回复184点生命值，并在1秒内每2秒重复一次。',
     ['并在2秒内每1秒重复一次'], False),

    # ---- 下面这些的特征是「两侧取值就是同一批」，先后顺序无解 -> 必须一个字都不改 ----
    ('石肤图腾(已正确)',
     'Summons a Stoneskin Totem with 5 health at the feet of the caster. The totem protects party '
     'members within 30 yards, reducing Physical damage taken by 16. Lasts 5 min.',
     '在施法者脚下召唤一个生命值为 5 的石肤图腾。该图腾保护 30 码内的小队成员，'
     '使其受到的物理伤害降低 16 点。持续 5 分钟。',
     [], True),

    ('火抗图腾(单位在前)',
     'Summons a Fire Resistance Totem with 5 health at the feet of the caster for 2 min that '
     'increases the fire resistance of party members within 20 yards by 30.',
     '在施法者脚下召唤一个生命值为 5 的火焰抗性图腾，持续 2 分钟，'
     '使 20 码内小队成员的火焰抗性提高 30 点。',
     [], True),

    ('Rank 3 by 38(无解)',
     'Rank 3 by level 38',
     '38 级前可学到 3 级',
     [], True),
]


def main():
    bad = 0
    for name, en, zh, wants, keep in CASES:
        out = numfix.fix_pair(en, zh)
        if keep:
            ok = out == zh
            why = '应原样不动，却变成了 %r' % out[:120] if not ok else ''
        else:
            miss = [w for w in wants if w not in out]
            ok = not miss
            why = '缺少 %r，实得 %r' % (miss, out[:150]) if miss else ''
            # 顺带确认幂等：改完再对一次不能再变
            if ok and numfix.fix_pair(en, out) != out:
                ok, why = False, '不幂等：再对一次还会变 %r' % numfix.fix_pair(en, out)[:120]
            # 顺带确认只重排、不增删
            if ok and numfix.digits(out) != numfix.digits(zh):
                ok, why = False, '数字多重集被改动'
        print('%s %-22s %s' % ('[OK]' if ok else '[!!]', name, why))
        bad += 0 if ok else 1

    # 全量幂等：对当前 i18n.json 再对账一次必须 0 改动
    try:
        D = json.load(io.open('i18n.json', encoding='utf-8'))['descs']
        n = sum(1 for e, z in D.items() if numfix.fix_pair(e, z) != z)
        print('%s %-22s 再对账会改 %d 条（应为 0）' % ('[OK]' if n == 0 else '[!!]',
                                                    '全量幂等', n))
        bad += 0 if n == 0 else 1
    except IOError:
        print('[--] 跳过全量幂等（i18n.json 不存在）')

    print('\n金丝雀 %s' % ('通过' if not bad else '失败 %d 项' % bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
