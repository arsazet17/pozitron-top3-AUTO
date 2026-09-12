import {card,esc} from "../ui.js";
function isRepeated(c){return /^([0-9])\1\1$/.test(String(c||""))}
function tripleStats(ctx){
 const full=ctx.fullArchive,combos=full?.combos||[];const stats=Array.from({length:10},(_,d)=>({triple:`${d}${d}${d}`,count:0,lastDraw:null,gap:null}));
 for(let i=0;i<combos.length;i++){const c=combos[i];if(isRepeated(c)){const d=Number(c[0]),x=stats[d];x.count++;x.lastDraw=Number(full.fromDraw)+i}}
 for(const x of stats)if(x.lastDraw!=null)x.gap=Number(full.toDraw)-x.lastDraw;
 return stats;
}
function lastTripleFacts(ctx,limit=80){
 const full=ctx.fullArchive,combos=full?.combos||[],out=[];if(!full)return out;
 for(let i=combos.length-1;i>=0&&out.length<limit;i--){const c=combos[i];if(isRepeated(c))out.push({draw:Number(full.fromDraw)+i,combo:c,gap:Number(full.toDraw)-(Number(full.fromDraw)+i)})}
 return out;
}
function recentBirths(ctx){
 const audit=[...(ctx.state?.mirrorAudit||[])].slice(-20),counts=new Map(),rows=[];let prev=new Set();
 for(const a of audit){const current=new Set((a.predictions||[]).map(x=>String(x.triple||x)).filter(isRepeated)),births=[...current].filter(x=>!prev.has(x));for(const t of births)counts.set(t,(counts.get(t)||0)+1);rows.push({...a,births});prev=current}
 const max=Math.max(0,...counts.values()),leaders=[...counts].filter(([,n])=>n===max&&max>0).map(([t,n])=>`${t} ×${n}`);
 return {rows,counts,max,leaders};
}
export function renderTriples(ctx){
 const pred=ctx.mirrorPred||[],audit=[...(ctx.state?.mirrorAudit||[])].reverse(),hits=[...(ctx.state?.mirrorHitLog||[])].reverse(),stats=tripleStats(ctx),recent=recentBirths(ctx),facts=lastTripleFacts(ctx);
 const leader=recent.leaders.length?recent.leaders.join(" / "):"пока нет";
 return `<div class="grid cols-3">
 ${card("СТРОГИЕ ТРОЙНИКИ СЕЙЧАС",`<div class="kpi">${pred.length}</div><div class="muted">только Зеркало +15</div>`)}
 ${card("ПОЛНЫЙ АРХИВ",`<div class="kpi">${ctx.fullArchive?.total||ctx.records.length}</div><div class="muted">тиражи №${esc(ctx.fullArchive?.fromDraw||"—")}…${esc(ctx.fullArchive?.toDraw||"—")}</div>`)}
 ${card("ЛИДЕР · ПОСЛЕДНИЕ 20",`<div class="kpi" style="font-size:24px">${esc(leader)}</div><div class="muted">только новые рождения сигналов, без продления дубля</div>`)}
 </div>
 <div class="grid cols-2" style="margin-top:12px">
 ${card("АКТИВНЫЕ БАЗЫ",`<div class="kpi">${ctx.mirror?.bases?.length||0}</div><div class="muted">поиск совпадений идёт по полному архиву</div>`)}
 ${card("ПОПАДАНИЯ ЗЕРКАЛА",`<div class="kpi">${hits.length}</div><div class="muted">отдельно от MASTER</div>`)}
 </div>
 ${card("ТЕКУЩИЕ СТРОГИЕ ТРОЙНИКИ",`<div class="table-wrap"><table><thead><tr><th>База</th><th>Permutation</th><th>Тройник</th><th>Тип</th></tr></thead><tbody>${pred.map(x=>`<tr><td>${esc(x.base)}</td><td>${esc(x.permutation)}</td><td><b>${esc(x.triple)}</b></td><td>${isRepeated(x.triple)?"000…999":"—"}</td></tr>`).join("")||'<tr><td colspan="4">Строгого сигнала на тройник нет.</td></tr>'}</tbody></table></div>`)}
 ${card("ЛИДЕР ПОЯВЛЕНИЯ ТРОЙНИ ЗА ПОСЛЕДНИЕ 20 ТИРАЖЕЙ · БЕЗ ДУБЛЯЖЕЙ",`<div class="table-wrap"><table><thead><tr><th>Дата/время</th><th>Факт</th><th>Frozen ДО</th><th>Новые рождения</th><th>Проверка</th></tr></thead><tbody>${recent.rows.slice().reverse().map(a=>`<tr><td>${esc(a.date)} ${esc(a.time)}</td><td><b>${esc(a.fact)}</b></td><td>${esc((a.predictions||[]).map(x=>x.triple).join(" / ")||"—")}</td><td><b>${esc((a.births||[]).join(" / ")||"—")}</b></td><td>${a.hit?"✅":"❌"}</td></tr>`).join("")||'<tr><td colspan="5">Пока нет 20 проверок строгой ветки.</td></tr>'}</tbody></table></div>`)}
 ${card("000–999 · СТАТИСТИКА ПО ПОЛНОМУ АРХИВУ",`<div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Сколько раз</th><th>Последний тираж</th><th>Тиражей назад</th></tr></thead><tbody>${stats.map(x=>`<tr><td><b>${x.triple}</b></td><td>${x.count}</td><td>${x.lastDraw==null?"—":"№"+x.lastDraw}</td><td>${x.gap==null?"—":x.gap}</td></tr>`).join("")}</tbody></table></div>`)}
 ${card("ПОСЛЕДНИЕ ФАКТИЧЕСКИЕ ТРОЙНИ В ПОЛНОМ АРХИВЕ",`<div class="table-wrap"><table><thead><tr><th>Тираж</th><th>Тройня</th><th>Тиражей назад</th></tr></thead><tbody>${facts.map(x=>`<tr><td>№${x.draw}</td><td><b>${x.combo}</b></td><td>${x.gap}</td></tr>`).join("")||'<tr><td colspan="3">Данные полного архива не загружены.</td></tr>'}</tbody></table></div>`)}
 ${card("АРХИВ ПРОВЕРОК ТРОЙНИКОВ",`<div class="table-wrap"><table><thead><tr><th>Дата/время</th><th>Факт</th><th>Было сигналов</th><th>Hit</th><th>Прогнозы</th></tr></thead><tbody>${audit.slice(0,500).map(a=>`<tr><td>${esc(a.date)} ${esc(a.time)}</td><td><b>${esc(a.fact)}</b></td><td>${esc(a.predictions?.length||0)}</td><td>${a.hit?"✅":"❌"}</td><td>${esc((a.predictions||[]).map(x=>x.triple).join(" / ")||"—")}</td></tr>`).join("")||'<tr><td colspan="5">Проверок новой отдельной ветки зеркала ещё нет.</td></tr>'}</tbody></table></div>`)}
 ${card("ПРАВИЛО",`<p><b>Зеркало не относится к основному прогнозу.</b> Оно не имеет MASTER score, не входит в MAIN / PERM→FAMILY / APP CORE / SHIFT и не участвует в классификации ошибок основного TOP-3. Полный архив используется только как историческая база поиска и статистики тройников.</p>`)}`;
}
