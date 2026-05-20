# Contexto 034

Fecha: 2026-05-20

## Tema

Preparacion de `qa` para futura prueba PRD, estado Railway, ajustes locales posteriores de APK/Fixture/Finanzas e icono.

## Git / QA

Se preparo y subio a GitHub la rama `qa`.

Commit creado y pusheado:

```txt
763d365 preparar qa para pruebas prd
```

Estado despues del push:

```txt
qa == origin/qa
working tree limpio en ese momento
```

Incluyo:

- cambios acumulados de acceso publico, APK responsive, permisos/delegados, cierre por abandono, fixture, finanzas, auditoria, etc.;
- contextos `027` a `033`;
- SQL pendientes en `docs/sql`;
- `public/js/session-abandon-guard.js`;
- icono Android PRD actualizado en vector nativo;
- `docs/despliegue_prd_20260520.md`;
- `.gitignore` actualizado para ignorar nuevos uploads generados.

No se subieron:

- `docs/_privado/`;
- backups reales;
- uploads nuevos de pruebas.

## Railway / PRD

Railway mostro:

- servicio `torneos` en linea;
- deploy activo:
  - `ajustar visibilidad auditoria y acceso torneo`;
- aviso:
  - `Acceso limitado`
  - `Los despliegues se han pausado temporalmente`.

Luego se compartio texto de estado de Railway:

- interrupcion generalizada;
- problema con Google Cloud;
- recuperacion parcial;
- builds/despliegues no empresariales limitados temporalmente.

Conclusion:

- PRD sigue corriendo con el ultimo deploy exitoso anterior;
- el push a `origin/qa` no cambio PRD;
- no conviene forzar despliegues mientras Railway siga limitado;
- cuando se pueda, el despliegue sera manual o reanudando deploys en Railway.

## APK / URL

Se aclaro:

- `http://10.0.2.2:3000` es local para emulador Android;
- `http://192.168.100.16:3000` es la PC local vista desde celular real en la red;
- `https://torneos-production.up.railway.app` es PRD/nube.

Decision:

- no cambiar la URL local de la APK por ahora;
- mantener el flujo local;
- cuando se genere APK/AAB PRD, resincronizar Capacitor con:

```powershell
$env:CAPACITOR_SERVER_URL="https://torneos-production.up.railway.app"
$env:CAPACITOR_APP_NAME="Torneos"
$env:CAPACITOR_APP_ID="com.torneosv2.prd"
npx.cmd cap sync android
```

Nota:

- para usuario final se recomendo no usar `Torneos PRD` como nombre visible;
- mejor `Torneos` o, si se decide marca comercial, `Torneos Pro`.

## Icono PRD

Se ajusto el icono adaptativo PRD:

- archivo Android:
  - `android/app/src/main/res/drawable/ic_launcher_foreground_prd.xml`
- fondo:
  - `android/app/src/main/res/values/ic_launcher_background.xml`

Estilo:

- fondo azul oscuro;
- cancha verde;
- estrellas;
- pelota grande al frente;
- inspirado en estética profesional, sin copiar logo oficial.

Se creo vista previa local:

- `docs/icono_prd_preview.svg`

Pendiente:

- el preview SVG esta sin commit despues de crearlo;
- no se compilo Gradle porque el permiso para `assembleDebug` fue rechazado.

## SQL / DB PRD

SQL pendientes para PRD cuando se despliegue o cuando corresponda:

- `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`
- `docs/sql/auditoria_jugadores_equipos_solo_altas_bajas_20260520.sql`

Sobre entidad demo:

- se pregunto por eliminar en PRD la entidad codigo `DEMO1`;
- se decidio no borrar fisicamente;
- se recomendo desactivar:

```sql
UPDATE public.entity
SET activo = false
WHERE codigo = 'DEMO1';
```

## Uso de PRD mientras no hay deploy

Se aclaro:

- PRD sigue igual al ultimo deploy activo;
- se puede cargar la entidad real con grupos/equipos si la app abre y funciona;
- no depender aun de funciones nuevas incluidas en el commit `763d365` hasta que Railway despliegue y se apliquen SQL.

Recomendacion para nombres:

- codigo de entidad sin simbolos raros, por ejemplo `MISIONES1`;
- descripcion visible puede ser `MISIONES I`.

## Cambios locales despues del push

Luego del commit/push se siguio trabajando localmente en `views/torneos/index.ejs` y `controllers/torneoController.js`.

### Fixture APK / fechas

Pedido:

- reemplazar multiples botones `Fecha 1`, `Fecha 2`, etc. por un solo selector;
- mostrar la siguiente fecha con encuentros sin jugar;
- agregar flechas izquierda/derecha para subir/bajar fecha;
- retirar filtro superior `Filtrar por fecha calendario`.

Aplicado localmente:

- en `views/torneos/index.ejs`:
  - se reemplazo la grilla visible de fechas por un navegador compacto:
    - flecha izquierda;
    - fecha activa al centro;
    - flecha derecha;
  - se mantienen tabs ocultos internamente para que Bootstrap cambie de panel;
  - las flechas cambian la fecha sin recargar;
  - se actualiza la URL con `?fecha=N#partidos`;
  - se borra `fecha_calendario` al navegar con flechas;
  - se elimino el bloque visual del filtro por fecha calendario.

- en `controllers/torneoController.js`:
  - se dejo de aplicar `req.query.fecha_calendario` para el Fixture;
  - si una URL vieja trae ese parametro, ya no filtra silenciosamente el Fixture;
  - se sigue permitiendo filtro por grupo.

Verificado:

```txt
node --check controllers/torneoController.js
EJS_OK views/torneos/index.ejs
GET http://localhost:3000/ -> 200
```

### Finanzas web

Problema observado:

- pestana `Finanzas` quedaba visualmente chueca/ancha respecto a `Estadisticas`;
- el panel y tabla quedaban corridos hacia la derecha.

Causa:

- `Finanzas` tenia `width: min(1180px...)`;
- usaba card interno con padding y ancho propio;
- `Estadisticas` usa el contenedor normal `#estadisticas > .p-3`.

Aplicado localmente:

- `#finanzas > .p-3` ahora usa el mismo tratamiento visual que `Estadisticas`;
- `.finanzas-panel` queda transparente/sin sombra/sin ancho extra;
- `.card-body` de finanzas queda sin padding;
- tabla financiera queda `width: 100%` y `min-width: 0`;
- columnas visibles se reparten mejor.

Verificado:

```txt
EJS_OK views/torneos/index.ejs
```

## Pedido descartado: Jugadores delegado

Ultimo pedido antes de actualizar este contexto:

- en pestana `Jugadores`, agregar opcion de `Habilitar edicion` / `Ver como admin`;
- al delegado le falta ver esa opcion.

Estado:

- se reviso que ya existen funciones JS:
  - `activarVistaPublicaJugadores`
  - `activarVistaAdminJugadores`
  - `jugadores-vista-publica`
  - `jugadores-admin-only`
- actualmente los botones de modo jugadores se renderizan solo para `rol_id == 3 || rol_id == 99`;
- el delegado queda forzado a vista publica y no tiene boton para habilitar edicion;
- el boton `Nuevo` para delegado esta visible aun en vista publica porque usa clase condicional distinta;
- la ruta `/jugadores/editar/:id` usa `requiereAdmin`, por lo que aunque se muestre lapiz al delegado, backend lo bloquearia.

Se empezo a preparar una solucion, pero fue interrumpida antes de aplicar cambios.

Decision posterior:

- no habilitar modo admin/edicion de `Jugadores` para delegados en esta tanda;
- mantener la edicion administrativa de jugadores reservada a admin/super admin;
- no tocar rutas ni permisos de `routes/jugadorRoutes.js` por este tema antes de subir a QA.

Propuesta tecnica descartada por ahora:

- en `views/torneos/index.ejs`:
  - mostrar botones `Vista usuario` / `Habilitar edicion` tambien para `rol_id == 2`;
  - para delegado, texto del boton:
    - `Habilitar edicion`;
  - hacer que `Nuevo` tambien sea `jugadores-admin-only` para que aparezca solo al habilitar edicion;
  - al habilitar edicion, mostrar columna acciones/lapiz.

- en `routes/jugadorRoutes.js`:
  - cambiar GET/POST `/jugadores/editar/:id` de `requiereAdmin` a `requiereGestionJugadores` si se quiere permitir delegado;
  - mantener `/:id/estado` solo admin.

- en `controllers/jugadorController.js` y `views/jugadores/editar.ejs`:
  - permitir al delegado corregir datos basicos del jugador;
  - no permitirle cambiar `Estado en el torneo` ni `Observaciones`;
  - ocultar esos campos si `rol_id == 2`;
  - validar entidad del jugador contra `req.session.entity_id`.

Importante:

- no se deben abrir permisos de estado/observaciones a delegado por frontend solamente;
- backend debe preservar o bloquear esos campos.

## Estado workspace actual

Hay cambios locales sin commit:

```txt
 M controllers/torneoController.js
 M views/torneos/index.ejs
?? docs/icono_prd_preview.svg
```

El pedido de `Jugadores` para delegados queda descartado por ahora; no bloquea el commit.

Antes de cualquier nuevo commit:

```powershell
git status --short --branch
node --check controllers\torneoController.js
node -e "const ejs=require('ejs'); ejs.compile(require('fs').readFileSync('views/torneos/index.ejs','utf8')); console.log('EJS_OK views/torneos/index.ejs')"
npm.cmd test
```

## Cambio posterior: selector de entidad en login/registro

Pedido:

- En `Iniciar sesion` y `Crear cuenta`, reemplazar el campo texto de entidad por un desplegable.
- El desplegable debe iniciar sin entidad real seleccionada; el usuario debe abrirlo y elegir.

Aplicado:

- `routes/authRoutes.js` carga entidades activas ordenadas por codigo para `/login` y `/registro`.
- `views/login.ejs` muestra un `select` de entidad con placeholder `Seleccione una entidad`.
- `views/registro.ejs` muestra el mismo `select`, requerido para crear cuenta.
- El valor enviado sigue siendo `entidad.codigo`, por lo que se mantiene la validacion existente del backend.

Verificado:

```txt
node --check routes\authRoutes.js
EJS_OK login registro
GET /login -> 200, selector de entidad presente
GET /registro -> 200, selector de entidad presente
```
