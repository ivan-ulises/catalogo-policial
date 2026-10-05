# Sistema de Diseño

## Identidad Visual y Paleta de Colores
El sistema extiende Tailwind CSS para inyectar su propia paleta B2B:

- **Navy (Principal)**: `#0A192F` - Usado para fondos primarios (Header), títulos importantes y jerarquías principales. Transmite autoridad y seriedad (policial).
- **Gold (Acento)**: `#FFD700` - (y variantes `hover`, `dark`) Usado para botones de llamada a la acción (CTA), badges distintivos y acentos visuales importantes.
- **Slate (Suave)**: `#8892B0` - Textos secundarios y descripciones sutiles (gris/azulado).
- **Gris (Fondo de UI)**: Basado en grises nativos de Tailwind (`gray-50`) para el fondo global.

## Tipografías
- **Display**: `Barlow Condensed` (400, 600, 700, 800). Aplicada en títulos (`h1`, `h2`), botones primarios, contadores numéricos y badges. Otorga un look táctico y claro.
- **Body**: `Source Sans 3` (400, 500, 600). Aplicada en descripciones de producto, párrafos largos e inputs. Pensada para máxima legibilidad.

## Espaciados
- Sigue la escala estándar de Tailwind CSS (`gap-4`, `py-10`, `px-4`).
- Contenedores principales limitados por `max-w-7xl` para centralización, excepto el Header que abarca hasta `max-w-[1600px]`.

## Componentes Repetidos

### Botones
- **Primario (Add to Cart / Checkout)**: Fondo `bg-gold`, texto `text-navy` en mayúsculas `font-display`, con sombra y ligera animación `hover:scale-[1.02]`.
- **Filtros (Pills)**: Bordes redondeados `rounded-full`, fondo blanco, texto secundario. Al activarse cambian a fondo `bg-navy` y texto `text-gold`.

### Tarjetas de Producto
- Fondo blanco puro `bg-white`, contenedor `rounded-2xl` con sombra sutil `shadow-md` y borde `border-gray-100`.
- El bloque superior es para la imagen (o slider) con `h-44`, contenido `object-cover`.
- Se incrustan Badges de "Referencia Interna" absolutos en la esquina superior izquierda.

### Modales / Overlay
- Fondo oscuro semi-transparente (`bg-black/60` o `/50`).
- Modal principal (cotización) utiliza fondo blanco centrado, jerarquía de tablas simples en su interior para imitar una factura/orden real.
