import fs from "node:fs";
import {nextTarget} from "./js/engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast,deltaCombo,family} from "./js/engine/chat-master.js";
import {createMirrorState} from "./js/engine/mirror15.js";

const records=JSON.parse(fs.readFileSync("./data/archive.json","utf8"));
const rules=JSON.parse(fs.readFileSync("./data/rules.json","utf8"));
let state={};try{state=JSON.parse(fs.readFileSync("./data/app-state.json","utf8"))}catch{}
const target=nextTarget(records,rules.schedule),f=computeChatForecast(records,target,rules,state),mirror=createMirrorState(records,rules),fail=[];
const ok=(cond,msg)=>{if(!cond)fail.push(msg)};
ok(CHAT_MASTER_SCHEMA==="chat-master-v1","schema constant");
ok(f.schema===CHAT_MASTER_SCHEMA,"forecast schema");
ok(f.lastFact===records.at(-1).combo,"lastFact must equal archive tail");
ok(f.master?.top3?.length===3,"MASTER must output exactly 3");
ok(new Set(f.master?.families||[]).size===3,"MASTER families must be unique");
ok((f.methods?.main?.top3||[]).length===3,"MAIN must rank TOP-3 families");
ok(f.methods?.main?.signals?.seq?.signal?.length===3,"LAST Δ must exist");
ok(f.methods?.main?.signals?.td?.signal?.length===3,"TIME-DIRECTION Δ must exist");
ok(deltaCombo("893","337")==="544","delta arithmetic 893→337 must be 544");
ok(family("834")==="348"&&family("483")==="348","family order must be ignored");
for(const x of f.methods?.algorithm?.top3||[])ok(x.repeat>=2,"Algorithm candidates require repeat>=2");
ok(!(f.master?.ranked||[]).some(x=>(x.groups||[]).includes("MIRROR")),"Mirror must never enter MASTER");
ok(Array.isArray(mirror.lastSignals),"Mirror subsystem must stay operational separately");
ok(rules.mirror?.independentFromMaster===true,"Mirror must be explicitly independent from MASTER");
console.log("CHAT MASTER target",target,"MASTER",f.master?.combos,"families",f.master?.families);
if(fail.length){console.error("CHAT MASTER STRICT CONTROL FAILED");fail.forEach(x=>console.error("-",x));process.exit(1)}
console.log("CHAT MASTER strict invariants: OK");
