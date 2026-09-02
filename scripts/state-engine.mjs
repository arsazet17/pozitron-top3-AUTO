import fs from "node:fs";
import path from "node:path";
import {nextTarget,sortRecords} from "../js/engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast,auditChatForecast,legacyRouteHits,family} from "../js/engine/chat-master.js";
import {createMirrorState} from "../js/engine/mirror15.js";

export function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return structuredClone(fallback)}}
export function writeJSON(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+".tmp";fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function keyOf(target){return `${target.date}|${target.time}`}
function detailPath(target){return `data/forecasts/${target.date}/${target.time.replace(":","-")}.json`}
function sameFamily(a,b){return family(a)===family(b)}
function log(state,msg,type="info"){state.systemLog=state.systemLog||[];state.systemLog.push({at:new Date().toISOString(),type,msg});state.systemLog=state.systemLog.slice(-1000)}

function makeIssue(records,state,rules){
  const sorted=sortRecords(records),target=nextTarget(sorted,rules.schedule),core=computeChatForecast(sorted,target,rules,state),mirror=createMirrorState(sorted,rules);
  return {...core,key:keyOf(target),issuedAt:new Date().toISOString(),factAfter:null,factAt:null,audit:null,mirror:mirror.lastSignals||[]};
}
function compactMethods(issue){
  const m=issue.methods||{};
  return {
    main:{signals:m.main?.signals||null,top3:m.main?.top3||[],rawTotals:{seq:m.main?.raw?.seq?.total||0,td:m.main?.raw?.td?.total||0},exactCommon:m.main?.exact?.commonFamilies||[]},
    algorithm:{top3:m.algorithm?.top3||[]},
    appCore:{selected:m.appCore?.selected||null,mode:m.appCore?.mode||null},
    shift:m.shift||null
  };
}
function summaryOf(issue){
  return {schema:issue.schema,key:issue.key,target:issue.target,issuedAt:issue.issuedAt,lastFact:issue.lastFact,master:issue.master,methods:compactMethods(issue),mirror:issue.mirror||[],factAfter:issue.factAfter||null,factAt:issue.factAt||null,audit:issue.audit||null,detailFile:detailPath(issue.target)};
}
function writeIssueDetail(issue){writeJSON(detailPath(issue.target),issue)}
function replaceRecent(state,issue){
  state.recentForecasts=state.recentForecasts||[];
  state.recentForecasts=state.recentForecasts.filter(x=>x.key!==issue.key&&`${x.target?.date}|${x.target?.time}`!==issue.key);
  state.recentForecasts.push(issue);state.recentForecasts=state.recentForecasts.slice(-80);
}
function replaceIndex(index,issue){const s=summaryOf(issue),i=index.findIndex(x=>x.key===issue.key);if(i>=0)index[i]=s;else index.push(s)}

export function ensurePendingForecast(records,state,index,rules){
  state.recentForecasts=state.recentForecasts||[];
  const target=nextTarget(records,rules.schedule),key=keyOf(target);
  let issue=[...state.recentForecasts].reverse().find(x=>x.key===key||`${x.target?.date}|${x.target?.time}`===key);
  if(issue?.schema===CHAT_MASTER_SCHEMA&&!issue.factAfter){
    if(!Array.isArray(issue.mirror)){
      issue.mirror=createMirrorState(sortRecords(records),rules).lastSignals||[];
      replaceRecent(state,issue);replaceIndex(index,issue);writeIssueDetail(issue);
      log(state,`ЗЕРКАЛО: добавлен отдельный frozen тройников к существующему CHAT MASTER ${key}`);
    }
    return {issue,created:false};
  }

  const file=detailPath(target);
  if(!issue&&fs.existsSync(file))issue=readJSON(file,null);
  if(issue?.schema===CHAT_MASTER_SCHEMA&&!issue.factAfter){
    if(!Array.isArray(issue.mirror))issue.mirror=createMirrorState(sortRecords(records),rules).lastSignals||[];
    replaceRecent(state,issue);replaceIndex(index,issue);writeIssueDetail(issue);return {issue,created:false}
  }

  // Полная замена старого pending-прогноза разрешена только пока факт ещё не вышел.
  if(issue?.factAfter){return {issue,created:false}}
  const fresh=makeIssue(records,state,rules);
  replaceRecent(state,fresh);replaceIndex(index,fresh);writeIssueDetail(fresh);
  log(state,`CHAT MASTER: сформирован frozen ${fresh.master.combos.join(" / ")} на ${fresh.target.date} ${fresh.target.time}`);
  return {issue:fresh,created:true};
}

function sourceCombos(issue){
  const out=[];
  (issue.master?.top3||[]).forEach((x,i)=>out.push({block:"MASTER",variant:`TOP${i+1}`,combo:x.order,family:x.family}));
  (issue.methods?.main?.top3||[]).forEach((x,i)=>out.push({block:"MAIN",variant:`R${i+1}`,combo:x.order,family:x.family}));
  (issue.methods?.algorithm?.top3||[]).forEach((x,i)=>out.push({block:"ALGORITHM",variant:`R${i+1}`,combo:x.order,family:x.family}));
  const app=issue.methods?.appCore?.selected?.combo;if(/^\d{3}$/.test(String(app||"")))out.push({block:"APP_CORE",variant:"selected",combo:String(app),family:family(app)});
  const shift=issue.methods?.shift?.combo;if(/^\d{3}$/.test(String(shift||"")))out.push({block:"SHIFT",variant:"matrix",combo:String(shift),family:family(shift)});
  return out;
}

export function settleForecastForFact(factRec,state,index){
  state.recentForecasts=state.recentForecasts||[];
  const key=keyOf(factRec);let issue=[...state.recentForecasts].reverse().find(x=>x.key===key||`${x.target?.date}|${x.target?.time}`===key);
  if(!issue){const file=detailPath(factRec);if(fs.existsSync(file))issue=readJSON(file,null)}
  if(!issue){log(state,`Нет сохранённого frozen для ${factRec.date} ${factRec.time}`,"warn");return {settled:false,hits:[]}}
  if(issue.factAfter)return {settled:false,hits:[]};
  if(issue.schema!==CHAT_MASTER_SCHEMA){log(state,`Прогноз ${key} имеет старую схему и не может быть засчитан как CHAT MASTER`,"warn");return {settled:false,hits:[]}}

  issue.factAfter=factRec.combo;issue.factAt=`${factRec.date} ${factRec.time}`;issue.audit=auditChatForecast(issue,factRec);
  replaceRecent(state,issue);

  // Служебная матрица APP продолжает учиться только как скрытый источник MASTER.
  const criteria=legacyRouteHits(issue,factRec);
  state.observations=state.observations||[];
  if(!state.observations.some(x=>x.date===factRec.date&&x.time===factRec.time)){
    state.observations.push({date:factRec.date,time:factRec.time,fact:factRec.combo,criteria});
    state.observations=state.observations.slice(-500);
  }

  state.masterAudit=state.masterAudit||[];
  state.masterAudit.push({date:factRec.date,time:factRec.time,...issue.audit,issuedAt:issue.issuedAt});
  state.masterAudit=state.masterAudit.slice(-2000);

  // ЗЕРКАЛО — отдельный контур тройников. Никак не влияет на MASTER.
  const mirrorPred=Array.isArray(issue.mirror)?issue.mirror:[];
  const mirrorHits=mirrorPred.filter(x=>x?.triple===factRec.combo);
  state.mirrorAudit=state.mirrorAudit||[];
  state.mirrorAudit.push({date:factRec.date,time:factRec.time,fact:factRec.combo,predictions:mirrorPred,hit:mirrorHits.length>0,issuedAt:issue.issuedAt});
  state.mirrorAudit=state.mirrorAudit.slice(-2000);
  if(mirrorHits.length){
    state.mirrorHitLog=state.mirrorHitLog||[];
    for(const x of mirrorHits)state.mirrorHitLog.push({date:factRec.date,time:factRec.time,fact:factRec.combo,triple:x.triple,base:x.base,permutation:x.permutation,issuedAt:issue.issuedAt});
    state.mirrorHitLog=state.mirrorHitLog.slice(-2000);
  }

  const hits=[];
  for(const x of sourceCombos(issue)){
    if(x.combo===factRec.combo)hits.push({...x,type:"T3",source:issue.target,lag:0});
    else if(sameFamily(x.combo,factRec.combo))hits.push({...x,type:"L3",source:issue.target,lag:0});
  }
  if(hits.length){state.hitLog=state.hitLog||[];state.hitLog.push({fact:factRec.combo,date:factRec.date,time:factRec.time,hits});state.hitLog=state.hitLog.slice(-2000)}

  replaceIndex(index,issue);writeIssueDetail(issue);
  log(state,`CHAT MASTER: проверен ${factRec.combo}; ${issue.audit.classification}; MASTER ${issue.audit.master.hit?"HIT":"MISS"}`);
  return {settled:true,hits,audit:issue.audit};
}

export function saveStateBundle(state,index){
  state.recentForecasts=(state.recentForecasts||[]).slice(-80);
  state.observations=(state.observations||[]).slice(-500);
  state.masterAudit=(state.masterAudit||[]).slice(-2000);
  state.mirrorAudit=(state.mirrorAudit||[]).slice(-2000);
  state.mirrorHitLog=(state.mirrorHitLog||[]).slice(-2000);
  state.hitLog=(state.hitLog||[]).slice(-2000);
  state.systemLog=(state.systemLog||[]).slice(-1000);
  index.sort((a,b)=>`${a.target?.date||""} ${a.target?.time||""}`.localeCompare(`${b.target?.date||""} ${b.target?.time||""}`));
  writeJSON("data/app-state.json",state);writeJSON("data/forecast-index.json",index);
}
export function createEmptyState(){return {recentForecasts:[],observations:[],masterAudit:[],mirrorAudit:[],mirrorHitLog:[],hitLog:[],systemLog:[]}}
