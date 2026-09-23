const CACHE='top3-analyzer-v0.6.9-m4-diffmirror1000';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=067-m6-1000',
  './app.js?v=069-m4-diffmirror1000',
  './m7.js?v=068-m7-odd500',
  '../js/engine/m4-diff-mirror-1000.js',
  './engine.js?v=067-m6-1000',
  './seed.json',
  './manifest.webmanifest?v=067-m6-1000',
  '../assets/top3-777-original.png?v=067-m6-1000',
  '../assets/top3-777-192.png?v=067-m6-1000',
  '../assets/top3-777-512.png?v=067-m6-1000'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.includes('/data/')){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));return}e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))})