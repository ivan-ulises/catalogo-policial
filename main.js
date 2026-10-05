/**
 * @file main.js
 * @description Orquestador principal de la aplicación.
 *
 * RESPONSABILIDAD: Punto de entrada del módulo ES6. Importa todos los
 * submódulos, los inicializa en el orden correcto y gestiona los
 * eventos globales de comunicación entre módulos.
 *
 * PATRÓN: Event-Driven Architecture (EDA) con CustomEvents.
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │                      main.js                            │
 *  │   (orquesta, no contiene lógica de negocio propia)      │
 *  └────────┬────────────────────┬────────────────────────────┘
 *           │                    │
 *    ┌──────▼──────┐     ┌───────▼────────┐
 *    │ api/        │     │ components/    │
 *    │ googleSheets│     │ catalog.js     │
 *    └──────┬──────┘     │ cart.js        │
 *           │             └───────┬────────┘
 *    datos  │                     │ eventos
 *           │             ┌───────▼────────┐
 *           └────────────►│ utils/         │
 *                          │ orders.js      │
 *                          │ whatsapp.js    │
 *                          │ format.js      │
 *                          └────────────────┘
 *
 * FLUJO DE DATOS:
 *   1. main.js llama a fetchProductsFromSheet() o getDemoProducts()
 *   2. Pasa los datos a initCatalog(products)
 *   3. catalog.js renderiza las tarjetas y dispara 'product:add'
 *   4. cart.js escucha 'product:add', actualiza estado y re-renderiza
 *   5. cart.js dispara 'cart:checkout' → orders.js muestra el modal
 *   6. cart.js/orders.js disparan 'cart:whatsapp' → whatsapp.js abre WA
 *
 * ADMIN: La única línea que debes cambiar normalmente es SHEET_CSV_URL.
 */

// ─── Importaciones de módulos ──────────────────────────────────

import { fetchProducts } from './api/supabaseClient.js';
import { initCatalog, renderError } from './components/catalog.js';
import { initCart, getCartItems, getCartTotal } from './components/cart.js';
import { initOrders } from './utils/orders.js';
import { initWhatsApp, sendOrderViaWhatsApp } from './utils/whatsapp.js';

// ─── Configuración ─────────────────────────────────────────────

/**
 * URL del CSV público de tu Google Sheet.
 *
 * ADMIN: Pasos para obtener esta URL:
 *   1. Abre tu Google Sheet con las columnas:
 *      ID | Producto | Descripcion | Categoria | Tallas | Precio | ImagenURL
 *   2. Menú → Archivo → Publicar en la web
 *   3. Selecciona la hoja → formato CSV → Publicar
 *   4. Copia la URL generada y pégala aquí.
 *
 * Si dejas esta constante como cadena vacía (''), la app cargará
 * automáticamente el catálogo de demostración (getDemoProducts).
 *
 * @type {string}
 */

// ─── Inicialización ────────────────────────────────────────────

/**
 * Punto de entrada principal. Se ejecuta cuando el DOM está listo.
 *
 * Orden de inicialización:
 *  1. Cart   (registra listeners antes de que catalog los dispare)
 *  2. Orders (registra listener de 'cart:checkout')
 *  3. WhatsApp (registra listeners de WA)
 *  4. Catálogo (fetch de datos → render)
 */
async function bootstrap() {
  // 1. Inicializar componentes que escuchan eventos
  initCart();
  initOrders();
  initWhatsApp();

  // 2. Cargar y renderizar el catálogo
  await loadCatalog();

  // 3. Registrar eventos globales de coordinación
  _registerGlobalEvents();
}

/**
 * Carga los productos desde Google Sheets (o demo si no hay URL)
 * y los entrega al renderizador del catálogo.
 *
 * @async
 * @private
 */
async function loadCatalog() {
  try {
    console.info('[main] Cargando catálogo desde Supabase…');
    let products = await fetchProducts();
    console.info(`[main] ${products.length} productos cargados.`);

    initCatalog(products);

  } catch (error) {
    // El fetch falló → mostrar mensaje amigable al usuario
    console.error('[main] Error al cargar catálogo:', error);

    renderError(error.message || 'Error desconocido al conectar con el catálogo.');
  }
}

// ─── Eventos globales ──────────────────────────────────────────

/**
 * Registra los eventos de coordinación entre módulos.
 * Todos los CustomEvents de la app pasan por aquí como "bus central".
 * @private
 */
function _registerGlobalEvents() {

  // ── Toast de notificaciones ──────────────────────────────────
  // Cualquier módulo puede disparar 'ui:toast' con { msg: string }
  document.addEventListener('ui:toast', (e) => {
    _showToast(e.detail?.msg ?? '');
  });

  // ── Carga del catálogo de demo (desde el botón de error) ─────
  

  // ── Botón flotante de WA cuando hay ítems en el carrito ──────
  // whatsapp.js dispara 'wa:floatClick'; main.js provee los datos
  document.addEventListener('wa:floatClick', () => {
    const items = getCartItems();
    const total = getCartTotal();
    if (items.length > 0) {
      sendOrderViaWhatsApp(items, total);
    }
  });

  // ── Log de actualización del carrito (útil para depuración) ──
  document.addEventListener('cart:updated', (e) => {
    const { count, total } = e.detail;
    console.debug(`[cart] ${count} ítem(s) | Total: $${total.toFixed(2)} MXN`);
  });
}

// ─── Toast ─────────────────────────────────────────────────────

/** @type {number|null} ID del timeout del toast activo */
let _toastTimer = null;

/**
 * Muestra el elemento de notificación (toast) brevemente.
 *
 * @param {string} msg - Mensaje a mostrar.
 * @private
 */
function _showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Limpiar timer anterior si hay un toast activo
  if (_toastTimer) clearTimeout(_toastTimer);

  toast.textContent = msg;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');

  _toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
    _toastTimer = null;
  }, 2200);
}

// ─── Arranque ──────────────────────────────────────────────────

// Esperar a que el DOM esté completamente listo antes de inicializar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // El documento ya estaba listo (caso poco común con type="module")
  bootstrap();
}
