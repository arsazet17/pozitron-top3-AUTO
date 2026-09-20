export const M6_V3_RULE_CODE="TOP3-M6-REPEAT-FAMILY-150-V3-STRICT-20.09.2026";
export const M6_V3_WINDOW=150;
export const M6_V3_FORWARD_START_SOURCE_ID=268327;

function pad(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
export function m6Family(v){return pad(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function perms(v){const a=pad(v).split(""),s=new Set();for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)s.add(a[i]+a[j]+a[k]);return [...s]}
function add(a,b){a=pad(a);b=pad(b);return a.split("").map((x,i)=>(Number(x)+Number(b[i]))%10).join("")}

function normalize(ctx){
 const byId=new Map((ctx.records||[]).map(r=>{const id=Number(r.draw??r.id),code=String(r.combo??((r.A!=null&&r.B!=null&&r.C!=null)?`${r.A}${r.B}${r.C}`:""));return[id,{id,date:String(r.date||""),time:String(r.time||""),code:pad(code)}]}));
 const full=ctx.fullArchive,combos=full?.combos||[];
 if(full&&combos.length&&Number.isFinite(Number(full.fromDraw))){return combos.map((c,i)=>{const id=Number(full.fromDraw)+i,known=byId.get(id);return{id,date:known?.date||"",time:known?.time||"",code:pad(c)}}).filter(x=>/^\d{3}$/.test(x.code)).sort((a,b)=>a.id-b.id)}
 return [...byId.values()].filter(x=>Number.isInteger(x.id)&&/^\d{3}$/.test(x.code)).sort((a,b)=>a.id-b.id)
}
function selfCalc(fam){const ps=perms(fam),triples=new Set(),paths=[];for(const a of ps)for(const b of ps){const r=add(a,b);if(!isTriple(r))continue;triples.add(r);paths.push(`${a}+${b}→${r}`)}return{triples:[...triples].sort((a,b)=>Number(a[0])-Number(b[0])),paths}}
export function m6SelfResults(v){return selfCalc(m6Family(v))}
function rowFor(real,index,prevFrozen){const current=real[index],window=real.slice(Math.max(0,index-M6_V3_WINDOW+1),index+1),fam=m6Family(current.code),hits=window.filter(x=>m6Family(x.code)===fam),n=hits.length,trigger=n>=3,self=trigger?selfCalc(fam):{triples:[],paths:[]};let prevCheck="START V3 · не оценивается";if(current.id>M6_V3_FORWARD_START_SOURCE_ID){if(!prevFrozen?.length)prevCheck="NO SIGNAL";else prevCheck=prevFrozen.includes(current.code)?`✅ HIT ${current.code}`:`❌ MISS · было ${prevFrozen.join(" / ")}`}return{sourceId:current.id,date:current.date,time:current.time,fact:current.code,family:fam,windowSize:window.length,count:n,appearances:hits.map(x=>x.id),ordinal:n,trigger,triples:self.triples,paths:self.paths,targetId:current.id+1,prevCheck}}
export function computeM6V3Strict(ctx){const real=normalize(ctx);if(!real.length)return{rule:M6_V3_RULE_CODE,rows:[],current:null};let start=real.findIndex(x=>x.id>=M6_V3_FORWARD_START_SOURCE_ID);if(start<0)return{rule:M6_V3_RULE_CODE,rows:[],current:null};const rows=[];let prevFrozen=[];for(let i=start;i<real.length;i++){const r=rowFor(real,i,prevFrozen);rows.push(r);prevFrozen=r.triples}return{rule:M6_V3_RULE_CODE,window:M6_V3_WINDOW,forwardStartSourceId:M6_V3_FORWARD_START_SOURCE_ID,rows,current:rows.at(-1)||null}}
