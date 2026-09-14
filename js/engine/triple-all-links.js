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
function complementCode(source,triple){
  const target=Number(triple[0]),s=padCode(source);
  return s.split("").map(x=>String((target-Number(x)+10)%10)).join("");
}

export function computeAllLinksForRows(rows=[]){
  const real=chronological(rows);
  const sourceFamilies=Object.fromEntries(TRIPLES.map(t=>[t,new Map()]));
  const links=[];
  const facts=[];
  const running=Object.fromEntries(TRIPLES.map(t=>[t,0]));

  real.forEach((row,rowIndex)=>{
    const ff=family(row.code),newLinks=[];

    for(const t of TRIPLES){
      const matches=sourceFamilies[t].get(ff)||[];
      for(const src of matches){
        const link={
          triple:t,
          sourceId:src.id,sourceDate:src.date,sourceTime:src.time,sourceCode:src.code,
          recipientId:row.id,recipientDate:row.date,recipientTime:row.time,recipientCode:row.code,
          addedCode:src.addedCode,addedFamily:src.addedFamily,
          lag:rowIndex-src.index
        };
        links.push(link);newLinks.push(link);running[t]++;
      }
    }

    for(const t of TRIPLES){
      const addedCode=complementCode(row.code,t),addedFamily=family(addedCode),m=sourceFamilies[t];
      if(!m.has(addedFamily))m.set(addedFamily,[]);
      m.get(addedFamily).push({id:row.id,date:row.date,time:row.time,code:row.code,index:rowIndex,addedCode,addedFamily});
    }

    const byTriple={};for(const l of newLinks)byTriple[l.triple]=(byTriple[l.triple]||0)+1;
    const max=Math.max(...Object.values(running));
    facts.push({
      id:row.id,date:row.date,time:row.time,code:row.code,
      added:newLinks.length,byTriple,cumulative:links.length,
      leaders:max>0?TRIPLES.filter(t=>running[t]===max):[],leaderCount:max
    });
  });

  const total=links.length;
  const stats=TRIPLES.map((triple,order)=>{
    const own=links.filter(x=>x.triple===triple),count=own.length;
    const sourceCount=new Set(own.map(x=>x.sourceId)).size;
    const recipientCount=new Set(own.map(x=>x.recipientId)).size;
    const avgLag=count?own.reduce((a,b)=>a+b.lag,0)/count:null;
    const maxLag=count?Math.max(...own.map(x=>x.lag)):null;
    return {
      triple,order,count,share:total?count*100/total:0,sourceCount,recipientCount,avgLag,maxLag,
      firstLink:own[0]||null,lastLink:own.at(-1)||null
    };
  });
  const counts=Object.fromEntries(stats.map(x=>[x.triple,x.count]));
  const sorted=[...stats].sort((a,b)=>b.count-a.count||a.order-b.order);
  const multiplicity=new Map();for(const x of sorted)multiplicity.set(x.count,(multiplicity.get(x.count)||0)+1);
  let last=null,rank=0;
  const ranking=sorted.map(x=>{
    if(x.count!==last){rank++;last=x.count}
    return {...x,rank,tied:(multiplicity.get(x.count)||0)>1};
  });

  return {rows:real.length,counts,ranking,total,links,facts};
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
    ranking:calc.ranking,
    links:calc.links,
    facts:calc.facts
  };
}
