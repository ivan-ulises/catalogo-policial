# Variables de Entorno del Sistema

Lista oficial de variables de entorno requeridas para la ejecución de la plataforma en Netlify (Functions y Build).
**Nota de Seguridad:** Este archivo **JAMÁS** debe contener valores reales, contraseñas o tokens. Solo documenta los nombres, propósito y alcance.

---

## 1. Variables de Netlify (Site Settings -> Environment Variables)

| Variable | Alcance / Entorno | Sensibilidad | Propósito / Descripción |
|---|---|---|---|
| `SUPABASE_URL` | Build & Runtime (Functions) | Pública / Estándar | URL del proyecto Supabase (ej. `https://xxxx.supabase.co`). Necesaria para el cliente REST. |
| `SUPABASE_ANON_KEY` | Build & Runtime (Client) | Pública (RLS protegida) | Clave pública anónima de Supabase. Permite al frontend consultar la tabla `products`. |
| `SUPABASE_SERVICE_KEY` | Runtime (Functions únicamente) | **CRÍTICA / PRIVADA** | Clave maestra (Service Role) con bypass de RLS. Utilizada exclusivamente en `netlify/functions/orders.js` para insertar registros en `orders`. **NUNCA exponer al frontend**. |
| `RESEND_API_KEY` | Runtime (Functions únicamente) | **CRÍTICA / PRIVADA** | Token de autenticación de Resend API. Utilizado para autorizar el despacho de correos transaccionales con el PDF adjunto. |

---

## 2. Variables de Configuración en `netlify.toml`
* `SECRETS_SCAN_ENABLED`: Establecida en `"false"` en `netlify.toml` para permitir que `SUPABASE_ANON_KEY` resida en el bundle del frontend sin que Netlify Build bloquee el despliegue.

---

## 3. Lista de Verificación al Crear un Nuevo Entorno (Deploy Preview / Staging / Prod)
- [ ] `SUPABASE_URL` configurada y accesible.
- [ ] `SUPABASE_ANON_KEY` configurada para lectura pública.
- [ ] `SUPABASE_SERVICE_KEY` inyectada en las variables de servidor de Netlify.
- [ ] `RESEND_API_KEY` con permisos para enviar desde el dominio registrado.
- [ ] Correo destino validado (`terminalasuncion.1@gmail.com`).
