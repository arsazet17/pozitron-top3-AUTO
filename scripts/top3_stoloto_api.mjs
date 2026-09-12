import fs from "node:fs/promises";

const OUT = "/tmp/top3_official_tail.json";
const ARCHIVE_API = "https://m.stoloto.ru/p/api/mobile/api/v35/service/draws/archive";
const INFO_API = "https://m.stoloto.ru/p/api/mobile/api/v35/service/games/info-new";
const PAGE_SIZE = 30;
const MAX_PAGES = 20;
const TAIL_SIZE = 60;
const SCHEDULE = new Set(Array.from({length:48},(_,i)=>{
  const m=25+i*30; return `${String(Math.floor(m/60)%24).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
}));
const HEADERS={accept:"application/json","user-agent":"Mozilla/5.0","cache-control":"no-cache","pragma":"no-cache"};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function parseISO(v){const m=String(v??"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);return m?{date:`${m[1]}-${m[2]}-${m[3]}`,time:`${m[4]}:${m[5]}`}:null}
function parseEpoch(v){let n=Number(v);if(!Number.isFinite(n))return null;if(n>1e10)n/=1000;const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(n*1000));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}}
function combo(raw){const nums=raw?.combination?.structured??raw?.combination?.serialized??raw?.winningCombination??[];if(!Array.isArray(nums)||nums.length<3)return null;const a=nums.slice(0,3).map(Number);return a.every(x=>Number.isInteger(x)&&x>=0&&x<=9)?a.join(""):null}
function valid(x){return x&&Number.isInteger(x.draw)&&x.draw>=100000&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&SCHEDULE.has(x.time)&&/^\d{3}$/.test(x.combo)}
function archiveRow(raw){const dt=parseISO(raw?.date),c=combo(raw),draw=Number(raw?.number);const x=dt&&c?{draw,date:dt.date,time:dt.time,combo:c}:null;return valid(x)?x:null}
function infoRow(raw){const dt=parseEpoch(raw?.date),c=combo(raw),draw=Number(raw?.number);const x=dt&&c?{draw,date:dt.date,time:dt.time,combo:c}:null;return valid(x)?x:null}
function same(a,b){return !!a&&!!b&&a.draw===b.draw&&a.date===b.date&&a.time===b.time&&a.combo===b.combo}
function dedupe(rows){const m=new Map();for(const x of rows)if(valid(x))m.set(x.draw,x);return [...m.values()].sort((a,b)=>a.draw-b.draw)}
async function getJson(url){let last;for(let i=1;i<=3;i++){try{const r=await fetch(url,{headers:HEADERS,cache:"no-store"});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return await r.json()}catch(e){last=e;if(i<3)await sleep(1200*i)}}throw new Error(`Official API read failed: ${last}`)}
async function localLatest(){try{const j=JSON.parse(await fs.readFile("data/latest.json","utf8"));return Number(j?.draw?.draw||0)}catch{}try{const a=JSON.parse(await fs.readFile("data/archive.json","utf8"));return Math.max(0,...a.map(x=>Number(x?.draw||0)))}catch{return 0}}
async function fetchInfo(){const j=await getJson(INFO_API);const g=(j?.games||[]).find(x=>x?.name==="top-3");const row=infoRow(g?.completedDraw);if(!row)throw new Error("games/info-new did not return valid TOP-3 completedDraw");return row}
async function fetchArchive(localNo){const out=[];for(let page=1;page<=MAX_PAGES;page++){const u=new URL(ARCHIVE_API);u.searchParams.set("game","top3");u.searchParams.set("count",String(PAGE_SIZE));u.searchParams.set("page",String(page));u.searchParams.set("_",String(Date.now()));const j=await getJson(u);const rows=(j?.draws||[]).map(archiveRow).filter(Boolean);if(!rows.length)break;out.push(...rows);const oldest=Math.min(...rows.map(x=>x.draw));if(oldest<=localNo||rows.length<PAGE_SIZE)break}return dedupe(out)}
async function verify(info,archive,localNo){if(!archive.length)throw new Error("Official archive API returned no TOP-3 rows");const latest=archive.at(-1);if(same(info,latest))return{rows:archive,mode:"archive+info-new"};if(latest.draw>info.draw){const common=archive.find(x=>x.draw===info.draw);if(!same(common,info))throw new Error(`Official sources disagree: info=${JSON.stringify(info)} common=${JSON.stringify(common)}`);await sleep(2500);const again=await fetchArchive(localNo);if(!again.length||!same(latest,again.at(-1)))throw new Error(`Newest archive draw did not confirm twice: ${JSON.stringify(latest)} / ${JSON.stringify(again.at(-1))}`);console.log(`INFO-NEW LAG: №${info.draw}; archive twice confirmed №${latest.draw}`);return{rows:again,mode:"archive-twice+info-common"}}throw new Error(`Archive has not caught up with info-new: info=${JSON.stringify(info)} archive=${JSON.stringify(latest)}`)}

const localNo=await localLatest();
const [info,first]=await Promise.all([fetchInfo(),fetchArchive(localNo)]);
const verified=await verify(info,first,localNo),rows=verified.rows,newest=rows.at(-1);
if(newest.draw<localNo)throw new Error(`Official source is stale: LOCAL №${localNo}, API №${newest.draw}`);
if(newest.draw>localNo){const m=new Map(rows.map(x=>[x.draw,x]));const missing=[];for(let n=localNo+1;n<=newest.draw;n++)if(!m.has(n))missing.push(n);if(missing.length)throw new Error(`Official API tail gap: ${missing.slice(0,8).join(", ")}`)}
const tail=rows.slice(-TAIL_SIZE);if(tail.length<3)throw new Error(`Official API returned only ${tail.length} valid rows`);
await fs.writeFile(OUT,JSON.stringify(tail,null,2),"utf8");
console.log(`OFFICIAL API TOP-3 OK (${verified.mode}): ${tail.length} rows; latest №${newest.draw} ${newest.date} ${newest.time}=${newest.combo}; local №${localNo}`);
