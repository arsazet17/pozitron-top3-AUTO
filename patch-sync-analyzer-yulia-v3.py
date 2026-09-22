from pathlib import Path

APP = Path('analyzer/app.js')
TRIPLES = Path('js/engine/triples-chat.js')

s = APP.read_text(encoding='utf-8')

def must_replace(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'not found: {label}')
    return text.replace(old, new, 1)

s = must_replace(
    s,
    "import {hydrateSeed,processFact,computeM5ForNext,computeM6Strict,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';",
    "import {hydrateSeed,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';\n"
    "import {computeTripleChat} from '../js/engine/triples-chat.js';\n"
    "import {computeTripleAllLinks} from '../js/engine/triple-all-links.js';\n"
    "import {computeTripleBeacon} from '../js/engine/triple-beacon.js';\n"
    "import {computeM6V3Strict} from '../js/engine/m6-v3-strict.js';",
    'imports'
)
s = must_replace(s, "const VER='0.6.4'", "const VER='0.6.5'", 'version')
s = must_replace(
    s,
    "const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json'};",
    "const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json',full:'../data/full-archive/all.json'};",
    'remote'
)
s = must_replace(
    s,
    "let state=null,fullArchive=[],busy=false,timer=null,repeatFilter='all',lastAudit=null,lastPollMinuteKey='',completedPollSlot='';",
    "let state=null,fullArchive=[],fullCore=null,authoritative=null,busy=false,timer=null,repeatFilter='all',lastAudit=null,lastPollMinuteKey='',completedPollSlot='';",
    'globals'
)
s = must_replace(
    s,
    "const fc=()=>state?.methodState?.currentForecast||{FINAL:[]};",
    "const fc=()=>authoritative?.forecast||state?.methodState?.currentForecast||{FINAL:[]};",
    'fc'
)

anchor = "const fc=()=>authoritative?.forecast||state?.methodState?.currentForecast||{FINAL:[]};\n"
helper = r'''
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function completeFullArchive(){
  if(!fullCore)return null;
  const baseCombos=Array.isArray(fullCore.combos)?[...fullCore.combos]:(typeof fullCore.data==='string'?(fullCore.data.match(/.{3}/g)||[]):[]);
  const from=Number(fullCore.fromDraw||0),baseTo=Number(fullCore.toDraw||0);
  const tail=fullArchive.filter(x=>x.draw>baseTo).sort((a,b)=>a.draw-b.draw);
  for(const r of tail){
    const expected=from+baseCombos.length;
    if(r.draw===expected)baseCombos.push(r.combo);
  }
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
  const m4calc=computeTripleAllLinks(records),top=Number(m4calc?.ranking?.[0]?.count||0);
  const m4=top?(m4calc.ranking||[]).filter(x=>Number(x.count)===top).map(x=>x.triple):[];
  const last=records.at(-1),target=nextSlot(last);
  const m2=uniq((snap.m2||[]).map(x=>x.triple));
  const m3=uniq((snap.m3||[]).map(x=>x.triple));
  const serial=uniq((snap.serialLeaders||[]).map(x=>x.triple));
  const core=uniq(snap.frozen||[]),m6sig=uniq(m6c?.triples||[]);
  const details={};
  for(const p of (m6c?.paths||[])){
    const m=String(p).match(/→(\d{3})$/),t=m?.[1]||'M6';
    (details[t]??=[]).push(p);
  }
  const by=new Map(records.map(r=>[r.draw,r]));
  const m6view=m6c?{
    family:m6c.family,count:m6c.count,trigger:m6c.trigger,signal:m6sig,
    occurrences:(m6c.appearances||[]).map(id=>by.get(id)||{draw:id,combo:''}),details
  }:{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}};
  const forecast={
    draw:target.draw,date:target.date,time:target.time,
    M1:uniq(snap.m1||[]),M2_ready:m2,M3:m3,serial_leader:serial,
    M4_leaders:m4,M6_REPEAT_FAMILY_150:m6sig,
    FINAL_CORE:core,FINAL:core,M4_IN_FINAL:false,
    status:core.length?'FROZEN':'NO VALID NUMERIC SIGNAL'
  };
  authoritative={triple:tc,m6:m6view,m6Raw:m6calc,m4:m4calc,forecast};
  state.methodState??={};
  state.methodState.currentForecast=forecast;
  state.methodState.leader20={
    counts:{...(snap.leader?.counts||{})},
    leaders:[...(snap.leader?.leaders||[])],
    max_count:Number(snap.leader?.max||0),
    window:`последние 20 · до №${last.draw}`
  };
  state.archive20=(snap.archive||[]).slice(-20).map(r=>[r.id,r.date,r.time,r.fact,r.before,r.check,r.after]);
}
function authoritativeM5(){
  const b=computeTripleBeacon(completeFullArchive());
  const links=(b.pairs||[]).map(x=>({
    source_draw:x.sourceDraw,source_combo:x.source,
    second_draw:x.secondDraw,second_combo:x.second,triple:x.type
  }));
  return{main:false,reserve:false,burst:Boolean(b.signal),signal:Boolean(b.signal),total:links.length,links,counts:b.typeCounts||{},shared:b};
}
function currentM6(){return authoritative?.m6||{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}}}
'''
s = must_replace(s, anchor, anchor + helper, 'helper anchor')

start = s.find('function stripM4FromFinal(){')
end = s.find('\nfunction mergeArchive', start)
if start < 0 or end < 0:
    raise RuntimeError('stripM4FromFinal block not found')
s = s[:start] + "function stripM4FromFinal(){ /* authoritative shared core owns M1/M2/M3; M4/M6 stay separate. */ }" + s[end:]

boot_start = s.find('async function boot(){')
sync_start = s.find('\nasync function sync(manual=false){', boot_start)
if boot_start < 0 or sync_start < 0:
    raise RuntimeError('boot block not found')
new_boot = '''async function boot(){
  try{localStorage.removeItem(KEY)}catch{}
  const seed=await fetchJSON('./seed.json');state=hydrateSeed(seed);state.appVersion=VER;state.syncMeta??={};
  try{fullCore=await fetchJSON(REMOTE.full)}catch{fullCore=null}
  try{const rows=await fetchJSON(REMOTE.archive);mergeArchive(rows)}catch{mergeArchive(state.facts)}
  rebuildAuthoritative();save();render();setupTimer();
}
'''
s = s[:boot_start] + new_boot + s[sync_start+1:]

sync_start = s.find('async function sync(manual=false){')
sched_start = s.find('\nasync function scheduledPoll(){', sync_start)
if sync_start < 0 or sched_start < 0:
    raise RuntimeError('sync block not found')
new_sync = r'''async function sync(manual=false){
  if(busy)return false;busy=true;
  try{
    const slot=pollSlot();
    setStatus('working',manual?'Обновляю сейчас…':'Проверка обновления архива…');
    const lp=await fetchJSON(REMOTE.latest),remote=norm(lp.draw||lp.latest||lp);
    if(!remote)throw Error('latest.json: неверный формат');
    state.syncMeta.remoteLatest=remote;state.syncMeta.remoteUpdatedAt=lp.updatedAt||null;
    const localNo=Number(lf()?.draw||0);
    if(remote.draw<=localNo){
      const slotReady=remoteUpdatedForSlot(lp.updatedAt,slot);
      if(slotReady)completedPollSlot=slot.key;
      state.syncMeta.lastAdded=0;state.syncMeta.lastSuccessAt=new Date().toISOString();
      setStatus(slot.active&&!slotReady?'working':'ok',slot.active&&!slotReady?'Архив ещё не обновился · повтор через 1 мин':'Архив актуален');
      render();return slotReady;
    }
    const oldFinal=[...(fc().FINAL||[])],oldM6=[...(fc().M6_REPEAT_FAMILY_150||[])];
    const rows=await fetchJSON(REMOTE.archive);
    if(!Array.isArray(rows))throw Error('archive.json: неверный формат');
    mergeArchive(rows);
    const by=new Map(fullArchive.map(x=>[x.draw,x]));
    for(let n=localNo+1;n<=remote.draw;n++)if(!by.get(n))throw Error(`Пропущен №${n} в удалённом архиве`);
    const added=Math.max(0,remote.draw-localNo);
    rebuildAuthoritative();
    lastAudit={
      oldFinal,
      check:oldFinal.length?(oldFinal.includes(remote.combo)?'HIT':'MISS'):'NO SIGNAL',
      final:[...(fc().FINAL||[])],
      m6:{signal:[...(fc().M6_REPEAT_FAMILY_150||[])],old:oldM6}
    };
    state.appVersion=VER;state.syncMeta.lastAdded=added;state.syncMeta.lastSuccessAt=new Date().toISOString();state.syncMeta.remoteLatest=remote;
    if(slot.active&&added>0)completedPollSlot=slot.key;
    save();setStatus('ok',`Загружено: ${added} · до №${remote.draw}`);render();return added>0;
  }catch(e){state.syncMeta.lastError=String(e.message||e);setStatus('error',`Ошибка AUTO: ${e.message||e}`);return false}finally{busy=false;renderSync()}
}
'''
s = s[:sync_start] + new_sync + s[sched_start+1:]

s = must_replace(s, 'function render(){stripM4FromFinal();renderMain();', 'function render(){renderMain();', 'render')
s = must_replace(s, 'const x=lf(),f=fc(),m5=computeM5ForNext(state.facts),m6=computeM6Strict(state.facts);', 'const x=lf(),f=fc(),m5=authoritativeM5(),m6=currentM6();', 'renderMain')
s = must_replace(s, 'function renderBeacon(){const m=computeM5ForNext(state.facts),f=fc(),', 'function renderBeacon(){const m=authoritativeM5(),f=fc(),', 'renderBeacon')
# Imported backups should also be rebuilt by the authoritative core instead of reusing obsolete Analyzer engine state.
s = s.replace("state=d.state||d;stripM4FromFinal();save();render()", "state=d.state||d;rebuildAuthoritative();save();render()")
APP.write_text(s, encoding='utf-8')

# Match Yulia v1.2.13 serial-leader semantics exactly: only second consecutive addition birth activates TTL=5; 3rd+ does not restart it.
t = TRIPLES.read_text(encoding='utf-8')
a = t.find('export function advanceSerialLeaders(')
b = t.find('\nfunction chronological', a)
if a < 0 or b < 0:
    raise RuntimeError('serial leader block not found')
serial_fn = r'''export function advanceSerialLeaders(active=[],previousStreaks={},additionBirths=[],currentId=0){
  const births=uniq((additionBirths||[]).filter(isTriple));
  const streaks={};
  for(const triple of births){
    const prev=previousStreaks?.[triple];
    const consecutive=prev&&Number(prev.lastId)===Number(currentId)-1;
    streaks[triple]={len:consecutive?Number(prev.len||1)+1:1,lastId:Number(currentId)};
  }
  const next=(active||[]).map(x=>({...x,rem:Number(x.rem||0)-1})).filter(x=>x.rem>0);
  const events=[];
  if(Number(currentId)>=SERIAL_LEADER_RULE_START_ID){
    for(const [triple,streak] of Object.entries(streaks)){
      if(Number(streak.len)!==2||next.some(x=>x.triple===triple))continue;
      next.push({triple,rem:SERIAL_LEADER_TTL,streak:2,activatedAt:Number(currentId),lastBirthAt:Number(currentId)});
      events.push(`${triple}: сложением 2 тиража подряд → НОВЫЙ ЛИДЕР на ${SERIAL_LEADER_TTL} тиражей`);
    }
  }
  next.sort((x,y)=>tripleSort(x.triple,y.triple));
  return {active:next,streaks,events};
}
'''
t = t[:a] + serial_fn + t[b:]
TRIPLES.write_text(t, encoding='utf-8')

for name in ('analyzer/index.html','analyzer/sw.js'):
    p=Path(name); q=p.read_text(encoding='utf-8')
    q=q.replace('0.6.4','0.6.5').replace('v064','v065').replace('064','065')
    p.write_text(q,encoding='utf-8')

print('OK: Analyzer v0.6.5 now uses the same M1/M2/M3, M4, M5 and M6 calculation modules as Yulia.')
