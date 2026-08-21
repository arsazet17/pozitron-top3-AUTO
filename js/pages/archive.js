import {esc} from "../ui.js";
export function renderArchive(ctx){
 const facts=[...ctx.records].slice(-300).reverse(), forecasts=[...(ctx.state?.forecastHistory||[])].reverse(), hits=[...(ctx.state?.hitLog||[])].reverse();
 return `<div class="card"><div class="card-head">АРХИВ</div><div class="card-body">
 <div class="controls"><input id="archiveSearch" placeholder="Поиск по архиву"><button class="secondary" id="exportBtn">Экспорт архива</button></div>
 <div class="section-title">ФАКТЫ</div><div class="table-wrap"><table class="searchable"><thead><tr><th>Дата</th><th>Время</th><th>Тираж</th><th>Факт</th></tr></thead><tbody>${facts.map(r=>`<tr><td>${r.date}</td><td>${r.time}</td><td>${esc(r.draw||"—")}</td><td><b>${r.combo}</b></td></tr>`).join("")}</tbody></table></div>
 <div class="section-title">АРХИВ ПРОГНОЗОВ</div><div class="table-wrap"><table class="searchable"><thead><tr><th>Дата</th><th>Время</th><th>Последний факт</th><th>TOP</th><th>Δ</th><th>ЧИСЛА</th><th>Факт выхода</th></tr></thead><tbody>${forecasts.map(h=>`<tr><td>${h.target.date}</td><td>${h.target.time}</td><td>${h.lastFact}</td><td>${h.forecast.TOP.join("/")}</td><td>${h.forecast.DELTA.join("/")}</td><td>${h.forecast.NUMBERS.join("/")}</td><td>${h.factAfter||"—"}</td></tr>`).join("")}</tbody></table></div>
 <div class="section-title">T3 / L3</div><div class="table-wrap"><table class="searchable"><thead><tr><th>Факт</th><th>Дата/время</th><th>Тип</th><th>Прогноз</th><th>Блок</th><th>Лаг, мин</th></tr></thead><tbody>${hits.flatMap(h=>h.hits.map(x=>`<tr><td>${h.fact}</td><td>${h.date} ${h.time}</td><td>${x.type}</td><td>${x.combo}</td><td>${x.block} ${x.variant}</td><td>${x.lag}</td></tr>`)).join("")}</tbody></table></div>
 </div></div>`;
}
export function mountedArchive(ctx){
 const inp=document.querySelector("#archiveSearch");if(inp)inp.oninput=()=>{const q=inp.value.toLowerCase();document.querySelectorAll(".searchable tbody tr").forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?"":"none")};
 const e=document.querySelector("#exportBtn");if(e)e.onclick=()=>{const blob=new Blob([JSON.stringify({facts:ctx.records,forecasts:ctx.state?.forecastHistory||[],hits:ctx.state?.hitLog||[],observations:ctx.state?.observations||[]},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="top3-full-archive.json";a.click();URL.revokeObjectURL(a.href)};
}
