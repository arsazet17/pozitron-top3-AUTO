import {card,variants,bindCollapsibles,esc} from "../ui.js";
function detailBlock(name,b){
 return card(name,["A","B","C"].map(p=>`<details><summary>${p} · источник V ${b[p].source.V.join("→")} · H ${b[p].source.H.join("→")}</summary><div>${Object.entries(b[p].methods).map(([m,v])=>`<div class="list-row"><span>${m} · L${v.L??"—"}</span><span>${esc(v.transformed.join(","))||"—"}</span></div>`).join("")}</div></details>`).join(""));
}
export function renderForecasts(ctx){
 const f=ctx.current;
 return `<div class="card"><div class="card-head">ПРОГНОЗ НА ${f.target.date} · ${f.target.time}</div><div class="card-body"><span class="muted">Последний факт:</span> <b>${f.lastFact}</b><br><span class="muted">Горизонталь 6:</span> ${f.horizontal.join(" → ")}<br><span class="muted">Вертикаль:</span> ${f.vertical.join(" → ")}</div></div>
 <div class="grid cols-3" style="margin-top:12px">${card("🔵 TOP ЮЛЯ",variants(f.TOP),"forecast-card top")}${card("🟣 Δ",variants(f.DELTA),"forecast-card delta")}${card("🟢 ЧИСЛА",variants(f.NUMBERS),"forecast-card numbers")}</div>
 <div class="grid cols-2" style="margin-top:12px">${card("ДОПОЛНИТЕЛЬНЫЕ",`<div class="variant"><span>Доп №1</span><b>${ctx.extras.dop1||"—"}</b></div><div class="variant"><span>Доп №2</span><b>${ctx.extras.dop2||"—"}</b></div><div class="variant"><span>Доп №3</span><b>${ctx.extras.dop3||"—"}</b></div><div class="variant"><span>Сканер</span><b>${ctx.extras.scanner||"—"}</b></div><div class="variant"><span>Запаздывающий</span><b>${ctx.extras.delayed||"—"}</b></div>`,"forecast-card extra")}${card("ИТОГ",`<b>TOP:</b> ${f.TOP.join(" / ")}<br><b>Δ:</b> ${f.DELTA.join(" / ")}<br><b>ЧИСЛА:</b> ${f.NUMBERS.join(" / ")}<br><b>Смена алгоритма:</b> ${ctx.shift.combo||"нет сигнала"}<br><b>Зеркало:</b> ${ctx.mirrorPred.map(x=>x.triple).join(", ")||"нет сигнала"}`)}</div>
 <div class="section-title">ДЕТАЛИ РАСЧЁТА</div>${detailBlock("TOP · ВСЕ ПРОДОЛЖЕНИЯ",f.details.TOP)}${detailBlock("Δ · ВСЕ ПРОДОЛЖЕНИЯ",f.details.DELTA)}${detailBlock("ЧИСЛА · ВСЕ ПРОДОЛЖЕНИЯ",f.details.NUMBERS)}`;
}
export function mountedForecasts(){bindCollapsibles()}
