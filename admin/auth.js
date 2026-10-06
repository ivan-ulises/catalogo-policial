/**
 * @file admin/auth.js
 * @description Gestión de sesión, autenticación y verificación de rol con Supabase Auth.
 */

import { EVT } from './events.js';

const SUPABASE_URL = 'https://gqjwdoaielmywbqyirso.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxandkb2FpZWxteXdicXlpcnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTc4MDEsImV4cCI6MjEwNjc5MzgwMX0.N7xJzFvWcM1sSqDIgdiFti0WMUFyT09zZMlAndhok3E';

let _client = null;
let _currentUser = null;
let _currentSession = null;
let _adminProfile = null;

export function getSupabase() {
  if (!_client) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase JS SDK no está disponible en window.supabase');
    }
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

export function getCurrentSession() {
  return _currentSession;
}

export function getCurrentUser() {
  return _currentUser;
}

export function getAdminProfile() {
  return _adminProfile;
}

/**
 * Inicializa el observador de estado de autenticación.
 */
export async function initAuth() {
  const sb = getSupabase();

  // Escuchar cambios de sesión
  sb.auth.onAuthStateChange(async (event, session) => {
    _currentSession = session;
    _currentUser = session?.user || null;

    if (_currentUser) {
      // Verificar si es administrador
      await _verifyAdminRole(_currentUser.id);
    } else {
      _adminProfile = null;
      document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
        detail: { isAuthenticated: false, user: null, isAdmin: false }
      }));
    }
  });

  // Obtener sesión inicial activa
  const { data: { session } } = await sb.auth.getSession();
  _currentSession = session;
  _currentUser = session?.user || null;

  if (_currentUser) {
    await _verifyAdminRole(_currentUser.id);
  } else {
    document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
      detail: { isAuthenticated: false, user: null, isAdmin: false }
    }));
  }
}

/**
 * Verifica si el usuario actual reside en public.admin_users
 */
async function _verifyAdminRole(userId) {
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('admin_users')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.warn('[Auth] Usuario autenticado pero sin rol en admin_users:', error);
      _adminProfile = null;
      document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
        detail: { isAuthenticated: true, user: _currentUser, isAdmin: false, error: 'No tienes permisos de administrador.' }
      }));
      return false;
    }

    _adminProfile = data;
    document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
      detail: { isAuthenticated: true, user: _currentUser, isAdmin: true, profile: _adminProfile }
    }));
    return true;
  } catch (err) {
    console.error('[Auth Error]', err);
    _adminProfile = null;
    document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
      detail: { isAuthenticated: true, user: _currentUser, isAdmin: false, error: err.message }
    }));
    return false;
  }
}

/**
 * Iniciar sesión con email y contraseña
 */
export async function signInWithPassword(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Iniciar sesión vía Magic Link
 */
export async function signInWithOtp(email) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/admin.html'
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Cerrar sesión
 */
export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
  _currentUser = null;
  _currentSession = null;
  _adminProfile = null;
  document.dispatchEvent(new CustomEvent(EVT.AUTH_STATE_CHANGED, {
    detail: { isAuthenticated: false, user: null, isAdmin: false }
  }));
}
