# Gestión del Catálogo y Productos

## 1. El Origen de Datos (Supabase)
Toda la base de datos de productos de Suministros A. R. ahora reside en **Supabase** (PostgreSQL) usando la tabla `products`.
- Se expone mediante una REST API anónima de sólo lectura.
- La URL y el Anon Key están guardados en el `.env` (en el despliegue se configuran en las variables de entorno de Netlify).
- `api/supabaseClient.js` es el encargado de consultar los datos de forma instantánea.

## 2. Estructura de Columnas (Requerido)
La tabla `products` en Supabase requiere la siguiente estructura:
- `id_producto` (uuid, PK): Identificador único interno.
- `sku` (text): Código comercial (ej. `BOTA-511`).
- `nombre` (text): Nombre público del bien.
- `descripcion` (text): Características técnicas.
- `categoria` / `partida` (text): Agrupa los productos en los botones superiores (ej. "Calzado", "Uniformes").
- `tallas` (text): Separadas por coma (ej. `CH, M, G, XG` o `Única`).
- `precio` (numeric): Valor bruto (se renderiza agregando formato de moneda).
- `imagen_url` (text): Enlace directo a la imagen.
- `variantes` (text): (Opcional) Parámetros especiales.
- `colores` (text): (Opcional) Usado para productos con variantes de color.

## 3. Tipos Especiales (Hardcoded en JS)
Por cómo está estructurado `catalog.js`, existen productos que inyectan UI especial si su nombre coincide:
- **Táctico / Fornitura**: Si el título incluye la palabra "Fornitura", se inyecta un módulo especial en la tarjeta para elegir *Cantidad de Compartimientos*. Permite cobrar extra si los compartimientos superan el estándar (5 base).
- **Selector de Colores**: Los productos que incluyen en el nombre ciertas palabras ("bota", "gorra", "pantalón", "chamarra", "playera") renderizan automáticamente selectores de color (paleta dura de CSS en `catalog.js` como Azul, Negro, Rojo, Blanco, Gris, Beige).

## 4. ¿Cuándo tocar el código vs la Base de Datos?
- **Actualizar precio, talla, imagen, crear producto nuevo, cambiar su categoría**: SOLO EDITA LA TABLA DE SUPABASE usando su interfaz web de administrador. No requiere despliegues, es inmediato.
- **Agregar nuevos colores a la paleta, cambiar la lógica de cobro de fornituras o modificar el diseño de las tarjetas**: Se DEBE tocar `components/catalog.js` y hacer un nuevo commit.
