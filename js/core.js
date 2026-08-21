export const POSITIONS = ["A","B","C"];
export const METHODS = ["VV","VH","HV","HH"];
export const METHOD_DEF = {
  VV:{source:"V",target:"V"}, VH:{source:"V",target:"H"},
  HV:{source:"H",target:"V"}, HH:{source:"H",target:"H"}
};
export const mod10 = n => ((n%10)+10)%10;
export const comboOf = r => `${r.A}${r.B}${r.C}`;
export function parseDT(r){ return new Date(`${r.date}T${r.time}:00+03:00`); }
export function sortRecords(records){ return [...records].sort((a,b)=>parseDT(a)-parseDT(b)); }
export function uniquePermutations(s){
  const a=[...String(s)], out=new Set();
  function rec(prefix, rest){ if(!rest.length){out.add(prefix);return;} for(let i=0;i<rest.length;i++) rec(prefix+rest[i],rest.slice(0,i).concat(rest.slice(i+1))); }
  rec("",a); return [...out];
}
export function mirrorCombo(combo, map){ return [...combo].map(x=>String(map[x])).join(""); }
export function nextScheduleTime(current,schedule){
  const i=schedule.indexOf(current); return schedule[(i+1+schedule.length)%schedule.length];
}
export function nextTarget(records,schedule){
  const s=sortRecords(records), last=s.at(-1), t=nextScheduleTime(last.time,schedule);
  let d=last.date; if(schedule.indexOf(t)<=schedule.indexOf(last.time)) { const x=new Date(`${d}T12:00:00+03:00`); x.setDate(x.getDate()+1); d=x.toISOString().slice(0,10); }
  return {date:d,time:t};
}
export function addDeltas(records){
  const s=sortRecords(records); return s.map((r,i)=>{
    const x={...r}; if(i===0){x.dA=x.dB=x.dC=null;} else for(const p of POSITIONS)x["d"+p]=mod10(r[p]-s[i-1][p]); return x;
  });
}
