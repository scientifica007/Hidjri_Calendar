const CACHE_PREFIX='miqat-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'-')+'-',VERSION=CACHE_PREFIX+'v1.0.1',SHELL=['./','./index.html','./assets/style.css','./assets/app.js','./assets/calendar.js','./assets/favicon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const url=new URL(event.request.url),dynamic=url.pathname.endsWith('/data/months.json')||url.pathname.endsWith('/data/headlines.json');
 if(dynamic){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));return;}
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok)caches.open(VERSION).then(c=>c.put(event.request,response.clone()));return response;})));
});
