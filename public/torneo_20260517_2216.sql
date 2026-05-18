--
-- PostgreSQL database dump
--

-- Dumped from database version 12.3
-- Dumped by pg_dump version 12.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: audit_jugadores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_jugadores() RETURNS trigger
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
    'jugadores',
    to_jsonb(public.fn_auditoria_detalle_simple('jugadores', TG_OP, v_old, v_new)),
    now(),
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_jugadores() OWNER TO postgres;

--
-- Name: fn_asignar_espectador_a_delegado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_asignar_espectador_a_delegado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Cambiar rol del usuario a delegado (2) si era espectador (1)
  UPDATE usuarios
  SET rol_id = 2
  WHERE id_usuario = NEW.id_usuario
    AND rol_id = 1;

  -- Registrar en auditorÃ­a la asignaciÃ³n
  INSERT INTO auditoria(id_usuario, accion, tabla_afectada, detalle, entity_id)
  VALUES (
    NEW.id_usuario,
    'UPDATE',
    'usuarios',
    jsonb_build_object(
      'rol', 'Espectador â†’ Delegado',
      'id_equipo', NEW.id_equipo,
      'id_torneo', NEW.id_torneo
    ),
    NEW.id_torneo
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_asignar_espectador_a_delegado() OWNER TO postgres;

--
-- Name: fn_audit_jugadores_equipos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_audit_jugadores_equipos() RETURNS trigger
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_audit_jugadores_equipos() OWNER TO postgres;

--
-- Name: fn_auditar_entity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditar_entity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_usuario UUID;
BEGIN
    -- Leer variable de sesiÃ³n
    BEGIN
        v_id_usuario := current_setting('app.usuario_id', true)::UUID;
    EXCEPTION WHEN others THEN
        v_id_usuario := NULL;
    END;

    INSERT INTO auditoria(
        id_usuario,
        accion,
        tabla_afectada,
        detalle,
        entity_id,
        fecha_hora
    )
    VALUES (
        v_id_usuario,
        TG_OP,
        'entity',
        row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END),
        COALESCE(NEW.entity_id, OLD.entity_id),
        NOW()
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_auditar_entity() OWNER TO postgres;

--
-- Name: fn_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria() RETURNS trigger
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


ALTER FUNCTION public.fn_auditoria() OWNER TO postgres;

--
-- Name: fn_auditoria_campo_legible(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_campo_legible(p_campo text) RETURNS text
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


ALTER FUNCTION public.fn_auditoria_campo_legible(p_campo text) OWNER TO postgres;

--
-- Name: fn_auditoria_detalle_simple(text, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_detalle_simple(p_tabla text, p_accion text, p_old jsonb, p_new jsonb) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_detalle text;
  v_grupo_origen text;
  v_grupo_destino text;
  v_registro jsonb;
  v_usuario_afectado text;
  v_rol_anterior text;
  v_rol_nuevo text;
BEGIN
  v_registro := COALESCE(p_new, p_old);

  IF p_accion = 'INSERT' THEN
    RETURN 'Se creo ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro);
  END IF;

  IF p_accion = 'DELETE' THEN
    RETURN 'Se elimino ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro);
  END IF;

  IF p_accion = 'UPDATE' THEN
    IF p_tabla = 'usuarios' AND p_old->'rol_id' IS DISTINCT FROM p_new->'rol_id' THEN
      v_usuario_afectado := public.fn_auditoria_nombre_registro('usuarios', p_new);

      v_rol_anterior := CASE p_old->>'rol_id'
        WHEN '1' THEN 'espectador'
        WHEN '2' THEN 'delegado'
        WHEN '3' THEN 'admin'
        WHEN '99' THEN 'super admin'
        ELSE 'rol ' || COALESCE(p_old->>'rol_id', '-')
      END;

      v_rol_nuevo := CASE p_new->>'rol_id'
        WHEN '1' THEN 'espectador'
        WHEN '2' THEN 'delegado'
        WHEN '3' THEN 'admin'
        WHEN '99' THEN 'super admin'
        ELSE 'rol ' || COALESCE(p_new->>'rol_id', '-')
      END;

      RETURN 'usuarios: ' || v_usuario_afectado
        || '; Se cambio permisos de ' || v_usuario_afectado
        || ': ' || v_rol_anterior || ' -> ' || v_rol_nuevo;
    END IF;

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


ALTER FUNCTION public.fn_auditoria_detalle_simple(p_tabla text, p_accion text, p_old jsonb, p_new jsonb) OWNER TO postgres;

--
-- Name: fn_auditoria_entity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_entity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    detalle_id INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        detalle_id := NEW.entity_id;
    ELSIF TG_OP = 'UPDATE' THEN
        detalle_id := NEW.entity_id;
    ELSIF TG_OP = 'DELETE' THEN
        detalle_id := OLD.entity_id;
    END IF;

    INSERT INTO auditoria(
        tabla_afectada,
        accion,
        detalle,
        fecha_hora,
        entity_id
    )
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        jsonb_build_object('id', detalle_id),
        CURRENT_TIMESTAMP,
        detalle_id
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_auditoria_entity() OWNER TO postgres;

--
-- Name: fn_auditoria_grupos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_grupos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO auditoria(
        tabla_afectada,
        accion,
        detalle,
        fecha_hora,
        entity_id
    )
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        jsonb_build_object(
            'id_grupo', NEW.id_grupo,
            'nombre_grupo', NEW.nombre_grupo,
            'id_torneo', NEW.id_torneo,
            'entity_id', NEW.entity_id,
            'estado', NEW.estado
        ),
        CURRENT_TIMESTAMP,
        NEW.entity_id
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_auditoria_grupos() OWNER TO postgres;

--
-- Name: fn_auditoria_nombre_registro(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_nombre_registro(p_tabla text, p_registro jsonb) RETURNS text
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


ALTER FUNCTION public.fn_auditoria_nombre_registro(p_tabla text, p_registro jsonb) OWNER TO postgres;

--
-- Name: fn_auditoria_torneos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_torneos() RETURNS trigger
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


ALTER FUNCTION public.fn_auditoria_torneos() OWNER TO postgres;

--
-- Name: fn_auditoria_valor_texto(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditoria_valor_texto(p_valor jsonb) RETURNS text
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


ALTER FUNCTION public.fn_auditoria_valor_texto(p_valor jsonb) OWNER TO postgres;

--
-- Name: fn_entity_audit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_entity_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO entity_audit(entity_id, accion, usuario, detalle)
        VALUES (NEW.entity_id, 'INSERT', current_user,
                'Se creÃ³ entity con cÃ³digo ' || NEW.codigo);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Detectar cambio de estado activo/desactivado
        IF NEW.activo <> OLD.activo THEN
            INSERT INTO entity_audit(entity_id, accion, usuario, detalle)
            VALUES (NEW.entity_id,
                    CASE WHEN NEW.activo THEN 'ACTIVAR' ELSE 'DESACTIVAR' END,
                    current_user,
                    'Cambio de estado para cÃ³digo ' || NEW.codigo);
        ELSE
            INSERT INTO entity_audit(entity_id, accion, usuario, detalle)
            VALUES (NEW.entity_id, 'UPDATE', current_user,
                    'Se modificÃ³ entity con cÃ³digo ' || NEW.codigo);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION public.fn_entity_audit() OWNER TO postgres;

--
-- Name: fn_entity_set_activo(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_entity_set_activo(p_codigo text, p_activo boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.entity
  SET activo = p_activo
  WHERE codigo = p_codigo;
END;
$$;


ALTER FUNCTION public.fn_entity_set_activo(p_codigo text, p_activo boolean) OWNER TO postgres;

--
-- Name: fn_entity_update_descripcion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_entity_update_descripcion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Permitir cambios en descripcion y activo
  IF NEW.descripcion IS DISTINCT FROM OLD.descripcion
     OR NEW.activo IS DISTINCT FROM OLD.activo THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Solo se permite modificar la descripciÃ³n o el estado de Entity';
  END IF;
END;
$$;


ALTER FUNCTION public.fn_entity_update_descripcion() OWNER TO postgres;

--
-- Name: fn_equipos_movimientos_grupo_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_equipos_movimientos_grupo_auditoria() RETURNS trigger
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


ALTER FUNCTION public.fn_equipos_movimientos_grupo_auditoria() OWNER TO postgres;

--
-- Name: fn_grupos_crear_items_tarjetas(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_grupos_crear_items_tarjetas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO public.items (nombre, descripcion, monto, entity_id, id_torneo)
  SELECT v.nombre, v.descripcion, 1, NEW.entity_id, NEW.id_torneo
  FROM (
    VALUES
      ('TARJETA AMARILLA', 'Item automatico generado al crear grupo'),
      ('TARJETA ROJA', 'Item automatico generado al crear grupo')
  ) AS v(nombre, descripcion)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id_torneo = NEW.id_torneo
      AND i.entity_id = NEW.entity_id
      AND lower(trim(i.nombre)) = lower(trim(v.nombre))
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_grupos_crear_items_tarjetas() OWNER TO postgres;

--
-- Name: fn_items_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_items_auditoria() RETURNS trigger
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


ALTER FUNCTION public.fn_items_auditoria() OWNER TO postgres;

--
-- Name: fn_items_set_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_items_set_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.entity_id IS NULL THEN
    NEW.entity_id := NULLIF(current_setting('app.entity_id', true), '')::integer;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_items_set_context() OWNER TO postgres;

--
-- Name: fn_manage_jugadores_equipos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_manage_jugadores_equipos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- lÃ³gica adicional si querÃ©s validar duplicados o asignar numero_camiseta
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- actualizar campos especÃ­ficos, por ejemplo estado y observaciones
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION public.fn_manage_jugadores_equipos() OWNER TO postgres;

--
-- Name: fn_reasignar_delegado_a_espectador(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_reasignar_delegado_a_espectador() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Cambiar rol del usuario a espectador (1) si era delegado (2)
  UPDATE usuarios
  SET rol_id = 1
  WHERE id_usuario = OLD.id_usuario
    AND rol_id = 2;

  -- Registrar en auditorÃ­a la reasignaciÃ³n
  INSERT INTO auditoria(id_usuario, accion, tabla_afectada, detalle, entity_id)
  VALUES (
    OLD.id_usuario,
    'UPDATE',
    'usuarios',
    jsonb_build_object(
      'rol', 'Delegado â†’ Espectador',
      'id_equipo', OLD.id_equipo,
      'id_torneo', OLD.id_torneo
    ),
    OLD.id_torneo
  );

  RETURN OLD;
END;
$$;


ALTER FUNCTION public.fn_reasignar_delegado_a_espectador() OWNER TO postgres;

--
-- Name: fn_sync_jugadores_equipos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_sync_jugadores_equipos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO jugadores_equipos (
      id_jugador,
      id_torneo,
      estado,
      observaciones
    )
    VALUES (
      NEW.id_jugador,
      current_setting('app.torneo_id', true)::int,
      NEW.estado,
      NEW.observaciones
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE jugadores_equipos
    SET estado = NEW.estado,
        observaciones = NEW.observaciones
    WHERE id_jugador = NEW.id_jugador
      AND id_torneo = current_setting('app.torneo_id', true)::int;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_sync_jugadores_equipos() OWNER TO postgres;

--
-- Name: fn_torneos_crear_items_tarjetas(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_torneos_crear_items_tarjetas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO public.items (nombre, descripcion, monto, entity_id, id_torneo)
  SELECT v.nombre, v.descripcion, 1, NEW.entity_id, NEW.id_torneo
  FROM (
    VALUES
      ('TARJETA AMARILLA', 'Item automatico generado al crear torneo'),
      ('TARJETA ROJA', 'Item automatico generado al crear torneo')
  ) AS v(nombre, descripcion)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id_torneo = NEW.id_torneo
      AND i.entity_id = NEW.entity_id
      AND lower(trim(i.nombre)) = lower(trim(v.nombre))
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_torneos_crear_items_tarjetas() OWNER TO postgres;

--
-- Name: fn_vincular_jugador_equipo(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_vincular_jugador_equipo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Al crear jugador, insertar vÃ­nculo
  IF TG_OP = 'INSERT' THEN
    INSERT INTO jugadores_equipos (
      id_jugador,
      id_torneo,
      estado,
      observaciones
    )
    VALUES (
      NEW.id_jugador,
      current_setting('app.torneo_id', true)::int,
      NEW.estado,
      NEW.observaciones
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_vincular_jugador_equipo() OWNER TO postgres;

--
-- Name: registrar_auditoria(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.registrar_auditoria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO auditoria (id_usuario, accion, tabla_afectada, detalle, fecha_hora)
    VALUES (
        current_setting('app.current_user')::uuid, -- usuario actual seteado desde la app
        TG_OP,                                     -- operaciÃ³n: INSERT, UPDATE, DELETE
        TG_TABLE_NAME,                             -- tabla afectada
        CASE
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb
            ELSE row_to_json(NEW)::jsonb
        END,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.registrar_auditoria() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria (
    id_auditoria integer NOT NULL,
    id_usuario uuid,
    accion character varying(100),
    tabla_afectada character varying(50),
    detalle jsonb,
    fecha_hora timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity_id integer
);


ALTER TABLE public.auditoria OWNER TO postgres;

--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_id_auditoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.auditoria_id_auditoria_seq OWNER TO postgres;

--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_id_auditoria_seq OWNED BY public.auditoria.id_auditoria;


--
-- Name: canchas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canchas (
    id_cancha integer NOT NULL,
    id_torneo integer NOT NULL,
    entity_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    direccion character varying(255),
    estado boolean DEFAULT true NOT NULL
);


ALTER TABLE public.canchas OWNER TO postgres;

--
-- Name: canchas_id_cancha_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.canchas_id_cancha_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.canchas_id_cancha_seq OWNER TO postgres;

--
-- Name: canchas_id_cancha_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.canchas_id_cancha_seq OWNED BY public.canchas.id_cancha;


--
-- Name: delegados_equipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delegados_equipos (
    id_delegado_equipo integer NOT NULL,
    id_usuario uuid NOT NULL,
    id_equipo integer NOT NULL,
    rol character varying(50) DEFAULT 'delegado'::character varying,
    fecha_asignacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado boolean DEFAULT true
);


ALTER TABLE public.delegados_equipos OWNER TO postgres;

--
-- Name: delegados_equipos_id_delegado_equipo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delegados_equipos_id_delegado_equipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.delegados_equipos_id_delegado_equipo_seq OWNER TO postgres;

--
-- Name: delegados_equipos_id_delegado_equipo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delegados_equipos_id_delegado_equipo_seq OWNED BY public.delegados_equipos.id_delegado_equipo;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entities (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    descripcion character varying(255)
);


ALTER TABLE public.entities OWNER TO postgres;

--
-- Name: entities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.entities_id_seq OWNER TO postgres;

--
-- Name: entities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entities_id_seq OWNED BY public.entities.id;


--
-- Name: entity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity (
    entity_id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true
);


ALTER TABLE public.entity OWNER TO postgres;

--
-- Name: entity_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_audit (
    audit_id integer NOT NULL,
    entity_id integer NOT NULL,
    accion character varying(20) NOT NULL,
    usuario character varying(50),
    fecha timestamp without time zone DEFAULT now(),
    detalle text
);


ALTER TABLE public.entity_audit OWNER TO postgres;

--
-- Name: entity_audit_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_audit_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.entity_audit_audit_id_seq OWNER TO postgres;

--
-- Name: entity_audit_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_audit_audit_id_seq OWNED BY public.entity_audit.audit_id;


--
-- Name: entity_entity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_entity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.entity_entity_id_seq OWNER TO postgres;

--
-- Name: entity_entity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_entity_id_seq OWNED BY public.entity.entity_id;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos (
    id_equipo integer NOT NULL,
    nombre character varying(100) NOT NULL,
    icono character varying(255),
    id_torneo integer,
    estado boolean DEFAULT true,
    id_grupo integer,
    entity_id integer,
    observaciones character varying(255)
);


ALTER TABLE public.equipos OWNER TO postgres;

--
-- Name: equipos_id_equipo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.equipos_id_equipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.equipos_id_equipo_seq OWNER TO postgres;

--
-- Name: equipos_id_equipo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.equipos_id_equipo_seq OWNED BY public.equipos.id_equipo;


--
-- Name: equipos_movimientos_grupo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.equipos_movimientos_grupo (
    id_movimiento integer NOT NULL,
    id_equipo integer NOT NULL,
    id_torneo integer NOT NULL,
    id_grupo_origen integer NOT NULL,
    id_grupo_destino integer NOT NULL,
    observacion text NOT NULL,
    fecha_movimiento timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id_usuario uuid,
    entity_id integer,
    CONSTRAINT equipos_movimientos_grupo_origen_destino_check CHECK ((id_grupo_origen <> id_grupo_destino))
);


ALTER TABLE public.equipos_movimientos_grupo OWNER TO postgres;

--
-- Name: equipos_movimientos_grupo_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.equipos_movimientos_grupo ALTER COLUMN id_movimiento ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.equipos_movimientos_grupo_id_movimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estadisticas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estadisticas (
    id_estadistica integer NOT NULL,
    id_jugador integer,
    id_partido integer,
    goles integer DEFAULT 0,
    tarjetas_amarillas integer DEFAULT 0,
    tarjetas_rojas integer DEFAULT 0,
    entity_id integer
);


ALTER TABLE public.estadisticas OWNER TO postgres;

--
-- Name: estadisticas_id_estadistica_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estadisticas_id_estadistica_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estadisticas_id_estadistica_seq OWNER TO postgres;

--
-- Name: estadisticas_id_estadistica_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estadisticas_id_estadistica_seq OWNED BY public.estadisticas.id_estadistica;


--
-- Name: eventos_partido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.eventos_partido (
    id_evento integer NOT NULL,
    id_partido integer NOT NULL,
    id_jugador integer,
    tipo_evento character varying(50) NOT NULL,
    minuto integer,
    detalle text,
    id_item integer,
    monto numeric(10,2)
);


ALTER TABLE public.eventos_partido OWNER TO postgres;

--
-- Name: eventos_partido_id_evento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.eventos_partido_id_evento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.eventos_partido_id_evento_seq OWNER TO postgres;

--
-- Name: eventos_partido_id_evento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.eventos_partido_id_evento_seq OWNED BY public.eventos_partido.id_evento;


--
-- Name: finanzas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finanzas (
    id_finanza integer NOT NULL,
    id_equipo integer,
    monto_inscripcion numeric(10,2),
    monto_aportado numeric(10,2),
    deuda_total numeric(10,2),
    entity_id integer,
    id_torneo integer,
    fecha_registro date DEFAULT CURRENT_DATE,
    concepto character varying(100),
    tipo character varying(20),
    saldo numeric(10,2),
    deuda_inicial numeric(10,2)
);


ALTER TABLE public.finanzas OWNER TO postgres;

--
-- Name: finanzas_id_finanza_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.finanzas_id_finanza_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.finanzas_id_finanza_seq OWNER TO postgres;

--
-- Name: finanzas_id_finanza_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.finanzas_id_finanza_seq OWNED BY public.finanzas.id_finanza;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupos (
    id_grupo integer NOT NULL,
    nombre_grupo character varying(50) NOT NULL,
    id_torneo integer NOT NULL,
    estado boolean DEFAULT true,
    entity_id integer,
    visible_fixture boolean DEFAULT true NOT NULL
);


ALTER TABLE public.grupos OWNER TO postgres;

--
-- Name: COLUMN grupos.visible_fixture; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.grupos.visible_fixture IS 'Controla si los partidos del grupo se muestran en Fixture. Si es false, el historico sigue disponible para dashboard/estadisticas.';


--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grupos_id_grupo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.grupos_id_grupo_seq OWNER TO postgres;

--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grupos_id_grupo_seq OWNED BY public.grupos.id_grupo;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id_item integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    monto numeric(10,2) NOT NULL,
    entity_id integer,
    id_torneo integer
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_equipo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items_equipo (
    id_item_equipo integer NOT NULL,
    id_equipo integer NOT NULL,
    id_partido integer,
    nombre character varying(100),
    monto numeric(10,2),
    cantidad integer DEFAULT 1,
    observaciones text,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.items_equipo OWNER TO postgres;

--
-- Name: items_equipo_id_item_equipo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_equipo_id_item_equipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.items_equipo_id_item_equipo_seq OWNER TO postgres;

--
-- Name: items_equipo_id_item_equipo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_equipo_id_item_equipo_seq OWNED BY public.items_equipo.id_item_equipo;


--
-- Name: items_id_item_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_item_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.items_id_item_seq OWNER TO postgres;

--
-- Name: items_id_item_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_item_seq OWNED BY public.items.id_item;


--
-- Name: jugadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jugadores (
    id_jugador integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100),
    documento character varying(20),
    fecha_nacimiento date,
    estado boolean DEFAULT true,
    entity_id integer,
    observaciones text
);


ALTER TABLE public.jugadores OWNER TO postgres;

--
-- Name: jugadores_equipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jugadores_equipos (
    id_jugador_equipo integer NOT NULL,
    id_jugador integer,
    id_equipo integer,
    tipo_vinculo character varying(20),
    estado boolean DEFAULT true,
    fecha_inicio date,
    fecha_fin date,
    id_torneo integer,
    observaciones text,
    numero_camiseta integer,
    capitan boolean DEFAULT false,
    CONSTRAINT jugadores_equipos_tipo_vinculo_check CHECK (((tipo_vinculo)::text = ANY ((ARRAY['titular'::character varying, 'prestamo'::character varying])::text[])))
);


ALTER TABLE public.jugadores_equipos OWNER TO postgres;

--
-- Name: jugadores_equipos_id_jugador_equipo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.jugadores_equipos_id_jugador_equipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.jugadores_equipos_id_jugador_equipo_seq OWNER TO postgres;

--
-- Name: jugadores_equipos_id_jugador_equipo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.jugadores_equipos_id_jugador_equipo_seq OWNED BY public.jugadores_equipos.id_jugador_equipo;


--
-- Name: jugadores_id_jugador_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.jugadores_id_jugador_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.jugadores_id_jugador_seq OWNER TO postgres;

--
-- Name: jugadores_id_jugador_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.jugadores_id_jugador_seq OWNED BY public.jugadores.id_jugador;


--
-- Name: partidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partidos (
    id_partido integer NOT NULL,
    id_torneo integer,
    equipo_a integer,
    equipo_b integer,
    fecha date,
    hora time without time zone,
    estado character varying(20) DEFAULT 'programado'::character varying,
    entity_id integer,
    numero_fecha integer,
    goles_a integer DEFAULT 0,
    goles_b integer DEFAULT 0,
    observaciones text,
    id_grupo integer,
    id_cancha integer
);


ALTER TABLE public.partidos OWNER TO postgres;

--
-- Name: partidos_id_partido_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partidos_id_partido_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.partidos_id_partido_seq OWNER TO postgres;

--
-- Name: partidos_id_partido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partidos_id_partido_seq OWNED BY public.partidos.id_partido;


--
-- Name: resultados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resultados (
    id_resultado integer NOT NULL,
    id_partido integer,
    goles_equipo_a integer DEFAULT 0,
    goles_equipo_b integer DEFAULT 0,
    observaciones text,
    entity_id integer
);


ALTER TABLE public.resultados OWNER TO postgres;

--
-- Name: resultados_id_resultado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resultados_id_resultado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.resultados_id_resultado_seq OWNER TO postgres;

--
-- Name: resultados_id_resultado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resultados_id_resultado_seq OWNED BY public.resultados.id_resultado;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    entity_id integer
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_rol_seq OWNER TO postgres;

--
-- Name: roles_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_rol_seq OWNED BY public.roles.id_rol;


--
-- Name: sanciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sanciones (
    id_sancion integer NOT NULL,
    id_jugador integer NOT NULL,
    id_partido integer,
    partidos_suspendidos integer,
    partidos_restantes integer,
    fecha_inicio integer,
    observaciones text,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sanciones OWNER TO postgres;

--
-- Name: sanciones_id_sancion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sanciones_id_sancion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sanciones_id_sancion_seq OWNER TO postgres;

--
-- Name: sanciones_id_sancion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sanciones_id_sancion_seq OWNED BY public.sanciones.id_sancion;


--
-- Name: torneos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.torneos (
    id_torneo integer NOT NULL,
    nombre_torneo character varying(100) NOT NULL,
    temporada character varying(20),
    estado boolean DEFAULT true,
    fecha_inicio date,
    entity_id integer,
    portada character varying(255),
    permitir_agregar_jugadores boolean DEFAULT true NOT NULL
);


ALTER TABLE public.torneos OWNER TO postgres;

--
-- Name: torneos_id_torneo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.torneos_id_torneo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.torneos_id_torneo_seq OWNER TO postgres;

--
-- Name: torneos_id_torneo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.torneos_id_torneo_seq OWNED BY public.torneos.id_torneo;


--
-- Name: torneos_reglas_tarjetas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.torneos_reglas_tarjetas (
    id_regla integer NOT NULL,
    id_torneo integer NOT NULL,
    entity_id integer NOT NULL,
    acumula_amarillas boolean DEFAULT false NOT NULL,
    amarillas_para_suspension integer DEFAULT 5 NOT NULL,
    fechas_suspension_acumulacion integer DEFAULT 1 NOT NULL,
    reiniciar_al_sancionar boolean DEFAULT true NOT NULL,
    aplicar_item_amarilla boolean DEFAULT true NOT NULL,
    aplicar_item_roja boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT torneos_reglas_tarjetas_amarillas_check CHECK ((amarillas_para_suspension > 0)),
    CONSTRAINT torneos_reglas_tarjetas_fechas_check CHECK ((fechas_suspension_acumulacion > 0))
);


ALTER TABLE public.torneos_reglas_tarjetas OWNER TO postgres;

--
-- Name: torneos_reglas_tarjetas_id_regla_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.torneos_reglas_tarjetas_id_regla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.torneos_reglas_tarjetas_id_regla_seq OWNER TO postgres;

--
-- Name: torneos_reglas_tarjetas_id_regla_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.torneos_reglas_tarjetas_id_regla_seq OWNED BY public.torneos_reglas_tarjetas.id_regla;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id_usuario uuid DEFAULT public.gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    correo character varying(150),
    contrasena_hash character varying(255) NOT NULL,
    rol_id integer,
    estado boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    documento character varying(50) NOT NULL,
    entity_id integer,
    debe_cambiar_contrasena boolean DEFAULT false NOT NULL,
    reset_contrasena_en timestamp without time zone
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: vista_jugadores; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vista_jugadores AS
 SELECT j.id_jugador,
    j.nombre,
    j.apellido,
    j.entity_id,
    COALESCE(e.nombre, 'Libre'::character varying) AS equipo,
    COALESCE(t.id_torneo, 0) AS id_torneo,
    COALESCE(t.nombre_torneo, 'Sin torneo'::character varying) AS torneo,
    COALESCE(je.tipo_vinculo, 'Libre'::character varying) AS tipo_vinculo,
        CASE
            WHEN (je.id_jugador IS NULL) THEN 'Libre'::text
            WHEN je.estado THEN 'Activo'::text
            ELSE 'Inactivo'::text
        END AS estado
   FROM (((public.jugadores j
     LEFT JOIN public.jugadores_equipos je ON (((j.id_jugador = je.id_jugador) AND (je.id_torneo = 2))))
     LEFT JOIN public.equipos e ON ((je.id_equipo = e.id_equipo)))
     LEFT JOIN public.torneos t ON ((je.id_torneo = t.id_torneo)));


ALTER TABLE public.vista_jugadores OWNER TO postgres;

--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('public.auditoria_id_auditoria_seq'::regclass);


--
-- Name: canchas id_cancha; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canchas ALTER COLUMN id_cancha SET DEFAULT nextval('public.canchas_id_cancha_seq'::regclass);


--
-- Name: delegados_equipos id_delegado_equipo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delegados_equipos ALTER COLUMN id_delegado_equipo SET DEFAULT nextval('public.delegados_equipos_id_delegado_equipo_seq'::regclass);


--
-- Name: entities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entities ALTER COLUMN id SET DEFAULT nextval('public.entities_id_seq'::regclass);


--
-- Name: entity entity_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity ALTER COLUMN entity_id SET DEFAULT nextval('public.entity_entity_id_seq'::regclass);


--
-- Name: entity_audit audit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit ALTER COLUMN audit_id SET DEFAULT nextval('public.entity_audit_audit_id_seq'::regclass);


--
-- Name: equipos id_equipo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id_equipo SET DEFAULT nextval('public.equipos_id_equipo_seq'::regclass);


--
-- Name: estadisticas id_estadistica; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estadisticas ALTER COLUMN id_estadistica SET DEFAULT nextval('public.estadisticas_id_estadistica_seq'::regclass);


--
-- Name: eventos_partido id_evento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_partido ALTER COLUMN id_evento SET DEFAULT nextval('public.eventos_partido_id_evento_seq'::regclass);


--
-- Name: finanzas id_finanza; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finanzas ALTER COLUMN id_finanza SET DEFAULT nextval('public.finanzas_id_finanza_seq'::regclass);


--
-- Name: grupos id_grupo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id_grupo SET DEFAULT nextval('public.grupos_id_grupo_seq'::regclass);


--
-- Name: items id_item; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id_item SET DEFAULT nextval('public.items_id_item_seq'::regclass);


--
-- Name: items_equipo id_item_equipo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items_equipo ALTER COLUMN id_item_equipo SET DEFAULT nextval('public.items_equipo_id_item_equipo_seq'::regclass);


--
-- Name: jugadores id_jugador; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores ALTER COLUMN id_jugador SET DEFAULT nextval('public.jugadores_id_jugador_seq'::regclass);


--
-- Name: jugadores_equipos id_jugador_equipo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores_equipos ALTER COLUMN id_jugador_equipo SET DEFAULT nextval('public.jugadores_equipos_id_jugador_equipo_seq'::regclass);


--
-- Name: partidos id_partido; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos ALTER COLUMN id_partido SET DEFAULT nextval('public.partidos_id_partido_seq'::regclass);


--
-- Name: resultados id_resultado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados ALTER COLUMN id_resultado SET DEFAULT nextval('public.resultados_id_resultado_seq'::regclass);


--
-- Name: roles id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id_rol SET DEFAULT nextval('public.roles_id_rol_seq'::regclass);


--
-- Name: sanciones id_sancion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanciones ALTER COLUMN id_sancion SET DEFAULT nextval('public.sanciones_id_sancion_seq'::regclass);


--
-- Name: torneos id_torneo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos ALTER COLUMN id_torneo SET DEFAULT nextval('public.torneos_id_torneo_seq'::regclass);


--
-- Name: torneos_reglas_tarjetas id_regla; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos_reglas_tarjetas ALTER COLUMN id_regla SET DEFAULT nextval('public.torneos_reglas_tarjetas_id_regla_seq'::regclass);


--
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria (id_auditoria, id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id) FROM stdin;
\.


--
-- Data for Name: canchas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.canchas (id_cancha, id_torneo, entity_id, nombre, direccion, estado) FROM stdin;
\.


--
-- Data for Name: delegados_equipos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delegados_equipos (id_delegado_equipo, id_usuario, id_equipo, rol, fecha_asignacion, estado) FROM stdin;
\.


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entities (id, nombre, descripcion) FROM stdin;
\.


--
-- Data for Name: entity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entity (entity_id, codigo, descripcion, activo) FROM stdin;
\.


--
-- Data for Name: entity_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entity_audit (audit_id, entity_id, accion, usuario, fecha, detalle) FROM stdin;
\.


--
-- Data for Name: equipos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.equipos (id_equipo, nombre, icono, id_torneo, estado, id_grupo, entity_id, observaciones) FROM stdin;
\.


--
-- Data for Name: equipos_movimientos_grupo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.equipos_movimientos_grupo (id_movimiento, id_equipo, id_torneo, id_grupo_origen, id_grupo_destino, observacion, fecha_movimiento, id_usuario, entity_id) FROM stdin;
\.


--
-- Data for Name: estadisticas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.estadisticas (id_estadistica, id_jugador, id_partido, goles, tarjetas_amarillas, tarjetas_rojas, entity_id) FROM stdin;
\.


--
-- Data for Name: eventos_partido; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.eventos_partido (id_evento, id_partido, id_jugador, tipo_evento, minuto, detalle, id_item, monto) FROM stdin;
\.


--
-- Data for Name: finanzas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.finanzas (id_finanza, id_equipo, monto_inscripcion, monto_aportado, deuda_total, entity_id, id_torneo, fecha_registro, concepto, tipo, saldo, deuda_inicial) FROM stdin;
\.


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grupos (id_grupo, nombre_grupo, id_torneo, estado, entity_id, visible_fixture) FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id_item, nombre, descripcion, monto, entity_id, id_torneo) FROM stdin;
\.


--
-- Data for Name: items_equipo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items_equipo (id_item_equipo, id_equipo, id_partido, nombre, monto, cantidad, observaciones, fecha_registro) FROM stdin;
\.


--
-- Data for Name: jugadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jugadores (id_jugador, nombre, apellido, documento, fecha_nacimiento, estado, entity_id, observaciones) FROM stdin;
\.


--
-- Data for Name: jugadores_equipos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jugadores_equipos (id_jugador_equipo, id_jugador, id_equipo, tipo_vinculo, estado, fecha_inicio, fecha_fin, id_torneo, observaciones, numero_camiseta, capitan) FROM stdin;
\.


--
-- Data for Name: partidos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.partidos (id_partido, id_torneo, equipo_a, equipo_b, fecha, hora, estado, entity_id, numero_fecha, goles_a, goles_b, observaciones, id_grupo, id_cancha) FROM stdin;
\.


--
-- Data for Name: resultados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resultados (id_resultado, id_partido, goles_equipo_a, goles_equipo_b, observaciones, entity_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id_rol, nombre_rol, entity_id) FROM stdin;
1	espectador	\N
2	delegado	\N
3	admin	\N
99	super_admin	\N
\.


--
-- Data for Name: sanciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sanciones (id_sancion, id_jugador, id_partido, partidos_suspendidos, partidos_restantes, fecha_inicio, observaciones, fecha_registro) FROM stdin;
\.


--
-- Data for Name: torneos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.torneos (id_torneo, nombre_torneo, temporada, estado, fecha_inicio, entity_id, portada, permitir_agregar_jugadores) FROM stdin;
\.


--
-- Data for Name: torneos_reglas_tarjetas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.torneos_reglas_tarjetas (id_regla, id_torneo, entity_id, acumula_amarillas, amarillas_para_suspension, fechas_suspension_acumulacion, reiniciar_al_sancionar, aplicar_item_amarilla, aplicar_item_roja, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id_usuario, nombre, correo, contrasena_hash, rol_id, estado, creado_en, documento, entity_id, debe_cambiar_contrasena, reset_contrasena_en) FROM stdin;
79552bf7-8e05-4583-bc88-23c4696e69d6	Julio Mendoza	\N	$2b$12$9PtxyOevbXn41hD21wlLaO/g.DWi4CeAvpK5R/YceCM5nKDmlpDSy	99	t	2026-03-27 03:43:26.964601	5160826	\N	f	\N
\.


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auditoria_id_auditoria_seq', 1, false);


--
-- Name: canchas_id_cancha_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.canchas_id_cancha_seq', 1, false);


--
-- Name: delegados_equipos_id_delegado_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delegados_equipos_id_delegado_equipo_seq', 1, false);


--
-- Name: entities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entities_id_seq', 1, false);


--
-- Name: entity_audit_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entity_audit_audit_id_seq', 1, false);


--
-- Name: entity_entity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.entity_entity_id_seq', 1, false);


--
-- Name: equipos_id_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.equipos_id_equipo_seq', 1, false);


--
-- Name: equipos_movimientos_grupo_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.equipos_movimientos_grupo_id_movimiento_seq', 1, false);


--
-- Name: estadisticas_id_estadistica_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.estadisticas_id_estadistica_seq', 1, false);


--
-- Name: eventos_partido_id_evento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.eventos_partido_id_evento_seq', 1, false);


--
-- Name: finanzas_id_finanza_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.finanzas_id_finanza_seq', 1, false);


--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grupos_id_grupo_seq', 1, false);


--
-- Name: items_equipo_id_item_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_equipo_id_item_equipo_seq', 1, false);


--
-- Name: items_id_item_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_item_seq', 1, false);


--
-- Name: jugadores_equipos_id_jugador_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.jugadores_equipos_id_jugador_equipo_seq', 1, false);


--
-- Name: jugadores_id_jugador_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.jugadores_id_jugador_seq', 1, false);


--
-- Name: partidos_id_partido_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.partidos_id_partido_seq', 1, false);


--
-- Name: resultados_id_resultado_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resultados_id_resultado_seq', 1, false);


--
-- Name: roles_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_rol_seq', 100, false);


--
-- Name: sanciones_id_sancion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sanciones_id_sancion_seq', 1, false);


--
-- Name: torneos_id_torneo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.torneos_id_torneo_seq', 1, false);


--
-- Name: torneos_reglas_tarjetas_id_regla_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.torneos_reglas_tarjetas_id_regla_seq', 1, false);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: canchas canchas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_pkey PRIMARY KEY (id_cancha);


--
-- Name: delegados_equipos delegados_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delegados_equipos
    ADD CONSTRAINT delegados_equipos_pkey PRIMARY KEY (id_delegado_equipo);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: entity_audit entity_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit
    ADD CONSTRAINT entity_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: entity entity_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_codigo_key UNIQUE (codigo);


--
-- Name: entity entity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_pkey PRIMARY KEY (entity_id);


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_pkey PRIMARY KEY (id_movimiento);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- Name: estadisticas estadisticas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estadisticas
    ADD CONSTRAINT estadisticas_pkey PRIMARY KEY (id_estadistica);


--
-- Name: eventos_partido eventos_partido_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_partido
    ADD CONSTRAINT eventos_partido_pkey PRIMARY KEY (id_evento);


--
-- Name: finanzas finanzas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finanzas
    ADD CONSTRAINT finanzas_pkey PRIMARY KEY (id_finanza);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id_grupo);


--
-- Name: items_equipo items_equipo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items_equipo
    ADD CONSTRAINT items_equipo_pkey PRIMARY KEY (id_item_equipo);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id_item);


--
-- Name: jugadores_equipos jugadores_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores_equipos
    ADD CONSTRAINT jugadores_equipos_pkey PRIMARY KEY (id_jugador_equipo);


--
-- Name: jugadores jugadores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_pkey PRIMARY KEY (id_jugador);


--
-- Name: partidos partidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_pkey PRIMARY KEY (id_partido);


--
-- Name: resultados resultados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados
    ADD CONSTRAINT resultados_pkey PRIMARY KEY (id_resultado);


--
-- Name: roles roles_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_rol_key UNIQUE (nombre_rol);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id_rol);


--
-- Name: sanciones sanciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanciones
    ADD CONSTRAINT sanciones_pkey PRIMARY KEY (id_sancion);


--
-- Name: torneos torneos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos
    ADD CONSTRAINT torneos_pkey PRIMARY KEY (id_torneo);


--
-- Name: torneos_reglas_tarjetas torneos_reglas_tarjetas_id_torneo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos_reglas_tarjetas
    ADD CONSTRAINT torneos_reglas_tarjetas_id_torneo_key UNIQUE (id_torneo);


--
-- Name: torneos_reglas_tarjetas torneos_reglas_tarjetas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos_reglas_tarjetas
    ADD CONSTRAINT torneos_reglas_tarjetas_pkey PRIMARY KEY (id_regla);


--
-- Name: delegados_equipos unico_equipo_usuario; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delegados_equipos
    ADD CONSTRAINT unico_equipo_usuario UNIQUE (id_equipo, id_usuario);


--
-- Name: grupos uq_grupo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT uq_grupo UNIQUE (id_torneo, nombre_grupo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: idx_eq_mov_grupo_equipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_mov_grupo_equipo ON public.equipos_movimientos_grupo USING btree (id_equipo);


--
-- Name: idx_eq_mov_grupo_torneo_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_mov_grupo_torneo_destino ON public.equipos_movimientos_grupo USING btree (id_torneo, id_grupo_destino);


--
-- Name: idx_eq_mov_grupo_torneo_origen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_eq_mov_grupo_torneo_origen ON public.equipos_movimientos_grupo USING btree (id_torneo, id_grupo_origen);


--
-- Name: idx_items_entity_torneo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_entity_torneo ON public.items USING btree (entity_id, id_torneo);


--
-- Name: unico_capitan_equipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unico_capitan_equipo ON public.jugadores_equipos USING btree (id_equipo) WHERE (capitan = true);


--
-- Name: usuarios_correo_entity_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_correo_entity_id_key ON public.usuarios USING btree (entity_id, lower(btrim((correo)::text))) WHERE ((correo IS NOT NULL) AND (btrim((correo)::text) <> ''::text));


--
-- Name: usuarios_documento_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_documento_entity_id ON public.usuarios USING btree (documento, entity_id);


--
-- Name: jugadores trg_audit_jugadores; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_jugadores AFTER INSERT OR DELETE OR UPDATE ON public.jugadores FOR EACH ROW EXECUTE FUNCTION public.audit_jugadores();


--
-- Name: jugadores_equipos trg_audit_jugadores_equipos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_jugadores_equipos AFTER INSERT OR DELETE OR UPDATE ON public.jugadores_equipos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_jugadores_equipos();


--
-- Name: canchas trg_canchas_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_canchas_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.canchas FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: delegados_equipos trg_delegados_equipos_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_delegados_equipos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.delegados_equipos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: entity trg_entity_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_entity_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.entity FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: equipos trg_equipos_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: equipos_movimientos_grupo trg_equipos_movimientos_grupo_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_equipos_movimientos_grupo_auditoria AFTER INSERT ON public.equipos_movimientos_grupo FOR EACH ROW EXECUTE FUNCTION public.fn_equipos_movimientos_grupo_auditoria();


--
-- Name: estadisticas trg_estadisticas_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_estadisticas_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.estadisticas FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: eventos_partido trg_eventos_partido_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_eventos_partido_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.eventos_partido FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: finanzas trg_finanzas_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_finanzas_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.finanzas FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: grupos trg_grupos_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_grupos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.grupos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: grupos trg_grupos_crear_items_tarjetas; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_grupos_crear_items_tarjetas AFTER INSERT ON public.grupos FOR EACH ROW EXECUTE FUNCTION public.fn_grupos_crear_items_tarjetas();


--
-- Name: items trg_items_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.fn_items_auditoria();


--
-- Name: items_equipo trg_items_equipo_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_equipo_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.items_equipo FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: items trg_items_set_context; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_set_context BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.fn_items_set_context();


--
-- Name: jugadores_equipos trg_manage_jugadores_equipos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_manage_jugadores_equipos BEFORE INSERT OR UPDATE ON public.jugadores_equipos FOR EACH ROW EXECUTE FUNCTION public.fn_manage_jugadores_equipos();


--
-- Name: partidos trg_partidos_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_partidos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.partidos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: resultados trg_resultados_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_resultados_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.resultados FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: roles trg_roles_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_roles_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: sanciones trg_sanciones_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sanciones_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.sanciones FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: jugadores trg_sync_jugadores_equipos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_jugadores_equipos AFTER INSERT OR UPDATE ON public.jugadores FOR EACH ROW EXECUTE FUNCTION public.fn_sync_jugadores_equipos();


--
-- Name: torneos trg_torneos_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_torneos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.torneos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_torneos();


--
-- Name: torneos trg_torneos_crear_items_tarjetas; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_torneos_crear_items_tarjetas AFTER INSERT ON public.torneos FOR EACH ROW EXECUTE FUNCTION public.fn_torneos_crear_items_tarjetas();


--
-- Name: torneos_reglas_tarjetas trg_torneos_reglas_tarjetas_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_torneos_reglas_tarjetas_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.torneos_reglas_tarjetas FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: usuarios trg_usuarios_auditoria; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_usuarios_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();


--
-- Name: jugadores trg_vincular_jugador_equipo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_vincular_jugador_equipo AFTER INSERT ON public.jugadores FOR EACH ROW EXECUTE FUNCTION public.fn_vincular_jugador_equipo();


--
-- Name: auditoria auditoria_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: auditoria auditoria_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);


--
-- Name: canchas canchas_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id) ON DELETE CASCADE;


--
-- Name: canchas canchas_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo) ON DELETE CASCADE;


--
-- Name: entity_audit entity_audit_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_audit
    ADD CONSTRAINT entity_audit_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: equipos equipos_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: equipos equipos_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo);


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_id_grupo_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_id_grupo_destino_fkey FOREIGN KEY (id_grupo_destino) REFERENCES public.grupos(id_grupo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_id_grupo_origen_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_id_grupo_origen_fkey FOREIGN KEY (id_grupo_origen) REFERENCES public.grupos(id_grupo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipos_movimientos_grupo equipos_movimientos_grupo_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos_movimientos_grupo
    ADD CONSTRAINT equipos_movimientos_grupo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: estadisticas estadisticas_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estadisticas
    ADD CONSTRAINT estadisticas_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: estadisticas estadisticas_id_jugador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estadisticas
    ADD CONSTRAINT estadisticas_id_jugador_fkey FOREIGN KEY (id_jugador) REFERENCES public.jugadores(id_jugador);


--
-- Name: estadisticas estadisticas_id_partido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estadisticas
    ADD CONSTRAINT estadisticas_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES public.partidos(id_partido);


--
-- Name: eventos_partido eventos_partido_id_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_partido
    ADD CONSTRAINT eventos_partido_id_item_fkey FOREIGN KEY (id_item) REFERENCES public.items(id_item);


--
-- Name: eventos_partido eventos_partido_id_jugador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_partido
    ADD CONSTRAINT eventos_partido_id_jugador_fkey FOREIGN KEY (id_jugador) REFERENCES public.jugadores(id_jugador);


--
-- Name: eventos_partido eventos_partido_id_partido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.eventos_partido
    ADD CONSTRAINT eventos_partido_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES public.partidos(id_partido);


--
-- Name: finanzas finanzas_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finanzas
    ADD CONSTRAINT finanzas_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: finanzas finanzas_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finanzas
    ADD CONSTRAINT finanzas_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo);


--
-- Name: delegados_equipos fk_equipo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delegados_equipos
    ADD CONSTRAINT fk_equipo FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: finanzas fk_finanzas_torneo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finanzas
    ADD CONSTRAINT fk_finanzas_torneo FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo);


--
-- Name: equipos fk_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT fk_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupos(id_grupo) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grupos fk_torneo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_torneo FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: delegados_equipos fk_usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delegados_equipos
    ADD CONSTRAINT fk_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grupos grupos_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: items items_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: items_equipo items_equipo_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items_equipo
    ADD CONSTRAINT items_equipo_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo);


--
-- Name: items_equipo items_equipo_id_partido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items_equipo
    ADD CONSTRAINT items_equipo_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES public.partidos(id_partido);


--
-- Name: items items_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: jugadores jugadores_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: jugadores_equipos jugadores_equipos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores_equipos
    ADD CONSTRAINT jugadores_equipos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id_equipo);


--
-- Name: jugadores_equipos jugadores_equipos_id_jugador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores_equipos
    ADD CONSTRAINT jugadores_equipos_id_jugador_fkey FOREIGN KEY (id_jugador) REFERENCES public.jugadores(id_jugador);


--
-- Name: jugadores_equipos jugadores_equipos_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jugadores_equipos
    ADD CONSTRAINT jugadores_equipos_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo);


--
-- Name: partidos partidos_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: partidos partidos_equipo_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_equipo_a_fkey FOREIGN KEY (equipo_a) REFERENCES public.equipos(id_equipo);


--
-- Name: partidos partidos_equipo_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_equipo_b_fkey FOREIGN KEY (equipo_b) REFERENCES public.equipos(id_equipo);


--
-- Name: partidos partidos_id_cancha_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_id_cancha_fkey FOREIGN KEY (id_cancha) REFERENCES public.canchas(id_cancha) ON DELETE SET NULL;


--
-- Name: partidos partidos_id_grupo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES public.grupos(id_grupo) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: partidos partidos_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo);


--
-- Name: resultados resultados_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados
    ADD CONSTRAINT resultados_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: resultados resultados_id_partido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados
    ADD CONSTRAINT resultados_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES public.partidos(id_partido);


--
-- Name: roles roles_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: sanciones sanciones_id_jugador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanciones
    ADD CONSTRAINT sanciones_id_jugador_fkey FOREIGN KEY (id_jugador) REFERENCES public.jugadores(id_jugador);


--
-- Name: sanciones sanciones_id_partido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanciones
    ADD CONSTRAINT sanciones_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES public.partidos(id_partido);


--
-- Name: torneos torneos_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos
    ADD CONSTRAINT torneos_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: torneos_reglas_tarjetas torneos_reglas_tarjetas_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos_reglas_tarjetas
    ADD CONSTRAINT torneos_reglas_tarjetas_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: torneos_reglas_tarjetas torneos_reglas_tarjetas_id_torneo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.torneos_reglas_tarjetas
    ADD CONSTRAINT torneos_reglas_tarjetas_id_torneo_fkey FOREIGN KEY (id_torneo) REFERENCES public.torneos(id_torneo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios usuarios_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(entity_id);


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id_rol) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

