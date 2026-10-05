# Guía de Despliegue — Catálogo B2B Suministros A. R.

## Información del Sitio

| Campo | Valor |
|-------|-------|
| **URL Producción** | https://snazzy-selkie-b2a65f.netlify.app |
| **Panel Netlify** | https://app.netlify.com/projects/snazzy-selkie-b2a65f |
| **Cuenta** | alexivan8945@gmail.com |
| **Directorio local** | `d:\proyecto_nuevo_catalogo_municipal` |
| **Stack** | HTML + Vanilla JS (ES Modules) + Tailwind CSS CDN |
| **Backend** | Google Apps Script (independiente, ver `Code.gs`) |

---

## Pre-requisitos

1. **Node.js** instalado en el sistema
2. **Netlify CLI** instalada globalmente:
   ```powershell
   npm install -g netlify-cli
   ```
3. **Sesión activa** — verificar con:
   ```powershell
   netlify status
   ```
   Si no está logueado:
   ```powershell
   netlify login
   ```
   Abrir el enlace de autorización en el navegador y confirmar.

---

## Desplegar Cambios a Producción

```powershell
cd d:\proyecto_nuevo_catalogo_municipal
netlify deploy --prod --dir . --message "descripcion breve del cambio"
```

Al finalizar, la CLI muestra la URL de producción confirmando que el cambio está en vivo.

## Vista Previa Antes de Publicar (recomendado para cambios grandes)

```powershell
netlify deploy --dir . --message "preview: descripcion"
```

Genera una URL temporal única para revisar sin afectar producción.

---

## Archivos que NO se Despliegan

Los siguientes archivos están bloqueados por `.netlifyignore` y `netlify.toml`:

| Archivo | Razón |
|---------|-------|
| `Code.gs` | Backend privado (Google Apps Script) |
| `*.xlsx` | Datos internos de precios |
| `*.pdf` | Listas de precios confidenciales |
| `Enlace a google sheets.txt` | URL privada de la hoja de cálculo |
| `.agents/` | Configuración interna del agente AI |

> [!WARNING]
> Nunca elimines `netlify.toml` ni `.netlifyignore`. Sin ellos, estos archivos
> privados quedarían expuestos públicamente en Internet.

---

## Arquitectura del Proyecto

```
proyecto_nuevo_catalogo_municipal/
├── index.html              ← Página principal
├── main.js                 ← Orquestador de módulos
├── netlify.toml            ← Config de Netlify (headers, redirects)
├── .netlifyignore          ← Archivos excluidos del deploy
├── components/
│   ├── catalog.js          ← Renderizado del catálogo de productos
│   └── cart.js             ← Carrito de pedido lateral
├── utils/
│   ├── orders.js           ← Generación de cotizaciones y PDF
│   ├── whatsapp.js         ← Integración WhatsApp
│   ├── gasClient.js        ← Cliente HTTP para Google Apps Script
│   └── format.js           ← Utilidades de formato (MXN, fechas)
├── api/
│   └── googleSheets.js     ← Carga de productos desde Google Sheets
├── assets/                 ← CSS, fuentes y recursos estáticos
├── Imagenes/               ← Logo e imágenes de productos
└── Code.gs                 ← ⚠ Backend (NO se despliega en Netlify)
```

---

## Backend — Google Apps Script

El archivo `Code.gs` **no se gestiona desde Netlify**. Para publicar cambios en el backend:

1. Entra a [script.google.com](https://script.google.com)
2. Abre el proyecto vinculado a la hoja de cálculo
3. Aplica tus cambios en el editor
4. Ve a **Implementar → Administrar implementaciones → Nueva versión**
5. Si el endpoint cambia, actualiza `utils/gasClient.js` y vuelve a hacer deploy en Netlify

---

## Cambiar el Nombre del Dominio

El dominio por defecto `snazzy-selkie-b2a65f.netlify.app` puede personalizarse:

1. Entra al [Panel de Netlify](https://app.netlify.com/projects/snazzy-selkie-b2a65f)
2. **Site settings → General → Site name**
3. Cambia el nombre (ej: `suministros-ar`) → la URL será `suministros-ar.netlify.app`

Para un **dominio propio** (ej. `suministrosar.com`):
- Panel → **Domain management → Add a domain**
- Netlify guía el proceso de configuración DNS paso a paso

---

## Comandos Rápidos

```powershell
# Ver estado de sesión
netlify status

# Desplegar a producción
netlify deploy --prod --dir . --message "cambio"

# Vista previa sin publicar
netlify deploy --dir .

# Abrir panel en el navegador
netlify open --site

# Ver logs del sitio
netlify logs:function
```
