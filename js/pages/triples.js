import {card,esc} from "../ui.js";
import {computeTripleChat,TRIPLE_CHAT_RULE_CODE} from "../engine/triples-chat.js";

function isRepeated(c){return /^([0-9])\1\1$/.test(String(c||""))}
function fmtList(a){return a&&a.length?a.join(" / "):"—"}
function stageLabel(x){return `${x.triple} · ${x.stage}/2 ${x.stage===1?"NEW":"LAST"}`}
function tripleStats(ctx){
 const full=ctx.fullArchive,combos=full?.combos||[];const stats=Array.from({length:10},(_,d)=>({triple:`${d}${d}${d}`,count:0,lastDraw:null,gap:null}));
 for(let i=0;i<combos.length;i++){const c=combos[i];if(isRepeated(c)){const d=Number(c[0]),x=stats[d];x.count++;x.lastDraw=Number(full.fromDraw)+i}}
 for(const x of stats)if(x.lastDraw!=null)x.gap=Number(full.toDraw)-x.lastDraw;
 return stats;
}
function lastTripleFacts(ctx,limit=40){
 const full=ctx.fullArchive,combos=full?.combos||[],out=[];if(!full)return out;
 for(let i=combos.length-1;i>=0&&out.length<limit;i--){const c=combos[i];if(isRepeated(c))out.push({draw:Number(full.fromDraw)+i,combo:c,gap:Number(full.toDraw)-(Number(full.fromDraw)+i)})}
 return out;
}
function frequencyHtml(freq,leaders){
 const lead=new Set(leaders||[]);
 return `<div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Новых рождений</th><th>Статус</th></tr></thead><tbody>${freq.map(x=>`<tr><td><b>${esc(x.triple)}</b></td><td>${esc(x.count)}</td><td>${lead.has(x.triple)?"🏆 ЛИДЕР":"—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function archiveHtml(snapshot){
 const births=new Map((snapshot.birthsWindow||[]).map(x=>[Number(x.id),x.births||[]]));
 return `<div class="table-wrap"><table><thead><tr><th>№</th><th>Дата / время</th><th>Факт</th><th>Frozen ДО</th><th>Проверка</th><th>Frozen после</th><th>Новые рождения</th></tr></thead><tbody>${(snapshot.archive||[]).map(r=>`<tr><td>№${esc(r.id)}</td><td>${esc(r.date)}<br><b>${esc(r.time)}</b></td><td><b>${esc(r.fact)}</b></td><td>${esc(r.before)}</td><td>${r.check.includes("✅")?"✅ ":r.check.includes("❌")?"❌ ":""}${esc(r.check.replace(/^✅\s*|^❌\s*/,""))}</td><td><b>${esc(r.after)}</b></td><td>${esc(fmtList(births.get(Number(r.id))||[]))}</td></tr>`).join("")}</tbody></table></div>`;
}

export function renderTriples(ctx){
 const calc=computeTripleChat(ctx.records,ctx.fullArchive),s=calc.snapshot;
 if(!s)return card("🔮 ТРОЙНИ · M1 / M2 / M3","<p>Недостаточно фактических данных для расчёта.</p>");
 const stats=tripleStats(ctx),facts=lastTripleFacts(ctx),L=s.leader;
 const leader=L.leaders.length?`${L.leaders.join(" / ")} ×${L.max}`:"—";
 const m1=fmtList(s.m1);
 const m2=s.m2.length?s.m2.map(stageLabel).join(" · "):"—";
 const m3=s.m3.length?s.m3.map(x=>`${stageLabel(x)} · ${x.sourceCode}+${x.bornCode||""}`).join(" · "):"—";
 const windows=s.windows.length?s.windows.map(w=>`${w.triple}: ждём family ${w.waitFamily||w.waitSig} · rem${w.rem}`).join(" · "):"Открытых окон нет";
 const pkg=s.diag.packages?.length?s.diag.packages.join(" · "):"не сформирован";
 const deps=s.diag.dependency?.length?s.diag.dependency.join(" · "):"нет новых зависимых подтверждений";
 const blocks=s.diag.blocks?.length?s.diag.blocks.join(" · "):"нет";
 const m2events=s.diag.m2Events?.length?s.diag.m2Events.join(" · "):"нет новых событий";
 return `<div class="grid cols-3">
 ${card("🔮 ИТОГОВЫЙ FROZEN · 3 МЕТОДА",`<div class="kpi" style="font-size:24px">${esc(fmtList(s.frozen))}</div><div class="muted">на ${esc(ctx.target?.date||"—")} · ${esc(ctx.target?.time||"—")}</div>`)}
 ${card("🏆 ЛИДЕР ПОЯВЛЕНИЯ · 20",`<div class="kpi" style="font-size:24px">${esc(leader)}</div><div class="muted">только новые рождения, без carry / продления / дублей</div>`)}
 ${card("📚 ПОЛНЫЙ АРХИВ",`<div class="kpi">${esc(ctx.fullArchive?.total||ctx.records.length)}</div><div class="muted">№${esc(ctx.fullArchive?.fromDraw||"—")}…№${esc(ctx.fullArchive?.toDraw||"—")}</div>`)}
 </div>
 <div class="grid cols-3" style="margin-top:12px">
 ${card("M1 · МЕТОД 1",`<div class="kpi" style="font-size:24px">${esc(m1)}</div><div class="muted">1 следующий тираж · база живёт 15 фактов после exact mirror/history gate</div>`)}
 ${card("M2 · МЕТОД 2",`<div class="kpi" style="font-size:22px">${esc(m2)}</div><div class="muted">схлопывание family-окна → 1/2 NEW → 2/2 LAST</div><p class="muted" style="margin-top:8px">${esc(windows)}</p>`)}
 ${card("M3 · МЕТОД 3",`<div class="kpi" style="font-size:22px">${esc(m3)}</div><div class="muted">15 предыдущих · все перестановки · 1/2 NEW → 2/2 LAST</div>`)}
 </div>
 ${card("📜 АРХИВ ПРОГНОЗОВ ЗА ПОСЛЕДНИЕ 20 ТИРАЖЕЙ",`${archiveHtml(s)}<p class="muted">Факт → Frozen ДО → проверка → Frozen после. Старые frozen не переписываются.</p>`)}
 ${card("📊 ЛИДЕР ПО ЧАСТОТЕ · БЕЗ ДУБЛЯЖЕЙ · ПОСЛЕДНИЕ 20",`${frequencyHtml(s.frequency,L.leaders)}<p class="muted">Считаются только новые рождения. Продление 1/2 → 2/2 второй раз не считается; M1+M3 из одного source = одно рождение; открытое окно M2 не считается; package→000 = одно рождение 000. Та же тройня может считаться снова только как новое рождение после закрытия старого сигнала.</p>`)}
 ${card("🧩 ПАКЕТ ПОДРЯД → 000",`<p><b>${esc(pkg)}</b></p><p class="muted">Если подряд идущие исходные комбинации дают разные XXX-тройки, отдельные XXX заменяются итоговым 000 с фиксацией участвовавших исходников.</p>`)}
 ${card("🔎 КОНТРОЛЬ ПРАВИЛ",`<div class="table-wrap"><table><tbody><tr><th>Exact BLOCK</th><td>${esc(blocks)}</td></tr><tr><th>M2 события</th><td>${esc(m2events)}</td></tr><tr><th>Зависимость M1/M3</th><td>${esc(deps)}</td></tr><tr><th>Mirror gate</th><td>${esc(s.diag.mirror||"—")} · ${s.diag.mirrorPass?"PASS":"не подтверждён"}${Number.isFinite(s.diag.mirrorHits)?` · exact ${esc(s.diag.mirrorHits)}`:""}</td></tr><tr><th>Версия правил</th><td>${esc(TRIPLE_CHAT_RULE_CODE)}</td></tr></tbody></table></div>`)}
 ${card("000–999 · ФАКТИЧЕСКАЯ СТАТИСТИКА ПОЛНОГО АРХИВА",`<div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Сколько раз</th><th>Последний тираж</th><th>Тиражей назад</th></tr></thead><tbody>${stats.map(x=>`<tr><td><b>${x.triple}</b></td><td>${x.count}</td><td>${x.lastDraw==null?"—":"№"+x.lastDraw}</td><td>${x.gap==null?"—":x.gap}</td></tr>`).join("")}</tbody></table></div>`)}
 ${card("ПОСЛЕДНИЕ ФАКТИЧЕСКИЕ ТРОЙНИ",`<div class="table-wrap"><table><thead><tr><th>Тираж</th><th>Тройня</th><th>Тиражей назад</th></tr></thead><tbody>${facts.map(x=>`<tr><td>№${x.draw}</td><td><b>${x.combo}</b></td><td>${x.gap}</td></tr>`).join("")||'<tr><td colspan="3">Данных пока нет.</td></tr>'}</tbody></table></div>`)}
 ${card("ПРАВИЛО",`<p><b>Раздел «Тройни» считается отдельно от CHAT MASTER.</b> M1 / M2 / M3 и их итоговый Frozen не получают MASTER score и не меняют основной прогноз TOP-3.</p>`)}`;
}
