
const ENTRY_PATH = location.pathname.replace(/\/$/, '');   // the URL as arrived, before the app rewrites it
(function(){
  const DATA = window.TALENT_DATA, CLASSES = Object.keys(DATA);
  const U = (...parts) => ['', ...parts].join('/');   // a site path from pieces, so no quoted string in this script begins with '/' followed by template text (Google crawled those as URLs and logged 404s)
  // a new talent that merges old ones (Hack and Slash, Weaponmaster) says so in its Classic compare instead of "no Classic talent with this name"
  const replacesLine = c => c.replaces && c.replaces.length ? `Replaces Classic's ${c.replaces.slice(0, -1).join(', ')} and ${c.replaces[c.replaces.length - 1]}, merged into one talent.` : 'No Classic talent with this name.';
  const ICON = n => `/assets/icons/${n}.jpg?i=2`;   // ?i= bumps when the icon files change (they are cached a year); the server treats it as an asset either way
  // A dropped connection or a deploy in progress fails a batch of icons at once; retry twice before giving up on one.
  window.iconRetry = function(img){ const n = (+img.dataset.try || 0) + 1; if(n > 2){ img.remove(); return; } img.dataset.try = n; const base = img.src.split('?')[0]; setTimeout(() => { img.src = base + '?r=' + n + '_' + Date.now(); }, 1500 * n); };
  const BG = id => `/assets/bg/${id}.jpg`;
  const $ = s => document.querySelector(s) || Object.assign(document.createElement('span'), {_detached:true});
  const ROWS = 7;

  const state = { cls: CLASSES.find(c => DATA[c].trees.some(t=>t.talents.length)) || CLASSES[0], level: 60, ranks: {} };
  const ranksFor = cls => state.ranks[cls] || (state.ranks[cls] = DATA[cls].trees.map(t => t.talents.map(()=>0)));
  // Talent points start at level 10, one level earlier per rank of the Talented Legacy perk, never more than 51 in all.
  const pool = cls => (cls || state.cls) === 'Legacy' ? L.points : Math.min(51, Math.max(0, state.level - 9 + talentedRank()));

  // The site's own counter (/note, counter/counter.js): the few things the Wrapped and Popular builds are made from, sent to our own
  // server with no cookie and no id, so those numbers no longer hang on an outside counter's quota or on who blocks it. A build goes
  // in its current short form whatever link it came in on, so one build is one row.
  const NOTE = {shared_build_opened:'open', share_copied:'share', share_native:'share', build_saved:'save', build_loaded:'load'};
  const refHost = (() => { try{ if(new URLSearchParams(location.search).has('a')) return 'addon'; const h = document.referrer ? new URL(document.referrer).host : ''; return h === location.host ? 'self' : h; }catch(e){ return ''; } })();   // ?a = a link the in-game addon made
  const notePath = () => state.cls && totalPts(state.cls) > 0 ? '/' + encode() : location.pathname;
  const note = (e, s, p) => { try{ if(!/^https?:$/.test(location.protocol) || location.pathname.startsWith('/index.html')) return; const b = JSON.stringify({e, p: p || notePath(), r: refHost, s}); if(!(navigator.sendBeacon && navigator.sendBeacon('/note', b))) fetch('/note', {method:'POST', body:b, keepalive:true}).catch(() => {}); }catch(_){} };
  const track = (ev, props) => { try{ window.posthog && posthog.capture(ev, props); }catch(e){} try{ window.gtag && gtag('event', ev, Object.assign({}, props || {})); }catch(e){} if(NOTE[ev]) note(NOTE[ev], props && props.src, props && props.path); }; // PostHog and GA4 both get every site event; our own counter gets the ones in NOTE
  // ---------- rules ----------
  const treePts = (cls,ti) => ranksFor(cls)[ti].reduce((a,b)=>a+b,0);
  const totalPts = cls => DATA[cls].trees.reduce((a,_,i)=>a+treePts(cls,i),0);
  const above = (cls,ti,tier) => DATA[cls].trees[ti].talents.reduce((a,t,i)=>a+(t.row<tier?ranksFor(cls)[ti][i]:0),0);
  const idx = (tree,name) => tree.talents.findIndex(t=>t.name===name);
  function gate(cls,ti,i){
    const tree = DATA[cls].trees[ti], t = tree.talents[i], r = ranksFor(cls)[ti];
    if(DATA[cls].legacy){
      if(t.placeholder) return 'To be added in future patch content';
      const spent = r.reduce((a,b)=>a+b,0) - r[i]; if(t.gate && spent < t.gate) return `Requires ${t.gate} points in ${tree.name}`;
    } else {
      const need = (t.row-1)*5;
      if(above(cls,ti,t.row) < need) return `Requires ${need} points in ${tree.name} Talents`;
    }
    if(t.req){ const p = idx(tree,t.req); if(p>=0 && r[p] < tree.talents[p].max) return `Requires ${tree.talents[p].max} point${tree.talents[p].max>1?'s':''} in ${t.req}`; }
    return null;
  }
  function canAdd(cls,ti,i){
    const t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i];
    if(r >= t.max) return 'Max rank';
    const g = gate(cls,ti,i); if(g) return g;
    if(totalPts(cls) >= pool(cls)) return `All ${pool(cls)} ${cls === 'Legacy' ? 'Legacy ' : ''}points spent. Take one back from another ${cls === 'Legacy' ? 'perk' : 'talent'} to move it.`;
    return null;
  }
  function canRemove(cls,ti,i){
    const tree = DATA[cls].trees[ti], r = ranksFor(cls)[ti];
    if(r[i] <= 0) return false;
    r[i]--; let ok = true;
    for(let j=0;j<tree.talents.length && ok;j++){ if(r[j]>0 && gate(cls,ti,j)) ok = false; }
    r[i]++; return ok;
  }
  const status = (cls,ti,i) => { const t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i]; return r>=t.max?'maxed':r>0?'partial':gate(cls,ti,i)?'locked':'avail'; };

  // ---------- a build that arrives whole (a link, the saved list, the Popular fold, last time's build) is judged by today's rules ----------
  // Beta builds move talents: 70009 swapped two Elemental rows and re-pointed Call of Thunder's arrow, so a Shaman build made the week
  // before carried points where the game no longer allows them, and the page drew it without a word (Davajey, 25 Sep 2026). The code's
  // generation digit says nothing about that: the counter and the older lists write current-looking codes for older builds, so the rules
  // are what decide. settle() takes back every point that sits behind a closed row or an unmet arrow, again until nothing breaks (a point
  // taken back can close a row below it); what it took back is remembered in state.back for the card above the trees and the gold rings.
  function settle(cls){
    const back = [];
    for(let pass = 0; pass < 12; pass++){
      const r = ranksFor(cls), found = [];
      DATA[cls].trees.forEach((tree, ti) => tree.talents.forEach((t, i) => { if(r[ti][i] > 0){ const why = gate(cls, ti, i); if(why) found.push([ti, i, why]); } }));
      if(!found.length) break;
      found.forEach(([ti, i, why]) => { back.push({cls, ti, i, pts: r[ti][i], why}); r[ti][i] = 0; });
    }
    return back;
  }
  // the same judgement on ranks that are not the page's (a Popular row), without touching the page
  function judge(cls, ranks){ const keep = state.ranks[cls]; state.ranks[cls] = ranks.map(t => t.slice()); try{ return settle(cls); } finally{ state.ranks[cls] = keep; } }
  // a build was settled: remember what came back (gone talents' points too), so the card can say so until the build is whole again
  function settled(cls, back, gone){ const list = back.concat((gone || []).map(g => ({cls, gone: true, name: g.name, tree: g.tree, icon: g.icon, pts: g.pts})));
    state.back = list.length ? {cls, list, n: list.reduce((a, b) => a + b.pts, 0), full: totalPts(cls) >= pool(cls)} : null;   // full: it still holds a whole pool (an old link with more points than the level allows), so the card stays until dismissed
    if(state.back){ fixOrder(cls); track('build_settled', {class: cls, points: state.back.n, talents: list.length}); } }
  // ---------- refit: help finish a settled build with the points that came back ----------
  // Never automatic. The card offers it and says what it takes: each talent that lost points goes back where the rules now allow,
  // its new arrow filled first, a row that fell short filled with the talents most builds OF THIS BUILD'S SPEC take (the pick rates
  // among the builds that lead in the same tree this one leads in, when there are 100 or more of them; else the class as a whole;
  // without any, the lowest row first). A talent the points cannot reach is named with its cost. One click applies it, Undo puts
  // the settled build back. Row order, so a talent's arrow is placed before the talent that hangs on it.
  // Spec, not class, since 28 Sep 2026 (u/Davajey): his Enhancement build's returned Elemental points were filled by Shaman-wide
  // rates, which are mostly casters, so a cast-time talent landed in a melee build. Among Enhancement builds the same tree fills
  // with what Enhancement players actually put there. And a talent only comes back when the road to it (its arrow, the row fillers)
  // is one this spec takes: fewer than one in five of the spec's builds and the road is not paid for, that talent's points go with the rest
  // instead, and the card says which road and the rate (his Call of Thunder now sits behind Elemental Alacrity, 0% of Enhancement).
  function refitPlan(cls){
    const s = state.back; if(!s || s.cls !== cls || s.done || s.refit) return null;
    const trees = DATA[cls].trees, pp = popFor(cls), R = ranksFor(cls).map(t => t.slice()), before = R.map(t => t.slice());
    const ptsIn = before.map(t => t.reduce((a, b) => a + b, 0)), leadTi = ptsIn.indexOf(Math.max(...ptsIn)), lead = trees[leadTi].name;
    const bySpec = pp && prOk(pp, lead) ? pp.pickBy[lead] : null, pick = bySpec || (pp && pp.pick) || null, spec = bySpec ? lead : null;
    let budget = pool(cls) - R.flat().reduce((a, b) => a + b, 0); if(budget <= 0) return null;
    const strays = s.list.filter(b => !b.gone && b.cls === cls).sort((a, b) => trees[a.ti].talents[a.i].row - trees[b.ti].talents[b.i].row);
    if(!strays.length) return null;
    const arrows = new Set(strays.map(b => trees[b.ti].talents[b.i].req).filter(Boolean));   // a stray's arrow fills before anything else in its row
    const above = (ti, row) => trees[ti].talents.reduce((a, t, i) => a + (t.row < row ? R[ti][i] : 0), 0);
    const open = (ti, i) => { const t = trees[ti].talents[i]; if(above(ti, t.row) < (t.row - 1) * 5) return false; if(t.req){ const p = idx(trees[ti], t.req); if(p >= 0 && R[ti][p] < trees[ti].talents[p].max) return false; } return true; };
    const rate = (ti, i) => pick && pick[ti] && pick[ti][i] != null ? pick[ti][i] : null;
    const FLOOR = 20, road = (ti, k) => !spec || (rate(ti, k) || 0) >= FLOOR;   // with spec data, a road fewer than one in five of this spec take is not paid for (28 Sep: live Enhancement builds take Alacrity 15%, Call of Thunder 12%, so 10 let his case through)
    function opening(ti, i, adds){
      const t = trees[ti].talents[i];
      if(t.req){ const p = idx(trees[ti], t.req); if(p >= 0 && R[ti][p] < trees[ti].talents[p].max){ if(!road(ti, p)){ adds.blocked = {ti, i: p, n: trees[ti].talents[p].max - R[ti][p], rate: rate(ti, p) || 0}; return false; } if(!opening(ti, p, adds)) return false; const n = trees[ti].talents[p].max - R[ti][p]; R[ti][p] += n; adds.push({ti, i: p, n, arrow: t.name}); } }
      let need = (t.row - 1) * 5 - above(ti, t.row), guard = 0;
      while(need > 0 && guard++ < 60){ let best = -1, bs = -Infinity;
        trees[ti].talents.forEach((x, k) => { if(x.row < t.row && R[ti][k] < x.max && open(ti, k) && road(ti, k) && !strays.some(z => z.ti === ti && z.i === k)){ const sc = (arrows.has(x.name) ? 1000 : 0) + (rate(ti, k) == null ? 0 : rate(ti, k)) - x.row * 0.01; if(sc > bs){ bs = sc; best = k; } } });
        if(best < 0) return false; R[ti][best]++; need--; const a = adds.find(z => z.ti === ti && z.i === best); if(a) a.n++; else { const of = strays.find(z => trees[z.ti].talents[z.i].req === trees[ti].talents[best].name); adds.push(of ? {ti, i: best, n: 1, arrow: trees[of.ti].talents[of.i].name} : {ti, i: best, n: 1, rate: rate(ti, best)}); } }
      return true;
    }
    const steps = [], cant = [];
    strays.forEach(b => { const save = R.map(t => t.slice()), adds = [], ok = opening(b.ti, b.i, adds), cost = adds.reduce((a, z) => a + z.n, 0) + b.pts;
      if(ok && cost <= budget){ R[b.ti][b.i] += b.pts; budget -= cost; steps.push({b, adds}); }
      else { const need = adds.reduce((a, z) => a + z.n, 0); cant.push({b, need: ok ? need : null, short: ok ? Math.max(1, cost - budget) : null, road: adds.blocked || null}); R.forEach((t, ti) => t.forEach((_, k) => { R[ti][k] = save[ti][k]; })); } });
    if(!steps.length) return null;
    const usedSteps = pool(cls) - budget - before.flat().reduce((a, b) => a + b, 0); let spare = Math.min(budget, Math.max(0, s.n - usedSteps));   // only what came back, never points that were free before
    // what is still left goes on the most-taken open talent in any tree this build already spends in, one at a time, by the same
    // (spec) pick rates, the tree the points came back from winning a tie; without rate data it stays the reader's, and the offer says so
    const extra = [], home = strays[0].ti, homes = trees.map((_, ti) => ti).filter(ti => ptsIn[ti] > 0 || ti === home).sort((a, b) => (a === home ? -1 : 0) - (b === home ? -1 : 0)); let noData = false;
    for(let guard = 0; spare > 0 && guard < 60; guard++){ let best = -1, bt = -1, br = -1;
      homes.forEach(ti => trees[ti].talents.forEach((x, k) => { if(R[ti][k] < x.max && open(ti, k)){ const rk = rate(ti, k); if(rk != null && rk > br){ br = rk; best = k; bt = ti; } } }));
      if(best < 0){ noData = true; break; } R[bt][best]++; budget--; spare--; const a = extra.find(z => z.ti === bt && z.i === best); if(a) a.n++; else extra.push({ti: bt, i: best, n: 1, rate: br}); }
    const used = pool(cls) - budget - before.flat().reduce((a, b) => a + b, 0);
    // left: of the points that came back, how many are still to place (points that were free before stay out of the story)
    return {steps, cant, extra, noData, R, before, used, left: Math.max(0, s.n - used), spec};
  }
  // the offer as short lines: each addition with its reason from the data (the arrow's name, the pick rate), what goes back, then
  // what stays out of reach and its cost
  function refitLines(cls, f){
    const trees = DATA[cls].trees, esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'), tn = (ti, i) => esc(trees[ti].talents[i].name);
    const who = f.spec ? `${esc(f.spec)} builds` : `${cls} builds`;   // whose pick rates: this build's spec when there are enough of them, else the class
    const lines = []; f.steps.forEach(({adds}) => adds.forEach(a => lines.push(`${a.n} in <b>${tn(a.ti, a.i)}</b> <small>${a.arrow ? `${esc(a.arrow)}'s arrow now` : a.rate != null ? `taken by ${a.rate}% of ${who}` : `row ${trees[a.ti].talents[a.i].row}`}</small>`)));
    const backs = f.steps.map(({b}) => `<b>${tn(b.ti, b.i)}</b> ${b.pts}/${trees[b.ti].talents[b.i].max}`), list = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    lines.push(`${lines.length ? 'then ' : ''}${list(backs)} ${backs.length === 1 ? 'goes' : 'go'} back`);
    (f.extra || []).forEach(a => lines.push(`${a.n} more in <b>${tn(a.ti, a.i)}</b> <small>the open ${esc(trees[a.ti].name)} talent most ${who} take, ${a.rate}%</small>`));
    const note = [];
    if(f.left > 0) note.push(`${f.left} point${f.left === 1 ? ' stays' : 's stay'} yours to place${f.noData ? ', nothing in the pick rates to place it by' : ''}.`);
    f.cant.forEach(({b, need, short, road}) => note.push(`<b>${tn(b.ti, b.i)}</b>'s ${b.pts} ${road ? `${b.pts === 1 ? 'goes' : 'go'} with the rest: it needs ${road.n} in ${tn(road.ti, road.i)} now, which ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}` : need ? `would need ${need} more point${need === 1 ? '' : 's'} in ${esc(trees[b.ti].name)} first` : short ? `would take ${short} more free point${short === 1 ? '' : 's'} than there ${short === 1 ? 'is' : 'are'}` : `can't go back with what came back`}.`));
    return {lines, note: note.join(' ')};
  }
  function applyRefit(cls, f){ const r = ranksFor(cls); f.R.forEach((t, ti) => t.forEach((v, i) => { r[ti][i] = v; }));
    const o = state.order[cls] = state.order[cls] || []; f.steps.forEach(({b, adds}) => { adds.forEach(a => { for(let k = 0; k < a.n; k++) o.push([a.ti, a.i]); }); for(let k = 0; k < b.pts; k++) o.push([b.ti, b.i]); }); (f.extra || []).forEach(a => { for(let k = 0; k < a.n; k++) o.push([a.ti, a.i]); }); fixOrder(cls);
    f.after = ranksFor(cls).map(t => t.slice()); state.back.refit = f; render(); track('build_refit', {class: cls, points: f.used}); }
  function undoRefit(cls){ const f = state.back && state.back.refit; if(!f) return; const r = ranksFor(cls); f.before.forEach((t, ti) => t.forEach((v, i) => { r[ti][i] = v; })); fixOrder(cls); state.back.refit = null; render(); }

  // ---------- leveling order: the sequence points were placed in ----------
  state.order = {}; state.orderKnown = {};
  // keep the recorded order in step with the ranks: drop points that were taken back, append any the order never saw (tree order)
  function fixOrder(cls){ const r = ranksFor(cls); const o = state.order[cls] || []; const seen = {}; const keep = [];
    o.forEach(([ti,i]) => { const k = ti+':'+i; seen[k] = (seen[k]||0)+1; if(r[ti] && seen[k] <= r[ti][i]) keep.push([ti,i]); });
    r.forEach((tr,ti) => tr.forEach((v,i) => { const k = ti+':'+i; for(let n = Math.min(seen[k]||0, v); n < v; n++) keep.push([ti,i]); }));
    state.order[cls] = keep; return keep; }
  function renderOrder(){ const box = $('#levelOrder'); if(!box) return; const cls = state.cls, o = fixOrder(cls); box.hidden = !o.length; if(!o.length) return;
    const trees = DATA[cls].trees, seen = {};
    const start = 10 - talentedRank();
    // one line per point: a level chip, the talent, and the rank that point makes
    $('#levelList').innerHTML = o.map(([ti,i], k) => { const t = trees[ti].talents[i], key = ti+':'+i; seen[key] = (seen[key]||0)+1; return `<li><span class="lv">Lv ${start+k}</span><img src="${ICON(t.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" title="${trees[ti].name}"><b>${t.name}</b><span class="rk">${seen[key]}<i>/${t.max}</i></span></li>`; }).join('');
    const tr = talentedRank();
    $('#orderNote').textContent = (tr ? `Talented ${tr}/5 in your Legacy perks: talent points start at level ${10 - tr}. ` : '') + (state.orderKnown[cls] ? 'In the order the points were placed. Take a point back and add it again to move it later in the order.' : 'This build came without an order, so it is listed tree by tree, row by row. Place points yourself and the order follows your clicks.'); }

  // ---------- Legacy: the three account-wide trees, playable, 16 points ----------
  // Registered as a fourth set in DATA so the rules, tooltips, ghost and bottom sheet are the talent ones, not a copy.
  const L = window.LEGACY || null, LBG = {Adventure: 181, Resourcefulness: 381, Professions: 81};
  const LT = L && L.trees ? L.trees.map(t => ({name: t.name, icon: t.icon, bg: LBG[t.name] || 81, talents: t.perks.map(p => Object.assign({}, p, {desc: p.ranks, passive: true}))})) : [];
  DATA.Legacy = {icon: 'inv_misc_map_01', legacy: true, trees: LT};
  state.legacy = LT.map(t => t.talents.map(() => 0)); state.ranks.Legacy = state.legacy;
  try{ const sv = JSON.parse(localStorage.getItem('tf_legacy') || 'null'); if(Array.isArray(sv)) sv.forEach((tr, ti) => (tr || []).forEach((v, i) => { if(state.legacy[ti] && state.legacy[ti][i] !== undefined) state.legacy[ti][i] = Math.min(v|0, LT[ti].talents[i].max); })); }catch(e){}
  const lPts = ti => state.legacy[ti].reduce((a,b)=>a+b,0), lTotal = () => state.legacy.reduce((a,t)=>a+t.reduce((x,y)=>x+y,0),0);
  const lSave = () => { try{ localStorage.setItem('tf_legacy', JSON.stringify(state.legacy)); }catch(e){} };
  function talentedRank(){ if(!LT.length) return 0; const ti = LT.findIndex(t => t.name === 'Adventure'); if(ti < 0) return 0; const i = LT[ti].talents.findIndex(t => t.name === 'Talented'); return i < 0 ? 0 : (state.legacy[ti][i] || 0); }
  function renderLegacy(){
    const host = $('#legacyTrees'); if(!L || !host) return;
    $('#legacyNote').textContent = L.note;
    const sub = $('#legacySub'); if(sub) sub.textContent = lTotal() ? `27 account-wide perks. ${lTotal()} / ${L.points} spent.` : `27 account-wide perks, ${L.points} points.`;
    if(!host.children.length){
      host.classList.add('play');
      LT.forEach((tree, ti) => {
        const el = document.createElement('section'); el.className = 'tree';
        el.innerHTML = `<div class="thead"><img src="${ICON(tree.icon)}" alt="" onerror="iconRetry(this)"><span class="n">${tree.name}<small class="nr"></small></span><span class="c"><b>0</b><span class="of"> / ${L.points}</span></span><button class="tr" title="Reset ${tree.name}" aria-label="Reset ${tree.name}" data-lreset="${ti}">↺</button></div><div class="tbody" style="background-image:url('${BG(tree.bg)}')"></div>`;
        el.querySelector('[data-lreset]').onclick = () => { state.legacy[ti] = tree.talents.map(()=>0); state.ranks.Legacy = state.legacy; lSave(); hideGhost(); renderLegacy(); render(); };
        const body = el.querySelector('.tbody'), grid = document.createElement('div'); grid.className = 'grid'; grid.style.gridTemplateRows = 'repeat(4,64px)';
        tree.talents.forEach((t,i) => {
          const d = document.createElement('div'); d.className = 'talent'; d.tabIndex = t.placeholder ? -1 : 0; d.setAttribute('role','button');
          d.style.gridRow = t.row; d.style.gridColumn = t.col;
          d.innerHTML = `<span class="ab">${abbrev(t.name)}</span><img src="${ICON(t.icon)}" alt="" decoding="async" onerror="iconRetry(this)"><span class="rk"></span><span class="un" aria-hidden="true">−</span>`;
          wireCell(d, ti, i, 'Legacy');
          grid.appendChild(d);
        });
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','arrows');
        body.appendChild(grid); grid.appendChild(svg);
        host.appendChild(el);
      });
    }
    LT.forEach((tree, ti) => {
      const el = host.children[ti]; if(!el) return; const tp = lPts(ti);
      el.querySelector('.thead .c b').textContent = tp; const th = el.querySelector('.thead'); th.style.setProperty('--fill', (100 * tp / L.points) + '%'); th.classList.toggle('spent', tp > 0);
      const gates = [...new Set(tree.talents.map(t => t.gate).filter(Boolean))].sort((a,b)=>a-b), next = gates.find(g => tp < g);
      el.querySelector('.thead .nr').textContent = next ? `next unlock at ${next}` : 'all unlocked';
      const cells = el.querySelectorAll('.talent');
      tree.talents.forEach((t,i) => { const d = cells[i], r = state.legacy[ti][i]; const sel = d.classList.contains('sel'); d.className = 'talent ' + status('Legacy',ti,i) + (t.placeholder ? ' unknown' : '') + (sel ? ' sel' : '') + (staleAt('Legacy',ti,i) ? ' was' : ''); d.setAttribute('aria-label', `${t.name}, rank ${r} of ${t.max}`); d.querySelector('.rk').textContent = `${r}/${t.max}`; });
      const svg = el.querySelector('.arrows'), grid = el.querySelector('.grid'); if(svg && grid && grid.offsetWidth) drawArrows(svg, grid, tree, ti, state.legacy[ti]);
    });
  }

  // ---------- rank text ----------
  function scaleText(text, from, to, t){
    // Estimate a higher rank from the rank shown in the video. Rules, in order:
    // 1. t.scaleIdx (learned from Classic per-rank text or set by hand): only those numeric tokens scale.
    // 2. t.fixed: numbers listed there never scale.
    // 3. Thresholds and durations never scale: numbers after below/under/above/within/up to/over/every/next/first/lasts/for/than/per/as if.
    // 4. If the text has a "% chance", only chance numbers scale. Otherwise percentages, decimals and "by N" integers scale.
    const fixed = new Set((t && t.fixed) || []);
    const idxOnly = t && t.scaleIdx ? new Set(t.scaleIdx) : null;
    // a chance that would scale past 100% is not the number that scales
    const chanceOverflow = [...text.matchAll(/(\d+(?:\.\d+)?)%\s+chance/gi)].some(m => parseFloat(m[1]) * to / from > 100);
    const hasChance = !chanceOverflow && /\d+(?:\.\d+)?%\s+chance/i.test(text);
    let i = -1;
    return text.replace(/(\b(?:by an additional|by up to|by|an additional|a|an|up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)\s+)?(\d+(?:\.\d+)?)(%)?(\s+chance)?/gi, (m, pre, num, pct, chance) => {
      i++;
      const tok = num + (pct||'');
      let ok;
      if(idxOnly) ok = idxOnly.has(i);
      else {
        if(fixed.has(tok)) return m;
        if(chanceOverflow && chance) return m;
        const p = (pre||'').trim().toLowerCase();
        if(/^(up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)$/.test(p)) return m;
        if(hasChance) ok = !!chance;
        else ok = !!pct || /\./.test(num) || /^by/.test(p);
      }
      if(!ok) return m;
      let v = parseFloat(num) * to / from;
      // Classic rounds a per-rank share of a nice total: 3/7/10, 17/33/50, 23/47/70, 8/17/25. If rank 1 looks like such a share, scale to the total instead.
      if(t && t.max && !/\./.test(num) && parseFloat(num) >= 3){ const T = parseFloat(num) * t.max / from; if(T >= 12 && T <= 100 && T % 5 !== 0){ const n5 = Math.round(T/5)*5; if(Math.abs(T - n5) <= 1.5) v = Math.round(n5 * to / t.max); } }
      if(pct && chance && Math.abs(v - 100) <= 1.5) v = 100; if(pct && chance && v > 100) v = 100;
      const out = Number.isInteger(v) ? String(v) : (Math.round(v*10)/10).toFixed(1);
      return (pre||'') + out + (pct||'') + (chance||'');
    });
  }
  function rankText(t, r){
    if(r < 1) return null;
    if(Array.isArray(t.desc)) return { text: t.desc[Math.min(r,t.desc.length)-1], est:false };
    const known = Object.keys(t.desc).map(Number).sort((a,b)=>a-b);
    if(t.desc[r]) return { text: t.desc[r], est:false };
    if(t.est && t.est[r]) return { text: t.est[r], est:true };
    // two read ranks either side of r: interpolate each number that differs between them
    const lo = known.filter(k=>k<r).pop(), hi = known.find(k=>k>r);
    if(lo !== undefined && hi !== undefined){
      const NUMRE = /\d+(?:\.\d+)?/g, a = t.desc[lo].match(NUMRE) || [], b = t.desc[hi].match(NUMRE) || [];
      if(a.length === b.length && a.length){
        let i = -1;
        const text = t.desc[lo].replace(NUMRE, m => { i++; if(a[i] === b[i]) return m; let v = parseFloat(a[i]) + (parseFloat(b[i]) - parseFloat(a[i])) * (r - lo) / (hi - lo); if(!/\./.test(a[i]) && !/\./.test(b[i])) v = Math.abs(v - Math.round(v)) === 0.5 ? Math.round(parseFloat(b[i]) * r / hi) : Math.round(v); return Number.isInteger(v) ? String(v) : (Math.round(v*10)/10).toFixed(1); });
        return { text, est:true };
      }
    }
    const base = known.reduce((b,k)=>Math.abs(k-r)<Math.abs(b-r)?k:b, known[0]);
    return { text: scaleText(t.desc[base], base, r, t), est:true };
  }

  window.__rankText = (cls,ti,i,r) => rankText(DATA[cls].trees[ti].talents[i], r);
  // ---------- URL ----------
  // The link: class/level/ranks-per-tree, then only what there is to carry (three Legacy segments, the leveling order), then a
  // version marker as the last segment. Three generations read, only the newest is written:
  //   v1, before the beta trees (no marker): ranks listed in the old talent order, translated by name through TALENT_ORDER_V1.
  //   v2 ("-2", 17 Sep 2026): one digit per talent in today's order; Legacy rode along whenever an order did; the order as two digits per point.
  //   v3 ("-3", 18 Sep 2026): trailing zeros trimmed from every digit segment, Legacy only when a perk is set, and the order as one symbol
  //   per run of points in the same talent, with a digit 1-4 after it when the run stops short of the build's total for that talent.
  //   A 51-point link went from about 200 characters to about 65. The addon (Core.lua) and the Wrapped aggregator read the same three.
  //   v4 ("-4", 24 Sep 2026): the same shape as v3, written against the trees of build 70009. That build removed Improved Holy Strike and
  //   Crusade and swapped two Shaman rows, so talent indexes moved; -2 and -3 codes are read in their own order (TALENT_ORDER_V3) and
  //   translated by name, with renames (TALENT_RENAMES) so Mangle's points land on Primal Bite.
  //   v5 ("-5", 1 Oct 2026): the same shape, written against the trees of build 70170. That build replaced Hot Streak and Soul Harvesting
  //   with Heating Up and Soul Harvest, removed King of the Jungle and added Shifting Power and Improved Shifting Power to Feral, so the
  //   Mage, Warlock and Druid indexes moved; -4 codes are read in their own order (TALENT_ORDER_V4) and translated by name the same way.
  //   v6 ("-6", 2 Oct 2026): the same shape, written against the 70170 trees with the server hotfixes of 1 to 2 Oct. Those hotfixes
  //   reshaped Warrior Fury and Protection (Lingering Rage, Furious Precision and Gore Drinker in; Improved Cleave, Boundless Rage,
  //   Precision and Toughness out; Iron Will across to Protection), so the Warrior indexes moved; -5 codes are read in their own order
  //   (TALENT_ORDER_V5) and translated by name the same way.
  const CODE_V = '6', SYMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz056789';   // one symbol per talent, flat across the trees; 1-4 are run counts
  const trim0 = s => s.replace(/0+$/, '');
  const flatTalents = cls => DATA[cls].trees.flatMap((t,ti) => t.talents.map((_,i) => [ti,i]));
  const orderCodeOf = (cls, r, o) => { if(!o || !o.length) return ''; const left = r.map(t => t.slice()), idx = {}; flatTalents(cls).forEach(([ti,i], f) => { idx[ti+':'+i] = f; }); let out = '';
    for(let k = 0; k < o.length;){ const [ti,i] = o[k]; let n = 1; while(k + n < o.length && o[k+n][0] === ti && o[k+n][1] === i) n++; const f = idx[ti+':'+i]; if(f !== undefined && left[ti][i] > 0) out += SYMS[f] + (n < left[ti][i] ? n : ''); if(left[ti]) left[ti][i] -= n; k += n; } return out; };
  const orderFromCode = (cls, s, r, at) => { at = at || flatTalents(cls); const o = [], taken = {}; for(let k = 0; k < s.length; k++){ const f = SYMS.indexOf(s[k]); if(f < 0 || !at[f]) continue; const [ti,i] = at[f], key = ti+':'+i; let n = (r[ti][i] || 0) - (taken[key] || 0); if(/^[1-4]$/.test(s[k+1] || '')){ n = Math.min(n, +s[k+1]); k++; } for(let x = 0; x < n; x++) o.push([ti,i]); taken[key] = (taken[key] || 0) + n; } return o; };
  const makeCode = (cls, level, ranks, legacy, order) => { const lg = legacy && legacy.some(t => t.some(v => v > 0)) ? '-' + legacy.map(t => trim0(t.join(''))).join('-') : '', oc = orderCodeOf(cls, ranks, order);
    return `${cls.toLowerCase()}/${level}/${ranks.map(t => trim0(t.join(''))).join('-')}${lg}${oc ? '-' + oc : ''}-${CODE_V}`; };
  const encode = () => { const cls = state.cls; return makeCode(cls, state.level, ranksFor(cls), LT.length ? state.legacy : null, state.orderKnown[cls] ? fixOrder(cls) : []); };
  const oldOrder = cls => window.TALENT_ORDER_V1 && window.TALENT_ORDER_V1[cls];
  const orderV3 = cls => window.TALENT_ORDER_V3 && window.TALENT_ORDER_V3[cls];
  const orderV4 = cls => window.TALENT_ORDER_V4 && window.TALENT_ORDER_V4[cls];
  const orderV5 = cls => window.TALENT_ORDER_V5 && window.TALENT_ORDER_V5[cls];
  // where each talent of an older order sits now, by name; a renamed talent answers to its old name too, a gone one to nothing
  function byNameNow(cls){
    const byName = {}, rn = window.TALENT_RENAMES || {};
    DATA[cls].trees.forEach((t,ti) => t.talents.forEach((x,i) => { byName[x.name] = [ti, i]; }));
    Object.keys(rn).forEach(o => { if(byName[rn[o]] && !byName[o]) byName[o] = byName[rn[o]]; });
    return byName;
  }
  // ranks listed in an older order -> the same talents wherever they sit now, into r (a talent that is gone hands its points back)
  function fromOldOrder(cls, treesOld, get, r, old, lost){
    old = old || oldOrder(cls); const trees = DATA[cls].trees, byName = byNameNow(cls); r = r || ranksFor(cls);
    treesOld.forEach((s,ti) => { if(!old[ti]) return; for(let i = 0; i < s.length; i++){ const at = old[ti][i] && byName[old[ti][i]]; if(!at){ if(lost && old[ti][i] && get(s, i) > 0) lost.push({name: old[ti][i], pts: get(s, i), tree: (trees[ti] || {}).name || '', icon: goneIcon(cls, old[ti][i])}); continue; } r[at[0]][at[1]] = Math.min(get(s, i), trees[at[0]].talents[at[1]].max); } });
  }
  // the icon a gone talent had, from the tracker's own row for it
  // a talent another took the place of is a replaced row (build_updates.py), its icon in beforeIcon, so the settle card's chip has a picture
  const goneIcon = (cls, name) => { for(const e of (window.UPDATES || [])){ const rows = (e.talents || {})[cls] || []; const row = rows.find(r => r.kind === 'gone' && r.talent === name); if(row) return row.icon; const rep = rows.find(r => r.kind === 'replaced' && r.before === name); if(rep && rep.beforeIcon) return rep.beforeIcon; } return ''; };
  // a leveling order written against an older order -> the same talents now (a point on a gone talent is dropped)
  const orderFromOld = (cls, old, pairs) => { const byName = byNameNow(cls); return pairs.map(([ti,i]) => old[ti] && old[ti][i] && byName[old[ti][i]]).filter(Boolean); };
  // A class's Popular data made on the trees of build 69876 (its build codes end -2 or -3) names talents that are gone or renamed and lists
  // pick rates in that order; carry both to today's talents by name once, the first time the class is drawn. A list whose codes end -4 was
  // made on the trees of build 70009 and is carried through that order (TALENT_ORDER_V4), one ending -5 on the 70170 file trees through
  // TALENT_ORDER_V5 (the 1 to 2 Oct hotfixes reshaped Warrior). A list from the counter on today's trees (-6) is current.
  function popFor(cls){
    const pp = window.POPULAR && POPULAR.classes && POPULAR.classes[cls]; if(!pp || pp._fixed) return pp;
    const tail = pp.top && pp.top.length ? ((/-(\d)$/.exec(pp.top[0].code || '') || [])[1] || '1') : '1';
    const old = tail === '5' ? orderV5(cls) : tail === '4' ? orderV4(cls) : orderV3(cls), by = byNameNow(cls), rn = window.TALENT_RENAMES || {}, nm = n => rn[n] || n, oldForm = tail !== '6';
    if(oldForm){
      ['most', 'least'].forEach(k => { if(pp[k]) pp[k] = pp[k].filter(r => by[nm(r[1])]).map(r => [r[0], nm(r[1]), r[2]]); });
      if(pp.pick && old && pp.pick.length === old.length && pp.pick.every((t,ti) => t.length === old[ti].length)){
        const np = DATA[cls].trees.map(t => t.talents.map(() => null));
        old.forEach((names,ti) => names.forEach((n,i) => { const at = by[n]; if(at && pp.pick[ti][i] != null) np[at[0]][at[1]] = pp.pick[ti][i]; })); pp.pick = np;
        if(pp.pickBy) for(const k in pp.pickBy){ const g = pp.pickBy[k], ng = DATA[cls].trees.map(t => t.talents.map(() => null)); old.forEach((names,ti) => names.forEach((n,i) => { const at = by[n]; if(at && g[ti] && g[ti][i] != null) ng[at[0]][at[1]] = g[ti][i]; })); pp.pickBy[k] = ng; }
      }
    }
    // a listed build that today's rules refuse (made before a patch moved its talents) is left out and counted: the fold never hands out a
    // build the game will not take. The counter leaves them out at source since 25 Sep; this covers the older lists and the gap between deploys
    if(pp.top && pp.top.length){ let out = 0; pp.top = pp.top.filter(b => { const q = parseCode(b.code); const bad = q ? judge(q.cls, q.ranks).length : 1; if(bad) out++; return !bad; }); pp.top.forEach((b, k) => { b.rank = k + 1; }); pp.stale = (pp.stale || 0) + out; }
    pp._fixed = true; return pp;
  }
  // any generation of code -> { cls, level, ranks, legacy (null when the code carried none), order } or null. The page is untouched.
  function parseCode(h){
    const m = /^#?([a-z ]+)\/(\d+)\/([0-9A-Za-z-]*)$/i.exec(decodeURIComponent(h||'')); if(!m) return null;
    const cls = CLASSES.find(c=>c.toLowerCase()===m[1].toLowerCase()); if(!cls) return null;
    const trees = DATA[cls].trees, nt = trees.length, all = m[3].split('-'), last = all[all.length - 1];
    const v = all.length > nt && ['2', '3', '4', '5', '6'].includes(last) ? +last : 1, segs = v > 1 ? all.slice(0, -1) : all;
    const r = trees.map(t => t.talents.map(() => 0)), digits = (s, row, max) => [...(s || '')].forEach((c,i) => { if(row[i] !== undefined) row[i] = Math.min(+c||0, max(i)); }), gone = [];
    const o3 = (v === 2 || v === 3) ? orderV3(cls) : v === 4 ? orderV4(cls) : v === 5 ? orderV5(cls) : null;   // a code written against older trees: -2/-3 before build 70009, -4 before 70170, -5 before the 1 to 2 Oct hotfixes
    if(v === 1 && oldOrder(cls)) fromOldOrder(cls, segs.slice(0, nt), (s, i) => +s[i] || 0, r, null, gone);
    else if(o3) fromOldOrder(cls, segs.slice(0, nt), (s, i) => +s[i] || 0, r, o3, gone);
    else segs.slice(0, nt).forEach((s,ti) => { if(r[ti]) digits(s, r[ti], i => trees[ti].talents[i].max); });
    const extra = segs.slice(nt), lgSegs = extra.length >= 3 ? extra.slice(0, 3) : null, oSeg = extra.length >= 4 ? extra[3] : (v >= 3 && extra.length === 1 ? extra[0] : '');
    let legacy = null; if(lgSegs && LT.length){ legacy = LT.map(t => t.talents.map(() => 0)); lgSegs.forEach((s,ti) => { if(legacy[ti]) digits(s, legacy[ti], i => LT[ti].talents[i].max); }); }
    let order = [];
    if(o3){   // read the order in the code's own talent order, then carry each point to where that talent sits now
      const rOld = o3.map(t => t.map(() => 0)); segs.slice(0, nt).forEach((s,ti) => { if(rOld[ti]) digits(s, rOld[ti], () => 9); });
      let oOld = [];
      if(v >= 3) oOld = orderFromCode(cls, oSeg, rOld, o3.flatMap((t,ti) => t.map((_,i) => [ti,i])));
      else for(let k = 0; k + 1 < oSeg.length; k += 2){ const x = +oSeg.slice(k, k + 2), ti = Math.floor(x / 20), i = x % 20; if(o3[ti] && o3[ti][i]) oOld.push([ti, i]); }
      order = orderFromOld(cls, o3, oOld);
    }
    else if(v >= 3) order = orderFromCode(cls, oSeg, r);
    else for(let k = 0; k + 1 < oSeg.length; k += 2){ const x = +oSeg.slice(k, k + 2), ti = Math.floor(x / 20), i = x % 20; if(trees[ti] && trees[ti].talents[i]) order.push([ti, i]); }
    return { cls, level: Math.min(60, Math.max(10, +m[2]||60)), ranks: r, legacy, order, gone };
  }
  // the same build makes the same code whichever generation it was saved or pasted as, so a saved build still reads as current
  // (settled too, since 25 Sep: a saved build from before a patch is the same build as the settled one on the trees, so it still reads as current)
  const canonCode = c => { const p = parseCode(c); if(!p) return c; const keep = state.ranks[p.cls]; state.ranks[p.cls] = p.ranks; try{ settle(p.cls); } finally{ state.ranks[p.cls] = keep; } return makeCode(p.cls, p.level, p.ranks, p.legacy, p.order); };
  function decode(h){
    const p = parseCode(h); if(!p) return;
    state.cls = p.cls; state.level = p.level;
    const r = ranksFor(p.cls); p.ranks.forEach((t,ti) => t.forEach((v,i) => { if(r[ti] && r[ti][i] !== undefined) r[ti][i] = v; }));
    if(p.legacy) p.legacy.forEach((t,ti) => t.forEach((v,i) => { if(state.legacy[ti] && state.legacy[ti][i] !== undefined) state.legacy[ti][i] = v; }));
    state.order[p.cls] = p.order; state.orderKnown[p.cls] = p.order.length > 0;
    settled(p.cls, settle(p.cls).concat(p.legacy ? settle('Legacy') : []), p.gone);
  }

  // ---------- render ----------
  const treesEl = $('#trees'), tip = $('#tip');
  const abbrev = n => { const w = n.replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean); return w.length===1 ? w[0].slice(0,3) : w.slice(0,3).map(x=>x[0]).join(''); };
  // ---------- tracker helpers, shared by the What's new drawer and the /builds page ----------
  const TRACK = (() => {
    const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const nice = d => { const [y,m,dd] = d.split('-'); return `${+dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`; };
    const KIND = {new: 'New', replaced: 'Replaced', renamed: 'Renamed', gone: 'Gone', moved: 'Moved', prereq: 'Arrow', ranks: 'Ranks', text: 'Text', icon: 'Icon', tree: 'Tab'};
    const GLYPH = {new: '+', replaced: '&#8646;', renamed: '&#8646;', gone: '&minus;', moved: '&#8644;', prereq: '&#8627;', ranks: '#', text: '&#9998;', icon: '&#9707;', tree: '&#8942;'};
    const ORDER = ['new','replaced','renamed','gone','moved','prereq','ranks','tree','text','icon'], MAJOR = new Set(['new','replaced','renamed','gone','moved','prereq','ranks','tree']);
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`, cicon = c => ICON(DATA[c] ? DATA[c].icon : 'class_' + c.toLowerCase());
    // spellbook rows (e.spells, since 25 Sep) sit beside the talent rows of their class; older entries have no spells field
    const spellsOf = (e, c) => (e.spells || {})[c] || [], classRows = (e, c) => (e.talents[c] || []).concat(spellsOf(e, c)).map(r => (r._c = c, r));
    const all = e => [...Object.values(e.talents).flat(), ...Object.values(e.spells || {}).flat(), ...e.racials, ...e.legacy], total = e => e.counts.talents + (e.counts.spells || 0) + e.counts.racials + e.counts.legacy;
    const count = rs => { const k = {}; rs.forEach(r => { k[r.kind] = (k[r.kind] || 0) + 1; }); return k; };
    const lv = r => 5 * r + 5;   // row r opens once 5(r-1) points are in the tree; points start at level 10, so the first point in row r lands at level 5r+5
    const ranksWord = rs => { if(!rs || !rs.length) return ''; if(rs.length === 1) return 'rank ' + rs[0]; const run = rs.length > 2 && rs.every((x, i) => !i || x === rs[i - 1] + 1); return run ? `ranks ${rs[0]} to ${rs[rs.length - 1]}` : 'ranks ' + rs.slice(0, -1).join(', ') + ' and ' + rs[rs.length - 1]; };
    // plain words: one sentence per class, built from the structural rows; every talent named carries its icon
    // rest(r) is what happened, after the name; say(r) is the name and the rest as one line
    const rest = (r, place) => { if(r.spell){ switch(r.kind){
        case 'new': return `is a new spell${r.level ? ` <span class="soft">(from level ${r.level})</span>` : ''}`;
        case 'renamed': return `is the new name of ${esc(r.before)}`;
        case 'gone': return `is gone from the spellbook`;
        case 'ranks': return esc(r.text.replace(/\.$/, '').toLowerCase()); } }
      switch(r.kind){
      case 'replaced': return `takes ${esc(r.before)}'s spot in ${esc(r.tree)}${r.row ? ` <span class="soft">from level ${lv(r.row)}</span>` : ''}${r.desc ? ` <span class="soft">${esc(r.desc.replace(/\.$/, ''))}</span>` : ''}`;
      case 'renamed': return `is the new name of ${esc(r.before)}`;
      case 'new': return place ? `is new for ${esc(r.tree)}` : `is new in ${esc(r.tree)}, row ${r.row} <span class="soft">(from level ${lv(r.row)})</span>`;
      case 'gone': return `is gone from ${esc(r.tree)}`;
      case 'moved': return r.fromTree !== r.tree ? `moved from ${esc(r.fromTree)} to ${esc(r.tree)}` : r.fromRow !== r.row ? `moved from row ${r.fromRow} to row ${r.row} in ${esc(r.tree)} <span class="soft">(reachable from level ${lv(r.row)} instead of ${lv(r.fromRow)})</span>` : `slid along row ${r.row} in ${esc(r.tree)}`;
      case 'prereq': return r.req ? `now needs ${esc(r.req)} first` : `no longer needs ${esc(r.oldReq)}`;
      case 'ranks': return esc(r.text.replace(/\.$/, '').toLowerCase());
      case 'tree': return esc(r.text.replace(/\.$/, ''));
      default: return esc(r.text); } };
    const say = r => r.kind === 'tree' ? rest(r) : `<img class="ti" src="${ICON(r.icon)}" alt=""><span class="nm">${esc(r.talent)}</span> ${rest(r)}`;
    const sentence = parts => parts.length === 1 ? parts[0] + '.' : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] + '.';
    // a small map per class: each tree as a dot grid, with the change marked where it happened
    const miniMap = (cls, rs) => { const trees = DATA[cls] ? DATA[cls].trees : []; if(!trees.length) return '';
      const C = 9, G = 3, W = 4 * C + 3 * G, H = 7 * C + 6 * G, cx = c => (c - 1) * (C + G) + C / 2, cy = r => (r - 1) * (C + G) + C / 2;
      return `<span class="mm" aria-hidden="true">${trees.map(t => { const dots = t.talents.map(x => `<circle cx="${cx(x.col)}" cy="${cy(x.row)}" r="2.2" class="d"/>`).join('');
        const marks = rs.filter(r => r.row && (r.tree === t.name || r.fromTree === t.name)).map(r => { switch(r.kind){
          case 'gone': return `<g class="m gone"><line x1="${cx(r.col) - 3.2}" y1="${cy(r.row) - 3.2}" x2="${cx(r.col) + 3.2}" y2="${cy(r.row) + 3.2}"/><line x1="${cx(r.col) + 3.2}" y1="${cy(r.row) - 3.2}" x2="${cx(r.col) - 3.2}" y2="${cy(r.row) + 3.2}"/></g>`;
          case 'new': case 'replaced': return `<circle class="m new" cx="${cx(r.col)}" cy="${cy(r.row)}" r="3.6"/>`;
          case 'moved': if(r.fromTree === t.name && r.tree === t.name) return `<g class="m moved"><line x1="${cx(r.fromCol)}" y1="${cy(r.fromRow)}" x2="${cx(r.col)}" y2="${cy(r.row)}"/><circle cx="${cx(r.fromCol)}" cy="${cy(r.fromRow)}" r="2.6" class="from"/><circle cx="${cx(r.col)}" cy="${cy(r.row)}" r="3.6"/></g>`;
            return r.tree === t.name ? `<circle class="m moved" cx="${cx(r.col)}" cy="${cy(r.row)}" r="3.6"/>` : `<circle class="m from" cx="${cx(r.fromCol)}" cy="${cy(r.fromRow)}" r="2.6"/>`;
          default: return ''; } }).join('');
        return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>${esc(t.name)}</title>${dots}${marks}</svg>`; }).join('')}</span>`; };
    // a tooltip change, read from its own diff: 'numbers' when a number moved (5 to 3 stacks, 10% to 20%), 'wording' when only the words did.
    // Both count for players; only icon swaps stay under the hood. Number words (one, two...) are read as digits so "1" to "one" is not a number change.
    // Read once per row from the diff itself and remembered on the row: sub is 'numbers' when a number was swapped for another number
    // ("15" to "20", "10%" to "20%", a damage range), else 'wording'; text is what it did in a few words.
    const UNITS = 'sec cooldown|sec cast|sec|min cooldown|min|yd range|yards?|yds|yd|times|stacks?|points?|targets?|charges?|hours?|Mana|Rage|Energy|Health', NUM = /^\d+(?:\.\d+)?%?$/, wc = s => s ? s.trim().split(/\s+/).length : 0;
    const bare = w => w.replace(/[.,;:!]+$/, ''), trimEdge = s => s.replace(/^(and|or|,)\s+/i, '').replace(/[.,;]$/, ''), q = s => `&ldquo;${esc(trimEdge(s))}&rdquo;`, rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // shared words at either edge of a pair are not part of the change ("damage." / "damage and increases...": the change is the addition)
    const refine = ([o, n]) => { const A = o ? o.split(/\s+/) : [], B = n ? n.split(/\s+/) : []; while(A.length && B.length && bare(A[0]) === bare(B[0])){ A.shift(); B.shift(); } while(A.length && B.length && bare(A[A.length - 1]) === bare(B[B.length - 1])){ A.pop(); B.pop(); } return [A.join(' '), B.join(' ')]; };
    const isNum = ([o, n]) => NUM.test(bare(o)) && NUM.test(bare(n));
    const read = r => { if(r._an) return r._an; if(r.kind !== 'text' || r.before == null) return (r._an = {sub: r.kind, text: ''});
      let P = wordDiff(r.before, r.after).pairs.slice();
      // the diff splits on spaces, so "Mangle" to "Primal Bite" comes out as two pairs; pairs that sit side by side in the text are one change
      for(let i = 0; i + 1 < P.length;){ const o = (P[i][0] + ' ' + P[i + 1][0]).trim(), n = (P[i][1] + ' ' + P[i + 1][1]).trim();
        if((!o || r.before.includes(o)) && (!n || r.after.includes(n)) && (o || n)) P.splice(i, 2, [o, n]); else i++; }
      P = P.map(refine).filter(([o, n]) => o || n);
      // "spell" to "and Holy Strike spells" is an insertion with a plural, not a swap: the old word survives at the end of the new run
      P = P.map(([o, n]) => { const w = n ? n.split(/\s+/) : [], last = w.length ? bare(w[w.length - 1]) : '', bo = bare(o); return o && w.length > 1 && (last === bo || last === bo + 's' || last + 's' === bo) ? ['', w.slice(0, -1).join(' ')] : [o, n]; });
      // a damage range that moved both ends ("106 to 134" now "150 to 192") reads as one change, not two
      for(let i = 0; i + 1 < P.length; i++){ if(isNum(P[i]) && isNum(P[i + 1]) && r.before.includes(`${bare(P[i][0])} to ${bare(P[i + 1][0])}`) && r.after.includes(`${bare(P[i][1])} to ${bare(P[i + 1][1])}`)){ P.splice(i, 2, [`${bare(P[i][0])} to ${bare(P[i + 1][0])}`, `${bare(P[i][1])} to ${bare(P[i + 1][1])}`, 'range']); } }
      const nums = P.filter(p => p[2] === 'range' || isNum(p)), rest = P.filter(p => !(p[2] === 'range' || isNum(p)));
      const moved = rest.reduce((a, [o, n]) => a + Math.max(wc(o), wc(n)), 0), share = moved / Math.max(1, wc(r.before)), big = share > .35 ? 'reworked' : 'reworded';
      const numPart = p => { const [o, n, tag] = p; if(tag === 'range') return `<del>${esc(o)}</del> is now <ins>${esc(n)}</ins>`; const u = r.after.match(new RegExp('(?:^|[^\\d.])' + rx(bare(n)) + '\\s+(' + UNITS + ')\\b', 'i')); return `${esc(bare(o))} to ${esc(bare(n))}${u ? ' ' + esc(u[1]) : ''}`; };
      let text;
      if(nums.length) text = share > .35 ? 'reworked' : nums.map(numPart).join(', ') + (rest.length ? ' and reworded' : '');   // "15 to 20 sec", "5 to 3 times and reworded"; a rewrite that also moved a number is just reworked
      else if(!P.length) text = 'reworded';
      else if(moved <= 2 && !/\d/.test(P.map(p => p[0] + p[1]).join('')) && P.every(([o, n]) => !o || !n)) text = 'a word changed';   // a typo fixed, an "it" dropped
      else if(P.length <= 3 && P.every(([o, n]) => !o && wc(n) <= 14)) text = 'adds ' + P.map(([, n]) => q(n)).join(' and ');   // clean additions: adds "Does not break crowd control"
      else if(P.length <= 3 && P.every(([o, n]) => !n && wc(o) <= 14)) text = 'drops ' + P.map(([o]) => q(o)).join(' and ');
      else if(P.length === 1 && wc(P[0][0]) <= 3 && wc(P[0][1]) <= 3 && !/^(and|or)\b/i.test(P[0][1])) text = `<del>${esc(bare(P[0][0]))}</del> is now <ins>${esc(bare(P[0][1]))}</ins>`;   // one clean short swap: Mangle is now Primal Bite
      else if(P.length === 1 && wc(P[0][0]) <= 8 && wc(P[0][1]) <= 14) text = `<del>${esc(bare(P[0][0]))}</del> <ins>${esc(bare(P[0][1]))}</ins>`;   // a longer swap reads as the diff itself
      else text = big;
      return (r._an = {sub: nums.length ? 'numbers' : 'wording', text}); };
    const sub = r => read(r).sub, delta = r => read(r).text;
    const nm = r => `<img class="ti" src="${ICON(r.icon)}" alt=""><span class="nm">${esc(r.talent)}</span>`;
    // One place's rows as a small ledger: a label per group (the tree moves, the numbers, the wording, the spells) and one line per
    // change, the name in bold and what happened after it. Racials and Legacy name the race or tree beside the name when it differs.
    // The words themselves, under every tooltip change: the sentence(s) that changed with the edit marked, or Was and Now when the
    // whole thing was rewritten. Open when the caller asks (the reader's own card), a tap away elsewhere.
    const sents = s => String(s || '').split(/(?<=[.!?])\s+/);
    // a diff that keeps punctuation as its own token, so "vendors," and "vendors." are the same word and only the comma clause is marked
    const diffHtml = (a, b) => { const tok = s => String(s || '').match(/\s+|[A-Za-z0-9'%\/\-’]+|[^\sA-Za-z0-9]/g) || [];
      const A = tok(a), B = tok(b), n = A.length, m = B.length, L = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
      for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      let i = 0, j = 0, o = '', w = '', h = ''; const flush = () => { h += o.trim() ? `<del>${esc(o)}</del>` : esc(o); h += w.trim() ? `<ins>${esc(w)}</ins>` : esc(w); o = ''; w = ''; };
      while(i < n && j < m){ if(A[i] === B[j]){ flush(); h += esc(A[i]); i++; j++; } else if(L[i + 1][j] >= L[i][j + 1]) o += A[i++]; else w += B[j++]; }
      o += A.slice(i).join(''); w += B.slice(j).join(''); flush(); return h; };
    const textOf = r => { const A = sents(r.before), B = sents(r.after);
      if(A.length === B.length && !/^reworked$/.test(delta(r))){ const ch = B.map((b, i) => [A[i], b]).filter(([a, b]) => a.trim() !== b.trim()); if(ch.length && ch.length <= 2) return `<span class="bd">${ch.map(([a, b]) => diffHtml(a, b)).join(' ')}</span>`; }
      return `<span class="bd two"><span class="was"><b>Was</b> ${esc(r.before)}</span><span class="now"><b>Now</b> ${esc(r.after)}</span></span>`; };
    // the three sources, each with its mark: the short take on the name line, Blizzard's words under a blue flag, the beta files under a scroll
    // the Blizzard mark is the small blue glyph their forum shows beside staff posts, kept as assets/blizzard.svg (their staff blue, #00aeff)
    const SVG = {flag: '<img class="bz" src="/assets/blizzard.svg?v=c16b77d5" alt="" width="20" height="14">', file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3M6.2 8h4.6M6.2 11h4.6"/></svg>'};
    const fold = (r, open) => `<details class="wn"${open ? ' open' : ''}><summary class="src file"><i><img class="sc" src="${ICON('inv_scroll_03')}" alt="" width="18" height="18"></i><b>In the tooltip</b><span class="lpill"><span class="show">Show</span><span class="hide">Hide</span></span></summary>${textOf(r)}</details>`;
    // Blizzard's own line for a change, when the build's notes have one for that name (e.blue.lines, keyed by talent, spell or racial)
    let BLUE = null;   // the shown build's notes, set by the caller before rendering a ledger
    // Blizzard's line beside a row: a BLUE key may end |kind (text, prereq, moved) to pin the line to one row of a talent that has several; a name-only line never backs an arrow (prereq) row
    const blueOf = r => { if(!BLUE || !BLUE.lines) return ''; const t = (r.line && BLUE.lines[r.talent + '|line']) || (!r.line && (BLUE.lines[r.talent + '|' + r.kind] || (r.kind !== 'prereq' && BLUE.lines[r.talent]))) || ''; return t ? `<span class="src blue"><i>${SVG.flag}</i><span><b>Blizzard</b> ${esc(t)}</span></span>` : ''; };
    // One statement per change. Blizzard's sentence when they wrote one, otherwise the site's short take; the beta-file tooltip is a
    // tap away either way, and only opens on its own when the short take could only say "reworked" or "reworded".
    // what the ability says now (rank 1): the row's own after-text, else the talent from the trees, else the spellbook, else what the row knows
    const tipOf = r => { if(r.kind === 'gone') return r.desc || r.before || ''; if(r.kind === 'text' && r.after) return r.after; const c = r._c;
      if(r.spell){ const S = window.SPELL_DESC || {}; const k = Object.keys(S).find(k => k.indexOf(c + '|' + r.talent + '|') === 0); if(k && S[k].d) return S[k].d; }
      else if(c && DATA[c]){ for(const t of DATA[c].trees){ const x = t.talents.find(x => x.name === r.talent); if(x){ const d = x.desc; const s = Array.isArray(d) ? d[0] : d && d['1']; if(s) return s; } } }
      return r.before || r.desc || r.text || ''; };
    const attr = s => esc(s).replace(/"/g, '&quot;');
    const line = (r, place) => { if(r.kind === 'tree') return `<li class="bare"><span class="what">${rest(r)}</span></li>`;
      const where = place && place !== r.tree ? ` <small>${esc(r.tree)}</small>` : '', ranks = r.spell && r.ranks && r.ranks.length > 1 ? ` <small>${ranksWord(r.ranks)}</small>` : '';
      const hasText = r.kind === 'text' && r.before != null, blue = blueOf(r), vague = hasText && /^(reworked|reworded)$/.test(delta(r));
      const what = blue ? ranks : ` <span class="what">${r.kind === 'text' ? delta(r) + ranks : rest(r, place)}</span>`;
      return `<li><img class="ti" src="${ICON(r.icon)}" alt="" data-name="${attr(r.talent)}" data-tip="${attr(tipOf(r))}"${r.kind === 'gone' ? ' data-gone="1"' : ''}><span><b>${esc(r.talent)}</b>${where}${what}${blue}${hasText ? fold(r, !blue && vague) : ''}</span></li>`; };
    // groups: [title, rows, place?]; a group with no rows is left out
    const ledger = (groups, open) => groups.filter(g => g[1].length).map(([t, g, place]) => `<div class="ledg"><h5>${t}</h5><ul>${g.map(r => line(r, place, open)).join('')}</ul></div>`).join('');
    const setBlue = b => { BLUE = b || null; };
    // The rest of Blizzard's notes for a build (e.notes, from data/blizzard_notes.json): what no tooltip shows, in their words, checked
    // against the post when the data was written (tools/check_blizzard_notes.py). Read at a glance: a colour key, then each place opens
    // on a row of coloured counts; inside, the lines sit under a few headers (plays differently, how it works, fixed, in a later build,
    // known bugs), one ability per line with its icon and name, lines about the same ability merged, numbers lit, the developers' note a
    // tap away. What the build's files do not carry yet folds under one line, sorted into new, removed, moved, arrows and reworked; a
    // talent no build carries yet has no icon to show, so it gets an empty talent slot. Never the first thing in a panel.
    const NSEC = [['rule', 'Plays differently', "Blizzard says it plays this way now. The tooltip doesn't say so."], ['info', 'How it works', 'How the game handles it, from Blizzard.'],
      ['fix', 'Fixed', 'Blizzard fixed it in the game.'], ['later', 'In a later build', "In Blizzard's notes for this build, in the game files from a later build."], ['known', 'Known bugs', "On Blizzard's known issues list for this build."]];
    const NSHAPE = [['new', 'New talents', '+'], ['gone', 'Removed', '&minus;'], ['moved', 'Moved', '&#8644;'], ['arrow', 'Arrows', '&#8627;'], ['rework', 'Reworked', '&#9998;']];
    const NPEND = "In Blizzard's notes, not in this build's game files yet.";
    const NHOT = "In Blizzard's notes for this build, in the game as server hotfixes and not in its files. The trees here carry them.";
    const NWORD = {rule: ['plays differently', 'play differently'], info: ['how it works', 'how it works'], fix: ['fixed', 'fixed'], later: ['in a later build', 'in a later build'], known: ['known bug', 'known bugs'], pending: ['not in the game files yet', 'not in the game files yet'], hotfix: ['in the game by hotfix', 'in the game by hotfix']};
    const NKINDS = [...NSEC.map(z => z[0]), 'hotfix', 'pending'];
    const nword = (k, n) => (NWORD[k] || [k, k])[n === 1 ? 0 : 1];
    const bshort = b => String(b || '').replace(/^1\.60\.1\./, '');
    const lit = t => esc(t).replace(/\d+(?:[.,\/]\d+)*%?/g, m => `<b class="nn">${m}</b>`);
    const raceIcon = r => { for(const side of Object.values(window.RACIALS || {})) if(Array.isArray(side)){ const x = side.find(x => x && x.race === r); if(x) return ICON(x.icon); } return ''; };
    const nic = x => x.i ? `<img class="ti" src="${ICON(x.i)}" alt="" loading="lazy">` : `<span class="ti nslot" title="No icon yet: no build's game files carry this talent"></span>`;
    const notesOf = (e, p) => e && e.notes ? e.notes.lines.filter(x => x.p === p) : [];
    // lines about the same ability, of the same kind, become one item with each of Blizzard's sentences under its name
    const merge = xs => { const out = []; xs.forEach(x => { const m = out.find(o => o.n === x.n && o.k === x.k && o.s === x.s); if(m) m.q.push(x); else out.push({n: x.n, i: x.i, k: x.k, s: x.s, b: x.b, q: [x]}); }); return out; };
    const item = o => `<li class="nl">${nic(o)}<div><b class="nnm">${esc(o.n || '')}${o.k === 'later' && o.b ? ` <small class="nlater">in build ${esc(bshort(o.b))}</small>` : ''}</b>${o.q.map(x => `<span class="nq${o.q.length > 1 ? ' many' : ''}">${lit(x.t)}</span>`).join('')}${o.q.filter(x => x.d).map(x => `<details class="ndev"${o.k === 'info' ? ' open' : ''}><summary>Developers' notes</summary><span>${esc(x.d)}</span></details>`).join('')}</div></li>`;
    const chips = xs => { const c = {}; xs.forEach(x => { c[x.k] = (c[x.k] || 0) + 1; }); return `<span class="nchips">${NKINDS.filter(k => c[k]).map(k => `<i class="c-${k}" title="${c[k]} ${nword(k, c[k])}">${c[k]}</i>`).join('')}</span>`; };
    // the lines that describe a tree change fold under one line, sorted into new, removed, moved, arrows and reworked: the ones a build's
    // files do not carry yet (pending), and the ones the game serves as server hotfixes over the build (hotfix, in the trees here)
    const shapeFold = (xs, N, kind, title, why) => { if(!xs.length) return ''; const gs = [...new Set(xs.map(x => x.g || ''))];
      const body = gs.map(g => { const ps = xs.filter(x => (x.g || '') === g), gd = g && N.groups && N.groups[g];
        return `<div class="npg">${g ? `<h6>${esc(g)}</h6>` : ''}${gd ? `<details class="ndev"><summary>Developers' notes</summary><span>${esc(gd)}</span></details>` : ''}` +
          NSHAPE.map(([k, w, gl]) => { const os = merge(ps.filter(x => (x.s || 'rework') === k)); return os.length ? `<div class="nshape s-${k}"><p><i>${gl}</i>${w}</p><ul>${os.map(item).join('')}</ul></div>` : ''; }).join('') + `</div>`; }).join('');
      return `<details class="npend"><summary><span class="nhd c-${kind}">${title}</span><b>${xs.length}</b>${gs.some(Boolean) ? ` <small>${gs.filter(Boolean).map(esc).join(' and ')}</small>` : ''}<span class="nicons">${xs.filter(x => x.i).slice(0, 7).map(x => `<img src="${ICON(x.i)}" alt="">`).join('')}</span></summary><p class="nwhy">${esc(why)}</p>${body}</details>`; };
    const pendFold = (pend, N) => shapeFold(pend, N, 'pending', 'Not in the game files yet', N.pending || NPEND);
    const hotFold = (hot, N) => shapeFold(hot, N, 'hotfix', 'In the game by hotfix', N.hotfixed || NHOT);
    const nbody = (xs, N) => NSEC.map(([k, w, help]) => { const os = merge(xs.filter(x => x.k === k)); return os.length ? `<div class="nsec"><p class="nhd c-${k}" title="${attr(help)}">${w}<small>${xs.filter(x => x.k === k).length}</small></p><ul>${os.map(item).join('')}</ul></div>` : ''; }).join('') + hotFold(xs.filter(x => x.k === 'hotfix'), N) + pendFold(xs.filter(x => x.k === 'pending'), N);
    // the whole build: a colour key first, then one fold per place, classes first, then races, every class, and the world
    const notes = e => { if(!e || !e.notes || !e.notes.lines.length) return ''; const N = e.notes, cl = Object.keys(DATA).filter(c => DATA[c] && DATA[c].trees && !DATA[c].legacy);
      const races = [...new Set(N.lines.filter(x => x.p.slice(0, 5) === 'race:').map(x => x.p))];
      const places = [...cl.map(c => [c, c, cicon(c)]), ...races.map(r => [r, esc(r.slice(5)), raceIcon(r.slice(5))]), ['all', 'Every class', ICON('inv_misc_book_09')], ['world', 'Leveling, items and the world', ICON('inv_misc_map_01')]].filter(([p]) => notesOf(e, p).length);
      const kinds = NKINDS.filter(k => N.lines.some(x => x.k === k));
      const key = `<p class="nkey">${kinds.map(k => `<span><i class="c-${k}"></i>${nword(k, 2)}</span>`).join('')}</p>`;
      return `<div class="bnotes">${key}` + places.map(([p, t, ic]) => { const xs = notesOf(e, p); return `<details class="bcls nb" data-npl="${attr(p)}"><summary>${ic ? `<img src="${ic}" alt="">` : ''}<b>${t}</b>${chips(xs)}</summary>${nbody(xs, N)}</details>`; }).join('') +
        `<p class="nsrc"><a href="${attr(N.url)}" target="_blank" rel="noopener"><i class="bflag">${SVG.flag}</i>${esc(N.title)} &rsaquo;</a></p></div>`; };
    // one class or race in the reader's card: a single closed line with its counts; open, the same headers, then (for a class) every class
    const notesFor = (e, p) => { if(!e || !e.notes || !p) return ''; const isCls = !!(DATA[p] && DATA[p].trees && !DATA[p].legacy), own = notesOf(e, p), every = isCls ? notesOf(e, 'all') : [], all = own.concat(every); if(!all.length) return '';
      return `<details class="ynotes"><summary><i class="bflag">${SVG.flag}</i><b>Blizzard's notes</b><small>not in a tooltip</small>${chips(all)}</summary>` +
        nbody(own, e.notes) + (every.length ? `<div class="nevery"><p class="nev">Every class</p>${nbody(every, e.notes)}</div>` : '') + `</details>`; };
    const tell = (rs, place) => { const ts = rs.filter(r => !r.spell), sp = rs.filter(r => r.spell);
      return ledger([[place ? 'New or gone' : 'In the trees', ts.filter(r => MAJOR.has(r.kind)), place], ['Numbers', ts.filter(r => sub(r) === 'numbers'), place], ['Wording', ts.filter(r => sub(r) === 'wording'), place], ['Spells', sp, place]]); };
    const words = e => { const out = [];
      Object.keys(DATA).filter(c => DATA[c] && DATA[c].trees && !DATA[c].legacy).forEach(c => { const m = classRows(e, c).filter(r => r.kind !== 'icon'), st = m.filter(r => !r.spell && MAJOR.has(r.kind)); if(m.length) out.push(`<li><img class="ci" src="${cicon(c)}" alt=""><span class="txt"><b>${c}.</b> ${tell(m)}</span>${st.length ? miniMap(c, st) : ''}</li>`); });
      const rn = e.racials.filter(r => r.kind !== 'icon'); if(rn.length) out.push(`<li><img class="ci" src="${ICON(rn[0].icon)}" alt=""><span class="txt"><b>Racials.</b> ${tell(rn, 'Racials')}</span></li>`);
      const ln = e.legacy.filter(r => r.kind !== 'icon'); if(ln.length) out.push(`<li><img class="ci" src="${ICON('inv_misc_map_01')}" alt=""><span class="txt"><b>Legacy.</b> ${tell(ln, 'Legacy')}</span></li>`);
      const k = count(all(e)); if(k.icon) out.push(`<li class="under"><i>&#9707;</i><span class="txt">Under the hood: ${plural(k.icon, 'icon')} refreshed. Icons only; open Every change to see each one.</span></li>`);
      return out.length ? `<div class="bp-words"><h4>In plain words</h4><ul>${out.join('')}</ul><p class="mmkey"><i class="k1"></i> new or replaced <i class="k2"></i> gone <i class="k3"></i> moved</p></div>` : ''; };
    return {esc, nice, KIND, GLYPH, ORDER, MAJOR, plural, cicon, all, total, count, lv, say, sentence, miniMap, words, sub, delta, tell, ledger, setBlue, SVG, spellsOf, classRows, ranksWord, notes, notesFor};
  })();
  // ---------- what's new drawer ----------
  (function(){
    const LOG = window.CHANGELOG || [], btn = $('#whatsNew'), dr = $('#logDrawer'), back = $('#logBack'), list = $('#logList');
    { const w = $('#wnlink'); if(w) w.onclick = () => btn.click(); }   // the pill under How it works opens the same drawer
    if(!btn || !dr || !LOG.length){ if(btn) btn.hidden = true; return; }
    const ls = { get(k){ try{ return localStorage.getItem(k) || ''; }catch{ return ''; } }, set(k,v){ try{ localStorage.setItem(k, v); }catch{} } };
    const UPD0 = (window.UPDATES || [])[0], latest = [LOG[0].date, UPD0 ? UPD0.date : ''].sort().pop(), seen = ls.get('log_seen');
    btn.classList.toggle('unread', seen < latest);
    const nice = d => { const [y,m,dd] = d.split('-'); return `${+dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`; };
    let last = ''; list.innerHTML = LOG.map(e => { const hd = e.date !== last ? `<li class="dd">${nice(e.date)}</li>` : ''; last = e.date; return `${hd}<li><b>${e.title}</b><span>${e.text}</span></li>`; }).join('');
    // ---------- Beta builds tab: what each client build changed, straight from the data diff (updates.js) ----------
    // A glance first: headline, class strip, the structural changes. Wording and icon changes fold away under one line.
    const UPD = window.UPDATES || [], bl = $('#buildLog'), esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const KIND = TRACK.KIND, GLYPH = TRACK.GLYPH, ORDER = TRACK.ORDER, MAJOR = TRACK.MAJOR;
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const row = (r, cls) => { const ic = r.kind === 'icon' && r.before ? `<span class="ic2"><img src="${ICON(r.before)}" alt=""><i>&rarr;</i><img src="${ICON(r.icon)}" alt=""></span>` : `<img src="${ICON(r.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
      const body = r.kind === 'text' && r.before != null ? (TRACK.delta(r) === 'reworked' ? `<span class="bd two"><span class="was"><b>Was</b> ${esc(r.before)}</span><span class="now"><b>Now</b> ${esc(r.after)}</span></span>` : `<span class="bd">${wordDiff(r.before, r.after).bothH}</span>`) : r.kind === 'icon' ? '' : `<span class="t">${esc(r.text)}</span>`;
      const where = `<small>${cls ? esc(cls) + ' · ' : ''}${esc(r.tree)}${r.spell ? ' · spell' : ''}</small>`;
      return `<li class="k-${r.kind}"><div class="ic">${ic}</div><div><b>${esc(r.talent)}</b>${where}<span class="kb k-${r.kind}"><i>${GLYPH[r.kind] || ''}</i>${KIND[r.kind] || r.kind}${r.kind === 'text' && r.rank ? ' · ' + (r.spell && r.ranks ? TRACK.ranksWord(r.ranks) : 'rank ' + r.rank) : ''}${r.line ? ' · cost line' : ''}</span>${body}</div></li>`; };
    const count = rs => { const k = {}; rs.forEach(r => { k[r.kind] = (k[r.kind] || 0) + 1; }); return k; };
    const headline = e => { const all = [...Object.values(e.talents).flat(), ...e.racials, ...e.legacy], k = count(all); if(!all.length) return 'Nothing on the site changed.';
      const bits = []; if(k.new) bits.push(plural(k.new, 'new talent')); if(k.gone) bits.push(`${k.gone} removed`); if(k.moved) bits.push(`${k.moved} moved`); if(k.prereq) bits.push(plural(k.prereq, 'arrow') + ' changed'); if(k.ranks) bits.push(plural(k.ranks, 'rank cap') + ' changed'); if(k.tree) bits.push(plural(k.tree, 'tab') + ' renamed');
      const soft = []; if(k.text) soft.push(plural(k.text, 'tooltip') + ' reworded'); if(k.icon) soft.push(plural(k.icon, 'icon') + ' refreshed');
      const big = Object.entries(e.talents).map(([c, rs]) => [c, rs.length]).sort((a, b) => b[1] - a[1]).slice(0, 2);
      return `<b>${bits.length ? bits.join(', ') + '.' : 'No tree changes.'}</b>${soft.length ? ' ' + soft.join(' and ') + '.' : ''}${big.length ? ` Most touched: ${big.map(([c, n]) => `${c} (${n})`).join(', ')}.` : ''}`; };
    // one bar per class, segments coloured by kind, widest bar = the class with most changes
    const strip = (e, id) => { const ents = Object.entries(e.talents); if(!ents.length) return ''; const max = Math.max(...ents.map(([, rs]) => rs.length));
      return `<div class="cstrip">${ents.map(([c, rs]) => { const k = count(rs); const segs = ORDER.filter(x => k[x]).map(x => `<i class="k-${x}" style="flex:${k[x]}" title="${k[x]} ${(KIND[x] || x).toLowerCase()}"></i>`).join('');
        return `<button type="button" class="cbar" data-cls="${c}" data-card="${id}"><img src="${ICON(DATA[c] ? DATA[c].icon : 'class_' + c.toLowerCase())}" alt=""><span class="cn">${c}</span><span class="bar" style="width:${Math.round(100 * rs.length / max)}%">${segs}</span><span class="n">${rs.length}</span></button>`; }).join('')}</div>`; };
    const firstWith = UPD.find(e => e.counts.talents + e.counts.racials + e.counts.legacy > 0);
    const card = (e, id) => { const total = e.counts.talents + e.counts.racials + e.counts.legacy, first = e === firstWith;
      const majors = [...Object.entries(e.talents).flatMap(([c, rs]) => rs.filter(r => MAJOR.has(r.kind)).map(r => row(r, c))), ...e.racials.filter(r => MAJOR.has(r.kind)).map(r => row(r, 'Racial')), ...e.legacy.filter(r => MAJOR.has(r.kind)).map(r => row(r, 'Legacy'))];
      const minorCls = Object.entries(e.talents).map(([c, rs]) => { const m = rs.filter(r => !MAJOR.has(r.kind)); return m.length ? `<details class="bcls" data-cls="${c}"><summary><img src="${ICON(DATA[c] ? DATA[c].icon : 'class_' + c.toLowerCase())}" alt=""><b>${c}</b><small>${m.length}</small></summary><ul class="brows">${m.map(r => row(r)).join('')}</ul></details>` : ''; }).join('');
      const minorR = e.racials.filter(r => !MAJOR.has(r.kind)), minorL = e.legacy.filter(r => !MAJOR.has(r.kind)), nMinor = minorR.length + minorL.length + Object.values(e.talents).flat().filter(r => !MAJOR.has(r.kind)).length;
      const minor = nMinor ? `<details class="bsec soft"><summary>Wording and icon changes<small>${nMinor}</small></summary>${minorCls}${minorR.length ? `<details class="bcls"><summary><b>Racials</b><small>${minorR.length}</small></summary><ul class="brows">${minorR.map(r => row(r)).join('')}</ul></details>` : ''}${minorL.length ? `<details class="bcls"><summary><b>Legacy perks</b><small>${minorL.length}</small></summary><ul class="brows">${minorL.map(r => row(r)).join('')}</ul></details>` : ''}</details>` : '';
      return `<li class="bcard${first ? ' first' : ''}" id="${id}"><div class="bh"><b>${esc(e.build)}</b><span>${nice(e.date)} · ${esc(e.title)}</span></div><p class="bnote">${esc(e.note)}</p>` +
        (total ? `<p class="bhead">${headline(e)}</p>${strip(e, id)}` + (majors.length ? `<details class="bsec" open><summary>What moved in the trees<small>${majors.length}</small></summary><ul class="brows major">${majors.join('')}</ul></details>` : '') + minor : `<div class="chips"><i class="quiet">No data changes</i></div>`) + `</li>`; };
    if(UPD.length){
      const fresh = seen ? UPD.filter(e => e.date > seen) : UPD, nfresh = fresh.reduce((a, e) => a + e.counts.talents + e.counts.racials + e.counts.legacy, 0);
      const since = seen ? `<li class="since"><b>Since you were here</b> (${nice(seen)}): ${fresh.length ? `${plural(fresh.length, 'build')} checked, ${nfresh ? plural(nfresh, 'change') + ' on the site' : 'nothing changed on the site'}.` : 'no new builds.'}</li>` : `<li class="since"><b>Every beta build</b> is checked against the site the day it lands. This is what each one changed.</li>`;
      const key = `<li class="bkey"><i class="k-new">+ new</i><i class="k-gone">&minus; gone</i><i class="k-moved">&#8644; moved</i><i class="k-prereq">&#8627; arrow</i><i class="k-text">&#9998; text</i><i class="k-icon">&#9707; icon</i></li>`;
      bl.innerHTML = since + `<li class="bkey"><a class="bp-link" href="/builds">Open the full breakdown, build by build &rsaquo;</a></li>` + key + UPD.map((e, i) => card(e, 'bld' + i)).join('');
      // a class bar opens that class's wording changes and scrolls to them
      bl.addEventListener('click', ev => { const b = ev.target.closest('.cbar'); if(!b) return; const c = document.getElementById(b.dataset.card); const soft = c.querySelector('.bsec.soft'); const d = c.querySelector(`.bcls[data-cls="${b.dataset.cls}"]`); if(soft) soft.open = true; if(d){ d.open = true; d.scrollIntoView({block: 'start', behavior: 'smooth'}); } });
      const st = $('#buildStamp'); if(st){ st.hidden = false; st.innerHTML = `<span class="dot"></span>Beta build <b>${esc(UPD[0].build)}</b> · checked ${nice(UPD[0].date)} <i>&rsaquo;</i>`; st.onclick = () => track('build_stamp'); }
    }
    // two topics of equal weight: a pair of tiles on top (always visible, they are the selector), the chosen topic's glance below.
    // Everything lives inside the panel: a glance first, then folds for the detail. Nothing links out.
    (function(){ const SW = $('#dswitch'), G = $('#topicGame'), S = $('#topicSite'), body = dr.querySelector('.dbody'); if(!SW || !G || !S || !body) return; const T = TRACK;
      const tot = T.total, short = b => String(b).replace(/^1\.60\.1\./, ''), bname = b => / hotfixes$/.test(b) ? `the ${short(b)}` : `build ${short(b)}`, cls = Object.keys(DATA).filter(c => DATA[c] && DATA[c].trees && !DATA[c].legacy);
      const UPD0 = UPD[0], lastReal = UPD.find(e => tot(e) > 0), gameFresh = !!(seen && UPD0 && seen < UPD0.date), siteFresh = !!seen && seen < LOG[0].date, nSite = seen ? LOG.filter(e => e.date > seen).length : 0;
      // six plain buckets instead of nine kinds: what arrived, what left, what moved, what plays by new rules, whose numbers moved, whose wording did.
      // Every row counts except an icon swap, and racials and Legacy count the same as talents, so a build that only retunes a racial still shows at the top.
      const BUCKET = {added: ['new', 'replaced'], removed: ['gone'], moved: ['moved'], rules: ['prereq', 'ranks', 'tree'], numbers: [], wording: []}, BWORD = {added: 'added', removed: 'removed', moved: 'moved', rules: 'rule changes', numbers: 'numbers', wording: 'wording'};
      const BTITLE = {added: 'with talents added', removed: 'with talents removed', moved: 'with talents moved', rules: 'with talents under new rules', numbers: 'with numbers changed', wording: 'with wording changed'};
      const BHELP = {added: 'new talents and spells', removed: 'talents and spells taken out', moved: 'talents in a new row or tree', rules: 'arrows, rank caps and tab names', numbers: 'a number in the tooltip changed', wording: 'the words changed, no number did'};
      // one plain glyph per kind, so the buckets read at a glance: plus, minus, two arrows, a branch, a hash, a pen
      const GLYPH6 = {added: '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>', removed: '<svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg>', moved: '<svg viewBox="0 0 16 16"><path d="M2 5.5h10l-2.5-2.5M14 10.5H4l2.5 2.5"/></svg>',
        rules: '<svg viewBox="0 0 16 16"><path d="M4 2v6a3 3 0 0 0 3 3h5M9.5 8.5l2.5 2.5-2.5 2.5"/></svg>', numbers: '<svg viewBox="0 0 16 16"><path d="M6 2 4.5 14M11.5 2 10 14M3 6h11M2 10h11"/></svg>', wording: '<svg viewBox="0 0 16 16"><path d="M3 13l1-3.5L11.5 2 14 4.5 6.5 12zM10 3.5l2.5 2.5"/></svg>'};
      let kf = '';   // bucket filter chosen in the key
      const inB = (r, k) => r.kind !== 'icon' && (!k || BUCKET[k].includes(r.kind) || T.sub(r) === k);
      // a place is a class, a race ('race:Gnome') or the Legacy tree; each gets an icon in the pick rows and a spot of its own
      const RACE = {}; Object.values(window.RACIALS || {}).forEach(side => (Array.isArray(side) ? side : []).forEach(x => { if(x && x.race) RACE[x.race] = x.icon; }));
      const isRace = key => key.slice(0, 5) === 'race:', keyName = key => key === 'Legacy' ? 'Legacy perks' : isRace(key) ? key.slice(5) : key;
      const keyIcon = key => key === 'Legacy' ? ICON('inv_misc_map_01') : isRace(key) ? ICON(RACE[key.slice(5)] || 'inv_misc_questionmark') : T.cicon(key);
      const rowsOf = (e, key, k) => { if(!e || !key) return []; const rs = key === 'Legacy' ? e.legacy : isRace(key) ? e.racials.filter(r => r.tree === key.slice(5)) : T.classRows(e, key); return rs.filter(r => inB(r, k)); };
      const places = e => { if(!e) return []; const races = []; e.racials.forEach(r => { if(r.kind !== 'icon' && !races.includes(r.tree)) races.push(r.tree); }); return races.map(x => 'race:' + x).concat(e.legacy.some(r => r.kind !== 'icon') ? ['Legacy'] : []); };
      const playerN = (e, k) => e ? cls.concat(places(e)).reduce((n, key) => n + rowsOf(e, key, k).length, 0) : 0;
      const major = (e, c, k) => rowsOf(e, c, k), treeN = playerN;
      const day = d => nice(d).replace(/ \d{4}$/, '');
      const days = [...Array(7)].map((_, i) => new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10)), perDay = days.map(d => LOG.filter(e => e.date === d).length), maxDay = Math.max(1, ...perDay), weekN = perDay.reduce((x, y) => x + y, 0);
      const spark = `<span class="spark" aria-hidden="true">${perDay.map((n, i) => `<i class="${n ? 'on' : ''}${i === 6 ? ' today' : ''}" style="height:${n ? Math.max(30, Math.round(100 * n / maxDay)) : 14}%"></i>`).join('')}</span>`;
      const cdots = e => `<span class="cdots" aria-hidden="true">${cls.map(c => `<i class="${major(e, c).length ? 'on' : ''}"></i>`).join('')}</span>`;
      const lastB = UPD.slice(0, 7).reverse(), maxB = Math.max(1, ...lastB.map(b => treeN(b))), padB = Array(Math.max(0, 7 - lastB.length)).fill(null);
      const bspark = `<span class="bspark" aria-hidden="true">${[...padB, ...lastB].map(b => !b ? '<i class="none"></i>' : `<i class="${treeN(b) ? 'on' : 'flat'}${b === UPD0 ? ' now' : ''}" style="height:${treeN(b) ? Math.max(30, Math.round(100 * treeN(b) / maxB)) : 14}%"></i>`).join('')}</span>`;
      const gameBig = !UPD0 ? 'No builds yet' : playerN(UPD0) ? `${playerN(UPD0)} change${playerN(UPD0) === 1 ? '' : 's'}` : tot(UPD0) ? 'Icons only' : 'No changes';
      SW.innerHTML = `<button type="button" class="tile game" data-go="game"><span class="tk"><span class="tic logo" aria-hidden="true"><img src="/assets/wow-forever.png" alt=""></span>In the game${gameFresh ? '<i class="dot"></i>' : ''}</span><span class="tb">${gameBig}</span><span class="ts">${UPD0 ? `${matchMedia('(max-width:640px)').matches ? '' : 'latest: '}${esc(bname(UPD0.build))} · ${day(UPD0.date)}` : ''}</span>${bspark}</button>` +
        `<button type="button" class="tile site" data-go="site"><span class="tk"><span class="tic" aria-hidden="true"><img src="/assets/book-round.png" alt=""></span>On the site${siteFresh ? '<i class="dot"></i>' : ''}</span><span class="tb">${nSite ? nSite + ' new' : (seen ? 'Up to date' : weekN + ' this week')}</span><span class="ts">${esc(LOG[0].title)}</span>${spark}</button>`;
      // ---- the game, at a glance
      let shown = lastReal || UPD0;
      // ---- one pick, one ledger. Tap a class, a race or Legacy and its changes show underneath: the short line, Blizzard's line
      // and the tooltip itself. The last pick is remembered (tf_place); a first visit takes the class page they came in on, or the
      // class this build touched most. No combining: a race's racials sit under the race, the Legacy perks under Legacy.
      const RACES = Object.values(window.RACIALS || {}).flat().filter(x => x && x.race);
      const PL = {Orc: 'Orcs', Undead: 'Undead', Tauren: 'Tauren', Troll: 'Trolls', Human: 'Humans', Dwarf: 'Dwarves', 'Night Elf': 'Night Elves', Gnome: 'Gnomes'};
      const plural = r => PL[r] || (/Skyborne/.test(r) ? r : r + 's');
      const placeRows = (b, p, k) => { if(!b || !p) return []; const rs = p === 'Legacy' ? b.legacy : isRace(p) ? b.racials.filter(r => r.tree === p.slice(5) || r.tree.indexOf(p.slice(5) + ' ') === 0) : T.classRows(b, p); return rs.filter(r => inB(r, k)); };
      // nothing is picked until the reader taps: no guess, no memory, so the icons with badges read as the things to tap
      let picked = '';
      const place = () => picked;
      const pickRow = (label, items, on, kind) => `<div class="lens-row ${kind || ''}"><small>${label}</small><div class="lens-icons">${items.map(x => `<button type="button" class="${x.n ? '' : 'quiet'}${x.id === on ? ' on' : ''}" data-place="${esc(x.id)}" title="${esc(x.name)}: ${x.n ? T.plural(x.n, 'change') : 'nothing here'}" aria-pressed="${x.id === on}"><img src="${x.icon}" alt="${esc(x.name)}">${x.n ? `<span class="n">${x.n}</span>` : ''}</button>`).join('')}</div></div>`;
      const placeCard = (e, sumH) => { const p = place(e), m = placeRows(e, p, kf), n = m.length, prev = UPD[UPD.indexOf(e) + 1], isCls = cls.includes(p), isR = isRace(p);
        const clsItems = cls.map(x => ({id: x, name: x, icon: T.cicon(x), n: placeRows(e, x, kf).length}));
        const raceItem = x => ({id: 'race:' + x.race, name: x.race, icon: ICON(x.icon), n: placeRows(e, 'race:' + x.race, kf).length});
        const sides = Object.entries(window.RACIALS || {}).filter(([, rs]) => Array.isArray(rs) && rs.length);
        const rows = `<p class="pick lens-hint">Tap a class, a race or Legacy to see its changes</p>` + pickRow('Class', clsItems, p, 'cls') + sides.map(([side, rs]) => pickRow(side, rs.filter(x => x && x.race).map(raceItem), p, 'inl')).join('') +
          pickRow('Legacy', [{id: 'Legacy', name: 'Legacy perks', icon: ICON('inv_misc_map_01'), n: placeRows(e, 'Legacy', kf).length}], p, 'inl');
        if(!p) return `<div class="lens unpicked" id="gameLens">${rows}</div>`;
        const name = isCls ? p : isR ? plural(p.slice(5)) : 'Legacy perks', what = isCls ? `${esc(p)} talent and spell` : isR ? `${esc(p.slice(5))} racial` : 'Legacy perk';
        const t = m.filter(r => !r.spell), s = m.filter(r => r.spell);
        const parts = isCls ? [[t.length, 'talent'], [s.length, 'spell']].filter(([x]) => x).map(([x, w]) => T.plural(x, w)).join(', ') : T.plural(n, isR ? 'racial' : 'perk');
        const head = `<div class="yh"><img class="ci" src="${keyIcon(p)}" alt=""><div><b>${esc(name)}</b><span>${n ? `${n} change${n === 1 ? '' : 's'} in ${esc(bname(e.build))}${isCls ? ': ' + parts : ''}` : `nothing changed in ${esc(bname(e.build))}`}${kf ? ` <i>(${BWORD[kf]} only)</i>` : ''}</span></div></div>`;
        const body = n ? T.ledger(isCls ? [['Talents', t, ''], ['Spells', s, '']] : [[isR ? `${esc(p.slice(5))} racials` : 'Legacy perks', m, isR ? p.slice(5) : 'Legacy']], true) : '';
        const map = isCls && t.some(r => T.MAJOR.has(r.kind)) ? T.miniMap(p, t.filter(r => T.MAJOR.has(r.kind))) : '';
        const sure = kf ? `Only the ${BWORD[kf]} rows are shown; clear the filter above for all of it.` : prev ? (n ? `That's every ${what} ${esc(bname(e.build))} touched, compared with ${esc(bname(prev.build))}.` : `Every ${what} reads the same as in ${esc(bname(prev.build))}.`) :
          `Compared with what the BlizzCon demo showed; the spellbooks came whole with this build.`;
        const more = isCls ? ` <a class="more" href="#" data-lines="${esc(p)}">Every ${esc(p)} line &rsaquo;</a>` : '';
        // picked: the summary rides inside the lens so desktop can stack it under the picks while the ledger fills the right column
        return `<div class="lens" id="gameLens">${rows}<div class="you" id="gameYou">${head}${body}${map}${T.notesFor(e, p)}<p class="ysure">${sure}${more}</p></div>${sumH || ''}</div>`; };
      const youCount = b => { const p = place(shown); return p ? placeRows(b, p, '').length : -1; };
      const youWord = () => { const p = place(shown); return cls.includes(p) ? `for ${p}s` : isRace(p) ? `for ${plural(p.slice(5))}` : 'in Legacy'; };
      const lines = e => { const grp = (title, icon, rs) => rs.length ? `<details class="bcls"><summary>${icon ? `<img src="${icon}" alt="">` : ''}<b>${title}</b><small>${rs.length}</small></summary><ul class="brows">${rs.map(r => row(r)).join('')}</ul></details>` : '';
        return cls.map(c => grp(c, T.cicon(c), T.classRows(e, c))).join('') + grp('Racials', '', e.racials) + grp('Legacy', '', e.legacy); };
      const drawGame = () => { const e = shown; if(!e){ G.innerHTML = '<p class="hl">No beta build checked yet.</p>'; return; } T.setBlue(e.blue);
        // the builds, compact: number and date on each node, one small line under the chosen one only; quiet builds are just dim dots
        const tl = `<p class="pick">Beta builds</p><ol class="btl slim" aria-label="Beta builds, latest first">${UPD.slice(0, 5).map(b => `<li class="${tot(b) ? 'hot' : ''}${b === e ? ' on' : ''}"><button type="button" data-build="${esc(b.build)}" title="${/ hotfixes$/.test(b.build) ? `The ${esc(b.build)}` : `Build ${esc(b.build)}`}, ${esc(nice(b.date))}: ${tot(b) ? T.plural(playerN(b), 'change') + ' for players' : 'no changes'}"><i></i><b>${esc(short(b.build))}</b><small>${day(b.date)}</small>${b === e ? `<em>${[b === UPD0 ? 'latest' : '', tot(b) ? (youCount(b) < 0 ? '' : youCount(b) ? `${youCount(b)} ${youWord()}` : `none ${youWord()}`) : 'no changes'].filter(Boolean).join(' · ')}</em>` : ''}</button></li>`).join('')}</ol>`;
        if(!tot(e)){ G.innerHTML = tl + `<div class="sum quiet"><div class="sumhead"><b>0</b><span>changes for players in ${esc(bname(e.build))}. Checked file by file.</span></div></div>` + (e.notes && e.notes.lines.length ? `<details class="deeper" id="gameNotes"><summary><span>Beyond the tooltips</span><small>${e.notes.lines.length} from Blizzard's notes</small></summary>${T.notes(e)}</details>` : ''); return; }
        const n = playerN(e), nc = cls.filter(c => rowsOf(e, c).length).length, pl = places(e), nr = pl.filter(isRace).length, nl = pl.includes('Legacy'), bk = Object.keys(BUCKET).map(k => [k, playerN(e, k)]).filter(([, v]) => v);
        const where = [nc ? `<b>${nc}</b> class${nc === 1 ? '' : 'es'}` : '', nr ? `<b>${nr}</b> race${nr === 1 ? '' : 's'}` : '', nl ? 'the Legacy tree' : ''].filter(Boolean);
        const sum = n ? `<div class="sum"><div class="sumhead"><b>${n}</b><span>change${n === 1 ? '' : 's'} for players across ${T.sentence(where).replace(/\.$/, '')}</span></div>` +
          `<div class="sumbar">${bk.map(([k, v]) => `<i class="b-${k}" style="flex:${v}" title="${v} ${BWORD[k]}"></i>`).join('')}</div>` +
          `<div class="sumleg">${bk.map(([k, v]) => `<span class="b-${k}" title="${BHELP[k]}"><i class="g">${GLYPH6[k]}</i><b>${v}</b> ${BWORD[k] === 'rule changes' ? 'rules' : BWORD[k]}</span>`).join('')}</div></div>` :
          `<div class="sum quiet"><div class="sumhead"><b>0</b><span>changes for players in ${esc(bname(e.build))}. ${tot(e)} icon swap${tot(e) === 1 ? '' : 's'}, nothing that plays differently.</span></div></div>`;
        const nIcon = T.all(e).filter(r => r.kind === 'icon').length, nAll = tot(e);
        const later = UPD.slice(0, UPD.indexOf(e)), why = later.length && later.every(b => !tot(b)) ? `<p class="whyold">The latest, ${esc(bname(UPD0.build))}, changed nothing for players. This is ${esc(bname(e.build))}, the last one that did.</p>` : '';
        // sources sit at the foot, after the folds: the beta client files the build was read from, and Blizzard's notes when they wrote some
        const prevB = UPD[UPD.indexOf(e) + 1];
        const sources = `<p class="sources"><b>Sources</b> ${e.source ? esc(e.source) : `Beta client ${esc(e.build)}${prevB ? `, compared with ${esc(prevB.build)}` : ''}, read file by file.`}${e.blue && e.blue.url ? ` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${T.SVG.flag}</i>Blizzard's notes for this build &rsaquo;</a>` : ''}</p>`;
        // order: the builds, then the thing to tap and what it opens, then the whole build in one sentence and a bar, then every line, then sources
        const nN = e.notes ? e.notes.lines.length : 0;
        const beyond = nN ? `<details class="deeper" id="gameNotes"><summary><span>Beyond the tooltips</span><small>${nN} from Blizzard's notes</small></summary>${T.notes(e)}</details>` : '';
        G.innerHTML = tl + why + placeCard(e, sum) + (picked ? '' : sum) +
          `<details class="deeper" id="gameLines"><summary><span>Every change</span><small>${nAll}${nIcon ? `, ${nIcon} of them icons` : ''}</small></summary><div class="lines">${lines(e)}</div></details>` + beyond + sources; };
      G.addEventListener('click', ev => { const nb = ev.target.closest('.btl button'); if(nb){ const b = UPD.find(x => x.build === nb.dataset.build); if(b){ shown = b; kf = ''; picked = ''; if(dr.__focus) dr.__focus(false); drawGame(); track('changelog_build', {build: b.build}); } return; }
        const ln = ev.target.closest('.you a.more'); if(ln){ ev.preventDefault(); const gl = $('#gameLines'); if(gl){ gl.open = true; const d = [...gl.querySelectorAll('.bcls')].find(x => x.querySelector('summary b') && x.querySelector('summary b').textContent === ln.dataset.lines); if(d){ d.open = true; d.scrollIntoView({block: 'start', behavior: 'smooth'}); } } track('changelog_lines', {cls: ln.dataset.lines}); return; }
        const lb = ev.target.closest('.lens-icons button'); if(lb){ picked = picked === lb.dataset.place ? '' : lb.dataset.place; track('changelog_place', {place: picked || 'none'}); if(dr.__focus) dr.__focus(!!picked);
          drawGame(); const yo = $('#gameYou'); if(yo) yo.scrollIntoView({block: 'nearest', behavior: 'smooth'}); return; } });
      drawGame(); dr.__redraw = () => { kf = ''; drawGame(); }; dr.__unfocus = () => { picked = ''; if(dr.__focus) dr.__focus(false); drawGame(); };
      // rest a mouse on an ability's icon in a ledger and its tooltip, as it reads now, floats beside it; gone on leave, click or scroll
      { let pop = null, over = null;
        const hide = () => { if(pop) pop.remove(); pop = null; over = null; };
        const show = t => { hide(); if(!t.dataset.tip) return; over = t; pop = document.createElement('div'); pop.className = 'tippop'; const gone = t.dataset.gone === '1';
          pop.innerHTML = `<img src="${t.src}" alt=""><b>${esc(t.dataset.name)}</b><small>${gone ? 'Gone. It read:' : 'Reads now:'}</small><span>${esc(t.dataset.tip)}</span>`; document.body.appendChild(pop);
          const r = t.getBoundingClientRect(), w = Math.min(340, innerWidth - 24), above = r.top - 8 - pop.offsetHeight > 8;
          pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px'; pop.style.top = (above ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + 'px'; pop.classList.toggle('under', !above); };
        // by pointer, not by device (a Surface has both): a mouse or trackpad hovers it in and out, a finger taps it in and taps elsewhere out
        let shownAt = 0, byTouch = false; const show2 = (t, touch) => { show(t); shownAt = Date.now(); byTouch = touch; };
        document.addEventListener('pointerover', ev => { if(ev.pointerType !== 'mouse') return; const t = ev.target.closest('.ledg img.ti[data-tip]'); if(t && t !== over) show2(t, false); });
        document.addEventListener('pointerout', ev => { if(ev.pointerType !== 'mouse' || byTouch) return; if(over && ev.relatedTarget && !over.contains(ev.relatedTarget)) hide(); });
        document.addEventListener('click', ev => { const t = ev.target.closest('.ledg img.ti[data-tip]'); if(t){ ev.preventDefault(); if(t !== over || byTouch === false) show2(t, true); } else hide(); }, true);
        document.addEventListener('scroll', () => { if(Date.now() - shownAt > 600) hide(); }, {passive: true, capture: true}); }
      // ---- the site, at a glance
      const plain = t => t.replace(/<[^>]+>/g, ''), first = t => { const x = plain(t); const m = x.match(/^.{20,160}?[.!?](\s|$)/); return (m ? m[0] : x.slice(0, 140) + (x.length > 140 ? '\u2026' : '')).trim(); };
      // what an entry is about, from its own words (an entry can say tag: 'builds' to settle it): the spine colour and icon
      const TOPIC = {talents: ['Talents', '<path d="M12 2.5l2.6 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17l-5.9 3.6 1.6-6.7L2.5 9.4l6.9-.6z"/>'],
        spells: ['Spells', '<path d="M4 5.5c2.7-1.2 5.3-1.2 8 0v13c-2.7-1.2-5.3-1.2-8 0zM12 5.5c2.7-1.2 5.3-1.2 8 0v13c-2.7-1.2-5.3-1.2-8 0z"/>'],
        builds: ['Builds', '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>'],
        site: ['The site', '<path d="M4 5h16v14H4zM4 9h16M8 13h8M8 16h5"/>']};
      const RULES = [['site', /^(stream layout|what's new|class buttons|pages turn|theorycraft|building on a phone)/i, true], ['builds', /\b(share[ds]?|sharing|saved builds?|my builds|wrapped|popular builds|share cards?)\b/i], ['spells', /\b(spellbooks?|racials?|legacy|abilit(y|ies)|totems?|spells?)\b/i], ['talents', /\b(talents?|tooltips?|ranks?|trees?|beta)\b/i], ['site', /\b(phones?|mobile|layout|stream\w*|banner|drawer|buttons?|icons?)\b/i]];
      const topicOf = e => { if(e.tag && TOPIC[e.tag]) return e.tag; for(const [k, r] of RULES) if(r.test(e.title)) return k; const f = first(e.text); for(const [k, r, titleOnly] of RULES) if(!titleOnly && r.test(f)) return k; return 'site'; };
      // the spine's icon: the talent or class the title names, else the topic's own icon
      const NAMEICON = (() => { const m = []; Object.keys(DATA).forEach(c => { if(!DATA[c] || !DATA[c].trees) return; m.push([c, T.cicon(c)]); DATA[c].trees.forEach(t => t.talents.forEach(x => m.push([x.name, ICON(x.icon)]))); }); return m.sort((a, b) => b[0].length - a[0].length); })();
      const TOPICON = {talents: ICON('ability_marksmanship'), spells: ICON('inv_misc_book_09'), builds: ICON('inv_misc_note_02'), site: '/assets/book-round.png'};
      const subjectIcon = (e, k) => { if(k === 'talents' || k === 'spells'){ const named = t => NAMEICON.find(([n]) => n.length > 3 && t.indexOf(n) >= 0 && new RegExp('(^|[^A-Za-z])' + n.replace(/[^A-Za-z0-9 ]/g, '.') + '([^A-Za-z]|$)').test(t)), hit = named(e.title) || named(first(e.text)); if(hit) return hit[1]; } return TOPICON[k]; };
      // before and after pictures of the thing an entry changed (changeshots.js, photographed from the site's own history)
      const SHOTS = window.CHANGESHOTS || {};
      const shotsH = e => { const c = SHOTS[e.title]; if(!c) return ''; const mw = w => `style="max-width:min(100%,${Math.round(w / 2)}px)"`;
        const main = !c.before ? `<span class="cmpcap">${esc(c.cap)} · new</span><img class="solo" loading="lazy" src="${c.after}" alt="" ${mw(c.w)}>`
          : c.w / c.h > 4 ? `<span class="stack"><span class="cmpcap">${esc(c.cap)}</span><span class="lab">Before</span><img loading="lazy" src="${c.before}" alt="Before" ${mw(c.w)}><span class="lab a">After</span><img loading="lazy" src="${c.after}" alt="After" ${mw(c.w)}></span>`
          : `<span class="cmpcap">${esc(c.cap)} · slide right for after</span><span class="cmpbox" ${mw(c.w)}><span class="basl" style="--x:50%;aspect-ratio:${c.w}/${c.h}"><img class="a" loading="lazy" src="${c.after}" alt="After"><img class="b" loading="lazy" src="${c.before}" alt="Before"><i class="bar"></i><input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after"></span><span class="cmpkey"><button type="button" data-x="0">Show before</button><button type="button" data-x="100">Show after</button></span></span>`;
        // how-to pictures: what to do, on a phone and on a desktop
        const more = (c.more || []).map(m => `<span class="howto"><span class="cmpcap">${esc(m.cap)}</span><img class="solo" loading="lazy" src="${m.src}" alt="" ${mw(m.w)}></span>`).join('');
        // a flip-through: real pages of the thing, one per class; the arrows (or a swipe) turn the page and the link opens that class's live book
        const fl = c.flip, f0 = fl && fl.frames[0];
        const flip = !fl ? '' : `<span class="flipbk" data-e="${LOG.indexOf(e)}" data-i="0"><span class="cmpcap">${esc(fl.cap)} · real pages, tap the arrows</span><span class="fbstage" style="aspect-ratio:${fl.w}/${fl.h};max-width:min(100%,${Math.round(fl.w / 2)}px)"><img class="fbu" alt=""><img class="fbt" loading="lazy" src="${f0.src}" alt="${esc(f0.label)}"></span><span class="fbbar"><button type="button" data-fb="-1" aria-label="Previous page"></button><span class="fblab"><b>${esc(f0.label)}</b><small>1 of ${fl.frames.length}</small></span><button type="button" data-fb="1" aria-label="Next page"></button></span><a class="fbopen" href="${U(f0.cls.toLowerCase())}#spellbook">Open the ${esc(f0.cls)} book</a></span>`;
        return `<span class="shots">${flip}${more}${more ? '<span class="howto"></span>' : ''}${main}</span>`; };   // how-to first: it is what the reader came for
      const entCard = e => { const k = topicOf(e), reader = /reddit\.com\/user\//.test(e.text); return `<li class="ent t-${k}${seen && e.date > seen ? ' fresh' : ''}"><span class="tsp" aria-hidden="true"><img src="${subjectIcon(e, k)}" alt="" loading="lazy"></span><time><em class="cat">${TOPIC[k][0]}</em>${nice(e.date)}${reader ? ' <i class="rd" title="A reader caught this one">reader catch</i>' : ''}${SHOTS[e.title] ? ` <i class="ph" title="Opens with pictures">${SHOTS[e.title].flip ? 'flip through' : SHOTS[e.title].before ? 'before / after' : 'pictures'}</i>` : ''}${seen && e.date > seen ? ' <i>new</i>' : ''}</time><b>${e.title}</b><span class="one">${esc(first(e.text))}</span><span class="full">${e.text}</span>${shotsH(e)}<span class="hint">tap to read</span></li>`; };
      let dayf = '';   // a day chosen on the chart
      const drawSite = () => { const was = $('#siteDeep'), keepOpen = !!(was && was.open), chosen = dayf ? LOG.filter(e => e.date === dayf) : LOG.slice(0, 3);
        const week = `<p class="pick">Last seven days · tap a day</p><div class="week"><div class="wbars">${perDay.map((n, i) => `<button type="button" class="${n ? 'on' : ''}${i === 6 ? ' today' : ''}${days[i] === dayf ? ' sel' : ''}" data-day="${days[i]}"${n ? '' : ' disabled'} title="${nice(days[i])}: ${n} update${n === 1 ? '' : 's'}"><b>${n || ''}</b><i style="height:${n ? Math.max(16, Math.round(70 * n / maxDay)) : 4}%"></i><small>${+days[i].slice(8)}</small></button>`).join('')}</div></div>`;
        const head = dayf ? `<p class="dayhead"><span><b>${chosen.length}</b> update${chosen.length === 1 ? '' : 's'} on ${day(dayf)}</span><button type="button" class="reset">Show the latest</button></p>`
          : `<p class="dayhead"><span><b>${weekN}</b> updates in the last seven days${nSite ? `, <b>${nSite}</b> since your last visit` : ''}. The latest:</span></p>`;
        S.innerHTML = week + head + `<ol class="ents">${chosen.map(entCard).join('')}</ol><details class="deeper" id="siteDeep"${keepOpen ? ' open' : ''}><summary><span>Everything new</span><small>${LOG.length} entries</small></summary><ol class="ents all">${LOG.map(entCard).join('')}</ol></details>`; };
      S.addEventListener('click', ev => { const d = ev.target.closest('.wbars button'); if(d){ dayf = dayf === d.dataset.day ? '' : d.dataset.day; drawSite(); track('changelog_day', {day: dayf || 'latest'}); return; }
        if(ev.target.closest('.reset')){ dayf = ''; drawSite(); return; }
        if(ev.target.closest('.shots')) return;   // dragging the compare handle is not a tap on the card
        const li = ev.target.closest('.ent'); if(!li || ev.target.closest('a')) return; li.classList.toggle('open'); li.querySelector('.hint').textContent = li.classList.contains('open') ? 'tap to close' : 'tap to read'; });
      S.addEventListener('input', ev => { const c = ev.target.closest('.basl'); if(c) c.style.setProperty('--x', ev.target.value + '%'); });
      S.addEventListener('click', ev => { const k = ev.target.closest('.cmpkey button'); if(!k) return; const c = k.closest('.cmpbox').querySelector('.basl'); c.classList.add('ease'); c.style.setProperty('--x', k.dataset.x + '%'); c.querySelector('input').value = k.dataset.x; setTimeout(() => c.classList.remove('ease'), 320); });
      const setX = (c, x) => { const r = c.getBoundingClientRect(), v = Math.max(0, Math.min(100, 100 * (x - r.left) / r.width)); c.style.setProperty('--x', v + '%'); c.querySelector('input').value = Math.round(v); };
      S.addEventListener('pointerdown', ev => { const c = ev.target.closest('.basl'); if(!c) return; c.setPointerCapture(ev.pointerId); c.__drag = true; setX(c, ev.clientX); });
      S.addEventListener('pointermove', ev => { const c = ev.target.closest('.basl'); if(c && c.__drag) setX(c, ev.clientX); });
      ['pointerup', 'pointercancel'].forEach(n => S.addEventListener(n, ev => { const c = ev.target.closest('.basl'); if(c) c.__drag = false; }));
      // the flip-through: turn to another page (the next picture waits underneath, the top one turns on its left edge)
      const flipTo = (fb, dir) => { const fl = (SHOTS[(LOG[+fb.dataset.e] || {}).title] || {}).flip; if(!fl || fb.__busy) return; const n = fl.frames.length, i = ((+fb.dataset.i || 0) + dir + n) % n, fr = fl.frames[i], top = fb.querySelector('.fbt'), under = fb.querySelector('.fbu');
        const done = () => { top.src = fr.src; top.alt = fr.label; top.classList.remove('turn', 'back'); fb.dataset.i = i; fb.querySelector('.fblab b').textContent = fr.label; fb.querySelector('.fblab small').textContent = `${i + 1} of ${n}`; const a = fb.querySelector('.fbopen'); a.href = '/' + fr.cls.toLowerCase() + '#spellbook'; a.textContent = `Open the ${fr.cls} book`; fb.__busy = false; };
        const go = () => { if(!fb.isConnected){ fb.__busy = false; return; } if(matchMedia('(prefers-reduced-motion: reduce)').matches){ done(); return; }
          let ended = false; const end = () => { if(ended) return; ended = true; done(); }; top.addEventListener('animationend', end, {once: true}); setTimeout(end, 900);
          if(dir > 0){ under.src = fr.src; top.classList.add('turn'); } else { under.src = top.src; top.src = fr.src; top.classList.add('back'); } };
        fb.__busy = true; const pre = new Image(); pre.src = fr.src; (pre.decode ? pre.decode() : Promise.resolve()).then(go, go); };
      const flipPlay = fb => { if(fb.__timer) return; fb.__timer = setInterval(() => { if(!fb.isConnected || !fb.closest('.ent.open')){ clearInterval(fb.__timer); fb.__timer = 0; return; } if(!fb.__touched && !document.hidden) flipTo(fb, 1); }, 2800); };
      S.addEventListener('click', ev => { const k = ev.target.closest('.flipbk [data-fb], .flipbk .fbstage'); if(k){ const fb = k.closest('.flipbk'); if(!k.dataset.fb && Date.now() - (fb.__swiped || 0) < 600) return; fb.__touched = true; flipTo(fb, k.dataset.fb ? +k.dataset.fb : 1); track('changelog_flip', {dir: k.dataset.fb || 'page'}); return; }
        const li = ev.target.closest('.ent'), fb = li && li.querySelector('.flipbk'); if(fb && li.classList.contains('open')) flipPlay(fb); });
      let fbx = null; S.addEventListener('touchstart', ev => { fbx = ev.target.closest('.fbstage') ? ev.touches[0].clientX : null; }, {passive: true});
      S.addEventListener('touchend', ev => { if(fbx == null) return; const dx = ev.changedTouches[0].clientX - fbx, st = ev.target.closest('.fbstage'); fbx = null; if(st && Math.abs(dx) > 36){ const fb = st.closest('.flipbk'); fb.__touched = true; fb.__swiped = Date.now(); flipTo(fb, dx < 0 ? 1 : -1); } }, {passive: true});
      drawSite();
      // ---- the tiles choose which glance shows; a wide drawer on a desktop shows both side by side
      const go = k => { body.dataset.on = k; SW.querySelectorAll('.tile').forEach(t => { const on = t.dataset.go === k; t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); }); body.scrollTop = 0; };
      SW.addEventListener('click', ev => { const t = ev.target.closest('.tile'); if(!t) return; if(dr.classList.contains('focus') && dr.__unfocus) dr.__unfocus(); go(t.dataset.go); track('changelog_tab', {tab: t.dataset.go}); });
      go(siteFresh && !gameFresh ? 'site' : 'game');
      dr.classList.add('builds');
    })();
    const wideBtn = $('#logWide'), setWide = w => { dr.classList.toggle('wide', w); wideBtn.setAttribute('aria-pressed', w); wideBtn.querySelector('span').textContent = w ? 'Shrink' : 'Expand'; wideBtn.querySelector('i').innerHTML = w ? '&rsaquo;' : '&lsaquo;'; };
    // the handle drags: the panel follows the hand between W_MIN and the viewport, turns two-column past WIDE_AT, and closes when pushed back into the edge; a plain click still flips between the two set widths
    const W_MIN = 440, WIDE_AT = 800, maxW = () => Math.min(980, innerWidth - 40);
    const setW = w => { w = Math.max(W_MIN, Math.min(maxW(), Math.round(w))); dr.style.setProperty('--dw', w + 'px'); setWide(w >= WIDE_AT); return w; };
    const savedW = +ls.get('log_w'); if(savedW) setW(savedW); else setWide(ls.get('log_wide') === '1');
    // focus: a class, race or Legacy is picked. The two topic tiles fold to a slim strip and, on desktop, the panel widens to the
    // two-column reading width (not the two-topic mode) unless the reader already made it wider; unpicking puts it back.
    let restW = null;
    // a chevron under the folded tiles opens them back up (and folds them again) without touching the pick
    // each folded tile carries its own arrow at the right edge; it opens that tile back to full size (and folds it again) without switching topics
    let arrows = false;
    const ensureFold = () => { if(arrows) return; arrows = true; $('#dswitch').querySelectorAll('.tile').forEach(t => { const a = document.createElement('span'); a.className = 'tfold'; a.setAttribute('aria-hidden', 'true');
      t.appendChild(a); t.title = 'Back to the full panels'; }); };
    dr.__focus = on => { dr.classList.toggle('focus', on); if(on) ensureFold(); if(!on) $('#dswitch').querySelectorAll('.tile').forEach(t => t.removeAttribute('title'));
      if(!matchMedia('(min-width:900px)').matches) return;
      const cur = dr.getBoundingClientRect().width;
      if(on){ if(cur < 760){ restW = cur; setW(760); } }
      else if(restW != null){ setW(restW); restW = null; } };
    let drag = null, skipClick = false;
    wideBtn.addEventListener('pointerdown', e => { if(e.button || !matchMedia('(min-width:900px)').matches) return; drag = {id: e.pointerId, x: e.clientX, w: dr.getBoundingClientRect().width, moved: false, want: 0}; try{ wideBtn.setPointerCapture(e.pointerId); }catch{} });
    wideBtn.addEventListener('pointermove', e => { if(!drag || e.pointerId !== drag.id) return; const dx = drag.x - e.clientX; if(!drag.moved){ if(Math.abs(dx) < 4) return; drag.moved = true; dr.classList.add('dragging'); } drag.want = drag.w + dx; setW(drag.want); dr.style.transform = drag.want < W_MIN ? 'translateX(' + Math.min(W_MIN - drag.want, W_MIN) + 'px)' : ''; });
    const endDrag = e => { if(!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; dr.classList.remove('dragging'); dr.style.transform = ''; if(!d.moved) return; skipClick = true; setTimeout(() => skipClick = false, 0);
      if(d.want < W_MIN - 90){ setW(d.w); close(); return; }   // pushed into the edge: closes, and comes back next time at the width it had
      const w = setW(d.want); ls.set('log_w', String(w)); ls.set('log_wide', w >= WIDE_AT ? '1' : '0'); track('changelog_wide', {wide: w >= WIDE_AT, width: w, how: 'drag'}); };
    wideBtn.addEventListener('pointerup', endDrag); wideBtn.addEventListener('pointercancel', endDrag);
    wideBtn.addEventListener('click', () => { if(skipClick) return; const w = !dr.classList.contains('wide'); dr.style.removeProperty('--dw'); ls.set('log_w', ''); setWide(w); ls.set('log_wide', w ? '1' : '0'); track('changelog_wide', {wide: w}); });
    // ---- Get this by email: the band at the top of the drawer. Drawn on the first open, only when the site's sign-up is on
    // (/account/votes answers ok); the class the reader is on is ticked, the others are a tap away; the form posts the same
    // sign-up Back to Class uses (news on, the ticked classes as alerts), so the confirm mail and the account page are the same.
    // Someone already signed in (the tf_s cookie) sees that they are on the list instead of the form.
    const mailBand = (() => { const M = $('#dmail'); let built = false; if(!M) return () => {};
      const cls = Object.keys(DATA).filter(c => DATA[c] && DATA[c].trees && !DATA[c].legacy), cur = () => { try{ return state.cls; }catch{ return ''; } };
      const draw = () => { const on = cur();
        M.innerHTML = `<div class="mh"><img src="/assets/book-round.png" alt=""><div><div class="mt">Get this by email</div><div class="ms">One email when a beta build moves the trees: what moved, your classes first, then a link to the rest.</div></div></div>` +
          `<form novalidate><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="Your email"><button type="submit">Send me the next one</button></form>` +
          `<div class="mc"><small>Your classes</small>${cls.map(c => `<button type="button" class="${c === on ? 'on' : ''}" data-cls="${c}" aria-pressed="${c === on}" title="${c}"><img src="${TRACK.cicon(c)}" alt="${c}"></button>`).join('')}</div>` +
          `<p class="mo" aria-live="polite"></p><p class="mf">One click in the first message confirms it, and the same link in every message stops it. A ticked class also gets one email when its guide is up. <a href="/privacy#alerts">How it's kept</a>.</p>`;
        M.querySelector('.mc').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; const now = !b.classList.contains('on'); b.classList.toggle('on', now); b.setAttribute('aria-pressed', now); });
        const f = M.querySelector('form'), out = M.querySelector('.mo'), go = f.querySelector('button');
        f.addEventListener('submit', e => { e.preventDefault(); const email = f.email.value.trim(), classes = [...M.querySelectorAll('.mc button.on')].map(b => b.dataset.cls.toLowerCase());
          if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)){ out.textContent = 'That does not look like an email address.'; f.email.focus(); return; }
          go.disabled = true; out.textContent = 'Sending the link…'; track('news_signup', {classes: classes.length});
          fetch('/account/start', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email, classes, news: true, source: 'drawer'})}).then(r => r.json()).then(j => { go.disabled = false;
            if(j && j.ok){ M.classList.add('done'); out.innerHTML = `<b>Check your inbox.</b> One click on the link in it and you are set. Not there in a minute? Look in junk, and mark it not junk so the next one lands.`; }
            else out.textContent = (j && j.reason) || 'That did not go through. Try again in a minute.'; }).catch(() => { go.disabled = false; out.textContent = 'That did not go through. Try again in a minute.'; }); }); };
      const me = () => fetch('/account/me', {credentials: 'same-origin'}).then(r => r.status === 200 ? r.json() : null).then(j => { if(!j || !j.ok || !j.profile) return;
        const p = j.profile; M.classList.add('in'); M.querySelector('.mo').innerHTML = p.news && !p.stopped ? `<b>You're on the list</b> as ${p.email}. The next build alert comes to you. <a href="/account">Your alerts</a>` : `<b>${p.email}</b> is signed in, with news off. <a href="/account">Switch it on</a> and the next build alert comes to you.`; }).catch(() => {});
      return () => { if(built) return; built = true; fetch('/account/votes', {credentials: 'same-origin'}).then(r => r.json()).then(j => { if(!j || !j.ok) return; draw(); M.hidden = false; me(); }).catch(() => {}); }; })();
    const open = () => { if(dr.__redraw) dr.__redraw(); dr.hidden = false; back.hidden = false; btn.setAttribute('aria-expanded','true'); btn.classList.remove('unread'); ls.set('log_seen', latest); track('changelog_opened'); mailBand(); $('#logClose').focus(); };
    const close = () => { dr.hidden = true; back.hidden = true; btn.setAttribute('aria-expanded','false'); btn.focus(); };
    btn.addEventListener('click', () => dr.hidden ? open() : close());
    $('#logClose').addEventListener('click', close); back.addEventListener('click', close);
    addEventListener('keydown', e => { if(e.key === 'Escape' && !dr.hidden) close(); });
  })();
  // ---------- feedback: Reddit DM with the current page prefilled ----------
  (function(){
    [$('#feedLink'), $('#logFeed')].filter(Boolean).forEach(a => a.addEventListener('click', () => { a.href = 'https://www.reddit.com/message/compose/?to=baldwinbuilds&subject=' + encodeURIComponent('Talents Forever') + '&message=' + encodeURIComponent('Page: https://talentsforever.com' + location.pathname + location.search + location.hash + '\n\nWhat I noticed:\n'); track('feedback_clicked', {from: a.id}); }));
  })();
  const TIP_URL = 'https://ko-fi.com/baldwinbuilds'; // empty string hides the footer pill
  (function(){ const a = $('#tipLink'); if(TIP_URL){ a.href = TIP_URL; $('#tipCard').hidden = false; a.addEventListener('click', () => track('tip_clicked')); } })();
  function goClass(c, src){ state.cls = c; state.picked = true; sheetAt = null; $('#sheet').hidden = true; restoreLast(c); render(); track('class_selected', {class: c, src: src || 'nav'}); }
  function renderClasses(){
    const nav = $('#classes'); nav.innerHTML = '';
    CLASSES.forEach(c => {
      const has = DATA[c].trees.some(t=>t.talents.length);
      // a real link: middle-click and Ctrl/Cmd-click open the class in a new tab; a plain click switches in place and adds a
      // history entry, so Back returns to the build you were on (thanks u/peter_panski)
      const b = document.createElement('a'); b.href = '/' + c.toLowerCase(); b.innerHTML = `<img src="${ICON(DATA[c].icon)}" alt=""><span>${c}</span>`;
      b.setAttribute('aria-pressed', c===state.cls); if(!has){ b.classList.add('soon'); b.title = 'No tooltip video for this class yet'; }
      b.onclick = e => { if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return; e.preventDefault(); if(!has) return; if(c !== state.cls) history.pushState(null, '', b.href); goClass(c); };
      nav.appendChild(b);
    });
  }
  // Every clickable cell, talent or Legacy perk, gets the same hands: tap, hold, badge, right-click, keys, hover.
  function wireCell(d, ti, i, cls){
    d.addEventListener('mousedown', e => e.preventDefault());
    d.addEventListener('click', e => { e.preventDefault(); if(TOUCH){ if(d._held){ d._held = false; return; } if(!$('#sheet').hidden){ $('#sheet').hidden = true; sheetAt = null; }
        const was = ranksFor(cls)[ti][i]; const un = e.target.closest('.un'), onBadge = un && was > 0;
        if(un){ un.classList.remove('hit'); void un.offsetWidth; un.classList.add('hit'); un.addEventListener('animationend', () => un.classList.remove('hit'), {once:true}); } const why = onBadge ? null : canAdd(cls,ti,i);
        if(why && why !== 'Max rank'){ showGhost(ti,i,false,cls); ghostHint(); return; }   // the tooltip itself says what's missing, no toast needed
        if(onBadge) remove(ti,i,cls); else add(ti,i,cls);
        const changed = ranksFor(cls)[ti][i] !== was; showGhost(ti,i,changed,cls); if(changed && navigator.vibrate) navigator.vibrate(7); ghostHint(); return; }
      (e.shiftKey ? remove : add)(ti,i,cls); });
    // hold on a touch device opens the full tooltip without spending a point
    let holdT; d.addEventListener('touchstart', () => { d._held = false; holdT = setTimeout(() => { d._held = true; showGhost(ti,i,false,cls); if(navigator.vibrate) navigator.vibrate(12); }, 550); }, {passive:true});
    ['touchend','touchmove','touchcancel'].forEach(ev => d.addEventListener(ev, () => clearTimeout(holdT), {passive:true}));
    d.addEventListener('contextmenu', e => { e.preventDefault(); remove(ti,i,cls); });
    d.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); add(ti,i,cls); } if(e.key==='Backspace'||e.key==='Delete'){ e.preventDefault(); remove(ti,i,cls); } });
    d.addEventListener('mouseenter', e => showTip(ti,i,e,cls)); d.addEventListener('mousemove', moveTip); d.addEventListener('mouseleave', leaveTip);
    d.addEventListener('focus', e => showTip(ti,i,e,cls)); d.addEventListener('blur', hideTip);
  }
  let tileArt = (cls, t) => `<img src="${ICON(t.icon)}" alt="" decoding="async" onerror="iconRetry(this)">`;   // a talent tile's picture (the polish lab may hand in another way to draw it)
  function renderTrees(){
    // Rebuilding the trees briefly shrinks the page, which makes browsers jump the scroll position. Hold the height and restore scroll.
    const keepY = window.scrollY, keepH = treesEl.offsetHeight;
    if(keepH) treesEl.style.minHeight = keepH + 'px';
    const cls = state.cls; treesEl.innerHTML = ''; treesEl.dataset.cls = cls;
    DATA[cls].trees.forEach((tree, ti) => {
      const el = document.createElement('section'); el.className = 'tree' + (tree.talents.length ? '' : ' empty');
      el.innerHTML = `<div class="thead"><img src="${ICON(tree.icon)}" alt="" onerror="iconRetry(this)"><span class="n">${tree.name}<small class="nr"></small></span><span class="c"><b>${treePts(cls,ti)}</b><span class="of"> / ${pool()}</span></span><button class="tr" title="Reset ${tree.name}" aria-label="Reset ${tree.name}" data-reset="${ti}">↺</button></div>
        <div class="tbody" style="background-image:url('${BG(tree.bg)}')"></div>`;
      const body = el.querySelector('.tbody');
      el.querySelector('[data-reset]').onclick = () => { ranksFor(cls)[ti] = tree.talents.map(()=>0); render(); };
      if(!tree.talents.length){ body.innerHTML = `<p>No ${tree.name} tooltips captured yet. Record this tree and it fills in.</p>`; treesEl.appendChild(el); return; }
      const grid = document.createElement('div'); grid.className = 'grid'; grid.style.gridTemplateRows = `repeat(${ROWS},64px)`;
      tree.talents.forEach((t,i) => {
        const r = ranksFor(cls)[ti][i], st = status(cls,ti,i);
        const d = document.createElement('div');
        d.className = `talent ${st}` + (t.note ? ' unknown' : '') + (t.classic ? ' ' + t.classic.status : ''); d.tabIndex = 0; d.setAttribute('role','button');
        d.setAttribute('aria-label', `${t.name}, rank ${r} of ${t.max}`);
        d.style.gridRow = t.row; d.style.gridColumn = t.col;
        d.innerHTML = `<span class="ab">${abbrev(t.name)}</span>${t.icon ? tileArt(cls, t) : ''}<span class="rk">${r}/${t.max}</span><span class="un" aria-hidden="true">−</span>${t.classic && t.classic.status!=='same' ? `<span class="badge ${t.classic.status}">${t.classic.status[0].toUpperCase()}</span>` : ''}`;
        wireCell(d, ti, i, cls);
        grid.appendChild(d);
      });
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','arrows');
      body.appendChild(grid); grid.appendChild(svg);
      if(tree.removed && tree.removed.length){
        const rm = document.createElement('div'); rm.className = 'removed'; rm.innerHTML = `<b>No longer a talent</b>`;
        // A Classic talent that shows up in the demo spellbook did not vanish, it became a trainer spell.
        const sb = (window.SPELLBOOKS || {})[cls]; const inBook = name => { if(!sb) return null; for(const t of sb.tabs){ const hit = t.spells.find(([n]) => n === name); if(hit) return {tab: t.name, rank: hit[1]}; } return null; };
        tree.removed.forEach(x => {
          const base = inBook(x.name);
          const sp = document.createElement('span'); sp.textContent = x.name; sp.tabIndex = 0; if(base) sp.classList.add('base');
          const html = `<div class="n">${x.name}</div><div class="r">Classic talent, ${x.max} rank${x.max>1?'s':''}</div><div class="d">${x.text}</div>` + (base
            ? `<div class="cl"><b>Baseline in Forever.</b> Every ${cls} learns it from the trainer now: it sits in the ${base.tab} tab of the ${sb.source === 'beta' ? 'spellbook below' : `level ${sb.level} demo spellbook${base.rank ? ` at ${base.rank}` : ''}`}.</div>`
            : `<div class="cl"><b>Not in Forever.</b> This talent was removed or folded into another one.</div>`);
          const show = e => { if(TOUCH){ sheetAt = null; $('#sheetBody').innerHTML = html; $('#sheetAdd').hidden = true; $('#sheetRem').hidden = true; $('#sheet').hidden = false; return; } tipAt = null; tip.innerHTML = html; tip.hidden = false; moveTip(e); };
          sp.addEventListener('mouseenter', show); sp.addEventListener('mousemove', moveTip); sp.addEventListener('mouseleave', leaveTip);
          sp.addEventListener('focus', show); sp.addEventListener('blur', hideTip);
          sp.addEventListener('click', e => { e.preventDefault(); if(TOUCH) show(e); });
          rm.appendChild(sp);
        });
        body.appendChild(rm);
      }
      treesEl.appendChild(el);
      drawArrows(svg, grid, tree, ti);
    });
    treesEl.style.minHeight = '';
    if(Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
  }
  function drawArrows(svg, grid, tree, ti, ranksIn){
    const gb = grid.getBoundingClientRect(), cells = [...grid.querySelectorAll('.talent')];
    svg.setAttribute('viewBox', `0 0 ${gb.width} ${gb.height}`); svg.style.width = gb.width+'px'; svg.style.height = gb.height+'px';
    let html = '';
    const rk = ranksIn || ranksFor(state.cls)[ti];
    tree.talents.forEach((t,i) => {
      if(!t.req) return; const p = idx(tree,t.req); if(p<0) return;
      const on = rk[p] >= tree.talents[p].max;
      const a = cells[p].getBoundingClientRect(), b = cells[i].getBoundingClientRect();
      const ax = a.left-gb.left+a.width/2, ay = a.top-gb.top+a.height/2, bx = b.left-gb.left+b.width/2, by = b.top-gb.top+b.height/2;
      const mk = `m${ranksIn ? 'l' : ''}${ti}_${i}`; html += `<defs><marker id="${mk}" class="${on?'on':''}" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z"/></marker></defs>`;
      const cls = on ? 'on' : '';
      if(Math.abs(ay-by) < 2){ const s = Math.sign(bx-ax); html += `<line class="${cls}" x1="${ax+s*(a.width/2+3)}" y1="${ay}" x2="${bx-s*(b.width/2+7)}" y2="${by}" marker-end="url(#${mk})"/>`; }
      else if(Math.abs(ax-bx) < 2){ html += `<line class="${cls}" x1="${ax}" y1="${ay+a.height/2+3}" x2="${bx}" y2="${by-b.height/2-7}" marker-end="url(#${mk})"/>`; }
      else { const s = Math.sign(bx-ax); html += `<polyline class="${cls}" points="${ax},${ay+a.height/2+3} ${ax},${by} ${bx-s*(b.width/2+7)},${by}" marker-end="url(#${mk})"/>`; }
    });
    svg.innerHTML = html;
  }
  function updateTrees(){
    const cls = state.cls;
    DATA[cls].trees.forEach((tree, ti) => {
      const el = treesEl.children[ti]; if(!el || !tree.talents.length) return;
      const tp = treePts(cls,ti), allPts = DATA[cls].trees.map((_,k)=>treePts(cls,k)), lead = Math.max(...allPts) > 0 && allPts.indexOf(Math.max(...allPts)) === ti;
      el.querySelector('.thead .c b').textContent = tp;
      const ofEl = el.querySelector('.thead .c .of'); if(ofEl) ofEl.textContent = ' / ' + pool();
      const th = el.querySelector('.thead'); th.style.setProperty('--fill', (100 * tp / pool()) + '%'); th.classList.toggle('lead', lead); th.classList.toggle('spent', tp > 0);
      const lastRow = Math.max(...tree.talents.map(t => t.row)), need = lastRow * 5, next = Math.min(need, Math.ceil((tp + 1) / 5) * 5);
      el.querySelector('.thead .nr').textContent = tp >= need ? 'all rows open' : `next row at ${next}`;
      const cells = el.querySelectorAll('.talent');
      tree.talents.forEach((t,i) => {
        const d = cells[i]; if(!d) return; const r = ranksFor(cls)[ti][i], st = status(cls,ti,i);
        const was = staleAt(cls, ti, i); d.className = `talent ${st}` + (t.note ? ' unknown' : '') + (t.classic ? ' ' + t.classic.status : '') + (was ? ' was' : '');
        { const ob = d.querySelector('.wb'); if(ob) ob.remove(); if(was){ const g = document.createElement('i'); g.className = 'wb'; g.textContent = `${was.pts} back`; d.appendChild(g); } }
        d.setAttribute('aria-label', `${t.name}, rank ${r} of ${t.max}`);
        d.querySelector('.rk').textContent = `${r}/${t.max}`;
        { const old = d.querySelector('.pr'); if(old) old.remove(); const pp = popFor(cls); if(pp && document.body.classList.contains('pr')){ const pct = (prPick(pp)[ti] || [])[i]; if(pct != null){ const s = document.createElement('i'); s.className = 'pr' + (pct >= 60 ? ' hi' : pct < 15 ? ' lo' : ''); s.innerHTML = `<img src="${ICON(prIcon(cls, pp))}" alt="">`; s.appendChild(document.createTextNode(pct + '%')); s.dataset.to = pct; s.dataset.row = t.row || 1; d.appendChild(s); } } }
      });
      const svg = el.querySelector('.arrows'), grid = el.querySelector('.grid'); if(svg && grid) drawArrows(svg, grid, tree, ti);
    });
  }
  function renderTop(){
    const cls = state.cls, spent = totalPts(cls), avail = pool();
    $('#split').textContent = DATA[cls].trees.map((_,i)=>treePts(cls,i)).join('/');
    const left = $('#ptsLeft'); left.textContent = avail - spent; left.classList.toggle('over', spent > avail);
    document.body.classList.toggle('done', spent > 0 && spent >= avail);
    $('#lvlneed').textContent = Math.max(10 - talentedRank(), spent + 9 - talentedRank());
    $('#bannerName').textContent = cls; renderClassVs(); const cd = $('#classData'); if(cd) cd.href = U('export', cls.toLowerCase() + '.json'); if(!['/racials','/legacy','/abilities','/builds'].includes(location.pathname.replace(/\/$/,''))) document.title = (state.picked || spent > 0) ? `WoW Forever ${cls} Talent Calculator | Talents Forever` : 'WoW Forever Talent Calculator | Talents Forever';   // section pages keep their own title; the app used to overwrite it and Google saw the home page's title on /racials
    (function(){
      const trees = DATA[cls].trees, pts = trees.map((_,i)=>treePts(cls,i)), max = pool();
      const order = pts.map((p,i)=>[p,i]).sort((a,b)=>b[0]-a[0]);
      const lead = order[0][0] > 0 ? order[0][1] : -1;
      const b = $('#classBanner'); b.style.setProperty('--cc', CLASS_COLOR[cls] || '#ffd100'); treesEl.style.setProperty('--cc', CLASS_COLOR[cls] || '#ffd100');
      let spec = '';
      if(spent === 0) spec = `<span class="hint">No points spent. ${matchMedia('(hover: none)').matches ? 'Tap' : 'Click'} a talent to start your build.</span>`;
      else {
        const named = order.filter(([p]) => p > 0);
        const label = named.length > 1 && named[1][0] >= Math.max(10, named[0][0] * 0.6) ? `${trees[named[0][1]].name} / ${trees[named[1][1]].name}` : trees[named[0][1]].name;
        spec = `<span class="spec">${label} ${cls}</span><span class="split">${named.map(([p,i]) => `<b>${p}</b> ${trees[i].name}`).join(' <span class="hint">·</span> ')}</span>`;
      }
      $('#bannerSum').innerHTML = spec;
      const bars = $('#bannerBars');
      if(bars.dataset.cls !== cls){ bars.dataset.cls = cls; bars.innerHTML = trees.map((t,i) => `<div class="bbar"><img src="${ICON(t.icon)}" alt=""><div class="tk"><div class="fl"></div></div><b>0</b></div>`).join(''); }
      bars.querySelectorAll('.bbar').forEach((el,i) => { el.classList.toggle('lead', i === lead); el.querySelector('.fl').style.width = (100 * pts[i] / max) + '%'; el.querySelector('b').textContent = pts[i]; });
    })();
    (function(){ const em = $('#mastIcon').parentElement, ic = ICON(DATA[cls].icon); if(em.dataset.cls !== cls){ em.dataset.cls = cls; $('#mastIcon').src = ic; em.style.setProperty('--cc', CLASS_COLOR[cls] || '#ffd100'); const once = el => { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 1700); }; once(em); const mb = document.querySelector('.mbook'); if(mb) once(mb); } })();
    $('#classBanner').style.backgroundImage = `url('${BG(DATA[cls].trees[1].bg)}')`;
    (function(){ const lg = document.querySelector('.states'); if(!lg || lg.dataset.cls === cls) return; lg.dataset.cls = cls;
      const pick = DATA[cls].trees.flatMap(t => t.talents).filter(t => t.icon).slice(0, 4);
      lg.querySelectorAll('.talent').forEach((el, i) => { const t = pick[i]; if(!t) return; el.querySelector('img').src = ICON(t.icon); el.querySelector('.rk').textContent = [`0/${t.max}`, `${Math.max(1, t.max - 1)}/${t.max}`, `${t.max}/${t.max}`, `0/${t.max}`][i]; el.title = t.name; });
    })();
    $('#classes').querySelectorAll('a').forEach(b => b.setAttribute('aria-pressed', b.textContent.trim()===cls));
    if(location.pathname.startsWith('/index.html')) history.replaceState(null,'', location.pathname + '#' + encode());
    else history.replaceState(null,'', spent > 0 ? '/' + encode() : (state.picked ? '/' + cls.toLowerCase() : (typeof sectionPath === 'string' && sectionPath) || '/'));
    $('#shareLink').value = location.href; $('#shareNative').hidden = !navigator.share;
    // GA: one page_view per real page (class or section), never per talent click. History-change tracking is off in the GA stream, so this is the only page_view after the initial load.
    if(window.gtag){ const pt = document.title; if(window.__gaTitle === undefined) window.__gaTitle = pt; else if(pt !== window.__gaTitle){ window.__gaTitle = pt; gtag('event', 'page_view', {page_title: pt, page_location: location.origin + location.pathname}); } }

  }

  // ---------- racials ----------
  const CLASS_ICON_MAP = Object.fromEntries(Object.keys(DATA).map(c => [c, DATA[c].icon]));
  const CLASS_COLOR = {Warrior:'#c69b6d', Paladin:'#f48cba', Hunter:'#aad372', Rogue:'#fff468', Priest:'#ffffff', Shaman:'#0070dd', Mage:'#3fc7eb', Warlock:'#8788ee', Druid:'#ff7c0a'};
  const abilityLi = ([n,t,ic]) => `<li>${ic ? `<img src="${ICON(ic)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ab>${n.slice(0,2)}</span>'">` : `<span class="ab">${n.slice(0,2)}</span>`}<div><b>${n}</b><span>${t}</span></div></li>`;
  const raceCard = (r, ok) => `<div class="race rc${ok ? '' : ' dim'}" role="button" tabindex="0" aria-expanded="false"><div class="rn"><img class="portrait" src="${ICON(r.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="rmeta"><div class="nm">${r.race.replace(/ \((.*)\)$/, '<small>$1</small>')}</div><div class="cls">${r.classes.map(c => `<img src="${ICON(CLASS_ICON_MAP[c] || ('class_' + c.toLowerCase()))}" alt="${c}" title="${c}">`).join('')}</div></div><div class="strip">${r.abilities.map(([n,t,ic]) => ic ? `<img src="${ICON(ic)}" alt="${n}" title="${n}" loading="lazy">` : '').join('')}</div><span class="chev" aria-hidden="true">▾</span></div><ul>${r.abilities.map(abilityLi).join('')}</ul></div>`;
  // Spellbook rendered like the in-game book: parchment page, side tabs, page turn.
  function buildBook(cls, sb){
    const el = document.getElementById('book'); if(!el) return;
    const tal = new Set(DATA[cls].trees.flatMap(t => t.talents.map(x => x.name)));
    const icons = window.SPELLBOOK_ICONS || {}, own = sb.icons || {};   // the class's own icons first: names repeat across classes and pets (Charge), and some ranks have their own picture
    const treeIcon = name => { const t = DATA[cls].trees.find(t => t.name === name.replace(/ \(.*\)$/, '')); return t ? t.icon : DATA[cls].icon; };
    const tabs = [{name: 'General', spells: sb.general, icon: DATA[cls].icon}, ...sb.tabs.map(t => ({...t, icon: t.icon || treeIcon(t.name)})), ...(sb.trainer ? [{...sb.trainer, icon: treeIcon(sb.trainer.name), note: 'read from the trainer list, not the spellbook'}] : [])];
    const PER = 12 /* two pages of six: the grid fills down the left page, then down the right (grid-auto-flow:column), so ranks read in order */, lvs = sb.levels || {}; let cur = Math.min(1, tabs.length - 1), page = 0;
    // Show all ranks, like the checkbox at the bottom of the in-game book: off keeps only the highest rank of each spell
    let allRanks = true;
    const maxOnly = spells => { const last = new Map(); spells.forEach((s, i) => last.set(s[0], i)); return spells.filter((s, i) => last.get(s[0]) === i); };
    // what kind of change a row carries against Classic (from the beta tooltips): new, ren(amed), rw (reworked), num (numbers only), '' (same)
    const SDX = window.SPELL_DESC || {}, isBeta = sb.source === 'beta';
    const kindOf = (n, sub) => { const d = SDX[cls + '|' + n + '|' + (sub || '')]; if(!d || d.s !== 'beta') return ''; if(d.was && d.was !== n) return 'ren'; if(d.cs === 'new') return 'new'; if(d.cs === 'note') return 'rw'; if(d.cs === 'changed') return d.ck === 'n' ? 'num' : 'rw'; return ''; };
    const badge = k => k === 'new' ? '<i class="chg new">New</i>' : k === 'ren' ? '<i class="chg ren">Renamed</i>' : k === 'rw' ? '<i class="chg rw">Reworked</i>' : '';
    let filt = 'all', view = 'book', myLv = Math.max(1, Math.min(60, +state.level || 60));   // filt: all | changed (new, renamed, reworked) | new
    const keep = ([n, sub]) => { if(filt === 'all') return true; const k = kindOf(n, sub); return filt === 'new' ? k === 'new' : (k === 'new' || k === 'rw' || k === 'ren'); };
    const rowsOf = t => (allRanks ? t.spells : maxOnly(t.spells)).filter(keep);
    const item = ([n, sub], i) => {
      const ic = own[n + '|' + (sub || '')] || own[n] || icons[n]; const r = /Rank (\d+)/.exec(sub || ''); const a = lvs[n];
      const lv = a ? `<span class="lv">${a.map((x, k) => `<i class="${x == null ? 'na' : ''}${r && k === +r[1] - 1 ? ' cur' : ''}" title="Rank ${k + 1}${x == null ? '' : ' at level ' + x}">${x == null ? '?' : x}</i>`).join('')}</span>` : '';
      return `<li style="--i:${i}" data-sk="${cls}|${n}|${sub || ''}" tabindex="0"><span class="ico">${ic ? `<img src="${ICON(ic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>${tal.has(n) ? '<span class="tal">TALENT</span>' : ''}<div class="txt"><b>${n}</b><span class="rk">${sub || '&nbsp;'}${isBeta ? badge(kindOf(n, sub)) : ''}</span>${lv}</div></li>`;
    };
    const face = () => {
      const t = tabs[cur]; const shown = rowsOf(t); const pages = Math.max(1, Math.ceil(shown.length / PER)); page = Math.min(page, pages - 1);
      const list = shown.slice(page * PER, page * PER + PER); const names = new Set(t.spells.map(([n]) => n)).size;
      const pgs = x => Math.max(1, Math.ceil(rowsOf(x).length / PER)), bookPages = tabs.reduce((n, x) => n + pgs(x), 0), bookPage = tabs.slice(0, cur).reduce((n, x) => n + pgs(x), 0) + page + 1;   // the whole class book, every tab
      const count = filt !== 'all' ? `${shown.length} of ${(allRanks ? t.spells : maxOnly(t.spells)).length} shown` : allRanks && shown.length !== names ? `${names} spell${names === 1 ? '' : 's'}, ${shown.length} ranks` : `${shown.length} spell${shown.length === 1 ? '' : 's'}`;
      return `<h3 class="pgtitle">${t.name.replace(/ \(.*\)$/, '')}</h3><div class="rule"><i></i></div><div class="pgsub">${count}${t.note ? ` · ${t.note}` : ''}${sb.levels && t.spells.some(([n]) => lvs[n]) ? (sb.source === 'beta' ? ' · small numbers: level each rank is learned at' : ' · small numbers: level each rank is trained at, your rank lit') : ''}</div><ol class="sgrid">${list.map(item).join('') || `<li class="none">Nothing ${filt === 'new' ? 'new' : 'new or reworked'} in this tab.</li>`}</ol><div class="pgfoot">${sb.source === 'beta' ? `<label class="allr"><input type="checkbox" id="allRanks"${allRanks ? ' checked' : ''}> Show all ranks</label>` : ''}<span class="pager"><button type="button" data-pg="-1" ${cur === 0 && page === 0 ? 'disabled' : ''} aria-label="Previous page">&#9664;</button><span class="pgno" data-tp="${page + 1}" data-tn="${pages}"><b>${t.name.replace(/ \(.*\)$/, '')} &middot; ${page + 1} of ${pages}</b><small>Book &middot; ${bookPage} of ${bookPages}</small></span><button type="button" data-pg="1" ${cur === tabs.length - 1 && page === pages - 1 ? 'disabled' : ''} aria-label="Next page">&#9654;</button></span></div>`;
    };
    const ctl = !isBeta ? '' : `<div class="bkctl"><div class="seg" role="group" aria-label="How to read it"><button type="button" data-view="book" aria-pressed="true">The book</button><button type="button" data-view="level" aria-pressed="false">By level</button></div><div class="seg filt" role="group" aria-label="Which spells"><button type="button" data-filt="all" aria-pressed="true">All</button><button type="button" data-filt="changed" aria-pressed="false">New and reworked</button><button type="button" data-filt="new" aria-pressed="false">New only</button></div></div>`;
    // By level: the same spells as a leveling list, like the What's Training addon. A slider says what level you are: learned, next up, later.
    const raceOf = n => { const cr = ((window.CLASS_RACIALS || {})[cls] || {}).races || {}; return Object.keys(cr).filter(r => cr[r].some(x => x[0] === n)).join(' / '); };   // a class racial spell says whose it is
    const lvOf = (n, sub) => { const d = SDX[cls + '|' + n + '|' + (sub || '')], m = d && /level (\d+)/.exec(d.lv || ''); return m ? +m[1] : 0; };
    const lvItem = r => { const ic = own[r.n + '|' + (r.sub || '')] || own[r.n] || icons[r.n], d = SDX[cls + '|' + r.n + '|' + (r.sub || '')] || {}; return `<li data-sk="${cls}|${r.n}|${r.sub || ''}" tabindex="0"><span class="ico">${ic ? `<img src="${ICON(ic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>${tal.has(r.n) ? '<span class="tal">TALENT</span>' : ''}<div class="txt"><b>${r.n}</b><span class="rk">${r.sub || ''}${badge(kindOf(r.n, r.sub))}${d.nt ? `<i class="chg src">${d.nt === 1 ? 'Portal trainer' : d.nt === 3 ? 'Comes with the talent' : 'Tome or quest'}</i>` : ''}${raceOf(r.n) ? `<i class="chg src">${raceOf(r.n)} only</i>` : ''}${r.note ? `<i class="chg src" title="The level Classic's trainer taught it at; a Forever trainer visit will confirm it">${r.note}</i>` : ''}</span></div><span class="ltab">${r.tab}</span></li>`; };
    const lvMark = () => { const host = el.querySelector('.bylv'); if(!host) return; const secs = [...host.querySelectorAll('.lvsec[data-l]')], next = secs.map(x => +x.dataset.l).find(L => L > myLv); let known = 0, all = 0;
      secs.forEach(x => { const L = +x.dataset.l, n = x.querySelectorAll('li').length; all += n; if(L <= myLv) known += n; x.className = 'lvsec ' + (L <= myLv ? 'known' : L === next ? 'next' : 'later'); x.querySelector('h4 small').textContent = L <= myLv ? '' : L === next ? 'next up' : ''; });
      host.querySelector('#lvNum').textContent = myLv; host.querySelector('.lvsum').textContent = `${known} of ${all} learned by level ${myLv}${next ? ` · next at level ${next}` : ' · that is all of them'}`; };
    // The General tab's trainer passives belong on a leveling list too (u/bessaai, 28 Sep: Dual Wield, Parry). The game files carry no
    // learned level for them (SpellLevels has no Dual Wield row and says 1 for Parry; the trainer's level is server data). Warrior Parry 6
    // was read in game (Dannal Stern, Tirisfal, 17 Sep 2026, Beta Mine ingame report). The others are the Classic Era trainer levels as
    // WhatsTraining (MIT) carries them and the Forever addon SpellbookExtended ships them (Data/<Class>.lua, 28 Sep 2026); they are marked
    // "Classic trainer level" until a Forever trainer visit reads each one. Nothing here is guessed.
    const TRAINER_PASSIVE = {Warrior: {Parry: [6, 'game'], 'Dual Wield': [20, 'classic']}, Rogue: {'Dual Wield': [10, 'classic'], Parry: [12, 'classic']}, Hunter: {Parry: [8, 'classic'], 'Dual Wield': [20, 'classic']}, Paladin: {Parry: [8, 'classic']}}, TRAINER_TAUGHT = new Set(['Dual Wield', 'Parry']);
    const drawLevels = () => { const host = el.querySelector('.bylv'); if(!host) return; const rows = [], talRows = [], trRows = [], met = new Set(); tabs.forEach(t => { if(t.name === 'General'){ t.spells.forEach(([n, sub]) => { if(sub !== 'Passive' || !TRAINER_TAUGHT.has(n) || !keep([n, sub])) return; const e = (TRAINER_PASSIVE[cls] || {})[n], L = e ? e[0] : 0, r = {n, sub, L, tab: 'Trainer', note: e && e[1] === 'classic' ? 'Classic trainer level' : ''}; if(L > 0) rows.push(r); else trRows.push(r); }); return; } t.spells.forEach(([n, sub]) => { const first = !met.has(n); met.add(n); if(!keep([n, sub])) return; const L = lvOf(n, sub), r = {n, sub, L, tab: t.name.replace(/ \(.*\)$/, '')};
        if(tal.has(n) && first) talRows.push(r); else if(L > 0) rows.push(r); }); });
      rows.sort((a, b) => a.L - b.L || a.n.localeCompare(b.n)); const by = new Map(); rows.forEach(r => { if(!by.has(r.L)) by.set(r.L, []); by.get(r.L).push(r); });
      host.innerHTML = `<div class="lvhead"><label>I'm level <b id="lvNum">${myLv}</b><input type="range" id="lvRange" min="1" max="60" value="${myLv}" aria-label="Your level"></label><span class="lvsum"></span></div>` + ([...by.entries()].map(([L, rs]) => `<section class="lvsec" data-l="${L}"><h4><b>Level ${L}</b><small></small></h4><ol class="sgrid lvl">${rs.map(lvItem).join('')}</ol></section>`).join('') || `<p class="crs">Nothing ${filt === 'new' ? 'new' : 'new or reworked'} for this class.</p>`)
        + (talRows.length ? `<section class="lvsec tals"><h4><b>From your talents</b><small>when you spend the point</small></h4><ol class="sgrid lvl">${talRows.sort((a, b) => a.n.localeCompare(b.n)).map(lvItem).join('')}</ol></section>` : '')
        + (trRows.length ? `<section class="lvsec tals"><h4><b>From the trainer</b><small>level not read in game yet</small></h4><ol class="sgrid lvl">${trRows.sort((a, b) => a.n.localeCompare(b.n)).map(lvItem).join('')}</ol></section>` : ''); lvMark(); };
    const syncView = () => { el.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view)); el.querySelectorAll('[data-filt]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filt === filt));
      const bc = el.querySelector('.bookcover'), lv = el.querySelector('.bylv'); bc.hidden = view !== 'book'; lv.hidden = view !== 'level'; if(view === 'level') drawLevels(); else { const f = el.querySelector('.pgface'); if(f) f.innerHTML = face(); fitBook(); } };
    el.classList.add('open'); el.innerHTML = ctl + `<div class="bookcover"><div class="sheen"></div><div class="page"><div class="spine"></div><div class="motes"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="pgface in">${face()}</div></div><div class="btabs" role="tablist">${tabs.map((t, i) => `<button class="btab${i === cur ? ' on' : ''}" data-tab="${i}" type="button" role="tab" aria-selected="${i === cur}"><img src="${ICON(t.icon)}" alt=""><span>${t.name.replace(/ \(.*\)$/, '')}</span></button>`).join('')}</div></div><div class="bylv" hidden></div>`;
    // One height for the whole book: every page's face is measured off screen and the page holds the tallest, so the pager
    // never moves between pages or during a turn. Re-done when the fold opens and when the width changes (phones let it collapse).
    const fitBook = () => { const pg = el.querySelector('.page'), f = el.querySelector('.pgface'); if(!pg || !f) return; if(innerWidth <= 760 || !el.offsetWidth){ pg.style.minHeight = ''; return; }
      const probe = document.createElement('div'); probe.className = 'pgface'; probe.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;animation:none;flex:none;height:auto;pointer-events:none'; pg.appendChild(probe);
      const c0 = cur, p0 = page; let best = 0;
      tabs.forEach((t, ti) => { cur = ti; for(let k = 0; k < pagesOf(t); k++){ page = k; probe.innerHTML = face(); best = Math.max(best, probe.offsetHeight); } });
      cur = c0; page = p0; probe.remove(); pg.style.minHeight = best ? best + 'px' : ''; };
    el._fit = fitBook;
    if(!el._io && 'IntersectionObserver' in window){ el._io = new IntersectionObserver(es => el.classList.toggle('idle', !es[0].isIntersecting)); el._io.observe(el); }   // rest the effects while the book is off screen
    let busy = false;
    const flip = (dir) => {
      const f = el.querySelector('.pgface'); if(!f) return; busy = true;
      const tabsOn = () => el.querySelectorAll('.btab').forEach((b, i) => { b.classList.toggle('on', i === cur); b.setAttribute('aria-selected', i === cur); });
      const done = () => { f.innerHTML = face(); f.classList.remove('out', 'still'); void f.offsetWidth; f.classList.add('in'); tabsOn(); busy = false; };
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){ done(); return; }
      const pg = el.querySelector('.page');
      if(innerWidth <= 760 || !pg){ f.classList.remove('in'); f.classList.add('out'); let did = false; const once = () => { if(did) return; did = true; done(); }; f.addEventListener('animationend', once, {once: true}); setTimeout(once, 450); return; }
      // leaf turn: the old spread stays under a static half and a turning leaf; the new spread is already underneath
      const oldHTML = f.innerHTML, h0 = f.offsetHeight;
      f.classList.remove('in', 'out'); f.classList.add('still'); f.innerHTML = face(); tabsOn();
      const newHTML = f.innerHTML, fwd = (dir || 1) > 0, h = Math.max(h0, f.offsetHeight);
      const wrap = html => `<div class="lfw" style="height:${h}px"><div class="pgface">${html}</div></div>`;
      const stat = document.createElement('div'); stat.className = 'lf s ' + (fwd ? 'l' : 'r'); stat.style[fwd ? 'left' : 'right'] = '0'; stat.innerHTML = wrap(oldHTML);
      const leaf = document.createElement('div'); leaf.className = 'leaf ' + (fwd ? 'fwd' : 'bwd');
      leaf.innerHTML = `<div class="lf f">${wrap(oldHTML)}</div><div class="lf b">${wrap(newHTML)}</div>`;
      pg.classList.add('turning'); pg.appendChild(stat); pg.appendChild(leaf);
      // the face swap: once the leaf has turned past edge-on (its rendered matrix's first cell, cos of the angle, goes negative) the back
      // face shows and the front hides. Read off the real transform every frame, so it holds in a browser that ignores backface-visibility
      let raf = 0; const watch = () => { if(!leaf.isConnected) return; const m = getComputedStyle(leaf).transform, c = m && m !== 'none' ? parseFloat(m.slice(m.indexOf('(') + 1)) : 1; leaf.classList.toggle('past', c < 0); raf = requestAnimationFrame(watch); }; watch();
      const fin = () => { cancelAnimationFrame(raf); leaf.remove(); stat.remove(); pg.classList.remove('turning'); busy = false; };
      leaf.addEventListener('animationend', e => { if(e.target === leaf) fin(); }); setTimeout(() => { if(leaf.isConnected) fin(); }, 1400);
    };
    // next past the last page turns to the next tab; previous before the first page turns back a tab, like leafing through the real book
    const pagesOf = t => Math.max(1, Math.ceil(rowsOf(t).length / PER));
    const nav = dir => { if(busy || view !== 'book') return; if(dir > 0){ if(page < pagesOf(tabs[cur]) - 1) page++; else if(cur < tabs.length - 1){ cur++; page = 0; } else return; } else { if(page > 0) page--; else if(cur > 0){ cur--; page = pagesOf(tabs[cur]) - 1; } else return; } hideTip(); flip(dir); };
    let sx = null, sy = null;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, {passive: true});
    el.addEventListener('touchend', e => { if(sx == null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) nav(dx < 0 ? 1 : -1); }, {passive: true});
    el.addEventListener('input', e => { if(e.target.id === 'lvRange'){ myLv = +e.target.value; lvMark(); } });
    el.addEventListener('keydown', e => { if(e.target.closest('input') || view !== 'book') return; if(e.key === 'ArrowRight'){ e.preventDefault(); nav(1); } if(e.key === 'ArrowLeft'){ e.preventDefault(); nav(-1); } });
    el.addEventListener('click', e => {
      if(busy) return;
      const vb = e.target.closest('[data-view]'); if(vb){ hideTip(); view = vb.dataset.view; syncView(); track('spellbook_view', {view}); return; }
      const fb2 = e.target.closest('[data-filt]'); if(fb2){ hideTip(); filt = fb2.dataset.filt; page = 0; syncView(); track('spellbook_filter', {filt}); return; }
      const ar = e.target.closest('#allRanks'); if(ar){ hideTip(); allRanks = ar.checked; page = 0; const f = el.querySelector('.pgface'); if(f) f.innerHTML = face(); track('spellbook_all_ranks', {on: allRanks}); return; }
      const tb = e.target.closest('.btab'); if(tb){ hideTip(); const i = +tb.dataset.tab; if(i !== cur){ const d = i > cur ? 1 : -1; cur = i; page = 0; flip(d); } return; }
      const pb = e.target.closest('[data-pg]'); if(pb && !pb.disabled) nav(+pb.dataset.pg);
      const li = e.target.closest('.sgrid li'); if(li){ if(li.classList.contains('tipon')){ if(Date.now() - tipAt > 500) hideTip(); } else showTip(li); }
    });
    // spell tooltips (hover on desktop, tap on touch)
    const SD = window.SPELL_DESC || {};
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const tipHTML = (li) => {
      const [c, n, sub] = li.dataset.sk.split('|'); const d = SD[li.dataset.sk];
      let h = `<div class="sttn"><b>${esc(n)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
      if(!d) return h + `<div class="sttd muted">No tooltip read for this one yet.</div>`;
      h += (d.l || []).filter(p => p[0] || p[1]).map(p => `<div class="sttl"><span>${esc(p[0] || '')}</span><span>${esc(p[1] || '')}</span></div>`).join('');
      if(d.lv && d.s === 'classic') h += `<div class="sttl lv"><span>${esc(d.lv)} in Classic</span><span></span></div>`;
      if(d.lv && d.s === 'beta') h += `<div class="sttl lv"><span>${esc(d.nt === 1 || d.nt === 2 ? d.lv.replace('Learned at', 'Requires') : d.lv)}</span><span></span></div>`;
      const crr = ((window.CLASS_RACIALS || {})[c] || {}).races || {}, onlyFor = Object.keys(crr).filter(r => crr[r].some(a => a[0] === n));
      if(onlyFor.length) h += `<div class="sttl nt"><span>Racial spell: ${esc(onlyFor.join(' and '))} ${esc(c)}s only.</span><span></span></div>`;
      if(d.nt) h += `<div class="sttl nt"><span>${d.nt === 3 ? 'Comes with the talent. No trainer sells it, taking the talent puts it in your book.' : (d.nt === 1 ? 'Taught by a portal trainer, not the class trainer.' : 'Not sold by the class trainer. Comes from a tome, a quest or a drop.') + ' Checked in game.'}</span><span></span></div>`;
      if(d.d) h += `<div class="sttd">${esc(d.d)}</div>`;
      if(d.fx) h += `<div class="sttl nt"><span>${esc(d.fx)}</span><span></span></div>`;
      if(d.s === 'beta' && (d.sc || d.co)) h += `<div class="sttl lv"><span>${esc(d.sc || '')}</span><span>${d.co ? 'Scales with ' + esc(d.co) : ''}</span></div>`;
      if(d.was && d.was !== n) h += `<div class="sttl nt"><span>Classic called this ${esc(d.was)}. Same spell, new name.</span><span></span></div>`;
      if((d.s === 'demo' || d.s === 'beta') && d.cs){
        // Classic comparison: same, new, or the words that changed (plus the old cost/cast line when that moved)
        if(d.cs === 'note') h += `<div class="cl"><b>${esc(d.cn)}</b></div>`;
        else if(d.cs === 'new') h += `<div class="cl"><b>New in Forever.</b> ${esc(d.cn ? d.cn.replace(/^New in Forever\.\s*/, '') : 'No Classic spell with this name and rank.')}</div>`;
        else if(d.cs === 'same') h += `<div class="cl"><b>Same as Classic.</b></div>`;
        else {
          const cline = d.cl ? d.cl.filter(p => p[0] || p[1]).map(p => [p[0], p[1]].filter(Boolean).join(' ')).join(' · ') : '';
          // one paragraph: Classic's words struck through, Forever's highlighted, so the tooltip stays the size of a tooltip
          const w = d.cd ? wordDiff(d.cd, d.d || '') : null;
          h += `<div class="cl"><b>${d.ck === 'n' ? 'Same spell, new numbers' : 'Reworked since Classic'}</b><span class="key"><del>Classic</del> <ins>Forever</ins></span>${cline ? `<div class="m">Classic: ${esc(cline)}</div>` : ''}${w ? `<div class="both">${w.bothH}</div>` : ''}${d.cx ? `<div class="m">${esc(d.cx)}</div>` : ''}</div>`;
        }
      }
      const hf = (d.src || '').match(/server hotfix (\d{4})-(\d\d)-(\d\d)/);   // export_site.py stamps a rank a hotfix overlay changed
      h += d.s === 'beta' && hf ? `<div class="stts ok">Forever text as the server's hotfix of ${+hf[3]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+hf[2] - 1]} has it, read from the beta's hotfix cache by other readers and checked against Blizzard's notes; the client's files do not carry it. Numbers at level 60 with no gear.</div>` : d.s === 'beta' ? `<div class="stts ok">Forever text from the beta client, numbers at level 60 with no gear.</div>` : d.s === 'demo' ? `<div class="stts ok">Real Forever text, read off BlizzCon demo footage${d.src ? ': ' + esc(d.src) : ''}</div>` : `<div class="stts">Classic text${d.r && d.r !== sub ? ' (' + esc(d.r) + ')' : ''}, shown for reference. Nobody has read this one on Forever footage yet, so it may have changed.</div>`;
      return h;
    };
    let tip = null, tipAt = 0;
    let tipScroll = null;
    const hideTip = () => { if(tip){ tip.remove(); tip = null; } if(tipScroll){ removeEventListener('scroll', tipScroll); tipScroll = null; } el.querySelectorAll('.tipon').forEach(x => x.classList.remove('tipon')); };
    const phone = () => matchMedia('(max-width:760px)').matches;
    // desktop: beside the spell like the game's tooltip, flipped to the other side when the screen edge is close, never clipped by the book
    // desktop: just past the spell's name, in the blank part of the page, like the game's tooltip sits by the cursor. Pushed in
    // from the screen edge when it would not fit; flipped to the icon's left only when pushing would cover the spell itself.
    const place = (li) => {
      const lr = li.getBoundingClientRect(), tx = li.querySelector('.txt'), tr = tx ? tx.getBoundingClientRect() : lr, tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = tr.right + 14;
      if(x + tw > innerWidth - 8){ x = innerWidth - tw - 8; if(x < tr.right - 40) x = lr.left - tw - 10; }
      if(x < 8) x = 8;
      let y = lr.top - 4; if(y + th > innerHeight - 8) y = Math.max(8, innerHeight - th - 8);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const showTip = (li) => {
      hideTip(); tipAt = Date.now(); tip = document.createElement('div'); tip.className = 'stt'; tip.innerHTML = tipHTML(li); li.classList.add('tipon');
      if(phone()){
        // phones: the tooltip unfolds inside the row you tapped, like opening a fold in the book; nothing floats, nothing is covered
        tip.classList.add('inline'); li.appendChild(tip); tip.addEventListener('click', ev => ev.stopPropagation());
        requestAnimationFrame(() => { const r = tip.getBoundingClientRect(); if(r.bottom > innerHeight - 12) tip.scrollIntoView({block: 'end', behavior: 'smooth'}); });
      } else {
        document.body.appendChild(tip); place(li); tipScroll = () => { if(tip) place(li); };
        addEventListener('scroll', tipScroll, {passive: true});
      }
    };
    el.addEventListener('mouseover', e => { const li = e.target.closest('.sgrid li'); if(!li) return; if(!li.classList.contains('tipon')) showTip(li); });
    let bookResting = null;   // the row whose tooltip stays up after a leave that went nowhere (iPad idle cursor, see leaveTip above)
    el.addEventListener('mouseout', e => { if(matchMedia('(hover: none)').matches) return; const li = e.target.closest('.sgrid li'); if(!li || li.contains(e.relatedTarget)) return; if(navigator.maxTouchPoints > 1 && e.relatedTarget === null){ bookResting = li; return; } bookResting = null; hideTip(); });
    document.addEventListener('mousemove', e => { if(bookResting && !bookResting.contains(e.target)){ bookResting = null; hideTip(); } }, {passive:true});
    // wheel over the spell scrolls its tooltip in the rare case it is taller than the screen (no scrollbar is drawn)
    el.addEventListener('wheel', e => { if(!tip || phone()) return; const li = e.target.closest('.sgrid li'); if(li && li.classList.contains('tipon') && tip.scrollHeight > tip.clientHeight + 1){ tip.scrollTop += e.deltaY; e.preventDefault(); } }, {passive: false});
    el.addEventListener('focusin', e => { const li = e.target.closest('.sgrid li'); if(li) showTip(li); });
    el.addEventListener('focusout', e => { const li = e.target.closest('.sgrid li'); if(li) hideTip(); });
    document.addEventListener('click', e => { if(tip && !e.target.closest('.sgrid li')) hideTip(); });
  }

  function renderRacials(){
    const all = $('#allRaces').checked, cls = state.cls, box = $('#factions'); const key = cls + '|' + all; if(box.dataset.key === key) return; box.dataset.key = key; box.innerHTML = '';
    $('#raceCls').textContent = 'a ' + cls; let shown = 0, total = 0;
    Object.entries(window.RACIALS || {}).forEach(([fac, races]) => {
      const f = document.createElement('div'); f.className = 'faction ' + fac.toLowerCase(); f.innerHTML = `<h3>${fac}</h3>`;
      races.forEach(r => {
        total++; const ok = r.classes.includes(cls); if(!ok && !all) return; shown++;
        f.insertAdjacentHTML('beforeend', raceCard(r, ok));
      });
      if(f.children.length > 1) box.appendChild(f);
    });
    $('#raceCnt').textContent = `${shown} of ${total} races`; if(window.syncRaceAll) window.syncRaceAll();
    const cr = (window.CLASS_RACIALS || {})[cls], ab = (window.CLASS_ABILITIES || {})[cls], host = $('#classRacials');
    if(!cr && !ab && !(window.SPELLBOOKS || {})[cls]){ host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false; let h = '';
    const fan = icons => `<span class="lfan" aria-hidden="true">${icons.slice(0,3).map(ic => `<img src="${ICON(ic)}" alt="" loading="lazy">`).join('')}</span>`;
    const fold = (id, icons, title, sub, body, open=true) => `<details class="legacy fold" id="${id}"${open?' open':''}><summary>${fan(icons)}<span class="ltitle"><strong>${title}</strong><span>${sub}</span></span><span class="lpill"><span class="show">Show</span><span class="hide">Hide</span></span></summary>${body}</details>`;
    const perkLi = ([n,t,ic]) => `<li>${ic ? `<img src="${ICON(ic)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span></span>'}<div><b>${n}</b><span>${t}</span></div></li>`;
    const sb = (window.SPELLBOOKS || {})[cls];
    if(sb){
      const miss = sb.missing.length ? `<p class="crs">Not opened on stream: ${sb.missing.join(', ')}${sb.trainer ? ' (filled in from the trainer list where possible)' : ''}.</p>` : '';
      const isBeta = sb.source === 'beta';
      const lvNote = sb.levels ? (isBeta ? `<p class="crs"><b>Small numbers</b> under a spell are the level each rank is learned at.</p>` : `<p class="crs"><b>Small numbers</b> under a spell are the level each rank is trained at, your rank lit. A ? is a rank the trainer list didn't show. ${sb.levelsSource || ''}</p>`) : '';
    // popular builds: what people actually built on the site, from our own analytics
    const pop = popFor(cls);
    if(pop){
      const trees = DATA[cls].trees, byName = {}; trees.forEach(t => t.talents.forEach(x => { byName[x.name] = x; }));
      const specbar = `<div class="specbar">${trees.map(t => `<i style="flex:${pop.spec[t.name] || 0};background:${['#c9a24a','#7fc8ff','#9fe870'][trees.indexOf(t)]}" title="${t.name} ${pop.spec[t.name] || 0}%"></i>`).join('')}</div><div class="speckey">${trees.map(t => `<span><img src="${ICON(t.icon)}" alt="">${t.name} <b>${pop.spec[t.name] || 0}%</b></span>`).join('')}</div>`;
      const top = `<ol class="poptop">${pop.top.map((b, i) => { const lead = trees[b.pts.indexOf(Math.max(...b.pts))]; const top1 = pop.top[0].score || 1; return `<li${b.seated ? ' class="seated"' : ''}><span class="rank" title="${b.seated ? `Most popular ${lead.name} build, #${b.rank} overall` : `#${b.rank} most popular ${cls} build`}">#${b.rank}</span><span><span class="pts">${trees.map((t, ti) => `<img src="${ICON(t.icon)}" alt="">${b.pts[ti]}${ti < trees.length - 1 ? '<i>/</i>' : ''}`).join('')}&nbsp; <i style="font-style:normal;color:var(--muted);font-weight:400">${lead.name}</i></span><span class="pbar" title="Popularity next to the #1 build"><i style="width:${Math.max(3, Math.round(100 * (b.score || 0) / top1))}%"></i></span><span class="meta">${b.seated ? `<b>Top ${lead.name} build</b> · ` : ''}shared ${b.shared} · saved ${b.saved} · opened ${b.opened}${b.views ? ` · viewed ${b.views}` : ''}${b.variants ? ` · <b title="shares, saves and opens of every complete build within four points of this one">across ${b.variants + 1} close builds</b>` : ''}</span></span><a class="load" href="${U(b.code)}">Load</a></li>`; }).join('')}</ol>`;
      const col = (title, rows, cls2) => `<div class="${cls2}"><h4>${title}</h4><ul>${rows.map(([pct, name, tree]) => { const x = byName[name]; return `<li>${x ? `<img src="${ICON(x.icon)}" alt="">` : ''}${name}<small>${tree}</small><b>${pct}%</b></li>`; }).join('')}</ul></div>`;
      // dates read month, day, year (Chris, 25 Sep): the counter's older '13 to 25 Sep 2026' and '13 Sep to 2 Oct 2026' shapes are turned round here too
      const MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', mdy = w => String(w || '').replace(new RegExp(`(\\d{1,2}) to (\\d{1,2}) ${MON} (\\d{4})`), '$3 $1 to $2, $4').replace(new RegExp(`(\\d{1,2}) ${MON}\\b`, 'g'), '$2 $1').replace(new RegExp(`(${MON} \\d{1,2}(?: to ${MON} \\d{1,2})?) (\\d{4})`), '$1, $4');
      h += fold('foldPopular', trees.map(t => t.icon), `Popular ${cls} builds`, `What people planned here for level 60, ${mdy(pop.window || POPULAR.window)}.`,
        `<div class="pophead"><span><b>${pop.builds.toLocaleString()}</b> ${pop.buildsLabel || 'builds shared, saved or opened'}</span><span><b>${pop.full.toLocaleString()}</b> with all 51 points</span><span><b>${pop.shared.toLocaleString()}</b> shared</span><span><b>${pop.saved.toLocaleString()}</b> saved</span><span><b>${pop.opened.toLocaleString()}</b> build links opened</span></div>` + specbar + top +
        `<div class="pickcols">${col('Almost everyone takes', pop.most, 'high')}${col('Almost nobody takes', pop.least, 'low')}</div><label class="prtoggle"><input type="checkbox" id="pickRates"${document.body.classList.contains('pr') ? ' checked' : ''}> Show pick rates on the trees</label><p class="crs">Builds within a few points of each other count as one, and the rows are ranked by how often people shared, saved or opened them.${pop.stale ? ` ${pop.stale.toLocaleString()} complete build${pop.stale === 1 ? '' : 's'} from before the trees changed ${pop.stale === 1 ? 'is' : 'are'} left out, since the game would not take ${pop.stale === 1 ? 'it' : 'them'} now.` : ''}${pop.epoch && !pop.epoch.live ? ` Since the ${(d => { const [y,m,dd] = d.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + +dd; })(pop.epoch.date)} patch: ${pop.epoch.complete.toLocaleString()} complete ${cls} build${pop.epoch.complete === 1 ? '' : 's'} so far. At ${pop.epoch.need.toLocaleString()} this list will rank those alone.` : ''}</p>`,
        ENTRY_PATH === '/popular' || true);
    }
      h += fold('foldSpellbook', [DATA[cls].icon], isBeta ? `${cls} spellbook` : `${cls} spellbook at level ${sb.level}`, isBeta ? `Every ${cls} trainer spell to 60, every rank. ${sb.checked ? 'Checked against the game files and in game.' : 'Checked against the game files.'}` : `Every spell ${/^[AEIOU]/.test(sb.race) ? 'an' : 'a'} ${sb.race} ${cls} had at level ${sb.level} in the demo, tab by tab, with ranks.`,
        `<div class="book" id="book"></div><p class="crs"><b>talent</b> tag = ${isBeta ? 'an ability a talent grants. It shows in your book once you take the talent' : 'a Forever talent this character had taken, not a trainer spell'}.</p><ul class="sbnotes">${sb.notes.map(n => `<li>${n}</li>`).join('')}</ul>${miss}${lvNote}<p class="crs">${isBeta ? `Numbers are the beta client's at level 60 with no gear on, so your in-game tooltip will read a bit higher. Show all ranks works like the checkbox in the game's book. The General tab still comes from the demo spellbook.` : `Read frame by frame off stream footage (${sb.seen}). Characters were capped at ${sb.level}, so anything trained later isn't here.`}</p>`, !matchMedia('(max-width:640px)').matches);   // open on desktop, collapsed on phones
    }
    let abDone = false;
    // a class racial spell (CLASS_RACIALS) is one race's, so it is listed in the racial spells fold and never here
    const isRacial = n => Object.values(((window.CLASS_RACIALS || {})[cls] || {}).races || {}).some(abs => abs.some(a => a[0] === n));
    if(sb && sb.source === 'beta'){ const SDA = window.SPELL_DESC || {}, ownI = sb.icons || {}, allI = window.SPELLBOOK_ICONS || {}, seenN = new Set(), news = [], ren = [];
      sb.tabs.forEach(t => { if(/^(Pets|Demons)$/.test(t.name)) return; t.spells.forEach(([n, sub]) => { if(seenN.has(n)) return; seenN.add(n); if(isRacial(n)) return; const d = SDA[cls + '|' + n + '|' + (sub || '')]; if(!d) return; const lv = (/level (\d+)/.exec(d.lv || '') || [])[1], ic = ownI[n + '|' + (sub || '')] || ownI[n] || allI[n];
        if(d.was && d.was !== n) ren.push([n, `Classic called it ${d.was}. Same spell, new name.`, ic]); else if(d.cs === 'new') news.push([n, `${lv ? 'Level ' + lv + ' · ' : ''}${t.name}${DATA[cls].trees.some(tr => tr.talents.some(x => x.name === n)) ? ' · from a talent' : ''}. ${d.d || ''}`, ic]); }); });
      const gone = sb.gone || [], grp = (title, rows) => rows.length ? `<div class="ltree"><h4>${title} <small style="color:var(--muted);font-weight:400">${rows.length}</small></h4><ul>${rows.map(perkLi).join('')}</ul></div>` : '';
      if(news.length || ren.length || gone.length){ abDone = true; h += fold('foldAbilities', news.concat(ren).map(a => a[2]).filter(Boolean), `New ${cls} abilities`, `${news.length} new in Forever${ren.length ? `, ${ren.length} renamed` : ''}${gone.length ? `, ${gone.length} gone` : ''}. From the beta's game files, compared with Classic by spell id.${cr ? ` Racial spells are in the ${cls} racial spells fold.` : ''}`,
        `<div class="ltrees one">${grp('New in Forever', news)}${grp('Renamed', ren)}${gone.length ? `<div class="ltree"><h4>Gone since Classic <small style="color:var(--muted);font-weight:400">${gone.length}</small></h4><ul><li><span></span><div><span>${gone.join(', ')}.</span></div></li></ul></div>` : ''}</div>`, ENTRY_PATH === '/abilities'); } }
    if(ab && !abDone) h += fold('foldAbilities', ab.map(a => a[2]), `New ${cls} abilities`, `New or changed since Classic.`,
      `<div class="ltrees one"><div class="ltree"><ul>${ab.map(perkLi).join('')}</ul></div></div>`, ENTRY_PATH === '/abilities');   // starts collapsed unless you came for the abilities page
    if(cr){
      const rows = Object.entries(cr.races).filter(([race]) => all || races_can(race, cls));
      const icons = rows.flatMap(([, abs]) => abs.map(a => a[2]).filter(Boolean));
      // Classic racials that every Priest learns now (u/Lunilah, 24 Sep 2026): Fear Ward was the Dwarves', Devouring Plague the Undead's.
      // Classic still has their spell ids, so nothing computed flags them; the list is by hand and only shows what the beta book holds.
      const SDA = window.SPELL_DESC || {}, ownI = (sb && sb.icons) || {}, allI = window.SPELLBOOK_ICONS || {};
      const spellTip = n => { const k = Object.keys(SDA).find(k => k.indexOf(cls + '|' + n + '|') === 0), d = k && SDA[k]; return d ? {t: d.d || '', lv: (/level (\d+)/.exec(d.lv || '') || [])[1] || ''} : null; };
      const RACE_ICON = {}; Object.values(window.RACIALS || {}).flat().forEach(r => { if(r && r.race) RACE_ICON[r.race] = r.icon; });
      const WAS_RACE = ({Priest: [['Dwarf', "the Dwarves'", 'Fear Ward'], ['Undead', "the Undead's", 'Devouring Plague']]})[cls] || [];
      const was = WAS_RACE.map(([r, plural, n]) => [r, plural, n, spellTip(n)]).filter(x => x[3]);
      const wasRow = was.length ? `<div class="ltree wasrace"><h4>Every ${cls}'s now <small style="color:var(--muted);font-weight:400">${was.length}</small></h4><p class="wr-lead">One race's in Classic, every ${cls} learns them now. Hover a spell to read it.</p><div class="wr">${was.map(([r, plural, n, st]) => { const ic = ownI[n] || allI[n]; return `<div class="wr-card"><span class="wr-race">${RACE_ICON[r] ? `<img src="${ICON(RACE_ICON[r])}" alt="${r}">` : ''}</span><span class="wr-who">was ${plural}</span><span class="wr-sp"><span class="wr-s" tabindex="0" data-name="${n.replace(/"/g, '&quot;')}" data-lv="${st.lv}" data-tip="${st.t.replace(/"/g, '&quot;')}">${ic ? `<img src="${ICON(ic)}" alt="">` : ''}${n}</span></span></div>`; }).join('')}</div></div>` : '';
      setTimeout(() => { document.querySelectorAll('.wr-s[data-tip]').forEach(s => { const im = s.querySelector('img'), html = `<div class="h">${im ? `<img src="${im.src}" alt="">` : ''}<div><b>${s.dataset.name}</b><span>${s.dataset.lv ? 'Level ' + s.dataset.lv + ' · ' : ''}every ${cls}'s now</span></div></div><div class="d">${s.dataset.tip}</div>`;
        const show = e => { if(TOUCH){ sheetAt = null; $('#sheetBody').innerHTML = html; $('#sheetAdd').hidden = true; $('#sheetRem').hidden = true; $('#sheet').hidden = false; return; } tipAt = null; tip.innerHTML = html; tip.hidden = false; moveTip(e); };
        s.addEventListener('mouseenter', show); s.addEventListener('mousemove', moveTip); s.addEventListener('mouseleave', leaveTip); s.addEventListener('focus', show); s.addEventListener('blur', hideTip); s.addEventListener('click', e => { if(TOUCH) show(e); }); }); }, 0);
      h += fold('foldClassRacials', icons, `${cls} racial spells`, cr.note,
        (wasRow ? `<div class="ltrees one">${wasRow}</div>` : '') + `<div class="ltrees">` +
        rows.map(([race, abs]) => { const rr = Object.values(window.RACIALS).flat().find(x => x.race.replace(/\s*\(.*\)/,'') === race); return `<div class="ltree"><h4>${rr ? `<img class="portrait" src="${ICON(rr.icon)}" alt="" loading="lazy">` : ''}${race}</h4><ul>${abs.map(perkLi).join('')}</ul></div>`; }).join('') +
        `</div>${cr.sources ? `<p class="crs">${cr.sources}</p>` : ''}`, false);
    }
    host.innerHTML = h;
    if(sb){ buildBook(cls, sb); const bk = $('#book'), fd = $('#foldSpellbook'); if(bk && bk._fit){ bk._fit(); if(fd) fd.addEventListener('toggle', () => { if(fd.open) bk._fit(); }); } }
    if(sb && window.__wantBook){ window.__wantBook = false; $('#foldSpellbook').open = true; track('spellbook_link'); setTimeout(() => { const g = $('#foldSpellbook'); if(g && !g._detached){ g.open = true; g.scrollIntoView({block: 'start', behavior: 'smooth'}); } }, 250); }
    host.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => track(d.open ? 'fold_opened' : 'fold_closed', {id: d.id, cls})));
  }
  function races_can(race, cls){ return Object.values(window.RACIALS||{}).flat().some(r => r.race.replace(/\s*\(.*\)/,'') === race && r.classes.includes(cls)); }
  $('#allRaces').onchange = renderRacials;
  const raceAllBtn = $('#raceAll'), syncRaceAll = window.syncRaceAll = () => { if(!raceAllBtn) return; const cards = [...$('#factions').querySelectorAll('.rc')], allOpen = cards.length && cards.every(c => c.classList.contains('open')); raceAllBtn.textContent = allOpen ? 'Close all' : 'Open all'; raceAllBtn.hidden = !cards.length; };
  if(raceAllBtn) raceAllBtn.addEventListener('click', () => { const cards = [...$('#factions').querySelectorAll('.rc')], open = !cards.every(c => c.classList.contains('open')); cards.forEach(c => { c.classList.toggle('open', open); c.setAttribute('aria-expanded', open); }); syncRaceAll(); if(open) track('race_opened', {race: 'all'}); });
  $('#factions').addEventListener('click', e => { const c = e.target.closest('.rc'); if(!c) return;
    // selecting text to copy it is not a tap on the card (u/Typical_Effect_9054, 28 Sep): a selection inside the card leaves it as it is
    const sel = window.getSelection && window.getSelection(); if(sel && String(sel).trim() && sel.anchorNode && c.contains(sel.anchorNode)) return;
    const open = !c.classList.contains('open'); c.classList.toggle('open', open); c.setAttribute('aria-expanded', open); syncRaceAll(); if(open) track('race_opened', {race: c.querySelector('.nm').textContent}); });
  $('#factions').addEventListener('keydown', e => { if((e.key==='Enter'||e.key===' ') && e.target.classList.contains('rc')){ e.preventDefault(); e.target.click(); } });
  function render(){ if(treesEl.dataset.cls === state.cls && treesEl.children.length) updateTrees(); else { renderTrees(); updateTrees(); hideGhost(); } renderTop(); renderRacials(); renderGhost(); renderOrder(); renderPrSet(); animPr(); renderStale(); }
  // is this cell one the settle step emptied, while the card is still up
  const staleUp = () => state.back && !state.back.done && state.back.cls === state.cls && (totalPts(state.cls) < pool(state.cls) || state.back.refit || state.back.full);
  const staleAt = (cls, ti, i) => (staleUp() && !state.back.refit && state.back.list.find(b => !b.gone && b.cls === cls && b.ti === ti && b.i === i)) || null;
  // The card: which talents lost points, why (today's rule, in the words the tooltip uses), and the beta build that did it, read from the
  // tracker's own rows for this class (a moved talent, a new arrow, a gone talent). Up until the build is whole again, Reset, or the x.
  function renderStale(){
    const box = $('#stale'); if(!box) return;
    if(!staleUp()){ if(!box.hidden){ box.hidden = true; box.innerHTML = ''; } return; }
    const s = state.back, cls = s.cls, esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const tal = b => b.gone ? {name: b.name, icon: b.icon, tree: b.tree} : Object.assign({tree: DATA[b.cls].trees[b.ti].name}, DATA[b.cls].trees[b.ti].talents[b.i]);
    const names = new Set(s.list.map(b => tal(b).name));
    // the newest build whose rows for this class moved, re-pointed, replaced or removed a talent that lost points (a change elsewhere is not why)
    let ent = null, rows = [];
    for(const e of (window.UPDATES || [])){ const hit = ((e.talents || {})[cls] || []).filter(r => ['moved','prereq','gone','replaced'].includes(r.kind) && (r.kind === 'replaced' ? names.has(r.before) : names.has(r.talent))); if(hit.length){ ent = e; rows = hit; break; } }
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], when = d => { const [y,m,dd] = String(d || '').split('-'); return m ? `${MON[+m-1]} ${+dd}` : ''; };
    // what moved, one short line per tracker row, in plain words
    const said = new Set(), moves = [];
    rows.forEach(r => { let t = ''; if(r.kind === 'moved') t = r.fromTree !== r.tree ? `<b>${esc(r.talent)}</b> moved from ${esc(r.fromTree)} to ${esc(r.tree)}` : `<b>${esc(r.talent)}</b> moved from row ${r.fromRow} to row ${r.row}`;
      else if(r.kind === 'prereq') t = r.req ? `<b>${esc(r.talent)}</b> now needs ${esc(r.req)} first` : `<b>${esc(r.talent)}</b> no longer needs ${esc(r.oldReq)}`;
      else if(r.kind === 'gone') t = `<b>${esc(r.talent)}</b> is gone`; else if(r.kind === 'replaced') t = `<b>${esc(r.talent)}</b> took ${esc(r.before)}'s place`;
      if(t && !said.has(t)){ said.add(t); moves.push(t); } });
    const phone = matchMedia('(max-width:640px)').matches, its = s.n === 1 ? `one of its points is back in your pool` : `${s.n} of its points are back in your pool`;
    const share = phone ? '' : ' The link you share from here will be the current one.';
    // a tracker entry that is a build names the build; one that is a round of server hotfixes over a build names the hotfixes and the build
    const span = e => { if(!e.from || e.from === e.date) return when(e.date); const m1 = String(e.from).split('-')[1], [, m2, d2] = String(e.date).split('-'); return m1 === m2 ? `${when(e.from)} to ${+d2}` : `${when(e.from)} to ${when(e.date)}`; };   // the round's first day to the day the cache was read: "Oct 1 to 2"
    const bname = ent ? (/ hotfixes$/.test(ent.build) ? `${span(ent)} hotfixes to build ${esc(ent.build.replace(/ hotfixes$/, '').replace(/^1\.60\.1\./, ''))}` : `${when(ent.date)} beta build (${esc(ent.build)})`) : '';
    const lead = ent && moves.length ? `Made before the ${bname}, so ${its}.${share}` : `The trees have changed since it was made, so ${its}.${share}`;
    const chips = s.list.map(b => { const t = tal(b); return `<li>${t.icon ? `<img src="${ICON(t.icon)}" alt="" loading="lazy">` : ''}<div><b>${esc(t.name)}</b><small>${b.gone ? `gone from ${esc(t.tree)}` : esc(b.why.replace(/ Talents$/, ''))}</small></div><i>${b.pts} back</i></li>`; }).join('');
    const f = s.refit || refitPlan(cls);
    let fitCol = '';
    if(f && s.refit){ const same = f.after && ranksFor(cls).every((t, ti) => t.every((v, i) => v === f.after[ti][i])), trees = DATA[cls].trees, tn = (ti, i) => esc(trees[ti].talents[i].name);
      const went = []; f.steps.forEach(({adds}) => adds.forEach(a => went.push(`${a.n} in <b>${tn(a.ti, a.i)}</b>`))); f.steps.forEach(({b}) => went.push(`<b>${tn(b.ti, b.i)}</b> ${b.pts}/${trees[b.ti].talents[b.i].max}`)); (f.extra || []).forEach(a => went.push(`${a.n} in <b>${tn(a.ti, a.i)}</b> <small class="soft" style="margin:0">(${a.rate}% take it)</small>`));
      const who = f.spec ? `${esc(f.spec)} builds` : `${cls} builds`;
      const list = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1], cant = f.cant.map(({b, need, short, road}) => road ? `<b>${tn(b.ti, b.i)}</b> stayed out, its road (${road.n} in ${tn(road.ti, road.i)}) is one ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}` : `<b>${tn(b.ti, b.i)}</b> needs ${need ? `${need} more in ${esc(trees[b.ti].name)}` : short ? `${short} more free point${short === 1 ? '' : 's'}` : 'more in the tree'} first`);
      fitCol = `<div><h5>Filled in</h5><p>${s.n === 1 ? 'The point is' : Math.min(f.used, s.n) === s.n ? `All ${s.n}` : `${Math.min(f.used, s.n)} of the ${s.n}`} placed${f.used > s.n ? ` (with ${f.used - s.n} of your free points on the arrows)` : ''}: ${list(went)}.${f.left > 0 ? ` ${f.left} still yours${f.noData ? ', nothing in the pick rates to place it by' : ''}.` : ''}${cant.length ? ` ${list(cant)}.` : ''}</p>${same ? `<button class="un" type="button">Undo</button>` : ''}</div>`; }
    else if(f){ const L = refitLines(cls, f); fitCol = `<div><h5>Put them back</h5><ul class="plan">${L.lines.map(x => `<li>${x}</li>`).join('')}</ul>${L.note ? `<p class="soft">${L.note}</p>` : ''}<button class="go" type="button">Fill it in for me</button></div>`; }
    // the closest build people make now: the Popular row nearest to the settled build, by points moved
    const near = (() => { const pp = popFor(cls), r = ranksFor(cls); if(!pp || !pp.top || !pp.top.length) return null; let best = null;
      pp.top.forEach(b => { const q = parseCode(b.code); if(!q) return; let d = 0; q.ranks.forEach((t, ti) => t.forEach((v, i) => { d += Math.abs(v - (r[ti] ? r[ti][i] : 0)); })); if(!best || d < best.d) best = {b, d, q}; }); return best && best.d <= 20 ? best : null; })();   // within 20 points moved, else the list has nothing close enough to call closest
    const nearCol = near ? `<div><h5>What people make now</h5><p>The closest Popular build is <a href="${U(near.b.code)}">#${near.b.rank} ${esc(near.b.lead)} ${near.q.ranks.map(t => t.reduce((a, v) => a + v, 0)).join('/')}</a>, ${near.d} point${near.d === 1 ? '' : 's'} apart. Load it to start from there.</p></div>` : '';
    const movedCol = moves.length ? `<div><h5>What moved</h5><ul class="ch">${moves.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
    const cameCol = `<div><h5>What came back</h5><ul class="chips">${chips}</ul>${s.list.some(b => !b.gone) && !s.refit ? `<p class="soft rg">Ringed in orange below; ${TOUCH ? 'tap' : 'hover'} one for why.</p>` : ''}</div>`;
    let body;
    if(phone && f && !s.refit){   // the phone: the offer in one line and the button up top, the story and the plan lines behind More
      // one line on the phone, whatever the class and the names: the phrasings run from full to bare and the first that fits stays (fitLine)
      const L = refitLines(cls, f), placed = Math.min(f.used, s.n), puts = s.n === 1 ? 'Puts the point back' : `Puts ${placed === s.n ? `all ${s.n}` : `${placed} of ${s.n}`} back`, yours = f.left ? `, ${f.left} stay${f.left === 1 ? 's' : ''} yours` : '';
      // a talent skipped for its road (an arrow this spec never takes) is said so, not "out of reach": its points go with the rest on purpose
      const who = f.spec ? `${f.spec} builds` : `${cls} builds`, tn = (ti, i) => DATA[cls].trees[ti].talents[i].name;
      const c1 = f.cant.map(({b, need, short, road}) => road ? `${tal(b).name} skipped: its road, ${road.n} in ${tn(road.ti, road.i)}, is one ${road.rate ? `only ${road.rate}% of ${who} take` : `no ${who.replace(/ builds$/, ' build')} takes`}` : `${tal(b).name} needs ${need ? `${need} more in ${DATA[cls].trees[b.ti].name}` : short ? `${short} more free point${short === 1 ? '' : 's'}` : 'more in the tree'} first`), c2 = f.cant.map(({b, need, short, road}) => road ? `${tal(b).name} skipped (${tn(road.ti, road.i)} road)` : `${tal(b).name} needs ${need || short ? (need || short) + ' more' : 'more'} first`), c3 = f.cant.map(({b, road}) => `${tal(b).name} ${road ? 'skipped' : 'out of reach'}`), nSkip = f.cant.filter(x => x.road).length, nFar = f.cant.length - nSkip, c4 = f.cant.length ? [[nSkip ? `${nSkip} talent${nSkip === 1 ? '' : 's'} skipped` : '', nFar ? `${nFar} out of reach` : ''].filter(Boolean).join(', ')] : [];
      const variants = [`${puts}${yours}. ${c1.join(' ')}${c1.length ? '.' : ''}`, `${puts}${yours}; ${c2.join('; ')}.`, `${puts}${yours}; ${c3.join('; ')}.`, `${puts}${yours}; ${c4.join('')}.`, `${puts}${yours}.`, `${puts}.`].map(x => x.replace(/; \.$/, '.').replace(/\s+\./g, '.'));
      body = `${cameCol}<div><h5>Put them back</h5><p class="fitline" data-v="${esc(JSON.stringify(variants))}">${esc(variants[0])}</p><button class="go" type="button">Fill it in for me</button></div>` +
        `<details class="more"><summary><span class="o">More</span><span class="c">Less</span></summary>${movedCol}<div><h5>What the fill does</h5><ul class="plan">${L.lines.map(x => `<li>${x}</li>`).join('')}</ul>${L.note ? `<p class="soft">${L.note}</p>` : ''}</div>${nearCol}</details>`;
    } else if(phone) body = `${cameCol}${fitCol}<details class="more"><summary><span class="o">More</span><span class="c">Less</span></summary>${movedCol}${nearCol}</details>`;
    else body = `<div class="cols">${[movedCol, cameCol, fitCol, nearCol].filter(Boolean).join('')}</div>`;
    box.innerHTML = `<button class="x" type="button" aria-label="Hide this note">&times;</button><h4><i aria-hidden="true"></i>This build is older than the trees</h4><p class="lead">${lead}</p>${body}`;
    box.hidden = false;
    box.querySelectorAll('.fitline').forEach(el => { let vs = []; try{ vs = JSON.parse(el.dataset.v); }catch(e){} const lh = parseFloat(getComputedStyle(el).lineHeight) || 20; for(const v of vs){ el.textContent = v; if(el.scrollHeight <= lh * 1.5) break; } });
    const go = box.querySelector('.go'); if(go) go.onclick = () => applyRefit(cls, f);
    const un = box.querySelector('.un'); if(un) un.onclick = () => undoRefit(cls);
    box.querySelector('.x').onclick = () => { s.done = true; render(); };
  }

  // ---------- actions ----------
  let firstPoint = true;
  function add(ti,i,cl){ const cls = cl || state.cls; const why = canAdd(cls,ti,i); if(why){ toast(why); return; } ranksFor(cls)[ti][i]++;
    if(cls === 'Legacy'){ lSave(); renderLegacy(); render(); } else { (state.order[cls] = state.order[cls] || []).push([ti,i]); state.orderKnown[cls] = true; render(); } refreshTip(ti,i,cls);
    if(ranksFor(cls)[ti][i] === DATA[cls].trees[ti].talents[i].max){ const cell = cellOf(cls,ti,i); if(cell){ cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash'); cell.addEventListener('animationend', () => cell.classList.remove('flash'), {once:true}); } } if(firstPoint){ firstPoint = false; track('first_point_spent', {class: state.cls}); } }
  function remove(ti,i,cl){ const cls = cl || state.cls; if(!canRemove(cls,ti,i)){ if(ranksFor(cls)[ti][i]>0) toast(cls === 'Legacy' ? 'Other perks depend on this point' : 'Other talents depend on this point'); return; } ranksFor(cls)[ti][i]--; if(cls === 'Legacy'){ lSave(); renderLegacy(); render(); } else { const o = state.order[cls] || []; for(let k = o.length - 1; k >= 0; k--){ if(o[k][0] === ti && o[k][1] === i){ o.splice(k, 1); break; } } render(); } refreshTip(ti,i,cls); }
  let toastT; function toast(m, ms){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'), ms || 1500); }

  // ---------- touch bottom sheet ----------
  let TOUCH = matchMedia('(hover: none)').matches;
  // Touchscreen laptops can report "no hover" even with a mouse in hand. Follow whichever pointer is actually in use.
  function setPointer(pt){ const touch = pt !== 'mouse'; if(touch === TOUCH) return; TOUCH = touch; document.documentElement.classList.toggle('mouse', !touch); if(touch) hideTip(); }
  addEventListener('pointerdown', e => setPointer(e.pointerType), {passive:true, capture:true});
  addEventListener('pointermove', e => { if(e.pointerType === 'mouse') setPointer('mouse'); }, {passive:true});
  let sheetAt = null;
  function openSheet(ti,i,cl){ sheetAt = [ti,i,cl||state.cls]; $('#sheetAdd').hidden = false; $('#sheetRem').hidden = false; renderSheet(); const sh = $('#sheet'); sh.hidden = false; sh.scrollTop = 0;
    const cell = cellOf(sheetAt[2],ti,i);
    if(cell){ const rc = cell.getBoundingClientRect(), top = innerHeight - sh.offsetHeight; if(rc.bottom > top - 12) scrollBy({top: rc.bottom - (top - 12), behavior: 'smooth'}); } }
  function renderSheet(){
    if(!sheetAt) return; const [ti,i,cl] = sheetAt, cls = cl || state.cls, t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i];
    $('#sheetBody').innerHTML = tipHTML(ti,i,true,cls);
    $('#sheetAdd').disabled = !!canAdd(cls,ti,i); $('#sheetRem').disabled = !(r>0 && canRemove(cls,ti,i));
  }
  // On touch devices act on touchend and swallow the default so rapid taps never reach the browser's double-tap zoom.
  function tapAction(id, fn){
    const el = $(id); let touched = false;
    el.addEventListener('touchend', e => { e.preventDefault(); touched = true; if(!el.disabled) fn(); setTimeout(()=>touched=false, 400); }, {passive:false});
    el.addEventListener('touchstart', e => { e.preventDefault(); }, {passive:false});
    el.addEventListener('click', () => { if(touched) return; fn(); });
  }
  tapAction('#sheetAdd', () => { if(!sheetAt) return; const [ti,i,cl]=sheetAt; add(ti,i,cl); renderSheet(); });
  tapAction('#sheetRem', () => { if(!sheetAt) return; const [ti,i,cl]=sheetAt; remove(ti,i,cl); renderSheet(); });
  $('#sheet').addEventListener('touchend', e => { if(e.target.closest('button')) return; e.preventDefault(); }, {passive:false});
  $('#sheetClose').onclick = () => { $('#sheet').hidden = true; sheetAt = null; };
  // ---------- touch: floating tooltip by the tapped talent ----------
  let ghostAt = null, ghostY = 0; const ghost = $('#ghost');
  const cellOf = (cls,ti,i) => { const host = cls === 'Legacy' ? $('#legacyTrees') : treesEl; const s = host && host.children[ti]; return s ? s.querySelectorAll('.talent')[i] : null; };
  function deselect(){ document.querySelectorAll('#trees .talent.sel, #legacyTrees .talent.sel').forEach(c => c.classList.remove('sel')); }
  function hideGhost(keepSel){ ghostAt = null; ghost.hidden = true; if(!keepSel) deselect(); }
  function ghostHTML(ti,i,cl){
    const cls = cl || state.cls, t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i];
    const cur = rankText(t, r), nxt = r < t.max ? rankText(t, r+1) : null, est = [];
    const found = new Set();
    let h = `<div class="gn">${t.name}<span>Rank ${r}/${t.max} · <b>${cls === 'Legacy' ? Math.max(0, pool(cls) - totalPts(cls)) : $('#ptsLeft').textContent}</b> left</span></div>`;
    { const w = staleAt(cls, ti, i); if(w) h += `<div class="gw">This build had ${w.pts} point${w.pts === 1 ? '' : 's'} here. ${w.why.replace(/ Talents$/, '')} now, so ${w.pts === 1 ? 'it is' : 'they are'} back in your pool.</div>`; }
    if(cur){ h += `<div class="gd">${linkNames(cur.text, cls, t.name, found)}</div>`; if(cur.est) est.push(r); }
    if(nxt){ if(nxt.est) est.push(r+1);
      if(cur){ const pairs = wordDiff(cur.text, nxt.text).pairs.filter(([a,b]) => a && b && a.length < 24 && b.length < 24);
        if(pairs.length && pairs.length <= 4) h += `<div class="gx"><span class="lab">Next rank</span>${pairs.map(([a,b]) => `<span><s>${a}</s><b>${b}</b></span>`).join('')}</div>`;
        else h += `<div class="gx"><span class="lab">Next rank</span><span>${linkNames(nxt.text, cls, t.name, found)}</span></div>`; }
      else h += `<div class="gd">${linkNames(nxt.text, cls, t.name, found)}</div>`; }
    if(est.length) h += `<div class="ge">Rank ${est.join(' and ')} value${est.length>1?'s':''} estimated from the rank shown in the video.</div>`;
    if(t.note) h += `<div class="ge">${t.note}</div>`; h += pickLine(cls, ti, i);
    if(document.body.classList.contains('cmp') && t.classic){
      const c = t.classic, w = []; if(c.renamed) w.push(`renamed from ${c.renamed}`); if(c.moved) w.push(`was ${c.tree} row ${c.row}, col ${c.col}`); if(c.max !== t.max) w.push(`was ${c.max} rank${c.max>1?'s':''}, now ${t.max}`); if(c.note) w.push(c.note);
      const meta = w.length ? `<div class="m">${w.join(' · ')}</div>` : '';
      const f1 = Array.isArray(t.desc) ? t.desc[0] : (t.desc && t.desc[1]);
      if(c.status === 'new') h += `<div class="cl"><b>New in Forever.</b> ${replacesLine(c)}</div>`;
      else if(c.status === 'changed' && f1 && c.text !== f1){ const d = wordDiff(c.text, f1); h += `<div class="cl"><b>Changed from Classic</b>${meta}<div class="diff"><span class="lab">Classic</span><div class="old">${d.oldH}</div><span class="lab">Forever</span><div class="new">${d.newH}</div></div></div>`; }
      else h += `<div class="cl"><b>${c.status === 'same' ? 'Same as Classic' : c.status === 'moved' ? 'Moved, same effect' : 'Changed from Classic'}</b>${meta}${c.status === 'same' ? '' : `<div class="t">Classic rank 1: ${c.text}</div>`}</div>`;
    }
    h += mentionChips(cls, found);
    const why = canAdd(cls,ti,i); if(why && why !== 'Max rank' && r === 0) h += `<div class="gr">${why}</div>`;
    return h;
  }
  function placeGhost(cell){
    const cr = cell.getBoundingClientRect(); ghost.hidden = false; const w = ghost.offsetWidth, hgt = ghost.offsetHeight;
    let x = cr.left + cr.width / 2 - w / 2; x = Math.max(8, Math.min(innerWidth - w - 8, x));
    const minTop = 8;   // it may cover the sticky points bar (its own header shows points left); it only pins here when the row sits at the very top
    const want = cr.top - 16 - hgt, top = Math.max(minTop, want), pinned = top > want;                       // 16px gap keeps the minus badge clear
    ghost.classList.add('above'); ghost.classList.remove('below'); ghost.classList.toggle('clamped', pinned);
    ghost.style.left = (x + scrollX) + 'px'; ghost.style.top = (top + scrollY) + 'px'; ghost.style.opacity = '';
    ghost.style.setProperty('--ax', (cr.left + cr.width / 2 - x) + 'px');
  }
  function showGhost(ti,i,bump,cl){
    const cls = cl || state.cls, cell = cellOf(cls,ti,i); if(!cell) return;
    document.querySelectorAll('#trees .talent.sel, #legacyTrees .talent.sel').forEach(c => { if(c !== cell) c.classList.remove('sel'); }); cell.classList.add('sel');
    ghostAt = [ti,i,cls]; ghostY = scrollY; ghost.innerHTML = ghostHTML(ti,i,cls); placeGhost(cell);
    if(bump){ const rk = cell.querySelector('.rk'); if(rk){ rk.classList.remove('bump'); void rk.offsetWidth; rk.classList.add('bump'); rk.addEventListener('animationend', () => rk.classList.remove('bump'), {once:true}); } }
  }
  function renderGhost(){ if(!ghostAt || ghost.hidden) return; const [ti,i,cl] = ghostAt, cls = cl || state.cls, cell = cellOf(cls,ti,i); if(!cell){ hideGhost(); return; } cell.classList.add('sel'); ghost.innerHTML = ghostHTML(ti,i,cls); placeGhost(cell); }
  addEventListener('scroll', () => { if(!ghostAt) return; const d = Math.abs(scrollY - ghostY) - 24; if(d <= 0){ ghost.style.opacity = ''; return; } if(d >= 150){ hideGhost(true); return; } ghost.style.opacity = (1 - d / 150).toFixed(3); }, {passive:true});
  // a name inside the floating tooltip can be tapped: it takes you to that talent and reads it, no point spent
  ghost.addEventListener('click', e => { const r = e.target.closest('.ref, .refchip, .refgo'); if(!r || !ghostAt) return; e.stopPropagation(); const [gti, gi, gc] = ghostAt, cls = gc || state.cls, n = r.dataset.ref, x = mentionsFor(cls).map.get(n); if(!x) return;
    if(!r.classList.contains('refgo')){ const box = ghost.querySelector('.refopen'), was = box.dataset.on === n; box.dataset.on = was ? '' : n; box.innerHTML = was ? '' : refRow(cls, n); ghost.querySelectorAll('.ref').forEach(b => b.classList.toggle('on', !was && b.dataset.ref === n)); const cell = cellOf(cls, gti, gi); if(cell) placeGhost(cell); track('tooltip_ref', {cls, from: 'phone', name: n}); return; }
    const c = cellOf(cls, x.ti, x.i); if(!c) return; c.scrollIntoView({block: 'center'}); showGhost(x.ti, x.i, false, cls); c.classList.add('refd'); setTimeout(() => c.classList.remove('refd'), 1800); });
  document.addEventListener('click', e => { if(e.target.closest('.talent')) return; hideGhost(); deselect(); });
  let ghostHinted = false; try { ghostHinted = localStorage.getItem('tf_ghosthint') === '1'; } catch(e){}
  function ghostHint(){ if(ghostHinted) return; ghostHinted = true; try { localStorage.setItem('tf_ghosthint', '1'); } catch(e){} toast('Tap a talent to add a point. Tap its − to take one back. Hold to read first.', 3200); }

  // ---------- tooltip ----------
  // Word-level diff (LCS) so Compare to Classic shows exactly which numbers and phrases changed.

  function wordDiff(a, b){
    const A = a.split(/(\s+)/).filter(x => x !== ''), B = b.split(/(\s+)/).filter(x => x !== '');
    const n = A.length, m = B.length, L = Array.from({length:n+1}, () => new Uint16Array(m+1));
    for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) L[i][j] = A[i]===B[j] ? L[i+1][j+1]+1 : Math.max(L[i+1][j], L[i][j+1]);
    const esc = x => x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    let i=0, j=0, oldH='', newH='', bothH=''; const pairs = [];
    const flush = (o, nw) => { if(o){ oldH += `<del>${esc(o)}</del>`; bothH += `<del>${esc(o)}</del>`; } if(nw){ newH += `<ins>${esc(nw)}</ins>`; bothH += `<ins>${esc(nw)}</ins>`; } if(o || nw) pairs.push([o.trim(), nw.trim()]); };
    let o='', nw='';
    while(i<n && j<m){
      if(A[i]===B[j]){ flush(o,nw); o=''; nw=''; oldH += esc(A[i]); newH += esc(B[j]); bothH += esc(A[i]); i++; j++; }
      else if(L[i+1][j] >= L[i][j+1]){ o += A[i++]; }
      else { nw += B[j++]; }
    }
    o += A.slice(i).join(''); nw += B.slice(j).join(''); flush(o,nw);
    return {oldH, newH, bothH, pairs};
  }
  // ---------- names inside tooltips: a talent or spell the text mentions is underlined, explained under the text, and lit in the tree
  const MLEAD = new Set(['Your','The','When','While','After','And','Or','Each','Any','All','If','Causes','Gives','Increases','Reduces','Allows','With','Casting','Using','Activating']);
  const MENTION = {}, MSTOP = new Set(['Attack','Shoot','Block','Parry','Dodge','Defense','Languages']);
  function mentionsFor(cls){
    if(MENTION[cls]) return MENTION[cls];
    const map = new Map(), c = DATA[cls]; if(!c || !c.trees || cls === 'Legacy') return MENTION[cls] = {re: null, map};
    c.trees.forEach((tr, ti) => tr.talents.forEach((t, i) => { if(!t.placeholder && t.name.length > 3) map.set(t.name, {kind: 'talent', isNew: !!(t.classic && t.classic.status === 'new'), ti, i, icon: t.icon, where: `${tr.name}, row ${t.row}`, text: (rankText(t, 1) || {}).text || ''}); }));
    const S = window.SPELL_DESC || {}, IC = window.SPELLBOOK_ICONS || {};
    Object.keys(S).forEach(k => { const [kc, n, rk] = k.split('|'); if(kc !== cls || !S[k].d || MSTOP.has(n) || n.length <= 3 || (map.has(n) && map.get(n).kind === 'talent')) return; map.set(n, {kind: 'spell', isNew: S[k].cs === 'new', icon: IC[n], where: `${cls} spell${rk ? ', ' + rk.toLowerCase() : ''}`, text: S[k].d}); });
    const names = [...map.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return MENTION[cls] = {map, re: names.length ? new RegExp('(^|[^A-Za-z])(' + names.join('|') + ')(?![A-Za-z])', 'g') : null};
  }
  function linkNames(html, cls, self, found){ const m = mentionsFor(cls); if(!m.re || !html) return html;
    return html.split(/(<[^>]+>)/).map(part => part.charAt(0) === '<' ? part : part.replace(m.re, (all, pre, n, at, whole) => { if(n === self) return all;
      // not a piece of the thing's own name (Shield Slam's text opens "Slam the target", u/stuntmahn, 28 Sep) and not a one-word name standing as the opening verb
      if(self && !n.includes(' ') && new RegExp('(^|\\s)' + n + '(\\s|$)').test(self)) return all;
      if(at === 0 && pre === '' && !n.includes(' ') && /^ (the|an?|your|all|nearby|up to|enemies|targets?)\b/i.test(whole.slice(all.length))) return all;
      // not the thing itself when it is part of a longer name (Bane of Doom, Greater Heal) or names an effect (Silence effects)
      const after = whole.slice(at + all.length), before = whole.slice(0, at + pre.length), pw = (before.match(/([A-Z][A-Za-z']+) $/) || [])[1];
      if(/^ (of |the )?[A-Z]/.test(after) || /^ (effects?|per)\b/.test(after) || /(^|[^A-Za-z])(one|a|an|each|any|other|another) $/.test(before) || (pw && !MLEAD.has(pw))) return all;
      found.add(n); return `${pre}<span class="ref${m.map.get(n).isNew ? ' new' : ''}" data-ref="${n.replace(/"/g, '&quot;')}">${n}</span>`; })).join(''); }
  const refLine = t => { const m = t.match(/^.{20,170}?[.!?](\s|$)/); return (m ? m[0] : t.slice(0, 150) + (t.length > 150 ? '\u2026' : '')).trim(); };
  let refAll = false;   // Ctrl held (Cmd on a Mac): explain every name, not only what is new in Forever. Not Shift: five taps of Shift opens Windows' Sticky Keys prompt
  const REFKEY = /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Cmd' : 'Ctrl';
  function mentionFoot(cls, found){ if(!found.size) return ''; const m = mentionsFor(cls).map, all = [...found], show = refAll ? all.slice(0, 6) : all.filter(n => m.get(n).isNew).slice(0, 3), rest = all.length - show.length;
    const hint = rest > 0 && !refAll ? `<div class="refhint">Hold <kbd>${REFKEY}</kbd> to explain ${show.length ? 'the other ' : ''}${rest === 1 ? 'name' : rest + ' names'}</div>` : '';
    if(!show.length) return hint ? `<div class="refs bare">${hint}</div>` : '';
    return `<div class="refs">${show.map(n => { const x = m.get(n); return `<div class="refrow">${x.icon ? `<img src="${ICON(x.icon)}" alt="" onerror="this.remove()">` : ''}<div><b>${n}</b><small>${x.isNew ? '<i>New in Forever</i> \u00b7 ' : ''}${x.kind === 'talent' ? 'Talent \u00b7 ' : ''}${x.where}</small><span>${refLine(x.text)}</span></div></div>`; }).join('')}${hint}</div>`; }
  addEventListener('keydown', e => { if((e.key === 'Control' || e.key === 'Meta') && !refAll){ refAll = true; if(tipAt && !tip.hidden) refreshTip(tipAt[0], tipAt[1], tipAt[2]); } });
  addEventListener('blur', () => { if(refAll){ refAll = false; if(tipAt && !tip.hidden) refreshTip(tipAt[0], tipAt[1], tipAt[2]); } });
  addEventListener('keyup', e => { if((e.key === 'Control' || e.key === 'Meta') && refAll){ refAll = false; if(tipAt && !tip.hidden) refreshTip(tipAt[0], tipAt[1], tipAt[2]); } });
  const refRow = (cls, n) => { const x = mentionsFor(cls).map.get(n); return !x ? '' : `<div class="refrow">${x.icon ? `<img src="${ICON(x.icon)}" alt="" onerror="this.remove()">` : ''}<div><b>${n}</b><small>${x.kind === 'talent' ? 'Talent · ' : ''}${x.where}</small><span>${refLine(x.text)}</span>${x.kind === 'talent' ? `<button type="button" class="refgo" data-ref="${n.replace(/"/g, '&quot;')}">Show it in the tree</button>` : ''}</div></div>`; };
  function mentionChips(cls, found){ return found.size ? '<div class="refopen"></div>' : ''; }
  function clearRefs(){ document.querySelectorAll('.talent.refd').forEach(c => c.classList.remove('refd')); }
  function markRefs(cls, found){ clearRefs(); const m = mentionsFor(cls).map; (found || []).forEach(n => { const x = m.get(n); if(x && x.kind === 'talent'){ const c = cellOf(cls, x.ti, x.i); if(c) c.classList.add('refd'); } }); }
  let tipAt = null;
  // pick rates by spec (u/beringtom, 24 Sep 2026). prSpecOf: the chip chosen on this device ('all' or a tree name); prPick: the rates the badges show;
  // pickLine: one line in a talent's tooltip: overall, its own tree's builds, and the builds that lead where your own build leads.
  function prSpecOf(){ try{ return localStorage.getItem('tf_prs') || 'all'; }catch(e){ return 'all'; } }
  function prOk(pp, n){ return !!(n && pp.pickBy && pp.pickBy[n] && (pp.specN || {})[n] >= 100); }
  function prSpecNow(cls, pp){ const s = prSpecOf(); return prOk(pp, s) ? s : ''; }
  function prIcon(cls, pp){ const sp = prSpecNow(cls, pp), t = sp && DATA[cls].trees.find(x => x.name === sp); return t ? t.icon : DATA[cls].icon; }
  function prPick(pp){ const sp = prSpecNow(state.cls, pp); return sp ? pp.pickBy[sp] : pp.pick; }
  // the numbers arrive: badges count up from what they showed before (0 when they first appear), row by row down the trees, so a change of
  // chip reads as the same talents re-counted among different builds. Off with reduced motion; a point placed changes nothing so nothing moves.
  let prAnim = 0;
  function animPr(){ if(!document.body.classList.contains('pr')) return; const jobs = []; document.querySelectorAll('.trees .talent .pr').forEach(s => { const d = s.parentNode, to = +s.dataset.to, from = d.dataset.prFrom == null ? 0 : +d.dataset.prFrom; d.dataset.prFrom = to; if(from !== to) jobs.push([s, from, to, +s.dataset.row || 1]); });
    if(!jobs.length || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const id = ++prAnim, t0 = performance.now(), D = 520, G = 60;
    jobs.forEach(([s, from]) => { s.lastChild.nodeValue = from + '%'; });
    setTimeout(() => { if(id === prAnim) jobs.forEach(([s, , to]) => { s.lastChild.nodeValue = to + '%'; }); }, D + 8 * G + 100);   // whatever frames did or did not run (a tab in the background gets none), the real numbers stand within a second
    const step = now => { if(id !== prAnim) return; let live = false; for(const [s, from, to, row] of jobs){ const p = Math.min(1, Math.max(0, (now - t0 - (row - 1) * G) / D)), e = 1 - Math.pow(1 - p, 3); s.lastChild.nodeValue = Math.round(from + (to - from) * e) + '%'; if(p < 1) live = true; } if(live) requestAnimationFrame(step); };
    requestAnimationFrame(step); }
  function renderPrSet(){ const el = $('#prset'); if(!el) return; const cls = state.cls, pp = popFor(cls); if(!pp || !pp.pick || !pp.pickBy){ el.innerHTML = ''; return; }
    const sn = pp.specN || {}, sp = prSpecNow(cls, pp), N = n => (n || 0).toLocaleString(), chip = (ps, icon, label, title, on) => `<button type="button" data-ps="${ps}" aria-pressed="${on}" title="${title}" ><img src="${ICON(icon)}" alt=""><span>${label}</span></button>`;
    el.innerHTML = chip('all', DATA[cls].icon, 'All', pp.complete ? `All ${N(pp.complete)} complete ${cls} builds` : `All complete ${cls} builds`, !sp) + DATA[cls].trees.filter(t => prOk(pp, t.name)).map(t => chip(t.name, t.icon, t.name, `The ${N(sn[t.name])} builds that lead in ${t.name}`, sp === t.name)).join(''); }
  function setPr(on){ document.body.classList.toggle('pr', on); if(!on) document.querySelectorAll('.talent[data-pr-from]').forEach(d => { delete d.dataset.prFrom; }); $('#prBtn').setAttribute('aria-pressed', on); const c = $('#pickRates'); if(c) c.checked = on; try{ localStorage.setItem('tf_pr', on ? '1' : '0'); }catch(x){} render(); track('pick_rates', {on}); }
  function pickLine(cls, ti, i){
    if(!document.body.classList.contains('pr')) return ''; const pp = popFor(cls); if(!pp || !pp.pick) return ''; const all = (pp.pick[ti] || [])[i]; if(all == null) return '';
    const trees = DATA[cls].trees, own = trees[ti].name, by = pp.pickBy || {}, sums = ranksFor(cls).map(t => t.reduce((a, v) => a + v, 0)), li = sums.indexOf(Math.max(...sums)), lead = sums[li] > 0 ? trees[li].name : '';
    const parts = [`<b>${all}%</b> of ${cls} builds`];
    if(by[own]) parts.push(`<b>${by[own][ti][i]}%</b> of ${own} builds${lead === own ? ' like yours' : ''}`);
    if(lead && lead !== own && by[lead]) parts.push(`<b>${by[lead][ti][i]}%</b> of ${lead} builds like yours`);
    return `<div class="pk">Taken by ${parts.length > 2 ? parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1] : parts.join(' and ')}.</div>`;
  }
  function tipHTML(ti,i,compact,cl){
    const cls = cl || state.cls, t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i];
    if(compact) return sheetHTML(ti,i,cls);
    const found = tipHTML.found = new Set();
    const pips = `<span class="pips">${'●'.repeat(r)}<i>${'●'.repeat(t.max - r)}</i></span>`;
    const meta = [`Rank ${r} of ${t.max}`, t.passive ? 'Passive' : '', t.cost || ''].filter(Boolean).join(' · ');
    let h = `<div class="hd">${t.icon ? `<img src="${ICON(t.icon)}" alt="" onerror="this.remove()">` : ''}<div><div class="n">${t.name}</div><div class="r">${pips}${meta}</div></div></div>`;
    { const w = staleAt(cls, ti, i); if(w) h += `<div class="gw">This build had ${w.pts} point${w.pts === 1 ? '' : 's'} here. ${w.why.replace(/ Talents$/, '')} now, so ${w.pts === 1 ? 'it is' : 'they are'} back in your pool.</div>`; }
    const cur = rankText(t, r), nxt = r < t.max ? rankText(t, r+1) : null;
    if(cur){ h += `<div class="d">${linkNames(cur.text, cls, t.name, found)}</div>`; if(cur.est) h += `<div class="est">Rank ${r} value estimated from the rank shown in the video.</div>`; }
    if(nxt){
      // Next rank in full, with the numbers that change picked out in white so the eye lands on them.
      const nx = cur ? wordDiff(cur.text, nxt.text).newH : nxt.text;
      if(cur) h += `<div class="next">Next rank</div>`;
      h += `<div class="d">${linkNames(nx, cls, t.name, found)}</div>`; if(nxt.est) h += `<div class="est">Rank ${r+1} value estimated from the rank shown in the video.</div>`;
    }
    if(t.note) h += `<div class="est">${t.note}</div>`;
    h += pickLine(cls, ti, i); h += mentionFoot(cls, found);   // straight under the text it explains, above the Classic comparison
    if(document.body.classList.contains('cmp') && t.classic){
      const c = t.classic;
      if(c.status==='new') h += `<div class="cl"><b>New in Forever.</b> ${replacesLine(c)}</div>`;
      else { const w = []; if(c.renamed) w.push(`renamed from ${c.renamed}`); if(c.moved) w.push(`was ${c.tree} row ${c.row}, col ${c.col}`); if(c.max!==t.max) w.push(`was ${c.max} rank${c.max>1?'s':''}, now ${t.max}`); if(c.note) w.push(c.note);
        const meta = w.length ? `<div class="m">${w.join(' · ')}</div>` : '';
        const f1 = Array.isArray(t.desc) ? t.desc[0] : (t.desc && t.desc[1]); // rank 1 text, whether ranks are stored as a list or by number
        if(c.status==='changed' && f1 && c.text !== f1){
          const d = wordDiff(c.text, f1);
          h += `<div class="cl"><b>Changed from Classic</b>${meta}<div class="diff"><span class="lab">Classic</span><div class="old">${d.oldH}</div><span class="lab">Forever</span><div class="new">${d.newH}</div></div></div>`;
        } else {
          h += `<div class="cl"><b>${c.status==='same' ? 'Same as Classic' : c.status==='moved' ? 'Moved, same effect' : 'Changed from Classic'}</b>${meta}${c.status==='same' ? '' : `<div class="t">Classic rank 1: ${c.text}</div>`}</div>`; } }
    }
    if(t.reqText) h += `<div class="req">${t.reqText}</div>`;
    const why = canAdd(cls,ti,i);
    if(!why) h += `<div class="cta">Click to learn${r > 0 ? '<small>Right-click to unlearn</small>' : ''}</div>`;
    else if(why==='Max rank') h += `<div class="cta no">Max rank</div>`;
    else if(why==='No unspent talent points') h += `<div class="cta no">${why}</div>`;
    else h += `<div class="req">${why}</div>`;
    return h;
  }
  // Phone sheet: current rank in full, next rank as just the numbers that change, one short note for estimates.
  function sheetHTML(ti,i,cl){
    const cls = cl || state.cls, t = DATA[cls].trees[ti].talents[i], r = ranksFor(cls)[ti][i];
    let h = `<div class="hd"><div class="n">${t.name}</div><div class="r">Rank ${r}/${t.max}${t.passive ? ' · Passive' : ''}${t.cost ? ' · ' + t.cost : ''}</div></div>`;
    { const w = staleAt(cls, ti, i); if(w) h += `<div class="gw">This build had ${w.pts} point${w.pts === 1 ? '' : 's'} here. ${w.why.replace(/ Talents$/, '')} now, so ${w.pts === 1 ? 'it is' : 'they are'} back in your pool.</div>`; }   // the phone's sheet says why the ring is there, like the hover tooltip
    const cur = rankText(t, r), nxt = r < t.max ? rankText(t, r+1) : null, est = [];
    if(cur){ h += `<div class="d">${cur.text}</div>`; if(cur.est) est.push(r); }
    if(nxt){
      if(nxt.est) est.push(r+1);
      if(cur){
        const pairs = wordDiff(cur.text, nxt.text).pairs.filter(([a,b]) => a && b && a.length < 24 && b.length < 24);
        if(pairs.length && pairs.length <= 4) h += `<div class="nx"><span class="lab">Next rank</span>${pairs.map(([a,b]) => `<span class="pair"><s>${a}</s><b>${b}</b></span>`).join('')}</div>`;
        else h += `<details class="nxd"><summary>Next rank</summary><div class="d">${nxt.text}</div></details>`;
      } else h += `<div class="d">${nxt.text}</div>`;
    }
    if(est.length) h += `<div class="est">Rank ${est.join(' and ')} value${est.length>1?'s':''} estimated from the rank shown in the video.</div>`; h += pickLine(cls, ti, i);
    if(t.note) h += `<div class="est">${t.note}</div>`;
    if(document.body.classList.contains('cmp') && t.classic){
      const c = t.classic;
      if(c.status==='new') h += `<div class="cl"><b>New in Forever.</b>${c.replaces ? ' ' + replacesLine(c) : ''}</div>`;
      else if(c.status==='changed' && (Array.isArray(t.desc) ? t.desc[0] : (t.desc && t.desc[1])) && c.text !== (Array.isArray(t.desc) ? t.desc[0] : t.desc[1])){ const f1 = Array.isArray(t.desc) ? t.desc[0] : t.desc[1]; const d = wordDiff(c.text, f1); h += `<details class="cl nxd" open><summary><b>Changed from Classic</b></summary><div class="diff"><span class="lab">Classic</span><div class="old">${d.oldH}</div><span class="lab">Forever</span><div class="new">${d.newH}</div></div></details>`; }
      else h += `<div class="cl"><b>${c.status==='same' ? 'Same as Classic' : c.status==='moved' ? 'Moved, same effect' : 'Changed from Classic'}</b>${c.status==='changed' && c.text ? `<div class="t">Classic rank 1: ${c.text}</div>` : ''}</div>`;
    }
    if(t.reqText) h += `<div class="req">${t.reqText}</div>`;
    const why = canAdd(cls,ti,i);
    if(why && why!=='Max rank' && why!=='No unspent talent points') h += `<div class="req">${why}</div>`;
    return h;
  }
  // a tap on a touch screen fires mouseenter and focus too; the hover box must never open there or it stacks under the floating one
  function showTip(ti,i,e,cl){ if(TOUCH) return; tipAt=[ti,i,cl||state.cls]; tip.innerHTML = tipHTML(ti,i,false,cl); tip.hidden = false; fitTip(); moveTip(e); markRefs(cl||state.cls, tipHTML.found); }
  function refreshTip(ti,i,cl){ const cls = cl||state.cls; if(tipAt && tipAt[0]===ti && tipAt[1]===i && (tipAt[2]||state.cls)===cls && !tip.hidden){ tip.innerHTML = tipHTML(ti,i,false,cls); fitTip(); if(tipAnchor) placeTip(tipAnchor); } }
  // a tooltip never grows past the screen: explanations are dropped from the bottom until it fits
  function fitTip(){ let rows = tip.querySelectorAll('.refrow'), k = rows.length; while(k > 0 && tip.offsetHeight > innerHeight - 16){ rows[--k].remove(); } const box = tip.querySelector('.refs'); if(box && !box.children.length) box.remove(); }
  // Anchored like Wowhead: the box sits just off the icon's right edge and stays put while the cursor moves over it.
  let tipAnchor = null;
  function moveTip(e){
    if(tip.hidden) return;
    const el = e.currentTarget || e.target;
    if(e.type === 'mousemove' && el === tipAnchor) return;
    tipAnchor = el; placeTip(el);
  }
  function placeTip(el){
    const w = tip.offsetWidth, h = tip.offsetHeight, r = el.getBoundingClientRect(), gap = 6;
    const tall = r.height >= 40;                       // talent icon: go beside it. Text pill: go under it.
    let x = tall ? r.right + gap : r.left, y = tall ? r.top : r.bottom + gap;
    if(x + w > innerWidth - 8) x = tall ? r.left - w - gap : innerWidth - w - 8;
    if(x < 8) x = 8;
    if(y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
    tip.style.left = x+'px'; tip.style.top = y+'px';
  }
  function hideTip(){ tip.hidden = true; tipAt = null; tipAnchor = null; clearRefs(); }
  // iPadOS hides a resting trackpad cursor after a few seconds and Safari then sends a mouseleave that went nowhere (u/jmicro89, 24 Sep 2026:
  // the tooltip "fades away after a few seconds" on an iPad with the Magic Keyboard). On a touch-capable device that leave keeps the tooltip;
  // the next move that lands off the talent, a tap or a scroll hides it. A mouse-only machine never sees a resting leave, so nothing changes there.
  let tipResting = false;
  function leaveTip(e){ if(navigator.maxTouchPoints > 1 && e && e.relatedTarget === null && !tip.hidden){ tipResting = true; return; } tipResting = false; hideTip(); }
  const restDone = () => { if(tipResting){ tipResting = false; hideTip(); } };
  document.addEventListener('mousemove', e => { if(!tipResting) return; if(tipAnchor && tipAnchor.contains(e.target)) return; restDone(); }, {passive:true});
  addEventListener('scroll', restDone, {passive:true}); document.addEventListener('pointerdown', restDone, {passive:true, capture:true});

  // ---------- controls ----------
  const lv = $('#level'); for(let l=60;l>=10;l--){ const o=document.createElement('option'); o.value=l; o.textContent = 'Level ' + l; lv.appendChild(o); }
  lv.onchange = () => { state.level = +lv.value; render(); };
  // ---------- saved builds (this device only) ----------
  const store = { get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch{ return d; } }, set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }, del(k){ try{ localStorage.removeItem(k); }catch{} } };
  const buildName = () => { const spec = document.querySelector('#bannerSum .spec'); return `${spec ? spec.textContent : state.cls}`; };
  const buildSplit = cls => DATA[cls].trees.map((_,i)=>treePts(cls,i)).join('/');
  function renderSaved(){
    const list = store.get('tf_builds', []), el = $('#buildList'), cur = encode(), isCur = b => canonCode(b.code) === cur;
    const order = Object.keys(DATA), shown = list.map((b, i) => ({ b, i })).sort((x, y) => (order.indexOf(x.b.cls) - order.indexOf(y.b.cls)) || x.b.name.localeCompare(y.b.name));   // by class, then name
    $('#copyBuilds').hidden = !list.length;
    const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');   // names come from Restore too, so pasted text never runs as markup
    el.innerHTML = shown.map(({ b, i }) => `<span class="bchip${isCur(b) ? ' cur' : ''}" data-i="${i}"><img src="${ICON(DATA[b.cls] ? DATA[b.cls].icon : 'inv_misc_questionmark')}" alt=""><span class="bn" title="Load ${esc(b.name)}">${esc(b.name)}</span><span class="bs">${b.split}</span><span class="bx" title="Remove" aria-label="Remove ${esc(b.name)}">×</span></span>`).join('');
    $('#buildHint').textContent = list.length ? `Tap a name to load it, × to remove it. Kept on this device only${list.length >= 400 ? `, ${list.length} of 500` : ''}. Back up copies them all as links.` : 'Kept on this device. Come back any time and pick it up here.';
    const sel = $('#loadBuild'); sel.hidden = false;
    const short = matchMedia('(max-width:640px)').matches;
    const groups = order.filter(c => shown.some(x => x.b.cls === c)).map(c => `<optgroup label="${c}">` + shown.filter(x => x.b.cls === c).map(({ b, i }) => `<option value="${i}"${isCur(b) ? ' disabled' : ''}>${esc(b.name)} · ${b.split}</option>`).join('') + '</optgroup>').join('');
    sel.innerHTML = `<option value="">${short ? 'Builds' : `My builds${list.length ? ` (${list.length})` : ''}`}</option>` + (list.length ? groups : '<option value="" disabled>Nothing saved yet. Use Save this build below.</option>');
  }
  // Under How it works: how much of the whole site was read at every rank.
  function renderClassVs(){
    const el = $('#cvsRead'); if(!el || el.dataset.done) return; let full = 0, total = 0;
    Object.values(DATA).forEach(cd => cd.trees.forEach(t => t.talents.forEach(x => { total++; if(x.complete) full++; })));
    const hot = Object.entries(DATA).filter(([, cd]) => cd && cd.trees && !cd.legacy && cd.trees.some(t => t.talents.some(x => x.hotfix))).map(([c]) => c);   // a class whose trees carry a server hotfix over the build (build_data.py keeps the stamp on each talent it touched)
    const hotList = hot.length > 1 ? `${hot.slice(0, -1).join(', ')} and ${hot[hot.length - 1]}` : hot[0];
    el.textContent = `All ${total} talents and every one of their ranks come from the beta client's own data${hot.length ? `, except the ${hotList} trees, which carry the server's hotfixes as other readers logged them from the beta's hotfix cache, checked against Blizzard's notes` : ''}. Nothing is estimated.`; el.dataset.done = '1';
  }
  function loadBuild(i, src){
    const list = store.get('tf_builds', []), b = list[i]; if(!b) return;
    state.ranks[b.cls] = null; decode(b.code); lv.value = state.level; sheetAt = null; $('#sheet').hidden = true; render(); toast(`Loaded "${b.name}"`); track('build_loaded', {class: b.cls, src});
  }
  $('#loadBuild').onchange = e => { const v = e.target.value; e.target.value = ''; if(v !== '') loadBuild(+v, 'top'); };
  // Naming happens inline: the browser's prompt dialog is blocked in some embedded browsers (Discord, Twitch, the desktop app's pane).
  const nameBox = $('#bname'), nameIn = $('#bnameIn');
  const closeName = () => { nameBox.hidden = true; $('#saveBuild').hidden = false; };
  const saveAs = raw => {
    const name = (raw || '').trim(); if(!name){ nameIn.focus(); return; }
    // a name only replaces an older build of the same class: "Protection PvE" on a Warrior must leave the Paladin's alone
    const all = store.get('tf_builds', []), same = b => b.name === name && b.cls === state.cls, replaced = all.some(same), list = all.filter(b => !same(b));
    if(list.length >= 500){ toast('500 builds saved on this device. Remove one to save another.', 3000); return; }
    list.unshift({ name, cls: state.cls, level: state.level, split: buildSplit(state.cls), code: encode(), when: Date.now() });
    store.set('tf_builds', list); renderSaved(); closeName(); toast(replaced ? `Replaced your ${state.cls} build "${name}"` : `Saved "${name}" on this device`); track('build_saved', {class: state.cls, points: totalPts(state.cls)});
  };
  $('#saveBuild').onclick = () => {
    if(totalPts(state.cls) === 0){ toast('Spend some points first'); return; }
    nameIn.value = buildName(); nameBox.hidden = false; $('#saveBuild').hidden = true; nameIn.focus(); nameIn.select();
  };
  $('#bnameOk').onclick = () => saveAs(nameIn.value);
  // Backup: every saved build as one line, "name — link", so a cleared browser or a new device can take them back.
  const buildsText = () => store.get('tf_builds', []).map(b => `${b.name} — ${location.origin}/${b.code}`).join('\n');
  $('#copyBuilds').onclick = async () => {
    const text = buildsText(); if(!text) return;
    try { await navigator.clipboard.writeText(text); } catch { const ta = $('#pasteIn'); $('#pasteBox').hidden = false; ta.value = text; ta.select(); toast('Select all and copy'); return; }
    toast(`Copied ${store.get('tf_builds', []).length} builds as links. Paste them somewhere safe.`, 2600); track('builds_copied');
  };
  $('#addBuilds').onclick = () => { const box = $('#pasteBox'); box.hidden = !box.hidden; if(!box.hidden){ $('#pasteIn').value = ''; $('#pasteIn').focus(); } };
  $('#pasteNo').onclick = () => { $('#pasteBox').hidden = true; };
  $('#pasteOk').onclick = () => {
    const list = store.get('tf_builds', []), have = new Set(list.map(b => canonCode(b.code)));
    let added = 0, full = false;
    $('#pasteIn').value.split(/\r?\n/).forEach(line => {
      // the whole code, whichever generation. The old match kept the three tree segments only, which dropped the leveling order and,
      // with the version marker gone, read five classes' points in the pre-beta talent order.
      const m = line.match(/(?:https?:\/\/[^\s\/]+\/)?#?((warrior|paladin|hunter|rogue|priest|shaman|mage|warlock|druid)\/(\d{1,2})\/[0-9A-Za-z-]+)/i), p = m && parseCode(m[1]); if(!p) return;
      const cls = p.cls, level = p.level, code = makeCode(cls, level, p.ranks, p.legacy, p.order), split = p.ranks.map(t => t.reduce((a, b) => a + b, 0)).join('/');
      if(have.has(code)) return;
      if(list.length >= 500){ full = true; return; }
      const name = line.slice(0, m.index).replace(/^[\s\-\u2013\u2014:]+|[\s\-\u2013\u2014:]+$/g, '').trim().slice(0, 40) || `${cls} ${split}`;
      list.unshift({ name, cls, level, split, code, when: Date.now() }); have.add(code); added++;
    });
    if(added) store.set('tf_builds', list);
    renderSaved(); $('#pasteBox').hidden = true;
    toast(added ? `Added ${added} build${added === 1 ? '' : 's'}${full ? ', stopped at 500' : ''}` : 'No build links found in that text', 2600); if(added) track('builds_imported', {count: added});
  };
  $('#bnameNo').onclick = closeName;
  nameIn.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); saveAs(nameIn.value); } else if(e.key === 'Escape'){ e.preventDefault(); closeName(); } };
  $('#buildList').onclick = e => {
    const chip = e.target.closest('.bchip'); if(!chip) return; const i = +chip.dataset.i, list = store.get('tf_builds', []), b = list[i]; if(!b) return;
    if(e.target.classList.contains('bx')){
      // first tap asks, second tap within 3 s removes; no browser dialog
      const x = e.target; if(!x.classList.contains('sure')){ x.classList.add('sure'); x.textContent = 'remove?'; setTimeout(() => { x.classList.remove('sure'); x.textContent = '×'; }, 3000); return; }
      list.splice(i, 1); store.set('tf_builds', list); renderSaved(); toast(`Removed "${b.name}"`); return; }
    loadBuild(i, 'panel');
  };
  // Remember where each class was left off, and pick it up on the next visit unless the URL already carries a build.
  const rememberLast = () => { const cls = state.cls; if(totalPts(cls) > 0) store.set('tf_last_' + cls, { v: 5, level: state.level, ranks: ranksFor(cls), order: state.orderKnown[cls] ? fixOrder(cls) : null }); else store.del('tf_last_' + cls); };
  function restoreLast(cls, quiet){
    if(state.ranks[cls] && state.ranks[cls].some(t => t.some(r => r > 0))) return false;
    const last = store.get('tf_last_' + cls); if(!last || !last.ranks) return false;
    const r = ranksFor(cls);
    if(!last.v && oldOrder(cls)){ fromOldOrder(cls, last.ranks, (s, i) => s[i]|0); last.order = null; }   // saved before the beta trees: by name, and its leveling order no longer lines up
    else if(last.v === 2 && orderV3(cls)){ fromOldOrder(cls, last.ranks, (s, i) => s[i]|0, r, orderV3(cls)); last.order = last.order ? orderFromOld(cls, orderV3(cls), last.order) : null; }   // saved on the trees before build 70009: by name
    else if(last.v === 3 && orderV4(cls)){ fromOldOrder(cls, last.ranks, (s, i) => s[i]|0, r, orderV4(cls)); last.order = last.order ? orderFromOld(cls, orderV4(cls), last.order) : null; }   // saved on the trees of build 70009, before 70170: by name
    else if(last.v === 4 && orderV5(cls)){ fromOldOrder(cls, last.ranks, (s, i) => s[i]|0, r, orderV5(cls)); last.order = last.order ? orderFromOld(cls, orderV5(cls), last.order) : null; }   // saved on the 70170 file trees, before the 1 to 2 Oct hotfixes: by name
    else last.ranks.forEach((tr, ti) => tr.forEach((v, i) => { if(r[ti] && r[ti][i] !== undefined) r[ti][i] = Math.min(v|0, DATA[cls].trees[ti].talents[i].max); }));
    if(last.level) { state.level = Math.min(60, Math.max(10, last.level)); lv.value = state.level; }
    if(last.order && last.order.length){ state.order[cls] = last.order; state.orderKnown[cls] = true; }
    settled(cls, settle(cls));
    if(!quiet) toast(`Picked up your last ${cls} build. Reset clears it.`, 2600);
    return true;
  }
  const resetBuild = () => { state.ranks[state.cls] = null; store.del('tf_last_' + state.cls); if(state.back && state.back.cls === state.cls) state.back = null; render(); };
  $('#reset').onclick = resetBuild; { const r2 = $('#reset2'); if(r2) r2.onclick = resetBuild; }
  // Stream layout: streamers park a cam bottom-left; shift the whole app right so nothing important sits under it.
  // px > 0 pushes the page right (cam bottom-left), px < 0 pushes it left (cam bottom-right); the page narrows to stay on screen, never below 720px
  // The page behaves like a window you hold: shift moves it sideways, top pushes it down, width squeezes or widens it (640 to 1200).
  const geo = { get: () => Object.assign({shift: 0, top: 0, width: 1200}, store.get('tf_geo', {})), set: g => store.set('tf_geo', g) };
  const MIN = 640, PAD = 16;
  const applyGeo = g => { const vw = window.innerWidth; const w = Math.max(MIN, Math.min(1200, g.width, vw - PAD)); const room = Math.max(0, vw - w - PAD);
    let ml = room / 2 + g.shift; ml = Math.max(0, Math.min(room, ml)); const mr = room - ml; const mt = Math.max(0, Math.min(Math.round(window.innerHeight * 0.5), g.top));
    const st = document.body.style; st.setProperty('--ml', ml + 'px'); st.setProperty('--mr', mr + 'px'); st.setProperty('--mw', w + 'px'); st.setProperty('--mt', mt + 'px');
    if(w !== geoW){ geoW = w; refit(); }
    return {shift: ml - room / 2, top: mt, width: w}; };
  // the arrows are drawn in pixels off the grid, so they have to be redrawn whenever the page changes width without the window doing so (u/justrelaxok, 19 Sep):
  // once shortly after the last change, and again when the .app width transition lands so they end up where the boxes stopped
  let geoW = 0, refitT; const refit = () => { clearTimeout(refitT); refitT = setTimeout(() => { updateTrees(); const lg = $('#legacy'); if(lg && lg.open) renderLegacy(); }, 120); };
  document.querySelector('.app').addEventListener('transitionend', e => { if(e.propertyName === 'max-width') refit(); });
  const setShift = px => { const g = geo.get(); g.shift = px; return applyGeo(g).shift; };
  const setStream = on => { const was = document.body.classList.contains('stream'); document.body.classList.toggle('stream', !!on); const b = $('#streamMode'); if(b) b.setAttribute('aria-pressed', !!on); if(on) applyGeo(geo.get()); else { for(const v of ['--shift','--ml','--mr','--mw','--mt']) document.body.style.removeProperty(v); geoW = 0; if(was) refit(); } };
  setStream(false);
  const sm = $('#streamMode'); if(sm) sm.onclick = () => { const on = !document.body.classList.contains('stream'); setStream(on); if(on){ const bar = $('#dragbar'); bar.classList.remove('guide'); void bar.offsetWidth; bar.classList.add('guide'); setTimeout(() => bar.classList.remove('guide'), 2200); } 
    toast(on ? 'Stream layout on. Grab "drag to move" to slide the page clear of your cam, "drag to resize" to shrink or grow it.' : 'Stream layout off', 4000); track('stream_layout', {on}); };
  (function(){ const mv = $('#dmove'), sz = $('#dsize'), rs = $('#dreset'); if(!mv) return;
    const hook = (el, onmove, skip) => { let x0 = 0, y0 = 0, g0 = null, drag = false;
      el.addEventListener('pointerdown', e => { if(skip && skip(e.target)) return; drag = true; x0 = e.clientX; y0 = e.clientY; g0 = geo.get(); el.setPointerCapture(e.pointerId); e.preventDefault(); });
      el.addEventListener('pointermove', e => { if(!drag) return; const g = onmove(Object.assign({}, g0), e.clientX - x0, e.clientY - y0); const r = applyGeo(g); g0r = r; });
      let g0r = null; const end = () => { if(!drag) return; drag = false; if(g0r) geo.set(g0r); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); };
    hook($('#dragbar'), (g, dx, dy) => { g.shift += dx; g.top += dy; return g; }, t => t.closest('#dsize, #dreset'));   // the whole bar moves; only the resize pill and reset are exempt
    hook(sz, (g, dx) => { g.width += dx * 2; g.width = Math.max(MIN, Math.min(1200, g.width)); return g; });   // pull the end out, both sides grow
    rs.onclick = e => { e.preventDefault(); geo.set({shift: 0, top: 0, width: 1200}); applyGeo(geo.get()); };
    window.addEventListener('resize', () => { if(document.body.classList.contains('stream')) applyGeo(geo.get()); }); })();
  const _render = render; render = function(){ _render(); rememberLast(); renderSaved(); if(sheetAt){ const [ti,i]=sheetAt; if(!DATA[state.cls].trees[ti] || !DATA[state.cls].trees[ti].talents[i]){ $('#sheet').hidden = true; sheetAt=null; } else renderSheet(); } };
  const copy = async () => { track('share_copied', {class: state.cls, points: totalPts(state.cls)}); try{ await navigator.clipboard.writeText($('#shareLink').value); toast('Link copied'); }catch{ $('#shareLink').select(); toast('Select and copy the link'); } };
  $('#copy').onclick = copy; $('#copy2').onclick = copy;
  function buildText(){ const cls = state.cls, trees = DATA[cls].trees, pts = trees.map((_,i)=>treePts(cls,i)), spent = pts.reduce((a,b)=>a+b,0); const spec = document.querySelector('#bannerSum .spec'); const maxed = []; trees.forEach((t,ti) => t.talents.forEach((x,i) => { if(ranksFor(cls)[ti][i] >= x.max) maxed.push(x.name); })); const lines = [`${spec ? spec.textContent : cls} ${pts.join('/')} (level ${state.level}, ${spent} points)`]; if(maxed.length) lines.push(`Maxed: ${maxed.join(', ')}`); lines.push($('#shareLink').value); return lines.join('\n'); }
  // Copy as text retired 13 Sep: Copy build for AI covers it
  function aiText(){
    const cls = state.cls, trees = DATA[cls].trees, pts = trees.map((_,i)=>treePts(cls,i)), spent = pts.reduce((a,b)=>a+b,0);
    const lines = [`WoW Forever ${cls} talent build: ${pts.join('/')} (${trees.map(t=>t.name).join(' / ')}), level ${state.level}, ${spent} points spent. Built on talentsforever.com; talent text comes from the WoW Forever beta client, so treat it as the beta build, not the final game.`, $('#shareLink').value, ''];
    let est = 0;
    trees.forEach((t,ti) => { const rows = []; t.talents.forEach((x,i) => { const r = ranksFor(cls)[ti][i]; if(r < 1) return; const rt = rankText(x, r); if(rt && rt.est) est++; rows.push(`- ${x.name} ${r}/${x.max}${rt && rt.est ? ' (est)' : ''}: ${rt ? rt.text : ''}`); }); if(rows.length){ lines.push(`${t.name} (${pts[ti]} points)`); lines.push(...rows); lines.push(''); } });
    lines.push(`Notes: each line is the in-game tooltip at the rank chosen${est ? '; (est) marks text estimated from a lower rank' : ''}. Every 5 points spent in a tree unlocks its next row. Full data for this class (all talents at every rank, spellbook, tooltips, racials): ${[location.origin, 'export', cls.toLowerCase() + '.json'].join('/')}`);
    return lines.join('\n');
  }
  $('#copyAI').onclick = async () => { if(totalPts(state.cls) === 0){ toast('Spend some points first'); return; } track('copy_ai', {class: state.cls, points: totalPts(state.cls)}); try{ await navigator.clipboard.writeText(aiText()); toast('Build copied with full talent text. Paste it into your AI with a question.', 3500); }catch{ toast('Could not copy'); } };
  function buildSummary(){ const cls = state.cls, trees = DATA[cls].trees, pts = trees.map((_,i)=>treePts(cls,i)), spent = pts.reduce((a,b)=>a+b,0); const spec = document.querySelector('#bannerSum .spec'); return spent ? `${spec ? spec.textContent : cls} build ${pts.join('/')} · Talents Forever` : `${cls} talents for WoW Forever · Talents Forever`; }
  $('#shareNative').onclick = async () => { track('share_native', {class: state.cls, points: totalPts(state.cls)}); try{ await navigator.share({title: buildSummary(), text: buildSummary(), url: $('#shareLink').value}); }catch{} };
  $('#cmp').onclick = () => { const on = !document.body.classList.contains('cmp'); document.body.classList.toggle('cmp', on); $('#cmp').setAttribute('aria-pressed', on); store.set('tf_cmp', on); if(sheetAt) renderSheet(); track('compare_toggled', {on, class: state.cls}); };
  if(store.get('tf_cmp', false)){ document.body.classList.add('cmp'); $('#cmp').setAttribute('aria-pressed', true); }   // stays the way it was left on this browser (readers were missing it)
  let rt, lastW = innerWidth; addEventListener('resize', () => { if(innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rt); rt = setTimeout(updateTrees, 120); });

  // class from the URL path (/paladin), unless the hash names one
  // ---------- Beta changes: the tracker, as a panel at the top of any page or as its own page at /builds ----------
  function buildsPage(){
    const UPD = window.UPDATES || []; if(!UPD.length) return null;
    let host = document.getElementById('sectionPage');   // plain DOM here: the page's $ helper returns a stub, never null
    if(!(host && location.pathname.replace(/\/$/, '') === '/builds')){ host = document.getElementById('buildsPanel'); if(!host){ host = document.createElement('section'); host.id = 'buildsPanel'; host.hidden = true; const tb = document.querySelector('.topbar'); tb.parentNode.insertBefore(host, tb); } }
    if(host.dataset.done) return host; host.dataset.done = '1';
    const {esc, nice, KIND, GLYPH, ORDER, MAJOR, plural, cicon, all, total, count, lv, say, sentence, miniMap, words} = TRACK;
    const row = (r, cls) => { const ic = r.kind === 'icon' && r.before ? `<span class="ic2"><img src="${ICON(r.before)}" alt=""><i>&rarr;</i><img src="${ICON(r.icon)}" alt=""></span>` : r.kind === 'replaced' && r.beforeIcon ? `<span class="ic2"><img src="${ICON(r.beforeIcon)}" alt=""><i>&rarr;</i><img src="${ICON(r.icon)}" alt=""></span>` : `<img src="${ICON(r.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
      const body = r.kind === 'text' && r.before != null ? (TRACK.delta(r) === 'reworked' ? `<span class="bd two"><span class="was"><b>Was</b> ${esc(r.before)}</span><span class="now"><b>Now</b> ${esc(r.after)}</span></span>` : `<span class="bd">${wordDiff(r.before, r.after).bothH}</span>`) : r.kind === 'icon' ? '' : `<span class="t">${esc(r.text)}</span>`;
      return `<li class="k-${r.kind}"><div class="ic">${ic}</div><div><b>${esc(r.talent)}</b><small>${cls ? esc(cls) + ' · ' : ''}${esc(r.tree)}${r.spell ? ' · spell' : ''}</small><span class="kb k-${r.kind}"><i>${GLYPH[r.kind] || ''}</i>${KIND[r.kind] || r.kind}${r.kind === 'text' && r.rank ? ' · ' + (r.spell && r.ranks ? TRACK.ranksWord(r.ranks) : 'rank ' + r.rank) : ''}${r.line ? ' · cost line' : ''}</span>${body}</div></li>`; };
    const clsOf = e => Object.keys(DATA).filter(c => DATA[c] && DATA[c].trees && !DATA[c].legacy && TRACK.classRows(e, c).length);
    const strip = (e, id) => { const ents = clsOf(e).map(c => [c, TRACK.classRows(e, c)]); if(!ents.length) return ''; const max = Math.max(...ents.map(([, rs]) => rs.length));
      return `<div class="cstrip">${ents.map(([c, rs]) => { const k = count(rs); const segs = ORDER.filter(x => k[x]).map(x => `<i class="k-${x}" style="flex:${k[x]}" title="${k[x]} ${(KIND[x] || x).toLowerCase()}"></i>`).join('');
        return `<button type="button" class="cbar" data-cls="${c}" data-card="${id}"><img src="${cicon(c)}" alt=""><span class="cn">${c}</span><span class="bar" style="width:${Math.round(100 * rs.length / max)}%">${segs}</span><span class="n">${rs.length}</span></button>`; }).join('')}</div>`; };
    const byClass = (e, id) => clsOf(e).map(c => { const rs = TRACK.classRows(e, c); return `<details class="bcls" data-cls="${c}"><summary><img src="${cicon(c)}" alt=""><b>${c}</b><small>${rs.length}</small></summary><ul class="brows">${rs.map(r => row(r)).join('')}</ul></details>`; }).join('');
    const build = (e, i) => { const n = total(e), id = 'bp' + i, ns = e.counts.spells || 0; TRACK.setBlue(e.blue);
      const prevB = UPD[i + 1], sources = `<p class="sources"><b>Sources</b> ${e.source ? esc(e.source) : `Beta client ${esc(e.build)}${prevB ? `, compared with ${esc(prevB.build)}` : ''}, read file by file.`}${e.blue && e.blue.url ? ` <a href="${esc(e.blue.url)}" target="_blank" rel="noopener"><i class="bflag">${TRACK.SVG.flag}</i>Blizzard's notes for this build &rsaquo;</a>` : ''}</p>`;
      return `<li class="bp-build${n ? '' : ' quiet'}" id="${id}"><h3>${esc(e.build)}<small>${nice(e.date)} · ${esc(e.title)}</small></h3><p class="note">${esc(e.note)}</p>` + (n ? words(e) +
        `<details class="bp-more"><summary>By class<small>${plural(e.counts.talents, 'talent change')}${ns ? `, ${plural(ns, 'spell change')}` : ''}</small></summary>${strip(e, id)}${byClass(e, id)}</details>` +
       `<details class="bp-more"><summary>Every change<small>${n}</small></summary>${e.racials.length ? `<details class="bcls" open><summary><b>Racials</b><small>${e.racials.length}</small></summary><ul class="brows">${e.racials.map(r => row(r)).join('')}</ul></details>` : ''}${e.legacy.length ? `<details class="bcls" open><summary><b>Legacy perks</b><small>${e.legacy.length}</small></summary><ul class="brows">${e.legacy.map(r => row(r)).join('')}</ul></details>` : ''}${byClass(e, id + 'x')}</details>` : '') + (e.notes && e.notes.lines.length ? `<details class="bp-more"><summary>Beyond the tooltips<small>${e.notes.lines.length} from Blizzard's notes</small></summary>${TRACK.notes(e)}</details>` : '') + sources + `</li>`; };
    const latest = UPD[0], seen = (() => { try{ return localStorage.getItem('log_seen') || ''; }catch{ return ''; } })();
    const fresh = seen ? UPD.filter(e => e.date > seen) : [], nfresh = fresh.reduce((a, e) => a + total(e), 0);
    host.className = 'bpage'; host.innerHTML = `<header class="bp-hero"><span class="eyebrow">Beta build tracker</span><h2>What's changed in WoW Forever</h2><p class="lede">Every beta build Blizzard ships gets checked against this site the day it lands. What each one changed, in plain words first, with every detail behind it.</p>` +
      `<div class="bp-latest"><span class="dot"></span><span>Latest: ${/ hotfixes$/.test(latest.build) ? `the <b>${esc(latest.build)}</b>` : `build <b>${esc(latest.build)}</b>`}, checked ${nice(latest.date)}. ${total(latest) ? plural(total(latest), 'change') + ' on the site.' : 'Nothing changed for players.'}</span>${seen ? `<span class="you">Since you were here (${nice(seen)}): ${fresh.length ? plural(fresh.length, 'build') + ' checked, ' + (nfresh ? plural(nfresh, 'change') : 'nothing changed') : 'no new builds'}.</span>` : ''}<a class="bp-share" href="/builds" title="This page on its own">Link to this &rsaquo;</a></div></header>` +
      `<ol class="bp-timeline">${UPD.map(build).join('')}</ol>`;
    host.addEventListener('click', ev => { const b = ev.target.closest('.cbar'); if(!b) return; const c = document.getElementById(b.dataset.card); const d = c && c.querySelector(`.bp-more .bcls[data-cls="${b.dataset.cls}"]`); if(d){ d.open = true; d.scrollIntoView({block: 'start', behavior: 'smooth'}); } });
    return host;
  }
  const sectionPath = ['/racials','/legacy','/abilities','/builds'].find(x => location.pathname.replace(/\/$/,'') === x) || '';
  if(sectionPath === '/builds'){ buildsPage(); document.title = 'WoW Forever Beta Build Changes | Talents Forever'; }
  if($('#buildsBtn')) $('#buildsBtn').addEventListener('click', e => { if(e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); const host = buildsPage(); if(!host) return;
    const show = host.hidden; host.hidden = !show; $('#buildsBtn').setAttribute('aria-expanded', show);
    if(show){ host.scrollIntoView({block: 'start', behavior: 'smooth'}); track('builds_opened'); } });
  window.__wantBook = location.hash === '#spellbook';
  const pathCls = CLASSES.find(c => c.toLowerCase() === location.pathname.split('/')[1]);
  if(pathCls && !/^#?[a-z]+\//i.test(location.hash)){ state.cls = pathCls; state.picked = true; }
  const pathBuild = /^\/[a-z]+\/\d+\/[0-9A-Za-z-]*$/i.test(location.pathname) ? location.pathname.slice(1) : null;
  if(sectionPath){ setTimeout(() => { const target = $('#sectionPage') || (sectionPath === '/legacy' ? $('#legacy') : sectionPath === '/abilities' ? ($('#classRacials').hidden ? $('#racials') : $('#classRacials')) : $('#racials')); if(sectionPath === '/legacy') $('#legacy').open = true; target.scrollIntoView({block:'start'}); }, 150); }
  renderLegacy();
  $('#legacy').addEventListener('toggle', () => { if($('#legacy').open){ track('legacy_opened'); renderLegacy(); } });
  addEventListener('resize', () => { if($('#legacy').open) renderLegacy(); const bk = $('#book'); if(bk && bk._fit) bk._fit(); });
  decode(pathBuild || location.hash); lv.value = state.level;
  if(!pathBuild && totalPts(state.cls) === 0) restoreLast(state.cls);   // no build with points in the path or the hash: pick up the last one
  if(pathBuild && totalPts(state.cls) > 0){ if(!state.back) setTimeout(() => toast(`Viewing a shared ${state.cls} build. Tweak it, or hit Reset to start your own.`, 3200), 400); track('shared_build_opened', {class: state.cls, points: totalPts(state.cls), path: state.back ? location.pathname : undefined}); }   // a link that settled is counted as the build it was, not the trimmed one: the counter judges it and leaves it out
  // own counter: one view per page load, and the build somebody leaves with when it is not the one they arrived on (what people
  // actually built, which no outside counter saw unless it was shared, saved or reloaded)
  // (the view is the page that was asked for; a build picked up from last time is not counted as built again until it changes)
  { note('view', null, pathBuild && totalPts(state.cls) > 0 && !state.back ? notePath() : location.pathname); const came = notePath(); let left = came;
    const leaving = () => { if(!state.cls || totalPts(state.cls) === 0) return; const now = notePath(); if(now !== left && now !== came){ left = now; note('built', refHost === 'self' && pathBuild ? 'seeded' : undefined); } };   // seeded: they started from a build link on this site (the Popular list, the Wrapped)
    addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') leaving(); }); }
  // ---- the polish lab's bridge (branch polish-lab, local only): /lab/lab.js gets the page's own rules and functions, and may wrap
  // the ones in fn. Without the lab script on the page this does nothing.
  if(window.__tfLab && window.__tfLab.boot) window.__tfLab.boot({ DATA, CLASSES, CLASS_COLOR, state, store, ICON, BG, $, treesEl, tip, ghost, lv,
    ranksFor, pool, treePts, totalPts, gate, canAdd, canRemove, status, idx, cellOf, rankText, wordDiff, encode, fixOrder, popFor, prPick, talentedRank, settle, settled, resetBuild, copy,
    get touch(){ return TOUCH; }, get tipAt(){ return tipAt; }, get ghostAt(){ return ghostAt; },
    fn: { get add(){ return add; }, set add(f){ add = f; }, get remove(){ return remove; }, set remove(f){ remove = f; }, get render(){ return render; }, set render(f){ render = f; },
      get toast(){ return toast; }, set toast(f){ toast = f; }, get goClass(){ return goClass; }, set goClass(f){ goClass = f; }, get renderTrees(){ return renderTrees; }, set renderTrees(f){ renderTrees = f; },
      get updateTrees(){ return updateTrees; }, set updateTrees(f){ updateTrees = f; }, get drawArrows(){ return drawArrows; }, set drawArrows(f){ drawArrows = f; }, get renderTop(){ return renderTop; }, set renderTop(f){ renderTop = f; },
      get showTip(){ return showTip; }, set showTip(f){ showTip = f; }, get hideTip(){ return hideTip; }, set hideTip(f){ hideTip = f; }, get refreshTip(){ return refreshTip; }, set refreshTip(f){ refreshTip = f; }, get tipHTML(){ return tipHTML; }, set tipHTML(f){ tipHTML = f; },
      get showGhost(){ return showGhost; }, set showGhost(f){ showGhost = f; }, get hideGhost(){ return hideGhost; }, set hideGhost(f){ hideGhost = f; },
      get loadBuild(){ return loadBuild; }, set loadBuild(f){ loadBuild = f; }, get decode(){ return decode; }, set decode(f){ decode = f; }, get applyRefit(){ return applyRefit; }, set applyRefit(f){ applyRefit = f; }, get undoRefit(){ return undoRefit; }, set undoRefit(f){ undoRefit = f; },
      get renderRacials(){ return renderRacials; }, set renderRacials(f){ renderRacials = f; }, get renderOrder(){ return renderOrder; }, set renderOrder(f){ renderOrder = f; }, get setPr(){ return setPr; }, set setPr(f){ setPr = f; }, get restoreLast(){ return restoreLast; }, set restoreLast(f){ restoreLast = f; }, get tileArt(){ return tileArt; }, set tileArt(f){ tileArt = f; } } });
  renderClasses(); render();
  // Direct link to the spellbook: /warlock#spellbook opens the fold and scrolls to it.
  // Back and Forward walk the class history: each entry holds the build as it was when you left it
  addEventListener('popstate', () => {
    const p = location.pathname, pc = CLASSES.find(c => c.toLowerCase() === p.split('/')[1]); if(!pc) return;
    const pb = /^\/[a-z]+\/\d+\/[0-9A-Za-z-]*$/i.test(p) ? p.slice(1) : null;
    state.cls = pc; state.picked = true; sheetAt = null; $('#sheet').hidden = true;
    if(pb){ ranksFor(pc).forEach(t => t.fill(0)); decode(pb); lv.value = state.level; }
    render();
  });
  document.querySelectorAll('a[href="/wrapped"]').forEach(a => a.addEventListener('click', () => track('wrapped_open')));
  // pick rates on the trees: the switch lives in the Popular builds fold and is remembered per device
  try{ if(localStorage.getItem('tf_pr') === '1'){ document.body.classList.add('pr'); $('#prBtn').setAttribute('aria-pressed', true); render(); } }catch(e){}
  $('#prBtn').onclick = () => setPr(!document.body.classList.contains('pr'));   /* render again: the trees were drawn before the switch was read, so a remembered switch showed no badges until the next point (fixed 24 Sep 2026) */
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.prset [data-ps]'); if(!b) return; try{ localStorage.setItem('tf_prs', b.dataset.ps); }catch(x){} b.parentNode.querySelectorAll('[data-ps]').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); track('pick_rates_spec', {spec: b.dataset.ps}); });
  document.addEventListener('change', e => { if(e.target && e.target.id === 'pickRates') setPr(e.target.checked); });
  // ---- header chips: a What's new entry can be pinned to the top of the site (pin: {id, kind, label, eyebrow, title, line, until, color, icon, href, cta}).
  // Each pin is a small round button in its own colour; hover or tap opens one card. kind 'book' lists the nine class books and opens the book of the
  // class on show; kind 'link' has one button to a page. A pin goes away after its date, and for good once somebody closes it.
  (function pinChips(){
    const host = $('#pinw'); if(!host) return; const today = new Date().toISOString().slice(0, 10);
    let goneIds = []; try{ goneIds = (localStorage.getItem('tf_pins_off') || '').split(',').filter(Boolean); }catch(err){}
    const pins = (window.CHANGELOG || []).filter(x => x.pin && (!x.pin.until || today <= x.pin.until) && !goneIds.includes(x.pin.id)).map(x => x.pin).slice(0, 2); if(!pins.length) return;
    const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'), icoOf = p => p.icon && p.icon[0] === '/' ? p.icon : ICON(p.icon || 'inv_misc_book_09'), mast = host.closest('.masthead');
    const setClasses = () => { const n = host.querySelectorAll('.pin').length; host.hidden = !n; mast.classList.toggle('haspin', n > 0); mast.classList.toggle('haspin2', n > 1); };
    host.innerHTML = pins.map((p, i) => `<button class="pin" type="button" data-pin="${i}" style="--c:${p.color || '#c39bff'}" aria-expanded="false" aria-label="New: ${esc(p.label)}. Open for details"><span class="pico"><img src="${icoOf(p)}" alt=""></span><span class="ptxt">${esc(p.label)}</span></button>`).join(''); setClasses();
    let card = null, cur = -1, closeT = 0, held = false; const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const close = () => { clearTimeout(closeT); held = false; if(!card) return; card.remove(); card = null; cur = -1; host.querySelectorAll('.pin').forEach(b => b.setAttribute('aria-expanded', 'false')); };
    const open = i => { clearTimeout(closeT); if(card && cur === i) return; close(); const p = pins[i], btn = host.querySelector(`.pin[data-pin="${i}"]`), cls = state.cls; if(!btn) return; cur = i;
      card = document.createElement('div'); card.className = 'pincard'; card.id = 'pinCard'; card.style.setProperty('--c', p.color || '#c39bff'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', p.title);
      card.innerHTML = `<span class="psp"><img src="${icoOf(p)}" alt=""></span><button class="px" type="button" aria-label="Close">&times;</button><span class="pey">${esc(p.eyebrow || 'New')}</span><h3>${esc(p.title)}</h3><p>${esc(p.line)}</p>`
        + (p.kind === 'link' ? '' : `<div class="pcls">${CLASSES.filter(c => (window.SPELLBOOKS || {})[c]).map(c => `<a href="${U(c.toLowerCase())}#spellbook" class="${c === cls ? 'here' : ''}" title="${c} spellbook"><img src="${ICON(DATA[c].icon)}" alt="${c}"></a>`).join('')}</div>`)
        + `<div class="pact"${p.kind === 'link' ? ' style="margin-top:12px"' : ''}>${p.kind === 'link' ? `<a class="pgo plink" href="${esc(p.href)}">${esc(p.cta || 'Open')}</a>` : `<a class="pgo" href="${U(cls.toLowerCase())}#spellbook">Open the ${esc(cls)} spellbook</a>`}<button class="pmore" type="button">What's new</button><button class="poff" type="button">Don't show again</button></div>`;
      host.appendChild(card); btn.setAttribute('aria-expanded', 'true');
      const vw = document.documentElement.clientWidth, b = btn.getBoundingClientRect(), h = host.getBoundingClientRect();
      if(matchMedia('(max-width:480px)').matches){ const m = mast.getBoundingClientRect(); card.style.setProperty('--cx', Math.round(b.left + b.width / 2 - m.left) + 'px'); }   // phone: the card spans the header, the arrow finds the chip
      else { card.style.left = Math.round(b.left + b.width / 2 - h.left) + 'px'; const r = card.getBoundingClientRect(), pad = 12, dx = r.left < pad ? pad - r.left : r.right > vw - pad ? vw - pad - r.right : 0; card.style.setProperty('--dx', dx + 'px'); card.style.setProperty('--cx', `calc(50% - ${dx}px)`); }   // desktop: under its own chip, nudged back inside the window
      track('pin_open', {id: p.id}); };
    if(canHover){ host.addEventListener('mouseover', ev => { const b = ev.target.closest('.pin'); if(b){ if(+b.dataset.pin !== cur) held = false; open(+b.dataset.pin); } else if(ev.target.closest('.pincard')) clearTimeout(closeT); }); host.addEventListener('mouseleave', () => { if(!held) closeT = setTimeout(close, 260); }); }
    host.addEventListener('focusin', ev => { const b = ev.target.closest('.pin'); if(b && canHover && b.matches(':focus-visible')) open(+b.dataset.pin); });   // keyboard only: a tap focuses first and would open then close on its own click
    host.addEventListener('click', ev => {
      const b = ev.target.closest('.pin'); if(b){ const i = +b.dataset.pin; if(card && cur === i && (held || !canHover)) close(); else { open(i); held = true; } return; }
      if(!card) return; const p = pins[cur];
      if(ev.target.closest('.px')){ close(); return; }   // the x only closes the card; the chip stays
      if(ev.target.closest('.poff')){ goneIds.push(p.id); try{ localStorage.setItem('tf_pins_off', goneIds.join(',')); }catch(err){} track('pin_dismiss', {id: p.id}); const btn = host.querySelector(`.pin[data-pin="${cur}"]`); close(); if(btn) btn.remove(); setClasses(); return; }
      if(ev.target.closest('.pmore')){ close(); $('#whatsNew').click(); track('pin_whatsnew', {id: p.id}); return; }
      const go = ev.target.closest('.pgo'); if(go){ track('pin_cta', {id: p.id, cls: state.cls}); if(go.classList.contains('plink')) return; const f = $('#foldSpellbook'); if(f){ ev.preventDefault(); close(); f.open = true; history.replaceState(null, '', location.pathname + location.search + '#spellbook'); setTimeout(() => f.scrollIntoView({block: 'start', behavior: 'smooth'}), 60); } } });
    document.addEventListener('click', ev => { if(card && !host.contains(ev.target)) close(); });
    document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && card){ const btn = host.querySelector(`.pin[data-pin="${cur}"]`); close(); if(btn) btn.focus(); } });
  })();
  addEventListener('hashchange', () => { if(location.hash !== '#spellbook') return; const f = $('#foldSpellbook'); if(!f) return; f.open = true; setTimeout(() => f.scrollIntoView({block: 'start', behavior: 'smooth'}), 80); });
})();
