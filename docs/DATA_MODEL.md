# Modelo de Datos — PostgreSQL (Supabase)

Especificación del modelo de base de datos relacional alojado en Supabase, tipos de datos, restricciones y políticas de seguridad (RLS).

---

## 1. Tabla `public.products` (Catálogo Maestro)
Contiene la lista oficial de uniformes, prendas y accesorios disponibles para cotización.

| Columna | Tipo de Dato | Nulo | Descripción / Reglas |
|---|---|---|---|
| `id_producto` | `TEXT` | `NO` (PK) | Identificador alfanumérico único del producto (ej. `PROD-01`). |
| `partida_fortamun` | `TEXT` | `NO` | Partida presupuestal de destino según clasificador municipal (ej. `28301`). |
| `nombre_bien` | `TEXT` | `NO` | Nombre comercial del artículo (ej. `Gorra Gabardina`). |
| `descripcion` | `TEXT` | `SÍ` | Ficha técnica y especificaciones de confección o materiales. |
| `unidad_medida` | `TEXT` | `NO` | Unidad de inventario (`PZA`, `PAR`, `JGO`). |
| `tallas_disponibles` | `TEXT` | `SÍ` | Tallas separadas por coma (`S, M, L, XL`) o `Unitalla`. |
| `precio_unitario` | `NUMERIC` | `NO` | Precio unitario final con IVA incluido en MXN. |
| `imagen_url` | `TEXT` | `SÍ` | URL(s) públicas de la imagen del producto (separadas por comas si son múltiples). |

### Políticas de Row Level Security (RLS) en `products`:
* **RLS Habilitado:** Sí (`ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;`).
* **Lectura (`SELECT`):** Pública e irrestricta para clientes anónimos (`FOR SELECT USING (true);`).
* **Escritura (`INSERT`, `UPDATE`, `DELETE`):** Bloqueada al público general. Solo administradores o Service Role pueden alterar el catálogo.

---

## 2. Tabla `public.orders` (Requisiciones y Cotizaciones)
Almacena el histórico de cotizaciones generadas por municipios y corporaciones.

| Columna | Tipo de Dato | Nulo | Descripción / Reglas |
|---|---|---|---|
| `id` | `UUID` | `NO` (PK) | Identificador único interno generado con `uuid_generate_v4()`. |
| `folio` | `TEXT` | `NO` | Folio comercial institucional único (ej. `COT-MUVSTPK2`). Sincronizado con el PDF y el correo. |
| `fecha` | `TIMESTAMPTZ` | `NO` | Fecha y hora de recepción del pedido (default `NOW()`). |
| `municipio` | `TEXT` | `NO` | Nombre del municipio, agencia o dependencia solicitante. |
| `detalles_pedido` | `TEXT` | `NO` | Resumen textual consolidado de las partidas (ej. `3x Gorra Gabardina \| 4x Gorra Licra`). |
| `num_partidas` | `INTEGER` | `NO` | Número de renglones o productos distintos en la cotización. |
| `total_piezas` | `INTEGER` | `NO` | Sumatoria total de unidades físicas solicitadas. |
| `total_mxn` | `NUMERIC` | `NO` | Importe monetario total en pesos mexicanos con IVA. |
| `status` | `TEXT` | `SÍ` | Estado operativo de la cotización (`pendiente`, `en_proceso`, `entregado`, default `pendiente`). |

### Políticas de Row Level Security (RLS) en `orders`:
* **RLS Habilitado:** Sí (`ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;`).
* **Lectura (`SELECT`):** Restringida (`FOR SELECT USING (false);`). Ningún usuario anónimo desde el cliente puede listar o ver pedidos ajenos.
* **Inserción (`INSERT`):** Permitida exclusivamente para el backend serverless (`netlify/functions/orders.js`) que se autentica mediante `SUPABASE_SERVICE_KEY` para garantizar integridad.

---

## 3. Consideraciones para Migraciones Futuras
* Todos los cambios a estas tablas deben ser **aditivos** (añadir columnas con valor por defecto o nulas).
* Archivos versionados en el directorio `supabase/migrations/<timestamp>_<descripcion>.sql`.
* Prohibido ejecutar sentencias destructivas (`DROP TABLE`, `DROP COLUMN`) en producción.
