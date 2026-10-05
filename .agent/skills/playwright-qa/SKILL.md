---
name: playwright-qa
description: Estrategia de pruebas automatizadas End-to-End con Playwright para verificar flujos críticos de compra y cotización.
---

# Playwright QA

Guía para diseñar y ejecutar pruebas automatizadas E2E en el flujo de pedidos sin alterar el código de producción.

## Principios Clave
1. **Flujo crítico de punta a punta:** Verificar que la app cargue productos -> agregue al carrito -> valide municipio -> emita PDF -> envíe la orden.
2. **Aislamiento de tests:** Las pruebas no deben dejar basura en la tabla `orders` de producción. Usar prefijo de prueba en el municipio (ej. `[TEST-AUTOMATED]`).
3. **Mocks de red si es necesario:** Para pruebas de interfaz continuas, interceptar la llamada a `/.netlify/functions/orders` para validar el payload enviado.

## Checklist de Pruebas Críticas
- [ ] Test 1: Carga inicial de catálogo (al menos un producto renderizado con título y precio).
- [ ] Test 2: Filtrado por partida presupuestal y búsqueda por palabra clave.
- [ ] Test 3: Agregar al carrito con talla y validación de contador de ítems.
- [ ] Test 4: Bloqueo de checkout cuando el campo de municipio está vacío.
- [ ] Test 5: Envío de pedido exitoso con generación de PDF y modal de confirmación.
- [ ] Ejecutar en modo headless: `npx playwright test`.
