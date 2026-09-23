/* TOP-3 · M4 · последняя Δ ↔ зеркало Δ по последним значениям каждой тройни в окне 1000. */

export const M4_DIFF_MIRROR_RULE_CODE = 'TOP3-M4-DIFF-MIRROR-1000-V1-24SEP2026';
export const M4_WINDOW = 1000;
export const M4_TRIPLES = Object.freeze(['000','111','222','333','444','555','666','777','888','999']);

function padCode(v){return String(v??'').replace(/\D/g,'').padStart(3,'0').slice(-3)}
function family(v){return padCode(v).split('').sort().join('')}
function isTriple(v){return /^([0-9])\1\1$/.test(String(v||''))}
function mirror(v){return padCode(v).split('').map(d=>String((10-Number(d))%10)).join('')}
function diff(current,previous){
  const a=padCode(current),b=padCode(previous);
  return [0,1,2].map(i=>String((Number(a[i])-Number(b[i])+10)%10)).join('');
}
function chronological(records=[]){
  return records.map(r=>{
    const rawId=r?.id??r?.draw;
    const rawCode=r?.code??r?.combo??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:null);
    return {id:Number(rawId),date:String(r?.date||''),time:String(r?.time||'').slice(0,5),code:rawCode==null?'':padCode(rawCode)};
  }).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id);
}

export function computeM4DiffMirror1000(records=[]){
  const real=chronological(records);
  if(real.length<2)return {ok:false,reason:'Недостаточно фактов для Δ.',signals:[],ranking:[]};
  const latest=real.at(-1),previous=real.at(-2);
  const currentDiff=diff(latest.code,previous.code);
  const currentMirror=mirror(currentDiff);
  const window=real.slice(-M4_WINDOW);
  const firstIndex=real.length-window.length;
  const candidates=[];

  for(const triple of M4_TRIPLES){
    let idx=-1;
    for(let i=real.length-1;i>=firstIndex;i--){if(real[i].code===triple){idx=i;break}}
    if(idx<0){
      candidates.push({triple,found:false,match:false});
      continue;
    }
    if(idx===0){
      candidates.push({triple,found:true,match:false,row:real[idx],reason:'Нет предыдущего факта для Δ.'});
      continue;
    }
    const row=real[idx],prev=real[idx-1];
    const storedDiff=diff(row.code,prev.code);
    const storedMirror=mirror(storedDiff);
    const currentDiffFamily=family(currentDiff),currentMirrorFamily=family(currentMirror);
    const storedDiffFamily=family(storedDiff),storedMirrorFamily=family(storedMirror);
    const diffToMirror=currentDiffFamily===storedMirrorFamily;
    const mirrorToDiff=currentMirrorFamily===storedDiffFamily;
    const match=diffToMirror||mirrorToDiff;
    candidates.push({
      triple,found:true,match,diffToMirror,mirrorToDiff,
      row,previous:prev,
      diff:storedDiff,mirror:storedMirror,
      diffFamily:storedDiffFamily,mirrorFamily:storedMirrorFamily
    });
  }

  const signals=candidates.filter(x=>x.match).map(x=>x.triple);
  const ranking=M4_TRIPLES.map((triple,order)=>{
    const c=candidates.find(x=>x.triple===triple);
    return {triple,order,count:c?.match?1:0,match:Boolean(c?.match),candidate:c||null};
  }).sort((a,b)=>b.count-a.count||a.order-b.order);

  return {
    ok:true,ruleCode:M4_DIFF_MIRROR_RULE_CODE,windowSize:window.length,
    windowStart:window[0]||null,windowEnd:window.at(-1)||null,
    latest,previous,currentDiff,currentMirror,
    currentDiffFamily:family(currentDiff),currentMirrorFamily:family(currentMirror),
    signals,candidates,ranking
  };
}

/* Совместимое имя для Analyzer: старый M4 заменён новым методом. */
export function computeTripleAllLinks(records=[]){return computeM4DiffMirror1000(records)}

export {family,mirror,diff,isTriple};
