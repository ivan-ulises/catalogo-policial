---
name: supabase-migrations
description: Guía de migraciones aditivas de esquema, configuración de políticas RLS y documentación de rollback en Supabase.
---

# Supabase Migrations

Buenas prácticas para cambios en la base de datos PostgreSQL sin interrupción del servicio en producción.

## Principios Clave
1. **Migraciones aditivas:** Solo agregar columnas nulas o con valor por defecto. Prohibido eliminar o renombrar columnas en caliente.
2. **Versionado ordenado:** Guardar cada cambio en `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql`.
3. **Rollback documentado:** Cada archivo de migración debe incluir en comentarios el script SQL exacto para revertir la operación.
4. **Seguridad RLS obligatoria:** Cada tabla creada debe tener `ENABLE ROW LEVEL SECURITY;` y políticas explícitas.

## Checklist de Migración
- [ ] Redactar script SQL aditivo y no bloqueante.
- [ ] Incluir bloque de reversión (`-- ROLLBACK: ...`) al final del archivo.
- [ ] Verificar impacto en tablas activas (`products` y `orders`).
- [ ] Probar la migración en un entorno de desarrollo o copia de prueba de Supabase.
- [ ] Solicitar confirmación explícita del usuario antes de aplicar en producción.
- [ ] Documentar nuevas columnas en `docs/DATA_MODEL.md`.
