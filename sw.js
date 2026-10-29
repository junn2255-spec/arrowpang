importScripts('./pwa-cache.js');
const PREFIX='arrowtok-pwa-',CACHE=PREFIX+PWA_VERSION,BASE=self.registration.scope;
const url=p=>new URL(p,BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const p of PWA_CORE){const source=p==='index.html'?'./':p==='offline.html'?'offline.html':p;const response=await fetch(url(source),{cache:'reload',credentials:'same-origin'});if(!response.ok||response.redirected)throw Error('Required file unavailable');await cache.put(url(p),response);}await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
async function missed(){for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'CACHE_MISS'});}
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==new URL(BASE).origin||!u.href.startsWith(BASE))return;
 const path=u.pathname.slice(new URL(BASE).pathname.length);if(path.startsWith('api/')||path.startsWith('cdn-cgi/')||path==='sw.js'||path==='pwa-cache.js')return;
 const navigation=req.mode==='navigate',asset=/\.(js|css|webp|png|jpg|jpeg|ttf|mp3|wav|webmanifest)$/.test(path);if(!navigation&&!asset)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(navigation){const shell=await cache.match(url('index.html'));if(shell)return shell;}if(!navigation&&!req.headers.has('range')){const cached=await cache.match(req);if(cached)return cached;}
  try{const response=await fetch(req);if(response.status===200&&!response.redirected&&!req.headers.has('range')){await cache.put(req,response.clone());const keys=await cache.keys();if(keys.length>PWA_CORE.length+140){const essential=new Set(PWA_CORE.map(url));const victim=keys.find(k=>!essential.has(k.url));if(victim)await cache.delete(victim);}}return response;}
  catch{const cached=await cache.match(req);if(cached)return cached;if(navigation){const page=await cache.match(url('index.html'));if(page)return page;const fallback=await cache.match(url('offline.html'));if(fallback)return fallback;}await missed();return new Response('Internet connection required for this uncached resource',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
 })());
});

