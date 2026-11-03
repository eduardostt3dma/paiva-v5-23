/* PAIVA Bike Fit Studio — medições finais opcionais, verificadas pelo avaliador. */
(() => {
  'use strict';

  const GROUPS = [
    ['Posição final do selim', [
      ['finalSaddleHeight', 'Altura do selim', 'mm', 'Centro do movimento central até a superfície do selim, seguindo a linha de medição adotada.'],
      ['finalSaddleSetback', 'Recuo horizontal do bico do selim ao eixo central', 'mm', 'Deslocamento horizontal do bico do selim em relação ao eixo do movimento central. Registre o sinal se a referência estiver à frente.'],
      ['finalSaddleAngle', 'Inclinação do selim', '°', 'Inclinação longitudinal do selim em relação à horizontal.'],
    ]],
    ['Selim, direção e apoios', [
      ['finalNoseHead', 'Bico do selim → tampa da caixa de direção', 'mm', 'Distância direta do bico do selim até o centro da tampa superior da caixa de direção.'],
      ['finalNoseStem', 'Bico do selim → tampa superior da mesa', 'mm', 'Distância direta do bico do selim até o centro da tampa superior da mesa.'],
      ['finalNoseGrip', 'Bico do selim → centro da manopla (MTB)', 'mm', 'Use o centro da área de apoio da mão na manopla.', 'mtb'],
      ['finalNoseSTI', 'Bico do selim → centro do STI (Road)', 'mm', 'Use o ponto de referência do apoio da mão sobre o STI.', 'road'],
      ['finalNoseTT', 'Bico do selim → centro do apoio de antebraço (TT)', 'mm', 'Use o centro do apoio de antebraço, não a extremidade do prolongador.', 'tt'],
      ['finalLeverAxle', 'Manete → eixo da roda dianteira', 'mm', 'Distância direta do ponto definido no manete até o centro do eixo dianteiro.'],
      ['finalHandlebarDrop', 'Desnível entre selim e apoio das mãos', 'mm', 'Diferença vertical entre topo do selim e ponto de apoio das mãos; registre o sentido.'],
    ]],
    ['Geometria do quadro', [
      ['finalStack', 'Stack real do quadro', 'mm', 'Vertical entre o centro do movimento central e o topo de referência do tubo de direção.'],
      ['finalReach', 'Reach real do quadro', 'mm', 'Horizontal entre o centro do movimento central e o topo de referência do tubo de direção.'],
    ]],
    ['Componentes e montagem', [
      ['finalSpacerCount', 'Quantidade de espaçadores sob a mesa', 'un.', 'Número de espaçadores; não equivale à altura total.', null, '1'],
      ['finalSpacerHeight', 'Altura total dos espaçadores', 'mm', 'Soma da espessura dos espaçadores, excluindo a tampa superior da direção.'],
      ['finalStemLength', 'Comprimento da mesa instalada', 'mm', 'Medida centro a centro conforme a referência do fabricante. Não somar ao top tube para estimar reach.'],
      ['finalHandlebarWidth', 'Largura do guidão', 'mm', 'Informe a referência do fabricante: centro a centro ou externo a externo.'],
    ]],
  ];

  const DEFINITIONS = GROUPS.flatMap(([group, fields]) => fields.map(([id, label, unit, help, mode, step]) =>
    ({ id, label, unit, help, mode: mode || null, step: step || '.1', group })));
  const photoEstimates = new Set();
  const getMode = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
  const validNumber = value => value !== '' && Number.isFinite(Number(value));

  function initialize() {
    const host = document.getElementById('bikeFields');
    if (!host || document.getElementById('finalSaddleHeight')) return;
    const card = host.closest('.card');
    card.classList.add('paiva-final-measures-card');
    const explanation = card.querySelector('p.note');
    if (explanation) explanation.remove();

    const note = document.createElement('p');
    note.className = 'paiva-final-note';
    note.textContent = 'OPCIONAL · Medidas finais conferidas pelo profissional.';
    const generalHelp = document.createElement('button');
    generalHelp.className = 'paiva-final-help';
    generalHelp.type = 'button'; generalHelp.textContent = '?';
    generalHelp.setAttribute('aria-label','Como registrar medidas reais da bicicleta');
    generalHelp.setAttribute('aria-expanded','false');
    const generalBox = document.createElement('div');
    generalBox.className = 'paiva-final-help-box';generalBox.hidden = true;
    generalBox.textContent = 'Os sistemas Retül e STT Systems já fornecem muitas destas medidas. Esta ficha é opcional para transcrever dados ou registrar valores aferidos manualmente. Só campos preenchidos entram no PDF. O comprimento do pedivela fica em Dados da bicicleta e, agora, também pode ser informado na calibração fotográfica 2D. As estimativas por foto devem ser conferidas com instrumento antes de serem usadas como medida final.';
    // O ? principal deve ficar no título, onde o usuário o procura.
    card.querySelector('h2')?.append(' ',generalHelp);
    const intro = document.createElement('div');
    intro.className = 'paiva-final-intro';
    intro.append(note,generalBox);
    host.before(intro);
    generalHelp.addEventListener('click', () => {
      const open = generalBox.hidden;
      generalBox.hidden = !open;
      generalHelp.setAttribute('aria-expanded',String(open));
    });
    host.classList.add('paiva-final-form');

    for (const [title, entries] of GROUPS) {
      const group = document.createElement('section');
      group.className = 'paiva-final-group';
      const heading = document.createElement('h3');
      heading.textContent = title.toUpperCase();
      const grid = document.createElement('div');
      grid.className = 'paiva-final-grid';
      for (const [id, label, unit, help, mode, step] of entries) {
        const field = document.createElement('div');
        field.className = 'paiva-final-field';
        if (mode && ['road','mtb','tt'].includes(mode)) field.dataset.modeOnly = mode;
        const name = document.createElement('label');
        name.htmlFor = id;
        name.textContent = `${label} (${unit})`;
        const head = document.createElement('div');
        head.className = 'paiva-final-field-head';
        const fieldHelp = document.createElement('button');
        fieldHelp.type = 'button';fieldHelp.className = 'paiva-final-help';
        fieldHelp.textContent = '?';
        fieldHelp.setAttribute('aria-label',`Como medir ${label}`);
        fieldHelp.setAttribute('aria-expanded','false');
        head.append(name,fieldHelp);
        const input = document.createElement('input');
        input.type = 'number';
        input.inputMode = 'decimal';
        input.step = step || '0.1';
        input.id = id;
        input.placeholder = 'Opcional';
        input.title = help;
        input.setAttribute('aria-label', `${label} em ${unit}`);
        const helpNote = document.createElement('small');
        helpNote.textContent = help;helpNote.hidden = true;
        helpNote.className = 'paiva-final-field-explain';
        fieldHelp.addEventListener('click', () => {
          const open = helpNote.hidden;
          helpNote.hidden = !open;
          fieldHelp.setAttribute('aria-expanded',String(open));
        });
        field.append(head, input, helpNote);
        grid.append(field);
      }
      group.append(heading, grid);
      host.append(group);
    }

    const controls = document.createElement('div');
    controls.className = 'paiva-final-controls';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn';
    clear.textContent = 'Limpar medidas finais';
    const count = document.createElement('span');
    count.id = 'paiva-final-count';
    controls.append(clear, count);
    host.after(controls);

    // A antiga coluna "Entenda as medidas" deixava explicações permanentes
    // na tela. Remova-a e conserve o botão Limpar na ficha atual.
    const legacyGuide = Array.from(card.parentElement?.children || [])
      .find(node => node !== card && node.matches?.('section.card') && node.querySelector('#reset'));
    if (legacyGuide) {
      const oldReset = legacyGuide.querySelector('#reset');
      if (oldReset) controls.append(oldReset);
      legacyGuide.remove();
      card.parentElement?.classList.add('paiva-final-single');
    }

    const report = document.createElement('section');
    report.className = 'report-final-measures';
    report.id = 'paiva-report-final';
    const reportHeading = document.createElement('h2');
    reportHeading.textContent = '06 · Medidas finais da bicicleta';
    const caption = document.createElement('p');
    caption.textContent = 'Registro opcional realizado pelo profissional após o ajuste. Não substitui a documentação dos sistemas Retül e STT.';
    const dl = document.createElement('dl');
    report.append(reportHeading, caption, dl);
    const visual = document.getElementById('reportBikeVisual');
    visual?.after(report);

    function reportRows() {
      return DEFINITIONS.filter(def => !def.mode || def.mode === getMode()).flatMap(def => {
        const input = document.getElementById(def.id);
        const raw = input?.value?.trim() || '';
        if (!validNumber(raw)) return [];
        const estimated = photoEstimates.has(def.id);
        return [{ id: def.id, label: estimated ? `${def.label} (estimativa por foto 2D)` : def.label,
          value: `${raw.replace('.', ',')} ${def.unit}`, unit: def.unit, raw: Number(raw), estimated }];
      });
    }

    function sync() {
      const mode = getMode();
      for (const field of host.querySelectorAll('[data-mode-only]')) {
        field.classList.toggle('paiva-field-hidden', field.dataset.modeOnly !== mode);
      }
      const rows = reportRows();
      const handId = mode === 'mtb' ? 'finalNoseGrip' : mode === 'tt' ? 'finalNoseTT' : 'finalNoseSTI';
      const hands = document.getElementById(handId)?.value?.trim() || '';
      const handBadge = document.getElementById('bikeHands');
      if (handBadge) handBadge.textContent = validNumber(hands) && Number(hands) > 0
        ? `${(Number(hands) / 10).toFixed(1).replace('.', ',')} cm · final` : '—';
      count.textContent = rows.length ? `${rows.length} medida(s) final(is) registrada(s).` : 'Nenhuma medida final preenchida.';
      report.hidden = rows.length === 0;
      dl.replaceChildren();
      for (const row of rows) {
        const pair = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = row.label;
        const value = document.createElement('dd');
        value.textContent = row.value;
        pair.append(term, value);
        dl.append(pair);
      }
    }

    host.addEventListener('input', event => {
      // Se a estimativa foi substituída à mão, passa a valer a medida revisada.
      if (event.isTrusted && event.target?.id) photoEstimates.delete(event.target.id);
      sync();
    });
    host.addEventListener('change', sync);
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setTimeout(sync, 0)));
    clear.addEventListener('click', () => {
      for (const def of DEFINITIONS) document.getElementById(def.id).value = '';
      photoEstimates.clear();
      sync();
      document.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.getElementById('reset')?.addEventListener('click', () => clear.click());

    globalThis.PAIVA_FINAL_MEASURES = {
      getReport: reportRows,
      availableForPhoto: () => DEFINITIONS.filter(def => (!def.mode || def.mode === getMode()) && def.unit === 'mm'),
      fillFromPhoto: (id, value) => {
        const def = DEFINITIONS.find(item => item.id === id);
        const input = document.getElementById(id);
        if (!def || !input || !Number.isFinite(value)) return false;
        input.value = String(Math.round(value * 10) / 10);
        photoEstimates.add(id);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      },
      setManual: (id, value) => {
        const def = DEFINITIONS.find(item => item.id === id);
        const input = document.getElementById(id);
        const raw = String(value ?? '').trim();
        if (!def || !input || (raw !== '' && !Number.isFinite(Number(raw)))) return false;
        input.value = raw;
        photoEstimates.delete(id);
        sync();
        return true;
      },
      getMode,
      reset: () => clear.click(),
    };
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
