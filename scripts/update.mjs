import fs from "node:fs";
import {readJSON,writeJSON,createEmptyState,ensurePendingForecast,settleForecastForFact,saveStateBundle} from "./state-engine.mjs";

const SOURCE="https://www.stoloto.ru/top3";
const ARCHIVE_SOURCE="https://www.stoloto.ru/top3/archive";
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
  const tail=t.slice(pos+head[0].length,pos+head[0].length+1400);
  let nums=tail.match(/(?:^|\s)0([0-9])\s+0([0-9])\s+0([0-9])(?:\s|$)/);
  if(!nums)nums=tail.match(/(?:Числа|Результат|Комбинация)\s*[:\-]?\s*0?([0-9])\s+0?([0-9])\s+0?([0-9])(?:\s|$)/i);
  if(!nums)throw new Error("Не удалось надёжно распознать три цифры результата");

  return {draw:String(head[1]),date:isoDate(+head[2],head[3],+head[4]),combo:`${nums[1]}${nums[2]}${nums[3]}`};
}
async function fetchParsed(url){
  const res=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 TOP3-AUTO/1.2"},redirect:"follow",cache:"no-store"});
  if(!res.ok)throw new Error(`${url}: HTTP ${res.status}`);
  return parse(await res.text());
}

const archive=readJSON("data/archive.json",[]);
const rules=readJSON("data/rules.json",{});
const state=readJSON("data/app-state.json",createEmptyState());
const forecastIndex=readJSON("data/forecast-index.json",[]);
if(!Array.isArray(archive)||!archive.length)throw new Error("Архив пуст или повреждён");
if(!Array.isArray(forecastIndex))throw new Error("forecast-index.json повреждён");

const knownDraw=[...archive].reverse().find(x=>x.draw!=null&&String(x.draw).trim()!=="")?.draw;
if(!knownDraw)throw new Error("В архиве нет опорного номера тиража — автоматическое продолжение остановлено");

// Frozen на следующий тираж обязан существовать ДО чтения нового факта.
ensurePendingForecast(archive,state,forecastIndex,rules);
saveStateBundle(state,forecastIndex);

const newest=await fetchParsed(SOURCE);
const newestNo=Number(newest.draw), knownNo=Number(knownDraw);
if(!Number.isFinite(newestNo)||!Number.isFinite(knownNo))throw new Error("Некорректный номер тиража");

if(newestNo<=knownNo){
  console.log(`Новых тиражей нет: сайт №${newest.draw}, последний сохранённый №${knownDraw}.`);
  process.exit(0);
}

// Если GitHub/диспетчер пропустил несколько запусков, забираем всю цепочку,
// а не останавливаемся на ошибке "пропуск тиражей".
const missing=[];
for(let n=knownNo+1;n<=newestNo;n++){
  const p=n===newestNo?newest:await fetchParsed(`${ARCHIVE_SOURCE}/${n}`);
  if(Number(p.draw)!==n)throw new Error(`Архивная страница №${n} вернула тираж №${p.draw}`);
  missing.push(p);
}

// Сначала проверяем всю цепочку и только потом меняем файлы.
let probeLast=archive.at(-1);
for(const p of missing){
  const slot=nextSlot(probeLast);
  if(p.date!==slot.date)throw new Error(`Дата тиража №${p.draw} (${p.date}) не совпадает с ожидаемой ${slot.date}`);
  if(!resultTimeHasArrived(slot.date,slot.time))throw new Error(`Слот ${slot.date} ${slot.time} для №${p.draw} ещё не наступил`);
  probeLast={date:slot.date,time:slot.time};
}

let lastRec=null;
for(const p of missing){
  const slot=nextSlot(archive.at(-1));
  const rec={
    date:slot.date,time:slot.time,
    A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],
    combo:p.combo,draw:p.draw
  };

  // 1. Закрываем только прогноз, который был frozen до этого факта.
  settleForecastForFact(rec,state,forecastIndex);

  // 2. Добавляем факт.
  archive.push(rec);

  // 3. Немедленно создаём frozen на следующий слот, прежде чем применять
  // следующий пропущенный факт. Так сохраняется anti-leakage.
  ensurePendingForecast(archive,state,forecastIndex,rules);
  lastRec=rec;
  console.log("Добавлен и полностью обработан",rec);
}

writeJSON("data/archive.json",archive);
writeJSON("data/latest.json",{updatedAt:new Date().toISOString(),draw:lastRec});
saveStateBundle(state,forecastIndex);

console.log(`TOP-3 догнан: добавлено ${missing.length} тираж(а/ей), последний №${lastRec.draw} ${lastRec.date} ${lastRec.time} = ${lastRec.combo}`);
