/* PAIVA Bike Fit Studio — comparação exploratória de geometrias de quadros.
   Não estima um bike fit definitivo com medidas corporais isoladas. */
(() => {
  'use strict';

  const MODALITIES = { road: 'Speed / Road', mtb: 'MTB', tt: 'Triatlo / TT' };

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
    const output = {
      delta: rawDelta,
      distanceA: null, distanceB: null,
      winner: null, status: 'comparison',
      conclusion: 'Comparação disponível. Informe uma referência profissional ou a estatura do ciclista para avaliar a proximidade geométrica.'
    };
    if (!reference) return output;

    const da = {
      stack: deviation(a.stack, reference.stack),
      reach: deviation(a.reach, reference.reach),
    };
    const db = {
      stack: deviation(b.stack, reference.stack),
      reach: deviation(b.reach, reference.reach),
    };
    output.distanceA = da;
    output.distanceB = db;

    const bothInside = da.stack === 0 && da.reach === 0 && db.stack === 0 && db.reach === 0;
    const aDominates = da.stack <= db.stack && da.reach <= db.reach &&
      (da.stack < db.stack || da.reach < db.reach);
    const bDominates = db.stack <= da.stack && db.reach <= da.reach &&
      (db.stack < da.stack || db.reach < da.reach);

    if (bothInside) {
      output.status = 'tie';
      output.conclusion = 'Os dois quadros estão dentro da faixa de referência. Não há preferência geométrica clara: compare montagem, ajustes e posicionamento dinâmico.';
    } else if (aDominates || bDominates) {
      output.winner = aDominates ? 'A' : 'B';
      output.status = 'preliminary';
      output.conclusion = `O quadro ${output.winner} apresenta desvios menores ou iguais em stack e reach em relação à referência escolhida. É uma preferência geométrica preliminar, não uma indicação definitiva de bike fit.`;
    } else {
      output.status = 'mixed';
      output.conclusion = 'Não há superioridade geométrica clara: um quadro se aproxima mais em stack e o outro em reach. A decisão depende da posição de contato desejada, da montagem e do teste dinâmico.';
    }

    if (mode === 'tt') {
      output.conclusion += ' Na TT, é indispensável conferir pad stack e pad reach e a posição funcional dos apoios antes de escolher.';
    }
    return output;
  }

  function init() {
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
          <p>Compare a geometria de dois modelos. O PAIVA informa diferenças e proximidade de referência, sempre com interpretação profissional.</p>
        </div>
        <span id="paiva-cmp-mode" class="paiva-cmp-mode">Speed / Road</span>
      </div>
      <div class="paiva-cmp-grid">
        <fieldset class="paiva-cmp-frame">
          <legend>01 · Bicicleta A</legend>
          <label>Marca / modelo <input id="paiva-cmp-a-name" type="text" maxlength="75" placeholder="Ex.: Modelo A" autocomplete="off" /></label>
          <div class="paiva-cmp-dimensions">
            <label>Stack do quadro <small>mm</small><input id="paiva-cmp-a-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 565" /></label>
            <label>Reach do quadro <small>mm</small><input id="paiva-cmp-a-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 390" /></label>
          </div>
        </fieldset>
        <fieldset class="paiva-cmp-frame">
          <legend>02 · Bicicleta B</legend>
          <label>Marca / modelo <input id="paiva-cmp-b-name" type="text" maxlength="75" placeholder="Ex.: Modelo B" autocomplete="off" /></label>
          <div class="paiva-cmp-dimensions">
            <label>Stack do quadro <small>mm</small><input id="paiva-cmp-b-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 585" /></label>
            <label>Reach do quadro <small>mm</small><input id="paiva-cmp-b-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 398" /></label>
          </div>
        </fieldset>
      </div>
      <details class="paiva-cmp-reference">
        <summary>Usar referência profissional personalizada (opcional)</summary>
        <p>Informe o stack e o reach de quadro usados como referência na sua avaliação ou de uma bicicleta já ajustada. Não confunda estas dimensões com coordenadas do guidão.</p>
        <div class="paiva-cmp-target">
          <label>Stack de referência (mm)<input id="paiva-cmp-target-stack" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 575" /></label>
          <label>Reach de referência (mm)<input id="paiva-cmp-target-reach" type="number" inputmode="decimal" min="1" step="0.1" placeholder="Ex.: 395" /></label>
        </div>
      </details>
      <div class="paiva-cmp-actions">
        <button class="btn primary" type="button" id="paiva-cmp-run">Comparar quadros</button>
        <button class="btn" type="button" id="paiva-cmp-clear">Limpar comparação</button>
      </div>
      <div class="paiva-cmp-output" id="paiva-cmp-output" aria-live="polite">
        <p id="paiva-cmp-message">Preencha o stack e o reach dos dois quadros para começar.</p>
      </div>
      <p class="paiva-cmp-disclaimer">Triagem inicial: as faixas automáticas do PAIVA são exploratórias e baseadas em estatura; não definem um bike fit ideal. A decisão depende de mobilidade, posição de selim, mesa, espaçadores, guidão e análise dinâmica. Em TT, conferir também pad stack e pad reach.</p>`;
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
    const fields = ['a-name','a-stack','a-reach','b-name','b-stack','b-reach','target-stack','target-reach'];
    let lastData = null;

    function read() {
      const a = { name: id('a-name').value.trim() || 'Bicicleta A',
        stack: numberFrom(id('a-stack').value), reach: numberFrom(id('a-reach').value) };
      const b = { name: id('b-name').value.trim() || 'Bicicleta B',
        stack: numberFrom(id('b-stack').value), reach: numberFrom(id('b-reach').value) };
      const stackTarget = numberFrom(id('target-stack').value);
      const reachTarget = numberFrom(id('target-reach').value);
      const oneTarget = (stackTarget !== null) !== (reachTarget !== null);
      const mode = currentMode();
      const valid = a.stack !== null && a.reach !== null &&
        b.stack !== null && b.reach !== null;
      let reference = null;
      let referenceLabel = '';
      if (!oneTarget && stackTarget !== null && reachTarget !== null) {
        reference = { stack: stackTarget, reach: reachTarget };
        referenceLabel = `Referência profissional: Stack ${display(stackTarget)} mm / Reach ${display(reachTarget)} mm.`;
      } else if (!oneTarget) {
        const sr = parseInterval(document.getElementById('bikeStack')?.textContent);
        const rr = parseInterval(document.getElementById('bikeReach')?.textContent);
        if (sr && rr) {
          reference = { stack: sr, reach: rr };
          referenceLabel = `Faixas exploratórias por estatura: Stack ${display(sr[0])}–${display(sr[1])} mm / Reach ${display(rr[0])}–${display(rr[1])} mm.`;
        }
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
        paragraph('Preencha o stack e o reach dos dois quadros para iniciar a comparação.');
        return;
      }
      const comparison = compare(d.a, d.b, d.oneTarget ? null : d.reference, d.mode);
      const delta = comparison.delta;
      paragraph(`Diferenças da bicicleta B em relação à A: Stack ${signed(delta.stack)} mm; Reach ${signed(delta.reach)} mm.`, true);
      if (d.oneTarget) {
        paragraph('Para usar a referência profissional, preencha os dois campos: stack e reach.');
        return;
      }
      paragraph(d.referenceLabel || 'Sem faixa disponível: informe a estatura do ciclista ou uma referência profissional.');
      const grid = document.createElement('div');
      grid.className = 'paiva-cmp-comparison';
      for (const [letter, bike, distance] of [
        ['A', d.a, comparison.distanceA], ['B', d.b, comparison.distanceB]]) {
        const box = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = `Quadro ${letter} · ${bike.name}`;
        const value = document.createElement('strong');
        value.textContent = distance
          ? `Desvio Stack ${display(distance.stack)} mm · Reach ${display(distance.reach)} mm`
          : `Stack ${display(bike.stack)} mm · Reach ${display(bike.reach)} mm`;
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
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => setTimeout(render, 0));
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
        return {
          rows: [
            { label: 'Modalidade', value: MODALITIES[mode] },
            { label: 'Bicicleta A', value: `${a.name} · Stack ${display(a.stack)} mm · Reach ${display(a.reach)} mm` },
            { label: 'Bicicleta B', value: `${b.name} · Stack ${display(b.stack)} mm · Reach ${display(b.reach)} mm` },
            { label: 'Diferença de stack (B - A)', value: `${signed(comparison.delta.stack)} mm` },
            { label: 'Diferença de reach (B - A)', value: `${signed(comparison.delta.reach)} mm` },
            { label: 'Referência', value: referenceLabel || 'Não informada' },
            { label: 'Conclusão preliminar', value: comparison.conclusion },
          ]
        };
      }
    };
    render();
  }

  // Permite testar a lógica sem abrir a interface.
  globalThis.PAIVA_FRAME_COMPARE_LOGIC = { compare, deviation, parseInterval };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
