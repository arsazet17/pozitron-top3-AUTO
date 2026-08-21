import {card,esc} from "../ui.js";

function currentCombos(ctx){
  const out=[], f=ctx.current;
  for(const block of ["TOP","DELTA","NUMBERS"]){
    for(let i=0;i<4;i++){
      const c=f?.[block]?.[i];
      if(/^\d{3}$/.test(String(c||"")))out.push({source:`${block} ${["В1","В2","В3","Г→Г"][i]}`,combo:String(c)});
    }
  }
  for(const [k,v] of Object.entries(ctx.extras||{}))if(/^\d{3}$/.test(String(v||"")))out.push({source:`ДОП ${k}`,combo:String(v)});
  if(/^\d{3}$/.test(String(ctx.shift?.combo||"")))out.push({source:"СМЕНА АЛГОРИТМА",combo:String(ctx.shift.combo)});
  for(const x of ctx.mirrorPred||[])if(/^\d{3}$/.test(String(x.triple||"")))out.push({source:`ЗЕРКАЛО ${x.base||""}`.trim(),combo:String(x.triple)});
  return out;
}
function isRepeatedTriple(c){return c[0]===c[1]&&c[1]===c[2]}

export function renderTriples(ctx){
  const now=currentCombos(ctx);
  const repeated=now.filter(x=>isRepeatedTriple(x.combo));
  const hitRows=[...(ctx.state?.hitLog||[])].reverse().flatMap(h=>(h.hits||[]).map(x=>({...x,fact:h.fact,date:h.date,time:h.time})));
  const t3=hitRows.filter(x=>x.type==="T3"), l3=hitRows.filter(x=>x.type==="L3");
  return `<div class="grid cols-3">
    ${card("АКТИВНЫЕ КОМБИНАЦИИ",`<div class="kpi">${now.length}</div><div class="muted">в текущем полном прогнозе</div>`)}
    ${card("ОДИНАКОВЫЕ ТРОЙНИКИ",`<div class="kpi">${repeated.length}</div><div class="muted">000 / 111 / … / 999</div>`)}
    ${card("T3 / L3 В АРХИВЕ",`<div class="kpi">${t3.length} / ${l3.length}</div>`)}
  </div>

  <div class="grid cols-2" style="margin-top:12px">
    ${card("ТРОЙНИКИ ТЕКУЩЕГО ПРОГНОЗА",`
      <div class="table-wrap"><table><thead><tr><th>Источник</th><th>Комбинация</th><th>Тип</th></tr></thead><tbody>
        ${now.map(x=>`<tr><td>${esc(x.source)}</td><td><b>${esc(x.combo)}</b></td><td>${isRepeatedTriple(x.combo)?"ОДИНАКОВЫЙ ТРОЙНИК":"3 цифры"}</td></tr>`).join("")||'<tr><td colspan="3">Нет активных комбинаций</td></tr>'}
      </tbody></table></div>
    `)}
    ${card("СТРОГИЕ ТРОЙНИКИ ЗЕРКАЛА",ctx.mirrorPred?.length?
      ctx.mirrorPred.map(x=>`<div class="list-row"><span>${esc(x.base)} + ${esc(x.permutation)}</span><b>${esc(x.triple)}</b></div>`).join(""):
      `<b class="muted">СТРОГОГО СИГНАЛА НА ТРОЙНИК НЕТ</b>`)}
  </div>

  ${card("АРХИВ T3 / L3",`
    <div class="table-wrap"><table><thead><tr><th>Дата/время выхода</th><th>Факт</th><th>Тип</th><th>Прогноз</th><th>Источник</th><th>Лаг</th></tr></thead><tbody>
      ${hitRows.slice(0,500).map(x=>`<tr><td>${esc(x.date)} ${esc(x.time)}</td><td><b>${esc(x.fact)}</b></td><td><b>${esc(x.type)}</b></td><td>${esc(x.combo)}</td><td>${esc(x.block)} ${esc(x.variant)}</td><td>${esc(x.lag)} мин</td></tr>`).join("")||'<tr><td colspan="6">Попаданий в новом постоянном архиве пока нет.</td></tr>'}
    </tbody></table></div>
  `)}`;
}
