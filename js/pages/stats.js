import {card,esc} from "../ui.js";
const sameFamily=(a,b)=>[...String(a||"")].sort().join("")===[...String(b||"")].sort().join("");
function methodCandidates(x){
 const out=[];
 (x.master?.top3||[]).forEach((v,i)=>out.push({name:`MASTER #${i+1}`,combo:v.order}));
 (x.methods?.main?.top3||[]).forEach((v,i)=>out.push({name:`MAIN #${i+1}`,combo:v.order}));
 (x.methods?.algorithm?.top3||[]).forEach((v,i)=>out.push({name:`ALGORITHM #${i+1}`,combo:v.order}));
 const a=x.methods?.appCore?.selected?.combo;if(a)out.push({name:"APP CORE",combo:a});
 const s=x.methods?.shift?.combo;if(s)out.push({name:"SHIFT",combo:s});
 return out;
}
function methodStats(index){
 const map=new Map();
 for(const x of index){if(x.schema!=="chat-master-v1"||!x.factAfter)continue;for(const p of methodCandidates(x)){const s=map.get(p.name)||{n:0,t3:0,l3:0};s.n++;if(p.combo===x.factAfter)s.t3++;else if(sameFamily(p.combo,x.factAfter))s.l3++;map.set(p.name,s)}}
 return [...map].sort((a,b)=>(b[1].t3+b[1].l3)-(a[1].t3+a[1].l3)||a[0].localeCompare(b[0]));
}
function timeStats(index){
 const map=new Map();for(const x of index){if(x.schema!=="chat-master-v1"||!x.factAfter)continue;const s=map.get(x.target.time)||{n:0,hit:0,exact:0};s.n++;if((x.master?.families||[]).includes([...x.factAfter].sort().join("")))s.hit++;if((x.master?.combos||[]).includes(x.factAfter))s.exact++;map.set(x.target.time,s)}return [...map].sort((a,b)=>a[0].localeCompare(b[0]));
}
export function renderStats(ctx){
 const idx=ctx.forecastIndex||[],done=idx.filter(x=>x.schema==="chat-master-v1"&&x.factAfter),audits=ctx.state?.masterAudit||[],masterHits=done.filter(x=>(x.master?.families||[]).includes([...x.factAfter].sort().join(""))).length,exact=done.filter(x=>(x.master?.combos||[]).includes(x.factAfter)).length,cls={};
 for(const a of audits)cls[a.classification]=(cls[a.classification]||0)+1;
 const ms=methodStats(idx),ts=timeStats(idx),issue=ctx.issue,mirrorAudits=ctx.state?.mirrorAudit||[],mirrorHits=ctx.state?.mirrorHitLog||[];
 return `<section class="stats-live"><div class="stats-live-title"><div><span>ТЕКУЩИЙ MASTER</span><b>${esc(issue.target.date)} · ${esc(issue.target.time)}</b></div><div class="stats-last-fact"><span>Frozen</span><b>${esc((issue.master?.combos||[]).join(" / "))}</b></div></div></section>
 <div class="grid cols-4">
 ${card("MASTER ПРОВЕРЕНО",`<div class="kpi">${done.length}</div>`)}
 ${card("FAMILY HIT",`<div class="kpi">${masterHits}</div><div class="muted">${done.length?Math.round(masterHits/done.length*100):0}%</div>`)}
 ${card("EXACT ORDER",`<div class="kpi">${exact}</div>`)}
 ${card("WORK-ERROR AUDIT",`<div class="kpi">${audits.length}</div>`)}
 </div>
 ${card("СТАТИСТИКА ПО ИСТОЧНИКАМ MASTER",`<div class="table-wrap"><table><thead><tr><th>Источник</th><th>Проверено</th><th>Exact</th><th>Family</th><th>Family %</th></tr></thead><tbody>${ms.map(([n,s])=>`<tr><td>${esc(n)}</td><td>${s.n}</td><td>${s.t3}</td><td>${s.t3+s.l3}</td><td>${s.n?Math.round((s.t3+s.l3)/s.n*100):0}%</td></tr>`).join("")||'<tr><td colspan="5">Статистика новой системы начнётся с первого факта после замены.</td></tr>'}</tbody></table></div>`)}
 <div class="grid cols-2" style="margin-top:12px">
 ${card("ПО ВРЕМЕНИ",`<div class="table-wrap"><table><thead><tr><th>Время</th><th>N</th><th>Family hit</th><th>Exact</th></tr></thead><tbody>${ts.map(([t,s])=>`<tr><td>${esc(t)}</td><td>${s.n}</td><td>${s.hit}</td><td>${s.exact}</td></tr>`).join("")||'<tr><td colspan="4">Нет новых проверок</td></tr>'}</tbody></table></div>`)}
 ${card("КЛАССИФИКАЦИИ ОШИБОК",`<div class="table-wrap"><table><thead><tr><th>Класс</th><th>N</th></tr></thead><tbody>${Object.entries(cls).map(([n,v])=>`<tr><td>${esc(n)}</td><td>${v}</td></tr>`).join("")||'<tr><td colspan="2">Нет новых проверок</td></tr>'}</tbody></table></div>`)}
 </div>
 ${card("ЗЕРКАЛО · ОТДЕЛЬНАЯ СТАТИСТИКА",`<div class="list-row"><span>Проверок</span><b>${mirrorAudits.length}</b></div><div class="list-row"><span>Строгих попаданий тройника</span><b>${mirrorHits.length}</b></div><p class="muted">Не входит в MASTER KPI и не влияет на основной прогноз.</p>`)}
 ${card("ВАЖНО",`<p>Старая статистика TOP/Δ/ЧИСЛА не смешивается с новой. KPI CHAT MASTER считается только для прогнозов schema=chat-master-v1. Зеркало ведётся отдельно и в эти показатели не входит.</p>`)}`;
}
