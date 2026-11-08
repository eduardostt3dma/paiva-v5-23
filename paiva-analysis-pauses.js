/* PAIVA Motion Studio V5.83 — Pausas de análise. Processamento local. */
(()=>{'use strict';
function init(){
 const root=document.querySelector('.paiva-2d-workspace');
 const video=document.getElementById('paiva-2d-video');
 const canvas=document.getElementById('paiva-2d-canvas');
 const dock=root?.querySelector('.paiva-2d-player-dock');
 if(!root||!video||!canvas||!dock||dock.querySelector('#paiva-pause-controls'))return;
 const panel=document.createElement('div');panel.id='paiva-pause-controls';panel.className='paiva-pause-controls';
 panel.innerHTML='<span class="paiva-pause-label">PAUSAS DE ANÁLISE</span><label>Duração <select id="paiva-pause-seconds"><option value="1">1 s</option><option value="2">2 s</option><option value="3" selected>3 s</option><option value="4">4 s</option><option value="5">5 s</option></select></label><button type="button" id="paiva-pause-add">＋ Marcar pausa</button><button type="button" id="paiva-pause-preview">▶ Prévia com pausas</button><button type="button" id="paiva-pause-export">Exportar vídeo com análises</button><small id="paiva-pause-status" aria-live="polite">Nenhuma pausa marcada.</small><div id="paiva-pause-list"></div>';
 dock.append(panel);
 const el=id=>panel.querySelector('#'+id), pauses=[];
 const status=t=>el('paiva-pause-status').textContent=t;
 const previewBtn=el('paiva-pause-preview');
 let previewRunning=false,previewStop=null;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function seekTo(t){return new Promise((resolve,reject)=>{
  if(Math.abs(video.currentTime-t)<0.04){resolve();return;}
  const timer=setTimeout(()=>{video.removeEventListener('seeked',ready);reject(new Error('Falha ao avançar o vídeo.'));},8000);
  function ready(){clearTimeout(timer);video.removeEventListener('seeked',ready);resolve();}
  video.addEventListener('seeked',ready);video.currentTime=t;
 });}
 async function playUntil(t,stillRunning){
  if(video.currentTime>=t-0.04)return;
  await video.play();
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{cleanup();reject(new Error('Tempo limite da reprodução.'));},Math.max(15000,(t-video.currentTime)*3000+15000));
   const interval=setInterval(tick,40);
   function cleanup(){clearTimeout(timeout);clearInterval(interval);video.removeEventListener('ended',tick);}
   function tick(){if(!stillRunning()){cleanup();resolve();}else if(video.currentTime>=t-0.045||video.ended){cleanup();resolve();}}
   video.addEventListener('ended',tick);tick();
  });
  video.pause();
 }
 async function runSequence(draw,stillRunning){
  await seekTo(0);
  for(const p of pauses.slice().sort((a,b)=>a.time-b.time)){
   if(!stillRunning())return;
   if(p.time>video.duration)continue;
   status(`Reproduzindo até ${stamp(p.time)}…`);
   await playUntil(p.time,stillRunning);
   if(!stillRunning())return;
   await seekTo(Math.min(p.time,video.duration));
   status(`Pausa de análise · ${p.seconds} s`);
   const until=performance.now()+p.seconds*1000;
   while(stillRunning()&&performance.now()<until){draw(p.image,1);await sleep(33);}
   if(!stillRunning())return;
   status('Retomando · ângulos desaparecendo…');
   // Retoma a pedalada enquanto o quadro marcado desaparece em 0,8 segundo.
   const fadeStart=performance.now();
   await video.play();
   while(stillRunning()&&performance.now()-fadeStart<800){
    draw(p.image,Math.max(0,1-(performance.now()-fadeStart)/800));await sleep(33);
   }
   draw(null,0);
  }
  if(stillRunning()&&video.currentTime<video.duration-0.06){
   status('Reproduzindo trecho final…');await playUntil(video.duration-0.05,stillRunning);
  }
 }
 previewBtn.onclick=async()=>{
  if(previewRunning){previewStop?.();return;}
  if(!pauses.length){status('Marque uma pausa antes de assistir à prévia.');return;}
  if(!Number.isFinite(video.duration)||video.duration<=0||video.readyState<2){status('Abra um vídeo gravado antes da prévia.');return;}
  const wrap=root.querySelector('.paiva-2d-canvas-wrap');
  if(!wrap){status('Não foi possível abrir a prévia.');return;}
  const overlay=document.createElement('canvas');overlay.className='paiva-pause-preview-overlay';
  overlay.width=canvas.width;overlay.height=canvas.height;
  wrap.append(overlay);
  const ctx=overlay.getContext('2d');
  const oldTime=video.currentTime,wasPaused=video.paused;
  let active=true;
  previewRunning=true;previewBtn.textContent='■ Parar prévia';
  previewStop=()=>{active=false;video.pause();};
  const draw=(frozen,alpha)=>{
   ctx.clearRect(0,0,overlay.width,overlay.height);
   try{ctx.drawImage(video,0,0,overlay.width,overlay.height);}catch(_){}
   if(frozen&&alpha>0){ctx.globalAlpha=alpha;ctx.drawImage(frozen,0,0,overlay.width,overlay.height);ctx.globalAlpha=1;}
  };
  const loop=()=>{if(!active)return;draw(null,0);requestAnimationFrame(loop);};
  // Um único ciclo de desenho controla a prévia; a pausa fornece a imagem marcada.
  let frame=null,opacity=0;
  const paint=()=>{if(!active)return;draw(frame,opacity);requestAnimationFrame(paint);};
  requestAnimationFrame(paint);
  try{
   await runSequence((image,a)=>{frame=image;opacity=a;},()=>active);
   if(active)status('Prévia concluída. Agora você pode exportar o vídeo.');
  }catch(e){status('Falha na prévia: '+(e?.message||e));}
  finally{active=false;video.pause();overlay.remove();previewRunning=false;previewStop=null;previewBtn.textContent='▶ Prévia com pausas';try{video.currentTime=oldTime;}catch(_){}if(!wasPaused)video.play().catch(()=>{});}
 };

 const stamp=t=>{const m=Math.floor(t/60),s=(t%60).toFixed(1).padStart(4,'0');return `${String(m).padStart(2,'0')}:${s}`;};
 function list(){el('paiva-pause-list').replaceChildren();pauses.forEach((p,i)=>{const row=document.createElement('div');row.className='paiva-pause-entry';const txt=document.createElement('span');txt.textContent=`${i+1}. ${stamp(p.time)} · ${p.seconds}s`;const go=document.createElement('button');go.type='button';go.textContent='Ver';go.onclick=()=>{video.pause();video.currentTime=p.time;};const del=document.createElement('button');del.type='button';del.textContent='✕';del.title='Excluir esta pausa';del.onclick=()=>{pauses.splice(i,1);list();status(`${pauses.length} pausa(s) marcada(s).`);};row.append(txt,go,del);el('paiva-pause-list').append(row);});}
 el('paiva-pause-add').onclick=()=>{
  if(!Number.isFinite(video.duration)||video.duration<=0||video.readyState<2){status('Primeiro abra um vídeo gravado e pause no quadro analisado.');return;}
  video.pause();const t=video.currentTime;
  // A tela 2D já contém as linhas e ângulos posicionados pelo profissional.
  const snap=document.createElement('canvas');snap.width=canvas.width;snap.height=canvas.height;
  const ctx=snap.getContext('2d');if(!ctx){status('Não foi possível capturar o quadro.');return;}
  ctx.drawImage(canvas,0,0);
  const curve=root.querySelector('canvas.paiva-spline-canvas');if(curve)ctx.drawImage(curve,0,0,snap.width,snap.height);
  const existing=pauses.findIndex(p=>Math.abs(p.time-t)<0.06);
  const item={time:t,seconds:Number(el('paiva-pause-seconds').value),image:snap};
  if(existing>=0)pauses[existing]=item;else pauses.push(item);
  pauses.sort((a,b)=>a.time-b.time);list();status(`Pausa registrada em ${stamp(t)} com ângulos visíveis.`);
 };
 el('paiva-pause-export').onclick=async()=>{
  if(!pauses.length){status('Marque pelo menos uma pausa antes de exportar.');return;}
  if(!Number.isFinite(video.duration)||video.duration<=0||video.readyState<2){status('Abra o vídeo original antes de exportar.');return;}
  if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream){status('Este navegador não oferece gravação de canvas. Use Chrome ou Edge atualizado.');return;}
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){status('Exportação WebM indisponível neste navegador.');return;}
  const button=el('paiva-pause-export');button.disabled=true;previewBtn.disabled=true;let recorder,stream;
  const oldTime=video.currentTime,wasPaused=video.paused;
  try{
   video.pause();const w=video.videoWidth||canvas.width,h=video.videoHeight||canvas.height;
   const output=document.createElement('canvas');output.width=w;output.height=h;const ctx=output.getContext('2d');
   stream=output.captureStream(30);const chunks=[];
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4500000});
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||new Error('Falha ao gravar.'));});
   await seekTo(0);ctx.drawImage(video,0,0,w,h);recorder.start(500);
   let active=true,frozen=null,opacity=0;
   const render=()=>{if(!active)return;try{ctx.drawImage(video,0,0,w,h);if(frozen&&opacity>0){ctx.globalAlpha=opacity;ctx.drawImage(frozen,0,0,w,h);ctx.globalAlpha=1;}}catch(_){}requestAnimationFrame(render);};
   requestAnimationFrame(render);
   await runSequence((image,a)=>{frozen=image;opacity=a;},()=>active);
   video.pause();active=false;recorder.stop();await done;
   const blob=new Blob(chunks,{type:mime});if(!blob.size)throw Error('O vídeo exportado ficou vazio.');
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='PAIVA_Pausas_de_Analise.webm';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status(`Vídeo exportado com ${pauses.length} pausa(s). Arquivo WebM salvo.`);
  }catch(e){status('Não foi possível exportar: '+(e?.message||e));try{if(recorder?.state==='recording')recorder.stop();}catch(_){}}
  finally{video.pause();try{video.currentTime=oldTime;}catch(_){}if(!wasPaused)video.play().catch(()=>{});stream?.getTracks().forEach(t=>t.stop());button.disabled=false;previewBtn.disabled=false;}
 };
}
// O workspace 2D é inserido dinamicamente após o carregamento da página.
// Aguarda sua montagem antes de adicionar os controles, sem criar duplicatas.
function mountWhenReady(){
 init();
 if(document.getElementById('paiva-pause-controls'))return;
 const observer=new MutationObserver(()=>{
  init();
  if(document.getElementById('paiva-pause-controls'))observer.disconnect();
 });
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountWhenReady);else mountWhenReady();
})();
