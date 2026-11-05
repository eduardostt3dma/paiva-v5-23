/* PAIVA V5.28 — TT: coordenadas medidas OU limites reais de catálogo.
   Nunca apresentar centro da regulagem como posição individual ideal. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const mode = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
  const measured = (id, min, max) => {
    const raw = String(el(id)?.value ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return raw && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const mm = value => value === null ? '—' :
    value.toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mm';
  function displayValues() {
    const stack = measured('paiva-tt-pad-stack', 200, 1200);
    const reach = measured('paiva-tt-pad-reach', 100, 900);
    const catalog = window.PAIVA_TT_REFERENCE?.getEstimate?.();
    const band = pair => pair ? pair[0] + '–' + pair[1] + ' mm' : '—';
    return {stack,reach,catalog,
      stackText:stack === null ? band(catalog?.padStack) : mm(stack),
      reachText:reach === null ? band(catalog?.padReach) : mm(reach)};
  }

  function syncReportPreview() {
    if (mode() !== 'tt') return;
    const cards = Array.from(document.querySelectorAll('#ttPhotoPanel .photo-data'));
    const items = Array.from(document.querySelectorAll('#reportBikeMetrics .report-bike-metric'));
    if (cards.length !== items.length) return;
    cards.forEach((card, index) => {
      const name = card.querySelector('span')?.textContent;
      const value = card.querySelector('strong')?.textContent;
      if (items[index].querySelector('span')) items[index].querySelector('span').textContent = name || '';
      if (items[index].querySelector('strong')) items[index].querySelector('strong').textContent = value || '—';
    });
  }

  function render() {
    const isTT = mode() === 'tt';
    const panel = el('paiva-tt-coordinates');
    if (!panel) return;
    panel.hidden = !isTT;
    const padDetails=el('paiva-tt-pad-details');
    if(padDetails)padDetails.hidden=!isTT||
      (window.PAIVA_TT_SIMPLE&&!window.PAIVA_TT_SIMPLE.isCatalogMode());
    const geometryNote = document.querySelector('.layout .disclaimer');
    if (geometryNote) geometryNote.textContent = isTT
      ? (window.PAIVA_TT_SIMPLE&&!window.PAIVA_TT_SIMPLE.isCatalogMode()
        ? 'TT sem bicicleta: usamos antropometria e tamanhos de UM catálogo identificado como triagem. O desenho não apresenta stack/reach do quadro nem coordenadas de pads não medidos.'
        : 'TT com catálogo: a imagem mostra faixa de regulagem de um modelo identificado, ou coordenadas dos pads realmente medidas. Nunca interpretar a faixa como posição ideal.')
      : 'Pré-fit Road/MTB: stack/reach do quadro são referências exploratórias de triagem por estatura, não um ajuste individual validado. Confira a geometria real e a avaliação dinâmica.';
    const legend = document.querySelector('.diagram-legend span:first-child');
    if (legend?.lastChild?.nodeType === 3) legend.lastChild.nodeValue = isTT
      ? ' Apoios TT: apenas medidas reais ou faixas publicadas por modelo' : ' Medidas de geometria do quadro';
    if (!isTT) return;

    const {stack,reach,catalog,stackText:realStackText,reachText:realReachText}=displayValues();
    const noBike=window.PAIVA_TT_SIMPLE&&!window.PAIVA_TT_SIMPLE.isCatalogMode();
    const stackText=noBike?'—':realStackText;
    const reachText=noBike?'—':realReachText;
    if (el('ttStackValue').textContent !== stackText) el('ttStackValue').textContent = stackText;
    if (el('ttReachValue').textContent !== reachText) el('ttReachValue').textContent = reachText;
    const photo = el('ttPhotoPanel');
    const labels = photo?.querySelectorAll('.photo-data span');
    if (labels?.length >= 2) {
      labels[0].textContent = noBike ? 'PAD REACH · SEM MEDIÇÃO' :
        reach === null ? 'PAD REACH · FAIXA' : 'PAD REACH · MEDIDO';
      labels[1].textContent = noBike ? 'PAD STACK · SEM MEDIÇÃO' :
        stack === null ? 'PAD STACK · FAIXA' : 'PAD STACK · MEDIDO';
    }

    const complete = stack !== null && reach !== null;
    const button = el('paiva-tt-use-comparator');
    if (button) button.disabled = !complete;
    const status = el('paiva-tt-pad-status');
    if (status) status.textContent = complete
      ? 'Coordenadas registradas. Agora você pode compará-las com a faixa de ajuste dos apoios de cada TT.'
      : catalog
        ? 'As faixas acima são apenas limites do modelo de referência. Preencha os pads reais para comparar a posição do atleta.'
        : 'Informe a estatura para ver um exemplo de regulagem; nenhuma coordenada ideal TT é calculada só pela antropometria.';

    syncReportPreview();
    if (typeof window.fillClientReport === 'function') window.fillClientReport();
  }

  function initialize() {
    if (!el('paiva-tt-coordinates')) return;
    for (const id of ['paiva-tt-pad-stack', 'paiva-tt-pad-reach']) {
      el(id).addEventListener('input', render);
      el(id).addEventListener('change', render);
    }
    document.querySelectorAll('[data-mode]').forEach(button =>
      button.addEventListener('click', render));

    el('paiva-tt-use-comparator').addEventListener('click', () => {
      const stack = measured('paiva-tt-pad-stack', 200, 1200);
      const reach = measured('paiva-tt-pad-reach', 100, 900);
      if (stack === null || reach === null) return;
      document.querySelector('[data-cmp-select="tt"]')?.click();
      for (const [key, value] of [['stack', stack], ['reach', reach]]) {
        const target = el('paiva-cmp-target-pad-' + key);
        if (!target) continue;
        target.value = String(value);
        target.dispatchEvent(new Event('input', {bubbles:true}));
      }
      const details = document.querySelector('#paiva-compare .paiva-cmp-reference');
      if (details) details.open = true;
      el('paiva-compare')?.scrollIntoView({behavior:'smooth', block:'start'});
      el('paiva-tt-pad-status').textContent = 'Referência copiada para o comparador TT. Insira os dados dos dois modelos e confira os limites de ajuste.';
    });

    // A rotina original repinta os cartões ao mudar modalidade ou antropometria;
    // estes ouvintes rodam depois dela e mantêm a leitura TT como PAD, nunca QUADRO.
    document.addEventListener('input', event => {
      if (event.target?.id === 'height' || event.target?.id === 'inseam') render();
    });
    document.addEventListener('change',event=>{
      if(['paiva-tt-model','paiva-tt-path'].includes(event.target?.id))render();
    });
    // O pré-fit antigo repinta todos os cartões (inclusive os ocultos) em cada
    // input. Um observador restitui o valor medido sem permitir que reapareça a
    // antiga estimativa TT de quadro; só escreve quando o conteúdo difere.
    const observer = new MutationObserver(() => {
      if (mode() !== 'tt') return;
      const current=displayValues();
      const noBike=window.PAIVA_TT_SIMPLE&&!window.PAIVA_TT_SIMPLE.isCatalogMode();
      const stackText=noBike?'—':current.stackText;
      const reachText=noBike?'—':current.reachText;
      if (el('ttStackValue').textContent !== stackText || el('ttReachValue').textContent !== reachText)
        render();
    });
    for (const id of ['ttStackValue', 'ttReachValue'])
      observer.observe(el(id), {childList:true,characterData:true,subtree:true});
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
