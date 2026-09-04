import { chromium } from "playwright";
import {readJSON,writeJSON,createEmptyState,ensurePendingForecast,settleForecastForFact,saveStateBundle} from "./state-engine.mjs";

const ARCHIVE_URL="https://m.stoloto.ru/top3/archive/";
const schedule=["02:40","04:40","06:40","07:40","09:40","11:40","13:40","16:25","21:25","22:40"];
const scheduleSet=new Set(schedule);
const monthMap={января:1,февраля:2,марта:3,апреля:4,мая:5,июня:6,июля:7,августа:8,сентября:9,октября:10,ноября:11,декабря:12};

function norm(s){return String(s??"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();}
function isoDate(day,mon,year){
  const m=monthMap[String(mon).toLowerCase()];
  if(!m) return null;
  return `${year}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function parseDate(text){
  const s=norm(text).toLowerCase();
  let m=s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if(m){
    let y=+m[3]; if(y<100)y+=2000;
    return `${y}-${String(+m[2]).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
  }
  m=s.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})\b/i);
  return m?isoDate(+m[1],m[2],+m[3]):null;
}
function parseTime(text){
  const m=String(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(!m)return null;
  return `${String(+m[1]).padStart(2,"0")}:${m[2]}`;
}
function parseDraw(text){
  const m=String(text).match(/№\s*(\d{4,})/);
  return m?String(m[1]):null;
}
function parseCombo(text){
  const s=norm(text);

  // На карточках TOP-3 цифры могут быть записаны как 08 08 05 либо как 8 8 5.
  let m=s.match(/(?:^|\s)0([0-9])\s+0([0-9])\s+0([0-9])(?:\s|$)/);
  if(m)return `${m[1]}${m[2]}${m[3]}`;

  // Сначала ищем тройку после служебных слов, если они присутствуют.
  m=s.match(/(?:числа|результат|комбинация)\s*[:\-]?\s*0?([0-9])\s+0?([0-9])\s+0?([0-9])(?:\s|$)/i);
  if(m)return `${m[1]}${m[2]}${m[3]}`;

  // Резерв: отдельные однозначные/двузначные с ведущим нулём числа в строке.
  const toks=[...s.matchAll(/(?:^|\s)0?([0-9])(?=\s|$)/g)].map(x=>x[1]);
  if(toks.length>=3)return toks.slice(-3).join("");
  return null;
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
function resultTimeHasArrived(date,time){
  const [y,m,d]=String(date).split("-").map(Number);
  const [hh,mm]=String(time).split(":").map(Number);
  return Date.UTC(y,m-1,d,hh-3,mm)<=Date.now();
}

async function collectRecent(){
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({
      locale:"ru-RU",
      timezoneId:"Europe/Moscow",
      viewport:{width:390,height:844}
    });
    const page=await ctx.newPage();
    await page.goto(ARCHIVE_URL,{waitUntil:"domcontentloaded",timeout:60000});
    try{await page.waitForLoadState("networkidle",{timeout:15000});}catch{}
    await page.waitForTimeout(5000);

    const raw=await page.locator("body").evaluate(() => {
      const norm=s=>String(s||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
      const all=[...document.querySelectorAll("body *")];

      // Берём самые маленькие DOM-элементы, в которых виден номер тиража.
      let rows=all.filter(el=>{
        const t=norm(el.innerText||"");
        if(!/№\s*\d{4,}/.test(t))return false;
        return ![...el.children].some(ch=>/№\s*\d{4,}/.test(norm(ch.innerText||"")));
      });

      return rows.map(el=>{
        let text=norm(el.innerText||"");
        let p=el.parentElement;
        // Добавляем ближайший контейнер, чтобы захватить дату/время/цифры,
        // но не весь документ.
        for(let i=0;i<4 && p;i++,p=p.parentElement){
          const pt=norm(p.innerText||"");
          if(pt.length>text.length && pt.length<1800) text=pt;
          if(/\b\d{1,2}:\d{2}\b/.test(text) &&
             /(?:\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}\s+[А-Яа-яЁё]+\s+\d{4}\b)/.test(text)) break;
        }
        return text;
      });
    });

    const out=[];
    for(const text0 of raw){
      const text=norm(text0);
      const draw=parseDraw(text), date=parseDate(text), time=parseTime(text), combo=parseCombo(text);
      if(draw && date && scheduleSet.has(time) && combo && /^\d{3}$/.test(combo)){
        out.push({draw,date,time,combo});
      }
    }

    // Фолбэк: если карточки сайта поменяли DOM, разбираем текст страницы блоками вокруг №.
    if(out.length<3){
      const body=await page.locator("body").innerText();
      const chunks=String(body).split(/(?=№\s*\d{4,})/);
      for(const chunk of chunks){
        const text=norm(chunk.slice(0,1200));
        const draw=parseDraw(text), date=parseDate(text), time=parseTime(text), combo=parseCombo(text);
        if(draw && date && scheduleSet.has(time) && combo && /^\d{3}$/.test(combo)){
          out.push({draw,date,time,combo});
        }
      }
    }

    const uniq=new Map();
    for(const x of out)uniq.set(Number(x.draw),x);
    const rows=[...uniq.values()].sort((a,b)=>Number(a.draw)-Number(b.draw));

    if(!rows.length){
      const title=await page.title();
      const bodyHead=norm((await page.locator("body").innerText()).slice(0,900));
      throw new Error(`TOP-3 archive parsed 0 draws; url=${page.url()} title=${title}; bodyHead=${bodyHead}`);
    }

    console.log(`TOP-3 browser: parsed ${rows.length} recent draws; newest №${rows.at(-1).draw} ${rows.at(-1).date} ${rows.at(-1).time}=${rows.at(-1).combo}`);
    return rows;
  } finally {
    await browser.close();
  }
}

const archive=readJSON("data/archive.json",[]);
const rules=readJSON("data/rules.json",{});
const state=readJSON("data/app-state.json",createEmptyState());
const forecastIndex=readJSON("data/forecast-index.json",[]);
if(!Array.isArray(archive)||!archive.length)throw new Error("Архив пуст или повреждён");
if(!Array.isArray(forecastIndex))throw new Error("forecast-index.json повреждён");

const knownDraw=[...archive].reverse().find(x=>x.draw!=null&&String(x.draw).trim()!=="")?.draw;
if(!knownDraw)throw new Error("В архиве нет опорного номера тиража");

ensurePendingForecast(archive,state,forecastIndex,rules);
saveStateBundle(state,forecastIndex);

const recent=await collectRecent();
const knownNo=Number(knownDraw);
const newestNo=Math.max(...recent.map(x=>Number(x.draw)));
if(newestNo<=knownNo){
  console.log(`Новых тиражей нет: сайт №${newestNo}, последний сохранённый №${knownDraw}.`);
  process.exit(0);
}

const byNo=new Map(recent.map(x=>[Number(x.draw),x]));
const missing=[];
for(let n=knownNo+1;n<=newestNo;n++){
  const p=byNo.get(n);
  if(!p){
    throw new Error(`В отрисованном архиве нет обязательного пропущенного тиража №${n}. Ничего не записано.`);
  }
  missing.push(p);
}

// Полная предварительная проверка цепочки.
let probeLast=archive.at(-1);
for(const p of missing){
  const slot=nextSlot(probeLast);
  if(p.date!==slot.date || p.time!==slot.time){
    throw new Error(`№${p.draw}: сайт дал ${p.date} ${p.time}, ожидалось ${slot.date} ${slot.time}`);
  }
  if(!resultTimeHasArrived(slot.date,slot.time)){
    throw new Error(`Слот ${slot.date} ${slot.time} для №${p.draw} ещё не наступил`);
  }
  probeLast={date:slot.date,time:slot.time};
}

// Применяем строго по одному факту: frozen -> факт -> следующий frozen.
let lastRec=null;
for(const p of missing){
  const slot=nextSlot(archive.at(-1));
  const rec={
    date:slot.date,time:slot.time,
    A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],
    combo:p.combo,draw:String(p.draw)
  };
  settleForecastForFact(rec,state,forecastIndex);
  archive.push(rec);
  ensurePendingForecast(archive,state,forecastIndex,rules);
  lastRec=rec;
  console.log("Добавлен и полностью обработан",rec);
}

writeJSON("data/archive.json",archive);
writeJSON("data/latest.json",{updatedAt:new Date().toISOString(),draw:lastRec});
saveStateBundle(state,forecastIndex);
console.log(`TOP-3 догнан: +${missing.length}; последний №${lastRec.draw} ${lastRec.date} ${lastRec.time}=${lastRec.combo}`);
