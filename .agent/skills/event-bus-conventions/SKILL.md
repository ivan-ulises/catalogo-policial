---
name: event-bus-conventions
description: Convenciones, tipado con JSDoc y manejo de CustomEvents en la arquitectura desacoplada de la aplicación.
---

# Event Bus Conventions

Normas para la comunicación mediante Event-Driven Architecture (EDA) en Vanilla JS.

## Principios Clave
1. **Desacoplamiento total:** Los componentes UI no se llaman entre sí directamente. Toda interacción cruzada se canaliza por `document.dispatchEvent`.
2. **Nomenclatura semántica:** Usar el formato `entidad:accion` (ej. `product:add`, `cart:updated`, `cart:checkout`).
3. **Payloads consistentes:** Todos los datos se envían dentro de `event.detail`. Los receptores deben manejar campos opcionales con defaults seguros.
4. **Documentación obligatoria:** Cada nuevo evento debe registrarse en `docs/EVENTS.md` con su estructura JSON de ejemplo.

## Checklist para Nuevos Eventos
- [ ] Definir nombre siguiendo el patrón `entidad:accion`.
- [ ] Documentar el payload en JSDoc en el punto de emisión.
- [ ] Asegurar que el receptor use validación defensiva (`e.detail?.campo ?? valorPorDefecto`).
- [ ] Registrar emisor, receptor y payload en `docs/EVENTS.md`.
- [ ] Verificar que no existan bucles infinitos de eventos entre emisores y escuchadores.
