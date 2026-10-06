# Historial de Cambios (Changelog)

Todas las modificaciones notables a este proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [1.5.0] — 2026-10-05
### Añadido
* **Fase 3 (UX B2B Municipal y Documental):**
  * **Matriz de tallas por prenda en lote:** Tabla interactiva por tarjeta con campos numéricos para cada talla (CH, M, G, XG, XXG, 28-40), contador de piezas y subtotal en vivo. Emite eventos desacoplados `product:add` 100% compatibles con `cart.js`.
  * **Datos del solicitante ampliados:** Captura en el modal de cotización de Municipio/Corporación, Dependencia/Área, Nombre y Cargo del Titular, Teléfono, Correo Oficial, RFC, Domicilio Fiscal y Domicilio de Entrega. Persistencia local con esquema versionado (`ep_b2b_applicant_v2`).
  * **PDF Institucional Enriquecido:** Tamaño Carta vectorial con membrete, datos completos del solicitante, desglose de partidas AutoTable, vigencia formal de 15 días naturales, tiempos de entrega (21 días hábiles en maquila), condiciones de pago (50/50), garantía de 90 días naturales y leyendas fiscales.
  * **Carrito persistente y enlace compartible:** Persistencia de borrador de requisición con indicador visual y generador de URL compartible (`?cart=...`) para cotizaciones colaborativas entre áreas municipales.
  * **Ficha técnica por producto:** Modal accesible e institucional (`#tech-sheet-modal`) con galería, composición, gramaje, refuerzos de confección, colores institucionales y tiempos de entrega.
  * **Pantalla de éxito interactiva:** Modal de confirmación con folio oficial en tipografía monoespaciada, botón para copiar folio, descarga directa del PDF Carta, estatus del expediente y botón para continuar por WhatsApp con mensaje preformateado.
  * **Pulido de UX y accesibilidad:** Skeletons de carga animados en el grid de productos mientras conecta con Supabase, botón "Deshacer" (undo) al eliminar ítems en el carrito, trampa de foco y navegación por teclado (Escape) en modales, y filtro por talla en la barra superior.
  * **Carga diferida (Lazy Loading) de jsPDF:** Eliminación de scripts bloqueantes en `index.html`; carga bajo demanda de `jsPDF` y `AutoTable` únicamente al interactuar con la cotización o descarga documental.
  * **Migración SQL aditiva:** `supabase/migrations/20261005_fase3_solicitante_orders.sql` para la columna `applicant_info` (JSONB) e índice GIN con rollback documentado.

---

## [1.4.0] — 2026-10-05
### Añadido
* **Fase 2 (Panel Administrativo B2B y Gestión de Requisiciones):**
  * Portal `/admin.html` con arquitectura Vanilla JS ES6 modular desacoplada mediante constantes `EVT`.
  * Integración con Supabase Auth (correo/contraseña y magic links) y validación de permisos en la tabla `public.admin_users`.
  * Políticas de Row Level Security (RLS) para lectura/actualización de `orders` y CRUD completo de `products` restringido a administradores verificados vía función `public.is_admin()`.
  * Módulo de requisiciones: filtros por búsqueda, estatus y fechas, paginación, visualización de partidas y actualización de estados (`nueva`, `en revisión`, `cotizada`, `aprobada`, `rechazada`, `entregada`).
  * Notas internas y bitácora de auditoría histórica inmutable en `public.order_audit_logs`.
  * Endpoint serverless protegido `netlify/functions/admin-resend.js` para reenvío administrativo de cotizaciones con PDF adjunto.
  * Regeneración y descarga client-side de PDF formal Carta idéntico al emitido al cliente a partir de los datos en base de datos.
  * Exportación de requisiciones a CSV compatible con Excel.
  * Módulo CRUD de catálogo maestro de productos con validaciones de formulario.
  * Dashboard con métricas de cotizaciones del mes, monto total, tasa de aprobación, municipios recurrentes y productos más solicitados.
  * Cabeceras de seguridad en `netlify.toml` con directiva `X-Robots-Tag: noindex, nofollow, noarchive` para la ruta `/admin*`.
  * Migración SQL aditiva en `supabase/migrations/20261005_fase2_admin_panel.sql` con script de rollback documentado.

---

## [1.3.0] — 2026-10-05
### Añadido
* **Fase 1 (Blindaje Serverless y Base de Datos):**
  * Recálculo financiero forzoso en el servidor (`netlify/functions/orders.js`) consultando la tabla `products` de Supabase; rechazo de montos manipulados por cliente.
  * Snapshot inmutable por partida (`items_snapshot` en formato JSONB) preservando precios y especificaciones ante cambios futuros de catálogo.
  * Idempotencia estricta mediante `idempotency_key` con restricción `UNIQUE` en PostgreSQL para mitigar duplicados por doble clic o reintentos de red.
  * Generador de folios canónicos en servidor con restricción `UNIQUE(folio)` (`COT-YYYY-XXXXXXX`).
  * Mecanismos de protección anti-abuso: rate limiting en memoria por IP (ventana deslizante de 10 req/min), campo honeypot oculto y soporte condicional para Cloudflare Turnstile.
  * Resiliencia transaccional con Resend: aislamiento de fallos de correo para no bloquear la persistencia del pedido (`email_status: 'pending'|'sent'|'failed'`).
  * Suite de pruebas unitarias automatizada en `tests/orders_validation.test.js`.
  * Migración SQL aditiva y versionada en `supabase/migrations/20261005_fase1_blindaje_orders.sql` con script de rollback documentado.

---

## [1.2.0] — 2026-10-05
### Añadido
* Motor de generación documental vectorial client-side utilizando `jsPDF (v2.5.1)` y `jsPDF-AutoTable (v3.8.2)`.
* Paginación inteligente (`Página X de Y`), encabezados repetidos por página y protección contra saltos de fila (`rowPageBreak: 'avoid'`).
* Folio unificado sincronizado (`COT-XXXX`) generado en el cliente y compartido idéntico en el PDF, correo y registro de base de datos.
* Documentación de arquitectura técnica e integración en `docs/ARCHITECTURE.md`, `docs/FILE_MAP.md`, `docs/EVENTS.md`, `docs/DATA_MODEL.md`, `docs/ENV_VARS.md`, `docs/RUNBOOK.md` y `docs/AGENT_ROLES.md`.
* Protocolo permanente de desarrollo para sistemas en producción en `.agent/rules/05-contexto-y-despliegue.md`.
* Skills especializadas y workflows operativos en `.agent/skills/` y `.agent/workflows/`.

### Modificado
* Eliminada dependencia de renderizado basada en capturas de pantalla HTML (`html2pdf.js` / `html2canvas`) para evitar textos truncados o imágenes en blanco.
* Limpieza del repositorio eliminando archivos locales de catálogo pesado, PDFs y hojas de cálculo confidenciales del seguimiento de Git (`.gitignore` actualizado).

---

## [1.1.0] — 2026-10-05
### Añadido
* Migración de backend: reemplazado Google Sheets y Google Apps Script (GAS) por PostgreSQL alojado en Supabase (`products` y `orders`).
* Endpoint serverless en Netlify Functions (`netlify/functions/orders.js`) con integración directa a Resend API.
* Despliegue automático CI/CD en Netlify conectado al nuevo repositorio en GitHub.

### Modificado
* `api/supabaseClient.js`: Lectura de productos optimizada reduciendo tiempos de respuesta de ~3s (Google Sheets) a ~50ms.
* `utils/orders.js`: Envío de cotizaciones con adjunto Base64 hacia Netlify Functions.

---

## [1.0.0] — 2026-04-14
### Añadido
* Lanzamiento inicial del catálogo interactivo B2B para Suministros A. R.
* Arquitectura Vanilla JS ES6 modular orientada a eventos (`CustomEvent`).
* Integración de carrito interactivo con tallas y cantidades.
* Envío de requisiciones hacia WhatsApp y Google Sheets vía Google Apps Script.
