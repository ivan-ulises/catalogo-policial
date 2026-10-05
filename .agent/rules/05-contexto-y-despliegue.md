# Regla 05: Contexto de Producción y Protocolo de Despliegue

## Rol y Contexto del Equipo
Operamos como un equipo de ingeniería senior (Arquitecto, Backend, Frontend, QA y DevOps) trabajando sobre un sistema **YA EN PRODUCCIÓN**.

### Contexto del Sistema
- **Plataforma:** B2B "Suministros A. R." — Catálogo interactivo y cotizador formal de uniformes y equipamiento táctico para municipios y corporaciones de seguridad pública.
- **Modelo comercial:** Requisición y cotización institucional B2B. **NO es un e-commerce**, no hay pasarela de pagos directa ni cobro con tarjeta.
- **Flujo principal:**
  1. Cliente configura prendas y equipo en el carrito (tallas, colores, cantidades).
  2. Generación de cotización institucional con **Folio único** (`COT-XXXX`).
  3. Renderizado client-side de **PDF vectorial Carta** con membrete, desglose de IVA y paginación (`jsPDF 2.5.1` + `AutoTable 3.8.2`).
  4. Envío y persistencia en Supabase (tabla `orders`).
  5. Envío transaccional del correo formal con el PDF adjunto mediante Resend API a operaciones (`terminalasuncion.1@gmail.com`).
  6. Opción para canalizar la requisición vía WhatsApp.

### Stack Tecnológico (FILOSOFÍA NO-BUILD ESTRICTA — PROHIBIDO ROMPER)
- **JavaScript Vanilla ES6+ Modular:** `import` / `export` nativos. **Terminantemente prohibido** introducir React, Vue, Webpack, Vite o cualquier bundler/compilador en el cliente.
- **Tailwind CSS por CDN:** Clases utilitarias directas (migración a CLI standalone reservada para Fase 5 con aprobación previa).
- **Event-Driven Architecture (EDA):** Comunicación desacoplada usando `CustomEvent` (`product:add`, `cart:updated`, `cart:checkout`, etc.).
- **Base de Datos:** Supabase PostgreSQL (`products` con RLS público de lectura; `orders` con Service Role).
- **Backend Serverless:** Netlify Functions (`netlify/functions/orders.js`) en Node.js.
- **Hosting y CI/CD:** Netlify conectado al repositorio GitHub.
- **Archivos Clave:** `index.html`, `main.js`, `api/supabaseClient.js`, `components/catalog.js`, `components/cart.js`, `utils/orders.js`, `utils/whatsapp.js`, `netlify/functions/orders.js`, `supabase_schema.sql`.

---

## Reglas de Trabajo Obligatorias

1. **Ahorro de Tokens y Contexto:**
   - Consultar primero `AGENTS.md` y `docs/FILE_MAP.md`.
   - Abrir y leer estrictamente los archivos que la tarea requiera. No releer el repositorio completo.
   - Mostrar diffs quirúrgicos en las respuestas, no archivos enteros.
2. **Control de Ramas y Git (Cero Push Directo a Main):**
   - **NUNCA** hacer push directo a `main`.
   - Cada fase o feature se desarrolla en su propia rama (`feat/fase-N-nombre`).
   - Abrir Pull Request o dejar listo el Deploy Preview de Netlify para revisión.
3. **Seguridad e Integridad de Base de Datos:**
   - **NUNCA** ejecutar SQL destructivo contra producción (`DROP`, `TRUNCATE`, mutaciones sin respaldo).
   - Todos los cambios de esquema van versionados como archivos en `supabase/migrations/` (aditivos, no bloqueantes y con rollback documentado).
   - La aplicación de migraciones requiere autorización o ejecución explícita del usuario.
4. **Manejo Seguro de Secretos:**
   - **NUNCA** escribir secretos (`SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, Turnstile, etc.) en código fuente ni en commits.
   - Usar exclusivamente variables de entorno de Netlify.
   - Documentar variables requeridas en `docs/ENV_VARS.md` (únicamente los nombres/claves, jamás los valores).
5. **Retrocompatibilidad Operativa:**
   - Todo cambio de comportamiento debe garantizar compatibilidad hacia atrás: los pedidos preexistentes en la tabla `orders` no deben romperse, corromperse ni perderse.
6. **Criterios de Aceptación (Definición de Terminado):**
   - Antes de fusionar a `main`: pruebas y sintaxis verificadas, checklist de QA completo, deploy preview validado y **aprobación explícita y por escrito del usuario**.
7. **Documentación Continua de Cada Fase:**
   - Tras concluir cada fase: actualizar `docs/FILE_MAP.md`, `CHANGELOG.md`, documentos afectados y skills/roles que cambien.
   - Detallar siempre los **PASOS MANUALES** requeridos por el usuario (DNS, API keys, credenciales, consola de Auth, ejecución de migraciones).
8. **Prudencia Operativa:**
   - Si un paso es ambiguo, destructivo o riesgoso para el sistema en vivo, detenerse y preguntar antes de ejecutar.
9. **Convención de Idiomas y Tono:**
   - Código fuente, nombres técnicos y comentarios en **inglés técnico**.
   - Textos de interfaz de usuario, modales, PDF y correos electrónicos en **español de México**, con tono institucional, sobrio y formal.
10. **Reporte de Cierre de Fase:**
    - Cada fase concluye con un reporte estructurado:
      - Qué se hizo.
      - Qué archivos se modificaron o crearon.
      - Cómo probarlo paso a paso.
      - Matriz de riesgos identificados.
      - Plan de rollback (cómo revertirlo en caso de falla).
