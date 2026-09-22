import fs from 'node:fs';

function mustReplace(text, from, to, label){
  if(!text.includes(from)) throw new Error(`not found: ${label}`);
  return text.replace(from,to);
}

const appPath='analyzer/app.js';
let s=fs.readFileSync(appPath,'utf8');

s=mustReplace(s,
"import {hydrateSeed,processFact,computeM5ForNext,computeM6Strict,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';",
"import {hydrateSeed,analyzeM6Window,analyzeFamilyRepeats150,TARGETS} from './engine.js';\nimport {computeTripleChat} from '../js/engine/triples-chat.js';\nimport {computeTripleAllLinks} from '../js/engine/triple-all-links.js';\nimport {computeTripleBeacon} from '../js/engine/triple-beacon.js';\nimport {computeM6V3Strict} from '../js/engine/m6-v3-strict.js';",
'import');

s=s.replace("const VER='0.6.4'", "const VER='0.6.5'");
s=mustReplace(s,
"const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json'};",
"const REMOTE={latest:'../data/latest.json',archive:'../data/archive.json',full:'../data/full-archive/all.json'};",
'REMOTE');
s=mustReplace(s,
"let state=null,fullArchive=[],busy=false,timer=null,repeatFilter='all',lastAudit=null,lastPollMinuteKey='',completedPollSlot='';",
"let state=null,fullArchive=[],fullCore=null,authoritative=null,busy=false,timer=null,repeatFilter='all',lastAudit=null,lastPollMinuteKey='',completedPollSlot='';",
'globals');
s=mustReplace(s,
"const fc=()=>state?.methodState?.currentForecast||{FINAL:[]};",
"const fc=()=>authoritative?.forecast||state?.methodState?.currentForecast||{FINAL:[]};",
'fc');

const fcAnchor="const fc=()=>authoritative?.forecast||state?.methodState?.currentForecast||{FINAL:[]};\n";
const helper=String.raw`
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
  const records=fullArchive.filter(x=>x.draw>=267959).sort((a,b)=>a.draw-b.draw);
  if(!records.length)return;
  state.facts=records;
  const full=completeFullArchive();
  const tc=computeTripleChat(records,full),snap=tc.snapshot||{};
  const m6calc=computeM6V3Strict({records,fullArchive:full}),m6c=m6calc.current||null;
  const m4calc=computeTripleAllLinks(records),top=Number(m4calc?.ranking?.[0]?.count||0),m4=top?(m4calc.ranking||[]).filter(x=>Number(x.count)===top).map(x=>x.triple):[];
  const last=records.at(-1),target=nextSlot(last);
  const m2=uniq((snap.m2||[]).map(x=>x.triple)),m3=uniq((snap.m3||[]).map(x=>x.triple)),serial=uniq((snap.serialLeaders||[]).map(x=>x.triple));
  const core=uniq(snap.frozen||[]),m6sig=uniq(m6c?.triples||[]);
  const details={};for(const p of (m6c?.paths||[])){const m=String(p).match(/→(\d{3})$/),t=m?.[1]||'M6';(details[t]??=[]).push(p)}
  const by=new Map(records.map(r=>[r.draw,r]));
  const m6view=m6c?{family:m6c.family,count:m6c.count,trigger:m6c.trigger,signal:m6sig,occurrences:(m6c.appearances||[]).map(id=>by.get(id)||{draw:id,combo:''}),details}:{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}};
  const forecast={draw:target.draw,date:target.date,time:target.time,M1:uniq(snap.m1||[]),M2_ready:m2,M3:m3,serial_leader:serial,M4_leaders:m4,M6_REPEAT_FAMILY_150:m6sig,FINAL_CORE:core,FINAL:core,M4_IN_FINAL:false,status:core.length?'FROZEN':'NO VALID NUMERIC SIGNAL'};
  authoritative={triple:tc,m6:m6view,m6Raw:m6calc,m4:m4calc,forecast};
  state.methodState??={};state.methodState.currentForecast=forecast;
}
function authoritativeM5(){
  const b=computeTripleBeacon(completeFullArchive());
  const links=(b.pairs||[]).map(x=>({source_draw:x.sourceDraw,source_combo:x.source,second_draw:x.secondDraw,second_combo:x.second,triple:x.type}));
  return{main:false,reserve:false,burst:Boolean(b.signal),signal:Boolean(b.signal),total:links.length,links,counts:b.typeCounts||{},shared:b};
}
function currentM6(){return authoritative?.m6||{family:'',count:0,trigger:false,signal:[],occurrences:[],details:{}}}
`;
s=s.replace(fcAnchor,fcAnchor+helper);

const stripStart=s.indexOf('function stripM4FromFinal(){');
const stripEnd=s.indexOf('\nfunction mergeArchive',stripStart);
if(stripStart<0||stripEnd<0)throw new Error('stripM4FromFinal block not found');
s=s.slice(0,stripStart)+"function stripM4FromFinal(){ /* authoritative Yulia core owns FINAL; M4/M6 stay separate. */ }"+s.slice(stripEnd);

const bootStart=s.indexOf('async function boot(){');
const syncStart=s.indexOf('\nasync function sync(manual=false){',bootStart);
if(bootStart<0||syncStart<0)throw new Error('boot block not found');
const newBoot=`async function boot(){\n  try{localStorage.removeItem(KEY)}catch{}\n  const seed=await fetchJSON('./seed.json');state=hydrateSeed(seed);state.appVersion=VER;state.syncMeta??={};\n  try{fullCore=await fetchJSON(REMOTE.full)}catch{fullCore=null}\n  try{const rows=await fetchJSON(REMOTE.archive);mergeArchive(rows)}catch{mergeArchive(state.facts)}\n  rebuildAuthoritative();save();render();setupTimer();\n}\n`;
s=s.slice(0,bootStart)+newBoot+s.slice(syncStart+1);

const syncS=s.indexOf('async function sync(manual=false){');
const schedS=s.indexOf('\nasync function scheduledPoll(){',syncS);
if(syncS<0||schedS<0)throw new Error('sync block not found');
const newSync=`async function sync(manual=false){\n  if(busy)return false;busy=true;\n  try{\n    const slot=pollSlot();setStatus('working',manual?'Обновляю сейчас…':'Проверка обновления архива…');\n    const lp=await fetchJSON(REMOTE.latest),remote=norm(lp.draw||lp.latest||lp);if(!remote)throw Error('latest.json: неверный формат');\n    state.syncMeta.remoteLatest=remote;state.syncMeta.remoteUpdatedAt=lp.updatedAt||null;\n    const localNo=Number(lf()?.draw||0);\n    if(remote.draw<=localNo){const slotReady=remoteUpdatedForSlot(lp.updatedAt,slot);if(slotReady)completedPollSlot=slot.key;state.syncMeta.lastAdded=0;state.syncMeta.lastSuccessAt=new Date().toISOString();setStatus(slot.active&&!slotReady?'working':'ok',slot.active&&!slotReady?'Архив ещё не обновился · повтор через 1 мин':'Архив актуален');render();return slotReady}\n    const oldFinal=[...(fc().FINAL||[])],oldM6=[...(fc().M6_REPEAT_FAMILY_150||[])];\n    const rows=await fetchJSON(REMOTE.archive);if(!Array.isArray(rows))throw Error('archive.json: неверный формат');mergeArchive(rows);\n    const by=new Map(fullArchive.map(x=>[x.draw,x]));for(let n=localNo+1;n<=remote.draw;n++)if(!by.get(n))throw Error(\`Пропущен №\${n} в удалённом архиве\`);\n    const added=Math.max(0,remote.draw-localNo);rebuildAuthoritative();\n    lastAudit={oldFinal,check:oldFinal.length?(oldFinal.includes(remote.combo)?'HIT':'MISS'):'NO SIGNAL',final:[...(fc().FINAL||[])],m6:{signal:[...(fc().M6_REPEAT_FAMILY_150||[])],old:oldM6}};\n    state.appVersion=VER;state.syncMeta.lastAdded=added;state.syncMeta.lastSuccessAt=new Date().toISOString();state.syncMeta.remoteLatest=remote;if(slot.active&&added>0)completedPollSlot=slot.key;\n    save();setStatus('ok',\`Загружено: \${added} · до №\${remote.draw}\`);render();return added>0;\n  }catch(e){state.syncMeta.lastError=String(e.message||e);setStatus('error',\`Ошибка AUTO: \${e.message||e}\`);return false}finally{busy=false;renderSync()}\n}\n`;
s=s.slice(0,syncS)+newSync+s.slice(schedS+1);

s=mustReplace(s,"function render(){stripM4FromFinal();renderMain();","function render(){renderMain();",'render');
s=mustReplace(s,"const x=lf(),f=fc(),m5=computeM5ForNext(state.facts),m6=computeM6Strict(state.facts);","const x=lf(),f=fc(),m5=authoritativeM5(),m6=currentM6();",'renderMain');
s=mustReplace(s,"function renderBeacon(){const m=computeM5ForNext(state.facts),f=fc(),","function renderBeacon(){const m=authoritativeM5(),f=fc(),",'renderBeacon');
fs.writeFileSync(appPath,s);

const tPath='js/engine/triples-chat.js';
let t=fs.readFileSync(tPath,'utf8');
const a=t.indexOf('export function advanceSerialLeaders('),b=t.indexOf('\nfunction chronological',a);
if(a<0||b<0)throw new Error('serial leader block not found');
const serialFn=String.raw`export function advanceSerialLeaders(active=[],previousStreaks={},additionBirths=[],currentId=0){
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
`;
t=t.slice(0,a)+serialFn+t.slice(b);fs.writeFileSync(tPath,t);

for(const p of ['analyzer/index.html','analyzer/sw.js']){
  let q=fs.readFileSync(p,'utf8');
  q=q.replaceAll('0.6.4','0.6.5').replaceAll('v064','v065').replaceAll('064','065');
  fs.writeFileSync(p,q);
}
console.log('OK: Analyzer v0.6.5 uses the same shared M1/M2/M3/M4/M5/M6 calculation core as Yulia.');
