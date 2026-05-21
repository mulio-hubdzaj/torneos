-- Mejora auditoria futura de items_equipo para incluir el equipo afectado.
-- No reescribe auditoria vieja.

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
  v_usuario_afectado text;
  v_rol_anterior text;
  v_rol_nuevo text;
  v_equipo text;
  v_usuario text;
  v_documento text;
  v_torneo text;
  v_item text;
BEGIN
  v_registro := COALESCE(p_new, p_old);

  IF p_tabla = 'items_equipo' THEN
    SELECT NULLIF(e.nombre, '')
    INTO v_equipo
    FROM public.equipos e
    WHERE e.id_equipo = NULLIF(v_registro->>'id_equipo', '')::integer;

    v_item := NULLIF(v_registro->>'nombre', '');

    IF p_accion = 'INSERT' THEN
      RETURN 'items_equipo: '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || '; Se cargo item '
        || COALESCE(v_item, 'item')
        || ' al equipo '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'));
    END IF;

    IF p_accion = 'DELETE' THEN
      RETURN 'items_equipo: '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || '; Se elimino item '
        || COALESCE(v_item, 'item')
        || ' del equipo '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'));
    END IF;
  END IF;

  IF p_tabla = 'delegados_equipos' THEN
    SELECT
      NULLIF(trim(concat_ws(' ', u.nombre)), ''),
      NULLIF(u.documento, ''),
      NULLIF(e.nombre, ''),
      NULLIF(t.nombre_torneo, '')
    INTO v_usuario, v_documento, v_equipo, v_torneo
    FROM (SELECT v_registro AS r) base
    LEFT JOIN public.usuarios u
      ON u.id_usuario = NULLIF(base.r->>'id_usuario', '')::uuid
    LEFT JOIN public.equipos e
      ON e.id_equipo = NULLIF(base.r->>'id_equipo', '')::integer
    LEFT JOIN public.torneos t
      ON t.id_torneo = e.id_torneo;

    IF p_accion = 'INSERT' THEN
      RETURN 'delegados_equipos: '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || '; Se asigno delegado '
        || COALESCE(v_usuario, 'usuario ' || COALESCE(v_registro->>'id_usuario', '-'))
        || CASE WHEN v_documento IS NOT NULL THEN ' (' || v_documento || ')' ELSE '' END
        || ' al equipo '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || CASE WHEN v_torneo IS NOT NULL THEN ' en torneo ' || v_torneo ELSE '' END;
    END IF;

    IF p_accion = 'DELETE' THEN
      RETURN 'delegados_equipos: '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || '; Se quito delegado '
        || COALESCE(v_usuario, 'usuario ' || COALESCE(v_registro->>'id_usuario', '-'))
        || CASE WHEN v_documento IS NOT NULL THEN ' (' || v_documento || ')' ELSE '' END
        || ' del equipo '
        || COALESCE(v_equipo, 'equipo #' || COALESCE(v_registro->>'id_equipo', '-'))
        || CASE WHEN v_torneo IS NOT NULL THEN ' en torneo ' || v_torneo ELSE '' END;
    END IF;
  END IF;

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

      RETURN 'equipos: ' || public.fn_auditoria_nombre_registro('equipos', p_new)
        || '; Se movio de grupo '
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

    IF p_tabla = 'equipos' AND v_detalle IS NOT NULL THEN
      RETURN 'equipos: ' || public.fn_auditoria_nombre_registro('equipos', p_new) || '; ' || v_detalle;
    END IF;

    RETURN COALESCE(v_detalle, 'Se actualizo ' || p_tabla || ': ' || public.fn_auditoria_nombre_registro(p_tabla, v_registro));
  END IF;

  RETURN 'Se registro accion ' || p_accion || ' en ' || p_tabla;
END;
$$;
