import fs from "node:fs";
import {readJSON,writeJSON,createEmptyState,ensurePendingForecast,settleForecastForFact,saveStateBundle} from "./state-engine.mjs";

const SOURCE="https://www.stoloto.ru/top3";
const schedule=["02:40","04:40","06:40","07:40","09:40","11:40","13:40","16:25","21:25","22:40"];
const monthMap={января:1,февраля:2,марта:3,апреля:4,мая:5,июня:6,июля:7,августа:8,сентября:9,октября:10,ноября:11,декабря:12};

function strip(s){
  return s.replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/g," ")
    .replace(/&thinsp;|&#8201;/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function isoDate(day,mon,year){
  const m=monthMap[String(mon).toLowerCase()];
  if(!m)throw new Error(`Неизвестный месяц: ${mon}`);
  return `${year}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function resultTimeHasArrived(date,time){
  const [y,m,d]=String(date).split("-").map(Number);
  const [hh,mm]=String(time).split(":").map(Number);
  if(!y||!m||!d||!Number.isFinite(hh)||!Number.isFinite(mm))return false;
  return Date.UTC(y,m-1,d,hh-3,mm)<=Date.now();
}
function nextSlot(last){
  const i=schedule.indexOf(last.time);
  if(i<0)throw new Error(`Последнее время ${last.time} отсутствует в расписании`);
  const ni=(i+1)%schedule.length;
  let date=last.date;
  if(ni===0){
    const d=new Date(`${date}T12:00:00+03:00`);
    d.setDate(d.getDate()+1);
    date=d.toISOString().slice(0,10);
  }
  return {date,time:schedule[ni]};
}
function parse(html){
  const t=strip(html);
  const head=t.match(/Результаты\s+тиража\s*№\s*(\d+)\s*от\s*(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})/i);
  if(!head)throw new Error("Не найден заголовок последнего тиража");

  const pos=t.indexOf(head[0]);
  const tail=t.slice(pos+head[0].length,pos+head[0].length+1000);
  let nums=tail.match(/(?:^|\s)0([0-9])\s+0([0-9])\s+0([0-9])(?:\s|$)/);
  if(!nums)nums=tail.match(/(?:Числа|Результат|Комбинация)\s*[:\-]?\s*0?([0-9])\s+0?([0-9])\s+0?([0-9])(?:\s|$)/i);
  if(!nums)throw new Error("Не удалось надёжно распознать три цифры результата");

  return {draw:String(head[1]),date:isoDate(+head[2],head[3],+head[4]),combo:`${nums[1]}${nums[2]}${nums[3]}`};
}

const archive=readJSON("data/archive.json",[]);
const rules=readJSON("data/rules.json",{});
const state=readJSON("data/app-state.json",createEmptyState());
const forecastIndex=readJSON("data/forecast-index.json",[]);
if(!Array.isArray(archive)||!archive.length)throw new Error("Архив пуст или повреждён");
if(!Array.isArray(forecastIndex))throw new Error("forecast-index.json повреждён");

const last=archive.at(-1);
const knownDraw=[...archive].reverse().find(x=>x.draw!=null&&String(x.draw).trim()!=="")?.draw;
if(!knownDraw)throw new Error("В архиве нет опорного номера тиража — автоматическое продолжение остановлено");

// ВАЖНО: прогноз на следующий тираж фиксируется ДО чтения нового результата.
ensurePendingForecast(archive,state,forecastIndex,rules);
saveStateBundle(state,forecastIndex);

const res=await fetch(SOURCE,{headers:{"user-agent":"Mozilla/5.0 TOP3-AUTO/1.1"},redirect:"follow"});
if(!res.ok)throw new Error("Stoloto HTTP "+res.status);
const p=parse(await res.text());

const pNo=Number(p.draw), knownNo=Number(knownDraw);
if(!Number.isFinite(pNo)||!Number.isFinite(knownNo))throw new Error("Некорректный номер тиража");

if(archive.some(x=>String(x.draw||"")===p.draw)){
  console.log(`Тираж №${p.draw} уже есть. Текущий прогноз и серверный архив синхронизированы.`);
  process.exit(0);
}
if(pNo<=knownNo){
  console.log(`Столото вернул старый тираж №${p.draw}; последний сохранённый №${knownDraw}.`);
  process.exit(0);
}
if(pNo!==knownNo+1){
  throw new Error(`Обнаружен пропуск тиражей: сохранён №${knownDraw}, сайт показывает №${p.draw}. Автозапись остановлена.`);
}

const slot=nextSlot(last);
if(p.date!==slot.date)throw new Error(`Дата нового тиража ${p.date} не совпадает с ожидаемой ${slot.date}`);
if(!resultTimeHasArrived(slot.date,slot.time)){
  console.log(`Тираж №${p.draw} распознан, но слот ${slot.date} ${slot.time} ещё не наступил — запись запрещена`);
  process.exit(0);
}

const rec={
  date:slot.date,time:slot.time,
  A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],
  combo:p.combo,draw:p.draw
};

// 1. Проверяем именно тот прогноз, который был сохранён ДО выхода факта.
settleForecastForFact(rec,state,forecastIndex);

// 2. Добавляем факт в постоянный архив.
archive.push(rec);
writeJSON("data/archive.json",archive);
writeJSON("data/latest.json",{updatedAt:new Date().toISOString(),draw:rec});

// 3. После нового факта создаём полный прогноз на следующий тираж.
ensurePendingForecast(archive,state,forecastIndex,rules);
saveStateBundle(state,forecastIndex);

console.log("Добавлен и полностью обработан",rec);
