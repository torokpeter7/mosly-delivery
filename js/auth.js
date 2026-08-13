import { isSupabaseConfigured, supabase } from './supabase.js';
import { showAlert, parseJwtPayload } from './utils.js';

function redirectByRole(role) {
  if (role === 'courier') {
    window.location.href = 'futar.html';
    return;
  }

  if (role === 'mosly_employee' || role === 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  // Ha a profil szerepköre nincs megadva, a belső felületet nyitjuk meg, nehogy a kezdőoldalra dobja a felhasználót.
  window.location.href = 'dashboard.html';
}

async function repairCourierAssignmentMismatch(email, authUserId) {
  if (!email || !authUserId || !isSupabaseConfigured()) return;

  const { data: profileByEmail, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (profileLookupError) {
    console.warn('Profil keresés hiba:', profileLookupError);
    return;
  }

  if (!profileByEmail || profileByEmail.id === authUserId) return;

  const { error: updateError } = await supabase
    .from('shipments')
    .update({ courier_id: authUserId, updated_at: new Date().toISOString() })
    .eq('courier_id', profileByEmail.id);

  if (updateError) {
    console.warn('Futár-hozzárendelés javítása sikertelen:', updateError);
  }
}

export function setupLoginForm() {
  const form = document.getElementById('loginForm');
  const progress = document.getElementById('loginProgress');
  const message = document.getElementById('loginMessage');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = form.querySelector('#email')?.value.trim();
    const password = form.querySelector('#password')?.value;

    if (!email || !password) {
      showAlert(message, 'Kérjük, add meg az e-mail címet és a jelszót.', 'error');
      return;
    }

    if (!isSupabaseConfigured()) {
      showAlert(message, 'A Supabase konfiguráció még nincs beállítva. Ellenőrizd a js/supabase.js fájlt.', 'error');
      return;
    }

    progress?.classList.add('visible');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showAlert(message, error.message || 'Sikertelen bejelentkezés.', 'error');
        progress?.classList.remove('visible');
        return;
      }

      const user = data?.user;
      const userId = user?.id;
      let profile = userId
        ? await supabase.from('profiles').select('role, full_name, is_active, email').eq('id', userId).maybeSingle()
        : { data: null, error: null };

      if (!profile?.data && user?.email) {
        profile = await supabase.from('profiles').select('role, full_name, is_active, email, id').eq('email', user.email).maybeSingle();
      }

      if (userId && user?.email) {
        await repairCourierAssignmentMismatch(user.email, userId);
      }

      const role = profile?.data?.role || 'mosly_employee';
      const safeUser = {
        id: userId,
        email: user?.email || email,
        full_name: profile?.data?.full_name || user?.email || 'Mosly felhasználó',
        role,
        is_active: profile?.data?.is_active ?? true
      };

      localStorage.setItem('mosly-user', JSON.stringify(safeUser));
      redirectByRole(role);
    } catch (error) {
      showAlert(message, 'Váratlan hiba történt a bejelentkezés során.', 'error');
      progress?.classList.remove('visible');
    }
  });
}

export function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('mosly-user') || '{}');
    return user && user.email ? user : null;
  } catch (error) {
    return null;
  }
}

export function ensureAuthenticated(requiredRole = null) {
  const user = getStoredUser();

  if (!user) {
    window.location.href = 'bejelentkezes.html';
    return false;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const isAllowed = allowedRoles.includes(user.role);

    if (!isAllowed) {
      if (user.role === 'courier') {
        window.location.href = 'futar.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return false;
    }
  }

  return true;
}

export function setupProfilePage() {
  const fullName = document.getElementById('profileFullName');
  const email = document.getElementById('profileEmail');
  const role = document.getElementById('profileRole');
  const status = document.getElementById('profileStatus');

  if (!fullName || !email || !role || !status) return;

  const user = getStoredUser() || {};
  fullName.value = user.full_name || 'Nincs megadva';
  email.value = user.email || '—';
  role.value = user.role || '—';
  status.value = user.is_active ? 'Aktív' : 'Inaktív';
}

export function setupLogoutButton() {
  const button = document.getElementById('logoutButton');
  if (!button) return;

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      localStorage.removeItem('mosly-user');
      window.location.href = 'bejelentkezes.html';
      return;
    }

    await supabase.auth.signOut();
    localStorage.removeItem('mosly-user');
    window.location.href = 'bejelentkezes.html';
  });
}

if (document.readyState !== 'loading') {
  setupLoginForm();
  setupLogoutButton();
  setupProfilePage();
}
