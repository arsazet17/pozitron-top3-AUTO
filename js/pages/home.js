import {card,combo,bindCollapsibles,esc} from "../ui.js";
function masterCards(issue){return (issue.master?.top3||[]).map((x,i)=>card(`${["🥇","🥈","🥉"][i]||""} MASTER ${i+1}`,`${combo(x.order)}<div class="muted" style="margin-top:8px">family ${esc(x.family)} · score ${esc(x.score)} · ${esc((x.groups||[]).join(" + "))}</div>`,"forecast-card top")).join("")}
function methodLine(title,arr){return `<div class="list-row"><span>${title}</span><b>${(arr||[]).map(x=>esc(x.order||x.combo||x.family)).join(" / ")||"—"}</b></div>`}
export function renderHome(ctx){
 const issue=ctx.issue,last=ctx.records.at(-1),m=issue.methods||{},sig=m.main?.signals||{};
 return `<div class="grid cols-3">
 ${card("ПОСЛЕДНИЙ ТИРАЖ",`<div class="muted">${last.date} · ${last.time}</div><div style="margin-top:10px">${combo(last.combo)}</div><div class="ok-text" style="margin-top:9px">Сохранён в базе</div>`)}
 ${card("СЛЕДУЮЩИЙ ТИРАЖ",`<div class="kpi">${issue.target.time}</div><div class="muted">${issue.target.date}</div>`)}
 ${card("СТАТУС СИСТЕМЫ",`<div class="list"><div class="list-row"><span>Ядро</span><b>CHAT MASTER</b></div><div class="list-row"><span>Версия</span><b>${ctx.version.version}</b></div><div class="list-row"><span>Фактов</span><b>${ctx.records.length}</b></div><div class="list-row"><span>Аудитов MASTER</span><b>${ctx.state?.masterAudit?.length||0}</b></div><div class="list-row"><span>Баз зеркала</span><b>${ctx.mirror?.bases?.length||0}</b></div></div>`)}
 </div>
 <div class="section-title">ИТОГОВЫЙ ПРОГНОЗ · РОВНО 3 КОМБИНАЦИИ</div>
 <div class="grid cols-3">${masterCards(issue)}</div>
 <div class="grid cols-2" style="margin-top:12px">
 ${card("ИСТОЧНИКИ MASTER",`${methodLine("MAIN TIME-DIRECTION",m.main?.top3)}${methodLine("PERM→FAMILY",m.algorithm?.top3)}<div class="list-row"><span>APP CORE</span><b>${esc(m.appCore?.selected?.combo||"—")}</b></div><div class="list-row"><span>MATRIX SHIFT</span><b>${esc(m.shift?.combo||m.shift?.status||"—")}</b></div>`)}
 ${card("АКТИВНЫЕ СИГНАЛЫ",`<div class="list-row"><span>LAST Δ</span><b>${esc(sig.seq?.signal||"—")}</b></div><div class="muted">${esc(sig.seq?.old||"—")} → ${esc(sig.seq?.new||"—")}</div><div class="list-row"><span>TIME-DIRECTION Δ</span><b>${esc(sig.td?.signal||"—")}</b></div><div class="muted">${esc(sig.td?.oldAt||"—")} ${esc(sig.td?.old||"")} → ${esc(sig.td?.newAt||"—")} ${esc(sig.td?.new||"")}</div>`)}
 </div>
 <div style="margin-top:12px">${card("↔ ЗЕРКАЛО · ОТДЕЛЬНО ОТ MASTER",(ctx.mirrorPred||[]).length?(ctx.mirrorPred||[]).map(x=>`<div class="list-row"><span>${esc(x.base)} → ${esc(x.permutation)}</span><b>${esc(x.triple)}</b></div>`).join(""):`<b class="muted">СТРОГОГО СИГНАЛА НА ТРОЙНИК НЕТ</b>`,"forecast-card mirror")}<div class="muted" style="margin-top:7px">Зеркало следит только за тройниками. Оно не голосует в MASTER и не меняет три основные комбинации.</div></div>`;
}
export function mountedHome(){bindCollapsibles()}
