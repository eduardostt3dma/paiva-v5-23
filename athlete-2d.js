/* PAIVA — análise angular 2D em fotografia ou quadro de vídeo, 100% local.
   Marcação MANUAL de três pontos (ângulo) ou dois (linha de referência).
   Não detecta pontos anatômicos nem representa movimento em 3D. */
(() => {
  'use strict';

  function angleDegrees(a, vertex, c) {
    const ux = a.x - vertex.x, uy = a.y - vertex.y;
    const vx = c.x - vertex.x, vy = c.y - vertex.y;
    const uLength = Math.hypot(ux,uy), vLength = Math.hypot(vx,vy);
    if (uLength < 8 || vLength < 8) return null;
    return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(uLength*vLength)))) * 180 / Math.PI;
  }

  function initialize() {
    if (document.getElementById('paiva-athlete-2d')) return;
    const target = document.querySelector('main > footer');
    if (!target) return;

    const section = document.createElement('section');
    section.className = 'card paiva-athlete-2d';
    section.id = 'paiva-athlete-2d';
    section.innerHTML = `
      <div class="paiva-2d-title">
        <div><span>FERRAMENTA COMPLEMENTAR</span><h2>ANÁLISE ANGULAR 2D</h2></div>
        <button type="button" id="paiva-2d-help" aria-label="Como medir ângulos e linhas" aria-expanded="false">?</button>
      </div>
      <div id="paiva-2d-explain" class="paiva-2d-explain" hidden>
        <p><strong>Ângulo:</strong> clique no vértice e arraste o mouse: duas hastes são criadas de uma vez. No modo “Ajustar pontos”, arraste as extremidades para alinhar ao atleta. O aplicativo exibe o ângulo interno, de 0° a 180°.</p>
        <p><strong>Linha:</strong> clique e arraste de uma extremidade até a outra. Depois, “Ajustar pontos” permite puxar as pontas ou mover a reta inteira pelo centro. Sem calibração métrica, não é uma régua em milímetros.</p>
        <p><strong>Alinhamento:</strong> selecione uma linha tocando nela e use Horizontal / Vertical; mantenha Shift pressionado ao desenhar para limitar a inclinação a passos de 45°.</p>
        <p><strong>Zoom:</strong> aproxime até 400% pelo controle lateral ou com Ctrl + roda do mouse sobre a foto. Role dentro da foto ampliada para localizar os pontos.</p>
        <p><strong>Espessura:</strong> ajuste as linhas de 1 a 8 px no painel lateral. A mudança aparece imediatamente nas linhas existentes e nas novas marcações.</p>
        <p><strong>Webcam:</strong> no computador, libere o acesso à câmera para visualizar e filmar o pedal. Você pode gravar até 2 minutos, salvar o vídeo no aparelho, pausá-lo e usar “Capturar quadro” para medir os ângulos de um instante. Os pontos iniciais são sempre marcados manualmente.</p>
        <p><strong>Rastreio beta:</strong> depois de congelar um quadro do vídeo gravado, desenhe e alinhe as marcações. Clique em “Rastrear marcações” para tentar acompanhá-las no vídeo. Essa função experimental acompanha pequenas regiões contrastantes da imagem e interrompe se perder a referência; não reconhece automaticamente as articulações e pode sofrer desvios. Use fitas contrastantes nos pontos, câmera fixa e valide cada ângulo importante antes de usar no bike fit.</p>
        <p><strong>Biomecânica:</strong> no joelho, uma referência possível é trocânter maior → côndilo femoral lateral → maléolo lateral. Escolha sempre a mesma convenção de pontos e o mesmo plano da câmera. A foto mostra uma projeção 2D, não captura rotação, profundidade nem movimento.</p>
        <p>O processamento ocorre neste aparelho. Imagens e vídeos não são transmitidos ao site ou ao GitHub. Salve a imagem marcada e o vídeo antes de fechar ou atualizar o aplicativo. Webcam exige permissão do navegador e conexão segura (HTTPS ou localhost).</p>
      </div>
      <div class="paiva-2d-workspace">
        <div class="paiva-2d-view">
          <div class="paiva-2d-canvas-wrap"><canvas id="paiva-2d-canvas" width="960" height="540" aria-label="Foto ou quadro do vídeo com ângulos e linhas desenhados manualmente"></canvas>
            <video id="paiva-2d-video" playsinline muted hidden aria-label="Webcam ou vídeo gravado para análise 2D"></video>
            <canvas id="paiva-2d-track-overlay" width="480" height="270" hidden aria-label="Visualização do rastreamento experimental sobre o vídeo"></canvas></div>
          <p class="paiva-2d-status" id="paiva-2d-status" role="status" aria-live="polite">Carregue uma foto lateral do atleta ou ligue a webcam.</p>
          <div class="paiva-2d-values" id="paiva-2d-values" aria-live="polite"></div>
        </div>
        <aside class="paiva-2d-sidebar" aria-label="Painel de ferramentas da análise 2D">
          <div class="paiva-2d-sidebar-heading">FERRAMENTAS 2D</div>
          <label class="paiva-2d-file">Foto lateral do atleta · JPG/PNG
            <input type="file" id="paiva-2d-file" accept="image/*" aria-label="Escolher foto do atleta para análise 2D" />
          </label>
          <div class="paiva-2d-tools" role="group" aria-label="Ferramenta de desenho">
            <button type="button" data-2d-tool="angle" aria-pressed="true">ÂNGULO · ARRASTAR</button>
            <button type="button" data-2d-tool="line" aria-pressed="false">LINHA · ARRASTAR</button>
            <button type="button" data-2d-tool="edit" aria-pressed="false">AJUSTAR PONTOS</button>
          </div>
          <div class="paiva-2d-align" role="group" aria-label="Alinhar linha selecionada">
            <button type="button" id="paiva-2d-align-horizontal">↔ Horizontal</button>
            <button type="button" id="paiva-2d-align-vertical">↕ Vertical</button>
          </div>
          <div class="paiva-2d-zoom" role="group" aria-label="Zoom da fotografia">
            <label for="paiva-2d-zoom">Zoom <output id="paiva-2d-zoom-value">100%</output></label>
            <input id="paiva-2d-zoom" type="range" min="100" max="400" step="25" value="100" />
            <button type="button" id="paiva-2d-zoom-out">−</button>
            <button type="button" id="paiva-2d-zoom-reset">100%</button>
            <button type="button" id="paiva-2d-zoom-in">+</button>
          </div>
          <label class="paiva-2d-width" for="paiva-2d-width">Espessura das linhas <output id="paiva-2d-width-value" for="paiva-2d-width">3 px</output>
            <input id="paiva-2d-width" type="range" min="1" max="8" step="1" value="3" aria-label="Espessura das linhas, de um a oito pixels" />
          </label>
          <div class="paiva-2d-actions">
            <button type="button" id="paiva-2d-undo">Desfazer</button>
            <button type="button" id="paiva-2d-clear">Limpar linhas</button>
            <button type="button" id="paiva-2d-save" class="paiva-2d-save">Salvar imagem marcada</button>
          </div>
          <div class="paiva-2d-webcam">
            <div class="paiva-2d-sidebar-heading">VÍDEO · WEBCAM</div>
            <button type="button" id="paiva-2d-camera-start">Ligar webcam</button>
            <button type="button" id="paiva-2d-record" disabled>Iniciar gravação</button>
            <button type="button" id="paiva-2d-stop-record" disabled>Parar gravação</button>
            <button type="button" id="paiva-2d-capture" disabled>Capturar quadro</button>
            <button type="button" id="paiva-2d-back-video" hidden>Voltar ao vídeo</button>
            <button type="button" id="paiva-2d-track-start" disabled>Rastrear marcações · beta</button>
            <button type="button" id="paiva-2d-track-stop" disabled>Parar rastreio</button>
            <button type="button" id="paiva-2d-camera-stop" disabled>Desligar webcam</button>
            <a id="paiva-2d-video-download" hidden>Baixar vídeo gravado</a>
            <small id="paiva-2d-camera-info">Sem envio para a internet. Webcam requer permissão.</small>
          </div>
        </aside>
      </div>
      <p class="paiva-2d-disclaimer">Medição angular manual sobre fotografia estática, para triagem. Confirme pontos anatômicos, plano da câmera e valores com sua avaliação dinâmica/STT/Retül.</p>`;
    target.before(section);

    const byId = key => document.getElementById('paiva-2d-' + key);
    const canvas = byId('canvas');
    const video = byId('video');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      byId('status').textContent = 'Este navegador não permite desenhar nesta ferramenta 2D.';
      return;
    }
    const original = document.createElement('canvas');
    const originalCtx = original.getContext('2d');
    if (!originalCtx) return;

    let photoLoaded = false;
    let tool = 'angle';
    let draft = [];
    let annotations = [];
    let activeDrag = null;
    let activeDraw = null;
    let selectedIndex = -1;
    let lineWidth = 3;
    const colors = {angle:'#e7cf86',line:'#8bd6e4'};
    const message = text => {byId('status').textContent = text;};
    const format = value => value.toFixed(1).replace('.',',');

    function pointAt(event) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const x = (event.clientX - rect.left) * canvas.width / rect.width;
      const y = (event.clientY - rect.top) * canvas.height / rect.height;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {x:Math.max(0,Math.min(canvas.width,x)),y:Math.max(0,Math.min(canvas.height,y))};
    }

    const constrain = p => ({x:Math.max(0,Math.min(canvas.width,p.x)),
      y:Math.max(0,Math.min(canvas.height,p.y))});
    function snapAngle(anchor,point,shiftKey) {
      if (!shiftKey) return point;
      const dx=point.x-anchor.x,dy=point.y-anchor.y;
      const length=Math.hypot(dx,dy);
      const direction=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);
      return constrain({x:anchor.x+Math.cos(direction)*length,y:anchor.y+Math.sin(direction)*length});
    }
    function draftFromDrag(kind,anchor,pointer,shiftKey) {
      const end=snapAngle(anchor,pointer,shiftKey);
      if (kind==='line') return [anchor,end];
      const dx=end.x-anchor.x,dy=end.y-anchor.y;
      // Uma única ação abre um ângulo reto editável; as hastes continuam livres.
      return [end,anchor,constrain({x:anchor.x-dy,y:anchor.y+dx})];
    }
    function segmentDistance(p,a,b) {
      const dx=b.x-a.x,dy=b.y-a.y;
      const norm=dx*dx+dy*dy;
      if (!norm) return Math.hypot(p.x-a.x,p.y-a.y);
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/norm));
      return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
    }

    function mark(p,color) {
      const radius = Math.max(3,Math.min(10,lineWidth+2));
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle = '#0b1a24';ctx.fill();
      ctx.lineWidth = Math.max(1,lineWidth/2);ctx.strokeStyle = color;ctx.stroke();
    }

    function tag(x,y,text,color) {
      const fontSize = Math.max(15,Math.min(34,canvas.width/33));
      ctx.font = `750 ${fontSize}px system-ui,sans-serif`;
      const padding = 7;
      const w = ctx.measureText(text).width + padding*2;
      const h = fontSize+padding*2;
      const tx = Math.max(4,Math.min(canvas.width-w-4,x+11));
      const ty = Math.max(h+4,Math.min(canvas.height-4,y-11));
      ctx.fillStyle = 'rgba(8,20,29,.92)';
      ctx.fillRect(tx,ty-h,w,h);
      ctx.strokeStyle = color;ctx.lineWidth=2;ctx.strokeRect(tx,ty-h,w,h);
      ctx.fillStyle = '#f4f8fa';ctx.textBaseline='middle';ctx.fillText(text,tx+padding,ty-h/2);
    }

    function drawAnnotation(item,index,partial=false) {
      const pts = item.points;
      const color = colors[item.kind];
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle=color;
      ctx.beginPath();
      if (pts.length) ctx.moveTo(pts[0].x,pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.stroke();
      for (const p of pts) mark(p,color);
      if (!partial && item.kind === 'angle' && pts.length === 3) {
        const a = angleDegrees(pts[0],pts[1],pts[2]);
        if (a !== null) tag(pts[1].x,pts[1].y,`A${index+1}  ${format(a)}°`,color);
      }
      if (!partial && item.kind === 'line' && pts.length === 2) {
        tag((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,`L${index+1}`,color);
      }
    }

    function updateValues() {
      const values = [];
      annotations.forEach((item,index) => {
        if (item.kind === 'angle') {
          const a = angleDegrees(item.points[0],item.points[1],item.points[2]);
          values.push(`Ângulo ${index+1}: ${a === null ? 'rever pontos' : format(a)+'°'}`);
        } else values.push(`Linha ${index+1}`);
      });
      byId('values').textContent = values.join('  ·  ');
    }

    function render() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (photoLoaded) ctx.drawImage(original,0,0,canvas.width,canvas.height);
      else {
        ctx.fillStyle='#15212b';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#b6c8d4';ctx.textAlign='center';
        ctx.font=`${Math.max(18,canvas.width/36)}px system-ui,sans-serif`;
        ctx.fillText('Escolha a fotografia do atleta',canvas.width/2,canvas.height/2);
        ctx.textAlign='start';
      }
      annotations.forEach((item,index) => drawAnnotation(item,index));
      if (draft.length) drawAnnotation({kind:tool,points:draft},annotations.length,true);
      updateValues();
    }

    function selectTool(next) {
      tool=next;draft=[];activeDrag=null;activeDraw=null;
      for (const button of section.querySelectorAll('[data-2d-tool]'))
        button.setAttribute('aria-pressed',String(button.getAttribute('data-2d-tool')===tool));
      render();
      if (!photoLoaded) return;
      message(tool==='angle' ? 'Ângulo: clique no vértice e ARRASTE para abrir duas hastes; depois ajuste cada ponta.' :
        tool==='line' ? 'Linha: clique e ARRASTE do início ao fim. Use Shift para alinhar a cada 45°.' :
        'Ajustar: arraste uma ponta ou o corpo da linha/ângulo para reposicionar.');
    }

    function findPoint(point,event) {
      const rect = canvas.getBoundingClientRect();
      const tolerance = Math.max(10,18 * canvas.width / rect.width);
      for (let i=annotations.length-1;i>=0;i--) {
        for (let j=annotations[i].points.length-1;j>=0;j--) {
          const p=annotations[i].points[j];
          if (Math.hypot(p.x-point.x,p.y-point.y)<=tolerance)
            return {item:i,index:j,pointer:event.pointerId};
        }
      }
      return null;
    }

    function findSegment(point,event) {
      const rect=canvas.getBoundingClientRect();
      const tolerance=Math.max(8,12*canvas.width/rect.width);
      for (let i=annotations.length-1;i>=0;i--) {
        const pts=annotations[i].points;
        const segments=annotations[i].kind==='angle' ? [[0,1],[1,2]] : [[0,1]];
        if (segments.some(([a,b])=>segmentDistance(point,pts[a],pts[b])<=tolerance))
          return {item:i,index:-1,pointer:event.pointerId,origin:point,
            original:pts.map(p=>({...p}))};
      }
      return null;
    }

    for (const button of section.querySelectorAll('[data-2d-tool]'))
      button.addEventListener('click',() => selectTool(button.getAttribute('data-2d-tool')));
    byId('width').addEventListener('input', () => {
      lineWidth = Math.max(1,Math.min(8,Number(byId('width').value) || 3));
      byId('width-value').textContent = `${lineWidth} px`;
      render();
    });
    function updateZoom(value) {
      const old=Number(byId('zoom').value);
      const next=Math.max(100,Math.min(400,Math.round(value/25)*25));
      byId('zoom').value=String(next);
      byId('zoom-value').textContent=`${next}%`;
      canvas.style.width=`${next}%`;
      const viewport=canvas.parentElement;
      if (viewport && next!==old) {
        const shift=(next-old)/200;
        viewport.scrollLeft+=viewport.clientWidth*shift;
        viewport.scrollTop+=viewport.clientHeight*shift;
      }
    }
    byId('zoom').addEventListener('input',()=>updateZoom(Number(byId('zoom').value)));
    byId('zoom-in').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)+25));
    byId('zoom-out').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)-25));
    byId('zoom-reset').addEventListener('click',()=>updateZoom(100));
    canvas.addEventListener('wheel',event=> {
      if (!event.ctrlKey) return;
      event.preventDefault();
      updateZoom(Number(byId('zoom').value)+(event.deltaY<0?25:-25));
    },{passive:false});
    function alignLine(vertical) {
      let index=selectedIndex;
      if (annotations[index]?.kind!=='line') {
        index=-1;
        for (let i=annotations.length-1;i>=0;i--) {
          if (annotations[i].kind==='line') {index=i;break;}
        }
      }
      if (index<0) {message('Desenhe primeiro uma linha para alinhar.');return;}
      const pts=annotations[index].points;
      const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      const length=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)/2;
      if (vertical) {
        pts[0]=constrain({x:center.x,y:center.y-length});
        pts[1]=constrain({x:center.x,y:center.y+length});
      } else {
        pts[0]=constrain({x:center.x-length,y:center.y});
        pts[1]=constrain({x:center.x+length,y:center.y});
      }
      selectedIndex=index;
      selectTool('edit');
      message(`Linha ${index+1} alinhada ${vertical?'verticalmente':'horizontalmente'}. Arraste as pontas para refinar.`);
    }
    byId('align-horizontal').addEventListener('click',()=>alignLine(false));
    byId('align-vertical').addEventListener('click',()=>alignLine(true));
    byId('help').addEventListener('click',() => {
      const box=byId('explain');const open=box.hidden;
      box.hidden=!open;byId('help').setAttribute('aria-expanded',String(open));
    });

    // A webcam serve como fonte de quadros. Um rastreio experimental local pode
    // seguir pontos contrastantes do vídeo gravado; nunca é medição validada.
    let cameraStream = null;
    let recorder = null;
    let recordedChunks = [];
    let recordingTimer = null;
    let recordedUrl = null;
    let lastFrameFromVideo = false;
    let motionTracker = null;
    let trackingActive = false;
    const trackOverlay=byId('track-overlay');
    const trackCtx=trackOverlay.getContext('2d');
    const maxRecordingMs = 120000;

    function showVideo(enabled) {
      video.hidden = !enabled;
      canvas.hidden = enabled;
      for (const button of section.querySelectorAll('[data-2d-tool]')) button.disabled=enabled;
      for (const key of ['undo','clear','save','width']) byId(key).disabled=enabled;
    }

    function updateCameraControls() {
      const live = !!cameraStream;
      const recording = recorder?.state === 'recording';
      const hasPlayback = !!recordedUrl && video.getAttribute('src')===recordedUrl;
      byId('camera-start').disabled = live || recording;
      byId('camera-stop').disabled = !live;
      byId('record').disabled = !live || recording || typeof MediaRecorder === 'undefined';
      byId('stop-record').disabled = !recording;
      byId('capture').disabled = recording || (!live && !hasPlayback);
      byId('track-start').disabled = !hasPlayback || !lastFrameFromVideo || !annotations.length || trackingActive || recording;
      byId('track-stop').disabled = !trackingActive;
    }

    function stopTracking(clear=true) {
      motionTracker?.stop();motionTracker=null;trackingActive=false;
      if (clear) trackOverlay.hidden=true;
      updateCameraControls();
    }

    function paintTracked(points,w,h,time) {
      if (!trackCtx) return;
      trackOverlay.width=w;trackOverlay.height=h;
      trackCtx.clearRect(0,0,w,h);
      trackCtx.lineWidth=2;trackCtx.lineCap='round';trackCtx.lineJoin='round';
      const readings=[];
      points.forEach((item,index)=> {
        const pts=item.points;
        const color=item.kind==='angle'?'#ffe9a8':'#a6eeff';
        trackCtx.strokeStyle=color;trackCtx.fillStyle=color;
        trackCtx.beginPath();trackCtx.moveTo(pts[0].x,pts[0].y);
        for(let j=1;j<pts.length;j++)trackCtx.lineTo(pts[j].x,pts[j].y);
        trackCtx.stroke();
        for(const p of pts){
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,4,0,Math.PI*2);
          trackCtx.fill();
        }
        if(item.kind==='angle') {
          const angle=angleDegrees(pts[0],pts[1],pts[2]);
          if(angle!==null) {
            readings.push(`A${index+1}: ${format(angle)}°`);
            trackCtx.font='750 16px system-ui,sans-serif';
            trackCtx.fillText(`${format(angle)}°`,Math.min(w-70,pts[1].x+8),Math.max(18,pts[1].y-8));
          }
        }
      });
      byId('values').textContent=`Rastreio experimental ${time.toFixed(1).replace('.',',')} s · ${readings.join('  |  ') || 'linhas em movimento'}`;
    }

    async function startTracking() {
      if (trackingActive || !lastFrameFromVideo || !annotations.length || !recordedUrl) return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if (!motion?.create || !trackCtx) {message('Módulo de rastreio indisponível. Atualize todos os arquivos do aplicativo.');return;}
      const currentTime=video.currentTime;
      motionTracker=motion.create({video,annotations:annotations.map(item=>({
        kind:item.kind,points:item.points.map(p=>({...p}))})),
        sourceWidth:canvas.width,sourceHeight:canvas.height,
        onPoints:(points,w,h,t)=>paintTracked(points,w,h,t),
        onLost:reason=>{
          stopTracking();video.pause();
          message(`Rastreio interrompido em ${video.currentTime.toFixed(1).replace('.',',')} s. ${reason} Não use esse ângulo sem conferir os marcadores.`);
        },
        onDone:()=>{stopTracking();message('Fim do vídeo. Rastreio encerrado; confira os ângulos antes de usar.');}
      });
      showVideo(true);trackOverlay.hidden=false;
      trackingActive=true;updateCameraControls();
      const started=await motionTracker.start();
      if (!started) {stopTracking();showVideo(false);return;}
      message(`Rastreio experimental iniciado em ${currentTime.toFixed(1).replace('.',',')} s. Use marcadores contrastantes e interrompa se um ponto se afastar da articulação.`);
    }
    function stopTrackingPlayback() {
      if(!trackingActive)return;
      stopTracking();video.pause();
      message('Rastreio encerrado. Pause noutro instante e capture um novo quadro para corrigir os pontos.');
    }
    byId('track-start').addEventListener('click',startTracking);
    byId('track-stop').addEventListener('click',stopTrackingPlayback);

    function stopStream() {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
    }

    function setFrame(source, naturalWidth, naturalHeight) {
      if (!naturalWidth || !naturalHeight) return false;
      const scale = Math.min(1,1400/Math.max(naturalWidth,naturalHeight));
      const width = Math.max(1,Math.round(naturalWidth*scale));
      const height = Math.max(1,Math.round(naturalHeight*scale));
      original.width = canvas.width = width;
      original.height = canvas.height = height;
      originalCtx.drawImage(source,0,0,width,height);
      photoLoaded = true;
      annotations=[];draft=[];activeDrag=null;activeDraw=null;selectedIndex=-1;
      render();showVideo(false);
      return true;
    }

    function videoCanCapture() {
      return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    }

    async function startCamera() {
      if (cameraStream) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        message('Webcam indisponível. Abra o site por HTTPS no Chrome ou Edge do Windows e confira a permissão de câmera.');
        return;
      }
      byId('camera-start').disabled = true;
      try {
        stopTracking();lastFrameFromVideo=false;
        const stream = await navigator.mediaDevices.getUserMedia({
          video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}, audio:false
        });
        cameraStream = stream;
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.controls = false;video.muted = true;video.autoplay = true;
        showVideo(true);byId('back-video').hidden=true;
        try {await video.play();} catch (_) { /* alguns navegadores exigem outro clique */ }
        byId('camera-info').textContent = 'Webcam ligada. Apenas vídeo local, sem áudio nem envio à internet.';
        message('Webcam ligada. Grave um trecho do pedal ou use “Capturar quadro” para medir os ângulos.');
      } catch (error) {
        stopStream();
        const denied = ['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name);
        message(denied ? 'O navegador bloqueou a webcam. Autorize a câmera nas permissões do site e tente novamente.'
          : 'Não foi possível abrir a webcam. Verifique a conexão, o uso por outro programa e as permissões do Windows.');
      }
      updateCameraControls();
    }

    function startRecording() {
      if (!cameraStream || recorder?.state==='recording') return;
      if (typeof MediaRecorder === 'undefined') {
        message('Este navegador não permite gravar vídeo. Você ainda pode capturar um quadro da webcam.');return;
      }
      const supported = ['video/webm;codecs=vp8','video/webm','video/mp4']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      try {
        recorder = new MediaRecorder(cameraStream,supported
          ? {mimeType:supported,videoBitsPerSecond:1500000}
          : {videoBitsPerSecond:1500000});
      } catch (_) {message('A gravação não é compatível com esta webcam/navegador. Use “Capturar quadro”.');return;}
      const thisRecorder = recorder;
      recordedChunks=[];
      thisRecorder.ondataavailable = event => {if (event.data?.size) recordedChunks.push(event.data);};
      thisRecorder.onerror = () => {message('Falha durante a gravação. Tente um trecho mais curto.');};
      thisRecorder.onstop = () => {
        if (recordingTimer) {clearTimeout(recordingTimer);recordingTimer=null;}
        const mime = thisRecorder.mimeType || 'video/webm';
        const movie = new Blob(recordedChunks,{type:mime});
        recordedChunks=[];
        stopStream();
        if (!movie.size) {
          message('Não foi possível salvar a gravação. Tente novamente.');
          showVideo(false);updateCameraControls();return;
        }
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        recordedUrl = URL.createObjectURL(movie);
        const download = byId('video-download');
        download.href=recordedUrl;
        download.download=`PAIVA_Filmagem_2D.${mime.includes('mp4')?'mp4':'webm'}`;
        download.hidden=false;
        video.pause();video.srcObject=null;video.src=recordedUrl;
        lastFrameFromVideo=false;
        video.controls=true;video.muted=true;video.autoplay=false;video.load();
        showVideo(true);byId('back-video').hidden=true;
        byId('camera-info').textContent = 'Vídeo gravado somente neste aparelho. Faça o download antes de sair.';
        message('Gravação concluída. Use a barra do vídeo para pausar no instante desejado e clique em “Capturar quadro”. Baixe também o arquivo do vídeo.');
        updateCameraControls();
      };
      try {thisRecorder.start(250);} catch (_) {
        recorder=null;message('Não foi possível iniciar a gravação. Tente novamente.');return;
      }
      recordingTimer=setTimeout(() => {
        if (thisRecorder.state==='recording') {
          thisRecorder.stop();
          message('Limite de 2 minutos atingido. Finalizando o vídeo...');
        }
      },maxRecordingMs);
      byId('camera-info').textContent='Gravando vídeo local · máximo de 2 minutos. Sem áudio.';
      message('Gravação iniciada. Pedale normalmente e depois toque em “Parar gravação”.');
      updateCameraControls();
    }

    function stopRecording() {
      if (recorder?.state==='recording') {
        byId('stop-record').disabled=true;
        recorder.stop();message('Finalizando vídeo. Aguarde alguns instantes...');
      }
    }

    function stopCamera() {
      if (recorder?.state==='recording') {stopRecording();return;}
      stopStream();
      video.pause();
      if (video.srcObject) video.srcObject=null;
      showVideo(false);byId('back-video').hidden=true;
      byId('camera-info').textContent='Webcam desligada. Vídeos e imagens não são enviados à internet.';
      message('Webcam desligada. A imagem capturada, se houver, foi preservada.');
      updateCameraControls();
    }

    function captureVideoFrame() {
      if (recorder?.state==='recording') {
        message('Pare a gravação antes de capturar um quadro para análise.');return;
      }
      if (trackingActive) stopTracking();
      if (!videoCanCapture() || !setFrame(video,video.videoWidth,video.videoHeight)) {
        message('Aguarde o vídeo carregar. Depois pause no quadro desejado e tente novamente.');return;
      }
      video.pause();
      lastFrameFromVideo=!cameraStream && !!recordedUrl;
      if (cameraStream) {
        stopStream();video.srcObject=null;
        byId('back-video').hidden=true;
      } else byId('back-video').hidden = !recordedUrl;
      updateCameraControls();
      message('Quadro congelado! Arraste para abrir o ângulo ou traçar a linha; depois ajuste pelas pontas. Salve a imagem marcada ao terminar.');
    }

    byId('camera-start').addEventListener('click',startCamera);
    byId('record').addEventListener('click',startRecording);
    byId('stop-record').addEventListener('click',stopRecording);
    byId('camera-stop').addEventListener('click',stopCamera);
    byId('capture').addEventListener('click',captureVideoFrame);
    byId('back-video').addEventListener('click',() => {
      if (!recordedUrl) return;
      if (trackingActive) stopTracking();
      showVideo(true);byId('back-video').hidden=true;
      message('Vídeo disponível. Pause em outro instante e toque em “Capturar quadro”. Salve suas marcações anteriores antes.');
    });
    window.addEventListener('pagehide',() => {
      stopTracking();
      if (recorder?.state==='recording') recorder.stop();
      stopStream();
      if (recordingTimer) clearTimeout(recordingTimer);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    });
    updateCameraControls();

    byId('file').addEventListener('change',() => {
      const chosen=byId('file').files?.[0];
      if (!chosen) return;
      if (recorder?.state==='recording') {
        message('Pare a gravação antes de carregar outra fotografia.');byId('file').value='';return;
      }
      if (!chosen.type.startsWith('image/') || chosen.size>20*1024*1024) {
        message('Escolha uma imagem compatível de até 20 MB.');return;
      }
      const uri=URL.createObjectURL(chosen);
      const photo=new Image();
      photo.onload=() => {
        stopTracking();lastFrameFromVideo=false;
        stopStream();video.pause();
        if (video.srcObject) video.srcObject=null;
        byId('back-video').hidden=true;
        setFrame(photo,photo.naturalWidth,photo.naturalHeight);
        URL.revokeObjectURL(uri);
        byId('file').value='';updateCameraControls();
        message('Imagem carregada. Escolha Ângulo ou Linha, clique e arraste para desenhar. Ajuste pelas pontas.');
      };
      photo.onerror=() => {URL.revokeObjectURL(uri);message('Não foi possível abrir a foto. Tente JPG ou PNG.');};
      photo.src=uri;
    });

    canvas.addEventListener('pointerdown',event => {
      if (!photoLoaded) {message('Primeiro escolha uma fotografia do atleta.');return;}
      const point=pointAt(event);
      if (!point) return;
      event.preventDefault();
      if (tool==='edit') {
        activeDrag=findPoint(point,event) || findSegment(point,event);
        if (activeDrag) {
          selectedIndex=activeDrag.item;
          canvas.setPointerCapture?.(event.pointerId);
        } else message('Clique sobre uma ponta ou sobre o corpo da linha para arrastá-la.');
        return;
      }
      activeDraw={pointer:event.pointerId,kind:tool,start:point};
      draft=draftFromDrag(tool,point,point,false);
      canvas.setPointerCapture?.(event.pointerId);
      render();
    });
    canvas.addEventListener('pointermove',event => {
      const p=pointAt(event);if(!p)return;
      if (activeDraw?.pointer===event.pointerId) {
        event.preventDefault();
        draft=draftFromDrag(activeDraw.kind,activeDraw.start,p,event.shiftKey);
        render();return;
      }
      if (!activeDrag || event.pointerId!==activeDrag.pointer)return;
      event.preventDefault();
      if (activeDrag.index>=0) annotations[activeDrag.item].points[activeDrag.index]=p;
      else {
        const dx=p.x-activeDrag.origin.x,dy=p.y-activeDrag.origin.y;
        annotations[activeDrag.item].points=activeDrag.original.map(q=>constrain({x:q.x+dx,y:q.y+dy}));
      }
      render();
    });
    const stopDrag=event => {
      if (activeDraw?.pointer===event.pointerId) {
        const p=pointAt(event) || activeDraw.start;
        const travel=Math.hypot(p.x-activeDraw.start.x,p.y-activeDraw.start.y);
        if (event.type==='pointercancel' || travel<8) {
          draft=[];render();
          message('Arraste por pelo menos alguns pixels para desenhar. Clique e mantenha pressionado enquanto puxa.');
        } else {
          const points=draftFromDrag(activeDraw.kind,activeDraw.start,p,event.shiftKey);
          annotations.push({kind:activeDraw.kind,points});
          selectedIndex=annotations.length-1;
          draft=[];selectTool('edit');
          updateCameraControls();
          message('Objeto criado! Arraste as pontas para esticar/girar ou arraste o traço para movê-lo inteiro.');
        }
        activeDraw=null;
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (activeDrag && activeDrag.pointer===event.pointerId) {
        activeDrag=null;
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        message('Marcador ajustado. Confira o ângulo atualizado na imagem.');
      }
    };
    canvas.addEventListener('pointerup',stopDrag);
    canvas.addEventListener('pointercancel',stopDrag);
    byId('undo').addEventListener('click',() => {
      if (draft.length) draft=[];else annotations.pop();
      selectedIndex=annotations.length-1;
      updateCameraControls();
      render();message('Último ponto ou anotação removido.');
    });
    byId('clear').addEventListener('click',() => {
      if (annotations.length && !window.confirm('Remover todas as linhas e ângulos desta foto?'))return;
      annotations=[];draft=[];selectedIndex=-1;render();message('Marcações removidas. A fotografia foi preservada.');
      updateCameraControls();
    });
    byId('save').addEventListener('click',() => {
      if (!photoLoaded) {message('Carregue uma fotografia antes de salvar.');return;}
      canvas.toBlob(blob => {
        if (!blob) {message('Não foi possível gerar a imagem.');return;}
        const uri=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=uri;link.download='PAIVA_Analise_Angular_2D.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(() => URL.revokeObjectURL(uri),30000);
        message('Imagem 2D anotada pronta para download. Guarde-a com a ficha do cliente.');
      },'image/png');
    });

    globalThis.PAIVA_ATHLETE_2D = {
      getAngles:() => annotations.filter(item => item.kind==='angle')
        .map(item => angleDegrees(item.points[0],item.points[1],item.points[2])),
      hasImage:() => photoLoaded
    };
    render();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
