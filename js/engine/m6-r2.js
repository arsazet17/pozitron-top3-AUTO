export const M6_R2_RULE_CODE='TOP3-M6-R2-EXPERIMENTAL-1000-25SEP2026';
export const M6_R2_WINDOW=1000;
export const M6_R2_MIN_COUNT=4;
export const M6_R2_MAX_COUNT=7;
export const M6_R2_OLD_GAP_MIN=300;
export const M6_R2_FRESH_GAP_MAX_EXCLUSIVE=100;
export const M6_R2_MIRROR_COUNT=2;
export const M6_R2_MIRROR_LAG_MAX=25;

function pad(v){return String(v??'').replace(/\D/g,'').padStart(3,'0').slice(-3)}
export function m6r2Family(v){return pad(v).split('').sort().join('')}
export function m6r2Mirror(v){return pad(v).split('').map(d=>String((10-Number(d))%10)).join('')}
export function m6r2MirrorFamily(v){return m6r2Family(m6r2Mirror(v))}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||''))}
function perms(v){const a=pad(v).split(''),s=new Set();for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)s.add(a[i]+a[j]+a[k]);return [...s]}
function add(a,b){a=pad(a);b=pad(b);return a.split('').map((x,i)=>(Number(x)+Number(b[i]))%10).join('')}

function normalize(ctx){
  const byId=new Map((ctx.records||[]).map(r=>{const id=Number(r.draw??r.id),code=String(r.combo??((r.A!=null&&r.B!=null&&r.C!=null)?`${r.A}${r.B}${r.C}`:''));return[id,{id,date:String(r.date||''),time:String(r.time||''),code:pad(code)}]}));
  const full=ctx.fullArchive,combos=full?.combos||[];
  if(full&&combos.length&&Number.isFinite(Number(full.fromDraw))){
    return combos.map((c,i)=>{const id=Number(full.fromDraw)+i,known=byId.get(id);return{id,date:known?.date||'',time:known?.time||'',code:pad(c)}}).filter(x=>Number.isInteger(x.id)&&/^\d{3}$/.test(x.code)).sort((a,b)=>a.id-b.id);
  }
  return [...byId.values()].filter(x=>Number.isInteger(x.id)&&/^\d{3}$/.test(x.code)).sort((a,b)=>a.id-b.id);
}

export function m6r2SelfDetails(v){
  const fam=m6r2Family(v),ps=perms(fam),triples=new Set(),paths=[];
  for(const a of ps)for(const b of ps){const r=add(a,b);if(!isTriple(r))continue;triples.add(r);paths.push(`${a}+${b}→${r}`)}
  return{family:fam,triples:[...triples].sort((a,b)=>Number(a[0])-Number(b[0])),paths};
}

function noSignal(base,reason){return{...base,trigger:false,signal:[],reason}}

export function computeM6R2(ctx){
  const real=normalize(ctx);
  const base={
    method:'M6-R2',rule:M6_R2_RULE_CODE,experimental:true,window:M6_R2_WINDOW,
    trigger:false,signal:[],family:'',familyCount:0,lastFour:[],gap1:null,gap2:null,gap3:null,
    mirrorFamily:'',mirrorOccurrences:[],mirrorCount:0,lastMirror:null,mirrorLag:null,paths:[],reason:'NO DATA'
  };
  if(!real.length)return base;

  const current=real.at(-1),window=real.slice(-M6_R2_WINDOW),family=m6r2Family(current.code);
  const occurrences=window.filter(x=>m6r2Family(x.code)===family),familyCount=occurrences.length;
  let out={...base,current,family,familyCount,occurrences:occurrences.map(x=>x.id)};

  if(familyCount<M6_R2_MIN_COUNT||familyCount>M6_R2_MAX_COUNT)
    return noSignal(out,`family_count ${familyCount} вне 4–7`);

  const lastFour=occurrences.slice(-4),[F1,F2,F3,F4]=lastFour;
  if(!F1||!F2||!F3||!F4||F4.id!==current.id)
    return noSignal({...out,lastFour},'Не удалось построить F1–F4 с CURRENT как F4');

  const gap1=F2.id-F1.id,gap2=F3.id-F2.id,gap3=F4.id-F3.id;
  out={...out,lastFour,gap1,gap2,gap3};
  if(gap1<M6_R2_OLD_GAP_MIN)return noSignal(out,`gap1 ${gap1} < 300`);
  if(gap3>=M6_R2_FRESH_GAP_MAX_EXCLUSIVE)return noSignal(out,`gap3 ${gap3} >= 100`);

  const mirrorFamily=m6r2MirrorFamily(current.code);
  const mirrorOccurrences=real.filter(x=>x.id>F1.id&&x.id<current.id&&m6r2Family(x.code)===mirrorFamily);
  out={...out,mirrorFamily,mirrorOccurrences,mirrorCount:mirrorOccurrences.length};
  if(mirrorOccurrences.length!==M6_R2_MIRROR_COUNT)
    return noSignal(out,`mirror_family ${mirrorFamily}: ${mirrorOccurrences.length} появлений, нужно ровно 2`);

  const lastMirror=mirrorOccurrences.at(-1),mirrorLag=current.id-lastMirror.id;
  out={...out,lastMirror,mirrorLag};
  if(mirrorLag>M6_R2_MIRROR_LAG_MAX)return noSignal(out,`mirror_lag ${mirrorLag} > 25`);

  const self=m6r2SelfDetails(family);
  if(!self.triples.length)return noSignal({...out,paths:self.paths},'family+family не дала XXX');

  return{...out,trigger:true,signal:self.triples,paths:self.paths,reason:'M6-R2 TRIGGER'};
}
