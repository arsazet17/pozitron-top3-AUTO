export const M6_RULE_CODE="TOP3-M6-REPEAT-FAMILY-150-V2-19.09.2026";
export const M6_RULE_START_FACT=268289;
export const M6_FORWARD_TARGET=268290;
export const M6_TTL=150;
export const M5_WINDOW=50;
export const M5_LAST=5;

function code3(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
export function familyOf(v){return code3(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function perms(v){const a=familyOf(v).split(""),out=new Set();for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)out.add(a[i]+a[j]+a[k]);return [...out]}
function add(a,b){a=code3(a);b=code3(b);return a.split("").map((x,i)=>(Number(x)+Number(b[i]))%10).join("")}
function normalize(records=[]){return (records||[]).map(r=>({id:Number(r?.draw??r?.id),date:String(r?.date||""),time:String(r?.time||""),code:code3(r?.combo??r?.code??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:""))})).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id)}
function occupiedSet(v){const s=new Set();for(const x of v||[]){const n=Number(typeof x==="object"?(x.id??x.draw):x);if(Number.isInteger(n))s.add(n)}return s}
export function familyTripleResults(a,b){const out=new Map();for(const pa of perms(a))for(const pb of perms(b)){const x=add(pa,pb);if(!isTriple(x))continue;if(!out.has(x))out.set(x,[]);const arr=out.get(x);if(arr.length<12)arr.push(`${pa}+${pb}→${x}`)}return out}

export function computeM5ExactState(records=[],uptoId=null){
 let real=normalize(records);
 if(uptoId!==null&&uptoId!==undefined&&Number.isInteger(Number(uptoId)))real=real.filter(r=>r.id<=Number(uptoId));
 if(!real.length)return{links:[],occupied:[],counts:{},previous5:[],burst:false,main:false,reserve:false};
 const window=real.slice(-M5_WINDOW),seconds=window.slice(-M5_LAST),secondIds=new Set(seconds.map(x=>x.id)),links=[];
 for(let j=0;j<window.length;j++){
  const second=window[j];if(!secondIds.has(second.id))continue;
  for(let i=0;i<j;i++){
   const source=window[i],triple=add(source.code,second.code);if(!isTriple(triple))continue;
   links.push({sourceId:source.id,sourceCode:source.code,secondId:second.id,secondCode:second.code,triple});
  }
 }
 const occupied=new Set(),counts={};for(const l of links){occupied.add(l.sourceId);occupied.add(l.secondId);counts[l.triple]=(counts[l.triple]||0)+1}
 const burst=links.length>=6,main=burst&&["222","444","888"].every(t=>(counts[t]||0)>0),reserve=burst&&(counts["222"]||0)>0&&(counts["444"]||0)>0;
 return{links,occupied:[...occupied].sort((a,b)=>a-b),counts,previous5:seconds,burst,main,reserve};
}

function activeRows(states,currentId){
 const out=[];for(const [family,s] of states)if(Number(s.activeFrom)<=currentId&&currentId<=Number(s.activeUntil))out.push({family,...s});
 return out.sort((a,b)=>a.family.localeCompare(b.family));
}
function updateFamilyState(states,row){
 const family=familyOf(row.code),old=states.get(family)||{count:0,firstAt:null,lastAt:null,activeFrom:null,activeUntil:null,lastRepeatAt:null};
 const wasActive=Number(old.activeFrom)<=row.id&&row.id<=Number(old.activeUntil),next={...old,count:Number(old.count||0)+1,firstAt:old.firstAt??row.id,lastAt:row.id};
 if(Number(old.count||0)>=1){next.activeFrom=wasActive?old.activeFrom:row.id+1;next.activeUntil=row.id+M6_TTL;next.lastRepeatAt=row.id}
 states.set(family,next);return{family,old,next,wasActive};
}

export function collectM5ExactOccupied(ctx={}){
 const out=new Set(computeM5ExactState(ctx?.records||[]).occupied);
 const pools=[ctx?.m5ExactOccupiedDraws,ctx?.state?.m5ExactOccupiedDraws,ctx?.issue?.m5ExactOccupiedDraws,ctx?.current?.m5ExactOccupiedDraws,ctx?.methods?.m5?.exactOccupiedDraws,ctx?.methods?.M5?.exactOccupiedDraws];
 for(const p of pools)for(const x of p||[]){const n=Number(typeof x==="object"?(x.id??x.draw):x);if(Number.isInteger(n))out.add(n)}return [...out].sort((a,b)=>a-b);
}

export function computeM6RepeatFamily(records=[],options={}){
 const real=normalize(records),externalOccupied=occupiedSet(options.exactOccupiedDraws||options.exactOccupied||[]),states=new Map(),history=[];
 let current=null;
 for(let i=0;i<real.length;i++){
  const row=real[i],active=activeRows(states,row.id),m5=row.id>=M6_RULE_START_FACT?computeM5ExactState(real.slice(0,i+1)):null;
  const occupied=new Set([...(m5?.occupied||[]),...externalOccupied]);
  const currentFamily=familyOf(row.code),currentBlocked=occupied.has(row.id),signals=new Map(),details=[],excluded=[];

  if(row.id>=M6_RULE_START_FACT&&!currentBlocked){
   for(const af of active){
    const hits=familyTripleResults(af.family,currentFamily);
    for(const [triple,paths] of hits){
     if(!signals.has(triple))signals.set(triple,[]);
     const d={triple,activeFamily:af.family,currentFamily,activeFrom:af.activeFrom,activeUntil:af.activeUntil,paths};signals.get(triple).push(d);details.push(d);
    }
   }
  }else if(row.id>=M6_RULE_START_FACT&&currentBlocked)excluded.push({draw:row.id,code:row.code,reason:"CURRENT FACT exact-occupied M5"});

  const triples=[...signals.keys()].sort((a,b)=>Number(a[0])-Number(b[0])),targetId=row.id+1,targetFact=real[i+1]?.id===targetId?real[i+1]:null;
  updateFamilyState(states,row);
  const activeNext=activeRows(states,targetId);

  if(row.id>=M6_RULE_START_FACT){
   const check=targetFact?(triples.length?(triples.includes(targetFact.code)?"✅ HIT":"❌ мимо"):"сигнала не было"):"ожидает факт";
   current={sourceId:row.id,sourceCode:row.code,currentFamily,targetId,targetFact,active,activeNext,currentBlocked,triples,details,excluded,check,m5:{...m5,occupied:[...occupied].sort((a,b)=>a-b)}};
   history.push(current);
  }
 }
 return{ruleCode:M6_RULE_CODE,startFact:M6_RULE_START_FACT,forwardTarget:M6_FORWARD_TARGET,ttl:M6_TTL,current,history,occupied:current?.m5?.occupied||[],m5:current?.m5||computeM5ExactState(real),activeNext:current?.activeNext||[]};
}
