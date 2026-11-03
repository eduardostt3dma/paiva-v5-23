/* PAIVA V5.23 — foto real da bicicleta por modalidade, somente na avaliação atual.
   A foto é processada localmente; não é enviada ao GitHub nem a servidores. */
(() => {
  'use strict';

  const MODES = {
    road: { panel: 'roadPhotoPanel', name: 'Speed / Road' },
    mtb: { panel: 'mtbPhotoPanel', name: 'MTB' },
    tt: { panel: 'ttPhotoPanel', name: 'Triatlo / TT' },
  };

  function initialize() {
    const heading = document.getElementById('bikeHeading');
    const bikeWrap = heading?.closest('.card')?.querySelector('.bike-wrap');
    if (!heading || !bikeWrap || document.getElementById('paiva-bike-photo-controls')) return;

    const pictures = {};
    const originals = {};
    const custom = {};
    for (const [key, def] of Object.entries(MODES)) {
      pictures[key] = document.querySelector(`#${def.panel} img`);
      originals[key] = pictures[key]?.src || '';
      custom[key] = null;
    }

    const panel = document.createElement('section');
    panel.id = 'paiva-bike-photo-controls';
    panel.className = 'paiva-photo-controls';
    panel.innerHTML = `
      <div class="paiva-photo-intro">
        <strong>FOTO DA BICICLETA DO CLIENTE</strong>
        <span>Opcional · Substitui a imagem da modalidade escolhida nesta avaliação e no PDF.</span>
      </div>
      <div class="paiva-photo-buttons">
        <button type="button" class="btn" id="paiva-choose-bike-photo">Escolher foto</button>
        <button type="button" class="btn" id="paiva-take-bike-photo">Tirar foto</button>
        <button type="button" class="btn" id="paiva-remove-bike-photo">Restaurar imagem</button>
      </div>
      <p class="paiva-photo-status" id="paiva-bike-photo-status" role="status" aria-live="polite"></p>
      <input type="file" id="paiva-bike-photo-file" accept="image/*" hidden aria-label="Selecionar foto da bicicleta" />
      <input type="file" id="paiva-bike-photo-camera" accept="image/*" capture="environment" hidden aria-label="Fotografar a bicicleta" />`;
    bikeWrap.before(panel);

    const style = document.createElement('style');
    style.id = 'paiva-bike-photo-style';
    style.textContent = `
      .paiva-photo-controls { border: 1px solid #404a54; border-radius: 12px;
        background: #141b22; padding: 13px; margin: 14px 0 12px; min-width: 0; }
      .paiva-photo-intro { display: flex; flex-direction: column; gap: 4px; }
      .paiva-photo-intro strong { color: #e5edf2; font-size: 11px; letter-spacing: .055em; }
      .paiva-photo-intro span, .paiva-photo-status { font-size: 11px; color: #a7b5c1;
        line-height: 1.5; overflow-wrap: anywhere; }
      .paiva-photo-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
      .paiva-photo-buttons button { min-height: 39px; font-size: 11px; padding: 9px 11px; }
      .paiva-photo-buttons button:disabled { opacity: .4; cursor: default; }
      .paiva-photo-status { margin: 9px 0 0; min-height: 17px; }
      .paiva-bike-photo img.paiva-client-photo { object-fit: contain !important;
        object-position: center center !important; }
      @media(max-width: 700px) { .paiva-photo-buttons { gap: 6px; }
        .paiva-photo-buttons button { flex: 1 1 auto; padding: 9px 8px; font-size: 10px; } }
      @media print { #paiva-bike-photo-controls { display: none !important; } }
    `;
    document.head.append(style);

    const fileInput = document.getElementById('paiva-bike-photo-file');
    const cameraInput = document.getElementById('paiva-bike-photo-camera');
    const removeButton = document.getElementById('paiva-remove-bike-photo');
    const status = document.getElementById('paiva-bike-photo-status');
    const reportPhoto = document.getElementById('reportBikePhoto');
    const reportSubtitle = document.querySelector('#reportBikeVisual .report-bike-sub');
    const reportCaption = document.querySelector('#reportBikeVisual .report-bike-caption');
    const originalSubtitle = reportSubtitle?.textContent || '';
    const originalCaption = reportCaption?.textContent || '';

    const activeMode = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';

    function syncReport() {
      // Reaproveita a rotina existente, que copia a imagem da modalidade ativa
      // para o relatório (inclusive na exportação direta de PDF).
      document.dispatchEvent(new Event('input', { bubbles: true }));
      const mode = activeMode();
      if (reportPhoto && pictures[mode] && custom[mode]) reportPhoto.src = pictures[mode].src;
      if (reportSubtitle) reportSubtitle.textContent = custom[mode]
        ? `Bicicleta do cliente · ${MODES[mode].name}` : originalSubtitle;
      if (reportCaption) reportCaption.textContent = custom[mode]
        ? 'Fotografia fornecida durante a avaliação. Os valores apresentados são referências iniciais e não substituem a avaliação dinâmica.'
        : originalCaption;
    }

    function syncControls() {
      const mode = activeMode();
      removeButton.disabled = !custom[mode];
      status.textContent = custom[mode]
        ? `Foto real de ${MODES[mode].name} selecionada. Ela também aparecerá no relatório PDF.`
        : `${MODES[mode].name}: imagem ilustrativa PAIVA. Você pode substituí-la por uma foto do cliente.`;
      syncReport();
    }

    function jpegFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file?.type?.startsWith('image/')) {
          reject(new Error('Escolha uma imagem da galeria ou tire uma fotografia.'));
          return;
        }
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          try {
            if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imagem inválida.');
            const maxSide = 1800;
            const factor = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * factor);
            canvas.height = Math.round(img.naturalHeight * factor);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Não foi possível preparar a fotografia.');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/jpeg', .84);
            if (!data.startsWith('data:image/jpeg;base64,')) throw new Error('Formato não compatível.');
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Não foi possível abrir essa imagem. Tente uma foto JPG ou PNG.'));
        };
        img.src = objectUrl;
      });
    }

    async function addPhoto(event) {
      const file = event.target.files?.[0];
      const mode = activeMode();
      event.target.value = ''; // Permite selecionar novamente o mesmo arquivo.
      if (!file) return;
      status.textContent = 'Preparando fotografia para a avaliação e o PDF...';
      try {
        const data = await jpegFromFile(file);
        if (!pictures[mode]) throw new Error('Imagem da modalidade indisponível.');
        custom[mode] = data;
        pictures[mode].src = data;
        pictures[mode].classList.add('paiva-client-photo');
        syncControls();
      } catch (error) {
        console.error('PAIVA: fotografia não carregada', error);
        status.textContent = error.message || 'Não foi possível carregar a fotografia.';
      }
    }

    document.getElementById('paiva-choose-bike-photo').addEventListener('click', () => fileInput.click());
    document.getElementById('paiva-take-bike-photo').addEventListener('click', () => cameraInput.click());
    fileInput.addEventListener('change', addPhoto);
    cameraInput.addEventListener('change', addPhoto);
    removeButton.addEventListener('click', () => {
      const mode = activeMode();
      custom[mode] = null;
      pictures[mode].src = originals[mode];
      pictures[mode].classList.remove('paiva-client-photo');
      syncControls();
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => setTimeout(syncControls, 0));
    });
    // O exportador consulta diretamente esta imagem para evitar qualquer atraso
    // de carregamento da prévia nos navegadores móveis.
    globalThis.PAIVA_BIKE_PHOTOS = {
      getActiveImage: () => custom[activeMode()],
      activeHasCustomPhoto: () => Boolean(custom[activeMode()]),
    };
    syncControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
