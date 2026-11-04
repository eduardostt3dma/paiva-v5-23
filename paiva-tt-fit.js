/* PAIVA V5.26 — TT profissional: coordenadas dos apoios independentes do quadro.
   Não converter a referência Road por estatura para prescrever uma TT. */
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
    const geometryNote = document.querySelector('.layout .disclaimer');
    if (geometryNote) geometryNote.textContent = isTT
      ? 'TT: a imagem apresenta PAD STACK e PAD REACH medidos nos apoios. Stack/reach do quadro TT devem ser consultados na geometria do modelo; não são as mesmas grandezas e não resultam de uma conversão Road.'
      : 'Pré-fit Road/MTB: stack/reach do quadro são referências exploratórias de triagem por estatura, não um ajuste individual validado. Confira a geometria real e a avaliação dinâmica.';
    const legend = document.querySelector('.diagram-legend span:first-child');
    if (legend?.lastChild?.nodeType === 3) legend.lastChild.nodeValue = isTT
      ? ' Coordenadas reais dos apoios TT' : ' Medidas de geometria do quadro';
    if (!isTT) return;

    const stack = measured('paiva-tt-pad-stack', 200, 1200);
    const reach = measured('paiva-tt-pad-reach', 100, 900);
    if (el('ttStackValue').textContent !== mm(stack)) el('ttStackValue').textContent = mm(stack);
    if (el('ttReachValue').textContent !== mm(reach)) el('ttReachValue').textContent = mm(reach);

    const complete = stack !== null && reach !== null;
    const button = el('paiva-tt-use-comparator');
    if (button) button.disabled = !complete;
    const status = el('paiva-tt-pad-status');
    if (status) status.textContent = complete
      ? 'Coordenadas registradas. Agora você pode compará-las com a faixa de ajuste dos apoios de cada TT.'
      : 'Sem medição válida dos dois pads, nenhuma posição TT será estimada a partir da tabela Road.';

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
    // O pré-fit antigo repinta todos os cartões (inclusive os ocultos) em cada
    // input. Um observador restitui o valor medido sem permitir que reapareça a
    // antiga estimativa TT de quadro; só escreve quando o conteúdo difere.
    const observer = new MutationObserver(() => {
      if (mode() !== 'tt') return;
      const stack = mm(measured('paiva-tt-pad-stack', 200, 1200));
      const reach = mm(measured('paiva-tt-pad-reach', 100, 900));
      if (el('ttStackValue').textContent !== stack || el('ttReachValue').textContent !== reach)
        render();
    });
    for (const id of ['ttStackValue', 'ttReachValue'])
      observer.observe(el(id), {childList:true,characterData:true,subtree:true});
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
