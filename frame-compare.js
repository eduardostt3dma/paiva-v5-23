/* PAIVA Bike Fit Studio — comparação exploratória de geometrias de quadros.
   Não estima um bike fit definitivo com medidas corporais isoladas. */
(() => {
  'use strict';

  const MODALITIES = { road: 'Speed / Road', mtb: 'MTB', tt: 'Triatlo / TT' };
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
    const aDominates = da[axisX] <= db[axisX] && da[axisY] <= db[axisY] &&
      (da[axisX] < db[axisX] || da[axisY] < db[axisY]);
    const bDominates = db[axisX] <= da[axisX] && db[axisY] <= da[axisY] &&
      (db[axisX] < da[axisX] || db[axisY] < da[axisY]);

    if (bothInside) {
      output.status = 'tie';
      output.conclusion = tt
        ? 'As duas montagens atingem a referência informada para os apoios. Sem preferência clara: confira limites de regulagem, posição do selim e avaliação dinâmica.'
        : 'Os dois quadros estão dentro da faixa de referência. Não há preferência geométrica clara: compare montagem, ajustes e posicionamento dinâmico.';
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
          <span class="paiva-cmp-eyebrow">ANÁLISE COMPARATIVA · NOVO RECURSO</span>
          <h2>Comparador de quadros</h2>
          <p>Compare duas bicicletas da mesma modalidade, com medidas reais. Não existe um stack/reach universal para MTB, Road e TT.</p>
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
      <details class="paiva-cmp-reference">
        <summary>Usar referência profissional personalizada (opcional)</summary>
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
        <button class="btn primary" type="button" id="paiva-cmp-run">Comparar quadros</button>
        <button class="btn" type="button" id="paiva-cmp-clear">Limpar comparação</button>
      </div>
      <div class="paiva-cmp-output" id="paiva-cmp-output" aria-live="polite">
        <p id="paiva-cmp-message">Preencha o stack e o reach dos dois quadros para começar.</p>
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
      if (!oneTarget && stackTarget !== null && reachTarget !== null) {
        reference = mode === 'tt'
          ? { padStack: stackTarget, padReach: reachTarget }
          : { stack: stackTarget, reach: reachTarget };
        referenceLabel = mode === 'tt'
          ? `Referência profissional TT: Pad stack ${display(stackTarget)} mm / Pad reach ${display(reachTarget)} mm.`
          : `Referência profissional ${MODALITIES[mode]}: Stack ${display(stackTarget)} mm / Reach ${display(reachTarget)} mm.`;
      }
      return { a, b, reference, referenceLabel, oneTarget, valid, mode };
    }

    function render() {
      const d = read();
      id('mode').textContent = MODALITIES[d.mode] || d.mode;
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
      paragraph(comparison.conclusion);
      lastData = { ...d, comparison };
    }

    fields.forEach(field => {
      id(field).addEventListener('input', render);
      id(field).addEventListener('change', render);
    });
    id('run').addEventListener('click', render);
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

    globalThis.PAIVA_FRAME_COMPARE = {
      compare,
      getReport() {
        render();
        if (!lastData) return null;
        const { a, b, mode, referenceLabel, comparison } = lastData;
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
          { label: 'Conclusão preliminar', value: comparison.conclusion }
        );
        return {
          rows
        };
      }
    };
    switchMode(selectedMode, false);
  }

  // Permite testar a lógica sem abrir a interface.
  globalThis.PAIVA_FRAME_COMPARE_LOGIC = { compare, deviation, parseInterval };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
