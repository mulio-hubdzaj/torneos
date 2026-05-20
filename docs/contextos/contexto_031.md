# Contexto 031

Fecha: 2026-05-19

## Tema

Avance local sobre pendientes: permisos de delegados para iconos, eliminacion de icono personalizado y ajuste previo de portada de torneo.

## Estado

- Rama actual:
  - `qa`
- Trabajo realizado y probado solo en localhost.
- No se hizo commit.

## Cambios aplicados

### Delegados modifican iconos

- Se agrego permiso por torneo:
  - `permitir_modificar_iconos_equipo`
- SQL preparado:
  - `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`
- SQL aplicado en la base local.
- En pestana `Equipos` se agrego switch:
  - `Delegados modifican iconos`
- El switch queda visible para:
  - admin entidad (`rol_id = 3`)
  - super admin (`rol_id = 99`)
- El permiso usa confirmacion con modal de la app.

Archivos:

- `controllers/torneoController.js`
- `routes/torneoRoutes.js`
- `views/torneos/index.ejs`
- `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`

### Icono de equipo

- La ruta de actualizar icono ahora permite:
  - admin/super admin;
  - delegado del propio equipo si el torneo tiene activo `permitir_modificar_iconos_equipo`.
- Si el delegado no tiene permiso, se bloquea con mensaje.
- Se agrego ruta para eliminar icono personalizado:
  - `POST /equipos/:id_equipo/icono/eliminar`
- Al eliminar, vuelve a:
  - `/images/default_team.png`
- En `Administrar equipo`, el delegado ve el boton de icono deshabilitado si el permiso esta apagado.

Archivos:

- `controllers/equipoController.js`
- `routes/equipoRoutes.js`
- `views/equipos/administrar.ejs`

### Portada de torneo

- En modal `Personalizar torneo`, al seleccionar imagen se muestra vista previa ajustable.
- Se puede:
  - mover/reencuadrar arrastrando;
  - agrandar/achicar con slider;
  - guardar el resultado ajustado.
- El frontend genera una imagen ajustada en canvas y la envia como `portada_ajustada`.
- El backend guarda esa imagen procesada en `public/uploads`.

Archivos:

- `controllers/torneoController.js`
- `views/torneos/index.ejs`

## Verificaciones

Ejecutado correctamente:

```powershell
node --check index.js
node --check controllers\equipoController.js
node --check controllers\partidoController.js
node --check controllers\torneoController.js
node --check routes\authRoutes.js
node --check routes\equipoRoutes.js
node --check routes\torneoRoutes.js
node -e "const ejs=require('ejs'); for (const f of ['views/index.ejs','views/login.ejs','views/equipos/administrar.ejs','views/torneos/index.ejs']) ejs.compile(require('fs').readFileSync(f,'utf8')); console.log('EJS_OK')"
npm.cmd test
```

Resultado de tests:

```txt
No hay tests definidos
```

Prueba HTTP local:

```txt
PORT=3099
GET /
STATUS=200
HAS_PUBLIC=True
```

## Pendientes de prueba manual

- Entrar como admin/super admin:
  - pestana `Equipos`;
  - activar/desactivar `Delegados modifican iconos`;
  - confirmar que persiste.
- Entrar como delegado:
  - administrar su propio equipo;
  - si el switch esta activo, cambiar icono;
  - eliminar icono personalizado y confirmar que vuelve al default;
  - si el switch esta apagado, confirmar que no puede cambiarlo.
- Portada:
  - seleccionar imagen;
  - mover/reencuadrar;
  - ajustar zoom;
  - guardar;
  - confirmar que la portada queda recortada como en la vista previa.
- Fechas vacias:
  - revisar manualmente Fecha 4 / Fecha 5 vacias.
  - El codigo vigente mantiene la regla:
    - fecha con cualquier partido no se elimina;
    - fecha sin partidos se elimina;
    - fechas posteriores se compactan.
  - Consulta local de huecos entre `1..MAX(numero_fecha)` no encontro fechas vacias reales en la DB actual.

## Cambio posterior: cierre por abandono APK

Pedido:

- Si se abandona la vista APK por 3 minutos, al volver debe pedir login.
- Debe aplicar tambien a modo visitante.
- Debe cerrar por completo.

Aplicado:

- Nuevo timeout configurable:
  - `ABANDON_TIMEOUT_MS`
  - default: `180000` ms.
- Nuevo endpoint:
  - `GET /session/heartbeat`
- Nuevo script:
  - `public/js/session-abandon-guard.js`
- Mientras la pantalla esta visible, el script envia heartbeat cada 60 segundos.
- Al ocultarse la pagina/app, guarda hora de abandono en `sessionStorage`.
- Al volver, si pasaron 3 minutos o mas:
  - redirige a `/logout?motivo=abandono`;
  - la ruta logout destruye sesion y limpia cookie.
- Para vista publica:
  - se marca `req.session.vista_publica_activa = true`;
  - tambien usa heartbeat y cierre por abandono.
- Refuerzo servidor:
  - si una sesion autenticada o publica llega con heartbeat vencido, se destruye y redirige a `/login`.

Archivos:

- `index.js`
- `routes/authRoutes.js`
- `public/js/session-abandon-guard.js`
- `views/torneos/index.ejs`
- `views/equipos/administrar.ejs`
- `views/equipos/ver.ejs`
- `views/entidad/index.ejs`
- `views/admin/index.ejs`
- `views/partials/footer.ejs`

Verificado:

```txt
node --check index.js
node --check routes\authRoutes.js
node --check public\js\session-abandon-guard.js
EJS_OK vistas tocadas
GET / -> 200
GET /js/session-abandon-guard.js -> 200
GET /session/heartbeat -> 204
```

## Cambio posterior: conservar pestaña Grupos al guardar

Pedido:

- Al agregar grupos/equipos, despues de guardar no debe saltar a la pestaña `Torneos`.
- Debe permanecer en `Grupos`.
- Al agregar un equipo, el cursor debe quedar en el campo para cargar el siguiente equipo.
- Aplica web y APK.

Aplicado:

- Redirects de grupos ahora vuelven a:
  - `/torneos/gestionar/:id_torneo#grupos`
- Crear equipo ahora vuelve a:
  - `/torneos/gestionar/:id_torneo#grupos`
- En cada input `Nuevo equipo` se agrego:
  - `data-grupo-equipo-input`
- Antes de enviar el formulario de equipo, se guarda en `sessionStorage` el grupo activo.
- Al cargar `#grupos`, se enfoca y centra el input del mismo grupo para continuar cargando equipos.

Archivos:

- `controllers/grupoController.js`
- `controllers/equipoController.js`
- `views/torneos/index.ejs`

Verificado:

```txt
node --check controllers\grupoController.js
node --check controllers\equipoController.js
EJS_OK views/torneos/index.ejs
```

## Cambio posterior: deshabilitar auditoria de accesos

Pedido:

- Deshabilitar por el momento la auditoria que registra accesos a entidad y torneo.
- Mantener auditoria/registro de acciones de negocio.

Aplicado:

- Se quitaron las llamadas a `registrarAccesoAuditoria` en:
  - ingreso a entidad;
  - ingreso a torneo.
- Los helpers quedan en `utils/helpers.js` por si luego se decide usar una tabla separada de metricas.

Archivos:

- `routes/entidadRoutes.js`
- `controllers/torneoController.js`

Verificado:

```txt
node --check routes\entidadRoutes.js
node --check controllers\torneoController.js
```

## Estado final hasta este punto

- Rama:
  - `qa`
- Trabajo probado solo localmente con `localhost`.
- No se hizo commit.
- La auditoria de accesos por navegacion quedo deshabilitada.
- La auditoria/triggers de acciones de negocio se mantiene.
- Se corrigio el flujo de `Grupos` para permanecer en `#grupos` y enfocar el siguiente input de equipo.
- Se implemento cierre por abandono de vista APK/web despues de 3 minutos.
- Se implemento permiso `Delegados modifican iconos` y eliminacion de icono personalizado.
- Se implemento ajuste visual previo de portada.

## Nota sobre fechas vacias

Se reviso el caso:

- Entidad:
  - `A2`
- Torneo:
  - `prueba de jugadores`
- `id_torneo` local:
  - `12`
- Fechas:
  - `4`
  - `5`

Resultado:

- Las fechas tenian partidos en DB.
- Los partidos pertenecian a un grupo oculto en Fixture (`visible_fixture = false`).
- Por eso visualmente parecian fechas vacias.
- Se decidio mantener la regla vigente:
  - si una fecha tiene cualquier encuentro, aunque este oculto, no se elimina.

## SQL local aplicado

Se aplico localmente:

```sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_modificar_iconos_equipo boolean NOT NULL DEFAULT false;
```

Archivo SQL:

- `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`

## Pendiente para PRD

Antes o junto con el despliegue a PRD, aplicar en base PRD:

```sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_modificar_iconos_equipo boolean NOT NULL DEFAULT false;
```

## Workspace observado

```txt
## qa...origin/qa
 M controllers/equipoController.js
 M controllers/grupoController.js
 M controllers/partidoController.js
 M controllers/torneoController.js
 M index.js
 M routes/authRoutes.js
 M routes/entidadRoutes.js
 M routes/equipoRoutes.js
 M routes/torneoRoutes.js
 M views/admin/index.ejs
 M views/entidad/index.ejs
 M views/equipos/administrar.ejs
 M views/equipos/ver.ejs
 M views/index.ejs
 M views/login.ejs
 M views/partials/footer.ejs
 M views/torneos/index.ejs
?? docs/contextos/contexto_027.md
?? docs/contextos/contexto_028.md
?? docs/contextos/contexto_029.md
?? docs/contextos/contexto_030.md
?? docs/contextos/contexto_031.md
?? docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql
?? public/js/
?? public/uploads/24dcff87f3567297ccb67441fecf85ed
?? public/uploads/2d8d7cd67b74a540ad0ef6d106f76627.jpg
?? public/uploads/a61614331b92a43c3cbb5492ac1538df
?? public/uploads/f5dec95462ce830d81d9d2c8e02dfb8e
```

Nota:

- Los uploads nuevos son resultado de pruebas/local.
- Revisar antes de commit si deben versionarse o quedar fuera.
