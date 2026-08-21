import {POSITIONS,METHODS,METHOD_DEF,parseDT,sortRecords} from "./core.js";
export function sourceChains(records,target,fieldPrefix=""){
  const t=new Date(`${target.date}T${target.time}:00+03:00`), before=sortRecords(records).filter(r=>parseDT(r)<t);
  const h=before.slice(-6), v=before.filter(r=>r.time===target.time).slice(-6), out={};
  for(const p of POSITIONS){
    const key=fieldPrefix+p; out[p]={H:h.map(r=>r[key]).filter(v=>v!==null&&v!==undefined),V:v.map(r=>r[key]).filter(v=>v!==null&&v!==undefined)};
  }
  return {chains:out,hRows:h,vRows:v};
}
export function buildPools(records,target,valueKind="num",excludeTargetDate=true){
  const t=new Date(`${target.date}T${target.time}:00+03:00`);
  const hist=sortRecords(records).filter(r=>parseDT(r)<t && (!excludeTargetDate || r.date<target.date));
  const pools={V:[],H:[]};
  for(const p of POSITIONS){
    const key=valueKind==="num"?p:"d"+p, byTime=new Map(), byDate=new Map();
    for(const r of hist){
      const val=r[key]; if(val===null||val===undefined)continue;
      if(!byTime.has(r.time))byTime.set(r.time,[]); byTime.get(r.time).push([parseDT(r),val]);
      if(!byDate.has(r.date))byDate.set(r.date,[]); byDate.get(r.date).push([parseDT(r),val]);
    }
    for(const arr of byTime.values()) pools.V.push(arr.sort((a,b)=>a[0]-b[0]).map(x=>x[1]));
    for(const arr of byDate.values()) pools.H.push(arr.sort((a,b)=>a[0]-b[0]).map(x=>x[1]));
  }
  return pools;
}
export function searchFirst(source,seqs,minLen=3){
  for(let L=source.length;L>=minLen;L--){
    const pat=source.slice(-L), cont=[];
    for(const seq of seqs){
      for(let i=0;i<=seq.length-L-1;i++){
        let ok=true; for(let j=0;j<L;j++)if(seq[i+j]!==pat[j]){ok=false;break;}
        if(ok)cont.push(seq[i+L]);
      }
    }
    if(cont.length)return {L,cont};
  }
  return {L:null,cont:[]};
}
export function methodsFor(sourceVH,pools){
  const out={};
  for(const m of METHODS){
    const d=METHOD_DEF[m], hit=searchFirst(sourceVH[d.source],pools[d.target]);
    out[m]={...hit,sourceKind:d.source,targetKind:d.target};
  }
  return out;
}
