# Contexto 006

Fecha: 2026-05-07

## Portada de torneo

- La columna `public.torneos.portada` ya existe en la DB.
- `models/Torneo.js` incluye el campo `portada`.
- Se agregaron rutas:
  - `POST /torneos/:id_torneo/portada`
  - `POST /torneos/:id_torneo/portada/eliminar`
- La subida usa `multer` con destino `public/uploads/`.
- En la pestana Torneos, cada torneo tiene boton `Personalizar`.
- El modal permite subir portada o eliminarla.
- Si hay portada:
  - Se muestra arriba de Estadisticas.
  - Se muestra arriba de Partidos.
- La portada queda compacta:
  - `max-width: 860px`
  - `max-height: 260px`
  - `object-fit: contain`

## Estadisticas

- Se corrigio la doble grilla al filtrar por grupo.
- Ahora una sola tabla renderiza:
  - vista general;
  - o grupo seleccionado.
- La grilla muestra posicion, icono del equipo y nombre.

## Partidos

- Se agrego filtro por grupo arriba del titulo `Partidos`.
- El filtro usa `grupo_id` en la URL y vuelve a `#partidos`.
- El controlador arma `partidosPorFecha` usando solo el grupo filtrado cuando corresponde.
- `Cruce manual` se movio encima de `Guardar cambios`.
- Se agrego modo `Vista usuario` con boton de ojo.
- Se agrego boton `Habilitar admin`.
- En vista usuario se ocultan:
  - formulario de fecha/hora/intervalo;
  - cruce manual;
  - guardar cambios;
  - columna acciones;
  - select administrativo de estado.
- En vista usuario quedan visibles:
  - portada;
  - fechas;
  - equipos;
  - marcador;
  - grupo;
  - fecha;
  - hora;
  - estado como texto.
- El modo de Partidos se persiste en `localStorage` como `partidosVistaModo`.

## Jugadores

- Se agrego espacio superior para que la pestana no quede pegada a la barra.
- Se corrigio el ancho del panel para que quede paralelo a la grilla.
- El buscador quedo como un solo campo:
  - `nombre - documento - equipo`
- El filtro busca por:
  - nombre;
  - apellido;
  - documento;
  - equipo.
- Se agrego boton de lupa para aplicar busqueda.
- Tambien busca con Enter.
- Se agrego visualizacion de:
  - numero de camiseta `#n`;
  - capitan con badge `c`.
- Se agrego modo `Vista usuario` con boton de ojo.
- Se agrego boton `Habilitar admin`.
- En vista usuario de Jugadores se ocultan solo opciones administrativas:
  - boton Nuevo;
  - columna Estado;
  - columna Acciones;
  - boton editar.
- En vista usuario quedan visibles:
  - buscador;
  - datos del jugador;
  - equipo;
  - camiseta;
  - capitan.
- El modo de Jugadores se persiste en `localStorage` como `jugadoresVistaModo`.

## Equipos / Administrar equipo

- Se agrego espacio superior en la pestana Equipos.
- Se corrigio `views/equipos/administrar.ejs` para que no herede el layout global centrado:
  - `body.bg-stadium` vuelve a `display: block`;
  - se agrega padding superior;
  - el card no queda limitado a `max-width: 400px`;
  - tabla de jugadores dentro de `table-responsive`.

## Eliminacion / desactivacion de equipos

- La eliminacion de equipo se bloquea si aparece en cualquier partido del fixture.
- Mensaje:
  - `No se puede eliminar equipo ya que cuenta con encuentros alineados, puede ir a equipos y desactivarlo sin borrar el Historial`
- Al eliminar desde Grupos se mantiene la pestana `#grupos`.
- Al desactivar un equipo con partidos pendientes/no finalizados, se pide confirmacion.
- En Partidos se marca equipo inactivo con fila gris y badge `inhabilitada`.

## Auditoria

- Se reaplico `public/auditoria_detalle_simple_20260507.sql`.
- Los nuevos detalles de auditoria quedan como frases simples.
- Se corrigio `fn_auditoria()` para usar `current_setting('app.usuario_id', true)`.

## Verificaciones usadas

- `node --check controllers/torneoController.js`
- `node --check controllers/equipoController.js`
- `node --check routes/torneoRoutes.js`
- `node --check models/Torneo.js`
- Compilacion EJS de:
  - `views/torneos/index.ejs`
  - `views/equipos/administrar.ejs`
- `npm.cmd test`
