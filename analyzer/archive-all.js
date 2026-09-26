import {computeTripleChat} from '../js/engine/triples-chat.js';
import {computeTripleAllLinks} from '../js/engine/m4-diff-mirror-1000.js';
import {computeTripleBeacon} from '../js/engine/triple-beacon.js';
import {computeM6V3Strict} from '../js/engine/m6-v3-strict.js';
import {computeM6R2} from '../js/engine/m6-r2.js';

const HISTORY=20;
const ODD=['111','333','555','777','999'];
let busy=false,lastDraw=0;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const triple=x=>/^([0-9])\1\1$/.test(String(x||''));
const norm=x=>{const draw=Number(x?.draw??x?.id),combo=String(x?.combo??x?.code??((x?.A!=null&&x?.B!=null&&x?.C!=null)?`${x.A}${x.B}${x.C}`:'')).padStart(3,'0').slice(-3);if(!Number.isInteger(draw)||!/^\d{3}$/.test(combo))return null;return{draw,combo,date:String(x.date||''),time:String(x.time||'').slice(0,5)}};
const perms=v=>{const a=String(v||'').padStart(3,'0').slice(-3).split(''),s=new Set();for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(j!==i)for(let k=0;k<3;k++)if(k!==i&&k!==j)s.add(a[i]+a[j]+a[k]);return[...s]};
const add=(a,b)=>[0,1,2].map(i=>(Number(a[i])+Number(b[i]))%10).join('');

function m7Base(records){
  const rows=(records||[]).map(norm).filter(Boolean).sort((a,b)=>a.draw-b.draw);
  if(rows.length<501)return{signals:[],series:[],r2:[],r3:[]};
  const X=rows.at(-1),prev=rows.slice(-501,-1),xp=perms(X.combo),analyzed=prev.map(p=>{const hits=new Set();for(const a of xp)for(const b of perms(p.combo)){const z=add(a,b);if(ODD.includes(z))hits.add(z)}return{...p,hits}});
  const series=[];
  for(const t of ODD){let start=-1;for(let i=0;i<=analyzed.length;i++){const has=i<analyzed.length&&analyzed[i].hits.has(t);if(has&&start<0)start=i;if(!has&&start>=0){const len=i-start;if(len>=2)series.push({triple:t,length:len,members:analyzed.slice(start,i)});start=-1}}}
  const best={};for(const s of series){if(!best[s.triple]||s.length>best[s.triple].length)best[s.triple]=s}
  const signals=ODD.filter(t=>best[t]).map(t=>({triple:t,length:best[t].length}));
  const r2=[];for(const s of series){if(s.length!==2)continue;const P1=s.members[0],P2=s.members[1],pairTriple=add(P1.combo,P2.combo);if(!triple(pairTriple))continue;r2.push({m7Triple:s.triple,P1,P2,pairTriple,lag:X.draw-P2.draw})}
  const r3=r2.filter(x=>x.lag>=31&&x.lag<=33);
  return{signals,series,r2,r3};
}

function exactCell(values,fact){
  const a=uniq(values);if(!a.length)return'<span class="muted">—</span>';
  return `<span class="mono">${esc(a.join(' / '))}</span><br><small>${a.includes(fact)?'✅ HIT':'❌ MISS'}</small>`;
}
function genericTripleCell(active,fact,extra=''){
  if(!active)return'<span class="muted">NO SIGNAL</span>';
  return `<b>ТРОЙНАЯ</b>${extra?`<br><small>${esc(extra)}</small>`:''}<br><small>${triple(fact)?'✅ HIT XXX':'❌ MISS'}</small>`;
}
function m7Cell(x,fact){if(!x.signals.length)return'<span class="muted">—</span>';const txt=x.signals.map(s=>`${s.triple}×${s.length}`).join(' / '),hit=x.signals.some(s=>s.triple===fact);return `<span class="mono">${esc(txt)}</span><br><small>SCAN · ${hit?'совпал с фактом':'без совпадения'}</small>`}
function m7r2Cell(x){if(!x.r2.length)return'<span class="muted">NO SIGNAL</span>';return x.r2.map(s=>`<span class="mono">${s.m7Triple}→${s.pairTriple}</span><br><small>lag ${s.lag}</small>`).join('<hr>')}

async function loadJSON(url){const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function fullForBeacon(prefix){const last=prefix.at(-1);if(!last)return{fromDraw:0,combos:[]};const tail=prefix.slice(-50);return{fromDraw:tail[0]?.draw||0,combos:tail.map(x=>x.combo)}}

async function build(){
  if(busy)return;const body=$('#allMethodsArchiveBody'),summary=$('#allMethodsArchiveSummary');if(!body||!summary)return;busy=true;summary.textContent='Расчёт всех методов…';
  try{
    const [raw,fullCore]=await Promise.all([loadJSON('../data/archive.json'),loadJSON('../data/full-archive/all.json').catch(()=>null)]);
    const rows=(raw||[]).map(norm).filter(Boolean).sort((a,b)=>a.draw-b.draw);if(rows.length<2)throw Error('Недостаточно фактов');
    const newest=rows.at(-1).draw;if(newest===lastDraw&&body.children.length){summary.textContent=`${Math.min(HISTORY,rows.length-1)} последних проверок · M1–M7`;busy=false;return}lastDraw=newest;
    const start=Math.max(1,rows.length-HISTORY),out=[];
    for(let i=start;i<rows.length;i++){
      const fact=rows[i],prefix=rows.slice(0,i);
      const tc=computeTripleChat(prefix,fullCore||null),snap=tc.snapshot||{};
      const m1=uniq(snap.m1||[]),m2=uniq((snap.m2||[]).map(x=>x.triple)),m3=uniq((snap.m3||[]).map(x=>x.triple)),frozen=uniq(snap.frozen||[]);
      const m4=computeTripleAllLinks(prefix),m4sig=uniq(m4?.signals||[]);
      const m6=computeM6V3Strict({records:prefix}).current?.triples||[];
      const m6r2=computeM6R2({records:prefix});
      const m5=computeTripleBeacon(fullForBeacon(prefix));
      const m7=m7Base(prefix);
      out.push({fact,m1,m2,m3,m4:m4sig,m5:Boolean(m5.signal),m6:uniq(m6),m6r2:uniq(m6r2.signal||[]),m7,frozen});
      if((i-start)%4===3)await new Promise(r=>setTimeout(r,0));
    }
    body.innerHTML=out.reverse().map(r=>`<tr>
      <td>№${r.fact.draw}<br><small>${esc(r.fact.date)} ${esc(r.fact.time)}</small></td>
      <td><b class="mono">${esc(r.fact.combo)}</b></td>
      <td>${exactCell(r.m1,r.fact.combo)}</td>
      <td>${exactCell(r.m2,r.fact.combo)}</td>
      <td>${exactCell(r.m3,r.fact.combo)}</td>
      <td>${exactCell(r.m4,r.fact.combo)}</td>
      <td>${genericTripleCell(r.m5,r.fact.combo)}</td>
      <td>${exactCell(r.m6,r.fact.combo)}</td>
      <td>${exactCell(r.m6r2,r.fact.combo)}</td>
      <td>${m7Cell(r.m7,r.fact.combo)}</td>
      <td>${m7r2Cell(r.m7)}</td>
      <td>${genericTripleCell(r.m7.r3.length>0,r.fact.combo,r.m7.r3.length?`lag ${r.m7.r3.map(x=>x.lag).join('/')}`:'')}</td>
      <td>${exactCell(r.frozen,r.fact.combo)}</td>
    </tr>`).join('');
    summary.textContent=`${out.length} последних проверок · M1–M7 + R2/R3`;
  }catch(e){body.innerHTML=`<tr><td colspan="13">Ошибка архива методов: ${esc(e.message||e)}</td></tr>`;summary.textContent='Ошибка расчёта'}finally{busy=false}
}

function init(){build();const c=$('#currentFact');if(c)new MutationObserver(()=>setTimeout(build,100)).observe(c,{childList:true,characterData:true,subtree:true});$('#syncNowBtn')?.addEventListener('click',()=>setTimeout(build,1800))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
