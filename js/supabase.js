import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://ncqpmndiahspjoyjovzi.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXBtbmRpYWhzcGpveWpvdnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTg0NjgsImV4cCI6MjEwMjE5NDQ2OH0._Jxp1RVF4vGJvxES9czeKmEESwEJroh9bj8RqudkJww';

const hasPlaceholderUrl = !SUPABASE_URL || SUPABASE_URL.includes('your-project') || SUPABASE_URL.includes('example.supabase.co');
const hasPlaceholderKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('your-anon-key') || SUPABASE_ANON_KEY.length < 20;

const isConfigured =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.startsWith('https://') &&
  !hasPlaceholderUrl &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 20 &&
  !hasPlaceholderKey;

const fallbackSupabase = {
  auth: {
    signInWithPassword: async () => {
      throw new Error('Supabase konfiguráció nincs beállítva. A SUPABASE_URL és SUPABASE_ANON_KEY mezőket kell beírni.');
    },
    getSession: async () => ({ data: { session: null } }),
    signOut: async () => ({ error: new Error('Supabase konfiguráció nincs beállítva.') }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => null,
        order: () => ({ data: [], error: null }),
        data: [],
        error: null
      }),
      order: () => ({ data: [], error: null })
    }),
    insert: () => ({ select: () => ({ data: [], error: null }) }),
    update: () => ({ eq: () => ({ data: [], error: null }) }),
    delete: () => ({ eq: () => ({ data: [], error: null }) })
  }),
  rpc: async () => ({ data: [], error: null })
};

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : fallbackSupabase;

export function isSupabaseConfigured() {
  return isConfigured;
}
