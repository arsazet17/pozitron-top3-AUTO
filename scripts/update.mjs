import fs from "node:fs";

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

  // На странице TOP-3 результат выводится тремя двухсимвольными токенами 00..09.
  // Берём только подряд идущую тройку. Произвольные одиночные цифры из текста
  // больше не считаются результатом.
  let nums=tail.match(/(?:^|\s)0([0-9])\s+0([0-9])\s+0([0-9])(?:\s|$)/);

  // Запасной вариант допустим только рядом с явной подписью результата.
  if(!nums){
    nums=tail.match(/(?:Числа|Результат|Комбинация)\s*[:\-]?\s*0?([0-9])\s+0?([0-9])\s+0?([0-9])(?:\s|$)/i);
  }
  if(!nums)throw new Error("Не удалось надёжно распознать три цифры результата");

  return {
    draw:String(head[1]),
    date:isoDate(+head[2],head[3],+head[4]),
    combo:`${nums[1]}${nums[2]}${nums[3]}`
  };
}

const archive=JSON.parse(fs.readFileSync("data/archive.json","utf8"));
if(!Array.isArray(archive)||!archive.length)throw new Error("Архив пуст или повреждён");
const last=archive.at(-1);
const knownDraw=[...archive].reverse().find(x=>x.draw!=null&&String(x.draw).trim()!=="")?.draw;
if(!knownDraw)throw new Error("В архиве нет опорного номера тиража — автоматическое продолжение остановлено");

const res=await fetch(SOURCE,{headers:{"user-agent":"Mozilla/5.0 TOP3-AUTO/1.1"},redirect:"follow"});
if(!res.ok)throw new Error("Stoloto HTTP "+res.status);
const p=parse(await res.text());

const pNo=Number(p.draw), knownNo=Number(knownDraw);
if(!Number.isFinite(pNo)||!Number.isFinite(knownNo))throw new Error("Некорректный номер тиража");
if(archive.some(x=>String(x.draw||"")===p.draw)){
  console.log(`Тираж №${p.draw} уже есть в архиве — пропуск`);
  process.exit(0);
}
if(pNo<=knownNo){
  console.log(`Столото вернул старый тираж №${p.draw}; последний сохранённый №${knownDraw} — пропуск`);
  process.exit(0);
}
if(pNo!==knownNo+1){
  throw new Error(`Обнаружен пропуск тиражей: сохранён №${knownDraw}, сайт показывает №${p.draw}. Автозапись остановлена, чтобы не сдвинуть время.`);
}

const slot=nextSlot(last);
if(p.date!==slot.date){
  throw new Error(`Дата нового тиража ${p.date} не совпадает с ожидаемой ${slot.date}`);
}
if(!resultTimeHasArrived(slot.date,slot.time)){
  console.log(`Тираж №${p.draw} распознан, но слот ${slot.date} ${slot.time} ещё не наступил — запись запрещена`);
  process.exit(0);
}

const rec={
  date:slot.date,
  time:slot.time,
  A:+p.combo[0],
  B:+p.combo[1],
  C:+p.combo[2],
  combo:p.combo,
  draw:p.draw
};

archive.push(rec);
fs.writeFileSync("data/archive.json",JSON.stringify(archive));
fs.writeFileSync("data/latest.json",JSON.stringify({updatedAt:new Date().toISOString(),draw:rec},null,2));
console.log("Добавлен",rec);
