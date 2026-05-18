# Contexto 013

Fecha: 2026-05-11

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.

## Usuarios, roles y permisos

- En la pestana `Usuarios` se reemplazo `Pasar a admin` por `Cambiar permisos`.
- Admin de entidad (`rol_id = 3`) puede cambiar usuarios entre:
  - `Espectador` (`rol_id = 1`);
  - `Admin` (`rol_id = 3`).
- Super admin (`rol_id = 99`) puede asignar:
  - `Espectador` (`rol_id = 1`);
  - `Delegado` (`rol_id = 2`);
  - `Admin` (`rol_id = 3`);
  - `Super admin` (`rol_id = 99`).
- Al asignar `Super admin`, se guarda:
  - `rol_id = 99`;
  - `entity_id = null`.
- Se evita que un usuario cambie sus propios permisos desde ese panel.
- Admin de entidad no puede modificar ni ver super admins.
- Se agrego filtro por rol en la pestana `Usuarios`.

## Entidad visible en header

- En el header de `views/torneos/index.ejs` se muestra la entidad actual.
- Se decidio mostrar el `codigo` de la entidad, no la `descripcion`.
- Fallback si no existe codigo:
  - `Entidad #<entityId>`.

## Reset de contrasena

- Se agrego soporte para resetear contrasenas desde administracion de usuarios.
- SQL pendiente/aplicable manualmente:
  - `public/usuarios_reset_password_20260511.sql`
- Columnas nuevas esperadas en `public.usuarios`:
  - `debe_cambiar_contrasena boolean DEFAULT false NOT NULL`;
  - `reset_contrasena_en timestamp without time zone`.
- En `models/Usuario.js` se agregaron los campos:
  - `debe_cambiar_contrasena`;
  - `reset_contrasena_en`.
- Se agrego boton `Resetear clave` en la pestana `Usuarios`.
- Al resetear:
  - se genera una clave temporal;
  - se guarda hasheada;
  - se marca `debe_cambiar_contrasena = true`;
  - se muestra el codigo temporal una sola vez en flash.
- En login, si el usuario tiene `debe_cambiar_contrasena = true`, se redirige a:
  - `/cambiar-contrasena`.
- Middleware de sesion bloquea rutas privadas mientras el usuario no cambie la contrasena.
- Nueva vista:
  - `views/cambiar_contrasena.ejs`.

## Seguridad de contrasenas

- Regla final vigente para nuevas contrasenas:
  - minimo 8 caracteres en total;
  - minimo 2 numeros;
  - minimo 1 caracter especial;
  - espacios no cuentan como caracter especial.
- Se valida en backend en:
  - `routes/authRoutes.js`.
- Se valida visualmente en frontend en:
  - `views/registro.ejs`;
  - `views/cambiar_contrasena.ejs`.
- Se agrego barra de progreso y checklist visual.
- Se quito el prefijo `NO` / `OK` del checklist; ahora solo cambia rojo/verde.
- Se agrego icono de ojo para ver/ocultar contrasena en:
  - `views/login.ejs`;
  - `views/registro.ejs`;
  - `views/cambiar_contrasena.ejs`.
- Se corrigio que al mostrar contrasena con el ojo se pasara a mayusculas por CSS global:
  - se agrego clase `password-segura`;
  - `public/css/style.css` fuerza `text-transform: none !important` para esa clase.

## Items y carga de partidos

- En el modal de carga de partido, pestana `Items y finanzas`, ya no se crea una fila vacia automaticamente.
- El admin debe usar `Agregar item` manualmente.
- Se retiro la generacion automatica de items por tarjetas desde el frontend.

## Eliminacion de encuentros con carga

- Al intentar eliminar un encuentro con carga registrada, se bloquea y muestra alerta.
- La validacion revisa:
  - `items_equipo`;
  - `estadisticas`;
  - `sanciones`;
  - `eventos_partido`;
  - movimientos en `finanzas`.
- Mensaje:
  - `No se puede eliminar este encuentro porque ya tiene carga registrada. Revise items, finanzas, estadisticas o sanciones antes de eliminarlo.`

## Finanzas

- Se corrigio el detalle financiero para que los items se crucen por:
  - `partido + equipo`;
  y no solo por `partido`.
- Esto evita que un equipo vea items cargados al otro equipo del mismo encuentro.
- Tambien se ajusto el refresco inmediato en cliente para no conservar items viejos mientras llega la sincronizacion del servidor.

## Verificaciones usadas

- `node --check routes/authRoutes.js`
- `node --check controllers/torneoController.js`
- `node --check routes/torneoRoutes.js`
- `node --check index.js`
- Compilacion EJS de:
  - `views/torneos/index.ejs`;
  - `views/login.ejs`;
  - `views/registro.ejs`;
  - `views/cambiar_contrasena.ejs`.
- `npm.cmd test`
  - actualmente responde `No hay tests definidos`.

## Pendientes recomendados

- Aplicar manualmente en PostgreSQL:
  - `public/usuarios_reset_password_20260511.sql`.
- Probar en navegador:
  - reset de clave desde `Usuarios`;
  - login con clave temporal;
  - cambio obligatorio de contrasena;
  - acceso posterior segun rol.
- Probar con admin entidad que no vea super admins.
- Probar con super admin que pueda asignar otro super admin y que quede `entity_id = null`.
