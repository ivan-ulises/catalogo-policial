---
name: quote-pdf-generator
description: Generación documental vectorial client-side con jsPDF y AutoTable (membrete, paginación, Carta, IVA).
---

# Quote PDF Generator

Estándar para la construcción de cotizaciones vectoriales formales en el navegador.

## Principios Clave
1. **Vectorial nativo:** Usar `jsPDF` y `AutoTable` directamente sobre coordenadas de página. Prohibido usar capturas de pantalla o `html2canvas` para el documento final.
2. **Formato institucional:** Tamaño Carta (`letter`), orientación vertical (`portrait`), fuentes estándar (`helvetica`, `courier`), colores corporativos (#0A192F, #FFD700).
3. **Paginación limpia:** Encabezados repetidos en cada página (`showHead: 'everyPage'`), evitar filas partidas (`rowPageBreak: 'avoid'`) y pie de página dinámico (`Página X de Y`).
4. **Desglose financiero:** Mostrar precios unitarios base (sin IVA), columna de IVA 16% y subtotal, con bloque final de totales destacados.

## Checklist de Calidad del PDF
- [ ] Validar que `window.jspdf.jsPDF` esté disponible antes de invocar la generación.
- [ ] Asegurar que el folio comercial (`COT-XXXX`) sea idéntico al enviado al backend.
- [ ] Probar con pedidos cortos (1 a 3 ítems) y pedidos extensos (15 a 30 ítems) para validar saltos de página.
- [ ] Verificar que no existan caracteres especiales no soportados por fuentes PDF estándar (usar guiones ASCII).
- [ ] Devolver base64 limpio listo para adjuntar en correo y descargar en cliente.
