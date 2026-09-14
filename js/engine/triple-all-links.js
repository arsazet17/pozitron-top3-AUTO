/* TOP-3 · таблица лидеров ОТ ТРОЙНИ · метод ВСЕХ связей. */

export const ALL_LINKS_RULE_CODE = "TOP3-ALL-LINKS-V1-14SEP2026-0255";
export const TRIPLES = Object.freeze(["111","222","333","444","555","666","777","888","999","000"]);

function padCode(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
function family(v){return padCode(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function chronological(records=[]){
  return records
    .map(r=>({id:Number(r.draw),date:String(r.date||""),time:String(r.time||""),code:padCode(r.combo??`${r.A}${r.B}${r.C}`)}))
    .filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code))
    .sort((a,b)=>a.id-b.id);
}
function complementFamily(source,triple){
  const target=Number(triple[0]),s=padCode(source);
  return family(s.split("").map(x=>String((target-Number(x)+10)%10)).join(""));
}

export function computeAllLinksForRows(rows=[]){
  const real=chronological(rows),counts=Object.fromEntries(TRIPLES.map(t=>[t,0]));
  const sourceFamilies=Object.fromEntries(TRIPLES.map(t=>[t,new Map()]));

  for(const row of real){
    const ff=family(row.code);
    for(const t of TRIPLES)counts[t]+=sourceFamilies[t].get(ff)||0;
    for(const t of TRIPLES){
      const f=complementFamily(row.code,t),m=sourceFamilies[t];
      m.set(f,(m.get(f)||0)+1);
    }
  }

  const sorted=TRIPLES.map((triple,order)=>({triple,count:counts[triple],order}))
    .sort((a,b)=>b.count-a.count||a.order-b.order);
  const multiplicity=new Map();
  for(const x of sorted)multiplicity.set(x.count,(multiplicity.get(x.count)||0)+1);
  let last=null,rank=0;
  const ranking=sorted.map((x,i)=>{
    if(x.count!==last){rank=i+1;last=x.count}
    return {triple:x.triple,count:x.count,rank,tied:(multiplicity.get(x.count)||0)>1};
  });

  return {rows:real.length,counts,ranking,total:Object.values(counts).reduce((a,b)=>a+b,0)};
}

export function computeTripleAllLinks(records=[]){
  const real=chronological(records);
  let anchorIndex=-1;
  for(let i=real.length-1;i>=0;i--)if(isTriple(real[i].code)){anchorIndex=i;break}
  const anchor=anchorIndex>=0?real[anchorIndex]:null;
  const cycleRows=anchorIndex>=0?real.slice(anchorIndex+1):[];
  const calc=computeAllLinksForRows(cycleRows);
  return {
    ruleCode:ALL_LINKS_RULE_CODE,
    anchor,
    start:cycleRows[0]||null,
    last:cycleRows.at(-1)||anchor||null,
    cycleRows:calc.rows,
    total:calc.total,
    counts:calc.counts,
    ranking:calc.ranking
  };
}
