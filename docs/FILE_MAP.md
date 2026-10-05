# Mapa de Archivos

| Archivo / Carpeta | Qué hace | Cuándo tocarlo | Depende de |
|-------------------|----------|----------------|------------|
| `index.html` | Punto de entrada, esqueleto semántico, links a CSS, CDN de Tailwind y configuración base. | Para cambiar estructura global, `meta` tags, título, o agregar contenedores globales (ej. modales). | Tailwind (CDN), `main.css`, `main.js` |
| `main.js` | Orquestador principal. Inicializa todos los componentes y enlaza el bus de eventos global. | Para orquestar nuevos módulos o cambiar la carga inicial. | Todos los submódulos. |
| `api/supabaseClient.js` | Conector al REST API de Supabase para leer la tabla de productos de forma anónima. | Si las columnas en la DB cambian o si se añaden filtros remotos. | Supabase REST, `format.js` |
| `components/catalog.js` | Renderizador masivo del grid de productos y la barra de filtros por partida. | Modificaciones de diseño de tarjeta, o si se agregan selectores especiales (ej. Fornitura). | `format.js` |
| `components/cart.js` | Gestor del estado del pedido (sidebar derecho). Suma totales e ítems. | Para cambiar el cómo se visualizan las listas dentro de "Mi Pedido". | `format.js` |
| `utils/orders.js` | Controlador del Checkout (modal de cotización y modal admin). Contiene lógica de conversión a PDF. | Para cambiar la estructura de la cotización, el PDF o los campos de validación del cliente. | Netlify Function (`/orders`), `html2pdf.js` |
| `utils/whatsapp.js` | Construye texto preformateado y levanta la URL de `wa.me` para redirigir a WhatsApp. | Para modificar el número destino o el machote de saludo y lista de productos. | `format.js` |
| `utils/format.js` | Utilidades puras de conversión a moneda (MXN) y control de fechas/strings. | Para ajustes regionales o formatos. | Ninguno. |
| `netlify/functions/orders.js` | Backend Serverless en Node.js. Escribe en base de datos Supabase usando credenciales admin y dispara emails por Resend. | Para cambiar la lógica de base de datos, el armado del HTML de los correos transaccionales, etc. | `.env`, Node.js, API de Resend |
| `scripts/migrate.js` | Herramienta temporal de migración de datos. Analiza el antiguo CSV de Google Sheets y lo inserta en Supabase. | No se suele tocar, se usó para la migración inicial. | Supabase JS SDK |
| `supabase_schema.sql` | Esquema de base de datos en SQL con comandos de configuración de tablas y RLS. | Para añadir columnas en la DB. | PostgreSQL |
| `assets/css/main.css` | Estilos base personalizados, animaciones globales de UI y sobreescrituras de scroll. | Ajustes finos que Tailwind no cubre fácilmente (scrollbars, animaciones `fade-up`). | `index.html` |
