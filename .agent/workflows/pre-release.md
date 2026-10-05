# Workflow: /pre-release

Lista de verificación previa a la solicitud de aprobación de despliegue.

1. **Revisión de Cambios (Diff Check):**
   - Ejecutar `git status` y `git diff`.
   - Confirmar que no se toquen archivos innecesarios ni se incluyan secretos o credenciales.
2. **Validación de Código y Sintaxis:**
   - Validar sintaxis de archivos JavaScript modificados: `node --check <archivo>`.
3. **Deploy Preview en Netlify:**
   - Subir la rama: `git push origin <rama>`.
   - Probar el flujo completo en la URL de Deploy Preview generada por Netlify.
4. **Verificación de Generación de PDF:**
   - Generar un pedido de prueba y confirmar que el PDF se descargue completo, sin desbordamientos y con el folio idéntico al del correo.
5. **Solicitud de Aprobación:**
   - Presentar al usuario el resumen de cambios, URL de previsualización y solicitar confirmación por escrito para el merge.
