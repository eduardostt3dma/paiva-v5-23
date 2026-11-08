// Alterar esta chave a cada publicação importante força a renovação dos
// arquivos JS/CSS cacheados e evita que o celular mostre uma versão antiga.
const CACHE = 'paiva-bike-fit-v583-cabecalho-offline-20261107-r2';
const FILES = ['./', './index.html', './manifest.webmanifest', './pin-lock.js', './pin-lock.css', './anthro-live.css', './anthro-live.js', './sternum-calc.js', './arm-calc.js', './pdf-lib.min.js', './pdf-export.js', './body-proportions.js', './bike-photo-upload.js', './help-text.js', './frame-compare.js', './bike-project.js', './final-measures.css', './final-measures.js', './photo-calibrator.css', './athlete-2d.css', './athlete-2d.js', './paiva-2d-history.js', './paiva-wind-simple.css', './paiva-wind-simple.js', './paiva-wind-segmentation.js', './paiva-aero-contour.js', './paiva-records.js', './athlete-motion.js', './multicam.css', './multicam.js', './handlebar-guide.css', './handlebar-guide.js', './video-converter.css', './video-converter.js', './paiva-v524.css', './paiva-tt-simple.js', './paiva-tt-reference.js', './paiva-v524-results.js', './paiva-tt-fit.js', './paiva-attendimentos.js', './icon-192.png', './icon-512.png', './antropometria-paiva.png', './paiva-logo-round.png', './bike-road-cutout.png', './bike-mtb-cutout.png', './bike-tt-cutout.png'];
// O motor WebAssembly compactado (~10 MB) é baixado somente na primeira conversão;
// cada arquivo acessado passa a ser armazenado offline sem pesar no boot do app.
FILES.push('./paiva-spline.js','./paiva-spline.css',
  './paiva-aero-compare.js','./paiva-aero-compare.css',
  './paiva-aero-pose.js','./paiva-aero-pose.css',
  './paiva-wind-ai.js',
  './paiva-aero-metrics.js','./paiva-aero-metrics.css');
const OPTIONAL = new Set(['ffmpeg.js','814.ffmpeg.js','ffmpeg-core.js','ffmpeg-core.wasm.gz'].map(name=>new URL('./'+name,self.location.href).pathname));
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate', event => {event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE && key.startsWith('paiva-bike-fit-'))await caches.delete(key);await self.clients.claim();})());});
// Páginas HTML: consultar a rede primeiro para que publicações no GitHub apareçam.
// Sem conexão, usa o index.html já salvo para manter o funcionamento offline.
// Outros recursos mantêm o comportamento anterior (cache-first).
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req, {cache:'no-store'});
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response.ok && OPTIONAL.has(new URL(req.url).pathname)) {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(req, response.clone());
        } catch (_) { /* sem quota: segue online */ }
      }
      return response;
    } catch (e) { throw e; }
  })());
});
