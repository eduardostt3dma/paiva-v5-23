/* PAIVA V5.28 — Road/MTB independentes; TT separa medição real de faixas
   publicadas por fabricantes. Faixa de regulagem NÃO é fit individual. */
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

    if (mode === 'tt') {
      const padStack = number('paiva-tt-pad-stack', 200, 1200);
      const padReach = number('paiva-tt-pad-reach', 100, 900);
      const catalog = window.PAIVA_TT_REFERENCE?.getEstimate?.();
      const range = pair => pair ? pair[0] + '–' + pair[1] + ' mm' : '—';
      const source = catalog ? catalog.model + ' · tamanho ' + catalog.size : 'modelo ainda não definido';
      addRow(fragment, padStack === null ? 'Pad stack · faixa do modelo TT' : 'Pad stack · MEDIDO',
        padStack === null ? range(catalog?.padStack) : fmt(padStack) + ' mm',
        padStack === null
          ? 'FAIXA DE AJUSTE de ' + source + '. Não é a coordenada ideal do ciclista. Sem simulador, usar apenas para triagem de modelos.'
          : 'Medida real do centro do movimento central ao topo do apoio de antebraço. Não é o stack do quadro.');
      addRow(fragment, padReach === null ? 'Pad reach · faixa do modelo TT' : 'Pad reach · MEDIDO',
        padReach === null ? range(catalog?.padReach) : fmt(padReach) + ' mm',
        padReach === null
          ? 'FAIXA DE AJUSTE de ' + source + '. Não é a coordenada ideal do ciclista. Conferir convenção da borda posterior do pad.'
          : 'Medida real do centro do movimento central à borda posterior do apoio. Não é o reach do quadro.');
    } else {
      addRow(fragment, 'Stack · quadro', stack,
        'Referência exploratória por estatura para a modalidade selecionada.');
      addRow(fragment, 'Reach · quadro', reach,
        'Referência exploratória por estatura para a modalidade selecionada.');
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
      ? 'TT sem simulador: os números mostrados sem medição são LIMITES MECÂNICOS de regulagem do modelo de exemplo, NÃO alvos calculados pela antropometria. O selim é estimado pelo cavalo, e o stack/reach do quadro constam separadamente na ficha oficial. Quando houver pad medido, a medida real substitui a faixa nesta síntese.'
      : 'Referências exploratórias: a posição final deve ser confirmada na bicicleta. Top tube e mesa não equivalem ao alcance das mãos; registre a geometria real e as medidas finais.';
    if (typeof window.fillClientReport === 'function') window.fillClientReport();
  }

  function initialize() {
    if (!get('results')) return;
    const warning=document.querySelector('#clientReport .report-warning p');
    if (warning) warning.textContent = 'Road/MTB usam referências exploratórias por estatura. Para TT sem simulador, a ficha oficial de um modelo identificado permite verificar somente a faixa de regulagem possível dos apoios e selim; essas faixas não predizem pad stack/reach ideais por estatura. Quando medidos no fit, os valores dos pads substituem os exemplos de catálogo. A altura do selim por 0,883 parte do movimento central; 109% parte do eixo do pedal. Validar tudo no ajuste dinâmico.';
    document.addEventListener('input', render);
    document.addEventListener('change', render);
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', render));
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
