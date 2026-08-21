import {POSITIONS,addDeltas,comboOf,mod10,sortRecords} from "./core.js";
import {sourceChains,buildPools,methodsFor} from "./search.js";
import {selectVariants} from "./select.js";
function transformed(methods,add=0){const o={};for(const [m,v] of Object.entries(methods))o[m]={...v,transformed:v.cont.map(x=>mod10(x+add))};return o}
export function computeMainForecast(records,target,rules){
  const r=addDeltas(records), numSrc=sourceChains(r,target,""), delSrc=sourceChains(r,target,"d");
  const pn=buildPools(r,target,"num",rules.search.excludeTargetDate), pd=buildPools(r,target,"delta",rules.search.excludeTargetDate);
  const before=sortRecords(r).filter(x=>new Date(`${x.date}T${x.time}:00+03:00`)<new Date(`${target.date}T${target.time}:00+03:00`));
  const last=before.at(-1); if(!last)throw new Error("Нет последнего факта");
  const blocks={TOP:{},DELTA:{},NUMBERS:{}};
  for(const p of POSITIONS){
    const m=methodsFor(numSrc.chains[p],pn), s=selectVariants(m,numSrc.chains[p],pn);
    blocks.TOP[p]={source:numSrc.chains[p],methods:transformed(m,0),selected:s};
    const md=methodsFor(delSrc.chains[p],pd), sd=selectVariants(md,delSrc.chains[p],pd).map(x=>x===null?null:mod10(x+last[p]));
    blocks.DELTA[p]={source:delSrc.chains[p],methods:transformed(md,last[p]),selected:sd};
    const mn=methodsFor(delSrc.chains[p],pn), sn=selectVariants(mn,delSrc.chains[p],pn,{mode:"numbers"}).map(x=>x===null?null:mod10(x+last[p]));
    blocks.NUMBERS[p]={source:delSrc.chains[p],methods:transformed(mn,last[p]),selected:sn};
  }
  const make=block=>[0,1,2,3].map(i=>POSITIONS.map(p=>block[p].selected[i]??"—").join(""));
  return {target,lastFact:comboOf(last),horizontal:numSrc.hRows.map(comboOf),vertical:numSrc.vRows.map(comboOf),
    TOP:make(blocks.TOP),DELTA:make(blocks.DELTA),NUMBERS:make(blocks.NUMBERS),details:blocks};
}
export function routeHits(forecast,fact){
  const out={A:[],B:[],C:[]}, actual={A:+fact[0],B:+fact[1],C:+fact[2]};
  for(const p of POSITIONS){
    for(const [blockName,block] of [["TOP",forecast.details.TOP],["DELTA",forecast.details.DELTA],["NUMBERS",forecast.details.NUMBERS]]){
      for(const [m,v] of Object.entries(block[p].methods))if(v.transformed.includes(actual[p]))out[p].push({block:blockName,method:m});
    }
  }
  return out;
}
export function applyFrozenRoutes(current,routes){
  const result={};
  for(const p of POSITIONS){
    if(!routes[p]?.length){result[p]=null;continue}
    const counts=new Map();
    for(const r of routes[p]){
      const vals=current.details[r.block][p].methods[r.method].transformed;
      for(const d of vals)counts.set(d,(counts.get(d)||0)+1);
    }
    if(!counts.size){result[p]=null;continue}
    const mx=Math.max(...counts.values()), c=[...counts].filter(x=>x[1]===mx).map(x=>x[0]);
    result[p]=Math.min(...c);
  }
  return result.A===null||result.B===null||result.C===null?null:`${result.A}${result.B}${result.C}`;
}
