-- Auditoria jugadores_equipos: registrar solo altas y bajas de jugadores.
-- Objetivo:
-- - INSERT: registra cuando se asigna/agrega un jugador al equipo.
-- - DELETE: registra cuando se desvincula/quita un jugador del equipo.
-- - UPDATE: no registra cambios de numero de camiseta, capitan, estado u otros ajustes internos.
-- - Detalle: muestra jugador/documento, equipo y torneo para que no quede como "registro".

CREATE OR REPLACE FUNCTION public.fn_audit_jugadores_equipos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
  v_jugador text;
  v_documento text;
  v_equipo text;
  v_torneo text;
  v_detalle text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END;
  v_registro := COALESCE(v_new, v_old);

  SELECT j.entity_id INTO v_entity_id
  FROM public.jugadores j
  WHERE j.id_jugador = NULLIF(v_registro->>'id_jugador', '')::integer;

  v_entity_id := COALESCE(v_entity_id, NULLIF(current_setting('app.entity_id', true), '')::integer);
  v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::uuid;

  SELECT
    NULLIF(trim(concat_ws(' ', j.nombre, j.apellido)), ''),
    NULLIF(j.documento, ''),
    NULLIF(e.nombre, ''),
    NULLIF(t.nombre_torneo, '')
  INTO v_jugador, v_documento, v_equipo, v_torneo
  FROM (SELECT v_registro AS r) base
  LEFT JOIN public.jugadores j
    ON j.id_jugador = NULLIF(base.r->>'id_jugador', '')::integer
  LEFT JOIN public.equipos e
    ON e.id_equipo = NULLIF(base.r->>'id_equipo', '')::integer
  LEFT JOIN public.torneos t
    ON t.id_torneo = NULLIF(base.r->>'id_torneo', '')::integer;

  IF TG_OP = 'INSERT' THEN
    v_detalle := 'Se asigno jugador '
      || COALESCE(v_jugador, 'ID ' || COALESCE(v_registro->>'id_jugador', '-'))
      || CASE WHEN v_documento IS NOT NULL THEN ' (' || v_documento || ')' ELSE '' END
      || ' al equipo '
      || COALESCE(v_equipo, 'ID ' || COALESCE(v_registro->>'id_equipo', '-'))
      || CASE WHEN v_torneo IS NOT NULL THEN ' en torneo ' || v_torneo ELSE '' END;
  ELSE
    v_detalle := 'Se quito jugador '
      || COALESCE(v_jugador, 'ID ' || COALESCE(v_registro->>'id_jugador', '-'))
      || CASE WHEN v_documento IS NOT NULL THEN ' (' || v_documento || ')' ELSE '' END
      || ' del equipo '
      || COALESCE(v_equipo, 'ID ' || COALESCE(v_registro->>'id_equipo', '-'))
      || CASE WHEN v_torneo IS NOT NULL THEN ' en torneo ' || v_torneo ELSE '' END;
  END IF;

  INSERT INTO public.auditoria(id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
  VALUES (
    v_usuario,
    TG_OP,
    'jugadores_equipos',
    to_jsonb(v_detalle),
    now(),
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
