/**
 * @file admin/admin.js
 * @description Orquestador principal del panel de administración (Vanilla JS ES6).
 */

import { EVT } from './events.js';
import { initAuth, signInWithPassword, signInWithOtp, signOut, getCurrentUser, getAdminProfile } from './auth.js';
import { initOrdersModule, loadOrders, setOrdersFilter } from './orders.js';
import { initProductsModule, loadProducts, openProductModal, saveProduct } from './products.js';
import { renderDashboard } from './dashboard.js';

let _activeView = 'dashboard';

document.addEventListener('DOMContentLoaded', async () => {
  setupUIEventListeners();
  initOrdersModule();
  initProductsModule();

  // Escuchar cambios de estado de autenticación
  document.addEventListener(EVT.AUTH_STATE_CHANGED, (e) => {
    handleAuthStateChanged(e.detail);
  });

  // Escuchar notificaciones Toast
  document.addEventListener(EVT.TOAST, (e) => {
    showToast(e.detail.msg, e.detail.type || 'info');
  });

  // Inicializar observador de autenticación
  await initAuth();
});

/**
 * Configuración de eventos de UI y navegación de pestañas
 */
function setupUIEventListeners() {
  // Login Form
  document.getElementById('form-admin-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-login-email')?.value.trim();
    const pass = document.getElementById('input-login-password')?.value;
    const btn = document.getElementById('btn-submit-login');
    const errEl = document.getElementById('login-error-msg');

    if (errEl) errEl.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando credenciales...';
    }

    try {
      await signInWithPassword(email, pass);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Credenciales incorrectas.';
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Ingresar al Panel';
      }
    }
  });

  // Magic Link Option
  document.getElementById('btn-login-magic')?.addEventListener('click', async () => {
    const email = document.getElementById('input-login-email')?.value.trim();
    if (!email) {
      alert('Ingresa tu correo electrónico para enviarte el enlace de acceso.');
      return;
    }
    try {
      await signInWithOtp(email);
      alert(`✓ Enlace de acceso enviado a ${email}. Revisa tu bandeja de entrada.`);
    } catch (err) {
      alert(`Error al enviar enlace: ${err.message}`);
    }
  });

  // Logout
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    signOut();
  });

  // Navegación de Vistas
  document.querySelectorAll('[data-view-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.viewTarget);
    });
  });

  // Filtros de Órdenes
  document.getElementById('input-filter-search')?.addEventListener('input', debounce((e) => {
    setOrdersFilter({ search: e.target.value });
  }, 400));

  document.getElementById('select-filter-status')?.addEventListener('change', (e) => {
    setOrdersFilter({ status: e.target.value });
  });

  document.getElementById('input-filter-date-from')?.addEventListener('change', (e) => {
    setOrdersFilter({ dateFrom: e.target.value });
  });

  document.getElementById('input-filter-date-to')?.addEventListener('change', (e) => {
    setOrdersFilter({ dateTo: e.target.value });
  });

  document.getElementById('btn-export-orders-csv')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent(EVT.ORDER_EXPORT_CSV));
  });

  // Modal de Detalle de Orden - Cerrar
  document.getElementById('btn-close-order-modal')?.addEventListener('click', () => {
    document.getElementById('order-detail-modal')?.classList.add('hidden');
  });

  // Modal de Producto - Acciones
  document.getElementById('btn-new-product')?.addEventListener('click', () => {
    openProductModal();
  });

  document.getElementById('btn-close-prod-modal')?.addEventListener('click', () => {
    document.getElementById('product-modal')?.classList.add('hidden');
  });

  document.getElementById('form-product')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const productData = {
      id_producto: document.getElementById('input-prod-id').value,
      nombre_bien: document.getElementById('input-prod-nombre').value,
      descripcion: document.getElementById('input-prod-desc').value,
      partida_fortamun: document.getElementById('input-prod-partida').value,
      unidad_medida: document.getElementById('input-prod-unidad').value,
      precio_unitario: document.getElementById('input-prod-precio').value,
      tallas_disponibles: document.getElementById('input-prod-tallas').value,
      imagen_url: document.getElementById('input-prod-imagen').value,
      active: document.getElementById('input-prod-active').checked
    };
    saveProduct(productData);
  });
}

/**
 * Manejo reactivo de cambios de sesión
 */
function handleAuthStateChanged(state) {
  const loginSection = document.getElementById('admin-login-section');
  const mainAppSection = document.getElementById('admin-app-section');
  const unauthorizedNotice = document.getElementById('admin-unauthorized-notice');
  const userDisplay = document.getElementById('admin-user-email');

  if (!state.isAuthenticated) {
    loginSection?.classList.remove('hidden');
    mainAppSection?.classList.add('hidden');
    unauthorizedNotice?.classList.add('hidden');
    return;
  }

  if (state.isAuthenticated && !state.isAdmin) {
    loginSection?.classList.add('hidden');
    mainAppSection?.classList.add('hidden');
    unauthorizedNotice?.classList.remove('hidden');
    return;
  }

  // Usuario autenticado y con rol de Administrador
  loginSection?.classList.add('hidden');
  unauthorizedNotice?.classList.add('hidden');
  mainAppSection?.classList.remove('hidden');

  if (userDisplay && state.user) {
    userDisplay.textContent = `${state.user.email} (${state.profile?.role || 'admin'})`;
  }

  // Cargar vista inicial
  switchView(_activeView);
}

/**
 * Cambio de vista entre Dashboard, Pedidos y Catálogo
 */
export function switchView(viewName) {
  _activeView = viewName;

  // Actualizar estilos de pestañas de navegación
  document.querySelectorAll('[data-view-target]').forEach(btn => {
    if (btn.dataset.viewTarget === viewName) {
      btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-[#FFD700] text-slate-950 transition-colors';
    } else {
      btn.className = 'px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors';
    }
  });

  // Ocultar todas las vistas
  document.querySelectorAll('.admin-view-panel').forEach(panel => panel.classList.add('hidden'));

  // Mostrar la vista activa y disparar su carga
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.remove('hidden');

  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'orders') {
    loadOrders();
  } else if (viewName === 'products') {
    loadProducts();
  }
}

/**
 * Toast de notificaciones
 */
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    'success': 'bg-emerald-600 border-emerald-400',
    'error': 'bg-rose-600 border-rose-400',
    'info': 'bg-slate-800 border-[#FFD700]'
  };

  toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-xs font-bold text-white shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.textContent = msg;

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
