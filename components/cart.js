/**
 * @file components/cart.js
 * @description Componente de lista de pedido (carrito lateral).
 *
 * RESPONSABILIDAD: Gestionar el estado del carrito en memoria
 * (y en localStorage como respaldo), renderizar el panel lateral
 * y exponer la API para que otros módulos lean el estado.
 *
 * CONEXIONES:
 *   ← Escucha evento: 'product:add'     (disparado por catalog.js)
 *   → Dispara evento: 'cart:updated'    (escuchado por main.js)
 *   → Dispara evento: 'cart:checkout'   (escuchado por orders.js)
 *   → Dispara evento: 'ui:toast'        (escuchado por main.js)
 *   → Usa utilidad:   utils/format.js
 */

import { formatMXN } from '../utils/format.js';

// ─── Constantes ────────────────────────────────────────────────

/** Clave de localStorage para persistencia entre recargas. */
const STORAGE_KEY = 'ep_fortamun_cart';

/** Mensaje de política de entrega — ADMIN: edita aquí. */
const DELIVERY_POLICY =
  'Sistema de maquila y logística: Entrega en 21 días hábiles ' +
  'a partir de la confirmación del pedido y anticipo correspondiente.';

// ─── Estado interno ────────────────────────────────────────────

/**
 * @typedef {Object} CartItem
 * @property {string} productId  - ID del producto
 * @property {string} name       - Nombre del producto (sin variante)
 * @property {string} sku        - Código SKU
 * @property {string} size       - Talla seleccionada
 * @property {string} [variant]  - Variante seleccionada (ej: Algodón)
 * @property {string} [color]    - Color seleccionado (ej: Azul)
 * @property {string} [slotInfo] - Info de compartimientos de Fornitura
 * @property {number} qty        - Cantidad
 * @property {number} unitPrice  - Precio unitario específico de la variante
 */

/** @type {CartItem[]} */
let _items = _loadFromStorage();

/** Estado para la confirmación de vaciado */
let _clearConfirmActive = false;
let _clearConfirmTimeout = null;

// ─── Inicialización ────────────────────────────────────────────

/**
 * Inicializa el componente del carrito:
 * - Construye el HTML del panel lateral.
 * - Registra listeners de eventos globales.
 * - Renderiza el estado guardado.
 */
export function initCart() {
  _buildPanelShell();
  _bindEvents();
  _render();
}

/**
 * Devuelve una copia del estado actual del carrito.
 * Usado por orders.js y whatsapp.js para generar documentos.
 *
 * @returns {CartItem[]}
 */
export function getCartItems() {
  return [..._items];
}

/**
 * Devuelve el total general del carrito.
 * @returns {number}
 */
export function getCartTotal() {
  return _items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

// ─── Construcción del DOM ──────────────────────────────────────

/**
 * Construye la estructura base del panel lateral del carrito.
 * Solo se llama una vez en initCart().
 * @private
 */
function _buildPanelShell() {
  const panel = document.getElementById('cart-panel');
  if (!panel) return;

  panel.innerHTML = `
    <!-- Cabecera fija del panel -->
    <div class="bg-gradient-to-r from-navy to-navy-light px-5 py-4
                flex items-center justify-between sticky top-0 z-10 shadow-md">
      <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-gold" fill="none" stroke="currentColor"
             stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7
                   a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2
                   0 012-2h2a2 2 0 012 2"/>
        </svg>
        <h2 class="font-display text-xl font-bold text-white tracking-wide">
          LISTA DE PEDIDO
        </h2>
      </div>
      <button id="btn-close-cart"
              class="text-slate-soft hover:text-gold transition-colors p-1 rounded-lg"
              aria-label="Cerrar panel de pedido">
        <svg class="w-6 h-6" fill="none" stroke="currentColor"
             stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Banner de política de entrega -->
    <div class="mx-4 mt-4 bg-amber-50 border-l-4 border-gold rounded-r-xl p-3">
      <div class="flex gap-2 items-start">
        <svg class="w-5 h-5 text-gold-dark mt-0.5 flex-shrink-0"
             fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92
                   c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98
                   l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3
                   a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <p class="text-xs text-navy leading-snug">
          <span class="block font-display font-bold text-gold-dark tracking-wide
                       text-sm uppercase mb-0.5">
            Política de Entrega
          </span>
          ${DELIVERY_POLICY}
        </p>
      </div>
    </div>

    <!-- Zona dinámica: ítems o estado vacío -->
    <div id="cart-items-container" class="px-4 mt-4 space-y-3">
      <!-- Renderizado por _render() -->
    </div>

    <!-- Footer con totales y acciones -->
    <div id="cart-footer" class="hidden px-4 pb-8 mt-5 space-y-3">
      <!-- Total -->
      <div class="bg-navy rounded-xl p-4 flex justify-between items-center">
        <span class="font-display text-base text-slate-light tracking-wide">
          TOTAL (IVA INCLUIDO):
        </span>
        <span id="cart-total-display"
              class="font-display text-2xl font-bold text-gold">
          $0.00
        </span>
      </div>
      <p class="text-xs text-gray-400 text-center">
        *Precios en MXN. Sujetos a confirmación formal de pedido.
      </p>

      <!-- Generar Pedido -->
      <button id="btn-generate-sheets"
              class="bg-gold hover:bg-gold-hover text-navy font-display font-bold w-full
                     py-3 rounded-xl text-sm flex items-center justify-center gap-2
                     shadow-md transition-all hover:scale-[1.02] tracking-wide">
        <svg class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                   a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        GENERAR PEDIDO
      </button>

      <!-- Enviar por WhatsApp -->
      <button id="btn-cart-whatsapp"
              class="bg-[#25D366] hover:bg-[#1da851] text-white font-display font-bold
                     w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2
                     shadow-md transition-all hover:scale-[1.02] tracking-wide">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148
                   -.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075
                   -.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059
                   -.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174
                   .198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612
                   -.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01
                   -.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462
                   1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306
                   1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719
                   2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.122 1.528 5.854L.057
                   23.057a.75.75 0 00.921.921l5.204-1.471A11.95 11.95 0 0012 24c6.627
                   0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.71 9.71 0 01-4.964-1.36
                   l-.357-.212-3.688 1.043 1.044-3.688-.213-.357A9.712 9.712 0 012.25
                   12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75
                   12 21.75z"/>
        </svg>
        ENVIAR POR WHATSAPP
      </button>

      <!-- Vaciar lista -->
      <button id="btn-clear-cart"
              class="w-full py-2 rounded-xl text-sm text-gray-500 hover:text-red-600
                     hover:bg-red-50 transition-colors border border-gray-200">
        Vaciar lista de pedido
      </button>
    </div>
  `;

  // Los listeners del footer se manejan ahora por delegación en _bindEvents para mayor robustez
}

// ─── Listeners de eventos globales ────────────────────────────

/**
 * Registra todos los listeners de eventos del módulo.
 * @private
 */
function _bindEvents() {
  // Toggle del panel (botón del header)
  document.getElementById('btn-toggle-cart')
    ?.addEventListener('click', toggleCart);

  // Cierre al hacer clic en el overlay
  document.getElementById('cart-overlay')
    ?.addEventListener('click', closeCart);

  // Recibir producto desde catalog.js
  document.addEventListener('product:add', (e) => {
    const { product, size, qty, variant, customPrice, color, slotInfo } = e.detail;
    _addItem(product, size, qty, variant, customPrice, color, slotInfo);
  });

  // Delegación de eventos para el panel (Botones del footer y cerrar)
  const panel = document.getElementById('cart-panel');
  if (panel) {
    panel.addEventListener('click', _handlePanelClick);
  }
}

/**
 * Manejador centralizado de clics en el panel del carrito (Delegación).
 * @param {MouseEvent} e
 * @private
 */
function _handlePanelClick(e) {
  const target = e.target.closest('button');
  if (!target) return;

  const id = target.id;

  if (id === 'btn-close-cart') {
    closeCart();
  } else if (id === 'btn-generate-sheets') {
    if (!_items.length) return _toast('⚠ La lista está vacía');
    document.dispatchEvent(new CustomEvent('cart:checkout', {
      detail: { items: getCartItems(), total: getCartTotal() },
    }));
  } else if (id === 'btn-cart-whatsapp') {
    if (!_items.length) return _toast('⚠ La lista está vacía');
    document.dispatchEvent(new CustomEvent('cart:whatsapp', {
      detail: { items: getCartItems(), total: getCartTotal() },
    }));
  } else if (id === 'btn-clear-cart') {
    if (!_items.length) return;
    
    if (!_clearConfirmActive) {
      // Primer clic: activar modo confirmación
      _clearConfirmActive = true;
      target.textContent = '⚠️ ¿ESTÁS SEGURO? CLIC DE NUEVO';
      target.classList.add('btn-danger-confirm');
      _toast('Haz clic de nuevo para vaciar todo');

      // Resetear tras 3 segundos si no confirma
      if (_clearConfirmTimeout) clearTimeout(_clearConfirmTimeout);
      _clearConfirmTimeout = setTimeout(() => {
        _clearConfirmActive = false;
        target.textContent = 'Vaciar lista de pedido';
        target.classList.remove('btn-danger-confirm');
      }, 3500);
      
    } else {
      // Segundo clic: realizar acción
      _clearConfirmActive = false;
      if (_clearConfirmTimeout) clearTimeout(_clearConfirmTimeout);
      _items = [];
      _persist();
      _render();
      _toast('🗑 Lista vaciada por completo');
    }
  }
}

// ─── Lógica del carrito ────────────────────────────────────────

/**
 * Agrega o acumula un producto en el carrito.
 *
 * @param {import('../api/googleSheets.js').Product} product
 * @param {string} size - Talla seleccionada
 * @param {number} qty  - Cantidad a agregar
 * @param {string} [variant]    - Variante (opcional)
 * @param {number} [customPrice] - Precio de la variante
 * @param {string} [color]      - Color seleccionado (opcional)
 * @param {string} [slotInfo]   - Info de compartimientos (opcional)
 * @private
 */
function _addItem(product, size, qty, variant, customPrice, color, slotInfo) {
  const priceToUse = customPrice !== undefined ? customPrice : product.price;
  const colorKey   = color || '';

  const existing = _items.find(
    i => i.productId === product.id &&
         i.size === size &&
         i.variant === variant &&
         i.color === colorKey
  );

  if (existing) {
    existing.qty = Math.min(999, existing.qty + qty);
  } else {
    _items.push({
      productId: product.id,
      name:      product.name,
      sku:       product.sku,
      size,
      variant:   variant || '',
      color:     colorKey,
      slotInfo:  slotInfo || '',
      qty,
      unitPrice: priceToUse,
    });
  }

  _persist();
  _render();
  _toast(`✓ ${product.name} añadido`);
}

// ─── Renderizado del panel ─────────────────────────────────────

/**
 * Re-renderiza el contenido dinámico del panel.
 * @private
 */
function _render() {
  const container = document.getElementById('cart-items-container');
  const footer    = document.getElementById('cart-footer');
  const totalEl   = document.getElementById('cart-total-display');
  const badge     = document.getElementById('cart-badge');

  if (!container) return;

  const totalQty   = _items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = getCartTotal();

  // Actualizar badge del header
  if (totalQty > 0) {
    badge?.classList.remove('hidden');
    if (badge) badge.textContent = String(totalQty);
  } else {
    badge?.classList.add('hidden');
  }

  // Estado vacío
  if (_items.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 px-6 text-center">
        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor"
             stroke-width="1.2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                   M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <p class="font-display text-xl text-gray-400 tracking-wide">Lista vacía</p>
        <p class="text-xs text-gray-400 mt-2">
          Agrega productos del catálogo para generar tu pedido.
        </p>
      </div>
    `;
    footer?.classList.add('hidden');
    return;
  }

  // Ítems
  container.innerHTML = _items.map((item, idx) => `
    <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 flex gap-3 items-start">
      <!-- Mini placeholder -->
      <div class="img-placeholder w-12 h-12 rounded-lg flex-shrink-0 flex items-center
                  justify-center overflow-hidden">
        <span class="text-white/60 text-[10px] font-bold font-display text-center leading-tight">
          ${item.name.substring(0, 6)}
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <p class="font-semibold text-navy text-sm leading-tight truncate">
          ${_escCart(item.name)}
          ${item.variant ? `<span class="text-gold-dark font-display ml-1 italic">(${_escCart(item.variant)})</span>` : ''}
        </p>
        <p class="text-xs text-gray-400 font-mono">${_escCart(item.sku)}</p>

        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <!-- Badge de talla -->
          <span class="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded font-bold">
            ${_escCart(item.size)}
          </span>
          <!-- Badge de color (si aplica) -->
          ${item.color ? `
            <span class="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
              🎨 ${_escCart(item.color)}
            </span>
          ` : ''}
          <!-- Info de compartimientos (si aplica) -->
          ${item.slotInfo ? `
            <span class="text-xs text-amber-700 font-semibold">
              &#9679; ${_escCart(item.slotInfo)}
            </span>
          ` : ''}
          <!-- Controles de cantidad -->
          <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              type="button"
              data-action="dec" data-idx="${idx}"
              class="cart-qty-btn px-2.5 py-0.5 bg-gray-200 hover:bg-gray-300
                     text-navy text-sm font-bold transition-colors select-none"
              aria-label="Reducir cantidad"
            >−</button>
            <span class="px-2.5 text-sm font-bold text-navy min-w-[2rem] text-center
                         select-none">
              ${item.qty}
            </span>
            <button
              type="button"
              data-action="inc" data-idx="${idx}"
              class="cart-qty-btn px-2.5 py-0.5 bg-gray-200 hover:bg-gray-300
                     text-navy text-sm font-bold transition-colors select-none"
              aria-label="Aumentar cantidad"
            >+</button>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-end gap-2 flex-shrink-0">
        <!-- Botón eliminar -->
        <button
          type="button"
          data-action="remove" data-idx="${idx}"
          class="cart-qty-btn text-gray-400 hover:text-red-500 transition-colors p-0.5"
          aria-label="Eliminar del pedido"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <!-- Subtotal del ítem -->
        <span class="font-display text-sm font-bold text-navy">
          ${formatMXN(item.qty * item.unitPrice)}
        </span>
      </div>
    </div>
  `).join('');

  // Delegación de eventos en los controles de cantidad
  container.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', _handleQtyAction);
  });

  // Footer
  footer?.classList.remove('hidden');
  if (totalEl) totalEl.textContent = formatMXN(totalPrice);

  // Notificar cambio a main.js
  document.dispatchEvent(new CustomEvent('cart:updated', {
    detail: { count: totalQty, total: totalPrice },
  }));
}

/**
 * Maneja los clics en los botones de cantidad/eliminar.
 * @param {MouseEvent} e
 * @private
 */
function _handleQtyAction(e) {
  const btn    = e.currentTarget;
  const action = btn.dataset.action;
  const idx    = parseInt(btn.dataset.idx);

  if (isNaN(idx) || idx < 0 || idx >= _items.length) return;

  if (action === 'inc') {
    _items[idx].qty = Math.min(999, _items[idx].qty + 1);
  } else if (action === 'dec') {
    if (_items[idx].qty <= 1) {
      _items.splice(idx, 1);
    } else {
      _items[idx].qty -= 1;
    }
  } else if (action === 'remove') {
    _items.splice(idx, 1);
  }

  _persist();
  _render();
}

// ─── Panel toggle ──────────────────────────────────────────────

/** Abre o cierra el panel del carrito. */
export function toggleCart() {
  const panel   = document.getElementById('cart-panel');
  const overlay = document.getElementById('cart-overlay');
  const isOpen  = panel && !panel.classList.contains('translate-x-full');

  if (isOpen) {
    closeCart();
  } else {
    overlay?.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay?.classList.remove('opacity-0');
      panel?.classList.remove('translate-x-full');
    });
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
  }
}

/** Cierra el panel del carrito. */
export function closeCart() {
  const panel   = document.getElementById('cart-panel');
  const overlay = document.getElementById('cart-overlay');

  panel?.classList.add('translate-x-full');
  overlay?.classList.add('opacity-0');
  setTimeout(() => overlay?.classList.add('hidden'), 300);
  document.body.style.overflow = '';
}

// ─── Persistencia ──────────────────────────────────────────────

/** Guarda el estado en localStorage. @private */
function _persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
  } catch {
    // localStorage no disponible (modo privado extremo): silencioso
  }
}

/**
 * Carga el carrito desde localStorage.
 * @returns {CartItem[]}
 * @private
 */
function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Toast helper ──────────────────────────────────────────────

/** Dispara el toast global. @param {string} msg @private */
function _toast(msg) {
  document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg } }));
}

/** Escapa HTML para prevenir XSS @param {string} s @returns {string} @private */
function _escCart(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
