---
name: admin-panel
description: Implementación y mantenimiento de vistas protegidas con Supabase Auth, roles de usuario y RLS de lectura administrativa.
---

# Admin Panel Architecture

Pautas para construir y mantener el panel interno de gestión de pedidos sin romper el frontend público.

## Principios Clave
1. **Autenticación con Supabase Auth:** Iniciar sesión con email/password de operador autorizado.
2. **Políticas RLS para administradores:** Crear políticas en Supabase basadas en roles o metadata de usuario (`auth.uid()`).
3. **Aislamiento visual:** El panel administrativo puede cargarse bajo una ruta aislada o modal protegido sin sobrecargar el flujo de clientes.
4. **Operaciones seguras:** El cambio de estatus de órdenes (`pendiente` -> `en_proceso`) debe auditarse con timestamp y usuario.

## Checklist de Desarrollo Admin
- [ ] Configurar usuario administrador en el panel de Supabase Auth.
- [ ] Definir política RLS `SELECT` y `UPDATE` en la tabla `orders` restringida a usuarios autenticados.
- [ ] Implementar pantalla de inicio de sesión con validación de credenciales.
- [ ] Diseñar vista tabular de cotizaciones con filtros por fecha y municipio.
- [ ] Proveer descarga directa del PDF o regeneración desde los datos de la orden.
- [ ] No exponer llaves Service Role en el navegador del administrador; usar token JWT de sesión de Supabase.
