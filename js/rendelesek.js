import { supabase, isSupabaseConfigured } from './supabase.js';
import { STATUS_LABELS, formatDate } from './utils.js';

export async function loadOrders() {
  if (!isSupabaseConfigured()) return;

  const search = document.getElementById('filterSearch')?.value.trim() || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const city = document.getElementById('filterCity')?.value.trim() || '';
  const date = document.getElementById('filterDate')?.value || '';

  let query = supabase.from('shipments').select('*');

  if (search) {
    query = query.ilike('tracking_number', `%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (city) {
    query = query.ilike('city', `%${city}%`);
  }

  if (date) {
    query = query.gte('created_at', new Date(date).toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return;

  const table = document.getElementById('shipmentsTable');
  if (!table) return;

  table.innerHTML = (data || []).map((shipment) => `
    <tr>
      <td><a href="rendeles.html?id=${shipment.id}" class="text-link">${shipment.tracking_number}</a></td>
      <td>${shipment.customer_name}</td>
      <td>${shipment.city}</td>
      <td>${shipment.customer_phone}</td>
      <td><span class="status-badge status-${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span></td>
      <td>${formatDate(shipment.created_at)}</td>
    </tr>
  `).join('');
}

export function setupOrdersPage() {
  const form = document.getElementById('shipmentFilters');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadOrders();
    });
  }

  loadOrders();
}

if (document.readyState !== 'loading') {
  setupOrdersPage();
}
