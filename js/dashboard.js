import { supabase, isSupabaseConfigured } from './supabase.js';
import { STATUS_LABELS, formatDate } from './utils.js';

function getUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('mosly-user') || '{}');
  } catch (error) {
    return {};
  }
}

export async function loadDashboardStats() {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase.from('shipments').select('status, created_at');
  if (error || !data) return;

  const total = data.length;
  const delivered = data.filter((shipment) => shipment.status === 'delivered').length;
  const outForDelivery = data.filter((shipment) => shipment.status === 'out_for_delivery' || shipment.status === 'courier_on_way').length;
  const thisMonth = data.filter((shipment) => new Date(shipment.created_at).getMonth() === new Date().getMonth()).length;

  document.getElementById('statsTotal').textContent = String(total);
  document.getElementById('statsDelivered').textContent = String(delivered);
  document.getElementById('statsOutForDelivery').textContent = String(outForDelivery);
  document.getElementById('statsMonth').textContent = String(thisMonth);
}

export async function loadRecentShipments() {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase.from('shipments').select('tracking_number, customer_name, city, status, created_at').order('created_at', { ascending: false }).limit(5);
  if (error || !data) return;

  const table = document.getElementById('dashboardRecentTable');
  if (!table) return;

  table.innerHTML = data.map((shipment) => `
    <tr>
      <td>${shipment.tracking_number}</td>
      <td>${shipment.customer_name}</td>
      <td>${shipment.city}</td>
      <td><span class="status-badge status-${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span></td>
      <td>${formatDate(shipment.created_at)}</td>
    </tr>
  `).join('');
}

export function setupDashboardPage() {
  const user = getUserFromStorage();
  const avatar = document.getElementById('userAvatar');
  const name = document.getElementById('userName');

  if (avatar && user.full_name) {
    avatar.textContent = user.full_name.charAt(0).toUpperCase();
  }

  if (name) {
    name.textContent = user.full_name || 'Admin';
  }

  loadDashboardStats();
  loadRecentShipments();

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      localStorage.removeItem('mosly-user');
      window.location.href = 'bejelentkezes.html';
    });
  }
}

if (document.readyState !== 'loading') {
  setupDashboardPage();
}
