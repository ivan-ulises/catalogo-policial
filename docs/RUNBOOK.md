# Runbook Operativo — Catálogo B2B Suministros A. R.

Procedimientos operativos estándar para despliegue, monitoreo, solución de incidentes y reversión de cambios en producción.

---

## 1. Procedimiento Estándar de Despliegue (Release)

1. **Desarrollo en rama aislada:**
   * Crear rama: `git checkout -b feat/fase-N-nombre`
   * Implementar cambios y verificar sintaxis localmente: `node --check <archivo>`
2. **Push y Deploy Preview:**
   * `git push origin feat/fase-N-nombre`
   * Netlify generará automáticamente un *Deploy Preview* con una URL única.
3. **Validación de QA:**
   * Probar el flujo completo en la URL de Deploy Preview (catálogo -> agregar al carrito -> generar cotización -> confirmar recepción de correo y registro en Supabase).
4. **Aprobación y Merge:**
   * Solicitar aprobación por escrito del usuario / responsable.
   * Fusionar la rama a `main`. Netlify desplegará automáticamente a producción en segundos.

---

## 2. Procedimiento de Reversión (Rollback Rápido)

Si un despliegue en producción introduce un error crítico:
1. **Opción A (Inmediata vía Netlify Console):**
   * Ir al dashboard de Netlify -> pestaña **Deploys**.
   * Localizar el último deploy funcional marcado como *"Published"*.
   * Hacer clic en los tres puntos (`...`) y seleccionar **"Publish deploy"**. El sitio volverá al estado funcional en < 5 segundos.
2. **Opción B (Vía Git):**
   * Revertir el último commit:
     ```bash
     git revert HEAD --no-edit
     git push origin main
     ```

---

## 3. Guía de Solución de Incidentes (Troubleshooting)

### Caso A: El correo con el PDF no llega a operaciones
1. **Verificar logs de la función serverless:**
   * En Netlify -> **Functions** -> `orders.js` -> revisar consola de logs en tiempo real.
2. **Revisar estado de Resend:**
   * Ingresar a [resend.com/emails](https://resend.com/emails).
   * Verificar si el correo aparece en estado `Delivered`, `Bounced` o `Suppressed`.
   * Si Resend arroja error 403: verificar que `RESEND_API_KEY` en Netlify sea válida y que el remitente coincida con el dominio autorizado (o `onboarding@resend.dev` en modo prueba).
3. **Revisar tamaño del PDF:**
   * Si el payload excede los 6MB (límite de Netlify Functions), la petición fallará con 413.

---

### Caso B: Error al guardar en base de datos ("Error de conexión" o 500)
1. **Verificar variables en Netlify:**
   * Revisar que `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` estén correctamente configuradas en **Site configuration -> Environment variables**.
2. **Comprobar conectividad y estado de Supabase:**
   * Abrir el panel de Supabase y verificar el estado del proyecto (que no esté en pausa o excediendo cuotas).
   * Ir al **Table Editor** -> tabla `orders` para ver si los registros están entrando.
3. **Revisar políticas RLS:**
   * La función serverless utiliza `SUPABASE_SERVICE_KEY`, la cual debe saltarse el RLS. Si se usó por error `ANON_KEY`, Supabase rechazará el `INSERT`.

---

### Caso C: El catálogo queda en "Cargando catálogo de suministros..."
1. **Verificar consola del navegador (F12):**
   * Si hay error de red en `fetchProducts`: verificar que `SUPABASE_ANON_KEY` y `SUPABASE_URL` en `api/supabaseClient.js` respondan con código 200.
   * Si hay un error de sintaxis o importación faltante (`Failed to resolve module specifier`), revisar que todas las rutas relativas en los `import` apunten a archivos existentes.
