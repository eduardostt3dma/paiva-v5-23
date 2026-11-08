/* PAIVA Bike Fit Studio V5.23 — exportação local e compartilhamento de PDF.
   Funciona offline após o cache da PWA, sem enviar avaliações a servidores. */
(() => {
  'use strict';

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 42;
  const CONTENT_W = PAGE_W - 2 * MARGIN;

  function cleanText(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[→⇒↔]/g, ' -> ')
      .replace(/[–—−]/g, '-')
      .replace(/×/g, 'x')
      .replace(/≈/g, 'aprox.')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      // Helvetica padrão em PDF usa WinAnsi: preservar letras acentuadas latinas.
      .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
      .trim();
  }

  function wrapText(text, font, size, maxWidth) {
    const input = cleanText(text);
    if (!input) return ['-'];
    const lines = [];
    let line = '';
    for (const word of input.split(/\s+/)) {
      const trial = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        line = trial;
        continue;
      }
      if (line) { lines.push(line); line = ''; }
      let piece = '';
      for (const character of word) {
        if (piece && font.widthOfTextAtSize(piece + character, size) > maxWidth) {
          lines.push(piece);
          piece = '';
        }
        piece += character;
      }
      line = piece;
    }
    if (line) lines.push(line);
    return lines.length ? lines : ['-'];
  }

  async function embedImage(pdf, source) {
    if (typeof source !== 'string' || !source) return null;
    try {
      if (source.startsWith('data:image/jpeg') || source.startsWith('data:image/jpg')) {
        return await pdf.embedJpg(source);
      }
      if (source.startsWith('data:image/png')) return await pdf.embedPng(source);

      // As ilustrações padrão e a logo são arquivos do próprio aplicativo.
      // Também são lidos do cache quando a instalação PWA está offline.
      const url = new URL(source, location.href);
      if (url.origin !== location.origin) return null;
      const response = await fetch(url.href);
      if (!response.ok) throw new Error(`Imagem indisponível: ${response.status}`);
      const bytes = await response.arrayBuffer();
      const type = response.headers.get('content-type') || '';
      if (type.includes('png') || /\.png(?:$|\?)/i.test(url.pathname)) {
        return await pdf.embedPng(bytes);
      }
      if (type.includes('jpeg') || type.includes('jpg') || /\.jpe?g(?:$|\?)/i.test(url.pathname)) {
        return await pdf.embedJpg(bytes);
      }
    } catch (error) {
      console.warn('Imagem opcional não inserida no PDF:', error);
    }
    return null;
  }

  function readPairs(id) {
    const root = document.getElementById(id);
    if (!root) return [];
    return [...root.querySelectorAll('dl > div')].map(item => ({
      label: item.querySelector('dt')?.textContent?.trim() || '',
      value: item.querySelector('dd')?.textContent?.trim() || 'Não informado',
    })).filter(item => item.label);
  }

  function collectReport() {
    if (typeof window.fillClientReport === 'function') window.fillClientReport();
    document.dispatchEvent(new Event('input', { bubbles: true }));
    const sizing = globalThis.PAIVA_ANTHRO_METHOD?.getReport?.() || null;
    const isFullProfile = sizing?.mode === 'full';
    const isTT = document.querySelector('[data-mode].active')?.dataset.mode === 'tt';

    const results = [...document.querySelectorAll('#results .result')].map(item => ({
      label: item.querySelector('.head span')?.textContent?.trim() || '',
      value: item.querySelector('.head strong')?.textContent?.trim() || '—',
      description: item.querySelector('small')?.textContent?.trim() || '',
    })).filter(item => item.label && !(isFullProfile && !isTT && /^(stack|reach)\b/i.test(item.label)));

    const bikeMetrics = [...document.querySelectorAll('#reportBikeMetrics .report-bike-metric')].map(item => ({
      label: item.querySelector('span')?.textContent?.trim() || '',
      value: item.querySelector('strong')?.textContent?.trim() || '',
    })).filter(item => item.label && !(isFullProfile && !isTT && /^(stack|reach)\b/i.test(item.label)));

    const clientName = document.getElementById('clientName')?.value?.trim() || 'Cliente';
    const clientBikeImage = globalThis.PAIVA_BIKE_PHOTOS?.getActiveImage?.();
    return {
      clientName,
      generatedAt: new Date().toLocaleDateString('pt-BR'),
      logo: document.getElementById('logo')?.src || '',
      bikeImage: clientBikeImage || document.getElementById('reportBikePhoto')?.src || '',
      client: readPairs('reportClient'),
      bike: readPairs('reportBike'),
      body: readPairs('reportBody'),
      sizing,
      proportions: globalThis.PAIVA_PROPORTIONS?.getReport?.() || null,
      bikeProject: globalThis.PAIVA_BIKE_PROJECT?.getReport?.() || null,
      results,
      bikeMetrics,
      finalMeasurements: globalThis.PAIVA_FINAL_MEASURES?.getReport?.() || [],
      comparison: globalThis.PAIVA_FRAME_COMPARE?.getReport?.() || null,
      note: document.querySelector('#clientReport .report-warning p')?.textContent?.trim() ||
        'Medidas e estimativas iniciais. A avaliação dinâmica e a geometria real da bicicleta devem orientar o ajuste final.',
    };
  }

  // Avaliação antropométrica V5.83: identidade somente pela logo,
  // acabamento digital grafite e paginação automática. Sem alterar fórmulas ou medições.
  async function buildPdf(data) {
    const lib = globalThis.PDFLib;
    if (!lib?.PDFDocument) throw new Error('O gerador de PDF não carregou. Atualize o aplicativo online e tente novamente.');

    const pdf = await lib.PDFDocument.create();
    pdf.setTitle('Avaliação de Antropometria - ' + cleanText(data.clientName));
    pdf.setAuthor('Eduardo Paiva');
    pdf.setSubject('Avaliação antropométrica individual, pré-fit e registro de medidas da bicicleta');
    pdf.setCreator('Motion Studio - relatório digital');

    const regular = await pdf.embedFont(lib.StandardFonts.Helvetica);
    const medium = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
    const rgb = (r, g, b) => lib.rgb(r / 255, g / 255, b / 255);
    // Paleta de leitura digital: fundo preto-grafite em TODAS as páginas,
    // cartões cinza-escuro e tipografia clara de alto contraste.
    const C = {
      graphite: rgb(12, 15, 19),
      charcoal: rgb(20, 25, 31),
      text: rgb(240, 244, 247),
      secondary: rgb(175, 188, 199),
      muted: rgb(144, 158, 171),
      steel: rgb(190, 202, 211),
      steelDark: rgb(183, 194, 203),
      line: rgb(54, 65, 75),
      soft: rgb(24, 30, 36),
      softBlue: rgb(28, 36, 44),
      white: rgb(255, 255, 255),
      accent: rgb(194, 166, 112),
      photoMat: rgb(111, 118, 125),
    };

    // Remove apenas margens transparentes da imagem escolhida pelo avaliador.
    // A logo do cabeçalho do software permanece intacta.
    async function prepareLogo(source) {
      if (!source || !/^data:image\/(?:png|jpeg|jpg)/i.test(source) || typeof Image === 'undefined') return source;
      try {
        return await new Promise(resolve => {
          const image = new Image();
          image.onerror = () => resolve(source);
          image.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = image.naturalWidth;
              canvas.height = image.naturalHeight;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (!ctx) return resolve(source);
              ctx.drawImage(image, 0, 0);
              const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
              for (let py = 0; py < canvas.height; py += 1) {
                for (let px = 0; px < canvas.width; px += 1) {
                  if (pixels[(py * canvas.width + px) * 4 + 3] < 24) continue;
                  if (px < minX) minX = px;
                  if (px > maxX) maxX = px;
                  if (py < minY) minY = py;
                  if (py > maxY) maxY = py;
                }
              }
              if (maxX < minX || maxY < minY) return resolve(source);
              const pad = Math.max(4, Math.round(Math.max(maxX - minX, maxY - minY) * 0.025));
              const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
              const sw = Math.min(canvas.width - sx, maxX - sx + 1 + pad);
              const sh = Math.min(canvas.height - sy, maxY - sy + 1 + pad);
              if (sw >= canvas.width * 0.96 && sh >= canvas.height * 0.96) return resolve(source);
              const cropped = document.createElement('canvas');
              cropped.width = sw; cropped.height = sh;
              cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
              resolve(cropped.toDataURL('image/png'));
            } catch (_) { resolve(source); }
          };
          image.src = source;
        });
      } catch (_) { return source; }
    }

    const logo = await embedImage(pdf, await prepareLogo(data.logo));
    const bike = await embedImage(pdf, data.bikeImage);
    // A mesma arte do cabeçalho aprovado, preparada exclusivamente para o PDF,
    // sem os botões, a versão ou os créditos de interface.
    const reportCover = await embedImage(pdf, data.reportCover || './paiva-report-cover-v583.png');
    const left = MARGIN, right = PAGE_W - MARGIN;
    const bottomLimit = 79;
    let page, y;
    let pageCount = 0;

    function text(str, x, baseline, size = 9, color = C.text, font = regular) {
      const content = cleanText(str);
      if (!content) return;
      page.drawText(content, { x, y: baseline, size, color, font });
    }
    // Espaçamento tipográfico refinado para o título discreto da capa.
    // Não altera fontes, dados, fórmulas ou a arte original do cabeçalho.
    function trackedText(str, x, baseline, size, color, font, tracking) {
      const content = cleanText(str);
      for (const char of content) {
        page.drawText(char, { x, y: baseline, size, color, font });
        x += font.widthOfTextAtSize(char, size) + tracking;
      }
    }
    function line(x1, yy, x2, color = C.line, thickness = 0.65) {
      page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
    }
    function fittedImage(img, x, baseY, maxW, maxH) {
      if (!img) return;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: x + (maxW - w) / 2, y: baseY + (maxH - h) / 2, width: w, height: h });
    }
    function newPage() {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      // Preenche o papel inteiro, inclusive margens e rodapé, para leitura digital.
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.graphite });
      pageCount += 1;
      const first = pageCount === 1;
      const coverH = first && reportCover ? PAGE_W * reportCover.height / reportCover.width : 0;
      const headerH = first ? (reportCover ? coverH + 68 : 142) : 89;
      page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: C.graphite });
      if (first && reportCover) {
        // Sem distorcer ou repetir a logo: a composição original ocupa toda a largura.
        page.drawImage(reportCover, { x: 0, y: PAGE_H - coverH, width: PAGE_W, height: coverH });
        // Assinatura editorial discreta: menos peso visual, mais respiro.
        trackedText('AVALIAÇÃO DE ANTROPOMETRIA', left, PAGE_H - coverH - 19, 9.3, C.white, regular, 0.85);
        trackedText('DOCUMENTO INDIVIDUAL', left, PAGE_H - coverH - 34, 7.0, C.steel, regular, 0.55);
        // Assinatura pequena, inspirada na tipografia limpa do Motion Studio.
        // Crédito profissional transferido para o rodapé em todas as páginas.
      } else {
        if (logo) fittedImage(logo, left, PAGE_H - (first ? 106 : 69), first ? 244 : 179, first ? 77 : 49);
        const titleX = first ? 324 : 308;
        text('DOCUMENTO INDIVIDUAL', titleX, PAGE_H - (first ? 47 : 34), 8, C.steel, medium);
        text('AVALIAÇÃO DE ANTROPOMETRIA', titleX, PAGE_H - (first ? 70 : 53), first ? 10 : 9.4, C.white, medium);
        if (first) text('DOCUMENTO INDIVIDUAL', titleX, PAGE_H - 90, 7.5, C.steel);
      }
      page.drawRectangle({ x: 0, y: PAGE_H - headerH - 1, width: PAGE_W, height: 1, color: C.accent });
      y = PAGE_H - headerH - (first ? 26 : 24);
    }
    function ensureSpace(height) {
      if (!page || y - height < bottomLimit) newPage();
    }
    function drawSectionHeading(title) {
      ensureSpace(82);
      y -= 15;
      page.drawRectangle({ x: left, y: y - 7, width: 2.4, height: 14, color: C.accent });
      text(cleanText(title).toUpperCase(), left + 13, y - 3, 10.4, C.text, medium);
      line(left, y - 16, right, C.line, 0.85);
      y -= 34;
    }
    function drawPair(label, value) {
      const labelLines = wrapText(label, regular, 8.9, 210);
      const valueLines = wrapText(value, medium, 9.5, CONTENT_W - 251);
      const count = Math.max(labelLines.length, valueLines.length);
      const h = Math.max(32, 13 + count * 13);
      ensureSpace(h + 2);
      const top = y;
      labelLines.forEach((part, i) => text(part, left + 8, top - 14 - i * 13, 8.9, C.secondary));
      valueLines.forEach((part, i) => text(part, left + 244, top - 14 - i * 13, 9.5, C.text, medium));
      line(left, top - h + 2, right, C.line, 0.5);
      y -= h;
    }
    function drawPairs(title, rows) {
      if (!rows?.length) return;
      ensureSpace(128); // evita titulo solto no fim da pagina
      drawSectionHeading(title);
      rows.forEach(item => drawPair(item.label || 'Medida', item.value ?? 'Não informado'));
      y -= 8;
    }
    function drawMeasurementGrid(title, rows) {
      if (!rows?.length) return;
      ensureSpace(160); // titulo + primeiro cartao antropometrico
      drawSectionHeading(title);
      const gap = 10, colW = (CONTENT_W - gap) / 2;
      for (let i = 0; i < rows.length; i += 2) {
        const entries = rows.slice(i, i + 2);
        const specs = entries.map(item => {
          const labels = wrapText(item.label || 'Medida', regular, 8.4, colW - 22);
          const values = wrapText(item.value ?? '-', medium, 13.1, colW - 22);
          return { labels, values, h: 27 + labels.length * 11 + values.length * 17 + 13 };
        });
        const h = Math.max(68, ...specs.map(item => item.h));
        ensureSpace(h + 10);
        entries.forEach((item, j) => {
          const x = left + j * (colW + gap);
          const spec = specs[j];
          page.drawRectangle({ x, y: y - h, width: colW, height: h, color: C.soft, borderColor: C.line, borderWidth: 0.6 });
          spec.labels.forEach((part, k) => text(part, x + 11, y - 19 - k * 11, 8.4, C.secondary));
          const base = y - 19 - spec.labels.length * 11 - 12;
          spec.values.forEach((part, k) => text(part, x + 11, base - k * 17, 13.1, C.text, medium));
        });
        y -= h + 10;
      }
      y -= 3;
    }
    function drawParagraph(value, size = 9, color = C.secondary, indent = 0) {
      if (!value) return;
      const parts = wrapText(value, regular, size, CONTENT_W - indent - 2);
      for (const part of parts) {
        ensureSpace(size + 8);
        text(part, left + indent, y - size, size, color);
        y -= size + 5;
      }
      y -= 6;
    }
    function drawProportions(proportions) {
      const metrics = proportions?.metrics || [];
      if (!metrics.length) return;
      ensureSpace(205); // titulo + primeiros indicadores
      drawSectionHeading('04  Proporções corporais');
      const gap = 10, cols = Math.min(3, metrics.length), colW = (CONTENT_W - gap * (cols - 1)) / cols;
      for (let offset = 0; offset < metrics.length; offset += cols) {
        const row = metrics.slice(offset, offset + cols);
        const h = 117;
        ensureSpace(h + 13);
        row.forEach((metric, j) => {
          const x = left + j * (colW + gap);
          page.drawRectangle({ x, y: y - h, width: colW, height: h, color: C.soft, borderColor: C.line, borderWidth: 0.65 });
          wrapText(metric.label || 'Proporção', medium, 9.1, colW - 24).slice(0, 2).forEach((part, k) =>
            text(part, x + 12, y - 21 - k * 11, 9.1, C.text, medium));
          const percent = Number.isFinite(metric.percent) ? metric.percent : null;
          const pct = percent === null ? '-' : percent.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
          text(pct, x + 12, y - 64, 22, C.text, medium);
          page.drawRectangle({ x: x + 12, y: y - 81, width: colW - 24, height: 3, color: C.line });
          if (percent !== null) page.drawRectangle({ x: x + 12, y: y - 81, width: (colW - 24) * Math.max(0, Math.min(100, percent)) / 100, height: 3, color: C.steelDark });
          const caption = Number.isFinite(metric.length)
            ? metric.length.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' cm / estatura'
            : 'Medida não informada';
          wrapText(caption, regular, 7.8, colW - 24).slice(0, 2).forEach((part, k) =>
            text(part, x + 12, y - 97 - k * 10, 7.8, C.secondary));
        });
        y -= h + 13;
      }
      for (const metric of metrics) {
        if (metric.description) drawParagraph((metric.label ? metric.label + ': ' : '') + metric.description, 8.5);
      }
      drawParagraph(proportions.explanation, 9);
      drawParagraph(proportions.meaning, 9);
      if (proportions.conclusion) {
        ensureSpace(45);
        text('LEITURA DO AVALIADOR', left, y - 10, 8.5, C.steelDark, medium);
        y -= 19;
        drawParagraph(proportions.conclusion, 9, C.text);
      }
      y -= 5;
    }
    function drawResult(item) {
      const labelLines = wrapText(item.label || 'Resultado', medium, 10, 305);
      const valueLines = wrapText(item.value || '-', medium, 12.3, 162);
      const descLines = item.description ? wrapText(item.description, regular, 8.7, CONTENT_W - 27) : [];
      const titleH = Math.max(labelLines.length * 13, valueLines.length * 15);
      const h = 24 + titleH + (descLines.length ? 8 + descLines.length * 12 : 0);
      ensureSpace(h + 9);
      page.drawRectangle({ x: left, y: y - h, width: CONTENT_W, height: h, color: C.soft, borderColor: C.line, borderWidth: 0.55 });
      labelLines.forEach((part, i) => text(part, left + 13, y - 19 - i * 13, 10, C.text, medium));
      valueLines.forEach((part, i) => {
        const width = medium.widthOfTextAtSize(cleanText(part), 12.3);
        text(part, right - 13 - width, y - 20 - i * 15, 12.3, C.steelDark, medium);
      });
      const base = y - 19 - titleH - 9;
      descLines.forEach((part, i) => text(part, left + 13, base - i * 12, 8.7, C.secondary));
      y -= h + 9;
    }
    function drawBikePhoto() {
      if (!bike) return;
      ensureSpace(320); // titulo e foto sempre juntos
      drawSectionHeading('06  Bicicleta e referências visuais');
      const h = 230;
      ensureSpace(h + 12);
      page.drawRectangle({ x: left, y: y - h, width: CONTENT_W, height: h, color: C.photoMat, borderColor: C.line, borderWidth: 0.7 });
      fittedImage(bike, left + 16, y - h + 13, CONTENT_W - 32, h - 26);
      y -= h + 12;
      const metrics = data.bikeMetrics || [];
      if (metrics.length) {
        // Quatro indicadores ficam em uma grade 2x2, nunca 3+1.
        const gap = 9, cols = metrics.length === 4 ? 2 : Math.min(3, metrics.length);
        const colW = (CONTENT_W - gap * (cols - 1)) / cols;
        const metricHeights = [];
        for (let k = 0; k < metrics.length; k += cols) {
          const row = metrics.slice(k, k + cols);
          metricHeights.push(Math.max(66, ...row.map(item => {
            const l = wrapText(item.label, regular, 8.2, colW - 22).length;
            const v = wrapText(item.value, medium, 12, colW - 22).length;
            return 19 + l * 10 + 9 + v * 15 + 12;
          })) + 10);
        }
        const metricsTotal = metricHeights.reduce((sum, h) => sum + h, 0);
        if (metricsTotal < PAGE_H - 205) ensureSpace(metricsTotal);
        for (let i = 0; i < metrics.length; i += cols) {
          const row = metrics.slice(i, i + cols);
          const specs = row.map(item => ({
            labels: wrapText(item.label, regular, 8.2, colW - 22),
            values: wrapText(item.value, medium, 12, colW - 22),
          }));
          const h2 = Math.max(66, ...specs.map(s => 19 + s.labels.length * 10 + 9 + s.values.length * 15 + 12));
          ensureSpace(h2 + 10);
          row.forEach((item, j) => {
            const x = left + j * (colW + gap), spec = specs[j];
            page.drawRectangle({ x, y: y - h2, width: colW, height: h2, color: C.charcoal });
            spec.labels.forEach((part, k) => text(part, x + 11, y - 18 - k * 10, 8.2, C.steel));
            const valueTop = y - 18 - spec.labels.length * 10 - 10;
            spec.values.forEach((part, k) => text(part, x + 11, valueTop - k * 15, 12, C.white, medium));
          });
          y -= h2 + 10;
        }
      }
      y -= 5;
    }
    function drawInterpretation(note) {
      if (!note) return;
      ensureSpace(130); // titulo e primeiro trecho da nota
      drawSectionHeading('Interpretação profissional');
      const parts = wrapText(note, regular, 9.1, CONTENT_W - 29);
      let offset = 0;
      while (offset < parts.length) {
        const available = Math.max(1, Math.floor((y - bottomLimit - 34) / 14));
        if (available < 2) { newPage(); continue; }
        const batch = parts.slice(offset, offset + available);
        const h = 24 + batch.length * 14;
        ensureSpace(h + 8);
        page.drawRectangle({ x: left, y: y - h, width: CONTENT_W, height: h, color: C.softBlue });
        page.drawRectangle({ x: left, y: y - h, width: 3, height: h, color: C.steelDark });
        batch.forEach((part, i) => text(part, left + 15, y - 21 - i * 14, 9.1, C.text));
        y -= h + 10;
        offset += batch.length;
      }
    }

    newPage();
    // Ficha inicial do cliente - sem duplicar a palavra presente na logo.
    const nameLines = wrapText(data.clientName || 'Cliente', medium, 17.5, CONTENT_W - 150);
    const summaryH = Math.max(91, 57 + nameLines.length * 21);
    ensureSpace(summaryH + 8);
    page.drawRectangle({ x: left, y: y - summaryH, width: CONTENT_W, height: summaryH, color: C.soft });
    page.drawRectangle({ x: left, y: y - summaryH, width: 3, height: summaryH, color: C.steelDark });
    text('AVALIAÇÃO INDIVIDUAL', left + 17, y - 22, 8.5, C.steelDark, medium);
    nameLines.forEach((part, i) => text(part, left + 17, y - 48 - i * 21, 17.5, C.text, medium));
    const date = cleanText(data.generatedAt || new Date().toLocaleDateString('pt-BR'));
    text('EMISSÃO', right - 105, y - 22, 7.8, C.muted, medium);
    text(date, right - 105, y - 41, 10, C.text, medium);
    y -= summaryH + 14;

    drawPairs('01  Identificação do cliente', data.client);
    drawPairs('02  Dados da bicicleta', data.bike);
    drawMeasurementGrid('03  Antropometria', data.body);
    drawProportions(data.proportions);

    if (data.results?.length) {
      ensureSpace(160);
      drawSectionHeading('05  Resultados do pré-fit');
      data.results.forEach(drawResult);
      y -= 6;
    }
    if (data.sizing?.rows?.length) drawPairs('05A  Leitura antropométrica', data.sizing.rows);
    if (data.bikeProject?.rows?.length) drawPairs('05B  Projeto inicial da bicicleta', data.bikeProject.rows);

    drawBikePhoto();
    if (data.finalMeasurements?.length) {
      // Mantém a ficha de medidas finais agrupada sempre que couber em uma página.
      const estimate = data.finalMeasurements.reduce((total, item) => {
        const l = wrapText(item.label, regular, 8.9, 210).length;
        const v = wrapText(item.value, medium, 9.5, CONTENT_W - 251).length;
        return total + Math.max(32, 13 + Math.max(l, v) * 13);
      }, 0) + 62;
      if (estimate < PAGE_H - 190) ensureSpace(estimate);
      drawPairs('07  Medidas finais registradas', data.finalMeasurements);
    }
    if (data.comparison?.rows?.length) drawPairs('08  Comparação de quadros', data.comparison.rows);
    drawInterpretation(data.note);

    const pages = pdf.getPages();
    pages.forEach((p, index) => {
      // Rodapé preto contínuo, independente do fundo grafite do restante da página.
      p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 65, color: rgb(8, 10, 13) });
      p.drawLine({ start: { x: left, y: 59 }, end: { x: right, y: 59 }, thickness: 0.65, color: C.line });
      const footer = 'AVALIAÇÃO ANTROPOMÉTRICA  ·  ' + cleanText(data.generatedAt || '');
      p.drawText(footer, { x: left, y: 43, font: medium, size: 7.7, color: C.secondary });
      p.drawText('retul@yahoo.com  ·  (48) 98846-6144', { x: left, y: 30, font: regular, size: 7.2, color: C.secondary });
      // Crédito institucional propositalmente menor que todas as demais linhas.
      const creditPrefix = 'Software desenvolvido por Eduardo ';
      const creditSize = 6.1;
      const creditSpacing = 0.18;
      p.drawText(creditPrefix, { x: left, y: 17, font: regular, size: creditSize, color: C.steelDark, characterSpacing: creditSpacing });
      p.drawText('Paiva', { x: left + regular.widthOfTextAtSize(creditPrefix, creditSize) + creditSpacing * creditPrefix.length, y: 17, font: regular, size: creditSize, color: rgb(239, 195, 54), characterSpacing: creditSpacing });
      const count = String(index + 1).padStart(2, '0') + ' / ' + String(pages.length).padStart(2, '0');
      p.drawText(count, { x: right - medium.widthOfTextAtSize(count, 8), y: 36, font: medium, size: 8, color: C.steelDark });
    });
    return await pdf.save({ useObjectStreams: false });
  }

  function fileName(clientName) {
    const name = String(clientName || 'Cliente').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim().replace(/\s+/g, '_').slice(0, 45) || 'Cliente';
    const date = new Date().toISOString().slice(0, 10);
    return `Avaliacao_Antropometria_${name}_${date}.pdf`;
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function initialize() {
    const button = document.getElementById('print');
    if (!button || document.getElementById('paiva-share-pdf')) return;
    button.onclick = null; // Substitui a abertura da caixa de impressão pelo arquivo PDF real.
    button.textContent = 'Gerar PDF';
    button.type = 'button';

    const share = document.createElement('button');
    share.id = 'paiva-share-pdf';
    share.type = 'button';
    share.className = 'btn';
    share.textContent = 'Compartilhar PDF';
    button.after(share);

    const status = document.createElement('span');
    status.id = 'paiva-pdf-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'font-size:11px;color:#b7c5cf;align-self:center;min-width:0;';
    share.after(status);
    let busy = false;

    async function handle(shareRequested) {
      if (busy) return;
      busy = true;
      button.disabled = share.disabled = true;
      status.textContent = 'Preparando relatório em PDF...';
      try {
        const data = collectReport();
        const bytes = await buildPdf(data);
        const file = new File([bytes], fileName(data.clientName), { type: 'application/pdf' });
        if (shareRequested && navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Avaliação de Antropometria' });
            status.textContent = 'Relatório disponibilizado para compartilhamento.';
          } catch (shareError) {
            if (shareError?.name === 'AbortError') {
              status.textContent = 'Compartilhamento cancelado.';
            } else {
              downloadFile(file);
              status.textContent = 'O aparelho não permitiu compartilhar diretamente. PDF baixado para envio manual.';
            }
          }
        } else {
          downloadFile(file);
          status.textContent = shareRequested
            ? 'PDF salvo. Compartilhe o arquivo pelo WhatsApp ou e-mail.'
            : 'PDF gerado. Confira a pasta de downloads.';
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          status.textContent = 'Compartilhamento cancelado.';
        } else {
          console.error('Falha ao gerar PDF:', error);
          status.textContent = 'Não foi possível gerar o PDF. Confira os dados e tente novamente.';
        }
      } finally {
        busy = false;
        button.disabled = share.disabled = false;
      }
    }

    button.addEventListener('click', () => { void handle(false); });
    share.addEventListener('click', () => { void handle(true); });
  }

  // Também permite verificar a construção do PDF sem abrir uma interface gráfica.
  globalThis.PAIVA_PDF = { buildPdf, collectReport };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
