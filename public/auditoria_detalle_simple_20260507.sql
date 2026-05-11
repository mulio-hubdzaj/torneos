-- Simplifica los nuevos registros de public.auditoria.
-- La columna detalle sigue siendo jsonb, pero ahora guarda un string JSON:
--   "Se movio de grupo A a grupo B"
--   "Se cambio nombre de AAA a BBB"

CREATE OR REPLACE FUNCTION public.fn_auditoria_valor_texto(p_valor jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_valor IS NULL OR p_valor = 'null'::jsonb THEN
    RETURN 'vacio';
  END IF;

  IF jsonb_typeof(p_valor) = 'string' THEN
    RETURN p_valor #>> '{}';
  END IF;

  RETURN p_valor::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_nombre_registro(p_tabla text, p_registro jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre text;
BEGIN
  IF p_registro IS NULL THEN
    RETURN 'registro';
  END IF;

  v_nombre := CASE p_tabla
    WHEN 'grupos' THEN p_registro->>'nombre_grupo'
    WHEN 'torneos' THEN p_registro->>'nombre_torneo'
    WHEN 'finanzas' THEN p_registro->>'concepto'
    WHEN 'jugadores' THEN concat_ws(' ', p_registro->>'nombre', p_registro->>'apellido')
    WHEN 'usuarios' THEN concat_ws(' ', p_registro->>'nombre', p_registro->>'documento')
    ELSE p_registro->>'nombre'
  END;

  RETURN COALESCE(NULLIF(trim(v_nombre), ''), 'registro');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_campo_legible(p_campo text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE p_campo
    WHEN 'nombre_grupo' THEN 'nombre'
    WHEN 'nombre_torneo' THEN 'nombre'
    WHEN 'id_grupo' THEN 'grupo'
    WHEN 'id_torneo' THEN 'torneo'
    WHEN 'id_equipo' THEN 'equipo'
    WHEN 'id_jugador' THEN 'jugador'
    WHEN 'id_usuario' THEN 'usuario'
    WHEN 'rol_id' THEN 'rol'
    WHEN 'contrasena_hash' THEN 'contrasena'
    ELSE replace(p_campo, '_', ' ')
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_detalle_simple(
  p_tabla text,
  p_accion text,
  p_old jsonb,
  p_new jsonb
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_detalle text;
  v_grupo_origen text;
  v_grupo_destino text;
  v_registro jsonb;
BEGIN
  v_registro := COALESCE(p_new, p_old);

  IF p_accion = 'INSERT' THEN
    RETURN 'Se creo ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro);
  END IF;

  IF p_accion = 'DELETE' THEN
    RETURN 'Se elimino ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro);
  END IF;

  IF p_accion = 'UPDATE' THEN
    IF p_tabla = 'equipos' AND p_old->'id_grupo' IS DISTINCT FROM p_new->'id_grupo' THEN
      SELECT nombre_grupo INTO v_grupo_origen
      FROM public.grupos
      WHERE id_grupo = NULLIF(p_old->>'id_grupo', '')::integer;

      SELECT nombre_grupo INTO v_grupo_destino
      FROM public.grupos
      WHERE id_grupo = NULLIF(p_new->>'id_grupo', '')::integer;

      RETURN 'Se movio de grupo '
        || COALESCE(v_grupo_origen, public.fn_auditoria_valor_texto(p_old->'id_grupo'))
        || ' a grupo '
        || COALESCE(v_grupo_destino, public.fn_auditoria_valor_texto(p_new->'id_grupo'));
    END IF;

    SELECT string_agg(
      'Se cambio '
        || public.fn_auditoria_campo_legible(n.key)
        || ' de '
        || public.fn_auditoria_valor_texto(o.value)
        || ' a '
        || public.fn_auditoria_valor_texto(n.value),
      '; ' ORDER BY n.key
    )
    INTO v_detalle
    FROM jsonb_each(COALESCE(p_new, '{}'::jsonb)) n
    LEFT JOIN jsonb_each(COALESCE(p_old, '{}'::jsonb)) o ON o.key = n.key
    WHERE n.key NOT IN (
      'entity_id',
      'fecha_hora',
      'fecha_movimiento',
      'fecha_asignacion',
      'creado_en',
      'updated_at',
      'created_at'
    )
    AND o.value IS DISTINCT FROM n.value;

    RETURN COALESCE(v_detalle, 'Se actualizo ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro));
  END IF;

  RETURN 'Se registro accion ' || p_accion || ' en ' || p_tabla;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_registro := COALESCE(v_new, v_old);

  v_entity_id := COALESCE(
    NULLIF(v_registro->>'entity_id', '')::integer,
    NULLIF(current_setting('app.entity_id', true), '')::integer
  );

  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    TG_TABLE_NAME,
    to_jsonb(public.fn_auditoria_detalle_simple(TG_TABLE_NAME, TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_items_auditoria() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_registro := COALESCE(v_new, v_old);

  v_entity_id := COALESCE(
    NULLIF(v_registro->>'entity_id', '')::integer,
    NULLIF(current_setting('app.entity_id', true), '')::integer
  );

  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    'items',
    to_jsonb(public.fn_auditoria_detalle_simple('items', TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_equipos_movimientos_grupo_auditoria() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_usuario uuid;
  v_grupo_origen text;
  v_grupo_destino text;
BEGIN
  v_usuario := COALESCE(
    NEW.id_usuario,
    NULLIF(current_setting('app.usuario_id', true), '')::uuid
  );

  SELECT nombre_grupo INTO v_grupo_origen
  FROM public.grupos
  WHERE id_grupo = NEW.id_grupo_origen;

  SELECT nombre_grupo INTO v_grupo_destino
  FROM public.grupos
  WHERE id_grupo = NEW.id_grupo_destino;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    'equipos_movimientos_grupo',
    to_jsonb(
      'Se movio de grupo '
      || COALESCE(v_grupo_origen, NEW.id_grupo_origen::text)
      || ' a grupo '
      || COALESCE(v_grupo_destino, NEW.id_grupo_destino::text)
    ),
    now(),
    NEW.entity_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_torneos() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_registro := COALESCE(v_new, v_old);

  v_entity_id := COALESCE(
    NULLIF(v_registro->>'entity_id', '')::integer,
    NULLIF(current_setting('app.entity_id', true), '')::integer
  );

  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    TG_TABLE_NAME,
    to_jsonb(public.fn_auditoria_detalle_simple(TG_TABLE_NAME, TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_jugadores() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  v_entity_id := COALESCE(
    NEW.entity_id,
    OLD.entity_id,
    NULLIF(current_setting('app.entity_id', true), '')::integer
  );

  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    'jugadores',
    to_jsonb(public.fn_auditoria_detalle_simple('jugadores', TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_jugadores_equipos() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_registro := COALESCE(v_new, v_old);

  SELECT j.entity_id INTO v_entity_id
  FROM public.jugadores j
  WHERE j.id_jugador = NULLIF(v_registro->>'id_jugador', '')::integer;

  v_entity_id := COALESCE(v_entity_id, NULLIF(current_setting('app.entity_id', true), '')::integer);
  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    'jugadores_equipos',
    to_jsonb(public.fn_auditoria_detalle_simple('jugadores_equipos', TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  RETURN NEW;
END;
$$;
