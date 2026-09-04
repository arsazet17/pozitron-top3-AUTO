import fs from "node:fs";
import {
  readJSON, writeJSON, createEmptyState,
  ensurePendingForecast, settleForecastForFact, saveStateBundle
} from "./state-engine.mjs";

const TAIL_FILE = "/tmp/top3_official_tail.json";
const archive = readJSON("data/archive.json", []);
const rules = readJSON("data/rules.json", {});
const state = readJSON("data/app-state.json", createEmptyState());
const forecastIndex = readJSON("data/forecast-index.json", []);

if (!Array.isArray(archive) || !archive.length) throw new Error("data/archive.json пуст или повреждён");
if (!Array.isArray(rules.schedule) || !rules.schedule.length) throw new Error("В data/rules.json нет schedule");
if (!Array.isArray(forecastIndex)) throw new Error("data/forecast-index.json повреждён");
if (!fs.existsSync(TAIL_FILE)) throw new Error("Нет /tmp/top3_official_tail.json от авторизованного reader");

const schedule = rules.schedule;
const tail = JSON.parse(fs.readFileSync(TAIL_FILE, "utf8"));

function nextSlot(last) {
  const i = schedule.indexOf(last.time);
  if (i < 0) throw new Error(`Последнее время ${last.time} отсутствует в schedule`);
  const ni = (i + 1) % schedule.length;
  let date = last.date;
  if (ni === 0) {
    const d = new Date(`${date}T12:00:00+03:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    date = d.toISOString().slice(0, 10);
  }
  return {date, time: schedule[ni]};
}

function validTailRow(x) {
  return x && Number.isInteger(Number(x.draw)) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")) && schedule.includes(String(x.time || "")) && /^\d{3}$/.test(String(x.combo || ""));
}

if (!Array.isArray(tail) || tail.length < 3 || !tail.every(validTailRow)) throw new Error("Авторизованный хвост TOP-3 имеет неверный формат");
tail.sort((a,b) => Number(a.draw) - Number(b.draw));

const known = [...archive].reverse().find(x => x?.draw != null && String(x.draw).trim() !== "");
if (!known) throw new Error("В архиве нет опорного номера тиража");

const knownNo = Number(known.draw);
const newestNo = Number(tail.at(-1).draw);
console.log(`LOCAL №${knownNo} ${known.date} ${known.time}=${known.combo}; STOLOTO №${newestNo} ${tail.at(-1).date} ${tail.at(-1).time}=${tail.at(-1).combo}`);

ensurePendingForecast(archive, state, forecastIndex, rules);
saveStateBundle(state, forecastIndex);

if (newestNo <= knownNo) {
  console.log("Новых официальных тиражей нет.");
  process.exit(0);
}

const byNo = new Map(tail.map(x => [Number(x.draw), x]));
const missing = [];
for (let n = knownNo + 1; n <= newestNo; n++) {
  const row = byNo.get(n);
  if (!row) throw new Error(`Авторизованный хвост не содержит обязательный №${n}. Ничего не записано; нужен более длинный хвост.`);
  missing.push(row);
}

let probe = archive.at(-1);
for (const row of missing) {
  const expected = nextSlot(probe);
  if (row.date !== expected.date || row.time !== expected.time) {
    throw new Error(`№${row.draw}: Stoloto дал ${row.date} ${row.time}, а по расписанию ожидается ${expected.date} ${expected.time}. Ничего не записано.`);
  }
  probe = {date: row.date, time: row.time};
}

let lastAdded = null;
for (const row of missing) {
  const rec = {
    date: row.date,
    time: row.time,
    A: Number(row.combo[0]),
    B: Number(row.combo[1]),
    C: Number(row.combo[2]),
    combo: row.combo,
    draw: String(row.draw)
  };
  settleForecastForFact(rec, state, forecastIndex);
  archive.push(rec);
  ensurePendingForecast(archive, state, forecastIndex, rules);
  lastAdded = rec;
  console.log(`ADDED №${rec.draw} ${rec.date} ${rec.time}=${rec.combo}`);
}

writeJSON("data/archive.json", archive);
writeJSON("data/latest.json", {updatedAt: new Date().toISOString(), draw: lastAdded});
saveStateBundle(state, forecastIndex);
console.log(`TOP-3 CAUGHT UP: +${missing.length}; latest №${lastAdded.draw} ${lastAdded.date} ${lastAdded.time}=${lastAdded.combo}`);
