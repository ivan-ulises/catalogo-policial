# Workflow: /nueva-fase

Guía de inicio para una nueva fase de desarrollo o funcionalidad.

1. **Definición y Alcance:**
   - Leer `AGENTS.md`, `docs/BACKLOG.md` y `docs/FILE_MAP.md`.
   - Clarificar los archivos específicos requeridos para la tarea.
2. **Creación de Rama:**
   - Confirmar estar en `main` actualizado: `git checkout main && git pull`.
   - Crear rama de trabajo: `git checkout -b feat/fase-N-nombre`.
3. **Planificación:**
   - Describir plan de cambios, riesgos identificados y estrategia de prueba antes de modificar archivos.
4. **Ejecución y Verificación:**
   - Tocar solo los archivos estrictamente necesarios.
   - Validar sintaxis con `node --check`.
