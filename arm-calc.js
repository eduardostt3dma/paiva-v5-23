/* PAIVA V5.23 — medida líquida do braço na régua antropométrica Shimano.
   Braço = leitura superior (acrômio) − leitura inferior (palma da mão). */
(() => {
  'use strict';

  function initialize() {
    const arm = document.getElementById('arm');
    const fields = document.getElementById('fields');
    if (!arm || !fields || document.getElementById('armUpper')) return;

    const armRow = arm.closest('.field');
    if (!armRow) return;

    function readingField(id, label, placeholder, help) {
      const row = document.createElement('div');
      row.className = 'field paiva-arm-reading';
      row.innerHTML = `
        <label for="${id}">${label}</label>
        <input id="${id}" type="number" inputmode="decimal" step="0.1" min="0"
          placeholder="${placeholder}" aria-label="${label}, em centímetros"
          title="${help}" />
        <button type="button" class="help" aria-label="Como medir ${label}">?</button>`;
      return row;
    }

    const upperRow = readingField(
      'armUpper', 'Leitura superior — acrômio', 'Ex.: 145',
      'Registre a posição do ponteiro superior da régua no acrômio, em cm.');
    const lowerRow = readingField(
      'armLower', 'Leitura inferior — palma da mão', 'Ex.: 45',
      'Registre a posição do ponteiro inferior da mesma régua na palma da mão, em cm.');
    armRow.before(upperRow, lowerRow);

    armRow.classList.add('paiva-computed-field');
    armRow.querySelector('label').textContent = 'Braço líquido (calculado)';
    arm.readOnly = true;
    arm.placeholder = '—';
    arm.setAttribute('aria-readonly', 'true');
    arm.title = 'Leitura superior no acrômio menos leitura inferior na palma da mão.';

    const note = document.createElement('p');
    note.className = 'paiva-formula-note paiva-arm-note';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    armRow.after(note);

    const style = document.createElement('style');
    style.id = 'paiva-arm-style';
    style.textContent = `
      #fields .paiva-arm-reading { grid-template-columns: minmax(0, 1fr) 92px 28px;
        min-width: 0; }
      #fields .paiva-arm-reading label { min-width: 0; overflow-wrap: anywhere; }
      #fields .paiva-arm-reading input { min-width: 0; }
      .paiva-arm-note { overflow-wrap: anywhere; }
      .paiva-computed-field #arm[readonly] {
        background: #1e292b !important;
        color: #e8dca5 !important;
        border-color: #68786a !important;
        cursor: default;
      }
      @media (max-width: 700px) {
        #fields .paiva-arm-reading { grid-template-columns: minmax(0, 1fr) 86px 26px; }
      }
    `;
    document.head.append(style);

    const upper = upperRow.querySelector('input');
    const lower = lowerRow.querySelector('input');
    const originalHelp = armRow.querySelector('.help');

    function showHelp() {
      const guide = document.getElementById('guide');
      if (!guide) return;
      const open = guide.classList.contains('show') && guide.dataset.open === 'paiva-arm-protocol';
      if (open) { guide.classList.remove('show'); return; }
      guide.dataset.open = 'paiva-arm-protocol';
      guide.innerHTML = '<h3>Braço líquido · régua antropométrica</h3>' +
        '<p>Posicione uma referência da régua no acrômio e a outra na palma da mão. ' +
        'Leia os dois valores na mesma escala, em centímetros. ' +
        'O comprimento é calculado por: leitura superior − leitura inferior. ' +
        'Mantenha o mesmo protocolo e os mesmos pontos anatômicos em todas as reavaliações.</p>';
      guide.classList.add('show');
    }

    const parsing = input => {
      const raw = input.value.trim().replace(',', '.');
      const number = Number(raw);
      return raw !== '' && Number.isFinite(number) && number >= 0 ? number : null;
    };
    const display = number => number.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

    function sync() {
      const superior = parsing(upper);
      const inferior = parsing(lower);
      const valid = superior !== null && inferior !== null && superior > inferior;
      const calculated = valid ? Math.round((superior - inferior) * 10) / 10 : null;
      const output = calculated === null ? '' : String(calculated);

      if (arm.value !== output) {
        arm.value = output;
        // Atualiza imediatamente a antropometria, os resultados e o relatório.
        arm.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (superior === null || inferior === null) {
        note.textContent = 'Braço líquido = leitura superior (acrômio) − leitura inferior (palma da mão).';
      } else if (!valid) {
        note.textContent = 'Confira as leituras: o valor superior deve ser maior que o inferior.';
      } else {
        note.textContent = `Braço líquido: ${display(superior)} − ${display(inferior)} = ${display(calculated)} cm.`;
      }
    }

    if (originalHelp) {
      originalHelp.removeAttribute('data-help');
      originalHelp.title = 'Braço líquido = leitura superior − leitura inferior';
      originalHelp.setAttribute('aria-label', 'Como é calculado o braço líquido');
      originalHelp.addEventListener('click', showHelp);
    }
    upperRow.querySelector('button').addEventListener('click', showHelp);
    lowerRow.querySelector('button').addEventListener('click', showHelp);
    upper.addEventListener('input', sync);
    lower.addEventListener('input', sync);
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
