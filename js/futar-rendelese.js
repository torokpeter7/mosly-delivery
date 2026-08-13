import { supabase, isSupabaseConfigured } from './supabase.js';
import { STATUS_LABELS } from './utils.js';

function setMessage(message, type = 'success') {
  const el = document.getElementById('assignmentMessage');
  if (!el) return;
  el.className = `alert show ${type}`;
  el.textContent = message;
}

async function loadCouriers() {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'courier').order('full_name', { ascending: true });

  if (error || !data) return [];

  const select = document.getElementById('courierSelect');
  if (!select) return data;

  select.innerHTML = '<option value="">Válassz futárt</option>' + data.map((courier) => `
    <option value="${courier.id}">${courier.full_name || courier.email}</option>
  `).join('');

  return data;
}

async function loadShipments() {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const select = document.getElementById('shipmentSelect');
  if (!select) return data;

  const unassigned = data.filter((shipment) => !shipment.courier_id || shipment.status !== 'delivered');
  select.innerHTML = '<option value="">Válassz csomagot</option>' + unassigned.map((shipment) => `
    <option value="${shipment.id}">${shipment.tracking_number} - ${shipment.customer_name}</option>
  `).join('');

  return unassigned;
}

async function loadAssignmentTable() {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase
    .from('shipments')
    .select('*, profiles!shipments_courier_id_fkey(full_name, email)')
    .order('created_at', { ascending: false });

  if (error || !data) return;

  const table = document.getElementById('assignmentTable');
  if (!table) return;

  table.innerHTML = data.map((shipment) => `
    <tr>
      <td>${shipment.tracking_number}</td>
      <td>${shipment.customer_name}</td>
      <td>${shipment.city}</td>
      <td>${shipment.profiles?.full_name || shipment.profiles?.email || 'Nincs hozzárendelve'}</td>
      <td><span class="status-badge status-${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span></td>
    </tr>
  `).join('');
}

async function assignCourierToShipment() {
  if (!isSupabaseConfigured()) return;

  const courierId = document.getElementById('courierSelect')?.value;
  const shipmentId = document.getElementById('shipmentSelect')?.value;
  const nextStatus = document.getElementById('assignmentStatus')?.value || 'out_for_delivery';

  if (!courierId || !shipmentId) {
    setMessage('Kérjük, válassz ki futárt és csomagot.', 'error');
    return;
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      courier_id: courierId,
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', shipmentId);

  if (error) {
    setMessage(error.message || 'A futárhoz rendelés sikertelen volt.', 'error');
    return;
  }

  setMessage('A csomag sikeresen futárhoz lett rendelve.', 'success');
  await loadShipments();
  await loadAssignmentTable();
}

async function assignAllOrderReceivedToCourier() {
  if (!isSupabaseConfigured()) return;

  const courierId = document.getElementById('courierSelect')?.value;
  const nextStatus = document.getElementById('assignmentStatus')?.value || 'out_for_delivery';

  if (!courierId) {
    setMessage('Kérjük, válassz ki egy futárt a tömeges hozzárendeléshez.', 'error');
    return;
  }

  const { data, error } = await supabase
    .from('shipments')
    .update({
      courier_id: courierId,
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq('status', 'order_received')
    .select('id');

  if (error) {
    setMessage(error.message || 'A tömeges futárhoz rendelés sikertelen volt.', 'error');
    return;
  }

  const updatedCount = data?.length || 0;
  setMessage(updatedCount > 0 ? `${updatedCount} db „Rendelés felvéve” státuszú csomag sikeresen futárhoz lett rendelve.` : 'Nincs „Rendelés felvéve” státuszú csomag a hozzárendeléshez.', updatedCount > 0 ? 'success' : 'info');
  await loadShipments();
  await loadAssignmentTable();
}

export function setupCourierAssignmentPage() {
  const button = document.getElementById('assignCourierButton');
  if (button) {
    button.addEventListener('click', assignCourierToShipment);
  }

  const bulkButton = document.getElementById('assignAllReceivedButton');
  if (bulkButton) {
    bulkButton.addEventListener('click', assignAllOrderReceivedToCourier);
  }

  loadCouriers();
  loadShipments();
  loadAssignmentTable();
}

if (document.readyState !== 'loading') {
  setupCourierAssignmentPage();
}
