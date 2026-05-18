# Contexto 015

Fecha: 2026-05-13

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.

## Contexto previo relevante

- El contexto 014 dejo implementado `Sedes/canchas`:
  - administracion en `Items -> Sedes/canchas`;
  - selector de cancha en `Editar horario`;
  - `partidos.id_cancha`;
  - modelo `Cancha`;
  - rutas de canchas.
- Se renombro la pestana visible `Partidos` a `Fixture`.
- Se ajusto el guardado masivo de fecha/hora para respetar `grupo_id` cuando hay filtro por grupo:
  - si se filtra por `SEMI`, solo actualiza encuentros de `SEMI` en esa fecha;
  - sin filtro, mantiene comportamiento general.

## Pedido actual interrumpido

- El usuario pidio que, desde super admin (`rol_id = 99`), se puedan eliminar usuarios existentes permitiendo registrarlos nuevamente.
- Se detecto que borrar fisicamente usuarios puede generar conflicto por FKs/historial, especialmente:
  - `auditoria.id_usuario -> usuarios.id_usuario` sin `ON DELETE`;
  - otros vinculos como `delegados_equipos`.
- El usuario ajusto el pedido:
  - si hay conflictos, habilitar edicion de datos del usuario.

## Cambios parciales hechos antes de suspender

Estos cambios quedaron aplicados parcialmente y deben revisarse antes de continuar:

- `routes/torneoRoutes.js`
  - se agrego primero una ruta parcial de eliminacion y luego se cambio a:
    - `POST /torneos/:id_torneo/usuarios/:id_usuario/editar`
    - controlador esperado: `torneoController.editarDatosUsuarioSuperAdmin`

- `controllers/torneoController.js`
  - se agrego:
    - `const { Op } = require('sequelize');`
  - se agrego una funcion:
    - `exports.editarDatosUsuarioSuperAdmin`
  - Intencion de la funcion:
    - solo super admin puede editar datos;
    - campos editables:
      - `nombre`;
      - `documento`;
      - `correo`;
    - valida correo;
    - valida duplicado de correo;
    - valida duplicado de documento dentro de la misma entidad;
    - guarda cambios y vuelve a `#usuarios`.

- `views/torneos/index.ejs`
  - se agrego boton parcial:
    - `Editar datos`
    - clase: `.btn-editar-usuario-admin`
    - visible solo si `rol_id == 99`
  - se agrego modal:
    - `#modalEditarUsuarioAdmin`
    - formulario:
      - `#formEditarUsuarioAdmin`
      - `nombre`
      - `documento`
      - `correo`
  - se agrego listener JS parcial para abrir el modal y setear:
    - `form.action = /torneos/<id_torneo>/usuarios/<id_usuario>/editar`
    - valores actuales de nombre/documento/correo.

## Importante

- El trabajo fue interrumpido a proposito por el usuario.
- No se corrieron verificaciones despues de estos cambios parciales.
- Antes de seguir, revisar:
  - `routes/torneoRoutes.js`
  - `controllers/torneoController.js`
  - `views/torneos/index.ejs`
- Luego ejecutar:
  - `node --check controllers/torneoController.js`
  - `node --check routes/torneoRoutes.js`
  - compilacion EJS de `views/torneos/index.ejs`
  - `npm.cmd test`

## Pendientes recomendados

- Decidir si se implementara:
  - edicion solamente;
  - eliminacion logica/anominizada para liberar documento/correo;
  - o eliminacion fisica solo cuando no existan FKs conflictivas.
- Si se quiere permitir registrar nuevamente al mismo usuario, la opcion mas segura parece:
  - boton super admin `Liberar usuario`;
  - anonimizar `documento` y `correo`;
  - desactivar usuario;
  - mantener historial y auditoria intactos.
