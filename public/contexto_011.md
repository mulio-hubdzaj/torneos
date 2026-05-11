# Contexto 011

Fecha: 2026-05-08

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde la app/codigo sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de BD; `registrarAuditoria` sigue neutralizado para el flujo normal.
- `rol_id = 99` sigue siendo super admin.

## Tarjetas, sanciones y acumulacion

- En el modal de carga por equipo/partido:
  - si un jugador queda a una tarjeta del limite, el acumulado se marca en rojo;
  - si alcanza el limite, se pide decision al guardar:
    - `SI`: confirma suspension, carga/bloquea `Susp. Fechas`, registra sancion, desactiva el vinculo `jugadores_equipos.estado = false` y reinicia conteo;
    - `NO`: registra advertencia con `0` fechas en `sanciones`, no desactiva el jugador y reinicia conteo desde ese punto.
- Cualquier registro en `sanciones` del torneo funciona como punto de reinicio si `reiniciar_al_sancionar` esta activo.
- Los mensajes del circuito de limite/acumulacion se muestran en rojo y negrita.
- Los mensajes normales del modal interno quedan en negro para evitar texto invisible.

## Modal de carga por encuentro

- En el resumen superior del modal se ajustaron etiquetas en negro/negrita:
  - `Deuda anterior`
  - `Total items`
  - `Entrega del delegado`
  - `Saldo`
- En el modal de `Nuevo item`, las etiquetas quedaron en negro/negrita:
  - `Nombre`
  - `Descripcion`
  - `Monto`

## Finanzas

- Se creo una seccion real para la pestana `Finanzas`.
- La grilla principal muestra todos los equipos del torneo.
- Si un equipo adeuda, muestra alerta roja `‼️‼️`.
- En vista usuario se ocultan:
  - `Saldo actual`
  - boton/columna `Detalles`
- Tiene botones:
  - `Vista usuario`
  - `Habilitar admin`
- Se agrego modal `Detalle financiero`:
  - total items/gastos;
  - entregas en efectivo;
  - deuda actual;
  - detalle por fecha/movimiento;
  - items de cada movimiento.
- En el detalle financiero, la primera columna muestra:
  - `Fecha N`
  - grupo/fase correspondiente, por ejemplo `A`, `A - Ida`, `A - Vuelta`, `Cuartos`, `Semi`, `Final`;
  - fecha calendario `dd/mm/aaaa`.
- Se agrego endpoint JSON:
  - `GET /torneos/:id_torneo/finanzas/resumen`
- Despues de guardar carga desde Partidos, Finanzas se sincroniza desde la DB sin recargar navegador.

## Estadisticas

- La pestana `Estadisticas` ahora tiene subpestanas:
  - `Tabla de posiciones`: conserva la vista actual;
  - `Ranking de goles`: muestra jugadores con mas goles del torneo.
- Ranking de goles usa columnas:
  - `Nombre`
  - `Equipo actual`
  - `Goles marcados`
- El ranking se consulta desde `estadisticas`, agrupando goles por jugador dentro del torneo.

## Partidos y fechas

- El filtro por grupo de Partidos se conserva al eliminar encuentros y al crear cruces manuales.
- Al eliminar un encuentro desde una fecha, se vuelve a la misma pestana de fecha usando `?fecha=N#partidos`.
- Las fechas intermedias vacias siguen renderizando:
  - si se eliminan todos los partidos de Fecha 2, la UI ya no salta de Fecha 1 a Fecha 3;
  - queda visible como fecha vacia con mensaje para agregar cruces manuales.
- Se agrego boton `Agregar fecha`:
  - abre `Cruce manual` apuntando a la siguiente fecha disponible;
  - la fecha adicional se crea al cargar el primer cruce.
- Se agrego boton `Eliminar fecha`:
  - elimina todos los encuentros de esa fecha si ninguno esta finalizado;
  - se bloquea en UI si existe un partido finalizado;
  - se bloquea tambien en backend con validacion por SQL normalizando estado con `LOWER(TRIM(...))`.
- La eliminacion de fecha revisa toda la fecha del torneo para detectar finalizados.
- Si se esta filtrando por grupo, la eliminacion aplica el filtro para borrar solo los encuentros visibles del grupo, pero la existencia de cualquier finalizado en esa fecha del torneo bloquea la eliminacion.

## Archivos principales modificados

- `views/torneos/index.ejs`
- `controllers/torneoController.js`
- `controllers/partidoController.js`
- `routes/torneoRoutes.js`
- `routes/partidoRoutes.js`

## Verificaciones usadas

- `node --check controllers/partidoController.js`
- `node --check controllers/torneoController.js`
- `node --check routes/partidoRoutes.js`
- `node --check routes/torneoRoutes.js`
- Compilacion EJS de `views/torneos/index.ejs`
- `npm.cmd test`
  - actualmente solo muestra `No hay tests definidos`.

## Pendientes recomendados

- Probar en navegador:
  - eliminar encuentro desde Fecha 6 y confirmar que queda en Fecha 6;
  - eliminar una fecha sin finalizados;
  - intentar eliminar una fecha con finalizados y confirmar bloqueo;
  - agregar fecha adicional con cruce manual;
  - guardar carga desde Partidos y verificar Finanzas sin recargar.
- Si se necesita conservar fechas vacias incluso despues de eliminar la ultima fecha, evaluar crear una tabla formal de calendario/fechas del torneo.
- Si Finanzas requiere historial mas fino por item, reemplazar el borrado/reinsercion de `items_equipo` por update/insert conservando `fecha_registro` original.
