import {card,bindCollapsibles,esc,combo} from "../ui.js";
function rowsMain(main){return (main?.ranked||[]).slice(0,15).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.family)}</b></td><td>${x.seq}</td><td>${x.td}</td><td><b>${x.total}</b></td><td>${esc(x.order)}</td><td>${esc(x.count)}</td><td>${esc(x.last||"—")}</td></tr>`).join("")}
function rowsAlg(alg){return (alg?.ranked||[]).slice(0,15).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.family)}</b></td><td>${esc(x.source)}</td><td>${esc(x.delta)}</td><td><b>${esc(x.repeat)}</b></td><td>${esc(x.order)}</td><td>${esc(x.last||"—")}</td></tr>`).join("")}
function rowsMaster(master){return (master?.ranked||[]).slice(0,20).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.family)}</b></td><td>${esc(x.order)}</td><td><b>${esc(x.score)}</b></td><td>${esc(x.groupCount)}</td><td>${esc((x.groups||[]).join(" + "))}</td><td>${esc(x.evidence)}</td></tr>`).join("")}
function appRows(app){return (app?.candidates||[]).map(x=>`<tr><td>${esc(x.block)}</td><td>${esc(x.combo)}</td><td>${x.consensus?"V1=V2":"V1"}</td><td>${esc(x.recent)}</td><td>${esc(x.long)}</td><td>${esc(x.signalSupport)}</td></tr>`).join("")}
export function renderForecasts(ctx){
 const issue=ctx.issue,m=issue.methods||{},main=m.main||{},alg=m.algorithm||{},sig=main.signals||{};
 return `<div class="card"><div class="card-head">CHAT MASTER · ${issue.target.date} · ${issue.target.time}</div><div class="card-body"><span class="muted">Последний факт:</span> <b>${esc(issue.lastFact)}</b><br><span class="muted">LAST Δ:</span> <b>${esc(sig.seq?.signal||"—")}</b> · ${esc(sig.seq?.old||"—")}→${esc(sig.seq?.new||"—")}<br><span class="muted">TIME-DIRECTION:</span> <b>${esc(sig.td?.signal||"—")}</b> · ${esc(sig.td?.old||"—")}→${esc(sig.td?.new||"—")}</div></div>
 <div class="section-title">ИТОГ · ТОЛЬКО 3</div>
 <div class="grid cols-3">${(issue.master?.top3||[]).map((x,i)=>card(`${["🥇","🥈","🥉"][i]} ${esc(x.family)}`,`${combo(x.order)}<p class="muted">score ${x.score} · ${(x.groups||[]).map(esc).join(" + ")}</p>`,"forecast-card top")).join("")}</div>
 <div class="section-title">MASTER · ПОЛНЫЙ РЕЕСТР</div>
 ${card("РАНЖИРОВАНИЕ FAMILY",`<div class="table-wrap"><table><thead><tr><th>#</th><th>Family</th><th>Order</th><th>Score</th><th>Групп</th><th>Источники</th><th>Evidence</th></tr></thead><tbody>${rowsMaster(issue.master)}</tbody></table></div>`)}
 <div class="section-title">MAIN SIGNAL-POOL · LAST Δ + TIME-DIRECTION</div>
 ${card("RAW FAMILY RANK",`<div class="table-wrap"><table><thead><tr><th>#</th><th>Family</th><th>SEQ</th><th>TD</th><th>Total</th><th>Order</th><th>Order N</th><th>Свежесть</th></tr></thead><tbody>${rowsMain(main)}</tbody></table></div><p class="muted">SEQ RAW: ${main.raw?.seq?.total||0} · TD RAW: ${main.raw?.td?.total||0} · Exact 2/2: ${(main.exact?.commonFamilies||[]).join(", ")||"нет"}</p>`)}
 <div class="section-title">АЛГОРИТМ · PERM→FAMILY REPEAT</div>
 ${card("REPEAT ≥ 2",`<div class="table-wrap"><table><thead><tr><th>#</th><th>Family</th><th>Источник</th><th>Перестановка Δ</th><th>Repeat</th><th>Order</th><th>Свежесть</th></tr></thead><tbody>${rowsAlg(alg)||'<tr><td colspan="7">Нет repeat≥2</td></tr>'}</tbody></table></div>`)}
 <div class="grid cols-2" style="margin-top:12px">
 ${card("APP CORE · СКРЫТЫЙ ИСТОЧНИК",`<div class="list-row"><span>Выбран</span><b>${esc(m.appCore?.selected?.combo||"—")}</b></div><div class="list-row"><span>Режим</span><b>${esc(m.appCore?.mode||"—")}</b></div><div class="table-wrap"><table><thead><tr><th>Блок</th><th>Combo</th><th>Тип</th><th>Recent</th><th>Long</th><th>SIGNAL</th></tr></thead><tbody>${appRows(m.appCore)}</tbody></table></div>`)}
 ${card("MATRIX SHIFT · СКРЫТЫЙ ИСТОЧНИК",`<div class="kpi">${esc(m.shift?.combo||"—")}</div><div class="list-row"><span>Статус</span><b>${esc(m.shift?.status||"—")}</b></div><p class="muted">${esc(m.shift?.reason||"")}</p>`)}
 </div>
 ${card("ЖЁСТКИЕ ПРАВИЛА",`<p><b>Порядок при проверке не важен.</b> MAIN: RAW total → family recency; order frequency → recency. Algorithm: конкретная перестановка Δ → family repeat≥2. MASTER: независимые группы, rank points 3/2/1, без двойного счёта. Любой факт проверяет уже frozen-прогноз; backfit запрещён.</p>`)}`;
}
export function mountedForecasts(){bindCollapsibles()}
