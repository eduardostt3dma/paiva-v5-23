/* PAIVA V5.23 — medidas reais em tempo real nas etiquetas anatômicas. */
(() => {
  'use strict';

  const references = [
    { input: 'shoulder', name: 'Ombros', spot: 'shoulder' },
    { input: 'arm', name: 'Braço', spot: 'arm' },
    { input: 'torso', name: 'Tronco líquido', spot: 'torso' },
    { input: 'inseam', name: 'Entrepernas', spot: 'inseam' },
    { input: 'height', name: 'Estatura', spot: 'height' },
    { input: 'foot', name: 'Pé', spot: 'foot' }
  ];

  function numberFromInput(element) {
    if (!element) return null;
    const raw = String(element.value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function asCentimeters(value) {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' cm';
  }

  function initialize() {
    const host = document.querySelector('.layout > .card:first-child .body-silhouette');
    const image = host?.querySelector('img');
    if (!host || !image || host.querySelector('.paiva-anthro-figure')) return;

    // A figura tem a mesma proporção da imagem; os pontos não deslocam no iPad.
    const figure = document.createElement('div');
    figure.className = 'paiva-anthro-figure';
    image.parentNode.insertBefore(figure, image);
    figure.appendChild(image);
    image.alt = 'Esqueletos em vistas frontal e lateral com medidas antropométricas atualizadas pela avaliação';

    const labels = new Map();
    for (const reference of references) {
      const spot = document.createElement('div');
      spot.className = 'paiva-anthro-spot paiva-anthro-spot--' + reference.spot;

      const name = document.createElement('span');
      name.className = 'paiva-anthro-spot__name';
      name.textContent = reference.name;

      const value = document.createElement('strong');
      value.className = 'paiva-anthro-spot__value';
      value.hidden = true;

      spot.append(name, value);
      figure.appendChild(spot);
      labels.set(reference.input, { spot, value });
    }

    function render() {
      for (const reference of references) {
        const input = document.getElementById(reference.input);
        const value = numberFromInput(input);
        const label = labels.get(reference.input);
        label.value.textContent = value === null ? '' : asCentimeters(value);
        label.value.hidden = value === null;
        label.spot.title = value === null
          ? reference.name + ': não informado'
          : reference.name + ': ' + label.value.textContent;
      }
    }

    const relevant = new Set(references.map(ref => ref.input));
    document.addEventListener('input', event => {
      if (relevant.has(event.target?.id)) render();
    });
    document.addEventListener('change', event => {
      if (relevant.has(event.target?.id)) render();
    });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
