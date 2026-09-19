export const M6_RULE_CODE="TOP3-M6-REPEAT-FAMILY-150-V2-19.09.2026";
export const M6_RULE_START_FACT=268289;
export const M6_TTL=150;

function code3(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
export function familyOf(v){return code3(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function perms(v){const a=familyOf(v).split(""),out=new Set();for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)out.add(a[i]+a[j]+a[k]);return [...out]}
function add(a,b){a=code3(a);b=code3(b);return a.split("").map((x,i)=>(Number(x)+Number(b[i]))%10).join("")}
function normalize(records=[]){return (records||[]).map(r=>({id:Number(r?.draw??r?.id),date:String(r?.date||""),time:String(r?.time||""),code:code3(r?.combo??r?.code??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:""))})).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id)}
function occupiedSet(v){const s=new Set();for(const x of v||[]){const n=Number(typeof x==="object"?(x.id??x.draw):x);if(Number.isInteger(n))s.add(n)}return s}
function familyTripleResults(a,b){const out=new Map();for(const pa of perms(a))for(const pb of perms(b)){const x=add(pa,pb);if(!isTriple(x))continue;if(!out.has(x))out.set(x,[]);const arr=out.get(x);if(arr.length<12)arr.push(`${pa}+${pb}→${x}`)}return out}

function forecastAt(real,index,occupied){
 const current=real[index];if(!current||current.id<M6_RULE_START_FACT)return null;
 const targetId=current.id+1,targetFact=real[index+1]?.id===targetId?real[index+1]:null;
 const allowed=real.slice(0,index+1).filter(r=>!occupied.has(r.id));
 const byFam=new Map();for(const r of allowed){const f=familyOf(r.code);if(!byFam.has(f))byFam.set(f,[]);byFam.get(f).push(r)}
 const active=[];for(const [family,rows] of byFam){if(rows.length<2)continue;const second=rows[1],last=rows.at(-1),activeFrom=second.id+1,activeUntil=last.id+M6_TTL;if(targetId<activeFrom||targetId>activeUntil)continue;active.push({family,secondAt:second.id,lastRepeatAt:last.id,activeFrom,activeUntil,occurrences:rows.length})}
 active.sort((a,b)=>a.family.localeCompare(b.family));
 const currentBlocked=occupied.has(current.id),currentFamily=familyOf(current.code),signals=new Map();
 if(!currentBlocked){for(const af of active){const hits=familyTripleResults(af.family,currentFamily);for(const [triple,paths] of hits){if(!signals.has(triple))signals.set(triple,[]);signals.get(triple).push({activeFamily:af.family,currentFamily,activeUntil:af.activeUntil,paths})}}}
 const triples=[...signals.keys()].sort((a,b)=>Number(a[0])-Number(b[0]));
 const details=triples.flatMap(triple=>signals.get(triple).map(x=>({triple,...x})));
 const check=targetFact?(triples.length?(triples.includes(targetFact.code)?"✅ HIT":"❌ мимо"):"сигнала не было"):"ожидает факт";
 return {sourceId:current.id,sourceCode:current.code,currentFamily,targetId,targetFact,active,currentBlocked,triples,details,check};
}

export function collectM5ExactOccupied(ctx={}){
 const pools=[ctx?.m5ExactOccupiedDraws,ctx?.state?.m5ExactOccupiedDraws,ctx?.issue?.m5ExactOccupiedDraws,ctx?.current?.m5ExactOccupiedDraws,ctx?.methods?.m5?.exactOccupiedDraws,ctx?.methods?.M5?.exactOccupiedDraws];
 const out=new Set();for(const p of pools)for(const x of p||[]){const n=Number(typeof x==="object"?(x.id??x.draw):x);if(Number.isInteger(n))out.add(n)}return [...out];
}

export function computeM6RepeatFamily(records=[],options={}){
 const real=normalize(records),occupied=occupiedSet(options.exactOccupiedDraws||options.exactOccupied||[]),history=[];
 for(let i=0;i<real.length;i++){const f=forecastAt(real,i,occupied);if(f)history.push(f)}
 return {ruleCode:M6_RULE_CODE,startFact:M6_RULE_START_FACT,ttl:M6_TTL,current:history.at(-1)||null,history,occupied:[...occupied]};
}
