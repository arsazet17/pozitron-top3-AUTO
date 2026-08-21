import fs from "node:fs";
import {computeMainForecast} from "./js/engine/forecast.js";

const records=JSON.parse(fs.readFileSync("./data/archive.json","utf8"));
const rules=JSON.parse(fs.readFileSync("./data/rules.json","utf8"));
const f=computeMainForecast(records,{date:"2026-08-20",time:"13:40"},rules);

const expected={
  TOP:["586","581","620","761"],
  DELTA:["752","652","460","961"],
  NUMBERS:["367","355","123","347"]
};

console.log("CONTROL 20.08 13:40",f.TOP,f.DELTA,f.NUMBERS);
const failures=[];
for(const key of Object.keys(expected)){
  if(JSON.stringify(f[key])!==JSON.stringify(expected[key]))failures.push(`${key}: ${f[key].join("/")} != ${expected[key].join("/")}`);
}
if(failures.length){
  console.error("STRICT CONTROL FAILED");
  for(const failure of failures)console.error(failure);
  process.exit(1);
}
console.log("TOP + DELTA + NUMBERS strict control: OK");
