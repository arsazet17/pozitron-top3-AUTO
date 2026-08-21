import fs from "node:fs/promises";

async function patchIndex(){
  let s=await fs.readFile("index.html","utf8");
  if(!s.includes("forecast-center.css")){
    s=s.replace("</head>",'  <link rel="stylesheet" href="./forecast-center.css?v=1">\n</head>');
  }
  if(!s.includes("forecast-center.js")){
    s=s.replace('</body>','  <script src="./forecast-center.js?v=1"></script>\n</body>');
  }
  await fs.writeFile("index.html",s);
}

async function patchApp(){
  let s=await fs.readFile("js/app.js","utf8");
  if(!s.includes("window.TOP3_AUTO_CTX=c;")){
    s=s.replace("const c=makeCtx(); ctx=c;","const c=makeCtx(); ctx=c; window.TOP3_AUTO_CTX=c;");
  }
  if(!s.includes("top3-auto-render")){
    s=s.replace("archiveCurrent(c);","archiveCurrent(c); window.dispatchEvent(new CustomEvent('top3-auto-render',{detail:c}));");
  }
  await fs.writeFile("js/app.js",s);
}

async function patchUpdater(){
  let s=await fs.readFile("scripts/update.mjs","utf8");

  if(!s.includes("function resultTimeHasArrived(")){
    const helper=`
function resultTimeHasArrived(date,time){
  const [y,m,d]=String(date).split("-").map(Number);
  const [hh,mm]=String(time).split(":").map(Number);
  if(!y||!m||!d||!Number.isFinite(hh)||!Number.isFinite(mm))return false;
  const stamp=Date.UTC(y,m-1,d,hh-3,mm);
  return stamp<=Date.now();
}
`;
    s=s.replace("function nextSlot(last){",helper+"\nfunction nextSlot(last){");
  }

  // Не добавлять факт до наступления рассчитанного слота.
  const old='const slot=nextSlot(last); const rec={date:p.date||slot.date,time:slot.time,A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],combo:p.combo,draw:p.draw};';
  const neu='const slot=nextSlot(last); if(!resultTimeHasArrived(p.date||slot.date,slot.time)){console.log("Тираж ещё не наступил — факт не сохраняем",p.date||slot.date,slot.time,p.combo);process.exit(0)} const rec={date:p.date||slot.date,time:slot.time,A:+p.combo[0],B:+p.combo[1],C:+p.combo[2],combo:p.combo,draw:p.draw};';
  if(s.includes(old)) s=s.replace(old,neu);

  await fs.writeFile("scripts/update.mjs",s);
}

await patchIndex();
await patchApp();
await patchUpdater();
console.log("TOP3 AUTO Forecast Center installed");
