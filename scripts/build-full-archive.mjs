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

function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return structuredClone(fallback)}}
function pad2(n){return String(n).padStart(2,'0')}
function addMinutesStamp(date,time,minutes){
  const [y,m,d]=String(date).split('-').map(Number),[hh,mm]=String(time).split(':').map(Number);
  const x=new Date(Date.UTC(y,m-1,d,hh,mm)+minutes*60000);
  return {date:`${x.getUTCFullYear()}-${pad2(x.getUTCMonth()+1)}-${pad2(x.getUTCDate())}`,time:`${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}`};
}
function decodePacked(meta){const s=String(meta?.data||''),out=[];for(let i=0;i+2<s.length;i+=3)out.push(s.slice(i,i+3));return out}
function expandBootstrap(meta){
  if(!meta?.data)return[];
  const combos=decodePacked(meta),out=[];
  for(let i=0;i<combos.length;i++){
    const stamp=i===0?meta.first:addMinutesStamp(meta.regularStart.date,meta.regularStart.time,(i-1)*Number(meta.stepMinutes||30));
    const combo=combos[i];
    out.push({draw:String(Number(meta.fromDraw)+i),date:stamp.date,time:stamp.time,A:+combo[0],B:+combo[1],C:+combo[2],combo});
  }
  if(meta.count!=null&&out.length!==Number(meta.count))throw new Error(`bootstrap count mismatch ${out.length} != ${meta.count}`);
  return out;
}
async function fetchText(name){
  const r=await fetch(SOURCE_BASE+name,{cache:'no-store'});
  if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);
  return r.text();
}
async function loadEarlyArchive(){
  const sandbox={TOP3_SEARCH_PACK:''};
  for(const [kind,name] of SEARCH_PARTS){
    const text=await fetchText(name);
    if(kind==='raw'){
      sandbox.TOP3_SEARCH_PACK+=text.trim();
    }else{
      new Function('window','atob','Uint8Array','Date','Object',text)(sandbox,atob,Uint8Array,Date,Object);
    }
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
function loadDatedTail(){
  const archive=readJSON('data/archive.json',[]),bootstrap=expandBootstrap(readJSON('data/bootstrap-tail.json',null));
  const byDraw=new Map();
  for(const r of [...archive,...bootstrap]){
    const id=Number(r?.draw),combo=String(r?.combo||'');
    if(Number.isInteger(id)&&/^\d{3}$/.test(combo))byDraw.set(id,{...r,draw:String(id),combo});
  }
  const ids=[...byDraw.keys()].filter(x=>x>=DATED_FROM).sort((a,b)=>a-b);
  if(!ids.length||ids[0]!==DATED_FROM)throw new Error(`dated archive must start at №${DATED_FROM}; got ${ids[0]}`);
  const last=ids.at(-1);
  const combos=[];
  for(let id=DATED_FROM;id<=last;id++){
    const r=byDraw.get(id);
    if(!r)throw new Error(`dated archive gap at №${id}`);
    combos.push(r.combo);
  }
  return {combos,last,rows:byDraw};
}

const early=await loadEarlyArchive();
const dated=loadDatedTail();
const combos=[...early,...dated.combos];
const expected=dated.last-EARLY_FROM+1;
if(combos.length!==expected)throw new Error(`full archive count mismatch ${combos.length} != ${expected}`);

fs.mkdirSync(OUT_DIR,{recursive:true});
const meta={
  schema:3,
  source:'TOP-3 full archive · verified early search pack + dated archive',
  earlySourceRepo:'arsazet17/pozitron-top3-v1.0',
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
console.log(`FULL ARCHIVE OK: №${meta.fromDraw}…№${meta.toDraw}; total=${meta.total}; early=${early.length}; dated=${dated.combos.length}; first=${combos[0]}; last=${combos.at(-1)}`);
