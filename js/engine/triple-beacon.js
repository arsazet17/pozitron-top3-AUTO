export const TRIPLE_BEACON_RULE_CODE="TOP3-BEACON-NO-REUSE-V2-SYNC-19SEP2026";
export const TRIPLE_BEACON_WINDOW=50;
export const TRIPLE_BEACON_MAX_DISTANCE=20;

// Frozen watch matrix V2 — синхронизирована с Yulia TOP-3 v1.2.8.
// Эти type×distance дают отдельный сигнал «ТРОЙНЯ — ДА» и не входят в M1/M2/M3 Frozen.
const V2_FROZEN_SIGNAL_PATTERNS=Object.freeze([
 ["111",19],["666",2],["222",17],["999",20],["555",4],["888",4],["888",20],
 ["777",13],["222",16],["777",7],["999",14],["999",4],["555",6]
]);
const V2_FROZEN_SIGNAL_KEYS=new Set(V2_FROZEN_SIGNAL_PATTERNS.map(([t,d])=>`${t}|${d}`));

function code3(x){return String(x??"").padStart(3,"0").slice(-3)}
function exactTripleType(a,b){
 a=code3(a);b=code3(b);
 const d=[];
 for(let i=0;i<3;i++)d.push((Number(a[i])+Number(b[i]))%10);
 return d[0]===d[1]&&d[1]===d[2]?`${d[0]}${d[0]}${d[0]}`:null;
}

function buildNoReusePairs(windowCombos,firstDraw){
 const locked=new Set(),pairs=[];
 for(let i=0;i<windowCombos.length;i++){
  if(locked.has(i))continue;
  for(let j=i+1;j<windowCombos.length;j++){
   if(locked.has(j))continue;
   const type=exactTripleType(windowCombos[i],windowCombos[j]);
   if(!type)continue;
   locked.add(i);locked.add(j);
   pairs.push({
    sourcePos:i,secondPos:j,
    sourceDraw:Number(firstDraw)+i,secondDraw:Number(firstDraw)+j,
    source:code3(windowCombos[i]),second:code3(windowCombos[j]),type,
    distance:windowCombos.length-j
   });
   break;
  }
 }
 return pairs;
}

export function computeTripleBeacon(fullArchive){
 const combos=Array.isArray(fullArchive?.combos)?fullArchive.combos:[];
 if(!combos.length)return {ready:false,signal:false,status:"НЕТ ДАННЫХ",reason:"Полный архив не загружен",pairs:[],activePatterns:[],matched:[]};
 const n=Math.min(TRIPLE_BEACON_WINDOW,combos.length),start=combos.length-n;
 const windowCombos=combos.slice(start),firstDraw=Number(fullArchive.fromDraw||0)+start;
 const pairs=buildNoReusePairs(windowCombos,firstDraw);
 const activePatterns=pairs
  .filter(p=>p.distance>=1&&p.distance<=TRIPLE_BEACON_MAX_DISTANCE)
  .map(p=>({...p,key:`${p.type}|${p.distance}`}));
 const matched=activePatterns
  .filter(p=>V2_FROZEN_SIGNAL_KEYS.has(p.key))
  .sort((a,b)=>a.distance-b.distance||a.type.localeCompare(b.type));
 const nearest=pairs.length?[...pairs].sort((a,b)=>b.secondPos-a.secondPos||b.sourcePos-a.sourcePos)[0]:null;
 const typeCounts={};for(const p of pairs)typeCounts[p.type]=(typeCounts[p.type]||0)+1;
 let reason;
 if(!pairs.length)reason="В окне 50 нет разрешённых точных NO-REUSE схлопываний";
 else if(!matched.length)reason="Текущие type×distance не входят в frozen-набор V2";
 else reason=`Совпали: ${matched.map(x=>`${x.type} · дистанция ${x.distance} · ${x.source}+${x.second}→${x.type}`).join(" / ")}`;
 return {
  ready:true,signal:matched.length>0,status:matched.length?"СИГНАЛ: ТРОЙНЯ":"НЕТ СИГНАЛА",reason,
  pairs,activePatterns,matched,nearest,typeCounts,
  window:n,maxDistance:TRIPLE_BEACON_MAX_DISTANCE,frozenPatternCount:V2_FROZEN_SIGNAL_KEYS.size,
  frozenPatterns:V2_FROZEN_SIGNAL_PATTERNS,
  ruleCode:TRIPLE_BEACON_RULE_CODE
 };
}
