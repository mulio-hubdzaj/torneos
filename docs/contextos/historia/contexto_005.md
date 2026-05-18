# Contexto 005

Fecha: 2026-05-07

## Error corregido

- Al desactivar un equipo, PostgreSQL fallaba con:
  - `parametro de configuracion app.usuario_id no reconocido`
- La DB viva aun tenia una version vieja de `public.fn_auditoria()`.
- Se reaplico `public/auditoria_detalle_simple_20260507.sql`.
- Se verifico que `fn_auditoria()` usa `current_setting('app.usuario_id', true)`.
- Se probo un `UPDATE equipos` dentro de transaccion con `ROLLBACK`.

## Desactivacion de equipos

- `controllers/equipoController.js`
  - `toggle` ahora revisa si el equipo a desactivar tiene partidos no finalizados en su grupo.
  - Si tiene partidos y no viene confirmacion, no desactiva y muestra aviso.
  - Si viene `confirmar_desactivacion = 1`, permite desactivar.

- `views/torneos/index.ejs`
  - El switch de equipos muestra confirmacion si el equipo tiene encuentros pendientes.
  - Mensaje:
    - `Este equipo tiene cargados partidos en curso, pendientes o en proceso. Desea desactivar?`
    - `Los encuentros quedaran disparejos para el equipo contrario en cada fecha.`
  - En partidos, si un equipo esta inactivo, la fila queda gris y junto al equipo aparece:
    - `inhabilitada`
  - En grupos, el equipo desactivado sigue visible como:
    - `Equipo inactivo - deshabilitada`

## Verificaciones

- `node --check controllers/equipoController.js`
- `node --check controllers/torneoController.js`
- `node --check index.js`
- Compilacion EJS de `views/torneos/index.ejs`
- `npm.cmd test`

## Regla de eliminacion de equipos

- `controllers/equipoController.js`
  - `eliminar` ya no borra equipos que tengan cualquier partido alineado en el fixture.
  - La validacion mira `partidos.equipo_a` y `partidos.equipo_b`, sin importar si el partido esta programado, pendiente, en proceso, suspendido o finalizado.
  - Mensaje:
    - `No se puede eliminar equipo ya que cuenta con encuentros alineados, puede ir a equipos y desactivarlo sin borrar el Historial`
- Verificado con `DDD` del torneo 8:
  - `id_equipo = 108`
  - `partidosAlineados = 4`
  - `bloqueado = true`

## Ajustes de vista

- Al eliminar un equipo desde la pestana Grupos, el formulario envia `redirect_hash = #grupos`.
- `controllers/equipoController.js` usa `redirect_hash` para volver a la misma pestana despues de bloquear o completar la eliminacion.
- En Estadisticas se elimino la segunda grilla de "Vista por grupo".
- Ahora la misma tabla renderiza:
  - `estadisticasGeneral` cuando el filtro esta en Vista general.
  - `estadisticasFiltradas` cuando se selecciona un grupo.
- La grilla de estadisticas muestra posicion, icono del equipo y nombre en una sola celda.
- `calcularTablaPosiciones` ahora incluye `icono` con fallback `/images/default_team.png`.

## Portada de torneo

- DB:
  - La columna `public.torneos.portada varchar(255)` ya existe.
- `models/Torneo.js`
  - Se agrego el campo `portada`.
- `controllers/torneoController.js`
  - `actualizarPortada` guarda la ruta publica `/uploads/<archivo>`.
  - `eliminarPortada` deja `portada = null`.
- `routes/torneoRoutes.js`
  - `POST /torneos/:id_torneo/portada`
  - `POST /torneos/:id_torneo/portada/eliminar`
  - Se usa `multer` con destino `public/uploads/`.
- `views/torneos/index.ejs`
  - En Estadisticas se agrego el boton `Personalizar torneo`.
  - El modal permite subir portada o eliminarla si existe.
  - Si el torneo tiene portada, se muestra arriba de la tabla de posiciones.
  - Si no tiene portada, la vista queda como estaba.
