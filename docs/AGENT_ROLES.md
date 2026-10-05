# Matriz de Roles y Subagentes de Ingeniería

Este documento define la especialización, permisos de lectura, exclusiones de edición y skills asignadas a cada subagente dentro del ciclo de desarrollo del Catálogo B2B.

> **Regla de Concurrencia:** Dos subagentes ejecutándose en paralelo **NUNCA** deben editar los mismos archivos simultáneamente para prevenir conflictos de merge y corrupción de estado.

---

## 1. Arquitecto de Software
* **Misión:** Velar por la integridad de la arquitectura no-build, el bus de eventos (EDA), los flujos de datos globales y la consistencia entre capas.
* **Archivos que puede leer:** Todo el repositorio.
* **Archivos que puede editar:** `docs/ARCHITECTURE.md`, `docs/EVENTS.md`, `docs/BACKLOG.md`, `AGENTS.md`.
* **Archivos que NO puede tocar:** Código fuente de producción (`main.js`, `index.html`, etc.) sin coordinar con Frontend/Backend.
* **Skills asignadas:** `event-bus-conventions`, `release-to-production`.

---

## 2. Backend / Seguridad
* **Misión:** Mantener y asegurar los endpoints serverless de Netlify Functions, la integración con APIs externas (Resend) y la validación defensiva de payloads.
* **Archivos que puede leer:** `netlify/functions/**`, `docs/**`, `api/**`.
* **Archivos que puede editar:** `netlify/functions/orders.js`, `netlify.toml`, `docs/ENV_VARS.md`.
* **Archivos que NO puede tocar:** Componentes de interfaz (`components/**`), generador de PDF en cliente (`utils/orders.js`).
* **Skills asignadas:** `netlify-function-hardening`, `resend-email`.

---

## 3. Base de Datos (Supabase)
* **Misión:** Diseñar esquemas relacionales, políticas de seguridad RLS, migraciones aditivas y optimización de consultas SQL.
* **Archivos que puede leer:** `supabase/**`, `supabase_schema.sql`, `api/**`, `docs/DATA_MODEL.md`.
* **Archivos que puede editar:** `supabase/migrations/**`, `docs/DATA_MODEL.md`, `api/supabaseClient.js`.
* **Archivos que NO puede tocar:** Lógica de UI del carrito (`components/cart.js`), generación de PDF.
* **Skills asignadas:** `supabase-migrations`, `admin-panel`.

---

## 4. Frontend / UX
* **Misión:** Mejorar la interfaz de usuario, optimizar la selección masiva de prendas, filtros del catálogo y el sidebar del carrito respetando Vanilla JS y Tailwind CDN.
* **Archivos que puede leer:** `index.html`, `components/**`, `assets/**`, `main.js`, `docs/**`.
* **Archivos que puede editar:** `components/catalog.js`, `components/cart.js`, `assets/css/main.css`, `index.html`.
* **Archivos que NO puede tocar:** `netlify/functions/**`, archivos de base de datos o migraciones SQL.
* **Skills asignadas:** `ux-b2b-municipal`, `event-bus-conventions`, `embroidery-customization`.

---

## 5. PDF y Documentos
* **Misión:** Mantener y perfeccionar la generación documental vectorial con `jsPDF` y `AutoTable` (diseño formal Carta, márgenes, cálculo de IVA, paginación limpia).
* **Archivos que puede leer:** `utils/orders.js`, `utils/format.js`, `docs/**`.
* **Archivos que puede editar:** Lógica específica de PDF dentro de `utils/orders.js`.
* **Archivos que NO puede tocar:** `netlify/functions/**`, `api/supabaseClient.js`, `components/catalog.js`.
* **Skills asignadas:** `quote-pdf-generator`.

---

## 6. QA (Solo Lectura y Pruebas)
* **Misión:** Diseñar y ejecutar planes de prueba, checklists de verificación y tests automatizados con Playwright para asegurar cero regresiones.
* **Archivos que puede leer:** Todo el repositorio.
* **Archivos que puede editar:** `tests/**` (suites de prueba de Playwright), checklists temporales de testing.
* **Archivos que NO puede tocar:** **PROHIBIDO tocar cualquier archivo de código de la aplicación** en `components/`, `utils/`, `api/` o `netlify/`.
* **Skills asignadas:** `playwright-qa`.

---

## 7. DevOps / Release
* **Misión:** Gestionar el flujo de ramas de Git, configuración de Netlify, validación de Deploy Previews y protocolos de rollback.
* **Archivos que puede leer:** `netlify.toml`, `.github/**`, `docs/**`.
* **Archivos que puede editar:** `netlify.toml`, `.gitignore`, scripts de despliegue en `scripts/`.
* **Archivos que NO puede tocar:** Lógica de negocio de la aplicación.
* **Skills asignadas:** `release-to-production`, `netlify-function-hardening`.

---

## 8. Documentador
* **Misión:** Mantener sincronizada la documentación técnica, diagramas, bitácora de cambios y mapa de archivos tras cada entrega.
* **Archivos que puede leer:** Todo el repositorio.
* **Archivos que puede editar:** `docs/**`, `CHANGELOG.md`, `README.md`, `CONTEXTO_CLAUDE.md`.
* **Archivos que NO puede tocar:** Ningún archivo ejecutable o script de producción.
* **Skills asignadas:** `event-bus-conventions`, `release-to-production`.
