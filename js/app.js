import {loadState,saveState,appendLog} from "./storage.js";
import {nextTarget,sortRecords,comboOf} from "./engine/core.js";
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
import {renderSettings} from "./pages/settings.js";

const loadJSON=async p=>{const r=await fetch(p+(p.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(`${p}: ${r.status}`);return r.json()};
let ctx, state=loadState(), page=location.hash.slice(1)||"home";

function toast(s){const x=document.querySelector("#toast");x.textContent=s;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function buildExtras(records,target,current){
  const scanner=scannerForecast(records,target,ctx.rules);
  const delayed=state.forecastHistory?.at(-1)?.forecast?.NUMBERS?.[2]||null;
  let dop1=null,dop2=null,dop3=null;
  if(state.lastFrozenRoutes)dop1=applyFrozenRoutes(current,state.lastFrozenRoutes);
  // Доп №2: только если в архиве приложения есть прогноз того же времени предыдущих суток и можно восстановить все маршруты.
  const y=new Date(`${target.date}T12:00:00+03:00`);y.setDate(y.getDate()-1);const yd=y.toISOString().slice(0,10);
  const hist=(state.forecastHistory||[]).find(x=>x.target?.date===yd&&x.target?.time===target.time);
  if(hist?.factAfter && hist?.forecast){const rr=routeHits(hist.forecast,hist.factAfter); if(Object.values(rr).every(x=>x.length))dop2=applyFrozenRoutes(current,rr)}
  return {scanner,delayed,dop1,dop2,dop3};
}
function makeCtx(){
  const records=sortRecords(ctx.records), target=nextTarget(records,ctx.rules.schedule), current=computeMainForecast(records,target,ctx.rules);
  const mirror=createMirrorState(records,ctx.rules), mirrorPred=mirror.lastSignals||[];
  const shift=algorithmShiftForecast(current,state.observations||{},ctx.rules);
  const extras=buildExtras(records,target,current);
  return {...ctx,state,records,target,current,mirror,mirrorPred,shift,extras};
}
function render(){
  const c=makeCtx(); ctx=c; window.TOP3_AUTO_CTX=c;
  const renderers={home:renderHome,forecasts:renderForecasts,archive:renderArchive,algorithm:renderAlgorithm,mirror:renderMirror,stats:renderStats,settings:renderSettings};
  document.querySelector("#main").innerHTML=(renderers[page]||renderHome)(c);
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  ({home:mountedHome,forecasts:mountedForecasts,archive:mountedArchive}[page]||(()=>{}))(c);
  archiveCurrent(c); window.dispatchEvent(new CustomEvent('top3-auto-render',{detail:c}));
}
function allForecastCombos(h){
  const out=[]; for(const block of ["TOP","DELTA","NUMBERS"])for(let i=0;i<4;i++)if(h.forecast?.[block]?.[i])out.push({block,variant:["V1","V2","V3","GG"][i],combo:h.forecast[block][i]});
  for(const [k,v] of Object.entries(h.extras||{}))if(v)out.push({block:"EXTRA",variant:k,combo:v});
  if(h.shift?.combo)out.push({block:"SHIFT",variant:"matrix",combo:h.shift.combo});
  for(const x of h.mirror||[])out.push({block:"MIRROR",variant:x.base,combo:x.triple});
  return out;
}
function sameMultiset(a,b){return [...a].sort().join("")===[...b].sort().join("")}
function evaluateIssuedForecast(h,factRec){
  const fact=factRec.combo, criteria={A:[],B:[],C:[]};
  const pos=["A","B","C"];
  for(const [block,label] of [["TOP","TOP"],["DELTA","Δ"],["NUMBERS","ЧИСЛА"]]){
    for(let i=0;i<4;i++){const c=h.forecast?.[block]?.[i];if(!c)continue;for(let j=0;j<3;j++)if(c[j]===fact[j])criteria[pos[j]].push(`${label} · ${["В1","В2","В3","Г→Г"][i]}`)}
  }
  for(const [k,c] of Object.entries(h.extras||{}))if(c)for(let j=0;j<3;j++)if(c[j]===fact[j])criteria[pos[j]].push(k);
  return criteria;
}
function archiveCurrent(c){
  state.forecastHistory=state.forecastHistory||[];
  const key=`${c.target.date} ${c.target.time}`;
  if(!state.forecastHistory.some(x=>`${x.target.date} ${x.target.time}`===key)){
    state.forecastHistory.push({target:c.target,lastFact:c.current.lastFact,forecast:c.current,extras:c.extras,shift:c.shift,mirror:c.mirrorPred,issuedAt:new Date().toISOString(),factAfter:null});
    state.forecastHistory=state.forecastHistory.slice(-400);
    saveState(state);
  }
}
async function refresh(){
  const btn=document.querySelector("#refreshBtn");btn.disabled=true;btn.textContent="Обновляю…";
  try{
    const [v,l]=await Promise.all([loadJSON("./data/version.json"),loadJSON("./data/latest.json")]);
    if(v.version!==ctx.version.version){toast(`Новая версия ${v.version}. Перезагрузка…`);setTimeout(()=>location.reload(),700);return}
    const d=l.draw, exists=ctx.records.some(r=>r.date===d.date&&r.time===d.time&&r.combo===d.combo);
    if(!exists){
      state.forecastHistory=state.forecastHistory||[];
      const issued=state.forecastHistory.find(x=>x.target?.date===d.date&&x.target?.time===d.time);
      if(issued){
        issued.factAfter=d.combo; issued.factAt=`${d.date} ${d.time}`;
        state.lastFrozenRoutes=routeHits(issued.forecast,d.combo);
        state.observations=state.observations||[];
        const criteria=evaluateIssuedForecast(issued,d);
        state.observations.push({date:d.date,time:d.time,fact:d.combo,criteria});
        // T3 / L3 за 24 часа
        const factDT=new Date(`${d.date}T${d.time}:00+03:00`), hits=[];
        for(const h of state.forecastHistory){
          const t=new Date(`${h.target.date}T${h.target.time}:00+03:00`), lag=(factDT-t)/60000;
          if(lag<0||lag>=1440)continue;
          for(const x of allForecastCombos(h)){
            if(x.combo===d.combo)hits.push({...x,type:"T3",source:h.target,lag});
            else if(sameMultiset(x.combo,d.combo))hits.push({...x,type:"L3",source:h.target,lag});
          }
        }
        if(hits.length){state.hitLog=state.hitLog||[];state.hitLog.push({fact:d.combo,date:d.date,time:d.time,hits})}
      }
      ctx.records.push(d);appendLog(state,`Новый тираж ${d.date} ${d.time} = ${d.combo}`);toast(`Новый тираж: ${d.combo}`);
    } else toast("Версия и тиражи актуальны");
    saveState(state);render();
  }catch(e){toast("Ошибка обновления: "+e.message);document.querySelector("#sourceDot").className="dot bad";document.querySelector("#sourceText").textContent="Столото: ошибка"}
  finally{btn.disabled=false;btn.textContent="↻ Обновить"}
}
async function init(){
  const [records,rules,version]=await Promise.all([loadJSON("./data/archive.json"),loadJSON("./data/rules.json"),loadJSON("./data/version.json")]);
  ctx={records,rules,version}; document.querySelector("#versionBadge").textContent="v"+version.version;
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{page=n.dataset.page;location.hash=page;document.querySelector("#sidebar").classList.remove("open");render()});
  document.querySelector("#menuBtn").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");
  document.querySelector("#refreshBtn").onclick=refresh; window.addEventListener("hashchange",()=>{page=location.hash.slice(1)||"home";render()});
  render(); if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
init().catch(e=>{document.querySelector("#main").innerHTML=`<div class="card"><div class="card-body bad">Ошибка запуска: ${e.message}</div></div>`});
