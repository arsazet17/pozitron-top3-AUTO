import {loadState,saveState} from "./storage.js";
import {nextTarget,sortRecords} from "./engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast} from "./engine/chat-master.js";
import {createMirrorState} from "./engine/mirror15.js";
import {renderHome,mountedHome} from "./pages/home.js";
import {renderForecasts,mountedForecasts} from "./pages/forecasts.js";
import {renderArchive,mountedArchive} from "./pages/archive.js";
import {renderAlgorithm} from "./pages/algorithm.js";
import {renderStats} from "./pages/stats.js";
import {renderTriples} from "./pages/triples.js";
import {renderMirror} from "./pages/mirror.js";
import {renderSettings} from "./pages/settings.js";
import {bindCollapsibles} from "./ui.js";

const loadJSON=async p=>{const r=await fetch(p+(p.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(`${p}: ${r.status}`);return r.json()};
const optionalJSON=async(p,fallback)=>{try{return await loadJSON(p)}catch{return fallback}};
let ctx=null,state=loadState()||{},page=location.hash.slice(1)||"home";

function toast(s){const x=document.querySelector("#toast");if(!x)return;x.textContent=s;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2400)}
function recentForecasts(){return state.recentForecasts||state.forecastHistory||[]}
function pendingIssue(target){const key=`${target.date}|${target.time}`;return [...recentForecasts()].reverse().find(x=>x.key===key||`${x.target?.date}|${x.target?.time}`===key)}
function recordKey(x){return x?.draw!=null&&String(x.draw)!==""?`d:${Number(x.draw)}`:`t:${x?.date||""}|${x?.time||""}|${x?.combo||""}`}
function mergeRecords(base=[],extra=[]){const m=new Map();for(const x of [...base,...extra])if(x&&/^\d{3}$/.test(String(x.combo||"")))m.set(recordKey(x),x);return sortRecords([...m.values()])}
function decodePacked(part){const s=String(part?.data||"");const out=[];for(let i=0;i+2<s.length;i+=3)out.push(s.slice(i,i+3));return out}
function pad2(n){return String(n).padStart(2,"0")}
function addMinutesStamp(date,time,minutes){const [y,m,d]=String(date).split("-").map(Number),[hh,mm]=String(time).split(":").map(Number),x=new Date(Date.UTC(y,m-1,d,hh,mm)+minutes*60000);return {date:`${x.getUTCFullYear()}-${pad2(x.getUTCMonth()+1)}-${pad2(x.getUTCDate())}`,time:`${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}`}}
function expandBootstrap(meta){if(!meta?.data)return[];const combos=decodePacked(meta),out=[];for(let i=0;i<combos.length;i++){const stamp=i===0?meta.first:addMinutesStamp(meta.regularStart.date,meta.regularStart.time,(i-1)*Number(meta.stepMinutes||30)),combo=combos[i];out.push({date:stamp.date,time:stamp.time,A:+combo[0],B:+combo[1],C:+combo[2],combo,draw:String(Number(meta.fromDraw)+i)})}return out}
async function loadFullArchive(){
  try{
    const packed=await loadJSON("./data/full-archive/all.json");
    const combos=decodePacked(packed);
    if(combos.length!==Number(packed.total||0))throw new Error(`полный архив: ожидалось ${packed.total}, получено ${combos.length}`);
    return {...packed,combos,comboSet:new Set(combos)};
  }catch(e){console.warn("Полный архив не загружен:",e);return null}
}
function extendFullArchive(full,records){
  if(!full?.combos?.length)return full;
  const latest=Number(full.toDraw||0), extras=[...records].filter(x=>Number(x.draw)>latest).sort((a,b)=>Number(a.draw)-Number(b.draw));
  let expected=latest+1;
  for(const r of extras){const d=Number(r.draw);if(d!==expected)break;full.combos.push(String(r.combo));full.comboSet.add(String(r.combo));full.toDraw=d;expected=d+1}
  full.total=full.combos.length;full.datedCount=records.length;full.datedToDraw=Math.max(Number(full.datedToDraw||0),...records.map(x=>Number(x.draw)||0));
  return full;
}
function makeCtx(){
  const records=sortRecords(ctx.records),target=nextTarget(records,ctx.rules.schedule),saved=pendingIssue(target);
  const mirror=createMirrorState(records,ctx.rules,undefined,ctx.fullArchive?.comboSet);
  const issue=saved?.schema===CHAT_MASTER_SCHEMA&&!saved.factAfter?saved:{...computeChatForecast(records,target,ctx.rules,state),key:`${target.date}|${target.time}`,issuedAt:"browser-preview",factAfter:null,factAt:null,audit:null,mirror:mirror.lastSignals||[]};
  const mirrorPred=Array.isArray(issue.mirror)?issue.mirror:(mirror.lastSignals||[]);
  return {...ctx,state,records,target,issue,current:issue,master:issue.master,methods:issue.methods,mirror,mirrorPred};
}
function render(){
  const c=makeCtx();ctx=c;window.TOP3_AUTO_CTX=c;
  const renderers={home:renderHome,forecasts:renderForecasts,archive:renderArchive,algorithm:renderAlgorithm,stats:renderStats,triples:renderTriples,mirror:renderMirror,settings:renderSettings};
  document.querySelector("#main").innerHTML=(renderers[page]||renderHome)(c);
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  const mounts={home:mountedHome,forecasts:mountedForecasts,archive:mountedArchive};(mounts[page]||(()=>{}))(c);bindCollapsibles(document);
}
function adoptServerState(serverState){if(serverState&&typeof serverState==="object"&&Object.keys(serverState).length){state=serverState;saveState(state)}}
async function refresh(){
  const btn=document.querySelector("#refreshBtn");btn.disabled=true;btn.textContent="Обновляю…";
  try{
    const [v,serverRecords,bootstrap,serverState,index,latest]=await Promise.all([loadJSON("./data/version.json"),loadJSON("./data/archive.json"),optionalJSON("./data/bootstrap-tail.json",null),optionalJSON("./data/app-state.json",{}),optionalJSON("./data/forecast-index.json",[]),optionalJSON("./data/latest.json",ctx.latest||null)]);
    if(v.version!==ctx.version.version){toast(`Новая версия ${v.version}. Перезагрузка…`);setTimeout(()=>location.reload(),700);return}
    const oldLast=ctx.records?.at(-1)?.combo,records=mergeRecords(serverRecords,expandBootstrap(bootstrap));ctx={...ctx,records,fullArchive:extendFullArchive(ctx.fullArchive,records),rules:ctx.rules,version:v,forecastIndex:index,latest};adoptServerState(serverState);const newLast=records?.at(-1)?.combo;
    document.querySelector("#sourceDot").className="dot ok";document.querySelector("#sourceText").textContent="Столото: подключено";toast(oldLast!==newLast?`Новый тираж обработан: ${newLast}`:"Данные и MASTER-прогноз актуальны");render();
  }catch(e){toast("Ошибка обновления: "+e.message);document.querySelector("#sourceDot").className="dot bad";document.querySelector("#sourceText").textContent="Столото: ошибка"}
  finally{btn.disabled=false;btn.textContent="↻ Обновить"}
}
async function init(){
  const [serverRecords,rules,version,serverState,index,latest,bootstrap,fullArchive]=await Promise.all([loadJSON("./data/archive.json"),loadJSON("./data/rules.json"),loadJSON("./data/version.json"),optionalJSON("./data/app-state.json",{}),optionalJSON("./data/forecast-index.json",[]),optionalJSON("./data/latest.json",null),optionalJSON("./data/bootstrap-tail.json",null),loadFullArchive()]);
  adoptServerState(serverState);const records=mergeRecords(serverRecords,expandBootstrap(bootstrap));ctx={records,rules,version,forecastIndex:index,latest,fullArchive:extendFullArchive(fullArchive,records)};document.querySelector("#versionBadge").textContent="v"+version.version;
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{page=n.dataset.page;location.hash=page;document.querySelector("#sidebar").classList.remove("open");render()});
  document.querySelector("#menuBtn").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");document.querySelector("#refreshBtn").onclick=refresh;window.addEventListener("hashchange",()=>{page=location.hash.slice(1)||"home";render()});render();
  if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
init().catch(e=>{document.querySelector("#main").innerHTML=`<div class="card"><div class="card-body bad">Ошибка запуска: ${e.message}</div></div>`});
