/* PAIVA V5.61 — assinatura própria PAIVA Motion Studio e PIN visual.
   O PIN é uma trava local de interface; NÃO é autenticação de servidor. */
(() => {
  'use strict';

  // SHA-256 de um PIN aleatório de 6 dígitos. O código fonte continua público.
  const PIN_SHA256 = 'f0d8a8299da2e2fb211a6bec83576f05f8387fa4f43e9b308531a7572747c8d9';
  const root = document.documentElement;
  let failures = 0;
  let cooldownUntil = 0;

  async function hashPin(value) {
    if (!globalThis.crypto?.subtle) throw new Error('Abra o aplicativo em um endereço HTTPS.');
    const data = new TextEncoder().encode(value);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  }

  // Símbolo PAIVA: um P geométrico e um eixo de movimento. Desenho original
  // do software, independente das marcas dos equipamentos do estúdio.
  function paivaSymbol(suffix) {
    return `<svg class="paiva-signature-symbol" viewBox="0 0 72 72" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs><linearGradient id="paiva-steel-${suffix}" x1="12" y1="8" x2="60" y2="65"
        gradientUnits="userSpaceOnUse"><stop stop-color="#f8fafb"/>
        <stop offset=".42" stop-color="#9baab4"/><stop offset=".72" stop-color="#e0e7eb"/>
        <stop offset="1" stop-color="#6d7c86"/></linearGradient></defs>
      <path d="M17 61V13H39C51.8 13 59 20.5 59 31S51.8 49 39 49H17"
        stroke="url(#paiva-steel-${suffix})" stroke-width="6.5" stroke-linejoin="miter"/>
      <path d="M38 60L57 41" stroke="url(#paiva-steel-${suffix})"
        stroke-width="2.3" stroke-linecap="square"/>
      <circle cx="58" cy="40" r="3.1" fill="#dce5ea"/>
    </svg>`;
  }

  function enhanceHeader(main) {
    const header = main.querySelector(':scope > header');
    if (!header || header.classList.contains('paiva-premium-header')) return;
    const logo = header.querySelector('#logo');
    const legacyTag = header.querySelector('.brand-tag');
    const headline = header.querySelector('h1');
    const content = headline?.parentElement;
    const actions = header.querySelector('.actions');
    const pdf = actions?.querySelector('#print');
    const upload = actions?.querySelector('#logoFile')?.closest('label');
    const reset = actions?.querySelector('#resetLogo');
    if (!logo || !content || !actions || !pdf || !upload || !reset) return;

    const identity = document.createElement('div');
    identity.className = 'paiva-premium-identity';
    identity.innerHTML = `${paivaSymbol('header')}
      <div class="paiva-premium-wordmark"><strong>PAIVA</strong>
        <span>MOTION STUDIO</span></div>`;

    content.classList.add('paiva-premium-content');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'paiva-premium-eyebrow';
    eyebrow.textContent = 'BIOMECÂNICA  /  PRECISÃO  /  MOVIMENTO';
    content.prepend(eyebrow);
    const fitter = content.querySelector('.fitter-header-info');
    fitter?.classList.add('paiva-premium-contact');
    // Mantém os dados e o mailto originais, mas o endereço legado não compete
    // visualmente com a assinatura própria PAIVA.
    const fitterName = fitter?.querySelector('strong');
    if (fitterName) fitterName.parentElement.replaceChildren(fitterName);
    const email = fitter?.querySelector('a[href^="mailto:"]');
    if (email) {
      email.title = email.textContent;
      email.textContent = 'Contato profissional';
      email.parentElement.replaceChildren(email);
    }

    const settings = document.createElement('details');
    settings.id = 'paiva-brand-settings';
    settings.className = 'paiva-brand-settings';
    const summary = document.createElement('summary');
    summary.textContent = 'Identidade do relatório';
    const settingsContent = document.createElement('div');
    settingsContent.className = 'paiva-brand-settings-content';
    const label = document.createElement('span');
    label.textContent = 'Logotipo utilizado no PDF';
    settingsContent.append(label, logo, upload, reset);
    settings.append(summary, settingsContent);

    actions.classList.add('paiva-premium-actions');
    pdf.textContent = 'Salvar PDF';
    actions.replaceChildren(pdf, settings);
    legacyTag?.remove();
    header.classList.add('paiva-premium-header');
    header.replaceChildren(identity, content, actions);
  }

  function initialize() {
    const main = document.querySelector('body > main');
    if (!main) return;

    enhanceHeader(main);

    const overlay = document.createElement('section');
    overlay.id = 'paiva-pin-lock';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Acesso ao PAIVA Motion Studio');
    overlay.innerHTML = `
      <div class="paiva-pin-panel">
        <div class="paiva-pin-emblem">${paivaSymbol('pin')}</div>
        <div class="paiva-pin-wordmark">PAIVA</div>
        <div class="paiva-pin-submark">MOTION STUDIO</div>
        <div class="paiva-pin-divider" aria-hidden="true"></div>
        <p class="paiva-pin-eyebrow">ÁREA RESERVADA</p>
        <h2 class="paiva-pin-title">Acesso pessoal</h2>
        <p class="paiva-pin-description">Digite seu PIN de 6 dígitos para continuar.</p>
        <form id="paiva-pin-form" autocomplete="off">
          <label for="paiva-pin-input" class="paiva-pin-description">PIN de acesso</label>
          <input id="paiva-pin-input" class="paiva-pin-input" type="password"
            inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6"
            autocomplete="off" enterkeyhint="done" required aria-describedby="paiva-pin-error" />
          <button class="paiva-pin-submit" type="submit">Entrar no estúdio</button>
          <p id="paiva-pin-error" class="paiva-pin-error" role="status" aria-live="polite"></p>
        </form>
        <p class="paiva-pin-note">PAIVA MOTION STUDIO · V5.61 · ACESSO LOCAL</p>
      </div>`;

    const relock = document.createElement('button');
    relock.id = 'paiva-pin-relock';
    relock.type = 'button';
    relock.textContent = '🔒 Bloquear';
    relock.setAttribute('aria-label', 'Bloquear aplicativo');

    document.body.append(overlay, relock);
    const form = overlay.querySelector('form');
    const field = overlay.querySelector('input');
    const submit = overlay.querySelector('button');
    const error = overlay.querySelector('#paiva-pin-error');

    function lock() {
      root.classList.remove('paiva-pin-unlocked');
      main.setAttribute('inert', '');
      main.setAttribute('aria-hidden', 'true');
      overlay.hidden = false;
      field.value = '';
      error.textContent = '';
      field.focus();
    }

    function unlock() {
      main.removeAttribute('inert');
      main.removeAttribute('aria-hidden');
      root.classList.add('paiva-pin-unlocked');
      overlay.hidden = true;
      field.value = '';
      failures = 0;
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = field.value;
      if (!/^\d{6}$/.test(value)) {
        error.textContent = 'Digite exatamente 6 números.';
        return;
      }
      if (Date.now() < cooldownUntil) {
        error.textContent = 'Aguarde um pouco antes de tentar novamente.';
        return;
      }
      submit.disabled = true;
      try {
        if (await hashPin(value) === PIN_SHA256) {
          unlock();
        } else {
          failures += 1;
          field.value = '';
          if (failures >= 5) {
            cooldownUntil = Date.now() + 30_000;
            failures = 0;
            error.textContent = 'Muitas tentativas. Aguarde 30 segundos.';
          } else {
            error.textContent = 'PIN incorreto. Tente novamente.';
          }
          field.focus();
        }
      } catch (err) {
        error.textContent = err.message || 'Não foi possível verificar o PIN.';
      } finally {
        submit.disabled = false;
      }
    });

    relock.addEventListener('click', lock);
    lock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
