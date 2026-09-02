import {card,esc} from "../ui.js";
export function renderMirror(ctx){
 const m=ctx.mirror||{bases:[],lastCheck:null},pred=ctx.mirrorPred||[],hits=[...(ctx.state?.mirrorHitLog||[])].reverse();
 return `${card("ЗЕРКАЛО + ПРИБАВЛЕНИЕ · 15 ТИРАЖЕЙ",`<b>Код:</b> TOP3-ЗЕРКАЛО-15-СТРОГО-21.08.2026<br><span class="muted">ОТДЕЛЬНЫЙ контур тройников. Не входит в MASTER, не получает score и не влияет на три основные комбинации.</span>`)}
 <div class="grid cols-2" style="margin-top:12px">
 ${card("АКТИВНЫЕ БАЗЫ",m.bases?.length?m.bases.map(b=>`<div class="list-row"><span><b>${esc(b.combo)}</b><br><small class="muted">${esc(b.activatedAt)}</small></span><span>${esc(b.worked)}/${esc(b.life)}</span></div>`).join(""):`<span class="muted">Нет активных баз</span>`)}
 ${card("СТРОГИЙ ПРОГНОЗ ТРОЙНИКОВ",pred.length?pred.map(x=>`<div class="list-row"><span>${esc(x.base)} → ${esc(x.permutation)}</span><b>${esc(x.triple)}</b></div>`).join(""):`<b>СТРОГОГО СИГНАЛА НА ТРОЙНИК НЕТ</b>`,"forecast-card mirror")}
 </div>
 ${card("ПОСЛЕДНЯЯ ПРОВЕРКА ЗЕРКАЛА",m.lastCheck?`Факт: <b>${esc(m.lastCheck.fact)}</b><br>Зеркало: <b>${esc(m.lastCheck.mirror)}</b><br>Перестановки: ${esc((m.lastCheck.mirrorPermutations||[]).join(" / "))}<br>Найдено в архиве: <b>${esc((m.lastCheck.found||[]).join(", ")||"нет")}</b>`:"—")}
 ${card("ОТДЕЛЬНЫЙ АРХИВ ПОПАДАНИЙ ЗЕРКАЛА",`<div class="table-wrap"><table><thead><tr><th>Дата/время</th><th>Факт</th><th>Тройник</th><th>База</th><th>Permutation</th></tr></thead><tbody>${hits.slice(0,300).map(h=>`<tr><td>${esc(h.date)} ${esc(h.time)}</td><td><b>${esc(h.fact)}</b></td><td><b>${esc(h.triple)}</b></td><td>${esc(h.base)}</td><td>${esc(h.permutation)}</td></tr>`).join("")||'<tr><td colspan="5">Попаданий зеркала пока нет.</td></tr>'}</tbody></table></div>`)}`;
}
