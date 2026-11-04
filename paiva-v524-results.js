/* PAIVA V5.26 — referência de quadros Road/MTB separada de pads TT.
   TT depende de medição profissional, não de uma curva Road por estatura. */
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
      addRow(fragment, 'Pad stack · apoio TT', padStack === null ? '—' : fmt(padStack) + ' mm',
        'Coordenada vertical medida do centro do movimento central até o topo do apoio de antebraço. Não é o stack do quadro.');
      addRow(fragment, 'Pad reach · apoio TT', padReach === null ? '—' : fmt(padReach) + ' mm',
        'Coordenada horizontal medida do centro do movimento central até a borda posterior do apoio. Não é o reach do quadro.');
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
      ? 'TT: a altura do selim é uma estimativa inicial; pad stack e pad reach são medidas reais dos apoios, informadas pelo avaliador. O stack e o reach do QUADRO TT devem ser obtidos na ficha específica do fabricante. Sem medição dos pads, o software não atribui números arbitrários à posição aerodinâmica.'
      : 'Referências exploratórias: a posição final deve ser confirmada na bicicleta. Top tube e mesa não equivalem ao alcance das mãos; registre a geometria real e as medidas finais.';
    if (typeof window.fillClientReport === 'function') window.fillClientReport();
  }

  function initialize() {
    if (!get('results')) return;
    const warning=document.querySelector('#clientReport .report-warning p');
    if (warning) warning.textContent = 'Road/MTB usam referências exploratórias por estatura. Para TT, o programa não converte a tabela Road: registra as coordenadas dos apoios de antebraço (pad stack e pad reach) medidas no fit e compara com a montagem específica da bicicleta. A altura do selim por 0,883 é medida desde o movimento central; a regra de 109% parte do eixo do pedal. Os valores finais devem ser medidos e confirmados pelo avaliador em movimento.';
    document.addEventListener('input', render);
    document.addEventListener('change', render);
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', render));
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
