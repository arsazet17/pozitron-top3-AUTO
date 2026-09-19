/* TOP-3 · M6 REPEAT-FAMILY-150 V2 · forward only. */

export const M6_RULE_CODE = "TOP3-M6-REPEAT-FAMILY-150-V2-19.09.2026";
export const M6_FORWARD_TARGET_ID = 268290;
export const M6_TTL = 150;
export const M5_EXACT_WINDOW = 50;
export const M5_EXACT_LAST = 5;

function padCode(v){return String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3)}
export function m6Family(v){return padCode(v).split("").sort().join("")}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||""))}
function tripleSort(a,b){return Number(a[0])-Number(b[0])}
function uniq(a){return [...new Set(a)].sort(tripleSort)}
function addExact(a,b){a=padCode(a);b=padCode(b);return a.split("").map((x,i)=>(Number(x)+Number(b[i]))%10).join("")}
function permutations(v){
  const a=padCode(v).split(""),out=new Set();
  function rec(prefix,rest){
    if(!rest.length){out.add(prefix);return}
    for(let i=0;i<rest.length;i++)rec(prefix+rest[i],rest.slice(0,i).concat(rest.slice(i+1)));
  }
  rec("",a);return [...out];
}

export function m6TriplesForFamilies(activeFamily,newFamily){
  const out=[];
  for(const a of permutations(m6Family(activeFamily)))for(const b of permutations(m6Family(newFamily))){
    const s=addExact(a,b);if(isTriple(s))out.push(s);
  }
  return uniq(out);
}

function chronological(records=[]){
  return (records||[]).map(r=>{
    const rawId=r?.id??r?.draw;
    const rawCode=r?.code??r?.combo??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:null);
    return {id:Number(rawId),date:String(r?.date||""),time:String(r?.time||""),code:rawCode==null?"":padCode(rawCode)};
  }).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id);
}

export function computeM5ExactState(records=[],uptoId=null){
  let real=chronological(records);
  if(Number.isInteger(Number(uptoId)))real=real.filter(r=>r.id<=Number(uptoId));
  if(!real.length)return {links:[],occupiedIds:[],counts:{},burst:false,main:false,reserve:false,previous5:[]};
  const window=real.slice(-M5_EXACT_WINDOW),seconds=window.slice(-M5_EXACT_LAST),secondIds=new Set(seconds.map(x=>x.id)),links=[];
  for(let j=0;j<window.length;j++){
    const second=window[j];if(!secondIds.has(second.id))continue;
    for(let i=0;i<j;i++){
      const source=window[i],triple=addExact(source.code,second.code);
      if(!isTriple(triple))continue;
      links.push({sourceId:source.id,sourceCode:source.code,secondId:second.id,secondCode:second.code,triple});
    }
  }
  const occupied=new Set(),counts={};
  for(const l of links){occupied.add(l.sourceId);occupied.add(l.secondId);counts[l.triple]=(counts[l.triple]||0)+1}
  const burst=links.length>=6,main=burst&&["222","444","888"].every(t=>counts[t]>0),reserve=burst&&counts["222"]>0&&counts["444"]>0;
  return {links,occupiedIds:[...occupied].sort((a,b)=>a-b),counts,burst,main,reserve,previous5:seconds};
}

function fmtFrozen(a){return a?.length?a.join(" / "):"—"}

export function computeTripleM6(records=[]){
  const real=chronological(records);
  if(!real.length)return {ruleCode:M6_RULE_CODE,ready:false,last:null,targetDraw:null,frozen:[],activeFamilies:[],usedFamilies:[],excludedFamilies:[],m5:computeM5ExactState([]),history:[]};

  const families=new Map(),history=[];
  let previousFrozen=[],lastCalc=null;

  for(let i=0;i<real.length;i++){
    const row=real[i],fam=m6Family(row.code);
    const activeBefore=[];
    for(const [family,s] of families)if(Number(s.activeFrom)<=row.id&&row.id<=Number(s.activeUntil))activeBefore.push({family,...s});

    const m5=computeM5ExactState(real.slice(0,i+1));
    const occupied=new Set(m5.occupiedIds);

    const old=families.get(fam)||{family:fam,count:0,firstDraw:null,lastDraw:null,activeFrom:null,activeUntil:null,lastRepeatDraw:null};
    const wasActive=Number(old.activeFrom)<=row.id&&row.id<=Number(old.activeUntil);
    const next={...old,count:Number(old.count||0)+1,firstDraw:old.firstDraw??row.id,lastDraw:row.id};
    if(Number(old.count||0)>=1){
      next.activeFrom=wasActive?old.activeFrom:row.id+1;
      next.activeUntil=row.id+M6_TTL;
      next.lastRepeatDraw=row.id;
    }
    families.set(fam,next);

    const targetDraw=row.id+1;
    let frozen=[],usedFamilies=[],excludedFamilies=[],sources=[];
    if(targetDraw>=M6_FORWARD_TARGET_ID){
      if(occupied.has(row.id)){
        excludedFamilies.push({family:fam,reason:`NEW ${row.code} exact-occupied M5`,draw:row.id});
      }else{
        for(const a of activeBefore){
          if(occupied.has(Number(a.lastRepeatDraw))){
            excludedFamilies.push({family:a.family,reason:`active repeat source №${a.lastRepeatDraw} exact-occupied M5`,draw:a.lastRepeatDraw});
            continue;
          }
          const triples=m6TriplesForFamilies(a.family,fam);
          if(!triples.length)continue;
          usedFamilies.push(a.family);
          for(const t of triples){frozen.push(t);sources.push({triple:t,activeFamily:a.family,newFamily:fam,activeUntil:a.activeUntil})}
        }
      }
      frozen=uniq(frozen);usedFamilies=[...new Set(usedFamilies)].sort();
      lastCalc={fact:row,targetDraw,frozen,usedFamilies,excludedFamilies,sources,m5};
    }

    if(row.id>=M6_FORWARD_TARGET_ID){
      const check=!previousFrozen.length?"сигнала не было":previousFrozen.includes(row.code)?"✅ HIT":"❌ MISS";
      history.push({id:row.id,date:row.date,time:row.time,fact:row.code,before:[...previousFrozen],check,after:[...frozen],sources:[...sources]});
    }
    if(targetDraw>=M6_FORWARD_TARGET_ID)previousFrozen=[...frozen];
  }

  const last=real.at(-1),nextDraw=last.id+1;
  const activeFamilies=[];
  for(const [family,s] of families)if(Number(s.activeFrom)<=nextDraw&&nextDraw<=Number(s.activeUntil))activeFamilies.push({family,...s});
  activeFamilies.sort((a,b)=>a.family.localeCompare(b.family));
  const currentM5=computeM5ExactState(real);

  return {
    ruleCode:M6_RULE_CODE,ready:true,last,targetDraw:nextDraw,
    frozen:[...(lastCalc?.frozen||[])],
    activeFamilies,
    usedFamilies:[...(lastCalc?.usedFamilies||[])],
    excludedFamilies:[...(lastCalc?.excludedFamilies||[])],
    sources:[...(lastCalc?.sources||[])],
    m5:currentM5,
    history:history.slice(-20),
    lastIssued:lastCalc,
    frozenText:fmtFrozen(lastCalc?.frozen||[])
  };
}
