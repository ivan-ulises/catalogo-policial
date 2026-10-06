/**
 * @file utils/orders.js
 * @description Motor de documentos de pedido y cotizaciones B2B para Suministros A. R.
 *
 * FLUJOS:
 *  1. FLUJO CLIENTE (Modal de Cotización):
 *     - Captura de datos institucionales del solicitante (Municipio, Dependencia, Titular, Teléfono, Email, RFC, Domicilios).
 *     - Persistencia versionada en localStorage (ep_b2b_applicant_v2).
 *     - Carga diferida (lazy load) de jsPDF + AutoTable solo al requerir el documento.
 *     - Generación de PDF vectorial Carta con vigencia (15 días), condiciones de entrega, pago y garantía.
 *     - Envío resiliente al backend Netlify Function con snapshot e idempotencia.
 *     - Pantalla de éxito con copia de folio, descarga de PDF, estatus y canal WhatsApp.
 *
 *  2. FLUJO ADMINISTRADOR (Protegido por contraseña):
 *     - Tabla B (requisición de producción para maquilador, confidencial y sin precios).
 *     - Destrucción inmediata del DOM al cerrar.
 */

import { formatMXN, getFormattedDate } from './format.js';

// ╔══════════════════════════════════════════════════════════════╗
// ║  CONFIGURACIÓN INSTITUCIONAL                                 ║
// ╚══════════════════════════════════════════════════════════════╝

const COMPANY_NAME = 'Suministros A. R.';
const APPLICANT_STORAGE_KEY = 'ep_b2b_applicant_v2';
const APPLICANT_LEGACY_KEY  = 'ep_b2b_applicant_v1';

const TABLA_A_FOOTER =
  'Los precios son referenciales y sujetos a confirmación formal mediante contrato o pedido institucional.';

const TABLA_B_FOOTER =
  'Requisición de producción para maquilador. Documento confidencial — no compartir precios.';

// ╔══════════════════════════════════════════════════════════════╗
// ║  ESTADO INTERNO DEL MÓDULO                                  ║
// ╚══════════════════════════════════════════════════════════════╝

let _currentOrder = null;
let _titleClickCount = 0;
let _titleClickTimer = null;
let _isSubmitting = false;

/** Promise singleton para la carga diferida de jsPDF */
let _jsPdfLoadingPromise = null;

// ╔══════════════════════════════════════════════════════════════╗
// ║  CARGA DIFERIDA DE jsPDF Y AUTOTABLE (Lazy Loading)          ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Carga de forma asíncrona las librerías jsPDF y AutoTable solo cuando se solicitan.
 * @returns {Promise<Object>} window.jspdf
 */
export async function ensureJsPdfLoaded() {
  if (window.jspdf?.jsPDF && window.jspdf.jsPDF.API?.autoTable) {
    return window.jspdf;
  }
  if (_jsPdfLoadingPromise) return _jsPdfLoadingPromise;

  _jsPdfLoadingPromise = (async () => {
    // 1. Inyectar script core de jsPDF
    await _injectScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    // 2. Inyectar plugin AutoTable
    await _injectScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    return window.jspdf;
  })();

  return _jsPdfLoadingPromise;
}

function _injectScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Fallo al cargar script: ${src}`));
    document.head.appendChild(script);
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PERSISTENCIA DE DATOS DEL SOLICITANTE                      ║
// ╚══════════════════════════════════════════════════════════════╝

function _loadApplicantData() {
  try {
    const raw = localStorage.getItem(APPLICANT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && parsed.data) {
        return parsed.data;
      }
    }
    const legacyRaw = localStorage.getItem(APPLICANT_LEGACY_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      return parsedLegacy.data || parsedLegacy;
    }
  } catch (e) {
    console.warn('[orders] Error al leer datos del solicitante en almacenamiento:', e);
  }
  return {
    municipio: '',
    dependencia: '',
    solicitante: '',
    cargo: '',
    telefono: '',
    email: '',
    rfc: '',
    domicilio_fiscal: '',
    domicilio_entrega: ''
  };
}

function _saveApplicantData(data) {
  try {
    const payload = {
      version: 2,
      savedAt: new Date().toISOString(),
      data
    };
    localStorage.setItem(APPLICANT_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[orders] Error al guardar datos del solicitante:', e);
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  API PÚBLICA                                                ║
// ╚══════════════════════════════════════════════════════════════╝

export function initOrders() {
  document.addEventListener('cart:checkout', (e) => {
    const { items, total } = e.detail;
    _currentOrder = { items, total, dateStr: getFormattedDate() };
    _openClientModal();
  });

  // Atajo de teclado: Ctrl + Shift + P para acceso admin
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      _requestAdminAccess();
    }
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FLUJO CLIENTE — Modal con Solicitante y Tabla A             ║
// ╚══════════════════════════════════════════════════════════════╝

function _openClientModal() {
  const modal = document.getElementById('sheets-modal');
  if (!modal || !_currentOrder) return;

  const { items, total, dateStr } = _currentOrder;
  const appData = _loadApplicantData();

  modal.innerHTML = `
    <div class="bg-white max-w-4xl mx-auto rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
         id="sheets-modal-inner">

      <!-- Cabecera -->
      <div class="bg-gradient-to-r from-navy via-navy-light to-navy-border px-6 py-5 flex items-start justify-between border-b border-gold/20">
        <div>
          <h2 id="modal-title-trigger"
              class="font-display text-2xl font-bold text-gold tracking-wider select-none cursor-default" title="">
            COTIZACIÓN INSTITUCIONAL
          </h2>
          <p class="text-slate-soft text-xs sm:text-sm mt-0.5">
            Ingresa los datos oficiales de la corporación para generar el expediente formal y el PDF.
          </p>
        </div>
        <button id="btn-close-modal"
                class="text-slate-soft hover:text-gold transition-colors p-2 rounded-lg -mr-2"
                aria-label="Cerrar modal">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">

        <!-- ════════════════════════════════════════════════════
             FORMULARIO: DATOS DEL SOLICITANTE (Fase 3 Requisito 2)
             ════════════════════════════════════════════════════ -->
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div class="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-200">
            <svg class="w-5 h-5 text-gold-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            <h3 class="font-display text-base sm:text-lg font-bold text-navy uppercase tracking-wide">
              Datos Oficiales del Municipio o Corporación
            </h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <!-- Municipio o Corporación -->
            <div class="md:col-span-2">
              <label for="input-municipio" class="block font-bold text-navy mb-1">
                Municipio o Corporación Solicitante <span class="text-red-500">*</span>
              </label>
              <input
                id="input-municipio"
                type="text"
                maxlength="140"
                placeholder="Ej. Municipio de Asunción Nochixtlán"
                value="${_esc(appData.municipio)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
                autocomplete="organization"
              />
              <p id="err-municipio" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Ingresa el municipio o corporación.</p>
            </div>

            <!-- Dependencia -->
            <div>
              <label for="input-dependencia" class="block font-bold text-navy mb-1">
                Dependencia / Área Requirente <span class="text-red-500">*</span>
              </label>
              <input
                id="input-dependencia"
                type="text"
                maxlength="140"
                placeholder="Ej. Dirección de Seguridad Pública y Vialidad"
                value="${_esc(appData.dependencia)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
              />
              <p id="err-dependencia" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Ingresa el área requirente.</p>
            </div>

            <!-- Titular / Solicitante y Cargo -->
            <div>
              <label for="input-solicitante" class="block font-bold text-navy mb-1">
                Nombre Completo y Cargo del Titular <span class="text-red-500">*</span>
              </label>
              <input
                id="input-solicitante"
                type="text"
                maxlength="140"
                placeholder="Ej. Cmdte. Roberto Morales Morales - Director"
                value="${_esc(appData.solicitante)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
                autocomplete="name"
              />
              <p id="err-solicitante" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Ingresa el nombre y cargo del solicitante.</p>
            </div>

            <!-- Teléfono Institucional -->
            <div>
              <label for="input-telefono" class="block font-bold text-navy mb-1">
                Teléfono Institucional / Móvil <span class="text-red-500">*</span>
              </label>
              <input
                id="input-telefono"
                type="tel"
                maxlength="30"
                placeholder="Ej. 951 123 4567"
                value="${_esc(appData.telefono)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
                autocomplete="tel"
              />
              <p id="err-telefono" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Ingresa un teléfono de contacto.</p>
            </div>

            <!-- Correo Oficial -->
            <div>
              <label for="input-email" class="block font-bold text-navy mb-1">
                Correo Electrónico Oficial <span class="text-red-500">*</span>
              </label>
              <input
                id="input-email"
                type="email"
                maxlength="120"
                placeholder="Ej. seguridad@municipio.gob.mx"
                value="${_esc(appData.email)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
                autocomplete="email"
              />
              <p id="err-email" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Ingresa un correo electrónico válido.</p>
            </div>

            <!-- RFC Institucional -->
            <div>
              <label for="input-rfc" class="block font-bold text-navy mb-1">
                RFC Institucional <span class="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="input-rfc"
                type="text"
                maxlength="20"
                placeholder="Ej. MAN850101XYZ"
                value="${_esc(appData.rfc)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white uppercase focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
              />
            </div>

            <!-- Domicilio Fiscal -->
            <div>
              <label for="input-domicilio-fiscal" class="block font-bold text-navy mb-1">
                Domicilio Fiscal <span class="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="input-domicilio-fiscal"
                type="text"
                maxlength="180"
                placeholder="Ej. Palacio Municipal S/N, Centro, C.P. 68000"
                value="${_esc(appData.domicilio_fiscal)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
              />
            </div>

            <!-- Domicilio de Entrega -->
            <div class="md:col-span-2">
              <label for="input-domicilio-entrega" class="block font-bold text-navy mb-1">
                Domicilio de Entrega de Bienes <span class="text-red-500">*</span>
              </label>
              <input
                id="input-domicilio-entrega"
                type="text"
                maxlength="180"
                placeholder="Ej. Comandancia de Policía Municipal o Cuartel General"
                value="${_esc(appData.domicilio_entrega)}"
                class="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-colors"
              />
              <p id="err-domicilio-entrega" class="text-[11px] text-red-500 font-bold hidden mt-1">⚠ Especifica la dirección de entrega.</p>
            </div>
          </div>

          <div class="mt-2.5 text-[11px] text-gray-400">
            * Datos requeridos para la emisión del oficio de cotización y expediente de adquisición pública.
          </div>
        </div>

        <!-- Campo Honeypot anti-spam -->
        <div style="position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;" aria-hidden="true">
          <input id="input-website-hp" type="text" name="b_website_corp" tabindex="-1" value="" autocomplete="off" />
        </div>

        <!-- ════════════════════════════════════════════════════
             TABLA A — DETALLE DE PARTIDAS
             ════════════════════════════════════════════════════ -->
        <section aria-label="Detalle de cotización">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <span class="bg-navy text-gold font-display font-bold text-sm px-3 py-1 rounded-lg tracking-wide">
                PARTIDAS
              </span>
              <div>
                <h3 class="font-display text-lg font-bold text-navy tracking-wide">
                  DESGLOSE DEL EQUIPO SOLICITADO
                </h3>
                <p class="text-xs text-gray-500">Valores unitarios, IVA (16%) y subtotales oficiales.</p>
              </div>
            </div>
            <button data-copy-table="table-a"
                    class="copy-btn flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-navy hover:text-gold px-3 py-2 rounded-lg transition-colors font-medium">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
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
                      <td colspan="6" class="text-right font-semibold text-gray-600 text-sm px-4 py-2">
                        SUBTOTAL S/IVA:
                      </td>
                      <td class="text-right font-semibold text-gray-700 text-sm px-4 py-2">
                        ${formatMXN(subtotalSinIva)}
                      </td>
                    </tr>
                    <tr>
                      <td colspan="6" class="text-right font-semibold text-gray-600 text-sm px-4 py-2">
                        IVA (16%):
                      </td>
                      <td class="text-right font-semibold text-gray-700 text-sm px-4 py-2">
                        ${formatMXN(ivaTotal)}
                      </td>
                    </tr>
                    <tr class="bg-navy/5">
                      <td colspan="6" class="text-right font-display font-bold text-navy text-sm px-4 py-3">
                        TOTAL C/IVA:
                      </td>
                      <td class="text-right font-display font-bold text-navy text-base px-4 py-3">
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
             BOTÓN PRINCIPAL: FINALIZAR Y GENERAR EXPEDIENTE
             ════════════════════════════════════════════════════ -->
        <div class="bg-navy rounded-2xl p-4 sm:p-5 text-center">
          <p class="text-slate-light text-xs mb-3.5 leading-relaxed">
            Se generará el folio oficial, el archivo PDF vectorial Carta y se registrará en el sistema de adquisiciones.
          </p>
          <button id="btn-submit-order"
                  class="w-full py-4 rounded-xl font-display font-bold text-base tracking-wide flex items-center justify-center gap-3 transition-all duration-200 shadow-lg bg-gold hover:bg-gold-hover text-navy hover:scale-[1.01] active:scale-[0.99]"
                  aria-live="polite">
            <span id="submit-icon-idle">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </span>
            <span id="submit-label">FINALIZAR Y REGISTRAR COTIZACIÓN</span>
          </button>
          <p id="submit-feedback" class="text-xs text-center mt-2 min-h-[1.2rem] text-slate-soft hidden"></p>
        </div>

        <!-- Botones Secundarios -->
        <div class="flex flex-wrap gap-3 pt-2 border-t border-gray-200 justify-between items-center">
          <div class="flex gap-2">
            <button id="btn-print-client"
                    class="bg-gray-100 hover:bg-navy hover:text-gold text-navy font-display font-bold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              Vista Previa Impresión
            </button>
          </div>

          <button id="btn-close-modal-footer"
                  class="px-5 py-2.5 rounded-xl text-xs text-gray-500 hover:text-navy hover:bg-gray-100 font-medium transition-colors">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Cerrar modal
  const closeModal = () => {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.body.style.overflow = '';
    _resetTitleClickCounter();
  };

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-modal-footer')?.addEventListener('click', closeModal);
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Copiar tabla
  modal.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => _copyTableToClipboard(btn.dataset.copyTable));
  });

  // Vista de impresión rápida
  document.getElementById('btn-print-client')?.addEventListener('click', () => {
    const applicant = _validateAndGetApplicant();
    if (applicant) {
      _printClientOnly(items, total, dateStr, applicant);
    }
  });

  // Triple-clic en el título para acceso admin protegido
  document.getElementById('modal-title-trigger')?.addEventListener('click', _handleTitleClick);

  // Submit principal
  document.getElementById('btn-submit-order')?.addEventListener('click', () => _handleSubmitOrder(items, total, dateStr));
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  VALIDACIÓN DE FORMULARIO                                    ║
// ╚══════════════════════════════════════════════════════════════╝

function _validateAndGetApplicant() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const setErr = (id, show) => {
    const err = document.getElementById(`err-${id}`);
    const inp = document.getElementById(`input-${id}`);
    if (err) err.classList.toggle('hidden', !show);
    if (inp) inp.classList.toggle('border-red-400', show);
    if (inp) inp.classList.toggle('ring-2', show);
    if (inp) inp.classList.toggle('ring-red-200', show);
  };

  const applicant = {
    municipio:         getVal('input-municipio'),
    dependencia:       getVal('input-dependencia'),
    solicitante:       getVal('input-solicitante'),
    telefono:          getVal('input-telefono'),
    email:             getVal('input-email'),
    rfc:               getVal('input-rfc').toUpperCase(),
    domicilio_fiscal:  getVal('input-domicilio-fiscal'),
    domicilio_entrega: getVal('input-domicilio-entrega')
  };

  let valid = true;
  let firstInvalid = null;

  const checkRequired = (field, id) => {
    if (!applicant[field]) {
      setErr(id, true);
      valid = false;
      if (!firstInvalid) firstInvalid = document.getElementById(`input-${id}`);
    } else {
      setErr(id, false);
    }
  };

  checkRequired('municipio', 'municipio');
  checkRequired('dependencia', 'dependencia');
  checkRequired('solicitante', 'solicitante');
  checkRequired('telefono', 'telefono');
  checkRequired('email', 'email');
  checkRequired('domicilio_entrega', 'domicilio-entrega');

  // Validar formato básico de correo
  if (applicant.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) {
    setErr('email', true);
    valid = false;
    if (!firstInvalid) firstInvalid = document.getElementById('input-email');
  }

  if (!valid) {
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
    }
    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: '⚠ Por favor completa los campos obligatorios del solicitante' }
    }));
    return null;
  }

  // Guardar en localStorage para futuras visitas
  _saveApplicantData(applicant);
  return applicant;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PROCESAMIENTO Y ENVÍO DEL PEDIDO                            ║
// ╚══════════════════════════════════════════════════════════════╝

async function _handleSubmitOrder(items, total, dateStr) {
  if (_isSubmitting) return;
  if (!items || items.length === 0) return;

  const applicant = _validateAndGetApplicant();
  if (!applicant) return;

  const btn = document.getElementById('btn-submit-order');
  const label = document.getElementById('submit-label');
  const feedback = document.getElementById('submit-feedback');

  if (!btn || !label) return;

  // Estado: LOADING
  _isSubmitting = true;
  btn.disabled = true;
  btn.classList.replace('bg-gold', 'bg-[#1E3A5F]');
  btn.classList.add('cursor-not-allowed', 'opacity-90');
  label.textContent = 'Generando documento y procesando orden…';
  
  const iconSpan = document.getElementById('submit-icon-idle');
  if (iconSpan) {
    iconSpan.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
    `;
  }
  if (feedback) {
    feedback.textContent = 'Preparando PDF vectorial y validando partidas…';
    feedback.classList.remove('hidden');
  }

  let finalFolio = 'COT-' + new Date().getFullYear() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
  let generatedPdf = null;

  try {
    // 1. Cargar jsPDF de forma diferida
    await ensureJsPdfLoaded();

    // 2. Clave de idempotencia
    if (!_currentOrder.idempotencyKey) {
      _currentOrder.idempotencyKey = 'IDEM-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    // 3. Generar PDF vectorial con condiciones institucionales
    generatedPdf = _buildInvoicePDF(items, dateStr, applicant, finalFolio);
    const pdfBase64 = generatedPdf.base64;

    // 4. Honeypot check
    const honeypotVal = document.getElementById('input-website-hp')?.value || '';

    // 5. Payload para la función serverless
    const payload = {
      items,
      total,
      municipio: applicant.municipio,
      applicant,
      dateStr,
      folio: finalFolio,
      idempotency_key: _currentOrder.idempotencyKey
    };

    if (feedback) feedback.textContent = 'Registrando en base de datos y notificando por correo…';

    const response = await fetch('/.netlify/functions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, pdfBase64, honeypot: honeypotVal })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al guardar la cotización');
    }

    const resData = await response.json();
    finalFolio = resData.folio || finalFolio;

    // Éxito: Renderizar la Pantalla de Éxito oficial (Requisito 6)
    _renderSuccessScreen(finalFolio, applicant, generatedPdf, items, total);

  } catch (err) {
    console.error('[orders] Error al procesar cotización:', err);
    _isSubmitting = false;
    btn.disabled = false;
    btn.classList.replace('bg-[#1E3A5F]', 'bg-red-700');
    label.textContent = 'Error al enviar — Reintentar';
    if (feedback) {
      feedback.textContent = err.message || 'Error de conexión. Por favor reintenta.';
      feedback.classList.add('text-red-400');
    }
    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: `⚠ ${err.message || 'Error al registrar pedido'}` }
    }));
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PANTALLA DE ÉXITO (Requisito 6 de Fase 3)                   ║
// ╚══════════════════════════════════════════════════════════════╝

function _renderSuccessScreen(folio, applicant, generatedPdf, items, total) {
  const modal = document.getElementById('sheets-modal');
  if (!modal) return;

  const totalPiezas = items.reduce((s, i) => s + i.qty, 0);

  modal.innerHTML = `
    <div class="bg-white max-w-2xl mx-auto rounded-2xl shadow-2xl overflow-hidden border-2 border-gold/40 p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 shadow-sm">
        <svg class="w-9 h-9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>

      <h2 class="font-display text-2xl sm:text-3xl font-bold text-navy tracking-wide uppercase mb-1">
        ¡REQUISICIÓN REGISTRADA CON ÉXITO!
      </h2>
      <p class="text-xs sm:text-sm text-gray-500 mb-6 max-w-lg mx-auto">
        Tu cotización ha sido formalmente registrada en Suministros A. R. y enviada para revisión técnica y reserva de producción.
      </p>

      <!-- Caja del Folio Copiable -->
      <div class="bg-navy text-white rounded-2xl p-5 mb-6 border border-gold/30 shadow-inner">
        <span class="text-[11px] font-bold text-gold uppercase tracking-widest block mb-1">
          FOLIO OFICIAL DE EXPEDIENTE
        </span>
        <div class="flex items-center justify-center gap-3">
          <span id="success-folio-val" class="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-wider">
            ${_esc(folio)}
          </span>
          <button id="btn-copy-folio"
                  class="bg-navy-light hover:bg-gold hover:text-navy text-gold p-2.5 rounded-xl transition-all border border-gold/40 flex items-center gap-1 text-xs font-bold"
                  title="Copiar folio al portapapeles">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            <span id="copy-folio-label">Copiar</span>
          </button>
        </div>
        <div class="mt-2.5 flex items-center justify-center gap-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
            ● Estatus: Registrada en Sistema / En Revisión
          </span>
        </div>
      </div>

      <!-- Resumen institucional -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left mb-6 space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-500">Municipio / Corporación:</span>
          <strong class="text-navy text-right font-bold">${_esc(applicant.municipio)}</strong>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Área Requirente:</span>
          <span class="text-navy text-right font-medium">${_esc(applicant.dependencia)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Total de Piezas:</span>
          <strong class="text-navy">${totalPiezas} piezas</strong>
        </div>
        <div class="flex justify-between pt-1.5 border-t border-slate-200">
          <span class="text-navy font-bold">Importe Total con IVA:</span>
          <strong class="text-gold-dark font-display text-lg font-bold">${formatMXN(total)}</strong>
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="space-y-3">
        <!-- Descarga directa del PDF -->
        <button id="btn-download-pdf-action"
                class="w-full py-3.5 bg-navy hover:bg-navy-light text-gold font-display font-bold text-sm rounded-xl transition-all shadow flex items-center justify-center gap-2 tracking-wide">
          <svg class="w-5 h-5 text-gold" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          DESCARGAR COTIZACIÓN EN PDF (CARTA)
        </button>

        <!-- Continuar por WhatsApp con el folio ya incluido -->
        <button id="btn-success-whatsapp"
                class="w-full py-3 bg-[#25D366] hover:bg-[#1da851] text-white font-display font-bold text-sm rounded-xl transition-all shadow flex items-center justify-center gap-2 tracking-wide">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.122 1.528 5.854L.057 23.057a.75.75 0 00.921.921l5.204-1.471A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.71 9.71 0 01-4.964-1.36l-.357-.212-3.688 1.043 1.044-3.688-.213-.357A9.712 9.712 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          CONTINUAR POR WHATSAPP CON MI FOLIO
        </button>

        <!-- Finalizar y limpiar -->
        <button id="btn-success-close"
                class="w-full py-2.5 text-xs text-gray-500 hover:text-navy hover:bg-gray-100 rounded-xl transition-colors font-medium">
          Finalizar y Volver al Catálogo
        </button>
      </div>
    </div>
  `;

  // Copiar Folio
  document.getElementById('btn-copy-folio')?.addEventListener('click', () => {
    navigator.clipboard.writeText(folio).then(() => {
      const lbl = document.getElementById('copy-folio-label');
      if (lbl) lbl.textContent = '¡Copiado!';
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: `📋 Folio ${folio} copiado` } }));
      setTimeout(() => { if (lbl) lbl.textContent = 'Copiar'; }, 2500);
    });
  });

  // Descarga del PDF
  document.getElementById('btn-download-pdf-action')?.addEventListener('click', () => {
    if (generatedPdf && generatedPdf.doc) {
      const filename = `${folio}_${applicant.municipio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      generatedPdf.doc.save(filename);
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '⬇ Descargando cotización formal en PDF' } }));
    }
  });

  // WhatsApp con Folio
  document.getElementById('btn-success-whatsapp')?.addEventListener('click', () => {
    const waText = encodeURIComponent(
      `Hola Suministros A. R., registré la cotización institucional con Folio *${folio}* ` +
      `para el Municipio de *${applicant.municipio}* (${totalPiezas} piezas, Total: ${formatMXN(total)}). ` +
      `Adjunto daré seguimiento para revisión técnica y tiempos de entrega.`
    );
    window.open(`https://wa.me/529513070420?text=${waText}`, '_blank');
  });

  // Cerrar y limpiar
  document.getElementById('btn-success-close')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.body.style.overflow = '';
    _isSubmitting = false;
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERADOR PDF VECTORIAL CARTA (Fase 3 Requisito 3)          ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Construye el documento formal en PDF Carta multipágina usando jsPDF y AutoTable.
 * @param {Array}  items
 * @param {string} dateStr
 * @param {Object} applicant
 * @param {string} folio
 * @returns {{ base64: string, doc: Object }}
 */
function _buildInvoicePDF(items, dateStr, applicant, folio) {
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor) throw new Error('jsPDF no está cargado');

  const doc = new jsPDFCtor({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth();   // 612 pt
  const PH = doc.internal.pageSize.getHeight();  // 792 pt
  const M  = 36;                                 // Margen 36 pt (0.5 in)
  const CW = PW - M * 2;                         // 540 pt útil

  const NAVY = [10, 25, 47], NAVY2 = [30, 58, 95], GOLD = [255, 215, 0];
  const GRAY = [100, 116, 139], LIGHT = [248, 250, 252], LINE = [203, 213, 225];

  const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const totalGral      = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const subtotalSinIva = totalGral / 1.16;
  const ivaTotal       = totalGral - subtotalSinIva;
  const totalPiezas    = items.reduce((s, i) => s + i.qty, 0);

  // 1. Membrete Superior
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, 36, CW, 60, 5, 5, 'F');
  
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(COMPANY_NAME, M + 16, 62);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(136, 146, 176);
  doc.text('EQUIPAMIENTO POLICIAL, UNIFORMES Y SEGURIDAD MUNICIPAL', M + 16, 76);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(folio, PW - M - 16, 60, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(136, 146, 176);
  doc.text(`Fecha: ${dateStr}`, PW - M - 16, 75, { align: 'right' });

  // 2. Bloque Institucional del Solicitante (2 columnas)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...NAVY2);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, 104, CW, 64, 4, 4, 'FD');

  const colW = (CW - 24) / 2;

  // Columna Izquierda: Entidad y Titular
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY2);
  doc.text('ENTIDAD / CORPORACIÓN SOLICITANTE:', M + 12, 118);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(doc.splitTextToSize(applicant.municipio || 'Cliente General', colW)[0], M + 12, 130);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const depStr = applicant.dependencia ? `Área: ${applicant.dependencia}` : '';
  doc.text(doc.splitTextToSize(depStr, colW)[0], M + 12, 142);
  
  const solStr = applicant.solicitante ? `Titular: ${applicant.solicitante}` : '';
  doc.text(doc.splitTextToSize(solStr, colW)[0], M + 12, 153);

  // Columna Derecha: Contacto y Entrega
  const rx = M + colW + 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY2);
  doc.text('DATOS DE ENTREGA Y CONTACTO:', rx, 118);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`Tel: ${applicant.telefono || '—'}   |   Email: ${applicant.email || '—'}`, rx, 130);
  doc.text(`RFC: ${applicant.rfc || 'No especificado'}`, rx, 142);
  const entregaStr = `Entrega en: ${applicant.domicilio_entrega || 'Comandancia Municipal'}`;
  doc.text(doc.splitTextToSize(entregaStr, colW)[0], rx, 153);

  // 3. Tabla de Partidas con AutoTable
  const rows = items.map(item => {
    const unitBase = item.unitPrice / 1.16;
    return [
      '', // Dibujado a mano en didDrawCell
      item.color || '—',
      item.size || '—',
      String(item.qty),
      money(unitBase),
      money(item.unitPrice - unitBase),
      money(item.qty * item.unitPrice),
    ];
  });

  const colProdW = 195;
  doc.autoTable({
    startY: 176,
    margin: { left: M, right: M, top: 40, bottom: 65 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    head: [['PARTIDA / PRODUCTO / SKU', 'COLOR', 'TALLA', 'CANT.', 'PRECIO U.', 'IVA 16%', 'SUBTOTAL']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: NAVY,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      valign: 'middle',
      lineColor: LINE,
      lineWidth: 0
    },
    headStyles: {
      fillColor: NAVY2,
      textColor: GOLD,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 6
    },
    columnStyles: {
      0: { cellWidth: colProdW, halign: 'left' },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 45, halign: 'center' },
      3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 75, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: LIGHT },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) data.cell.styles.halign = 'left';
      if (data.section === 'head' && data.column.index >= 4) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 0) {
        const it = items[data.row.index];
        const detail = [it.variant, it.slotInfo].filter(Boolean).join(' · ');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const nameLines = doc.splitTextToSize(String(it.name || ''), colProdW - 10);
        data.cell.raw = { nameLines, detail, sku: it.sku || '' };
        data.cell.styles.minCellHeight = 10 + nameLines.length * 10 + (detail ? 9 : 0) + 9;
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.5);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
      if (data.section === 'body' && data.column.index === 0 && data.cell.raw && data.cell.raw.nameLines) {
        const { nameLines, detail, sku } = data.cell.raw;
        let y = data.cell.y + 12;
        const x = data.cell.x + 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        nameLines.forEach(l => { doc.text(l, x, y); y += 10; });
        if (detail) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...GRAY);
          doc.text(doc.splitTextToSize(detail, colProdW - 10)[0], x, y);
          y += 9;
        }
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(String(sku), x, y);
      }
    },
  });

  // 4. Bloque de Totales
  let y = doc.lastAutoTable.finalY + 12;
  if (y + 130 > PH - 65) {
    doc.addPage();
    y = 45;
  }

  const bx = PW - M - 230, bw = 230;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(bx, y, bw, 48, 4, 4, 'FD');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal sin IVA:', bx + 12, y + 17);
  doc.text(money(subtotalSinIva), bx + bw - 12, y + 17, { align: 'right' });
  
  doc.text('IVA Trasladado (16%):', bx + 12, y + 36);
  doc.text(money(ivaTotal), bx + bw - 12, y + 36, { align: 'right' });

  doc.setFillColor(...NAVY);
  doc.roundedRect(bx, y + 54, bw, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD);
  doc.text('TOTAL GENERAL (c/IVA):', bx + 12, y + 72);
  doc.setFontSize(12);
  doc.text(money(totalGral), bx + bw - 12, y + 73, { align: 'right' });

  // Resumen a la izquierda de los totales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('RESUMEN DE ADQUISICIÓN:', M, y + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`• Total de partidas: ${items.length}`, M, y + 28);
  doc.text(`• Total de piezas físicas: ${totalPiezas} piezas`, M, y + 40);
  doc.text(`• Moneda: Pesos Mexicanos (MXN)`, M, y + 52);

  // 5. Condiciones Institucionales B2B (Fase 3 Requisito 3)
  let cy = y + 92;
  if (cy + 75 > PH - 65) {
    doc.addPage();
    cy = 45;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, cy, CW, 70, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('TÉRMINOS Y CONDICIONES COMERCIALES (SEGURIDAD PÚBLICA B2B):', M + 10, cy + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  
  const condiciones = [
    '1. Vigencia de la cotización: 15 días naturales a partir de la fecha de emisión del presente documento.',
    '2. Tiempo de entrega: 21 días hábiles posteriores a la confirmación formal del pedido y recepción de anticipo (sistema de maquila especializada).',
    '3. Condiciones de pago: 50% de anticipo al inicio de producción y 50% finiquito contra aviso de embarque o entrega física.',
    '4. Garantía: 90 días naturales contra defectos de confección o vicios ocultos de materiales en uso normal.',
    '5. Variación de precios: Precios en MXN, IVA 16% incluido. Sujetos a confirmación formal mediante contrato o pedido institucional.'
  ];

  condiciones.forEach((c, idx) => {
    doc.text(c, M + 10, cy + 24 + idx * 9);
  });

  // 6. Pie de Página en Todas las Páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, PH - 38, PW - M, PH - 38);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${COMPANY_NAME} · ${folio} · Documento Institucional de Requisición`, M, PH - 25);
    doc.text(`Página ${p} de ${pages}`, PW - M, PH - 25, { align: 'right' });
  }

  return {
    base64: doc.output('datauristring'),
    doc
  };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FILAS DE TABLA A Y TABLA B                                  ║
// ╚══════════════════════════════════════════════════════════════╝

function _buildTableARows(items) {
  return items.map(item => {
    const totalLinea    = item.qty * item.unitPrice;
    const unitPriceBase = item.unitPrice / 1.16;
    const ivaUnitario   = item.unitPrice - unitPriceBase;

    return `
      <tr>
        <td class="px-4 py-2.5">
          <p class="font-semibold text-navy leading-snug">
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
        <td class="px-3 py-2.5 text-center font-bold text-navy">${item.qty}</td>
        <td class="px-4 py-2.5 text-right text-gray-700">${formatMXN(unitPriceBase)}</td>
        <td class="px-4 py-2.5 text-right text-gray-500 text-sm">${formatMXN(ivaUnitario)}</td>
        <td class="px-4 py-2.5 text-right font-bold text-navy">
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
        <p class="font-semibold text-navy leading-snug">
          ${_esc(item.name)}
          ${item.variant ? `<span style="color:#A88E00; font-size:0.9em; font-style:italic"> (${_esc(item.variant)})</span>` : ''}
        </p>
        <p class="text-xs text-gray-400 font-mono">${_esc(item.sku)}</p>
      </td>
      <td class="px-3 py-2.5 text-center font-bold">${_esc(item.size)}</td>
      <td class="px-3 py-2.5 text-center font-bold text-navy">${item.qty}</td>
      <td class="px-4 py-2.5 text-sm text-gray-400 italic">—</td>
    </tr>
  `).join('');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  VISTA DE IMPRESIÓN RÁPIDA                                   ║
// ╚══════════════════════════════════════════════════════════════╝

function _printClientOnly(items, total, dateStr, applicant) {
  const totalGral      = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const subtotalSinIva = totalGral / 1.16;
  const ivaTotal       = totalGral - subtotalSinIva;
  const folio          = "COT-" + Date.now().toString(36).toUpperCase();

  const rowsHTML = items.map(item => {
    const unitBase  = item.unitPrice / 1.16;
    const ivaUnit   = item.unitPrice - unitBase;
    const subtotal  = item.qty * item.unitPrice;
    return `
      <tr>
        <td>
          <strong>${_esc(item.name)}</strong>
          ${item.variant ? `<br/><small>(${_esc(item.variant)})</small>` : ''}
          <div style="font-family:monospace;font-size:8px;color:#888">${_esc(item.sku)}</div>
        </td>
        <td style="text-align:center">${item.color || '—'}</td>
        <td style="text-align:center;font-weight:bold">${_esc(item.size)}</td>
        <td style="text-align:center;font-weight:bold">${item.qty}</td>
        <td style="text-align:right">${formatMXN(unitBase)}</td>
        <td style="text-align:right">${formatMXN(ivaUnit)}</td>
        <td style="text-align:right;font-weight:bold">${formatMXN(subtotal)}</td>
      </tr>
    `;
  }).join('');

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) { window.print(); return; }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Cotización ${folio}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:30px;color:#112240;font-size:11px}
      .hdr{background:#0A192F;color:#FFD700;padding:15px;border-radius:6px;display:flex;justify-content:space-between}
      .app-box{background:#f8fafc;border:1px solid #cbd5e1;padding:10px 14px;border-radius:6px;margin:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#1E3A5F;color:#FFD700;padding:7px;text-align:left;font-size:10px}
      td{padding:6px;border-bottom:1px solid #e2e8f0}
      .tot{background:#f1f5f9;font-weight:bold}
      .cond{margin-top:15px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;font-size:9.5px;color:#475569}
    </style>
    </head><body>
      <div class="hdr">
        <div><h2 style="margin:0">${COMPANY_NAME}</h2><small>EQUIPAMIENTO POLICIAL Y SEGURIDAD MUNICIPAL</small></div>
        <div style="text-align:right"><h3 style="margin:0">${folio}</h3><small>${dateStr}</small></div>
      </div>
      <div class="app-box">
        <strong>Solicitante:</strong> ${_esc(applicant.municipio)} | <strong>Área:</strong> ${_esc(applicant.dependencia)}<br/>
        <strong>Titular:</strong> ${_esc(applicant.solicitante)} | <strong>Tel:</strong> ${_esc(applicant.telefono)} | <strong>Email:</strong> ${_esc(applicant.email)}
      </div>
      <table>
        <thead><tr><th>Partida / Producto</th><th>Color</th><th>Talla</th><th>Cant.</th><th>Precio U.</th><th>IVA 16%</th><th>Subtotal</th></tr></thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr class="tot"><td colspan="6" style="text-align:right">Subtotal s/IVA:</td><td style="text-align:right">${formatMXN(subtotalSinIva)}</td></tr>
          <tr class="tot"><td colspan="6" style="text-align:right">IVA 16%:</td><td style="text-align:right">${formatMXN(ivaTotal)}</td></tr>
          <tr style="background:#0A192F;color:#FFD700;font-weight:bold"><td colspan="6" style="text-align:right">TOTAL C/IVA:</td><td style="text-align:right">${formatMXN(totalGral)}</td></tr>
        </tfoot>
      </table>
      <div class="cond">
        <strong>Condiciones B2B:</strong> Vigencia: 15 días naturales · Entrega: 21 días hábiles · Pago: 50% anticipo, 50% contra aviso de entrega · Garantía: 90 días naturales.
      </div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>`);
  win.document.close();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FLUJO ADMIN PROTEGIDO (Tabla B Maquila)                     ║
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
    alert('No hay ninguna cotización activa. Genera una lista primero.');
    return;
  }

  let authModal = document.getElementById('admin-auth-modal');
  if (!authModal) {
    authModal = document.createElement('div');
    authModal.id = 'admin-auth-modal';
    authModal.className = 'fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4';
    authModal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-gold">
        <h3 class="font-display font-bold text-navy text-xl mb-1 flex items-center gap-2">
          <svg class="w-5 h-5 text-gold" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          Acceso Restringido
        </h3>
        <p class="text-xs text-gray-500 mb-4">Ingresa la contraseña de administrador.</p>
        <form id="admin-auth-form" class="space-y-4">
          <div>
            <input type="password" id="admin-auth-input" class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:outline-none transition-colors" placeholder="Contraseña..." autocomplete="off">
            <p id="admin-auth-error" class="text-xs text-red-500 mt-1.5 hidden font-bold"></p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="admin-auth-cancel" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
            <button type="submit" id="admin-auth-submit" class="px-5 py-2 text-sm bg-navy text-gold rounded-lg hover:bg-navy-light flex items-center gap-2 font-bold tracking-wide transition-colors">
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

  input.value = '';
  errorEl.classList.add('hidden');
  authModal.classList.remove('hidden');
  setTimeout(() => input.focus(), 60);

  const close = () => {
    authModal.classList.add('hidden');
    form.onsubmit = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = close;

  form.onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim() === 'admin2026') {
      close();
      _openAdminModal();
    } else {
      errorEl.textContent = 'Contraseña incorrecta.';
      errorEl.classList.remove('hidden');
      input.focus();
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
    adminModal.className = 'fixed inset-0 bg-black/70 z-[80] overflow-y-auto py-8 px-3';
    document.body.appendChild(adminModal);
  }

  adminModal.innerHTML = `
    <div class="bg-white max-w-3xl mx-auto rounded-2xl shadow-2xl overflow-hidden border-4 border-amber-400">
      <div class="bg-amber-400 px-6 py-4 flex items-start justify-between">
        <div>
          <h2 class="font-display text-2xl font-bold text-navy tracking-wider">
            🔐 REQUISICIÓN PARA PROVEEDOR
          </h2>
          <p class="text-navy/70 text-sm font-semibold mt-0.5">
            MODO ADMINISTRADOR — Documento interno para maquila (sin precios)
          </p>
        </div>
        <button id="btn-close-admin" class="text-navy/60 hover:text-navy p-2 rounded-lg" aria-label="Cerrar admin">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-5 sm:p-6 space-y-4">
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
                <td colspan="2" class="font-display font-bold text-navy text-sm px-4 py-3">TOTAL DE PIEZAS:</td>
                <td class="text-center font-display font-bold text-navy text-base px-4 py-3">${totalPiezas}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="text-xs text-gray-400 italic">${TABLA_B_FOOTER}</p>
      </div>
    </div>
  `;

  adminModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const close = () => {
    adminModal.innerHTML = '';
    adminModal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  document.getElementById('btn-close-admin')?.addEventListener('click', close);
  adminModal.onclick = (e) => { if (e.target === adminModal) close(); };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  UTILIDADES                                                 ║
// ╚══════════════════════════════════════════════════════════════╝

async function _copyTableToClipboard(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const text = [...table.querySelectorAll('tr')]
    .map(row => [...row.querySelectorAll('th,td')].map(cell => cell.innerText.replace(/\n/g, ' ').trim()).join('\t'))
    .join('\n');
  try {
    await navigator.clipboard.writeText(text);
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '📋 Tabla copiada al portapapeles' } }));
  } catch {
    document.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: '📋 Selección lista para copiar' } }));
  }
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
