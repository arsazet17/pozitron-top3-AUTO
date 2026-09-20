export const M6_RULE_CODE="TOP3-M6-REPEAT-FAMILY-150-V3-STRICT-20.09.2026";
export const M6_WINDOW=150;
export const M6_RULE_START_FACT=268327;
export const M6_FORWARD_TARGET=268328;

function code3(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
export function familyOf(v){return code3(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function add(a,b){a=code3(a);b=code3(b);return a.split("").map((x,i)=>(Number(x)+Number(b[i]))%10).join("")}
function normalize(records=[]){return (records||[]).map(r=>({id:Number(r?.draw??r?.id),date:String(r?.date||""),time:String(r?.time||""),code:code3(r?.combo??r?.code??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:""))})).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id)}

export function uniquePermutations(v){
 const a=familyOf(v).split(""),out=new Set();
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)out.add(a[i]+a[j]+a[k]);
 return [...out].sort();
}

export function familyTripleResults(a,b=a){
 const out=new Map();
 for(const pa of uniquePermutations(a))for(const pb of uniquePermutations(b)){
  const x=add(pa,pb);if(!isTriple(x))continue;
  if(!out.has(x))out.set(x,[]);
  const path=`${pa}+${pb}→${x}`;
  if(!out.get(x).includes(path))out.get(x).push(path);
 }
 return out;
}

export function evaluateM6Window(records=[],index=null){
 const real=normalize(records);if(!real.length)return null;
 const i=index==null?real.length-1:Math.max(0,Math.min(real.length-1,Number(index)));
 const row=real[i],from=Math.max(0,i-M6_WINDOW+1),window=real.slice(from,i+1),currentFamily=familyOf(row.code);
 const occurrences=window.filter(x=>familyOf(x.code)===currentFamily);
 const count=occurrences.length,trigger=count>=3,results=trigger?familyTripleResults(currentFamily,currentFamily):new Map();
 const triples=[...results.keys()].sort((a,b)=>Number(a[0])-Number(b[0]));
 const paths=Object.fromEntries([...results.entries()].map(([triple,list])=>[triple,[...list]]));
 return {
  sourceId:row.id,sourceDate:row.date,sourceTime:row.time,sourceCode:row.code,currentFamily,
  windowSize:window.length,windowFromId:window[0]?.id??null,windowToId:window.at(-1)?.id??null,
  count,occurrenceIds:occurrences.map(x=>x.id),occurrenceCodes:occurrences.map(x=>x.code),
  occurrenceOrdinal:count,trigger,triples,paths,targetId:row.id+1
 };
}

export function computeM6RepeatFamily(records=[],options={}){
 const real=normalize(records),startFact=Number(options.startFact??M6_RULE_START_FACT),history=[];
 let current=null,previous=null;
 for(let i=0;i<real.length;i++){
  const row=real[i];
  if(previous&&previous.targetId===row.id){
   previous.targetFact={id:row.id,date:row.date,time:row.time,code:row.code};
   previous.check=previous.triples.length?(previous.triples.includes(row.code)?"✅ HIT":"❌ MISS"):"NO SIGNAL";
  }
  const calc=evaluateM6Window(real,i);
  if(row.id<startFact)continue;
  const previousCheck=previous&&previous.targetId===row.id?previous.check:(row.id===startFact?"V3 START — предыдущий V3 отсутствует":"NO SIGNAL");
  current={...calc,previousCheck,targetFact:null,check:"ожидает факт"};
  history.push(current);previous=current;
 }
 return {
  ruleCode:M6_RULE_CODE,window:M6_WINDOW,startFact,forwardTarget:startFact+1,
  current,history
 };
}
