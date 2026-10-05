# Workflow: /revision-semanal

Rutina periódica de salud, seguridad y rendimiento del sistema.

1. **Revisión de Base de Datos en Supabase:**
   - Checar el volumen de la tabla `orders` y verificar que los estados de los pedidos se estén actualizando.
   - Revisar logs de Supabase en busca de errores de cuota o peticiones rechazadas por RLS.
2. **Revisión de Despacho de Correos en Resend:**
   - Verificar la tasa de entrega (Delivery rate), rebotes y posibles quejas de spam en [resend.com](https://resend.com).
3. **Auditoría de Logs en Netlify Functions:**
   - Inspeccionar la pestaña de Functions en Netlify para detectar posibles timeouts o errores 500 no reportados.
4. **Revisión del Backlog:**
   - Actualizar el estado de tareas en `docs/BACKLOG.md` y priorizar elementos según feedback operativo.
