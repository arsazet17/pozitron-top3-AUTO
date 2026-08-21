import fs from 'node:fs/promises';
let i=await fs.readFile('index.html','utf8');
if(!i.includes('top3-forecast-center.css'))i=i.replace('</head>','  <link rel="stylesheet" href="top3-forecast-center.css?v=1">\n</head>');
if(!i.includes('top3-forecast-center.js'))i=i.replace('</body>','  <script src="top3-forecast-center.js?v=1"></script>\n</body>');
await fs.writeFile('index.html',i);

let u=await fs.readFile('update-top3.mjs','utf8');
if(!u.includes('function rejectFutureDraws(')){
 const helper=`function rejectFutureDraws(draws) {
  const now=Date.now();
  return draws.filter(d=>{
    try {
      const [dd,mm,yy]=String(d.date).split('.').map(Number);
      const [hh,mi]=String(d.time).split(':').map(Number);
      const stamp=Date.UTC(2000+yy,mm-1,dd,hh-3,mi);
      return Number.isFinite(stamp)&&stamp<=now;
    } catch { return false; }
  });
}\n\n`;
 u=u.replace('function dedupe(draws) {',helper+'function dedupe(draws) {');
}
u=u.replace('return dedupe(found);','return dedupe(rejectFutureDraws(found));');
await fs.writeFile('update-top3.mjs',u);
console.log('installed');
