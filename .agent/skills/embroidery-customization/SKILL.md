---
name: embroidery-customization
description: Modelo y UI para personalización táctica de prendas (escudos municipales, parches, sectores reflectivos y costos adicionales).
---

# Embroidery & Tactical Customization

Estándar para manejar personalización de uniformes policiales (bordados y sectores) en catálogo y cotización.

## Principios Clave
1. **Zonas predefinidas:** Identificar ubicaciones estándar en prendas tácticas (Pecho izquierdo, Espalda, Manga derecha, Manga izquierda).
2. **Impacto en precios:** Permitir costo base por prenda + recargo por bordado o personalización.
3. **Reflejo en documentos:** El PDF formal y la orden en Supabase deben detallar explícitamente el texto del bordado o escudo solicitado.
4. **Almacenamiento de archivos:** Si el cliente sube el escudo municipal en imagen/vector, almacenar en Supabase Storage en un bucket público/privado seguro.

## Checklist de Implementación
- [ ] Definir catálogo de opciones de personalización en la tabla de productos o metadatos JSON.
- [ ] Integrar selectores claros en la tarjeta de producto o modal previo a agregar al carrito.
- [ ] Incluir la descripción de personalización en el payload de `product:add`.
- [ ] Mostrar el desglose de personalización en el sidebar del carrito y tabla de cotización.
- [ ] Reflejar el desglose detallado en el generador de PDF (`_buildInvoicePDF`).
- [ ] Probar que el total general calcule correctamente las piezas con y sin personalización.
