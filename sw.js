const CACHE = 'paiva-bike-fit-v5-23';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate', event => {event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE && key.startsWith('paiva-bike-fit-'))await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch', event => {const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{return await fetch(req);}catch(e){if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();throw e;}})());});
