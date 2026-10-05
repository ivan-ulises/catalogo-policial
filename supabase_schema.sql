-- 1. Tabla de Productos
CREATE TABLE public.products (
    id_producto TEXT PRIMARY KEY,
    partida_fortamun TEXT NOT NULL,
    nombre_bien TEXT NOT NULL,
    descripcion TEXT,
    unidad_medida TEXT NOT NULL,
    tallas_disponibles TEXT,
    precio_unitario NUMERIC NOT NULL,
    imagen_url TEXT
);

-- Habilitar RLS (Row Level Security) para productos
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Crear política de lectura pública (cualquier usuario puede ver el catálogo)
CREATE POLICY "Catálogo público" ON public.products
    FOR SELECT USING (true);

-- 2. Tabla de Pedidos (Reemplaza la hoja de Google Sheets de destino)
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    municipio TEXT NOT NULL,
    detalles_pedido TEXT NOT NULL,
    num_partidas INTEGER NOT NULL,
    total_piezas INTEGER NOT NULL,
    total_mxn NUMERIC NOT NULL,
    status TEXT DEFAULT 'pendiente'
);

-- Habilitar RLS para pedidos
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Crear política para que solo el admin pueda leer pedidos (requiere autenticación o backend)
CREATE POLICY "Nadie puede leer pedidos desde el cliente" ON public.orders
    FOR SELECT USING (false);

-- Política para que el proxy (Service Role) pueda insertar pedidos
CREATE POLICY "Insertar pedidos proxy" ON public.orders
    FOR INSERT WITH CHECK (true);
