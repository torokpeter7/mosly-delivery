import { supabase, isSupabaseConfigured } from './supabase.js';
import { generateTrackingNumber, showAlert } from './utils.js';

export function setupNewShipmentForm() {
  const form = document.getElementById('newShipmentForm');
  const message = document.getElementById('newShipmentMessage');

  if (!form) return;
  if (form.dataset.moslyInitialized === 'true') return;
  form.dataset.moslyInitialized = 'true';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem('mosly-user') || '{}');
      } catch (error) {
        return {};
      }
    })();

    const payload = {
      tracking_number: generateTrackingNumber(),
      customer_name: form.querySelector('#customer_name')?.value.trim(),
      customer_email: form.querySelector('#customer_email')?.value.trim(),
      customer_phone: form.querySelector('#customer_phone')?.value.trim(),
      postal_code: form.querySelector('#postal_code')?.value.trim(),
      city: form.querySelector('#city')?.value.trim(),
      street: form.querySelector('#street')?.value.trim(),
      house_number: form.querySelector('#house_number')?.value.trim(),
      notes: form.querySelector('#notes')?.value.trim() || '',
      status: 'order_received',
      created_by: storedUser.id || null,
      courier_id: null
    };

    if (!payload.customer_name || !payload.customer_email || !payload.customer_phone || !payload.postal_code || !payload.city || !payload.street || !payload.house_number) {
      showAlert(message, 'Kérjük, töltse ki az összes kötelező mezőt.', 'error');
      return;
    }

    if (!storedUser.id) {
      showAlert(message, 'A rendelés rögzítéséhez be kell jelentkezni.', 'error');
      return;
    }

    if (!isSupabaseConfigured()) {
      showAlert(message, 'A Supabase konfiguráció még nincs beállítva. Ellenőrizd a js/supabase.js fájlt.', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('shipments').insert(payload);
      if (error) {
        showAlert(message, error.message || 'A rendelés mentése sikertelen volt.', 'error');
        return;
      }

      showAlert(message, `Rendelés sikeresen rögzítve. Csomagszám: ${payload.tracking_number}`, 'success');
      form.reset();
    } catch (error) {
      showAlert(message, 'Váratlan hiba történt a rendelés mentésekor.', 'error');
    }
  });
}

if (document.readyState !== 'loading') {
  setupNewShipmentForm();
}
