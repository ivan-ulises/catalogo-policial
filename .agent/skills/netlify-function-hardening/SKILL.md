---
name: netlify-function-hardening
description: Validación estricta, sanitización, manejo de errores, CORS y mitigación de abuso en Netlify Functions.
---

# Netlify Function Hardening

Guía para asegurar endpoints serverless en Node.js sobre Netlify Functions en producción.

## Principios Clave
1. **CORS explícito:** Responder solo a los orígenes requeridos o cabeceras estándar en peticiones POST. Manejar `OPTIONS` preflight con código 200.
2. **Validación de entrada:** Rechazar peticiones con payloads vacíos o incompletos antes de procesar lógica pesada.
3. **Manejo defensivo de errores:** Nunca filtrar trazas internas (stack traces) de la base de datos o secretos al cliente; responder con mensajes limpios.
4. **Control de tamaño de payload:** Verificar que el base64 del PDF no exceda el límite de memoria/tiempo de la función.

## Checklist de Implementación
- [ ] Validar método HTTP (`if (event.httpMethod !== 'POST') return 405`).
- [ ] Parsear `JSON.parse(event.body)` dentro de un bloque `try/catch`.
- [ ] Validar presencia y longitud de campos obligatorios (`municipio`, `items`, `total`, `pdfBase64`).
- [ ] Sanitizar inputs de texto contra inyecciones básicas antes de insertarlos.
- [ ] Configurar variables de entorno con fallback de advertencia si alguna falta.
- [ ] Retornar código HTTP 200 con cuerpo JSON estructurado (`{ ok: true, folio }`).
- [ ] Probar localmente con `npx netlify dev` antes de enviar al repositorio.
