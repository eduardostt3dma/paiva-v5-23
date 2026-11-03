/* PAIVA — assistência experimental à medição projetada em uma única foto lateral.
   Escala dada pela distância entre o centro do movimento central e o eixo do pedal.
   Não corrige perspectiva, distorção óptica nem paralaxe; conferir com instrumento real. */
(() => {
  'use strict';
  function initialize() {
    const host = document.getElementById('bikeFields');
    const manual = globalThis.PAIVA_FINAL_MEASURES;
    if (!host || !manual || document.getElementById('paiva-photo-calibrator')) return;

    const section = document.createElement('details');
    section.id = 'paiva-photo-calibrator';
    section.className = 'paiva-photo-calibrator';
    const summary = document.createElement('summary');
    summary.textContent = 'MEDIÇÃO ASSISTIDA PELA FOTO · EXPERIMENTAL';
    const note = document.createElement('p');
    note.textContent = 'Aponte manualmente os centros do movimento central e do eixo do pedal para calibrar pela medida REAL do pedivela. Depois toque nos dois pontos de cada medida. A foto fornece apenas distâncias projetadas em 2D: câmera inclinada, pontos em planos diferentes e lente podem causar erros importantes. Revise com fita, Retül ou STT antes de usar no relatório.';
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Selecionar fotografia lateral da bicicleta');
    const buttons = document.createElement('div');
    buttons.className = 'paiva-calibrator-controls';
    const calibrate = document.createElement('button');
    calibrate.type = 'button'; calibrate.className = 'btn'; calibrate.textContent = '1 · Calibrar pedivela';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Escolher medida a extrair da foto');
    const measure = document.createElement('button');
    measure.type = 'button'; measure.className = 'btn'; measure.textContent = '2 · Medir';
    buttons.append(calibrate, select, measure);
    const frame = document.createElement('div');
    frame.className = 'paiva-calibrator-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 490;
    frame.append(canvas);
    const status = document.createElement('p');
    status.className = 'paiva-calibrator-status'; status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
    const disclaimer = document.createElement('p');
    disclaimer.textContent = 'Aviso: estimativas enviadas à ficha ficam identificadas como “foto 2D” no PDF. Para medições oficiais, utilize o seu protocolo instrumental.';
    section.append(summary, note, file, buttons, frame, status, disclaimer);
    host.after(section);

    const context = canvas.getContext('2d');
    if (!context) { section.remove(); return; }
    let image = null;
    let stage = 'idle';
    let draft = [];
    let reference = [];
    let measurement = [];
    let ratio = null;
    let lastDistance = '';
    const excluded = new Set(['finalHandlebarWidth']); // fora do plano da foto lateral

    function refreshFields() {
      const previous = select.value;
      select.replaceChildren();
      for (const def of manual.availableForPhoto().filter(d => !excluded.has(d.id))) {
        const option = document.createElement('option');
        option.value = def.id;
        option.textContent = def.label;
        select.append(option);
      }
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }

    function line(a, b, color, width = 3) {
      context.beginPath();context.moveTo(a.x, a.y);context.lineTo(b.x, b.y);
      context.strokeStyle = color;context.lineWidth = width;context.stroke();
      for (const point of [a, b]) {
        context.beginPath();context.arc(point.x, point.y, 7, 0, Math.PI * 2);
        context.fillStyle = '#13242e';context.fill();context.lineWidth = 3;
        context.strokeStyle = color;context.stroke();
      }
    }

    function draw() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!image) {
        context.fillStyle = '#172530';context.fillRect(0,0,canvas.width,canvas.height);
        context.fillStyle = '#c3d4e0'; context.font = '18px system-ui';context.textAlign = 'center';
        context.fillText('Escolha uma foto lateral da bicicleta para começar',canvas.width/2,canvas.height/2);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (reference.length === 2) line(reference[0], reference[1], '#00d9ec', 4);
      if (measurement.length === 2) line(measurement[0], measurement[1], '#ffe18d', 4);
      if (draft.length === 1) {
        const point = draft[0];context.beginPath();context.arc(point.x,point.y,7,0,Math.PI*2);
        context.fillStyle = '#0e2834';context.fill();context.lineWidth = 3;
        context.strokeStyle = stage === 'calibrate' ? '#00d9ec' : '#ffe18d';context.stroke();
      }
    }

    function setMessage(message) { status.textContent = message; }
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      if (!selected.type.startsWith('image/')) { setMessage('Selecione uma fotografia JPG, PNG ou HEIC compatível com o aparelho.'); return; }
      if (selected.size > 22 * 1024 * 1024) { setMessage('Imagem muito grande. Escolha uma foto de até 22 MB.'); return; }
      const uri = URL.createObjectURL(selected);
      const next = new Image();
      next.onload = () => {
        const factor = Math.min(1, 1100 / Math.max(next.naturalWidth, next.naturalHeight));
        canvas.width = Math.max(1, Math.round(next.naturalWidth * factor));
        canvas.height = Math.max(1, Math.round(next.naturalHeight * factor));
        // Reduz a foto na memória antes das marcações: evita reter um JPG de
        // 12–48 megapixels decodificado na RAM do Android ou iPad.
        const reduced = document.createElement('canvas');
        reduced.width = canvas.width; reduced.height = canvas.height;
        reduced.getContext('2d')?.drawImage(next, 0, 0, reduced.width, reduced.height);
        image = reduced;
        URL.revokeObjectURL(uri);
        file.value = '';
        ratio = null;reference=[];measurement=[];draft=[];stage='idle';
        draw();setMessage('Foto carregada. Informe o pedivela em Dados da bicicleta e toque em “1 · Calibrar pedivela”.');
      };
      next.onerror = () => { URL.revokeObjectURL(uri); setMessage('Não foi possível abrir a fotografia. Tente JPG ou PNG.'); };
      next.src = uri;
    });

    calibrate.addEventListener('click', () => {
      if (!image) { setMessage('Primeiro carregue uma foto lateral da bicicleta.'); return; }
      const crank = Number(document.getElementById('crankLength')?.value);
      if (!Number.isFinite(crank) || crank < 140 || crank > 190) {
        setMessage('Informe antes o comprimento real do pedivela (140–190 mm) na seção Dados da bicicleta.'); return;
      }
      stage='calibrate';draft=[];reference=[];measurement=[];ratio=null;
      draw();setMessage(`Calibração ${crank} mm: toque no CENTRO DO MOVIMENTO CENTRAL e depois no CENTRO DO EIXO DO PEDAL.`);
    });
    measure.addEventListener('click', () => {
      if (!image || !ratio) { setMessage('Primeiro carregue a foto e calibre pelo comprimento do pedivela.'); return; }
      stage='measure';draft=[];measurement=[];draw();
      const name = select.selectedOptions?.[0]?.textContent || 'medida';
      setMessage(`Marque os dois pontos de “${name}” na fotografia. Esta será uma aproximação 2D.`);
    });
    select.addEventListener('change', () => { if (stage==='measure') {stage='idle';draft=[];draw();setMessage('Campo alterado. Toque novamente em “2 · Medir”.');} });

    canvas.addEventListener('pointerdown', event => {
      if (!image || !['calibrate','measure'].includes(stage)) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = { x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height };
      if (point.x < 0 || point.y < 0 || point.x > canvas.width || point.y > canvas.height) return;
      draft.push(point);draw();
      if (draft.length < 2) { setMessage('Primeiro ponto marcado. Toque no segundo ponto com atenção.'); return; }
      const [a,b] = draft;
      const dx = Math.abs(b.x-a.x), dy = Math.abs(b.y-a.y);
      const pixels = Math.hypot(dx, dy);
      if (pixels < 10) {draft=[];draw();setMessage('Pontos próximos demais. Repita a marcação.');return;}
      if (stage === 'calibrate') {
        const crank = Number(document.getElementById('crankLength').value);
        ratio = crank/pixels;reference = [a,b];
        stage='idle';draft=[];draw();
        setMessage(`Calibrado: ${pixels.toFixed(1).replace('.',',')} pixels representam ${crank} mm. Selecione uma medida e toque em “2 · Medir”.`);
        return;
      }
      const id = select.value;
      if (!id) {draft=[];setMessage('Escolha primeiro uma medida.');return;}
      const axis = ['finalStack','finalHandlebarDrop','finalSpacerHeight'].includes(id) ? 'vertical'
        : ['finalReach','finalSaddleSetback'].includes(id) ? 'horizontal' : 'distance';
      const projected = axis === 'vertical' ? dy : axis === 'horizontal' ? dx : pixels;
      const mm = projected * ratio;
      measurement=[a,b];draft=[];stage='idle';draw();
      if (!Number.isFinite(mm) || mm < 1 || mm > 1800) {
        setMessage('Distância não plausível para essa foto. Confira a calibração e repita.');return;
      }
      manual.fillFromPhoto(id, mm);
      lastDistance = `${mm.toFixed(1).replace('.',',')} mm`;
      setMessage(`Estimativa ${axis === 'vertical' ? 'vertical' : axis === 'horizontal' ? 'horizontal' : 'projetada'}: ${lastDistance}. Campo preenchido e marcado “foto 2D” no relatório. Confira com instrumento antes de usar.`);
    });

    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setTimeout(refreshFields, 0)));
    refreshFields(); draw();setMessage('Selecione uma foto para começar.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
