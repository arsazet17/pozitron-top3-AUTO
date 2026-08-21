import {loadState,saveState} from "./storage.js";
import {nextTarget,sortRecords} from "./engine/core.js";
import {computeMainForecast,routeHits,applyFrozenRoutes} from "./engine/forecast.js";
import {scannerForecast} from "./engine/scanner.js";
import {createMirrorState} from "./engine/mirror15.js";
import {algorithmShiftForecast} from "./engine/shift.js";
import {renderHome,mountedHome} from "./pages/home.js";
import {renderForecasts,mountedForecasts} from "./pages/forecasts.js";
import {renderArchive,mountedArchive} from "./pages/archive.js";
import {renderAlgorithm} from "./pages/algorithm.js";
import {renderMirror} from "./pages/mirror.js";
import {renderStats} from "./pages/stats.js";
import {renderTriples} from "./pages/triples.js";
import {renderSettings} from "./pages/settings.js";
import {bindCollapsibles} from "./ui.js";

const loadJSON=async p=>{
  const r=await fetch(p+(p.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error(`${p}: ${r.status}`);
  return r.json();
};
const optionalJSON=async(p,fallback)=>{try{return await loadJSON(p)}catch{return fallback}};

let ctx=null;
let state=loadState()||{};
let page=location.hash.slice(1)||"home";

function toast(s){
  const x=document.querySelector("#toast");
  if(!x)return;
  x.textContent=s;x.classList.add("show");
  setTimeout(()=>x.classList.remove("show"),2400);
}
function dateShift(date,days){
  const d=new Date(`${date}T12:00:00+03:00`);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function recentForecasts(){return state.recentForecasts||state.forecastHistory||[]}

function buildExtrasFallback(records,target,current,rules){
  const scanner=scannerForecast(records,target,rules);
  const recent=recentForecasts();
  const delayed=recent.at(-1)?.forecast?.NUMBERS?.[2]||null;
  let dop1=null,dop2=null,dop3=null;
  if(state.lastFrozenRoutes)dop1=applyFrozenRoutes(current,state.lastFrozenRoutes);

  const yd=dateShift(target.date,-1);
  const hist=[...recent].reverse().find(x=>x.target?.date===yd&&x.target?.time===target.time);
  if(hist?.factAfter&&hist?.forecast){
    const rr=routeHits(hist.forecast,hist.factAfter);
    if(Object.values(rr).every(x=>x.length))dop2=applyFrozenRoutes(current,rr);
  }
  return {dop1,dop2,dop3,scanner,delayed};
}
function pendingIssue(target){
  const key=`${target.date}|${target.time}`;
  return [...recentForecasts()].reverse().find(x=>x.key===key||`${x.target?.date}|${x.target?.time}`===key);
}
function makeCtx(){
  const records=sortRecords(ctx.records);
  const target=nextTarget(records,ctx.rules.schedule);
  const saved=pendingIssue(target);

  let current,extras,shift,mirrorPred;
  const mirror=createMirrorState(records,ctx.rules);
  if(saved?.forecast){
    current=saved.forecast;
    extras=saved.extras||{};
    shift=saved.shift||algorithmShiftForecast(current,state.observations||[],ctx.rules);
    mirrorPred=saved.mirror||[];
  }else{
    current=computeMainForecast(records,target,ctx.rules);
    extras=buildExtrasFallback(records,target,current,ctx.rules);
    shift=algorithmShiftForecast(current,state.observations||[],ctx.rules);
    mirrorPred=mirror.lastSignals||[];
  }
  return {...ctx,state,records,target,current,mirror,mirrorPred,shift,extras};
}
function render(){
  const c=makeCtx();
  ctx=c;
  window.TOP3_AUTO_CTX=c;
  const renderers={
    home:renderHome,forecasts:renderForecasts,archive:renderArchive,
    algorithm:renderAlgorithm,mirror:renderMirror,stats:renderStats,
    triples:renderTriples,settings:renderSettings
  };
  document.querySelector("#main").innerHTML=(renderers[page]||renderHome)(c);
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  const mounts={home:mountedHome,forecasts:mountedForecasts,archive:mountedArchive};
  (mounts[page]||(()=>{}))(c);
  bindCollapsibles(document);
}
function adoptServerState(serverState){
  if(serverState&&typeof serverState==="object"&&Object.keys(serverState).length){
    state=serverState;
    saveState(state); // только резерв для офлайн-запуска; серверная база остаётся главной.
  }
}
async function refresh(){
  const btn=document.querySelector("#refreshBtn");
  btn.disabled=true;btn.textContent="Обновляю…";
  try{
    const [v,records,serverState,index,latest]=await Promise.all([
      loadJSON("./data/version.json"),
      loadJSON("./data/archive.json"),
      optionalJSON("./data/app-state.json",{}),
      optionalJSON("./data/forecast-index.json",[]),
      optionalJSON("./data/latest.json",ctx.latest||null)
    ]);
    if(v.version!==ctx.version.version){
      toast(`Новая версия ${v.version}. Перезагрузка…`);
      setTimeout(()=>location.reload(),700);
      return;
    }
    const oldLast=ctx.records?.at(-1)?.combo;
    ctx={...ctx,records,rules:ctx.rules,version:v,forecastIndex:index,latest};
    adoptServerState(serverState);
    const newLast=records?.at(-1)?.combo;
    document.querySelector("#sourceDot").className="dot ok";
    document.querySelector("#sourceText").textContent="Столото: подключено";
    toast(oldLast!==newLast?`Новый тираж обработан: ${newLast}`:"Данные и прогнозы актуальны");
    render();
  }catch(e){
    toast("Ошибка обновления: "+e.message);
    document.querySelector("#sourceDot").className="dot bad";
    document.querySelector("#sourceText").textContent="Столото: ошибка";
  }finally{
    btn.disabled=false;btn.textContent="↻ Обновить";
  }
}
async function init(){
  const [records,rules,version,serverState,index,latest]=await Promise.all([
    loadJSON("./data/archive.json"),
    loadJSON("./data/rules.json"),
    loadJSON("./data/version.json"),
    optionalJSON("./data/app-state.json",{}),
    optionalJSON("./data/forecast-index.json",[]),
    optionalJSON("./data/latest.json",null)
  ]);
  adoptServerState(serverState);
  ctx={records,rules,version,forecastIndex:index,latest};
  document.querySelector("#versionBadge").textContent="v"+version.version;

  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{
    page=n.dataset.page;
    location.hash=page;
    document.querySelector("#sidebar").classList.remove("open");
    render();
  });
  document.querySelector("#menuBtn").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");
  document.querySelector("#refreshBtn").onclick=refresh;
  window.addEventListener("hashchange",()=>{page=location.hash.slice(1)||"home";render()});
  render();

  if("serviceWorker"in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}
init().catch(e=>{
  document.querySelector("#main").innerHTML=`<div class="card"><div class="card-body bad">Ошибка запуска: ${e.message}</div></div>`;
});
