import { isSupabaseConfigured, supabase } from './supabase.js';
import { showAlert } from './utils.js';

export function setupPublicTracking() {
  const form = document.getElementById('trackingForm');
  const input = document.getElementById('trackingInput');
  const statusBox = document.getElementById('trackingStatus');
  const resultBox = document.getElementById('trackingResult');

  if (!form || !input || !statusBox || !resultBox) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const trackingNumber = input.value.trim();

    if (!trackingNumber) {
      showAlert(statusBox, 'Kérjük, add meg a csomagszámot.', 'error');
      resultBox.classList.add('hidden');
      return;
    }

    if (!isSupabaseConfigured()) {
      showAlert(statusBox, 'A Supabase konfiguráció még nincs beállítva. Ellenőrizd a js/supabase.js fájlt.', 'error');
      resultBox.classList.add('hidden');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_public_tracking_info', { p_tracking_number: trackingNumber });

      if (error || !data || data.length === 0) {
        showAlert(statusBox, 'A megadott csomagszám nem található.', 'error');
        resultBox.classList.add('hidden');
        return;
      }

      const item = data[0];
      const statusValue = item.status_label || item.status || 'Ismeretlen';
      const historyValue = Array.isArray(item.status_history) ? item.status_history.join('\n') : 'Nincs státusz történet.';

      document.getElementById('trackingNumber').value = item.tracking_number || trackingNumber;
      document.getElementById('trackingStatusValue').value = statusValue;
      document.getElementById('trackingUpdatedAt').value = item.updated_at ? new Date(item.updated_at).toLocaleString('hu-HU') : '—';
      document.getElementById('trackingHistory').value = historyValue;
      document.getElementById('statusBadge').textContent = statusValue;
      document.getElementById('statusBadge').className = 'badge badge-neutral';

      resultBox.classList.remove('hidden');
      showAlert(statusBox, 'A csomag adatai sikeresen betöltődtek.', 'success');
    } catch (error) {
      showAlert(statusBox, 'Hiba történt a csomag lekérdezése közben.', 'error');
      resultBox.classList.add('hidden');
    }
  });
}

if (document.readyState !== 'loading') {
  setupPublicTracking();
}
