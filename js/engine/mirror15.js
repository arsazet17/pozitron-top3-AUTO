import {uniquePermutations,mirrorCombo,comboOf,sortRecords,mod10} from "./core.js";
export function mirrorSignalsForBase(base,fact){
  const out=[];
  for(const p of uniquePermutations(base.combo)){
    const x=[0,1,2].map(i=>mod10(+p[i] + +fact[i]));
    if(x[0]===x[1]&&x[1]===x[2])out.push({base:base.combo,permutation:p,triple:`${x[0]}${x[0]}${x[0]}`});
  }
  return out;
}
export function createMirrorState(records,rules,seedFrom="2026-08-19T04:40:00+03:00"){
  const historicalSet=new Set(records.map(comboOf));
  const s=sortRecords(records), start=new Date(seedFrom), work=s.filter(r=>new Date(`${r.date}T${r.time}:00+03:00`)>=start);
  let bases=[], lastSignals=[], lastCheck=null, prevFact=null;
  for(const r of work){
    const fact=comboOf(r), priorBases=bases.filter(b=>b.worked<rules.mirror.life), signals=[];
    for(const b of priorBases){signals.push(...mirrorSignalsForBase(b,fact));b.worked++}
    bases=priorBases.filter(b=>b.worked<rules.mirror.life);
    const mirror=mirrorCombo(fact,rules.mirror.map), perms=uniquePermutations(mirror), found=perms.filter(x=>historicalSet.has(x));
    if(found.length&&!bases.some(b=>b.combo===fact))bases.push({combo:fact,activatedAt:`${r.date} ${r.time}`,worked:0,life:rules.mirror.life,mirror,mirrorMatches:found});
    lastCheck={fact,previousPrediction:lastSignals,hit:lastSignals.some(x=>x.triple===fact),mirror,mirrorPermutations:perms,found,newBase:found.length?fact:null};
    lastSignals=signals; prevFact=fact;
  }
  return {bases,lastSignals,lastCheck,previousFact:prevFact};
}
export function nextMirrorPrediction(state,currentFact){
  const signals=[]; for(const b of state.bases)signals.push(...mirrorSignalsForBase(b,currentFact));
  return signals;
}
