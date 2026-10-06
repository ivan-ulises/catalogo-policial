/**
 * @file admin/products.js
 * @description Módulo de gestión del catálogo maestro (CRUD) para administradores.
 */

import { EVT } from './events.js';
import { getSupabase } from './auth.js';

let _products = [];
let _editingProduct = null;

export function initProductsModule() {
  document.addEventListener(EVT.PRODUCTS_LOAD_REQUEST, () => loadProducts());
  document.addEventListener(EVT.PRODUCT_SAVE, (e) => saveProduct(e.detail.productData));
  document.addEventListener(EVT.PRODUCT_DELETE, (e) => deleteProduct(e.detail.id_producto));
  document.addEventListener(EVT.PRODUCT_EDIT_REQUEST, (e) => openProductModal(e.detail.product));
}

/**
 * Consulta la lista completa de productos en Supabase
 */
export async function loadProducts() {
  const sb = getSupabase();
  const container = document.getElementById('products-table-container');
  if (container) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <svg class="w-8 h-8 mx-auto animate-spin mb-3 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <p>Cargando catálogo...</p>
      </div>`;
  }

  try {
    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('nombre_bien', { ascending: true });

    if (error) throw error;
    _products = data || [];
    renderProductsTable(_products);

    document.dispatchEvent(new CustomEvent(EVT.PRODUCTS_LOADED, {
      detail: { products: _products }
    }));
  } catch (err) {
    console.error('[loadProducts error]', err);
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <p class="font-bold">Error al cargar productos</p>
          <p class="text-xs opacity-80">${err.message}</p>
        </div>`;
    }
  }
}

/**
 * Renderizado de la tabla de productos
 */
export function renderProductsTable(products) {
  const container = document.getElementById('products-table-container');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <p class="text-lg font-bold text-slate-300 mb-1">Catálogo vacío</p>
        <p class="text-sm">Agrega tu primer producto haciendo clic en "Nuevo Producto".</p>
      </div>`;
    return;
  }

  const rows = products.map(p => {
    const priceFormatted = '$' + Number(p.precio_unitario || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const isActive = p.active !== false;

    return `
      <tr class="hover:bg-slate-800/40 border-b border-slate-800/80 transition-colors">
        <td class="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
          ${p.id_producto}
        </td>
        <td class="px-4 py-3 font-medium text-slate-100">
          <div class="font-bold">${p.nombre_bien}</div>
          <div class="text-xs text-slate-400 truncate max-w-xs">${p.descripcion || 'Sin descripción'}</div>
        </td>
        <td class="px-4 py-3 text-xs font-mono text-[#FFD700]">
          ${p.partida_fortamun || 'General'}
        </td>
        <td class="px-4 py-3 text-center text-xs text-slate-300">
          ${p.unidad_medida || 'PZA'}
        </td>
        <td class="px-4 py-3 text-center text-xs text-slate-300 max-w-xs truncate" title="${p.tallas_disponibles || 'Unitalla'}">
          ${p.tallas_disponibles || 'Unitalla'}
        </td>
        <td class="px-4 py-3 text-right font-mono font-bold text-slate-100 text-sm whitespace-nowrap">
          ${priceFormatted}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}">
            ${isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
          <button class="btn-edit-prod px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors" data-id="${p.id_producto}">
            Editar
          </button>
          <button class="btn-del-prod px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-xs font-semibold text-red-400 rounded-lg border border-red-800/40 transition-colors" data-id="${p.id_producto}">
            Eliminar
          </button>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 font-bold">
            <th class="px-4 py-3">ID / SKU</th>
            <th class="px-4 py-3">Nombre / Ficha Técnica</th>
            <th class="px-4 py-3">Partida</th>
            <th class="px-4 py-3 text-center">Unidad</th>
            <th class="px-4 py-3 text-center">Tallas</th>
            <th class="px-4 py-3 text-right">Precio Unitario</th>
            <th class="px-4 py-3 text-center">Estatus</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Listeners de edición y eliminación
  container.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = products.find(prod => prod.id_producto === btn.dataset.id);
      if (p) openProductModal(p);
    });
  });

  container.querySelectorAll('.btn-del-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`¿Estás seguro de eliminar el producto "${btn.dataset.id}"? Esta acción no se puede deshacer.`)) {
        deleteProduct(btn.dataset.id);
      }
    });
  });
}

/**
 * Abre el modal para crear o editar un producto
 */
export function openProductModal(product = null) {
  _editingProduct = product;
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  if (!modal) return;

  if (title) title.textContent = product ? `Editar Producto: ${product.id_producto}` : 'Nuevo Producto';

  document.getElementById('input-prod-id').value = product?.id_producto || '';
  document.getElementById('input-prod-id').disabled = !!product; // ID no editable una vez creado
  document.getElementById('input-prod-nombre').value = product?.nombre_bien || '';
  document.getElementById('input-prod-desc').value = product?.descripcion || '';
  document.getElementById('input-prod-partida').value = product?.partida_fortamun || '';
  document.getElementById('input-prod-unidad').value = product?.unidad_medida || 'PZA';
  document.getElementById('input-prod-precio').value = product?.precio_unitario || '';
  document.getElementById('input-prod-tallas').value = product?.tallas_disponibles || 'Unitalla';
  document.getElementById('input-prod-imagen').value = product?.imagen_url || '';
  document.getElementById('input-prod-active').checked = product ? product.active !== false : true;

  modal.classList.remove('hidden');
}

/**
 * Guarda o actualiza un producto en Supabase con validaciones
 */
export async function saveProduct(productData) {
  const sb = getSupabase();

  // Validaciones
  if (!productData.id_producto || productData.id_producto.trim().length < 2) {
    alert('El ID o SKU del producto es obligatorio.');
    return;
  }
  if (!productData.nombre_bien || productData.nombre_bien.trim().length < 3) {
    alert('El nombre del bien es obligatorio (mínimo 3 caracteres).');
    return;
  }
  const precio = parseFloat(productData.precio_unitario);
  if (isNaN(precio) || precio <= 0) {
    alert('El precio unitario debe ser un número positivo.');
    return;
  }

  try {
    const payload = {
      id_producto: productData.id_producto.trim(),
      nombre_bien: productData.nombre_bien.trim(),
      descripcion: productData.descripcion?.trim() || '',
      partida_fortamun: productData.partida_fortamun?.trim() || 'General',
      unidad_medida: productData.unidad_medida?.trim() || 'PZA',
      precio_unitario: precio,
      tallas_disponibles: productData.tallas_disponibles?.trim() || 'Unitalla',
      imagen_url: productData.imagen_url?.trim() || '',
      active: !!productData.active,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb
      .from('products')
      .upsert(payload, { onConflict: 'id_producto' });

    if (error) throw error;

    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `✓ Producto "${payload.nombre_bien}" guardado con éxito`, type: 'success' }
    }));

    document.getElementById('product-modal')?.classList.add('hidden');
    await loadProducts();
  } catch (err) {
    console.error('[saveProduct error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al guardar producto: ${err.message}`, type: 'error' }
    }));
  }
}

/**
 * Elimina un producto de la base de datos
 */
export async function deleteProduct(id_producto) {
  const sb = getSupabase();
  try {
    const { error } = await sb
      .from('products')
      .delete()
      .eq('id_producto', id_producto);

    if (error) throw error;

    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `✓ Producto "${id_producto}" eliminado`, type: 'success' }
    }));

    await loadProducts();
  } catch (err) {
    console.error('[deleteProduct error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al eliminar producto: ${err.message}`, type: 'error' }
    }));
  }
}
