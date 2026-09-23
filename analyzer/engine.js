export const TARGETS = ['000','111','222','333','444','555','666','777','888','999'];

const MIRROR = {0:'0',1:'9',2:'8',3:'7',4:'6',5:'5',6:'4',7:'3',8:'2',9:'1'};
const M2 = {
  '000':['577','335'],'111':['039','017'],'222':['056','045'],'333':['478','236'],
  '444':['357','357'],'555':['156','459'],'666':['049','016'],'777':['478','236'],
  '888':['147','369'],'999':['248','268']
};

export function family(s){ return String(s).padStart(3,'0').split('').sort().join(''); }
export function mirror(s){ return String(s).padStart(3,'0').split('').map(x=>MIRROR[x]).join(''); }
export function exactAdd(a,b){
  a=String(a).padStart(3,'0'); b=String(b).padStart(3,'0');
  return [...a].map((x,i)=>String((Number(x)+Number(b[i]))%10)).join('');
}
export function addCombo(source,target){
  const t=Number(target[0]);
  return [...String(source).padStart(3,'0')].map(x=>String((t-Number(x)+10)%10)).join('');
}
export function uniquePerms(s){
  s=String(s).padStart(3,'0');
  const out=new Set();
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(j!==i) for(let k=0;k<3;k++) if(k!==i&&k!==j) out.add(s[i]+s[j]+s[k]);
  return [...out];
}
export function isTriple(s){ return s[0]===s[1] && s[1]===s[2]; }
export function pairRaw(a,b){
  const ex=exactAdd(a,b);
  if(isTriple(ex)) return {block:ex, raw:{}};
  const raw={};
  for(const pa of uniquePerms(a)) for(const pb of uniquePerms(b)){
    const sm=exactAdd(pa,pb);
    if(isTriple(sm)) (raw[sm]??=[]).push([pa,pb]);
  }
  return {block:null,raw};
}
export function familyPairTriples(f1,f2){
  const out=new Set();
  for(const a of uniquePerms(f1)) for(const b of uniquePerms(f2)){
    const sm=exactAdd(a,b); if(isTriple(sm)) out.add(sm);
  }
  return [...out].sort();
}
export function familySelfDetails(f){
  const details={};
  for(const a of uniquePerms(f)) for(const b of uniquePerms(f)){
    const sm=exactAdd(a,b);
    if(isTriple(sm)) (details[sm]??=[]).push(`${a}+${b}→${sm}`);
  }
  return details;
}
export function add30(dateStr,timeStr){
  const [dd,mm,yyyy]=dateStr.split('.').map(Number);
  const [hh,mi]=timeStr.split(':').map(Number);
  const d=new Date(yyyy,mm-1,dd,hh,mi+30,0,0);
  const pad=n=>String(n).padStart(2,'0');
  return {date:`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};
}

function exactType(a,b){ const s=exactAdd(a,b); return isTriple(s)?s:null; }
export function computeM5ForNext(facts){
  const w=facts.slice(-50), last5=w.slice(-5), last5Draws=new Set(last5.map(x=>x.draw));
  const links=[];
  for(let j=0;j<w.length;j++){
    const b=w[j]; if(!last5Draws.has(b.draw)) continue;
    for(let i=0;i<j;i++){
      const a=w[i], tr=exactType(a.combo,b.combo);
      if(tr) links.push({source_draw:a.draw,source_combo:a.combo,second_draw:b.draw,second_combo:b.combo,triple:tr});
    }
  }
  const counts={}; for(const x of links) counts[x.triple]=(counts[x.triple]||0)+1;
  const occupied=[...new Set(links.flatMap(x=>[x.source_draw,x.second_draw]))].sort((a,b)=>a-b);
  return {last5,links,counts,total:links.length,occupied,
    burst:links.length>=6,
    main:links.length>=6 && ['222','444','888'].every(t=>counts[t]),
    reserve:links.length>=6 && ['222','444'].every(t=>counts[t])};
}

export function computeM6Strict(facts){
  const current=facts.at(-1); if(!current) return {status:'NO DATA',signal:[]};
  const window=facts.slice(-1000), f=family(current.combo);
  const occurrences=window.filter(x=>family(x.combo)===f);
  if(occurrences.length<3){
    return {version:'V3',window:1000,family:f,count:occurrences.length,occurrences,trigger:false,signal:[],details:{},status:'NO SIGNAL'};
  }
  const details=familySelfDetails(f), signal=Object.keys(details).sort();
  return {version:'V3',window:1000,family:f,count:occurrences.length,occurrences,trigger:true,signal,details,status:signal.length?'SIGNAL':'NO SIGNAL'};
}

function packageGroups(rawUnion){
  const byDraw=new Map(), comboBy=new Map();
  for(const x of rawUnion){
    if(!byDraw.has(x.source_draw)) byDraw.set(x.source_draw,new Set());
    byDraw.get(x.source_draw).add(x.triple); comboBy.set(x.source_draw,x.source_combo);
  }
  const draws=[...byDraw.keys()].sort((a,b)=>a-b), groups=[]; let cur=[];
  function flush(){
    if(cur.length>=2){
      const ts=new Set(); cur.forEach(d=>byDraw.get(d).forEach(t=>ts.add(t)));
      if(ts.size>=2) groups.push({sources:[...cur],triples:[...ts].sort(),combos:cur.map(d=>comboBy.get(d))});
    }
  }
  for(const d of draws){
    if(!cur.length || d===cur.at(-1)+1) cur.push(d); else {flush(); cur=[d];}
  }
  flush(); return groups;
}

function dedupRaw(list){
  const map=new Map(); for(const x of list) map.set(`${x.source_draw}|${x.triple}`,x); return [...map.values()].sort((a,b)=>a.source_draw-b.source_draw||a.triple.localeCompare(b.triple));
}
function uniqueOrder(arr){ const out=[]; for(const x of arr) if(x && !out.includes(x)) out.push(x); return out; }
function normalizeCycleFacts(xs){ return (xs||[]).map(x=>Array.isArray(x)?{draw:x[0],date:x[1],time:x[2],combo:x[3]}:x); }

export function hydrateSeed(seed){
  const m=structuredClone(seed.methodState||{});
  m.m1ActiveBases ||= []; m.m2OpenWindows ||= []; m.m2Ready ||= []; m.m3Live ||= []; m.prev15 ||= [];
  m.serialActive ||= []; m.serialStreaks ||= {}; m.birthHistory ||= {};
  m.m4 ||= {anchor:null,cycleFacts:[],links:[],counts:{},leaders:[],leaderLinks:0};
  m.m4.cycleFacts=normalizeCycleFacts(m.m4.cycleFacts);
  m.leader20 ||= {counts:Object.fromEntries(TARGETS.map(t=>[t,0])),leaders:[],max_count:0};
  m.currentForecast ||= {FINAL:[]};
  return {facts:structuredClone(seed.facts||[]), methodState:m, mirrorExactCounts:seed.mirrorExactCounts||{}, archive20:structuredClone(seed.archive20||[]), appVersion:seed.appVersion||'0.1.0'};
}

export function processFact(appState, fact){
  const S=structuredClone(appState), ms=S.methodState;
  const current={...fact,combo:String(fact.combo).padStart(3,'0')};
  const oldForecast=ms.currentForecast||{};
  const oldFinal=uniqueOrder([...(oldForecast.M1||[]),...(oldForecast.M2_ready||[]),...(oldForecast.M3||[]),...(oldForecast.serial_leader||[]),...(oldForecast.M6_REPEAT_FAMILY_150||[])]);
  const oldM6=[...(ms.currentForecast?.M6_REPEAT_FAMILY_150||[])];
  const check=oldFinal.includes(current.combo)?'HIT':oldFinal.length?'MISS':'NO SIGNAL';
  const m6Check=oldM6.includes(current.combo)?'HIT':oldM6.length?'MISS':'NO SIGNAL';

  S.facts.push(current);
  const m5=computeM5ForNext(S.facts), occupied=new Set(m5.occupied);
  const currentOccupied=occupied.has(current.draw);

  const oldBases=ms.m1ActiveBases||[], agedBases=[];
  for(const b of oldBases){ const rem=Number(b.rem)-1; if(rem>0) agedBases.push({...b,rem}); }
  let m1Raw=[], m1Blocks=[];
  if(!currentOccupied){
    for(const b of oldBases){
      if(occupied.has(b.draw)) continue;
      const r=pairRaw(b.combo,current.combo);
      if(r.block) m1Blocks.push({source_draw:b.draw,source_combo:b.combo,exact:r.block});
      else for(const [tr,paths] of Object.entries(r.raw)) m1Raw.push({method:'M1',source_draw:b.draw,source_combo:b.combo,triple:tr,paths});
    }
  }
  m1Raw=dedupRaw(m1Raw);

  const carried=[];
  for(const br of (ms.m3Live||[])){
    if(br.position==='1/2 NEW' && current.combo!==br.triple) carried.push({...br,position:'2/2 LAST'});
  }
  let m3Raw=[], m3Blocks=[];
  if(!currentOccupied){
    for(const [sd,sc] of (ms.prev15||[])){
      if(occupied.has(sd)) continue;
      const r=pairRaw(sc,current.combo);
      if(r.block) m3Blocks.push({source_draw:sd,source_combo:sc,exact:r.block});
      else for(const [tr,paths] of Object.entries(r.raw)) m3Raw.push({method:'M3',source_draw:sd,source_combo:sc,triple:tr,paths});
    }
  }
  m3Raw=dedupRaw(m3Raw);

  const rawUnion=dedupRaw([...m1Raw,...m3Raw].map(x=>({...x,method:'U'})));
  const packages=packageGroups(rawUnion), affected=new Set(packages.flatMap(g=>g.sources));
  const m1Signals=uniqueOrder(m1Raw.filter(x=>!affected.has(x.source_draw)).map(x=>x.triple));
  if(packages.length && !m1Signals.includes('000')) m1Signals.push('000');

  const newM3=m3Raw.filter(x=>!affected.has(x.source_draw)).map(x=>({triple:x.triple,position:'1/2 NEW',source_pair:`${x.source_combo}+${current.combo}`,source_draw:x.source_draw,born_draw:current.draw}));
  if(packages.length) newM3.push({triple:'000',position:'1/2 NEW',source_pair:'PACKAGE',source_draw:Math.min(...affected),born_draw:current.draw});
  ms.m3Live=[...carried,...newM3];
  ms.prev15=[...(ms.prev15||[]).slice(-14),[current.draw,current.combo]];

  ms.m2Ready=(ms.m2Ready||[]).map(x=>({...x,rem:Number(x.rem)-1})).filter(x=>x.rem>0);
  ms.m2OpenWindows=(ms.m2OpenWindows||[]).map(x=>({...x,rem:Number(x.rem)-1})).filter(x=>x.rem>0);
  const cf=family(current.combo), kept=[];
  if(!currentOccupied){
    for(const w of ms.m2OpenWindows){
      if(occupied.has(w.opened_draw)){ kept.push(w); continue; }
      if(cf===w.waiting_family && current.draw>w.opened_draw) ms.m2Ready.push({triple:w.triple,rem:2,born_draw:current.draw});
      else kept.push(w);
    }
    ms.m2OpenWindows=kept;
    for(const [tr,[a,b]] of Object.entries(M2)){
      if(cf===a) ms.m2OpenWindows.push({triple:tr,opened_draw:current.draw,opened_combo:current.combo,waiting_family:b,rem:15});
      else if(cf===b) ms.m2OpenWindows.push({triple:tr,opened_draw:current.draw,opened_combo:current.combo,waiting_family:a,rem:15});
    }
  }

  let births;
  if(packages.length){ const b=new Set(rawUnion.filter(x=>!affected.has(x.source_draw)).map(x=>x.triple)); b.add('000'); births=[...b].sort(); }
  else births=[...new Set(rawUnion.map(x=>x.triple))].sort();
  ms.serialActive=(ms.serialActive||[]).map(x=>({...x,rem:Number(x.rem)-1})).filter(x=>x.rem>0);
  if(births.length){
    const next={}; for(const tr of births) next[tr]=(ms.serialStreaks?.[tr]||0)+1; ms.serialStreaks=next;
    for(const [tr,n] of Object.entries(next)) if(n>=2){ const found=ms.serialActive.find(x=>x.triple===tr); if(found) found.rem=5; else ms.serialActive.push({triple:tr,rem:5}); }
  } else ms.serialStreaks={};

  const drop=current.draw-20, lc={...(ms.leader20?.counts||{})};
  for(const t of TARGETS) if(lc[t]==null) lc[t]=0;
  for(const tr of (ms.birthHistory?.[String(drop)]||[])) lc[tr]=Math.max(0,(lc[tr]||0)-1);
  for(const tr of births) lc[tr]=(lc[tr]||0)+1;
  ms.birthHistory[String(current.draw)]=births;
  const lmax=Math.max(...Object.values(lc));
  ms.leader20={counts:lc,leaders:TARGETS.filter(t=>lc[t]===lmax),max_count:lmax,window:`${current.draw-19}..${current.draw}`};

  const mc=S.mirrorExactCounts[mirror(current.combo)]||0;
  if(mc>0) agedBases.push({draw:current.draw,combo:current.combo,rem:15});
  ms.m1ActiveBases=agedBases;

  const m4=ms.m4, cycleFacts=normalizeCycleFacts(m4.cycleFacts), m4New=[];
  if(isTriple(current.combo)){
    m4.anchor=current; m4.cycleFacts=[]; m4.links=[]; m4.counts={}; m4.leaders=[]; m4.leaderLinks=0;
  } else {
    const currentFam=family(current.combo);
    if(!currentOccupied){
      for(const src of cycleFacts){
        if(occupied.has(src.draw)) continue;
        for(const tr of TARGETS){
          const add=addCombo(src.combo,tr);
          if(family(add)===currentFam){
            const link={triple:tr,source_draw:src.draw,source_combo:src.combo,add_combo:add,fact_draw:current.draw,fact_combo:current.combo,lag:current.draw-src.draw};
            m4New.push(link); (m4.counts[tr]??=0); m4.counts[tr]++; m4.links.push(link);
          }
        }
      }
    }
    m4.cycleFacts.push(current);
    const values=Object.values(m4.counts||{}); const top=values.length?Math.max(...values):0;
    m4.leaderLinks=top; m4.leaders=top?TARGETS.filter(t=>(m4.counts[t]||0)===top):[];
  }

  const m6=computeM6Strict(S.facts);
  const m2Signals=uniqueOrder(ms.m2Ready.map(x=>x.triple));
  const m3Signals=uniqueOrder(ms.m3Live.map(x=>x.triple));
  const serialSignals=uniqueOrder(ms.serialActive.map(x=>x.triple));
  const core=uniqueOrder([...m1Signals,...m2Signals,...m3Signals,...serialSignals]);
  const final=uniqueOrder([...core,...m6.signal]);
  const nxt=add30(current.date,current.time);
  ms.currentForecast={draw:current.draw+1,date:nxt.date,time:nxt.time,M1:m1Signals,M2_ready:m2Signals,M3:m3Signals,serial_leader:serialSignals,
    M4_leaders:[...(m4.leaders||[])],M4_IN_FINAL:false,M5_BURST:m5.main?'MAIN':m5.reserve?'RESERVE':'NO SIGNAL',M6_REPEAT_FAMILY_1000:m6.signal,M6_REPEAT_FAMILY_150:m6.signal,FINAL_CORE:core,FINAL:final,
    status:final.length?'FROZEN':'NO VALID NUMERIC SIGNAL'};

  const result=check==='HIT'?'✅ HIT':check==='MISS'?'❌ мимо':'сигнала не было';
  S.archive20=[...(S.archive20||[]).slice(-19),[current.draw,current.date,current.time,current.combo,oldFinal.length?oldFinal.join(' / '):'—',result,final.length?final.join(' / '):'—']];

  return {state:S,audit:{oldFinal,check,oldM6,m6Check,m5,m6,m1Signals,m1Blocks,m2Signals,m3Signals,m3Blocks,serialSignals,m4New,m4Leaders:m4.leaders||[],births,packages,mirrorCount:mc,mirror:mirror(current.combo),core,final,next:nxt}};
}

export function analyzeFamilyRepeats150(facts){
  const window=facts.slice(-1000);
  const current=facts.at(-1)||null;
  const groups=new Map();
  for(const x of window){ const f=family(x.combo); if(!groups.has(f)) groups.set(f,[]); groups.get(f).push(x); }
  const rows=[];
  for(const [f,occurrences] of groups.entries()){
    if(occurrences.length<2) continue;
    const gaps=[]; for(let i=1;i<occurrences.length;i++) gaps.push(occurrences[i].draw-occurrences[i-1].draw);
    const details=familySelfDetails(f);
    rows.push({family:f,count:occurrences.length,occurrences,gaps,last:occurrences.at(-1),first:occurrences[0],current:current?family(current.combo)===f:false,status:occurrences.length===2?'WAIT THIRD':'THIRD+',selfSignal:Object.keys(details).sort(),selfDetails:details});
  }
  rows.sort((a,b)=>b.count-a.count || b.last.draw-a.last.draw || a.family.localeCompare(b.family));
  const currentFamily=current?family(current.combo):null;
  const currentOccurrences=currentFamily?(groups.get(currentFamily)||[]):[];
  return {window,start:window[0]||null,end:window.at(-1)||null,rows,repeat2plus:rows.length,repeat3plus:rows.filter(x=>x.count>=3).length,currentFamily,currentCount:currentOccurrences.length,currentOccurrences};
}

export function analyzeM6Window(facts, n=20){
  const slice=facts.slice(-n); const out=[];
  for(let i=facts.length-slice.length;i<facts.length;i++){
    const prefix=facts.slice(0,i+1), r=computeM6Strict(prefix);
    out.push({draw:facts[i].draw,combo:facts[i].combo,family:r.family,count:r.count,signal:r.signal});
  }
  return out;
}