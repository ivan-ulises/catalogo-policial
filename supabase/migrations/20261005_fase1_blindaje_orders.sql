-- ==============================================================================
-- Migración: 20261005_fase1_blindaje_orders.sql
-- Fase 1: Blindaje, Idempotencia, Snapshot de Partidas y Resiliencia de Correo
-- NOTA: Migración ADITIVA y retrocompatible para la tabla public.orders.
-- ==============================================================================

-- 1. Nueva columna: idempotency_key con restricción UNIQUE directa
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 2. Asegurar restricción UNIQUE en la columna 'folio'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_folio_key' AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_folio_key UNIQUE (folio);
    END IF;
END $$;

-- 3. Nueva columna: items_snapshot (JSONB inmutable con detalle de precios al momento de la orden)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb;

-- 4. Nuevas columnas de resiliencia y seguimiento de correo electrónico (Resend)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending'; -- 'pending', 'sent', 'failed'

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS email_error TEXT;

-- 5. Nuevas columnas opcionales de auditoría y desglose fiscal
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal_mxn NUMERIC;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS iva_mxn NUMERIC;

-- 6. Índices para búsquedas rápidas por idempotency_key y status
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON public.orders (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_email_status ON public.orders (email_status);

-- ==============================================================================
-- SCRIPT DE ROLLBACK DOCUMENTADO (En caso de requerir reversión en Supabase):
-- ==============================================================================
/*
DROP INDEX IF EXISTS public.idx_orders_email_status;
DROP INDEX IF EXISTS public.idx_orders_idempotency;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_folio_key;

ALTER TABLE public.orders DROP COLUMN IF EXISTS iva_mxn;
ALTER TABLE public.orders DROP COLUMN IF EXISTS subtotal_mxn;
ALTER TABLE public.orders DROP COLUMN IF EXISTS email_error;
ALTER TABLE public.orders DROP COLUMN IF EXISTS email_status;
ALTER TABLE public.orders DROP COLUMN IF EXISTS items_snapshot;
ALTER TABLE public.orders DROP COLUMN IF EXISTS idempotency_key;
*/
