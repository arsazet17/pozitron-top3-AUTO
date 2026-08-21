import {card,esc} from "../ui.js";

const variantNames=["В1","В2","В3","Г→Г"];
function sameMultiset(a,b){return [...String(a)].sort().join("")===[...String(b)].sort().join("")}
function fmt(v){return v===null||v===undefined||v===""?"—":String(v)}
function comboRows(arr){
  return variantNames.map((n,i)=>`<div class="live-variant"><span>${n}</span><b>${esc(fmt(arr?.[i]))}</b></div>`).join("");
}
function combosOf(x){
  const out=[];
  for(const block of ["TOP","DELTA","NUMBERS"]){
    for(let i=0;i<4;i++){
      const c=x?.[block]?.[i];
      if(/^\d{3}$/.test(String(c||"")))out.push({name:`${block} ${variantNames[i]}`,combo:String(c)});
    }
  }
  for(const [k,v] of Object.entries(x.extras||{}))if(/^\d{3}$/.test(String(v||"")))out.push({name:`ДОП ${k}`,combo:String(v)});
  const s=x.shift?.combo||x.shift;
  if(/^\d{3}$/.test(String(s||"")))out.push({name:"СМЕНА АЛГОРИТМА",combo:String(s)});
  for(const m of x.mirror||[]){
    const c=m?.triple||m;
    if(/^\d{3}$/.test(String(c||"")))out.push({name:"ЗЕРКАЛО",combo:String(c)});
  }
  return out;
}
function methodStats(index){
  const m=new Map();
  for(const x of index){
    if(!x.factAfter)continue;
    for(const p of combosOf(x)){
      const s=m.get(p.name)||{issued:0,t3:0,l3:0};
      s.issued++;
      if(p.combo===x.factAfter)s.t3++;
      else if(sameMultiset(p.combo,x.factAfter))s.l3++;
      m.set(p.name,s);
    }
  }
  return [...m].sort((a,b)=>b[1].t3-a[1].t3||b[1].l3-a[1].l3||a[0].localeCompare(b[0]));
}
function timeStats(index){
  const map=new Map();
  for(const x of index){
    if(!x.factAfter)continue;
    const s=map.get(x.target.time)||{n:0,t3:0,l3:0};
    s.n++;
    let hasT=false,hasL=false;
    for(const p of combosOf(x)){
      if(p.combo===x.factAfter)hasT=true;
      else if(sameMultiset(p.combo,x.factAfter))hasL=true;
    }
    if(hasT)s.t3++; else if(hasL)s.l3++;
    map.set(x.target.time,s);
  }
  return [...map].sort((a,b)=>a[0].localeCompare(b[0]));
}
function lagStats(hitLog){
  const map=new Map();
  for(const h of hitLog||[])for(const x of h.hits||[]){
    const k=String(x.lag);
    const s=map.get(k)||{t3:0,l3:0};
    if(x.type==="T3")s.t3++; else s.l3++;
    map.set(k,s);
  }
  return [...map].sort((a,b)=>Number(a[0])-Number(b[0]));
}
function extrasPanel(ctx){
  const e=ctx.extras||{};
  return [
    ["Доп №1",e.dop1],["Доп №2",e.dop2],["Доп №3",e.dop3],
    ["Сканер",e.scanner],["Запаздывающий",e.delayed]
  ].map(([n,v])=>`<div class="live-variant"><span>${n}</span><b>${esc(fmt(v))}</b></div>`).join("");
}
function mirrorText(ctx){
  return (ctx.mirrorPred||[]).map(x=>x?.triple||x).filter(Boolean).join(" / ")||"нет сигнала";
}
function liveDashboard(ctx){
  const f=ctx.current||{};
  const shift=ctx.shift||{};
  return `<section class="stats-live">
    <div class="stats-live-title">
      <div><span>ТЕКУЩИЙ ПОЛНЫЙ ПРОГНОЗ</span><b>${esc(fmt(f.target?.date))} · ${esc(fmt(f.target?.time))}</b></div>
      <div class="stats-last-fact"><span>Последний факт</span><b>${esc(fmt(f.lastFact))}</b></div>
    </div>
    <div class="stats-live-board">
      <div class="live-panel live-source">
        <h3>ИСХОДНЫЕ ЦЕПОЧКИ</h3>
        <div class="live-chain"><span>Горизонталь 6</span><b>${esc((f.horizontal||[]).join(" → ")||"—")}</b></div>
        <div class="live-chain"><span>Вертикаль</span><b>${esc((f.vertical||[]).join(" → ")||"—")}</b></div>
      </div>
      <div class="live-panel live-top"><h3>🔵 TOP ЮЛЯ</h3>${comboRows(f.TOP)}</div>
      <div class="live-panel live-delta"><h3>🟣 Δ</h3>${comboRows(f.DELTA)}</div>
      <div class="live-panel live-numbers"><h3>🟢 ЧИСЛА</h3>${comboRows(f.NUMBERS)}</div>
      <div class="live-panel live-extra"><h3>ДОПОЛНИТЕЛЬНЫЕ</h3>${extrasPanel(ctx)}</div>
      <div class="live-panel live-signals">
        <h3>СИГНАЛЫ</h3>
        <div class="live-signal"><span>Смена алгоритма</span><b>${esc(shift.combo||"нет сигнала")}</b></div>
        <small>${esc(shift.reason||shift.status||"")}</small>
        <div class="live-signal"><span>Зеркало</span><b>${esc(mirrorText(ctx))}</b></div>
        <div class="live-signal"><span>Наблюдений</span><b>${ctx.state?.observations?.length||0}</b></div>
      </div>
    </div>
  </section>`;
}

export function renderStats(ctx){
  const idx=ctx.forecastIndex||[];
  const done=idx.filter(x=>x.factAfter);
  const ms=methodStats(idx), ts=timeStats(idx), ls=lagStats(ctx.state?.hitLog);
  const exact=done.filter(x=>combosOf(x).some(p=>p.combo===x.factAfter)).length;
  const loose=done.filter(x=>!combosOf(x).some(p=>p.combo===x.factAfter)&&combosOf(x).some(p=>sameMultiset(p.combo,x.factAfter))).length;
  const obs=(ctx.state?.observations||[]).length;
  const shift=ctx.shift||{};
  return `${liveDashboard(ctx)}
  <div class="section-title stats-section-title">СТАТИСТИКА ПРОГНОЗОВ</div>
  <div class="grid cols-4">
    ${card("ПРОВЕРЕНО ПРОГНОЗОВ",`<div class="kpi">${done.length}</div>`)}
    ${card("ЕСТЬ T3",`<div class="kpi">${exact}</div><div class="muted">${done.length?Math.round(exact/done.length*100):0}% тиражей</div>`)}
    ${card("ЕСТЬ L3 БЕЗ T3",`<div class="kpi">${loose}</div>`)}
    ${card("МАТРИЦА АЛГОРИТМА",`<div class="kpi">${obs}</div><div class="muted">наблюдений</div>`)}
  </div>

  ${card("СТАТИСТИКА ПО МЕТОДАМ",`<div class="table-wrap"><table><thead><tr><th>Метод</th><th>Проверено</th><th>T3</th><th>L3</th><th>T3 %</th></tr></thead><tbody>
    ${ms.map(([n,s])=>`<tr><td>${esc(n)}</td><td>${s.issued}</td><td><b>${s.t3}</b></td><td>${s.l3}</td><td>${s.issued?Math.round(s.t3/s.issued*100):0}%</td></tr>`).join("")||'<tr><td colspan="5">Статистика появится после сохранения и проверки новых прогнозов.</td></tr>'}
  </tbody></table></div>`)}

  <div class="grid cols-2" style="margin-top:12px">
    ${card("ПО ВРЕМЕНИ ТИРАЖА",`<div class="table-wrap"><table><thead><tr><th>Время</th><th>Проверено</th><th>T3</th><th>L3</th></tr></thead><tbody>
      ${ts.map(([t,s])=>`<tr><td>${esc(t)}</td><td>${s.n}</td><td>${s.t3}</td><td>${s.l3}</td></tr>`).join("")||'<tr><td colspan="4">Нет данных</td></tr>'}
    </tbody></table></div>`)}

    ${card("ПО ЗАДЕРЖКЕ",`<div class="table-wrap"><table><thead><tr><th>Лаг, мин</th><th>T3</th><th>L3</th></tr></thead><tbody>
      ${ls.map(([lag,s])=>`<tr><td>${esc(lag)}</td><td>${s.t3}</td><td>${s.l3}</td></tr>`).join("")||'<tr><td colspan="3">Нет данных</td></tr>'}
    </tbody></table></div>`)}
  </div>

  <div class="grid cols-2" style="margin-top:12px">
    ${card("СМЕНА АЛГОРИТМА",`<div class="list-row"><span>Статус</span><b>${esc(shift.status||"—")}</b></div>
      <div class="list-row"><span>Доп прогноз</span><b>${esc(shift.combo||"—")}</b></div>
      <p class="muted">${esc(shift.reason||"")}</p>`)}
    ${card("ЗЕРКАЛО",`<div class="list-row"><span>Активные базы</span><b>${ctx.mirror?.bases?.length||0}</b></div>
      <div class="list-row"><span>Текущие строгие тройники</span><b>${ctx.mirrorPred?.length||0}</b></div>
      <p class="muted">Этот блок только оценивает уже рассчитанные сигналы и не создаёт основной прогноз.</p>`)}
  </div>`;
}
