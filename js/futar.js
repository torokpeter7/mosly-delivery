import { supabase, isSupabaseConfigured } from './supabase.js';
import { STATUS_LABELS } from './utils.js';

const geocodeCache = new Map();
const navigationState = {
  map: null,
  route: [],
  currentStopIndex: 0,
  watchId: null,
  currentPosition: null,
  routeLine: null,
  markers: [],
  currentPositionMarker: null,
  statusMessage: 'Várakozás',
  routeReady: false
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('mosly-user') || '{}');
  } catch (error) {
    return {};
  }
}

function getStartPointValue() {
  const input = document.getElementById('routeStartPoint');
  const fallback = 'Baja, Orgona utca 2';

  if (input && input.value && input.value.trim()) {
    return input.value.trim();
  }

  if (navigationState.currentPosition) {
    return `${navigationState.currentPosition.lat.toFixed(5)}, ${navigationState.currentPosition.lon.toFixed(5)}`;
  }

  return fallback;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDistanceKm(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatMinutes(minutes) {
  return `${Math.max(1, Math.round(minutes))} perc`;
}

function formatRouteDistance(route, startCoords) {
  if (!route.length) return 0;

  let totalKm = 0;
  let last = startCoords;

  route.forEach((stop) => {
    if (stop.coords && last) {
      totalKm += haversineKm(last.lat, last.lon, stop.coords.lat, stop.coords.lon);
      last = stop.coords;
    }
  });

  return totalKm;
}

function buildAddressQuery(shipment) {
  return [shipment.city, shipment.street, shipment.house_number].filter(Boolean).join(', ');
}

async function geocodeAddress(address) {
  const normalized = (address || '').trim();
  if (!normalized) return null;
  if (geocodeCache.has(normalized)) return geocodeCache.get(normalized);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(normalized)}&limit=1&accept-language=hu`, {
      headers: { 'Accept-Language': 'hu' }
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

async function resolveShipmentCoordinates(shipment) {
  if (shipment.latitude && shipment.longitude) {
    return { lat: Number(shipment.latitude), lon: Number(shipment.longitude) };
  }

  const address = buildAddressQuery(shipment);
  const coords = await geocodeAddress(address);

  if (coords && isSupabaseConfigured()) {
    try {
      await supabase
        .from('shipments')
        .update({ latitude: coords.lat, longitude: coords.lon, geocoded_at: new Date().toISOString() })
        .eq('id', shipment.id);
    } catch (error) {
      console.warn('Geokód mentése sikertelen:', error);
    }
  }

  return coords;
}

async function claimPendingShipments() {
  if (!isSupabaseConfigured()) return [];

  const user = getCurrentUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('id')
    .is('courier_id', null)
    .in('status', ['order_received', 'out_for_delivery', 'courier_on_way'])
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  const ids = data.map((shipment) => shipment.id);

  const { error: updateError } = await supabase
    .from('shipments')
    .update({
      courier_id: user.id,
      status: 'out_for_delivery',
      updated_at: new Date().toISOString()
    })
    .in('id', ids);

  if (updateError) {
    console.warn('Függőben lévő csomagok hozzárendelése sikertelen:', updateError);
    return [];
  }

  return ids;
}

async function getCourierShipments() {
  if (!isSupabaseConfigured()) return [];

  const user = getCurrentUser();
  if (!user?.id) return [];

  const direct = await supabase
    .from('shipments')
    .select('*')
    .eq('courier_id', user.id)
    .neq('status', 'delivered')
    .order('created_at', { ascending: true });

  if (!direct.error && direct.data && direct.data.length) {
    return direct.data;
  }

  const byEmail = user.email
    ? await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()
    : { data: null };

  const fallbackUserId = byEmail?.data?.id || user.id;

  const fallback = await supabase
    .from('shipments')
    .select('*')
    .eq('courier_id', fallbackUserId)
    .neq('status', 'delivered')
    .order('created_at', { ascending: true });

  if (!fallback.error && fallback.data && fallback.data.length) {
    return fallback.data;
  }

  const claimed = await claimPendingShipments();
  if (!claimed.length) {
    return [];
  }

  const assigned = await supabase
    .from('shipments')
    .select('*')
    .eq('courier_id', fallbackUserId)
    .neq('status', 'delivered')
    .order('created_at', { ascending: true });

  if (assigned.error) {
    console.error('Újra hozzárendelt csomagok lekérdezése hibás:', assigned.error);
    return [];
  }

  return assigned.data || [];
}

function sortStopsByDistance(stops, startCoords) {
  if (!startCoords || !stops.length) return stops;

  const remaining = [...stops];
  const ordered = [];
  let lastCoords = startCoords;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.MAX_SAFE_INTEGER;

    remaining.forEach((stop, index) => {
      if (!stop.coords) return;
      const distance = haversineKm(lastCoords.lat, lastCoords.lon, stop.coords.lat, stop.coords.lon);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const selected = remaining.splice(bestIndex, 1)[0];
    ordered.push(selected);
    lastCoords = selected.coords || lastCoords;
  }

  return ordered;
}

async function buildNavigationRoute() {
  const routeStart = getStartPointValue();
  const startCoords = await geocodeAddress(routeStart) || { lat: 46.07, lon: 18.93 };

  const shipments = await getCourierShipments();
  if (!shipments.length) return { route: [], startCoords, totalDistance: 0 };

  const withCoords = await Promise.all(
    shipments.map(async (shipment) => {
      const coords = await resolveShipmentCoordinates(shipment);
      return { ...shipment, coords: coords || null };
    })
  );

  const validStops = withCoords.filter((shipment) => shipment.coords);
  const route = sortStopsByDistance(validStops, startCoords);

  return {
    route,
    startCoords,
    totalDistance: formatRouteDistance(route, startCoords)
  };
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Jó reggelt!';
  if (hour < 18) return 'Jó napot!';
  return 'Jó estét!';
}

function getDirectionText(angle) {
  const rounded = (angle + 360) % 360;
  if (rounded >= 337.5 || rounded < 22.5) return 'Északkelet';
  if (rounded < 67.5) return 'Északkelet';
  if (rounded < 112.5) return 'Kelet';
  if (rounded < 157.5) return 'Délkelet';
  if (rounded < 202.5) return 'Dél';
  if (rounded < 247.5) return 'Délnyugat';
  if (rounded < 292.5) return 'Nyugat';
  return 'Északnyugat';
}

function getTurnInstruction(distanceKm, bearingDegrees) {
  if (!Number.isFinite(distanceKm) || distanceKm === null) return 'Kezdje az útvonalat.';
  const direction = getDirectionText(bearingDegrees);
  if (distanceKm < 0.2) return `Megközelíti a célpontot. Forduljon ${direction} felé.`;
  return `${Math.round(distanceKm * 1000)} m múlva forduljon ${direction} felé.`;
}

function bearingDegrees(fromLat, fromLon, toLat, toLon) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLon = toRadians(toLon - fromLon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function updateSummary(route, deliveredCount = 0) {
  const todayCount = route.length;
  const remainingCount = Math.max(0, route.length - deliveredCount);
  const totalDistance = route.length ? formatRouteDistance(route, { lat: 46.07, lon: 18.93 }) : 0;
  const avgVelocity = 24;
  const eta = route.length ? Math.round((totalDistance / avgVelocity) * 60) : 0;

  setText('courierGreeting', getGreetingText());
  setText('statsTodayCount', String(todayCount));
  setText('statsRemainingCount', String(remainingCount));
  setText('statsDistance', `${Number(totalDistance).toFixed(1)} km`);
  setText('statsEta', `${eta} min`);
  setText('statsDeliveredCount', String(deliveredCount));
}

function speakHungarian(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'hu-HU';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getNextStopFromRoute(route, index = 0) {
  if (!route.length) return null;
  return route[Math.min(index, route.length - 1)];
}

function updateNextStopVisual() {
  const nextStop = navigationState.route[navigationState.currentStopIndex];
  if (!nextStop) {
    setText('nextStopName', 'Nincs több megálló');
    setText('nextStopAddress', 'A mai útvonal befejeződött.');
    setText('turnInstruction', 'Kész a nap.');
    setText('nextStopDistance', '—');
    setText('nextStopEta', '—');
    document.getElementById('courierStatusChip').textContent = 'Kész';
    return;
  }

  const address = `${nextStop.city || ''} ${nextStop.street || ''} ${nextStop.house_number || ''}`.trim();
  const customerName = nextStop.customer_name || 'Ügyfél';
  let distanceText = '—';
  let etaText = '—';
  let instructionText = 'Közeli cél.';

  if (navigationState.currentPosition && nextStop.coords) {
    const distanceKm = haversineKm(
      navigationState.currentPosition.lat,
      navigationState.currentPosition.lon,
      nextStop.coords.lat,
      nextStop.coords.lon
    );

    const bearing = bearingDegrees(
      navigationState.currentPosition.lat,
      navigationState.currentPosition.lon,
      nextStop.coords.lat,
      nextStop.coords.lon
    );

    distanceText = formatDistanceKm(distanceKm);
    etaText = formatMinutes((distanceKm / 24) * 60);
    instructionText = getTurnInstruction(distanceKm, bearing);
  }

  setText('nextStopName', customerName);
  setText('nextStopAddress', address || 'Cím nem található');
  setText('turnInstruction', instructionText);
  setText('nextStopDistance', distanceText);
  setText('nextStopEta', etaText);
  setText('routeStateText', navigationState.routeReady ? 'Útvonal aktív' : 'Várakozás');
  document.getElementById('nextStopBadge').textContent = navigationState.routeReady ? 'Következő megálló' : 'Várakozás';
}

function drawMap() {
  if (!window.L) return;
  const mapContainer = document.getElementById('courierMap');
  if (!mapContainer) return;

  if (!navigationState.map) {
    navigationState.map = L.map('courierMap', { zoomControl: true, scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(navigationState.map);
    navigationState.map.setView([46.07, 18.93], 12);
  }

  navigationState.markers.forEach((marker) => marker.remove());
  navigationState.markers = [];

  if (navigationState.routeLine) {
    navigationState.routeLine.remove();
  }

  const routeCoordinates = navigationState.route.map((stop) => [stop.coords.lat, stop.coords.lon]).filter(Boolean);
  if (routeCoordinates.length) {
    navigationState.routeLine = L.polyline(routeCoordinates, { color: '#1e5c54', weight: 5, opacity: 0.8 }).addTo(navigationState.map);
  }

  navigationState.route.forEach((stop, index) => {
    if (!stop.coords) return;
    const marker = L.marker([stop.coords.lat, stop.coords.lon]).addTo(navigationState.map);
    marker.bindPopup(`${index + 1}. ${stop.customer_name || 'Csomag'}`);
    navigationState.markers.push(marker);
  });

  if (navigationState.currentPosition) {
    if (navigationState.currentPositionMarker) {
      navigationState.currentPositionMarker.remove();
    }
    navigationState.currentPositionMarker = L.circleMarker(
      [navigationState.currentPosition.lat, navigationState.currentPosition.lon],
      { radius: 8, color: '#d88b2a', fillColor: '#f5c56b', fillOpacity: 0.9 }
    ).addTo(navigationState.map);
    navigationState.currentPositionMarker.bindPopup('Aktuális pozíció');
  }

  const basePoints = navigationState.route.length ? navigationState.route.map((stop) => stop.coords).filter(Boolean) : [];
  if (basePoints.length) {
    const bounds = L.latLngBounds(basePoints);
    if (navigationState.currentPosition) {
      bounds.extend([navigationState.currentPosition.lat, navigationState.currentPosition.lon]);
    }
    navigationState.map.fitBounds(bounds.pad(0.2));
  }
}

async function rebuildRoute() {
  const routeResult = await buildNavigationRoute();
  navigationState.route = routeResult.route;
  navigationState.routeReady = routeResult.route.length > 0;

  if (!navigationState.routeReady) {
    setText('routeTitle', 'Nincs aktív útvonal');
    setText('courierStatusChip', 'Útvonal üres');
    updateSummary([], 0);
    updateNextStopVisual();
    drawMap();
    return;
  }

  setText('routeTitle', 'Mai útvonal');
  setText('courierStatusChip', 'Útvonal aktív');
  updateSummary(routeResult.route, 0);
  navigationState.currentStopIndex = 0;
  updateNextStopVisual();
  drawMap();
}

function startGpsTracking() {
  if (!navigator.geolocation) {
    setText('courierStatusChip', 'GPS nem elérhető');
    return;
  }

  if (navigationState.watchId !== null) {
    navigator.geolocation.clearWatch(navigationState.watchId);
  }

  const positionRequest = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        navigationState.currentPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };

        const input = document.getElementById('routeStartPoint');
        if (input && (!input.value || !input.value.trim())) {
          input.value = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
        }

        if (navigationState.route.length) {
          const currentStop = navigationState.route[navigationState.currentStopIndex];
          if (currentStop?.coords) {
            const distanceKm = haversineKm(
              navigationState.currentPosition.lat,
              navigationState.currentPosition.lon,
              currentStop.coords.lat,
              currentStop.coords.lon
            );

            if (distanceKm < 0.05) {
              markCurrentStopDelivered();
            }
          }
        }

        updateNextStopVisual();
        drawMap();
      },
      (error) => {
        console.warn('GPS hiba:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      }
    );
  };

  positionRequest();

  navigationState.watchId = navigator.geolocation.watchPosition(
    (position) => {
      navigationState.currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };

      const input = document.getElementById('routeStartPoint');
      input.value = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;

      if (navigationState.route.length) {
        const currentStop = navigationState.route[navigationState.currentStopIndex];
        if (currentStop?.coords) {
          const distanceKm = haversineKm(
            navigationState.currentPosition.lat,
            navigationState.currentPosition.lon,
            currentStop.coords.lat,
            currentStop.coords.lon
          );

          if (distanceKm < 0.05) {
            markCurrentStopDelivered();
          }
        }
      }

      updateNextStopVisual();
      drawMap();
    },
    (error) => {
      console.warn('GPS hiba:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
}

async function markCurrentStopDelivered() {
  const currentStop = navigationState.route[navigationState.currentStopIndex];
  if (!currentStop) return;

  const { error } = await supabase
    .from('shipments')
    .update({ status: 'delivered', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', currentStop.id);

  if (!error) {
    speakHungarian('Megérkeztél.');
    navigationState.route.splice(navigationState.currentStopIndex, 1);
    navigationState.currentStopIndex = 0;
    drawMap();
    rebuildRoute();
    return;
  }

  console.error('Kézbesítés frissítése sikertelen:', error);
}

async function markCurrentStopFailed() {
  const currentStop = navigationState.route[navigationState.currentStopIndex];
  if (!currentStop) return;

  const reason = document.getElementById('deliveryFailureReason')?.value || 'Egyéb';

  try {
    const payload = {
      status: 'out_for_delivery',
      updated_at: new Date().toISOString(),
      delivery_failed_reason: reason,
      delivery_failed_at: new Date().toISOString()
    };

    await supabase.from('shipments').update(payload).eq('id', currentStop.id);
    speakHungarian('Nem sikerült a kézbesítés.');
    navigationState.route.splice(navigationState.currentStopIndex, 1);
    rebuildRoute();
  } catch (error) {
    console.error('Kézbesítés hiba mentése sikertelen:', error);
  }
}

function bindNavigationControls() {
  const startButton = document.getElementById('routeStartButton');
  const deliveryButton = document.getElementById('markDeliveredButton');
  const failedButton = document.getElementById('markFailedButton');

  startButton?.addEventListener('click', async () => {
    await claimPendingShipments();
    await rebuildRoute();
    startGpsTracking();
    speakHungarian('Útvonal indítása. Következő megálló a célba.');
  });

  deliveryButton?.addEventListener('click', () => {
    markCurrentStopDelivered();
  });

  failedButton?.addEventListener('click', () => {
    markCurrentStopFailed();
  });
}

export function setupCourierPage() {
  bindNavigationControls();
  setText('courierGreeting', getGreetingText());
  rebuildRoute();
}

if (document.readyState !== 'loading') {
  setupCourierPage();
}
