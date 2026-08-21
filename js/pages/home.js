import {card,combo,variants,bindCollapsibles} from "../ui.js";
export function renderHome(ctx){
 const f=ctx.current, last=ctx.records.at(-1), shift=ctx.shift, mir=ctx.mirrorPred;
 return `<div class="grid cols-3">
 ${card("ПОСЛЕДНИЙ ТИРАЖ",`<div class="muted">${last.date} · ${last.time}</div><div style="margin-top:10px">${combo(last.combo)}</div><div class="ok-text" style="margin-top:9px">Сохранён в базе</div>`)}
 ${card("СЛЕДУЮЩИЙ ТИРАЖ",`<div class="kpi">${f.target.time}</div><div class="muted">${f.target.date}</div>`)}
 ${card("СТАТУС СИСТЕМЫ",`<div class="list"><div class="list-row"><span>Источник</span><b>Столото</b></div><div class="list-row"><span>Версия</span><b>${ctx.version.version}</b></div><div class="list-row"><span>Фактов в базе</span><b>${ctx.records.length}</b></div><div class="list-row"><span>Баз зеркала</span><b>${ctx.mirror.bases.length}</b></div></div>`)}
 </div>
 <div class="section-title">КРАТКИЙ ОБЗОР СЛЕДУЮЩЕГО ПРОГНОЗА</div>
 <div class="grid cols-4">
 ${card("🔵 TOP ЮЛЯ",variants(f.TOP),"forecast-card top")}
 ${card("🟣 Δ",variants(f.DELTA),"forecast-card delta")}
 ${card("🟢 ЧИСЛА",variants(f.NUMBERS),"forecast-card numbers")}
 ${card("➕ ДОПОЛНИТЕЛЬНЫЕ",`<div class="variant"><span>Доп №1</span><b>${ctx.extras.dop1||"—"}</b></div><div class="variant"><span>Доп №2</span><b>${ctx.extras.dop2||"—"}</b></div><div class="variant"><span>Сканер</span><b>${ctx.extras.scanner||"—"}</b></div><div class="variant"><span>Запаздывающий</span><b>${ctx.extras.delayed||"—"}</b></div>`,"forecast-card extra")}
 </div>
 <div class="grid cols-2" style="margin-top:12px">
 ${card("🧬 ДОП ПРОГНОЗ · СМЕНА АЛГОРИТМА",shift.combo?combo(shift.combo):`<b class="warn">НЕТ СИГНАЛА</b><p class="muted">${shift.reason}</p>`,"forecast-card shift")}
 ${card("↔ ЗЕРКАЛО + 15 ТИРАЖЕЙ",mir.length?mir.map(x=>`<div class="list-row"><span>${x.base} + ${x.permutation}</span><b>${x.triple}</b></div>`).join(""):`<b class="muted">СТРОГОГО СИГНАЛА НА ТРОЙНИК НЕТ</b>`,"forecast-card mirror")}
 </div>`;
}
export function mountedHome(){bindCollapsibles()}
