import fs from "node:fs";
import {nextTarget} from "./js/engine/core.js";
import {CHAT_MASTER_SCHEMA,computeChatForecast,deltaCombo,family} from "./js/engine/chat-master.js";
import {createMirrorState} from "./js/engine/mirror15.js";
import {
  computeTripleChat,M2_MAP,pairEval,TRIPLE_CHAT_RULE_CODE,TRIPLE_CHAT_SEED_ID,
  SERIAL_LEADER_TTL,advanceSerialLeaders
} from "./js/engine/triples-chat.js";
import {ALL_LINKS_RULE_CODE,computeAllLinksForRows,computeTripleAllLinks} from "./js/engine/triple-all-links.js";
import {
  M6_V3_RULE_CODE,M6_V3_WINDOW,M6_V3_FORWARD_START_SOURCE_ID,
  m6Family,m6SelfResults,computeM6V3Strict
} from "./js/engine/m6-v3-strict.js";

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

ok(TRIPLE_CHAT_RULE_CODE==="YULIA-TOP3-M1M2M3-CANONICAL-1.2.14","canonical Yulia triple rules code");
ok(SERIAL_LEADER_TTL===5,"serial leader TTL must be exactly 5 draws");
ok(M2_MAP["999"]?.join("/")==="482/628","M2 999 family map must stay frozen");
ok(pairEval("915","268").triples.includes("777"),"M3 known branch 915+268 must produce 777");
ok(pairEval("111","999").blocked===true,"exact XXX must trigger BLOCK before permutations");

const preSerial=advanceSerialLeaders([],{},["444"],268002);
ok(preSerial.active.length===0&&preSerial.streaks["444"]?.len===1&&preSerial.streaks["444"]?.lastId===268002,"first addition birth must only arm streak");
const serial2=advanceSerialLeaders(preSerial.active,preSerial.streaks,["444"],268003);
ok(serial2.active.length===1&&serial2.active[0].triple==="444","same addition triple on second consecutive draw must activate leader");
ok(serial2.active[0].rem===5&&serial2.streaks["444"]?.len===2&&serial2.active[0].startedAt===268003,"new serial leader must start at rem5 / streak2");
const serialCarry=advanceSerialLeaders(serial2.active,serial2.streaks,[],268004);
ok(serialCarry.active[0]?.rem===4,"serial leader must carry forward without counting carry as a new birth");
ok(Object.keys(serialCarry.streaks).length===0,"missing addition birth must break consecutive streak");
const serialRestart=advanceSerialLeaders(serialCarry.active,serialCarry.streaks,["444"],268005);
ok(serialRestart.active[0]?.rem===3&&serialRestart.streaks["444"]?.len===1,"non-consecutive addition birth must not refresh leader");
const serialContinue=advanceSerialLeaders(serial2.active,serial2.streaks,["444"],268004);
ok(serialContinue.active[0]?.rem===4&&serialContinue.streaks["444"]?.len===3,"third consecutive addition birth must not extend the five-draw window");
ok(serialContinue.active[0]?.startedAt===268003,"continuing births must preserve the activation draw");
const serialGap=advanceSerialLeaders([],preSerial.streaks,["444"],268004);
ok(serialGap.active.length===0&&serialGap.streaks["444"]?.len===1,"nonadjacent draw IDs must not activate a leader");
let serialExpiry=serial2;
for(let id=268004;id<=268008;id++)serialExpiry=advanceSerialLeaders(serialExpiry.active,serialExpiry.streaks,["444"],id);
ok(serialExpiry.active.length===0&&serialExpiry.streaks["444"]?.len===7,"continuous births must not revive an expired leader");
const serialBreak=advanceSerialLeaders(serialExpiry.active,serialExpiry.streaks,[],268009);
const serialRearm=advanceSerialLeaders(serialBreak.active,serialBreak.streaks,["444"],268010);
const serialNew=advanceSerialLeaders(serialRearm.active,serialRearm.streaks,["444"],268011);
ok(serialNew.active.length===1&&serialNew.active[0].rem===5&&serialNew.active[0].startedAt===268011,"a fresh two-draw streak after a break must activate a new leader");

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

ok(M6_V3_RULE_CODE==="TOP3-M6-REPEAT-FAMILY-1000-V3-STRICT-23.09.2026","M6 V3 strict rule code");
ok(M6_V3_WINDOW===1000,"M6 V3 must use exactly sliding window1000");
ok(M6_V3_FORWARD_START_SOURCE_ID===268327,"M6 V3 forward must start from fact №268327");
ok(m6Family("173")==="137"&&m6Family("713")==="137"&&m6Family("371")==="137"&&m6Family("137")==="137","M6 V3 family must ignore digit order");
const self137=m6SelfResults("137");
ok(self137.triples.includes("444"),"M6 V3 retro control family137 + family137 must produce 444");
ok(new Set(self137.triples).size===self137.triples.length,"M6 V3 XXX forecast must be deduplicated");
ok(self137.paths.some(x=>x==="137+317→444"),"M6 V3 journal must preserve permutation paths");

const mk=(draw,combo)=>({draw,date:"2026-09-20",time:"00:00",combo});
const n1=computeM6V3Strict({records:[mk(268327,"173")]});
ok(n1.current?.count===1&&!n1.current?.trigger&&n1.current?.triples?.length===0,"M6 V3 first family appearance must be NO SIGNAL");
const n2=computeM6V3Strict({records:[mk(268327,"173"),mk(268328,"713")]});
ok(n2.current?.count===2&&!n2.current?.trigger&&n2.current?.triples?.length===0,"M6 V3 second family appearance must be NO SIGNAL");
const n3=computeM6V3Strict({records:[mk(268327,"173"),mk(268328,"713"),mk(268329,"137")]});
ok(n3.current?.count===3&&n3.current?.trigger,"M6 V3 third family appearance must trigger");
ok(n3.current?.triples?.includes("444"),"M6 V3 third family137 appearance must freeze 444 one-shot");
ok(n3.current?.targetId===268330,"M6 V3 signal must target only the next draw");
const n4=computeM6V3Strict({records:[mk(268327,"173"),mk(268328,"713"),mk(268329,"137"),mk(268330,"371")]});
ok(n4.current?.count===4&&n4.current?.trigger,"M6 V3 fourth family appearance must trigger again");
const hitAfter137=computeM6V3Strict({records:[mk(268327,"173"),mk(268328,"713"),mk(268329,"137"),mk(268330,"444")]});
ok(hitAfter137.current?.prevCheck?.startsWith("✅ HIT 444"),"M6 V3 must check old Frozen before calculating the new fact");

const slide=[mk(268327,"173"),mk(268328,"713")];
for(let id=268329;id<=269326;id++)slide.push(mk(id,"000"));
const atBoundary=computeM6V3Strict({records:[...slide.slice(0,-1),mk(269326,"371")]});
ok(atBoundary.current?.windowSize===1000&&atBoundary.current?.count===3&&atBoundary.current?.trigger,"M6 V3 must include the oldest draw at the 1000-draw boundary");
slide.push(mk(269327,"371"));
const slid=computeM6V3Strict({records:slide});
ok(slid.current?.windowSize===1000,"M6 V3 current window must be exactly 1000 when enough facts exist");
ok(slid.current?.count===2&&!slid.current?.trigger,"M6 V3 must forget family occurrences that left window1000");
ok(!("activeUntil" in (slid.current||{})),"M6 V3 must not contain active_until state");

const family012two=computeM6V3Strict({records:[mk(268327,"021"),mk(268328,"210")]});
ok(family012two.current?.family==="012"&&family012two.current?.count===2&&!family012two.current?.trigger,"M6 V3 family012 second appearance must stay NO SIGNAL");

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

const m6=computeM6V3Strict({records,fullArchive});
console.log("CHAT MASTER target",target,"MASTER",f.master?.combos,"families",f.master?.families);
console.log("TRIPLES",triple.snapshot?.frozen,"leader",triple.snapshot?.leader?.leaders,"×",triple.snapshot?.leader?.max,"serial",triple.snapshot?.serialLeaders);
console.log("M6 V3",m6.current?.sourceId,"family",m6.current?.family,"N",m6.current?.count,"trigger",m6.current?.trigger,"→",m6.current?.targetId,m6.current?.triples,"prev",m6.current?.prevCheck);
console.log("ALL-LINKS",currentAllLinks.anchor?.code,"start",currentAllLinks.start?.date,currentAllLinks.start?.time,"ranking",currentAllLinks.ranking?.map(x=>`${x.rank}:${x.triple}=${x.count} ${x.share.toFixed(1)}% src${x.sourceCount} dst${x.recipientCount} avg${x.avgLag==null?"—":x.avgLag.toFixed(2)} max${x.maxLag??"—"}`).join(" | "));
if(fail.length){console.error("STRICT CONTROL FAILED");fail.forEach(x=>console.error("-",x));process.exit(1)}
console.log("CHAT MASTER + M1/M2/M3 + serial leader + M4 + M6 V3 STRICT invariants: OK");
