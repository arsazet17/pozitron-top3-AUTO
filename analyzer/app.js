import {hydrateSeed,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';
import {computeTripleChat} from '../js/engine/triples-chat.js';
import {computeTripleAllLinks} from '../js/engine/m4-diff-mirror-1000.js';
import {computeTripleBeacon} from '../js/engine/triple-beacon.js';
import {computeM6V3Strict} from '../js/engine/m6-v3-strict.js';
import {computeM6R2} from '../js/engine/m6-r2.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const VER='0.7.4', KEY='top3-analyzer-online-state-v060', AUTO='top3-analyzer-auto-v1';
const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json',full:'../data/full-archive/all.json'};
let state=null,fullArchive=[],fullCore=null,authoritative=null,busy=false,timer=null,repeatFilter='all',lastAudit=null,lastPollMinuteKey='',completedPollSlot='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sig=a=>a?.length?a.join(' / '):'—';
const ruDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s).split('-').reverse().join('.'):String(s||'');
const isoDate=s=>/^\d{2}\.\d{2}\.\d{4}$/.test(String(s||''))?String(s).split('.').reverse().join('-'):String(s||'');
const norm=x=>{if(!x)return null;const combo=String(x.combo??((x.A!=null&&x.B!=null&&x.C!=null)?`${x.A}${x.B}${x.C}`:'')).padStart(3,'0'),draw=Number(x.draw),time=String(x.time||'').slice(0,5);if(!Number.isInteger(draw)||!/^\d{3}$/.test(combo)||!/^\d{2}:\d{2}$/.test(time))return null;return{draw,date:ruDate(x.date),time,combo}};
const fetchJSON=async url=>{const r=await fetch(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const save=()=>{}; // archive/state stays in repository; do not duplicate it into quota-limited localStorage
const autoOn=()=>localStorage.getItem(AUTO)!=='0';
const lf=()=>state?.facts?.at(-1)||null;
const fc=()=>authoritative?.forecast||state?.methodState?.currentForecast||{FINAL:[]};

const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function completeFullArchive(){
  if(!fullCore)return null;
  const baseCombos=Array.isArray(fullCore.combos)?[...fullCore.combos]:(typeof fullCore.data==='string'?(fullCore.data.match(/.{3}/g)||[]):[]);
  const from=Number(fullCore.fromDraw||0),baseTo=Number(fullCore.toDraw||0);
  const tail=fullArchive.filter(x=>x.draw>baseTo).sort((a,b)=>a.draw-b.draw);
  for(const r of tail){const expected=from+baseCombos.length;if(r.draw===expected)baseCombos.push(r.combo)}
  return {...fullCore,combos:baseCombos,toDraw:from+baseCombos.length-1,total:baseCombos.length};
}
function nextSlot(last){
  if(!last)return{draw:null,date:'',time:''};
  const [dd,mm,yyyy]=String(last.date).split('.').map(Number),[hh,mi]=String(last.time).split(':').map(Number);
  const d=new Date(yyyy,mm-1,dd,hh,mi+30,0,0),pad=n=>String(n).padStart(2,'0');
  return{draw:Number(last.draw)+1,date:`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};
}
function rebuildAuthoritative(){
  const records=[...fullArchive].sort((a,b)=>a.draw-b.draw);
  if(!records.length)return;
  state.facts=records;
  const full=completeFullArchive();
  const tc=computeTripleChat(records,full),snap=tc.snapshot||{};
  const m6calc=computeM6V3Strict({records,fullArchive:full}),m6c=m6calc.current||null;
  const m6r2=computeM6R2({records,fullArchive:full});
  const m4calc=computeTripleAllLinks(records),top=Number(m4calc?.ranking?.[0]?.count||0);
  const m4=top?(m4calc.ranking||[]).filter(x=>Number(x.count)===top).map(x=>x.triple):[];
  const last=records.at(-1),target=nextSlot(last);
  const m2=uniq((snap.m2||[]).map(x=>x.triple));
  const m3=uniq((snap.m3||[]).map(x=>x.triple));
  const serial=uniq((snap.serialLeaders||[]).map(x=>x.triple));
  const core=uniq(snap.frozen||[]),m6sig=uniq(m6c?.triples||[]);
  const details={};for(const p of (m6c?.paths||[])){const m=String(p).match(/→(\d{3})$/),t=m?.[1]||'M6';(details[t]??=[]).push(p)}
  const by=new Map(records.map(r=>[r.draw,r]));
  const m6view=m6c?{family:m6c.family,count:m6c.count,trigger:m6c.trigger,signal:m6sig,occurrences:(m6c.appearances||[]).map(id=>by.get(id)||{draw:id,combo:''}),details}:{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}};
  const forecast={draw:target.draw,date:target.date,time:target.time,M1:uniq(snap.m1||[]),M2_ready:m2,M3:m3,serial_leader:serial,M4_leaders:m4,M6_REPEAT_FAMILY_1000:m6sig,M6_REPEAT_FAMILY_150:m6sig,M6_R2:[...(m6r2.signal||[])],FINAL_CORE:core,FINAL:core,M4_IN_FINAL:false,status:core.length?'FROZEN':'NO VALID NUMERIC SIGNAL'};
  authoritative={triple:tc,m6:m6view,m6Raw:m6calc,m6r2,m4:m4calc,forecast};
  state.methodState??={};state.methodState.currentForecast=forecast;
  state.methodState.leader20={counts:{...(snap.leader?.counts||{})},leaders:[...(snap.leader?.leaders||[])],max_count:Number(snap.leader?.max||0),window:`последние 20 · до №${last.draw}`};
  state.archive20=(snap.archive||[]).slice(-20).map(r=>[r.id,r.date,r.time,r.fact,r.before,r.check,r.after]);
}
function authoritativeM5(){
  const b=computeTripleBeacon(completeFullArchive());
  const links=(b.pairs||[]).map(x=>({source_draw:x.sourceDraw,source_combo:x.source,second_draw:x.secondDraw,second_combo:x.second,triple:x.type}));
  return{main:false,reserve:false,burst:Boolean(b.signal),signal:Boolean(b.signal),total:links.length,links,counts:b.typeCounts||{},shared:b};
}
function currentM6(){return authoritative?.m6||{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}}}
function currentM6R2(){return authoritative?.m6r2||{method:'M6-R2',experimental:true,trigger:false,signal:[],family:'',familyCount:0,gap1:null,gap2:null,gap3:null,mirrorFamily:'',mirrorCount:0,mirrorLag:null,reason:'NO SIGNAL'}}

function pollSlot(now=new Date()){
  const startMinute=now.getMinutes()<30?0:30;
  const start=new Date(now);start.setMinutes(startMinute,0,0);
  const elapsed=now-start;
  const active=elapsed>=0&&elapsed<10*60*1000;
  const pad=n=>String(n).padStart(2,'0');
  const key=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(startMinute)}`;
  const minuteKey=`${key}-${pad(now.getMinutes())}`;
  return{active,key,minuteKey,start};
}
function remoteUpdatedForSlot(updatedAt,slot){if(!updatedAt||!slot?.active)return false;const d=new Date(updatedAt);return !Number.isNaN(d.getTime())&&d>=slot.start}

function stripM4FromFinal(){ /* canonical Yulia core owns M1/M2/M3; M4/M6 stay separate. */ }
function mergeArchive(rows){const m=new Map(fullArchive.map(x=>[x.draw,x]));for(const r0 of rows||[]){const r=norm(r0);if(r)m.set(r.draw,r)}fullArchive=[...m.values()].sort((a,b)=>a.draw-b.draw)}
function countsThrough(draw){const c={};for(const x of fullArchive){if(x.draw>draw)break;c[x.combo]=(c[x.combo]||0)+1}return c}
function setStatus(kind,msg){state.syncMeta??={};state.syncMeta.status=kind;state.syncMeta.message=msg;save();renderSync()}

async function boot(){
  try{localStorage.removeItem(KEY)}catch{}
  const seed=await fetchJSON('./seed.json');state=hydrateSeed(seed);state.appVersion=VER;state.syncMeta??={};
  try{fullCore=await fetchJSON(REMOTE.full)}catch{fullCore=null}
  try{const rows=await fetchJSON(REMOTE.archive);mergeArchive(rows)}catch{mergeArchive(state.facts)}
  rebuildAuthoritative();save();render();setupTimer();
}
async function sync(manual=false){
  if(busy)return false;busy=true;
  try{
    const slot=pollSlot();setStatus('working',manual?'Обновляю сейчас…':'Проверка обновления архива…');
    const lp=await fetchJSON(REMOTE.latest),remote=norm(lp.draw||lp.latest||lp);if(!remote)throw Error('latest.json: неверный формат');
    state.syncMeta.remoteLatest=remote;state.syncMeta.remoteUpdatedAt=lp.updatedAt||null;
    const localNo=Number(lf()?.draw||0);
    if(remote.draw<=localNo){const slotReady=remoteUpdatedForSlot(lp.updatedAt,slot);if(slotReady)completedPollSlot=slot.key;state.syncMeta.lastAdded=0;state.syncMeta.lastSuccessAt=new Date().toISOString();setStatus(slot.active&&!slotReady?'working':'ok',slot.active&&!slotReady?'Архив ещё не обновился · повтор через 1 мин':'Архив актуален');render();return slotReady}
    const oldFinal=[...(fc().FINAL||[])],oldM6=[...(fc().M6_REPEAT_FAMILY_150||[])];
    const rows=await fetchJSON(REMOTE.archive);if(!Array.isArray(rows))throw Error('archive.json: неверный формат');mergeArchive(rows);
    const by=new Map(fullArchive.map(x=>[x.draw,x]));for(let n=localNo+1;n<=remote.draw;n++)if(!by.get(n))throw Error(`Пропущен №${n} в удалённом архиве`);
    const added=Math.max(0,remote.draw-localNo);rebuildAuthoritative();
    lastAudit={oldFinal,check:oldFinal.length?(oldFinal.includes(remote.combo)?'HIT':'MISS'):'NO SIGNAL',final:[...(fc().FINAL||[])],m6:{signal:[...(fc().M6_REPEAT_FAMILY_150||[])],old:oldM6}};
    state.appVersion=VER;state.syncMeta.lastAdded=added;state.syncMeta.lastSuccessAt=new Date().toISOString();state.syncMeta.remoteLatest=remote;if(slot.active&&added>0)completedPollSlot=slot.key;
    save();setStatus('ok',`Загружено: ${added} · до №${remote.draw}`);render();return added>0;
  }catch(e){state.syncMeta.lastError=String(e.message||e);setStatus('error',`Ошибка AUTO: ${e.message||e}`);return false}finally{busy=false;renderSync()}
}
async function scheduledPoll(){
  if(!autoOn()||busy||!state)return;
  const slot=pollSlot();
  if(!slot.active){
    if(state.syncMeta?.message!=='Ожидание обновления в :00 / :30'){state.syncMeta??={};state.syncMeta.status='idle';state.syncMeta.message='Ожидание обновления в :00 / :30';save();renderSync()}
    return;
  }
  if(completedPollSlot===slot.key||lastPollMinuteKey===slot.minuteKey)return;
  lastPollMinuteKey=slot.minuteKey;
  await sync(false);
}
function setupTimer(){if(timer)clearInterval(timer);lastPollMinuteKey='';if(autoOn()){scheduledPoll();timer=setInterval(scheduledPoll,15000)}}
function render(){renderMain();renderRepeats();renderBeacon();renderArchive();renderLeaders();renderSync()}
function renderM4Detail(){
  const box=$('#m4Detail'),m=authoritative?.m4;if(!box)return;
  if(!m?.ok){box.innerHTML=`<div class="section-title compact"><div><div class="kicker">M4 · Δ ↔ зеркало</div><h3>Последние значения каждой тройни · окно 1000</h3></div></div><div class="muted">${esc(m?.reason||'Нет данных')}</div>`;return}
  const signals=m.signals||[];
  const summary=signals.length?signals.map(t=>`<span class="chip"><b>${esc(t)}</b></span>`).join(' '):'<b>СИГНАЛА НЕТ.</b>';
  const rows=(m.candidates||[]).map(c=>{
    if(!c.found)return `<tr><td><b>${c.triple}</b></td><td colspan="6" class="muted">Нет этой тройни в последних 1000 тиражах</td></tr>`;
    const dir=c.match?(c.diffToMirror&&c.mirrorToDiff?'Δ→зеркало / зеркало→Δ':c.diffToMirror?'Δ→зеркало':'зеркало→Δ'):'—';
    return `<tr class="${c.match?'hit-row':''}"><td><b>${c.triple}</b></td><td>№${c.row?.id??'—'}<br><span class="muted">${esc(c.row?.date||'')} ${esc(c.row?.time||'')}</span></td><td class="mono">${esc(c.previous?.code||'—')} → ${esc(c.row?.code||'—')}</td><td class="mono"><b>${esc(c.diff||'—')}</b><br><span class="muted">family ${esc(c.diffFamily||'—')}</span></td><td class="mono"><b>${esc(c.mirror||'—')}</b><br><span class="muted">family ${esc(c.mirrorFamily||'—')}</span></td><td>${c.match?'✅ СХЛОПНУЛОСЬ':'—'}</td><td>${dir}</td></tr>`;
  }).join('');
  box.innerHTML=`
    <div class="section-title compact"><div><div class="kicker">M4 · Δ ↔ зеркало</div><h3>Последние значения каждой тройни · окно 1000</h3></div></div>
    <div class="audit-grid" style="margin-bottom:1rem">
      <div><span>Последний факт</span><b>${esc(m.latest?.code||'—')}</b><small>№${m.latest?.id??'—'}</small></div>
      <div><span>Предыдущий</span><b>${esc(m.previous?.code||'—')}</b><small>№${m.previous?.id??'—'}</small></div>
      <div><span>Последняя Δ</span><b>${esc(m.currentDiff||'—')}</b><small>family ${esc(m.currentDiffFamily||'—')}</small></div>
      <div><span>Зеркало Δ</span><b>${esc(m.currentMirror||'—')}</b><small>family ${esc(m.currentMirrorFamily||'—')}</small></div>
      <div><span>Окно</span><b>${m.windowSize||0} тиражей</b><small>№${m.windowStart?.id??'—'} → №${m.windowEnd?.id??'—'}</small></div>
      <div><span>Итог M4</span><b>${signals.length?signals.join(' / '):'СИГНАЛА НЕТ'}</b><small>Прогнозируется тройня, чья пара Δ/зеркало схлопнулась</small></div>
    </div>
    <div style="margin-bottom:1rem"><b>ИТОГОВЫЙ СИГНАЛ M4:</b><div style="margin-top:.55rem">${summary}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Последнее появление /1000</th><th>Переход</th><th>Δ тройни</th><th>Зеркало Δ</th><th>Статус</th><th>Направление</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="muted" style="margin-top:1rem">Сравнение только по family: порядок цифр не важен. Проверка: последняя Δ ↔ зеркало Δ тройни или зеркало последней Δ ↔ Δ тройни. Для каждой тройни используется только её самое последнее появление внутри текущих 1000 тиражей.</div>`;
}

function renderMain(){
  const x=lf(),f=fc(),m5=authoritativeM5(),m6=currentM6(),m6r2=currentM6R2();
  $('#version').textContent='v'+VER;$('#currentFact').textContent=x?`№${x.draw} · ${x.date} ${x.time} · ${x.combo}`:'—';$('#nextDraw').textContent=f.draw?`№${f.draw} · ${f.date} ${f.time}`:'—';
  $('#lastResult').textContent=x?.combo||'—';$('#lastResultMeta').textContent=x?`№${x.draw} · ${x.date} ${x.time}`:'—';$('#finalFrozen').textContent=sig(f.FINAL);$('#finalFrozenTarget').textContent=f.draw?`На №${f.draw} · ${f.date} ${f.time}`:'—';
  [['#m1Card',f.M1],['#m2Card',f.M2_ready],['#m3Card',f.M3],['#m4Card',f.M4_leaders]].forEach(([id,v])=>$(id).textContent=sig(v));const m6Base=sig(f.M6_REPEAT_FAMILY_1000||f.M6_REPEAT_FAMILY_150);const m6r2Forecast=m6r2.trigger?sig(m6r2.signal):'NO SIGNAL';$('#m6Card').textContent=`${m6Base} (M6-R2: ${m6r2Forecast})`;$('#m5Card').textContent=m5.signal?'🚨 СИГНАЛ':'NO SIGNAL';
  const m4Label=$('#m4Card')?.previousElementSibling;if(m4Label)m4Label.textContent='M4 · Δ ↔ зеркало · 1000';renderM4Detail();
  $('#m6Family').textContent=m6.family||'—';$('#m6Count').textContent=m6.count??'—';$('#m6Trigger').textContent=m6.trigger?'ДА':'НЕТ';$('#m6Result').textContent=sig(m6.signal);
  if($('#m6R2Result'))$('#m6R2Result').textContent=m6r2.trigger?sig(m6r2.signal):'NO SIGNAL';if($('#m6R2FamilyCount'))$('#m6R2FamilyCount').textContent=`${m6r2.family||'—'} · ${m6r2.familyCount??0}`;if($('#m6R2Gaps'))$('#m6R2Gaps').textContent=[m6r2.gap1,m6r2.gap2,m6r2.gap3].map(v=>v??'—').join(' / ');if($('#m6R2Mirror'))$('#m6R2Mirror').textContent=`${m6r2.mirrorFamily||'—'} · ${m6r2.mirrorCount??0} раза`;if($('#m6R2Lag'))$('#m6R2Lag').textContent=m6r2.mirrorLag??'—';if($('#m6R2Reason'))$('#m6R2Reason').textContent=m6r2.trigger?'✅ Все фильтры M6-R2 выполнены. Экспериментальный сигнал на следующий тираж.':`NO SIGNAL · ${m6r2.reason||'условия не выполнены'}`;
  $('#m6Occurrences').innerHTML=(m6.occurrences||[]).map((o,i)=>`<span class="chip">${i+1}. №${o.draw} ${o.combo}</span>`).join(' ')||'<span class="muted">Нет</span>';
  $('#m6Paths').innerHTML=Object.entries(m6.details||{}).map(([t,p])=>`<details><summary><b>${t}</b> · ${p.length} путей</summary><div class="mono">${p.slice(0,12).map(esc).join('<br>')}</div></details>`).join('')||'<span class="muted">Нет M6-сигнала</span>';
  $('#auditBox').innerHTML=lastAudit?`<div class="audit-grid"><div><span>Frozen ДО</span><b>${sig(lastAudit.oldFinal)}</b></div><div><span>Проверка</span><b>${lastAudit.check}</b></div><div><span>Новый Frozen</span><b>${sig(lastAudit.final)}</b></div><div><span>M6</span><b>${sig(lastAudit.m6.signal)}</b></div></div>`:`<div class="audit-grid"><div><span>Текущий Frozen</span><b>${sig(f.FINAL)}</b></div><div><span>Статус</span><b>${esc(f.status||'—')}</b></div></div>`;
}

function renderRepeats(){const a=analyzeFamilyRepeats150(state.facts),cur=a.rows.find(r=>r.current);$('#repeatWindow').textContent=a.start&&a.end?`№${a.start.draw} → №${a.end.draw}`:'—';$('#repeat2Count').textContent=a.repeat2plus;$('#repeat3Count').textContent=a.repeat3plus;$('#repeatCurrent').textContent=a.currentFamily||'—';$('#repeatCurrentStatus').textContent=`${a.currentCount} появлений /1000${a.currentCount===2?' · ждём 3-й':a.currentCount>=3?' · M6 trigger':' · без сигнала'}`;$('#repeatSummary').textContent=`2+: ${a.repeat2plus} · 3+: ${a.repeat3plus}`;
  const q=($('#repeatSearch')?.value||'').trim();let rows=a.rows.filter(r=>(repeatFilter==='two'?r.count===2:repeatFilter==='hot'?r.count>=3:true)&&(!q||r.family.includes(q)));$('#repeatBody').innerHTML=rows.map(r=>`<tr class="${r.current?'current-row':''}"><td><b class="mono">${r.family}</b></td><td>${r.count}</td><td>${r.count===2?'ЖДЁМ 3-Й':'3+ АКТИВНА'}</td><td>№${r.last.draw} · ${r.last.combo}</td><td>${r.occurrences.map(o=>`№${o.draw}:${o.combo}`).join(' · ')}</td><td>${r.gaps.join(' / ')||'—'}</td><td class="mono">${sig(r.selfSignal)}</td></tr>`).join('')||'<tr><td colspan="7">Нет строк</td></tr>'}

function renderBeacon(){const m=authoritativeM5(),f=fc(),types=Object.keys(m.counts||{}).sort(),signal=Boolean(m.signal),level=m.main?'MAIN':m.reserve?'RESERVE':m.burst?'BURST':'NO SIGNAL';$('#beaconHeadStatus').textContent=signal?'🚨 СИГНАЛ НА ТРОЙНЮ':'— НЕТ СИГНАЛА';$('#beaconTitle').textContent=signal?'ТРОЙНЯ ОЖИДАЕТСЯ':'НЕТ СИГНАЛА НА ТРОЙНЮ';$('#beaconSub').textContent=`M5 BURST‑6/5 · ${m.total} точных связей · ${types.length} типов`;$('#beaconNext').textContent=f.draw?`№${f.draw} · ${f.date} ${f.time}`:'—';$('#beaconM5Total').textContent=m.total;$('#beaconM5Types').textContent=types.length;$('#beaconM5Burst').textContent=m.burst?'ДА':'НЕТ';$('#beaconM5Level').textContent=level;$('#beaconNavDot').classList.toggle('hot',signal);$('#beaconReasons').innerHTML=`<div class="reason ${signal?'good':''}"><b>${level}</b><span>${signal?'M5 разрешает отдельный сигнал на факт появления любой тройни.':'Порог M5 не достигнут — отдельного сигнала на тройню нет.'}</span></div>`;$('#beaconTypes').innerHTML=types.length?types.map(t=>`<span class="triple-chip">${t} ×${m.counts[t]}</span>`).join(''):'<span class="muted">Типов нет</span>';$('#beaconLinks').innerHTML=m.links.length?m.links.map(l=>`<div class="collapse-link"><span>№${l.source_draw} <b>${l.source_combo}</b></span><span>+</span><span>№${l.second_draw} <b>${l.second_combo}</b></span><span>→</span><strong>${l.triple}</strong></div>`).join(''):'<div class="muted">Точных связей в текущем окне нет.</div>'}

function renderArchive(){const rows=(state.archive20||[]).slice().reverse();$('#archiveSummary').textContent=`${rows.length} последних проверок`;$('#archiveBody').innerHTML=rows.map(r=>`<tr><td>№${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><b class="mono">${r[3]}</b></td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td></tr>`).join('');renderFullArchive()}
function renderFullArchive(){const q=($('#factsArchiveSearch')?.value||'').trim().toLowerCase();let rows=fullArchive.filter(x=>!q||String(x.draw).includes(q)||x.combo.includes(q)||x.date.includes(q));const n=rows.length;rows=rows.slice(-150).reverse();$('#factsArchiveBody').innerHTML=rows.map(x=>`<tr><td>№${x.draw}</td><td>${x.date}</td><td>${x.time}</td><td><b class="mono">${x.combo}</b></td></tr>`).join('')||'<tr><td colspan="4">Ничего не найдено</td></tr>';$('#factsArchiveSummary').textContent=`Всего ${fullArchive.length.toLocaleString('ru-RU')} · найдено ${n.toLocaleString('ru-RU')} · показано ${rows.length}`}
function when(x){try{return new Date(x).toLocaleString('ru-RU')}catch{return'—'}}
function renderSync(){if(!state)return;const m=state.syncMeta||{},local=lf(),remote=m.remoteLatest;$('#syncSource').textContent='Stoloto → GitHub AUTO';$('#syncLocalLatest').textContent=local?`№${local.draw} · ${local.combo}`:'—';$('#syncRemoteLatest').textContent=remote?`№${remote.draw} · ${remote.combo}`:'—';$('#syncAdded').textContent=m.lastAdded??0;$('#syncLastAt').textContent=m.lastSuccessAt?when(m.lastSuccessAt):'—';$('#syncRemoteAt').textContent=m.remoteUpdatedAt?when(m.remoteUpdatedAt):'—';$('#fullArchiveCount').textContent=fullArchive.length.toLocaleString('ru-RU');['syncStatus','syncTopStatus'].forEach(id=>{const e=$('#'+id);if(e){e.textContent=m.message||(autoOn()?'AUTO включён':'AUTO выключен');e.className=(id==='syncStatus'?'sync-status ':'sync-top ')+(m.status||'idle')}});if($('#autoSyncToggle'))$('#autoSyncToggle').checked=autoOn();const note=$('.sync-note');if(note)note.innerHTML='<b>AUTO:</b> архив обновляется каждые 30 минут — в <b>:00</b> и <b>:30</b>. После каждого контрольного времени приложение проверяет обновление <b>раз в минуту</b> и прекращает запросы сразу после получения нового архива; если обновление задержалось, проверки продолжаются не более <b>10 минут</b>.'}

function m6Counts(n){const c=Object.fromEntries(TARGETS.map(t=>[t,0]));analyzeM6Window(state.facts,n).forEach(r=>r.signal.forEach(t=>c[t]++));return c}
function top(c){const mx=Math.max(...Object.values(c));return mx?`${TARGETS.filter(t=>c[t]===mx).join(' / ')} · ${mx}`:'—'}
function renderLeaders(){const l=state.methodState.leader20||{},c5=m6Counts(5),c10=m6Counts(10),c20=m6Counts(20);$('#leaderHero').innerHTML=`Лидер20: <b>${sig(l.leaders)} ×${l.max_count||0}</b>`;$('#leader20Main').textContent=`${sig(l.leaders)} ×${l.max_count||0}`;$('#leader20Window').textContent=l.window||'последние 20';$('#m6Leader5').textContent=top(c5);$('#m6Leader10').textContent=top(c10);$('#m6Leader20').textContent=top(c20);const bc=Object.fromEntries(TARGETS.map(t=>[t,Number(l.counts?.[t]||0)]));$('#leaderBars').innerHTML=TARGETS.slice().sort((a,b)=>bc[b]-bc[a]).map(t=>`<div class="bar-row"><span class="mono">${t}</span><div class="bar-track"><i style="width:${Math.min(100,bc[t]*20)}%"></i></div><b>${bc[t]}</b></div>`).join('');$('#m6LeaderStats').innerHTML=`5: ${top(c5)}<br>10: ${top(c10)}<br>20: ${top(c20)}`;$('#leaderTableBody').innerHTML=TARGETS.map(t=>`<tr><td class="mono"><b>${t}</b></td><td>${bc[t]}</td><td>${c5[t]}/5</td><td>${c10[t]}/10</td><td>${c20[t]}/20</td><td>—</td></tr>`).join('')}

$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{$$('.view').forEach(v=>v.classList.toggle('active',v.id===b.dataset.tab));$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.body.classList.remove('menu-open')}));
$$('[data-repeat-filter]').forEach(b=>b.addEventListener('click',()=>{repeatFilter=b.dataset.repeatFilter;$$('[data-repeat-filter]').forEach(x=>x.classList.toggle('active',x===b));renderRepeats()}));
$('#repeatSearch')?.addEventListener('input',renderRepeats);$('#factsArchiveSearch')?.addEventListener('input',renderFullArchive);$('#syncNowBtn')?.addEventListener('click',()=>sync(true));$('#autoSyncToggle')?.addEventListener('change',e=>{localStorage.setItem(AUTO,e.target.checked?'1':'0');setupTimer();renderSync()});$('#menuBtn')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));$('#themeBtn')?.addEventListener('click',()=>{document.documentElement.classList.toggle('light');localStorage.setItem('top3-theme',document.documentElement.classList.contains('light')?'light':'dark')});
if(localStorage.getItem('top3-theme')==='light')document.documentElement.classList.add('light');
$('#resetBtn')?.addEventListener('click',()=>{if(confirm('Сбросить локальное состояние и заново синхронизировать?')){localStorage.removeItem(KEY);location.reload()}});
$('#exportBtn')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({state},null,2)],{type:'application/json'}));a.download=`TOP3_backup_${lf()?.draw||'state'}.json`;a.click()});
$('#importInput')?.addEventListener('change',async e=>{try{const d=JSON.parse(await e.target.files[0].text());state=d.state||d;rebuildAuthoritative();save();render()}catch(err){alert('Ошибка backup: '+err.message)}e.target.value=''});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&autoOn())scheduledPoll()});window.addEventListener('online',()=>{if(autoOn())scheduledPoll()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
boot();