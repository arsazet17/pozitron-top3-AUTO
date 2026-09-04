import {
  readJSON, writeJSON, createEmptyState,
  ensurePendingForecast, settleForecastForFact, saveStateBundle
} from "./state-engine.mjs";

const API_BASES = [
  "https://www.stoloto.ru/p/api/mobile/api/v35/service/draws/archive",
  "https://www.stoloto.ru/p/api/mobile/api/v34/service/draws/archive"
];

const schedule = ["02:40","04:40","06:40","07:40","09:40","11:40","13:40","16:25","21:25","22:40"];

function nextSlot(last) {
  const i = schedule.indexOf(last.time);
  if (i < 0) throw new Error(`Последнее время ${last.time} отсутствует в расписании`);
  const ni = (i + 1) % schedule.length;
  let date = last.date;
  if (ni === 0) {
    const d = new Date(`${date}T12:00:00+03:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    date = d.toISOString().slice(0, 10);
  }
  return { date, time: schedule[ni] };
}

function moscowParts(value) {
  if (value == null) return null;

  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    let n = Number(value);
    if (n < 2e10) n *= 1000;
    const dt = new Date(n);
    if (!Number.isFinite(dt.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(dt);
    const o = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {date:`${o.year}-${o.month}-${o.day}`, time:`${o.hour}:${o.minute}`};
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return {date:`${m[1]}-${m[2]}-${m[3]}`, time:`${m[4]}:${m[5]}`};

  const dmy = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4}).*?(\d{1,2}):(\d{2})/);
  if (dmy) {
    let y = Number(dmy[3]); if (y < 100) y += 2000;
    return {
      date:`${y}-${String(Number(dmy[2])).padStart(2,"0")}-${String(Number(dmy[1])).padStart(2,"0")}`,
      time:`${String(Number(dmy[4])).padStart(2,"0")}:${dmy[5]}`
    };
  }
  return null;
}

function comboFrom(v) {
  if (Array.isArray(v)) {
    const a = v.flat(Infinity).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 9);
    if (a.length >= 3) return a.slice(0,3).join("");
  }
  if (v && typeof v === "object") {
    for (const k of ["numbers","balls","value","combination","winningCombination"]) {
      const x = comboFrom(v[k]);
      if (x) return x;
    }
  }
  const s = String(v ?? "");
  const ds = s.match(/\d/g);
  if (ds && ds.length >= 3) return ds.slice(0,3).join("");
  return null;
}

function parseDraw(raw) {
  const number = raw?.number ?? raw?.drawNumber ?? raw?.draw ?? raw?.id;
  const combo = comboFrom(
    raw?.winningCombination ??
    raw?.winningNumbers ??
    raw?.numbers ??
    raw?.combination ??
    raw?.result
  );

  const dt = moscowParts(
    raw?.date ??
    raw?.drawDate ??
    raw?.drawDateTime ??
    raw?.eventDate ??
    raw?.timestamp
  );

  if (!number || !combo || !dt) return null;
  return {
    draw: String(number),
    date: dt.date,
    time: dt.time,
    combo
  };
}

async function fetchJson(url, extraHeaders={}) {
  const r = await fetch(url, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0",
      "Device-Type": "MOBILE",
      "Referer": "https://www.stoloto.ru/top3/archive",
      ...extraHeaders
    },
    signal: AbortSignal.timeout(15000)
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0,160)}`);

  try { return JSON.parse(text); }
  catch { throw new Error(`Ответ не JSON: ${text.slice(0,200)}`); }
}

async function loadPage(base, page) {
  const qs = new URLSearchParams({count:"50", game:"top3", page:String(page)});
  const url = `${base}?${qs}`;

  const headerVariants = [
    {},
    {"Gosloto-Partner":"bXMjXFRXZ3coWXh6R3s1NTdUX3dnWlBMLUxmdg"}
  ];

  let lastErr;
  for (const h of headerVariants) {
    try {
      const json = await fetchJson(url, h);
      const arr = Array.isArray(json?.draws) ? json.draws
                : Array.isArray(json?.items) ? json.items
                : Array.isArray(json) ? json
                : [];
      if (!arr.length) throw new Error(`JSON получен, но draws/items пуст; keys=${Object.keys(json ?? {}).join(",")}`);
      return arr.map(parseDraw).filter(Boolean);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function collectUntilKnown(knownNo) {
  let diagnostics = [];
  for (const base of API_BASES) {
    const byNo = new Map();
    try {
      for (let page=1; page<=5; page++) {
        const rows = await loadPage(base, page);
        diagnostics.push(`${base.split("/api/")[1]?.split("/")[0] || base} p${page}=${rows.length}`);
        for (const x of rows) byNo.set(Number(x.draw), x);

        const nums = [...byNo.keys()];
        if (nums.includes(knownNo) || (nums.length && Math.min(...nums) <= knownNo)) break;
        if (rows.length < 50) break;
      }

      if (byNo.size) {
        const rows = [...byNo.values()].sort((a,b)=>Number(a.draw)-Number(b.draw));
        console.log(`TOP-3 API: ${rows.length} тиражей; newest №${rows.at(-1).draw} ${rows.at(-1).date} ${rows.at(-1).time}=${rows.at(-1).combo}`);
        return rows;
      }
    } catch (e) {
      diagnostics.push(`${base}: ${e.message}`);
    }
  }

  throw new Error(`Stoloto API не дал тиражи. ${diagnostics.join(" | ")}`);
}

const archive = readJSON("data/archive.json", []);
const rules = readJSON("data/rules.json", {});
const state = readJSON("data/app-state.json", createEmptyState());
const forecastIndex = readJSON("data/forecast-index.json", []);

if (!Array.isArray(archive) || !archive.length) throw new Error("Архив пуст или повреждён");
if (!Array.isArray(forecastIndex)) throw new Error("forecast-index.json повреждён");

const knownDraw = [...archive].reverse().find(x => x.draw != null && String(x.draw).trim() !== "")?.draw;
if (!knownDraw) throw new Error("В архиве нет опорного номера тиража");

ensurePendingForecast(archive, state, forecastIndex, rules);
saveStateBundle(state, forecastIndex);

const knownNo = Number(knownDraw);
const recent = await collectUntilKnown(knownNo);
const newestNo = Math.max(...recent.map(x => Number(x.draw)));

if (newestNo <= knownNo) {
  console.log(`Новых тиражей нет: API №${newestNo}, сохранён №${knownDraw}.`);
  process.exit(0);
}

const byNo = new Map(recent.map(x => [Number(x.draw), x]));
const missing = [];

for (let n = knownNo + 1; n <= newestNo; n++) {
  const p = byNo.get(n);
  if (!p) throw new Error(`API не вернул обязательный тираж №${n}; данные НЕ записаны`);
  missing.push(p);
}

// В API время иногда может быть серверным/служебным.
// Номер тиража определяет порядок, а реальный слот берём только из расписания приложения.
// Дату API проверяем, если она совпадает по смыслу с ожидаемым календарным днём.
let probe = archive.at(-1);
for (const p of missing) {
  const slot = nextSlot(probe);
  if (p.date && p.date !== slot.date) {
    throw new Error(`№${p.draw}: дата API ${p.date}, ожидалась ${slot.date}; данные НЕ записаны`);
  }
  probe = {date:slot.date, time:slot.time};
}

let lastRec = null;
for (const p of missing) {
  const slot = nextSlot(archive.at(-1));
  const rec = {
    date: slot.date,
    time: slot.time,
    A: +p.combo[0],
    B: +p.combo[1],
    C: +p.combo[2],
    combo: p.combo,
    draw: String(p.draw)
  };

  settleForecastForFact(rec, state, forecastIndex);
  archive.push(rec);
  ensurePendingForecast(archive, state, forecastIndex, rules);
  lastRec = rec;
  console.log("Добавлен", rec);
}

writeJSON("data/archive.json", archive);
writeJSON("data/latest.json", {updatedAt:new Date().toISOString(), draw:lastRec});
saveStateBundle(state, forecastIndex);

console.log(`TOP-3 догнан: +${missing.length}; последний №${lastRec.draw} ${lastRec.date} ${lastRec.time}=${lastRec.combo}`);
