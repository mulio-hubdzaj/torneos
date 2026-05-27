CREATE TABLE IF NOT EXISTS public.app_uso_diario (
  fecha date NOT NULL,
  usuario_id uuid NOT NULL,
  entity_id integer,
  rol_id integer,
  origen varchar(10) NOT NULL DEFAULT 'web',
  primer_acceso timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso timestamptz NOT NULL DEFAULT now(),
  cantidad_pings integer NOT NULL DEFAULT 1,
  CONSTRAINT app_uso_diario_origen_chk CHECK (origen IN ('apk', 'web')),
  CONSTRAINT app_uso_diario_pings_chk CHECK (cantidad_pings >= 1),
  CONSTRAINT app_uso_diario_pk PRIMARY KEY (fecha, usuario_id, origen)
);

CREATE INDEX IF NOT EXISTS idx_app_uso_diario_entity_fecha
  ON public.app_uso_diario (entity_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_app_uso_diario_origen_fecha
  ON public.app_uso_diario (origen, fecha DESC);
