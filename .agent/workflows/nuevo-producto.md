# Workflow: /nuevo-producto

Procedimiento para dar de alta o actualizar artículos en el catálogo municipal.

1. **Recolección de Datos del Producto:**
   - SKU / ID único.
   - Partida FORTAMUN de destino.
   - Nombre oficial del bien y ficha técnica detallada.
   - Unidad de medida (`PZA`, `PAR`, `JGO`).
   - Tallas disponibles (ej. `S, M, L, XL` o `Unitalla`).
   - Precio unitario final en MXN (con IVA incluido).
   - URL(s) de imagen optimizada (preferente relación aspecto 1:1 o 4:3).
2. **Inserción en Supabase:**
   - Ejecutar inserción en la tabla `public.products` vía Table Editor o script SQL.
3. **Verificación en Frontend:**
   - Recargar el catálogo y verificar que el artículo aparezca con su filtro de partida correspondiente.
   - Probar agregarlo al pedido, seleccionar talla y validar cálculo en carrito y PDF.
