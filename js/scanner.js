import {sortRecords} from "./core.js";
function dateShift(date,days){const d=new Date(`${date}T12:00:00+03:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
export function scannerForecast(records,target,rules){
  const rule=rules.scannerRules[target.time]; if(!rule)return null;
  const schedule=rules.schedule, arr=sortRecords(records), find=(date,time)=>arr.find(r=>r.date===date&&r.time===time), out={};
  for(const p of ["A","B","C"]){
    const kind=rule[p]; let d=dateShift(target.date,-1), t=target.time;
    if(kind==="twoDaysBackSameTime")d=dateShift(target.date,-2);
    if(kind==="prevDayPrevTime"){const i=schedule.indexOf(target.time);t=schedule[(i-1+schedule.length)%schedule.length]}
    if(kind==="prevDayNextTime"){const i=schedule.indexOf(target.time);t=schedule[(i+1)%schedule.length]}
    const r=find(d,t); if(!r)return null; out[p]=r[p];
  }
  return `${out.A}${out.B}${out.C}`;
}
