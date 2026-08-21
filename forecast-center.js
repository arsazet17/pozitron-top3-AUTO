(() => {
'use strict';
const DB='top3-auto-forecast-center', STORE='history';
let db=null, ctx=null, tab='forecast';

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function openDB(){return new Promise(res=>{if(db)return res(db);const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>res(null)})}
async function put(x){const d=await openDB();if(!d)return;await new Promise(res=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(x);t.oncomplete=res;t.onerror=res})}
async function all(){const d=await openDB();if(!d)return[];return await new Promise(res=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>String(b.issuedAt).localeCompare(String(a.issuedAt))));r.onerror=()=>res([])})}

function currentSnapshot(c){
 const f=c.current;
 return {
   key:`${c.target.date}|${c.target.time}`,
   target:c.target,
   issuedAt:new Date().toISOString(),
   lastFact:f.lastFact,
   TOP:[...(f.TOP||[])],
   DELTA:[...(f.DELTA||[])],
   NUMBERS:[...(f.NUMBERS||[])],
   extras:{...(c.extras||{})},
   shift:c.shift?.combo||null,
   mirror:(c.mirrorPred||[]).map(x=>x.triple),
   factAfter:c.state?.forecastHistory?.find(x=>x.target?.date===c.target.date&&x.target?.time===c.target.time)?.factAfter||null
 };
}
async function syncFromCtx(c){
 ctx=c;
 for(const h of (c.state?.forecastHistory||[])){
   const x={
    key:`${h.target.date}|${h.target.time}`,target:h.target,issuedAt:h.issuedAt||'',
    lastFact:h.lastFact,TOP:[...(h.forecast?.TOP||[])],DELTA:[...(h.forecast?.DELTA||[])],NUMBERS:[...(h.forecast?.NUMBERS||[])],
    extras:{...(h.extras||{})},shift:h.shift?.combo||null,mirror:(h.mirror||[]).map(x=>x.triple),factAfter:h.factAfter||null
   };
   await put(x);
 }
 await put(currentSnapshot(c));
 render();
}
function result(x){
 if(!x.factAfter)return'ОЖИДАЕТ';
 const pools=[...(x.TOP||[]),...(x.DELTA||[]),...(x.NUMBERS||[]),...Object.values(x.extras||{}),x.shift,...(x.mirror||[])].filter(Boolean);
 return pools.includes(x.factAfter)?'🔥 ТОЧНО':'—';
}
function typeOf(s){if(!/^\d{3}$/.test(String(s||'')))return'';const n=new Set(String(s)).size;return n===1?'ТРОЙНИК':n===2?'ПАРА':'';}
function card(x){
 const variants=[...(x.TOP||[]),...(x.DELTA||[]),...(x.NUMBERS||[])].filter(Boolean);
 return `<details class="tfc-card"><summary><span>${esc(x.target?.date)} · ${esc(x.target?.time)}</span><b>${result(x)}</b></summary>
 <div class="tfc-body">
 <div><span>Последний факт</span><b>${esc(x.lastFact||'—')}</b></div>
 <div><span>TOP ЮЛЯ</span><b>${esc((x.TOP||[]).join(' · ')||'—')}</b></div>
 <div><span>Δ</span><b>${esc((x.DELTA||[]).join(' · ')||'—')}</b></div>
 <div><span>ЧИСЛА</span><b>${esc((x.NUMBERS||[]).join(' · ')||'—')}</b></div>
 <div><span>Доп.</span><b>${esc(Object.values(x.extras||{}).filter(Boolean).join(' · ')||'—')}</b></div>
 <div><span>Смена алгоритма</span><b>${esc(x.shift||'—')}</b></div>
 <div><span>Зеркало</span><b>${esc((x.mirror||[]).join(' · ')||'—')}</b></div>
 <div><span>Факт</span><b>${esc(x.factAfter||'ещё нет')}</b></div>
 </div></details>`;
}
function install(){
 if(document.querySelector('#top3ForecastCenter'))return;
 const host=document.querySelector('#main')||document.body;
 const box=document.createElement('section');box.id='top3ForecastCenter';box.className='tfc';
 box.innerHTML=`<details class="tfc-window" open><summary>📦 ПОЛНЫЙ ПРОГНОЗ / АРХИВ</summary>
 <div class="tfc-tabs">
 <button data-tfc="forecast" class="active">Прогноз</button><button data-tfc="archive">Архив</button><button data-tfc="stats">Статистика</button><button data-tfc="algorithm">Алгоритм</button><button data-tfc="triples">Тройники</button>
 </div><div id="tfcContent"></div></details>`;
 host.appendChild(box);
 box.querySelectorAll('[data-tfc]').forEach(b=>b.onclick=()=>{tab=b.dataset.tfc;box.querySelectorAll('[data-tfc]').forEach(x=>x.classList.toggle('active',x===b));render()});
}
async function render(){
 install();const c=document.querySelector('#tfcContent');if(!c)return;const items=await all();
 if(tab==='forecast'){c.innerHTML=items.length?card(items[0]):'<div class="tfc-empty">Нет прогноза</div>';return}
 if(tab==='archive'){c.innerHTML=items.map(card).join('')||'<div class="tfc-empty">Архив пуст</div>';return}
 if(tab==='stats'){const done=items.filter(x=>x.factAfter),hits=done.filter(x=>result(x).includes('ТОЧНО')).length;c.innerHTML=`<div class="tfc-stats"><div><span>Проверено</span><b>${done.length}</b></div><div><span>Точных</span><b>${hits}</b></div><div><span>Точность</span><b>${done.length?Math.round(hits/done.length*100):0}%</b></div></div>`;return}
 if(tab==='algorithm'){c.innerHTML=`<h3>Слежка за алгоритмом</h3>${items.slice(0,80).map(x=>`<div class="tfc-row"><span>${esc(x.target?.date)} ${esc(x.target?.time)}</span><b>TOP ${esc((x.TOP||[]).join('/'))} · Δ ${esc((x.DELTA||[]).join('/'))} · ЧИСЛА ${esc((x.NUMBERS||[]).join('/'))}</b></div>`).join('')}`;return}
 if(tab==='triples'){let arr=[];for(const x of items){for(const v of [...(x.TOP||[]),...(x.DELTA||[]),...(x.NUMBERS||[])]){const t=typeOf(v);if(t)arr.push({x,v,t})}}c.innerHTML=arr.map(r=>`<div class="tfc-row"><span>${esc(r.t)} · ${esc(r.v)}</span><b>${esc(r.x.target?.date)} ${esc(r.x.target?.time)}</b></div>`).join('')||'<div class="tfc-empty">Нет троек/пар</div>'}
}
window.addEventListener('top3-auto-render',e=>syncFromCtx(e.detail));
document.addEventListener('DOMContentLoaded',()=>{if(window.TOP3_AUTO_CTX)syncFromCtx(window.TOP3_AUTO_CTX);else install()});
})();