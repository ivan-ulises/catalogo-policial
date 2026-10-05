# Workflow: /actualizar-docs

Protocolo de mantenimiento documental continuo.

1. **Identificar Módulos Modificados:**
   - Si se cambiaron nombres de archivos o responsabilidades -> actualizar `docs/FILE_MAP.md`.
   - Si se agregaron o alteraron eventos -> actualizar `docs/EVENTS.md`.
   - Si se alteraron columnas de base de datos -> actualizar `docs/DATA_MODEL.md`.
   - Si se crearon nuevas variables de entorno -> registrar en `docs/ENV_VARS.md`.
2. **Registrar en Bitácora:**
   - Añadir entrada descriptiva en `docs/CHANGELOG.md` con la versión y fecha correspondiente.
3. **Validación de Enlaces:**
   - Asegurarse de que las referencias relativas entre documentos Markdown apunten a rutas válidas.
