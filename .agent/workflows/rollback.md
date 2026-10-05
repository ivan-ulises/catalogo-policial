# Workflow: /rollback

Plan de contingencia y restauración inmediata ante incidentes en producción.

1. **Evaluación de la Gravedad:**
   - Si la página no carga o el checkout falla por completo: ejecutar reversión inmediata en < 2 minutos.
2. **Método 1: Netlify Instant Rollback (Recomendado):**
   - Ingresar a la consola de Netlify -> **Deploys**.
   - Identificar el deploy anterior funcional con estatus `Published`.
   - Seleccionar `...` -> **Publish deploy**. El sitio se restaura instantáneamente.
3. **Método 2: Git Revert:**
   - Crear commit de reversión:
     ```bash
     git revert HEAD --no-edit
     git push origin main
     ```
4. **Análisis Post-Mortem:**
   - Documentar la causa raíz del fallo en un archivo de notas antes de volver a intentar el despliegue.
