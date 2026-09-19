import fs from "node:fs";
import {nextTarget} from "./js/engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast,deltaCombo,family} from "./js/engine/chat-master.js";
import {createMirrorState} from "./js/engine/mirror15.js";
import {
  computeTripleChat,M2_MAP,pairEval,TRIPLE_CHAT_RULE_CODE,TRIPLE_CHAT_SEED_ID,
  SERIAL_LEADER_RULE_START_ID,SERIAL_LEADER_TTL,advanceSerialLeaders
} from "./js/engine/triples-chat.js";
import {ALL_LINKS_RULE_CODE,computeAllLinksForRows,computeTripleAllLinks} from "./js/engine/triple-all-links.js";
import {
  M6_RULE_CODE,M6_RULE_START_FACT,M6_FORWARD_TARGET,M6_TTL,
  familyOf,familyTripleResults,computeM5ExactState,computeM6RepeatFamily
} from "./js/engine/m6-repeat-family.js";

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

ok(TRIPLE_CHAT_RULE_CODE==="TOP3-3METHODS-SERIAL-LEADER-13.09.2026","triple rules code");
ok(SERIAL_LEADER_RULE_START_ID===268003,"serial leader must start prospectively after №268003 fact");
ok(SERIAL_LEADER_TTL===5,"serial leader TTL must be exactly 5 draws");
ok(M2_MAP["999"]?.join("/")==="482/628","M2 999 family map must stay frozen");
ok(pairEval("915","268").triples.includes("777"),"M3 known branch 915+268 must produce 777");
ok(pairEval("111","999").blocked===true,"exact XXX must trigger BLOCK before permutations");

const preSerial=advanceSerialLeaders([],{},["444"],268002);
ok(preSerial.active.length===0&&preSerial.streaks["444"]===1,"first addition birth before activation must only arm streak");
const serial2=advanceSerialLeaders(preSerial.active,preSerial.streaks,["444"],268003);
ok(serial2.active.length===1&&serial2.active[0].triple==="444","same addition triple on second consecutive draw must activate leader");
ok(serial2.active[0].rem===5&&serial2.active[0].streak===2,"new serial leader must start at rem5 / streak2");
const serialCarry=advanceSerialLeaders(serial2.active,serial2.streaks,[],268004);
ok(serialCarry.active[0]?.rem===4,"serial leader must carry forward without counting carry as a new birth");
ok(Object.keys(serialCarry.streaks).length===0,"missing addition birth must break consecutive streak");
const serialRestart=advanceSerialLeaders(serialCarry.active,serialCarry.streaks,["444"],268005);
ok(serialRestart.active[0]?.rem===3&&serialRestart.streaks["444"]===1,"non-consecutive addition birth must not refresh leader");
const serialContinue=advanceSerialLeaders(serial2.active,serial2.streaks,["444"],268004);
ok(serialContinue.active[0]?.rem===5&&serialContinue.active[0]?.streak===3,"third consecutive addition birth must refresh leader back to rem5");

ok(ALL_LINKS_RULE_CODE==="TOP3-ALL-LINKS-V1-14SEP2026-0255","all-links transfer code");
const auditRows=records.filter(r=>{const k=`${r.date} ${r.time}`;return k>="2026-09-11 22:55"&&k<="2026-09-14 01:55"});
const audit=computeAllLinksForRows(auditRows);
const expectedLinks={"111":26,"222":28,"333":38,"444":40,"555":42,"666":29,"777":23,"888":31,"999":31,"000":23};
ok(audit.rows===103,"all-links control interval must contain 103 draws");
for(const [t,n] of Object.entries(expectedLinks))ok(audit.counts[t]===n,`all-links audit ${t} must equal ${n}`);
ok(audit.total===311,"all-links control total must equal 311");
ok(audit.links?.length===audit.total,"all-links journal must preserve every link");
ok(audit.facts?.length===audit.rows,"all-links fact statistics must cover every cycle fact");
const currentAllLinks=computeTripleAllLinks(records);
ok(currentAllLinks.ranking?.length===10,"all-links current ranking must contain all 10 triples");
ok(currentAllLinks.ranking?.every(x=>Number.isInteger(x.rank)&&Number.isInteger(x.count)),"all-links ranking must expose rank and all-link count");
ok(currentAllLinks.ranking?.every(x=>Number.isFinite(x.share)&&Number.isInteger(x.sourceCount)&&Number.isInteger(x.recipientCount)),"all-links ranking must expose share / sources / recipients");
ok(currentAllLinks.ranking?.every(x=>x.count===0||(Number.isFinite(x.avgLag)&&Number.isInteger(x.maxLag))),"all-links ranking must expose average and max lag for non-zero rows");
const distinctCounts=new Set((currentAllLinks.ranking||[]).map(x=>x.count)).size;
ok(Math.max(...(currentAllLinks.ranking||[]).map(x=>x.rank))===distinctCounts,"all-links places must use dense ranking 1,2,2,3");
if(currentAllLinks.total>0){const shareSum=currentAllLinks.ranking.reduce((a,b)=>a+b.share,0);ok(Math.abs(shareSum-100)<1e-9,"all-links shares must sum to 100%")}
ok(currentAllLinks.links?.length===currentAllLinks.total,"current all-links must expose full journal");
ok(currentAllLinks.facts?.length===currentAllLinks.cycleRows,"current all-links must expose per-fact statistics");

ok(M6_RULE_CODE==="TOP3-M6-REPEAT-FAMILY-150-V2-19.09.2026","M6 V2 rule code");
ok(M6_RULE_START_FACT===268289&&M6_FORWARD_TARGET===268290,"M6 forward must start from frozen №268290 after fact №268289");
ok(M6_TTL===150,"M6 repeat-family TTL must be exactly 150 future draws");
ok(familyOf("173")==="137"&&familyOf("713")==="137"&&familyOf("137")==="137","M6 family must ignore digit order");
ok(familyTripleResults("137","137").has("444"),"M6 retro control family137 + family137 must produce 444");
ok(familyTripleResults("666","444").has("000"),"M6 control family666 + family444 must produce 000");
const preM6Records=records.filter(r=>Number(r.draw)<=268289);
const m5At268289=computeM5ExactState(preM6Records);
const m5Keys=new Set((m5At268289.links||[]).map(x=>`${x.sourceCode}+${x.secondCode}→${x.triple}`));
ok(m5Keys.has("794+194→888"),"M5 control exact 794+194→888 before №268290");
ok(m5Keys.has("084+137→111"),"M5 control exact 084+137→111 before №268290");
for(const id of [268261,268270,268287,268288])ok((m5At268289.occupied||[]).includes(id),`M5 EXCLUSIVE occupied must include №${id}`);
ok(!(m5At268289.occupied||[]).includes(268289),"current fact №268289=444 must not be exact-occupied for M6 №268290");
const m6At268289=computeM6RepeatFamily(preM6Records);
ok(m6At268289.current?.sourceId===268289&&m6At268289.current?.targetId===268290,"M6 control must issue after №268289 for №268290");
ok((m6At268289.current?.triples||[]).join("/")==="000","M6 frozen №268290 must be exactly 000");
const active666=(m6At268289.current?.active||[]).find(x=>x.family==="666");
ok(active666?.activeUntil===268320,"active family666 must stay live through №268320");
ok(m6At268289.current?.currentBlocked===false,"fact444 must pass M5 EXCLUSIVE for M6 №268290");
ok((m6At268289.history||[]).every(x=>x.targetId>=268290),"M6 history must not retroactively create forecasts before №268290");

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
ok(Array.isArray(triple.snapshot?.serialLeaders),"serial leaders must be exposed in snapshot");
ok((triple.snapshot?.birthsWindow||[]).every(x=>Array.isArray(x.additionBirths)),"birth audit must expose addition-only births");

const m6=computeM6RepeatFamily(records);
console.log("CHAT MASTER target",target,"MASTER",f.master?.combos,"families",f.master?.families);
console.log("TRIPLES",triple.snapshot?.frozen,"leader",triple.snapshot?.leader?.leaders,"×",triple.snapshot?.leader?.max,"serial",triple.snapshot?.serialLeaders);
console.log("M6",m6.current?.sourceId,"→",m6.current?.targetId,m6.current?.triples,"active",m6.current?.active?.map(x=>`${x.family}@${x.activeUntil}`));
console.log("ALL-LINKS",currentAllLinks.anchor?.code,"start",currentAllLinks.start?.date,currentAllLinks.start?.time,"ranking",currentAllLinks.ranking?.map(x=>`${x.rank}:${x.triple}=${x.count} ${x.share.toFixed(1)}% src${x.sourceCount} dst${x.recipientCount} avg${x.avgLag==null?"—":x.avgLag.toFixed(2)} max${x.maxLag??"—"}`).join(" | "));
if(fail.length){console.error("STRICT CONTROL FAILED");fail.forEach(x=>console.error("-",x));process.exit(1)}
console.log("CHAT MASTER + M1/M2/M3 + serial leader + M4 + M6 V2 strict invariants: OK");
