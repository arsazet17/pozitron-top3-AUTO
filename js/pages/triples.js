import {card,esc} from "../ui.js";
function isRepeated(c){return /^([0-9])\1\1$/.test(String(c||""))}
export function renderTriples(ctx){
 const pred=ctx.mirrorPred||[],audit=[...(ctx.state?.mirrorAudit||[])].reverse(),hits=[...(ctx.state?.mirrorHitLog||[])].reverse();
 return `<div class="grid cols-3">
 ${card("СТРОГИЕ ТРОЙНИКИ СЕЙЧАС",`<div class="kpi">${pred.length}</div><div class="muted">только Зеркало +15</div>`)}
 ${card("АКТИВНЫЕ БАЗЫ",`<div class="kpi">${ctx.mirror?.bases?.length||0}</div>`)}
 ${card("ПОПАДАНИЯ ЗЕРКАЛА",`<div class="kpi">${hits.length}</div><div class="muted">отдельно от MASTER</div>`)}
 </div>
 ${card("ТЕКУЩИЕ СТРОГИЕ ТРОЙНИКИ",`<div class="table-wrap"><table><thead><tr><th>База</th><th>Permutation</th><th>Тройник</th><th>Тип</th></tr></thead><tbody>${pred.map(x=>`<tr><td>${esc(x.base)}</td><td>${esc(x.permutation)}</td><td><b>${esc(x.triple)}</b></td><td>${isRepeated(x.triple)?"000…999":"—"}</td></tr>`).join("")||'<tr><td colspan="4">Строгого сигнала на тройник нет.</td></tr>'}</tbody></table></div>`)}
 ${card("АРХИВ ПРОВЕРОК ТРОЙНИКОВ",`<div class="table-wrap"><table><thead><tr><th>Дата/время</th><th>Факт</th><th>Было сигналов</th><th>Hit</th><th>Прогнозы</th></tr></thead><tbody>${audit.slice(0,500).map(a=>`<tr><td>${esc(a.date)} ${esc(a.time)}</td><td><b>${esc(a.fact)}</b></td><td>${esc(a.predictions?.length||0)}</td><td>${a.hit?"✅":"❌"}</td><td>${esc((a.predictions||[]).map(x=>x.triple).join(" / ")||"—")}</td></tr>`).join("")||'<tr><td colspan="5">Проверок новой отдельной ветки зеркала ещё нет.</td></tr>'}</tbody></table></div>`)}
 ${card("ПРАВИЛО",`<p><b>Зеркало не относится к основному прогнозу.</b> Оно не имеет MASTER score, не входит в MAIN / PERM→FAMILY / APP CORE / SHIFT и не участвует в классификации ошибок основного TOP-3. Здесь ведётся только отдельное слежение за строгими тройниками.</p>`)}`;
}
