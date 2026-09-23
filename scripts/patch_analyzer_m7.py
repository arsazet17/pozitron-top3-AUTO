from pathlib import Path
import re

# Analyzer main page: M5 remains only in the separate Beacon tab; its former main card becomes strict M7.
p = Path('analyzer/index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('Методы M1–M6', 'Методы M1–M7')
s = s.replace(
    '<div class="method"><span>M5 · BURST</span><b id="m5Card">—</b></div>',
    '<div class="method accent-method"><span>M7 · Нечётные тройни · 500</span><b id="m5Card">—</b></div>'
)
s = s.replace(
    '<div><b>M5</b><p>Exact-схлопывания, окно50; BURST ≥6, MAIN/RESERVE по типам.</p></div>',
    '<div><b>M7</b><p>Ровно 500 предыдущих тиражей. Семьи X и P складываются по позициям mod10. Учитываются только 111/333/555/777/999. Сигнал — только одна и та же тройня на 2+ соседних тиражах подряд.</p></div>'
)
if 'id="m7Detail"' not in s:
    marker = '        <div class="detail-grid">'
    block = '''        <div class="card" id="m7Detail">\n          <div class="section-title compact"><div><div class="kicker">M7 · нечётные тройни</div><h3>500 предыдущих · серия 2+</h3></div></div>\n          <div class="muted">Расчёт загружается…</div>\n        </div>\n\n'''
    if marker not in s:
        raise SystemExit('ERROR: detail-grid marker not found')
    s = s.replace(marker, block + marker, 1)
if 'm7.js?v=068-m7-odd500' not in s:
    if '</body>' not in s:
        raise SystemExit('ERROR: </body> not found')
    s = s.replace('</body>', '  <script type="module" src="m7.js?v=068-m7-odd500"></script>\n</body>', 1)
s = re.sub(r'app\.js\?v=[^"\']+', 'app.js?v=068-m7-odd500', s)
s = s.replace('>v0.6.6<', '>v0.6.8<').replace('>v0.6.7<', '>v0.6.8<')
p.write_text(s, encoding='utf-8')

# Runtime version.
p = Path('analyzer/app.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const VER='[^']+'", "const VER='0.6.8'", s, count=1)
p.write_text(s, encoding='utf-8')

# Service worker cache-bust and cache M7 module.
p = Path('analyzer/sw.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE='[^']+'", "const CACHE='top3-analyzer-v0.6.8-m7-odd500'", s, count=1)
s = re.sub(r"'\./app\.js\?v=[^']+'", "'./app.js?v=068-m7-odd500'", s)
if "'./m7.js?v=068-m7-odd500'" not in s:
    target = "'./app.js?v=068-m7-odd500',"
    if target not in s:
        raise SystemExit('ERROR: sw app.js asset marker not found')
    s = s.replace(target, target + "\n  './m7.js?v=068-m7-odd500',", 1)
p.write_text(s, encoding='utf-8')

# Hard verification of requested invariants.
index = Path('analyzer/index.html').read_text(encoding='utf-8')
m7 = Path('analyzer/m7.js').read_text(encoding='utf-8')
app = Path('analyzer/app.js').read_text(encoding='utf-8')
checks = {
    'main title M1-M7': 'Методы M1–M7' in index,
    'main card renamed M7': 'M7 · Нечётные тройни · 500' in index,
    'M7 detail present': 'id="m7Detail"' in index,
    'M7 module linked': 'm7.js?v=068-m7-odd500' in index,
    'version 0.6.8': "const VER='0.6.8'" in app,
    'window exactly 500': 'const M7_WINDOW=500;' in m7,
    'odd targets only': "const M7_TARGETS=['111','333','555','777','999'];" in m7,
    'no old main M5 card label': '<span>M5 · BURST</span><b id="m5Card">' not in index,
}
failed = [k for k,v in checks.items() if not v]
if failed:
    raise SystemExit('ERROR checks: ' + ', '.join(failed))
print('M7 PATCH VERIFIED:', ', '.join(checks))
