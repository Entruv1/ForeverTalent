# -*- coding: utf-8 -*-
"""生成 v3 的缺口表：data_v3.json → _new_names.json / _new_descs.json"""
import json
D=json.load(open('data_new.json',encoding='utf-8'))
names,descs=set(),set()
def add(s,k):
    if not isinstance(s,str) or not s: return
    (names if k=='N' else descs).add(s)
for cls,cv in D['TALENT_DATA'].items():
    names.add(cls)
    for tree in cv['trees']:
        add(tree['name'],'N'); add(tree.get('source'),'T'); add(tree.get('note'),'T')
        for t in tree['talents']:
            add(t['name'],'N'); add(t.get('req'),'N')
            for f in ('reqText','note','cost','asis'): add(t.get(f),'T')
            d=t.get('desc')
            if isinstance(d,list):
                for x in d: add(x,'T')
            elif isinstance(d,dict):
                for x in d.values(): add(x,'T')
            e=t.get('est')
            if isinstance(e,dict):
                for x in e.values(): add(x,'T')
            c=t.get('classic')
            if c:
                add(c.get('text'),'T'); add(c.get('tree'),'N'); add(c.get('renamed'),'N')
                add(c.get('note'),'T')   # v5：如 "no longer requires Stealth (Classic did)"
        for rm in (tree.get('removed') or []):
            add(rm.get('name'),'N'); add(rm.get('text'),'T')
for fac,races in D['RACIALS'].items():
    for r in races:
        add(r.get('race'),'N')
        for a in r['abilities']:
            add(a[0],'N'); add(a[1],'T')
for cls,sb in D['SPELLBOOKS'].items():
    add(sb.get('race'),'N'); add(sb.get('seen'),'T'); add(sb.get('levelsSource'),'T')
    for f in ('missing','gone','talents'):
        for x in (sb.get(f) or []): add(x,'N')
    add(sb.get('build'),'T')
    for k in (sb.get('icons') or {}): add(k,'N')
    # tabs[] 的 name 也是会渲染的标签（v3 新增了 Rogue 的 Poisons 页）
    for t in (sb.get('tabs') or []):
        add(t.get('name'),'N'); add(t.get('note'),'T')
    tr=sb.get('trainer')
    if isinstance(tr,dict): add(tr.get('name'),'N')
    add(sb.get('note'),'T')
    # levels 的键是等级数字串，不是文本；below/notes 之类会渲染
    for x in (sb.get('below') or []): add(x,'T')
    for x in (sb.get('notes') or []): add(x,'T')
def rows(rl):
    for r in rl:
        # v5：replaced 行带 beforeDesc（被顶替天赋的原文说明），渲染层虽走了
        # r.desc，但字段仍会进产物，补齐保证数据层不留英文。
        for f in ('text','desc','before','after','note','title','beforeDesc','afterDesc'):
            add(r.get(f),'T')
        add(r.get('talent'),'N')
for u in D['UPDATES']:
    add(u.get('title'),'T'); add(u.get('note'),'T')
    # v5 新增：「提示框之外」的暴雪开发说明（渲染层直接读 notes.lines）
    nt=u.get('notes')
    if isinstance(nt,dict):
        for f in ('title','pending','hotfixed'): add(nt.get(f),'T')
        for gk,gv in (nt.get('groups') or {}).items():
            add(gk,'N'); add(gv,'T')
        for l in (nt.get('lines') or []):
            for f in ('n','t','d'): add(l.get(f),'T')
            for x in (l.get('q') or []):
                if isinstance(x,dict): add(x.get('t'),'T'); add(x.get('d'),'T')
    for sec in ('talents','spells','racials','legacy'):
        v=u.get(sec)
        if isinstance(v,dict):
            for c,rl in v.items(): rows(rl)
        elif isinstance(v,list): rows(v)
for c in D['CHANGELOG']:
    add(c.get('title'),'T'); add(c.get('text'),'T')
    p=c.get('pin')
    if isinstance(p,dict):
        for f in ('eyebrow','label','title','line','cta'): add(p.get(f),'T')
for tr in D['LEGACY']['trees']:
    add(tr.get('name'),'N'); add(tr.get('note'),'T')
    for p in tr['perks']:
        # req 是「同树里另一个 perk 的名字」，渲染层用它查表 + 拼「需要 N 点…」文案。
        # 漏了它 → 中文名对不上，传承专长的前置判定整条失效（2026-10-03 实测 6 条）。
        add(p.get('name'),'N'); add(p.get('req'),'N')
        add(p.get('desc'),'T'); add(p.get('text'),'T')
for cls,pv in D['POPULAR'].get('classes',{}).items():
    for b in (pv.get('top') or []):
        for t in (b.get('talents') or []):
            if isinstance(t,str): add(t,'N')
    # 渲染的说明文字（v3 新增 window / buildsLabel / note）
    for f in ('window','buildsLabel','note','updated','label','title','sub'):
        add(pv.get(f),'T')
for k in ('note','label','title','sub','window','buildsLabel','updated'):
    add(D['POPULAR'].get(k),'T')
for b in (D['POPULAR'].get('top') or []):
    for t in (b.get('talents') or []):
        if isinstance(t,str): add(t,'N')

# ---- CLASS_RACIALS / CLASS_ABILITIES（职业总览页的条目）----
# 形状：{cls: [[名称, 说明], ...]} 或 {cls: {race: [[名称,说明], ...]}}
def _pairs(v):
    if isinstance(v,dict):
        for x in v.values(): _pairs(x)
    elif isinstance(v,list):
        for x in v:
            if isinstance(x,list) and len(x)>=2: add(x[0],'N'); add(x[1],'T')
            elif isinstance(x,str): add(x,'T')
for sec in ('CLASS_RACIALS','CLASS_ABILITIES'):
    for _c,_v in D.get(sec,{}).items(): _pairs(_v)

# ---- CHANGESHOTS（对比图卡片；标题是键，cap 是说明文字）----
for title,cs in D.get('CHANGESHOTS',{}).items():
    add(title,'T')
    if isinstance(cs,dict):
        add(cs.get('cap'),'T')
        add(cs.get('note'),'T')
        add(cs.get('hand'),'T')   # v5：如 "added by hand 22 Sep"
        for m in (cs.get('more') or []):
            if isinstance(m,dict):
                add(m.get('cap'),'T'); add(m.get('title'),'T')
    elif isinstance(cs,list):
        for m in cs:
            if isinstance(m,dict): add(m.get('cap'),'T')
# ---- SPELL_DESC（法术提示框；build_data.js 的 T()/N() 调用点）----
# 注意字段名单要与 build_data.js 的 SPELL_DESC 段一一对应，漏一个就会在
# 界面上留英文（v3 的 co/cc/fx/cn/asis 就是这么漏掉的）。
for k,v in D.get('SPELL_DESC',{}).items():
    parts=k.split('|')
    for i,p in enumerate(parts):
        if i in (1,2): add(p,'N')
    for f in ('d','lv','src','co','cc','cn','cd','fx','asis','nt','ck'):
        add(v.get(f) if not isinstance(v.get(f),int) else None,'T')
    add(v.get('r'),'N'); add(v.get('sc'),'N'); add(v.get('was'),'N')
    for arr in ('l','cl'):
        for p in (v.get(arr) or []):
            add(p[0],'N'); add(p[1],'T')
json.dump(sorted(names),open('_new_names.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
json.dump(sorted(descs),open('_new_descs.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('names',len(names),'descs',len(descs))
