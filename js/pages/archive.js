import {esc} from "../ui.js";

const vNames=["В1","В2","В3","Г→Г"];
function fmt(arr){return (arr||[]).filter(Boolean).join(" / ")||"—"}
function shiftCombo(x){return x?.combo||x||"—"}
function mirrorList(x){return (x||[]).map(v=>v?.triple||v).filter(Boolean).join(" / ")||"—"}
function statusOf(x){return x.factAfter?`Факт ${x.factAfter}`:"ОЖИДАЕТ"}

function archiveCard(x){
  return `<details class="forecast-archive-card searchable-item" data-detail="${esc(x.detailFile||"")}">
    <summary>
      <span><b>${esc(x.target?.date)} · ${esc(x.target?.time)}</b><small>последний факт ${esc(x.lastFact||"—")}</small></span>
      <strong>${esc(statusOf(x))}</strong>
    </summary>
    <div class="forecast-snapshot">
      <div><span>TOP ЮЛЯ</span><b>${esc(fmt(x.TOP))}</b></div>
      <div><span>Δ</span><b>${esc(fmt(x.DELTA))}</b></div>
      <div><span>ЧИСЛА</span><b>${esc(fmt(x.NUMBERS))}</b></div>
      <div><span>Допы / Сканер / Запаздывающий</span><b>${esc(Object.values(x.extras||{}).filter(Boolean).join(" / ")||"—")}</b></div>
      <div><span>Смена алгоритма</span><b>${esc(shiftCombo(x.shift))}</b></div>
      <div><span>Зеркало</span><b>${esc(mirrorList(x.mirror))}</b></div>
      <div><span>Факт выхода</span><b>${esc(x.factAfter||"ещё нет")}</b></div>
    </div>
    <div class="forecast-full-detail muted">Нажмите — загружается полный сохранённый расчёт…</div>
  </details>`;
}
function rawBlock(title,b){
  if(!b)return "";
  return `<div class="raw-block"><h4>${esc(title)}</h4>${["A","B","C"].map(p=>{
    const x=b[p]; if(!x)return "";
    const rows=Object.entries(x.methods||{}).map(([m,v])=>
      `<div class="raw-row"><span>${esc(m)} · L${esc(v.L??"—")}</span><b>${esc((v.transformed||[]).join(", ")||"—")}</b></div>`
    ).join("");
    return `<details><summary>${p} · V ${esc((x.source?.V||[]).join("→"))} · H ${esc((x.source?.H||[]).join("→"))}</summary>${rows}</details>`;
  }).join("")}</div>`;
}
function fullDetail(d){
  const f=d.forecast||{};
  return `<div class="full-forecast">
    <div class="section-title">ПОЛНЫЙ СЛЕПОК ПРОГНОЗА</div>
    <div class="forecast-snapshot">
      <div><span>Создан</span><b>${esc(d.issuedAt||"—")}</b></div>
      <div><span>Последний факт</span><b>${esc(d.lastFact||"—")}</b></div>
      <div><span>Горизонталь 6</span><b>${esc((f.horizontal||[]).join(" → ")||"—")}</b></div>
      <div><span>Вертикаль</span><b>${esc((f.vertical||[]).join(" → ")||"—")}</b></div>
      <div><span>TOP</span><b>${esc(fmt(f.TOP))}</b></div>
      <div><span>Δ</span><b>${esc(fmt(f.DELTA))}</b></div>
      <div><span>ЧИСЛА</span><b>${esc(fmt(f.NUMBERS))}</b></div>
      <div><span>Дополнительные</span><b>${esc(Object.entries(d.extras||{}).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(" · ")||"—")}</b></div>
      <div><span>Смена алгоритма</span><b>${esc(shiftCombo(d.shift))}</b></div>
      <div><span>Зеркало</span><b>${esc(mirrorList(d.mirror))}</b></div>
      <div><span>Факт</span><b>${esc(d.factAfter||"ещё нет")}</b></div>
    </div>
    ${rawBlock("TOP · RAW / цепочки",f.details?.TOP)}
    ${rawBlock("Δ · RAW / цепочки",f.details?.DELTA)}
    ${rawBlock("ЧИСЛА · RAW / цепочки",f.details?.NUMBERS)}
  </div>`;
}

export function renderArchive(ctx){
  const facts=[...ctx.records].slice(-500).reverse();
  const forecasts=[...(ctx.forecastIndex||[])].reverse();
  const hits=[...(ctx.state?.hitLog||[])].reverse();
  return `<div class="card"><div class="card-head">АРХИВ</div><div class="card-body">
    <div class="controls">
      <input id="archiveSearch" placeholder="Дата, время, комбинация, метод">
      <button class="secondary" id="exportBtn">Экспорт архива</button>
    </div>

    <div class="archive-tabs">
      <button class="archive-tab active" data-atab="pred">ПРОГНОЗЫ</button>
      <button class="archive-tab" data-atab="facts">ФАКТЫ</button>
      <button class="archive-tab" data-atab="hits">T3 / L3</button>
      <button class="archive-tab" data-atab="system">СИСТЕМА</button>
    </div>

    <section data-apanel="pred">${forecasts.length?forecasts.map(archiveCard).join(""):'<div class="tfc-empty">Архив прогнозов пока пуст. После запуска автообновления первый полный прогноз будет сохранён в репозитории.</div>'}</section>

    <section data-apanel="facts" hidden>
      <div class="table-wrap"><table class="searchable"><thead><tr><th>Дата</th><th>Время</th><th>Тираж</th><th>Факт</th></tr></thead>
      <tbody>${facts.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td>${esc(r.draw||"—")}</td><td><b>${esc(r.combo)}</b></td></tr>`).join("")}</tbody></table></div>
    </section>

    <section data-apanel="hits" hidden>
      <div class="table-wrap"><table class="searchable"><thead><tr><th>Факт</th><th>Дата/время</th><th>Тип</th><th>Прогноз</th><th>Источник</th><th>Лаг</th></tr></thead>
      <tbody>${hits.flatMap(h=>(h.hits||[]).map(x=>`<tr><td>${esc(h.fact)}</td><td>${esc(h.date)} ${esc(h.time)}</td><td><b>${esc(x.type)}</b></td><td>${esc(x.combo)}</td><td>${esc(x.block)} ${esc(x.variant)}</td><td>${esc(x.lag)} мин</td></tr>`)).join("")}</tbody></table></div>
    </section>

    <section data-apanel="system" hidden>
      <div class="system-log">${[...(ctx.state?.systemLog||[])].reverse().map(x=>`<div class="tfc-row"><span>${esc(x.at)}</span><b>${esc(x.msg)}</b></div>`).join("")||'<div class="tfc-empty">Журнал пуст</div>'}</div>
    </section>
  </div></div>`;
}

export function mountedArchive(ctx){
  document.querySelectorAll(".archive-tab").forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll(".archive-tab").forEach(x=>x.classList.toggle("active",x===btn));
    document.querySelectorAll("[data-apanel]").forEach(p=>p.hidden=p.dataset.apanel!==btn.dataset.atab);
  });

  const inp=document.querySelector("#archiveSearch");
  if(inp)inp.oninput=()=>{
    const q=inp.value.toLowerCase();
    document.querySelectorAll(".searchable tbody tr,.searchable-item").forEach(el=>{
      el.style.display=el.textContent.toLowerCase().includes(q)?"":"none";
    });
  };

  document.querySelectorAll(".forecast-archive-card").forEach(d=>d.addEventListener("toggle",async()=>{
    if(!d.open||d.dataset.loaded==="1")return;
    d.dataset.loaded="1";
    const target=d.querySelector(".forecast-full-detail");
    const file=d.dataset.detail;
    if(!file){target.textContent="Полный файл для этой записи отсутствует.";return}
    try{
      const r=await fetch("./"+file+"?t="+Date.now(),{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      target.classList.remove("muted");
      target.innerHTML=fullDetail(await r.json());
    }catch(e){
      target.textContent="Не удалось загрузить полный прогноз: "+e.message;
    }
  }));

  const e=document.querySelector("#exportBtn");
  if(e)e.onclick=()=>{
    const blob=new Blob([JSON.stringify({
      facts:ctx.records,
      forecasts:ctx.forecastIndex||[],
      hits:ctx.state?.hitLog||[],
      observations:ctx.state?.observations||[],
      systemLog:ctx.state?.systemLog||[]
    },null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="top3-auto-full-archive.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
}
