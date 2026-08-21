import {card} from "../ui.js";
export function renderAlgorithm(ctx){
 const s=ctx.shift;
 return `<div class="grid cols-2">${card("НАБЛЮДЕНИЕ АЛГОРИТМА",`<p>Главный файл: <b>TOP3_матрица_наблюдения_алгоритма_с_попаданиями(1).xlsx</b></p><p>Матрицы A/B/C, журнал вариантов, архив 24ч и T3/L3 подключены как отдельный слой.</p><span class="badge ${s.combo?"green":"orange"}">${s.combo?"СИГНАЛ АКТИВЕН":"НЕТ СИГНАЛА"}</span>`) }${card("ДОП ПРОГНОЗ ПРИ СМЕНЕ АЛГОРИТМА",s.combo?`<div class="kpi">${s.combo}</div><p>${s.reason}</p>`:`<b class="warn">НЕТ СИГНАЛА</b><p class="muted">${s.reason}</p>`, "forecast-card shift")}</div>
 <div class="card" style="margin-top:12px"><div class="card-head">ЗАКОН</div><div class="card-body"><p>Этот блок идёт только <b>после основного прогноза</b> и не изменяет TOP / Δ / ЧИСЛА.</p><p>Если точная формула выбора из матрицы не задана, приложение не создаёт цифры самостоятельно.</p></div></div>`;
}
