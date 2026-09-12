import fs from 'node:fs';
import path from 'node:path';

const SOURCE_BASE='https://raw.githubusercontent.com/arsazet17/pozitron-top3-v1.0/main/';
const SEARCH_PARTS=[
  ['js','top3-search-pack-01.js'],['js','top3-search-pack-02.js'],['js','top3-search-pack-03.js'],['js','top3-search-pack-04.js'],
  ['js','top3-search-mini-001.js'],['js','top3-search-mini-002.js'],['js','top3-search-mini-003.js'],['js','top3-search-mini-004.js'],
  ['js','top3-search-mini-005.js'],['js','top3-search-mini-006.js'],['js','top3-search-mini-007.js'],['js','top3-search-mini-008.js'],
  ['js','top3-search-mini-009.js'],['js','top3-search-mini-010.js'],['js','top3-search-mini-011.js'],['js','top3-search-mini-012.js'],
  ['js','top3-search-tail-001.js'],['js','top3-search-tail-002.js'],['js','top3-search-tail-003.js'],['js','top3-search-tail-004.js'],
  ['js','top3-search-rest-001.js'],
  ['js','top3-search-bulk-001.js'],['js','top3-search-bulk-002.js'],
  ['raw','top3-search-bulk-003a.txt'],['raw','top3-search-bulk-003b.txt'],['raw','top3-search-bulk-003c.txt'],
  ['js','top3-search-bulk-004.js'],
  ['raw','top3-search-bulk-005a.txt'],['raw','top3-search-bulk-005b.txt'],['raw','top3-search-bulk-005c.txt'],
  ['js','top3-search-bulk-006.js'],
  ['raw','top3-search-bulk-007p1.txt'],['raw','top3-search-bulk-007p2a.txt'],['raw','top3-search-bulk-007p2b.txt'],['raw','top3-search-bulk-007p2c.txt'],['raw','top3-search-bulk-007p2d.txt'],['raw','top3-search-bulk-007p2e.txt'],['raw','top3-search-bulk-007p3.txt'],['raw','top3-search-bulk-007p4.txt'],['raw','top3-search-bulk-007p5.txt'],['raw','top3-search-bulk-007p6.txt'],
  ['js','top3-search-bulk-008.js'],['js','top3-search-bulk-009.js'],['js','top3-search-bulk-010.js'],['js','top3-search-bulk-011.js'],['js','top3-search-bulk-012.js'],['js','top3-search-bulk-013.js'],
  ['js','top3-search-pack-final.js']
];
const EARLY_FROM=11, EARLY_TO=247986, EARLY_COUNT=247976, DATED_FROM=247987;
const OUT_DIR='data/full-archive';

async function fetchText(name){
  const r=await fetch(SOURCE_BASE+name,{cache:'no-store'});
  if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);
  return r.text();
}
function isoDate(s){
  const m=String(s||'').match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if(!m)throw new Error(`bad date ${s}`);
  return `20${m[3]}-${m[2]}-${m[1]}`;
}
async function loadEarlyArchive(){
  const sandbox={TOP3_SEARCH_PACK:''};
  for(const [kind,name] of SEARCH_PARTS){
    const text=await fetchText(name);
    if(kind==='raw')sandbox.TOP3_SEARCH_PACK+=text.trim();
    else new Function('window','atob','Uint8Array','Date','Object',text)(sandbox,atob,Uint8Array,Date,Object);
  }
  const a=sandbox.TOP3_SEARCH_ARCHIVE;
  if(!a)throw new Error('TOP3_SEARCH_ARCHIVE was not created');
  if(a.count!==EARLY_COUNT||a.newestId!==EARLY_TO||a.oldestId!==EARLY_FROM)throw new Error(`early archive boundary mismatch: ${a.oldestId}..${a.newestId}, count=${a.count}`);
  if(a.codeById(EARLY_TO)!=='655'||a.codeById(EARLY_FROM)!=='699')throw new Error(`early archive control mismatch: newest=${a.codeById(EARLY_TO)} oldest=${a.codeById(EARLY_FROM)}`);
  const out=new Array(EARLY_COUNT);
  for(let id=EARLY_FROM;id<=EARLY_TO;id++){
    const c=a.codeById(id);
    if(!/^\d{3}$/.test(String(c||'')))throw new Error(`bad early combo №${id}: ${c}`);
    out[id-EARLY_FROM]=c;
  }
  return out;
}
async function loadDatedArchive(){
  const history=JSON.parse(await fetchText('top3-history.json'));
  if(history.fullArchive!==true)throw new Error('top3-history.json is not marked fullArchive');
  if(Number(history.archiveFrom)!==DATED_FROM)throw new Error(`dated archive start mismatch: ${history.archiveFrom}`);
  const byDraw=new Map();
  for(const d of history.draws||[]){
    const id=Number(d.id),a=Number(d.a),b=Number(d.b),c=Number(d.c);
    if(!Number.isInteger(id)||![a,b,c].every(x=>Number.isInteger(x)&&x>=0&&x<=9))continue;
    const combo=`${a}${b}${c}`;
    byDraw.set(id,{date:isoDate(d.date),time:String(d.time),A:a,B:b,C:c,combo,draw:String(id)});
  }
  const ids=[...byDraw.keys()].filter(id=>id>=DATED_FROM).sort((a,b)=>a-b);
  if(!ids.length||ids[0]!==DATED_FROM)throw new Error(`dated rows start mismatch: ${ids[0]}`);
  const last=Math.max(Number(history.latest)||0,ids.at(-1));
  const records=[],combos=[];
  for(let id=DATED_FROM;id<=last;id++){
    const r=byDraw.get(id);
    if(!r)throw new Error(`verified dated archive gap at №${id}`);
    records.push(r);combos.push(r.combo);
  }
  if(records.at(-1)?.draw!==String(last))throw new Error('dated tail mismatch');
  return {records,combos,last,updatedAt:history.updatedAt||new Date().toISOString()};
}

const [early,dated]=await Promise.all([loadEarlyArchive(),loadDatedArchive()]);
const combos=[...early,...dated.combos];
const expected=dated.last-EARLY_FROM+1;
if(combos.length!==expected)throw new Error(`full archive count mismatch ${combos.length} != ${expected}`);

fs.mkdirSync(OUT_DIR,{recursive:true});
const meta={
  schema:4,
  source:'TOP-3 full archive · verified early search pack + official dated history',
  sourceRepo:'arsazet17/pozitron-top3-v1.0',
  sourceUpdatedAt:dated.updatedAt,
  order:'oldest-to-newest',
  fromDraw:EARLY_FROM,
  toDraw:dated.last,
  total:combos.length,
  datedFromDraw:DATED_FROM,
  datedToDraw:dated.last,
  datedCount:dated.combos.length,
  undatedCount:early.length,
  data:combos.join('')
};
fs.writeFileSync(path.join(OUT_DIR,'all.json'),JSON.stringify(meta));
fs.writeFileSync(path.join(OUT_DIR,'unique.json'),JSON.stringify([...new Set(combos)].sort()));
fs.writeFileSync('data/archive.json',JSON.stringify(dated.records,null,2));
fs.writeFileSync('data/latest.json',JSON.stringify({updatedAt:new Date().toISOString(),draw:dated.records.at(-1)},null,2));
console.log(`FULL ARCHIVE OK: №${meta.fromDraw}…№${meta.toDraw}; total=${meta.total}; early=${early.length}; dated=${dated.combos.length}; first=${combos[0]}; boundary=${early.at(-1)}; last=${combos.at(-1)}`);
