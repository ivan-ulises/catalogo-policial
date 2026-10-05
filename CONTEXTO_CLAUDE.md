# 📋 Documento de Contexto y Handoff Técnico: Catálogo B2B Suministros A.R.

> **Objetivo de este documento:** Proveer una radiografía completa, clara y precisa del sistema para análisis, auditoría y propuesta de mejoras por parte de Claude o un equipo de desarrollo.

---

## 1. Resumen Ejecutivo del Negocio
* **Empresa:** Suministros A.R. (Equipamiento policial y táctico municipal).
* **Modelo:** **B2B / Requisición formal**. No cuenta con pasarela de pago bancario directa (no usa Stripe ni PayPal). Los clientes suelen ser ayuntamientos, corporaciones policiales o agencias de seguridad.
* **Objetivo de la plataforma:** Permitir al cliente navegar un catálogo de uniformes y equipo táctico, configurar tallas/colores/cantidades en un carrito interactivo, y generar una **cotización formal con folio único**.
* **Canales de salida del pedido:**
  1. **Envío formal a producción:** Guarda el pedido en base de datos Postgres (Supabase) y envía automáticamente un correo formal vía **Resend** con un **PDF adjunto vectorizado (tamaño Carta)** a la bandeja de operaciones (`terminalasuncion.1@gmail.com`).
  2. **Vía WhatsApp:** Abre una conversación con formato de requisición desglosada y mensaje personalizado.
  3. **Impresión / Portapapeles:** Copia estructurada en tabla o impresión local del navegador.

---

## 2. Pila Tecnológica (Stack) Actual

El proyecto opera bajo una filosofía de **cero compilación (No-Build)** para el frontend, garantizando máxima ligereza, velocidad de carga y simplicidad de mantenimiento.

* **Frontend:**
  * **Vanilla JavaScript ES6+ Nativo:** Modular (`import` / `export`), sin frameworks pesados (ni React, ni Vue, ni Node en el cliente).
  * **Tailwind CSS vía CDN:** Estilos responsivos y utilitarios inyectados directamente.
  * **Arquitectura Event-Driven (EDA):** Comunicación desacoplada entre módulos mediante `CustomEvent` en el `document` (`product:add`, `cart:updated`, `cart:checkout`, `cart:whatsapp`, etc.).
  * **Generador de PDFs:** `jsPDF (v2.5.1)` + `jsPDF-AutoTable (v3.8.2)` en el navegador. Genera documentos vectoriales reales en formato Carta (con paginación automática `Página X de Y`, salto de página inteligente `rowPageBreak: avoid`, desglose de IVA y formato de moneda).
* **Backend y Serverless:**
  * **Netlify Functions:** Endpoint serverless en Node.js (`/.netlify/functions/orders`).
  * **Resend API:** Servicio transaccional para envío del correo con el PDF adjunto en Base64.
* **Base de Datos & Almacenamiento:**
  * **Supabase (PostgreSQL):**
    * Tabla `products`: Catálogo central con políticas RLS (Row Level Security) de lectura pública anónima.
    * Tabla `orders`: Histórico de cotizaciones y pedidos recibidos. Inserción protegida mediante la clave privilegiada `SUPABASE_SERVICE_KEY` dentro de la función serverless.
* **Hosting & Despliegue:**
  * **Netlify:** Despliegue continuo conectado a la rama `main` de GitHub (`ivan-ulises/catalogo-policial`).

---

## 3. Arquitectura y Flujo de Datos

```
[ Cliente Navegador ]
         │
         ├── 1. Carga Catálogo ───────────► [ Supabase REST API (products) ]
         │
         ├── 2. Agrega al Carrito (EDA: CustomEvents)
         │
         └── 3. "Generar Pedido"
                 ├─ Valida Municipio
                 ├─ Genera Folio Único (ej. COT-MUVSTPK2)
                 ├─ Genera PDF Vectorial Carta (jsPDF + autoTable)
                 │
                 ▼ POST /.netlify/functions/orders
       [ Netlify Serverless Function ]
                 │
                 ├─► Guarda registro ─────► [ Supabase DB (orders) ]
                 │
                 └─► Envía Email + PDF ───► [ Resend API ] ──► terminalasuncion.1@gmail.com
```

---

## 4. Estructura de Archivos del Proyecto

```text
├── index.html                   # HTML base, layouts de modales, scripts CDN (Tailwind, jsPDF)
├── main.js                      # Orquestador del ciclo de vida y eventos globales
├── netlify.toml                 # Configuración de headers de seguridad y variables de Netlify
├── supabase_schema.sql          # DDL de las tablas SQL (products, orders) y políticas RLS
│
├── api/
│   └── supabaseClient.js       # Fetch del catálogo contra REST API de Supabase
│
├── components/
│   ├── catalog.js              # Render de tarjetas de productos, filtros por categoría y búsqueda
│   └── cart.js                 # Estado del carrito, selector de variantes/tallas/cantidades
│
├── utils/
│   ├── orders.js               # Modal de cotización, generador de PDF vectorial y envío a Netlify
│   ├── whatsapp.js             # Generador de URL y formateador de mensajes para WhatsApp
│   └── format.js               # Formateador de moneda MXN y fechas
│
├── netlify/
│   └── functions/
│       └── orders.js           # Función serverless: inserta en Supabase y dispara email en Resend
│
├── Imagenes/
│   └── logo_suministros_a_r.png# Logotipo oficial para la UI
└── docs/                       # Documentación técnica complementaria (ARCHITECTURE, CATALOG, FILE_MAP)
```

---

## 5. Esquema de Base de Datos (Supabase)

### Tabla `products`
* `id_producto` (TEXT, PK): Identificador único o clave interna.
* `partida_fortamun` (TEXT): Código o partida presupuestal municipal.
* `nombre_bien` (TEXT): Título del artículo.
* `descripcion` (TEXT): Especificaciones técnicas.
* `unidad_medida` (TEXT): PZA, PAR, JGO, etc.
* `tallas_disponibles` (TEXT): Lista separada por comas (ej. `S, M, L, XL` o `Unitalla`).
* `precio_unitario` (NUMERIC): Precio neto.
* `imagen_url` (TEXT): URLs públicas de la fotografía.

### Tabla `orders`
* `id` (UUID, PK): Identificador generado por PostgreSQL.
* `folio` (TEXT): Folio comercial alfanumérico generado por el cliente (ej. `COT-MUVSTPK2`).
* `fecha` (TIMESTAMPTZ): Marca de tiempo de recepción.
* `municipio` (TEXT): Entidad solicitante.
* `detalles_pedido` (TEXT): Resumen textual de las partidas solicitadas.
* `num_partidas` (INTEGER): Cantidad de renglones distintos.
* `total_piezas` (INTEGER): Sumatoria total de unidades físicas.
* `total_mxn` (NUMERIC): Importe total con IVA.
* `status` (TEXT): Estado operativo (`pendiente`, `en_proceso`, `entregado`).

---

## 6. Variables de Entorno Requeridas (Netlify)
1. `SUPABASE_URL`: Endpoint de la instancia Supabase.
2. `SUPABASE_ANON_KEY`: Llave pública para lecturas de frontend.
3. `SUPABASE_SERVICE_KEY`: Llave secreta para inserciones seguras desde `netlify/functions/orders.js`.
4. `RESEND_API_KEY`: Token de autorización para despacho de correos.

---

## 7. Áreas de Oportunidad y Posibles Mejoras para Claude

Para que Claude proponga mejoras de alto impacto, se sugieren las siguientes líneas de trabajo:

1. **Panel Administrativo / Dashboard Interno:**
   * Crear una vista protegida o sección interna para consultar, filtrar y cambiar el estado (`status`) de los pedidos almacenados en Supabase, así como exportar reportes en Excel/CSV.
2. **Personalización Táctica de Prendas (Customización):**
   * Soporte para bordados específicos, sectores, banderas o escudos municipales por producto, con recargo o nota específica en la cotización.
3. **Optimización de Rendimiento y Assets:**
   * Migración de imágenes a Supabase Storage con compresión WebP automática o CDN dedicada.
4. **Validación y UX en Checkout:**
   * Agregar campos opcionales como: *Nombre del contacto*, *Cargo/Puesto*, *Teléfono directo*, y selector de *Forma de entrega / Logística*.
5. **Autenticación B2B (Opcional):**
   * Permitir a municipios recurrentes iniciar sesión para ver su historial de requisiciones previas.
