import {card} from "../ui.js";
export function renderMirror(ctx){
 const m=ctx.mirror, pred=ctx.mirrorPred;
 return `${card("ЗЕРКАЛО + ПРИБАВЛЕНИЕ · 15 ТИРАЖЕЙ",`<b>Код:</b> TOP3-ЗЕРКАЛО-15-СТРОГО-21.08.2026<br><span class="muted">Сначала считаются уже активные базы; новый факт становится базой только после подтверждения зеркала и начинает работу со следующего факта.</span>`)}
 <div class="grid cols-2" style="margin-top:12px">${card("АКТИВНЫЕ БАЗЫ",m.bases.length?m.bases.map(b=>`<div class="list-row"><span><b>${b.combo}</b><br><small class="muted">${b.activatedAt}</small></span><span>${b.worked}/${b.life}</span></div>`).join(""):`<span class="muted">Нет активных баз</span>`)}${card("СТРОГИЙ ПРОГНОЗ",pred.length?pred.map(x=>`<div class="list-row"><span>${x.base} → ${x.permutation}</span><b>${x.triple}</b></div>`).join(""):`<b>СТРОГОГО СИГНАЛА НА ТРОЙНИК НЕТ</b>`,"forecast-card mirror")}</div>
 ${card("ПОСЛЕДНЯЯ ПРОВЕРКА ЗЕРКАЛА",m.lastCheck?`Факт: <b>${m.lastCheck.fact}</b><br>Зеркало: <b>${m.lastCheck.mirror}</b><br>Перестановки: ${m.lastCheck.mirrorPermutations.join(" / ")}<br>Найдено в архиве: <b>${m.lastCheck.found.join(", ")||"нет"}</b>`:"—")}`;
}
