# Contexto 004

Fecha: 2026-05-07

## Auditoria simplificada

- Se evaluaron los registros actuales de `public.auditoria`.
- Los registros existentes siguen con `detalle` cargado como JSON completo.
- No se reescribio el historico para no alterar evidencia ya registrada.

## Cambio aplicado

- Se agrego y aplico `public/auditoria_detalle_simple_20260507.sql`.
- La columna `detalle` sigue siendo `jsonb`, pero los nuevos registros guardan un string JSON simple.
- Ejemplos esperados:
  - `Se movio de grupo A a grupo B`
  - `Se cambio nombre de AAA a BBB`
  - `Se creo equipos: SECU`
  - `Se elimino grupos: OFF`

## Funciones reemplazadas

- `public.fn_auditoria()`
- `public.fn_items_auditoria()`
- `public.fn_equipos_movimientos_grupo_auditoria()`
- `public.fn_auditoria_torneos()`
- `public.audit_jugadores()`
- `public.fn_audit_jugadores_equipos()`

## Verificacion

- Se probo el SQL completo dentro de una transaccion con `ROLLBACK`.
- Luego se aplico en la DB viva.
- Se hizo una prueba real de `UPDATE equipos` dentro de transaccion y se revirtio.
- El detalle generado fue:
  - `Se cambio nombre de SECU a SECU TEST_AUD`

## Nota

- Los registros viejos pueden normalizarse despues con un script de backfill, si se decide que el historico tambien debe verse simple.
