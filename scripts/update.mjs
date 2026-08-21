import fs from "node:fs";
const SOURCE="https://www.stoloto.ru/top3";
const schedule=["02:40","04:40","06:40","07:40","09:40","11:40","13:40","16:25","21:25","22:40"];
const monthMap={января:1,февраля:2,марта:3,апреля:4,мая:5,июня:6,июля:7,августа:8,сентября:9,октября:10,ноября:11,декабря:12};
function strip(s){return s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ").trim()}
function isoDate(day,mon,year){return `${year}-${String(monthMap[mon.toLowerCase()]).padStart(2,"0")}-${String(day).padStart(2,"0")}`}
function nextSlot(last){
  const i=schedule.indexOf(last.time), ni=(i+1)%schedule.length;let date=last.date;
  if(ni===0){const d=new Date(date+"T12:00:00+03:00");d.setDate(d.getDate()+1);date=d.toISOString().slice(0,10)}
  return {date,time:schedule[ni]};
}
function parse(html){
  const t=strip(html);
  const head=t.match(/Результаты\s+тиража\s*№\s*(\d+)\s*от\s*(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})/i);
  if(!head)throw new Error("Не найден заголовок последнего тиража");
  const pos=t.indexOf(head[0]), tail=t.slice(pos+head[0].length,pos+head[0].length+800);
  const nums=[...tail.matchAll(/(?:^|\s)0?([0-9])(?:\s|$)/g)].slice(0,3).map(x=>x[1]);
  if(nums.length<3)throw new Error("Не найдены три цифры результата");
  return {draw:head[1],date:isoDate(+head[2],head[3],+head[4]),combo:nums.join("")};
}
const archive=JSON.parse(fs.readFileSync("data/archive.json","utf8")), last=archive.at(-1);
const res=await fetch(SOURCE,{headers:{"user-agent":"Mozilla/5.0 TOP3-AUTO/1.0"},redirect:"follow"});if(!res.ok)throw new Error("Stoloto HTTP "+res.status);
const p=parse(await res.text());
if(p.combo===last.combo && p.date===last.date){console.log("Нет нового результата");process.exit(0)}
const slot=nextSlot(last); const rec={date:p.date||slot.date,time:slot.time,A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],combo:p.combo,draw:p.draw};
archive.push(rec);fs.writeFileSync("data/archive.json",JSON.stringify(archive));
fs.writeFileSync("data/latest.json",JSON.stringify({updatedAt:new Date().toISOString(),draw:rec},null,2));
console.log("Добавлен",rec);
