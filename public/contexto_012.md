# Contexto 012

Fecha: 2026-05-09

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.

## Roles y permisos

- `rol_id = 1`: usuario/espectador.
  - No ve pestañas administrativas.
  - No ve `Finanzas`.
  - No ve boton `Ir a Torneos`.
  - No puede registrar jugadores por URL directa.

- `rol_id = 2`: delegado de equipo.
  - Puede ver `Equipos`, `Jugadores`, `Partidos`, `Finanzas`, `Estadisticas` y `Torneos`.
  - En `Equipos`, solo puede administrar el equipo donde esta vinculado como delegado en el torneo actual.
  - Si entra a otro torneo activo de la misma entidad donde no tiene equipo vinculado, conserva el rol pero no puede administrar equipos ajenos.
  - En `Finanzas`, solo ve el balance de su equipo vinculado en el torneo actual.
  - No puede administrar delegados ni desvincular jugadores.

- `rol_id = 3`: admin de entidad.
  - Puede administrar usuarios de su entidad.
  - Puede promover usuarios `rol_id = 1` a admin.
  - No puede crear ni modificar super admin.

- `rol_id = 99`: super admin.
  - Puede administrar entidades y usuarios.

## Pestaña Usuarios

- Se agrego pestaña `Usuarios` en `views/torneos/index.ejs`.
- Visible solo para `rol_id = 3` y `rol_id = 99`.
- Muestra usuarios de la entidad con:
  - nombre;
  - documento;
  - correo;
  - rol;
  - estado;
  - torneo activo donde esta vinculado;
  - equipo vinculado.
- Los vinculos se consultan solo contra torneos activos (`torneos.estado = true`).
- Tiene buscador por:
  - nombre;
  - equipo;
  - documento.
- Tiene filtro por torneo activo.
- Permite activar/desactivar usuarios.
- Permite pasar usuarios `rol_id = 1` a admin (`rol_id = 3`).
- Backend protege las acciones con rutas:
  - `POST /torneos/:id_torneo/usuarios/:id_usuario/toggle`
  - `POST /torneos/:id_torneo/usuarios/:id_usuario/admin`

## Vista usuario por defecto

- `Partidos`, `Jugadores`, `Finanzas` y `Usuarios` arrancan en vista usuario.
- Para admins/super admin se puede habilitar admin con boton.
- Se quito persistencia en `localStorage`, por lo que al recargar vuelve a vista usuario.
- Para `rol_id = 1` se ocultaron botones administrativos, incluyendo:
  - `Habilitar admin`;
  - `Personalizar torneo`;
  - `Ir a Entidades`;
  - `Ir a Torneos`.

## Delegados

- Se habilito `rol_id = 2` como delegado operativo.
- En pestaña `Equipos`:
  - ve todos los equipos;
  - puede abrir ojo/ver datos basicos de cualquier equipo;
  - solo puede administrar su propio equipo vinculado;
  - otros equipos muestran candado.
- Backend bloquea acceso directo a `/equipos/administrar/:id_equipo` si el delegado intenta administrar un equipo ajeno.
- En `Administrar equipo`, para delegado:
  - puede asignar jugadores;
  - no puede desvincular jugadores;
  - no puede asignar delegados;
  - no puede desvincular delegados;
  - no puede agregar jugador de prestamo.
- Backend tambien bloquea:
  - `/equipos/asignarDelegados`;
  - `/equipos/desvincularDelegado`;
  - `/equipos/desvincularJugador`;
  - alta con `tipo_vinculo = prestamo`.

## Rol automatico delegado/espectador

- Al asignar un usuario como delegado de equipo:
  - si tenia `rol_id = 1`, pasa automaticamente a `rol_id = 2`.
- Al desvincular un delegado:
  - si ya no tiene ningun vinculo activo en equipos activos de torneos activos de la entidad, vuelve de `rol_id = 2` a `rol_id = 1`.
- No se baja automaticamente a admins ni super admins.

## Registro de usuarios

- En `views/registro.ejs` se agrego:
  - apellido;
  - correo.
- Como la tabla `usuarios` solo tiene columna `nombre`, se guarda concatenado:
  - `usuarios.nombre = NOMBRE APELLIDO`.
- `usuarios.correo` ya existia y ahora se guarda.
- Se reforzo validacion de correo:
  - frontend con `pattern`;
  - backend en `routes/authRoutes.js`.
- Ya no debe aceptar correos tipo `gfgfhgfh@bbb`; exige formato tipo `usuario@dominio.com`.

## Logout y cache

- Se detecto que al cerrar sesion y presionar atras el navegador podia mostrar el torneo desde cache.
- En `index.js` se agregaron headers:
  - `Cache-Control: no-store, no-cache, must-revalidate, private`;
  - `Pragma: no-cache`;
  - `Expires: 0`.
- Se agrego middleware `requiereSesion` para rutas privadas.
- En `/logout` se limpia cookie `connect.sid` y se envian headers anti-cache.

## Navegacion y pestañas

- En `views/entidad/index.ejs` se quito `target="_blank"` del boton `Ir a torneo`.
- Ahora al abrir un torneo desde entidad se navega en la misma pestaña.
- En `views/equipos/ver.ejs` y `views/torneos/index.ejs` se ajusto retorno desde el ojo de equipos para volver a `#equipos`.
- Para `rol_id = 2` se corrigio bloqueo de hash:
  - puede volver a `#equipos` y `#finanzas`;
  - se bloquean `#grupos`, `#items`, `#usuarios`.

## Jugadores

- Para delegado, en pestaña `Jugadores` se habilito boton `Nuevo`.
- Al registrar jugador como delegado:
  - no se muestra `Estado`;
  - no se muestra `Observaciones`;
  - backend fuerza `estado = true`;
  - backend fuerza `observaciones = ''`.
- Se corrigio desfase visual de fecha de nacimiento:
  - se dejo de usar `new Date(...).toLocaleDateString()` en la tabla;
  - ahora se formatea manualmente `YYYY-MM-DD` a `DD/MM/YYYY`.
- Tambien se corrigio `views/jugadores/editar.ejs` para no usar `toISOString()` en el input date.

## Verificaciones usadas

- `node --check index.js`
- `node --check routes/authRoutes.js`
- `node --check routes/torneoRoutes.js`
- `node --check controllers/torneoController.js`
- `node --check controllers/equipoController.js`
- `node --check controllers/jugadorController.js`
- Compilacion EJS de:
  - `views/torneos/index.ejs`
  - `views/equipos/administrar.ejs`
  - `views/equipos/ver.ejs`
  - `views/jugadores/nuevo.ejs`
  - `views/jugadores/editar.ejs`
  - `views/registro.ejs`
  - `views/entidad/index.ejs`
- `npm.cmd test`
  - actualmente responde `No hay tests definidos`.

## Pendientes recomendados

- Probar en navegador con:
  - `rol_id = 1`;
  - `rol_id = 2` con equipo vinculado;
  - `rol_id = 2` en otro torneo activo sin equipo vinculado;
  - `rol_id = 3`;
  - `rol_id = 99`.
- Confirmar que el retorno desde ojo de equipos queda siempre en `#equipos`.
- Decidir si el delegado debe poder editar camiseta/capitan o solo agregar jugadores.
- Evaluar si Finanzas de delegado debe ocultar completamente la pestaña cuando no tiene equipo vinculado en el torneo actual.
