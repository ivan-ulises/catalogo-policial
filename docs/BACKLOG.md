# Diagnóstico Profesional y Backlog de Mejoras

## 📊 Diagnóstico Técnico

- **Arquitectura (8/10)**: Extremadamente eficiente para el presupuesto y contexto. Uso inteligente de Google Sheets y GAS para el backend. La capa EDA (Event-Driven) desacopla bien el frontend.
- **Rendimiento (8/10)**: Muy rápido por no tener bundlers pesados, aunque la inyección dinámica masiva de DOM podría alentarse si el catálogo supera +500 items y las imágenes no tienen Lazy Loading garantizado o si el CDN tarda.
- **SEO (2/10)**: Intencionalmente bloqueado con `<meta name="robots" content="noindex, nofollow" />`. Correcto si es un portal cerrado B2B.
- **Accesibilidad (7/10)**: Buen contraste, etiquetas `aria-label` en botones y modales con roles. Faltaría revisar la captura de foco real dentro del checkout.
- **Diseño/UX (8/10)**: Identidad sólida B2B (táctico/policial). Buen feedback con Toasts y estados de deshabilitación.
- **Móvil (8/10)**: UI responsiva, carrito manejado con sidebar (Offcanvas) que funciona muy bien.
- **Conversión (8/10)**: Excelente túnel hacia cierre vía WhatsApp, lo cual es ideal para ventas a corporaciones.
- **Seguridad (6/10)**: `API_KEY` expuesta en el JavaScript cliente. GAS lo protege de curiosos genéricos, pero un desarrollador puede extraer la llave e inyectar basura en el Sheets.
- **Mantenibilidad (6/10)**: Muchos templates HTML dentro de literales de strings JS (`catalog.js` y `orders.js`). Se vuelve difícil de leer para perfiles junior y propenso a errores tipográficos.
- **Confianza/Credibilidad (8/10)**: PDFs autogenerados que otorgan un estatus sumamente profesional para la empresa.

---

## 📋 Backlog Priorizado

### 🔴 Crítico (Debería hacerse inmediatamente)
- **Ocultar API Keys (S)**: Eliminar `API_KEY` del frontend o rotarla con un backend middleware simple (ej. Netlify Functions) para no exponer la llave directa de GAS, previniendo inyección de datos basura.
  - *Archivos:* `utils/orders.js`, `Code.gs`, (Posible nueva `netlify/functions/`)

### 🟠 Importante (Mejoras sustanciales al producto)
- **Refactorización de Templates JS (L)**: Extraer los enormes HTML incrustados en `catalog.js` y `orders.js` hacia etiquetas `<template>` en el `index.html` (o Web Components nativos).
  - *Archivos:* `index.html`, `components/catalog.js`, `utils/orders.js`
- **Gestión de Imágenes (M)**: Implementar `loading="lazy"` obligatorio y placeholders Skeleton para evitar el salto de diseño (Layout Shift) mientras las imágenes desde Sheets cargan.
  - *Archivos:* `components/catalog.js`

### 🟡 Mejora (Optimizaciones técnicas)
- **Buscador (M)**: Agregar un input de texto al lado de los filtros para buscar productos por SKU o palabra clave. El catálogo actual demanda visualización manual de todo.
  - *Archivos:* `index.html`, `components/catalog.js`
- **Validación Robusta (S)**: Mostrar los errores del formulario en la UI de cada input en lugar del Toast para mayor claridad al usuario si se equivoca de contraseña o campo.
  - *Archivos:* `utils/orders.js`

### 🟢 Extra (Nice to have)
- **Animaciones Fluidas (S)**: Transiciones View Transitions API para suavizar los filtros de las tarjetas.
- **PWA (L)**: Agregar Web App Manifest y un Service Worker básico para permitir acceso offline al catálogo usando caché en caso de vendedores en zonas sin cobertura.
  - *Archivos:* `index.html`, `sw.js`, `manifest.json`
