import fs from "node:fs";
import {nextTarget} from "./js/engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast,deltaCombo,family} from "./js/engine/chat-master.js";
import {createMirrorState} from "./js/engine/mirror15.js";
import {computeTripleChat,M2_MAP,pairEval,TRIPLE_CHAT_RULE_CODE,TRIPLE_CHAT_SEED_ID} from "./js/engine/triples-chat.js";

const records=JSON.parse(fs.readFileSync("./data/archive.json","utf8"));
const rules=JSON.parse(fs.readFileSync("./data/rules.json","utf8"));
const packed=JSON.parse(fs.readFileSync("./data/full-archive/all.json","utf8"));
const packedData=String(packed.data||"");
const combos=[];for(let i=0;i+2<packedData.length;i+=3)combos.push(packedData.slice(i,i+3));
const fullArchive={...packed,combos};
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

ok(TRIPLE_CHAT_RULE_CODE==="TOP3-3METHODS-CHAT-12.09.2026","triple rules code");
ok(M2_MAP["999"]?.join("/")==="482/628","M2 999 family map must stay frozen");
ok(pairEval("915","268").triples.includes("777"),"M3 known branch 915+268 must produce 777");
ok(pairEval("111","999").blocked===true,"exact XXX must trigger BLOCK before permutations");
const seedRecords=records.filter(r=>Number(r.draw)<=TRIPLE_CHAT_SEED_ID);
const seedTriple=computeTripleChat(seedRecords,fullArchive);
ok(seedTriple.snapshot?.frozen?.join("/")==="777","seed frozen after №267958 must be 777");
ok(seedTriple.snapshot?.archive?.at(-1)?.id===267958,"seed archive must end at №267958");
ok(seedTriple.snapshot?.archive?.at(-1)?.after==="777","seed archive frozen after №267958 must be 777");
ok(seedTriple.snapshot?.leader?.leaders?.join("/")==="444/777","seed leader must be 444 / 777");
ok(seedTriple.snapshot?.leader?.max===3,"seed leader frequency must be ×3");
const triple=computeTripleChat(records,fullArchive);
ok(triple.snapshot?.archive?.length===20,"triple archive must keep exactly 20 draws");
ok(Object.keys(triple.snapshot?.leader?.counts||{}).length===10,"triple leader frequency must cover 000..999");
ok(triple.snapshot?.frequency?.length===10,"triple frequency table must contain 10 triples");
ok((triple.snapshot?.m2||[]).every(x=>x.stage===1||x.stage===2),"M2 ready lives only 1/2 NEW → 2/2 LAST");
ok((triple.snapshot?.m3||[]).every(x=>x.stage===1||x.stage===2),"M3 lives only 1/2 NEW → 2/2 LAST");

console.log("CHAT MASTER target",target,"MASTER",f.master?.combos,"families",f.master?.families);
console.log("TRIPLES",triple.snapshot?.frozen,"leader",triple.snapshot?.leader?.leaders,"×",triple.snapshot?.leader?.max);
if(fail.length){console.error("STRICT CONTROL FAILED");fail.forEach(x=>console.error("-",x));process.exit(1)}
console.log("CHAT MASTER + M1/M2/M3 strict invariants: OK");
