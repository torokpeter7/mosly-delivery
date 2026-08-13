import { supabase, isSupabaseConfigured } from './supabase.js';

function getShipmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

export async function loadShipmentDetails() {
  if (!isSupabaseConfigured()) return;

  const shipmentId = getShipmentIdFromUrl();
  if (!shipmentId) {
    const label = document.getElementById('selectedShipment');
    if (label) label.textContent = 'Hiányzó rendelés azonosító.';
    return;
  }

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .maybeSingle();

  if (error || !data) {
    const label = document.getElementById('selectedShipment');
    if (label) label.textContent = 'A rendelés nem található.';
    return;
  }

  const fields = {
    detailTrackingNumber: data.tracking_number,
    detailStatus: data.status,
    detailCustomerName: data.customer_name,
    detailCustomerPhone: data.customer_phone,
    detailCustomerEmail: data.customer_email,
    detailCity: data.city,
    detailStreet: data.street,
    detailHouseNumber: data.house_number,
    detailPostalCode: data.postal_code,
    detailNotes: data.notes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
    }
  });

  const label = document.getElementById('selectedShipment');
  if (label) {
    label.textContent = `Rendelés: ${data.tracking_number}`;
  }
}

export function setupShipmentDetails() {
  loadShipmentDetails();
}

if (document.readyState !== 'loading') {
  setupShipmentDetails();
}
