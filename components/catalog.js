/**
 * @file components/catalog.js
 * @description Renderizador del catálogo de productos B2B con Matriz de Tallas,
 * Fichas Técnicas Oficiales, filtros avanzados y accesibilidad para Suministros A. R.
 *
 * RESPONSABILIDAD ÚNICA: Tomar un arreglo de Product[] y pintar
 * las tarjetas en el DOM. No contiene lógica de almacenamiento de carrito.
 *
 * CONEXIONES:
 *   ← Recibe datos de: api/supabaseClient.js (vía main.js)
 *   → Dispara evento:  'product:add' (escuchado por cart.js)
 *   → Usa utilidad:    utils/format.js (formatMXN)
 */

import { formatMXN } from '../utils/format.js';

// ─── Selectores del DOM ────────────────────────────────────────

const EL = {
  loading:          () => document.getElementById('catalog-loading'),
  error:            () => document.getElementById('catalog-error'),
  header:           () => document.getElementById('products-header'),
  count:            () => document.getElementById('products-count'),
  grid:             () => document.getElementById('products-grid'),
  filterBar:        () => document.getElementById('filter-bar'),
  searchInput:      () => document.getElementById('search-input'),
  searchClearBtn:   () => document.getElementById('search-clear-btn'),
  sizeFilterSelect: () => document.getElementById('size-filter-select'),
  techModal:        () => document.getElementById('tech-sheet-modal'),
  matrixModal:      () => document.getElementById('matrix-modal'),
};

// ─── Estado interno ────────────────────────────────────────────

/** @type {Array<Object>} */
let _allProducts        = [];
/** @type {string} Categoría activa en el filtro */
let _activeFilter       = 'Todos';
/** @type {string} Talla activa en el filtro */
let _activeSizeFilter   = 'Todas';
/** @type {string} Búsqueda activa */
let _searchQuery        = '';
/** @type {HTMLElement|null} Elemento que activó el modal de ficha técnica para devolver el foco */
let _lastFocusedElement = null;

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
  const n = (name || '').toLowerCase();
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
  return (name || '').toLowerCase().includes('fornitura');
}

/**
 * Genera especificaciones técnicas institucionales para la ficha técnica.
 * @param {Object} p
 * @returns {Object}
 */
function getTechSheetData(p) {
  const name = (p.name || '').toLowerCase();
  
  if (name.includes('playera') || name.includes('polo')) {
    return {
      material: 'Tejido tipo Piqué de alta densidad (65% Poliéster / 35% Algodón)',
      gramaje: '220 g/m² ± 5%',
      confeccion: 'Cuello y puños tejidos en cárdigan de punto cerrado indeformable. Tapacostura interior de hombro a hombro. Aletilla reforzada con botones al tono.',
      uso: 'Uniformidad policial operativa y de proximidad social. Transpirable con solidez de color a la luz y lavados industriales continuos.',
      norma: 'Confección grado seguridad pública según lineamientos SESNSP.'
    };
  }
  
  if (name.includes('pantalon') || name.includes('pantalón')) {
    return {
      material: 'Gabardina Ripstop Antidesgarre (65% Poliéster / 35% Algodón)',
      gramaje: '240 g/m² con acabado teflonado hidro-repelente',
      confeccion: 'Doble costura en costados y tiro con hilo de alta tenacidad. Refuerzo de doble tela en rodillas y entrepierna. Bolsillos cargo con fuelle y solapa.',
      uso: 'Operaciones tácticas y patrullaje de alta exigencia física. Resistente a fricción, desgarre y condiciones climáticas adversas.',
      norma: 'Diseñado bajo estándares de equipamiento táctico municipal.'
    };
  }

  if (name.includes('chamarra')) {
    return {
      material: 'Taslan Softshell bicapa con membrana hidro-repelente y forro térmico capitonado',
      gramaje: '260 g/m² exterior + guata térmica interior 120 g',
      confeccion: 'Cierres de uso rudo tipo tractor YKK. Paneles de velcro militar en pecho y mangas para sectores y escudos. Cintura y puños con ajuste hermético.',
      uso: 'Protección invernal y climas lluviosos para personal de guardia y vialidad. Cortavientos con máxima retención térmica.',
      norma: 'Especificación táctica para corporaciones policiales.'
    };
  }

  if (name.includes('bota')) {
    return {
      material: 'Piel genuina flor entera de primera selección combinada con nylon balístico 1000D',
      gramaje: 'Espesor de piel 1.8 - 2.0 mm',
      confeccion: 'Suela de caucho vulcanizado antiderrapante resistente a aceites e hidrocarburos. Plantilla ergonómica antibacterial de alta memoria.',
      uso: 'Jornadas de patrullaje de 12 a 24 horas continuas. Soporte de tobillo y absorción de impacto en pavimento y terreno irregular.',
      norma: 'Calzado táctico de alto rendimiento para fuerzas de seguridad.'
    };
  }

  if (name.includes('fornitura')) {
    return {
      material: 'Nylon balístico de grado militar 1680D con ribetes reforzados',
      gramaje: 'Cinturón rígido de 2 pulgadas de ancho con alma de polímero',
      confeccion: 'Hebilla de seguridad de 3 puntos de liberación rápida. Módulos y accesorios con broches de presión antioxidantes y pasacintos reforzados.',
      uso: 'Portación segura de equipo de cargo: gas, esposas, bastón, radio, cargadores y lámpara.',
      norma: 'Configuración estándar para servicio en patrulla y a pie.'
    };
  }

  if (name.includes('gorra')) {
    return {
      material: 'Gabardina pesada 100% Algodón o Microfibra con elastano (licra)',
      gramaje: '260 g/m² estructura de 6 gajos con ojillos bordados',
      confeccion: 'Visera rígida precurvada con alma plástica indeformable (no cartón). Tafilete interno absorbente de sudor y ajuste posterior velcro/broche.',
      uso: 'Protección solar y presentación institucional en servicio diario.',
      norma: 'Apta para bordado institucional frontal y leyendas laterales.'
    };
  }

  if (name.includes('lampara') || name.includes('lámpara')) {
    return {
      material: 'Aleación de aluminio aeroespacial anodizado grado militar tipo III',
      gramaje: 'Cuerpo estanco resistente a impactos desde 1.5 metros (IPX6)',
      confeccion: 'LED CREE de alta intensidad con lente de policarbonato antirrayaduras. Circuito de control de voltaje con modos Alto, Bajo y Estrobo.',
      uso: 'Operaciones nocturnas, filtros de revisión y búsqueda táctica.',
      norma: 'Autonomía prolongada con batería recargable de alta capacidad.'
    };
  }

  if (name.includes('baston') || name.includes('bastón')) {
    return {
      material: 'Acero templado al carbono sin costuras o Policarbonato de alto impacto PR-24',
      gramaje: 'Tratamiento térmico endurecido antioxidante negro mate',
      confeccion: 'Empuñadura de caucho texturizado antideslizante con tope de retención y funda de porte de liberación rápida.',
      uso: 'Uso de la fuerza legítima no letal, contención y defensa personal policial.',
      norma: 'Estándar homologado para corporaciones policiales municipales.'
    };
  }

  return {
    material: 'Materiales industriales y tácticos certificados de uso rudo para corporaciones públicas.',
    gramaje: 'Especificación de alta durabilidad para servicio policial continuo.',
    confeccion: 'Ensamblado con hilos de alta tenacidad, costuras reforzadas y pruebas de resistencia mecánica.',
    uso: 'Equipamiento municipal institucional.',
    norma: 'Cumple requerimientos de compras públicas FORTAMUN.'
  };
}

// ─── API pública ───────────────────────────────────────────────

/**
 * Inicializa el catálogo con los productos y renderiza la vista.
 * @param {Array<Object>} products
 */
export function initCatalog(products) {
  _allProducts = products;
  _hideLoading();
  _initFiltersAndSearch();
  _renderFilterBar();
  _renderFiltered();
  _initTechModalListeners();
}

/**
 * Vincula la búsqueda, el selector de tallas y el botón de limpiar búsqueda.
 * @private
 */
function _initFiltersAndSearch() {
  const input = EL.searchInput();
  const clearBtn = EL.searchClearBtn();
  const sizeSelect = EL.sizeFilterSelect();

  if (input) {
    const newInst = input.cloneNode(true);
    input.parentNode.replaceChild(newInst, input);
    
    newInst.addEventListener('input', (e) => {
      _searchQuery = e.target.value.trim().toLowerCase();
      if (clearBtn) {
        if (_searchQuery) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      _renderFiltered();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const inp = EL.searchInput();
      if (inp) inp.value = '';
      _searchQuery = '';
      clearBtn.classList.add('hidden');
      _renderFiltered();
    });
  }

  if (sizeSelect) {
    sizeSelect.addEventListener('change', (e) => {
      _activeSizeFilter = e.target.value;
      _renderFiltered();
    });
  }
}

/**
 * Filtra los productos según categoría activa, texto de búsqueda y talla seleccionada.
 * @private
 */
function _renderFiltered() {
  let filtered = _allProducts;

  if (_activeFilter !== 'Todos') {
    filtered = filtered.filter(p => p.partida === _activeFilter);
  }

  if (_activeSizeFilter !== 'Todas') {
    filtered = filtered.filter(p => {
      if (!p.sizes || p.sizes.length === 0) return false;
      return p.sizes.some(s => s.toLowerCase() === _activeSizeFilter.toLowerCase());
    });
  }

  if (_searchQuery) {
    filtered = filtered.filter(p => 
      (p.name && p.name.toLowerCase().includes(_searchQuery)) || 
      (p.sku && p.sku.toLowerCase().includes(_searchQuery)) ||
      (p.description && p.description.toLowerCase().includes(_searchQuery))
    );
  }

  _renderGrid(filtered);
}

/**
 * Muestra el estado de error con un mensaje amigable.
 * @param {string} message - Descripción del error para el usuario.
 */
export function renderError(message) {
  _hideLoading();
  const el = EL.error();
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
      <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
        <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
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
        Verifica tu conexión a internet o intenta recargar el catálogo.
      </p>

      <button id="btn-retry"
              class="bg-navy hover:bg-navy-light text-gold font-display font-bold
                     px-6 py-2.5 rounded-xl tracking-wide transition-colors">
        Reintentar
      </button>
    </div>
  `;

  document.getElementById('btn-retry')?.addEventListener('click', () => location.reload());
}

// ─── Renderizado interno ───────────────────────────────────────

/**
 * Renderiza la barra de filtros por categoría.
 * @private
 */
function _renderFilterBar() {
  const partidas = ['Todos', ...new Set(_allProducts.map(p => p.partida).filter(Boolean))];
  const bar = EL.filterBar();
  if (!bar) return;

  bar.innerHTML = partidas.map(partida => `
    <button
      data-filter="${_escapeAttr(partida)}"
      class="filter-btn flex-shrink-0 font-display tracking-wide text-xs sm:text-sm px-4 py-1.5
             rounded-full border transition-all duration-150 ${
               partida === _activeFilter
                 ? 'bg-navy text-gold border-navy shadow-sm'
                 : 'bg-white text-gray-600 border-gray-300 hover:border-navy hover:text-navy'
             }"
    >${_escapeHTML(partida)}</button>
  `).join('');

  bar.onclick = (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    _activeFilter = btn.dataset.filter;
    _renderFilterBar();
    _renderFiltered();
  };
}

/**
 * Renderiza la cuadrícula de tarjetas de productos.
 * @param {Array<Object>} products
 * @private
 */
function _renderGrid(products) {
  const header = EL.header();
  const count  = EL.count();
  const grid   = EL.grid();

  if (!grid) return;

  if (header) {
    header.classList.remove('hidden');
    header.classList.add('flex');
  }
  if (count) {
    count.textContent = `${products.length} producto${products.length !== 1 ? 's' : ''}`;
  }

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl border border-gray-200 p-12 text-center my-6 shadow-sm">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <h3 class="font-display text-2xl font-bold text-navy tracking-wide mb-1">
          Sin productos encontrados
        </h3>
        <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
          No hay artículos que coincidan con la categoría, talla o búsqueda actual.
        </p>
        <button id="btn-reset-filters"
                class="bg-navy hover:bg-navy-light text-gold text-xs font-display font-bold px-6 py-2.5 rounded-xl transition-all shadow">
          Restablecer Filtros
        </button>
      </div>
    `;

    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      _activeFilter = 'Todos';
      _activeSizeFilter = 'Todas';
      _searchQuery = '';
      const inp = EL.searchInput();
      if (inp) inp.value = '';
      const sizeSel = EL.sizeFilterSelect();
      if (sizeSel) sizeSel.value = 'Todas';
      const clr = EL.searchClearBtn();
      if (clr) clr.classList.add('hidden');
      _renderFilterBar();
      _renderFiltered();
    });
    return;
  }

  grid.innerHTML = products
    .map((product, index) => _buildCardHTML(product, index))
    .join('');

  // Remover listeners previos duplicados reasignando handlers directos o con delegación limpia
  grid.onclick = _handleGridClick;
  grid.onchange = _handleVariantChange;
  grid.oninput = _handleGridInput;
}

/**
 * Maneja los inputs directos en la tarjeta (slots de fornitura o matriz de tallas).
 * @param {Event} e
 * @private
 */
function _handleGridInput(e) {
  // 1. Input de compartimientos Fornitura
  if (e.target.closest('.slot-input')) {
    _handleSlotInput(e);
  }

  // 2. Input de cantidades en la matriz de tallas
  if (e.target.closest('.matrix-qty-input')) {
    const input = e.target.closest('.matrix-qty-input');
    const productId = input.dataset.productId;
    _recalculateMatrixCard(productId);
  }
}

/**
 * Recalcula el total de piezas y el subtotal en vivo de la matriz de tallas de una tarjeta.
 * @param {string} productId
 * @private
 */
function _recalculateMatrixCard(productId) {
  const card = document.querySelector(`[data-card-id="${productId}"]`);
  if (!card) return;

  const product = _allProducts.find(p => p.id === productId);
  if (!product) return;

  // Determinar precio base a considerar (incluyendo variante si está seleccionada)
  const variantSelect = card.querySelector(`#variant-${productId}`);
  let currentPrice = product.price;
  if (variantSelect && product.variants) {
    const selectedVariant = variantSelect.value;
    const vObj = product.variants.find(v => v.label === selectedVariant);
    if (vObj) currentPrice = vObj.price;
  }

  const inputs = card.querySelectorAll(`.matrix-qty-input[data-product-id="${productId}"]`);
  let totalQty = 0;
  inputs.forEach(inp => {
    const val = parseInt(inp.value, 10);
    const tile = inp.closest('.matrix-tile');
    if (!isNaN(val) && val > 0) {
      totalQty += val;
      if (tile) {
        tile.classList.add('ring-2', 'ring-gold', 'border-gold', 'bg-[#1E3A5F]', 'shadow-[0_0_12px_rgba(255,215,0,0.25)]');
        tile.classList.remove('border-navy-border');
        const badge = tile.querySelector('.tile-size-badge');
        if (badge) {
          badge.classList.add('bg-gold', 'text-navy');
          badge.classList.remove('bg-navy-border', 'text-white');
        }
        inp.classList.add('text-gold', 'font-black');
        inp.classList.remove('text-white');
      }
    } else {
      if (tile) {
        tile.classList.remove('ring-2', 'ring-gold', 'border-gold', 'bg-[#1E3A5F]', 'shadow-[0_0_12px_rgba(255,215,0,0.25)]');
        tile.classList.add('border-navy-border');
        const badge = tile.querySelector('.tile-size-badge');
        if (badge) {
          badge.classList.remove('bg-gold', 'text-navy');
          badge.classList.add('bg-navy-border', 'text-white');
        }
        inp.classList.remove('text-gold', 'font-black');
        inp.classList.add('text-white');
      }
    }
  });

  const subtotal = totalQty * currentPrice;

  const qtyEl = card.querySelector(`.matrix-total-qty-${productId}`);
  const subtotalEl = card.querySelector(`.matrix-subtotal-${productId}`);
  const btnLabel = card.querySelector(`.matrix-btn-label-${productId}`);

  if (qtyEl) qtyEl.textContent = String(totalQty);
  if (subtotalEl) subtotalEl.textContent = formatMXN(subtotal);
  if (btnLabel) {
    btnLabel.textContent = totalQty > 0 ? `AÑADIR LOTE (${totalQty} PZAS)` : 'AÑADIR LOTE (0 PZAS)';
  }
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
    priceDisplay.style.transform = 'scale(0.95)';
    priceDisplay.style.opacity = '0.5';

    setTimeout(() => {
      priceDisplay.textContent = formatMXN(newPrice);
      priceDisplay.style.transform = 'scale(1)';
      priceDisplay.style.opacity = '1';
    }, 150);
  }

  // Si tiene matriz de tallas desplegada, recalcular
  const productId = card?.dataset.cardId;
  if (productId) {
    _recalculateMatrixCard(productId);
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
 * Maneja el clic en el grid (delegación centralizada).
 * @param {MouseEvent} e
 * @private
 */
function _handleGridClick(e) {
  // 1. Flechas de slider
  if (e.target.closest('.slider-nav')) {
    _handleSliderNav(e);
    return;
  }

  // 2. Clic en los círculos de color
  const colorBtn = e.target.closest('.color-swatch');
  if (colorBtn) {
    const card = colorBtn.closest('[data-card-id]');
    card?.querySelectorAll('.color-swatch').forEach(b => {
      b.classList.remove('ring-2', 'ring-offset-1', 'ring-gold');
      b.removeAttribute('aria-pressed');
    });
    colorBtn.classList.add('ring-2', 'ring-offset-1', 'ring-gold');
    colorBtn.setAttribute('aria-pressed', 'true');
    return;
  }

  // 3. Abrir Ficha Técnica Oficial
  const techBtn = e.target.closest('.btn-open-tech-sheet');
  if (techBtn) {
    const productId = techBtn.dataset.productId;
    const product = _allProducts.find(p => p.id === productId);
    if (product) {
      _lastFocusedElement = techBtn;
      _openTechSheetModal(product);
    }
    return;
  }

  // 4. Selector de Modo en Tarjeta (Individual vs Matriz por Lote)
  const tabBtn = e.target.closest('.tab-mode-btn');
  if (tabBtn) {
    const productId = tabBtn.dataset.productId;
    const targetMode = tabBtn.dataset.targetMode;
    const card = tabBtn.closest('[data-card-id]');
    if (card) {
      card.querySelectorAll('.tab-mode-btn').forEach(b => {
        if (b.dataset.targetMode === targetMode) {
          b.className = 'tab-mode-btn flex-1 py-1.5 px-2 rounded-lg text-center transition-all bg-navy text-gold shadow-xs';
        } else {
          b.className = 'tab-mode-btn flex-1 py-1.5 px-2 rounded-lg text-center transition-all text-gray-500 hover:text-navy';
        }
      });
      const singlePanel = card.querySelector(`#single-panel-${productId}`);
      const batchPanel = card.querySelector(`#batch-panel-${productId}`);
      if (targetMode === 'single') {
        singlePanel?.classList.remove('hidden');
        batchPanel?.classList.add('hidden');
      } else {
        singlePanel?.classList.add('hidden');
        batchPanel?.classList.remove('hidden');
        _recalculateMatrixCard(productId);
      }
    }
    return;
  }

  // 5. Botones +/- dentro de la Matriz de Tallas
  const matrixStepBtn = e.target.closest('.matrix-step-btn');
  if (matrixStepBtn) {
    const delta = parseInt(matrixStepBtn.dataset.delta, 10) || 0;
    const productId = matrixStepBtn.dataset.productId;
    const size = matrixStepBtn.dataset.size;
    const card = matrixStepBtn.closest('[data-card-id]');
    const input = card?.querySelector(`.matrix-qty-input[data-product-id="${productId}"][data-size="${size}"]`);
    if (input) {
      const curr = parseInt(input.value, 10) || 0;
      input.value = Math.max(0, Math.min(999, curr + delta));
      _recalculateMatrixCard(productId);
    }
    return;
  }

  // 6. Botón +5 rápido por talla en la matriz
  const quickAddBtn = e.target.closest('.matrix-quick-add');
  if (quickAddBtn) {
    const delta = parseInt(quickAddBtn.dataset.delta, 10) || 5;
    const productId = quickAddBtn.dataset.productId;
    const size = quickAddBtn.dataset.size;
    const card = quickAddBtn.closest('[data-card-id]');
    const input = card?.querySelector(`.matrix-qty-input[data-product-id="${productId}"][data-size="${size}"]`);
    if (input) {
      const curr = parseInt(input.value, 10) || 0;
      input.value = Math.max(0, Math.min(999, curr + delta));
      _recalculateMatrixCard(productId);
    }
    return;
  }

  // 7. Llenado masivo de todo el lote (+5, +10, +20 a todas las tallas)
  const batchFillBtn = e.target.closest('.btn-batch-fill');
  if (batchFillBtn) {
    const amount = parseInt(batchFillBtn.dataset.amount, 10) || 5;
    const productId = batchFillBtn.dataset.productId;
    const card = batchFillBtn.closest('[data-card-id]');
    if (card) {
      const inputs = card.querySelectorAll(`.matrix-qty-input[data-product-id="${productId}"]`);
      inputs.forEach(inp => {
        const curr = parseInt(inp.value, 10) || 0;
        inp.value = Math.max(0, Math.min(999, curr + amount));
      });
      _recalculateMatrixCard(productId);
    }
    return;
  }

  // 8. Limpiar matriz de tallas a 0
  const clearMatrixBtn = e.target.closest('.btn-clear-matrix');
  if (clearMatrixBtn) {
    const productId = clearMatrixBtn.dataset.productId;
    const card = clearMatrixBtn.closest('[data-card-id]');
    if (card) {
      const inputs = card.querySelectorAll(`.matrix-qty-input[data-product-id="${productId}"]`);
      inputs.forEach(inp => { inp.value = 0; });
      _recalculateMatrixCard(productId);
    }
    return;
  }

  // 9. Abrir Matriz Táctica Ampliada en Pantalla Completa
  const expandMatrixBtn = e.target.closest('.btn-expand-matrix');
  if (expandMatrixBtn) {
    const productId = expandMatrixBtn.dataset.productId;
    const product = _allProducts.find(p => p.id === productId);
    if (product) {
      _lastFocusedElement = expandMatrixBtn;
      _openExpandedMatrixModal(product);
    }
    return;
  }

  // 10. Añadir Lote desde la Matriz de Tallas
  const addMatrixBtn = e.target.closest('.btn-add-matrix');
  if (addMatrixBtn) {
    _handleAddMatrix(addMatrixBtn);
    return;
  }

  // 11. Botón regular "AÑADIR A LA LISTA" (individual)
  const btn = e.target.closest('.btn-add-product');
  if (btn) {
    _handleAddSingleProduct(btn);
    return;
  }
}

/**
 * Procesa la adición masiva de un lote desde la matriz de tallas.
 * @param {HTMLElement} btn
 * @private
 */
function _handleAddMatrix(btn) {
  const productId = btn.dataset.productId;
  const card = btn.closest('[data-card-id]');
  const product = _allProducts.find(p => p.id === productId);
  if (!product || !card) return;

  // Validar color si aplica
  const colorOptions = getColorOptions(product.name);
  const selectedColorBtn = card.querySelector('.color-swatch[aria-pressed="true"]');
  if (colorOptions && !selectedColorBtn) {
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⚠ Selecciona un color antes de añadir el lote' } }));
    const swatchArea = card.querySelector('.color-swatches-area');
    if (swatchArea) {
      swatchArea.classList.add('ring-2', 'ring-red-400', 'rounded-lg', 'p-1');
      setTimeout(() => swatchArea.classList.remove('ring-2', 'ring-red-400', 'rounded-lg', 'p-1'), 2500);
    }
    return;
  }
  const selectedColor = selectedColorBtn?.dataset.colorLabel || '';

  // Determinar precio según variante
  const variantSelect = card.querySelector(`#variant-${productId}`);
  const selectedVariant = variantSelect ? variantSelect.value : null;
  let finalPrice = product.price;
  if (selectedVariant && product.variants) {
    const vObj = product.variants.find(v => v.label === selectedVariant);
    if (vObj) finalPrice = vObj.price;
  }

  // Recolectar tallas con cantidad > 0
  const inputs = card.querySelectorAll(`.matrix-qty-input[data-product-id="${productId}"]`);
  let totalAdded = 0;
  const batches = [];

  inputs.forEach(inp => {
    const qty = parseInt(inp.value, 10);
    if (!isNaN(qty) && qty > 0) {
      batches.push({ size: inp.dataset.size, qty });
      totalAdded += qty;
    }
  });

  if (batches.length === 0) {
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⚠ Ingresa al menos una pieza en la matriz' } }));
    return;
  }

  // Disparar evento para cada talla seleccionada (retrocompatible con cart.js)
  batches.forEach(b => {
    document.dispatchEvent(new CustomEvent('product:add', {
      detail: {
        product,
        size: b.size,
        qty: b.qty,
        variant: selectedVariant,
        customPrice: finalPrice,
        color: selectedColor,
        slotInfo: ''
      }
    }));
  });

  // Limpiar inputs de la matriz
  inputs.forEach(inp => { inp.value = 0; });
  _recalculateMatrixCard(productId);

  document.dispatchEvent(new CustomEvent('ui:toast', {
    detail: { msg: `✓ Lote agregado: ${totalAdded} piezas (${product.name})` }
  }));
}

/**
 * Añade un producto individual (flujo estándar).
 * @param {HTMLElement} btn
 * @private
 */
function _handleAddSingleProduct(btn) {
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
    const swatchArea = card?.querySelector('.color-swatches-area');
    if (swatchArea) {
      swatchArea.classList.add('ring-2', 'ring-red-400', 'rounded-lg', 'p-1');
      setTimeout(() => swatchArea.classList.remove('ring-2', 'ring-red-400', 'rounded-lg', 'p-1'), 2500);
    }
    return;
  }
  const selectedColor = selectedColorBtn?.dataset.colorLabel || '';

  // Determinar precio final
  let finalPrice = product.price;
  if (selectedVariant && product.variants) {
    const vObj = product.variants.find(v => v.label === selectedVariant);
    if (vObj) finalPrice = vObj.price;
  }

  // Compartimientos Fornitura
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

  // Validar selección de talla si tiene varias
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

  // Reset visual de inputs
  if (qtyInput) qtyInput.value = 1;
  card?.querySelectorAll('.color-swatch').forEach(b => {
    b.classList.remove('ring-2', 'ring-offset-1', 'ring-gold');
    b.removeAttribute('aria-pressed');
  });
  if (slotInput) slotInput.value = BASE_COMPARTIMIENTOS;
}

/**
 * Genera el HTML de una tarjeta de producto con soporte para Matriz de Tallas y Ficha Técnica.
 * @param {Object} p
 * @param {number} index
 * @returns {string}
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
             fade-up flex flex-col transition-all hover:shadow-lg"
      style="animation-delay:${index * 0.05}s"
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
            ` : ''}
          `;
        })()}

        <!-- Badge de Partida FORTAMUN -->
        <span class="absolute top-3 left-3 bg-navy/90 text-gold text-xs font-bold
                     font-display px-2.5 py-0.5 rounded-full tracking-wider z-10 border border-gold/30"
              title="Partida de catálogo">
          ${_escapeHTML(p.partida || 'PARTIDA')}
        </span>

        <!-- SKU / Folio -->
        <span class="absolute bottom-2 right-2 bg-black/50 text-white/80 text-xs
                     font-mono px-2 py-0.5 rounded"
              title="Folio o SKU interno">
          ${_escapeHTML(p.sku || p.id)}
        </span>
      </div>

      <!-- Datos del bien -->
      <div class="p-4 flex flex-col flex-1">
        <h3 class="font-display text-base font-bold text-navy tracking-wide leading-tight mb-1">
          ${_escapeHTML(p.name)}
        </h3>
        <p class="text-xs text-gray-500 leading-snug mb-3 flex-1 line-clamp-2">
          ${_escapeHTML(p.description)}
        </p>

        <!-- Precio + unidad de medida -->
        <div class="flex flex-col mb-3">
          <div class="flex items-baseline gap-1.5">
            <span class="price-display font-display text-2xl font-bold text-navy transition-all duration-200">
              ${formatMXN(p.price)}
            </span>
            <span class="text-xs text-gray-400 uppercase tracking-wide">
              / ${_escapeHTML(p.unit || 'PIEZA')}
            </span>
          </div>
          <span class="text-[10px] text-gold-dark font-bold uppercase tracking-widest mt-0.5">
            IVA Incluido (16%)
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

        <!-- Selector de Color (círculos) -->
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

        <!-- Compartimientos (solo Fornitura) -->
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

        <!-- Selector de Modo o Controles de Compra -->
        ${hasSizes ? `
          <!-- Selector Segmentado: Individual vs Lote -->
          <div class="mb-3 bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-display font-bold">
            <button
              type="button"
              class="tab-mode-btn flex-1 py-1.5 px-2 rounded-lg text-center transition-all bg-navy text-gold shadow-xs"
              data-target-mode="single"
              data-product-id="${_escapeAttr(p.id)}"
            >
              🔘 INDIVIDUAL
            </button>
            <button
              type="button"
              class="tab-mode-btn flex-1 py-1.5 px-2 rounded-lg text-center transition-all text-gray-500 hover:text-navy"
              data-target-mode="batch"
              data-product-id="${_escapeAttr(p.id)}"
            >
              📦 MATRIZ POR LOTE
            </button>
          </div>

          <!-- Panel Individual (Talla unitaria estándar) -->
          <div id="single-panel-${_escapeAttr(p.id)}" class="space-y-3">
            <div>
              <label for="size-${_escapeAttr(p.id)}"
                     class="block text-xs font-semibold text-gray-500 mb-1 tracking-wide">
                TALLA INDIVIDUAL:
              </label>
              <select
                id="size-${_escapeAttr(p.id)}"
                class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-navy
                       bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                       transition-colors"
              >
                <option value="">Seleccionar talla…</option>
                ${p.sizes.map(s => `<option value="${_escapeAttr(s)}">${_escapeHTML(s)}</option>`).join('')}
              </select>
            </div>

            <!-- Cantidad Unitaria -->
            <div class="flex items-center gap-2">
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

            <!-- Botón Añadir Individual -->
            <button
              type="button"
              class="btn-add-product bg-gold hover:bg-gold-hover text-navy font-display font-bold
                     w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2
                     shadow transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]
                     tracking-wide"
              data-product-id="${_escapeAttr(p.id)}"
              aria-label="Añadir ${_escapeAttr(p.name)} al pedido"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              AÑADIR A LA LISTA
            </button>
          </div>

          <!-- Panel Táctico de Lote (Matriz de Tallas) -->
          <div id="batch-panel-${_escapeAttr(p.id)}"
               class="hidden bg-gradient-to-br from-navy via-navy-light to-navy-border rounded-2xl p-3 border border-gold/40 shadow-xl text-white">
            
            <!-- Encabezado del panel -->
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <div class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span class="text-xs font-display font-bold text-gold tracking-wide uppercase">
                  Distribución por Lote
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn-expand-matrix text-[10px] text-slate-soft hover:text-gold flex items-center gap-0.5 transition-colors"
                  data-product-id="${_escapeAttr(p.id)}"
                  title="Abrir vista ampliada"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                  Ampliar
                </button>
                <button
                  type="button"
                  class="btn-clear-matrix text-[10px] text-slate-soft hover:text-red-400 transition-colors"
                  data-product-id="${_escapeAttr(p.id)}"
                  title="Restablecer cantidades a 0"
                >
                  ✕ Limpiar
                </button>
              </div>
            </div>

            <!-- Atajos rápidos de llenado -->
            <div class="flex items-center justify-between gap-1 mb-2.5 px-2 py-1 rounded-lg bg-navy/60 border border-white/5 text-[10px]">
              <span class="text-slate-soft font-semibold">Llenar lote:</span>
              <div class="flex items-center gap-1">
                <button type="button" class="btn-batch-fill px-2 py-0.5 rounded bg-navy-border hover:bg-gold hover:text-navy text-slate-light border border-white/10 font-bold transition-colors" data-amount="5" data-product-id="${_escapeAttr(p.id)}">+5 c/u</button>
                <button type="button" class="btn-batch-fill px-2 py-0.5 rounded bg-navy-border hover:bg-gold hover:text-navy text-slate-light border border-white/10 font-bold transition-colors" data-amount="10" data-product-id="${_escapeAttr(p.id)}">+10 c/u</button>
                <button type="button" class="btn-batch-fill px-2 py-0.5 rounded bg-navy-border hover:bg-gold hover:text-navy text-slate-light border border-white/10 font-bold transition-colors" data-amount="20" data-product-id="${_escapeAttr(p.id)}">+20 c/u</button>
              </div>
            </div>

            <!-- Rejilla de tallas -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${p.sizes.map(s => `
                <div class="matrix-tile bg-navy-light/90 border border-navy-border rounded-xl p-2 transition-all duration-200 text-center"
                     data-tile-size="${_escapeAttr(s)}"
                     data-product-id="${_escapeAttr(p.id)}">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="tile-size-badge text-xs font-display font-black text-white px-2 py-0.5 rounded-md bg-navy-border transition-colors">
                      ${_escapeHTML(s)}
                    </span>
                    <button
                      type="button"
                      class="matrix-quick-add text-[10px] font-bold text-slate-soft hover:text-gold hover:bg-navy px-1.5 py-0.5 rounded transition-colors"
                      data-delta="5"
                      data-size="${_escapeAttr(s)}"
                      data-product-id="${_escapeAttr(p.id)}"
                      title="Sumar 5 a talla ${_escapeAttr(s)}"
                    >+5</button>
                  </div>

                  <div class="flex items-center justify-between bg-navy/90 rounded-lg border border-navy-border overflow-hidden">
                    <button
                      type="button"
                      class="matrix-step-btn w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-soft hover:text-white hover:bg-navy-border transition-colors select-none"
                      data-delta="-1"
                      data-size="${_escapeAttr(s)}"
                      data-product-id="${_escapeAttr(p.id)}"
                      aria-label="Restar 1 a ${_escapeAttr(s)}"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value="0"
                      class="matrix-qty-input w-full text-center text-xs font-bold py-1 bg-transparent text-white focus:outline-none"
                      data-size="${_escapeAttr(s)}"
                      data-product-id="${_escapeAttr(p.id)}"
                      aria-label="Cantidad para talla ${_escapeAttr(s)}"
                    />
                    <button
                      type="button"
                      class="matrix-step-btn w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-soft hover:text-white hover:bg-navy-border transition-colors select-none"
                      data-delta="1"
                      data-size="${_escapeAttr(s)}"
                      data-product-id="${_escapeAttr(p.id)}"
                      aria-label="Sumar 1 a ${_escapeAttr(s)}"
                    >+</button>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Tally en vivo -->
            <div class="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <div>
                <span class="text-slate-soft text-[10px] uppercase font-bold tracking-wider">Total Lote:</span>
                <div class="font-display text-base font-black text-white">
                  <span class="matrix-total-qty-${_escapeAttr(p.id)}">0</span> <span class="text-[11px] font-normal text-slate-soft">pzas</span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-slate-soft text-[10px] uppercase font-bold tracking-wider">Subtotal:</span>
                <div class="font-display text-base font-black text-gold matrix-subtotal-${_escapeAttr(p.id)}">
                  ${formatMXN(0)}
                </div>
              </div>
            </div>

            <!-- Botón añadir lote -->
            <button
              type="button"
              class="btn-add-matrix mt-2.5 w-full bg-gold hover:bg-gold-hover text-navy text-xs font-display font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
              data-product-id="${_escapeAttr(p.id)}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              <span class="matrix-btn-label-${_escapeAttr(p.id)}">AÑADIR LOTE (0 PZAS)</span>
            </button>
          </div>
        ` : `
          <!-- Control de cantidad unitaria para accesorios sin tallas -->
          <div class="mb-3 flex items-center gap-2">
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

          <button
            type="button"
            class="btn-add-product bg-gold hover:bg-gold-hover text-navy font-display font-bold
                   w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2
                   shadow transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]
                   tracking-wide"
            data-product-id="${_escapeAttr(p.id)}"
            aria-label="Añadir ${_escapeAttr(p.name)} al pedido"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            AÑADIR A LA LISTA
          </button>
        `}

        <!-- ════════════════════════════════════════════════════
             BOTÓN DE FICHA TÉCNICA OFICIAL (Requisito 5 de Fase 3)
             ════════════════════════════════════════════════════ -->
        <button
          type="button"
          class="btn-open-tech-sheet w-full py-1.5 mt-2.5 text-xs font-medium text-slate-soft hover:text-navy hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-dashed border-gray-300"
          data-product-id="${_escapeAttr(p.id)}"
        >
          <svg class="w-3.5 h-3.5 text-gold-dark" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Ficha Técnica Oficial
        </button>
      </div>
    </article>
  `;
}

// ─── Modal de Ficha Técnica Oficial (Accesible con Trampa de Foco) ───

function _initTechModalListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = EL.techModal();
      if (modal && !modal.classList.contains('hidden')) {
        _closeTechSheetModal();
      }
      const matModal = EL.matrixModal();
      if (matModal && !matModal.classList.contains('hidden')) {
        _closeExpandedMatrixModal();
      }
    }
  });
}

function _openTechSheetModal(product) {
  const modal = EL.techModal();
  if (!modal) return;

  const tech = getTechSheetData(product);
  const colorOpts = getColorOptions(product.name);
  const hasMultipleImages = product.imageUrls && product.imageUrls.length > 1;

  modal.innerHTML = `
    <div class="bg-white max-w-4xl mx-auto rounded-2xl shadow-2xl overflow-hidden border border-gray-200 relative animate-in fade-in zoom-in-95 duration-150"
         id="tech-modal-card"
         role="document">

      <!-- Header del Modal -->
      <div class="bg-gradient-to-r from-navy via-navy-light to-navy-border px-6 py-4 flex items-center justify-between text-white border-b border-gold/20">
        <div class="flex items-center gap-3">
          <div class="bg-gold/15 p-2 rounded-xl text-gold">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h2 class="font-display text-xl font-bold text-gold tracking-wide uppercase leading-tight">
              FICHA TÉCNICA INSTITUCIONAL
            </h2>
            <p class="text-xs text-slate-soft">Suministros A. R. · Proveedor Homologado de Seguridad Pública</p>
          </div>
        </div>
        <button id="btn-close-tech-modal"
                class="text-slate-soft hover:text-gold p-2 rounded-lg transition-colors"
                aria-label="Cerrar ficha técnica">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Contenido en dos columnas -->
      <div class="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[80vh] overflow-y-auto">
        
        <!-- Columna Izquierda: Galería e Imagen (5 cols) -->
        <div class="md:col-span-5 flex flex-col gap-3">
          <div class="relative h-64 sm:h-72 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <img id="tech-modal-main-img"
                 src="${product.imageUrls && product.imageUrls[0] ? product.imageUrls[0] : ''}"
                 alt="${_escapeAttr(product.name)}"
                 class="w-full h-full object-cover"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-400 font-bold\\'>Imagen Institucional</div>'"/>
            <span class="absolute top-2 left-2 bg-navy text-gold text-xs font-bold px-2.5 py-0.5 rounded-full font-display border border-gold/20">
              ${_escapeHTML(product.partida || 'PARTIDA')}
            </span>
          </div>

          <!-- Thumbnails interactivos si hay múltiples fotos -->
          ${hasMultipleImages ? `
            <div class="flex gap-2 overflow-x-auto pb-1">
              ${product.imageUrls.map((url, idx) => `
                <button type="button"
                        class="tech-thumb-btn w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${idx === 0 ? 'border-gold' : 'border-gray-200 hover:border-gray-400'}"
                        data-img-src="${_escapeAttr(url)}">
                  <img src="${_escapeAttr(url)}" class="w-full h-full object-cover" alt="Vista miniatura ${idx+1}" />
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Bloque de Entrega y Garantía -->
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2 mt-2">
            <div class="flex items-center gap-2 text-xs font-bold text-navy">
              <svg class="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Tiempo de Entrega: 21 días hábiles</span>
            </div>
            <p class="text-[11px] text-gray-600 leading-relaxed">
              Producción sobre pedido con estricto control de calidad y trazabilidad por lote.
            </p>
            <div class="flex items-center gap-2 text-xs font-bold text-navy pt-1 border-t border-blue-100">
              <svg class="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>Garantía Institucional: 90 días naturales</span>
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Especificaciones y Formulario de Requisición (7 cols) -->
        <div class="md:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-baseline justify-between gap-2 border-b border-gray-200 pb-2 mb-3">
              <div>
                <h3 class="font-display text-2xl font-bold text-navy tracking-wide leading-tight">
                  ${_escapeHTML(product.name)}
                </h3>
                <span class="text-xs text-gray-400 font-mono">SKU: ${_escapeHTML(product.sku || product.id)}</span>
              </div>
              <div class="text-right">
                <span class="font-display text-2xl font-bold text-navy">
                  ${formatMXN(product.price)}
                </span>
                <span class="block text-[10px] text-gold-dark font-bold uppercase">IVA Incluido</span>
              </div>
            </div>

            <p class="text-xs text-gray-600 mb-4 leading-relaxed">
              ${_escapeHTML(product.description)}
            </p>

            <!-- Tabla de especificaciones técnicas -->
            <div class="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div class="bg-gray-100 px-3.5 py-1.5 border-b border-gray-200 text-xs font-bold text-navy font-display uppercase tracking-wider">
                Especificaciones de Confección y Materiales
              </div>
              <div class="divide-y divide-gray-200 text-xs">
                <div class="px-3.5 py-2 grid grid-cols-3 gap-2">
                  <span class="font-bold text-gray-500">Material / Tela:</span>
                  <span class="col-span-2 text-navy font-medium">${_escapeHTML(tech.material)}</span>
                </div>
                <div class="px-3.5 py-2 grid grid-cols-3 gap-2">
                  <span class="font-bold text-gray-500">Gramaje / Densidad:</span>
                  <span class="col-span-2 text-navy font-medium">${_escapeHTML(tech.gramaje)}</span>
                </div>
                <div class="px-3.5 py-2 grid grid-cols-3 gap-2">
                  <span class="font-bold text-gray-500">Confección:</span>
                  <span class="col-span-2 text-navy font-medium">${_escapeHTML(tech.confeccion)}</span>
                </div>
                <div class="px-3.5 py-2 grid grid-cols-3 gap-2">
                  <span class="font-bold text-gray-500">Uso Operativo:</span>
                  <span class="col-span-2 text-navy font-medium">${_escapeHTML(tech.uso)}</span>
                </div>
                <div class="px-3.5 py-2 grid grid-cols-3 gap-2">
                  <span class="font-bold text-gray-500">Normativa:</span>
                  <span class="col-span-2 text-navy font-medium">${_escapeHTML(tech.norma)}</span>
                </div>
              </div>
            </div>

            <!-- Tallas Disponibles -->
            <div class="mb-4">
              <span class="block text-xs font-bold text-gray-700 mb-1">Tallas Disponibles:</span>
              <div class="flex flex-wrap gap-1.5">
                ${product.sizes.map(s => `
                  <span class="text-xs bg-navy/10 text-navy font-bold px-2.5 py-1 rounded-md">
                    ${_escapeHTML(s)}
                  </span>
                `).join('')}
              </div>
            </div>

            <!-- Colores disponibles si aplica -->
            ${colorOpts ? `
              <div class="mb-4">
                <span class="block text-xs font-bold text-gray-700 mb-1">Colores Institucionales:</span>
                <div class="flex flex-wrap gap-2 items-center">
                  ${colorOpts.map(c => `
                    <div class="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                      <span class="w-3.5 h-3.5 rounded-full border border-gray-300" style="background-color: ${c.css}"></span>
                      <span class="text-xs font-semibold text-gray-700">${_escapeHTML(c.label)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Acciones del Modal -->
          <div class="pt-3 border-t border-gray-200 flex flex-wrap gap-3 items-center justify-end">
            <button id="btn-tech-modal-close"
                    class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              Cerrar Ficha
            </button>
            <button id="btn-tech-modal-scroll"
                    class="bg-navy hover:bg-navy-light text-gold text-xs font-display font-bold px-5 py-2.5 rounded-xl transition-all shadow flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Ver en Catálogo y Configurar Tallas
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Vincular cambio de thumbnails
  modal.querySelectorAll('.tech-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mainImg = document.getElementById('tech-modal-main-img');
      if (mainImg) mainImg.src = btn.dataset.imgSrc;
      modal.querySelectorAll('.tech-thumb-btn').forEach(b => b.classList.replace('border-gold', 'border-gray-200'));
      btn.classList.replace('border-gray-200', 'border-gold');
    });
  });

  // Cerrar modal
  const closeBtn = document.getElementById('btn-close-tech-modal');
  const footerCloseBtn = document.getElementById('btn-tech-modal-close');
  if (closeBtn) closeBtn.onclick = _closeTechSheetModal;
  if (footerCloseBtn) footerCloseBtn.onclick = _closeTechSheetModal;
  modal.onclick = (e) => {
    if (e.target === modal) _closeTechSheetModal();
  };

  // Botón para saltar directo a la tarjeta y configurar
  document.getElementById('btn-tech-modal-scroll')?.addEventListener('click', () => {
    _closeTechSheetModal();
    const card = document.querySelector(`[data-card-id="${product.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('ring-4', 'ring-gold/60');
      setTimeout(() => card.classList.remove('ring-4', 'ring-gold/60'), 2000);
    }
  });

  // Atrapar foco para accesibilidad (A11y)
  const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}

function _closeTechSheetModal() {
  const modal = EL.techModal();
  if (!modal) return;
  modal.classList.add('hidden');
  modal.innerHTML = '';
  document.body.style.overflow = '';
  if (_lastFocusedElement) {
    _lastFocusedElement.focus();
    _lastFocusedElement = null;
  }
}

// ─── Modal de Matriz de Tallas Ampliada (Pantalla Completa) ───

function _openExpandedMatrixModal(product) {
  const modal = EL.matrixModal();
  if (!modal) return;

  const colorOpts = getColorOptions(product.name);

  modal.innerHTML = `
    <div class="bg-navy max-w-2xl mx-auto rounded-2xl shadow-2xl overflow-hidden border border-gold/40 text-white relative animate-in fade-in zoom-in-95 duration-150"
         role="document">

      <!-- Header del Modal -->
      <div class="bg-gradient-to-r from-navy via-navy-light to-navy-border px-6 py-4 flex items-center justify-between border-b border-gold/20">
        <div class="flex items-center gap-3">
          <div class="bg-gold/20 p-2.5 rounded-xl text-gold">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div>
            <h2 class="font-display text-xl font-bold text-gold tracking-wide uppercase leading-tight">
              MATRIZ TÁCTICA EXPANDIDA
            </h2>
            <p class="text-xs text-slate-soft">${_escapeHTML(product.name)} · Asignación por Tallas</p>
          </div>
        </div>
        <button id="btn-close-expanded-matrix"
                class="text-slate-soft hover:text-gold p-2 rounded-lg transition-colors"
                aria-label="Cerrar matriz ampliada">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Cuerpo del Modal -->
      <div class="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <!-- Barra de producto: Precio, SKU y Selector de color -->
        <div class="bg-navy-light/90 border border-navy-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs text-slate-soft font-mono">SKU: ${_escapeHTML(product.sku || product.id)}</span>
            <div class="font-display text-xl font-bold text-white">
              ${formatMXN(product.price)} <span class="text-xs text-gold font-normal">IVA Incluido</span>
            </div>
          </div>

          ${colorOpts ? `
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-soft font-semibold">Color:</span>
              <div class="modal-color-area flex gap-1.5">
                ${colorOpts.map(c => `
                  <button
                    type="button"
                    class="modal-color-swatch w-7 h-7 rounded-full border-2 shadow transition-transform hover:scale-110"
                    style="background-color: ${c.css}"
                    data-color-label="${_escapeAttr(c.label)}"
                    title="${_escapeAttr(c.label)}"
                    aria-pressed="false"
                  ></button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Atajos de Llenado Rápido -->
        <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-navy-light/60 border border-white/5 text-xs">
          <span class="text-slate-soft font-semibold">Llenado masivo por escuadra:</span>
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn-modal-fill px-2.5 py-1 rounded-lg bg-navy-border hover:bg-gold hover:text-navy text-slate-light font-bold text-xs transition-colors" data-amount="5">+5 a c/u</button>
            <button type="button" class="btn-modal-fill px-2.5 py-1 rounded-lg bg-navy-border hover:bg-gold hover:text-navy text-slate-light font-bold text-xs transition-colors" data-amount="10">+10 a c/u</button>
            <button type="button" class="btn-modal-fill px-2.5 py-1 rounded-lg bg-navy-border hover:bg-gold hover:text-navy text-slate-light font-bold text-xs transition-colors" data-amount="20">+20 a c/u</button>
            <button type="button" class="btn-modal-reset px-2.5 py-1 rounded-lg text-slate-soft hover:text-red-400 font-semibold text-xs transition-colors">Limpiar</button>
          </div>
        </div>

        <!-- Rejilla de Tallas táctica ampliada -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          ${product.sizes.map(s => `
            <div class="modal-tile bg-navy-light border border-navy-border rounded-xl p-3 text-center transition-all duration-200"
                 data-size="${_escapeAttr(s)}">
              <div class="flex items-center justify-between mb-2">
                <span class="modal-tile-badge text-sm font-display font-black text-white px-2.5 py-0.5 rounded-md bg-navy-border">
                  ${_escapeHTML(s)}
                </span>
                <button
                  type="button"
                  class="btn-modal-quick-add text-xs font-bold text-slate-soft hover:text-gold hover:bg-navy px-1.5 py-0.5 rounded transition-colors"
                  data-size="${_escapeAttr(s)}"
                  data-delta="5"
                >+5</button>
              </div>

              <div class="flex items-center justify-between bg-navy rounded-lg border border-navy-border overflow-hidden">
                <button
                  type="button"
                  class="btn-modal-step w-8 h-8 flex items-center justify-center text-sm font-bold text-slate-soft hover:text-white hover:bg-navy-border transition-colors select-none"
                  data-size="${_escapeAttr(s)}"
                  data-delta="-1"
                >−</button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value="0"
                  class="modal-qty-input w-full text-center text-sm font-bold py-1 bg-transparent text-white focus:outline-none"
                  data-size="${_escapeAttr(s)}"
                />
                <button
                  type="button"
                  class="btn-modal-step w-8 h-8 flex items-center justify-center text-sm font-bold text-slate-soft hover:text-white hover:bg-navy-border transition-colors select-none"
                  data-size="${_escapeAttr(s)}"
                  data-delta="1"
                >+</button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Resumen de totales -->
        <div class="bg-gradient-to-r from-navy-light to-navy-border p-4 rounded-xl border border-gold/30 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-soft uppercase font-bold tracking-wider">Total Piezas:</span>
            <div class="font-display text-2xl font-black text-white">
              <span id="modal-matrix-total-qty">0</span> <span class="text-sm font-normal text-slate-soft">piezas</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-soft uppercase font-bold tracking-wider">Subtotal Lote:</span>
            <div class="font-display text-2xl font-black text-gold" id="modal-matrix-subtotal">
              ${formatMXN(0)}
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="pt-2 flex items-center justify-end gap-3">
          <button id="btn-modal-cancel-matrix"
                  class="px-4 py-2.5 text-xs font-semibold text-slate-soft hover:text-white transition-colors">
            Cancelar
          </button>
          <button id="btn-modal-submit-matrix"
                  class="bg-gold hover:bg-gold-hover text-navy text-xs font-display font-black px-6 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            <span id="modal-submit-label">AÑADIR LOTE (0 PZAS) AL PEDIDO</span>
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Leer estado existente de la tarjeta si ya tenía cantidades
  const card = document.querySelector(`[data-card-id="${product.id}"]`);
  let selectedColor = '';
  if (card) {
    const cardColor = card.querySelector('.color-swatch[aria-pressed="true"]');
    if (cardColor) {
      selectedColor = cardColor.dataset.colorLabel || '';
      const modalSwatch = modal.querySelector(`.modal-color-swatch[data-color-label="${selectedColor}"]`);
      if (modalSwatch) {
        modalSwatch.classList.add('ring-2', 'ring-gold', 'ring-offset-1');
        modalSwatch.setAttribute('aria-pressed', 'true');
      }
    }

    // Copiar cantidades de la tarjeta a la ventana modal
    const cardInputs = card.querySelectorAll(`.matrix-qty-input[data-product-id="${product.id}"]`);
    cardInputs.forEach(ci => {
      const s = ci.dataset.size;
      const v = parseInt(ci.value, 10) || 0;
      if (v > 0) {
        const mi = modal.querySelector(`.modal-qty-input[data-size="${s}"]`);
        if (mi) mi.value = v;
      }
    });
  }

  // Función de recalcular dentro del modal
  function _recalcModal() {
    let tot = 0;
    modal.querySelectorAll('.modal-qty-input').forEach(inp => {
      const v = parseInt(inp.value, 10);
      const tile = inp.closest('.modal-tile');
      if (!isNaN(v) && v > 0) {
        tot += v;
        if (tile) {
          tile.classList.add('ring-2', 'ring-gold', 'border-gold', 'bg-[#1E3A5F]', 'shadow-[0_0_12px_rgba(255,215,0,0.25)]');
          tile.classList.remove('border-navy-border');
          const badge = tile.querySelector('.modal-tile-badge');
          if (badge) {
            badge.classList.add('bg-gold', 'text-navy');
            badge.classList.remove('bg-navy-border', 'text-white');
          }
          inp.classList.add('text-gold', 'font-black');
          inp.classList.remove('text-white');
        }
      } else {
        if (tile) {
          tile.classList.remove('ring-2', 'ring-gold', 'border-gold', 'bg-[#1E3A5F]', 'shadow-[0_0_12px_rgba(255,215,0,0.25)]');
          tile.classList.add('border-navy-border');
          const badge = tile.querySelector('.modal-tile-badge');
          if (badge) {
            badge.classList.remove('bg-gold', 'text-navy');
            badge.classList.add('bg-navy-border', 'text-white');
          }
          inp.classList.remove('text-gold', 'font-black');
          inp.classList.add('text-white');
        }
      }
    });

    const sub = tot * product.price;
    const qEl = document.getElementById('modal-matrix-total-qty');
    const sEl = document.getElementById('modal-matrix-subtotal');
    const bEl = document.getElementById('modal-submit-label');
    if (qEl) qEl.textContent = String(tot);
    if (sEl) sEl.textContent = formatMXN(sub);
    if (bEl) bEl.textContent = tot > 0 ? `AÑADIR LOTE (${tot} PZAS) AL PEDIDO` : 'AÑADIR LOTE (0 PZAS) AL PEDIDO';
  }

  _recalcModal();

  // Color picker en el modal
  modal.querySelectorAll('.modal-color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      modal.querySelectorAll('.modal-color-swatch').forEach(b => {
        b.classList.remove('ring-2', 'ring-gold', 'ring-offset-1');
        b.removeAttribute('aria-pressed');
      });
      sw.classList.add('ring-2', 'ring-gold', 'ring-offset-1');
      sw.setAttribute('aria-pressed', 'true');
      selectedColor = sw.dataset.colorLabel || '';

      // Sincronizar con la tarjeta
      if (card) {
        card.querySelectorAll('.color-swatch').forEach(cb => {
          if (cb.dataset.colorLabel === selectedColor) {
            cb.classList.add('ring-2', 'ring-offset-1', 'ring-gold');
            cb.setAttribute('aria-pressed', 'true');
          } else {
            cb.classList.remove('ring-2', 'ring-offset-1', 'ring-gold');
            cb.removeAttribute('aria-pressed');
          }
        });
      }
    });
  });

  // Steppers del modal
  modal.querySelectorAll('.btn-modal-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta, 10) || 0;
      const size = btn.dataset.size;
      const inp = modal.querySelector(`.modal-qty-input[data-size="${size}"]`);
      if (inp) {
        const cur = parseInt(inp.value, 10) || 0;
        inp.value = Math.max(0, Math.min(999, cur + delta));
        _recalcModal();
      }
    });
  });

  // +5 rápido por talla
  modal.querySelectorAll('.btn-modal-quick-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta, 10) || 5;
      const size = btn.dataset.size;
      const inp = modal.querySelector(`.modal-qty-input[data-size="${size}"]`);
      if (inp) {
        const cur = parseInt(inp.value, 10) || 0;
        inp.value = Math.max(0, Math.min(999, cur + delta));
        _recalcModal();
      }
    });
  });

  // Llenado masivo
  modal.querySelectorAll('.btn-modal-fill').forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = parseInt(btn.dataset.amount, 10) || 5;
      modal.querySelectorAll('.modal-qty-input').forEach(inp => {
        const cur = parseInt(inp.value, 10) || 0;
        inp.value = Math.max(0, Math.min(999, cur + amt));
      });
      _recalcModal();
    });
  });

  // Reset
  document.querySelector('.btn-modal-reset')?.addEventListener('click', () => {
    modal.querySelectorAll('.modal-qty-input').forEach(inp => { inp.value = 0; });
    _recalcModal();
  });

  // Inputs directos
  modal.querySelectorAll('.modal-qty-input').forEach(inp => {
    inp.addEventListener('input', _recalcModal);
  });

  // Enviar lote desde el modal
  document.getElementById('btn-modal-submit-matrix')?.addEventListener('click', () => {
    if (colorOpts && !selectedColor) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⚠ Selecciona un color institucional antes de añadir el lote' } }));
      return;
    }

    const batches = [];
    let totalAdded = 0;
    modal.querySelectorAll('.modal-qty-input').forEach(inp => {
      const q = parseInt(inp.value, 10);
      if (!isNaN(q) && q > 0) {
        batches.push({ size: inp.dataset.size, qty: q });
        totalAdded += q;
      }
    });

    if (batches.length === 0) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⚠ Ingresa al menos una pieza en la matriz' } }));
      return;
    }

    // Disparar eventos
    batches.forEach(b => {
      document.dispatchEvent(new CustomEvent('product:add', {
        detail: {
          product,
          size: b.size,
          qty: b.qty,
          variant: null,
          customPrice: product.price,
          color: selectedColor,
          slotInfo: ''
        }
      }));
    });

    // Limpiar tarjeta e inputs
    if (card) {
      card.querySelectorAll(`.matrix-qty-input[data-product-id="${product.id}"]`).forEach(ci => { ci.value = 0; });
      _recalculateMatrixCard(product.id);
    }

    _closeExpandedMatrixModal();
    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: `✓ Lote agregado: ${totalAdded} piezas (${product.name})` }
    }));
  });

  // Cerrar
  document.getElementById('btn-close-expanded-matrix')?.addEventListener('click', _closeExpandedMatrixModal);
  document.getElementById('btn-modal-cancel-matrix')?.addEventListener('click', _closeExpandedMatrixModal);
  modal.onclick = (e) => {
    if (e.target === modal) _closeExpandedMatrixModal();
  };

  const firstFocusable = modal.querySelector('button, input');
  if (firstFocusable) firstFocusable.focus();
}

function _closeExpandedMatrixModal() {
  const modal = EL.matrixModal();
  if (!modal) return;
  modal.classList.add('hidden');
  modal.innerHTML = '';
  document.body.style.overflow = '';
  if (_lastFocusedElement) {
    _lastFocusedElement.focus();
    _lastFocusedElement = null;
  }
}

// ─── Helpers privados ──────────────────────────────────────────

function _placeholderSVG(p) {
  const label = p.name ? p.name.split(' ').slice(0, 2).join('\n') : 'PRODUCTO';
  return `
    <div class="img-placeholder w-full h-full flex items-center justify-center bg-navy/80">
      <span class="text-white/60 font-display font-bold text-lg leading-tight
                   text-center whitespace-pre-line tracking-wider">
        ${_escapeHTML(label)}
      </span>
    </div>
  `;
}

function _markInvalid(el, toastMsg) {
  if (el) {
    el.classList.add('border-red-400', 'ring-2', 'ring-red-200');
    el.focus();
    setTimeout(() => el.classList.remove('border-red-400', 'ring-2', 'ring-red-200'), 2500);
  }
  document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: `⚠ ${toastMsg}` } }));
}

function _escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _hideLoading() {
  EL.loading()?.classList.add('hidden');
}
