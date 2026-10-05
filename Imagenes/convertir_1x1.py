import os
from PIL import Image, ImageOps

# CONFIGURACIÓN
carpeta_entrada = '.'  # Carpeta actual
carpeta_salida = './catalogo_final_1x1'
tamano_final = (1080, 1080)  # Resolución alta y estándar para web
color_fondo = (255, 255, 255)  # Blanco puro

if not os.path.exists(carpeta_salida):
    os.makedirs(carpeta_salida)


def hacer_cuadrada_con_fondo(img, size, color):
    """Añade fondo para hacer la imagen cuadrada sin recortar nada."""
    img.thumbnail(size, Image.Resampling.LANCZOS)
    # Crear lienzo cuadrado
    nuevo_lienzo = Image.new("RGB", size, color)
    # Pegar la imagen en el centro
    nuevo_lienzo.paste(
        img, ((size[0] - img.size[0]) // 2, (size[1] - img.size[1]) // 2)
    )
    return nuevo_lienzo


def procesar():
    # Extensiones de WhatsApp y web comunes
    extensiones = ('.jpg', '.jpeg', '.png', '.webp', '.jfif')
    archivos = [f for f in os.listdir(
        carpeta_entrada) if f.lower().endswith(extensiones)]

    if not archivos:
        print("No se encontraron imágenes en esta carpeta.")
        return

    print(f"--- Iniciando procesamiento de {len(archivos)} imágenes ---")

    for nombre in archivos:
        ruta_in = os.path.join(carpeta_entrada, nombre)
        try:
            with Image.open(ruta_in) as img:
                # 1. Corregir rotación de celular
                img = ImageOps.exif_transpose(img)

                # 2. Convertir a RGB (necesario para JPEG/WebP)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                # 3. Hacer cuadrada con fondo blanco
                img_final = hacer_cuadrada_con_fondo(
                    img, tamano_final, color_fondo)

                # 4. Guardar en carpeta nueva como WebP (Optimizado)
                nombre_limpio = os.path.splitext(nombre)[0]
                ruta_out = os.path.join(
                    carpeta_salida, f"{nombre_limpio}_1x1.webp")

                img_final.save(ruta_out, "WEBP", quality=80)
                print(f"✅ Listo: {nombre} -> {nombre_limpio}_1x1.webp")

        except Exception as e:
            print(f"❌ Error con {nombre}: {e}")

    print(f"\n--- Proceso terminado. Revisa la carpeta: {carpeta_salida} ---")


if __name__ == "__main__":
    procesar()
