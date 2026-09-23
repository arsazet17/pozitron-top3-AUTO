const M7_TARGETS=['111','333','555','777','999'];
const M7_WINDOW=500;
let m7ExpectedCard='—';
let m7Busy=false;

const m7Esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function uniquePermutations(combo){
  const s=String(combo||'').padStart(3,'0').slice(-3), out=new Set();
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++){
    if(i===j||i===k||j===k)continue;
    out.add(s[i]+s[j]+s[k]);
  }
  return [...out];
}

function addMod10(a,b){
  const digits=[0,1,2].map(i=>(Number(a[i])+Number(b[i]))%10);
  return digits.join('');
}

function calcText(a,b){
  return [0,1,2].map(i=>`${a[i]}+${b[i]}→${(Number(a[i])+Number(b[i]))%10}`).join(', ');
}

function normRecord(x){
  if(!x)return null;
  const draw=Number(x.draw??x.drawNumber??x.id);
  const combo=String(x.combo??x.combination??((x.A!=null&&x.B!=null&&x.C!=null)?`${x.A}${x.B}${x.C}`:'')).padStart(3,'0').slice(-3);
  if(!Number.isInteger(draw)||!/^\d{3}$/.test(combo))return null;
  return {draw,combo,date:x.date||'',time:String(x.time||'').slice(0,5)};
}

function analyzeM7(records){
  const rows=(records||[]).map(normRecord).filter(Boolean).sort((a,b)=>a.draw-b.draw);
  if(rows.length<501)return {ok:false,reason:`Недостаточно архива: ${rows.length}. Нужно минимум 501 тираж.`};
  const X=rows.at(-1), prev=rows.slice(-501,-1);
  if(prev.length!==M7_WINDOW)return {ok:false,reason:`Окно собрано неверно: ${prev.length}/500`};
  const xFamily=uniquePermutations(X.combo);
  const analyzed=prev.map(p=>{
    const pFamily=uniquePermutations(p.combo), hits=new Set(), witnesses={};
    for(const xp of xFamily){
      for(const pp of pFamily){
        const sum=addMod10(xp,pp);
        if(!M7_TARGETS.includes(sum))continue;
        hits.add(sum);
        if(!witnesses[sum])witnesses[sum]={xPerm:xp,pPerm:pp,triple:sum,calc:calcText(xp,pp)};
      }
    }
    return {...p,hits,witnesses};
  });

  const series=[];
  for(const triple of M7_TARGETS){
    let start=-1;
    for(let i=0;i<=analyzed.length;i++){
      const has=i<analyzed.length&&analyzed[i].hits.has(triple);
      if(has&&start<0)start=i;
      if(!has&&start>=0){
        const len=i-start;
        if(len>=2){
          const members=analyzed.slice(start,i).map(r=>({draw:r.draw,combo:r.combo,witness:r.witnesses[triple]}));
          series.push({triple,length:len,startIndex:start,endIndex:i-1,members});
        }
        start=-1;
      }
    }
  }
  series.sort((a,b)=>a.startIndex-b.startIndex||M7_TARGETS.indexOf(a.triple)-M7_TARGETS.indexOf(b.triple));
  const bestByTriple={};
  for(const s of series){
    const prevBest=bestByTriple[s.triple];
    if(!prevBest||s.length>prevBest.length||(s.length===prevBest.length&&s.endIndex>prevBest.endIndex))bestByTriple[s.triple]=s;
  }
  const signals=M7_TARGETS.filter(t=>bestByTriple[t]).map(t=>({triple:t,length:bestByTriple[t].length}));
  return {ok:true,X,window:prev,analyzed,series,signals};
}

function cardText(result){
  if(!result?.ok)return 'НЕТ ДАННЫХ';
  if(!result.signals.length)return 'СИГНАЛА НЕТ';
  return result.signals.map(s=>`${s.triple} · серия ${s.length}`).join(' / ');
}

function renderM7(result){
  const card=document.querySelector('#m5Card');
  const detail=document.querySelector('#m7Detail');
  if(!card||!detail)return;
  m7ExpectedCard=cardText(result);
  if(card.textContent!==m7ExpectedCard)card.textContent=m7ExpectedCard;

  if(!result?.ok){
    detail.innerHTML=`<div class="section-title compact"><div><div class="kicker">M7 · нечётные тройни</div><h3>500 предыдущих · серия 2+</h3></div></div><div class="muted">${m7Esc(result?.reason||'Нет данных')}</div>`;
    return;
  }

  const {X,window,series,signals}=result;
  const summary=signals.length
    ? signals.map(s=>`<span class="chip"><b>${s.triple}</b> · серия ${s.length}</span>`).join(' ')
    : '<b>СИГНАЛА НЕТ.</b>';
  const found=series.length?series.map((s,idx)=>{
    const draws=s.members.map(m=>`№${m.draw}`).join(' → ');
    const proofs=s.members.map(m=>{
      const w=m.witness;
      return `<div class="mono" style="margin:.45rem 0">№${m.draw} = ${m7Esc(m.combo)} · ${m7Esc(w.xPerm)} + ${m7Esc(w.pPerm)} = <b>${s.triple}</b><br><span class="muted">${m7Esc(w.calc)} → ${s.triple}</span></div>`;
    }).join('');
    return `<details ${idx===series.length-1?'open':''}><summary><b>${s.triple}</b>: серия ${s.length} · ${draws}</summary><div style="padding:.6rem 0"><div class="muted">X = ${m7Esc(X.combo)}. Одна и та же тройня подтверждена на соседних тиражах без пропусков.</div>${proofs}</div></details>`;
  }).join(''):'<div class="muted">Одинаковых нечётных троен на двух соседних тиражах подряд нет.</div>';

  detail.innerHTML=`
    <div class="section-title compact"><div><div class="kicker">M7 · нечётные тройни</div><h3>500 предыдущих · серия 2+</h3></div></div>
    <div class="audit-grid" style="margin-bottom:1rem">
      <div><span>НОВАЯ X</span><b>${m7Esc(X.combo)}</b><small>№${X.draw}</small></div>
      <div><span>Окно</span><b>500 предыдущих</b><small>№${window[0].draw} → №${window.at(-1).draw}</small></div>
      <div><span>Учитываются</span><b>111 / 333 / 555 / 777 / 999</b><small>Только нечётные тройни</small></div>
      <div><span>Минимум</span><b>серия 2</b><small>Только одна и та же тройня подряд</small></div>
    </div>
    <div style="margin-bottom:1rem"><b>ИТОГОВЫЙ СИГНАЛ:</b><div style="margin-top:.55rem">${summary}</div></div>
    <div class="section-title compact"><h4>Найденные серии и точное подтверждение</h4></div>
    ${found}
    <div class="muted" style="margin-top:1rem">Анти-ошибка: 555 → 333 не считается серией. Серия существует только для одинаковой тройни на соседних тиражах. Каждый новый факт пересчитывается независимо по своим 500 предыдущим тиражам.</div>`;
}

async function loadM7(){
  if(m7Busy)return;
  m7Busy=true;
  try{
    const r=await fetch(`../data/archive.json?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`archive HTTP ${r.status}`);
    const data=await r.json();
    if(!Array.isArray(data))throw new Error('archive.json не массив');
    const result=analyzeM7(data);
    window.__TOP3_M7=result;
    renderM7(result);
  }catch(e){
    renderM7({ok:false,reason:`Ошибка M7: ${e.message||e}`});
  }finally{m7Busy=false}
}

function initM7(){
  const current=document.querySelector('#currentFact'),card=document.querySelector('#m5Card');
  if(current)new MutationObserver(()=>loadM7()).observe(current,{childList:true,characterData:true,subtree:true});
  if(card)new MutationObserver(()=>{if(card.textContent!==m7ExpectedCard&&m7ExpectedCard)card.textContent=m7ExpectedCard}).observe(card,{childList:true,characterData:true,subtree:true});
  document.querySelector('#syncNowBtn')?.addEventListener('click',()=>setTimeout(loadM7,1500));
  loadM7();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initM7,{once:true});else initM7();

export {analyzeM7,uniquePermutations};
