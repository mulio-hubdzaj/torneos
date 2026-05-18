# Contexto 019

Fecha: 2026-05-14

## Estado acordado

- La copia SQL ubicada en `public` es momentanea y no se dejara ahi en un ambiente real.
- La auditoria principal debe trabajar desde triggers de PostgreSQL.
- No se debe modificar/enriquecer auditoria desde controllers como post-proceso.
- El rol `Delegado` no debe asignarse desde la pestana `Usuarios`.
- Un usuario es delegado solo si queda vinculado a un equipo desde administracion de equipo.
- Si un usuario deja de ser delegado, no debe conservar vinculos activos en `delegados_equipos`.

## Verificacion de contextos y backup DB

- Contextos existentes:
  - `public/historia/contexto_001.md` a `contexto_010.md`
  - `public/contexto_011.md` a `contexto_018.md`
- Backup revisado:
  - `public/torneo_20260514_1516.sql`
  - tipo: dump PostgreSQL
  - lineas: 3766
  - SHA256: `659502B7D80F3AD3E70E468D575AE1BC809D2479441509321E350829AC7C924D`
  - finaliza con `PostgreSQL database dump complete`
- Se confirmo que el dump incluye:
  - tabla `torneos.permitir_agregar_jugadores`
  - datos de tablas principales
  - triggers de auditoria
  - indice unico por correo + entidad:
    - `usuarios_correo_entity_id_key`

## Auditoria de cambio de permisos

Caso reportado:

- Documento `444555` fue cambiado a administrador.
- El usuario no lo veia claramente en auditoria.

Hallazgo:

- La fila existia:
  - `id_auditoria = 2134`
  - `tabla_afectada = usuarios`
  - `accion = UPDATE`
  - `detalle = Se cambio rol de 1 a 3`
  - `entity_id = 2`
- El problema era que el detalle generado por trigger no incluia usuario/documento afectado.

Decision:

- No enriquecer auditoria desde controller.
- Revertir el post-proceso que se habia probado en `controllers/torneoController.js`.
- La mejora debe aplicarse en DB, ajustando `public.fn_auditoria_detalle_simple(...)`.

SQL sugerido pendiente:

```sql
CREATE OR REPLACE FUNCTION public.fn_auditoria_detalle_simple(
  p_tabla text,
  p_accion text,
  p_old jsonb,
  p_new jsonb
)
RETURNS text
LANGUAGE plpgsql
AS $function$
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
$function$;
```

## Controversia rol delegado vs vinculo de equipo

Caso reportado:

- Documento `999888` fue pasado a espectador desde pestana `Usuarios`.
- Seguía apareciendo como delegado del equipo `B`.

Hallazgo en DB:

- En entidad 2:
  - usuario `ALEJANDRO CACERES`
  - documento `999888`
  - `rol_id = 1`
  - tenia vinculo activo en `delegados_equipos` con equipo `B`
- Tambien existe otro usuario con documento `999888` en entidad 27, sin relacion con este caso.

Decision funcional:

- `rol_id = 2` no debe asignarse directamente desde `Usuarios`.
- La asignacion de delegado debe hacerse desde administracion de equipo.
- Al vincular delegado a equipo:
  - se crea registro en `delegados_equipos`;
  - la app actualiza el usuario a `rol_id = 2`.
- Al desvincular delegado desde equipo:
  - se elimina el vinculo;
  - si ya no tiene vinculos activos, vuelve a `rol_id = 1`.
- Al cambiar desde `Usuarios` a cualquier rol distinto de delegado:
  - se eliminan sus vinculos como delegado en la entidad.

Cambios aplicados:

- `controllers/torneoController.js`
  - se agrego `desvincularDelegadoUsuarioEnEntidad(idUsuario, entityId)`.
  - en `cambiarPermisosUsuario`, si `nuevoRol !== 2`, elimina los vinculos del usuario en `delegados_equipos` para esa entidad.
  - backend ya no permite asignar `rol_id = 2` desde Usuarios:
    - super admin: `[1, 3, 99]`
    - admin: `[1, 3]`
- `views/torneos/index.ejs`
  - selector `Cambiar permisos` ya no muestra opcion `Delegado`.
  - filtro por roles si muestra `Delegado`, para poder buscar usuarios que son delegados por vinculo.

Correccion de datos aplicada:

- Se elimino de `delegados_equipos` el vinculo activo de `999888` con equipo `B` en entidad 2.
- Se verifico luego:
  - `999888` en entidad 2 queda como `rol_id = 1`.
  - no quedan vinculos en `delegados_equipos` para documento `999888`.
- Se registro auditoria:
  - `id_auditoria = 2143`
  - `tabla_afectada = delegados_equipos`
  - `accion = DELETE`

## Alertas internas de la app

Cambio solicitado:

- Reemplazar alerta nativa del navegador:
  - `Cambiar permisos de este usuario?`
- Usar modal/alerta propia de la app.

Cambios aplicados:

- `views/torneos/index.ejs`
  - el form de cambio de permisos usa:
    - `onsubmit="confirmarCambioPermisosUsuario(event)"`
  - se agrego funcion JS:
    - `confirmarCambioPermisosUsuario(event)`
  - usa `confirmarApp(...)`.
  - mensaje:
    - `El usuario pasara a ...`
  - titulo:
    - `Cambiar permisos`
  - botones:
    - `Cambiar permisos`
    - `Cancelar`

## Verificaciones realizadas

- `node --check controllers\torneoController.js`
- `npm.cmd test`

Resultado de tests:

```txt
No hay tests definidos
```

## Pendientes actuales

### Aplicar SQL de auditoria en DB

- Aplicar el ajuste de `public.fn_auditoria_detalle_simple(...)` para que los cambios de rol en usuarios incluyan usuario/documento afectado desde el trigger.

### Probar en navegador

- Desde Usuarios:
  - confirmar que no aparece la opcion `Delegado` en `Cambiar permisos`;
  - confirmar que el filtro por rol si permite `Delegado`;
  - intentar manipular POST con `rol_id=2` y verificar que backend lo bloquea.
- Desde administracion de equipo:
  - asignar delegado;
  - verificar que se crea vinculo y cambia a `rol_id=2`;
  - desvincular delegado;
  - verificar que queda como espectador si no tiene otros vinculos activos.
- Auditoria:
  - luego de aplicar SQL, cambiar permisos de un usuario y confirmar detalle legible con documento.

## Archivos tocados en esta tanda

- `controllers/torneoController.js`
- `views/torneos/index.ejs`
- `public/contexto_019.md`
