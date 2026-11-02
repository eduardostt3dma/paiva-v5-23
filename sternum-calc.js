/* PAIVA V5.23 — tronco líquido pelo protocolo de altura esternal ao solo. */
(() => {
  'use strict';

  function initialize() {
    const inseam = document.getElementById('inseam');
    const torso = document.getElementById('torso');
    const fields = document.getElementById('fields');
    if (!inseam || !torso || !fields || document.getElementById('sternumHeight')) return;

    const css = document.createElement('style');
    css.id = 'paiva-sternum-style';
    css.textContent = `
      .paiva-computed-field input[readonly] {
        background: #1e292b !important;
        color: #e8dca5 !important;
        border-color: #68786a !important;
        cursor: default;
      }
      .paiva-formula-note {
        margin: 4px 0 14px;
        padding: 8px 10px;
        color: #aab8c2;
        background: #111820;
        border: 1px solid #394651;
        border-radius: 9px;
        font-size: 11px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .paiva-sternum-stat { min-width: 0; }
      .paiva-sternum-stat span { overflow-wrap: anywhere; }
    `;
    document.head.append(css);

    const row = document.createElement('div');
    row.className = 'field paiva-sternum-field';
    row.innerHTML = `
      <label for="sternumHeight">Esterno (altura ao solo)</label>
      <input id="sternumHeight" type="number" inputmode="decimal" step="0.1" min="0"
        placeholder="Ex.: 145" aria-label="Altura do ponto esternal ao solo em centímetros" />
      <button type="button" class="help" aria-label="Como medir a altura do esterno">?</button>`;
    inseam.closest('.field').before(row);
    const sternum = row.querySelector('input');

    const torsoRow = torso.closest('.field');
    torsoRow.classList.add('paiva-computed-field');
    torsoRow.querySelector('label').textContent = 'Tronco líquido (calculado)';
    torso.readOnly = true;
    torso.placeholder = '—';
    torso.setAttribute('aria-readonly', 'true');
    torso.title = 'Altura do esterno ao solo menos entrepernas, em centímetros.';
    const oldHelp = torsoRow.querySelector('.help');
    if (oldHelp) {
      oldHelp.removeAttribute('data-help');
      oldHelp.title = 'Tronco líquido = esterno − entrepernas';
      oldHelp.setAttribute('aria-label', 'Como é calculado o tronco líquido');
      oldHelp.addEventListener('click', showHelp);
    }

    const note = document.createElement('p');
    note.className = 'paiva-formula-note';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    torsoRow.after(note);

    const stats = document.querySelector('.body-stats');
    const torsoValue = document.getElementById('repTorso');
    let sternumValue = null;
    if (stats && torsoValue) {
      const torsoStat = torsoValue.closest('div');
      const inseamStat = document.getElementById('repInseam')?.closest('div');
      const newStat = document.createElement('div');
      newStat.className = 'paiva-sternum-stat';
      newStat.innerHTML = '<span>ESTERNO AO SOLO</span><strong id="repSternum">—</strong>';
      stats.insertBefore(newStat, torsoStat);
      if (inseamStat) stats.insertBefore(inseamStat, torsoStat);
      const torsoLabel = torsoStat.querySelector('span');
      if (torsoLabel) torsoLabel.textContent = 'TRONCO LÍQUIDO';
      sternumValue = document.getElementById('repSternum');
    }

    const parse = input => {
      const text = input.value.trim().replace(',', '.');
      const value = Number(text);
      return text && Number.isFinite(value) && value > 0 ? value : null;
    };
    const readable = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

    function sync() {
      const s = parse(sternum);
      const i = parse(inseam);
      if (sternumValue) sternumValue.textContent = s === null ? '—' : readable(s) + ' cm';

      const raw = s !== null && i !== null && s > i ? s - i : null;
      const valid = raw !== null && raw <= 150;
      const result = valid ? String(Math.round(raw * 10) / 10) : '';
      if (torso.value !== result) {
        torso.value = result;
        // Reaproveita a atualização original das medidas e do relatório.
        torso.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (s === null || i === null) {
        note.textContent = 'Tronco líquido = altura do esterno ao solo − entrepernas.';
      } else if (!valid) {
        note.textContent = 'Confira as medidas: a altura do esterno deve ser maior que a entrepernas.';
      } else {
        note.textContent = `Tronco líquido: ${readable(s)} − ${readable(i)} = ${readable(Number(result))} cm.`;
      }
    }

    function showHelp() {
      const guide = document.getElementById('guide');
      if (!guide) return;
      const open = guide.classList.contains('show') && guide.dataset.open === 'paiva-torso-protocol';
      if (open) { guide.classList.remove('show'); return; }
      guide.dataset.open = 'paiva-torso-protocol';
      guide.innerHTML = '<h3>Tronco líquido · protocolo PAIVA</h3><p>Meça a altura vertical do ponto esternal de referência até o solo. Subtraia a medida da entrepernas, usando o mesmo piso e a mesma unidade (cm). O resultado aparece automaticamente.</p>';
      guide.classList.add('show');
    }

    row.querySelector('button').addEventListener('click', showHelp);
    sternum.addEventListener('input', sync);
    inseam.addEventListener('input', sync);
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
