/* PAIVA V5.63 — comparação assistida entre antropometria e duas geometrias.
   O filtro e o laudo são calculados localmente com regras explícitas.
   Não há conexão com modelo generativo ou diagnóstico de bike fit definitivo. */
(() => {
  'use strict';

  const MODALITIES = { road: 'Speed / Road', mtb: 'MTB', tt: 'Triatlo / TT' };
  const PROFILE_LABELS = { aggressive: 'Agressivo', balanced: 'Intermediário', comfortable: 'Confortável' };
  const ANTHRO_FIELDS = [
    ['height','estatura'],['inseam','entrepernas'],['torso','tronco líquido'],
    ['arm','braço líquido'],['shoulder','ombros'],['foot','pé']
  ];
  const MODE_NOTES = {
    road: 'Road / Speed: compare geometrias de quadros da mesma modalidade. Mesa, espaçadores, guidão e posição das mãos precisam ser avaliados na montagem.',
    mtb: 'MTB: compare geometrias de MTB. Curso e SAG da suspensão, mesa, rise, backsweep e altura do guidão alteram a posição real do ciclista.',
    tt: 'TT / Triatlo: o stack e o reach do quadro não definem sozinhos o encaixe. Para indicar proximidade, use PAD STACK e PAD REACH dos apoios, com a mesma convenção de medida em ambas as bicicletas.'
  };

  function numberFrom(value) {
    const raw = String(value ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) && n > 0 && n < 2000 ? n : null;
  }

  function parseInterval(text) {
    const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const low = numberFrom(match[1]);
    const high = numberFrom(match[2]);
    return low !== null && high !== null && low <= high ? [low, high] : null;
  }

  function display(n) {
    return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  function signed(n) {
    if (!n) return '0';
    return (n > 0 ? '+' : '−') + display(Math.abs(n));
  }

  function deviation(value, reference) {
    if (Array.isArray(reference)) {
      if (value < reference[0]) return reference[0] - value;
      if (value > reference[1]) return value - reference[1];
      return 0;
    }
    return Math.abs(value - reference);
  }

  // Retorna apenas uma preferência de proximidade geométrica: nunca um "fit ideal".
  function compare(a, b, reference, mode = 'road') {
    const rawDelta = { stack: b.stack - a.stack, reach: b.reach - a.reach };
    const tt = mode === 'tt';
    const padDelta = tt && a.padStack && a.padReach && b.padStack && b.padReach
      ? { padStack: b.padStack - a.padStack, padReach: b.padReach - a.padReach } : null;
    const output = {
      delta: rawDelta, padDelta,
      distanceA: null, distanceB: null,
      winner: null, status: 'comparison',
      conclusion: tt
        ? 'Quadros TT comparados. Para avaliar proximidade de posição, informe pad stack e pad reach das duas montagens e uma referência profissional dos apoios. Só a geometria do quadro não permite indicar vencedora.'
        : 'Comparação geométrica disponível. Para indicar proximidade de ajuste, informe stack e reach de uma referência profissional validada na avaliação.'
    };
    if (!reference) return output;

    const axisX = tt ? 'padStack' : 'stack';
    const axisY = tt ? 'padReach' : 'reach';
    if (tt && (!padDelta || !reference.padStack || !reference.padReach)) return output;
    if (!reference[axisX] || !reference[axisY]) return output;

    const da = {
      [axisX]: deviation(a[axisX], reference[axisX]),
      [axisY]: deviation(a[axisY], reference[axisY]),
    };
    const db = {
      [axisX]: deviation(b[axisX], reference[axisX]),
      [axisY]: deviation(b[axisY], reference[axisY]),
    };
    output.distanceA = da;
    output.distanceB = db;

    const bothInside = da[axisX] === 0 && da[axisY] === 0 && db[axisX] === 0 && db[axisY] === 0;
    const equalDistances = da[axisX] === db[axisX] && da[axisY] === db[axisY];
    const aDominates = da[axisX] <= db[axisX] && da[axisY] <= db[axisY] &&
      (da[axisX] < db[axisX] || da[axisY] < db[axisY]);
    const bDominates = db[axisX] <= da[axisX] && db[axisY] <= da[axisY] &&
      (db[axisX] < da[axisX] || db[axisY] < da[axisY]);

    if (bothInside) {
      output.status = 'tie';
      output.conclusion = tt
        ? 'As duas montagens atingem a referência informada para os apoios. Sem preferência clara: confira limites de regulagem, posição do selim e avaliação dinâmica.'
        : 'Os dois quadros estão dentro da faixa de referência. Não há preferência geométrica clara: compare montagem, ajustes e posicionamento dinâmico.';
    } else if (equalDistances) {
      output.status = 'tie';
      output.conclusion = tt
        ? 'As duas montagens têm desvios iguais de pad stack e pad reach frente à referência. Sem preferência geométrica clara: confira a regulagem dos apoios.'
        : 'Os dois quadros têm desvios iguais de stack e reach frente à referência. Não há preferência geométrica clara; compare as montagens e a posição dinâmica.';
    } else if (aDominates || bDominates) {
      output.winner = aDominates ? 'A' : 'B';
      output.status = 'preliminary';
      output.conclusion = tt
        ? `A montagem TT ${output.winner} está mais próxima (ou igual) nos dois eixos dos apoios em relação à referência profissional. Confirme que a regulagem é atingível no modelo real, com a posição dinâmica e de selim desejada.`
        : `O quadro ${output.winner} apresenta desvios menores ou iguais em stack e reach em relação à referência escolhida. É uma preferência geométrica preliminar, não uma indicação definitiva de bike fit.`;
    } else {
      output.status = 'mixed';
      output.conclusion = tt
        ? 'Não há preferência clara nos apoios: uma montagem se aproxima mais em pad stack e a outra em pad reach. Verifique a faixa de ajuste real e o teste dinâmico.'
        : 'Não há superioridade geométrica clara: um quadro se aproxima mais em stack e o outro em reach. A decisão depende da posição de contato desejada, da montagem e do teste dinâmico.';
    }
    return output;
  }

  // Reaproveita exatamente o motor exploratório do módulo de pré-fit.
  // Nunca transpõe stack/reach de quadro Road/MTB para pad stack/reach de TT.
  function athleteReference(mode) {
    if (mode === 'tt') return { value: null,
      note: 'TT: a antropometria não define automaticamente pad stack e pad reach. Informe uma referência profissional dos apoios.' };
    const body = Object.fromEntries(ANTHRO_FIELDS.map(([key]) =>
      [key, document.getElementById(key)?.value || '']));
    const missing = ANTHRO_FIELDS.filter(([key]) => !String(body[key]).trim())
      .map(([,label]) => label);
    if (missing.length) return { value: null,
      note: `Complete a antropometria para ativar o filtro: ${missing.join(', ')}.` };
    const engine = globalThis.PAIVA_BIKE_PROJECT;
    const base = typeof globalThis.frameReference === 'function'
      ? globalThis.frameReference(numberFrom(body.height), mode) : null;
    const draft = engine?.getDraft?.();
    const profile = PROFILE_LABELS[draft?.profile] ? draft.profile : 'balanced';
    const value = engine?.estimate?.(body, base, profile) || null;
    if (!value) return { value: null,
      note: 'Confira as medidas antropométricas. O filtro requer valores válidos e uma referência de estatura da modalidade.' };
    return { value, profile,
      note: `Pré-fit · ${PROFILE_LABELS[profile]}: stack ${display(value.stack)} mm / reach ${display(value.reach)} mm. Referência antropométrica experimental, não posição prescrita.` };
  }

  function axisDescription(delta, nameB, nameA) {
    const phrase = (amount, larger, smaller, axis) => amount === 0
      ? `o mesmo ${axis}` : `${display(Math.abs(amount))} mm de ${axis} ${amount > 0 ? larger : smaller}`;
    return `${nameB} apresenta ${phrase(delta.stack,'a mais','a menos','stack')} e ` +
      `${phrase(delta.reach,'a mais','a menos','reach')} em relação à ${nameA}.`;
  }

  function technicalReport(d, comparison) {
    const passages = [axisDescription(comparison.delta, d.b.name, d.a.name)];
    if (d.reference) {
      const label = d.referenceSource === 'anthropometry'
        ? 'referência exploratória obtida da antropometria'
        : 'referência profissional informada';
      passages.push(`O filtro utiliza a ${label}. Os desvios são distâncias geométricas por eixo, não diferenças diretas na posição das mãos.`);
      if (comparison.distanceA && comparison.distanceB) {
        const axisX = d.mode === 'tt' ? 'padStack' : 'stack';
        const axisY = d.mode === 'tt' ? 'padReach' : 'reach';
        passages.push(`${d.a.name}: desvios ${display(comparison.distanceA[axisX])} mm / ${display(comparison.distanceA[axisY])} mm. ` +
          `${d.b.name}: desvios ${display(comparison.distanceB[axisX])} mm / ${display(comparison.distanceB[axisY])} mm (altura / alcance).`);
      }
    } else passages.push('Sem referência válida do atleta ou dos apoios, o sistema descreve as diferenças, mas não indica preferência entre os quadros.');
    passages.push(comparison.conclusion);
    passages.push(d.mode === 'tt'
      ? 'Antes da escolha, conferir faixa de regulagem dos pads, posição do selim, geometria do modelo e análise dinâmica.'
      : d.mode === 'mtb'
        ? 'Antes da escolha, conferir mesa, guidão, altura dos apoios, suspensão/SAG, posição do selim e análise dinâmica.'
        : 'Antes da escolha, conferir mesa, espaçadores, guidão, posições de apoio das mãos, selim e análise dinâmica.');
    if (d.referenceSource === 'anthropometry') passages.push(
      'Esta comparação usa a hipótese exploratória do pré-fit, sem validação clínica para prescrever quadros. A conclusão exige revisão do bike fitter.');
    return passages;
  }

  function aiReportPrompt(d, comparison) {
    const body = ANTHRO_FIELDS.map(([key,label]) => {
      const value = document.getElementById(key)?.value?.trim();
      return value ? `${label}: ${value} cm` : null;
    }).filter(Boolean);
    const target = d.referenceLabel || 'Não há referência individual válida';
    const measure = bike => `${bike.name}: stack ${display(bike.stack)} mm; ` +
      `reach ${display(bike.reach)} mm` + (d.mode === 'tt' && bike.padStack && bike.padReach
        ? `; pad stack ${display(bike.padStack)} mm; pad reach ${display(bike.padReach)} mm` : '');
    return [
      'Atue como assistente técnico de um bike fitter. Redija um laudo comparativo em português do Brasil (até 220 palavras).',
      'Não invente fórmulas validadas, ângulos, marcas de geometria, medidas ausentes ou compatibilidade clínica.',
      'O filtro antropométrico do PAIVA é experimental. Não afirme que uma bicicleta serve melhor sem referência e possibilidade de montagem verificadas.',
      'Mostre diferenças, vantagens geométricas relativas, limites e próximos pontos a conferir no bike fit dinâmico.',
      `Modalidade: ${MODALITIES[d.mode]}.`,
      `Antropometria (sem identificação pessoal): ${body.length ? body.join('; ') : 'não informada'}.`,
      `Bicicleta 01: ${measure(d.a)}.`,
      `Bicicleta 02: ${measure(d.b)}.`,
      `Referência: ${target}.`,
      `Diferenças B - A: stack ${signed(comparison.delta.stack)} mm; reach ${signed(comparison.delta.reach)} mm.`,
      `Resultado do filtro local: ${comparison.conclusion}`,
      'Inclua uma conclusão preliminar, ressalvando que o profissional decidirá após verificar regulagens e movimento.'
    ].join('\n');
  }

  // Duas leituras do pré-fit. A antropometria completa descreve proporções
  // reais; não transforma segmentos corporais em stack/reach "ideais" sem
  // um modelo validado e uma referência de posição dinâmica.
  function initSizingMethod() {
    const anchor = document.getElementById('bikeHeading');
    if (!anchor || document.getElementById('paiva-sizing-method')) return;

    const panel = document.createElement('div');
    panel.id = 'paiva-sizing-method';
    panel.innerHTML = `
      <div class="paiva-sizing-heading">
        <span>LEITURA DO PRÉ-FIT</span>
        <button type="button" id="paiva-sizing-help" aria-label="Entender os dois métodos" aria-expanded="false">?</button>
      </div>
      <div class="paiva-sizing-options" role="group" aria-label="Método de leitura da antropometria">
        <button type="button" data-sizing="height" aria-pressed="true">01 · ESTATURA</button>
        <button type="button" data-sizing="full" aria-pressed="false">02 · ANTROPOMETRIA COMPLETA</button>
      </div>
      <div id="paiva-sizing-explain" class="paiva-sizing-explain" hidden>
        <p><strong>Por estatura:</strong> consulta o guia empírico inicial de stack e reach para MTB, Road ou TT. Não define tamanho ideal de quadro.</p>
        <p><strong>Antropometria completa:</strong> considera as proporções de entreperna, tronco líquido, braço líquido, ombros e pé. O quadro "Pré-fit · geometria individual" oferece uma hipótese exploratória de stack/reach a partir dessas medidas e do guia por estatura, sem equivaler a uma fórmula clínica validada.</p>
        <p><strong>Para escolher o quadro:</strong> use as medidas reais de cada bicicleta no comparador e uma posição de referência verificada no bike fit. Na TT, compare também as coordenadas dos apoios de antebraço.</p>
      </div>
      <p id="paiva-sizing-status" class="paiva-sizing-status" aria-live="polite"></p>
      <div id="paiva-sizing-profile" class="paiva-sizing-profile" hidden></div>
      <button id="paiva-sizing-go-compare" type="button" class="paiva-sizing-link" hidden>Comparar quadros desta modalidade</button>`;
    anchor.insertAdjacentElement('afterend', panel);

    const css = document.createElement('style');
    css.id = 'paiva-sizing-style';
    css.textContent = `
      #paiva-sizing-method { margin:14px 0 20px; padding:13px; background:#18212a;
        border:1px solid #40505d; border-radius:13px; }
      #paiva-sizing-method .paiva-sizing-heading { display:flex; justify-content:space-between;
        align-items:center; gap:8px; color:#a3b4c0; font-size:10px; font-weight:800; letter-spacing:.09em; }
      #paiva-sizing-method #paiva-sizing-help { width:30px; height:30px; border-radius:50%;
        border:1px solid #8193a0; color:#edf3f5; background:#24313b; font-weight:850;
        cursor:pointer; }
      #paiva-sizing-method .paiva-sizing-options { display:flex; flex-wrap:wrap;
        gap:8px; margin-top:12px; }
      #paiva-sizing-method .paiva-sizing-options button { flex:1; min-width:140px;
        padding:11px 12px; border-radius:9px; border:1px solid #637480; background:#0f1921;
        color:#d1dce3; font:750 11px system-ui,sans-serif; cursor:pointer; }
      #paiva-sizing-method .paiva-sizing-options button[aria-pressed="true"] {
        background:#d8e2e9; color:#16212a; border-color:#d8e2e9; }
      #paiva-sizing-method .paiva-sizing-status { color:#c4d0d8; font-size:11px;
        line-height:1.55; margin:11px 0 0; }
      #paiva-sizing-method .paiva-sizing-explain { margin-top:10px; padding:11px 12px;
        background:#101a22; color:#d0dbe2; border:1px solid #495a66;
        border-radius:10px; font-size:11px; line-height:1.6; }
      #paiva-sizing-method .paiva-sizing-explain p { margin:0 0 9px; }
      #paiva-sizing-method .paiva-sizing-explain p:last-child { margin-bottom:0; }
      #paiva-sizing-method .paiva-sizing-profile { display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:10px; }
      #paiva-sizing-method .paiva-sizing-metric { border:1px solid #445561;
        border-radius:9px; background:#111b24; min-width:0; padding:9px; }
      #paiva-sizing-method .paiva-sizing-metric span { display:block; font-size:10px;
        color:#9cafbb; margin-bottom:5px; }
      #paiva-sizing-method .paiva-sizing-metric strong { color:#eff5f7;
        font-size:14px; font-variant-numeric:tabular-nums; }
      #paiva-sizing-method .paiva-sizing-link { background:none; border:0;
        border-bottom:1px solid #9fb4c1; padding:7px 1px; margin-top:10px;
        color:#c4dce7; cursor:pointer; font-size:11px; font-weight:750; }
      #paiva-sizing-method [hidden] { display:none!important; }
      body.paiva-full-anthro .paiva-bike-photo .photo-reach,
      body.paiva-full-anthro .paiva-bike-photo .photo-stack,
      body.paiva-full-anthro #results .paiva-empirical-ref { display:none!important; }
      @media(max-width:480px){ #paiva-sizing-method .paiva-sizing-profile {
        grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media print { #paiva-sizing-method { display:none!important; } }`;
    document.head.append(css);

    const id = key => document.getElementById('paiva-sizing-' + key);
    const coreIds = [
      ['height', 'Estatura'], ['inseam', 'Entreperna'], ['torso', 'Tronco líquido'],
      ['arm', 'Braço líquido'], ['shoulder', 'Ombros'], ['foot', 'Pé']
    ];
    let method = 'height';
    let lastRows = [];
    const get = key => {
      const raw = document.getElementById(key)?.value.trim().replace(',', '.') || '';
      const n = Number(raw);
      return raw !== '' && Number.isFinite(n) && n > 0 ? n : null;
    };

    function render() {
      const mode = document.querySelector('[data-mode].active')?.dataset.mode || 'road';
      const profile = id('profile');
      profile.replaceChildren();
      profile.hidden = method !== 'full';
      id('go-compare').hidden = method !== 'full';
      document.body.classList.toggle('paiva-full-anthro', method === 'full');
      document.querySelectorAll('#paiva-sizing-method [data-sizing]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.sizing === method));
      });
      document.querySelectorAll('#results .result').forEach(item => {
        const title = item.querySelector('.head span')?.textContent.trim() || '';
        item.classList.toggle('paiva-empirical-ref', /^(stack|reach)\b/i.test(title));
      });
      if (method === 'height') {
        id('status').textContent = `Referência inicial por estatura · ${MODALITIES[mode]}.`;
        lastRows = [{ label: 'Método de leitura', value: 'Estatura · guia empírico (sem prescrição de quadro)' }];
        return;
      }

      const height = get('height');
      const missing = coreIds.filter(([key]) => get(key) === null).map(([, label]) => label);
      id('status').textContent = missing.length
        ? `Perfil proporcional · ${MODALITIES[mode]} · complete: ${missing.join(', ')}.`
        : `Perfil proporcional completo · ${MODALITIES[mode]} · 6 medidas registradas.`;
      lastRows = [{ label: 'Método de leitura', value: 'Antropometria completa · leitura das proporções' }];
      for (const [key, label] of coreIds) {
        const n = get(key);
        if (n === null) continue;
        const value = `${n.toLocaleString('pt-BR', {maximumFractionDigits:1})} cm`;
        let ratio = null;
        if (height && key !== 'height') ratio = 100 * n / height;
        const box = document.createElement('div');
        box.className = 'paiva-sizing-metric';
        const small = document.createElement('span');
        small.textContent = label;
        const strong = document.createElement('strong');
        strong.textContent = ratio === null ? value : `${ratio.toLocaleString('pt-BR', {maximumFractionDigits:1})}%`;
        strong.title = ratio === null ? value : `${value} · proporção da estatura`;
        box.append(small, strong);
        profile.append(box);
        lastRows.push({ label: key === 'height' ? 'Estatura' : `${label} / estatura`,
          value: ratio === null ? value : `${value} · ${ratio.toLocaleString('pt-BR', {maximumFractionDigits:1})}%` });
      }
      if (height && !missing.length) {
        lastRows.push({ label: 'O que significam as porcentagens?',
          value: 'Cada porcentagem mostra o comprimento de uma medida em relação à estatura. A entreperna ajuda a observar a proporção dos membros inferiores; tronco e braço ajudam a interpretar o alcance dos segmentos superiores. São medidas distintas e não devem ser somadas para totalizar 100%.' });
      }
      lastRows.push({ label: 'Stack e reach por antropometria',
        value: 'Hipóteses exploratórias no projeto individual; não são prescrição nem prova de compatibilidade do quadro.' });
    }

    document.querySelectorAll('#paiva-sizing-method [data-sizing]').forEach(btn => {
      btn.addEventListener('click', () => { method = btn.dataset.sizing; render(); });
    });
    id('help').addEventListener('click', () => {
      const open = id('explain').hidden;
      id('explain').hidden = !open;
      id('help').setAttribute('aria-expanded', String(open));
    });
    id('go-compare').addEventListener('click', () => {
      document.getElementById('paiva-compare')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    document.querySelectorAll('#fields input').forEach(input => {
      input.addEventListener('input', () => setTimeout(render, 0));
      input.addEventListener('change', () => setTimeout(render, 0));
    });
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(render, 0));
    });
    globalThis.PAIVA_ANTHRO_METHOD = {
      getMode: () => method,
      getReport() { render(); return { mode: method, rows: [...lastRows] }; }
    };
    render();
  }

  function init() {
    initSizingMethod();
    const footer = document.querySelector('main > footer');
    if (!footer || document.getElementById('paiva-compare')) return;

    const section = document.createElement('section');
    section.id = 'paiva-compare';
    section.className = 'card paiva-compare';
    section.innerHTML = `
      <div class="paiva-cmp-heading">
        <div>
          <span class="paiva-cmp-eyebrow">PAIVA · FILTRO GEOMÉTRICO ASSISTIDO</span>
          <h2>Comparador de quadros</h2>
          <p>O sistema cruza a antropometria do cliente com duas geometrias da mesma modalidade e apresenta uma leitura técnica. A confirmação final é feita no bike fit.</p>
        </div>
        <span id="paiva-cmp-mode" class="paiva-cmp-mode">Speed / Road</span>
      </div>
      <div class="paiva-cmp-select" role="group" aria-label="Modalidade dos quadros comparados">
        <button type="button" data-cmp-select="mtb" aria-pressed="false">MTB</button>
        <button type="button" data-cmp-select="road" aria-pressed="true">ROAD / SPEED</button>
        <button type="button" data-cmp-select="tt" aria-pressed="false">TT / TRIATLO</button>
      </div>
      <details class="paiva-cmp-explain">
        <summary aria-label="Ajuda sobre as medidas do quadro">? <span>Entenda a comparação</span></summary>
        <p class="paiva-cmp-mode-note" id="paiva-cmp-mode-note"></p>
        <p class="paiva-cmp-disclaimer">Cada modalidade guarda sua própria comparação. Nenhuma estimativa antropométrica é transferida entre MTB, Road e TT. Os valores devem vir da ficha geométrica do fabricante ou de medição profissional. A decisão final depende da montagem e do bike fit dinâmico.</p>
      </details>
      <div class="paiva-cmp-grid">
        <fieldset class="paiva-cmp-frame">
          <legend>01 · Bicicleta A</legend>
          <label>Marca / modelo <input id="paiva-cmp-a-name" type="text" maxlength="75" placeholder="Ex.: Modelo A" autocomplete="off" /></label>
          <div class="paiva-cmp-dimensions">
            <label>Stack do quadro <small>mm</small><input id="paiva-cmp-a-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 565" /></label>
            <label>Reach do quadro <small>mm</small><input id="paiva-cmp-a-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 390" /></label>
          </div>
          <div class="paiva-cmp-pad-fields" data-pad-only hidden>
            <div class="paiva-cmp-dimensions">
              <label>Pad stack <small>mm</small><input id="paiva-cmp-a-pad-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 640" /></label>
              <label>Pad reach <small>mm</small><input id="paiva-cmp-a-pad-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 470" /></label>
            </div>
          </div>
        </fieldset>
        <fieldset class="paiva-cmp-frame">
          <legend>02 · Bicicleta B</legend>
          <label>Marca / modelo <input id="paiva-cmp-b-name" type="text" maxlength="75" placeholder="Ex.: Modelo B" autocomplete="off" /></label>
          <div class="paiva-cmp-dimensions">
            <label>Stack do quadro <small>mm</small><input id="paiva-cmp-b-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 585" /></label>
            <label>Reach do quadro <small>mm</small><input id="paiva-cmp-b-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 398" /></label>
          </div>
          <div class="paiva-cmp-pad-fields" data-pad-only hidden>
            <div class="paiva-cmp-dimensions">
              <label>Pad stack <small>mm</small><input id="paiva-cmp-b-pad-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 660" /></label>
              <label>Pad reach <small>mm</small><input id="paiva-cmp-b-pad-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 480" /></label>
            </div>
          </div>
        </fieldset>
      </div>
      <div class="paiva-cmp-auto" aria-live="polite">
        <div class="paiva-cmp-auto-head"><span>REFERÊNCIA DO ATLETA</span>
          <strong id="paiva-cmp-auto-label">Verificando antropometria...</strong></div>
        <p id="paiva-cmp-auto-status">Preencha a ficha do atleta para ativar o filtro automático.</p>
      </div>
      <details class="paiva-cmp-reference">
        <summary>Substituir pelo stack/reach de referência profissional (opcional)</summary>
        <p id="paiva-cmp-target-note">Informe o stack e o reach de quadro usados como referência na sua avaliação ou de uma bicicleta já ajustada. Não confunda estas dimensões com coordenadas do guidão.</p>
        <div class="paiva-cmp-target" data-frame-reference>
          <label>Stack de referência (mm)<input id="paiva-cmp-target-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 575" /></label>
          <label>Reach de referência (mm)<input id="paiva-cmp-target-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 395" /></label>
        </div>
        <div class="paiva-cmp-target" data-pad-only hidden>
          <label>Pad stack de referência (mm)<input id="paiva-cmp-target-pad-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 650" /></label>
          <label>Pad reach de referência (mm)<input id="paiva-cmp-target-pad-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 475" /></label>
        </div>
      </details>
      <div class="paiva-cmp-actions">
        <button class="btn primary" type="button" id="paiva-cmp-run">Gerar laudo comparativo</button>
        <button class="btn" type="button" id="paiva-cmp-ai-prep">Preparar dados para IA</button>
        <button class="btn" type="button" id="paiva-cmp-clear">Limpar comparação</button>
      </div>
      <div class="paiva-cmp-output" id="paiva-cmp-output" aria-live="polite">
        <p id="paiva-cmp-message">Preencha o stack e o reach dos dois quadros para começar.</p>
      </div>
      <div class="paiva-cmp-ai-panel" id="paiva-cmp-ai-panel" hidden>
        <p>Para pedir uma redação com IA generativa, copie estes dados e cole no ChatGPT. Nenhum nome, e-mail ou telefone é incluído; revise antes de compartilhar.</p>
        <textarea id="paiva-cmp-ai-text" rows="9" readonly aria-label="Texto para a IA"></textarea>
        <div class="paiva-cmp-ai-actions">
          <button class="btn" type="button" id="paiva-cmp-ai-copy">Copiar texto</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT</a>
        </div>
        <p id="paiva-cmp-ai-feedback" role="status" aria-live="polite"></p>
      </div>`;
    footer.before(section);

    const style = document.createElement('style');
    style.id = 'paiva-compare-style';
    style.textContent = `
      #paiva-compare { margin: 22px 0 28px; border: 1px solid #485560;
        background: linear-gradient(155deg,#1c242c,#10161d); }
      #paiva-compare .paiva-cmp-heading { display:flex; flex-wrap:wrap;
        justify-content:space-between; gap:12px; align-items:center; }
      #paiva-compare .paiva-cmp-eyebrow { color:#a5b5c0; font-size:10px;
        letter-spacing:.09em; font-weight:800; }
      #paiva-compare h2 { margin:6px 0 5px; font-size:22px; color:#eef3f5; }
      #paiva-compare .paiva-cmp-heading p { margin:0; max-width:640px;
        font-size:12px; line-height:1.6; color:#aab9c5; }
      #paiva-compare .paiva-cmp-mode { display:inline-flex; border:1px solid #687784;
        color:#e2eaf0; border-radius:999px; padding:9px 13px; font-size:11px; font-weight:750; }
      #paiva-compare .paiva-cmp-select { display:flex; flex-wrap:wrap; gap:7px; margin-top:17px; }
      #paiva-compare .paiva-cmp-select button { border:1px solid #667681; background:#101820;
        color:#cbd9e1; border-radius:9px; font:750 11px system-ui,sans-serif;
        letter-spacing:.03em; padding:11px 15px; cursor:pointer; }
      #paiva-compare .paiva-cmp-select button[aria-pressed="true"] { background:#d8e3e9;
        border-color:#d8e3e9; color:#16212b; }
      #paiva-compare .paiva-cmp-mode-note { margin:11px 0 0; padding:11px 13px;
        border-left:2px solid #94aab8; background:#1a252f; color:#c4d2db;
        font-size:11px; line-height:1.65; border-radius:0 7px 7px 0; }
      #paiva-compare .paiva-cmp-explain { margin-top:10px; }
      #paiva-compare .paiva-cmp-explain summary { display:inline-flex; align-items:center;
        gap:7px; cursor:pointer; border:1px solid #637682; color:#ecf3f6;
        background:#22303b; border-radius:30px; padding:6px 10px;
        font-size:12px; font-weight:800; list-style:none; }
      #paiva-compare .paiva-cmp-explain summary::-webkit-details-marker { display:none; }
      #paiva-compare .paiva-cmp-explain summary span { font-size:10px;
        color:#b6c6cf; font-weight:600; }
      #paiva-compare [hidden] { display:none!important; }
      #paiva-compare .paiva-cmp-pad-fields { border-top:1px solid #364551; padding-top:10px; }
      #paiva-compare .paiva-cmp-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px; margin-top:22px; }
      #paiva-compare .paiva-cmp-frame { min-width:0; margin:0; padding:15px;
        border:1px solid #48545f; border-radius:13px; background:#111922; }
      #paiva-compare .paiva-cmp-frame legend { padding:0 6px; font-size:13px;
        font-weight:800; color:#dce8ef; }
      #paiva-compare label { display:block; font-size:11px; font-weight:750;
        color:#c8d3da; min-width:0; }
      #paiva-compare label small { float:right; color:#8297a6; font-size:10px; }
      #paiva-compare input { display:block; margin:7px 0 11px; width:100%; box-sizing:border-box;
        background:#0b1118; border:1px solid #52616d; border-radius:9px;
        color:#f0f5f7; font:650 13px system-ui,sans-serif; padding:11px; min-width:0; }
      #paiva-compare input:focus { outline:2px solid #8394a1; outline-offset:1px; }
      #paiva-compare .paiva-cmp-dimensions, #paiva-compare .paiva-cmp-target {
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
      #paiva-compare .paiva-cmp-auto { margin-top:16px; border:1px solid #50606b;
        border-radius:12px; padding:12px 13px; background:#111922; }
      #paiva-compare .paiva-cmp-auto-head { display:flex; align-items:center;
        flex-wrap:wrap; justify-content:space-between; gap:5px 14px; }
      #paiva-compare .paiva-cmp-auto-head span { color:#a5b4bf; font-size:9px;
        font-weight:800; letter-spacing:.1em; }
      #paiva-compare .paiva-cmp-auto-head span::before { content:'';display:inline-block;
        width:4px;height:4px;margin-right:8px;border-radius:50%;background:#d8bd6d;
        vertical-align:middle; }
      #paiva-compare .paiva-cmp-auto-head strong { color:#e9eff2; font-size:11px; }
      #paiva-compare .paiva-cmp-auto p { margin:8px 0 0;color:#afc1cb;
        font-size:11px;line-height:1.6; }
      #paiva-compare .paiva-cmp-reference { margin-top:16px;
        border:1px solid #3e4b55; border-radius:12px; padding:11px 13px; }
      #paiva-compare .paiva-cmp-reference summary { color:#e0e8ed;
        font-size:12px; font-weight:750; cursor:pointer; }
      #paiva-compare .paiva-cmp-reference p { color:#aebbc4;
        font-size:11px; line-height:1.6; }
      #paiva-compare .paiva-cmp-actions { display:flex; flex-wrap:wrap; gap:8px;
        margin:16px 0 0; }
      #paiva-compare .paiva-cmp-output { border:1px solid #586773; background:#101820;
        border-radius:12px; padding:15px; margin-top:14px; }
      #paiva-compare .paiva-cmp-output p { margin:7px 0; color:#d4e0e7;
        font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
      #paiva-compare .paiva-cmp-output strong { color:#f0f5f7; }
      #paiva-compare .paiva-cmp-comparison { display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:12px 0; }
      #paiva-compare .paiva-cmp-comparison > div { background:#1c2730;
        border:1px solid #42525f; border-radius:10px; padding:11px; }
      #paiva-compare .paiva-cmp-comparison span { display:block; color:#9dafbc;
        font-size:10px; margin-bottom:4px; }
      #paiva-compare .paiva-cmp-comparison strong { font-size:15px; }
      #paiva-compare .paiva-cmp-disclaimer { font-size:10px; line-height:1.6;
        color:#92a2ae; margin:14px 0 0; }
      #paiva-compare .paiva-cmp-assessment { margin-top:14px;
        padding:15px 14px;border:1px solid #697a85;border-radius:12px;
        background:#151d24; }
      #paiva-compare .paiva-cmp-assessment h3 { margin:0 0 12px;
        font-size:13px;letter-spacing:.01em;color:#f0f5f7; }
      #paiva-compare .paiva-cmp-assessment p { margin:8px 0;
        font-size:11px;line-height:1.7;color:#c6d3da; }
      #paiva-compare .paiva-cmp-assessment small {display:block;margin-top:12px;
        font-size:9px;color:#92a2ae;line-height:1.6;}
      #paiva-compare .paiva-cmp-ai-panel { margin-top:12px;padding:13px;
        border:1px solid #4f606a;border-radius:12px;background:#101820; }
      #paiva-compare .paiva-cmp-ai-panel p { color:#bacad3;font-size:11px;
        line-height:1.6; margin:0 0 9px; }
      #paiva-compare .paiva-cmp-ai-panel textarea { box-sizing:border-box;
        width:100%;min-height:150px;background:#080e14;color:#d7e2e8;
        border:1px solid #596d79;border-radius:8px;padding:12px;
        font:11px/1.55 ui-monospace,monospace;resize:vertical; }
      #paiva-compare .paiva-cmp-ai-actions { display:flex;align-items:center;
        flex-wrap:wrap;gap:12px;margin-top:9px; }
      #paiva-compare .paiva-cmp-ai-actions a { color:#dfc67d;font-size:11px; }
      @media(max-width:680px){ #paiva-compare .paiva-cmp-grid { grid-template-columns:1fr; }
        #paiva-compare { padding:15px; } #paiva-compare h2 { font-size:19px; } }
      @media print { #paiva-compare { display:none!important; } }
    `;
    document.head.append(style);

    const id = name => document.getElementById('paiva-cmp-' + name);
    const currentMode = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
    const fields = ['a-name','a-stack','a-reach','a-pad-stack','a-pad-reach',
      'b-name','b-stack','b-reach','b-pad-stack','b-pad-reach',
      'target-stack','target-reach','target-pad-stack','target-pad-reach'];
    const drafts = { mtb: {}, road: {}, tt: {} };
    let selectedMode = currentMode();
    let lastData = null;

    function saveDraft(mode) {
      drafts[mode] = Object.fromEntries(fields.map(field => [field, id(field).value]));
    }

    function restoreDraft(mode) {
      fields.forEach(field => { id(field).value = drafts[mode][field] || ''; });
    }

    function switchMode(next, synchronize = true) {
      if (!MODALITIES[next]) return;
      if (next !== selectedMode) {
        saveDraft(selectedMode);
        selectedMode = next;
        restoreDraft(next);
      }
      document.querySelectorAll('#paiva-compare [data-cmp-select]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.cmpSelect === next));
      });
      id('mode-note').textContent = MODE_NOTES[next];
      document.querySelectorAll('#paiva-compare [data-pad-only]').forEach(group => {
        group.hidden = next !== 'tt';
      });
      document.querySelectorAll('#paiva-compare [data-frame-reference]').forEach(group => {
        group.hidden = next === 'tt';
      });
      id('target-note').textContent = next === 'tt'
        ? 'Para TT, a referência precisa ser do centro do movimento central ao topo e à borda posterior do apoio de antebraço (pad). Compare montagens usando exatamente os mesmos pontos anatômicos e convenções.'
        : 'Informe stack e reach de quadro de referência da MESMA modalidade, aferidos na ficha do fabricante ou em bicicleta ajustada. Esses pontos não são a posição do guidão.';
      if (synchronize && currentMode() !== next) {
        document.querySelector(`[data-mode="${next}"]`)?.click();
      }
      render();
    }

    function read() {
      const a = { name: id('a-name').value.trim() || 'Bicicleta A',
        stack: numberFrom(id('a-stack').value), reach: numberFrom(id('a-reach').value),
        padStack: numberFrom(id('a-pad-stack').value), padReach: numberFrom(id('a-pad-reach').value) };
      const b = { name: id('b-name').value.trim() || 'Bicicleta B',
        stack: numberFrom(id('b-stack').value), reach: numberFrom(id('b-reach').value),
        padStack: numberFrom(id('b-pad-stack').value), padReach: numberFrom(id('b-pad-reach').value) };
      const mode = selectedMode;
      const stackTarget = numberFrom(id(mode === 'tt' ? 'target-pad-stack' : 'target-stack').value);
      const reachTarget = numberFrom(id(mode === 'tt' ? 'target-pad-reach' : 'target-reach').value);
      const oneTarget = (stackTarget !== null) !== (reachTarget !== null);
      const valid = a.stack !== null && a.reach !== null &&
        b.stack !== null && b.reach !== null;
      let reference = null;
      let referenceLabel = '';
      let referenceSource = 'none';
      const athlete = athleteReference(mode);
      if (!oneTarget && stackTarget !== null && reachTarget !== null) {
        reference = mode === 'tt'
          ? { padStack: stackTarget, padReach: reachTarget }
          : { stack: stackTarget, reach: reachTarget };
        referenceSource = 'professional';
        referenceLabel = mode === 'tt'
          ? `Referência profissional TT: Pad stack ${display(stackTarget)} mm / Pad reach ${display(reachTarget)} mm.`
          : `Referência profissional ${MODALITIES[mode]}: Stack ${display(stackTarget)} mm / Reach ${display(reachTarget)} mm.`;
      } else if (!oneTarget && mode !== 'tt' && athlete.value) {
        reference = { stack: athlete.value.stack, reach: athlete.value.reach };
        referenceSource = 'anthropometry';
        referenceLabel = `Pré-fit antropométrico experimental (${PROFILE_LABELS[athlete.profile]}): ` +
          `Stack ${display(reference.stack)} mm / Reach ${display(reference.reach)} mm. ` +
          'Hipótese exploratória, não medida de fit validada.';
      }
      return { a, b, reference, referenceLabel, referenceSource, athlete, oneTarget, valid, mode };
    }

    function render() {
      const d = read();
      id('ai-panel').hidden = true;
      id('mode').textContent = MODALITIES[d.mode] || d.mode;
      id('auto-label').textContent = d.referenceSource === 'professional'
        ? 'Referência profissional ativa'
        : d.athlete.value ? `Pré-fit ${PROFILE_LABELS[d.athlete.profile]} disponível`
          : 'Referência automática indisponível';
      id('auto-status').textContent = d.referenceSource === 'professional'
        ? 'Os dois valores da referência profissional substituem a hipótese antropométrica nesta comparação.'
        : d.athlete.note;
      const output = id('output');
      output.replaceChildren();
      lastData = null;
      function paragraph(text, strong = false) {
        const p = document.createElement('p');
        if (strong) { const b = document.createElement('strong'); b.textContent = text; p.append(b); }
        else p.textContent = text;
        output.append(p);
      }
      if (!d.valid) {
        paragraph(`Preencha o stack e o reach dos dois quadros de ${MODALITIES[d.mode]} para iniciar a comparação. Não utilize medidas de outra modalidade.`);
        return;
      }
      const comparison = compare(d.a, d.b, d.oneTarget ? null : d.reference, d.mode);
      const delta = comparison.delta;
      paragraph(`Diferenças da bicicleta B em relação à A: Stack ${signed(delta.stack)} mm; Reach ${signed(delta.reach)} mm.`, true);
      if (d.mode === 'tt') {
        if (comparison.padDelta) {
          paragraph(`Diferenças entre os apoios (B − A): Pad stack ${signed(comparison.padDelta.padStack)} mm; Pad reach ${signed(comparison.padDelta.padReach)} mm.`, true);
        } else {
          paragraph('Na TT, preencha pad stack e pad reach das duas montagens para comparar a posição dos apoios. Sem isso, o resultado é apenas descritivo.');
        }
      }
      if (d.oneTarget) {
        paragraph(d.mode === 'tt'
          ? 'Para usar a referência TT, preencha os dois campos: pad stack e pad reach.'
          : 'Para usar a referência profissional, preencha os dois campos: stack e reach.');
        return;
      }
      paragraph(d.referenceLabel || 'Sem referência profissional: comparação descritiva, sem indicação automática de tamanho ou vencedor.');
      const grid = document.createElement('div');
      grid.className = 'paiva-cmp-comparison';
      for (const [letter, bike, distance] of [
        ['A', d.a, comparison.distanceA], ['B', d.b, comparison.distanceB]]) {
        const box = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = `Quadro ${letter} · ${bike.name}`;
        const value = document.createElement('strong');
        value.textContent = distance
          ? d.mode === 'tt'
            ? `Desvio Pad stack ${display(distance.padStack)} mm · Pad reach ${display(distance.padReach)} mm`
            : `Desvio Stack ${display(distance.stack)} mm · Reach ${display(distance.reach)} mm`
          : `Quadro: Stack ${display(bike.stack)} mm · Reach ${display(bike.reach)} mm`;
        box.append(title, value);
        grid.append(box);
      }
      output.append(grid);
      const report = technicalReport(d, comparison);
      const article = document.createElement('article');
      article.className = 'paiva-cmp-assessment';
      const title = document.createElement('h3');
      title.textContent = 'Laudo automático · análise geométrica';
      article.append(title);
      for (const sentence of report) {
        const item = document.createElement('p');
        item.textContent = sentence;
        article.append(item);
      }
      const footnote = document.createElement('small');
      footnote.textContent = 'Gerado pelo motor de regras local do PAIVA. Ainda não utiliza IA generativa online. Revisar antes de entregar ao cliente.';
      article.append(footnote);
      output.append(article);
      lastData = { ...d, comparison, report };
    }

    fields.forEach(field => {
      id(field).addEventListener('input', render);
      id(field).addEventListener('change', render);
    });
    id('run').addEventListener('click', render);
    id('ai-prep').addEventListener('click', () => {
      render();
      if (!lastData) {
        id('output').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      id('ai-text').value = aiReportPrompt(lastData, lastData.comparison);
      id('ai-feedback').textContent = '';
      id('ai-panel').hidden = false;
      id('ai-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    id('ai-copy').addEventListener('click', async () => {
      const field = id('ai-text');
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard indisponível');
        await navigator.clipboard.writeText(field.value);
        id('ai-feedback').textContent = 'Texto copiado. Cole na IA para solicitar a interpretação.';
      } catch (_) {
        field.focus(); field.select();
        id('ai-feedback').textContent = 'Selecione o texto e use Copiar no celular/computador.';
      }
    });
    id('clear').addEventListener('click', () => {
      fields.forEach(field => { id(field).value = ''; });
      render();
    });
    document.querySelectorAll('#paiva-compare [data-cmp-select]').forEach(button => {
      button.addEventListener('click', () => switchMode(button.dataset.cmpSelect));
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => setTimeout(() => switchMode(currentMode(), false), 0));
    });
    document.querySelectorAll('#fields input').forEach(input => {
      input.addEventListener('input', () => setTimeout(render, 0));
    });
    // Delegação: os controles do projeto são montados após o comparador.
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#paiva-bike-project [data-prj-profile], #paiva-sizing-method [data-sizing]'))
        setTimeout(render, 0);
    });

    globalThis.PAIVA_FRAME_COMPARE = {
      compare,
      resetAll() {
        for (const key of Object.keys(drafts)) drafts[key] = {};
        selectedMode = currentMode();
        fields.forEach(field => { id(field).value = ''; });
        switchMode(selectedMode, false);
      },
      getReport() {
        render();
        if (!lastData) return null;
        const { a, b, mode, referenceLabel, referenceSource, comparison, report } = lastData;
        const rows = [
          { label: 'Modalidade da comparação', value: MODALITIES[mode] },
          { label: 'Bicicleta A', value: `${a.name} · Stack ${display(a.stack)} mm · Reach ${display(a.reach)} mm` },
          { label: 'Bicicleta B', value: `${b.name} · Stack ${display(b.stack)} mm · Reach ${display(b.reach)} mm` },
          { label: 'Diferença de stack do quadro (B - A)', value: `${signed(comparison.delta.stack)} mm` },
          { label: 'Diferença de reach do quadro (B - A)', value: `${signed(comparison.delta.reach)} mm` },
        ];
        if (mode === 'tt') {
          for (const [label, bike] of [['A', a], ['B', b]]) {
            rows.push({ label: `Apoios TT ${label}`, value: bike.padStack && bike.padReach
              ? `Pad stack ${display(bike.padStack)} mm · Pad reach ${display(bike.padReach)} mm`
              : 'Não informados' });
          }
          if (comparison.padDelta) {
            rows.push({ label: 'Diferenças dos apoios (B - A)', value:
              `Pad stack ${signed(comparison.padDelta.padStack)} mm · Pad reach ${signed(comparison.padDelta.padReach)} mm` });
          }
        }
        rows.push(
          { label: 'Referência', value: referenceLabel || 'Não informada' },
          { label: 'Tipo de filtro', value: referenceSource === 'anthropometry'
            ? 'Pré-fit antropométrico experimental (não validado)'
            : referenceSource === 'professional' ? 'Referência profissional manual' : 'Descritivo, sem referência' },
          { label: 'Conclusão preliminar', value: comparison.conclusion }
        );
        for (const [index, sentence] of report.entries())
          rows.push({ label: `Laudo · observação ${index + 1}`, value: sentence });
        return {
          rows
        };
      }
    };
    switchMode(selectedMode, false);
    // O projeto antropométrico é inicializado depois deste módulo na página.
    // Atualiza a referência automaticamente ao terminar a inicialização.
    setTimeout(render, 0);
  }

  // Permite testar a lógica sem abrir a interface.
  globalThis.PAIVA_FRAME_COMPARE_LOGIC = { compare, deviation, parseInterval };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
