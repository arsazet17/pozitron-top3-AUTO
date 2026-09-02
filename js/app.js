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
function makeCtx(){
  const records=sortRecords(ctx.records),target=nextTarget(records,ctx.rules.schedule),saved=pendingIssue(target);
  const mirror=createMirrorState(records,ctx.rules);
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
    const [v,records,serverState,index,latest]=await Promise.all([loadJSON("./data/version.json"),loadJSON("./data/archive.json"),optionalJSON("./data/app-state.json",{}),optionalJSON("./data/forecast-index.json",[]),optionalJSON("./data/latest.json",ctx.latest||null)]);
    if(v.version!==ctx.version.version){toast(`Новая версия ${v.version}. Перезагрузка…`);setTimeout(()=>location.reload(),700);return}
    const oldLast=ctx.records?.at(-1)?.combo;ctx={...ctx,records,rules:ctx.rules,version:v,forecastIndex:index,latest};adoptServerState(serverState);const newLast=records?.at(-1)?.combo;
    document.querySelector("#sourceDot").className="dot ok";document.querySelector("#sourceText").textContent="Столото: подключено";toast(oldLast!==newLast?`Новый тираж обработан: ${newLast}`:"Данные и MASTER-прогноз актуальны");render();
  }catch(e){toast("Ошибка обновления: "+e.message);document.querySelector("#sourceDot").className="dot bad";document.querySelector("#sourceText").textContent="Столото: ошибка"}
  finally{btn.disabled=false;btn.textContent="↻ Обновить"}
}
async function init(){
  const [records,rules,version,serverState,index,latest]=await Promise.all([loadJSON("./data/archive.json"),loadJSON("./data/rules.json"),loadJSON("./data/version.json"),optionalJSON("./data/app-state.json",{}),optionalJSON("./data/forecast-index.json",[]),optionalJSON("./data/latest.json",null)]);
  adoptServerState(serverState);ctx={records,rules,version,forecastIndex:index,latest};document.querySelector("#versionBadge").textContent="v"+version.version;
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{page=n.dataset.page;location.hash=page;document.querySelector("#sidebar").classList.remove("open");render()});
  document.querySelector("#menuBtn").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");document.querySelector("#refreshBtn").onclick=refresh;window.addEventListener("hashchange",()=>{page=location.hash.slice(1)||"home";render()});render();
  if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
init().catch(e=>{document.querySelector("#main").innerHTML=`<div class="card"><div class="card-body bad">Ошибка запуска: ${e.message}</div></div>`});
