from pathlib import Path
import re, json

VER='1.3.12'
p=Path('js/pages/triples.js')
s=p.read_text(encoding='utf-8')

if 'function repeatFamilies150' not in s:
    marker='function tripleStats(ctx){'
    add='''function repeatFamilies150(records=[]){
 const real=(records||[]).map(r=>{const code=String(r?.combo??r?.code??((r?.A!=null&&r?.B!=null&&r?.C!=null)?`${r.A}${r.B}${r.C}`:""));return{id:Number(r?.draw??r?.id),date:String(r?.date||""),time:String(r?.time||""),code};}).filter(r=>Number.isInteger(r.id)&&/^\\d{3}$/.test(r.code)).sort((a,b)=>a.id-b.id);
 const window=real.slice(-150),byFamily=new Map();
 window.forEach((r,i)=>{const family=r.code.split("").sort().join("");if(!byFamily.has(family))byFamily.set(family,[]);byFamily.get(family).push({pos:i+1,...r});});
 const rows=[...byFamily.entries()].filter(([,hits])=>hits.length>=2).map(([family,hits])=>({family,count:hits.length,hits})).sort((a,b)=>b.count-a.count||a.family.localeCompare(b.family));
 return{windowSize:window.length,rows};
}
function repeatFamilies150Html(x){
 const rows=(x.rows||[]).map(r=>`<tr><td><b>family${esc(r.family)}</b></td><td><b>${esc(r.count)}</b></td><td>${r.hits.map(h=>esc(h.pos)).join(" · ")}</td><td>${r.hits.map(h=>`№${esc(h.id)}=${esc(h.code)}`).join(" · ")}</td></tr>`).join("");
 return `<p class="muted">Окно: ${esc(x.windowSize)}/150 последних фактических тиражей. Показываются только family, встретившиеся минимум 2 раза. Позиция 1 — самый старый тираж окна, позиция ${esc(x.windowSize)} — самый новый.</p><div class="table-wrap"><table><thead><tr><th>Family</th><th>Количество</th><th>Позиции в окне 150</th><th>Тиражи / комбинации</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Повторных family в окне нет.</td></tr>'}</tbody></table></div>`;
}
'''
    if marker not in s: raise SystemExit('tripleStats marker not found')
    s=s.replace(marker,add+marker,1)

if 'const repeat150=repeatFamilies150(ctx.records)' not in s:
    marker='const stats=tripleStats(ctx),facts=lastTripleFacts(ctx),L=s.leader;'
    repl='const stats=tripleStats(ctx),facts=lastTripleFacts(ctx),L=s.leader,repeat150=repeatFamilies150(ctx.records);'
    if marker not in s: raise SystemExit('stats marker not found')
    s=s.replace(marker,repl,1)

if 'ПОВТОРНЫЕ СЕМЬИ · ПОСЛЕДНИЕ 150 ТИРАЖЕЙ' not in s:
    marker=' ${card("🏆 ТАБЛИЦА ЛИДЕРОВ ОТ ТРОЙНИ · ВСЕ СВЯЗИ",allLinksHtml(allLinks))}'
    card=' ${card("🔁 ПОВТОРНЫЕ СЕМЬИ · ПОСЛЕДНИЕ 150 ТИРАЖЕЙ",repeatFamilies150Html(repeat150))}\n'
    if marker not in s: raise SystemExit('M4 card marker not found')
    s=s.replace(marker,card+marker,1)

p.write_text(s,encoding='utf-8')

p=Path('data/version.json'); d=json.loads(p.read_text(encoding='utf-8') or '{}'); d['version']=VER; d['buildDate']='2026-09-19'; d['note']='Тройни: таблица повторных family за последние 150 тиражей; M6 остаётся отключён'; p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=Path('sw.js'); s=p.read_text(encoding='utf-8'); s=re.sub(r'const CACHE="[^"]+";', 'const CACHE="top3-auto-v1312-repeat-families-150";',s,count=1); p.write_text(s,encoding='utf-8')
p=Path('manifest.webmanifest'); s=p.read_text(encoding='utf-8'); s=re.sub(r'"start_url":\s*"[^"]+"',f'"start_url": "./?v={VER}"',s,count=1); p.write_text(s,encoding='utf-8')
