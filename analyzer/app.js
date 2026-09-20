import {hydrateSeed,processFact,computeM5ForNext,computeM6Strict,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const VER='0.6.2', KEY='top3-analyzer-online-state-v060', AUTO='top3-analyzer-auto-v1';
const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json'};
let state=null,fullArchive=[],busy=false,timer=null,repeatFilter='all',lastAudit=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sig=a=>a?.length?a.join(' / '):'—';
const ruDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s).split('-').reverse().join('.'):String(s||'');
const isoDate=s=>/^\d{2}\.\d{2}\.\d{4}$/.test(String(s||''))?String(s).split('.').reverse().join('-'):String(s||'');
const norm=x=>{if(!x)return null;const combo=String(x.combo??((x.A!=null&&x.B!=null&&x.C!=null)?`${x.A}${x.B}${x.C}`:'')).padStart(3,'0'),draw=Number(x.draw),time=String(x.time||'').slice(0,5);if(!Number.isInteger(draw)||!/^\d{3}$/.test(combo)||!/^\d{2}:\d{2}$/.test(time))return null;return{draw,date:ruDate(x.date),time,combo}};
const fetchJSON=async url=>{const r=await fetch(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const autoOn=()=>localStorage.getItem(AUTO)!=='0';
const lf=()=>state?.facts?.at(-1)||null;
const fc=()=>state?.methodState?.currentForecast||{FINAL:[]};

function stripM4FromFinal(){
  const f=state?.methodState?.currentForecast;if(!f)return;
  const core=[...(f.M1||[]),...(f.M2_ready||[]),...(f.M3||[]),...(f.serial_leader||[])];
  f.FINAL_CORE=[...new Set(core.filter(Boolean))];
  f.FINAL=[...new Set([...f.FINAL_CORE,...(f.M6_REPEAT_FAMILY_150||[])].filter(Boolean))];
  f.M4_IN_FINAL=false;
  f.status=f.FINAL.length?'FROZEN':'NO VALID NUMERIC SIGNAL';
}
function mergeArchive(rows){const m=new Map(fullArchive.map(x=>[x.draw,x]));for(const r0 of rows||[]){const r=norm(r0);if(r)m.set(r.draw,r)}fullArchive=[...m.values()].sort((a,b)=>a.draw-b.draw)}
function countsThrough(draw){const c={};for(const x of fullArchive){if(x.draw>draw)break;c[x.combo]=(c[x.combo]||0)+1}return c}
function setStatus(kind,msg){state.syncMeta??={};state.syncMeta.status=kind;state.syncMeta.message=msg;save();renderSync()}

async function boot(){
  const saved=localStorage.getItem(KEY);
  if(saved){state=JSON.parse(saved)}else{const seed=await fetchJSON('./seed.json');state=hydrateSeed(seed)}
  stripM4FromFinal();state.appVersion=VER;state.syncMeta??={};save();
  try{const rows=await fetchJSON(REMOTE.archive);mergeArchive(rows)}catch{mergeArchive(state.facts)}
  render();setupTimer();sync(false).catch(()=>{});
}

async function sync(manual=false){
  if(busy)return;busy=true;
  try{
    setStatus('working',manual?'Обновляю сейчас…':'Проверка обновлений…');
    const lp=await fetchJSON(REMOTE.latest),remote=norm(lp.draw||lp.latest||lp);
    if(!remote)throw Error('latest.json: неверный формат');
    state.syncMeta.remoteLatest=remote;state.syncMeta.remoteUpdatedAt=lp.updatedAt||null;
    const localNo=Number(lf()?.draw||0);
    if(remote.draw<=localNo){state.syncMeta.lastAdded=0;state.syncMeta.lastSuccessAt=new Date().toISOString();setStatus('ok','Архив актуален');render();return}
    const rows=await fetchJSON(REMOTE.archive);if(!Array.isArray(rows))throw Error('archive.json: неверный формат');
    mergeArchive(rows);
    const by=new Map(fullArchive.map(x=>[x.draw,x]));
    for(const old of state.facts.slice(-80)){const r=by.get(Number(old.draw));if(r&&(r.combo!==old.combo||r.time!==old.time||isoDate(r.date)!==isoDate(old.date)))throw Error(`Конфликт №${old.draw}: локально ${old.combo}, источник ${r.combo}`)}
    const missing=[];for(let n=localNo+1;n<=remote.draw;n++){const r=by.get(n);if(!r)throw Error(`Пропущен №${n} в удалённом архиве`);missing.push(r)}
    let comboCounts=countsThrough(localNo),added=0;
    for(const fact of missing){state.mirrorExactCounts={...comboCounts};const res=processFact(state,fact);state=res.state;lastAudit=res.audit;comboCounts[fact.combo]=(comboCounts[fact.combo]||0)+1;added++}
    stripM4FromFinal();state.mirrorExactCounts={...comboCounts};state.appVersion=VER;state.syncMeta.lastAdded=added;state.syncMeta.lastSuccessAt=new Date().toISOString();state.syncMeta.remoteLatest=remote;save();setStatus('ok',`Загружено: ${added} · до №${remote.draw}`);render();
  }catch(e){state.syncMeta.lastError=String(e.message||e);setStatus('error',`Ошибка AUTO: ${e.message||e}`)}finally{busy=false;renderSync()}
}

function setupTimer(){if(timer)clearInterval(timer);if(autoOn())timer=setInterval(()=>sync(false),120000)}
function render(){stripM4FromFinal();renderMain();renderRepeats();renderBeacon();renderArchive();renderLeaders();renderSync()}
function renderMain(){
  const x=lf(),f=fc(),m5=computeM5ForNext(state.facts),m6=computeM6Strict(state.facts);
  $('#version').textContent='v'+VER;$('#currentFact').textContent=x?`№${x.draw} · ${x.date} ${x.time} · ${x.combo}`:'—';$('#nextDraw').textContent=f.draw?`№${f.draw} · ${f.date} ${f.time}`:'—';
  $('#lastResult').textContent=x?.combo||'—';$('#lastResultMeta').textContent=x?`№${x.draw} · ${x.date} ${x.time}`:'—';$('#finalFrozen').textContent=sig(f.FINAL);$('#finalFrozenTarget').textContent=f.draw?`На №${f.draw} · ${f.date} ${f.time}`:'—';
  [['#m1Card',f.M1],['#m2Card',f.M2_ready],['#m3Card',f.M3],['#m4Card',f.M4_leaders],['#m6Card',f.M6_REPEAT_FAMILY_150]].forEach(([id,v])=>$(id).textContent=sig(v));$('#m5Card').textContent=m5.main?'MAIN':m5.reserve?'RESERVE':'NO SIGNAL';
  const m4Label=$('#m4Card')?.previousElementSibling;if(m4Label)m4Label.textContent='M4 · Итог (вне Frozen)';
  $('#m6Family').textContent=m6.family||'—';$('#m6Count').textContent=m6.count??'—';$('#m6Trigger').textContent=m6.trigger?'ДА':'НЕТ';$('#m6Result').textContent=sig(m6.signal);
  $('#m6Occurrences').innerHTML=(m6.occurrences||[]).map((o,i)=>`<span class="chip">${i+1}. №${o.draw} ${o.combo}</span>`).join(' ')||'<span class="muted">Нет</span>';
  $('#m6Paths').innerHTML=Object.entries(m6.details||{}).map(([t,p])=>`<details><summary><b>${t}</b> · ${p.length} путей</summary><div class="mono">${p.slice(0,12).map(esc).join('<br>')}</div></details>`).join('')||'<span class="muted">Нет M6-сигнала</span>';
  $('#auditBox').innerHTML=lastAudit?`<div class="audit-grid"><div><span>Frozen ДО</span><b>${sig(lastAudit.oldFinal)}</b></div><div><span>Проверка</span><b>${lastAudit.check}</b></div><div><span>Новый Frozen</span><b>${sig(lastAudit.final)}</b></div><div><span>M6</span><b>${sig(lastAudit.m6.signal)}</b></div></div>`:`<div class="audit-grid"><div><span>Текущий Frozen</span><b>${sig(f.FINAL)}</b></div><div><span>Статус</span><b>${esc(f.status||'—')}</b></div></div>`;
}

function renderRepeats(){const a=analyzeFamilyRepeats150(state.facts),cur=a.rows.find(r=>r.current);$('#repeatWindow').textContent=a.start&&a.end?`№${a.start.draw} → №${a.end.draw}`:'—';$('#repeat2Count').textContent=a.repeat2plus;$('#repeat3Count').textContent=a.repeat3plus;$('#repeatCurrent').textContent=a.currentFamily||'—';$('#repeatCurrentStatus').textContent=`${a.currentCount} появлений /150${a.currentCount===2?' · ждём 3-й':a.currentCount>=3?' · M6 trigger':' · без сигнала'}`;$('#repeatSummary').textContent=`2+: ${a.repeat2plus} · 3+: ${a.repeat3plus}`;
  const q=($('#repeatSearch')?.value||'').trim();let rows=a.rows.filter(r=>(repeatFilter==='two'?r.count===2:repeatFilter==='hot'?r.count>=3:true)&&(!q||r.family.includes(q)));$('#repeatBody').innerHTML=rows.map(r=>`<tr class="${r.current?'current-row':''}"><td><b class="mono">${r.family}</b></td><td>${r.count}</td><td>${r.count===2?'ЖДЁМ 3-Й':'3+ АКТИВНА'}</td><td>№${r.last.draw} · ${r.last.combo}</td><td>${r.occurrences.map(o=>`№${o.draw}:${o.combo}`).join(' · ')}</td><td>${r.gaps.join(' / ')||'—'}</td><td class="mono">${sig(r.selfSignal)}</td></tr>`).join('')||'<tr><td colspan="7">Нет строк</td></tr>'}

function renderBeacon(){const m=computeM5ForNext(state.facts),f=fc(),types=Object.keys(m.counts||{}).sort(),signal=m.main||m.reserve||m.burst,level=m.main?'MAIN':m.reserve?'RESERVE':m.burst?'BURST':'NO SIGNAL';$('#beaconHeadStatus').textContent=signal?'🚨 СИГНАЛ НА ТРОЙНЮ':'— НЕТ СИГНАЛА';$('#beaconTitle').textContent=signal?'ТРОЙНЯ ОЖИДАЕТСЯ':'НЕТ СИГНАЛА НА ТРОЙНЮ';$('#beaconSub').textContent=`M5 BURST‑6/5 · ${m.total} точных связей · ${types.length} типов`;$('#beaconNext').textContent=f.draw?`№${f.draw} · ${f.date} ${f.time}`:'—';$('#beaconM5Total').textContent=m.total;$('#beaconM5Types').textContent=types.length;$('#beaconM5Burst').textContent=m.burst?'ДА':'НЕТ';$('#beaconM5Level').textContent=level;$('#beaconNavDot').classList.toggle('hot',signal);$('#beaconReasons').innerHTML=`<div class="reason ${signal?'good':''}"><b>${level}</b><span>${signal?'M5 разрешает отдельный сигнал на факт появления любой тройни.':'Порог M5 не достигнут — отдельного сигнала на тройню нет.'}</span></div>`;$('#beaconTypes').innerHTML=types.length?types.map(t=>`<span class="triple-chip">${t} ×${m.counts[t]}</span>`).join(''):'<span class="muted">Типов нет</span>';$('#beaconLinks').innerHTML=m.links.length?m.links.map(l=>`<div class="collapse-link"><span>№${l.source_draw} <b>${l.source_combo}</b></span><span>+</span><span>№${l.second_draw} <b>${l.second_combo}</b></span><span>→</span><strong>${l.triple}</strong></div>`).join(''):'<div class="muted">Точных связей в текущем окне нет.</div>'}

function renderArchive(){const rows=(state.archive20||[]).slice().reverse();$('#archiveSummary').textContent=`${rows.length} последних проверок`;$('#archiveBody').innerHTML=rows.map(r=>`<tr><td>№${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><b class="mono">${r[3]}</b></td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td></tr>`).join('');renderFullArchive()}
function renderFullArchive(){const q=($('#factsArchiveSearch')?.value||'').trim().toLowerCase();let rows=fullArchive.filter(x=>!q||String(x.draw).includes(q)||x.combo.includes(q)||x.date.includes(q));const n=rows.length;rows=rows.slice(-150).reverse();$('#factsArchiveBody').innerHTML=rows.map(x=>`<tr><td>№${x.draw}</td><td>${x.date}</td><td>${x.time}</td><td><b class="mono">${x.combo}</b></td></tr>`).join('')||'<tr><td colspan="4">Ничего не найдено</td></tr>';$('#factsArchiveSummary').textContent=`Всего ${fullArchive.length.toLocaleString('ru-RU')} · найдено ${n.toLocaleString('ru-RU')} · показано ${rows.length}`}
function when(x){try{return new Date(x).toLocaleString('ru-RU')}catch{return'—'}}
function renderSync(){if(!state)return;const m=state.syncMeta||{},local=lf(),remote=m.remoteLatest;$('#syncSource').textContent='Stoloto → GitHub AUTO';$('#syncLocalLatest').textContent=local?`№${local.draw} · ${local.combo}`:'—';$('#syncRemoteLatest').textContent=remote?`№${remote.draw} · ${remote.combo}`:'—';$('#syncAdded').textContent=m.lastAdded??0;$('#syncLastAt').textContent=m.lastSuccessAt?when(m.lastSuccessAt):'—';$('#syncRemoteAt').textContent=m.remoteUpdatedAt?when(m.remoteUpdatedAt):'—';$('#fullArchiveCount').textContent=fullArchive.length.toLocaleString('ru-RU');['syncStatus','syncTopStatus'].forEach(id=>{const e=$('#'+id);if(e){e.textContent=m.message||(autoOn()?'AUTO включён':'AUTO выключен');e.className=(id==='syncStatus'?'sync-status ':'sync-top ')+(m.status||'idle')}});if($('#autoSyncToggle'))$('#autoSyncToggle').checked=autoOn()}

function m6Counts(n){const c=Object.fromEntries(TARGETS.map(t=>[t,0]));analyzeM6Window(state.facts,n).forEach(r=>r.signal.forEach(t=>c[t]++));return c}
function top(c){const mx=Math.max(...Object.values(c));return mx?`${TARGETS.filter(t=>c[t]===mx).join(' / ')} · ${mx}`:'—'}
function renderLeaders(){const l=state.methodState.leader20||{},c5=m6Counts(5),c10=m6Counts(10),c20=m6Counts(20);$('#leaderHero').innerHTML=`Лидер20: <b>${sig(l.leaders)} ×${l.max_count||0}</b>`;$('#leader20Main').textContent=`${sig(l.leaders)} ×${l.max_count||0}`;$('#leader20Window').textContent=l.window||'последние 20';$('#m6Leader5').textContent=top(c5);$('#m6Leader10').textContent=top(c10);$('#m6Leader20').textContent=top(c20);const bc=Object.fromEntries(TARGETS.map(t=>[t,Number(l.counts?.[t]||0)]));$('#leaderBars').innerHTML=TARGETS.slice().sort((a,b)=>bc[b]-bc[a]).map(t=>`<div class="bar-row"><span class="mono">${t}</span><div class="bar-track"><i style="width:${Math.min(100,bc[t]*20)}%"></i></div><b>${bc[t]}</b></div>`).join('');$('#m6LeaderStats').innerHTML=`5: ${top(c5)}<br>10: ${top(c10)}<br>20: ${top(c20)}`;$('#leaderTableBody').innerHTML=TARGETS.map(t=>`<tr><td class="mono"><b>${t}</b></td><td>${bc[t]}</td><td>${c5[t]}/5</td><td>${c10[t]}/10</td><td>${c20[t]}/20</td><td>—</td></tr>`).join('')}

$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{$$('.view').forEach(v=>v.classList.toggle('active',v.id===b.dataset.tab));$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.body.classList.remove('menu-open')}));
$$('[data-repeat-filter]').forEach(b=>b.addEventListener('click',()=>{repeatFilter=b.dataset.repeatFilter;$$('[data-repeat-filter]').forEach(x=>x.classList.toggle('active',x===b));renderRepeats()}));
$('#repeatSearch')?.addEventListener('input',renderRepeats);$('#factsArchiveSearch')?.addEventListener('input',renderFullArchive);$('#syncNowBtn')?.addEventListener('click',()=>sync(true));$('#autoSyncToggle')?.addEventListener('change',e=>{localStorage.setItem(AUTO,e.target.checked?'1':'0');setupTimer();renderSync()});$('#menuBtn')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));$('#themeBtn')?.addEventListener('click',()=>{document.documentElement.classList.toggle('light');localStorage.setItem('top3-theme',document.documentElement.classList.contains('light')?'light':'dark')});
if(localStorage.getItem('top3-theme')==='light')document.documentElement.classList.add('light');
$('#resetBtn')?.addEventListener('click',()=>{if(confirm('Сбросить локальное состояние и заново синхронизировать?')){localStorage.removeItem(KEY);location.reload()}});
$('#exportBtn')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({state},null,2)],{type:'application/json'}));a.download=`TOP3_backup_${lf()?.draw||'state'}.json`;a.click()});
$('#importInput')?.addEventListener('change',async e=>{try{const d=JSON.parse(await e.target.files[0].text());state=d.state||d;stripM4FromFinal();save();render()}catch(err){alert('Ошибка backup: '+err.message)}e.target.value=''});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&autoOn())sync(false)});window.addEventListener('online',()=>{if(autoOn())sync(false)});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
boot();