ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_delegados_ver_estado_finanzas boolean NOT NULL DEFAULT false;
