-- ==============================================================================
-- Migración: 20261005_fase2_admin_panel.sql
-- Fase 2: Panel Administrativo, Roles de Admin, Audit Log y RLS
-- NOTA: Migración ADITIVA y retrocompatible.
-- ==============================================================================

-- 1. Tabla de administradores autorizados vinculada a auth.users de Supabase
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'superadmin', 'operador'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Política RLS para admin_users: Un usuario autenticado puede consultar si él mismo es admin
CREATE POLICY "Admins pueden leer su propio registro" ON public.admin_users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- 2. Función auxiliar segura (SECURITY DEFINER) para comprobar si el usuario actual es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = auth.uid()
    );
$$;

-- 3. Nuevas columnas en public.orders para notas internas y auditoría
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '';

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 4. Nueva columna en public.products para control de activo/inactivo y timestamps
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Tabla de bitácora de auditoría para cambios de estado en pedidos
CREATE TABLE IF NOT EXISTS public.order_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'status_change', 'note_added', 'email_resent'
    previous_state JSONB,
    new_state JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Actualización de Políticas RLS para Orders
-- Permitir SELECT y UPDATE en orders solo si is_admin() es verdadero
CREATE POLICY "Admins pueden leer pedidos" ON public.orders
    FOR SELECT TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins pueden actualizar pedidos" ON public.orders
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins pueden eliminar pedidos" ON public.orders
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Políticas RLS para order_audit_logs
CREATE POLICY "Admins pueden leer logs de auditoria" ON public.order_audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins pueden insertar logs de auditoria" ON public.order_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- 7. Políticas RLS para Products (CRUD completo para administradores)
CREATE POLICY "Admins pueden insertar productos" ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins pueden actualizar productos" ON public.products
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins pueden eliminar productos" ON public.products
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_admin_users_id ON public.admin_users (id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_fecha ON public.orders (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_order_id ON public.order_audit_logs (order_id);

-- ==============================================================================
-- SCRIPT DE ROLLBACK DOCUMENTADO (En caso de reversión en Supabase):
-- ==============================================================================
/*
DROP POLICY IF EXISTS "Admins pueden eliminar productos" ON public.products;
DROP POLICY IF EXISTS "Admins pueden actualizar productos" ON public.products;
DROP POLICY IF EXISTS "Admins pueden insertar productos" ON public.products;

DROP POLICY IF EXISTS "Admins pueden insertar logs de auditoria" ON public.order_audit_logs;
DROP POLICY IF EXISTS "Admins pueden leer logs de auditoria" ON public.order_audit_logs;

DROP POLICY IF EXISTS "Admins pueden actualizar pedidos" ON public.orders;
DROP POLICY IF EXISTS "Admins pueden leer pedidos" ON public.orders;

DROP TABLE IF EXISTS public.order_audit_logs;

ALTER TABLE public.products DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.products DROP COLUMN IF EXISTS active;

ALTER TABLE public.orders DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.orders DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS internal_notes;

DROP FUNCTION IF EXISTS public.is_admin();

DROP POLICY IF EXISTS "Admins pueden leer su propio registro" ON public.admin_users;
DROP TABLE IF EXISTS public.admin_users;
*/
