---
name: release-to-production
description: Protocolo estricto de despliegue a producción mediante ramas, Deploy Previews, aprobación explícita y verificación post-merge.
---

# Release to Production

Protocolo obligatorio para llevar cambios de código o esquema a producción sin riesgo de interrupción.

## Principios Clave
1. **Cero push directo a main:** Todo cambio entra mediante Pull Request o rama de feature/chore.
2. **Deploy Preview obligatorio:** Probar la funcionalidad en la URL efímera generada por Netlify antes del merge.
3. **Aprobación escrita:** No fusionar a `main` sin el visto bueno explícito del usuario responsable.
4. **Verificación inmediata:** Tras el merge, probar la versión en vivo en el dominio oficial o URL de producción.

## Checklist de Release
- [ ] Crear rama de trabajo: `git checkout -b feat/fase-X-nombre`.
- [ ] Implementar cambios respetando la filosofía no-build.
- [ ] Validar sintaxis y pruebas locales: `node --check`.
- [ ] Push de la rama y obtención de Deploy Preview de Netlify.
- [ ] Ejecutar prueba de humo sobre el Deploy Preview.
- [ ] Solicitar confirmación explícita al usuario.
- [ ] Merge a `main` y verificar que el build en Netlify finalice en `Published`.
- [ ] Registrar entrega en `docs/CHANGELOG.md`.
