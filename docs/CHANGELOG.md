# Historial de Cambios (Changelog)

Todas las modificaciones notables a este proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
