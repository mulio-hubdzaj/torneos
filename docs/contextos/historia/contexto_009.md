# Contexto 009

Fecha: 2026-05-08

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL mas reciente de referencia es:
  - `public/torneo_20260508_1024.sql`
- No se aplican cambios directos a DB desde la app/codigo sin pasarlos primero al usuario.
- `rol_id = 99` sigue siendo super admin.
- Auditoria principal por triggers de BD; `registrarAuditoria` sigue deshabilitado.

## Estadisticas / tabla de posiciones

- Se corrigio que al guardar marcador por `fetch` la grilla de Estadisticas quedara vieja hasta recargar.
- La vista recalcula la tabla de posiciones en cliente cuando:
  - se guarda marcador;
  - se cambia estado del partido.
- Se agregaron `data-*` al marcador para recalcular:
  - equipo A/B;
  - goles;
  - estado;
  - grupo.
- La tabla de Estadisticas ahora tiene `tbody#estadisticasTbody` y metadata por equipo.

## Tarjetas acumuladas y sanciones

- La regla de tarjetas sigue en `torneos_reglas_tarjetas`.
- Se confirmo contra DB actual que:
  - `sanciones.fecha_inicio` es `integer`.
  - La app debe guardar ahi la `numero_fecha`, no `CURRENT_DATE`.
- Al cargar tarjetas en el modal por equipo/partido:
  - se calcula acumulado de amarillas por torneo;
  - si llega al limite configurado, se propone sancion;
  - si el admin confirma, se inserta en `sanciones`;
  - ademas se actualiza el vinculo del jugador:
    - `jugadores_equipos.estado = false`;
    - `jugadores_equipos.observaciones = 'Suspension por acumulacion de amarillas (x/y)'`.
- No se toca `jugadores.estado` global.
- La rehabilitacion manual del admin desde Jugadores solo vuelve a activar `jugadores_equipos.estado = true`.
- Si `reiniciar_al_sancionar` esta activo, el conteo se reinicia desde la sancion registrada, no desde la rehabilitacion manual.

## Caso verificado

- Documento `55554`, jugador `joel lopez`, torneo `12`.
- Se verifico que la sancion quedo registrada en `sanciones`.
- Se detecto que el bloqueo del modal no debia depender solo de `sanciones.partidos_restantes`.
- Se ajusto para que el modal bloquee la carga del jugador solo si el vinculo actual `jugadores_equipos.estado` esta `false`.
- Si el admin habilita el jugador desde Jugadores, el modal vuelve a permitir cargar goles, tarjetas e items aunque exista historial en `sanciones`.

## Actualizacion visual sin recargar

- Al confirmar una sancion desde el modal de carga, la pestaña Jugadores se actualiza en caliente:
  - apaga el switch;
  - pinta la fila;
  - coloca la observacion;
  - marca el equipo como `(Inactivo)`.
- Antes esto solo se veia al recargar la pagina.

## Avisos internos de la app

- Se agrego modal interno Bootstrap reutilizable:
  - `mostrarAvisoApp(mensaje, titulo)`
  - `confirmarApp(mensaje, titulo)`
- El circuito de carga/sancion ya no depende de `alert()` / `confirm()` del navegador.
- Todavia quedan otros `alert/confirm` viejos en otras partes de `index.ejs`:
  - sorteo;
  - cruce manual;
  - eliminar items;
  - validar mudanza de equipo;
  - eliminaciones varias.

## Items y finanzas en carga de partido

- Se corrigio la fila vacia tipo `Seleccionar item` que aparecia en automatico.
- El backend ya no trae `items_equipo` con `nombre` vacio.
- El frontend ya no envia filas sin item seleccionado.
- Se agrego columna `Agregado` para mostrar `items_equipo.fecha_registro`.
- Formato mostrado:
  - `DD/MM/YYYY HH24:MI`
- Nota importante:
  - el guardado actual borra y reinserta todos los items del partido;
  - por eso `fecha_registro` refleja la ultima vez que se guardo la carga completa;
  - si se quiere conservar fecha original por item individual, hay que cambiar el guardado a update por `id_item_equipo`.

## Buscador en modal de carga de jugadores

- En el modal `modalCargaEquipoPartido`, pestaña Jugadores, se agrego buscador arriba de la tabla.
- Busca en las filas visibles por coincidencia:
  - nombre;
  - apellido;
  - documento;
  - numero de camiseta con o sin `#`.
- Tiene campo de texto y boton con lupa.
- Enter aplica busqueda.
- Al borrar texto se muestran todos.
- Al abrir otro partido se limpia el buscador.

## Archivos principales modificados

- `controllers/partidoController.js`
- `controllers/torneoController.js`
- `controllers/equipoController.js`
- `views/torneos/index.ejs`
- `views/equipos/administrar.ejs`

## Verificaciones usadas

- `node --check controllers/partidoController.js`
- `node --check controllers/torneoController.js`
- `node --check controllers/equipoController.js`
- Compilacion EJS:
  - `views/torneos/index.ejs`
  - `views/equipos/administrar.ejs`
- `npm.cmd test`
  - Actualmente solo muestra `No hay tests definidos`.

## Pendientes recomendados

- Probar en navegador el circuito completo:
  - cargar tarjeta que llega al limite;
  - confirmar sancion;
  - verificar pestaña Jugadores sin recargar;
  - rehabilitar jugador desde Jugadores;
  - verificar que el siguiente partido permita cargarlo.
- Migrar los `alert/confirm` restantes a `mostrarAvisoApp` / `confirmarApp`.
- Definir si `partidos_restantes` debe decrementar automaticamente o si el admin controlara la rehabilitacion manual.
- Si se requiere historial mas fino de items, reemplazar delete/insert de `items_equipo` por update/insert conservando `fecha_registro` original.
