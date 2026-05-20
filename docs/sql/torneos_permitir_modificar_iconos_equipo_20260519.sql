ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_modificar_iconos_equipo boolean NOT NULL DEFAULT false;
