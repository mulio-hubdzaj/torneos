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

  -- Registrar en auditoría la asignación
  INSERT INTO auditoria(id_usuario, accion, tabla_afectada, detalle, entity_id)
  VALUES (
    NEW.id_usuario,
    'UPDATE',
    'usuarios',
    jsonb_build_object(
      'rol', 'Espectador → Delegado',
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
    -- Leer variable de sesión
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
                'Se creó entity con código ' || NEW.codigo);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Detectar cambio de estado activo/desactivado
        IF NEW.activo <> OLD.activo THEN
            INSERT INTO entity_audit(entity_id, accion, usuario, detalle)
            VALUES (NEW.entity_id,
                    CASE WHEN NEW.activo THEN 'ACTIVAR' ELSE 'DESACTIVAR' END,
                    current_user,
                    'Cambio de estado para código ' || NEW.codigo);
        ELSE
            INSERT INTO entity_audit(entity_id, accion, usuario, detalle)
            VALUES (NEW.entity_id, 'UPDATE', current_user,
                    'Se modificó entity con código ' || NEW.codigo);
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
    RAISE EXCEPTION 'Solo se permite modificar la descripción o el estado de Entity';
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
    -- lógica adicional si querés validar duplicados o asignar numero_camiseta
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- actualizar campos específicos, por ejemplo estado y observaciones
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

  -- Registrar en auditoría la reasignación
  INSERT INTO auditoria(id_usuario, accion, tabla_afectada, detalle, entity_id)
  VALUES (
    OLD.id_usuario,
    'UPDATE',
    'usuarios',
    jsonb_build_object(
      'rol', 'Delegado → Espectador',
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
  -- Al crear jugador, insertar vínculo
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
        TG_OP,                                     -- operación: INSERT, UPDATE, DELETE
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
    entity_id integer
);


ALTER TABLE public.grupos OWNER TO postgres;

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
    id_grupo integer
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
    portada character varying(255)
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
    entity_id integer
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
1377	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	equipos_movimientos_grupo	{"equipo": "DDD", "usuario": "Julio Mendoza", "documento": "5160826", "id_equipo": 108, "id_torneo": 8, "id_usuario": "79552bf7-8e05-4583-bc88-23c4696e69d6", "observacion": "Se cambio de A a B", "grupo_origen": "A", "detalle_claro": "Se cambio de A a B", "grupo_destino": "B", "id_movimiento": 5, "id_grupo_origen": 26, "fecha_movimiento": "2026-05-07T02:09:55.158", "id_grupo_destino": 54}	2026-05-07 02:09:55.141499	2
1378	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	equipos	{"icono": "/images/default_team.png", "estado": true, "nombre": "DDD", "id_grupo": 54, "entity_id": 2, "id_equipo": 108, "id_torneo": 8, "observaciones": null}	2026-05-07 02:09:55.141499	2
1379	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	grupos	{"estado": true, "id_grupo": 55, "entity_id": 2, "id_torneo": 8, "nombre_grupo": "CUARTOS"}	2026-05-07 02:09:59.476593	2
1380	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	grupos	{"estado": true, "id_grupo": 56, "entity_id": 2, "id_torneo": 8, "nombre_grupo": "OFF"}	2026-05-07 02:10:03.988691	2
1381	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	equipos	{"icono": "/images/default_team.png", "estado": true, "nombre": "SECU", "id_grupo": 56, "entity_id": 2, "id_equipo": 113, "id_torneo": 8, "observaciones": null}	2026-05-07 02:10:10.552322	2
1382	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	equipos	{"icono": "/images/default_team.png", "estado": true, "nombre": "SECU", "id_grupo": 54, "entity_id": 2, "id_equipo": 113, "id_torneo": 8, "observaciones": null}	2026-05-07 02:10:20.318473	2
1383	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	grupos	{"estado": true, "id_grupo": 56, "entity_id": 2, "id_torneo": 8, "nombre_grupo": "OFF"}	2026-05-07 02:10:22.906424	2
1384	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	{"icono": "/images/default_team.png", "estado": true, "nombre": "EEE", "id_grupo": 26, "entity_id": 2, "id_equipo": 109, "id_torneo": 8, "observaciones": null}	2026-05-07 02:13:35.863742	2
1385	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	delegados_equipos	{"rol": "delegado", "estado": true, "id_equipo": 109, "id_usuario": "34593613-cd11-4298-9b14-d157e533edc3", "fecha_asignacion": "2026-05-06T19:32:34.782997", "id_delegado_equipo": 32}	2026-05-07 02:13:35.863742	2
1386	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	delegados_equipos	{"rol": "delegado", "estado": true, "id_equipo": 109, "id_usuario": "e6315efd-3815-42c2-bd97-e356c1ba99a7", "fecha_asignacion": "2026-05-06T19:32:44.291111", "id_delegado_equipo": 33}	2026-05-07 02:13:35.863742	2
1387	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	{"icono": "/images/default_team.png", "estado": true, "nombre": "CCC", "id_grupo": 26, "entity_id": 2, "id_equipo": 107, "id_torneo": 8, "observaciones": null}	2026-05-07 02:13:39.89459	2
1391	\N	UPDATE	equipos	"Se cambio estado de true a false"	2026-05-07 12:30:10.359433	2
1392	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	"Se elimino equipos: LIBERTAD"	2026-05-07 12:33:31.457131	2
1393	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	delegados_equipos	"Se elimino delegados_equipos: registro"	2026-05-07 12:33:31.457131	2
1394	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	"Se elimino equipos: BOCA"	2026-05-07 12:33:39.321218	2
1395	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	delegados_equipos	"Se elimino delegados_equipos: registro"	2026-05-07 12:33:39.321218	2
1396	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	delegados_equipos	"Se elimino delegados_equipos: registro"	2026-05-07 12:33:39.321218	2
1397	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	"Se elimino equipos: SECU"	2026-05-07 12:34:50.87904	2
1398	79552bf7-8e05-4583-bc88-23c4696e69d6	DELETE	equipos	"Se elimino equipos: ALONZO"	2026-05-07 12:35:06.970492	2
1399	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	equipos	"Se cambio icono de /uploads/1777936763778-argentina.webp a /uploads/aa1cbd43f5f27f4067f11b9032690ad5"	2026-05-07 12:41:39.703006	2
1400	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de vacio a /uploads/6fc30608b6ba84904dc4f85b6a12ef68"	2026-05-07 13:00:23.940119	2
1401	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de /uploads/6fc30608b6ba84904dc4f85b6a12ef68 a /uploads/c61d94e337581aee7f6365eddf65f8bc"	2026-05-07 13:02:01.324211	2
1402	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de /uploads/c61d94e337581aee7f6365eddf65f8bc a vacio"	2026-05-07 13:02:22.644113	2
1403	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de vacio a /uploads/b0e1b8b448a0693200155f4e3c99f393"	2026-05-07 13:07:51.670621	2
1404	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 57 a 80"	2026-05-07 13:19:39.522134	2
1405	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 63 a 70"	2026-05-07 13:20:34.912781	2
1406	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 68 a 70"	2026-05-07 13:20:34.927073	2
1407	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 68 a 70"	2026-05-07 13:20:34.929996	2
1408	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 13:20:34.932676	2
1409	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 13:20:34.949452	2
1410	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 63 a 70"	2026-05-07 13:20:34.951618	2
1411	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 13:20:34.955479	2
1412	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 13:20:34.957477	2
1413	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1414	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 22"	2026-05-07 13:20:58.249511	2
1415	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 16"	2026-05-07 13:20:58.249511	2
1416	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 25"	2026-05-07 13:20:58.249511	2
1417	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1418	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 58"	2026-05-07 13:20:58.249511	2
1419	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 16"	2026-05-07 13:20:58.249511	2
1420	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 21"	2026-05-07 13:20:58.249511	2
1421	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de true a false"	2026-05-07 13:20:58.249511	2
1422	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1423	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1424	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1425	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1426	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1427	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1428	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:20:58.249511	2
1429	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de false a true"	2026-05-07 13:20:58.249511	2
1430	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	equipos	"Se cambio icono de /uploads/1777928386308-brasil.png a /uploads/727f6c5d774da0db91ea3880936d9921"	2026-05-07 13:27:20.625632	2
1431	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de vacio a /uploads/066ac1da13d4ca5d83c4955e39579a07"	2026-05-07 13:27:52.198631	2
1432	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio estado de false a true; Se cambio equipo de 75 a 50"	2026-05-07 13:51:02.171454	2
1433	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio estado de false a true; Se cambio equipo de vacio a 50"	2026-05-07 13:51:02.200755	2
1434	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de vacio a 50"	2026-05-07 13:51:02.203064	2
1435	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 76 a 50"	2026-05-07 13:51:02.205478	2
1436	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio estado de false a true; Se cambio equipo de vacio a 50"	2026-05-07 13:51:02.207783	2
1437	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 13:51:02.210128	2
1438	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 22"	2026-05-07 13:51:18.232308	2
1439	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 11"	2026-05-07 13:51:18.232308	2
1440	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 10"	2026-05-07 13:51:18.232308	2
1441	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 55"	2026-05-07 13:51:18.232308	2
1442	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 6"	2026-05-07 13:51:18.232308	2
1443	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 8"	2026-05-07 13:51:18.232308	2
1444	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1445	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1446	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1447	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1448	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1449	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 13:51:18.232308	2
1450	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de false a true"	2026-05-07 13:51:18.232308	2
1451	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de vacio a 82"	2026-05-07 13:54:47.07876	2
1452	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio estado de false a true; Se cambio equipo de 72 a 82"	2026-05-07 13:54:47.110258	2
1453	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 76 a 82"	2026-05-07 13:54:47.11269	2
1454	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio estado de false a true; Se cambio equipo de vacio a 82"	2026-05-07 13:54:47.114971	2
1455	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 77 a 82"	2026-05-07 13:54:47.11899	2
1456	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 22"	2026-05-07 14:24:56.989461	2
1457	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 1"	2026-05-07 14:24:56.989461	2
1458	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 22"	2026-05-07 14:24:56.989461	2
1459	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 14:24:56.989461	2
1460	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 14:24:56.989461	2
1461	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 14:24:56.989461	2
1462	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de false a true"	2026-05-07 14:24:56.989461	2
1463	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de /uploads/b0e1b8b448a0693200155f4e3c99f393 a vacio"	2026-05-07 17:11:06.474176	2
1464	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de vacio a /uploads/02d3ce37bb2070c586f3574135f4958d"	2026-05-07 17:11:39.944608	2
1465	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio portada de /uploads/02d3ce37bb2070c586f3574135f4958d a vacio"	2026-05-07 17:12:38.369227	2
1466	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 17:14:34.582236	2
1467	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 17:14:36.414821	2
1468	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 17:14:37.372391	2
1469	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de false a true"	2026-05-07 17:14:44.531294	2
1470	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de false a true"	2026-05-07 17:14:46.213064	2
1471	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de false a true"	2026-05-07 17:14:47.654223	2
1472	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	equipos	"Se movio de grupo B a grupo A"	2026-05-07 17:15:35.557807	2
1473	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	equipos	"Se creo equipos: MENDOZA"	2026-05-07 17:15:49.210705	2
1474	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	items	"Se creo items: targeta amarilla"	2026-05-07 18:00:27.883607	2
1475	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	items	"Se creo items: INSCRIPCION"	2026-05-07 18:00:39.899341	2
1476	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	items	"Se creo items: DERECHO DE PARTIDOS"	2026-05-07 18:00:58.004454	2
1477	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:01:51.391844	2
1478	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 18:02:23.74872	2
1479	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 57 a 69"	2026-05-07 18:02:23.775458	2
1480	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 57 a 69"	2026-05-07 18:02:23.781737	2
1481	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 18:02:23.784354	2
1482	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 68 a 69"	2026-05-07 18:02:23.786951	2
1483	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 22"	2026-05-07 18:02:40.014916	2
1484	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1485	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1486	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de 11 a 10"	2026-05-07 18:02:40.014916	2
1487	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 55"	2026-05-07 18:02:40.014916	2
1488	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1489	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1490	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de true a false"	2026-05-07 18:02:40.014916	2
1491	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1492	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 18:02:40.014916	2
1493	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de false a true"	2026-05-07 18:02:40.014916	2
1494	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	delegados_equipos	"Se creo delegados_equipos: registro"	2026-05-07 18:02:56.608921	2
1495	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:04:02.774374	2
1496	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:04:02.774374	2
1497	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:04:02.774374	2
1498	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:04:02.774374	2
1499	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 18:04:47.455679	2
1500	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 18:04:47.455679	2
1501	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:04:47.455679	2
1502	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:04:47.455679	2
1503	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:04:47.455679	2
1504	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:04:47.455679	2
1505	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:04:47.455679	2
1506	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 18:07:52.65685	2
1507	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 18:07:52.65685	2
1508	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 18:07:52.65685	2
1509	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:07:52.65685	2
1510	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:07:52.65685	2
1511	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 18:07:52.65685	2
1512	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:07:52.65685	2
1513	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 18:07:52.65685	2
1514	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:11.936851	2
1515	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:11.936851	2
1516	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:11.936851	2
1517	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:11.936851	2
1518	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:11.936851	2
1519	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:11.936851	2
1520	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:33:11.936851	2
1521	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:33:11.936851	2
1522	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:42.282497	2
1523	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:42.282497	2
1524	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:33:42.282497	2
1525	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:42.282497	2
1526	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:42.282497	2
1527	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:42.282497	2
1528	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:33:42.282497	2
1529	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:33:42.282497	2
1530	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:33:42.282497	2
1531	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:08.395349	2
1532	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:08.395349	2
1533	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:08.395349	2
1534	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:08.395349	2
1535	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:08.395349	2
1536	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:08.395349	2
1537	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:08.395349	2
1538	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:08.395349	2
1539	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:08.395349	2
1540	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:08.395349	2
1541	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:41.724842	2
1542	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:41.724842	2
1543	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:41.724842	2
1544	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:41.724842	2
1545	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:41.724842	2
1546	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:41.724842	2
1547	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:41.724842	2
1548	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:41.724842	2
1549	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:41.724842	2
1550	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:41.724842	2
1551	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:55.531863	2
1552	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:55.531863	2
1553	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:55.531863	2
1554	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:34:55.531863	2
1555	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:55.531863	2
1556	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:55.531863	2
1557	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:55.531863	2
1558	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:34:55.531863	2
1559	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:55.531863	2
1560	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:34:55.531863	2
1561	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:35:25.620539	2
1562	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:35:25.620539	2
1563	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:35:25.620539	2
1564	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:35:25.620539	2
1565	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:35:25.620539	2
1566	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:35:25.620539	2
1567	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:35:25.620539	2
1572	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:36:09.106723	2
1573	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:36:09.106723	2
1574	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:36:09.106723	2
1575	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	items	"Se cambio monto de 1000000.00 a 100000.00"	2026-05-07 19:36:46.912425	2
1576	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	items	"Se cambio monto de 1000000.00 a 100000.00"	2026-05-07 19:37:10.335072	2
1579	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:38:28.727472	2
1580	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:38:28.727472	2
1581	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:38:28.727472	2
1582	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:38:28.727472	2
1583	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:38:56.472206	2
1584	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:38:56.472206	2
1585	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:38:56.472206	2
1586	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:38:56.472206	2
1587	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:38:56.472206	2
1588	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:38:56.472206	2
1589	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:39:07.691735	2
1590	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 19:39:07.691735	2
1591	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:39:07.691735	2
1592	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 19:39:07.691735	2
1593	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:39:07.691735	2
1594	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 19:39:07.691735	2
1595	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - OLIMPIA"	2026-05-07 19:40:16.729904	2
1596	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #318 - GUARANI"	2026-05-07 19:57:05.624004	2
1597	\N	INSERT	finanzas	"Se creo finanzas: Fecha libre #2 - LANUS"	2026-05-07 20:02:05.693934	2
1598	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	torneos	"Se creo torneos: tarjetas"	2026-05-07 20:20:49.147575	2
1599	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	torneos	"Se creo torneos: tarjetas 2"	2026-05-07 20:23:39.24798	2
1600	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	items	"Se creo items: TARJETA AMARILLA"	2026-05-07 20:23:39.24798	2
1601	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	items	"Se creo items: TARJETA ROJA"	2026-05-07 20:23:39.24798	2
1602	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 20:25:10.555882	2
1603	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 20:25:11.699981	2
1604	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 20:26:33.987322	2
1605	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 20:26:33.987322	2
1606	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 20:26:33.987322	2
1607	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 20:26:33.987322	2
1608	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 20:26:33.987322	2
1609	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #315 - GUARANI"	2026-05-07 20:26:33.987322	2
1610	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #315 - GUARANI"	2026-05-07 20:26:33.987322	2
1611	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	items	"Se actualizo items: targeta amarilla"	2026-05-07 20:57:28.013812	2
1612	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	items	"Se actualizo items: targeta amarilla"	2026-05-07 20:57:41.016172	2
1613	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	items	"Se cambio nombre de targeta amarilla a TARJETA AMARILLA"	2026-05-07 20:57:52.559637	2
1614	\N	INSERT	torneos_reglas_tarjetas	"Se creo torneos_reglas_tarjetas: registro"	2026-05-07 20:58:12.341737	2
1617	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 20:59:41.087707	2
1618	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 20:59:41.087707	2
1619	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #318 - GUARANI"	2026-05-07 20:59:41.087707	2
1620	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #318 - GUARANI"	2026-05-07 20:59:41.087707	2
1621	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 21:00:08.30689	2
1622	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #322 - GUARANI"	2026-05-07 21:00:08.30689	2
1623	\N	UPDATE	torneos_reglas_tarjetas	"Se cambio amarillas para suspension de 5 a 3"	2026-05-07 21:00:23.659084	2
1624	\N	UPDATE	torneos_reglas_tarjetas	"Se actualizo torneos_reglas_tarjetas: registro"	2026-05-07 21:00:30.15791	2
1625	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de true a false"	2026-05-07 21:02:13.975668	2
1626	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	torneos	"Se cambio estado de false a true"	2026-05-07 21:02:19.050993	2
1627	\N	UPDATE	torneos_reglas_tarjetas	"Se cambio acumula amarillas de false a true; Se cambio reiniciar al sancionar de false a true"	2026-05-07 21:02:44.762284	2
1628	79552bf7-8e05-4583-bc88-23c4696e69d6	INSERT	jugadores_equipos	"Se creo jugadores_equipos: registro"	2026-05-07 21:03:27.785666	2
1629	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 63 a 58"	2026-05-07 21:03:27.801496	2
1630	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio equipo de 63 a 58"	2026-05-07 21:03:27.805304	2
1631	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 1"	2026-05-07 21:03:36.932926	2
1632	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 2"	2026-05-07 21:03:36.932926	2
1633	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio numero camiseta de vacio a 3"	2026-05-07 21:03:36.932926	2
1634	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 21:03:36.932926	2
1635	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 21:03:36.932926	2
1636	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se actualizo jugadores_equipos: registro"	2026-05-07 21:03:36.932926	2
1637	79552bf7-8e05-4583-bc88-23c4696e69d6	UPDATE	jugadores_equipos	"Se cambio capitan de false a true"	2026-05-07 21:03:36.932926	2
1638	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 21:04:03.597623	2
1639	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #316 - RIVER"	2026-05-07 21:04:03.597623	2
1640	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-07 21:04:29.534695	2
1641	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 21:04:29.534695	2
1642	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #316 - RIVER"	2026-05-07 21:04:29.534695	2
1643	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #316 - RIVER"	2026-05-07 21:04:29.534695	2
1644	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 21:05:33.792609	2
1645	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #318 - RIVER"	2026-05-07 21:05:33.792609	2
1646	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-07 21:05:54.071302	2
1647	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #320 - RIVER"	2026-05-07 21:05:54.071302	2
1648	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #325 - TOLEDO"	2026-05-07 21:06:24.886715	2
1649	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-08 13:22:00.617801	2
1650	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-08 13:22:00.617801	2
1651	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-08 13:22:00.617801	2
1652	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #316 - RIVER"	2026-05-08 13:22:00.617801	2
1653	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #316 - RIVER"	2026-05-08 13:22:00.617801	2
1654	\N	DELETE	estadisticas	"Se elimino estadisticas: registro"	2026-05-08 13:22:19.665914	2
1655	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-08 13:22:19.665914	2
1656	\N	INSERT	estadisticas	"Se creo estadisticas: registro"	2026-05-08 13:22:19.665914	2
1657	\N	DELETE	finanzas	"Se elimino finanzas: Encuentro #318 - RIVER"	2026-05-08 13:22:19.665914	2
1658	\N	INSERT	finanzas	"Se creo finanzas: Encuentro #318 - RIVER"	2026-05-08 13:22:19.665914	2
\.


--
-- Data for Name: delegados_equipos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delegados_equipos (id_delegado_equipo, id_usuario, id_equipo, rol, fecha_asignacion, estado) FROM stdin;
22	34593613-cd11-4298-9b14-d157e533edc3	58	delegado	2026-05-01 20:08:19.067225	t
27	34593613-cd11-4298-9b14-d157e533edc3	73	delegado	2026-05-03 23:45:34.900939	t
30	d4dfc7ac-59c3-4bc9-9130-6431cdd029de	50	delegado	2026-05-06 04:55:08.305515	t
38	ceba6f6e-d1c3-4d8d-a268-84a437d8e3ce	69	delegado	2026-05-07 18:02:56.608921	t
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
4	A3	A4	t
1	A1	A01	t
2	A2	A223	t
3	CCSDC	ASXAAA	t
9	A4	A3	f
8	A5	A5	f
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
31	CHILE	\N	2	f	8	2	\N
37	CDCSD	\N	2	t	13	2	\N
70	NACIONAL	/uploads/727f6c5d774da0db91ea3880936d9921	12	t	40	2	\N
39	CSD	\N	2	t	19	2	\N
38	CDSC	\N	2	f	20	2	\N
28	BOLIVIA	\N	2	f	13	2	\N
41	CHILE	\N	2	t	21	2	\N
42	PERU	\N	2	t	21	2	\N
43	ARGENTINA	\N	6	t	22	4	\N
71	BRASIL	/images/default_team.png	6	t	22	4	\N
14	OLMPIA	\N	1	t	10	2	\N
73	PPP	/uploads/5da3176babf4b2122b8416519e068356	3	t	39	2	\N
50	BRASIL	/uploads/3316986b79a37d09fd9af397a21ab526	3	t	52	2	\N
32	VENEZUELA	\N	2	t	13	2	\N
40	VENEZUELA	\N	2	f	21	2	\N
82	ECUADOR	/images/default_team.png	3	t	52	2	\N
98	PERU	/images/default_team.png	3	t	52	2	\N
99	DDD	/images/default_team.png	3	t	36	2	\N
69	GUARANI	\N	12	t	40	2	\N
100	AAAA	/images/default_team.png	3	t	39	2	\N
103	AAA	/images/default_team.png	3	t	36	2	\N
101	BBB	/images/default_team.png	3	t	36	2	\N
102	CCC	/images/default_team.png	3	t	36	2	\N
104	EEE	/images/default_team.png	3	t	36	2	\N
114	MENDOZA	/images/default_team.png	12	t	41	2	\N
13	VZXC	/uploads/0bfc72af5ae13d4a163cd5d4e633cf62	1	t	10	2	\N
97	COLOMBIA	/uploads/4da1b0ba6202bcc872bbab8db393fa9a	3	t	52	2	\N
26	PERU	\N	2	t	13	2	\N
27	PERU	\N	2	t	8	2	\N
22	BRASIL	\N	2	t	13	2	\N
21	ARGENTINA	\N	2	t	8	2	\N
58	RIVER	\N	12	t	40	2	\N
30	ECUADOR	\N	2	t	8	2	\N
34	ARGENTINA	\N	2	t	13	2	\N
74	PARAGUAY	/uploads/e732bb347b8133ded1ef33360c100ccf	3	t	52	2	\N
79	SOL	/images/default_team.png	12	t	41	2	\N
80	AMERIA	/images/default_team.png	12	t	41	2	\N
59	LANUS	/uploads/a6a15c1c14800e6799578f7a5a6f6af0	12	t	40	2	\N
81	TOLEDO	/uploads/a4cc164347ae2d0757143894c17569e4	12	t	41	2	\N
83	VENEZUELA	/images/default_team.png	3	t	52	2	\N
64	EQUIPO 1	\N	9	t	48	8	\N
65	EQUIPO 2	\N	9	t	50	8	\N
67	OLIMPIA	\N	12	t	40	2	\N
112	ELSA	/images/default_team.png	8	t	54	2	\N
66	CHILE	/uploads/c6fbdb2309ed643dbf28e51c595d4da6	3	t	52	2	\N
106	BBB	/images/default_team.png	8	t	54	2	\N
105	AAA	/images/default_team.png	8	t	54	2	\N
108	DDD	/images/default_team.png	8	f	54	2	\N
78	ARGENTINA	/uploads/aa1cbd43f5f27f4067f11b9032690ad5	3	t	52	2	\N
\.


--
-- Data for Name: equipos_movimientos_grupo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.equipos_movimientos_grupo (id_movimiento, id_equipo, id_torneo, id_grupo_origen, id_grupo_destino, observacion, fecha_movimiento, id_usuario, entity_id) FROM stdin;
3	106	8	26	54	Se cambio de A a B	2026-05-07 02:03:21.536	79552bf7-8e05-4583-bc88-23c4696e69d6	2
5	108	8	26	54	Se cambio de A a B	2026-05-07 02:09:55.158	79552bf7-8e05-4583-bc88-23c4696e69d6	2
\.


--
-- Data for Name: estadisticas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.estadisticas (id_estadistica, id_jugador, id_partido, goles, tarjetas_amarillas, tarjetas_rojas, entity_id) FROM stdin;
37	18	315	2	1	0	2
38	25	315	0	1	0	2
39	26	315	0	1	0	2
42	18	318	0	1	0	2
43	25	318	0	1	0	2
44	18	322	0	1	0	2
48	19	320	0	1	0	2
49	19	316	0	1	0	2
50	13	316	0	1	0	2
51	19	318	0	1	0	2
52	13	318	0	1	0	2
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
15	67	0.00	0.00	0.00	2	12	2026-05-07	Encuentro #315 - OLIMPIA	partido	0.00	0.00
17	59	0.00	0.00	100000.00	2	12	2026-05-07	Fecha libre #2 - LANUS	fecha_libre	100000.00	0.00
18	69	0.00	100000.00	230000.00	2	12	2026-05-07	Encuentro #315 - GUARANI	partido	160000.00	30000.00
19	69	0.00	100000.00	130000.00	2	12	2026-05-07	Encuentro #318 - GUARANI	partido	190000.00	160000.00
20	69	0.00	0.00	15000.00	2	12	2026-05-07	Encuentro #322 - GUARANI	partido	205000.00	190000.00
24	58	0.00	0.00	15000.00	2	12	2026-05-07	Encuentro #320 - RIVER	partido	145000.00	130000.00
25	81	0.00	0.00	100000.00	2	12	2026-05-07	Encuentro #325 - TOLEDO	partido	100000.00	0.00
26	58	0.00	0.00	130000.00	2	12	2026-05-08	Encuentro #316 - RIVER	partido	275000.00	145000.00
27	58	0.00	0.00	30000.00	2	12	2026-05-08	Encuentro #318 - RIVER	partido	305000.00	275000.00
\.


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grupos (id_grupo, nombre_grupo, id_torneo, estado, entity_id) FROM stdin;
3	GRUBO B	1	t	1
8	CXZ	2	t	2
10	 XCVC	1	t	2
13	B	2	t	2
19	SDSD	2	t	2
20	SAS	2	t	2
21	CUARTOS IDA	2	t	2
22	1	6	t	4
26	A	8	t	2
36	A	3	t	2
38	B	3	t	2
39	SEMIFINAL	3	t	2
40	A	12	t	2
41	B	12	t	2
48	A	9	t	8
50	B	9	t	8
51	SEMI	12	t	2
52	CUARTOS	3	t	2
54	B	8	t	2
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id_item, nombre, descripcion, monto, entity_id, id_torneo) FROM stdin;
4	tarjeta roja	\N	15000.00	2	8
9	DERECHO DE PARTIDOS	\N	100000.00	2	12
8	INSCRIPCION	\N	100000.00	2	12
10	TARJETA AMARILLA	Item automatico generado al crear torneo	1.00	2	14
11	TARJETA ROJA	Item automatico generado al crear torneo	1.00	2	14
7	TARJETA AMARILLA	\N	15000.00	2	12
\.


--
-- Data for Name: items_equipo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items_equipo (id_item_equipo, id_equipo, id_partido, nombre, monto, cantidad, observaciones, fecha_registro) FROM stdin;
33	59	\N	DERECHO DE PARTIDOS	100000.00	1	[fecha_libre:12:2]	2026-05-07 20:02:05.693934
34	69	315	targeta amarilla	15000.00	2		2026-05-07 20:26:33.987322
35	69	315	INSCRIPCION	100000.00	1		2026-05-07 20:26:33.987322
36	69	315	DERECHO DE PARTIDOS	100000.00	1		2026-05-07 20:26:33.987322
37	69	318	INSCRIPCION	100000.00	1		2026-05-07 20:59:41.087707
38	69	318	TARJETA AMARILLA	15000.00	2	Generado por tarjetas del encuentro	2026-05-07 20:59:41.087707
39	69	322	TARJETA AMARILLA	15000.00	1	Generado por tarjetas del encuentro	2026-05-07 21:00:08.30689
44	58	320	TARJETA AMARILLA	15000.00	1	Generado por tarjetas del encuentro	2026-05-07 21:05:54.071302
45	81	325	DERECHO DE PARTIDOS	100000.00	1		2026-05-07 21:06:24.886715
46	58	316	TARJETA AMARILLA	15000.00	2	Generado por tarjetas del encuentro	2026-05-08 13:22:00.617801
47	58	316	DERECHO DE PARTIDOS	100000.00	1		2026-05-08 13:22:00.617801
48	58	318	TARJETA AMARILLA	15000.00	2	Generado por tarjetas del encuentro	2026-05-08 13:22:19.665914
\.


--
-- Data for Name: jugadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jugadores (id_jugador, nombre, apellido, documento, fecha_nacimiento, estado, entity_id, observaciones) FROM stdin;
14	fgfhgf	fhghfh	885858	1990-07-30	t	4	
15	jul	mmm	5160826	1990-07-30	t	4	
31	joel 	lopez	55554	2001-01-22	t	2	
27	rolando	roman	777777777	2004-02-20	t	2	prueba
12	juan	perez	55522233	2001-10-22	t	2	
3	cdscz	cds	65151	2002-10-22	f	2	 cvb
8	alan	batista	525252	2000-12-10	t	2	
30	alejandro	aghuero	5222222	2001-05-08	t	2	
17	xsas	xas	8885555	2001-01-20	t	2	
18	xsxax	xasa	111222	2001-10-01	t	2	
19	jjgjf	hgfhg	552225	2001-01-01	t	2	
29	rodrigo 	lopez	9999999999	2004-01-02	t	2	
28	elias	dos santos	888888888888888888	0001-02-02	t	2	
34	martin	candi	645654	2001-01-22	t	2	
26	marcos 	martinez	222222222	2002-02-02	t	2	prueba
33	juan 	perez	5555552	2001-01-22	t	2	
32	julio	lopez	51608268888	2001-01-22	t	2	
25	xxx	xx	888889	2001-02-20	t	2	
13	jul	men	5252524	2021-01-10	t	2	
20	mathias	franco	888555	2001-01-01	t	2	
4	cdc	cds	654	2001-12-22	t	2	
16	elias 	lopez	999999	2001-01-21	t	2	
35	xsx	cscs	324234234	2002-05-07	t	2	
36	aaaaa	aaaaa	4534543	2004-05-07	t	2	
1	julio	mendoza	5160826	1990-07-30	t	2	 bv cbv
\.


--
-- Data for Name: jugadores_equipos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jugadores_equipos (id_jugador_equipo, id_jugador, id_equipo, tipo_vinculo, estado, fecha_inicio, fecha_fin, id_torneo, observaciones, numero_camiseta, capitan) FROM stdin;
218	13	58	titular	t	2026-05-07	\N	12	\N	3	t
94	1	49	titular	t	2026-05-02	\N	3	\N	2	f
185	35	\N	\N	t	\N	\N	\N		\N	f
186	35	\N	\N	t	\N	\N	\N		\N	f
187	35	\N	\N	t	\N	\N	3		\N	f
188	36	\N	\N	t	\N	\N	\N		\N	f
189	36	\N	\N	t	\N	\N	\N		\N	f
190	36	\N	\N	f	\N	\N	3		\N	f
150	27	74	titular	t	2026-05-04	\N	3	\N	\N	f
192	18	97	titular	t	2026-05-06	\N	3	\N	\N	f
99	16	66	titular	t	2026-05-02	\N	3	\N	66	t
160	17	50	titular	t	2026-05-04	\N	3	\N	11	f
173	26	50	titular	t	2026-05-04	\N	3		10	f
145	33	50	titular	t	2026-05-04	\N	3		55	f
146	25	50	titular	t	2026-05-04	\N	3		6	f
124	20	50	titular	t	2026-05-04	\N	3		8	f
215	31	50	titular	t	2026-05-07	\N	3	\N	22	t
144	34	82	titular	t	2026-05-04	\N	3		\N	f
194	30	109	titular	t	2026-05-06	\N	8	\N	22	f
118	13	82	titular	t	2026-05-03	\N	3		\N	f
162	19	82	titular	t	2026-05-04	\N	3	\N	\N	f
142	32	82	titular	t	2026-05-04	\N	3		\N	f
174	8	82	titular	t	2026-05-04	\N	3	\N	\N	f
117	14	71	titular	t	2026-05-03	\N	6	\N	\N	f
193	1	105	titular	t	2026-05-06	\N	8		\N	f
204	27	80	titular	t	2026-05-07	\N	12	\N	22	f
158	12	75	titular	t	2026-05-04	\N	3	\N	\N	f
159	30	75	titular	t	2026-05-04	\N	3	\N	\N	f
161	18	76	titular	t	2026-05-04	\N	3	\N	\N	f
143	19	\N	titular	t	2026-05-04	\N	3		\N	f
163	28	76	titular	t	2026-05-04	\N	3	\N	\N	f
176	30	78	titular	t	2026-05-05	\N	3	\N	\N	f
209	27	112	titular	t	2026-05-07	\N	8	\N	1	f
210	12	112	titular	t	2026-05-07	\N	8	\N	22	f
208	31	112	titular	t	2026-05-07	\N	8	\N	22	t
205	31	70	titular	t	2026-05-07	\N	12	\N	1	f
212	30	70	titular	t	2026-05-07	\N	12	\N	16	f
180	29	70	titular	t	2026-05-05	\N	12	\N	25	f
206	34	70	titular	t	2026-05-07	\N	12	\N	55	f
181	33	70	titular	t	2026-05-05	\N	12	\N	58	f
213	16	70	titular	t	2026-05-07	\N	12	\N	16	f
214	36	70	titular	t	2026-05-07	\N	12	\N	21	f
211	12	70	titular	t	2026-05-07	\N	12	\N	22	t
164	12	73	titular	t	2026-05-04	\N	3	\N	\N	f
178	18	69	titular	t	2026-05-05	\N	12	\N	5	f
203	26	69	titular	t	2026-05-07	\N	12	\N	22	f
183	25	69	titular	t	2026-05-05	\N	12	\N	10	f
216	20	69	titular	t	2026-05-07	\N	12	\N	55	f
217	17	69	titular	t	2026-05-07	\N	12	\N	22	t
179	19	58	titular	t	2026-05-05	\N	12	\N	1	f
182	32	58	titular	t	2026-05-05	\N	12	\N	2	f
\.


--
-- Data for Name: partidos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.partidos (id_partido, id_torneo, equipo_a, equipo_b, fecha, hora, estado, entity_id, numero_fecha, goles_a, goles_b, observaciones, id_grupo) FROM stdin;
274	8	106	109	2026-05-09	19:30:00	finalizado	2	1	3	1	\N	26
287	3	50	78	\N	\N	programado	2	1	0	0	\N	52
288	3	82	66	\N	\N	programado	2	1	0	0	\N	52
289	3	98	83	\N	\N	programado	2	1	0	0	\N	52
290	3	97	74	\N	\N	programado	2	1	0	0	\N	52
291	3	50	66	\N	\N	programado	2	2	0	0	\N	52
292	3	78	83	\N	\N	programado	2	2	0	0	\N	52
293	3	82	74	\N	\N	programado	2	2	0	0	\N	52
294	3	98	97	\N	\N	programado	2	2	0	0	\N	52
295	3	50	83	\N	\N	programado	2	3	0	0	\N	52
296	3	66	74	\N	\N	programado	2	3	0	0	\N	52
297	3	78	97	\N	\N	programado	2	3	0	0	\N	52
298	3	82	98	\N	\N	programado	2	3	0	0	\N	52
299	3	50	74	\N	\N	programado	2	4	0	0	\N	52
300	3	83	97	\N	\N	programado	2	4	0	0	\N	52
301	3	66	98	\N	\N	programado	2	4	0	0	\N	52
302	3	78	82	\N	\N	programado	2	4	0	0	\N	52
303	3	50	97	\N	\N	programado	2	5	0	0	\N	52
304	3	74	98	\N	\N	programado	2	5	0	0	\N	52
305	3	83	82	\N	\N	programado	2	5	0	0	\N	52
306	3	66	78	\N	\N	programado	2	5	0	0	\N	52
307	3	50	98	\N	\N	programado	2	6	0	0	\N	52
308	3	97	82	\N	\N	programado	2	6	0	0	\N	52
309	3	74	78	\N	\N	programado	2	6	0	0	\N	52
310	3	83	66	\N	\N	programado	2	6	0	0	\N	52
311	3	50	82	\N	\N	programado	2	7	0	0	\N	52
279	8	109	107	\N	\N	programado	2	3	0	0	\N	26
312	3	98	78	\N	\N	programado	2	7	0	0	\N	52
313	3	97	66	\N	\N	programado	2	7	0	0	\N	52
314	3	74	83	\N	\N	programado	2	7	0	0	\N	52
329	12	114	79	\N	\N	finalizado	2	3	0	0	\N	41
282	8	105	106	\N	\N	finalizado	2	5	2	0	\N	26
275	8	107	108	2026-05-09	19:30:00	finalizado	2	1	3	3	\N	26
284	8	106	108	\N	\N	finalizado	2	1	18	0	\N	26
322	12	59	69	\N	\N	finalizado	2	4	1	0	\N	40
321	12	70	58	\N	\N	finalizado	2	4	2	3	\N	40
278	8	105	108	\N	\N	finalizado	2	3	0	3	\N	26
323	12	70	69	\N	\N	finalizado	2	5	0	1	\N	40
280	8	105	107	\N	\N	finalizado	2	4	0	0	\N	26
277	8	106	107	\N	\N	finalizado	2	2	0	0	\N	26
276	8	105	109	\N	\N	finalizado	2	2	20	0	\N	26
286	8	108	109	\N	\N	programado	2	5	0	0	\N	26
324	12	59	67	\N	\N	finalizado	2	5	0	4	\N	40
326	12	79	80	2026-05-16	17:00:00	finalizado	2	1	1	0	\N	41
316	12	58	59	2026-05-16	15:40:00	finalizado	2	1	3	2	\N	40
315	12	69	67	2026-05-16	15:00:00	finalizado	2	1	2	0	\N	40
325	12	114	81	2026-05-16	16:20:00	finalizado	2	1	3	0	\N	41
317	12	70	67	2026-05-23	15:00:00	finalizado	2	2	1	0	\N	40
318	12	69	58	2026-05-23	15:30:00	finalizado	2	2	0	2	\N	40
327	12	114	80	2026-05-23	16:00:00	finalizado	2	2	3	3	\N	41
328	12	81	79	2026-05-23	16:30:00	finalizado	2	2	2	1	\N	41
319	12	70	59	\N	\N	finalizado	2	3	2	1	\N	40
320	12	67	58	\N	\N	finalizado	2	3	0	2	\N	40
330	12	80	81	\N	\N	finalizado	2	3	2	2	\N	41
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

COPY public.torneos (id_torneo, nombre_torneo, temporada, estado, fecha_inicio, entity_id, portada) FROM stdin;
1	a1	2025	t	2026-04-16	1	\N
7	a2	2025	f	2026-04-29	2	\N
3	a2 secundario	2025	f	2026-04-15	2	\N
8	a2	a2	t	2026-04-22	2	\N
2	a2	a2	t	2026-04-08	2	\N
6	sa	2025	t	2026-04-18	4	\N
14	tarjetas 2	2026	f	2026-05-15	2	\N
13	tarjetas	2026	f	2026-05-16	2	\N
12	prueba de jugadores	2026	t	2026-04-08	2	/uploads/066ac1da13d4ca5d83c4955e39579a07
9	TORNEO A5	2026	t	2026-05-02	8	\N
10	TROENEO A5	2026 CLAUSURA	t	2026-05-08	8	\N
11	A4	2026	t	2026-05-10	9	\N
\.


--
-- Data for Name: torneos_reglas_tarjetas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.torneos_reglas_tarjetas (id_regla, id_torneo, entity_id, acumula_amarillas, amarillas_para_suspension, fechas_suspension_acumulacion, reiniciar_al_sancionar, aplicar_item_amarilla, aplicar_item_roja, created_at, updated_at) FROM stdin;
1	12	2	t	3	1	t	t	t	2026-05-07 20:58:12.341737	2026-05-07 21:02:44.762284
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id_usuario, nombre, correo, contrasena_hash, rol_id, estado, creado_en, documento, entity_id) FROM stdin;
79552bf7-8e05-4583-bc88-23c4696e69d6	Julio Mendoza	\N	$2b$12$9PtxyOevbXn41hD21wlLaO/g.DWi4CeAvpK5R/YceCM5nKDmlpDSy	99	t	2026-03-27 03:43:26.964601	5160826	\N
39b0e85c-c9f4-4bcb-be34-3a17d4d6b638	ejemplo delegado	\N	$2b$10$TadXJvc2G085RRBVFbaeSuAK3Pg1Q1xoyDzKOhpuCtg2XWUeg.1Y6	1	t	2026-04-07 19:48:29.765	444555	2
e91cfb04-d97d-463f-8a7c-6a58a2b8ef2e	ejemplo	\N	$2b$10$rIVI0l.yM.590I.W9XAzve6Tma9KqUrZsoirMWkQVjGzaGaU0gmMG	1	t	2026-04-22 18:46:59.527	555222	1
47b9bdad-d359-4832-a192-53df5f06b21e	juan	\N	$2b$10$ADoUeZ6h0iD4Q/gR8ZbajOUT1QJupIGRkVfZhoEUxGyhqv0zbKiUi	1	t	2026-04-24 00:13:30.962	888889	2
34593613-cd11-4298-9b14-d157e533edc3	JUAN	\N	$2b$10$lSS/qefsuuUSaQG.PA3DUuxWELxLAL2Bu46zDMLOTD0M1/PKq7v1u	1	t	2026-04-24 00:15:48.764	555555	2
130858d5-8077-4bea-a87e-41dbc4a76844	juan perez	\N	$2b$10$02zKDaQLoAohMK2gZx33RuKObiWkclzpmHLReCD6DhR86sMcgSw/2	1	f	2026-04-25 14:47:04.288	666666	2
d4dfc7ac-59c3-4bc9-9130-6431cdd029de	sebastian	\N	$2b$10$We.pItiVLHuQhT9jgzeMTOWkpfT7RmAb.1N9a.xRBRMvpotl1ZwSG	1	t	2026-04-27 22:45:20.086	333222	2
cda56090-2d82-4794-80ab-5a5ec7b26012	PRUEBA 	\N	$2b$10$b0b8p17d9ncuqwBkHS4Pne/KUSvo3uA.jhdOX0IpGiQdHBNBntLpC	1	t	2026-05-02 18:32:24.142	111222	2
ceba6f6e-d1c3-4d8d-a268-84a437d8e3ce	alejandro caceres	\N	$2b$10$a10YSCXSSszf/H9Q/Bfbb.kwZsw9nVfr1jyaaLvGHa6rL9YMo1Api	1	t	2026-05-04 16:47:42.846	999888	2
bc4f953f-b09c-4a4a-a0ab-a258dc384e32	JUAN	\N	$2b$10$CpTZi/Cp7s2PAr1MTjdJT.g2eUDDWDiwl2U38wMNptjloAGsnPJi.	1	t	2026-05-04 16:48:37.373	777888	2
60cda1f8-aadc-40aa-a21a-4a7e6fb1f540	ADMIN TEST	\N	$2b$10$hSAx0MtOBj5lhItfVPZGHutW7enMOzTtxTBaPKE9fzaYq7ovfAP8y	1	t	2026-05-05 20:28:56.813	12345678	1
e6315efd-3815-42c2-bd97-e356c1ba99a7	juaan perez	\N	$2b$10$Yt..0/XUqxdfW5BcVlttgO7c4zZBhMMFlc50nNmMcSuSX2yP4FDeK	1	t	2026-05-05 20:38:45.639	555222	2
\.


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auditoria_id_auditoria_seq', 1660, true);


--
-- Name: delegados_equipos_id_delegado_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delegados_equipos_id_delegado_equipo_seq', 38, true);


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

SELECT pg_catalog.setval('public.entity_entity_id_seq', 26, true);


--
-- Name: equipos_id_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.equipos_id_equipo_seq', 114, true);


--
-- Name: equipos_movimientos_grupo_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.equipos_movimientos_grupo_id_movimiento_seq', 5, true);


--
-- Name: estadisticas_id_estadistica_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.estadisticas_id_estadistica_seq', 53, true);


--
-- Name: eventos_partido_id_evento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.eventos_partido_id_evento_seq', 1, false);


--
-- Name: finanzas_id_finanza_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.finanzas_id_finanza_seq', 27, true);


--
-- Name: grupos_id_grupo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grupos_id_grupo_seq', 56, true);


--
-- Name: items_equipo_id_item_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_equipo_id_item_equipo_seq', 48, true);


--
-- Name: items_id_item_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_item_seq', 11, true);


--
-- Name: jugadores_equipos_id_jugador_equipo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.jugadores_equipos_id_jugador_equipo_seq', 218, true);


--
-- Name: jugadores_id_jugador_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.jugadores_id_jugador_seq', 36, true);


--
-- Name: partidos_id_partido_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.partidos_id_partido_seq', 330, true);


--
-- Name: resultados_id_resultado_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resultados_id_resultado_seq', 1, false);


--
-- Name: roles_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_rol_seq', 1, false);


--
-- Name: sanciones_id_sancion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sanciones_id_sancion_seq', 1, false);


--
-- Name: torneos_id_torneo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.torneos_id_torneo_seq', 14, true);


--
-- Name: torneos_reglas_tarjetas_id_regla_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.torneos_reglas_tarjetas_id_regla_seq', 4, true);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


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
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


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
-- Name: usuarios_documento_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_documento_entity_id ON public.usuarios USING btree (documento, entity_id);


--
-- Name: jugadores trg_audit_jugadores; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_jugadores AFTER INSERT OR UPDATE ON public.jugadores FOR EACH ROW EXECUTE FUNCTION public.audit_jugadores();


--
-- Name: jugadores_equipos trg_audit_jugadores_equipos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_jugadores_equipos AFTER INSERT OR UPDATE ON public.jugadores_equipos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_jugadores_equipos();


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
-- Name: items trg_items_set_context; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_set_context BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.fn_items_set_context();


--
-- Name: jugadores_equipos trg_manage_jugadores_equipos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_manage_jugadores_equipos BEFORE INSERT OR UPDATE ON public.jugadores_equipos FOR EACH ROW EXECUTE FUNCTION public.fn_manage_jugadores_equipos();


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

