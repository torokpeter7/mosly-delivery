import { supabase, isSupabaseConfigured } from './supabase.js';
import { STATUS_LABELS } from './utils.js';

const STATUS_OPTIONS = [
  { value: 'order_received', label: 'Rendelés felvéve' },
  { value: 'out_for_delivery', label: 'Kiszállítás alatt' },
  { value: 'courier_on_way', label: 'Úton hozzád' },
  { value: 'delivered', label: 'Kiszállítva' }
];

const geocodeCache = new Map();

function getStartPointValue() {
  const input = document.getElementById('routeStartPoint');
  return (input?.value || 'Baja, Orgona utca 2').trim();
}

function buildAddressQuery(shipment) {
  return [shipment.city, shipment.street, shipment.house_number].filter(Boolean).join(' ');
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeAddress(address) {
  const normalized = (address || '').trim();
  if (!normalized) return null;
  if (geocodeCache.has(normalized)) return geocodeCache.get(normalized);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(normalized)}&limit=1&accept-language=hu`, {
      headers: {
        'Accept-Language': 'hu'
      }
    });
    const data = await response.json();
    const match = Array.isArray(data) ? data[0] : null;
    const coords = match ? { lat: Number(match.lat), lon: Number(match.lon) } : null;
    geocodeCache.set(normalized, coords);
    return coords;
  } catch (error) {
    geocodeCache.set(normalized, null);
    return null;
  }
}

async function orderShipmentsByDistance(shipments) {
  const startPoint = getStartPointValue();
  const startCoords = await geocodeAddress(startPoint);

  if (!startCoords) {
    return [...shipments].sort((a, b) => (a.city || '').localeCompare(b.city || ''));
  }

  const withDistance = await Promise.all(shipments.map(async (shipment) => {
    const query = buildAddressQuery(shipment);
    const coords = await geocodeAddress(query);
    const distanceKm = coords
      ? haversineKm(startCoords.lat, startCoords.lon, coords.lat, coords.lon)
      : Number.MAX_SAFE_INTEGER;

    return { ...shipment, __distanceKm: distanceKm };
  }));

  return withDistance.sort((a, b) => a.__distanceKm - b.__distanceKm);
}

function renderShipmentTable(shipments) {
  const table = document.getElementById('courierShipmentsTable');
  const mapsButton = document.getElementById('googleMapsRouteButton');
  const startPoint = getStartPointValue();

  if (!table) return;

  if (mapsButton) {
    const routeStops = shipments.map((shipment) => `${shipment.city} ${shipment.street} ${shipment.house_number}`.trim()).filter(Boolean);
    const destinationQuery = routeStops.length ? routeStops.join(' / ') : startPoint;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startPoint)}&destination=${encodeURIComponent(routeStops[routeStops.length - 1] || startPoint)}&waypoints=${encodeURIComponent(routeStops.slice(0, -1).join('|'))}`;
    mapsButton.href = mapsUrl;
    mapsButton.style.display = routeStops.length ? 'inline-block' : 'none';
  }

  table.innerHTML = shipments.map((shipment) => `
    <tr>
      <td>${shipment.tracking_number}</td>
      <td>${shipment.customer_name}</td>
      <td>${shipment.customer_phone}</td>
      <td>${shipment.city}, ${shipment.street} ${shipment.house_number}</td>
      <td>${shipment.notes || '—'}</td>
      <td><span class="status-badge status-${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span></td>
      <td>
        <div class="inline-actions">
          <a class="btn-small" href="tel:${shipment.customer_phone}">HÍVÁS</a>
          <a class="btn-small" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shipment.city} ${shipment.street} ${shipment.house_number}`)}" target="_blank" rel="noreferrer">ÚTVONAL</a>
          <select class="status-select" data-status-select="${shipment.id}" aria-label="Csomag státusz módosítása">
            ${STATUS_OPTIONS.map((option) => `
              <option value="${option.value}" ${shipment.status === option.value ? 'selected' : ''}>
                ${option.label}
              </option>
            `).join('')}
          </select>
          <button class="btn-small" data-status-action="${shipment.id}">STÁTUSZ MÓDOSÍTÁSA</button>
        </div>
      </td>
    </tr>
  `).join('');

  table.querySelectorAll('[data-status-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const shipmentId = button.dataset.statusAction;
      const select = document.querySelector(`[data-status-select="${shipmentId}"]`);
      const nextStatus = select?.value;

      if (!nextStatus) return;

      const { error } = await supabase.from('shipments').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', shipmentId);
      if (!error) {
        loadCourierShipments();
      }
    });
  });
}

export async function loadCourierShipments() {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase.from('shipments').select('*').order('created_at', { ascending: false });
  if (error || !data) return;

  const sorted = await orderShipmentsByDistance(data);
  renderShipmentTable(sorted);
}

export function setupCourierPage() {
  const optimizeButton = document.getElementById('routeOptimizeButton');
  if (optimizeButton) {
    optimizeButton.addEventListener('click', () => {
      loadCourierShipments();
    });
  }

  loadCourierShipments();
}

if (document.readyState !== 'loading') {
  setupCourierPage();
}
