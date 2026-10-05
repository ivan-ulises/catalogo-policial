# Arquitectura del Sistema — Catálogo B2B Suministros A. R.

## 1. Visión General
El sistema opera como un cotizador interactivo de uniformes policiales y equipamiento de seguridad pública para municipios de México. Los compradores públicos no efectúan transacciones bancarias en la interfaz; la salida es una requisición formal foliada, respaldada en base de datos y despachada por correo y WhatsApp.

## 2. Pila Tecnológica (Filosofía NO-BUILD)
* **Frontend:** HTML5 semántico + Vanilla JavaScript ES6 nativo (módulos con `import`/`export` sin empaquetado) + Tailwind CSS vía CDN.
* **Motor Documental:** `jsPDF (2.5.1)` + `jsPDF-AutoTable (3.8.2)` ejecutados en el cliente. Construyen un documento vectorial en tamaño Carta (texto nativo seleccionable, salto de página automático `rowPageBreak: avoid`, membrete institucional y cálculo de IVA).
* **Capa Serverless:** Netlify Functions (`netlify/functions/orders.js`) en Node.js para inserción protegida en DB y envío de correo.
* **Base de Datos:** Supabase (PostgreSQL) con dos tablas: `products` (catálogo) y `orders` (requisiciones).
* **Servicio de Correo:** Resend API (despacha el correo con PDF adjunto en Base64).
* **Despliegue y Hosting:** Netlify con integración continua vinculada a GitHub.

## 3. Diagrama de Flujo de Operación

```
[ Comprador / Navegador ]
         │
         ├── 1. bootstrap() en main.js ──────► [ Supabase REST API ]
         │      (fetchProducts() público)          (Tabla: products)
         │
         ├── 2. Interacción con Catálogo
         │      (Filtros, Selección de tallas/colores)
         │      Emite: 'product:add' ────────► Escucha: cart.js
         │
         ├── 3. Confirmación de Requisición
         │      Click "Generar Pedido"
         │      Emite: 'cart:checkout' ──────► Escucha: orders.js
         │
         ├── 4. Procesamiento en orders.js
         │      ├─ Valida Municipio obligatorio
         │      ├─ Genera folio unificado (ej. COT-MUVSTPK2)
         │      └─ Genera PDF vectorial Carta (_buildInvoicePDF)
         │
         └── 5. POST /.netlify/functions/orders
                     │ (payload estructurado + pdfBase64)
                     ▼
       [ Netlify Function: orders.js ]
         │
         ├──► 6. Inserta con Service Role ───► [ Supabase PostgreSQL ]
         │                                         (Tabla: orders)
         │
         └──► 7. Despacha Email con PDF ─────► [ Resend API ]
                                                   │
                                                   ▼
                                         terminalasuncion.1@gmail.com
```

## 4. Bus Central de Eventos (Event-Driven Architecture)

La comunicación entre componentes visuales y utilidades es 100% desacoplada mediante `CustomEvent` sobre `document`:

| Evento | Emitido por | Escuchado por | Propósito |
|---|---|---|---|
| `product:add` | `components/catalog.js` | `components/cart.js` | Agregar artículo con talla, color y cantidad al pedido. |
| `cart:updated` | `components/cart.js` | `main.js` | Notificar nuevo conteo y total acumulado. |
| `cart:checkout` | `components/cart.js` | `utils/orders.js` | Abrir modal de cotización formal con los ítems activos. |
| `cart:whatsapp` | `utils/orders.js` / `components/cart.js` | `utils/whatsapp.js` | Redirigir a WhatsApp con el formato de mensaje preparado. |
| `ui:toast` | Cualquier módulo | `main.js` | Mostrar notificación flotante temporal al usuario. |
| `wa:floatClick`| `utils/whatsapp.js` | `main.js` | Disparar envío de WhatsApp desde el botón flotante. |

*Para la especificación detallada de cada payload, consultar [`docs/EVENTS.md`](EVENTS.md).*
