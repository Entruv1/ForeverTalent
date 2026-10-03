const fs=require('fs'), vm=require('vm');
const ctx={window:{},console,document:{querySelector:()=>null,addEventListener:()=>{}}};
ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('zh_data.js','utf8'),ctx,{filename:'zh_data.js'});
const D=ctx.window;
const EN_KEYS=new Set(['id','icon','icons','s','cs','ck','p','k','i','cls','class','kind','tree','talent','row','col','max','rank','href','url','src','code','key','race','iconName','beforeIcon','status','type','action','tags','until','color','tab','fac','group','groups','lang','locale','slug','path','file','ext','mime','after','before','flip','frames','more','cap','label','req','spells','groups','build','date','counts','from','until','updated','window','buildsLabel']);
const CN=/[\u4e00-\u9fff]/;
const OUT=[];
function walk(o,path,depth){
  if(depth>14||o==null) return;
  if(typeof o==='string'){
    if(o.length<14||CN.test(o)) return;
    if(/^(?:\/|data:|https?:|#)/.test(o)) return;
    if(/\.(?:jpg|jpeg|png|gif|webp|svg|ico)\b/i.test(o)) return;
    if(/^[a-z0-9_]+$/.test(o)) return;              // 图标名 snake_case
    if(/^[A-Za-z' ]+$/.test(o) && o.split(' ').length<=4) return; // 短专名（人名/地名/技能名）
    const w=(o.match(/[A-Za-z][A-Za-z'’-]{1,}/g)||[]);
    if(w.length<4) return;
    OUT.push([path,o]);
    return;
  }
  if(Array.isArray(o)){ o.forEach((v,i)=>walk(v,path+'['+i+']',depth+1)); return; }
  if(typeof o==='object'){ for(const k of Object.keys(o)){ if(EN_KEYS.has(k)) continue; walk(o[k],path+'.'+k,depth+1); } }
}
for(const k of Object.keys(D)) walk(D[k],k,0);
OUT.sort((a,b)=>a[0]<b[0]?-1:1);
console.log('TOTAL',OUT.length);
for(const [p,v] of OUT) console.log('-',p,'::',v);
