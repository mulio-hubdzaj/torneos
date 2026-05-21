-- Evita que el sorteo de fixture genere una fila de auditoria por cada partido.
-- La app setea app.omitir_auditoria_partidos_insert = '1' solo dentro de la
-- transaccion del sorteo y luego inserta un resumen unico manualmente.

CREATE OR REPLACE FUNCTION public.fn_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_registro jsonb;
  v_entity_id integer;
  v_usuario uuid;
BEGIN
  IF TG_TABLE_NAME = 'partidos'
     AND TG_OP = 'INSERT'
     AND current_setting('app.omitir_auditoria_partidos_insert', true) = '1' THEN
    RETURN NEW;
  END IF;

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
$function$;
