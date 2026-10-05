/**
 * @file components/catalog.js
 * @description Renderizador del catálogo de productos.
 *
 * RESPONSABILIDAD ÚNICA: Tomar un arreglo de Product[] y pintar
 * las tarjetas en el DOM. No contiene lógica de carrito ni de datos.
 *
 * CONEXIONES:
 *   ← Recibe datos de: api/googleSheets.js (vía main.js)
 *   → Dispara evento:  'product:add' (escuchado por cart.js)
 *   → Usa utilidad:    utils/format.js (formatMXN)
 */

import { formatMXN } from '../utils/format.js';

// ─── Selectores del DOM ────────────────────────────────────────

const EL = {
  loading:  () => document.getElementById('catalog-loading'),
  error:    () => document.getElementById('catalog-error'),
  header:   () => document.getElementById('products-header'),
  count:    () => document.getElementById('products-count'),
  grid:     () => document.getElementById('products-grid'),
  filterBar:() => document.getElementById('filter-bar'),
  searchInput:() => document.getElementById('search-input'),
};

// ─── Estado interno ────────────────────────────────────────────

/** @type {import('../api/googleSheets.js').Product[]} */
let _allProducts  = [];
/** @type {string} Categoría activa en el filtro */
let _activeFilter = 'Todos';
/** @type {string} Búsqueda activa */
let _searchQuery = '';

// ─── Configuración de colores y Fornitura ─────────────────────

/**
 * Compartimientos base incluidos en el precio de Fornitura.
 * ADMIN: cambia este número si el estándar cambia.
 */
const BASE_COMPARTIMIENTOS = 5;

/**
 * Paleta de colores estándar con su valor CSS y etiqueta en español.
 * @type {{ label: string, css: string }[]}
 */
const COLOR_PALETTE = [
  { label: 'Azul',   css: '#1d4ed8' },
  { label: 'Negro',  css: '#111111' },
  { label: 'Rojo',   css: '#dc2626' },
  { label: 'Blanco', css: '#f8fafc' },
  { label: 'Gris',   css: '#6b7280' },
  { label: 'Beige',  css: '#c4a882' },
];

const COLOR_PALETTE_BOTAS = [
  { label: 'Negro',  css: '#111111' },
  { label: 'Beige',  css: '#c4a882' },
];

/**
 * Devuelve los colores disponibles según el nombre del producto.
 * Retorna null si el producto no requiere selección de color.
 *
 * @param {string} name - Nombre del producto.
 * @returns {{ label: string, css: string }[] | null}
 */
function getColorOptions(name) {
  const n = name.toLowerCase();
  if (n.includes('bota')) return COLOR_PALETTE_BOTAS;
  if (
    n.includes('gorra')    ||
    n.includes('playera')  ||
    n.includes('pantalon') ||
    n.includes('pantalón') ||
    n.includes('chamarra')
  ) return COLOR_PALETTE;
  return null;
}

/**
 * Retorna true si el nombre corresponde a un producto Fornitura.
 * @param {string} name
 * @returns {boolean}
 */
function _isFornitura(name) {
  return name.toLowerCase().includes('fornitura');
}

// ─── API pública ───────────────────────────────────────────────

/**
 * Inicializa el catálogo con los productos y renderiza la vista.
 * @param {import('../api/googleSheets.js').Product[]} products
 */
export function initCatalog(products) {
  _allProducts = products;
  _hideLoading();
  _initSearch(); // Bind search listener
  _renderFilterBar();
  _renderFiltered();
}

function _initSearch() {
  const input = EL.searchInput();
  if (!input) return;
  // Use clone to remove potential existing listeners
  const newInst = input.cloneNode(true);
  input.parentNode.replaceChild(newInst, input);
  
  newInst.addEventListener('input', (e) => {
    _searchQuery = e.target.value.trim().toLowerCase();
    _renderFiltered();
  });
}

function _renderFiltered() {
  let filtered = _allProducts;
  if (_activeFilter !== 'Todos') {
    filtered = filtered.filter(p => p.partida === _activeFilter);
  }
  if (_searchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(_searchQuery) || 
      (p.sku && p.sku.toLowerCase().includes(_searchQuery)) ||
      (p.description && p.description.toLowerCase().includes(_searchQuery))
    );
  }
  _renderGrid(filtered);
}

/**
 * Muestra el estado de error con un mensaje amigable.
 * Lo llama main.js si el fetch al Sheet falla.
 *
 * @param {string} message - Descripción del error para el usuario.
 */
export function renderError(message) {
  _hideLoading();
  const el = EL.error();
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
      <!-- Ícono de advertencia -->
      <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
        <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor"
             stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                   c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898
                   0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      </div>

      <h2 class="font-display text-2xl font-bold text-navy tracking-wide mb-2">
        No se pudo cargar el catálogo
      </h2>
      <p class="text-gray-500 text-sm leading-relaxed mb-1">
        ${_escapeHTML(message)}
      </p>
      <p class="text-gray-400 text-xs mt-3 mb-6">
        Si el problema persiste, verifica que el Google Sheet esté publicado como CSV
        y que tengas conexión a internet.
      </p>

      <!-- Botón para reintentar -->
      <button
        id="btn-retry"
        class="bg-navy hover:bg-navy-light text-gold font-display font-bold
               px-6 py-2.5 rounded-xl tracking-wide transition-colors"
      >
        Reintentar
      </button>

      <!-- Opción de cargar demo -->
      <button
        id="btn-load-demo"
        class="mt-3 text-sm text-gray-400 hover:text-navy underline transition-colors"
      >
        Cargar catálogo de demostración
      </button>
    </div>
  `;

  // El botón "Reintentar" recarga la página
  document.getElementById('btn-retry')?.addEventListener('click', () => location.reload());

  // "Cargar demo" dispara un evento para que main.js lo maneje
  document.getElementById('btn-load-demo')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('catalog:loadDemo'));
  });
}

// ─── Renderizado interno ───────────────────────────────────────

/**
 * Renderiza la barra de filtros.
 * Agrupa por `partida` (referencia SUMINISTROS A. R.).
 * El botón "Todos" siempre aparece primero.
 * @private
 */
function _renderFilterBar() {
  // Genera etiquetas únicas de partida para los botones de filtro
  const partidas = ['Todos', ...new Set(_allProducts.map(p => p.partida).filter(Boolean))];
  const bar = EL.filterBar();

  bar.innerHTML = partidas.map(partida => `
    <button
      data-filter="${_escapeAttr(partida)}"
      class="filter-btn flex-shrink-0 font-display tracking-wide text-sm px-4 py-1.5
             rounded-full border transition-colors ${
               partida === _activeFilter
                 ? 'bg-navy text-gold border-navy'
                 : 'bg-white text-gray-600 border-gray-300 hover:border-navy hover:text-navy'
             }"
    >${_escapeHTML(partida)}</button>
  `).join('');

  // Usamos onclick para no acumular listeners
  bar.onclick = (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    _activeFilter = btn.dataset.filter;
    _renderFilterBar(); // re-renderiza para actualizar clases activas
    _renderFiltered();
  };
}

/**
 * Renderiza la cuadrícula de tarjetas de productos.
 * @param {import('../api/googleSheets.js').Product[]} products
 * @private
 */
function _renderGrid(products) {
  const header = EL.header();
  const count  = EL.count();
  const grid   = EL.grid();

  header.classList.remove('hidden');
  header.classList.add('flex');
  count.textContent = `${products.length} producto${products.length !== 1 ? 's' : ''}`;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 text-gray-400">
        <p class="font-display text-xl tracking-wide">Sin productos en esta categoría.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products
    .map((product, index) => _buildCardHTML(product, index))
    .join('');

  // Delegación de eventos: captura clics en "Añadir" y en color swatches
  grid.addEventListener('click', _handleGridClick);

  // Listener para cambio de precio al elegir variante
  grid.addEventListener('change', _handleVariantChange);

  // Listener para input de compartimientos (Fornitura)
  grid.addEventListener('input', _handleSlotInput);

  // Listener para navegación de la galería (flechas)
  grid.addEventListener('click', _handleSliderNav);
}

/**
 * Maneja el clic en las flechas de la galería.
 * @param {MouseEvent} e
 * @private
 */
function _handleSliderNav(e) {
  const btn = e.target.closest('.slider-nav');
  if (!btn) return;

  const card = btn.closest('.product-card');
  const slider = card?.querySelector('.product-slider');
  if (!slider) return;

  const direction = btn.dataset.dir === 'next' ? 1 : -1;
  const slideWidth = slider.offsetWidth;

  slider.scrollBy({
    left: slideWidth * direction,
    behavior: 'smooth'
  });
}

/**
 * Maneja el cambio en el selector de variantes para actualizar el precio visual.
 * @param {Event} e
 * @private
 */
function _handleVariantChange(e) {
  const select = e.target.closest('.variant-select');
  if (!select) return;

  const card = select.closest('[data-card-id]');
  const priceDisplay = card?.querySelector('.price-display');
  const selectedOption = select.options[select.selectedIndex];
  const newPrice = parseFloat(selectedOption.dataset.price);

  if (priceDisplay && !isNaN(newPrice)) {
    // Animación de cambio de precio
    priceDisplay.style.transform = 'scale(0.95)';
    priceDisplay.style.opacity = '0.5';

    setTimeout(() => {
      priceDisplay.textContent = formatMXN(newPrice);
      priceDisplay.style.transform = 'scale(1)';
      priceDisplay.style.opacity = '1';
    }, 150);
  }
}

/**
 * Actualiza el precio dinámicamente cuando cambian los compartimientos de Fornitura.
 * @param {Event} e
 * @private
 */
function _handleSlotInput(e) {
  const input = e.target.closest('.slot-input');
  if (!input) return;

  const productId  = input.dataset.productId;
  const basePrice  = parseFloat(input.dataset.basePrice) || 0;
  const extraPrice = parseFloat(input.dataset.extraPrice) || 0;
  const card       = input.closest('[data-card-id]');
  const priceDisplay = card?.querySelector('.price-display');
  const extraLabel   = card?.querySelector(`.slot-extra-label-${productId}`);

  const totalSlots = parseInt(input.value) || BASE_COMPARTIMIENTOS;
  const extras     = Math.max(0, totalSlots - BASE_COMPARTIMIENTOS);
  const newPrice   = basePrice + extras * extraPrice;

  if (priceDisplay) {
    priceDisplay.style.transform = 'scale(0.95)';
    priceDisplay.style.opacity   = '0.5';
    setTimeout(() => {
      priceDisplay.textContent     = formatMXN(newPrice);
      priceDisplay.style.transform = 'scale(1)';
      priceDisplay.style.opacity   = '1';
    }, 120);
  }

  if (extraLabel) {
    extraLabel.textContent = extras > 0
      ? `+${extras} extra · +${formatMXN(extras * extraPrice)}`
      : '';
  }
}

/**
 * Maneja el clic en el grid (delegación de eventos).
 * @param {MouseEvent} e
 * @private
 */
function _handleGridClick(e) {
  // Captura de clic en los círculos de color
  const colorBtn = e.target.closest('.color-swatch');
  if (colorBtn) {
    const card = colorBtn.closest('[data-card-id]');
    // Deseleccionar todos los del mismo grupo
    card?.querySelectorAll('.color-swatch').forEach(b => {
      b.classList.remove('ring-2', 'ring-offset-1', 'ring-gold');
      b.removeAttribute('aria-pressed');
    });
    // Seleccionar el clicado
    colorBtn.classList.add('ring-2', 'ring-offset-1', 'ring-gold');
    colorBtn.setAttribute('aria-pressed', 'true');
    return;
  }

  const btn = e.target.closest('.btn-add-product');
  if (!btn) return;

  const productId = btn.dataset.productId;
  const card      = btn.closest('[data-card-id]');

  const sizeSelect    = card?.querySelector(`#size-${productId}`);
  const variantSelect = card?.querySelector(`#variant-${productId}`);
  const qtyInput      = card?.querySelector(`#qty-${productId}`);
  const slotInput     = card?.querySelector(`#slots-${productId}`);

  const selectedSize    = sizeSelect ? sizeSelect.value : 'Única';
  const selectedVariant = variantSelect ? variantSelect.value : null;
  const qty             = parseInt(qtyInput?.value) || 1;
  const product         = _allProducts.find(p => p.id === productId);

  if (!product) return;

  // Leer color seleccionado (si aplica)
  const selectedColorBtn = card?.querySelector('.color-swatch[aria-pressed="true"]');
  const colorOptions = getColorOptions(product.name);
  if (colorOptions && !selectedColorBtn) {
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⚠ Selecciona un color' } }));
    // Highlight del contenedor de colores
    const swatchArea = card?.querySelector('.color-swatches-area');
    if (swatchArea) {
      swatchArea.classList.add('ring-2', 'ring-red-400', 'rounded-lg', 'p-1');
      setTimeout(() => swatchArea.classList.remove('ring-2', 'ring-red-400', 'rounded-lg', 'p-1'), 2500);
    }
    return;
  }
  const selectedColor = selectedColorBtn?.dataset.colorLabel || '';

  // Determinar el precio final basado en la variante (si existe)
  let finalPrice = product.price;
  if (selectedVariant && product.variants) {
    const vObj = product.variants.find(v => v.label === selectedVariant);
    if (vObj) finalPrice = vObj.price;
  }

  // Calcular precio de Fornitura con compartimientos extra
  let slotInfo = '';
  if (_isFornitura(product.name) && slotInput) {
    const totalSlots = parseInt(slotInput.value) || BASE_COMPARTIMIENTOS;
    const extraSlots = Math.max(0, totalSlots - BASE_COMPARTIMIENTOS);
    const extraPrice = (product.extraSlotPrice ?? 0) * extraSlots;
    finalPrice += extraPrice;
    slotInfo = totalSlots === BASE_COMPARTIMIENTOS
      ? `${BASE_COMPARTIMIENTOS} compartimientos estándar`
      : `${totalSlots} compartimientos (+${extraSlots} extra)`;
  }

  // Validar selección de talla
  if (product.sizes.length > 1 && !selectedSize) {
    _markInvalid(sizeSelect, 'Selecciona una talla');
    return;
  }

  // Disparar evento hacia cart.js
  document.dispatchEvent(new CustomEvent('product:add', {
    detail: {
      product,
      size: selectedSize || 'Única',
      qty,
      variant: selectedVariant,
      customPrice: finalPrice,
      color: selectedColor,
      slotInfo,
    },
  }));

  // Reset visual del input de cantidad y color
  if (qtyInput) qtyInput.value = 1;
  card?.querySelectorAll('.color-swatch').forEach(b => {
    b.classList.remove('ring-2', 'ring-offset-1', 'ring-gold');
    b.removeAttribute('aria-pressed');
  });
  if (slotInput) slotInput.value = BASE_COMPARTIMIENTOS;
}

/**
 * Genera el HTML de una tarjeta de producto.
 *
 * @param {import('../api/googleSheets.js').Product} p
 * @param {number} index - Para el delay de animación escalonada
 * @returns {string} HTML de la tarjeta
 * @private
 */
function _buildCardHTML(p, index) {
  const hasSizes    = p.sizes.length > 1 || (p.sizes.length === 1 && p.sizes[0] !== 'Única');
  const colorOpts   = getColorOptions(p.name);
  const isFornitura = _isFornitura(p.name);
  const hasExtraSlot = isFornitura && p.extraSlotPrice != null;

  return `
    <article
      class="product-card bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100
             fade-up flex flex-col"
      style="animation-delay:${index * 0.055}s"
      data-card-id="${_escapeAttr(p.id)}"
      aria-label="Bien: ${_escapeAttr(p.name)}"
    >
      <!-- Imagen o Galería -->
      <div class="relative h-44 overflow-hidden group">
        ${(function() {
          if (!p.imageUrls || p.imageUrls.length === 0) return _placeholderSVG(p);

          const hasMultiple = p.imageUrls.length > 1;
          const sliderHTML = p.imageUrls.map((url, i) => {
            const optimizedUrl = url.replace('/upload/', '/upload/f_auto,q_auto/');
            return `
              <div class="slider-item bg-gray-200 animate-pulse">
                <img src="${_escapeAttr(optimizedUrl)}"
                     alt="${_escapeAttr(p.name)} - Vista ${i+1}"
                     class="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                     loading="lazy"
                     onload="this.classList.remove('opacity-0'); this.parentElement.classList.remove('animate-pulse', 'bg-gray-200')"
                     onerror="this.style.display='none'; this.parentElement.classList.remove('animate-pulse', 'bg-gray-200'); this.parentElement.insertAdjacentHTML('afterbegin', \`${_escapeAttr(_placeholderSVG(p))}\`)" />
              </div>
            `;
          }).join('');

          return `
            <div class="product-slider w-full h-full">
              ${sliderHTML}
            </div>

            ${hasMultiple ? `
              <!-- Flechas de Navegación (Desktop) -->
              <button class="slider-nav prev" data-dir="prev" aria-label="Anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="slider-nav next" data-dir="next" aria-label="Siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              <div class="slider-dots">
                ${p.imageUrls.map((_, i) => `<span class="dot" data-index="${i}"></span>`).join('')}
              </div>
            ` : ''}
          `;
        })()}
        <!-- Badge de referencia SUMINISTROS A. R. -->
        <span class="absolute top-3 left-3 bg-gold/90 text-navy text-xs font-bold
                     font-display px-2.5 py-0.5 rounded-full tracking-wider z-10"
              title="Referencia de catálogo SUMINISTROS A. R.">
          ${_escapeHTML(p.partida || '—')}
        </span>
        <!-- SKU / Folio -->
        <span class="absolute bottom-2 right-2 bg-black/40 text-white/70 text-xs
                     font-mono px-2 py-0.5 rounded"
              title="Folio interno">
          ${_escapeHTML(p.sku)}
        </span>
      </div>

      <!-- Datos del bien -->
      <div class="p-4 flex flex-col flex-1">
        <h3 class="font-display text-base font-bold text-navy tracking-wide leading-tight mb-1">
          ${_escapeHTML(p.name)}
        </h3>
        <p class="text-xs text-gray-500 leading-snug mb-3 flex-1">
          ${_escapeHTML(p.description)}
        </p>

        <!-- Precio + unidad de medida -->
        <div class="flex flex-col mb-3">
          <div class="flex items-baseline gap-1.5">
            <span class="price-display font-display text-2xl font-bold text-navy transition-all duration-200">
              ${formatMXN(p.price)}
            </span>
            <span class="text-xs text-gray-400 uppercase tracking-wide">
              / ${_escapeHTML(p.unitLabel || 'PIEZA')}
            </span>
          </div>
          <span class="text-[10px] text-gold-dark font-bold uppercase tracking-widest mt-0.5">
            IVA Incluido
          </span>
        </div>

        <!-- Selector de variante (si existen) -->
        ${p.variants ? `
          <div class="mb-3">
            <label for="variant-${_escapeAttr(p.id)}"
                   class="block text-xs font-semibold text-gold-dark mb-1 tracking-wide">
              VERSIÓN / MATERIAL:
            </label>
            <select
              id="variant-${_escapeAttr(p.id)}"
              class="variant-select w-full border border-gold-dark/30 rounded-lg px-3 py-1.5 text-sm text-navy
                     bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                     transition-colors font-semibold"
            >
              ${p.variants.map(v => `
                <option value="${_escapeAttr(v.label)}" data-price="${v.price}">
                  ${_escapeHTML(v.label)} (${formatMXN(v.price)})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <!-- ── SELECTOR DE COLOR (círculos) ── -->
        ${colorOpts ? `
          <div class="mb-3">
            <label class="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">
              COLOR:
            </label>
            <div class="color-swatches-area flex flex-wrap gap-1.5">
              ${colorOpts.map(c => `
                <button
                  type="button"
                  class="color-swatch w-7 h-7 rounded-full border-2 shadow
                         transition-all duration-150 hover:scale-110 focus:outline-none
                         focus:ring-2 focus:ring-gold focus:ring-offset-1
                         ${c.css === '#f8fafc' ? 'border-gray-300' : 'border-white'}"
                  style="background-color:${c.css}"
                  data-color-label="${_escapeAttr(c.label)}"
                  title="${_escapeAttr(c.label)}"
                  aria-label="${_escapeAttr(c.label)}"
                  aria-pressed="false"
                ></button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- ── COMPARTIMIENTOS (solo Fornitura) ── -->
        ${isFornitura ? `
          <div class="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <label class="block text-xs font-semibold text-amber-700 mb-1.5 tracking-wide">
              COMPARTIMIENTOS:
            </label>
            <div class="flex items-center gap-2">
              <div class="flex items-center border border-amber-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onclick="
                    const el=document.getElementById('slots-${p.id}');
                    el.value=Math.max(${BASE_COMPARTIMIENTOS},parseInt(el.value||${BASE_COMPARTIMIENTOS})-1);
                    el.dispatchEvent(new Event('input',{bubbles:true}));
                  "
                  class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm transition-colors select-none"
                  aria-label="Reducir compartimientos"
                >−</button>
                <input
                  id="slots-${_escapeAttr(p.id)}"
                  type="number"
                  value="${BASE_COMPARTIMIENTOS}"
                  min="${BASE_COMPARTIMIENTOS}"
                  max="20"
                  class="slot-input w-12 text-center text-sm font-bold py-1.5 border-0
                         focus:outline-none text-amber-800 bg-white"
                  data-product-id="${_escapeAttr(p.id)}"
                  data-base-price="${p.price}"
                  data-extra-price="${p.extraSlotPrice ?? 0}"
                  aria-label="Número de compartimientos"
                />
                <button
                  type="button"
                  onclick="
                    const el=document.getElementById('slots-${p.id}');
                    el.value=Math.min(20,parseInt(el.value||${BASE_COMPARTIMIENTOS})+1);
                    el.dispatchEvent(new Event('input',{bubbles:true}));
                  "
                  class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm transition-colors select-none"
                  aria-label="Aumentar compartimientos"
                >+</button>
              </div>
              <div class="flex flex-col leading-tight">
                <span class="text-xs text-amber-700 font-semibold">
                  ${BASE_COMPARTIMIENTOS} base incluidos
                </span>
                ${hasExtraSlot ? `
                  <span class="slot-extra-label-${_escapeAttr(p.id)} text-xs text-amber-600"></span>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Selector de talla (solo si hay más de una opción o no es Única) -->
        ${hasSizes ? `
          <div class="mb-3">
            <label for="size-${_escapeAttr(p.id)}"
                   class="block text-xs font-semibold text-gray-500 mb-1 tracking-wide">
              TALLA / MEDIDA:
            </label>
            <select
              id="size-${_escapeAttr(p.id)}"
              class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-navy
                     bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                     transition-colors"
            >
              <option value="">Seleccionar…</option>
              ${p.sizes.map(s => `<option value="${_escapeAttr(s)}">${_escapeHTML(s)}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <!-- Control de cantidad -->
        <div class="mb-4 flex items-center gap-2">
          <span class="text-xs font-semibold text-gray-500 tracking-wide">CANT:</span>
          <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onclick="
                const el=document.getElementById('qty-${p.id}');
                el.value=Math.max(1,parseInt(el.value||1)-1);
              "
              class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-navy font-bold
                     text-sm transition-colors select-none"
              aria-label="Reducir cantidad"
            >−</button>
            <input
              id="qty-${_escapeAttr(p.id)}"
              type="number"
              value="1" min="1" max="999"
              class="w-14 text-center text-sm font-semibold py-1.5 border-0
                     focus:outline-none text-navy"
              aria-label="Cantidad"
            />
            <button
              type="button"
              onclick="
                const el=document.getElementById('qty-${p.id}');
                el.value=Math.min(999,parseInt(el.value||1)+1);
              "
              class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-navy font-bold
                     text-sm transition-colors select-none"
              aria-label="Aumentar cantidad"
            >+</button>
          </div>
        </div>

        <!-- Botón de añadir -->
        <button
          type="button"
          class="btn-add-product bg-gold hover:bg-gold-hover text-navy font-display font-bold
                 w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2
                 shadow transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]
                 tracking-wide"
          data-product-id="${_escapeAttr(p.id)}"
          aria-label="Añadir ${_escapeAttr(p.name)} a la lista"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5"
               viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          AÑADIR A LA LISTA
        </button>
      </div>
    </article>
  `;
}

// ─── Helpers privados ──────────────────────────────────────────

/**
 * Genera el HTML del placeholder de imagen con patrón diagonal.
 * @param {import('../api/googleSheets.js').Product} p
 * @returns {string}
 * @private
 */
function _placeholderSVG(p) {
  const label = p.name.split(' ').slice(0, 2).join('\n');
  return `
    <div class="img-placeholder w-full h-full flex items-center justify-center">
      <span class="text-white/60 font-display font-bold text-lg leading-tight
                   text-center whitespace-pre-line tracking-wider">
        ${_escapeHTML(label)}
      </span>
    </div>
  `;
}

/**
 * Marca un <select> como inválido temporalmente.
 * @param {HTMLSelectElement|null} el
 * @param {string} toastMsg
 * @private
 */
function _markInvalid(el, toastMsg) {
  if (el) {
    el.classList.add('border-red-400', 'ring-2', 'ring-red-200');
    el.focus();
    setTimeout(() => el.classList.remove('border-red-400', 'ring-2', 'ring-red-200'), 2500);
  }
  document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: `⚠ ${toastMsg}` } }));
}

/** Escapa HTML para prevenir XSS @param {string} s @returns {string} */
function _escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapa para atributos HTML @param {string} s @returns {string} */
function _escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Oculta el spinner de carga @private */
function _hideLoading() {
  EL.loading()?.classList.add('hidden');
}
