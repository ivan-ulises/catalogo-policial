/**
 * @file utils/orders.js
 * @description Motor de documentos de pedido. Gestiona dos flujos SEPARADOS:
 *
 *  ┌─ FLUJO CLIENTE (siempre visible) ──────────────────────────────────┐
 *  │  Modal principal → solo Tabla A (cotización con precios)           │
 *  │  Impresión / PDF → solo Tabla A                                    │
 *  └────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ FLUJO ADMINISTRADOR (protegido) ──────────────────────────────────┐
 *  │  Trigger 1: Ctrl + Shift + P (atajo de teclado global)             │
 *  │  Trigger 2: Triple-clic en el título del modal de cotización        │
 *  │  → prompt() de contraseña                                          │
 *  │  → Si correcta: abre modal secundario con Tabla B (sin precios)    │
 *  └────────────────────────────────────────────────────────────────────┘
 *
 * REGLA CRÍTICA DE SEGURIDAD UI:
 *   La Tabla B (proveedor) NUNCA se inyecta en el DOM durante el flujo
 *   normal. Se construye dinámicamente SOLO después de autenticación.
 *   Al cerrar el modal admin, su HTML es destruido del DOM completamente.
 *
 * CONEXIONES:
 *   ← Recibe datos de: cart.js (vía evento 'cart:checkout')
 *   → Dispara evento:  'cart:whatsapp'
 *   → Usa utilidad:    utils/format.js
 */

import { formatMXN, getFormattedDate } from './format.js';

// ╔══════════════════════════════════════════════════════════════╗
// ║  CONFIGURACIÓN — ADMIN: edita solo este bloque              ║
// ╚══════════════════════════════════════════════════════════════╝

/** ADMIN: Nombre de la empresa / municipio para encabezados. */
const COMPANY_NAME = 'Suministros A. R.';

/** ADMIN: Pie de página de la cotización del cliente (Tabla A). */
const TABLA_A_FOOTER =
  'Los precios son referenciales y sujetos a confirmación formal de pedido.';

/** ADMIN: Pie de página de la requisición del proveedor (Tabla B). */
const TABLA_B_FOOTER =
  'Requisición de producción para maquilador. Documento confidencial — no compartir precios.';

// ╔══════════════════════════════════════════════════════════════╗
// ║  ESTADO INTERNO DEL MÓDULO                                  ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Snapshot del pedido activo. Se actualiza cada vez que el cliente
 * genera una cotización. El modo admin lo reutiliza sin necesidad
 * de recibir los datos de nuevo.
 *
 * @type {{ items: Array, total: number, dateStr: string } | null}
 */
let _currentOrder = null;

/** Contador de clics para el triple-clic en el título. */
let _titleClickCount = 0;
/** Timer de reset del contador. */
let _titleClickTimer = null;

// ╔══════════════════════════════════════════════════════════════╗
// ║  API PÚBLICA                                                ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Inicializa el motor de órdenes.
 * - Escucha 'cart:checkout' → abre modal cliente (solo Tabla A).
 * - Registra atajo Ctrl+Shift+P para acceso admin.
 */
export function initOrders() {
  document.addEventListener('cart:checkout', (e) => {
    const { items, total } = e.detail;
    _currentOrder = { items, total, dateStr: getFormattedDate() };
    _openClientModal();
  });

  // Atajo de teclado: Ctrl + Shift + P
  // ADMIN: cambia la combinación aquí si lo necesitas.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      _requestAdminAccess();
    }
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FLUJO CLIENTE — Modal con Tabla A únicamente               ║
// ╚══════════════════════════════════════════════════════════════╝

function _openClientModal() {
  const modal = document.getElementById('sheets-modal');
  if (!modal) { alert("Error: modal no existe en el DOM"); return; }
  if (!_currentOrder) { alert("Error: no hay pedido actual"); return; }

  const { items, total, dateStr } = _currentOrder;

  // Ya no usamos GAS, el backend siempre está configurado (Supabase/Netlify)
  const backendConfigured = true;

  modal.innerHTML = `
    <div class="bg-white max-w-4xl mx-auto rounded-2xl shadow-2xl overflow-hidden"
         id="sheets-modal-inner">

      <!-- ── Cabecera ── -->
      <div class="bg-gradient-to-r from-[#0A192F] via-[#112240] to-[#1E3A5F]
                  px-6 py-5 flex items-start justify-between">
        <div>
          <h2 id="modal-title-trigger"
              class="font-display text-2xl font-bold text-[#FFD700] tracking-wider
                     select-none cursor-default" title="">
            COTIZACIÓN GENERADA
          </h2>
          <p class="text-[#8892B0] text-sm mt-0.5">
            Revisa los datos, guarda el pedido y envía por WhatsApp.
          </p>
        </div>
        <button id="btn-close-modal"
                class="text-[#8892B0] hover:text-[#FFD700] transition-colors p-2
                       rounded-lg mt-0.5 flex-shrink-0"
                aria-label="Cerrar">
          <svg class="w-6 h-6" fill="none" stroke="currentColor"
               stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="p-5 sm:p-6 space-y-6">

        <!-- ════════════════════════════════════════════════════
             CAMPO DE MUNICIPIO / AGENCIA
             ════════════════════════════════════════════════════ -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label for="input-municipio"
                 class="block font-display font-bold text-[#0A192F] text-sm
                        tracking-wide mb-2 uppercase">
            Municipio / Agencia Solicitante
            <span class="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="input-municipio"
            type="text"
            placeholder="Ej. Asunción Nochixtlán — Dirección de Seguridad Pública"
            maxlength="120"
            class="w-full border border-blue-300 rounded-lg px-4 py-2.5 text-sm
                   text-[#0A192F] bg-white placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50
                   focus:border-[#FFD700] transition-colors"
            autocomplete="organization"
          />
          <div class="flex justify-between items-start mt-1.5">
            <p class="text-xs text-blue-600">
              Este dato quedará registrado junto con el pedido en la base de datos.
            </p>
            <p id="municipio-error" class="text-xs text-red-500 font-bold hidden">
              ⚠ Escribe el nombre del municipio
            </p>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════
             TABLA A — COTIZACIÓN (solo con precios)
             ════════════════════════════════════════════════════ -->
        <section aria-label="Cotización de pedido">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <span class="bg-[#0A192F] text-[#FFD700] font-display font-bold text-base
                           px-3 py-1 rounded-lg tracking-wide">COTIZACIÓN</span>
              <div>
                <h3 class="font-display text-xl font-bold text-[#0A192F] tracking-wide">
                  DETALLE DEL PEDIDO
                </h3>
                <p class="text-xs text-gray-500">Incluye precios unitarios y totales.</p>
              </div>
            </div>
            <button data-copy-table="table-a"
                    class="copy-btn flex items-center gap-1.5 text-xs bg-gray-100
                           hover:bg-[#0A192F] hover:text-[#FFD700] px-3 py-2 rounded-lg
                           transition-colors font-medium">
              <svg class="w-4 h-4" fill="none" stroke="currentColor"
                   stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2
                         m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2
                         2v8a2 2 0 002 2z"/>
              </svg>
              Copiar tabla
            </button>
          </div>

          <div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table id="table-a" class="sheet-table w-full border-collapse whitespace-nowrap min-w-[700px]">
              <thead>
                <tr>
                  <th class="text-left">PRODUCTO / SKU</th>
                  <th class="text-center">COLOR</th>
                  <th class="text-center">TALLA</th>
                  <th class="text-center">CANT.</th>
                  <th class="text-right">PRECIO UNIT.</th>
                  <th class="text-right">IVA 16%</th>
                  <th class="text-right">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>${_buildTableARows(items)}</tbody>
              <tfoot>
                ${(function() {
                  const totalGral      = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                  const subtotalSinIva = totalGral / 1.16;
                  const ivaTotal       = totalGral - subtotalSinIva;
                  return `
                    <tr>
                      <td colspan="6"
                          class="text-right font-semibold text-gray-600
                                 tracking-wide text-sm px-4 py-2">
                        SUBTOTAL S/IVA:
                      </td>
                      <td class="text-right font-semibold text-gray-700
                                 text-sm px-4 py-2">
                        ${formatMXN(subtotalSinIva)}
                      </td>
                    </tr>
                    <tr>
                      <td colspan="6"
                          class="text-right font-semibold text-gray-600
                                 tracking-wide text-sm px-4 py-2">
                        IVA (16%):
                      </td>
                      <td class="text-right font-semibold text-gray-700
                                 text-sm px-4 py-2">
                        ${formatMXN(ivaTotal)}
                      </td>
                    </tr>
                    <tr class="bg-navy/5">
                      <td colspan="6"
                          class="text-right font-display font-bold text-[#0A192F]
                                 tracking-wide text-sm px-4 py-3">
                        TOTAL C/IVA:
                      </td>
                      <td class="text-right font-display font-bold text-[#0A192F]
                                 text-base px-4 py-3">
                        ${formatMXN(totalGral)}
                      </td>
                    </tr>
                  `;
                })()}
              </tfoot>
            </table>
          </div>

          <div class="flex justify-between mt-2 px-1">
            <p class="text-xs text-gray-400 italic">${TABLA_A_FOOTER}</p>
            <p class="text-xs text-gray-400 text-right flex-shrink-0 ml-4">
              ${COMPANY_NAME} · ${dateStr}
            </p>
          </div>
        </section>

        <!-- ════════════════════════════════════════════════════
             BOTÓN PRINCIPAL: FINALIZAR Y GUARDAR PEDIDO
             Solo visible si GAS_ENDPOINT está configurado.
             Estado visual: idle → loading → success / error
             ════════════════════════════════════════════════════ -->
        ${backendConfigured ? `
        <div class="bg-[#0A192F] rounded-2xl p-4 sm:p-5">
          <p class="text-[#CCD6F6] text-xs mb-3 text-center leading-relaxed">
            Al hacer clic, el pedido se registra en la base de datos FORTAMUN
            y se abre WhatsApp con el detalle completo.
          </p>
          <button id="btn-submit-order"
                  class="w-full py-4 rounded-xl font-display font-bold text-base
                         tracking-wide flex items-center justify-center gap-3
                         transition-all duration-200 shadow-lg
                         bg-[#FFD700] hover:bg-[#FFC200] text-[#0A192F]
                         hover:scale-[1.01] active:scale-[0.99]"
                  aria-live="polite">
            <!-- Estado: idle -->
            <span id="submit-icon-idle">
              <svg class="w-5 h-5" fill="none" stroke="currentColor"
                   stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </span>
            <span id="submit-label">FINALIZAR Y GUARDAR PEDIDO</span>
          </button>
          <!-- Feedback de estado debajo del botón -->
          <p id="submit-feedback" class="text-xs text-center mt-2 min-h-[1.2rem]
                                         text-[#8892B0] hidden"></p>
        </div>
        ` : ''}

        <!-- ════════════════════════════════════════════════════
             BOTONES SECUNDARIOS
             ════════════════════════════════════════════════════ -->
        <div class="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
          <button id="btn-print-client"
                  class="bg-[#FFD700] hover:bg-[#FFC200] text-[#0A192F] font-display
                         font-bold flex items-center gap-2 px-5 py-3 rounded-xl text-sm
                         shadow transition-all hover:scale-[1.02] tracking-wide">
            <svg class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4
                       a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9
                       a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9
                       a2 2 0 00-2 2v4h10z"/>
            </svg>
            Imprimir / PDF
          </button>

          <button id="btn-modal-whatsapp"
                  class="bg-[#25D366] hover:bg-[#1da851] text-white font-display font-bold
                         flex items-center gap-2 px-5 py-3 rounded-xl text-sm shadow
                         transition-all hover:scale-[1.02] tracking-wide">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099
                       -.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199
                       -.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883
                       -.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606
                       .134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099
                       -.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207
                       -.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01
                       -.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479
                       0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077
                       4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871
                       .118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289
                       .173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.122 1.528
                       5.854L.057 23.057a.75.75 0 00.921.921l5.204-1.471A11.95
                       11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0
                       21.75a9.71 9.71 0 01-4.964-1.36l-.357-.212-3.688 1.043
                       1.044-3.688-.213-.357A9.712 9.712 0 012.25 12C2.25 6.615
                       6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12
                       21.75z"/>
            </svg>
            Solo WhatsApp
          </button>

          <button id="btn-close-modal-footer"
                  class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm border
                         border-gray-300 hover:bg-gray-50 transition-colors font-medium">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // ── Cerrar modal ─────────────────────────────────────────────
  const closeClientModal = () => {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.body.style.overflow = '';
    _resetTitleClickCounter();
  };

  document.getElementById('btn-close-modal')
    ?.addEventListener('click', closeClientModal);
  document.getElementById('btn-close-modal-footer')
    ?.addEventListener('click', closeClientModal);
  modal.onclick = (e) => {
    if (e.target === modal) closeClientModal();
  };

  // ── Copiar tabla ──────────────────────────────────────────────
  modal.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => _copyTableToClipboard(btn.dataset.copyTable));
  });

  // ── Imprimir solo Tabla A ─────────────────────────────────────
  document.getElementById('btn-print-client')
    ?.addEventListener('click', () => _printClientOnly(items, total, dateStr));

  // ── WhatsApp directo (sin guardar en GAS) ─────────────────────
  document.getElementById('btn-modal-whatsapp')
    ?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('cart:whatsapp', {
        detail: { items, total },
      }));
    });

  // ── Triple-clic → acceso admin ────────────────────────────────
  document.getElementById('modal-title-trigger')
    ?.addEventListener('click', _handleTitleClick);

  // ── Botón principal: Finalizar y Guardar Pedido ───────────────
  if (backendConfigured) {
    document.getElementById('btn-submit-order')
      ?.addEventListener('click', () => _handleSubmitOrder(items, total, dateStr));
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SUBMIT A GAS — Máquina de estados del botón principal      ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Maneja el clic en "FINALIZAR Y GUARDAR PEDIDO".
 * Ciclo de estados del botón:
 *
 *   idle ──► loading ──► success (abre WA)
 *                    └──► error   (muestra mensaje, re-habilita)
 *
 * @param {Array}  items   - Ítems del carrito
 * @param {number} total   - Total en MXN
 * @param {string} dateStr - Fecha formateada
 * @private
 */
let _isSubmitting = false;

async function _handleSubmitOrder(items, total, dateStr) {
  if (_isSubmitting) return;
  if (!items || items.length === 0) return;

  const btn = document.getElementById('btn-submit-order');
  const label = document.getElementById('submit-label');
  const feedback = document.getElementById('submit-feedback');

  if (!btn || !label) return;

  // Leer el nombre del municipio del input
  const municipioInput = document.getElementById('input-municipio');
  const municipioError = document.getElementById('municipio-error');
  const municipio = municipioInput?.value?.trim() ?? '';

  // Validar campo obligatorio
  if (!municipio) {
    municipioInput?.classList.add('border-red-400', 'ring-2', 'ring-red-200');
    municipioError?.classList.remove('hidden');
    municipioInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    municipioInput?.focus();
    alert('Por favor, ingresa el nombre del Municipio o Agencia solicitante.');
    setTimeout(() => {
      municipioInput?.classList.remove('border-red-400', 'ring-2', 'ring-red-200');
      municipioError?.classList.add('hidden');
    }, 2500);
    return;
  }

  // ── Estado: LOADING ──────────────────────────────────────────
  _isSubmitting = true;
  btn.disabled = true;
  btn.classList.remove('bg-[#FFD700]', 'hover:bg-[#FFC200]', 'hover:scale-[1.01]');
  btn.classList.add('bg-[#1E3A5F]', 'cursor-not-allowed', 'opacity-90');
  label.textContent = 'Procesando pedido…';
  document.getElementById('submit-icon-idle').innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor"
         stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
               11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
  `;
  if (feedback) {
    feedback.textContent = 'Preparando pedido…';
    feedback.className = 'text-xs text-center mt-2 min-h-[1.2rem] text-[#8892B0]';
  }

  // ── Generar PDF y Enviar a Netlify ───────────────────────────────
  try {
    if (feedback) feedback.textContent = 'Generando PDF...';
    
    
    // Folio único: el mismo número aparece en el PDF, el correo y la base de datos
    const folio = 'COT-' + Date.now().toString(36).toUpperCase();

    // PDF vectorial (texto real, sin capturas de pantalla)
    const pdfBase64 = _buildInvoicePDF(items, dateStr, municipio, folio);

    if (feedback) feedback.textContent = 'Enviando orden y correo...';

    const payload = { items, total, municipio, dateStr, folio };
    
    const response = await fetch('/.netlify/functions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, pdfBase64 })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || 'Fallo al guardar');
    }
    const resultData = await response.json();
    
    var result = { ok: true, mode: 'cors' }; // mock para no cambiar el flujo de abajo
  } catch (err) {
    console.error('[orders] Error al enviar pedido:', err);
    var result = { ok: false, message: 'No se pudo enviar el pedido: ' + (err.message || 'error de conexión') + '. Intenta de nuevo.' };
  }

  // ── Estado: SUCCESS ──────────────────────────────────────────
  if (result.ok) {
    btn.classList.remove('bg-[#1E3A5F]', 'cursor-not-allowed', 'opacity-90');
    btn.classList.add('bg-green-600', 'cursor-default');
    label.textContent = '✓ Pedido Guardado — Abriendo WhatsApp…';
    document.getElementById('submit-icon-idle').innerHTML = '';

    if (feedback) {
      const modeNote = result.mode === 'no-cors'
        ? ' (sin confirmación del servidor)'
        : '';
      feedback.textContent = `Registrado correctamente${modeNote}`;
      feedback.className = 'text-xs text-center mt-2 min-h-[1.2rem] text-green-400';
    }

    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: '✓ Pedido enviado correctamente' },
    }));

    // Pausa breve para que el usuario vea el estado success, luego abre WA
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('cart:whatsapp', {
        detail: { items, total, municipio },
      }));
    }, 1200);

    // ── Estado: ERROR ─────────────────────────────────────────────
  } else {
    // Re-habilitar el botón para que pueda reintentar
    btn.disabled = false;
    btn.classList.remove('bg-[#1E3A5F]', 'cursor-not-allowed', 'opacity-90');
    btn.classList.add('bg-red-700', 'hover:bg-red-600', 'hover:scale-[1.01]');
    label.textContent = 'Error al guardar — Reintentar';
    document.getElementById('submit-icon-idle').innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor"
           stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464
                 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    `;

    if (feedback) {
      feedback.textContent = result.message;
      feedback.className = 'text-xs text-center mt-2 min-h-[1.2rem] text-red-400';
    }

    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: '⚠ ' + result.message },
    }));

    // Al reintentar, restablecer colores del botón antes de volver a llamar
    btn.addEventListener('click', () => {
      _isSubmitting = false;
      btn.classList.remove('bg-red-700', 'hover:bg-red-600');
      btn.classList.add('bg-[#FFD700]', 'hover:bg-[#FFC200]');
      label.textContent = 'FINALIZAR Y GUARDAR PEDIDO';
    }, { once: true });
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FLUJO ADMINISTRADOR — Acceso protegido por contraseña      ║
// ╚══════════════════════════════════════════════════════════════╝

function _handleTitleClick() {
  _titleClickCount++;
  clearTimeout(_titleClickTimer);
  _titleClickTimer = setTimeout(_resetTitleClickCounter, 1500);
  if (_titleClickCount >= 3) {
    _resetTitleClickCounter();
    _requestAdminAccess();
  }
}

function _resetTitleClickCounter() {
  _titleClickCount = 0;
  clearTimeout(_titleClickTimer);
}

function _requestAdminAccess() {
  if (!_currentOrder) {
    alert('No hay ninguna cotización activa. Genera un pedido primero.');
    return;
  }

  let authModal = document.getElementById('admin-auth-modal');
  if (!authModal) {
    authModal = document.createElement('div');
    authModal.id = 'admin-auth-modal';
    authModal.className = 'fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4';
    authModal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-[#FFD700]">
        <h3 class="font-display font-bold text-[#0A192F] text-xl mb-1 flex items-center gap-2">
          <svg class="w-5 h-5 text-[#FFD700]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          Acceso Restringido
        </h3>
        <p class="text-xs text-gray-500 mb-4">Ingresa la contraseña de administrador.</p>
        <form id="admin-auth-form" class="space-y-4">
          <div>
            <input type="password" id="admin-auth-input" class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:outline-none transition-colors" placeholder="Contraseña..." autocomplete="off">
            <p id="admin-auth-error" class="text-xs text-red-500 mt-1.5 hidden font-bold"></p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="admin-auth-cancel" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button type="submit" id="admin-auth-submit" class="px-5 py-2 text-sm bg-[#0A192F] text-[#FFD700] rounded-lg hover:bg-navy-light flex items-center gap-2 font-bold tracking-wide transition-colors">
              <span id="admin-auth-spinner" class="hidden">
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </span>
              Validar
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(authModal);
  }

  const input = document.getElementById('admin-auth-input');
  const errorEl = document.getElementById('admin-auth-error');
  const form = document.getElementById('admin-auth-form');
  const cancelBtn = document.getElementById('admin-auth-cancel');
  const submitBtn = document.getElementById('admin-auth-submit');
  const spinner = document.getElementById('admin-auth-spinner');

  input.value = '';
  errorEl.classList.add('hidden');
  input.classList.remove('border-red-400', 'ring-red-200');
  authModal.classList.remove('hidden');
  // Usar timeout leve para asegurar que el DOM pintó el modal antes de enfocar
  setTimeout(() => input.focus(), 50);

  const close = () => {
    authModal.classList.add('hidden');
    form.onsubmit = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = close;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) {
      errorEl.textContent = 'La contraseña no puede estar vacía.';
      errorEl.classList.remove('hidden');
      input.classList.add('border-red-400', 'ring-2', 'ring-red-200');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    spinner.classList.remove('hidden');
    errorEl.classList.add('hidden');
    input.classList.remove('border-red-400', 'ring-2', 'ring-red-200');

    try {
      const result = val === "admin2026" ? { ok: true } : { ok: false };
      if (result.ok) {
        close();
        _openAdminModal();
      } else {
        errorEl.textContent = 'Contraseña incorrecta.';
        errorEl.classList.remove('hidden');
        input.classList.add('border-red-400', 'ring-2', 'ring-red-200');
        input.focus();
      }
    } catch (err) {
      errorEl.textContent = 'Error de conexión. Intenta de nuevo.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
      spinner.classList.add('hidden');
    }
  };
}

function _openAdminModal() {
  if (!_currentOrder) return;
  const { items, dateStr } = _currentOrder;
  const totalPiezas = items.reduce((s, i) => s + i.qty, 0);

  let adminModal = document.getElementById('admin-modal');
  if (!adminModal) {
    adminModal = document.createElement('div');
    adminModal.id = 'admin-modal';
    adminModal.className =
      'fixed inset-0 bg-black/70 z-[80] overflow-y-auto py-8 px-3';
    document.body.appendChild(adminModal);
  }

  adminModal.innerHTML = `
    <div class="bg-white max-w-3xl mx-auto rounded-2xl shadow-2xl overflow-hidden
                border-4 border-amber-400">

      <div class="bg-amber-400 px-6 py-4 flex items-start justify-between">
        <div>
          <h2 class="font-display text-2xl font-bold text-[#0A192F] tracking-wider">
            🔐 REQUISICIÓN PARA PROVEEDOR
          </h2>
          <p class="text-[#0A192F]/70 text-sm font-semibold mt-0.5">
            MODO ADMINISTRADOR — Documento interno confidencial
          </p>
        </div>
        <button id="btn-close-admin"
                class="text-[#0A192F]/60 hover:text-[#0A192F] transition-colors
                       p-2 rounded-lg flex-shrink-0"
                aria-label="Cerrar modo admin">
          <svg class="w-6 h-6" fill="none" stroke="currentColor"
               stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2">
        <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor"
             viewBox="0 0 20 20">
          <path fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334
                   -.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58
                   -9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3
                   a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <p class="text-xs text-red-700 font-semibold">
          Esta tabla NO contiene precios. Es exclusiva para el proveedor/maquilador.
          No compartas esta pantalla con el cliente.
        </p>
      </div>

      <div class="p-5 sm:p-6 space-y-4">

        <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h3 class="font-display text-lg font-bold text-[#0A192F] tracking-wide">
              TABLA DE REQUISICIÓN
            </h3>
            <p class="text-xs text-gray-500">${dateStr} — ${COMPANY_NAME}</p>
          </div>
          <button data-copy-table="table-b-admin"
                  class="copy-btn-admin flex items-center gap-1.5 text-xs bg-gray-100
                         hover:bg-[#0A192F] hover:text-amber-400 px-3 py-2 rounded-lg
                         transition-colors font-medium">
            <svg class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2
                       m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2
                       2v8a2 2 0 002 2z"/>
            </svg>
            Copiar tabla
          </button>
        </div>

        <div class="overflow-x-auto rounded-xl border border-gray-200">
          <table id="table-b-admin" class="sheet-table w-full border-collapse whitespace-nowrap min-w-[600px]">
            <thead>
              <tr>
                <th class="text-left">PRODUCTO / SKU</th>
                <th class="text-center">TALLA</th>
                <th class="text-center">CANTIDAD</th>
                <th class="text-left">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>${_buildTableBRows(items)}</tbody>
            <tfoot>
              <tr>
                <td colspan="2"
                    class="font-display font-bold text-[#0A192F] text-sm
                           px-4 py-3 tracking-wide">
                  TOTAL DE PIEZAS:
                </td>
                <td class="text-center font-display font-bold text-[#0A192F]
                           text-base px-4 py-3">
                  ${totalPiezas}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="text-xs text-gray-400 italic px-1">${TABLA_B_FOOTER}</p>

        <div class="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
          <button id="btn-print-admin"
                  class="bg-amber-400 hover:bg-amber-300 text-[#0A192F] font-display
                         font-bold flex items-center gap-2 px-5 py-3 rounded-xl text-sm
                         shadow transition-all hover:scale-[1.02] tracking-wide">
            <svg class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4
                       a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9
                       a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9
                       a2 2 0 00-2 2v4h10z"/>
            </svg>
            Imprimir Requisición
          </button>
          <button id="btn-close-admin-footer"
                  class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm border
                         border-gray-300 hover:bg-gray-50 transition-colors font-medium">
            Cerrar y volver
          </button>
        </div>

      </div>
    </div>
  `;

  adminModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const closeAdminModal = () => {
    adminModal.innerHTML = ''; // destruye la Tabla B del DOM
    adminModal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  document.getElementById('btn-close-admin')
    ?.addEventListener('click', closeAdminModal);
  document.getElementById('btn-close-admin-footer')
    ?.addEventListener('click', closeAdminModal);
  adminModal.onclick = (e) => {
    if (e.target === adminModal) closeAdminModal();
  };

  adminModal.querySelectorAll('.copy-btn-admin').forEach(btn => {
    btn.addEventListener('click', () => _copyTableToClipboard(btn.dataset.copyTable));
  });

  document.getElementById('btn-print-admin')
    ?.addEventListener('click', () => _printAdminOnly(items, dateStr));
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  BUILDERS DE FILAS                                          ║
// ╚══════════════════════════════════════════════════════════════╝

function _buildTableARows(items) {
  return items.map(item => {
    // Calculamos el desglose asumiendo que el precio unitario ya trae el IVA
    const totalLinea      = item.qty * item.unitPrice;
    const unitPriceBase   = item.unitPrice / 1.16;
    const ivaUnitario     = item.unitPrice - unitPriceBase;
    
    return `
    <tr>
      <td class="px-4 py-2.5">
        <p class="font-semibold text-[#0A192F] leading-snug">
          ${_esc(item.name)}
          ${item.variant ? `<span style="color:#A88E00; font-size:0.9em; font-style:italic"> (${_esc(item.variant)})</span>` : ''}
        </p>
        ${item.slotInfo ? `<p class="text-xs text-amber-700 font-medium">${_esc(item.slotInfo)}</p>` : ''}
        <p class="text-xs text-gray-400 font-mono">${_esc(item.sku)}</p>
      </td>
      <td class="px-3 py-2.5 text-center">
        ${item.color
          ? `<span class="inline-block text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">${_esc(item.color)}</span>`
          : '<span class="text-gray-400 text-xs">—</span>'}
      </td>
      <td class="px-3 py-2.5 text-center font-bold">${_esc(item.size)}</td>
      <td class="px-3 py-2.5 text-center font-bold text-[#0A192F]">${item.qty}</td>
      <td class="px-4 py-2.5 text-right text-gray-700">${formatMXN(unitPriceBase)}</td>
      <td class="px-4 py-2.5 text-right text-gray-500 text-sm">${formatMXN(ivaUnitario)}</td>
      <td class="px-4 py-2.5 text-right font-bold text-[#0A192F]">
        ${formatMXN(totalLinea)}
      </td>
    </tr>
  `;
  }).join('');
}

function _buildTableBRows(items) {
  return items.map(item => `
    <tr>
      <td class="px-4 py-2.5">
        <p class="font-semibold text-[#0A192F] leading-snug">
          ${_esc(item.name)}
          ${item.variant ? `<span style="color:#A88E00; font-size:0.9em; font-style:italic"> (${_esc(item.variant)})</span>` : ''}
        </p>
        <p class="text-xs text-gray-400 font-mono">${_esc(item.sku)}</p>
      </td>
      <td class="px-3 py-2.5 text-center font-bold">${_esc(item.size)}</td>
      <td class="px-3 py-2.5 text-center font-bold text-[#0A192F]">${item.qty}</td>
      <td class="px-4 py-2.5 text-sm text-gray-400 italic">—</td>
    </tr>
  `).join('');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  IMPRESIÓN SEPARADA — cada flujo imprime su propio doc      ║
// ╚══════════════════════════════════════════════════════════════╝

function _printClientOnly(items, total, dateStr) {
  const municipioVal = document.getElementById('input-municipio')?.value?.trim() || '';
  const htmlStr = _generateInvoiceHTML(items, total, dateStr, municipioVal);
  
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) { window.print(); return; }
  
  win.document.write('<!DOCTYPE html><html><head><title>Imprimir</title></head><body style="margin:0">' + htmlStr + '<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>'); win.document.close();
}

function _printAdminOnly(items, dateStr) {
  const rows = _buildTableBRows(items);
  const totalPiezas = items.reduce((s, i) => s + i.qty, 0);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.print(); return; }
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"/>
    <title>${_esc(COMPANY_NAME)} — Requisición</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:24px;color:#111}
      .hdr{background:#112240;color:#FFD700;padding:12px 16px;font-size:1.2rem;
           font-weight:800;letter-spacing:.07em;display:flex;
           justify-content:space-between;align-items:center}
      .sub{color:#8892B0;font-size:.72rem}
      .warn{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;
            font-size:.75rem;padding:6px 14px;margin-bottom:8px;border-radius:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#112240;color:#FFD700;font-size:.78rem;padding:8px 12px;text-align:left}
      td{padding:7px 12px;font-size:.82rem;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#f8fafc}
      tfoot td{background:#f0f4fa;font-weight:700}
      .note{font-size:.68rem;color:#6b7280;margin-top:6px}
      @media print{.warn{display:none}body{margin:0}}
    </style>
    </head><body>
    <div class="hdr">
      <span>${_esc(COMPANY_NAME)} — REQUISICIÓN PARA PROVEEDOR</span>
      <span class="sub">${dateStr}</span>
    </div>
    <div class="warn">🔐 Documento de uso exclusivo interno. No contiene precios.</div>
    <table>
      <thead>
        <tr>
          <th>PRODUCTO / SKU</th><th>TALLA</th><th>CANTIDAD</th><th>OBSERVACIONES</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:right;font-weight:700">TOTAL PIEZAS:</td>
          <td style="text-align:center;font-weight:700">${totalPiezas}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <p class="note">📦 ${TABLA_B_FOOTER}</p>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </div>`);
  win.document.close();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  UTILIDADES                                                 ║
// ╚══════════════════════════════════════════════════════════════╝

async function _copyTableToClipboard(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const text = [...table.querySelectorAll('tr')]
    .map(row =>
      [...row.querySelectorAll('th,td')]
        .map(cell => cell.innerText.replace(/\n/g, ' ').trim())
        .join('\t')
    ).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: '📋 Tabla copiada al portapapeles' },
    }));
  } catch {
    const ta = Object.assign(document.createElement('textarea'), {
      value: text, style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '📋 Tabla copiada' } }));
  }
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Formatea numero como moneda MXN para el PDF (independiente de format.js).
 * @param {number} n @returns {string} @private
 */
function _fmtPDF(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(n || 0);
}

/**
 * Genera la cotización como PDF VECTORIAL (texto real, seleccionable, sin
 * capturas de pantalla) usando jsPDF + AutoTable. Tamaño Carta, multipágina.
 *
 * @param {Array}  items      Ítems del carrito.
 * @param {string} dateStr    Fecha formateada.
 * @param {string} municipio  Municipio / agencia solicitante.
 * @param {string} folio      Folio de la cotización.
 * @returns {string} Data URI base64 del PDF.
 * @private
 */
function _buildInvoicePDF(items, dateStr, municipio, folio) {
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor) throw new Error('jsPDF no está cargado');

  const doc = new jsPDFCtor({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth();   // 612
  const PH = doc.internal.pageSize.getHeight();  // 792
  const M  = 36;                                 // margen lateral
  const CW = PW - M * 2;                         // ancho útil (540)

  const NAVY = [10, 25, 47], NAVY2 = [30, 58, 95], GOLD = [255, 215, 0];
  const GRAY = [100, 116, 139], LIGHT = [248, 250, 252], LINE = [203, 213, 225];

  // Moneda sin caracteres especiales (compatible con la fuente base del PDF)
  const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const totalGral      = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const subtotalSinIva = totalGral / 1.16;
  const ivaTotal       = totalGral - subtotalSinIva;
  const totalPiezas    = items.reduce((s, i) => s + i.qty, 0);

  // ── Encabezado ────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, 36, CW, 62, 6, 6, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text(COMPANY_NAME, M + 16, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(136, 146, 176);
  doc.text('ESPECIALISTAS EN EQUIPAMIENTO POLICIAL Y SEGURIDAD', M + 16, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text(folio, PW - M - 16, 62, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(136, 146, 176);
  doc.text(String(dateStr || ''), PW - M - 16, 78, { align: 'right' });

  // ── Título + Municipio ────────────────────────────────────────
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('COTIZACIÓN', M, 124);

  doc.setFillColor(247, 249, 253);
  doc.setDrawColor(...NAVY2);
  doc.setLineWidth(1);
  doc.roundedRect(M, 134, CW, 34, 5, 5, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('MUNICIPIO / AGENCIA SOLICITANTE', M + 14, 148);
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  const muniLine = doc.splitTextToSize(municipio || 'Cliente General', CW - 28)[0];
  doc.text(muniLine, M + 14, 161);

  // ── Tabla de productos ────────────────────────────────────────
  const rows = items.map(item => {
    const unitBase = item.unitPrice / 1.16;
    return [
      '', // se dibuja a mano (nombre + detalle + SKU)
      item.color || '-',
      item.size || '-',
      String(item.qty),
      money(unitBase),
      money(item.unitPrice - unitBase),
      money(item.qty * item.unitPrice),
    ];
  });

  const colProdW = 190;
  doc.autoTable({
    startY: 182,
    margin: { left: M, right: M, top: 40, bottom: 60 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    head: [['PRODUCTO / SKU', 'COLOR', 'TALLA', 'CANT.', 'PRECIO U.', 'IVA 16%', 'SUBTOTAL']],
    body: rows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: NAVY, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, valign: 'middle', lineColor: LINE, lineWidth: 0 },
    headStyles: { fillColor: NAVY2, textColor: GOLD, fontStyle: 'bold', fontSize: 8, halign: 'center', valign: 'middle', cellPadding: 7 },
    columnStyles: {
      0: { cellWidth: colProdW, halign: 'left' },
      1: { cellWidth: 55, halign: 'center' },
      2: { cellWidth: 50, halign: 'center' },
      3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: LIGHT },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) data.cell.styles.halign = 'left';
      if (data.section === 'head' && data.column.index >= 4) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 0) {
        // Calcula la altura necesaria para nombre (multilínea) + detalle + SKU
        const it = items[data.row.index];
        const detail = [it.variant, it.slotInfo].filter(Boolean).join(' - ');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(String(it.name || ''), colProdW - 12);
        data.cell.raw = { nameLines, detail, sku: it.sku || '' };
        data.cell.styles.minCellHeight = 12 + nameLines.length * 11 + (detail ? 10 : 0) + 10;
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        // Línea divisoria inferior de cada fila
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
      if (data.section === 'body' && data.column.index === 0 && data.cell.raw && data.cell.raw.nameLines) {
        const { nameLines, detail, sku } = data.cell.raw;
        let y = data.cell.y + 14;
        const x = data.cell.x + 6;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
        nameLines.forEach(l => { doc.text(l, x, y); y += 11; });
        if (detail) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
          doc.text(doc.splitTextToSize(detail, colProdW - 12)[0], x, y - 1); y += 10;
        }
        doc.setFont('courier', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
        doc.text(String(sku), x, y - 1);
      }
    },
  });

  // ── Totales ───────────────────────────────────────────────────
  let y = doc.lastAutoTable.finalY + 14;
  if (y + 100 > PH - 60) { doc.addPage(); y = 50; }

  const bx = PW - M - 230, bw = 230;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.8);
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

  // Resumen a la izquierda de los totales
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  doc.text(`Partidas: ${items.length}`, M, y + 18);
  doc.text(`Total de piezas: ${totalPiezas}`, M, y + 32);

  // ── Condiciones ───────────────────────────────────────────────
  let cy = y + 108;
  if (cy + 50 > PH - 60) { doc.addPage(); cy = 50; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
  doc.text('CONDICIONES', M, cy);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  const cond = [
    'Entrega en 21 días hábiles a partir de la confirmación del pedido y anticipo correspondiente.',
    TABLA_A_FOOTER,
    'Precios en MXN, IVA incluido en el total.',
  ];
  cond.forEach((t, i) => {
    doc.text(doc.splitTextToSize('- ' + t, CW)[0], M, cy + 14 + i * 12);
  });

  // ── Pie de página en todas las páginas ────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
    doc.line(M, PH - 42, PW - M, PH - 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`${COMPANY_NAME} · ${folio}`, M, PH - 28);
    doc.text(`Página ${p} de ${pages}`, PW - M, PH - 28, { align: 'right' });
  }

  return doc.output('datauristring');
}

function _generateInvoiceHTML(items, total, dateStr, municipioVal) {
  const totalGral      = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const subtotalSinIva = totalGral / 1.16;
  const ivaTotal       = totalGral - subtotalSinIva;
  const folio          = "COT-" + Date.now().toString(36).toUpperCase();

  const rowsHTML = items.map(item => {
    const unitBase  = item.unitPrice / 1.16;
    const ivaUnit   = item.unitPrice - unitBase;
    const subtotal  = item.qty * item.unitPrice;
    const descExtra = [item.variant, item.slotInfo].filter(Boolean).join(' \u00b7 ');
    return `
      <tr>
        <td>
          <div class="prod-name">${_esc(item.name)}${descExtra ? `<br/><span class="prod-sub">${_esc(descExtra)}</span>` : ''}</div>
          <div class="prod-sku">${_esc(item.sku)}</div>
        </td>
        <td class="tc">${item.color ? _esc(item.color) : '\u2014'}</td>
        <td class="tc">${_esc(item.size)}</td>
        <td class="tc bold">${item.qty}</td>
        <td class="tr">${_fmtPDF(unitBase)}</td>
        <td class="tr">${_fmtPDF(ivaUnit)}</td>
        <td class="tr bold">${_fmtPDF(subtotal)}</td>
      </tr>`;
  }).join('');

  return `<div id="invoice-wrapper" style="width: 800px; padding: 20px; background: #fff; font-family: 'Source Sans 3', sans-serif; font-size: 10.5px; color: #1a1a2e;">
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
/* ===== RESET ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: Letter portrait; margin: 16mm 14mm 14mm 14mm; }
.main-header { background: linear-gradient(135deg, #0A192F 0%, #112240 65%, #1E3A5F 100%); border-radius: 8px; padding: 14px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
.mh-left  { display: flex; align-items: center; gap: 12px; }
.mh-company { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 800; color: #FFD700; letter-spacing: 0.07em; line-height: 1; }
.mh-sub { font-size: 9px; color: #8892B0; margin-top: 3px; letter-spacing: 0.04em; }
.mh-right { text-align: right; }
.mh-folio { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; color: #FFD700; letter-spacing: 0.05em; }
.mh-fecha { font-size: 9px; color: #8892B0; margin-top: 3px; }
.muni-box { border: 1.5px solid #1E3A5F; border-radius: 6px; padding: 7px 14px; margin-bottom: 10px; background: #f7f9fd; display: flex; align-items: center; gap: 12px; }
.muni-label { font-family: 'Barlow Condensed', sans-serif; font-size: 8.5px; font-weight: 700; color: #0A192F; text-transform: uppercase; letter-spacing: 0.07em; }
.muni-val { font-size: 11px; font-weight: 600; color: #0A192F; }
.tbl-wrap { border: 1.5px solid #CBD5E1; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
.brand-strip td { background: #0A192F; color: #8892B0; font-size: 8.5px; padding: 4px 12px; letter-spacing: 0.03em; }
.brand-strip .bs-name { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 10px; color: #FFD700; letter-spacing: 0.05em; }
.brand-strip .bs-sep { color: #334155; margin: 0 6px; }
.col-headers th { background: #1E3A5F; font-family: 'Barlow Condensed', sans-serif; font-size: 9.5px; font-weight: 700; color: #FFD700; padding: 7px 10px; text-transform: uppercase; letter-spacing: 0.06em; border-right: 1px solid #2D4A6E; text-align: left; }
.col-headers th.tc { text-align: center; }
.col-headers th.tr { text-align: right; }
.col-headers th:last-child { border-right: none; }
tbody tr { border-bottom: 1px solid #E5EAF2; page-break-inside: avoid; }
tbody tr:nth-child(even) { background: #F8FAFC; }
tbody td { padding: 6px 10px; vertical-align: top; border-right: 1px solid #E5EAF2; }
tbody td:last-child { border-right: none; }
.prod-name { font-weight: 700; font-size: 10px; color: #0A192F; }
.prod-sub  { font-size: 8.5px; color: #64748B; font-weight: 500; display: inline-block; margin-top: 2px; }
.prod-sku  { font-family: monospace; font-size: 8px; color: #94A3B8; margin-top: 3px; }
.tc { text-align: center; }
.tr { text-align: right; }
.bold { font-weight: 700; }
tfoot { display: table-row-group; page-break-inside: avoid; }
.tf-sub td { background: #F1F5F9; border-bottom: 1px solid #CBD5E1; color: #475569; font-weight: 600; font-size: 9.5px; padding: 6px 10px; }
.tf-tot td { background: #E2E8F0; color: #0A192F; font-weight: 800; font-size: 11px; padding: 8px 10px; border-bottom: none; }
.footer-note { font-size: 8.5px; color: #94A3B8; text-align: center; margin-top: 10px; font-style: italic; }
</style>

  <div class="main-header">
    <div class="mh-left">
      <div>
        <div class="mh-company">${_esc(COMPANY_NAME)}</div>
        <div class="mh-sub">ESPECIALISTAS EN EQUIPAMIENTO POLICIAL Y SEGURIDAD</div>
      </div>
    </div>
    <div class="mh-right">
      <div class="mh-folio">${folio}</div>
      <div class="mh-fecha">${dateStr}</div>
    </div>
  </div>
  <div class="muni-box">
    <div class="muni-label">Cotizaci\u00f3n para:</div>
    <div class="muni-val">${_esc(municipioVal || 'Cliente General')}</div>
  </div>
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr class="brand-strip">
          <td colspan="7">
            <span class="bs-name">${_esc(COMPANY_NAME)}</span>
            <span class="bs-sep">|</span> Cotizaci\u00f3n Confidencial
          </td>
        </tr>
        <tr class="col-headers">
          <th>Producto / SKU</th>
          <th class="tc">Color</th>
          <th class="tc">Talla</th>
          <th class="tc">Cant.</th>
          <th class="tr">Precio U.</th>
          <th class="tr">IVA 16%</th>
          <th class="tr">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr class="tf-sub">
          <td colspan="6" class="tr">SUBTOTAL S/IVA:</td>
          <td class="tr">${_fmtPDF(subtotalSinIva)}</td>
        </tr>
        <tr class="tf-sub">
          <td colspan="6" class="tr">IVA (16%):</td>
          <td class="tr">${_fmtPDF(ivaTotal)}</td>
        </tr>
        <tr class="tf-tot">
          <td colspan="6" class="tr">TOTAL C/IVA:</td>
          <td class="tr">${_fmtPDF(totalGral)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="footer-note">${TABLA_A_FOOTER}</div>
</div>`;
}
