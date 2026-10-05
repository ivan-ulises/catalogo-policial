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
| `subtotal_mxn` | `NUMERIC` | `SÍ` | Importe acumulado antes de IVA (calculado en servidor). |
| `iva_mxn` | `NUMERIC` | `SÍ` | Impuesto al Valor Agregado del 16% (calculado en servidor). |
| `status` | `TEXT` | `SÍ` | Estado operativo de la cotización (`pendiente`, `en_proceso`, `entregado`, default `pendiente`). |
| `idempotency_key` | `TEXT` | `SÍ` (UNIQUE) | Clave de idempotencia única para prevenir duplicados por reintentos o doble clic. |
| `items_snapshot` | `JSONB` | `SÍ` | Snapshot inmutable de las partidas (precios unitarios, tallas, colores y subtotales al momento de compra). |
| `email_status` | `TEXT` | `SÍ` | Estado de entrega del correo con PDF vía Resend (`pending`, `sent`, `failed`). |
| `email_error` | `TEXT` | `SÍ` | Detalle o mensaje de error en caso de fallo en el despacho por Resend. |
| `internal_notes` | `TEXT` | `SÍ` | Notas internas confidenciales de seguimiento para operadores. |
| `updated_at` | `TIMESTAMPTZ` | `SÍ` | Fecha y hora de última modificación operativa. |
| `updated_by` | `TEXT` | `SÍ` | Correo o identificador del usuario administrador que realizó el cambio. |

### Restricciones y Llaves Únicas en `orders`:
* `orders_folio_key`: Restricción `UNIQUE(folio)` para garantizar unicidad contable.
* `orders_idempotency_key_key`: Restricción `UNIQUE(idempotency_key)` para idempotencia.

### Políticas de Row Level Security (RLS) en `orders`:
* **RLS Habilitado:** Sí (`ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;`).
* **Lectura (`SELECT`):** Restringida al público; permitida exclusivamente a usuarios autenticados con rol en `admin_users` mediante `public.is_admin()`.
* **Actualización (`UPDATE`):** Permitida exclusivamente a administradores verificados (`public.is_admin()`).
* **Inserción (`INSERT`):** Permitida exclusivamente para el backend serverless (`netlify/functions/orders.js`) con `SUPABASE_SERVICE_KEY`.

---

## 3. Tabla `public.admin_users` (Administradores Autorizados)
Control de acceso y roles administrativos vinculado a `auth.users` de Supabase.

| Columna | Tipo de Dato | Nulo | Descripción |
|---|---|---|---|
| `id` | `UUID` | `NO` (PK) | Llave foránea hacia `auth.users(id)`. |
| `email` | `TEXT` | `NO` (UNIQUE) | Correo electrónico institucional del operador. |
| `role` | `TEXT` | `NO` | Rol administrativo (`admin`, `superadmin`, `operador`, default `admin`). |
| `created_at` | `TIMESTAMPTZ` | `SÍ` | Fecha de alta del operador. |
| `last_login` | `TIMESTAMPTZ` | `SÍ` | Registro de última sesión. |

### Políticas RLS en `admin_users`:
* **Lectura:** Un usuario autenticado solo puede leer su propio registro (`auth.uid() = id`).

---

## 4. Tabla `public.order_audit_logs` (Bitácora de Auditoría)
Historial inmutable de cambios y acciones sobre requisiciones.

| Columna | Tipo de Dato | Nulo | Descripción |
|---|---|---|---|
| `id` | `UUID` | `NO` (PK) | Identificador del evento de auditoría. |
| `order_id` | `UUID` | `NO` (FK) | Vínculo hacia `public.orders(id)`. |
| `action` | `TEXT` | `NO` | Acción ejecutada (`status_change`, `note_added`, `email_resent`). |
| `previous_state` | `JSONB` | `SÍ` | Estado anterior. |
| `new_state` | `JSONB` | `SÍ` | Nuevo estado asignado. |
| `user_id` | `UUID` | `SÍ` | Operador que ejecutó la acción. |
| `user_email` | `TEXT` | `SÍ` | Correo del operador. |
| `created_at` | `TIMESTAMPTZ` | `SÍ` | Timestamp del evento (default `NOW()`). |

### Políticas RLS en `order_audit_logs`:
* **Lectura e Inserción:** Exclusiva para administradores verificados (`public.is_admin()`).

---

## 5. Consideraciones para Migraciones Futuras
* Todos los cambios a estas tablas deben ser **aditivos** (añadir columnas con valor por defecto o nulas).
* Archivos versionados en el directorio `supabase/migrations/<timestamp>_<descripcion>.sql`.
* Prohibido ejecutar sentencias destructivas (`DROP TABLE`, `DROP COLUMN`) en producción.
