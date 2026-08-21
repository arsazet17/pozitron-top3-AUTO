(() => {
'use strict';
const LIVE_URL='./top3-live.json';
const DRAW_TIMES=['02:40','04:40','06:40','07:40','09:40','11:40','13:40','16:25','21:25','22:40'];
const DB_NAME='yulia-top3-forecast-center', STORE='snapshots';
let db=null, live=null, active='forecast';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function openDB(){return new Promise(resolve=>{
 if(db)return resolve(db);
 const r=indexedDB.open(DB_NAME,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};
 r.onsuccess=()=>{db=r.result;resolve(db)}; r.onerror=()=>resolve(null);
});}
async function put(x){const d=await openDB();if(!d)return;await new Promise(res=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(x);t.oncomplete=res;t.onerror=res;});}
async function all(){const d=await openDB();if(!d)return[];return await new Promise(res=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));r.onerror=()=>res([]);});}

function parseDate(s){const m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{2})$/);return m?new Date(Date.UTC(2000+Number(m[3]),Number(m[2])-1,Number(m[1]))):null;}
function drawStamp(d){const dt=parseDate(d?.date);if(!dt)return NaN;const [h,m]=String(d?.time||'').split(':').map(Number);return Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth(),dt.getUTCDate(),h-3,m);}
function validDraw(d){return Number.isInteger(Number(d?.id))&&/^\d{2}\.\d{2}\.\d{2}$/.test(String(d?.date||''))&&DRAW_TIMES.includes(String(d?.time||''))&&[d?.a,d?.b,d?.c].every(x=>Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=9);}
function confirmedDraws(){const now=Date.now();return (live?.draws||[]).filter(d=>validDraw(d)&&drawStamp(d)<=now);}

async function sanitizeLegacyDB(){
 if(!('indexedDB'in window))return;
 const confirmed=confirmedDraws(), ids=new Set(confirmed.map(d=>Number(d.id)));
 const maxId=confirmed.length?Math.max(...confirmed.map(d=>Number(d.id))):0;
 await new Promise(resolve=>{
  const r=indexedDB.open('yulia-top3-db',1);
  r.onsuccess=()=>{const d=r.result;if(!d.objectStoreNames.contains('draws')){d.close();return resolve();}
   const t=d.transaction('draws','readwrite'), s=t.objectStore('draws'), q=s.getAll();
   q.onsuccess=()=>{for(const x of q.result||[]){const id=Number(x?.id);if((id>maxId||drawStamp(x)>Date.now())&&!ids.has(id))s.delete(id);}};
   t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();resolve()};
  };
  r.onerror=()=>resolve();
 });
}
function latestForecast(){return [...(live?.forecasts||[])].sort((a,b)=>Number(b.targetId)-Number(a.targetId))[0]||null;}
function actualFor(f){const d=(live?.draws||[]).find(x=>Number(x.id)===Number(f.targetId));return d?`${d.a}${d.b}${d.c}`:null;}
function typeOf(code){if(!/^\d{3}$/.test(String(code||'')))return'—';const n=new Set(String(code).split('')).size;return n===1?'ТРОЙНИК':n===2?'ПАРА':'ТРИ РАЗНЫЕ';}
function resultOf(f){const fact=actualFor(f);if(!fact)return'ожидает';const vs=(f.variants||[]).map(String);if(vs.includes(fact))return'точно';let best=0;for(const v of vs)best=Math.max(best,[...v].reduce((n,ch,i)=>n+(fact[i]===ch?1:0),0));return best?`${best}/3 позиции`:'мимо';}
function snap(f){return{key:`${f.targetId}|${f.targetDate}|${f.targetTime}`,targetId:f.targetId,targetDate:f.targetDate,targetTime:f.targetTime,createdAt:f.createdAt||new Date().toISOString(),baseId:f.baseId,baseCode:f.baseCode,delta:f.delta,deltaVariants:f.deltaVariants||[],variants:f.variants||[],actual:actualFor(f),result:resultOf(f)};}
async function saveForecasts(){for(const f of live?.forecasts||[])await put(snap(f));}

function cards(items){return items.length?items.map(x=>`<details class="fc-card"><summary><span><b>№${esc(x.targetId)}</b> · ${esc(x.targetDate)} · ${esc(x.targetTime)}</span><strong>${esc(x.actual?x.result:'ОЖИДАЕТ')}</strong></summary><div class="fc-detail">
<div><span>База</span><b>№${esc(x.baseId)} · ${esc(x.baseCode)}</b></div><div><span>Δ переход</span><b>${esc(x.delta||'—')}</b></div><div><span>Δ варианты</span><b>${esc((x.deltaVariants||[]).join(' · ')||'—')}</b></div><div><span>Полный прогноз</span><b>${esc((x.variants||[]).join(' · ')||'—')}</b></div><div><span>Типы</span><b>${esc((x.variants||[]).map(typeOf).join(' · ')||'—')}</b></div><div><span>Факт</span><b>${esc(x.actual||'ещё нет')}</b></div><div><span>Результат</span><b>${esc(x.result||'ожидает')}</b></div></div></details>`).join(''):'<div class="fc-empty">Записей пока нет.</div>';}
async function render(){
 const c=document.getElementById('fcContent');if(!c)return;
 document.querySelectorAll('.fc-tab').forEach(b=>b.classList.toggle('active',b.dataset.fcTab===active));
 const items=await all();
 if(active==='forecast'){const f=latestForecast();c.innerHTML=f?`<h3>Полный прогноз</h3>${cards([snap(f)])}`:'<div class="fc-empty">Серверного прогноза пока нет.</div>';return;}
 if(active==='archive'){c.innerHTML=`<h3>Архив прогнозов</h3>${cards(items)}`;return;}
 if(active==='stats'){const d=items.filter(x=>x.actual),exact=d.filter(x=>x.result==='точно').length,miss=d.filter(x=>x.result==='мимо').length;c.innerHTML=`<h3>Статистика прогнозов</h3><div class="fc-stats"><div><span>Проверено</span><b>${d.length}</b></div><div><span>Точно 3/3</span><b>${exact}</b></div><div><span>Мимо</span><b>${miss}</b></div><div><span>Точность</span><b>${d.length?Math.round(exact/d.length*100):0}%</b></div></div>`;return;}
 if(active==='algorithm'){const freq={};for(const x of items.slice(0,100)){if(x.delta)freq[x.delta]=(freq[x.delta]||0)+1;}const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12);c.innerHTML=`<h3>Слежка за алгоритмом</h3><p class="fc-note">Какие Δ реально применялись в сохранённых серверных прогнозах.</p><div class="fc-stats">${top.map(([d,n])=>`<div><span>Δ ${esc(d)}</span><b>${n} раз</b></div>`).join('')}</div>`;return;}
 if(active==='triples'){const rows=[];for(const x of items)for(const v of x.variants||[]){const t=typeOf(v);if(t==='ТРОЙНИК'||t==='ПАРА')rows.push({x,v,t});}c.innerHTML=`<h3>Тройники / пары</h3><div class="fc-trip-grid">${rows.slice(0,150).map(r=>`<div class="fc-trip"><b>${esc(r.v)}</b><span>${esc(r.t)}</span><small>№${esc(r.x.targetId)} · ${esc(r.x.targetDate)} ${esc(r.x.targetTime)}</small></div>`).join('')||'<div class="fc-empty">Пока нет.</div>'}</div>`;}
}
function install(){
 if(document.getElementById('forecastCenter'))return;
 const host=document.querySelector('#view-home')||document.querySelector('main')||document.body;
 const box=document.createElement('section');box.id='forecastCenter';box.className='fc-wrap';box.innerHTML=`<details class="fc-window" open><summary>📦 ПОЛНЫЙ ПРОГНОЗ / АРХИВ</summary><div class="fc-tabs"><button class="fc-tab active" data-fc-tab="forecast">Прогноз</button><button class="fc-tab" data-fc-tab="archive">Архив</button><button class="fc-tab" data-fc-tab="stats">Статистика</button><button class="fc-tab" data-fc-tab="algorithm">Алгоритм</button><button class="fc-tab" data-fc-tab="triples">Тройники</button></div><div id="fcContent" class="fc-content"></div></details>`;host.appendChild(box);box.querySelectorAll('.fc-tab').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.fcTab;render();}));
}
async function refresh(){try{const r=await fetch(`${LIVE_URL}?t=${Date.now()}`,{cache:'no-store'});live=await r.json();await sanitizeLegacyDB();await saveForecasts();install();await render();}catch(e){console.error(e);}}
document.addEventListener('DOMContentLoaded',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(()=>{if(!document.hidden)refresh();},60000);
})();