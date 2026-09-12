/* TOP-3 · Тройни M1/M2/M3 · правила синхронизированы с чатом «🔮🔮Топ тройни🔮🔮». */

export const TRIPLE_CHAT_RULE_CODE = "TOP3-3METHODS-CHAT-12.09.2026";
export const TRIPLE_CHAT_SEED_ID = 267958;

export const M2_MAP = Object.freeze({
  "000":["757","353"], "111":["930","170"], "222":["560","540"], "333":["487","623"], "444":["375","735"],
  "555":["561","549"], "666":["409","601"], "777":["847","263"], "888":["741","369"], "999":["482","628"]
});

const SEED_ROWS = [
  [267939,"2026-09-12","09:25","345","222 / 555 / 999","❌ мимо и истёк","—"],
  [267940,"2026-09-12","09:55","388","—","сигнала не было","—"],
  [267941,"2026-09-12","10:25","799","—","сигнала не было","999"],
  [267942,"2026-09-12","10:55","641","999","❌ мимо","333 / 666 / 999"],
  [267943,"2026-09-12","11:25","968","333 / 666 / 999","❌ мимо","333 / 666"],
  [267944,"2026-09-12","11:55","938","333 / 666","❌ мимо","888"],
  [267945,"2026-09-12","12:25","678","888","❌ мимо","111 / 888"],
  [267946,"2026-09-12","12:55","572","111 / 888","❌ мимо","111 / 777"],
  [267947,"2026-09-12","13:25","956","111 / 777","❌ мимо","777"],
  [267948,"2026-09-12","13:55","729","777","❌ мимо и истёк","333 / 444 / 999"],
  [267949,"2026-09-12","14:25","752","333 / 444 / 999","❌ мимо","333 / 444 / 777 / 999"],
  [267950,"2026-09-12","14:55","158","333 / 444 / 777 / 999","❌ мимо","444 / 777"],
  [267951,"2026-09-12","15:25","003","444 / 777","❌ мимо и истёк","—"],
  [267952,"2026-09-12","15:55","151","—","сигнала не было","—"],
  [267953,"2026-09-12","16:25","679","—","сигнала не было","555"],
  [267954,"2026-09-12","16:55","257","555","❌ мимо","444 / 555"],
  [267955,"2026-09-12","17:25","915","444 / 555","❌ мимо","444"],
  [267956,"2026-09-12","17:55","267","444","❌ мимо и истёк","555"],
  [267957,"2026-09-12","18:25","268","555","❌ мимо","555 / 777"],
  [267958,"2026-09-12","18:55","008","555 / 777","❌ мимо","777"]
];

const SEED_BIRTHS = new Map([
  [267939,[]],[267940,[]],[267941,["999"]],[267942,["333","666"]],[267943,[]],[267944,["888"]],[267945,["111"]],
  [267946,["777"]],[267947,[]],[267948,["333","444","999"]],[267949,["444","777"]],[267950,[]],[267951,[]],[267952,[]],
  [267953,["555"]],[267954,["444"]],[267955,[]],[267956,["555"]],[267957,["777"]],[267958,[]]
]);

const SEED_M1_BASES = [
  {id:267944,code:"938",rem:1},{id:267947,code:"956",rem:4},{id:267948,code:"729",rem:5},{id:267950,code:"158",rem:7},
  {id:267951,code:"003",rem:8},{id:267952,code:"151",rem:9},{id:267953,code:"679",rem:10},{id:267954,code:"257",rem:11},
  {id:267955,code:"915",rem:12},{id:267956,code:"267",rem:13},{id:267957,code:"268",rem:14},{id:267958,code:"008",rem:15}
];

const SEED_STATE = {
  m1Bases: SEED_M1_BASES,
  m1Forecast: [],
  m2Windows: [{triple:"999",waitSig:"248",waitFamily:"482",openedBy:267957,openedCode:"268",rem:14}],
  m2Ready: [],
  m3: [{triple:"777",stage:2,sourceId:267955,sourceCode:"915",bornCode:"268",bornAt:267957}],
  packageForecast: [],
  frozen: ["777"],
  birthsWindow: SEED_ROWS.map(r=>({id:r[0],births:[...(SEED_BIRTHS.get(r[0])||[])]})),
  archive: SEED_ROWS.map(r=>({id:r[0],date:r[1],time:r[2],fact:r[3],before:r[4],check:r[5],after:r[6]})),
  diag: {blocks:[],raw:[],packages:[],dependency:[],mirror:"002",mirrorPass:true,mirrorHits:null,m2Events:[]}
};

const MIRROR = Object.freeze({0:0,1:9,2:8,3:7,4:6,5:5,6:4,7:3,8:2,9:1});
const pairCache = new Map();
let cachedEarlyCombos = null;
let cachedEarlyCount = -1;
let cachedEarlyCounts = null;

function padCode(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
function sig(v){return padCode(v).split("").sort().join("")}
function mirror(v){return padCode(v).split("").map(x=>MIRROR[+x]).join("")}
function add(a,b){a=padCode(a);b=padCode(b);return a.split("").map((x,i)=>(+x + +b[i])%10).join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function tripleSort(a,b){return +a[0]-+b[0]}
function uniq(a){return [...new Set(a)].sort(tripleSort)}
function cloneState(){return JSON.parse(JSON.stringify(SEED_STATE))}

function perms(v){
  const x=padCode(v).split(""),out=new Set();
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)out.add(x[i]+x[j]+x[k]);
  return [...out];
}

export function pairEval(a,b){
  a=padCode(a);b=padCode(b);const key=a+"|"+b;
  if(pairCache.has(key))return pairCache.get(key);
  const exact=add(a,b);
  if(isTriple(exact)){
    const z={exact,blocked:true,triples:[],paths:[]};pairCache.set(key,z);return z;
  }
  const triples=new Set(),paths=[];
  for(const pa of perms(a))for(const pb of perms(b)){
    if(pa===a&&pb===b)continue;
    const s=add(pa,pb);
    if(isTriple(s)){
      triples.add(s);
      if(paths.length<12)paths.push(`${pa}+${pb}→${s}`);
    }
  }
  const z={exact,blocked:false,triples:[...triples].sort(tripleSort),paths};
  pairCache.set(key,z);return z;
}

function chronological(records=[]){
  return records
    .map(r=>({id:Number(r.draw),date:r.date,time:r.time,code:String(r.combo??`${r.A}${r.B}${r.C}`)}))
    .filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code))
    .sort((a,b)=>a.id-b.id);
}

function earlyCounts(fullArchive){
  const combos=fullArchive?.combos||[];
  const count=Math.max(0,Number(fullArchive?.undatedCount ?? (Number(fullArchive?.datedFromDraw||0)-Number(fullArchive?.fromDraw||0))));
  if(cachedEarlyCombos===combos&&cachedEarlyCount===count&&cachedEarlyCounts)return cachedEarlyCounts;
  const m=new Map();
  for(let i=0;i<Math.min(count,combos.length);i++){
    const c=String(combos[i]);m.set(c,(m.get(c)||0)+1);
  }
  cachedEarlyCombos=combos;cachedEarlyCount=count;cachedEarlyCounts=m;
  return m;
}

function mirrorGate(c,counts,earlierReal){
  const mc=mirror(c);let hits=counts.get(mc)||0;
  for(const d of earlierReal)if(d.code===mc)hits++;
  return {mirror:mc,pass:hits>0,hits};
}

function m2SidesBySig(){
  const out=new Map();
  for(const [triple,[a,b]] of Object.entries(M2_MAP))for(const [side,other] of [[a,b],[b,a]]){
    const s=sig(side);if(!out.has(s))out.set(s,[]);
    out.get(s).push({triple,side,waitSig:sig(other),waitFamily:other});
  }
  return out;
}
const M2_SIDES=m2SidesBySig();

function packageGroups(raw,indexById){
  const bySource=new Map();
  for(const r of raw){if(!bySource.has(r.sourceId))bySource.set(r.sourceId,new Set());bySource.get(r.sourceId).add(r.triple)}
  const ids=[...bySource.keys()].sort((a,b)=>(indexById.get(a)??0)-(indexById.get(b)??0));
  const groups=[];let g=[];
  const flush=()=>{
    if(g.length>=2){const ts=new Set(g.flatMap(id=>[...bySource.get(id)]));if(ts.size>=2)groups.push({ids:[...g],triples:ts})}
    g=[];
  };
  for(const id of ids){
    if(!g.length){g=[id];continue}
    const p=g[g.length-1];
    if((indexById.get(id)??-99)===(indexById.get(p)??-99)+1)g.push(id);else{flush();g=[id]}
  }
  flush();return groups;
}

function fmtList(a){return a&&a.length?uniq(a).join(" / "):"—"}

function processForward(state,current,allReal,counts){
  const before=[...state.frozen],fact=current.code;
  const check=!before.length?"сигнала не было":before.includes(fact)?"✅ HIT":"❌ мимо";
  const older=allReal.filter(d=>d.id<current.id),idxMap=new Map(allReal.map((d,i)=>[d.id,i])),previous15=older.slice(-15);
  const diag={blocks:[],raw:[],packages:[],dependency:[],mirror:"",mirrorPass:false,mirrorHits:0,m2Events:[]};

  const carriedM3=[];
  for(const b of state.m3)if(b.stage===1)carriedM3.push({...b,stage:2});
  const carriedReady=[];
  for(const b of state.m2Ready)if(b.stage===1)carriedReady.push({...b,stage:2});

  const fam=sig(fact),newReady=[],windows=[];
  for(const w of state.m2Windows){
    if(fam===w.waitSig){
      newReady.push({triple:w.triple,stage:1,openedBy:w.openedBy,closedBy:current.id});
      diag.m2Events.push(`${w.triple}: окно закрыто фактом ${fact} → READY 1/2`);
    }else if(w.rem>1)windows.push({...w,rem:w.rem-1});
    else diag.m2Events.push(`${w.triple}: окно истекло`);
  }
  for(const side of M2_SIDES.get(fam)||[]){
    windows.push({triple:side.triple,waitSig:side.waitSig,waitFamily:side.waitFamily,openedBy:current.id,openedCode:fact,rem:15});
    diag.m2Events.push(`${side.triple}: OPEN, ждём family ${side.waitFamily}, rem15`);
  }

  const rawM1=[];
  for(const base of state.m1Bases){
    const ev=pairEval(base.code,fact);
    if(ev.blocked){diag.blocks.push(`M1 ${base.code}+${fact}=${ev.exact} BLOCK`);continue}
    for(const t of ev.triples)rawM1.push({method:"M1",triple:t,sourceId:base.id,sourceCode:base.code,exact:ev.exact});
  }

  const rawM3=[];
  for(const src of previous15){
    const ev=pairEval(src.code,fact);
    if(ev.blocked){diag.blocks.push(`M3 ${src.code}+${fact}=${ev.exact} BLOCK`);continue}
    for(const t of ev.triples)rawM3.push({method:"M3",triple:t,sourceId:src.id,sourceCode:src.code,exact:ev.exact});
  }

  const unionRaw=[],seenRaw=new Set();
  for(const r of [...rawM1,...rawM3]){
    const k=`${r.sourceId}|${r.triple}`;
    if(!seenRaw.has(k)){seenRaw.add(k);unionRaw.push(r)}
  }
  diag.raw=unionRaw.map(r=>`${r.sourceCode}→${r.triple} (${r.exact})`);

  const pGroups=packageGroups(unionRaw,idxMap),packSourceIds=new Set();
  for(const g of pGroups){
    for(const id of g.ids)packSourceIds.add(id);
    const parts=[];
    for(const id of g.ids){
      const rs=unionRaw.filter(x=>x.sourceId===id),r=rs[0];
      parts.push(`${r?.sourceCode||id}→${uniq(rs.map(x=>x.triple)).join("/")}`);
    }
    diag.packages.push(`000 [пакет подряд: ${parts.join("; ")}]`);
  }

  const normalM1=rawM1.filter(r=>!packSourceIds.has(r.sourceId));
  const normalM3=rawM3.filter(r=>!packSourceIds.has(r.sourceId));
  const m1Forecast=uniq(normalM1.map(r=>r.triple));
  const newM3=[],m3Dedup=new Set();
  for(const r of normalM3){
    const k=`${r.sourceId}|${r.triple}`;
    if(m3Dedup.has(k))continue;
    m3Dedup.add(k);
    newM3.push({triple:r.triple,stage:1,sourceId:r.sourceId,sourceCode:r.sourceCode,bornCode:fact,bornAt:current.id});
  }
  const packages=pGroups.length?["000"]:[];

  for(const r of normalM1){
    if(normalM3.some(x=>x.sourceId===r.sourceId&&x.triple===r.triple))diag.dependency.push(`${r.triple}: M1/M3 same-source ${r.sourceCode}+${fact}`);
  }

  const births=[];
  if(packages.length)births.push("000");
  for(const r of [...normalM1,...normalM3])if(!births.includes(r.triple))births.push(r.triple);
  for(const r of newReady)if(!births.includes(r.triple))births.push(r.triple);

  const nextBases=state.m1Bases.map(b=>({...b,rem:b.rem-1})).filter(b=>b.rem>0);
  const gate=mirrorGate(fact,counts,older);
  diag.mirror=gate.mirror;diag.mirrorPass=gate.pass;diag.mirrorHits=gate.hits;
  if(gate.pass)nextBases.push({id:current.id,code:fact,rem:15});

  const m2Ready=[...carriedReady,...newReady];
  const m3=[...carriedM3,...newM3];
  const frozen=uniq([...packages,...m1Forecast,...m2Ready.map(x=>x.triple),...m3.map(x=>x.triple)]);
  let checkText=check;
  if(check==="❌ мимо"&&before.length&&frozen.length===0)checkText+=" и истёк";

  Object.assign(state,{m1Bases:nextBases,m1Forecast,m2Windows:windows,m2Ready,m3,packageForecast:packages,frozen,diag});
  state.archive.push({id:current.id,date:current.date,time:current.time,fact,before:fmtList(before),check:checkText,after:fmtList(frozen)});
  state.archive=state.archive.slice(-20);
  state.birthsWindow.push({id:current.id,births:uniq(births)});
  state.birthsWindow=state.birthsWindow.slice(-20);
  return state;
}

function leader(state){
  const counts=Object.fromEntries(Array.from({length:10},(_,i)=>[`${i}${i}${i}`,0]));
  for(const row of state.birthsWindow)for(const t of row.births||[])if(t in counts)counts[t]++;
  const max=Math.max(...Object.values(counts));
  return {counts,max,leaders:Object.entries(counts).filter(([,n])=>n===max&&max>0).map(([t])=>t)};
}

export function computeTripleChat(records=[],fullArchive=null){
  const real=chronological(records);
  if(!real.length)return {ruleCode:TRIPLE_CHAT_RULE_CODE,seedAhead:true,last:null,state:cloneState(),snapshot:null};
  const last=real.at(-1),state=cloneState(),counts=earlyCounts(fullArchive);
  if(last.id>=TRIPLE_CHAT_SEED_ID){
    const future=real.filter(x=>x.id>TRIPLE_CHAT_SEED_ID);
    for(const d of future)processForward(state,d,real.filter(x=>x.id<=d.id),counts);
  }
  const L=leader(state);
  const frequency=Object.entries(L.counts).map(([triple,count])=>({triple,count})).sort((a,b)=>b.count-a.count||tripleSort(a.triple,b.triple));
  return {
    ruleCode:TRIPLE_CHAT_RULE_CODE,
    seedAhead:last.id<TRIPLE_CHAT_SEED_ID,
    last,
    state,
    snapshot:{
      m1:state.m1Forecast,
      m2:state.m2Ready,
      m3:state.m3,
      windows:state.m2Windows,
      packages:state.packageForecast,
      frozen:state.frozen,
      diag:state.diag,
      leader:L,
      frequency,
      archive:state.archive,
      birthsWindow:state.birthsWindow
    }
  };
}
