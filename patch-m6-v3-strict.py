from pathlib import Path
import re,json
ver='1.3.14'
p=Path('js/pages/triples.js')
s=p.read_text(encoding='utf-8')
imp='import {computeM6V3Strict,M6_V3_RULE_CODE} from "../engine/m6-v3-strict.js";\n'
if 'm6-v3-strict.js' not in s:
    anchor='import {computeTripleBeacon,TRIPLE_BEACON_RULE_CODE} from "../engine/triple-beacon.js";\n'
    if anchor not in s: raise SystemExit('import marker not found')
    s=s.replace(anchor,anchor+imp,1)

helper='''function m6V3Html(x){
 const r=x?.current;if(!r)return `<p class="muted">M6 V3 forward начнётся с факта №268327 → target №268328.</p>`;
 const paths=r.paths?.length?r.paths.join(" · "):"—";
 const rows=(x.rows||[]).slice().reverse().map(q=>{
  const appearances=(q.appearances||[]).map((id,i)=>`${i+1}-е:№${id}`).join(" · ")||"—";
  const qpaths=q.paths?.length?q.paths.join(" · "):"—";
  const frozen=q.triples?.length?q.triples.join(" / "):"— NO SIGNAL";
  return `<tr><td>№${esc(q.sourceId)}</td><td>${esc(q.date)}<br><b>${esc(q.time)}</b></td><td><b>${esc(q.fact)}</b><br>family${esc(q.family)}</td><td>${esc(q.windowSize)}/150</td><td><b>${esc(q.count)}</b></td><td>${esc(appearances)}</td><td>${q.trigger?"ДА":"НЕТ"}</td><td><b>${esc(q.triples?.length?q.triples.join(" / "):"—")}</b></td><td>${esc(qpaths)}</td><td>№${esc(q.targetId)} · <b>${esc(frozen)}</b></td><td>${esc(q.prevCheck)}</td></tr>`;
 }).join("");
 return `<div class="kpi" style="font-size:26px">${esc(r.triples?.length?r.triples.join(" / "):"— NO SIGNAL")}</div><div class="muted">one-shot на №${esc(r.targetId)} · current family${esc(r.family)} · N=${esc(r.count)} в окне ${esc(r.windowSize)}/150 · ${r.trigger?"TRIGGER":"NO TRIGGER"}</div><p><b>Появления current family:</b> ${esc((r.appearances||[]).map((id,i)=>`${i+1}-е №${id}`).join(" · ")||"—")}</p><p><b>XXX:</b> ${esc(r.triples?.length?r.triples.join(" / "):"—")} · <b>формулы/перестановки:</b> ${esc(paths)}</p><div class="table-wrap"><table><thead><tr><th>№ факт</th><th>Дата / время</th><th>Факт / family</th><th>Окно</th><th>N</th><th>Все появления family</th><th>Trigger</th><th>XXX</th><th>Формулы / перестановки</th><th>M6 Frozen на следующий</th><th>Проверка предыдущего M6</th></tr></thead><tbody>${rows||'<tr><td colspan="11">Forward-журнал V3 ещё пуст.</td></tr>'}</tbody></table></div><p class="muted"><b>ANTI-LEAKAGE:</b> сначала проверяется старый one-shot Frozen на пришедшем факте, только затем текущий факт входит в новое окно150 и формируется новый прогноз. Только current_family + current_family через все уникальные перестановки mod10; сохраняются только XXX. 1-е и 2-е появление = NO SIGNAL; 3-е и каждое последующее в текущем скользящем окне150 = trigger. Никакой ACTIVE family / active_until нет. V1/V2 не используются. M6 считается отдельно и не входит в CORE/M4. Код: ${esc(M6_V3_RULE_CODE)}.</p>`;
}
'''
pat=r'function m6V3Html\(x\)\{.*?\n\}\nfunction tripleStats\(ctx\)\{'
if re.search(pat,s,flags=re.S):
    s=re.sub(pat,helper+'function tripleStats(ctx){',s,count=1,flags=re.S)
else:
    marker='function tripleStats(ctx){'
    if marker not in s: raise SystemExit('helper marker not found')
    s=s.replace(marker,helper+marker,1)

old='const calc=computeTripleChat(ctx.records,ctx.fullArchive),s=calc.snapshot,allLinks=computeTripleAllLinks(ctx.records),beacon=computeTripleBeacon(ctx.fullArchive);'
new='const calc=computeTripleChat(ctx.records,ctx.fullArchive),s=calc.snapshot,allLinks=computeTripleAllLinks(ctx.records),beacon=computeTripleBeacon(ctx.fullArchive),m6=computeM6V3Strict(ctx);'
if old in s:s=s.replace(old,new,1)
elif 'm6=computeM6V3Strict(ctx)' not in s: raise SystemExit('render calc marker not found')
card=' ${card("🧬 M6 · THIRD+ REPEAT FAMILY / 150 · V3 STRICT",m6V3Html(m6))}\n'
anchor=' ${card("🔁 ПОВТОРНЫЕ СЕМЬИ · ПОСЛЕДНИЕ 150 ТИРАЖЕЙ",repeatFamilies150Html(repeats150))}\n'
if 'THIRD+ REPEAT FAMILY / 150 · V3 STRICT' not in s:
    if anchor not in s: raise SystemExit('card marker not found')
    s=s.replace(anchor,anchor+card,1)

if '<tr><th>M6 V3 STRICT</th>' not in s:
    s=s.replace('<div class="table-wrap"><table><tbody><tr><th>МАЯЧОК</th>',f'<div class="table-wrap"><table><tbody><tr><th>M6 V3 STRICT</th><td>${{esc(M6_V3_RULE_CODE)}} · ${{esc(m6.current?.triples?.length?m6.current.triples.join(" / "):"NO SIGNAL")}}</td></tr><tr><th>МАЯЧОК</th>',1)
s=s.replace('M1 / M2 / M3, серийный лидер, МАЯЧОК и таблица лидеров от тройни не получают MASTER score. Таблица повторных family за 150 тиражей — только аналитика и не влияет на Frozen.', 'M1 / M2 / M3, M6 V3 STRICT, серийный лидер, МАЯЧОК и таблица лидеров от тройни не получают MASTER score. M6 V3 — отдельный one-shot и не входит в CORE/M4; таблица повторных family за 150 тиражей остаётся отдельной аналитикой.',1)
p.write_text(s,encoding='utf-8')

p=Path('data/version.json')
d=json.loads(p.read_text(encoding='utf-8') or '{}');d['version']=ver;d['buildDate']='2026-09-20';d['note']='Тройни: M6 V3 STRICT — third+ current repeat family в скользящем окне150; полный anti-leakage журнал; V1/V2 удалены'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

p=Path('package.json');d=json.loads(p.read_text(encoding='utf-8'));d['version']=ver;p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

p=Path('manifest.webmanifest');s=p.read_text(encoding='utf-8');s=re.sub(r'"start_url":\s*"[^"]+"',f'"start_url": "./?v={ver}"',s,count=1);p.write_text(s,encoding='utf-8')

p=Path('sw.js');s=p.read_text(encoding='utf-8');s=re.sub(r'const CACHE="[^"]+";','const CACHE="top3-auto-v1314-m6-v3-strict-journal";',s,count=1)
if './js/engine/m6-v3-strict.js' not in s:s=s.replace('"./js/engine/triple-beacon.js",','"./js/engine/triple-beacon.js","./js/engine/m6-v3-strict.js",')
p.write_text(s,encoding='utf-8')
