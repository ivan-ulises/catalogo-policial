/**
 * @file admin/events.js
 * @description Constantes EVT para comunicación desacoplada en el panel administrativo.
 */

export const EVT = Object.freeze({
  // Autenticación
  AUTH_LOGIN: 'admin:auth:login',
  AUTH_LOGOUT: 'admin:auth:logout',
  AUTH_STATE_CHANGED: 'admin:auth:state_changed',

  // Navegación de Vistas
  VIEW_NAVIGATE: 'admin:view:navigate',

  // Pedidos / Cotizaciones
  ORDERS_LOAD_REQUEST: 'admin:orders:load_request',
  ORDERS_LOADED: 'admin:orders:loaded',
  ORDER_SELECT: 'admin:orders:select',
  ORDER_STATUS_UPDATE: 'admin:orders:status_update',
  ORDER_NOTE_UPDATE: 'admin:orders:note_update',
  ORDER_RESEND_EMAIL: 'admin:orders:resend_email',
  ORDER_DOWNLOAD_PDF: 'admin:orders:download_pdf',
  ORDER_EXPORT_CSV: 'admin:orders:export_csv',

  // Catálogo de Productos (CRUD)
  PRODUCTS_LOAD_REQUEST: 'admin:products:load_request',
  PRODUCTS_LOADED: 'admin:products:loaded',
  PRODUCT_SAVE: 'admin:products:save',
  PRODUCT_DELETE: 'admin:products:delete',
  PRODUCT_EDIT_REQUEST: 'admin:products:edit_request',

  // Notificaciones Toast
  TOAST: 'admin:ui:toast'
});
