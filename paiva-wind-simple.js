/* PAIVA AERO V5.35 — ondas visuais de ar, ilustrativas, sem CFD.
   Painel totalmente separado das ferramentas angulares do PAIVA 2D. */
(() => {
  'use strict';
  const W=960,H=540;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function wavePosition(x,y,ellipse,phase=0,intensity=3,direction=1){
    const rx=Math.max(35,ellipse.rx),ry=Math.max(28,ellipse.ry);
    const p=direction===1?x:W-x;
    const center=direction===1?ellipse.cx:W-ellipse.cx;
    const distance=p-center;
    const focus=Math.exp(-1.5*Math.pow(distance/(rx*1.32),2));
    const nearness=clamp(1-Math.abs(y-ellipse.cy)/(ry*1.45),0,1);
    const side=y<ellipse.cy?-1:1;
    const bend=side*ry*.46*focus*nearness*(.55+intensity*.11);
    const tail=Math.max(0,distance-rx);
    const wake=distance>rx?
      Math.sin(tail*.037-phase*.075)*ry*.13*nearness*
        Math.exp(-tail/(rx*1.7))*(.5+intensity*.13):0;
    return y+bend+wake;
  }
  globalThis.PAIVA_WIND_SIMPLE_MATH={wavePosition};
  if(typeof document==='undefined')return;

  function init(){
    const athlete=document.getElementById('paiva-athlete-2d');
    if(!athlete||document.getElementById('paiva-wind-simple'))return;
    const section=document.createElement('section');
    section.className='card paiva-wind-simple';
    section.id='paiva-wind-simple';
    section.innerHTML=[
      '<div class="aero-heading"><div><span>PAIVA LAB · VISUAL</span>',
      '<h2>TÚNEL DE VENTO</h2>',
      '<p>Veja as ondas passando pelo atleta. Simples, visual e independente do 2D.</p></div>',
      '<span class="aero-badge">V5.35</span></div>',
      '<div class="aero-toolbar">',
      '<label class="aero-file">📷 Abrir foto<input id="aero-photo" type="file" accept="image/png,image/jpeg,image/webp"></label>',
      '<label class="aero-file">▶ Abrir vídeo<input id="aero-video-file" type="file" accept="video/*,.mp4,.mov,.webm,.m4v"></label>',
      '<button type="button" id="aero-webcam">◉ Usar webcam</button>',
      '<button type="button" id="aero-capture">▣ Usar quadro do 2D</button>',
      '</div>',
      '<div class="aero-stage"><canvas id="aero-canvas" width="960" height="540" aria-label="Foto ou vídeo com ondas de vento ilustrativas atravessando a imagem"></canvas>',
      '<video id="aero-source-video" muted playsinline hidden></video></div>',
      '<p class="aero-guidance" id="aero-message" role="status" aria-live="polite">Abra uma foto ou vídeo. Arraste o mouse sobre o ciclista para orientar as ondas ao redor dele.</p>',
      '<div class="aero-toolbar aero-controls">',
      '<button type="button" id="aero-wind" class="aero-main">⏸ Pausar vento</button>',
      '<button type="button" id="aero-direction">→ Vento para a direita</button>',
      '<label class="aero-strength">Ondas <input type="range" id="aero-strength" min="1" max="5" step="1" value="3" aria-label="Intensidade visual das ondas de ar"><span>leve → forte</span></label>',
      '<button type="button" id="aero-play" hidden>⏸ Pausar vídeo</button>',
      '<button type="button" id="aero-stop-camera" hidden>■ Desligar câmera</button>',
      '<button type="button" id="aero-save">↓ Salvar imagem</button>',
      '</div>',
      '<p class="aero-disclaimer">Ondas de ar <strong>ilustrativas</strong>: este efeito não mede fluxo físico, turbulência, resistência, CdA ou watts. ',
      'A região marcada serve apenas para orientar o desenho gráfico. Fotos e vídeos ficam neste aparelho.</p>'
    ].join('');
    athlete.after(section);
    const actions=athlete.querySelector('.paiva-2d-title-actions');
    if(actions){
      const shortcut=document.createElement('button');
      shortcut.id='aero-open';
      shortcut.type='button';
      shortcut.textContent='≈ Túnel visual';
      shortcut.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      actions.prepend(shortcut);
    }
    const nav=document.getElementById('paiva-v524-nav');
    if(nav){
      const button=document.createElement('button');
      button.type='button';button.textContent='Vento';
      button.addEventListener('click',()=>section.scrollIntoView({behavior:'smooth',block:'start'}));
      const pdf=[...nav.querySelectorAll('button')].find(b=>b.textContent==='PDF');
      if(pdf)nav.insertBefore(button,pdf);else nav.append(button);
    }

    const el=id=>document.getElementById(id);
    const canvas=el('aero-canvas'),ctx=canvas.getContext('2d');
    if(!ctx){el('aero-message').textContent='Seu navegador não permite esta animação.';return;}
    const air=document.createElement('canvas');air.width=W;air.height=H;
    const ac=air.getContext('2d');
    const still=document.createElement('canvas');still.width=W;still.height=H;
    const sc=still.getContext('2d');
    const video=el('aero-source-video');
    let mode='demo',videoURL=null,stream=null,playing=true,direction=1,phase=0;
    let visible=true,lastTime=0;
    let ellipse={cx:W*.53,cy:H*.53,rx:W*.32,ry:H*.35};
    let pointerStart=null,dragging=false;
    const notify=message=>{el('aero-message').textContent=message;};
    const strength=()=>Number(el('aero-strength').value)||3;
    const sourceDims=source=>({
      width:source.videoWidth||source.naturalWidth||source.width,
      height:source.videoHeight||source.naturalHeight||source.height
    });
    function drawFitted(target,source){
      const size=sourceDims(source);
      if(!(size.width>0&&size.height>0))return false;
      target.fillStyle='#0b131c';
      target.fillRect(0,0,W,H);
      const ratio=Math.min(W/size.width,H/size.height);
      target.drawImage(source,(W-size.width*ratio)/2,(H-size.height*ratio)/2,
        size.width*ratio,size.height*ratio);
      return true;
    }
    function stopVideo(){
      video.pause();
      video.srcObject=null;
      video.removeAttribute('src');
      video.load();
      if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
      if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
      el('aero-play').hidden=true;
      el('aero-stop-camera').hidden=true;
    }
    function setPhoto(source){
      stopVideo();
      if(!drawFitted(sc,source)){notify('Não foi possível ler esta imagem.');return;}
      mode='photo';
      notify('Foto carregada! O vento já está passando. Arraste no ciclista para aproximar a área de desvio.');
      render();
    }
    function airPath(){
      if(!ac||!playing)return;
      ac.globalCompositeOperation='source-over';ac.globalAlpha=1;
      ac.clearRect(0,0,W,H);
      const amount=strength();
      ac.lineWidth=1.25;
      ac.strokeStyle='#9bdfff';
      ac.globalAlpha=.78;
      ac.setLineDash([8+amount,16]);
      ac.lineDashOffset=-phase*direction;
      for(let y=15;y<H;y+=23){
        ac.beginPath();
        for(let x=-12;x<=W+12;x+=8){
          const shifted=wavePosition(x,y,ellipse,phase,amount,direction);
          if(x===-12)ac.moveTo(x,shifted);else ac.lineTo(x,shifted);
        }
        ac.stroke();
      }
      ac.setLineDash([]);
      // Pequenas partículas deixam o movimento evidente mesmo em foto parada.
      ac.globalAlpha=.8;
      for(let i=0;i<84;i++){
        const travel=(phase*(2+amount*.7)+i*71+i*i*9)%(W+80)-40;
        const x=direction===1?travel:W-travel;
        const y=(i*43+19)%(H-24)+12;
        const shifted=wavePosition(x,y,ellipse,phase,amount,direction);
        ac.beginPath();ac.arc(x,shifted,i%5===0?2.1:1.15,0,Math.PI*2);
        ac.fillStyle=i%3===0?'#c9f5ff':'#6bcaff';ac.fill();
      }
      // As linhas contornam apenas a região visual indicada pelo usuário.
      ac.globalCompositeOperation='destination-out';
      ac.globalAlpha=1;
      ac.beginPath();
      ac.ellipse(ellipse.cx,ellipse.cy,ellipse.rx,ellipse.ry,0,0,Math.PI*2);
      ac.fill();
      ac.globalCompositeOperation='source-over';
      ac.globalAlpha=1;
    }
    function drawWake(){
      const amount=strength();
      ctx.save();
      for(let j=0;j<9;j++){
        const origin=ellipse.cx+direction*(ellipse.rx*.86);
        const lane=(j-4)*ellipse.ry*.12;
        ctx.beginPath();
        for(let t=0;t<450;t+=7){
          const x=origin+direction*t;
          if(x<-20||x>W+20)break;
          const decay=Math.exp(-t/(ellipse.rx*2.0+70));
          const y=ellipse.cy+lane+
            Math.sin(t*.043-phase*.095+j*.6)*ellipse.ry*.16*decay*
              (amount/3);
          if(t===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=j%3===0?'rgba(194,242,255,.44)':'rgba(85,181,229,.24)';
        ctx.lineWidth=j%3===0?1.7:1.1;
        ctx.stroke();
      }
      ctx.restore();
    }
    function render(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#0c141f';ctx.fillRect(0,0,W,H);
      if(mode==='photo')ctx.drawImage(still,0,0);
      else if(['video','camera'].includes(mode)&&video.readyState>=2&&video.videoWidth)
        drawFitted(ctx,video);
      else{
        const glow=ctx.createRadialGradient(W*.45,H*.47,8,W*.45,H*.47,700);
        glow.addColorStop(0,'#243a4b');glow.addColorStop(1,'#09131c');
        ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#f3f5f5';ctx.textAlign='center';ctx.font='bold 29px system-ui';
        ctx.fillText('PAIVA AERO',W/2,H/2-38);
        ctx.fillStyle='#bdcedc';ctx.font='17px system-ui';
        ctx.fillText('Abra uma foto ou vídeo para começar',W/2,H/2+2);
        ctx.textAlign='left';
      }
      // Brisa leve permanente não depende de fundo verde nem segmentação.
      airPath();ctx.drawImage(air,0,0);
      drawWake();
      ctx.save();ctx.strokeStyle=dragging?'#ffe173':'rgba(250,222,108,.36)';
      ctx.setLineDash([7,9]);ctx.lineWidth=dragging?3:1.4;
      ctx.beginPath();ctx.ellipse(ellipse.cx,ellipse.cy,ellipse.rx,ellipse.ry,0,0,Math.PI*2);
      ctx.stroke();ctx.restore();
      ctx.fillStyle='rgba(4,11,17,.75)';ctx.fillRect(10,10,330,36);
      ctx.fillStyle='#ffe05e';ctx.font='bold 18px system-ui';
      ctx.fillText('PAIVA AERO  ·  ONDA VISUAL',20,34);
      ctx.fillStyle='rgba(4,11,17,.76)';ctx.fillRect(10,H-38,W-20,27);
      ctx.fillStyle='#deedf7';ctx.font='12px system-ui';
      ctx.fillText('VENTO ILUSTRATIVO  ·  NÃO MEDE ARRASTO, CdA OU WATTS',20,H-20);
    }
    function tick(now){
      if(now-lastTime>32){
        if(visible&&!document.hidden){
          if(playing)phase=(phase+.65+strength()*.27)%8000;
          render();
        }
        lastTime=now;
      }
      requestAnimationFrame(tick);
    }
    if(typeof IntersectionObserver==='function'){
      const obs=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);});
      obs.observe(section);
    }
    function canvasCoords(event){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return null;
      return {x:clamp((event.clientX-rect.left)*W/rect.width,0,W),
        y:clamp((event.clientY-rect.top)*H/rect.height,0,H)};
    }
    canvas.addEventListener('pointerdown',event=>{
      const p=canvasCoords(event);
      if(!p)return;
      pointerStart=p;dragging=true;
      try{canvas.setPointerCapture(event.pointerId);}catch(error){}
    });
    canvas.addEventListener('pointermove',event=>{
      if(!dragging||!pointerStart)return;
      const p=canvasCoords(event);
      if(!p)return;
      const rx=Math.abs(p.x-pointerStart.x)/2,ry=Math.abs(p.y-pointerStart.y)/2;
      if(rx<12||ry<12)return;
      ellipse={cx:(p.x+pointerStart.x)/2,cy:(p.y+pointerStart.y)/2,
        rx:clamp(rx,35,W*.48),ry:clamp(ry,28,H*.48)};
      render();
    });
    function finishDrag(){
      if(!dragging)return;
      dragging=false;pointerStart=null;
      notify('Área visual ajustada. As ondas agora desviam pela região marcada. Você pode arrastar novamente.');
      render();
    }
    canvas.addEventListener('pointerup',finishDrag);
    canvas.addEventListener('pointercancel',finishDrag);

    el('aero-photo').addEventListener('change',event=>{
      const input=event.target,file=input.files?.[0];
      if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>25*1024*1024){
        notify('Escolha JPG, PNG ou WebP de até 25 MB.');input.value='';return;
      }
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{setPhoto(image);URL.revokeObjectURL(url);input.value='';};
      image.onerror=()=>{URL.revokeObjectURL(url);input.value='';notify('Não foi possível abrir esta foto.');};
      image.src=url;
    });
    el('aero-video-file').addEventListener('change',async event=>{
      const input=event.target,file=input.files?.[0];
      if(!file)return;
      stopVideo();videoURL=URL.createObjectURL(file);
      video.src=videoURL;video.loop=true;mode='video';
      el('aero-play').hidden=false;el('aero-stop-camera').hidden=true;
      try{
        await video.play();el('aero-play').textContent='⏸ Pausar vídeo';
        notify('Vídeo carregado. O vento passa sobre o atleta enquanto ele pedala.');
      }catch(error){notify('O navegador não reproduziu este vídeo. Para Windows, tente MP4 H.264.');}
      input.value='';
    });
    el('aero-webcam').addEventListener('click',async()=>{
      if(!navigator.mediaDevices?.getUserMedia){
        notify('Webcam exige HTTPS e permissão do navegador.');return;
      }
      stopVideo();
      try{
        stream=await navigator.mediaDevices.getUserMedia({
          video:{width:{ideal:1280},height:{ideal:720}},audio:false});
        video.srcObject=stream;mode='camera';await video.play();
        el('aero-stop-camera').hidden=false;el('aero-play').hidden=true;
        notify('Webcam ligada. Arraste sobre o atleta para ajustar a onda visual.');
      }catch(error){
        stopVideo();mode='demo';
        notify('Não foi possível ligar a webcam: '+(error?.name||'acesso não permitido')+'.');
      }
    });
    el('aero-stop-camera').addEventListener('click',()=>{
      stopVideo();mode='demo';notify('Webcam desligada.');render();
    });
    el('aero-capture').addEventListener('click',()=>{
      const sourceVideo=document.getElementById('paiva-2d-video');
      const sourceCanvas=document.getElementById('paiva-2d-canvas');
      if(sourceVideo&&!sourceVideo.hidden&&sourceVideo.readyState>=2&&sourceVideo.videoWidth){
        setPhoto(sourceVideo);
      }else if(globalThis.PAIVA_ATHLETE_2D?.hasImage?.()&&sourceCanvas){
        setPhoto(sourceCanvas);
      }else notify('Primeiro abra uma foto ou vídeo no módulo 2D, ou escolha Abrir foto aqui.');
    });
    el('aero-wind').addEventListener('click',()=>{
      playing=!playing;
      el('aero-wind').textContent=playing?'⏸ Pausar vento':'▶ Soltar vento';
      notify(playing?'Onda de vento ativada.':'Onda pausada para observar a imagem.');
      render();
    });
    el('aero-direction').addEventListener('click',()=>{
      direction*=-1;
      el('aero-direction').textContent=direction===1?
        '→ Vento para a direita':'← Vento para a esquerda';
      render();
    });
    el('aero-strength').addEventListener('input',render);
    el('aero-play').addEventListener('click',async()=>{
      if(mode!=='video')return;
      if(video.paused){
        try{await video.play();el('aero-play').textContent='⏸ Pausar vídeo';}
        catch(error){notify('Não foi possível reproduzir este vídeo.');}
      }else{video.pause();el('aero-play').textContent='▶ Reproduzir vídeo';}
    });
    el('aero-save').addEventListener('click',()=>{
      render();
      canvas.toBlob(blob=>{
        if(!blob){notify('Não foi possível salvar a imagem.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='PAIVA_AERO_Onda_Visual.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        notify('Imagem com a onda de vento salva em PNG.');
      },'image/png');
    });
    window.addEventListener('pagehide',stopVideo,{once:true});
    render();requestAnimationFrame(tick);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
