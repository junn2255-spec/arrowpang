// Latest-release network-first update v155
importScripts('./pwa-cache.js');
const PREFIX='arrowtok-pwa-',CACHE=PREFIX+PWA_VERSION,BASE=self.registration.scope;
const url=p=>new URL(p,BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);const response=await fetch(url('index.html'),{cache:'reload'});if(!response.ok)throw Error('Latest game unavailable');await cache.put(url('index.html'),response);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys(),upgrading=keys.some(key=>key.startsWith(PREFIX)&&key!==CACHE);for(const key of keys)if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();if(upgrading){for(const client of await self.clients.matchAll({type:'window'})){const target=new URL(client.url);if(target.href.startsWith(BASE)){target.searchParams.set('v','160');await client.navigate(target.href);}}}})()));
async function missed(){for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'CACHE_MISS'});}
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==new URL(BASE).origin||!u.href.startsWith(BASE))return;
 const path=u.pathname.slice(new URL(BASE).pathname.length);if(path.startsWith('api/')||path.startsWith('cdn-cgi/')||path==='sw.js'||path==='pwa-cache.js')return;
 const navigation=req.mode==='navigate',asset=/\.(js|css|webp|png|jpg|jpeg|ttf|mp3|wav|webmanifest)$/.test(path);if(!navigation&&!asset)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(!navigation&&!/\.(js|css)$/.test(path)&&!req.headers.has('range')){const cached=await cache.match(req);if(cached)return cached;}
  try{const response=await fetch(req,{cache:navigation||/\.(js|css)$/.test(path)?'no-cache':'default'});if(response.status===200&&!response.redirected&&!req.headers.has('range')){await cache.put(navigation?url('index.html'):req,response.clone());const keys=await cache.keys();if(keys.length>PWA_CORE.length+140){const essential=new Set(PWA_CORE.map(url));const victim=keys.find(k=>!essential.has(k.url));if(victim)await cache.delete(victim);}}return response;}
  catch{const cached=await cache.match(req);if(cached)return cached;if(navigation){const page=await cache.match(url('index.html'));if(page)return page;const fallback=await cache.match(url('offline.html'));if(fallback)return fallback;}await missed();return new Response('Internet connection required for this uncached resource',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
 })());
});


