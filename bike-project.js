/* PAIVA Bike Fit Studio — concepção inicial, sem prescrições antropométricas não validadas. */
(() => {
  'use strict';

  const MODES = { road: 'Road / Speed', mtb: 'MTB', tt: 'TT / Triatlo' };
  const PROFILES = {
    aggressive: {
      label: 'Agressivo',
      note: 'Avaliar a viabilidade de uma posição frontal mais baixa e aerodinâmica sem exceder a flexão funcional do quadril, a estabilidade pélvica ou a tolerância cervical.'
    },
    balanced: {
      label: 'Intermediário',
      note: 'Equilibrar sustentação postural, controle, capacidade de produção de força, conforto e exigências da modalidade.'
    },
    comfortable: {
      label: 'Confortável',
      note: 'Priorizar posição de contato menos exigente, respeitando mobilidade, estabilidade e controle. Elevar a frente pode ser considerado quando a montagem permitir.'
    }
  };
  const KEYS = ['crank', 'stem', 'stack', 'reach', 'head-angle', 'spacers',
    'stem-angle', 'contact-x', 'contact-y', 'saddle-y', 'nose-setback',
    'pad-stack', 'pad-reach', 'step', 'trunk-angle', 'elbow-angle'];
  const allowedCranks = ['145', '150', '155', '160', '165', '170', '172.5', '175'];

  function readPositive(value, max = 2000) {
    const s = String(value || '').trim().replace(',', '.');
    const n = Number(s);
    return s && Number.isFinite(n) && n > 0 && n <= max ? n : null;
  }

  function readRange(value, min, max) {
    const s = String(value ?? '').trim().replace(',', '.');
    const n = Number(s);
    return s !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
  }

  /* Sistema cartesiano (mm): origem no eixo do movimento central,
     X horizontal para a frente e Y vertical para cima.
     Isto descreve a MONTAGEM, não prediz a postura biomecânica. */
  function simulateGeometry(data, mode, step = 10) {
    const N = (key, min, max) => readRange(data[key], min, max);
    const saddleY = N('saddle-y', 250, 1200);
    const setback = N('nose-setback', -250, 250);
    const delta = readRange(step, 5, 20);
    if (saddleY === null || setback === null || delta === null) return null;
    const configs = [
      { key: 'aggressive', label: 'Agressivo' },
      { key: 'balanced', label: 'Intermediário' },
      { key: 'comfortable', label: 'Confortável' }
    ];
    if (mode === 'tt') {
      const padS = N('pad-stack', 350, 950);
      const padR = N('pad-reach', 250, 850);
      if (padS === null || padR === null) return null;
      return configs.map(c => {
        const sign = c.key === 'aggressive' ? 1 : c.key === 'comfortable' ? -1 : 0;
        const x = padR + sign * delta;
        const y = padS - sign * delta;
        return { ...c, x, y, reachFromNose: x + setback, drop: saddleY - y,
          note: sign ? 'Cenário hipotético: confirmar curso real dos apoios' : 'Apoios medidos na bicicleta',
          spacers: null, stem: null };
      });
    }
    const stack = N('stack', 300, 800);
    const reach = N('reach', 250, 650);
    const headAngle = N('head-angle', 55, 85);
    const spacers = N('spacers', 0, 100);
    const stem = N('stem', 30, 180);
    const stemAngle = N('stem-angle', -40, 45);
    const offsetX = N('contact-x', -100, 250);
    const offsetY = N('contact-y', -150, 150);
    if ([stack,reach,headAngle,spacers,stem,stemAngle,offsetX,offsetY].some(v => v === null)) return null;
    const a = headAngle * Math.PI / 180;
    const b = (90 - headAngle + stemAngle) * Math.PI / 180;
    return configs.map(c => {
      const sign = c.key === 'aggressive' ? -1 : c.key === 'comfortable' ? 1 : 0;
      const spacer = Math.max(0, spacers + sign * delta);
      const stemLength = Math.max(30, Math.min(180, stem - sign * delta));
      const x = reach - spacer * Math.cos(a) + stemLength * Math.cos(b) + offsetX;
      const y = stack + spacer * Math.sin(a) + stemLength * Math.sin(b) + offsetY;
      let note = 'Cenário de mesa/altura axial para conferir';
      if (sign < 0 && spacers < delta) note = 'Limite geométrico: sem curso axial suficiente para a redução';
      return { ...c, x, y, spacers: spacer, stem: stemLength,
        reachFromNose: x + setback, drop: saddleY - y, note };
    });
  }

  function init() {
    const sizing = document.getElementById('paiva-sizing-method');
    if (!sizing || document.getElementById('paiva-bike-project')) return;
    const panel = document.createElement('div');
    panel.id = 'paiva-bike-project';
    panel.innerHTML = `
      <div class="paiva-prj-heading">
        <span>PROJETO INICIAL DA BICICLETA</span>
        <button id="paiva-prj-help" type="button" aria-label="Explicações sobre o projeto da bicicleta" aria-expanded="false">?</button>
      </div>
      <div class="paiva-prj-profiles" role="group" aria-label="Perfil de posicionamento desejado">
        <button data-prj-profile="aggressive" type="button" aria-pressed="false">AGRESSIVO</button>
        <button data-prj-profile="balanced" type="button" aria-pressed="true">INTERMEDIÁRIO</button>
        <button data-prj-profile="comfortable" type="button" aria-pressed="false">CONFORTÁVEL</button>
      </div>
      <div id="paiva-prj-explain" class="paiva-prj-explain" hidden>
        <p>O perfil define a intenção de posicionamento, não um ângulo ou tamanho universal. O bike fit deve confirmar conforto, estabilidade pélvica, amplitude articular e postura dinâmica.</p>
        <p>As porcentagens corporais mostram proporções, mas não determinam automaticamente stack/reach do quadro, comprimento de mesa ou pedivela. Esses componentes dependem também da geometria real, dos pontos de contato, da montagem e da modalidade.</p>
        <p>O pedivela selecionado abaixo é uma opção <strong>para testar</strong>, não uma prescrição. Comprimentos mais curtos podem reduzir a flexão de quadril e joelho, mas a escolha precisa de verificação dinâmica. O campo de pedivela instalado continua no cadastro da bicicleta.</p>
        <p>Na TT, o projeto deve conferir pad stack e pad reach e a faixa de regulagem real dos apoios. Para comparar duas opções, use o Comparador de Quadros.</p>
      </div>
      <div class="paiva-prj-grid">
        <label>Pedivela para testar <small>mm</small>
          <select id="paiva-prj-crank"><option value="">A definir</option></select>
        </label>
        <label class="paiva-prj-stem-only">Mesa proposta <small>mm · opcional</small>
          <input id="paiva-prj-stem" type="number" inputmode="decimal" min="30" max="180" step="1" placeholder="A definir"/>
        </label>
        <label>Stack do quadro considerado <small>mm · opcional</small>
          <input id="paiva-prj-stack" type="number" inputmode="decimal" min="300" max="800" step="1" placeholder="Medida real"/>
        </label>
        <label>Reach do quadro considerado <small>mm · opcional</small>
          <input id="paiva-prj-reach" type="number" inputmode="decimal" min="250" max="650" step="1" placeholder="Medida real"/>
        </label>
      </div>
      <details id="paiva-prj-simulator" class="paiva-prj-simulator">
        <summary>BICICLETA PRESENTE <span>Simular 3 montagens</span></summary>
        <div class="paiva-prj-help-line">Informe as medidas da bicicleta do cliente. <button id="paiva-prj-simhelp" type="button" aria-label="Como funciona o simulador" aria-expanded="false">?</button></div>
        <div id="paiva-prj-simexplain" class="paiva-prj-explain" hidden>
          <p><strong>Referência:</strong> eixo do movimento central = (0, 0). Stack/reach são as coordenadas da parte superior do tubo de direção, não o contato das mãos. Para Road/MTB, informe ângulo de direção, distância axial até o centro da abraçadeira da mesa (tampa da caixa + espaçadores + metade da abraçadeira), comprimento/ângulo nominal da mesa e deslocamento horizontal/vertical do contato (STI ou centro da manopla) em relação ao centro do guidão na ponta da mesa.</p>
          <p><strong>Selim:</strong> altura vertical (Y), desde o eixo do movimento central até a superfície do selim na referência escolhida. Não é a altura diagonal do selim. Recuo do bico (X) em relação ao movimento central: positivo quando o bico está atrás do eixo, negativo quando à frente.</p>
          <p><strong>TT:</strong> informe diretamente o pad stack e pad reach reais dos apoios, medidos em relação ao movimento central. Stack e reach do quadro, isolados, não determinam os apoios.</p>
          <p><strong>Três cenários:</strong> a posição intermediária reproduz os números informados. Na Road/MTB, os outros cenários consideram uma mudança axial de ±um passo na mesa/direção, além de mesa mais longa/curta na mesma quantidade. Na TT, movimentam hipoteticamente a posição dos apoios. <strong>Isso é uma simulação geométrica, não uma indicação ideal nem garantia de compatibilidade.</strong> Parte da altura axial é fixa: só se altera com espaçadores disponíveis e montagem autorizada. Verifique limites da direção, disponibilidade de componentes, cabos, manuseio e a resposta dinâmica no 2D/3D.</p>
          <p><strong>Ângulos opcionais:</strong> tronco em relação à horizontal e cotovelo interno (acrômio–cotovelo–punho). São observações para comparação clínica; não alimentam as equações de distância. Antropometria e mobilidade são fundamentais na interpretação final.</p>
        </div>
        <div class="paiva-prj-grid paiva-prj-sim-grid">
          <label class="paiva-prj-non-tt">Ângulo da direção <small>graus</small>
            <input id="paiva-prj-head-angle" type="number" inputmode="decimal" min="55" max="85" step="0.1" placeholder="Ex.: 73" />
          </label>
          <label class="paiva-prj-non-tt">Elevação axial até centro da mesa <small>mm</small>
            <input id="paiva-prj-spacers" type="number" inputmode="decimal" min="0" max="100" step="1" placeholder="Tampa + espaçadores + ½ abraçadeira" />
          </label>
          <label class="paiva-prj-non-tt">Ângulo nominal da mesa <small>graus</small>
            <input id="paiva-prj-stem-angle" type="number" inputmode="decimal" min="-40" max="45" step="1" placeholder="Ex.: −17" />
          </label>
          <label class="paiva-prj-non-tt">Ponta da mesa → contato (X) <small>mm</small>
            <input id="paiva-prj-contact-x" type="number" inputmode="decimal" min="-100" max="250" step="1" placeholder="STI ou manopla" />
          </label>
          <label class="paiva-prj-non-tt">Ponta da mesa → contato (Y) <small>mm</small>
            <input id="paiva-prj-contact-y" type="number" inputmode="decimal" min="-150" max="150" step="1" placeholder="0 se alinhado" />
          </label>
          <label class="paiva-prj-tt-only">Pad stack real <small>mm · desde o central</small>
            <input id="paiva-prj-pad-stack" type="number" inputmode="decimal" min="350" max="950" step="1" placeholder="Altura do apoio" />
          </label>
          <label class="paiva-prj-tt-only">Pad reach real <small>mm · desde o central</small>
            <input id="paiva-prj-pad-reach" type="number" inputmode="decimal" min="250" max="850" step="1" placeholder="Distância do apoio" />
          </label>
          <label>Altura VERTICAL do selim <small>mm · eixo central</small>
            <input id="paiva-prj-saddle-y" type="number" inputmode="decimal" min="250" max="1200" step="1" placeholder="Não é diagonal" />
          </label>
          <label>Recuo horizontal do bico <small>mm · desde o central</small>
            <input id="paiva-prj-nose-setback" type="number" inputmode="decimal" min="-250" max="250" step="1" placeholder="Negativo se à frente" />
          </label>
          <label>Passo da simulação <small>mm</small>
            <select id="paiva-prj-step"><option value="5">5 mm</option><option value="10" selected>10 mm</option><option value="15">15 mm</option><option value="20">20 mm</option></select>
          </label>
          <label>Tronco × horizontal <small>° · observado</small>
            <input id="paiva-prj-trunk-angle" type="number" inputmode="decimal" min="0" max="90" step="0.5" placeholder="Opcional" />
          </label>
          <label>Cotovelo interno <small>° · observado</small>
            <input id="paiva-prj-elbow-angle" type="number" inputmode="decimal" min="0" max="180" step="0.5" placeholder="Opcional" />
          </label>
        </div>
        <div id="paiva-prj-results" class="paiva-prj-results" aria-live="polite">Preencha as medidas reais para visualizar os três cenários.</div>
      </details>
      <p class="paiva-prj-status" id="paiva-prj-status" aria-live="polite"></p>`;
    sizing.insertAdjacentElement('afterend', panel);

    const css = document.createElement('style');
    css.id = 'paiva-prj-css';
    css.textContent = `
      #paiva-bike-project { margin:0 0 18px; padding:13px;
        border:1px solid #465763; border-radius:13px;
        background:linear-gradient(145deg,#1b2630,#111921); }
      body:not(.paiva-full-anthro) #paiva-bike-project { display:none!important; }
      #paiva-bike-project .paiva-prj-heading { display:flex; align-items:center;
        justify-content:space-between; gap:8px; color:#a6b8c4;
        letter-spacing:.085em; font-weight:800; font-size:10px; }
      #paiva-prj-help { color:#edf4f7; background:#23323d; border:1px solid #7f96a5;
        border-radius:50%; cursor:pointer; width:30px; height:30px; font-weight:850; }
      #paiva-bike-project .paiva-prj-profiles { display:flex; flex-wrap:wrap;
        gap:7px; margin:13px 0; }
      #paiva-bike-project .paiva-prj-profiles button { flex:1; min-width:102px;
        background:#101922; border:1px solid #5b6d79; color:#ccd9e0;
        padding:10px 9px; border-radius:9px; font:750 10px system-ui,sans-serif;
        cursor:pointer; }
      #paiva-bike-project .paiva-prj-profiles button[aria-pressed="true"] {
        border-color:#d9e5ec; background:#d9e5ec; color:#162029; }
      #paiva-bike-project .paiva-prj-grid { display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; }
      #paiva-bike-project label { display:block; min-width:0;
        font-size:11px; color:#cdd9e0; font-weight:750; }
      #paiva-bike-project label small { float:right; color:#94a8b5; }
      #paiva-bike-project select, #paiva-bike-project input {
        display:block; box-sizing:border-box; width:100%; min-width:0; margin-top:6px;
        padding:10px 11px; background:#0e161e; color:#f0f5f8;
        border:1px solid #5d6d7a; border-radius:9px;
        font:650 12px system-ui,sans-serif; }
      #paiva-bike-project .paiva-prj-explain { padding:11px 12px;
        margin-bottom:13px; border-radius:9px; background:#111b23;
        color:#cbd8e0; font-size:11px; line-height:1.6;
        border:1px solid #485864; }
      #paiva-bike-project .paiva-prj-explain p { margin:0 0 9px; }
      #paiva-bike-project .paiva-prj-explain p:last-child { margin-bottom:0; }
      #paiva-bike-project .paiva-prj-status { color:#aebfca; font-size:11px;
        line-height:1.55; margin:12px 0 0; }
      #paiva-bike-project .paiva-prj-simulator { border-top:1px solid #455661;
        padding-top:13px; margin-top:15px; }
      #paiva-bike-project .paiva-prj-simulator summary { cursor:pointer;
        font-weight:850; letter-spacing:.05em; font-size:11px; color:#e0ebf0;
        list-style-position:inside; }
      #paiva-bike-project .paiva-prj-simulator summary span { float:right;
        font-weight:500; font-size:10px; color:#a6c1d0; letter-spacing:0; }
      #paiva-bike-project .paiva-prj-help-line { display:flex; gap:12px;
        align-items:center; justify-content:space-between; margin:12px 0;
        color:#aec0cb; font-size:11px; }
      #paiva-prj-simhelp { border-radius:50%; width:29px; height:29px;
        color:#fff; background:#23323d; border:1px solid #7f96a5;
        font-weight:800; cursor:pointer; flex:none; }
      #paiva-bike-project .paiva-prj-sim-grid { padding:6px 0; }
      #paiva-bike-project:not(.paiva-prj-is-tt) .paiva-prj-tt-only,
      #paiva-bike-project.paiva-prj-is-tt .paiva-prj-non-tt,
      #paiva-bike-project.paiva-prj-is-tt .paiva-prj-stem-only { display:none; }
      #paiva-bike-project .paiva-prj-results { padding-top:9px;
        font-size:11px; color:#b9c8d1; line-height:1.5; }
      #paiva-bike-project .paiva-prj-results-head { margin:5px 0 9px;
        color:#d9e9f1; font-weight:750; }
      #paiva-bike-project .paiva-prj-result-grid { display:grid; gap:8px;
        grid-template-columns:repeat(3,minmax(0,1fr)); }
      #paiva-bike-project .paiva-prj-result-card { min-width:0; padding:10px 8px;
        background:#111e26; border-radius:9px; border:1px solid #425666; }
      #paiva-bike-project .paiva-prj-result-card[data-selected="true"] { border-color:#c6d8e4;
        background:#243541; }
      #paiva-bike-project .paiva-prj-result-card strong { display:block; font-size:10px;
        text-transform:uppercase; color:#e5eef3; margin-bottom:7px; }
      #paiva-bike-project .paiva-prj-result-card b { display:block; color:#d4e7f2;
        font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; }
      #paiva-bike-project .paiva-prj-result-card small { font-size:9px;
        color:#9cb1be; font-weight:500; }
      #paiva-bike-project .paiva-prj-result-card p { margin:8px 0 0;
        font-size:10px; color:#abbdc7; }
      #paiva-bike-project .paiva-prj-disclaimer { font-size:10px;
        margin:10px 0 0; color:#9fb3c0; }
      #paiva-bike-project [hidden] { display:none!important; }
      @media(max-width:590px){ #paiva-bike-project .paiva-prj-result-grid {
        grid-template-columns:1fr; } }
      @media(max-width:460px){ #paiva-bike-project .paiva-prj-grid {
        grid-template-columns:1fr; } }
      @media print { #paiva-bike-project { display:none!important; } }`;
    document.head.append(css);

    const id = key => document.getElementById('paiva-prj-' + key);
    const modeNow = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
    const newDraft = () => ({ profile: 'balanced',
      ...Object.fromEntries(KEYS.map(k => [k, k === 'step' ? '10' : ''])) });
    const drafts = { road: newDraft(), mtb: newDraft(), tt: newDraft() };
    let mode = modeNow();
    let profile = 'balanced';
    for (const length of allowedCranks) {
      const option = document.createElement('option');
      option.value = length;
      option.textContent = length.replace('.', ',') + ' mm';
      id('crank').append(option);
    }

    function saveCurrent() {
      drafts[mode] = { profile, ...Object.fromEntries(KEYS.map(k => [k, id(k).value])) };
    }
    function switchMode() {
      const next = modeNow();
      if (next !== mode) {
        saveCurrent();
        mode = next;
        const d = drafts[mode];
        profile = d.profile;
        KEYS.forEach(key => { id(key).value = d[key] || ''; });
      }
      render();
    }
    function render() {
      panel.classList.toggle('paiva-prj-is-tt', mode === 'tt');
      document.querySelectorAll('#paiva-bike-project [data-prj-profile]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.prjProfile === profile));
      });
      const style = PROFILES[profile].label;
      const crank = readPositive(id('crank').value, 200);
      const stack = readPositive(id('stack').value, 800);
      const reach = readPositive(id('reach').value, 650);
      const geom = stack !== null && reach !== null ? 'quadro informado' : 'quadro a conferir';
      id('status').textContent = `${MODES[mode]} · Perfil ${style.toLowerCase()} · ${geom} · ` +
        (crank === null ? 'pedivela a testar' : `teste de pedivela ${crank.toLocaleString('pt-BR')} mm`);
      const data = Object.fromEntries(KEYS.map(k => [k, id(k).value]));
      const results = simulateGeometry(data, mode, id('step').value);
      const target = id('results');
      if (results === null) {
        target.textContent = mode === 'tt'
          ? 'Para simular, informe pad stack/reach reais, altura vertical do selim e recuo horizontal do bico.'
          : 'Para simular, informe stack/reach reais, mesa, direção, elevação axial da mesa, deslocamentos do contato, altura vertical do selim e recuo do bico. Preencha 0 onde a medida for zero.';
        return;
      }
      const mm = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      const reference = mode === 'tt' ? 'apoios de antebraço' : mode === 'mtb' ? 'centro da manopla' : 'centro do STI';
      target.innerHTML = `<p class="paiva-prj-results-head">Simulação · bico do selim → ${reference}</p>
        <div class="paiva-prj-result-grid">${results.map(r => `
          <div class="paiva-prj-result-card" data-selected="${r.key === profile}">
            <strong>${r.label}</strong>
            <b>${mm(r.reachFromNose)} mm</b><small>distância horizontal do bico</small>
            <b>${mm(r.drop)} mm</b><small>desnível vertical selim − contato</small>
            ${r.stem === null ? `<p>Pad X ${mm(r.x)} · Y ${mm(r.y)} mm</p>`
              : `<p>Mesa ${mm(r.stem)} · elevação axial ${mm(r.spacers)} mm</p>`}
            <p>${r.note}</p>
          </div>`).join('')}</div>
        <p class="paiva-prj-disclaimer">Cenários geométricos estimados, sem prescrição. Confirmar referências de medida, regulagens possíveis e conforto no bike fit dinâmico.</p>`;
    }

    document.querySelectorAll('#paiva-bike-project [data-prj-profile]').forEach(btn => {
      btn.addEventListener('click', () => { profile = btn.dataset.prjProfile; render(); });
    });
    KEYS.forEach(key => {
      id(key).addEventListener('input', render);
      id(key).addEventListener('change', render);
    });
    id('help').addEventListener('click', () => {
      const open = id('explain').hidden;
      id('explain').hidden = !open;
      id('help').setAttribute('aria-expanded', String(open));
    });
    id('simhelp').addEventListener('click', () => {
      const open = id('simexplain').hidden;
      id('simexplain').hidden = !open;
      id('simhelp').setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => setTimeout(switchMode, 0));
    });

    globalThis.PAIVA_BIKE_PROJECT = {
      getReport() {
        if (globalThis.PAIVA_ANTHRO_METHOD?.getMode?.() !== 'full') return null;
        switchMode();
        const fields = [
          {label:'Modalidade',value:MODES[mode]},
          {label:'Perfil pretendido',value:PROFILES[profile].label}
        ];
        const crank = readPositive(id('crank').value,200);
        const stem = readPositive(id('stem').value,180);
        const stack = readPositive(id('stack').value,800);
        const reach = readPositive(id('reach').value,650);
        if (crank !== null) fields.push({label:'Pedivela para teste',value:`${crank.toLocaleString('pt-BR')} mm · escolha profissional provisória`});
        if (stem !== null) fields.push({label:'Mesa proposta',value:`${stem.toLocaleString('pt-BR')} mm · sujeita a avaliação`});
        if (stack !== null) fields.push({label:'Stack do quadro considerado',value:`${stack.toLocaleString('pt-BR')} mm · medida informada`});
        if (reach !== null) fields.push({label:'Reach do quadro considerado',value:`${reach.toLocaleString('pt-BR')} mm · medida informada`});
        const data = Object.fromEntries(KEYS.map(k => [k, id(k).value]));
        const simulated = simulateGeometry(data, mode, data.step);
        const fmt = n => n.toLocaleString('pt-BR', {maximumFractionDigits:1});
        if (simulated !== null) {
          fields.push({ label:'Simulador de bicicleta presente', value:'Geometria relativa ao movimento central; cenários mecânicos hipotéticos, não prescrições de fit.' });
          for (const scenario of simulated) {
            fields.push({ label:`${scenario.label} · bico → contato / desnível`,
              value:`${fmt(scenario.reachFromNose)} mm horizontal · ${fmt(scenario.drop)} mm vertical; ${scenario.note.toLowerCase()}` });
          }
          if (mode === 'tt') fields.push({ label:'Referência do contato',value:'Centro dos apoios de antebraço (pad stack / pad reach informados).' });
          else fields.push({label:'Referência do contato',value:mode === 'mtb' ? 'Centro da manopla' : 'Centro do STI'});
          fields.push({label:'Passo entre cenários',value:`${fmt(Number(data.step))} mm; montagem sujeita à faixa física de regulagem`});
        }
        const trunk = readRange(data['trunk-angle'],0,90);
        const elbow = readRange(data['elbow-angle'],0,180);
        if (trunk !== null) fields.push({label:'Tronco em relação à horizontal',value:`${fmt(trunk)}° · observado, não usado no cálculo`});
        if (elbow !== null) fields.push({label:'Cotovelo interno',value:`${fmt(elbow)}° · observado, não usado no cálculo`});
        fields.push({label:'Estado do projeto',value:'Hipótese de montagem; confirmar com geometria real, mobilidade, pontos de contato e bike fit dinâmico.'});
        return { rows: fields };
      },
      getDraft() { switchMode(); return { mode, profile, ...Object.fromEntries(KEYS.map(k => [k,id(k).value])) }; },
      simulate(input, modality = 'road', step = 10) { return simulateGeometry(input, modality, step); }
    };
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
