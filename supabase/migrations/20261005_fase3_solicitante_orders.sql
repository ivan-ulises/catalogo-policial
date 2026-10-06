-- ==============================================================================
-- Migración: 20261005_fase3_solicitante_orders.sql
-- Fase 3: Datos Completos del Solicitante B2B (Municipio, Dependencia, RFC, Domicilios)
-- NOTA: Migración ADITIVA y retrocompatible para la tabla public.orders.
-- ==============================================================================

-- 1. Nueva columna: applicant_info (JSONB estructurado con todos los datos institucionales del solicitante)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS applicant_info JSONB DEFAULT '{}'::jsonb;

-- 2. Índice GIN para búsquedas y filtros optimizados por campos del solicitante (RFC, titular, etc.)
CREATE INDEX IF NOT EXISTS idx_orders_applicant_info ON public.orders USING gin (applicant_info);

-- ==============================================================================
-- SCRIPT DE ROLLBACK DOCUMENTADO (En caso de requerir reversión en Supabase):
-- ==============================================================================
/*
DROP INDEX IF EXISTS public.idx_orders_applicant_info;
ALTER TABLE public.orders DROP COLUMN IF EXISTS applicant_info;
*/
