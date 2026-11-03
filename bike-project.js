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
  const KEYS = ['crank', 'stem', 'stack', 'reach'];
  const allowedCranks = ['145', '150', '155', '160', '165', '170', '172.5', '175'];

  function readPositive(value, max = 2000) {
    const s = String(value || '').trim().replace(',', '.');
    const n = Number(s);
    return s && Number.isFinite(n) && n > 0 && n <= max ? n : null;
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
        <label>Mesa proposta <small>mm · opcional</small>
          <input id="paiva-prj-stem" type="number" inputmode="decimal" min="30" max="180" step="1" placeholder="A definir"/>
        </label>
        <label>Stack do quadro considerado <small>mm · opcional</small>
          <input id="paiva-prj-stack" type="number" inputmode="decimal" min="300" max="800" step="1" placeholder="Medida real"/>
        </label>
        <label>Reach do quadro considerado <small>mm · opcional</small>
          <input id="paiva-prj-reach" type="number" inputmode="decimal" min="250" max="650" step="1" placeholder="Medida real"/>
        </label>
      </div>
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
      #paiva-bike-project [hidden] { display:none!important; }
      @media(max-width:460px){ #paiva-bike-project .paiva-prj-grid {
        grid-template-columns:1fr; } }
      @media print { #paiva-bike-project { display:none!important; } }`;
    document.head.append(css);

    const id = key => document.getElementById('paiva-prj-' + key);
    const modeNow = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
    const drafts = {
      road: { profile: 'balanced', crank: '', stem: '', stack: '', reach: '' },
      mtb: { profile: 'balanced', crank: '', stem: '', stack: '', reach: '' },
      tt: { profile: 'balanced', crank: '', stem: '', stack: '', reach: '' }
    };
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
        fields.push({label:'Estado do projeto',value:'Hipótese de montagem; confirmar com geometria real, mobilidade, pontos de contato e bike fit dinâmico.'});
        return { rows: fields };
      },
      getDraft() { switchMode(); return { mode, profile, ...Object.fromEntries(KEYS.map(k => [k,id(k).value])) }; }
    };
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
