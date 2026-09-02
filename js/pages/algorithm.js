import {card,esc} from "../ui.js";
function supportText(s){return Object.entries(s||{}).map(([d,x])=>`${d}: SEQ ${x.seq}/${x.seqTotal} · TD ${x.td}/${x.tdTotal}`).join("<br>")||"—"}
function auditRows(audits){return audits.slice(-100).reverse().map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.time)}</td><td><b>${esc(a.fact)}</b></td><td>${esc(a.family)}</td><td>${a.master?.hit?"✅":"❌"}</td><td>${esc(a.classification)}</td><td>${a.assemblyBlind?"ДА":"нет"}</td><td>${esc(a.main?.seq??0)} / ${esc(a.main?.td??0)}</td><td>${supportText(a.digitSupport)}</td></tr>`).join("")}
function relationRows(alg){return (alg?.relations||[]).slice(0,100).map(x=>`<tr><td>${esc(x.source)}</td><td>${esc(x.delta)}</td><td><b>${esc(x.family)}</b></td><td><b>${esc(x.repeat)}</b></td><td>${esc(x.order)}</td><td>${esc(x.last||"—")}</td></tr>`).join("")}
function shiftRows(shift){return ["A","B","C"].filter(p=>shift?.diagnostics?.[p]).map(p=>{const x=shift.diagnostics[p];return `<tr><td>${p}</td><td>${esc(x.recentRoute||"—")}</td><td>${esc(x.recentScore??"—")}</td><td>${esc(x.longRoute||"—")}</td><td>${x.changed?"ДА":"нет"}</td><td><b>${esc(x.digit||"—")}</b></td></tr>`}).join("")}
export function renderAlgorithm(ctx){
 const issue=ctx.issue,m=issue.methods||{},audits=ctx.state?.masterAudit||[];
 return `<div class="grid cols-3">
 ${card("MASTER НАБЛЮДЕНИЯ",`<div class="kpi">${audits.length}</div><div class="muted">проверенных фактов новой системы</div>`)}
 ${card("PERM→FAMILY RELATIONS",`<div class="kpi">${m.algorithm?.relations?.length||0}</div><div class="muted">активных repeat≥2 под текущими сигналами</div>`)}
 ${card("ТЕКУЩИЙ MASTER",`<div class="kpi">${esc((issue.master?.combos||[]).join(" / "))}</div><div class="muted">ровно 3 frozen</div>`)}
 </div>
 <div class="section-title">СЛЕЖЕНИЕ · ОТКУДА ВЫШЕЛ ФАКТ</div>
 ${card("РАБОТА НАД ОШИБКАМИ",`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Время</th><th>Факт</th><th>Family</th><th>MASTER</th><th>Классификация</th><th>Assembly blind</th><th>RAW SEQ/TD</th><th>Цифры</th></tr></thead><tbody>${auditRows(audits)||'<tr><td colspan="9">Новый MASTER ещё не проверен фактом.</td></tr>'}</tbody></table></div>`)}
 <div class="section-title">АЛГОРИТМ · PERM→FAMILY</div>
 ${card("ТЕКУЩИЕ ВОСПРОИЗВОДИМЫЕ СВЯЗИ",`<div class="table-wrap"><table><thead><tr><th>Источник</th><th>Permutation Δ</th><th>Family</th><th>Repeat</th><th>Order</th><th>Последнее подтверждение</th></tr></thead><tbody>${relationRows(m.algorithm)||'<tr><td colspan="6">Нет repeat≥2.</td></tr>'}</tbody></table></div>`)}
 <div class="section-title">СКРЫТОЕ СЛЕЖЕНИЕ APP ROUTE-STATE</div>
 ${card("MATRIX SHIFT",`<div class="list-row"><span>Статус</span><b>${esc(m.shift?.status||"—")}</b></div><div class="list-row"><span>Комбинация</span><b>${esc(m.shift?.combo||"—")}</b></div><div class="table-wrap"><table><thead><tr><th>Позиция</th><th>Recent route</th><th>Вес</th><th>Long route</th><th>Смена</th><th>Цифра</th></tr></thead><tbody>${shiftRows(m.shift)||'<tr><td colspan="6">Нет активной диагностики.</td></tr>'}</tbody></table></div><p class="muted">Этот слой больше не является отдельным экранным методом старого приложения: он только независимый источник MASTER и продолжает учиться на фактах.</p>`)}
 ${card("ПРАВИЛО ОБУЧЕНИЯ",`<p>После каждого факта автоматически фиксируются RAW family SEQ/TD, поддержка каждой цифры, structural/single-source/2-source miss, assembly blind, PERM→FAMILY repeat, APP route-state и результат каждой независимой группы. Старый frozen не переписывается.</p>`)}`;
}
