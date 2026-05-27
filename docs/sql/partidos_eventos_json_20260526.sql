ALTER TABLE public.estadisticas
ADD COLUMN IF NOT EXISTS goles_minutos jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS amarillas_minutos jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS rojas_minutos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.partidos
ADD COLUMN IF NOT EXISTS cambios_json jsonb NOT NULL DEFAULT '[]'::jsonb;
