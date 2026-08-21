import {METHODS,METHOD_DEF} from "./core.js";
import {searchFirst} from "./search.js";
const count=(arr)=>{const m=new Map();for(const x of arr)m.set(x,(m.get(x)||0)+1);return m};
const keys=m=>[...m.keys()];
function rerunAll(sourceVH,pools,drop){
  const total=new Map();
  for(const m of METHODS){
    const d=METHOD_DEF[m], src=sourceVH[d.source].slice(drop), h=searchFirst(src,pools[d.target]);
    for(const x of h.cont)total.set(x,(total.get(x)||0)+1);
  }
  return total;
}
export function selectVariants(methods,sourceVH,pools){
  const coverage=new Map(), total=new Map(), depth=new Map();
  for(const m of METHODS){
    const uniq=new Set(methods[m].cont);
    for(const d of uniq){coverage.set(d,(coverage.get(d)||0)+1);depth.set(d,(depth.get(d)||0)+(methods[m].L||0));}
    for(const d of methods[m].cont)total.set(d,(total.get(d)||0)+1);
  }
  const digits=keys(total); if(!digits.length)return [null,null,null,null];
  const max=(arr,fn)=>Math.max(...arr.map(fn)), min=(arr,fn)=>Math.min(...arr.map(fn));
  let c=digits.filter(d=>coverage.get(d)===max(digits,x=>coverage.get(x)));
  if(c.length>1){const q=max(c,x=>total.get(x));c=c.filter(x=>total.get(x)===q)}
  if(c.length>1){const q=max(c,x=>depth.get(x));c=c.filter(x=>depth.get(x)===q)}
  for(let drop=1;drop<=3&&c.length>1;drop++){const rr=rerunAll(sourceVH,pools,drop),q=max(c,x=>rr.get(x)||0);c=c.filter(x=>(rr.get(x)||0)===q)}
  const v1=Math.min(...c);
  c=digits.filter(d=>total.get(d)===max(digits,x=>total.get(x)));
  for(let drop=1;drop<=3&&c.length>1;drop++){const rr=rerunAll(sourceVH,pools,drop),q=max(c,x=>rr.get(x)||0);c=c.filter(x=>(rr.get(x)||0)===q)}
  const v2=Math.min(...c);
  c=digits.filter(d=>coverage.get(d)===min(digits,x=>coverage.get(x)));
  if(c.length>1){const q=min(c,x=>total.get(x));c=c.filter(x=>total.get(x)===q)}
  for(let drop=1;drop<=3&&c.length>1;drop++){const rr=rerunAll(sourceVH,pools,drop),q=min(c,x=>rr.get(x)||0);c=c.filter(x=>(rr.get(x)||0)===q)}
  const v3=Math.min(...c);
  let hh=count(methods.HH.cont), gg=keys(hh).filter(d=>hh.get(d)===max(keys(hh),x=>hh.get(x)));
  for(let drop=1;drop<=3&&gg.length>1;drop++){const h=searchFirst(sourceVH.H.slice(drop),pools.H),cc=count(h.cont);if(cc.size){const q=max(keys(cc),x=>cc.get(x));gg=keys(cc).filter(x=>cc.get(x)===q)}}
  const g=Math.min(...gg);
  return [v1,v2,v3,g];
}
