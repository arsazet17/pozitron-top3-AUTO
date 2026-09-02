import {parseDT,sortRecords} from "./core.js";
import {computeMainForecast,routeHits} from "./forecast.js";
import {algorithmShiftForecast} from "./shift.js";

export const CHAT_MASTER_SCHEMA="chat-master-v1";
const GROUP_ORDER={MAIN:0,ALGORITHM:1,APP_CORE:2,SHIFT:3};
const BLOCK_ORDER={TOP:0,DELTA:1,NUMBERS:2};
const LABEL_BLOCK={TOP:"TOP","Δ":"DELTA","ЧИСЛА":"NUMBERS"};

export function family(combo){return [...String(combo||"")].sort().join("")}
export function deltaCombo(oldCombo,newCombo){
  const a=String(oldCombo),b=String(newCombo);
  if(!/^\d{3}$/.test(a)||!/^\d{3}$/.test(b))return null;
  return [...a].map((x,i)=>String((Number(b[i])-Number(x)+10)%10)).join("");
}
function dtKey(r){return parseDT(r).getTime()}
function comboOf(r){return r?.combo||`${r?.A??""}${r?.B??""}${r?.C??""}`}
function targetMs(target){return new Date(`${target.date}T${target.time}:00+03:00`).getTime()}
function beforeTarget(records,target){return sortRecords(records).filter(r=>dtKey(r)<targetMs(target))}
function latestDate(a,b){return !a?b:!b?a:(String(a)>String(b)?a:b)}
function countMap(arr,keyFn){const m=new Map();for(const x of arr){const k=keyFn(x);m.set(k,(m.get(k)||0)+1)}return m}
function obj(m){return Object.fromEntries([...m.entries()])}

function sequenceOccurrences(records,target){
  const arr=beforeTarget(records,target),out=[];
  for(let i=1;i<arr.length-1;i++){
    const d=deltaCombo(comboOf(arr[i-1]),comboOf(arr[i]));
    const next=arr[i+1];
    if(d)out.push({source:"SEQ",delta:d,deltaFamily:family(d),combo:comboOf(next),family:family(comboOf(next)),at:`${next.date} ${next.time}`,time:next.time});
  }
  return out;
}
function timeDirectionOccurrences(records,target){
  const arr=beforeTarget(records,target),byTime=new Map(),out=[];
  for(const r of arr){if(!byTime.has(r.time))byTime.set(r.time,[]);byTime.get(r.time).push(r)}
  for(const [time,rows] of byTime){
    rows.sort((a,b)=>dtKey(a)-dtKey(b));
    for(let i=1;i<rows.length-1;i++){
      const d=deltaCombo(comboOf(rows[i-1]),comboOf(rows[i]));
      const next=rows[i+1];
      if(d)out.push({source:"TD",time,delta:d,deltaFamily:family(d),combo:comboOf(next),family:family(comboOf(next)),at:`${next.date} ${next.time}`});
    }
  }
  return out;
}
function currentSignals(records,target){
  const arr=beforeTarget(records,target),last=arr.at(-1),prev=arr.at(-2),same=arr.filter(r=>r.time===target.time),tdNew=same.at(-1),tdOld=same.at(-2);
  return {
    lastFact:comboOf(last),
    seq:{signal:prev&&last?deltaCombo(comboOf(prev),comboOf(last)):null,old:prev?comboOf(prev):null,new:last?comboOf(last):null,oldAt:prev?`${prev.date} ${prev.time}`:null,newAt:last?`${last.date} ${last.time}`:null},
    td:{signal:tdOld&&tdNew?deltaCombo(comboOf(tdOld),comboOf(tdNew)):null,old:tdOld?comboOf(tdOld):null,new:tdNew?comboOf(tdNew):null,oldAt:tdOld?`${tdOld.date} ${tdOld.time}`:null,newAt:tdNew?`${tdNew.date} ${tdNew.time}`:null}
  };
}
function rawForSignal(occ,signal){if(!signal)return [];const f=family(signal);return occ.filter(x=>x.deltaFamily===f)}
function rawSummary(raw){
  const families=new Map(),familyLatest=new Map(),digits=new Map();
  for(let d=0;d<=9;d++)digits.set(String(d),0);
  for(const x of raw){
    families.set(x.family,(families.get(x.family)||0)+1);
    familyLatest.set(x.family,latestDate(familyLatest.get(x.family),x.at));
    for(const d of new Set([...x.combo]))digits.set(d,(digits.get(d)||0)+1);
  }
  return {total:raw.length,families,familyLatest,digits};
}
function bestOrder(f,seqRaw,tdRaw){
  const rows=[...seqRaw,...tdRaw].filter(x=>x.family===f),counts=countMap(rows,x=>x.combo),latest=new Map();
  for(const x of rows)latest.set(x.combo,latestDate(latest.get(x.combo),x.at));
  const ranked=[...counts.keys()].sort((a,b)=>(counts.get(b)-counts.get(a))||String(latest.get(b)||"").localeCompare(String(latest.get(a)||""))||a.localeCompare(b));
  const order=ranked[0]||f;
  return {order,count:counts.get(order)||0,last:latest.get(order)||null,orders:ranked.map(x=>({order:x,count:counts.get(x),last:latest.get(x)||null}))};
}
function mainSignalPool(records,target){
  const signals=currentSignals(records,target),seqOcc=sequenceOccurrences(records,target),tdOcc=timeDirectionOccurrences(records,target),seqRaw=rawForSignal(seqOcc,signals.seq.signal),tdRaw=rawForSignal(tdOcc,signals.td.signal),s1=rawSummary(seqRaw),s2=rawSummary(tdRaw),families=new Set([...s1.families.keys(),...s2.families.keys()]);
  const ranked=[...families].map(f=>{
    const seq=s1.families.get(f)||0,td=s2.families.get(f)||0,total=seq+td,last=latestDate(s1.familyLatest.get(f),s2.familyLatest.get(f));
    return {family:f,seq,td,total,last,...bestOrder(f,seqRaw,tdRaw)};
  }).sort((a,b)=>(b.total-a.total)||String(b.last||"").localeCompare(String(a.last||""))||a.family.localeCompare(b.family));
  const exactSeq=seqRaw.filter(x=>x.delta===signals.seq.signal),exactTD=tdRaw.filter(x=>x.delta===signals.td.signal),ef1=new Set(exactSeq.map(x=>x.family)),ef2=new Set(exactTD.map(x=>x.family));
  return {signals,top3:ranked.slice(0,3),ranked,raw:{seq:{total:s1.total,familyCounts:obj(s1.families),digitCounts:obj(s1.digits),matches:seqRaw},td:{total:s2.total,familyCounts:obj(s2.families),digitCounts:obj(s2.digits),matches:tdRaw}},exact:{seq:exactSeq,td:exactTD,commonFamilies:[...ef1].filter(x=>ef2.has(x))}};
}

function relationCandidates(raw,source){
  const rel=new Map();
  for(const x of raw){
    const key=`${x.delta}|${x.family}`;
    if(!rel.has(key))rel.set(key,{source,delta:x.delta,family:x.family,repeat:0,last:null,orders:new Map(),orderLatest:new Map()});
    const r=rel.get(key);r.repeat++;r.last=latestDate(r.last,x.at);r.orders.set(x.combo,(r.orders.get(x.combo)||0)+1);r.orderLatest.set(x.combo,latestDate(r.orderLatest.get(x.combo),x.at));
  }
  return [...rel.values()].filter(x=>x.repeat>=2).map(r=>{
    const orderKeys=[...r.orders.keys()].sort((a,b)=>(r.orders.get(b)-r.orders.get(a))||String(r.orderLatest.get(b)||"").localeCompare(String(r.orderLatest.get(a)||""))||a.localeCompare(b));
    const order=orderKeys[0]||r.family;
    return {source:r.source,delta:r.delta,family:r.family,repeat:r.repeat,last:r.last,order,orderCount:r.orders.get(order)||0,orders:orderKeys.map(o=>({order:o,count:r.orders.get(o),last:r.orderLatest.get(o)}))};
  });
}
function permAlgorithm(main){
  const relations=[...relationCandidates(main.raw.seq.matches,"SEQ"),...relationCandidates(main.raw.td.matches,"TD")].sort((a,b)=>(b.repeat-a.repeat)||String(b.last||"").localeCompare(String(a.last||""))||a.source.localeCompare(b.source)||a.delta.localeCompare(b.delta));
  const byFamily=new Map();
  for(const r of relations){const old=byFamily.get(r.family);if(!old||r.repeat>old.repeat||(r.repeat===old.repeat&&String(r.last)>String(old.last)))byFamily.set(r.family,r)}
  const ranked=[...byFamily.values()].sort((a,b)=>(b.repeat-a.repeat)||String(b.last||"").localeCompare(String(a.last||""))||a.family.localeCompare(b.family));
  return {top3:ranked.slice(0,3),ranked,relations};
}

function routeBlockCounts(shift,kind){
  const out={TOP:0,DELTA:0,NUMBERS:0};
  for(const p of ["A","B","C"]){const label=shift?.diagnostics?.[p]?.[kind];if(!label)continue;const prefix=String(label).split(" · ")[0],block=LABEL_BLOCK[prefix];if(block)out[block]++}
  return out;
}
function signalFamilySupport(main,combo){const f=family(combo);return Number(main.raw.seq.familyCounts[f]||0)+Number(main.raw.td.familyCounts[f]||0)}
function chooseAppCore(legacy,shift,main){
  const blocks=["TOP","DELTA","NUMBERS"],consensus=blocks.filter(b=>legacy?.[b]?.[0]&&legacy[b][0]===legacy[b][1]).map(block=>({block,combo:legacy[block][0],family:family(legacy[block][0]),consensus:true}));
  let pool=consensus.length?consensus:blocks.map(block=>({block,combo:legacy?.[block]?.[0],family:family(legacy?.[block]?.[0]),consensus:false})).filter(x=>/^\d{3}$/.test(x.combo));
  const recent=routeBlockCounts(shift,"recentRoute"),long=routeBlockCounts(shift,"longRoute");
  pool=pool.map(x=>({...x,recent:recent[x.block]||0,long:long[x.block]||0,signalSupport:signalFamilySupport(main,x.combo),blockOrder:BLOCK_ORDER[x.block]}));
  pool.sort((a,b)=>(b.recent-a.recent)||(b.long-a.long)||(b.signalSupport-a.signalSupport)||(a.blockOrder-b.blockOrder)||a.combo.localeCompare(b.combo));
  return {selected:pool[0]||null,candidates:pool,mode:consensus.length?"V1=V2 consensus":"V1 fallback"};
}

function addGroupCandidate(map,group,rank,candidate,evidence=0,recency=null){
  const order=String(candidate?.order||candidate?.combo||"");
  if(!candidate?.family||!/^\d{3}$/.test(order))return;
  const points=rank===1?3:rank===2?2:1,f=candidate.family;
  if(!map.has(f))map.set(f,{family:f,score:0,groups:new Set(),evidence:0,recency:null,orders:new Map(),sources:[]});
  const x=map.get(f);x.score+=points;x.groups.add(group);x.evidence+=Number(evidence||0);x.recency=latestDate(x.recency,recency);x.orders.set(order,(x.orders.get(order)||0)+points);x.sources.push({group,rank,points,order,evidence,recency});
}
function masterRank(main,algorithm,appCore,shift){
  const map=new Map();
  main.top3.forEach((x,i)=>addGroupCandidate(map,"MAIN",i+1,x,x.total,x.last));
  algorithm.top3.forEach((x,i)=>addGroupCandidate(map,"ALGORITHM",i+1,x,x.repeat,x.last));
  if(appCore?.selected)addGroupCandidate(map,"APP_CORE",1,{family:appCore.selected.family,order:appCore.selected.combo},appCore.selected.consensus?2:1,main.signals?.seq?.newAt||null);
  if(shift?.status==="активен"&&/^\d{3}$/.test(String(shift.combo||""))){const changed=["A","B","C"].filter(p=>shift.diagnostics?.[p]?.changed).length;addGroupCandidate(map,"SHIFT",1,{family:family(shift.combo),order:shift.combo},Math.max(1,changed),main.signals?.seq?.newAt||null)}
  const ranked=[...map.values()].map(x=>{const order=[...x.orders.keys()].sort((a,b)=>(x.orders.get(b)-x.orders.get(a))||a.localeCompare(b))[0];return {...x,groupCount:x.groups.size,groups:[...x.groups],order,orders:obj(x.orders)}}).sort((a,b)=>(b.score-a.score)||(b.groupCount-a.groupCount)||(b.evidence-a.evidence)||String(b.recency||"").localeCompare(String(a.recency||""))||(Math.min(...a.groups.map(g=>GROUP_ORDER[g]??99))-Math.min(...b.groups.map(g=>GROUP_ORDER[g]??99)))||a.family.localeCompare(b.family));
  return {top3:ranked.slice(0,3),ranked,combos:ranked.slice(0,3).map(x=>x.order),families:ranked.slice(0,3).map(x=>x.family)};
}

export function computeChatForecast(records,target,rules,state={}){
  const main=mainSignalPool(records,target),algorithm=permAlgorithm(main),legacy=computeMainForecast(records,target,rules),shift=algorithmShiftForecast(legacy,state.observations||[],rules),appCore=chooseAppCore(legacy,shift,main),master=masterRank(main,algorithm,appCore,shift);
  return {schema:CHAT_MASTER_SCHEMA,target,lastFact:main.signals.lastFact,master,methods:{main,algorithm,appCore,shift},hidden:{legacyForecast:legacy},ruleSet:{familyOrderIgnored:true,main:"RAW total → family recency; order frequency → order recency",algorithm:"PERM→FAMILY repeat>=2 → repeat → recency",master:"independent groups MAIN/ALGORITHM/APP_CORE/SHIFT; rank points 3/2/1; no double count",noLeakage:true}};
}

export function auditChatForecast(issue,fact){
  const combo=String(fact?.combo||fact||""),f=family(combo),main=issue?.methods?.main||{},algorithm=issue?.methods?.algorithm||{},appCore=issue?.methods?.appCore||{},shift=issue?.methods?.shift||{};
  const seq=Number(main.raw?.seq?.familyCounts?.[f]||0),td=Number(main.raw?.td?.familyCounts?.[f]||0),mainFamilies=(main.top3||[]).map(x=>x.family),algFamilies=(algorithm.top3||[]).map(x=>x.family),masterFamilies=issue?.master?.families||[];
  const classification=seq===0&&td===0?"STRUCTURAL BLIND":seq===0||td===0?"single-source RAW miss":mainFamilies.includes(f)?"MAIN covered":"2-source selector-miss";
  const digits=[...new Set(combo)],digitSupport={};
  for(const d of digits)digitSupport[d]={seq:Number(main.raw?.seq?.digitCounts?.[d]||0),seqTotal:Number(main.raw?.seq?.total||0),td:Number(main.raw?.td?.digitCounts?.[d]||0),tdTotal:Number(main.raw?.td?.total||0)};
  const assemblyBlind=seq===0&&td===0&&digits.every(d=>digitSupport[d].seq>0&&digitSupport[d].td>0),appCombo=appCore.selected?.combo||null,shiftCombo=shift.combo||null,same=x=>x&&family(x)===f,exact=x=>x===combo;
  return {fact:combo,family:f,master:{hit:masterFamilies.includes(f),exact:(issue.master?.combos||[]).some(exact),families:masterFamilies},main:{hit:mainFamilies.includes(f),seq,td,classification},algorithm:{hit:algFamilies.includes(f),relations:(algorithm.relations||[]).filter(x=>x.family===f)},appCore:{hit:same(appCombo),exact:exact(appCombo),combo:appCombo},shift:{hit:same(shiftCombo),exact:exact(shiftCombo),combo:shiftCombo},digitSupport,assemblyBlind,classification,workError:masterFamilies.includes(f)?"MASTER HIT — freeze подтверждён":"MASTER MISS — сохранить freeze; проверить RAW/relations/groups; правила не менять по одному факту"};
}

export function legacyRouteHits(issue,fact){const legacy=issue?.hidden?.legacyForecast;return legacy?routeHits(legacy,String(fact?.combo||fact||"")):{A:[],B:[],C:[]}}
