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

    const results = [...document.querySelectorAll('#results .result')].map(item => ({
      label: item.querySelector('.head span')?.textContent?.trim() || '',
      value: item.querySelector('.head strong')?.textContent?.trim() || '—',
      description: item.querySelector('small')?.textContent?.trim() || '',
    })).filter(item => item.label && !(isFullProfile && /^(stack|reach)\b/i.test(item.label)));

    const bikeMetrics = [...document.querySelectorAll('#reportBikeMetrics .report-bike-metric')].map(item => ({
      label: item.querySelector('span')?.textContent?.trim() || '',
      value: item.querySelector('strong')?.textContent?.trim() || '',
    })).filter(item => item.label && !(isFullProfile && /^(stack|reach)\b/i.test(item.label)));

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
      results,
      bikeMetrics,
      finalMeasurements: globalThis.PAIVA_FINAL_MEASURES?.getReport?.() || [],
      comparison: globalThis.PAIVA_FRAME_COMPARE?.getReport?.() || null,
      note: document.querySelector('#clientReport .report-warning p')?.textContent?.trim() ||
        'Medidas e estimativas iniciais. A avaliação dinâmica e a geometria real da bicicleta devem orientar o ajuste final.',
    };
  }

  async function buildPdf(data) {
    const lib = globalThis.PDFLib;
    if (!lib?.PDFDocument) throw new Error('O gerador de PDF não carregou. Atualize o aplicativo online e tente novamente.');

    const pdf = await lib.PDFDocument.create();
    pdf.setTitle('PAIVA - Relatório de Bike Fit - ' + cleanText(data.clientName));
    pdf.setAuthor('PAIVA Bike Fit Studio');
    pdf.setSubject('Relatório profissional de pré-fit antropométrico e registro final opcional');

    const font = await pdf.embedFont(lib.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
    const C = {
      navy: lib.rgb(0.070, 0.115, 0.155),
      navy2: lib.rgb(0.105, 0.165, 0.205),
      steel: lib.rgb(0.67, 0.79, 0.85),
      blue: lib.rgb(0.28, 0.60, 0.74),
      white: lib.rgb(1, 1, 1),
      text: lib.rgb(0.12, 0.20, 0.26),
      secondary: lib.rgb(0.34, 0.42, 0.49),
      line: lib.rgb(0.84, 0.88, 0.91),
      tint: lib.rgb(0.955, 0.968, 0.980),
      lightBlue: lib.rgb(0.910, 0.951, 0.967),
    };
    const logo = await embedImage(pdf, data.logo);
    const bike = await embedImage(pdf, data.bikeImage);
    let page;
    let y;

    function newPage() {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      page.drawRectangle({ x: 0, y: PAGE_H - 125, width: PAGE_W, height: 125, color: C.navy });
      page.drawRectangle({ x: 0, y: PAGE_H - 125, width: 5, height: 125, color: C.blue });
      page.drawRectangle({ x: 0, y: PAGE_H - 128, width: PAGE_W, height: 3, color: C.steel });
      page.drawLine({ start: { x: 145, y: PAGE_H - 59 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 59 },
        thickness: 0.6, color: C.steel, opacity: .40 });
      if (logo) {
        page.drawImage(logo, { x: MARGIN, y: PAGE_H - 106, width: 86, height: 86 });
      }
      const titleX = logo ? 145 : MARGIN;
      page.drawText('PAIVA', { x: titleX, y: PAGE_H - 45, size: 26, font: bold, color: C.white });
      page.drawText('BIKE FIT STUDIO  |  ANÁLISE BIOMECÂNICA', { x: titleX, y: PAGE_H - 75, size: 8.2, font: bold, color: C.steel });
      page.drawText('RELATÓRIO DIGITAL PROFISSIONAL', { x: titleX, y: PAGE_H - 98, size: 10, font, color: C.white });
      y = PAGE_H - 153;
    }

    function ensureSpace(height) {
      if (!page || y - height < 64) newPage();
    }

    function sectionHeading(title) {
      ensureSpace(48);
      y -= 10;
      page.drawRectangle({ x: MARGIN, y: y - 11, width: 3, height: 14, color: C.blue });
      page.drawText(cleanText(title).toUpperCase(), { x: MARGIN + 12, y: y - 8, size: 10.5, font: bold, color: C.text });
      page.drawLine({ start: { x: MARGIN, y: y - 18 }, end: { x: PAGE_W - MARGIN, y: y - 18 }, thickness: .8, color: C.line });
      y -= 34;
    }

    function pairRow(label, value, index) {
      const labelWidth = 210;
      const valueWidth = CONTENT_W - labelWidth - 22;
      const labels = wrapText(label, font, 8.8, labelWidth);
      const values = wrapText(value, bold, 9, valueWidth);
      const lines = Math.max(labels.length, values.length);
      const height = Math.max(24, lines * 12 + 10);
      ensureSpace(height + 3);
      if (index % 2 === 0) {
        page.drawRectangle({ x: MARGIN, y: y - height + 3, width: CONTENT_W, height, color: C.tint });
      }
      for (let i = 0; i < labels.length; i++) {
        page.drawText(labels[i], { x: MARGIN + 10, y: y - 13 - i * 12, font, size: 8.8, color: C.secondary });
      }
      for (let i = 0; i < values.length; i++) {
        page.drawText(values[i], { x: MARGIN + labelWidth + 14, y: y - 13 - i * 12, font: bold, size: 9, color: C.text });
      }
      y -= height;
    }

    function pairsSection(title, rows) {
      sectionHeading(title);
      if (!rows?.length) { pairRow('Informações', 'Não informado', 0); y -= 12; return; }
      rows.forEach((item, index) => pairRow(item.label, item.value, index));
      y -= 12;
    }

    function resultRow(item, index) {
      const label = wrapText(item.label, bold, 9.4, 335);
      const value = wrapText(item.value, bold, 10, 144);
      const description = item.description ? wrapText(item.description, font, 8.4, CONTENT_W - 24) : [];
      const headHeight = Math.max(label.length * 12, value.length * 13);
      const height = headHeight + (description.length ? description.length * 11 + 7 : 0) + 17;
      ensureSpace(height + 4);
      if (index % 2 === 0) {
        page.drawRectangle({ x: MARGIN, y: y - height + 3, width: CONTENT_W, height, color: C.tint });
      }
      for (let i = 0; i < label.length; i++) {
        page.drawText(label[i], { x: MARGIN + 8, y: y - 13 - i * 12, font: bold, size: 9.4, color: C.text });
      }
      for (let i = 0; i < value.length; i++) {
        page.drawText(value[i], { x: MARGIN + 355, y: y - 13 - i * 13, font: bold, size: 10, color: C.text });
      }
      const detailY = y - 13 - headHeight - 5;
      for (let i = 0; i < description.length; i++) {
        page.drawText(description[i], { x: MARGIN + 8, y: detailY - i * 11, font, size: 8.4, color: C.secondary });
      }
      y -= height;
    }

    newPage();
    ensureSpace(49);
    page.drawRectangle({ x: MARGIN, y: y - 30, width: CONTENT_W, height: 39, color: C.lightBlue });
    const clientSummary = cleanText(data.clientName || 'Cliente');
    page.drawText('AVALIAÇÃO INDIVIDUAL', { x: MARGIN + 12, y: y - 7, size: 8, font: bold, color: C.secondary });
    page.drawText(clientSummary.length > 45 ? clientSummary.slice(0, 45) + '...' : clientSummary,
      { x: MARGIN + 12, y: y - 23, size: 12.4, font: bold, color: C.text });
    const dateText = cleanText(data.generatedAt);
    page.drawText(dateText, { x: PAGE_W - MARGIN - 12 - font.widthOfTextAtSize(dateText, 9), y: y - 15, size: 9, font, color: C.secondary });
    y -= 59;
    pairsSection('01 · Identificação do cliente', data.client);
    pairsSection('02 · Dados da bicicleta', data.bike);
    pairsSection('03 · Medidas antropométricas', data.body);

    sectionHeading('04 · Resultados do pré-fit');
    (data.results || []).forEach(resultRow);
    y -= 14;
    if (data.sizing?.rows?.length) {
      pairsSection('04A · Método de leitura antropométrica', data.sizing.rows);
    }

    if (bike) {
      ensureSpace(330);
      sectionHeading('05 · Visualização da bicicleta');
      const boxHeight = 228;
      page.drawRectangle({ x: MARGIN, y: y - boxHeight, width: CONTENT_W, height: boxHeight,
        color: C.tint, borderColor: C.line, borderWidth: .8 });
      const scale = Math.min((CONTENT_W - 26) / bike.width, (boxHeight - 22) / bike.height);
      const width = bike.width * scale;
      const height = bike.height * scale;
      page.drawImage(bike, { x: MARGIN + (CONTENT_W - width) / 2, y: y - boxHeight + (boxHeight - height) / 2, width, height });
      y -= boxHeight + 14;
      const metrics = data.bikeMetrics || [];
      if (metrics.length) {
        const gap = 9;
        const columns = Math.min(3, metrics.length);
        const tileWidth = (CONTENT_W - gap * (columns - 1)) / columns;
        const tileHeight = 49;
        ensureSpace(tileHeight + 7);
        metrics.slice(0, columns).forEach((item, index) => {
          const x = MARGIN + index * (tileWidth + gap);
          page.drawRectangle({ x, y: y - tileHeight + 3, width: tileWidth, height: tileHeight,
            color: C.navy2 });
          const label = wrapText(item.label, font, 8, tileWidth - 16).slice(0, 2);
          label.forEach((line, i) => page.drawText(line, { x: x + 9, y: y - 9 - i * 9,
            size: 8, font, color: C.steel }));
          const value = wrapText(item.value, bold, 10.2, tileWidth - 16).slice(0, 2);
          value.forEach((line, i) => page.drawText(line, { x: x + 9, y: y - 31 - i * 11,
            size: 10.2, font: bold, color: C.white }));
        });
        y -= tileHeight + 9;
        metrics.slice(columns).forEach((item, index) => pairRow(item.label, item.value, index));
      }
      y -= 12;
    }

    if (data.finalMeasurements?.length) {
      // Nunca deixar a ficha final quebrada com uma única medida órfã
      // na página seguinte: ela deve ser uma unidade legível para o cliente.
      const estimatedHeight = data.finalMeasurements.reduce((total, item) => {
        const label = wrapText(item.label, font, 8.8, 210);
        const value = wrapText(item.value, bold, 9, CONTENT_W - 232);
        return total + Math.max(24, Math.max(label.length, value.length) * 12 + 10) + 3;
      }, 0) + 66;
      if (estimatedHeight < PAGE_H - 205) ensureSpace(estimatedHeight);
      pairsSection('06 · Medidas finais registradas pelo avaliador', data.finalMeasurements);
    }

    if (data.comparison?.rows?.length) {
      pairsSection('07 · Comparação de quadros', data.comparison.rows);
    }

    const notes = wrapText(data.note || '', font, 8.7, CONTENT_W - 20);
    const notesHeight = notes.length * 12 + 34;
    ensureSpace(notesHeight + 6);
    page.drawRectangle({ x: MARGIN, y: y - notesHeight + 5, width: CONTENT_W, height: notesHeight, color: C.lightBlue, borderColor: C.line, borderWidth: 0.6 });
    page.drawRectangle({ x: MARGIN, y: y - notesHeight + 5, width: 3, height: notesHeight, color: C.blue });
    page.drawText('INTERPRETAÇÃO PROFISSIONAL', { x: MARGIN + 12, y: y - 12, size: 9, font: bold, color: C.text });
    notes.forEach((line, i) => page.drawText(line, { x: MARGIN + 10, y: y - 27 - i * 12, size: 8.7, font, color: C.secondary }));

    const pages = pdf.getPages();
    pages.forEach((p, index) => {
      p.drawRectangle({ x: MARGIN, y: 49, width: 26, height: 2, color: C.blue });
      p.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: PAGE_W - MARGIN, y: 46 }, thickness: 0.7, color: C.line });
      p.drawText('PAIVA  |  DOCUMENTO DIGITAL  |  ' + cleanText(data.generatedAt), { x: MARGIN, y: 31, font, size: 8, color: C.secondary });
      const number = `Página ${index + 1} de ${pages.length}`;
      p.drawText(number, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(number, 8), y: 31, font, size: 8, color: C.secondary });
    });

    return await pdf.save({ useObjectStreams: false });
  }

  function fileName(clientName) {
    const name = String(clientName || 'Cliente').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim().replace(/\s+/g, '_').slice(0, 45) || 'Cliente';
    const date = new Date().toISOString().slice(0, 10);
    return `PAIVA_PreFit_${name}_${date}.pdf`;
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
            await navigator.share({ files: [file], title: 'Relatório PAIVA Bike Fit Studio' });
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
