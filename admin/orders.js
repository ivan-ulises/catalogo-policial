/**
 * @file admin/orders.js
 * @description Módulo de gestión y visualización de órdenes para el panel administrativo.
 */

import { EVT } from './events.js';
import { getSupabase } from './auth.js';

let _orders = [];
let _currentFilter = {
  search: '',
  status: 'todos',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 10
};
let _selectedOrder = null;

export function initOrdersModule() {
  document.addEventListener(EVT.ORDERS_LOAD_REQUEST, () => loadOrders());
  document.addEventListener(EVT.ORDER_SELECT, (e) => showOrderDetail(e.detail.orderId));
  document.addEventListener(EVT.ORDER_STATUS_UPDATE, (e) => updateOrderStatus(e.detail.orderId, e.detail.newStatus));
  document.addEventListener(EVT.ORDER_NOTE_UPDATE, (e) => updateOrderNote(e.detail.orderId, e.detail.note));
  document.addEventListener(EVT.ORDER_RESEND_EMAIL, (e) => resendOrderEmail(e.detail.orderId, e.detail.customEmail));
  document.addEventListener(EVT.ORDER_DOWNLOAD_PDF, (e) => downloadOrderPDF(e.detail.orderId));
  document.addEventListener(EVT.ORDER_EXPORT_CSV, () => exportOrdersToCSV());
}

/**
 * Consulta las órdenes en Supabase con filtros y paginación
 */
export async function loadOrders() {
  const sb = getSupabase();
  const container = document.getElementById('orders-table-container');
  if (container) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <svg class="w-8 h-8 mx-auto animate-spin mb-3 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <p>Cargando requisiciones...</p>
      </div>`;
  }

  try {
    let query = sb.from('orders').select('*', { count: 'exact' });

    if (_currentFilter.status && _currentFilter.status !== 'todos') {
      query = query.eq('status', _currentFilter.status);
    }

    if (_currentFilter.search && _currentFilter.search.trim()) {
      const term = `%${_currentFilter.search.trim()}%`;
      query = query.or(`folio.ilike.${term},municipio.ilike.${term}`);
    }

    if (_currentFilter.dateFrom) {
      query = query.gte('fecha', _currentFilter.dateFrom + 'T00:00:00Z');
    }
    if (_currentFilter.dateTo) {
      query = query.lte('fecha', _currentFilter.dateTo + 'T23:59:59Z');
    }

    // Paginación
    const from = (_currentFilter.page - 1) * _currentFilter.pageSize;
    const to = from + _currentFilter.pageSize - 1;

    const { data, count, error } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) throw error;

    _orders = data || [];
    renderOrdersTable(_orders, count || 0);

    document.dispatchEvent(new CustomEvent(EVT.ORDERS_LOADED, {
      detail: { orders: _orders, totalCount: count }
    }));
  } catch (err) {
    console.error('[loadOrders error]', err);
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <p class="font-bold mb-1">Error al cargar las requisiciones</p>
          <p class="text-xs opacity-80">${err.message}</p>
        </div>`;
    }
  }
}

/**
 * Renderizado de la tabla de órdenes en el DOM
 */
export function renderOrdersTable(orders, totalCount) {
  const container = document.getElementById('orders-table-container');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <p class="text-lg font-bold text-slate-300 mb-1">No se encontraron requisiciones</p>
        <p class="text-sm">Prueba ajustando los filtros de búsqueda o fecha.</p>
      </div>`;
    return;
  }

  const statusBadges = {
    'nueva': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'pendiente': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'en revisión': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'en_proceso': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'cotizada': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'aprobada': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'rechazada': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    'entregada': 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  };

  const rows = orders.map(ord => {
    const badgeClass = statusBadges[ord.status] || 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    const fechaFormatted = ord.fecha ? new Date(ord.fecha).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';
    const totalFormatted = '$' + Number(ord.total_mxn || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

    return `
      <tr class="hover:bg-slate-800/40 border-b border-slate-800/80 transition-colors cursor-pointer group" data-order-id="${ord.id}">
        <td class="px-4 py-3 font-mono font-bold text-[#FFD700] text-sm whitespace-nowrap">
          ${ord.folio}
        </td>
        <td class="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">
          ${fechaFormatted}
        </td>
        <td class="px-4 py-3 font-medium text-slate-100 max-w-xs truncate" title="${ord.municipio}">
          ${ord.municipio}
        </td>
        <td class="px-4 py-3 text-center text-xs text-slate-300">
          ${ord.total_piezas || 0} pzas
        </td>
        <td class="px-4 py-3 text-right font-mono font-bold text-slate-100 text-sm whitespace-nowrap">
          ${totalFormatted}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}">
            ${ord.status || 'pendiente'}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          <button class="btn-detail px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors" data-order-id="${ord.id}">
            Ver Detalle
          </button>
        </td>
      </tr>`;
  }).join('');

  const totalPages = Math.ceil(totalCount / _currentFilter.pageSize) || 1;

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 font-bold">
            <th class="px-4 py-3">Folio</th>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Municipio / Dependencia</th>
            <th class="px-4 py-3 text-center">Piezas</th>
            <th class="px-4 py-3 text-right">Total MXN</th>
            <th class="px-4 py-3 text-center">Estatus</th>
            <th class="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    
    <!-- Paginación -->
    <div class="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
      <div>Mostrando <strong>${orders.length}</strong> de <strong>${totalCount}</strong> requisiciones</div>
      <div class="flex items-center gap-2">
        <button id="btn-page-prev" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" ${_currentFilter.page <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <span>Página <strong>${_currentFilter.page}</strong> de <strong>${totalPages}</strong></span>
        <button id="btn-page-next" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" ${_currentFilter.page >= totalPages ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    </div>`;

  // Listeners de clics en filas y paginación
  container.querySelectorAll('[data-order-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      const orderId = el.dataset.orderId || el.closest('[data-order-id]')?.dataset.orderId;
      if (orderId) showOrderDetail(orderId);
    });
  });

  document.getElementById('btn-page-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_currentFilter.page > 1) {
      _currentFilter.page--;
      loadOrders();
    }
  });

  document.getElementById('btn-page-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_currentFilter.page < totalPages) {
      _currentFilter.page++;
      loadOrders();
    }
  });
}

/**
 * Muestra el modal con el detalle completo de la orden, partidas, bitácora y acciones
 */
export async function showOrderDetail(orderId) {
  const sb = getSupabase();
  const modal = document.getElementById('order-detail-modal');
  const content = document.getElementById('order-detail-content');
  if (!modal || !content) return;

  modal.classList.remove('hidden');
  content.innerHTML = `
    <div class="p-12 text-center text-slate-400">
      <svg class="w-8 h-8 mx-auto animate-spin mb-3 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <p>Cargando detalle de la orden...</p>
    </div>`;

  try {
    const { data: order, error } = await sb
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    _selectedOrder = order;

    // Obtener logs de auditoría para este pedido
    const { data: auditLogs } = await sb
      .from('order_audit_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    renderOrderDetailView(order, auditLogs || []);
  } catch (err) {
    console.error('[showOrderDetail error]', err);
    content.innerHTML = `
      <div class="p-8 text-center text-red-400">
        <p class="font-bold">Error al cargar la orden</p>
        <p class="text-xs opacity-80">${err.message}</p>
      </div>`;
  }
}

function renderOrderDetailView(order, auditLogs) {
  const content = document.getElementById('order-detail-content');
  if (!content) return;

  const items = Array.isArray(order.items_snapshot) && order.items_snapshot.length > 0
    ? order.items_snapshot
    : (order.detalles_pedido ? order.detalles_pedido.split(' | ').map(d => ({ nombre: d, cantidad: 1, precio_unitario: 0, subtotal: 0 })) : []);

  const itemsRows = items.map(it => {
    const pUnit = '$' + Number(it.precio_unitario || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const sub = '$' + Number(it.subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
    return `
      <tr class="border-b border-slate-800 text-xs">
        <td class="py-2.5 font-medium text-slate-200">
          ${it.nombre || 'Producto'}
          ${it.talla ? `<span class="text-slate-400">(${it.talla})</span>` : ''}
          ${it.color ? `<span class="text-slate-400">· ${it.color}</span>` : ''}
        </td>
        <td class="py-2.5 text-center font-bold text-slate-100">${it.cantidad || 1}</td>
        <td class="py-2.5 text-right font-mono text-slate-300">${pUnit}</td>
        <td class="py-2.5 text-right font-mono font-bold text-slate-100">${sub}</td>
      </tr>`;
  }).join('');

  const auditRows = auditLogs.map(l => {
    const f = new Date(l.created_at).toLocaleString('es-MX');
    return `
      <li class="mb-2 text-xs text-slate-400">
        <span class="text-slate-200 font-semibold">${f}</span>: 
        <span class="text-[#FFD700]">${l.action}</span> por <em>${l.user_email || 'Sistema'}</em>
      </li>`;
  }).join('');

  const statusOptions = ['nueva', 'en revisión', 'cotizada', 'aprobada', 'rechazada', 'entregada', 'pendiente', 'en_proceso']
    .map(st => `<option value="${st}" ${order.status === st ? 'selected' : ''}>${st.toUpperCase()}</option>`)
    .join('');

  content.innerHTML = `
    <!-- Header del Detalle -->
    <div class="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-bold font-mono text-[#FFD700]">${order.folio}</h2>
          <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-200 border border-slate-700">
            ${order.status || 'pendiente'}
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Registrado el ${new Date(order.fecha).toLocaleString('es-MX')}</p>
      </div>

      <div class="flex items-center gap-2">
        <button id="btn-download-order-pdf" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors">
          <span>📄</span> Descargar PDF
        </button>
        <button id="btn-resend-order-email" class="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-xs font-semibold text-blue-400 rounded-lg border border-blue-500/40 flex items-center gap-1.5 transition-colors">
          <span>✉</span> Reenviar Correo
        </button>
      </div>
    </div>

    <!-- Info del Municipio -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
      <div>
        <span class="text-slate-400 font-bold block mb-1">MUNICIPIO / AGENCIA SOLICITANTE</span>
        <span class="text-sm font-semibold text-slate-100">${order.municipio}</span>
      </div>
      <div>
        <span class="text-slate-400 font-bold block mb-1">ESTADO DE ENVÍO DE CORREO</span>
        <span class="font-mono ${order.email_status === 'sent' ? 'text-emerald-400' : 'text-amber-400'}">
          ${order.email_status || 'desconocido'}
        </span>
        ${order.email_error ? `<span class="block text-red-400 text-[10px] mt-0.5 truncate">${order.email_error}</span>` : ''}
      </div>
    </div>

    <!-- Tabla de Partidas -->
    <div class="my-4">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Partidas Cotizadas</h3>
      <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table class="w-full text-left border-collapse px-4">
          <thead>
            <tr class="bg-slate-900 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
              <th class="py-2 px-3">Producto / Especificación</th>
              <th class="py-2 px-3 text-center">Cant.</th>
              <th class="py-2 px-3 text-right">Precio U.</th>
              <th class="py-2 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody class="px-3">${itemsRows}</tbody>
        </table>
      </div>

      <!-- Resumen Financiero -->
      <div class="flex justify-end mt-3 text-xs">
        <div class="w-64 space-y-1.5 text-right font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div class="flex justify-between text-slate-400">
            <span>Subtotal s/IVA:</span>
            <span>$${Number(order.subtotal_mxn || (order.total_mxn / 1.16)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>IVA (16%):</span>
            <span>$${Number(order.iva_mxn || (order.total_mxn - (order.total_mxn / 1.16))).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="flex justify-between text-sm font-bold text-[#FFD700] pt-1.5 border-t border-slate-800">
            <span>TOTAL:</span>
            <span>$${Number(order.total_mxn || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cambio de Estatus y Notas Internas -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
      <div>
        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Actualizar Estatus</label>
        <div class="flex gap-2">
          <select id="select-change-status" class="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-[#FFD700] w-full">
            ${statusOptions}
          </select>
          <button id="btn-save-status" class="px-3 py-1.5 bg-[#FFD700] hover:bg-[#FFC200] text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap">
            Guardar
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Notas Internas</label>
        <textarea id="textarea-internal-notes" rows="2" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-[#FFD700] placeholder-slate-500" placeholder="Escribe notas operativas o de seguimiento...">${order.internal_notes || ''}</textarea>
        <div class="text-right mt-1">
          <button id="btn-save-notes" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition-colors">
            Guardar Nota
          </button>
        </div>
      </div>
    </div>

    <!-- Bitácora de Cambios (Audit Log) -->
    <div class="mt-6 pt-4 border-t border-slate-800">
      <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">Bitácora de Seguimiento</h4>
      ${auditLogs.length > 0 ? `<ul class="list-disc list-inside max-h-32 overflow-y-auto">${auditRows}</ul>` : '<p class="text-xs text-slate-500">Sin cambios registrados aún.</p>'}
    </div>`;

  // Listeners de acciones del detalle
  document.getElementById('btn-save-status')?.addEventListener('click', () => {
    const newStatus = document.getElementById('select-change-status')?.value;
    if (newStatus) updateOrderStatus(order.id, newStatus);
  });

  document.getElementById('btn-save-notes')?.addEventListener('click', () => {
    const note = document.getElementById('textarea-internal-notes')?.value;
    updateOrderNote(order.id, note);
  });

  document.getElementById('btn-download-order-pdf')?.addEventListener('click', () => {
    downloadOrderPDF(order.id);
  });

  document.getElementById('btn-resend-order-email')?.addEventListener('click', () => {
    const customEmail = prompt('Ingresa el correo destino para el reenvío:', 'terminalasuncion.1@gmail.com');
    if (customEmail) resendOrderEmail(order.id, customEmail.trim());
  });
}

/**
 * Actualiza el estatus de una orden y registra auditoría
 */
export async function updateOrderStatus(orderId, newStatus) {
  const sb = getSupabase();
  try {
    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: user?.email || 'Admin'
      })
      .eq('id', orderId);

    if (error) throw error;

    // Registrar en order_audit_logs
    await sb.from('order_audit_logs').insert({
      order_id: orderId,
      action: 'status_change',
      previous_state: { status: _selectedOrder?.status },
      new_state: { status: newStatus },
      user_id: user?.id,
      user_email: user?.email
    });

    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `✓ Estatus actualizado a "${newStatus.toUpperCase()}"`, type: 'success' }
    }));

    // Recargar vista
    await showOrderDetail(orderId);
    await loadOrders();
  } catch (err) {
    console.error('[updateOrderStatus error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al actualizar: ${err.message}`, type: 'error' }
    }));
  }
}

/**
 * Guarda notas internas en la orden
 */
export async function updateOrderNote(orderId, note) {
  const sb = getSupabase();
  try {
    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb
      .from('orders')
      .update({
        internal_notes: note,
        updated_at: new Date().toISOString(),
        updated_by: user?.email || 'Admin'
      })
      .eq('id', orderId);

    if (error) throw error;

    await sb.from('order_audit_logs').insert({
      order_id: orderId,
      action: 'note_added',
      new_state: { note },
      user_id: user?.id,
      user_email: user?.email
    });

    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: '✓ Nota interna guardada', type: 'success' }
    }));
  } catch (err) {
    console.error('[updateOrderNote error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al guardar nota: ${err.message}`, type: 'error' }
    }));
  }
}

/**
 * Reenvía el correo con PDF a través del endpoint serverless protegido
 */
export async function resendOrderEmail(orderId, customEmail) {
  const sb = getSupabase();
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('No hay sesión activa');

    // Generar PDF base64 en cliente si tenemos la orden seleccionada
    let pdfBase64 = null;
    if (_selectedOrder) {
      pdfBase64 = generateOrderPDFBase64(_selectedOrder);
    }

    const res = await fetch('/.netlify/functions/admin-resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        orderId,
        customRecipient: customEmail,
        pdfBase64
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fallo en reenvío');

    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: data.message || '✓ Correo reenviado con éxito', type: 'success' }
    }));

    showOrderDetail(orderId);
  } catch (err) {
    console.error('[resendOrderEmail error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al reenviar correo: ${err.message}`, type: 'error' }
    }));
  }
}

/**
 * Regenera y descarga el PDF formal en tamaño Carta desde los datos guardados en DB
 */
export function downloadOrderPDF(orderId) {
  if (!_selectedOrder || _selectedOrder.id !== orderId) return;

  try {
    const doc = buildOrderPDFDocument(_selectedOrder);
    doc.save(`${_selectedOrder.folio}_${_selectedOrder.municipio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: '✓ PDF descargado exitosamente', type: 'success' }
    }));
  } catch (err) {
    console.error('[downloadOrderPDF error]', err);
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: `Error al generar PDF: ${err.message}`, type: 'error' }
    }));
  }
}

/**
 * Genera el documento jsPDF con membrete y estilo idéntico al cliente
 */
function buildOrderPDFDocument(order) {
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor) throw new Error('jsPDF no disponible');

  const doc = new jsPDFCtor({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 36;
  const CW = PW - M * 2;

  const NAVY = [10, 25, 47], NAVY2 = [30, 58, 95], GOLD = [255, 215, 0];
  const GRAY = [100, 116, 139], LIGHT = [248, 250, 252], LINE = [203, 213, 225];

  const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const items = Array.isArray(order.items_snapshot) && order.items_snapshot.length > 0
    ? order.items_snapshot
    : [{ nombre: order.detalles_pedido || 'Partida general', cantidad: order.total_piezas || 1, precio_unitario: order.total_mxn, subtotal: order.total_mxn }];

  const totalGral = Number(order.total_mxn || 0);
  const subtotalSinIva = Number(order.subtotal_mxn || (totalGral / 1.16));
  const ivaTotal = Number(order.iva_mxn || (totalGral - subtotalSinIva));

  // Encabezado
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, 36, CW, 62, 6, 6, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text('Suministros A. R.', M + 16, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(136, 146, 176);
  doc.text('ESPECIALISTAS EN EQUIPAMIENTO POLICIAL Y SEGURIDAD', M + 16, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text(order.folio, PW - M - 16, 62, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(136, 146, 176);
  doc.text(new Date(order.fecha).toLocaleDateString('es-MX'), PW - M - 16, 78, { align: 'right' });

  // Título + Municipio
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('COTIZACIÓN FORMAL', M, 124);

  doc.setFillColor(247, 249, 253);
  doc.setDrawColor(...NAVY2);
  doc.setLineWidth(1);
  doc.roundedRect(M, 134, CW, 34, 5, 5, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('MUNICIPIO / AGENCIA SOLICITANTE', M + 14, 148);
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(doc.splitTextToSize(order.municipio || 'Cliente General', CW - 28)[0], M + 14, 161);

  // Tabla
  const rows = items.map(item => {
    const pUnit = Number(item.precio_unitario || item.subtotal / (item.cantidad || 1));
    const uBase = pUnit / 1.16;
    return [
      item.nombre || 'Producto',
      item.color || '-',
      item.talla || '-',
      String(item.cantidad || 1),
      money(uBase),
      money(pUnit - uBase),
      money(item.subtotal || (pUnit * (item.cantidad || 1))),
    ];
  });

  doc.autoTable({
    startY: 182,
    margin: { left: M, right: M, top: 40, bottom: 60 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    head: [['PRODUCTO / ESPECIFICACIÓN', 'COLOR', 'TALLA', 'CANT.', 'PRECIO U.', 'IVA 16%', 'SUBTOTAL']],
    body: rows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: NAVY, cellPadding: 6, valign: 'middle' },
    headStyles: { fillColor: NAVY2, textColor: GOLD, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 190, halign: 'left' },
      1: { cellWidth: 55, halign: 'center' },
      2: { cellWidth: 50, halign: 'center' },
      3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: LIGHT }
  });

  // Totales
  let y = doc.lastAutoTable.finalY + 14;
  if (y + 100 > PH - 60) { doc.addPage(); y = 50; }

  const bx = PW - M - 230, bw = 230;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(bx, y, bw, 52, 4, 4, 'FD');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  doc.text('Subtotal s/IVA', bx + 12, y + 18);
  doc.text(money(subtotalSinIva), bx + bw - 12, y + 18, { align: 'right' });
  doc.text('IVA (16%)', bx + 12, y + 38);
  doc.text(money(ivaTotal), bx + bw - 12, y + 38, { align: 'right' });

  doc.setFillColor(...NAVY);
  doc.roundedRect(bx, y + 58, bw, 30, 4, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLD);
  doc.text('TOTAL C/IVA', bx + 12, y + 77);
  doc.setFontSize(13);
  doc.text(money(totalGral), bx + bw - 12, y + 78, { align: 'right' });

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
    doc.line(M, PH - 42, PW - M, PH - 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`Suministros A. R. · ${order.folio}`, M, PH - 28);
    doc.text(`Página ${p} de ${pages}`, PW - M, PH - 28, { align: 'right' });
  }

  return doc;
}

function generateOrderPDFBase64(order) {
  const doc = buildOrderPDFDocument(order);
  return doc.output('datauristring');
}

/**
 * Exporta el listado actual filtrado a formato CSV
 */
export function exportOrdersToCSV() {
  if (_orders.length === 0) {
    document.dispatchEvent(new CustomEvent(EVT.TOAST, {
      detail: { msg: 'No hay requisiciones para exportar', type: 'info' }
    }));
    return;
  }

  const headers = ['Folio', 'Fecha', 'Municipio', 'Piezas', 'Total MXN', 'Estatus', 'Email Status', 'Notas'];
  const rows = _orders.map(o => [
    `"${o.folio}"`,
    `"${new Date(o.fecha).toISOString()}"`,
    `"${(o.municipio || '').replace(/"/g, '""')}"`,
    o.total_piezas || 0,
    o.total_mxn || 0,
    `"${o.status || ''}"`,
    `"${o.email_status || ''}"`,
    `"${(o.internal_notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Requisiciones_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  document.dispatchEvent(new CustomEvent(EVT.TOAST, {
    detail: { msg: '✓ Exportación CSV generada', type: 'success' }
  }));
}

/**
 * Actualiza los filtros de búsqueda
 */
export function setOrdersFilter(newFilter) {
  _currentFilter = { ..._currentFilter, ...newFilter, page: 1 };
  loadOrders();
}
