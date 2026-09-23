from pathlib import Path
import re

# app.js
p=Path('analyzer/app.js')
s=p.read_text(encoding='utf-8')
s=s.replace("import {computeTripleAllLinks} from '../js/engine/triple-all-links.js';",
            "import {computeTripleAllLinks} from '../js/engine/m4-diff-mirror-1000.js';")
s=s.replace("const VER='0.6.8'", "const VER='0.6.9'", 1)

helper='''function renderM4Detail(){
  const box=$(\'#m4Detail\'),m=authoritative?.m4;if(!box)return;
  if(!m?.ok){box.innerHTML=`<div class="section-title compact"><div><div class="kicker">M4 · Δ ↔ зеркало</div><h3>Последние значения каждой тройни · окно 1000</h3></div></div><div class="muted">${esc(m?.reason||\'Нет данных\')}</div>`;return}
  const signals=m.signals||[];
  const summary=signals.length?signals.map(t=>`<span class="chip"><b>${esc(t)}</b></span>`).join(\' \'):\'<b>СИГНАЛА НЕТ.</b>\';
  const rows=(m.candidates||[]).map(c=>{
    if(!c.found)return `<tr><td><b>${c.triple}</b></td><td colspan="6" class="muted">Нет этой тройни в последних 1000 тиражах</td></tr>`;
    const dir=c.match?(c.diffToMirror&&c.mirrorToDiff?\'Δ→зеркало / зеркало→Δ\':c.diffToMirror?\'Δ→зеркало\':\'зеркало→Δ\'):\'—\';
    return `<tr class="${c.match?\'hit-row\':\'\'}"><td><b>${c.triple}</b></td><td>№${c.row?.id??\'—\'}<br><span class="muted">${esc(c.row?.date||\'\')} ${esc(c.row?.time||\'\')}</span></td><td class="mono">${esc(c.previous?.code||\'—\')} → ${esc(c.row?.code||\'—\')}</td><td class="mono"><b>${esc(c.diff||\'—\')}</b><br><span class="muted">family ${esc(c.diffFamily||\'—\')}</span></td><td class="mono"><b>${esc(c.mirror||\'—\')}</b><br><span class="muted">family ${esc(c.mirrorFamily||\'—\')}</span></td><td>${c.match?\'✅ СХЛОПНУЛОСЬ\':\'—\'}</td><td>${dir}</td></tr>`;
  }).join(\'\');
  box.innerHTML=`
    <div class="section-title compact"><div><div class="kicker">M4 · Δ ↔ зеркало</div><h3>Последние значения каждой тройни · окно 1000</h3></div></div>
    <div class="audit-grid" style="margin-bottom:1rem">
      <div><span>Последний факт</span><b>${esc(m.latest?.code||\'—\')}</b><small>№${m.latest?.id??\'—\'}</small></div>
      <div><span>Предыдущий</span><b>${esc(m.previous?.code||\'—\')}</b><small>№${m.previous?.id??\'—\'}</small></div>
      <div><span>Последняя Δ</span><b>${esc(m.currentDiff||\'—\')}</b><small>family ${esc(m.currentDiffFamily||\'—\')}</small></div>
      <div><span>Зеркало Δ</span><b>${esc(m.currentMirror||\'—\')}</b><small>family ${esc(m.currentMirrorFamily||\'—\')}</small></div>
      <div><span>Окно</span><b>${m.windowSize||0} тиражей</b><small>№${m.windowStart?.id??\'—\'} → №${m.windowEnd?.id??\'—\'}</small></div>
      <div><span>Итог M4</span><b>${signals.length?signals.join(\' / \'):\'СИГНАЛА НЕТ\'}</b><small>Прогнозируется тройня, чья пара Δ/зеркало схлопнулась</small></div>
    </div>
    <div style="margin-bottom:1rem"><b>ИТОГОВЫЙ СИГНАЛ M4:</b><div style="margin-top:.55rem">${summary}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Тройня</th><th>Последнее появление /1000</th><th>Переход</th><th>Δ тройни</th><th>Зеркало Δ</th><th>Статус</th><th>Направление</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="muted" style="margin-top:1rem">Сравнение только по family: порядок цифр не важен. Проверка: последняя Δ ↔ зеркало Δ тройни или зеркало последней Δ ↔ Δ тройни. Для каждой тройни используется только её самое последнее появление внутри текущих 1000 тиражей.</div>`;
}

'''
if 'function renderM4Detail(){' not in s:
    marker='function renderMain(){'
    if marker not in s: raise SystemExit('renderMain marker not found')
    s=s.replace(marker,helper+marker,1)
s=s.replace("const m4Label=$('#m4Card')?.previousElementSibling;if(m4Label)m4Label.textContent='M4 · Итог (вне Frozen)';",
            "const m4Label=$('#m4Card')?.previousElementSibling;if(m4Label)m4Label.textContent='M4 · Δ ↔ зеркало · 1000';renderM4Detail();")
p.write_text(s,encoding='utf-8')

# index.html
p=Path('analyzer/index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('id="version">v0.6.8<','id="version">v0.6.9<',1)
s=s.replace('<div class="method"><span>M4 · Семейные связи</span><b id="m4Card">—</b></div>',
            '<div class="method"><span>M4 · Δ ↔ зеркало · 1000</span><b id="m4Card">—</b></div>')
if 'id="m4Detail"' not in s:
    marker='        <div class="card" id="m7Detail">'
    block='''        <div class="card" id="m4Detail">
          <div class="section-title compact"><div><div class="kicker">M4 · Δ ↔ зеркало</div><h3>Последние значения каждой тройни · окно 1000</h3></div></div>
          <div class="muted">Расчёт загружается…</div>
        </div>\n\n'''
    if marker not in s: raise SystemExit('m7Detail marker not found')
    s=s.replace(marker,block+marker,1)
s=s.replace('<div><b>M4</b><p>Цикл от фактической тройни до следующей; все family-связи и лидеры.</p></div>',
            '<div><b>M4</b><p>Берётся последняя Δ текущего факта и её зеркало. В последних 1000 тиражах для каждой тройни 000–999 берётся только её самое последнее появление, вычисляются Δ и зеркало Δ. Сравнение по family без порядка: последняя Δ ↔ зеркало тройни или зеркало последней Δ ↔ Δ тройни. Чья пара схлопнулась — ту тройню прогнозируем.</p></div>')
s=s.replace('app.js?v=068-m7-odd500','app.js?v=069-m4-diffmirror1000')
p.write_text(s,encoding='utf-8')

# sw.js
p=Path('analyzer/sw.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r"const CACHE='[^']+'", "const CACHE='top3-analyzer-v0.6.9-m4-diffmirror1000'", s, count=1)
s=s.replace("'./app.js?v=068-m7-odd500'", "'./app.js?v=069-m4-diffmirror1000'")
asset="  '../js/engine/m4-diff-mirror-1000.js',\n"
if "../js/engine/m4-diff-mirror-1000.js" not in s:
    marker="  './m7.js?v=068-m7-odd500',\n"
    if marker not in s: raise SystemExit('sw m7 asset marker not found')
    s=s.replace(marker,marker+asset,1)
p.write_text(s,encoding='utf-8')
