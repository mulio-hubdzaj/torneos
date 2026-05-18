# Contexto 017

Fecha: 2026-05-14

## Estado acordado

- Archivo SQL de referencia actual:
  - `public/torneo_20260514_1014.sql`
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- El usuario aplica manualmente los SQL que decide ejecutar.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.
- Vista principal activa:
  - `views/torneos/index.ejs`

## Resumen de la ultima sesion sin contexto previo

### Revision de seguridad y permisos

- Se estuvo verificando que ningun usuario pueda darse permisos navegando por opciones del navegador, herramientas de desarrollador, formularios manipulados o rutas directas.
- El enfoque acordado es cerrar puertas y ventanas que puedan permitir acceso indebido.
- Regla de seguridad:
  - la UI puede ocultar botones o pestanas;
  - pero la autorizacion real debe validarse siempre en backend.
- No se debe confiar en datos enviados desde formularios cuando afecten permisos, roles, `entity_id`, torneo o alcance administrativo.
- Las rutas sensibles deben validar:
  - sesion activa;
  - `rol_id`;
  - `entity_id` cuando aplique;
  - relacion real del usuario con torneo/equipo/entidad;
  - caso especial de super admin (`rol_id = 99`).
- Objetivo:
  - evitar escalamiento de privilegios;
  - evitar acceso por URL directa;
  - evitar cambios manipulando HTML desde devtools;
  - evitar acciones administrativas desde roles no autorizados.

### Revision de seguridad continuada

Cambios aplicados el 2026-05-14:

- `index.js`
  - Se bloqueo exposicion HTTP de archivos sensibles dentro de `public`:
    - `.sql`
    - `.doc`
    - `contexto_###.md`
    - archivos con `auditoria_detalle`
  - Se mantiene acceso a assets normales como `css/style.css`.
  - `SESSION_SECRET` ahora se toma de `process.env.SESSION_SECRET` con fallback de desarrollo.

- `routes/entidadRoutes.js`
  - Entrar a `/entidad/gestionar/:id` ya no permite cambiarse a una entidad ajena por URL.
  - Solo super admin puede usar rutas antiguas de crear/editar/activar/desactivar entidades.

- `controllers/entityController.js`
  - `activar` y `desactivar` ahora leen `req.params.entity_id`, alineado con la ruta real.

- `routes/grupoRoutes.js` y `controllers/grupoController.js`
  - Crear, editar y eliminar grupos requiere admin (`rol_id` 3 o 99).
  - El backend valida que el torneo/grupo pertenezca a la entidad permitida.
  - Ya no se acepta `entity_id` del body para editar grupos.

- `routes/torneoRoutes.js`
  - `/torneos/grupos` ya no permite consultar otra entidad manipulando `entity_id`.
  - Si se pasa `torneo_id`, tambien se valida que pertenezca a la entidad permitida.

- `routes/equipoRoutes.js` y `controllers/equipoController.js`
  - Busqueda de usuarios para delegados requiere admin.
  - Busqueda/asignacion/actualizacion de jugadores requiere rol operativo (`2`, `3` o `99`).
  - Asignar/desvincular delegados ahora valida el equipo real y la entidad antes de actuar.

- `routes/jugadorEquipoRoutes.js` y `controllers/jugadorEquipoController.js`
  - Ruta antigua `/jugador-equipo` queda cerrada a admin.
  - Listado/detalle/actualizacion de vinculos se filtra por entidad salvo super admin.

- `routes/authRoutes.js`, `views/login.ejs`, `views/restablecer_contrasena.ejs`
  - Se agrego opcion publica `Restablecer contrasena` desde inicio de sesion.
  - Nuevo flujo:
    - documento;
    - correo;
    - entidad;
    - nueva contrasena;
    - confirmar contrasena.
  - Solo permite restablecer si:
    - la entidad existe;
    - la entidad esta activa;
    - documento + correo + entidad coinciden;
    - el usuario esta activo actualmente.
  - Si algo no coincide, muestra motivo y pide comunicarse con el admin.
  - El login normal ahora tambien bloquea usuarios inactivos.
  - Registro:
    - se agrego validacion previa de correo duplicado;
    - la DB tiene `usuarios_correo_key UNIQUE (correo)`;
    - antes solo se validaba documento + entidad, por eso un correo repetido caia en `Error al registrar usuario`;
    - ahora informa si el correo ya existe en la misma entidad o en otro usuario.

- `views/torneos/index.ejs`
  - En la pestana Usuarios, el filtro `Estado` ahora inicia en `Todos`.
  - Motivo: al desactivar un usuario desde la tabla, quedaba oculto por el filtro default `Activos` y no se podia verlo para activarlo de vuelta.

Verificaciones:

- `node --check` OK en archivos tocados.
- `npm.cmd test` responde `No hay tests definidos`.
- Prueba HTTP local:
  - `/torneo_20260514_1014.sql` -> `404`
  - `/contexto_017.md` -> `404`
  - `/css/style.css` -> `200`
- Prueba HTTP local auth:
  - `/login` -> `200`
  - `/restablecer-contrasena` -> `200`
- Compilacion EJS OK para:
  - `views/torneos/index.ejs`

### Dashboard bajo torneo seleccionado

- Se acordo que primero debe seleccionarse un torneo.
- Debajo de `Torneo seleccionado` se agrego un dashboard del torneo actual.
- El dashboard muestra:
  - tabla de posiciones resumida;
  - goleadores;
  - ultimos resultados;
  - proximos encuentros;
  - accesos directos a pestanas relevantes.
- El dashboard queda ligado al torneo seleccionado y desde ahi se navega sin perder el contexto.
- Se agregaron accesos directos:
  - `Tabla`
  - `Goleadores`
  - `Fixture`
  - `Jugadores`
- Los accesos directos ahora activan pestanas con JavaScript de Bootstrap.

### Ajuste visual del dashboard

- Se pidio agregar mas color, evitando que todo sea blanco/negro.
- Se dejaron cabeceras de tarjetas en verde.
- El contenido de las tarjetas queda en blanco.

### Proximos encuentros

- Se quito del dashboard la observacion `Sin cancha`.
- Ahora solo se muestra cancha si el partido tiene una cancha asignada.

### Auditoria por AJAX

- Se agrego refresco de auditoria al entrar a la pestana `Audit/Auditoria`.
- Ya no deberia requerir recargar toda la pagina para ver auditoria actualizada.
- Endpoint agregado:
  - `GET /torneos/:id_torneo/auditoria/resumen`
- El refresco vuelve a aplicar filtros despues de actualizar la tabla.

### Bug de Usuarios mezclado con Auditoria

- Se detecto que al pasar de Auditoria a Usuarios la pantalla quedaba mezclada/crasheada.
- No era un cambio real de rol.
- Causa:
  - el `<tbody>` de Usuarios habia quedado accidentalmente con `id="auditoriaTbody"`;
  - el AJAX de Auditoria escribia filas de auditoria dentro de la tabla de Usuarios.
- Correccion:
  - Usuarios vuelve a tener su `<tbody>` normal;
  - Auditoria conserva `id="auditoriaTbody"` en su tabla correcta.
- Por eso aparecia `INGRESO` visualmente en la columna de rol: era una fila de auditoria renderizada en tabla equivocada.

## DB revisada desde `torneo_20260514_1014.sql`

### Torneos en el dump

Activos (`estado = true`):

- `1` - `a1` - entity `1`
- `12` - `prueba de jugadores` - entity `2`
- `15` - `CAMPEONES` - entity `2`
- `16` - `prueba` - entity `27`
- `6` - `sa` - entity `4`
- `9` - `TORNEO A5` - entity `8`
- `10` - `TROENEO A5` - entity `8`
- `11` - `A4` - entity `9`

Inactivos (`estado = false`):

- `2`, `3`, `7`, `8`, `13`, `14`

### Auditoria en DB de referencia

El dump actual ya incluye triggers que antes estaban como pendientes:

- `jugadores`
  - `trg_audit_jugadores`
  - `AFTER INSERT OR DELETE OR UPDATE`
- `jugadores_equipos`
  - `trg_audit_jugadores_equipos`
  - `AFTER INSERT OR DELETE OR UPDATE`
- `roles`
  - `trg_roles_auditoria`
  - `AFTER INSERT OR DELETE OR UPDATE`

Tambien aparecen triggers de auditoria para:

- `partidos`
- `items_equipo`
- `sanciones`
- `eventos_partido`
- `resultados`
- `usuarios`
- `canchas`
- `delegados_equipos`
- `entity`
- `equipos`
- `estadisticas`
- `finanzas`
- `grupos`
- `items`
- `torneos`
- `torneos_reglas_tarjetas`

Conclusion:

- El pendiente fuerte del contexto 016 sobre `DELETE` en `jugadores` y `jugadores_equipos` parece resuelto en el dump nuevo.
- El pendiente secundario de `roles` tambien parece resuelto.

## Archivos tocados segun la ultima sesion

- `controllers/torneoController.js`
  - dashboard inicial;
  - endpoint `auditoriaResumen`.
- `routes/torneoRoutes.js`
  - ruta `GET /:id_torneo/auditoria/resumen`.
- `views/torneos/index.ejs`
  - dashboard bajo torneo seleccionado;
  - accesos directos por pestanas;
  - refresco AJAX de auditoria;
  - correccion de `auditoriaTbody`.

## Verificaciones informadas en la sesion anterior

- `node --check controllers\\torneoController.js`
- `node --check routes\\torneoRoutes.js`
- compilacion EJS de `views/torneos/index.ejs`
- `npm.cmd test`

## Pendientes actuales recomendados

### Revisar / confirmar

- Revisar rutas sensibles con enfoque backend-first:
  - usuarios y cambio de roles;
  - entidades;
  - equipos/delegados/jugadores;
  - canchas;
  - items;
  - partidos/fixture/resultados;
  - finanzas;
  - auditoria;
  - endpoints AJAX.
- Confirmar que no se puedan habilitar acciones administrativas manipulando botones ocultos desde devtools.
- Seguir revisando rutas antiguas no principales:
  - `usuarioRoutes.js`
  - `rolRoutes.js`
  - `finanzasRoutes.js`
  - `estadisticaRoutes.js`
  - confirmar si estan montadas o si conviene eliminarlas/cerrarlas por middleware.
- Revisar que los formularios de entidad antiguos sigan funcionando solo para super admin si aun se usan.
- Probar en navegador:
  - entrar a Auditoria;
  - volver a Usuarios;
  - confirmar que no se mezclan filas ni queda pantalla rota.
- Confirmar que el refresco AJAX de Auditoria muestra registros nuevos sin recargar.
- Confirmar que los accesos directos del dashboard abren:
  - Estadisticas / Tabla de posiciones;
  - Estadisticas / Ranking de goles;
  - Fixture;
  - Jugadores.

### Producto / UX

- Definir si la pestana visible se llamara `Audit` o `Auditoria`.
- Definir alcance de super admin en Auditoria:
  - solo torneo/contexto actual;
  - entidad completa;
  - global.
- Mejorar dashboard si se desea:
  - mas estados visuales;
  - filtros por grupo;
  - accesos rapidos adicionales;
  - indicadores de partidos pendientes/finalizados.

### Codigo / mantenimiento

- Si se conserva una sola referencia SQL, usar `public/torneo_20260514_1014.sql` como base actual.
- No confiar en backups SQL viejos mencionados por contextos anteriores si ya no existen en `public`.
- Antes de seguir con nuevas funciones, conviene correr de nuevo:
  - `node --check controllers/torneoController.js`
  - `node --check routes/torneoRoutes.js`
  - compilacion EJS de `views/torneos/index.ejs`
  - `npm.cmd test`

## Sobre contextos anteriores

- Se pueden conservar los contextos `001` a `016` como historial.
- Para trabajar de ahora en adelante, este `contexto_017.md` puede funcionar como contexto global actual.
- Recomendacion:
  - no borrar todavia los anteriores;
  - si se quiere limpiar, moverlos luego a una carpeta `public/contextos_archivo/`;
  - dejar visible `contexto_017.md` como punto de arranque.
