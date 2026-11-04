/* PAIVA V5.24 — resultados por modalidade, sem duplicações na TT.
   As referências são empíricas; o registro final depende da avaliação. */
(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const number = (id, min, max) => {
    const raw = String(get(id)?.value ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return raw && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const fmt = n => n.toLocaleString('pt-BR', {maximumFractionDigits:1});

  function addRow(host, label, value, description) {
    const row = document.createElement('div');
    row.className = 'result';
    const head = document.createElement('div');
    head.className = 'head';
    const name = document.createElement('span');
    name.textContent = label;
    const result = document.createElement('strong');
    result.textContent = value;
    head.append(name, result);
    row.append(head);
    if (description) {
      const small = document.createElement('small');
      small.textContent = description;
      row.append(small);
    }
    host.append(row);
  }

  function render() {
    const output = get('results');
    if (!output) return;
    const mode = document.querySelector('[data-mode].active')?.dataset.mode || 'road';
    const height = number('height', 140, 215);
    const inseam = number('inseam', 55, 110);
    const saddleValid = height !== null && inseam !== null && inseam < height;
    const saddleBB = saddleValid ? fmt(inseam * 0.883) + ' cm' : '—';
    const saddlePedal = saddleValid ? fmt(inseam * 1.09) + ' cm' : '—';
    const stack = get(mode + 'StackValue')?.textContent?.trim() || '—';
    const reach = get(mode + 'ReachValue')?.textContent?.trim() || '—';
    const fragment = document.createDocumentFragment();

    addRow(fragment, 'Altura do selim · centro do MC', saddleBB,
      'Referência LeMond: entreperna × 0,883. Medida do centro do movimento central até o topo do selim.');
    addRow(fragment, 'Stack · quadro', stack,
      'Referência exploratória por estatura; não equivale ao pad stack dos apoios.');
    addRow(fragment, 'Reach · quadro', reach,
      'Referência exploratória por estatura; não equivale ao alcance efetivo das mãos.');

    if (mode !== 'tt') {
      addRow(fragment, 'Altura do selim · eixo do pedal', saddlePedal,
        'Regra alternativa de 109% da entreperna, medida a partir do eixo do pedal. Não confundir com a distância a partir do MC.');
      const handId = mode === 'mtb' ? 'finalNoseGrip' : 'finalNoseSTI';
      const hand = number(handId, 1, 2000);
      addRow(fragment, mode === 'mtb' ? 'Bico do selim → manopla' : 'Bico do selim → STI',
        hand === null ? '—' : fmt(hand / 10) + ' cm',
        'Medida real informada pelo avaliador; não é calculada somente pela antropometria.');
      addRow(fragment, 'Comprimento do pedivela', 'Avaliar individualmente',
        'Considere flexão de quadril e joelho, cadência, conforto e teste dinâmico.');
    }

    output.replaceChildren(fragment);
    const note = get('validation');
    if (note) note.textContent = mode === 'tt'
      ? 'TT: apenas altura do selim, stack e reach nesta síntese. Para avaliar o encaixe aerodinâmico, use também pad stack e pad reach medidos nos apoios. A referência de 109% usa outro ponto inicial e não pode substituir diretamente a medida desde o MC.'
      : 'Referências exploratórias: a posição final deve ser confirmada na bicicleta. Top tube e mesa não equivalem ao alcance das mãos; registre a geometria real e as medidas finais.';
    if (typeof window.fillClientReport === 'function') window.fillClientReport();
  }

  function initialize() {
    if (!get('results')) return;
    const warning=document.querySelector('#clientReport .report-warning p');
    if (warning) warning.textContent = 'Referências de pré-fit obtidas de um guia exploratório por estatura, com transições suavizadas. A altura do selim por 0,883 é medida desde o movimento central; a regra de 109% utiliza o eixo do pedal e não representa a mesma distância. Stack e reach do quadro não equivalem à posição das mãos ou dos apoios de TT. Os valores finais devem ser medidos e confirmados pelo avaliador em movimento.';
    document.addEventListener('input', render);
    document.addEventListener('change', render);
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', render));
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
