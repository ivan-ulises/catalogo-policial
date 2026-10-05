/**
 * @file utils/format.js
 * @description Funciones de formateo compartidas entre todos los módulos.
 *
 * RESPONSABILIDAD ÚNICA: Transformaciones de datos puras (sin efectos
 * secundarios, sin tocar el DOM).
 *
 * EXPORTACIONES:
 *   - formatMXN(amount)      → "$1,850.00"
 *   - getFormattedDate()     → "22 de marzo de 2026, 10:30 a. m."
 *   - slugify(text)          → "uniforme-tactico-operativo"
 *   - clamp(val, min, max)   → número dentro del rango
 */

// ─── Formateador de moneda ─────────────────────────────────────

/**
 * Formatea un número como moneda MXN usando la API nativa Intl.
 *
 * @param {number} amount - Valor numérico en pesos mexicanos.
 * @returns {string} Cadena formateada, ej. "$1,850.00"
 *
 * @example
 * formatMXN(1850)    // → "$1,850.00"
 * formatMXN(0)       // → "$0.00"
 * formatMXN(3200.5)  // → "$3,200.50"
 */
export function formatMXN(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('es-MX', {
    style:    'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Formateador de fecha ──────────────────────────────────────

/**
 * Devuelve la fecha y hora actuales formateadas en español (México).
 *
 * @returns {string} Ej. "22 de marzo de 2026, 10:30 a. m."
 */
export function getFormattedDate() {
  return new Intl.DateTimeFormat('es-MX', {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

/**
 * Devuelve solo la fecha (sin hora) formateada en español.
 *
 * @returns {string} Ej. "22 de marzo de 2026"
 */
export function getShortDate() {
  return new Intl.DateTimeFormat('es-MX', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  }).format(new Date());
}

// ─── Utilidades de string ──────────────────────────────────────

/**
 * Convierte un texto a slug para usar en IDs o URLs.
 *
 * @param {string} text
 * @returns {string} Ej. "Uniforme Táctico" → "uniforme-tactico"
 *
 * @example
 * slugify('Uniforme Táctico Operativo') // → "uniforme-tactico-operativo"
 */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')                   // descompone acentos
    .replace(/[\u0300-\u036f]/g, '')    // elimina diacríticos
    .replace(/[^a-z0-9\s-]/g, '')       // elimina caracteres especiales
    .trim()
    .replace(/\s+/g, '-');              // espacios → guiones
}

// ─── Utilidades numéricas ──────────────────────────────────────

/**
 * Limita un valor numérico a un rango [min, max].
 *
 * @param {number} value - Valor a limitar.
 * @param {number} min   - Límite inferior.
 * @param {number} max   - Límite superior.
 * @returns {number}
 *
 * @example
 * clamp(150, 1, 100) // → 100
 * clamp(-5,  1, 100) // → 1
 * clamp(50,  1, 100) // → 50
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ─── Escaping HTML ─────────────────────────────────────────────

/**
 * Escapa caracteres HTML especiales para prevenir XSS.
 * Usar siempre al insertar strings de usuario en innerHTML.
 *
 * @param {string} str
 * @returns {string}
 *
 * @example
 * escapeHTML('<script>alert(1)</script>') // → "&lt;script&gt;alert(1)&lt;/script&gt;"
 */
export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
