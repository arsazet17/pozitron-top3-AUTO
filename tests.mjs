import fs from "node:fs";import {computeMainForecast} from "./js/engine/forecast.js";
const records=JSON.parse(fs.readFileSync("./data/archive.json","utf8")),rules=JSON.parse(fs.readFileSync("./data/rules.json","utf8"));
const f=computeMainForecast(records,{date:"2026-08-20",time:"13:40"},rules);
console.log("CONTROL 20.08 13:40",f.TOP,f.DELTA,f.NUMBERS);
const okTop=JSON.stringify(f.TOP)===JSON.stringify(["586","581","620","761"]);
const okD=JSON.stringify(f.DELTA)===JSON.stringify(["752","652","460","961"]);
if(!okTop||!okD){console.error("STRICT CONTROL FAILED");process.exit(1)}
console.log("TOP + DELTA strict control: OK");
console.log("NUMBERS control is printed for parity audit; historical saved tie-break rows require final reconciliation before using them as a hard unit test.");
