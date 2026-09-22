from pathlib import Path

app_path = Path('analyzer/app.js')
index_path = Path('analyzer/index.html')
sw_path = Path('analyzer/sw.js')

app = app_path.read_text(encoding='utf-8')

replacements = [
    ("const VER='0.6.5'", "const VER='0.6.6'"),
    ("$('#m5Card').textContent=m5.main?'MAIN':m5.reserve?'RESERVE':'NO SIGNAL';",
     "$('#m5Card').textContent=m5.signal?'🚨 СИГНАЛ':'NO SIGNAL';"),
    ("signal=m.main||m.reserve||m.burst,level=",
     "signal=Boolean(m.signal),level=")
]

for old, new in replacements:
    if old not in app:
        raise RuntimeError(f'app.js anchor not found: {old}')
    app = app.replace(old, new, 1)

app_path.write_text(app, encoding='utf-8')

index = index_path.read_text(encoding='utf-8')
index = index.replace('id="version">v0.6.0', 'id="version">v0.6.6')
index = index.replace('app.js?v=062-final-2129', 'app.js?v=066-beacon-consistency')
index_path.write_text(index, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("const CACHE='top3-analyzer-v0.6.3-archive-poll-0030';", "const CACHE='top3-analyzer-v0.6.6-beacon-consistency';")
sw = sw.replace("'./app.js?v=063-archive-poll'", "'./app.js?v=066-beacon-consistency'")
sw_path.write_text(sw, encoding='utf-8')

# Guard: the general M5 card and the dedicated Beacon view must now consume
# the same canonical boolean m.signal from authoritativeM5().
final_app = app_path.read_text(encoding='utf-8')
assert "$('#m5Card').textContent=m5.signal?'🚨 СИГНАЛ':'NO SIGNAL';" in final_app
assert 'signal=Boolean(m.signal),level=' in final_app
assert "m5.main?'MAIN':m5.reserve?'RESERVE':'NO SIGNAL'" not in final_app

print('Beacon consistency fix applied: both views use authoritativeM5().signal; version 0.6.6')
