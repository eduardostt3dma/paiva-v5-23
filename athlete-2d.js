/* PAIVA — análise angular 2D em fotografia estática, 100% local.
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
        <p><strong>Ângulo:</strong> marque três pontos na ordem A → B → C. O ponto B é o vértice; o aplicativo exibe o ângulo interno entre BA e BC, de 0° a 180°.</p>
        <p><strong>Linha:</strong> marque apenas início e fim para desenhar uma referência reta. Sem calibração métrica, não é uma régua em milímetros.</p>
        <p><strong>Editar:</strong> escolha “Ajustar pontos” e arraste os marcadores com o dedo ou mouse. Você pode desenhar vários ângulos e linhas na mesma foto, desfazer o último ou limpar.</p>
        <p><strong>Biomecânica:</strong> no joelho, uma referência possível é trocânter maior → côndilo femoral lateral → maléolo lateral. Escolha sempre a mesma convenção de pontos e o mesmo plano da câmera. A foto mostra uma projeção 2D, não captura rotação, profundidade nem movimento.</p>
        <p>O processamento ocorre neste aparelho. A imagem do cliente não é transmitida ao site ou ao GitHub. Salve a imagem anotada antes de fechar ou atualizar o aplicativo.</p>
      </div>
      <label class="paiva-2d-file">Foto lateral do atleta · JPG/PNG
        <input type="file" id="paiva-2d-file" accept="image/*" aria-label="Escolher foto do atleta para análise 2D" />
      </label>
      <div class="paiva-2d-tools" role="group" aria-label="Ferramenta de desenho">
        <button type="button" data-2d-tool="angle" aria-pressed="true">ÂNGULO · 3 PONTOS</button>
        <button type="button" data-2d-tool="line" aria-pressed="false">LINHA RETA</button>
        <button type="button" data-2d-tool="edit" aria-pressed="false">AJUSTAR PONTOS</button>
      </div>
      <div class="paiva-2d-canvas-wrap"><canvas id="paiva-2d-canvas" width="960" height="540" aria-label="Foto do atleta com ângulos e linhas desenhados manualmente"></canvas></div>
      <p class="paiva-2d-status" id="paiva-2d-status" role="status" aria-live="polite">Carregue uma foto lateral do atleta para começar.</p>
      <div class="paiva-2d-values" id="paiva-2d-values" aria-live="polite"></div>
      <div class="paiva-2d-actions">
        <button type="button" id="paiva-2d-undo">Desfazer</button>
        <button type="button" id="paiva-2d-clear">Limpar linhas</button>
        <button type="button" id="paiva-2d-save" class="paiva-2d-save">Salvar imagem marcada</button>
      </div>
      <p class="paiva-2d-disclaimer">Medição angular manual sobre fotografia estática, para triagem. Confirme pontos anatômicos, plano da câmera e valores com sua avaliação dinâmica/STT/Retül.</p>`;
    target.before(section);

    const byId = key => document.getElementById('paiva-2d-' + key);
    const canvas = byId('canvas');
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

    function mark(p,color) {
      const radius = Math.max(7,Math.min(13,canvas.width/110));
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle = '#0b1a24';ctx.fill();
      ctx.lineWidth = Math.max(2,radius/3);ctx.strokeStyle = color;ctx.stroke();
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
      ctx.lineWidth = Math.max(3,canvas.width/330);
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
      tool=next;draft=[];activeDrag=null;
      for (const button of section.querySelectorAll('[data-2d-tool]'))
        button.setAttribute('aria-pressed',String(button.getAttribute('data-2d-tool')===tool));
      render();
      if (!photoLoaded) return;
      message(tool==='angle' ? 'Ângulo: toque A, depois B (vértice) e C.' :
        tool==='line' ? 'Linha: toque no ponto inicial e depois no ponto final.' :
        'Ajustar: arraste os marcadores sobre a foto para corrigir as posições.');
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

    for (const button of section.querySelectorAll('[data-2d-tool]'))
      button.addEventListener('click',() => selectTool(button.getAttribute('data-2d-tool')));
    byId('help').addEventListener('click',() => {
      const box=byId('explain');const open=box.hidden;
      box.hidden=!open;byId('help').setAttribute('aria-expanded',String(open));
    });

    byId('file').addEventListener('change',() => {
      const chosen=byId('file').files?.[0];
      if (!chosen) return;
      if (!chosen.type.startsWith('image/') || chosen.size>20*1024*1024) {
        message('Escolha uma imagem compatível de até 20 MB.');return;
      }
      const uri=URL.createObjectURL(chosen);
      const photo=new Image();
      photo.onload=() => {
        const scale=Math.min(1,1400/Math.max(photo.naturalWidth,photo.naturalHeight));
        const width=Math.max(1,Math.round(photo.naturalWidth*scale));
        const height=Math.max(1,Math.round(photo.naturalHeight*scale));
        original.width=canvas.width=width;original.height=canvas.height=height;
        originalCtx.drawImage(photo,0,0,width,height);
        URL.revokeObjectURL(uri);
        photoLoaded=true;annotations=[];draft=[];activeDrag=null;
        byId('file').value='';render();
        message('Imagem carregada. Selecione Ângulo e marque A → B (vértice) → C.');
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
        activeDrag=findPoint(point,event);
        if (activeDrag) canvas.setPointerCapture?.(event.pointerId);
        else message('Toque diretamente em um marcador para arrastá-lo.');
        return;
      }
      draft.push(point);
      const required=tool==='angle'?3:2;
      if (draft.length<required) {
        render();message(tool==='angle'
          ? `Ponto ${draft.length}/3 marcado. ${draft.length===1?'Agora marque B, o vértice.':'Agora marque C.'}`
          : 'Primeiro ponto marcado. Toque no ponto final da linha.');
        return;
      }
      if (tool==='angle' && angleDegrees(draft[0],draft[1],draft[2])===null) {
        draft=[];render();message('Pontos próximos demais. Marque novamente o ângulo com precisão.');
        return;
      }
      annotations.push({kind:tool,points:draft});draft=[];render();
      message(tool==='angle'?'Ângulo registrado. Continue marcando ou escolha Ajustar pontos.':
        'Linha registrada. Continue marcando ou escolha Ajustar pontos.');
    });
    canvas.addEventListener('pointermove',event => {
      if (!activeDrag || event.pointerId!==activeDrag.pointer)return;
      const p=pointAt(event);if(!p)return;
      event.preventDefault();annotations[activeDrag.item].points[activeDrag.index]=p;render();
    });
    const stopDrag=event => {
      if (activeDrag && activeDrag.pointer===event.pointerId) {
        activeDrag=null;
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        message('Marcador ajustado. Confira o ângulo atualizado na imagem.');
      }
    };
    canvas.addEventListener('pointerup',stopDrag);
    canvas.addEventListener('pointercancel',stopDrag);
    byId('undo').addEventListener('click',() => {
      if (draft.length) draft.pop();else annotations.pop();
      render();message('Último ponto ou anotação removido.');
    });
    byId('clear').addEventListener('click',() => {
      if (annotations.length && !window.confirm('Remover todas as linhas e ângulos desta foto?'))return;
      annotations=[];draft=[];render();message('Marcações removidas. A fotografia foi preservada.');
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
