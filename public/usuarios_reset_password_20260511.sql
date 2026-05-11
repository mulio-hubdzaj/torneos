-- Agrega soporte para contrasenas temporales administradas desde Usuarios.
-- Aplicar manualmente en PostgreSQL antes de usar "Resetear clave".

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS reset_contrasena_en timestamp without time zone;
