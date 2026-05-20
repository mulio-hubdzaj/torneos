# Contexto 032

Fecha: 2026-05-19

## Tema

Aprobacion manual de registros y reglas de activacion/desactivacion al vincular delegados a equipos.

## Cambios aplicados

- El registro publico crea usuarios como:
  - `rol_id = 1`
  - `estado = false`
- El mensaje posterior al registro indica que un administrador debe aprobar la solicitud antes de iniciar sesion.
- El panel `Usuarios` mantiene visibles los inactivos/pendientes para que admin o super admin puedan:
  - activarlos como espectadores;
  - cambiar permisos, lo que tambien los activa.
- Al asignar un usuario como delegado de equipo:
  - se permite tomar usuarios pendientes con rol espectador/delegado;
  - el usuario queda activo;
  - si era espectador, pasa a delegado.
- Al desvincular un delegado de un equipo:
  - si conserva otro vinculo activo como delegado en otro torneo/equipo, sigue activo y delegado;
  - si no conserva vinculos activos, queda como espectador inactivo.
- Los usuarios admin/super admin no se convierten automaticamente en delegados ni se inactivan por este flujo.
- En la pestaña `Usuarios`, la columna `Estado` queda visible tambien en `Vista usuario`.
- El boton de activacion en modo admin se renombro a `Aprobar / activar` para que las solicitudes pendientes sean mas claras.
- En movil vertical, `Vista usuario` de la pestaña `Usuarios` pasa a formato tarjeta para evitar que rol/estado/equipo queden cortados.

## Archivos modificados

- `routes/authRoutes.js`
- `controllers/equipoController.js`
- `controllers/torneoController.js`
- `views/partials/listaUsuarios.ejs`
- `views/equipos/listaUsuarios.ejs`
- `views/torneos/index.ejs`

## Pendiente de prueba manual

- Crear una cuenta desde registro publico y confirmar que no puede iniciar sesion hasta ser activada.
- En `Usuarios`, activar una solicitud y confirmar que queda como espectador activo.
- En `Usuarios`, cambiar una solicitud a admin y confirmar que queda activa.
- Buscar una solicitud pendiente desde administrar equipo, asignarla como delegado y confirmar que queda activa/delegado.
- Desvincular un delegado sin otros vinculos y confirmar que queda espectador inactivo.
- Desvincular un delegado que tambien esta vinculado en otro torneo y confirmar que sigue activo/delegado.
