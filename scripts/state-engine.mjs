import fs from "node:fs";
import path from "node:path";
import {nextTarget,sortRecords} from "../js/engine/core.js";
import {computeMainForecast,routeHits,applyFrozenRoutes} from "../js/engine/forecast.js";
import {scannerForecast} from "../js/engine/scanner.js";
import {createMirrorState} from "../js/engine/mirror15.js";
import {algorithmShiftForecast} from "../js/engine/shift.js";

export function readJSON(file,fallback){
  try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return structuredClone(fallback)}
}
export function writeJSON(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(value,null,2));
  fs.renameSync(tmp,file);
}
function keyOf(target){return `${target.date}|${target.time}`}
function detailPath(target){return `data/forecasts/${target.date}/${target.time.replace(":","-")}.json`}
function dateShift(date,days){
  const d=new Date(`${date}T12:00:00+03:00`);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function sameMultiset(a,b){return [...String(a)].sort().join("")===[...String(b)].sort().join("")}

function allForecastCombos(issue){
  const out=[];
  const f=issue.forecast||issue;
  for(const block of ["TOP","DELTA","NUMBERS"]){
    for(let i=0;i<4;i++){
      const combo=f?.[block]?.[i];
      if(combo && /^\d{3}$/.test(combo))out.push({block,variant:["V1","V2","V3","GG"][i],combo});
    }
  }
  for(const [k,v] of Object.entries(issue.extras||{})){
    if(v && /^\d{3}$/.test(String(v)))out.push({block:"EXTRA",variant:k,combo:String(v)});
  }
  const shift=issue.shift?.combo||issue.shift;
  if(shift && /^\d{3}$/.test(String(shift)))out.push({block:"SHIFT",variant:"matrix",combo:String(shift)});
  for(const x of issue.mirror||[]){
    const combo=x?.triple||x;
    if(combo && /^\d{3}$/.test(String(combo)))out.push({block:"MIRROR",variant:x?.base||"mirror",combo:String(combo)});
  }
  return out;
}

function evaluateIssuedForecast(issue,factRec){
  const fact=factRec.combo, criteria={A:[],B:[],C:[]}, pos=["A","B","C"];
  for(const [block,label] of [["TOP","TOP"],["DELTA","Δ"],["NUMBERS","ЧИСЛА"]]){
    for(let i=0;i<4;i++){
      const c=issue.forecast?.[block]?.[i];
      if(!c)continue;
      for(let j=0;j<3;j++){
        if(c[j]===fact[j])criteria[pos[j]].push(`${label} · ${["В1","В2","В3","Г→Г"][i]}`);
      }
    }
  }
  for(const [k,c] of Object.entries(issue.extras||{})){
    if(!c)continue;
    for(let j=0;j<3;j++)if(String(c)[j]===fact[j])criteria[pos[j]].push(`ДОП · ${k}`);
  }
  if(issue.shift?.combo){
    for(let j=0;j<3;j++)if(issue.shift.combo[j]===fact[j])criteria[pos[j]].push("СМЕНА АЛГОРИТМА");
  }
  for(const x of issue.mirror||[]){
    if(!x?.triple)continue;
    for(let j=0;j<3;j++)if(x.triple[j]===fact[j])criteria[pos[j]].push("ЗЕРКАЛО");
  }
  return criteria;
}

function buildExtras(records,target,current,state,rules){
  const scanner=scannerForecast(records,target,rules);
  const recent=state.recentForecasts||[];
  const delayed=recent.at(-1)?.forecast?.NUMBERS?.[2]||null;
  let dop1=null,dop2=null,dop3=null;
  if(state.lastFrozenRoutes)dop1=applyFrozenRoutes(current,state.lastFrozenRoutes);

  const yd=dateShift(target.date,-1);
  const hist=[...recent].reverse().find(x=>x.target?.date===yd&&x.target?.time===target.time);
  if(hist?.factAfter && hist?.forecast){
    const rr=routeHits(hist.forecast,hist.factAfter);
    if(Object.values(rr).every(x=>x.length))dop2=applyFrozenRoutes(current,rr);
  }
  return {dop1,dop2,dop3,scanner,delayed};
}

function makeIssue(records,state,rules){
  const sorted=sortRecords(records);
  const target=nextTarget(sorted,rules.schedule);
  const current=computeMainForecast(sorted,target,rules);
  const extras=buildExtras(sorted,target,current,state,rules);
  const mirror=createMirrorState(sorted,rules);
  const mirrorPred=mirror.lastSignals||[];
  const shift=algorithmShiftForecast(current,state.observations||[],rules);
  return {
    key:keyOf(target),
    target,
    lastFact:current.lastFact,
    forecast:current,
    extras,
    shift,
    mirror:mirrorPred,
    issuedAt:new Date().toISOString(),
    factAfter:null,
    factAt:null
  };
}

function summaryOf(issue){
  return {
    key:issue.key,
    target:issue.target,
    issuedAt:issue.issuedAt,
    lastFact:issue.lastFact,
    TOP:[...(issue.forecast?.TOP||[])],
    DELTA:[...(issue.forecast?.DELTA||[])],
    NUMBERS:[...(issue.forecast?.NUMBERS||[])],
    extras:{...(issue.extras||{})},
    shift:issue.shift||null,
    mirror:(issue.mirror||[]).map(x=>({...x})),
    factAfter:issue.factAfter||null,
    factAt:issue.factAt||null,
    detailFile:detailPath(issue.target)
  };
}

function log(state,msg,type="info"){
  state.systemLog=state.systemLog||[];
  state.systemLog.push({at:new Date().toISOString(),type,msg});
  state.systemLog=state.systemLog.slice(-1000);
}

function writeIssueDetail(issue){
  writeJSON(detailPath(issue.target),issue);
}

export function ensurePendingForecast(records,state,index,rules){
  state.recentForecasts=state.recentForecasts||[];
  const target=nextTarget(records,rules.schedule), key=keyOf(target);
  let issue=state.recentForecasts.find(x=>x.key===key);
  if(issue)return {issue,created:false};

  const file=detailPath(target);
  if(fs.existsSync(file)){
    issue=readJSON(file,null);
    if(issue){
      state.recentForecasts.push(issue);
      state.recentForecasts=state.recentForecasts.slice(-80);
      return {issue,created:false};
    }
  }

  issue=makeIssue(records,state,rules);
  state.recentForecasts.push(issue);
  state.recentForecasts=state.recentForecasts.slice(-80);

  if(!index.some(x=>x.key===issue.key))index.push(summaryOf(issue));
  writeIssueDetail(issue);
  log(state,`Сформирован полный прогноз на ${issue.target.date} ${issue.target.time}`);
  return {issue,created:true};
}

export function settleForecastForFact(factRec,state,index){
  state.recentForecasts=state.recentForecasts||[];
  const key=keyOf(factRec);
  let issue=state.recentForecasts.find(x=>x.key===key);

  if(!issue){
    const file=detailPath(factRec);
    if(fs.existsSync(file))issue=readJSON(file,null);
    if(issue){
      state.recentForecasts.push(issue);
      state.recentForecasts=state.recentForecasts.slice(-80);
    }
  }
  if(!issue){
    log(state,`Нет сохранённого прогноза для факта ${factRec.date} ${factRec.time}`,"warn");
    return {settled:false,hits:[]};
  }
  if(issue.factAfter)return {settled:false,hits:[]};

  issue.factAfter=factRec.combo;
  issue.factAt=`${factRec.date} ${factRec.time}`;
  state.lastFrozenRoutes=routeHits(issue.forecast,factRec.combo);

  state.observations=state.observations||[];
  if(!state.observations.some(x=>x.date===factRec.date&&x.time===factRec.time)){
    state.observations.push({
      date:factRec.date,time:factRec.time,fact:factRec.combo,
      criteria:evaluateIssuedForecast(issue,factRec)
    });
    state.observations=state.observations.slice(-500);
  }

  const factDT=new Date(`${factRec.date}T${factRec.time}:00+03:00`), hits=[];
  for(const h of index){
    const t=new Date(`${h.target.date}T${h.target.time}:00+03:00`);
    const lag=(factDT-t)/60000;
    if(lag<0||lag>=1440)continue;
    for(const x of allForecastCombos(h)){
      if(x.combo===factRec.combo)hits.push({...x,type:"T3",source:h.target,lag});
      else if(sameMultiset(x.combo,factRec.combo))hits.push({...x,type:"L3",source:h.target,lag});
    }
  }
  if(hits.length){
    state.hitLog=state.hitLog||[];
    state.hitLog.push({fact:factRec.combo,date:factRec.date,time:factRec.time,hits});
    state.hitLog=state.hitLog.slice(-2000);
  }

  const idx=index.findIndex(x=>x.key===key);
  if(idx>=0)index[idx]=summaryOf(issue);
  else index.push(summaryOf(issue));
  writeIssueDetail(issue);
  log(state,`Проверен прогноз ${factRec.date} ${factRec.time}; факт ${factRec.combo}; T3/L3: ${hits.length}`);
  return {settled:true,hits};
}

export function saveStateBundle(state,index){
  state.recentForecasts=(state.recentForecasts||[]).slice(-80);
  state.observations=(state.observations||[]).slice(-500);
  state.hitLog=(state.hitLog||[]).slice(-2000);
  state.systemLog=(state.systemLog||[]).slice(-1000);
  index.sort((a,b)=>`${a.target.date} ${a.target.time}`.localeCompare(`${b.target.date} ${b.target.time}`));
  writeJSON("data/app-state.json",state);
  writeJSON("data/forecast-index.json",index);
}

export function createEmptyState(){
  return {recentForecasts:[],observations:[],hitLog:[],systemLog:[],lastFrozenRoutes:null};
}
