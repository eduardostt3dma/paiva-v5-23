/* PAIVA — análise 2D em fotografia ou quadro de vídeo, 100% local.
   Marcação MANUAL de três pontos (ângulo), dois (reta) ou um (trajetória).
   Rastreio experimental de textura, sem reconhecimento anatômico nem 3D. */
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
        <p><strong>Ângulo suplementar:</strong> clique diretamente na etiqueta “A 35°”, por exemplo, para alternar entre 35° e 145° (180° − 35°). A geometria das hastes não muda, somente a convenção mostrada. Confirme qual convenção está usando no laudo.</p>
        <p><strong>Linha:</strong> clique e arraste de uma extremidade até a outra. Depois, “Ajustar pontos” permite puxar as pontas ou mover a reta inteira pelo centro. Sem calibração métrica, não é uma régua em milímetros.</p>
        <p><strong>Alinhamento:</strong> selecione uma linha tocando nela e use Horizontal / Vertical; mantenha Shift pressionado ao desenhar para limitar a inclinação a passos de 45°.</p>
        <p><strong>Rodinha do mouse:</strong> sobre o vídeo ou sobre um quadro capturado, gire para avançar ou voltar um quadro da pedalada. A página permanece parada. Em fotos independentes, use Ctrl + rodinha para o zoom. Os pontos desenhados sobre um quadro parado não são reposicionados automaticamente ao girar a rodinha: reajuste-os antes de interpretar os números.</p>
        <p><strong>Mouse e teclado:</strong> com o mouse sobre o vídeo, o botão DIREITO alterna pausar/reproduzir, sem abrir o menu do navegador. A tecla Espaço também alterna play/pause; K pausa, L reproduz e as setas ← / → mudam um quadro. Atalhos não são aplicados enquanto você digita em campos ou usa seletores.</p>
        <p><strong>Congelar com clique:</strong> no vídeo gravado, clique com o botão ESQUERDO sobre a imagem para pausar e capturar automaticamente o quadro atual; as ferramentas compactas ficam logo abaixo. Com o quadro capturado, você pode marcar ou editar os pontos.</p>
        <p><strong>Zoom:</strong> aproxime até 400% pelo controle inferior ou com Ctrl + roda do mouse sobre a foto.</p>
        <p><strong>Espessura:</strong> ajuste as linhas de 1 a 8 px no painel lateral. A mudança aparece imediatamente nas linhas existentes e nas novas marcações.</p>
        <p><strong>Webcam:</strong> no computador, libere o acesso à câmera para visualizar e filmar o pedal. Você pode gravar até 3 minutos, salvar o vídeo no aparelho, pausá-lo e usar “Capturar quadro” para medir os ângulos de um instante. Os pontos iniciais são sempre marcados manualmente.</p>
        <p><strong>Vídeos antigos:</strong> use “Abrir vídeo do computador ou pendrive” para carregar MP4, WebM, MOV e outros formatos que seu navegador consiga decodificar. Pause num quadro, capture e analise com as mesmas ferramentas; nenhum arquivo é enviado à internet.</p>
        <p><strong>Vai e volta contínuo:</strong> os comandos ficam logo abaixo da imagem. Com essa opção marcada, o vídeo segue até o fim, retorna por buscas sucessivas de quadros e volta a avançar sem parar até você clicar em Pausar. A fluidez do retorno depende dos quadros-chave, do arquivo e do computador; a reprodução reversa em navegador pode ser menos suave do que em programas nativos. Use a régua de tempo para escolher o instante exato.</p>
        <p><strong>Extensão em trecho curto:</strong> capture um quadro próximo da extensão máxima e marque os três pontos anatômicos. Use “Buscar extensão” para examinar um intervalo curto antes e depois daquele instante, procurando o maior valor na convenção angular escolhida. O rastreio é experimental e pode interromper em áreas sem contraste; é uma prévia a validar manualmente, não uma medição clínica autônoma.</p>
        <p><strong>Rastreio beta:</strong> depois de congelar um quadro do vídeo gravado, desenhe e alinhe as marcações. Clique em “Rastrear marcações” para tentar acompanhá-las no vídeo. Essa função experimental acompanha pequenas regiões contrastantes da imagem e interrompe se perder a referência; não reconhece automaticamente as articulações e pode sofrer desvios. Use fitas contrastantes nos pontos, câmera fixa e valide cada ângulo importante antes de usar no bike fit.</p>
        <p><strong>Seguir pontos ao reproduzir:</strong> após capturar e marcar o quadro, escolha Voltar ao vídeo e Reproduzir. Com essa opção ativa, o rastreio assistido tenta acompanhar os pontos já desenhados, inclusive no retorno. Se perder algum marcador, a análise é interrompida para evitar um ângulo enganoso. Reposicione os pontos e recomece do quadro correto.</p>
        <p><strong>Ponto de trajetória:</strong> escolha “PONTO · RASTRO” e clique no quadril, pé ou outra referência visível; use “AJUSTAR PONTOS” para refinar a posição. Depois volte ao vídeo e reproduza com rastreio. O ponto e seu caminho recente ficam destacados sem cálculo angular. A linha do rastro representa deslocamento na imagem (pixels), não milímetros ou movimento tridimensional.</p>
        <p><strong>Biomecânica:</strong> no joelho, uma referência possível é trocânter maior → côndilo femoral lateral → maléolo lateral. Escolha sempre a mesma convenção de pontos e o mesmo plano da câmera. A foto mostra uma projeção 2D, não captura rotação, profundidade nem movimento.</p>
        <p>O processamento ocorre neste aparelho. Imagens e vídeos não são transmitidos ao site ou ao GitHub. Salve a imagem marcada e o vídeo antes de fechar ou atualizar o aplicativo. Webcam exige permissão do navegador e conexão segura (HTTPS ou localhost).</p>
      </div>
      <div class="paiva-2d-workspace">
        <div class="paiva-2d-view">
          <div class="paiva-2d-canvas-wrap"><canvas id="paiva-2d-canvas" width="960" height="540" aria-label="Foto ou quadro do vídeo com ângulos e linhas desenhados manualmente"></canvas>
            <video id="paiva-2d-video" playsinline muted hidden aria-label="Webcam ou vídeo gravado para análise 2D"></video>
            <canvas id="paiva-2d-track-overlay" width="480" height="270" hidden aria-label="Visualização do rastreamento experimental sobre o vídeo"></canvas></div>
          <div class="paiva-2d-player-dock" aria-label="Controles do vídeo sob a imagem"></div>
          <div class="paiva-2d-marking-dock" aria-label="Ferramentas de medição sob a imagem"></div>
          <div class="paiva-2d-quick-actions" aria-label="Capturar quadro e seguir marcações"></div>
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
            <button type="button" data-2d-tool="point" aria-pressed="false">PONTO · RASTRO</button>
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
            <div class="paiva-2d-sidebar-heading">VÍDEO · ARQUIVO OU WEBCAM</div>
            <label class="paiva-2d-file">Abrir vídeo do computador ou pendrive
              <input type="file" id="paiva-2d-video-file" accept="video/*,.mp4,.mov,.webm,.m4v,.avi" aria-label="Importar vídeo local para análise quadro a quadro" />
            </label>
            <div class="paiva-2d-playback">
              <div class="paiva-2d-timeline">
                <output id="paiva-2d-time-current" for="paiva-2d-scrub">00:00,0</output>
                <input type="range" id="paiva-2d-scrub" aria-label="Posição no vídeo" min="0" max="1" step="0.01" value="0" disabled />
                <output id="paiva-2d-time-total" for="paiva-2d-scrub">00:00,0</output>
              </div>
              <label class="paiva-2d-pingpong"><input type="checkbox" id="paiva-2d-pingpong" checked /> ↔ Vai e volta contínuo</label>
              <label>Velocidade do vídeo
                <select id="paiva-2d-speed" aria-label="Velocidade de reprodução">
                  <option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option>
                  <option value="1" selected>1×</option><option value="1.5">1,5×</option>
                </select>
              </label>
              <div><button type="button" id="paiva-2d-play-video" disabled>▶ Reproduzir</button>
                <button type="button" id="paiva-2d-pause-video" disabled>⏸ Pausar</button></div>
              <label>Quadros por segundo do arquivo (para avançar manualmente)
                <select id="paiva-2d-file-fps"><option value="24">24 fps</option><option value="25">25 fps</option><option value="30" selected>30 fps</option><option value="50">50 fps</option><option value="60">60 fps</option></select>
              </label>
              <div><button type="button" id="paiva-2d-prev-frame" disabled>◀ Quadro</button>
                <button type="button" id="paiva-2d-next-frame" disabled>Quadro ▶</button></div>
              <small class="paiva-2d-wheel-hint">🖱 Rodinha: quadros · Direito: play/pause · Espaço: play/pause · ← →: quadros</small>
            </div>
            <button type="button" id="paiva-2d-camera-start">Ligar webcam</button>
            <button type="button" id="paiva-2d-record" disabled>Iniciar gravação</button>
            <button type="button" id="paiva-2d-stop-record" disabled>Parar gravação</button>
            <button type="button" id="paiva-2d-capture" disabled>Capturar quadro</button>
            <button type="button" id="paiva-2d-back-video" hidden>Voltar ao vídeo</button>
            <button type="button" id="paiva-2d-track-start" disabled>Rastrear marcações · beta</button>
            <div class="paiva-2d-short-scan">
              <button type="button" id="paiva-2d-scan-short" disabled>Buscar extensão ±0,5 s</button>
              <select id="paiva-2d-scan-radius" aria-label="Trecho para busca da extensão máxima">
                <option value="0.25">±0,25 s</option><option value="0.5" selected>±0,5 s</option><option value="1">±1 s</option>
              </select>
            </div>
            <button type="button" id="paiva-2d-track-stop" disabled>Parar rastreio</button>
            <button type="button" id="paiva-2d-camera-stop" disabled>Desligar webcam</button>
            <a id="paiva-2d-video-download" hidden>Baixar vídeo gravado</a>
            <small id="paiva-2d-camera-info">Sem envio para a internet. Webcam requer permissão.</small>
          </div>
        </aside>
      </div>
      <p class="paiva-2d-disclaimer">Medição angular manual sobre fotografia estática, para triagem. Confirme pontos anatômicos, plano da câmera e valores com sua avaliação dinâmica/STT/Retül.</p>`;
    target.before(section);

    // O conjunto que mais se usa na análise fica sempre imediatamente sob o vídeo.
    // Controles e IDs existentes são movidos (não duplicados), preservando eventos.
    section.querySelector('.paiva-2d-player-dock').append(section.querySelector('.paiva-2d-playback'));
    const markingDock=section.querySelector('.paiva-2d-marking-dock');
    for(const selector of ['.paiva-2d-tools','.paiva-2d-align','.paiva-2d-zoom','.paiva-2d-width'])
      markingDock.append(section.querySelector(selector));
    const quickDock=section.querySelector('.paiva-2d-quick-actions');
    for(const id of ['paiva-2d-capture','paiva-2d-back-video'])
      quickDock.append(document.getElementById(id));
    quickDock.append(section.querySelector('.paiva-2d-short-scan'));
    for(const id of ['paiva-2d-track-start','paiva-2d-track-stop'])
      quickDock.append(document.getElementById(id));
    quickDock.insertAdjacentHTML('afterbegin','<label class="paiva-2d-follow"><input type="checkbox" id="paiva-2d-auto-track" /> Seguir pontos ao reproduzir <span>· experimental</span></label>');
    section.querySelector('.paiva-2d-player-dock').hidden=true;

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
    const colors = {angle:'#e7cf86',line:'#8bd6e4',point:'#a8f5c3'};
    const message = text => {byId('status').textContent = text;};
    const format = value => value.toFixed(1).replace('.',',');
    const displayedAngle = item => {
      const a=angleDegrees(item.points[0],item.points[1],item.points[2]);
      return a===null?null:item.supplementary?180-a:a;
    };

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
      const fontSize = Math.max(12,Math.min(20,canvas.width/65));
      ctx.font = `700 ${fontSize}px system-ui,sans-serif`;
      const padding = 4;
      const w = ctx.measureText(text).width + padding*2;
      const h = fontSize+padding*2;
      const tx = Math.max(4,Math.min(canvas.width-w-4,x+11));
      const ty = Math.max(h+4,Math.min(canvas.height-4,y-11));
      ctx.fillStyle = 'rgba(8,20,29,.74)';
      ctx.fillRect(tx,ty-h,w,h);
      ctx.strokeStyle = color;ctx.lineWidth=1;ctx.strokeRect(tx,ty-h,w,h);
      ctx.fillStyle = '#f4f8fa';ctx.textBaseline='middle';ctx.fillText(text,tx+padding,ty-h/2);
      return {left:tx,top:ty-h,right:tx+w,bottom:ty};
    }

    function drawAnnotation(item,index,partial=false) {
      const pts = item.points;
      const color = colors[item.kind];
      if(item.kind==='point') {
        if(pts.length){
          const p=pts[0];
          ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,lineWidth+1),0,Math.PI*2);
          ctx.fillStyle=color;ctx.fill();
          ctx.strokeStyle='#102a24';ctx.lineWidth=1.5;ctx.stroke();
        }
        return;
      }
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle=color;
      ctx.beginPath();
      if (pts.length) ctx.moveTo(pts[0].x,pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.stroke();
      for (const p of pts) mark(p,color);
      if (!partial && item.kind === 'angle' && pts.length === 3) {
        item.labelBounds=null;
        const a = displayedAngle(item);
        if (a !== null) item.labelBounds=tag(pts[1].x,pts[1].y,`A ${format(a)}°`,color);
      }
      if (!partial && item.kind === 'line' && pts.length === 2) {
        tag((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,`L${index+1}`,color);
      }
    }

    function updateValues() {
      const values = [];
      annotations.forEach((item,index) => {
        if (item.kind === 'angle') {
          const a = displayedAngle(item);
          values.push(`Ângulo ${index+1}: ${a === null ? 'rever pontos' : format(a)+'°'}`);
        } else if(item.kind==='point') values.push(`Ponto ${index+1} · rastro`);
        else values.push(`Linha ${index+1}`);
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
        tool==='point' ? 'Ponto: clique uma vez no quadril ou no pé. Depois arraste o pontinho para ajustar.' :
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
    function angleLabelAt(point){
      for(let i=annotations.length-1;i>=0;i--){
        const a=annotations[i];
        if(a.kind!=='angle'||!a.labelBounds)continue;
        const {left,right,top,bottom}=a.labelBounds;
        if(point.x>=left-3&&point.x<=right+3&&point.y>=top-3&&point.y<=bottom+3)return i;
      }
      return -1;
    }

    function findSegment(point,event) {
      const rect=canvas.getBoundingClientRect();
      const tolerance=Math.max(8,12*canvas.width/rect.width);
      for (let i=annotations.length-1;i>=0;i--) {
        const pts=annotations[i].points;
        const segments=annotations[i].kind==='angle' ? [[0,1],[1,2]] : annotations[i].kind==='line' ? [[0,1]] : [];
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
    let stillFromVideo = false;
    let motionTracker = null;
    let trackingActive = false;
    let scanningActive = false,scanCancelled = false;
    const trackOverlay=byId('track-overlay');
    const trackCtx=trackOverlay.getContext('2d');
    const pointTrails=new Map();
    const maxRecordingMs = 180000;
    let backwardMode=false,reverseFrame=null,lastReverseTick=0,scrubActive=false,wheelAccumulator=0;

    const hasFileVideo=()=>!!recordedUrl && video.getAttribute('src')===recordedUrl;
    const clockTime=value=>{
      if(!Number.isFinite(value)||value<0)return '00:00,0';
      const whole=Math.floor(value);
      return `${String(Math.floor(whole/60)).padStart(2,'0')}:${String(whole%60).padStart(2,'0')},${Math.floor(value*10)%10}`;
    };
    function syncTimeline() {
      const available=hasFileVideo()&&Number.isFinite(video.duration)&&video.duration>0;
      const slider=byId('scrub');
      slider.disabled=!available;
      slider.max=String(available?video.duration:1);
      if(!scrubActive)slider.value=String(available?Math.max(0,Math.min(video.duration,video.currentTime)):0);
      byId('time-current').textContent=clockTime(available?video.currentTime:0);
      byId('time-total').textContent=clockTime(available?video.duration:0);
    }
    function haltReverse(resetDirection=true) {
      if(reverseFrame!==null)cancelAnimationFrame(reverseFrame);
      reverseFrame=null;lastReverseTick=0;
      if(resetDirection)backwardMode=false;
    }
    function reverseTick(timestamp) {
      reverseFrame=null;
      if(!backwardMode||!hasFileVideo()||!byId('pingpong').checked)return;
      const fps=Number(byId('file-fps').value)||30;
      const rate=Number(byId('speed').value)||1;
      const interval=1000/(fps*rate);
      if(!lastReverseTick)lastReverseTick=timestamp-interval;
      if(timestamp-lastReverseTick>=interval && !video.seeking){
        lastReverseTick=timestamp;
        const next=Math.max(0,video.currentTime-1/fps);
        video.currentTime=next;
        syncTimeline();
        if(next<=.001){
          haltReverse();
          video.currentTime=0;
          Promise.resolve(video.play()).catch(()=>message('Clique em Reproduzir para continuar o vídeo.'));
          return;
        }
      }
      reverseFrame=requestAnimationFrame(reverseTick);
    }
    function startReverse() {
      if(!hasFileVideo()||!byId('pingpong').checked||!Number.isFinite(video.duration)||video.duration<=0)return;
      haltReverse();video.pause();
      backwardMode=true;
      video.currentTime=Math.max(0,video.duration-1/(Number(byId('file-fps').value)||30));
      reverseFrame=requestAnimationFrame(reverseTick);
      message('Retorno automático do vídeo. Clique em Pausar para examinar o quadro.');
    }

    function showVideo(enabled) {
      video.hidden = !enabled;
      canvas.hidden = enabled;
      section.querySelector('.paiva-2d-player-dock').hidden=!enabled;
      section.querySelector('.paiva-2d-marking-dock').hidden=enabled;
      byId('auto-track').disabled=!enabled;
      for (const button of section.querySelectorAll('[data-2d-tool]')) button.disabled=enabled||scanningActive;
      for (const key of ['undo','clear','save','width']) byId(key).disabled=enabled||scanningActive;
    }

    function updateCameraControls() {
      const live = !!cameraStream;
      const recording = recorder?.state === 'recording';
      const hasPlayback = !!recordedUrl && video.getAttribute('src')===recordedUrl;
      byId('camera-start').disabled = live || recording;
      byId('camera-stop').disabled = !live;
      byId('record').disabled = !live || recording || typeof MediaRecorder === 'undefined';
      byId('stop-record').disabled = !recording;
      byId('capture').disabled = scanningActive || recording || (!live && !hasPlayback);
      byId('track-start').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo || !annotations.length || trackingActive || recording;
      byId('scan-short').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.kind==='angle') || trackingActive || recording;
      byId('scan-radius').disabled = scanningActive;
      byId('track-stop').disabled = !trackingActive && !scanningActive;
      byId('prev-frame').disabled = !hasPlayback || recording || trackingActive || scanningActive;
      byId('next-frame').disabled = !hasPlayback || recording || trackingActive || scanningActive;
      byId('speed').disabled = !hasPlayback || recording;
      byId('pingpong').disabled = !hasPlayback || recording;
      byId('play-video').disabled = !hasPlayback || recording || scanningActive;
      byId('pause-video').disabled = !hasPlayback || recording || scanningActive;
      syncTimeline();
    }

    function stopTracking(clear=true) {
      if(scanningActive)scanCancelled=true;
      motionTracker?.stop();motionTracker=null;trackingActive=false;
      if (clear) trackOverlay.hidden=true;
      updateCameraControls();
    }

    function alignTrackedOverlay() {
      if(!video.videoWidth || !video.videoHeight)return;
      const frame=video.getBoundingClientRect();
      const holder=video.parentElement.getBoundingClientRect();
      const ratio=video.videoWidth/video.videoHeight;
      if(!frame.width || !frame.height || !holder.width)return;
      const visibleWidth=Math.min(frame.width,frame.height*ratio);
      const visibleHeight=visibleWidth/ratio;
      trackOverlay.style.width=`${visibleWidth}px`;
      trackOverlay.style.height=`${visibleHeight}px`;
      trackOverlay.style.left=`${frame.left-holder.left+(frame.width-visibleWidth)/2}px`;
      trackOverlay.style.top=`${frame.top-holder.top+(frame.height-visibleHeight)/2}px`;
    }
    window.addEventListener('resize',()=>{if(!trackOverlay.hidden)alignTrackedOverlay();});

    function paintTracked(points,w,h,time) {
      if (!trackCtx) return;
      alignTrackedOverlay();
      trackOverlay.width=w;trackOverlay.height=h;
      trackCtx.clearRect(0,0,w,h);
      trackCtx.lineWidth=2;trackCtx.lineCap='round';trackCtx.lineJoin='round';
      const readings=[];
      points.forEach((item,index)=> {
        const pts=item.points;
        const color=item.kind==='angle'?'#ffe9a8':item.kind==='point'?'#a8f5c3':'#a6eeff';
        if(item.kind==='point'){
          const p=pts[0];
          if(!p)return;
          const trail=pointTrails.get(index)||[];
          if(!trail.length||Math.hypot(trail[trail.length-1].x-p.x,trail[trail.length-1].y-p.y)>.5)trail.push({...p});
          if(trail.length>180)trail.shift();
          pointTrails.set(index,trail);
          if(trail.length>1){
            trackCtx.beginPath();trackCtx.moveTo(trail[0].x,trail[0].y);
            for(let j=1;j<trail.length;j++)trackCtx.lineTo(trail[j].x,trail[j].y);
            trackCtx.strokeStyle='rgba(168,245,195,.82)';trackCtx.lineWidth=2;trackCtx.stroke();
          }
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,5,0,Math.PI*2);
          trackCtx.fillStyle=color;trackCtx.fill();
          trackCtx.strokeStyle='#102d25';trackCtx.lineWidth=1.5;trackCtx.stroke();
          readings.push(`Ponto ${index+1} · trajetória`);
          return;
        }
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
            const shown=item.supplementary?180-angle:angle;
            readings.push(`A ${format(shown)}°`);
            trackCtx.font='650 13px system-ui,sans-serif';
            trackCtx.fillText(`A ${format(shown)}°`,Math.min(w-82,pts[1].x+8),Math.max(15,pts[1].y-8));
          }
        }
      });
      byId('values').textContent=`Rastreio experimental ${time.toFixed(1).replace('.',',')} s · ${readings.join('  |  ') || 'linhas em movimento'}`;
    }

    async function startTracking() {
      if (trackingActive || scanningActive || !lastFrameFromVideo || !annotations.length || !recordedUrl) return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if (!motion?.create || !trackCtx) {message('Módulo de rastreio indisponível. Atualize todos os arquivos do aplicativo.');return;}
      pointTrails.clear();
      const currentTime=video.currentTime;
      motionTracker=motion.create({video,annotations:annotations.map(item=>({
        kind:item.kind,supplementary:!!item.supplementary,points:item.points.map(p=>({...p}))})),
        sourceWidth:canvas.width,sourceHeight:canvas.height,
        isReversePlaying:()=>backwardMode&&reverseFrame!==null,
        isPingPongEnabled:()=>byId('pingpong').checked,
        onPoints:(points,w,h,t)=>paintTracked(points,w,h,t),
        onLost:reason=>{
          haltReverse();stopTracking();video.pause();
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
    async function scanShortSegment(){
      if(scanningActive||trackingActive||!lastFrameFromVideo||!hasFileVideo()||
        !annotations.some(item=>item.kind==='angle'))return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanWindow){message('Atualize também athlete-motion.js para usar a busca de extensão.');return;}
      const radius=Number(byId('scan-radius').value)||0.5;
      const fps=Number(byId('file-fps').value)||30;
      const center=video.currentTime;
      haltReverse();video.pause();
      scanCancelled=false;scanningActive=true;
      updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Buscando a extensão em ±${String(radius).replace('.',',')} s do quadro marcado. Aguarde; você pode interromper em “Parar rastreio”.`);
      try{
        const result=await motion.scanWindow({video,centerTime:center,radius,fps,
          annotations:annotations.map(item=>({kind:item.kind,supplementary:!!item.supplementary,
            points:item.points.map(p=>({...p}))})),
          sourceWidth:canvas.width,sourceHeight:canvas.height,
          shouldCancel:()=>scanCancelled,
          onProgress:progress=>message(`Analisando quadros próximos… ${progress.tested} conferidos · maior A ${format(progress.bestAngle)}° até agora.`)
        });
        if(scanCancelled)return;
        // Ao terminar, expõe o quadro em que a MAIOR leitura experimental ocorreu.
        // Os pontos desse quadro são correspondências rastreadas, não detecção anatômica.
        originalCtx.drawImage(video,0,0,original.width,original.height);
        annotations=result.best.shapes.map(item=>({kind:item.kind,supplementary:item.supplementary,
          points:item.points.map(p=>({x:p.x/result.width*canvas.width,y:p.y/result.height*canvas.height}))}));
        lastFrameFromVideo=true;stillFromVideo=true;
        render();showVideo(false);
        byId('back-video').hidden=false;
        message(`Maior leitura encontrada: A ${format(result.best.angle)}° em ${clockTime(result.best.time)} · ${result.tested} quadros próximos. ${result.partial?'Parte do intervalo foi interrompida por falta de referência; ':''}Confira visualmente cada ponto e a convenção angular antes de usar no bike fit.`);
      }catch(error){
        if(!scanCancelled)message(`Busca curta interrompida: ${error?.message||'não foi possível acompanhar os pontos'}. Confira contraste, FPS e posição dos marcadores.`);
      }finally{
        scanningActive=false;scanCancelled=false;
        updateCameraControls();
        for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=!video.hidden;
      }
    }
    function stopTrackingPlayback() {
      if(scanningActive){scanCancelled=true;message('Interrompendo a busca curta. O quadro original continua marcado.');return;}
      if(!trackingActive)return;
      stopTracking();video.pause();
      message('Rastreio encerrado. Pause noutro instante e capture um novo quadro para corrigir os pontos.');
    }
    byId('track-start').addEventListener('click',startTracking);
    byId('scan-short').addEventListener('click',scanShortSegment);
    byId('track-stop').addEventListener('click',stopTrackingPlayback);

    function stopStream() {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
    }

    function loadVideoFile(file,label='Vídeo local') {
      if (!file || recorder?.state==='recording') {
        message('Pare a gravação atual antes de importar outro vídeo.');return false;
      }
      const filename=String(label || file.name || 'Vídeo');
      const allowed=/\.(mp4|mov|webm|m4v|avi)$/i.test(filename) ||
        String(file.type||'').startsWith('video/');
      if (!allowed) {message('Selecione um vídeo, por exemplo MP4, WebM ou MOV.');return false;}
      haltReverse();stopTracking();stopStream();video.pause();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl=URL.createObjectURL(file);
      video.srcObject=null;video.src=recordedUrl;video.controls=false;
      video.muted=true;video.autoplay=false;video.load();
      video.playbackRate=Number(byId('speed').value)||1;
      lastFrameFromVideo=false;
      stillFromVideo=false;
      byId('back-video').hidden=true;
      const download=byId('video-download');download.hidden=true;download.removeAttribute('href');
      showVideo(true);
      byId('camera-info').textContent=`Arquivo: ${filename}. Reprodução local, sem upload.`;
      message('Vídeo aberto. Use a barra de reprodução para pausar no instante desejado, depois clique “Capturar quadro”.');
      updateCameraControls();syncTimeline();
      attemptPlayback();
      return true;
    }
    function attemptPlayback() {
      if(scanningActive||!hasFileVideo())return;
      if(backwardMode){
        if(reverseFrame===null)reverseFrame=requestAnimationFrame(reverseTick);
        message('Vídeo retornando. Clique em Pausar no instante desejado.');
        return;
      }
      if(!trackingActive && lastFrameFromVideo && annotations.length && byId('auto-track').checked){
        startTracking();return;
      }
      if(video.ended)video.currentTime=0;
      let attempt;
      try{attempt=video.play();}catch(error){message(`Não foi possível iniciar o vídeo: ${error?.message||'erro de reprodução'}.`);return;}
      Promise.resolve(attempt).then(()=>{
        if(!video.paused)message('Vídeo em reprodução. Pause no instante desejado e clique “Capturar quadro”.');
      }).catch(error=>{
        message(error?.name==='NotAllowedError'
          ? 'O navegador bloqueou a reprodução automática. Clique em “▶ Reproduzir”.'
          : 'O navegador não conseguiu reproduzir este formato. Prefira MP4 (vídeo H.264) ou WebM; alguns AVI/MOV precisam de conversão.');
      });
    }
    byId('play-video').addEventListener('click',attemptPlayback);
    function pausePlayback() {
      haltReverse(false);video.pause();
      message('Vídeo pausado. Ajuste a posição na linha do tempo ou clique em “Capturar quadro”.');
    }
    function togglePlayback() {
      if(scanningActive||!hasFileVideo())return;
      if(!video.paused || (backwardMode && reverseFrame!==null))pausePlayback();
      else {
        if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
        attemptPlayback();
      }
    }
    byId('pause-video').addEventListener('click',pausePlayback);
    byId('video-file').addEventListener('change',() => {
      const input=byId('video-file');
      const file=input.files?.[0];if(!file)return;
      loadVideoFile(file,file.name);
      input.value='';
    });
    byId('speed').addEventListener('change',()=>{
      video.playbackRate=Number(byId('speed').value)||1;
      if(recordedUrl)message(`Reprodução configurada para ${byId('speed').selectedOptions[0].textContent}.`);
    });
    byId('pingpong').addEventListener('change',()=>{
      if(!byId('pingpong').checked && backwardMode){
        haltReverse();video.pause();
      }
      message(byId('pingpong').checked?'Vai e volta ativado: o vídeo retornará automaticamente no final.':'Vai e volta desativado.');
    });
    byId('scrub').addEventListener('pointerdown',()=>{scrubActive=true;});
    byId('scrub').addEventListener('pointerup',()=>{scrubActive=false;syncTimeline();});
    byId('scrub').addEventListener('change',()=>{scrubActive=false;syncTimeline();});
    byId('scrub').addEventListener('input',()=>{
      if(!hasFileVideo()||!Number.isFinite(video.duration))return;
      haltReverse();video.pause();
      if(trackingActive)stopTracking();
      lastFrameFromVideo=false;
      video.currentTime=Math.max(0,Math.min(video.duration,Number(byId('scrub').value)||0));
      syncTimeline();
      message('Posição ajustada. Capture um novo quadro antes de iniciar um rastreio.');
    });
    function stepFrame(direction,preserveCapturedImage=false) {
      if(scanningActive||!hasFileVideo())return;
      haltReverse();video.pause();
      if(trackingActive)stopTracking();
      const refreshStill=preserveCapturedImage && stillFromVideo && !canvas.hidden;
      lastFrameFromVideo=false;
      const duration=Number.isFinite(video.duration)?video.duration:Math.max(video.currentTime,0);
      const fps=Number(byId('file-fps').value)||30;
      const next=Math.max(0,Math.min(duration,video.currentTime+direction/fps));
      if(refreshStill && Math.abs(next-video.currentTime)>.0001){
        video.addEventListener('seeked',()=>{
          if(!canvas.hidden && video.readyState>=2){
            originalCtx.drawImage(video,0,0,original.width,original.height);
            render();
          }
        },{once:true});
      }
      video.currentTime=next;
      syncTimeline();
      updateCameraControls();
      message(refreshStill
        ? `Quadro deslocado em 1/${fps} s. As marcações estão fixas: ajuste os pontos ao atleta antes de interpretar o ângulo; recapture para reativar o rastreio.`
        : `Avanço aproximado de 1/${fps} s. Ajuste o FPS conforme o vídeo; aguarde atualizar antes de capturar.`);
    }
    byId('prev-frame').addEventListener('click',()=>stepFrame(-1));
    byId('next-frame').addEventListener('click',()=>stepFrame(1));
    // Sobre o visor da análise, a rodinha move o vídeo de fato: não rola a página.
    // Ctrl + rodinha mantém o zoom da foto; arquivos de webcam ao vivo não sofrem seek.
    canvas.parentElement.addEventListener('wheel',event=>{
      if(scanningActive){event.preventDefault();return;}
      if(event.ctrlKey && !canvas.hidden){
        event.preventDefault();
        updateZoom(Number(byId('zoom').value)+(event.deltaY<0?25:-25));
        return;
      }
      if(event.ctrlKey || !hasFileVideo() || !Number.isFinite(video.duration) || video.duration<=0)return;
      event.preventDefault();
      const multiplier=event.deltaMode===1?16:event.deltaMode===2?100:1;
      wheelAccumulator+=event.deltaY*multiplier;
      if(Math.abs(wheelAccumulator)<30)return;
      const direction=Math.sign(wheelAccumulator);
      wheelAccumulator=0;
      stepFrame(direction,!canvas.hidden);
    },{passive:false});
    const playerArea=canvas.parentElement;
    playerArea.tabIndex=0;
    playerArea.setAttribute('aria-label','Área de análise 2D. Botão direito pausa ou reproduz; Espaço alterna vídeo; setas mudam os quadros.');
    playerArea.addEventListener('pointerenter',()=>{globalThis.PAIVA_ACTIVE_VIDEO_PANEL='athlete';});
    playerArea.addEventListener('pointerdown',()=>playerArea.focus({preventScroll:true}));
    playerArea.addEventListener('contextmenu',event=>{
      if(!hasFileVideo())return;
      event.preventDefault();
      globalThis.PAIVA_ACTIVE_VIDEO_PANEL='athlete';
      togglePlayback();
    });
    document.addEventListener('keydown',event=>{
      if(globalThis.PAIVA_ACTIVE_VIDEO_PANEL!=='athlete'||!hasFileVideo()||event.repeat)return;
      if(event.ctrlKey||event.altKey||event.metaKey)return;
      if(event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]'))return;
      const key=event.code||event.key;
      if(key==='Space'||key===' '){event.preventDefault();togglePlayback();}
      else if(key==='KeyK'||key==='k'||key==='K'){event.preventDefault();pausePlayback();}
      else if(key==='KeyL'||key==='l'||key==='L'){event.preventDefault();
        if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
        attemptPlayback();}
      else if(key==='ArrowLeft'||key==='ArrowRight'){
        event.preventDefault();stepFrame(key==='ArrowRight'?1:-1,!canvas.hidden);
      }
    });
    video.addEventListener('error',() => {
      haltReverse();
      if (!cameraStream && video.getAttribute('src'))
        message('O navegador não conseguiu reproduzir esse arquivo. Tente MP4 com vídeo H.264 ou WebM; alguns AVI/MOV precisam ser convertidos.');
    });
    video.addEventListener('loadedmetadata',()=>{
      syncTimeline();
      if(recordedUrl && video.getAttribute('src')===recordedUrl && video.paused)
        message('Vídeo reconhecido. Clique em “▶ Reproduzir” ou use a barra de reprodução.');
    });
    video.addEventListener('timeupdate',syncTimeline);
    video.addEventListener('durationchange',syncTimeline);
    video.addEventListener('ended',()=>{
      syncTimeline();
      if(hasFileVideo() && byId('pingpong').checked)startReverse();
    });

    function setFrame(source, naturalWidth, naturalHeight) {
      if (!naturalWidth || !naturalHeight) return false;
      const scale = Math.min(1,1400/Math.max(naturalWidth,naturalHeight));
      const width = Math.max(1,Math.round(naturalWidth*scale));
      const height = Math.max(1,Math.round(naturalHeight*scale));
      original.width = canvas.width = width;
      original.height = canvas.height = height;
      originalCtx.drawImage(source,0,0,width,height);
      photoLoaded = true;
      stillFromVideo=source===video;
      annotations=[];draft=[];activeDrag=null;activeDraw=null;selectedIndex=-1;
      updateZoom(100);
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
        haltReverse();stopTracking();lastFrameFromVideo=false;
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
        stillFromVideo=false;
        video.controls=false;video.muted=true;video.autoplay=false;video.load();
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
          message('Limite de 3 minutos atingido. Finalizando o vídeo...');
        }
      },maxRecordingMs);
      byId('camera-info').textContent='Gravando vídeo local · máximo de 3 minutos. Sem áudio.';
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
      haltReverse();stopStream();
      video.pause();
      if (video.srcObject) video.srcObject=null;
      showVideo(false);byId('back-video').hidden=true;
      byId('camera-info').textContent='Webcam desligada. Vídeos e imagens não são enviados à internet.';
      message('Webcam desligada. A imagem capturada, se houver, foi preservada.');
      updateCameraControls();
    }

    function captureVideoFrame() {
      if(scanningActive)return;
      if (recorder?.state==='recording') {
        message('Pare a gravação antes de capturar um quadro para análise.');return;
      }
      haltReverse();
      if (trackingActive) stopTracking();
      video.pause();
      if (!videoCanCapture() || !setFrame(video,video.videoWidth,video.videoHeight)) {
        message('Aguarde o vídeo carregar. Depois pause no quadro desejado e tente novamente.');return;
      }
      lastFrameFromVideo=!cameraStream && !!recordedUrl;
      if (cameraStream) {
        stopStream();video.srcObject=null;
        byId('back-video').hidden=true;
      } else byId('back-video').hidden = !recordedUrl;
      updateCameraControls();
      message('Quadro congelado! Posicione o ângulo ou a linha. Depois clique em “Voltar ao vídeo” e Reproduzir para tentar seguir os pontos marcados.');
    }

    byId('camera-start').addEventListener('click',startCamera);
    byId('record').addEventListener('click',startRecording);
    byId('stop-record').addEventListener('click',stopRecording);
    byId('camera-stop').addEventListener('click',stopCamera);
    byId('capture').addEventListener('click',captureVideoFrame);
    video.addEventListener('pointerdown',event=>{
      if(event.button!==0 || scanningActive || recorder?.state==='recording')return;
      if(!videoCanCapture()||(!hasFileVideo()&&!cameraStream))return;
      event.preventDefault();
      captureVideoFrame();
    });
    byId('back-video').addEventListener('click',() => {
      if (!recordedUrl) return;
      if (trackingActive) stopTracking();
      showVideo(true);byId('back-video').hidden=true;
      message('Vídeo disponível. Pause em outro instante e toque em “Capturar quadro”. Salve suas marcações anteriores antes.');
    });
    window.addEventListener('pagehide',() => {
      haltReverse();stopTracking();
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
        haltReverse();stopTracking();lastFrameFromVideo=false;
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
      if(event.button!==0)return;
      if(scanningActive)return;
      if (!photoLoaded) {message('Primeiro escolha uma fotografia do atleta.');return;}
      const point=pointAt(event);
      if (!point) return;
      event.preventDefault();
      const selectedLabel=angleLabelAt(point);
      if(selectedLabel>=0){
        const angle=annotations[selectedLabel];
        angle.supplementary=!angle.supplementary;
        render();
        message(`Convenção alterada: A ${format(displayedAngle(angle))}°. Clique novamente no valor para inverter.`);
        return;
      }
      if(tool==='point'){
        annotations.push({kind:'point',points:[point]});
        selectedIndex=annotations.length-1;
        selectTool('edit');updateCameraControls();
        message('Ponto colocado. Arraste-o para alinhar ao quadril ou pé; depois volte ao vídeo e use o rastreio.');
        return;
      }
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
      if(!activeDraw&&!activeDrag)canvas.style.cursor=angleLabelAt(p)>=0?'pointer':'crosshair';
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
      getAngles:() => annotations.filter(item => item.kind==='angle').map(displayedAngle),
      hasImage:() => photoLoaded,
      openVideo:(file,label) => {
        const loaded=loadVideoFile(file,label);
        if(loaded)section.scrollIntoView({behavior:'smooth',block:'start'});
        return loaded;
      }
    };
    render();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
