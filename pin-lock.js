/* PAIVA V5.23 — trava simples de interface por PIN. NÃO é login seguro. */
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

  function initialize() {
    const main = document.querySelector('body > main');
    if (!main) return;

    const overlay = document.createElement('section');
    overlay.id = 'paiva-pin-lock';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Acesso ao PAIVA Bike Fit Studio');
    overlay.innerHTML = `
      <div class="paiva-pin-panel">
        <h1 class="paiva-pin-mark">PAIVA</h1>
        <p class="paiva-pin-subbrand">BIKE FIT STUDIO</p>
        <h2 class="paiva-pin-title">Acesso pessoal</h2>
        <p class="paiva-pin-description">Digite seu PIN de 6 dígitos para continuar.</p>
        <form id="paiva-pin-form" autocomplete="off">
          <label for="paiva-pin-input" class="paiva-pin-description">PIN de acesso</label>
          <input id="paiva-pin-input" class="paiva-pin-input" type="password"
            inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6"
            autocomplete="off" enterkeyhint="done" required aria-describedby="paiva-pin-error" />
          <button class="paiva-pin-submit" type="submit">Entrar</button>
          <p id="paiva-pin-error" class="paiva-pin-error" role="status" aria-live="polite"></p>
        </form>
        <p class="paiva-pin-note">PAIVA V5.23 · ACESSO LOCAL</p>
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
