/* PAIVA Motion Studio V5.83 — Pausas de análise. Processamento local. */
(()=>{'use strict';
function init(){
 const root=document.querySelector('.paiva-2d-workspace');
 const video=document.getElementById('paiva-2d-video');
 const canvas=document.getElementById('paiva-2d-canvas');
 const dock=root?.querySelector('.paiva-2d-player-dock');
 if(!root||!video||!canvas||!dock||dock.querySelector('#paiva-pause-controls'))return;
 const panel=document.createElement('div');panel.id='paiva-pause-controls';panel.className='paiva-pause-controls';
 panel.innerHTML='<span class="paiva-pause-label">PAUSAS DE ANÁLISE</span><label>Duração <select id="paiva-pause-seconds"><option value="1">1 s</option><option value="2">2 s</option><option value="3" selected>3 s</option><option value="4">4 s</option><option value="5">5 s</option></select></label><button type="button" id="paiva-pause-add">＋ Marcar pausa</button><button type="button" id="paiva-pause-export">Exportar vídeo com análises</button><small id="paiva-pause-status" aria-live="polite">Nenhuma pausa marcada.</small><div id="paiva-pause-list"></div>';
 dock.append(panel);
 const el=id=>panel.querySelector('#'+id), pauses=[];
 const status=t=>el('paiva-pause-status').textContent=t;
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
  const button=el('paiva-pause-export');button.disabled=true;let recorder,stream;
  const oldTime=video.currentTime,wasPaused=video.paused;
  try{
   video.pause();const w=video.videoWidth||canvas.width,h=video.videoHeight||canvas.height;
   const output=document.createElement('canvas');output.width=w;output.height=h;const ctx=output.getContext('2d');
   stream=output.captureStream(30);const chunks=[];
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4500000});
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||new Error('Falha ao gravar.'));});
   const seek=t=>new Promise((resolve,reject)=>{if(Math.abs(video.currentTime-t)<0.03){resolve();return;}const timeout=setTimeout(()=>{cleanup();reject(new Error('Não foi possível posicionar o vídeo.'));},8000);function cleanup(){clearTimeout(timeout);video.removeEventListener('seeked',ready);}function ready(){cleanup();resolve();}video.addEventListener('seeked',ready);video.currentTime=t;});
   await seek(0);ctx.drawImage(video,0,0,w,h);recorder.start(500);
   let active=true;let frozen=null;
   const render=()=>{if(!active)return;try{ctx.drawImage(frozen||video,0,0,w,h);}catch(_){}requestAnimationFrame(render);};requestAnimationFrame(render);
   for(const p of pauses){
    if(p.time>video.duration)continue;
    status(`Exportando pedalada até ${stamp(p.time)}…`);
    if(video.currentTime<p.time-0.04){
     await video.play();await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('Tempo limite de reprodução.'));},Math.max(15000,(p.time-video.currentTime)*3000+15000));function cleanup(){clearTimeout(timeout);video.removeEventListener('timeupdate',tick);video.removeEventListener('ended',tick);}function tick(){if(video.currentTime>=p.time-0.035||video.ended){cleanup();resolve();}}video.addEventListener('timeupdate',tick);video.addEventListener('ended',tick);tick();});
    }
    video.pause();await seek(Math.min(p.time,video.duration));
    frozen=p.image;ctx.drawImage(p.image,0,0,w,h);status(`Congelando análise por ${p.seconds} s…`);
    // Não desenhar frames em movimento durante o congelamento.
    await new Promise(r=>setTimeout(r,p.seconds*1000));frozen=null;
   }
   if(video.currentTime<video.duration-0.06){status('Exportando pedalada final…');await video.play();await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('Tempo limite de reprodução final.'));},Math.max(15000,(video.duration-video.currentTime)*3000+15000));function cleanup(){clearTimeout(timeout);video.removeEventListener('ended',finish);video.removeEventListener('timeupdate',tick);}function finish(){cleanup();resolve();}function tick(){if(video.currentTime>=video.duration-0.05)finish();}video.addEventListener('ended',finish);video.addEventListener('timeupdate',tick);tick();});}
   video.pause();active=false;recorder.stop();await done;
   const blob=new Blob(chunks,{type:mime});if(!blob.size)throw Error('O vídeo exportado ficou vazio.');
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='PAIVA_Pausas_de_Analise.webm';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status(`Vídeo exportado com ${pauses.length} pausa(s). Arquivo WebM salvo.`);
  }catch(e){status('Não foi possível exportar: '+(e?.message||e));try{if(recorder?.state==='recording')recorder.stop();}catch(_){}}
  finally{video.pause();try{video.currentTime=oldTime;}catch(_){}if(!wasPaused)video.play().catch(()=>{});stream?.getTracks().forEach(t=>t.stop());button.disabled=false;}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
