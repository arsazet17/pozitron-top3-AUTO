import {card} from "../ui.js";
export function renderStats(ctx){
 const rec=ctx.records, freq={};for(const r of rec.slice(-100)){for(const d of r.combo)freq[d]=(freq[d]||0)+1}
 return `<div class="grid cols-3">${card("БАЗА",`<div class="kpi">${rec.length}</div><div class="muted">фактических тиражей</div>`)}${card("АКТИВНЫЕ БАЗЫ ЗЕРКАЛА",`<div class="kpi">${ctx.mirror.bases.length}</div>`)}${card("ТЕКУЩИЙ СИГНАЛ ЗЕРКАЛА",`<div class="kpi">${ctx.mirrorPred.length}</div><div class="muted">тройников</div>`)}</div>
 ${card("ЧАСТОТЫ ПОСЛЕДНИХ 100 ФАКТОВ · ТОЛЬКО СПРАВКА",`<div class="table-wrap"><table><thead><tr><th>Цифра</th><th>Количество</th></tr></thead><tbody>${Object.entries(freq).sort((a,b)=>a[0]-b[0]).map(([d,n])=>`<tr><td>${d}</td><td>${n}</td></tr>`).join("")}</tbody></table></div><p class="muted">Частоты не имеют права создавать зеркальный прогноз; они могут только характеризовать уже рассчитанный строгий тройник.</p>`)}`;
}
