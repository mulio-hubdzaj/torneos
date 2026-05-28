# Contexto 041

Fecha: 2026-05-27

## Tema

Cierre de tanda y despliegue PRD: selector de entidad favorito, redireccion admin, controles de permisos, planillas PDF, cambios de jugadores, grupos con cruce manual y auditoria de movimientos.

## Estado Git / PRD

Rama de trabajo al cierre:

```txt
qa
```

Commit empaquetado y enviado:

```txt
51fc314 preparar ajustes finales para prd
```

Acciones realizadas:

```txt
git push origin qa
git checkout main
git merge qa --no-edit
git push origin main
git checkout qa
```

Resultado:

- `qa` y `main` quedaron en `51fc314`.
- PRD respondio correctamente:

```txt
GET https://torneos-production.up.railway.app/ -> 200
```

- Se verifico que PRD ya servia senales del paquete nuevo (`entity-selector` visible en HTML).

## SQL PRD

El usuario confirmo que de su lado quedo check/aplicado en PRD.

SQL involucrados:

```txt
docs/sql/partidos_eventos_json_20260526.sql
docs/sql/app_uso_diario_20260526.sql
```

Motivo:

- `partidos_eventos_json_20260526.sql` agrega columnas JSON usadas por carga de goles/tarjetas con minutos y cambios:
  - `estadisticas.goles_minutos`
  - `estadisticas.amarillas_minutos`
  - `estadisticas.rojas_minutos`
  - `partidos.cambios_json`
- `app_uso_diario_20260526.sql` agrega la tabla de resumen de uso app/web:
  - `app_uso_diario`

Nota:

- Sin `partidos.cambios_json` en PRD, la pantalla de gestionar torneo podia caer con `Error al gestionar torneo`.
- Los SQL usan `IF NOT EXISTS`, por lo que son idempotentes.

## Verificaciones antes de subir

Se ejecutaron:

```txt
node --check controllers/equipoController.js
node --check controllers/grupoController.js
node --check controllers/partidoController.js
node --check controllers/torneoController.js
node --check controllers/usoController.js
node --check routes/authRoutes.js
node --check routes/entidadRoutes.js
node --check routes/adminRoutes.js
node --check routes/usoRoutes.js
node --check index.js
node --check public/js/entity-selector.js
node --check public/js/session-abandon-guard.js
EJS_OK views/torneos/index.ejs
EJS_OK views/equipos/administrar.ejs
EJS_OK views/login.ejs
EJS_OK views/registro.ejs
EJS_OK views/index.ejs
EJS_OK views/restablecer_contrasena.ejs
EJS_OK views/admin/index.ejs
EJS_OK views/admin/agregar.ejs
EJS_OK views/admin/editar.ejs
npm.cmd test
git diff --check
```

Resultados:

- JS OK.
- EJS OK.
- `npm.cmd test` OK; el proyecto informa `No hay tests definidos`.
- `git diff --check` sin errores, solo avisos normales CRLF.

## Cambios principales incluidos

### Selector de entidad

- Selector con busqueda y favorito.
- Favorito persistente en `localStorage`.
- En public/sin login, login, registro y restablecer contrasena.
- Seleccion automatica/favorita tambien para la APK.

### Admin / super admin

- Admin entra directo a pestana Torneos cuando la entidad tiene torneos activos.
- Si no tiene torneos, entra a `entidad/gestionar/:id` como antes.
- Super admin al seleccionar entidad entra directo a Torneos si existen.
- Rutas `/admin` reforzadas para que solo acceda super admin.
- Se agregaron recargas `pageshow` en vistas admin para evitar cache al volver atras.

### Grupos

- Equipos con cruces manuales muestran nota `cruce manual`.
- El sorteador queda habilitado si solo hay cruces manuales y no sorteo registrado.
- Al mover equipo entre grupos, se deja registro en `equipos_movimientos_grupo` con origen/destino.
- Se permite eliminar grupo vacio aunque tenga historial/auditoria de movimientos.

### Planillas y PDFs

- Lista de jugadores por partido:
  - Se quito columna goles.
  - Se amplio nombre y apellido.
- Planilla final del encuentro:
  - `N` renombrado a `NRO`.
  - Numero de camiseta va en primera columna sin `#`.
  - Jugador sin numero repetido en columna nombre.
  - Cambios sin redundancia de numero.
  - Muestra todos los minutos de goles/tarjetas.
  - Cabecera con marcador final y torneo.
- Administrar equipo:
  - Nuevo boton `Descargar buena fe`.
  - Planilla general de plantel sin rival, sin fecha de encuentro y sin estado habilitado/inhabilitado.
  - Descarga compatible con web y APK usando el mismo flujo de PDFs preparado en servidor.

### Cambios en dashboard/estadisticas

- Cambios muestran numero de camiseta y nombre:

```txt
22 - Julio xxx
```

- Sin usar `#`.

### Uso app/web

- Se agrego ping de uso desde `session-abandon-guard`.
- Tabla/resumen visible para super admin si existe `app_uso_diario`.
- Si la tabla no existe, no rompe la app.

## Estado de trabajo al cerrar

Rama:

```txt
qa
```

Pendiente local no commiteado:

```txt
docs/Planilla_resumen encuentros .pdf
```

Ese PDF quedo fuera del commit porque es un archivo de ejemplo/documento suelto, no codigo ni migracion.

## Cierre

El usuario confirmo que la aplicacion de SQL/DB de su lado ya esta check.

Queda como siguiente validacion funcional manual en PRD:

- login con entidad favorita;
- acceso admin/super admin;
- abrir torneo sin error;
- descargar buena fe en web/APK;
- revisar planilla final del encuentro;
- revisar nota `cruce manual` y registro al mover equipo.
