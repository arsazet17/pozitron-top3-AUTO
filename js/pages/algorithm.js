import {card,esc} from "../ui.js";

function diagTable(shift){
  const d=shift?.diagnostics||{};
  const rows=["A","B","C"].filter(p=>d[p]).map(p=>{
    const x=d[p];
    return `<tr>
      <td><b>${p}</b></td>
      <td>${esc(x.recentRoute||x.route||"—")}</td>
      <td>${esc(x.recentScore??"—")}</td>
      <td>${esc(x.longRoute||"—")}</td>
      <td>${x.changed===true?"ДА":x.changed===false?"нет":"—"}</td>
      <td><b>${esc(x.digit||"—")}</b></td>
    </tr>`;
  }).join("");
  return rows?`<div class="table-wrap"><table><thead><tr><th>Позиция</th><th>Текущий лидер</th><th>Вес</th><th>Длинное окно</th><th>Смена</th><th>Цифра</th></tr></thead><tbody>${rows}</tbody></table></div>`:"<div class='muted'>Диагностика появится после накопления наблюдений.</div>";
}

export function renderAlgorithm(ctx){
  const s=ctx.shift||{}, obs=[...(ctx.state?.observations||[])].reverse();
  return `<div class="grid cols-2">
    ${card("НАБЛЮДЕНИЕ АЛГОРИТМА",`
      <p>Матрица A / B / C обновляется после каждого фактического тиража.</p>
      <div class="list-row"><span>Наблюдений</span><b>${obs.length}</b></div>
      <div class="list-row"><span>Режим</span><b>${ctx.rules?.algorithmShift?.enabled?"включён":"выключен"}</b></div>
      <div class="list-row"><span>Окно</span><b>${esc(ctx.rules?.algorithmShift?.recentWindow||"—")} / ${esc(ctx.rules?.algorithmShift?.rolling||"—")}</b></div>
      <span class="badge ${s.combo?"green":"orange"}">${s.combo?"СИГНАЛ АКТИВЕН":esc((s.status||"НЕТ СИГНАЛА").toUpperCase())}</span>
    `)}
    ${card("ДОП ПРОГНОЗ ПРИ СМЕНЕ АЛГОРИТМА",s.combo?
      `<div class="kpi">${esc(s.combo)}</div><p>${esc(s.reason)}</p>`:
      `<b class="warn">НЕТ СИГНАЛА</b><p class="muted">${esc(s.reason||"")}</p>`,"forecast-card shift")}
  </div>

  ${card("КАК МАТРИЦА ВЛИЯЕТ НА ДОП ПРОГНОЗ",`
    <p>Основные TOP / Δ / ЧИСЛА не меняются. Этот слой только выбирает для A / B / C лидирующие текущие маршруты по накопленным фактическим совпадениям.</p>
    ${diagTable(s)}
  `)}

  ${card("ПОСЛЕДНИЕ НАБЛЮДЕНИЯ A / B / C",`
    <div class="table-wrap"><table><thead><tr><th>Дата</th><th>Время</th><th>Факт</th><th>A</th><th>B</th><th>C</th></tr></thead><tbody>
      ${obs.slice(0,100).map(o=>`<tr>
        <td>${esc(o.date)}</td><td>${esc(o.time)}</td><td><b>${esc(o.fact)}</b></td>
        <td>${esc((o.criteria?.A||[]).join(" · ")||"—")}</td>
        <td>${esc((o.criteria?.B||[]).join(" · ")||"—")}</td>
        <td>${esc((o.criteria?.C||[]).join(" · ")||"—")}</td>
      </tr>`).join("")||'<tr><td colspan="6">Наблюдений пока нет. Они начнут записываться автоматически после установки обновления.</td></tr>'}
    </tbody></table></div>
  `)}`;
}
