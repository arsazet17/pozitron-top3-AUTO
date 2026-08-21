import {METHODS,METHOD_DEF} from "./core.js";
import {searchFirst} from "./search.js";

const count=(arr)=>{const m=new Map();for(const x of arr)m.set(x,(m.get(x)||0)+1);return m};
const keys=m=>[...m.keys()];
const max=(arr,fn)=>Math.max(...arr.map(fn));
const min=(arr,fn)=>Math.min(...arr.map(fn));

function searchExact(source,seqs){
  const L=source.length,cont=[];
  if(!L)return {L:null,cont};
  for(const seq of seqs){
    for(let i=0;i<=seq.length-L-1;i++){
      let ok=true;
      for(let j=0;j<L;j++)if(seq[i+j]!==source[j]){ok=false;break;}
      if(ok)cont.push(seq[i+L]);
    }
  }
  return {L,cont};
}

function rerunAll(sourceVH,pools,drop,{exact=false}={}){
  const total=new Map();
  for(const m of METHODS){
    const d=METHOD_DEF[m], src=sourceVH[d.source].slice(drop);
    const h=exact?searchExact(src,pools[d.target]):searchFirst(src,pools[d.target]);
    for(const x of h.cont)total.set(x,(total.get(x)||0)+1);
  }
  return total;
}

function rerunPerMethodExact(methods,sourceVH,pools,round){
  const total=new Map();
  for(const m of METHODS){
    const d=METHOD_DEF[m], L=(methods[m].L||0)-round;
    if(L<1)continue;
    const src=sourceVH[d.source].slice(-L);
    const h=searchExact(src,pools[d.target]);
    for(const x of h.cont)total.set(x,(total.get(x)||0)+1);
  }
  return total;
}

function baseStats(methods){
  const coverage=new Map(), total=new Map(), depth=new Map();
  for(const m of METHODS){
    const uniq=new Set(methods[m].cont);
    for(const d of uniq){
      coverage.set(d,(coverage.get(d)||0)+1);
      depth.set(d,(depth.get(d)||0)+(methods[m].L||0));
    }
    for(const d of methods[m].cont)total.set(d,(total.get(d)||0)+1);
  }
  return {coverage,total,depth,digits:keys(total)};
}

function selectV1(methods,sourceVH,pools,stats){
  const {coverage,total,depth,digits}=stats;
  let c=digits.filter(d=>coverage.get(d)===max(digits,x=>coverage.get(x)));
  if(c.length>1){const q=max(c,x=>total.get(x));c=c.filter(x=>total.get(x)===q)}
  if(c.length>1){const q=max(c,x=>depth.get(x));c=c.filter(x=>depth.get(x)===q)}
  for(let drop=1;drop<=3&&c.length>1;drop++){
    const rr=rerunAll(sourceVH,pools,drop),q=max(c,x=>rr.get(x)||0);
    c=c.filter(x=>(rr.get(x)||0)===q);
  }
  return Math.min(...c);
}

function selectStandard(methods,sourceVH,pools){
  const stats=baseStats(methods),{coverage,total,digits}=stats;
  if(!digits.length)return [null,null,null,null];
  const v1=selectV1(methods,sourceVH,pools,stats);

  let c=digits.filter(d=>total.get(d)===max(digits,x=>total.get(x)));
  for(let drop=1;drop<=3&&c.length>1;drop++){
    const rr=rerunAll(sourceVH,pools,drop),q=max(c,x=>rr.get(x)||0);
    c=c.filter(x=>(rr.get(x)||0)===q);
  }
  const v2=Math.min(...c);

  c=digits.filter(d=>coverage.get(d)===min(digits,x=>coverage.get(x)));
  if(c.length>1){const q=min(c,x=>total.get(x));c=c.filter(x=>total.get(x)===q)}
  for(let drop=1;drop<=3&&c.length>1;drop++){
    const rr=rerunAll(sourceVH,pools,drop),q=min(c,x=>rr.get(x)||0);
    c=c.filter(x=>(rr.get(x)||0)===q);
  }
  const v3=Math.min(...c);

  let hh=count(methods.HH.cont),gg=keys(hh).filter(d=>hh.get(d)===max(keys(hh),x=>hh.get(x)));
  for(let drop=1;drop<=3&&gg.length>1;drop++){
    const h=searchFirst(sourceVH.H.slice(drop),pools.H),cc=count(h.cont);
    if(cc.size){const q=max(keys(cc),x=>cc.get(x));gg=keys(cc).filter(x=>cc.get(x)===q)}
  }
  const g=gg.length?Math.min(...gg):null;
  return [v1,v2,v3,g];
}

function selectNumbers(methods,sourceVH,pools){
  const stats=baseStats(methods),{coverage,total,digits}=stats;
  if(!digits.length)return [null,null,null,null];
  const v1=selectV1(methods,sourceVH,pools,stats);

  // NUMBERS V2: after an initial raw-frequency tie, each route is shortened
  // exactly one level from the route's own usedLen. No hidden fall-through to
  // a shorter length inside the same round. Only the tied leaders compete.
  let c=digits.filter(d=>total.get(d)===max(digits,x=>total.get(x)));
  for(let round=1;round<=5&&c.length>1;round++){
    const rr=rerunPerMethodExact(methods,sourceVH,pools,round);
    const q=max(c,x=>rr.get(x)||0);
    c=c.filter(x=>(rr.get(x)||0)===q);
  }
  const v2=Math.min(...c);

  // NUMBERS V3 is the rare contour. A missing continuation on the exact
  // shortened level counts as zero, therefore it remains the rarest result.
  c=digits.filter(d=>coverage.get(d)===min(digits,x=>coverage.get(x)));
  if(c.length>1){const q=min(c,x=>total.get(x));c=c.filter(x=>total.get(x)===q)}
  for(let drop=1;drop<=3&&c.length>1;drop++){
    const rr=rerunAll(sourceVH,pools,drop,{exact:true}),q=min(c,x=>rr.get(x)||0);
    c=c.filter(x=>(rr.get(x)||0)===q);
  }
  const v3=Math.min(...c);

  // NUMBERS GG: only HH participates. If HH is tied, shorten from HH's own
  // usedLen by exact -1 rounds and rerank the whole HH continuation set.
  let hh=count(methods.HH.cont);
  if(!hh.size)return [v1,v2,v3,null];
  let gg=keys(hh).filter(d=>hh.get(d)===max(keys(hh),x=>hh.get(x)));
  for(let round=1;round<=6&&gg.length>1;round++){
    const L=(methods.HH.L||0)-round;
    if(L<1)break;
    const h=searchExact(sourceVH.H.slice(-L),pools.H),cc=count(h.cont);
    if(!cc.size)continue;
    const all=keys(cc),q=max(all,x=>cc.get(x));
    gg=all.filter(x=>cc.get(x)===q);
  }
  const g=gg.length?Math.min(...gg):null;
  return [v1,v2,v3,g];
}

export function selectVariants(methods,sourceVH,pools,options={}){
  return options.mode==="numbers"
    ? selectNumbers(methods,sourceVH,pools)
    : selectStandard(methods,sourceVH,pools);
}
