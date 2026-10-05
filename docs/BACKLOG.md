# Backlog de Producto y Hoja de Ruta Priorizada

Este documento recopila las oportunidades de mejora, deuda técnica y nuevas funcionalidades ordenadas por impacto y criticidad para el sistema B2B en producción.

---

## Leyenda de Prioridad
* 🔴 **P0 — Crítico:** Estabilidad, seguridad operativa o bloqueo funcional de ventas.
* 🟠 **P1 — Alto:** Mejoras prioritarias de negocio B2B y experiencia del comprador.
* 🟡 **P2 — Medio:** Eficiencia interna, analítica y optimización de flujos de trabajo.
* 🟢 **P3 — Bajo / Futuro:** Funcionalidades avanzadas y mejoras cosméticas.

---

## 🔴 Prioridad P0 (Crítico / Seguridad / Robustez)
- [ ] **Hardening de Netlify Function:** Implementar rate-limiting por IP y validación estricta de esquemas (JSON schema) en `netlify/functions/orders.js` para prevenir abuso o spam.
- [ ] **Dominio Verificado en Resend:** Configurar registros DNS (DKIM, SPF, DMARC) para el dominio propio de Suministros A. R., reemplazando el remitente de pruebas `onboarding@resend.dev`.
- [ ] **Pruebas Automatizadas E2E (Playwright):** Suite mínima de pruebas de humo para verificar flujo completo: agregar ítem -> generar cotización -> emisión de PDF -> respuesta 200 de función.

---

## 🟠 Prioridad P1 (Alto Impacto de Negocio B2B)
- [ ] **Captura de Metadatos del Comprador Municipal:**
  - Agregar campos formales en el modal de cotización: *Nombre del contacto*, *Cargo / Área* (ej. Director de Seguridad Pública, Síndico, Comisario), *Teléfono directo*, y *Correo institucional*.
- [ ] **Vigencia y Condiciones Formales en PDF:**
  - Incluir en el encabezado o pie del PDF: tiempo de vigencia de la cotización (ej. 30 días naturales), cuenta CLABE institucional o datos bancarios para anticipos, y notas de flete/logística.
- [ ] **Personalización de Prendas (Bordados y Parches):**
  - Módulo para especificar si una prenda lleva bordado de escudo municipal, nombre del oficial o sectores reflectivos, con ajuste de precio o nota específica.
- [ ] **Panel Administrativo Protegido (Admin Dashboard):**
  - Vista interna con autenticación Supabase Auth para revisar las órdenes registradas en la tabla `orders`, filtrar por municipio/fecha, descargar el PDF y marcar pedidos como `en_proceso` o `entregado`.

---

## 🟡 Prioridad P2 (Medio / Optimización Operativa)
- [ ] **Migración de Tailwind CDN a Tailwind Standalone CLI (Fase 5):**
  - Generar un archivo `dist/styles.css` minificado sin meter Webpack/Vite (manteniendo filosofía no-build con script standalone de Tailwind).
- [ ] **Exportación de Reportes a Excel/CSV:**
  - Botón en panel admin para descargar pedidos consolidados en formato XLSX/CSV para el área de almacén y maquila.
- [ ] **Supabase Storage para Imágenes:**
  - Alojar imágenes de catálogo en bucket dedicado de Supabase con compresión automática a WebP y CDN global.

---

## 🟢 Prioridad P3 (Bajo / Mejoras Futuras)
- [ ] **Portal Municipal con Historial (Autenticación B2B):**
  - Acceso por municipio para consultar pedidos pasados o repetir requisiciones anteriores.
- [ ] **Modo Offline Básico:**
  - Service Worker ligero para permitir navegar el catálogo en zonas municipales con conectividad intermitente.
