# Mapa Maestro - Suministros A. R. (Catálogo B2B)

## Resumen del Proyecto
Sistema B2B tipo catálogo interactivo para ventas de uniformes y equipamiento policial municipal. No cuenta con pasarela de pagos tradicional; el carrito (lista de pedido) genera una requisición formal que el usuario manda a producción vía WhatsApp o un modal formal que conecta a Google Sheets/Email usando Google Apps Script.

## Documentación Esencial
- [Arquitectura (Stack y Flujos)](docs/ARCHITECTURE.md)
- [Mapa de Archivos (Módulos y Responsabilidades)](docs/FILE_MAP.md)
- [Sistema de Diseño (Colores y UI)](docs/DESIGN_SYSTEM.md)
- [Gestión del Catálogo (Google Sheets y Reglas)](docs/CATALOG.md)
- [Backlog (Diagnóstico y Mejoras Pendientes)](docs/BACKLOG.md)

## Convenciones del Proyecto
1. **Puro JS ES6**: El proyecto no utiliza Node.js, Webpack, Vite, React ni Vue. Emplea `import`/`export` nativos de ES6 y se despacha directamente al navegador.
2. **Tailwind via CDN**: Las clases CSS están escritas directo en los literales JS o en el `index.html`. 
3. **Comunicación Event-Driven**: Los componentes no se invocan entre sí directamente. Uno emite un CustomEvent global (`document.dispatchEvent`) y otro lo atrapa. 
4. **Resiliencia de Red**: Peticiones críticas (al Apps Script) envueltas en `Promise.race()` dentro de `gasClient.js` para asegurar fallbacks y experiencia fluida.

## Comandos / Rutina de Desarrollo
- **Instalar dependencias**: `N/A`. No hay `package.json`.
- **Servir en Local**: Debes levantar un servidor web estático básico desde la raíz.
  ```bash
  python -m http.server 8080
  # o
  npx serve .
  ```
- **Hacer Build**: `N/A`.
- **Despliegue**: Automático en Netlify al pushear a la rama principal (revisar `netlify.toml`).
- **Backend**: Cualquier modificación en `Code.gs` debe copiarse manualmente al editor de Apps Script web y crear una "Nueva Implementación".

*Este documento es el punto de inicio definitivo para cualquier IA o Dev que toque este repositorio.*
