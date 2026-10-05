/**
 * @file utils/whatsapp.js
 * @description Integración con WhatsApp Web/App.
 *
 * RESPONSABILIDAD ÚNICA: Tomar el estado del carrito, generar un
 * mensaje de texto formateado y abrir el enlace wa.me correcto.
 *
 * CONEXIONES:
 *   ← Escucha evento: 'cart:whatsapp' (de cart.js y orders.js)
 *   → Llama a:        window.open() con URL de WhatsApp
 *   → Usa utilidad:   utils/format.js
 *
 * ADMIN:
 *   - Cambia WHATSAPP_NUMBER con tu número real.
 *   - Ajusta el texto de GREETING / FOOTER según tu estilo comercial.
 */

import { formatMXN, getFormattedDate } from './format.js';

// ─── Configuración ─────────────────────────────────────────────

/**
 * Número de WhatsApp del vendedor.
 * ADMIN: Formato internacional sin + ni espacios.
 *   México:        521XXXXXXXXXX  (52 = país, 1 = prefijo celular)
 *   Ejemplo Gdl.:  5213312345678
 *
 * @type {string}
 */
const WHATSAPP_NUMBER = '5219512683438'; // ← CAMBIA ESTE NÚMERO

/**
 * Nombre de la empresa para el mensaje.
 * ADMIN: Cambia al nombre real de tu negocio.
 * @type {string}
 */
const COMPANY_NAME = 'Suministros A. R.';

/**
 * Días de entrega para incluir en el mensaje.
 * ADMIN: Ajusta si cambias la política de entrega.
 * @type {number}
 */
const DELIVERY_DAYS = 21;

// ─── API pública ───────────────────────────────────────────────

/**
 * Inicializa el módulo de WhatsApp:
 * - Escucha 'cart:whatsapp' para enviar el pedido.
 * - Configura el botón flotante (#wa-float).
 */
export function initWhatsApp() {
  // Escucha el evento disparado por cart.js y orders.js
  document.addEventListener('cart:whatsapp', (e) => {
    const { items, total, municipio = '' } = e.detail;
    sendOrderViaWhatsApp(items, total, municipio);
  });

  // Botón flotante: si hay items en carrito → envía pedido, si no → saludo genérico
  document.getElementById('wa-float')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Leer el badge para saber si hay ítems
    const badge = document.getElementById('cart-badge');
    const count = parseInt(badge?.textContent || '0');

    if (count > 0) {
      // Disparar el evento para que cart.js provea los datos
      document.dispatchEvent(new CustomEvent('wa:floatClick'));
    } else {
      _openWhatsApp(_buildGreetingMessage());
    }
  });
}

/**
 * Genera el mensaje del pedido y abre WhatsApp.
 *
 * @param {import('../components/cart.js').CartItem[]} items - Ítems del carrito
 * @param {number} total - Total general en MXN
 */
export function sendOrderViaWhatsApp(items, total, municipio = '') {
  if (!items || items.length === 0) {
    document.dispatchEvent(new CustomEvent('ui:toast', {
      detail: { msg: '⚠ La lista está vacía' },
    }));
    return;
  }

  const message = _buildOrderMessage(items, total, municipio);
  _openWhatsApp(message);
}

// ─── Constructores de mensaje ──────────────────────────────────

/**
 * Construye el mensaje completo del pedido en texto plano amigable.
 * Usa formato de WhatsApp: *negrita*, _cursiva_.
 *
 * @param {import('../components/cart.js').CartItem[]} items
 * @param {number} total
 * @returns {string}
 * @private
 */
function _buildOrderMessage(items, total, municipio = '') {
  const date = getFormattedDate();
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // ── Encabezado ──
  // Incluye el municipio si fue proporcionado
  const municipioLine = municipio ? `\n🏛️ *Municipio/Agencia:* ${municipio}` : '';
  const header = [
    `🛡️ *SOLICITUD DE PEDIDO — ${COMPANY_NAME}*`,
    `📅 *Fecha:* ${date}${municipioLine}`,
    ``,
  ].join('\n');

  // ── Líneas de productos ──
  const separator = '─'.repeat(32);
  const productLines = items.map((item, idx) => {
    const subtotal = item.qty * item.unitPrice;
    return [
      `*${idx + 1}. ${item.name}*`,
      `   • SKU: \`${item.sku}\``,
      `   • Talla: *${item.size}* | Cantidad: *${item.qty} pzs*`,
      `   • Precio unit.: ${formatMXN(item.unitPrice)}`,
      `   • Subtotal: *${formatMXN(subtotal)}*`,
    ].join('\n');
  }).join('\n\n');

  // ── Resumen ──
  const summary = [
    ``,
    separator,
    `📦 *Total de piezas: ${totalQty}*`,
    `💰 *TOTAL ESTIMADO (IVA INCLUIDO): ${formatMXN(total)} MXN*`,
    separator,
  ].join('\n');

  // ── Política de entrega ──
  const policy = [
    ``,
    `⏱ _Sistema de maquila y logística._`,
    `_Entrega en *${DELIVERY_DAYS} días hábiles* tras confirmación y anticipo._`,
    ``,
    `Por favor confirmar disponibilidad y condiciones de pago.`,
    `¡Gracias! 🙏`,
  ].join('\n');

  return header + productLines + summary + policy;
}

/**
 * Construye un mensaje de saludo genérico (sin pedido).
 * @returns {string}
 * @private
 */
function _buildGreetingMessage() {
  return (
    `¡Hola! 👋 Me interesa obtener información sobre los productos ` +
    `del catálogo de *${COMPANY_NAME}*. ` +
    `¿Podrían orientarme sobre disponibilidad y condiciones?`
  );
}

// ─── Apertura de WhatsApp ──────────────────────────────────────

/**
 * Codifica el mensaje y abre el enlace de WhatsApp.
 *
 * @param {string} message - Texto plano del mensaje.
 * @private
 */
function _openWhatsApp(message) {
  // Validación básica del número
  if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER === '5211234567890') {
    console.warn(
      '[whatsapp.js] El número de WhatsApp no ha sido configurado. ' +
      'Edita la constante WHATSAPP_NUMBER en utils/whatsapp.js'
    );
  }

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
