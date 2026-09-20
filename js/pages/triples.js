import {card,esc} from "../ui.js";
import {computeTripleChat,TRIPLE_CHAT_RULE_CODE,SERIAL_LEADER_TTL} from "../engine/triples-chat.js";
import {computeTripleAllLinks,computeAllLinksForRows,ALL_LINKS_RULE_CODE} from "../engine/triple-all-links.js";
import {computeTripleBeacon,TRIPLE_BEACON_RULE_CODE} from "../engine/triple-beacon.js";
import {computeM6V3Strict,M6_V3_RULE_CODE} from "../engine/m6-v3-strict.js";

function isRepeated(c){return /^([0-9])\1\1$/.test(String(c||""))}
function fmtList(a){return a&&a.length?a.join(" / "):"—"}
function stageLabel(x){return `${x.triple} · ${x.stage}/2 ${x.stage===1?"NEW":"LAST"}`}
function serialLabel(x){return `${x.triple} · rem${x.rem} · серия ${x.streak}`}
function uniqTriples(a=[]){return [...new Set((a||[]).filter(isRepeated))].sort((x,y)=>Number(x[0])-Number(y[0]))}
function familyOf(v){const s=String(v??"").replace(/\D/g,"").padStart(3,"0").slice(-3);return s.split("").sort().join("")}
function repeatFamilies150(ctx,limit=150){
 const full=ctx.fullArchive,combos=full?.combos||[];
 if(full&&combos.length){
  const total=Math.min(limit,combos.length),start=combos.length-total,map=new Map();
  for(let i=start;i<combos.length;i++){
   const code=String(combos[i]??"").padStart(3,"0");if(!/^\d{3}$/.test(code))continue;
   const family=familyOf(code),pos=i-start+1,draw=Number(full.fromDraw)+i;
   if(!map.has(family))map.set(family,{family,count:0,positions:[],draws:[],codes:[]});
   const x=map.get(family);x.count++;x.positions.push(pos);x.draws.push(draw);x.codes.push(code);
  }
  return {rows:[...map.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||a.family.localeCompare(b.family)),total,fromDraw:Number(full.fromDraw)+start,toDraw:Number(full.fromDraw)+combos.length-1};
 }
 const real=(ctx.records||[]).map(r=>({draw:Number(r.draw??r.id),code:String(r.combo??((r.A!=null&&r.B!=null&&r.C!=null)?`${r.A}${r.B}${r.C}`:""))})).filter(r=>Number.isInteger(r.draw)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.draw-b.draw).slice(-limit),map=new Map();
 real.forEach((r,i)=>{const family=familyOf(r.code);if(!map.has(family))map.set(family,{family,count:0,positions:[],draws:[],codes:[]});const x=map.get(family);x.count++;x.positions.push(i+1);x.draws.push(r.draw);x.codes.push(r.code)});
 return {rows:[...map.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||a.family.localeCompare(b.family)),total:real.length,fromDraw:real[0]?.draw??null,toDraw:real.at(-1)?.draw??null};
}
function repeatFamilies150Html(x){
 const rows=(x.rows||[]).map((r,i)=>`<tr><td>${i+1}</td><td><b>family${esc(r.family)}</b></td><td><b>${esc(r.count)}</b></td><td>${esc(Math.max(0,r.count-1))}</td><td>${esc(r.positions.join(", "))}</td><td>${esc(r.draws.map(n=>`№${n}`).join(", "))}</td><td>${esc(r.codes.join(" / "))}</td></tr>`).join("");
 return `<p class="muted"><b>Окно:</b> последние ${esc(x.total)}/150 фактических тиражей${x.fromDraw!=null?` · №${esc(x.fromDraw)}…№${esc(x.toDraw)}`:""}. Показываются только семьи, которые встретились минимум 2 раза. Позиция 1 = самый старый тираж окна, позиция ${esc(x.total||150)} = самый новый.</p><div class="table-wrap"><table><thead><tr><th>№</th><th>Семья</th><th>Выходов</th><th>Повторов</th><th>Позиции в окне</th><th>Тиражи</th><th>Комбинации</th></tr></thead><tbody>${rows||'<tr><td colspan="7">Повторных семей в текущем окне нет.</td></tr>'}</tbody></table></div>`;
}
function m6V3Html(x){
 const r=x?.current;if(!r)return `<p class="muted">M6 V3 forward начнётся с факта №268327 → target №268328.</p>`;
 const paths=r.paths?.length?r.paths.join(" · "):"—";
 const rows=(x.rows||[]).slice(-20).reverse().map(q=>`<tr><td>№${esc(q.sourceId)}</td><td>${esc(q.date)}<br><b>${esc(q.time)}</b></td><td><b>${esc(q.fact)}</b><br>family${esc(q.family)}</td><td>${esc(q.count)}</td><td>${esc(q.appearances.map((id,i)=>`${i+1}:№${id}`).join(" · "))}</td><td>${q.trigger?"ДА":"НЕТ"}</td><td><b>${esc(q.triples?.length?q.triples.join(" / "):"—")}</b><br>→ №${esc(q.targetId)}</td><td>${esc(q.prevCheck)}</td></tr>`).join("");
 return `<div class="kpi" style="font-size:26px">${esc(r.triples?.length?r.triples.join(" / "):"— NO SIGNAL")}</div><div class="muted">one-shot на №${esc(r.targetId)} · current family${esc(r.family)} · N=${esc(r.count)} в окне ${esc(r.windowSize)}/150 · ${r.trigger?"TRIGGER":"NO TRIGGER"}</div><p><b>Появления:</b> ${esc(r.appearances.map((id,i)=>`${i+1}-е №${id}`).join(" · "))}</p><p><b>XXX:</b> ${esc(r.triples?.length?r.triples.join(" / "):"—")} · <b>пути:</b> ${esc(paths)}</p><div class="table-wrap"><table><thead><tr><th>№ факт</th><th>Дата / время</th><th>Факт / family</th><th>N</th><th>Появления</th><th>Trigger</th><th>M6 Frozen</th><th>Проверка предыдущего</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">Только current_family + current_family через все уникальные перестановки mod10; сохраняются только XXX. 1-е и 2-е появление = NO SIGNAL; 3-е и каждое последующее в текущем скользящем окне150 = trigger. V1/V2 не используются. M6 считается отдельно и не входит в CORE/M4. Код: ${esc(M6_V3_RULE_CODE)}.</p>`;
}
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
 const births=new Map((snapshot.birthsWindow||[]).map(x=>[Number(x.id),x]));
 return `<div class="table-wrap"><table><thead><tr><th>№</th><th>Дата / время</th><th>Факт</th><th>Frozen ДО</th><th>Проверка</th><th>Frozen после</th><th>Новые рождения</th><th>Сложение NEW</th><th>Лидер 5</th></tr></thead><tbody>${(snapshot.archive||[]).map(r=>{const b=births.get(Number(r.id))||{};return `<tr><td>№${esc(r.id)}</td><td>${esc(r.date)}<br><b>${esc(r.time)}</b></td><td><b>${esc(r.fact)}</b></td><td>${esc(r.before)}</td><td>${r.check.includes("✅")?"✅ ":r.check.includes("❌")?"❌ ":""}${esc(r.check.replace(/^✅\s*|^❌\s*/,""))}</td><td><b>${esc(r.after)}</b></td><td>${esc(fmtList(b.births||[]))}</td><td>${esc(fmtList(b.additionBirths||[]))}</td><td>${esc(r.serial||"—")}</td></tr>`}).join("")}</tbody></table></div>`;
}
function allLinksHtml(x){
 const anchor=x.anchor?`${x.anchor.code} · ${x.anchor.date} ${x.anchor.time}`:"—";
 const start=x.start?`${x.start.date} ${x.start.time}`:"—";
 const rows=(x.ranking||[]).map(r=>`<tr><td>${esc(r.rank)}</td><td><b>${esc(r.triple)}</b></td><td><b>${esc(r.count)}</b></td><td>${esc((Number(r.share)||0).toFixed(1))}%</td><td>${esc(r.sourceCount)}</td><td>${esc(r.recipientCount)}</td><td>${r.avgLag==null?"—":esc(Number(r.avgLag).toFixed(2))}</td><td>${r.maxLag==null?"—":esc(r.maxLag)}</td></tr>`).join("");
 return `<div class="table-wrap"><table><thead><tr><th>Место</th><th>Тройня</th><th>Все связи</th><th>Доля</th><th>Источников</th><th>Фактов-получателей</th><th>Средний лаг</th><th>Макс. лаг</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted"><b>Опорная тройня:</b> ${esc(anchor)} · <b>старт цикла:</b> ${esc(start)} · <b>тиражей в текущем цикле:</b> ${esc(x.cycleRows)} · <b>всего связей:</b> ${esc(x.total)}</p><p class="muted">Статистика считается по ВСЕМ связям текущего цикла: доля от общего числа связей, уникальные источники, уникальные факты-получатели, средний и максимальный лаг. Несколько связей одного факта не схлопываются. При равенстве количества связей место одинаковое и идёт плотная нумерация 1, 2, 2, 3… Новый цикл начинается со следующего тиража после новой фактической тройни. Код: ${esc(ALL_LINKS_RULE_CODE)}.</p>`;
}
function topM4(calc){const n=Number(calc?.ranking?.[0]?.count||0);return n>0?(calc.ranking||[]).filter(x=>Number(x.count)===n).map(x=>x.triple):[]}
function m4Fallback(ctx,allLinks,baseCore){
 if(baseCore?.length)return {values:[],kind:"M4 fallback не нужен"};
 const live=topM4(allLinks);if(live.length)return {values:live,kind:"M4 текущий цикл"};
 const real=(ctx.records||[]).map(r=>({id:Number(r.draw??r.id),date:r.date,time:r.time,code:String(r.combo??`${r.A}${r.B}${r.C}`)})).filter(r=>Number.isInteger(r.id)&&/^\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id);
 let anchor=-1;for(let i=real.length-1;i>=0;i--)if(isRepeated(real[i].code)){anchor=i;break}
 if(anchor<0||anchor!==real.length-1)return {values:[],kind:"M4 текущий цикл пока без рейтинга"};
 let prev=-1;for(let i=anchor-1;i>=0;i--)if(isRepeated(real[i].code)){prev=i;break}
 if(prev<0)return {values:[],kind:"M4 transition недоступен"};
 const closed=computeAllLinksForRows(real.slice(prev+1,anchor)),values=topM4(closed);
 return {values,kind:values.length?"M4 transition · 1 тираж":"M4 transition без лидера"};
}

export function renderTriples(ctx){
 const calc=computeTripleChat(ctx.records,ctx.fullArchive),s=calc.snapshot,allLinks=computeTripleAllLinks(ctx.records),beacon=computeTripleBeacon(ctx.fullArchive),m6=computeM6V3Strict(ctx);
 if(!s)return card("🔮 ТРОЙНИ · M1 / M2 / M3","<p>Недостаточно фактических данных для расчёта.</p>");
 const stats=tripleStats(ctx),facts=lastTripleFacts(ctx),L=s.leader,repeats150=repeatFamilies150(ctx);
 const leader=L.leaders.length?`${L.leaders.join(" / ")} ×${L.max}`:"—";
 const serial=s.serialLeaders?.length?s.serialLeaders.map(serialLabel).join(" · "):"—";
 const m1=fmtList(s.m1),m2=s.m2.length?s.m2.map(stageLabel).join(" · "):"—",m3=s.m3.length?s.m3.map(x=>`${stageLabel(x)} · ${x.sourceCode}+${x.bornCode||""}`).join(" · "):"—";
 const baseCore=uniqTriples(s.frozen),fallback=m4Fallback(ctx,allLinks,baseCore),combinedFrozen=uniqTriples([...baseCore,...fallback.values]);
 const windows=s.windows.length?s.windows.map(w=>`${w.triple}: ждём family ${w.waitFamily||w.waitSig} · rem${w.rem}`).join(" · "):"Открытых окон нет";
 const pkg=s.diag.packages?.length?s.diag.packages.join(" · "):"не сформирован",deps=s.diag.dependency?.length?s.diag.dependency.join(" · "):"нет новых зависимых подтверждений",blocks=s.diag.blocks?.length?s.diag.blocks.join(" · "):"нет",m2events=s.diag.m2Events?.length?s.diag.m2Events.join(" · "):"нет новых событий",serialEvents=s.diag.serialEvents?.length?s.diag.serialEvents.join(" · "):"нет нового серийного события";
 const beaconPair=beacon.nearest?`${beacon.nearest.source}+${beacon.nearest.second}→${beacon.nearest.type}`:"—",beaconPattern=beacon.nearest?`${beacon.nearest.type} · дистанция ${beacon.nearest.distance}`:"—",beaconMatches=beacon.matched?.length?beacon.matched.map(x=>`${x.type} · дистанция ${x.distance} · ${x.source}+${x.second}→${x.type}`).join(" / "):"—",beaconActive=beacon.activePatterns?.length?beacon.activePatterns.slice().sort((a,b)=>a.distance-b.distance||a.type.localeCompare(b.type)).map(x=>`${x.type}@${x.distance}`).join(" · "):"нет";
 return `<div class="grid cols-3">
 ${card("🔮 ИТОГОВЫЙ FROZEN · CORE + M4",`<div class="kpi" style="font-size:24px">${esc(fmtList(combinedFrozen))}</div><div class="muted">на ${esc(ctx.target?.date||"—")} · ${esc(ctx.target?.time||"—")} · CORE ${esc(fmtList(baseCore))} · ${esc(fallback.kind)} ${esc(fmtList(fallback.values))}</div>`)}
 ${card("🏆 ЛИДЕР ПОЯВЛЕНИЯ · 20",`<div class="kpi" style="font-size:24px">${esc(leader)}</div><div class="muted">только новые рождения, без carry / продления / дублей</div>`)}
 ${card("📚 ПОЛНЫЙ АРХИВ",`<div class="kpi">${esc(ctx.fullArchive?.total||ctx.records.length)}</div><div class="muted">№${esc(ctx.fullArchive?.fromDraw||"—")}…№${esc(ctx.fullArchive?.toDraw||"—")}</div>`)}
 </div>
 ${card("🔦 МАЯЧОК · ОТДЕЛЬНЫЙ ПРОГНОЗ",`<div class="kpi" style="font-size:26px">${esc(beacon.status)}</div><div class="muted">на ${esc(ctx.target?.date||"—")} · ${esc(ctx.target?.time||"—")} · не входит в итоговый Frozen</div><div class="table-wrap" style="margin-top:10px"><table><tbody><tr><th>Сработавший frozen-шаблон</th><td><b>${esc(beaconMatches)}</b></td></tr><tr><th>Ближайшее разрешённое схлопывание</th><td><b>${esc(beaconPair)}</b></td></tr><tr><th>Тип × дистанция ближайшего</th><td><b>${esc(beaconPattern)}</b></td></tr><tr><th>Активные type@distance ≤20</th><td>${esc(beaconActive)}</td></tr><tr><th>NO-REUSE пар в окне 50</th><td>${esc(beacon.pairs?.length||0)}</td></tr><tr><th>Frozen V2 шаблонов</th><td>${esc(beacon.frozenPatternCount||0)}</td></tr></tbody></table></div><p class="muted"><b>${esc(beacon.reason)}</b></p><p class="muted">Тип 000…999 здесь означает тип точного поразрядного схлопывания, а не прогноз конкретной тройни. Каждая строка архива может участвовать максимум в одной паре; порядок source→second строгий, семьи и перестановки запрещены. Код: ${esc(TRIPLE_BEACON_RULE_CODE)}.</p>`)}
 ${card("🔥 СЕРИЙНЫЙ ЛИДЕР · 5 ТИРАЖЕЙ",`<div class="kpi" style="font-size:24px">${esc(serial)}</div><p class="muted">Если одна и та же XXX-тройня рождается именно СЛОЖЕНИЕМ в двух тиражах подряд или более, она становится лидером и автоматически идёт в CORE ещё ${SERIAL_LEADER_TTL} тиражей. Carry 1/2→2/2, M2 READY, дубль одного рождения и package→000 серией не считаются.</p>`)}
 <div class="grid cols-3" style="margin-top:12px">
 ${card("M1 · МЕТОД 1",`<div class="kpi" style="font-size:24px">${esc(m1)}</div><div class="muted">1 следующий тираж · база живёт 15 фактов после exact mirror/history gate</div>`)}
 ${card("M2 · МЕТОД 2",`<div class="kpi" style="font-size:22px">${esc(m2)}</div><div class="muted">схлопывание family-окна → 1/2 NEW → 2/2 LAST</div><p class="muted" style="margin-top:8px">${esc(windows)}</p>`)}
 ${card("M3 · МЕТОД 3",`<div class="kpi" style="font-size:22px">${esc(m3)}</div><div class="muted">15 предыдущих · все перестановки · 1/2 NEW → 2/2 LAST</div>`)}
 </div>
 ${card("📜 АРХИВ ПРОГНОЗОВ ЗА ПОСЛЕДНИЕ 20 ТИРАЖЕЙ",`${archiveHtml(s)}<p class="muted">Факт → Frozen ДО → проверка → Frozen после.</p>`)}
 ${card("🔁 ПОВТОРНЫЕ СЕМЬИ · ПОСЛЕДНИЕ 150 ТИРАЖЕЙ",repeatFamilies150Html(repeats150))}
 ${card("🧬 M6 · THIRD+ REPEAT FAMILY / 150 · V3 STRICT",m6V3Html(m6))}
 ${card("🏆 ТАБЛИЦА ЛИДЕРОВ ОТ ТРОЙНИ · ВСЕ СВЯЗИ",allLinksHtml(allLinks))}
 ${card("📊 ЛИДЕР ПО ЧАСТОТЕ · БЕЗ ДУБЛЯЖЕЙ · ПОСЛЕДНИЕ 20",`${frequencyHtml(s.frequency,L.leaders)}<p class="muted">Считаются только новые рождения. Продление 1/2 → 2/2 второй раз не считается; M1+M3 из одного source = одно рождение; открытое окно M2 не считается; package→000 = одно рождение 000.</p>`)}
 ${card("🧩 ПАКЕТ ПОДРЯД → 000",`<p><b>${esc(pkg)}</b></p><p class="muted">Если подряд идущие исходные комбинации дают разные XXX-тройки, отдельные XXX заменяются итоговым 000 с фиксацией участвовавших исходников.</p>`)}
 ${card("🔎 КОНТРОЛЬ ПРАВИЛ",`<div class="table-wrap"><table><tbody><tr><th>МАЯЧОК</th><td>${esc(TRIPLE_BEACON_RULE_CODE)} · ${beacon.signal?"SIGNAL":"NO SIGNAL"}</td></tr><tr><th>Лидеры от тройни</th><td>${esc(ALL_LINKS_RULE_CODE)}</td></tr><tr><th>Серийный лидер</th><td>${esc(serialEvents)}</td></tr><tr><th>Exact BLOCK</th><td>${esc(blocks)}</td></tr><tr><th>M2 события</th><td>${esc(m2events)}</td></tr><tr><th>Зависимость M1/M3</th><td>${esc(deps)}</td></tr><tr><th>Mirror gate</th><td>${esc(s.diag.mirror||"—")} · ${s.diag.mirrorPass?"PASS":"не подтверждён"}${Number.isFinite(s.diag.mirrorHits)?` · exact ${esc(s.diag.mirrorHits)}`:""}</td></tr><tr><th>Версия правил M1/M2/M3</th><td>${esc(TRIPLE_CHAT_RULE_CODE)}</td></tr></tbody></table></div>`)}
 ${card("000–999 · ФАКТИЧЕСКАЯ СТАТИСТИКА ПОЛНОГО АРХИВА",`<div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Сколько раз</th><th>Последний тираж</th><th>Тиражей назад</th></tr></thead><tbody>${stats.map(x=>`<tr><td><b>${x.triple}</b></td><td>${x.count}</td><td>${x.lastDraw==null?"—":"№"+x.lastDraw}</td><td>${x.gap==null?"—":x.gap}</td></tr>`).join("")}</tbody></table></div>`)}
 ${card("ПОСЛЕДНИЕ ФАКТИЧЕСКИЕ ТРОЙНИ",`<div class="table-wrap"><table><thead><tr><th>Тираж</th><th>Тройня</th><th>Тиражей назад</th></tr></thead><tbody>${facts.map(x=>`<tr><td>№${x.draw}</td><td><b>${x.combo}</b></td><td>${x.gap}</td></tr>`).join("")||'<tr><td colspan="3">Данных пока нет.</td></tr>'}</tbody></table></div>`)}
 ${card("ПРАВИЛО",`<p><b>Раздел «Тройни» считается отдельно от CHAT MASTER.</b> M1 / M2 / M3, серийный лидер, МАЯЧОК и таблица лидеров от тройни не получают MASTER score. Таблица повторных family за 150 тиражей — только аналитика и не влияет на Frozen.</p>`)}`;
}
