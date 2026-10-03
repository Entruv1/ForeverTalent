// 对**产物**逐段 <script> 做 acorn 解析，抽出所有字符串 / 模板字面量并归一化。
// 归一化：模板插值 ${…} 换成占位词 Xx、去掉 HTML 标签，这样
// `Every ${cls}'s now <small>${n}</small>` 这种长模板不会被切碎而躲过检查。
//
// 用法：node _scan.js <html> <out.json>
const fs = require('fs');
const acorn = require('acorn');

const HTML = process.argv[2];
const OUT = process.argv[3];
const html = fs.readFileSync(HTML, 'utf8');

const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
const WORD = /[A-Za-z][A-Za-z'-]*/g;

function norm(s) {
  return s.replace(/<[^>]*>/g, ' ')
          .replace(/&(?:amp|lt|gt|quot|#39|middot|rsaquo|ldquo|rdquo|minus|nbsp);/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
}

const out = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, seg = 0;
while ((m = re.exec(html))) {
  seg++;
  let js = m.group ? m.group : m[1];
  js = js.replace(/data:[a-z/+]*;base64,[A-Za-z0-9+/=]+/g, 'DATAURI');
  let ast;
  try { ast = acorn.parse(js, { ecmaVersion: 'latest', locations: true }); }
  catch (e) { console.log('seg' + seg + ' parse fail: ' + e.message); continue; }

  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.type !== 'string') return;
    let text = null, kind = null;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      text = node.value; kind = 'S';
    } else if (node.type === 'TemplateLiteral') {
      kind = 'T';
      text = node.quasis.map(q => q.value.cooked).join(' \u0001Xx\u0001 ');
      text = text.replace(/\u0001Xx\u0001/g, 'Xx');
    }
    if (text != null) {
      const t = norm(text);
      const words = t.match(WORD) || [];
      if (!CJK.test(t) && t.length >= 4 && words.length >= 2) {
        out.push({ seg, kind, line: node.loc.start.line, text: t,
                   raw: js.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 220) });
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(node[k]);
    }
  })(ast);
}
fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
console.log('segments', seg, 'candidates', out.length, '->', OUT);
