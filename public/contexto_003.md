# Contexto 003

Fecha: 2026-05-06

## Estado acordado

- `rol_id = 99` sigue siendo `super admin`.
- `super admin` no requiere `entity_id` al login.
- Para escrituras, `entity_id` se resuelve por contexto.
- No tocar la logica de jugadores salvo pedido explicito.

## Trabajo realizado

- Se corrigio la administracion de jugadores por equipo:
  - El formulario de "Guardar cambios" ya no envuelve formularios de desvincular jugadores.
  - Se corrigio que el primer/ultimo jugador no pudiera desvincularse por HTML invalido.
  - La asignacion de jugadores ahora permite uno o varios seleccionados.
  - La asignacion reutiliza vinculos libres/desactivados o huerfanos cuando corresponde.
  - La desvinculacion usa `id_equipo`, `id_jugador` e `id_torneo`.

- Se corrigio la asignacion de capitan:
  - Se agrego `capitan` al modelo `JugadorEquipo`.
  - Al guardar jugadores de un equipo, primero se actualizan camisetas.
  - Luego se pone `capitan = false` para todos los jugadores del equipo.
  - Finalmente se marca como `capitan = true` solo el seleccionado.
  - Se verifico con rollback que queda exactamente un capitan por equipo.

- Se agrego historial de movimientos de equipos entre grupos:
  - Nueva tabla aplicada en DB: `public.equipos_movimientos_grupo`.
  - Nuevo modelo local: `models/EquipoMovimientoGrupo.js`.
  - Modelo registrado en `models/index.js`.
  - Nueva ruta: `POST /equipos/validarMudanza`.
  - En `views/torneos/index.ejs` se agrego validacion previa con `alert/confirm`.
  - Si el equipo ya existe en el mismo grupo, se bloquea.
  - Si el equipo existe en otro grupo, se pide confirmacion.
  - La mudanza conserva el mismo `id_equipo`, por lo tanto conserva icono, jugadores y delegados.
  - Si el grupo origen tenia partidos/puntos, se crea historial y se muestra:
    - `Pasó a otro grupo/fase`
  - Si el grupo origen no tenia partidos, la mudanza es limpia y no deja historial visible.

- Se limpio un registro incorrecto:
  - `AAA` habia generado historial al moverse desde `CUARTOS` a `B` con `0` partidos en origen.
  - Ese registro fue eliminado.
  - Quedo el caso correcto de `BBB`, que tenia partidos en origen.

- Se corrigio parcialmente el problema de `back`:
  - En `controllers/grupoController.js`, el eliminador de grupos ya no usa `res.redirect("back")`.
  - Ahora usa `referer` con fallback.
  - Esto corrige el error `Cannot GET /grupos/eliminar/back` para grupos.

## SQL aplicado

- Se creo `public.equipos_movimientos_grupo`.
- Se creo `public.fn_equipos_movimientos_grupo_auditoria()`.
- Se creo el trigger:
  - `trg_equipos_movimientos_grupo_auditoria`

## Verificaciones hechas

- `node --check controllers/equipoController.js`
- `node --check controllers/grupoController.js`
- `node --check controllers/torneoController.js`
- `node --check models/index.js`
- `node --check models/EquipoMovimientoGrupo.js`
- `npm.cmd test`
- Pruebas con rollback para:
  - movimiento de equipo conservando `id_equipo`;
  - historial de movimiento;
  - capitan unico por equipo.

## Auditoria

- Se verifico contra la DB viva que `items` si tiene triggers:
  - `trg_items_auditoria`
  - `trg_items_set_context`
- Segun la DB viva, tienen trigger:
  - `delegados_equipos`
  - `entity`
  - `equipos`
  - `estadisticas`
  - `finanzas`
  - `grupos`
  - `items`
  - `jugadores`
  - `jugadores_equipos`
  - `torneos`
- No aparecen con trigger directo:
  - `partidos`
  - `usuarios`
  - `roles`
- `registrarAuditoria` sigue deshabilitado porque se prefiere auditoria por triggers.

## Pendiente para la proxima sesion

- Corregir/revisar el trigger de movimientos de equipos entre grupos:
  - `public.fn_equipos_movimientos_grupo_auditoria()`
  - `trg_equipos_movimientos_grupo_auditoria`
- Revisar que el detalle de auditoria del movimiento quede claro:
  - equipo
  - grupo origen
  - grupo destino
  - usuario
  - documento
  - observacion tipo: `Se cambio de grupo A a Cuartos`
- Cambiar los `res.redirect('back')` restantes en `routes/torneoRoutes.js`.
- Si se decide, estandarizar alertas/confirmaciones visuales en vez de usar dialogs nativos del navegador.
