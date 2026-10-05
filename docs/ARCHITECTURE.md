# Arquitectura del Sistema

## Stack Tecnológico
- **Frontend**: HTML5, Vanilla JS (ES6 Modules), Tailwind CSS (CDN). No hay bundlers ni frameworks pesados (React/Vue).
- **Backend/API**: Netlify Functions (Node.js sin servidor) comunicándose con Supabase (REST API) y Resend (API de Correos).
- **Base de Datos**: Supabase (PostgreSQL), reemplazando a Google Sheets para lectura y escritura ultrarrápidas.
- **Hosting**: Netlify.
- **Generación PDF**: Frontend-side usando `jsPDF` + `jspdf-autotable` (PDF vectorial: texto real, sin capturas de pantalla).

## Flujo General
1. **Lectura (Catálogo)**: `main.js` llama a `supabaseClient.js`, que hace un `fetch` a la tabla `products` en Supabase vía su API REST usando la Anon Key.
2. **Renderizado**: `catalog.js` inyecta las tarjetas dinámicamente en el DOM. `cart.js` escucha eventos y gestiona el estado del pedido en memoria.
3. **Checkout**: Al confirmar el pedido, `orders.js` maneja un modal de cliente ("Cotización"). Se valida el Municipio solicitado.
4. **Generación Documental**: `_buildInvoicePDF()` (en `utils/orders.js`) dibuja la cotización como PDF vectorial Carta (multipágina, encabezado, tabla, totales y condiciones) y lo codifica en Base64 en el navegador. El folio (`COT-XXXX`) se genera en el cliente y es el mismo en el PDF, el correo y Supabase.
5. **Escritura (Backend)**: El sistema envía el pedido (Payload + PDF Base64) a `/.netlify/functions/orders`.
6. **Procesamiento Netlify Function**: La función sin servidor inserta el registro en la tabla `orders` de Supabase usando la Service Role Key y envía el correo con el PDF adjunto mediante la API de Resend.

## Decisiones Técnicas Clave
- **Event-Driven Architecture (EDA)**: Se usan `CustomEvents` en el objeto `document` para comunicar partes desacopladas (ej. `catalog.js` avisa a `cart.js`).
- **Migración a Supabase**: Se eliminó Google Sheets debido a latencias inaceptables (~3 segundos de carga). Supabase reduce el tiempo a ~50ms.
- **PDF Client-Side**: Se movió la generación del PDF desde el backend (GAS) hacia el frontend (`jsPDF` + `autoTable`) para aligerar la función serverless y evitar problemas de límite de tiempo (timeout) en Netlify Functions.
- **Netlify + Resend**: Se sustituyó Google Apps Script por una función local de Netlify que llama a Resend para correos transaccionales ultrarrápidos y seguros.
