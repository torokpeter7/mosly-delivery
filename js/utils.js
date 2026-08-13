export const STATUS_LABELS = {
  order_received: 'Rendelés felvéve',
  out_for_delivery: 'Kiszállítás alatt',
  courier_on_way: 'Úton hozzád',
  delivered: 'Kiszállítva'
};

export const STATUS_ORDER = ['order_received', 'out_for_delivery', 'courier_on_way', 'delivered'];

export function formatDate(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function showAlert(element, message, type = 'success') {
  if (!element) return;
  element.className = `alert show ${type}`;
  element.textContent = message;
}

export function setButtonLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = isLoading ? label : (button.dataset.originalText || label);
}

export function generateTrackingNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'MSL-';
  for (let i = 0; i < 6; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return {};
  }
}
