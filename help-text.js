/* PAIVA V5.23 — orientações textuais profissionais, sem bonecos esquemáticos. */
(() => {
  'use strict';

  const GUIDES = {
    height: {
      title: 'Estatura',
      reference: 'Do solo ao ponto mais alto da cabeça.',
      how: 'Meça com a pessoa descalça, em pé, olhando para a frente e mantendo a postura habitual. Registre o valor em centímetros.',
      note: 'A estatura isolada não determina o tamanho ideal do quadro.'
    },
    inseam: {
      title: 'Entrepernas · cavalo',
      reference: 'Distância vertical entre a referência da virilha e o solo.',
      how: 'Utilize a régua ou o equipamento antropométrico de forma padronizada. A pessoa deve estar descalça; mantenha a mesma pressão e o mesmo protocolo nas reavaliações.',
      note: 'É uma referência para a posição inicial do selim, não uma altura definitiva.'
    },
    torso: {
      title: 'Tronco líquido · método PAIVA',
      reference: 'Altura do esterno ao solo menos a medida das entrepernas.',
      how: 'Registre as duas leituras separadamente. O campo do tronco líquido é calculado automaticamente no aplicativo.',
      note: 'O resultado depende dos pontos de referência adotados pelo profissional.'
    },
    arm: {
      title: 'Braço líquido · régua antropométrica',
      reference: 'Leitura superior no acrômio menos leitura inferior na palma da mão.',
      how: 'Posicione os indicadores nas duas referências e leia os valores na mesma escala da ferramenta. O aplicativo faz a subtração.',
      note: 'Reproduza o mesmo procedimento nas reavaliações.'
    },
    shoulder: {
      title: 'Largura dos ombros',
      reference: 'Distância entre os acrômios direito e esquerdo.',
      how: 'Identifique as referências ósseas dos dois acrômios. Meça entre esses pontos sem incluir a projeção muscular do deltoide.',
      note: 'A escolha do guidão também depende de modalidade, conforto e controle.'
    },
    foot: {
      title: 'Comprimento do pé',
      reference: 'Do ponto mais posterior do calcanhar à extremidade do dedo mais longo.',
      how: 'Meça o pé apoiado e registre a distância em centímetros. Quando necessário, compare os dois pés.',
      note: 'O comprimento total do pé não substitui a identificação da linha metatarsal.'
    },
    metatarsal: {
      title: 'Calcanhar → linha dos metatarsos',
      reference: 'Do extremo posterior do calcanhar à linha transversal das cabeças metatarsais.',
      how: 'Localize as cabeças metatarsais e a referência posterior do calcanhar. Mantenha o mesmo protocolo de marcação e registro.',
      note: 'É referência para análise do taco; a posição final exige avaliação individual.'
    },
    saddleX: {
      title: 'Recuo do selim',
      reference: 'Distância horizontal entre o bico do selim e a vertical do centro do movimento central.',
      how: 'Use referências niveladas e registre sinal negativo quando o bico estiver atrás do centro do movimento central, conforme a convenção do aplicativo.',
      note: 'A geometria e o formato do selim afetam a comparação entre bicicletas.'
    },
    realReach: {
      title: 'Reach real do quadro',
      reference: 'Distância horizontal entre o centro do movimento central e o centro superior de referência do tubo de direção.',
      how: 'Utilize a geometria publicada pelo fabricante ou a medição física seguindo a mesma referência de quadro.',
      note: 'Reach do quadro não equivale ao alcance da mão no guidão.'
    },
    extension: {
      title: 'Direção → apoio das mãos',
      reference: 'Distância horizontal entre a referência superior do tubo de direção e o ponto de apoio das mãos.',
      how: 'Considere o conjunto de mesa, guidão e posição real de apoio: STI na Speed, manoplas na MTB ou apoios aerodinâmicos na TT.',
      note: 'Mantenha a definição da referência consistente entre as bicicletas comparadas.'
    }
  };

  function init() {
    const guide = document.getElementById('guide');
    if (!guide || document.getElementById('paiva-help-style')) return;

    const css = document.createElement('style');
    css.id = 'paiva-help-style';
    css.textContent = `
      #guide.guide { border: 1px solid #65717b; border-radius: 14px;
        background: linear-gradient(160deg,#202932,#111820); padding: 0;
        box-shadow: 0 14px 40px #0004; overflow: hidden; }
      #guide.guide.show { padding: 17px 19px 18px; }
      #guide h3 { margin: 0 0 12px; font-size: 15px; line-height: 1.25;
        color: #f0f4f6; font-weight: 750; }
      #guide p { margin: 8px 0; color: #c0ccd5; font-size: 12px;
        line-height: 1.65; overflow-wrap: anywhere; }
      #guide .paiva-help-label { display:block; font-weight: 800;
        color: #9aaebd; font-size: 10px; letter-spacing: .09em;
        text-transform: uppercase; margin-top: 13px; }
      #guide .paiva-help-note { color: #d8e3e7; font-size: 11px;
        border-left: 2px solid #a7b8c2; padding-left: 11px; margin-top: 13px; }
      #guide .paiva-help-close { float: right; border: 1px solid #52616c;
        background: #27313b; border-radius: 8px; color: #e2eaf0;
        padding: 5px 10px; font-size: 11px; cursor: pointer; }
      @media print { #guide { display: none !important; } }
    `;
    document.head.append(css);

    // A escuta em captura antecede o desenho antigo, que era aberto no evento
    // delegado de clique. Os outros botões de ajuda, sem data-help, não mudam.
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-help]');
      if (!button) return;
      const key = button.dataset.help;
      const content = GUIDES[key];
      if (!content) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const sameOpen = guide.classList.contains('show') && guide.dataset.open === 'paiva-text-' + key;
      if (sameOpen) { guide.classList.remove('show'); return; }
      guide.replaceChildren();

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'paiva-help-close';
      close.textContent = 'Fechar';
      close.addEventListener('click', () => guide.classList.remove('show'));
      guide.append(close);

      const title = document.createElement('h3');
      title.textContent = content.title;
      guide.append(title);

      const paragraph = (label, text, emphasis = false) => {
        const heading = document.createElement('span');
        heading.className = 'paiva-help-label';
        heading.textContent = label;
        const p = document.createElement('p');
        if (emphasis) p.className = 'paiva-help-note';
        p.textContent = text;
        guide.append(heading, p);
      };
      paragraph('Referência', content.reference);
      paragraph('Como medir', content.how);
      paragraph('Atenção', content.note, true);
      guide.dataset.open = 'paiva-text-' + key;
      guide.classList.add('show');
    }, { capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
