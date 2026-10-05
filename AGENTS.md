# Mapa Maestro — Suministros A. R. (Catálogo B2B en Producción)

## Contexto y Misión
Plataforma web institucional B2B para **Suministros A. R.** especializada en equipamiento policial y táctico municipal.
**Modelo B2B Requisición/Cotizador:** No es un e-commerce; no procesa pagos con tarjeta.
El comprador municipal arma su selección -> genera requisición con folio único (`COT-XXXX`) -> genera PDF vectorial Carta (`jsPDF` + `AutoTable`) -> persiste en PostgreSQL (`orders` vía Supabase) -> despacha correo formal con PDF adjunto (Netlify Functions + Resend) -> permite envío complementario por WhatsApp.

## Protocolo de Producción Obligatorio
> Documento normativo: [`.agent/rules/05-contexto-y-despliegue.md`](.agent/rules/05-contexto-y-despliegue.md)

1. **Ahorro de tokens:** Leer primero este archivo y [`docs/FILE_MAP.md`](docs/FILE_MAP.md). Abrir únicamente los archivos estrictamente necesarios.
2. **Cero push directo a `main`:** Trabajar por fases en ramas (`feat/fase-N-nombre` o `chore/...`). Preparar PR / Deploy Preview.
3. **Cero SQL destructivo:** Migraciones aditivas y versionadas en `supabase/migrations/` con rollback documentado.
4. **Secretos seguros:** Jamás commitear API keys. Variables en Netlify y documentadas en [`docs/ENV_VARS.md`](docs/ENV_VARS.md).
5. **Retrocompatibilidad:** No romper registros históricos de pedidos en la tabla `orders`.
6. **Criterio de merge:** Pruebas verificadas, checklist de QA, Deploy Preview probado y **aprobación explícita del usuario**.
7. **Documentación continua:** Actualizar [`docs/FILE_MAP.md`](docs/FILE_MAP.md), [`docs/CHANGELOG.md`](docs/CHANGELOG.md) y listar pasos manuales.
8. **Prudencia:** Ante dudas de seguridad o ambigüedad, consultar antes de aplicar cambios.
9. **Idiomas:** Código/comentarios en inglés técnico; interfaz, correos y PDF en español institucional de México.
10. **Reporte de fase:** Detallar cambios, archivos tocados, cómo probar, riesgos y rollback.

## Stack Técnico (Filosofía NO-BUILD Estricta)
* **Frontend:** Vanilla JavaScript ES6 nativo (`import`/`export`), Tailwind CSS vía CDN. **Prohibido introducir React/Vue/Webpack/Vite/bundlers**.
* **Arquitectura:** Event-Driven Architecture (EDA) con `CustomEvent` en `document`. Ver detalle en [`docs/EVENTS.md`](docs/EVENTS.md).
* **Motor PDF:** `jsPDF (2.5.1)` + `jsPDF-AutoTable (3.8.2)` en el cliente (vectorial, multipágina, Carta).
* **Base de Datos:** Supabase PostgreSQL (`products` con RLS público; `orders` gestionada vía Service Role). Ver [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).
* **Backend:** Netlify Functions Node.js (`netlify/functions/orders.js`) + Resend API.
* **Hosting & CI/CD:** Netlify conectado a la rama `main` de GitHub.

## Comandos y Rutinas de Desarrollo
```bash
# Servir en local (puerto 8080 o cualquiera disponible)
python -m http.server 8080
# o alternativamente con Node
npx serve .

# Emular Netlify Functions en local (opcional)
npx netlify dev
```

## Índice de Documentación Esencial
* [Arquitectura y Flujos](docs/ARCHITECTURE.md)
* [Mapa de Archivos y Responsabilidades](docs/FILE_MAP.md)
* [Catálogo de Eventos (CustomEvents)](docs/EVENTS.md)
* [Modelo de Datos y Esquema SQL](docs/DATA_MODEL.md)
* [Variables de Entorno Requeridas](docs/ENV_VARS.md)
* [Roles de Subagentes](docs/AGENT_ROLES.md)
* [Guía Operativa y Runbook](docs/RUNBOOK.md)
* [Backlog Priorizado](docs/BACKLOG.md)
* [Historial de Cambios (Changelog)](docs/CHANGELOG.md)
* [Sistema de Diseño](docs/DESIGN_SYSTEM.md)
