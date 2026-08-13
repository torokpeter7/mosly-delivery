import { isSupabaseConfigured, supabase } from './supabase.js';

export function setupNavigation() {
  const toggle = document.querySelector('.mobile-toggle');
  const menu = document.querySelector('.site-nav');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }
}

export function setupContactForm() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.querySelector('#name')?.value.trim() || '';
    const email = form.querySelector('#email')?.value.trim() || '';
    const message = form.querySelector('#message')?.value.trim() || '';

    if (!name || !email || !message) {
      status.className = 'alert show error';
      status.textContent = 'Kérjük, töltsd ki az összes mezőt.';
      return;
    }

    status.className = 'alert show success';
    status.textContent = 'Az üzenetét fogadtuk. Hamarosan válaszolunk.';
    form.reset();
  });
}

export function setupTrackingForm() {
  const form = document.getElementById('trackingForm');
  if (!form) return;

  const input = document.getElementById('trackingInput');
  const statusBox = document.getElementById('trackingStatus');
  const resultBox = document.getElementById('trackingResult');

  if (!input || !statusBox || !resultBox) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const trackingNumber = input.value.trim();

    if (!trackingNumber) {
      statusBox.className = 'alert show error';
      statusBox.textContent = 'Kérjük, add meg a csomagszámot.';
      resultBox.classList.add('hidden');
      return;
    }

    if (!isSupabaseConfigured()) {
      statusBox.className = 'alert show error';
      statusBox.textContent = 'A Supabase konfiguráció még nincs beállítva. Adjd meg a projekt URL és anon kulcs értékeit a js/supabase.js fájlban.';
      resultBox.classList.add('hidden');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_public_tracking_info', { p_tracking_number: trackingNumber });

      if (error || !data || data.length === 0) {
        statusBox.className = 'alert show error';
        statusBox.textContent = 'A megadott csomagszám nem található.';
        resultBox.classList.add('hidden');
        return;
      }

      const item = data[0];
      const history = Array.isArray(item.status_history) ? item.status_history.join('\n') : 'Nincs elérhető státusz történet.';

      document.getElementById('trackingNumber').value = item.tracking_number || trackingNumber;
      document.getElementById('trackingStatusValue').value = item.status_label || item.status || 'Ismeretlen';
      document.getElementById('trackingUpdatedAt').value = item.updated_at ? new Date(item.updated_at).toLocaleString('hu-HU') : '—';
      document.getElementById('trackingHistory').value = history;
      document.getElementById('statusBadge').textContent = item.status_label || item.status || 'Ismeretlen';
      document.getElementById('statusBadge').className = 'badge badge-neutral';

      resultBox.classList.remove('hidden');
      statusBox.className = 'alert show success';
      statusBox.textContent = 'A csomag adatai sikeresen betöltődtek.';
    } catch (error) {
      statusBox.className = 'alert show error';
      statusBox.textContent = 'Hiba történt a csomag lekérdezése közben.';
      resultBox.classList.add('hidden');
    }
  });
}

if (document.readyState !== 'loading') {
  setupNavigation();
  setupContactForm();
  setupTrackingForm();
}
