/* PAIVA Bike Fit Studio — pré-fit simples por estatura e proporções antropométricas.
   Correções heurísticas exploratórias, não modelo clínico validado. */
(() => {
  'use strict';

  const MODES = { road: 'Road / Speed', mtb: 'MTB', tt: 'TT / Triatlo' };
  const PROFILES = {
    aggressive: { label: 'Agressivo', stack: -8, reach: 8 },
    balanced: { label: 'Intermediário', stack: 0, reach: 0 },
    comfortable: { label: 'Confortável', stack: 8, reach: -8 }
  };
  const FIELDS = ['height', 'inseam', 'torso', 'arm', 'shoulder', 'foot'];
  const LABELS = { height: 'estatura', inseam: 'entreperna', torso: 'tronco',
    arm: 'braço', shoulder: 'ombros', foot: 'pé' };
  const allowedCranks = ['145', '150', '155', '160', '165', '170', '172.5', '175'];
  const round = n => Math.round(n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mm = n => `${n.toLocaleString('pt-BR', {maximumFractionDigits:1})} mm`;
  const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${mm(Math.abs(n))}`;

  function read(value, min, max) {
    const raw = String(value ?? '').trim().replace(',', '.');
    const valueNumber = Number(raw);
    return raw !== '' && Number.isFinite(valueNumber) && valueNumber >= min && valueNumber <= max
      ? valueNumber : null;
  }

  /* Heurística explícita: ajusta em no máximo 18 mm o guia já existente por
     estatura. Os 47%/34% são âncoras matemáticas de exploração, NÃO normas
     populacionais. Ombro e pé integram a ficha, mas não afetam os dois eixos
     sagitais do quadro; são importantes para outros componentes do fit. */
  function estimateReference(body, base, profile = 'balanced') {
    const h = read(body.height, 140, 215);
    const leg = read(body.inseam, 55, 110);
    const torso = read(body.torso, 25, 95);
    const arm = read(body.arm, 30, 100);
    const shoulder = read(body.shoulder, 20, 75);
    const foot = read(body.foot, 15, 40);
    const stackBase = read(base?.stack, 300, 800);
    const reachBase = read(base?.reach, 250, 650);
    if ([h,leg,torso,arm,shoulder,foot,stackBase,reachBase].some(v => v === null) ||
        leg >= h || !PROFILES[profile]) return null;

    const deviationLeg = (leg - 0.47 * h) * 10;
    const deviationTorso = (torso - 0.34 * h) * 10;
    const deviationArm = (arm - 0.34 * h) * 10;
    const adjustmentStack = round(clamp(0.24 * deviationLeg - 0.15 * deviationTorso -
      0.05 * deviationArm, -18, 18));
    const adjustmentReach = round(clamp(0.24 * deviationTorso + 0.16 * deviationArm -
      0.12 * deviationLeg, -18, 18));
    const aim = PROFILES[profile];
    return {
      profile, stack: stackBase + adjustmentStack + aim.stack,
      reach: reachBase + adjustmentReach + aim.reach,
      baselineStack: stackBase, baselineReach: reachBase,
      adjustmentStack, adjustmentReach,
      ratioLeg: 100 * leg / h, ratioTorso: 100 * torso / h, ratioArm: 100 * arm / h
    };
  }

  // Leitura descritiva das correções limitadas do simulador, sem valor clínico validado.
  function geometryTendency(reference, mode) {
    if (!reference) return 'Indefinida: faltam medidas completas para explorar as proporções.';
    const s = reference.adjustmentStack, r = reference.adjustmentReach;
    let description;
    if (Math.abs(s) < 6 && Math.abs(r) < 6)
      description = 'Sem predominância clara de quadro mais alto, baixo, longo ou curto';
    else if (s >= 6 && r <= -6) description = 'Explorar quadros relativamente mais altos e curtos';
    else if (s <= -6 && r >= 6) description = 'Explorar quadros relativamente mais baixos e longos';
    else if (s >= 6 && r >= 6) description = 'Explorar quadros relativamente mais altos e longos';
    else if (s <= -6 && r <= -6) description = 'Explorar quadros relativamente mais baixos e curtos';
    else if (s >= 6) description = 'Explorar quadros com stack relativamente mais alto';
    else if (s <= -6) description = 'Explorar quadros com stack relativamente mais baixo';
    else if (r >= 6) description = 'Explorar quadros com reach relativamente mais longo';
    else description = 'Explorar quadros com reach relativamente mais curto';
    return description + (mode === 'tt'
      ? '. Na TT, conferir sobretudo alcance e altura dos apoios (pad reach e pad stack), não apenas o quadro.'
      : '. Comparar dentro da modalidade e conferir os ajustes reais de selim, mesa e guidão.');
  }

  function initialize() {
    const anchor = document.getElementById('paiva-sizing-method');
    if (!anchor || document.getElementById('paiva-bike-project')) return;
    const panel = document.createElement('div');
    panel.id = 'paiva-bike-project';
    panel.innerHTML = `
      <div class="paiva-prj-heading"><span>PRÉ-FIT · GEOMETRIA INDIVIDUAL</span>
        <button id="paiva-prj-help" type="button" aria-label="Entender a referência" aria-expanded="false">?</button></div>
      <div class="paiva-prj-profiles" role="group" aria-label="Intenção da posição">
        <button data-prj-profile="aggressive" type="button" aria-pressed="false">AGRESSIVO</button>
        <button data-prj-profile="balanced" type="button" aria-pressed="true">INTERMEDIÁRIO</button>
        <button data-prj-profile="comfortable" type="button" aria-pressed="false">CONFORTÁVEL</button>
      </div>
      <div class="paiva-prj-explain" id="paiva-prj-explain" hidden>
        <p><strong>Como funciona:</strong> parte do guia por estatura que já estava no aplicativo. Entreperna, tronco e braço corrigem essa referência de forma pequena e limitada (até 18 mm por eixo). As três intenções acrescentam variações demonstrativas de 8 mm. Essas são <strong>hipóteses de triagem, não fórmulas científicas de quadro ideal</strong>.</p>
        <p><strong>Transparência do método:</strong> as proporções de 47% (entreperna), 34% (tronco) e 34% (braço) são âncoras matemáticas do simulador, não médias ou limites clínicos comprovados. Os coeficientes de correção também são experimentais, e não derivam de um estudo de validação.</p>
        <p><strong>Por que não ombros e pé na conta?</strong> Registramos as seis medidas completas, mas largura de ombros e comprimento do pé não definem diretamente stack/reach do quadro no plano lateral. Eles ajudam a escolher guidão, apoio e outros componentes, a serem conferidos em movimento.</p>
        <p><strong>Quadro do cliente:</strong> digite o stack e o reach reais em milímetros. A diferença apresentada é <strong>quadro real menos referência exploratória</strong>, não uma recomendação automática de trocar o quadro. Mesa, espaçadores, selim e contato das mãos ainda podem modificar a montagem. No TT, o posicionamento dos apoios exige pad stack/pad reach específicos.</p>
        <p><strong>Pedivela:</strong> a opção para teste é manual e não depende de uma fórmula pela entreperna. Verificar quadril, joelho, cadência, conforto e desempenho no fit dinâmico.</p>
      </div>
      <div class="paiva-prj-grid">
        <label>Stack do quadro do cliente <small>mm · opcional</small>
          <input id="paiva-prj-stack" type="number" inputmode="decimal" min="300" max="800" step="1" placeholder="Medida real"></label>
        <label>Reach do quadro do cliente <small>mm · opcional</small>
          <input id="paiva-prj-reach" type="number" inputmode="decimal" min="250" max="650" step="1" placeholder="Medida real"></label>
        <label>Pedivela para testar <small>mm · opcional</small>
          <select id="paiva-prj-crank"><option value="">A definir</option></select></label>
      </div>
      <div id="paiva-prj-status" class="paiva-prj-status" aria-live="polite"></div>
      <div id="paiva-prj-results" class="paiva-prj-results" aria-live="polite"></div>`;
    anchor.insertAdjacentElement('afterend', panel);

    const style = document.createElement('style');
    style.id = 'paiva-prj-css';
    style.textContent = `
      #paiva-bike-project { margin:0 0 18px; padding:13px; border:1px solid #4a5d6b;
        border-radius:13px; background:linear-gradient(140deg,#1c2831,#121b24); }
      body:not(.paiva-full-anthro) #paiva-bike-project {display:none!important}
      #paiva-bike-project .paiva-prj-heading {display:flex;align-items:center;justify-content:space-between;
        gap:8px;color:#a9bfcb;letter-spacing:.08em;font-weight:800;font-size:10px}
      #paiva-prj-help {color:#f2f6f8;background:#273844;border:1px solid #839dab;
        border-radius:50%;cursor:pointer;width:30px;height:30px;font-weight:850}
      #paiva-bike-project .paiva-prj-profiles {display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}
      #paiva-bike-project .paiva-prj-profiles button {flex:1;min-width:102px;background:#101922;
        border:1px solid #5c707d;color:#cedce4;padding:10px 9px;border-radius:9px;
        font:750 10px system-ui,sans-serif;cursor:pointer}
      #paiva-bike-project .paiva-prj-profiles button[aria-pressed="true"] {
        border-color:#e0ebf2;background:#d9e5ec;color:#14202a}
      #paiva-bike-project .paiva-prj-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}
      #paiva-bike-project label {display:block;min-width:0;font-size:11px;color:#d0dde4;font-weight:750}
      #paiva-bike-project label small {float:right;color:#9bb0bd;font-size:9px}
      #paiva-bike-project select,#paiva-bike-project input {display:block;box-sizing:border-box;width:100%;
        min-width:0;margin-top:6px;padding:10px 11px;background:#0e171f;color:#f0f5f8;
        border:1px solid #647683;border-radius:9px;font:650 12px system-ui,sans-serif}
      #paiva-bike-project .paiva-prj-explain {padding:11px 12px;margin-bottom:13px;
        border-radius:9px;background:#111b23;color:#cfdae1;font-size:11px;line-height:1.6;
        border:1px solid #4e6270}
      #paiva-bike-project .paiva-prj-explain p {margin:0 0 10px}
      #paiva-bike-project .paiva-prj-explain p:last-child {margin-bottom:0}
      #paiva-bike-project .paiva-prj-status {color:#b7c9d4;font-size:11px;line-height:1.5;margin:12px 0}
      #paiva-bike-project .paiva-prj-results {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      #paiva-bike-project .paiva-prj-card {padding:9px 8px;border:1px solid #516978;border-radius:10px;
        background:#101c24;min-width:0}
      #paiva-bike-project .paiva-prj-card[data-selected="true"] {border-color:#e3edf2;background:#233540}
      #paiva-bike-project .paiva-prj-card h3 {margin:0 0 9px;font-size:10px;letter-spacing:.02em;color:#e1ebef}
      #paiva-bike-project .paiva-prj-card strong {display:block;font-size:17px;color:#f5f9fa;
        font-variant-numeric:tabular-nums}
      #paiva-bike-project .paiva-prj-card span {display:block;color:#9eb1be;font-size:10px;margin:0 0 8px}
      #paiva-bike-project .paiva-prj-difference {grid-column:1/-1;padding:11px 12px;
        background:#102028;border:1px solid #4b687a;border-radius:10px;color:#d8e7ef;font-size:11px;line-height:1.6}
      #paiva-bike-project .paiva-prj-footnote {font-size:10px;color:#9fb4c0;line-height:1.5;margin:0;grid-column:1/-1}
      #paiva-bike-project [hidden] {display:none!important}
      @media(max-width:520px){ #paiva-bike-project .paiva-prj-results {grid-template-columns:1fr} }
      @media(max-width:380px){ #paiva-bike-project .paiva-prj-grid {grid-template-columns:1fr} }
      @media print {#paiva-bike-project {display:none!important}}`;
    document.head.append(style);

    const id = key => document.getElementById('paiva-prj-' + key);
    const modeNow = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
    const fresh = () => ({profile:'balanced',crank:'',stack:'',reach:''});
    const drafts = {road:fresh(),mtb:fresh(),tt:fresh()};
    let mode = modeNow();
    let profile = 'balanced';
    for (const length of allowedCranks) {
      const option = document.createElement('option');
      option.value = length; option.textContent = length.replace('.',',') + ' mm';
      id('crank').append(option);
    }

    const bodyValues = () => Object.fromEntries(FIELDS.map(key =>
      [key, document.getElementById(key)?.value ?? '']));
    function originalReference(body) {
      if (typeof globalThis.frameReference === 'function')
        return globalThis.frameReference(read(body.height,140,215),mode);
      const prefix = mode === 'mtb' ? 'mtb' : mode === 'tt' ? 'tt' : 'road';
      return {stack:document.getElementById(prefix+'StackValue')?.textContent?.replace(/[^0-9.]/g,''),
        reach:document.getElementById(prefix+'ReachValue')?.textContent?.replace(/[^0-9.]/g,'')};
    }
    function reportData() {
      const body = bodyValues();
      const base = originalReference(body);
      return Object.keys(PROFILES).map(key => estimateReference(body,base,key));
    }
    function saveCurrent() { drafts[mode] = {profile,crank:id('crank').value,stack:id('stack').value,reach:id('reach').value}; }
    function switchMode() {
      const next = modeNow();
      if (next !== mode) {
        saveCurrent();mode = next;
        const stored = drafts[mode];profile = stored.profile;
        for (const key of ['crank','stack','reach']) id(key).value = stored[key] || '';
      }
      render();
    }

    function render() {
      for (const btn of panel.querySelectorAll('[data-prj-profile]'))
        btn.setAttribute('aria-pressed',String(btn.dataset.prjProfile === profile));
      const values = reportData();
      const results = id('results');
      if (values.some(v => v === null)) {
        const body = bodyValues();
        const missing = FIELDS.filter(key => body[key] === '').map(key => LABELS[key]);
        id('status').textContent = missing.length
          ? 'Preencha a antropometria para calcular a referência: ' + missing.join(', ') + '.'
          : 'Confira os valores da antropometria e a estatura (140–215 cm).';
        results.replaceChildren();
        return;
      }
      const ref = values.find(v => v.profile === profile);
      id('status').textContent = `${MODES[mode]} · Guia por estatura + proporções de perna, tronco e braço.`;
      const stackActual = read(id('stack').value,300,800);
      const reachActual = read(id('reach').value,250,650);
      results.innerHTML = values.map(value => `
        <div class="paiva-prj-card" data-selected="${value.profile === profile}">
          <h3>${PROFILES[value.profile].label}</h3>
          <strong>${mm(value.stack)}</strong><span>Stack · referência exploratória</span>
          <strong>${mm(value.reach)}</strong><span>Reach · referência exploratória</span>
        </div>`).join('') +
        `<p class="paiva-prj-footnote">Correção antropométrica sobre a referência por estatura: stack ${signed(ref.adjustmentStack)} · reach ${signed(ref.adjustmentReach)}. Não é quadro perfeito nem resultado de fórmula clínica validada.</p>`;
      const geometry = document.createElement('p');
      geometry.className = 'paiva-prj-footnote';
      geometry.textContent = `Perfil de geometria para investigar: ${geometryTendency(ref,mode)} Tendência exploratória, a confirmar em avaliação dinâmica.`;
      results.append(geometry);
      if (stackActual !== null && reachActual !== null) {
        const comparison = document.createElement('div');
        comparison.className = 'paiva-prj-difference';
        comparison.textContent = `Quadro do cliente × perfil ${PROFILES[profile].label.toLowerCase()}: ` +
          `stack ${signed(stackActual - ref.stack)} · reach ${signed(reachActual - ref.reach)}. ` +
          'A diferença é geométrica, não um julgamento de compatibilidade.';
        results.append(comparison);
      } else if (stackActual !== null || reachActual !== null) {
        const note = document.createElement('p'); note.className='paiva-prj-footnote';
        note.textContent = 'Informe stack e reach reais para comparar os dois eixos do quadro.';
        results.append(note);
      }
    }

    for (const btn of panel.querySelectorAll('[data-prj-profile]'))
      btn.addEventListener('click', () => {profile = btn.dataset.prjProfile;render();});
    id('help').addEventListener('click', () => {
      const opened = id('explain').hidden;
      id('explain').hidden = !opened;
      id('help').setAttribute('aria-expanded',String(opened));
    });
    for (const key of ['crank','stack','reach']) {
      id(key).addEventListener('input', () => {
        if (key === 'stack' || key === 'reach') {
          const realKey = key === 'stack' ? 'finalStack' : 'finalReach';
          const realInput = document.getElementById(realKey);
          if (realInput && realInput.value !== id(key).value) {
            const saved = globalThis.PAIVA_FINAL_MEASURES?.setManual?.(realKey,id(key).value);
            if (!saved) {
              realInput.value = id(key).value;
              realInput.dispatchEvent(new Event('input',{bubbles:true}));
            }
          }
        }
        render();
      });
      id(key).addEventListener('change',render);
    }
    document.addEventListener('input', event => {
      if (['finalStack','finalReach'].includes(event.target?.id)) {
        const key = event.target.id === 'finalStack' ? 'stack' : 'reach';
        id(key).value = event.target.value;
        render();
      } else if (FIELDS.includes(event.target?.id)) render();
    });
    for (const btn of document.querySelectorAll('[data-mode]'))
      btn.addEventListener('click', () => setTimeout(switchMode,0));
    for (const btn of document.querySelectorAll('#paiva-sizing-method [data-sizing]'))
      btn.addEventListener('click', () => setTimeout(render,0));
    setTimeout(() => {
      for (const key of ['stack','reach']) {
        const val = document.getElementById(key === 'stack' ? 'finalStack' : 'finalReach')?.value;
        if (val && !id(key).value) id(key).value = val;
      }
      render();
    },0);

    globalThis.PAIVA_BIKE_PROJECT = {
      estimate: estimateReference,
      geometryTendency,
      getReport() {
        if (globalThis.PAIVA_ANTHRO_METHOD?.getMode?.() !== 'full') return null;
        switchMode();
        const candidates = reportData();
        const rows = [{label:'Modalidade',value:MODES[mode]},
          {label:'Perfil escolhido',value:PROFILES[profile].label}];
        if (candidates.every(Boolean)) {
          for (const value of candidates) rows.push({
            label:`${PROFILES[value.profile].label} · stack / reach estimados`,
            value:`${mm(value.stack)} / ${mm(value.reach)} · referência exploratória, não validada` });
          const chosen = candidates.find(v => v.profile === profile);
          rows.push({label:'Perfil de geometria para investigar',
            value: geometryTendency(chosen,mode)});
          rows.push({label:'Como interpretar esta indicação',
            value:'As proporções de perna, tronco e braço ajudam a formular uma hipótese de geometria, mas não determinam modelo, marca ou tamanho perfeito. Esta é uma leitura inicial experimental: validar os pontos de contato, limites de regulagem, mobilidade e posição dinâmica antes de recomendar uma bicicleta.'});
          const s = read(id('stack').value,300,800),r = read(id('reach').value,250,650);
          if (s !== null && r !== null) {
            rows.push({label:'Quadro real informado · stack / reach',value:`${mm(s)} / ${mm(r)}`});
            rows.push({label:'Diferença do quadro frente à referência',
              value:`Stack ${signed(s-chosen.stack)} · reach ${signed(r-chosen.reach)}; sem diagnóstico automático`});
          }
        }
        const crank = read(id('crank').value,140,190);
        if (crank !== null) rows.push({label:'Pedivela para testar',value:`${mm(crank)} · seleção manual`});
        rows.push({label:'Observação',value:'Triagem experimental por proporções, não equivale a fit ideal; conferir quadro, montagem e avaliação dinâmica.'});
        return {rows};
      },
      getDraft() {switchMode();return {mode,profile,crank:id('crank').value,stack:id('stack').value,reach:id('reach').value};},
      resetAll() {
        for (const key of Object.keys(drafts)) drafts[key] = fresh();
        mode = modeNow();profile = 'balanced';
        for (const key of ['crank','stack','reach']) id(key).value = '';
        render();
      }
    };
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
