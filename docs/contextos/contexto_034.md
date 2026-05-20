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

## Cambio posterior: ajustes APK/web post deploy QA

Pedidos:

- Al cerrar sesion, enviar a `https://torneos-production.up.railway.app/`.
- En APK, la vista publica/usuario de equipo se cortaba horizontalmente.
- En el dashboard inicial, agregar scroll a `Tabla de posiciones` como en `Proximos encuentros`.
- Ocultar cards del dashboard si no tienen datos, como ya se hacia con `En curso`.

Aplicado:

- `routes/authRoutes.js` redirige `/logout` a `LOGOUT_REDIRECT_URL` o, por default, a `https://torneos-production.up.railway.app/`.
- `views/equipos/ver.ejs` agrega `viewport`, contenedor responsive, scroll horizontal para jugadores y ajustes mobile.
- `views/torneos/index.ejs` agrega scroll a la tabla de posiciones del dashboard.
- `views/torneos/index.ejs` oculta las cards vacias de tabla, goleadores, en curso, ultimos resultados y proximos encuentros.
- Si el dashboard no tiene ningun dato, se muestra un aviso unico en lugar de varias cards vacias.

Verificado:

```txt
node --check routes\authRoutes.js
EJS_OK equipo torneo
npm.cmd test
GET /logout -> 302 Location https://torneos-production.up.railway.app/
```

## Cambio posterior: auditoria afectado equipo/delegados

Observado en PRD:

- Cambios de icono de equipo podian mostrar `Equipo / afectado` vacio o incluso otro equipo con icono default.
- `delegados_equipos` mostraba `registro` y detalle generico.
- Algunos registros viejos de `jugadores_equipos` seguian mostrando `UPDATE` de camiseta/capitan; esos registros no se reescriben.

Aplicado en codigo:

- `controllers/torneoController.js` deja de adivinar el equipo afectado por la ruta del icono.
- Si el detalle contiene `equipo de X a Y`, usa el equipo destino como afectado.
- Si el detalle solo dice cambio de icono sin id/nombre, muestra afectado generico `Equipo` en vez de inferir mal.
- `delegados_equipos` se muestra como pantalla `Delegado equipo`.

SQL preparado para PRD:

- `docs/sql/auditoria_detalle_equipos_delegados_20260520.sql`
- Reemplaza `public.fn_auditoria_detalle_simple(...)`.
- Para registros futuros:
  - `equipos` queda con prefijo `equipos: NOMBRE_EQUIPO; ...`;
  - `delegados_equipos` queda como asignacion/baja de delegado con usuario, documento, equipo y torneo.

Nota:

- No modifica datos cargados ni auditoria vieja.
- Antes de validar de nuevo `jugadores_equipos`, conviene revisar en PRD si existe mas de un trigger sobre esa tabla.

## Cambio posterior: bloqueo claro al eliminar equipo

Observado en PRD:

- Se creo un equipo sin partidos/cruces.
- Se asigno un jugador.
- Al eliminar el equipo, la app intento borrar fisicamente y fallo por FK:
  - `jugadores_equipos_id_equipo_fkey`

Aplicado:

- `controllers/equipoController.js` valida antes de eliminar si el equipo tiene:
  - logo personalizado;
  - delegados asignados;
  - jugadores asignados.
- Si encuentra alguno, bloquea la eliminacion con mensaje claro.
- El mensaje recomienda quitar esos datos o desactivar el equipo para conservar historial.
- Si ocurre un error inesperado, vuelve al torneo/pestana correspondiente en vez de mandar a la pantalla generica de torneos.

## Cambio posterior: registro/login con teclado APK

Observado:

- En `Crear cuenta`, al abrir el teclado en APK/WebView se subia toda la seccion.
- El primer campo quedaba perdido arriba de la pantalla.
- El formulario se veia como pagina de escritorio porque faltaba viewport y se usaba centrado vertical con `vh-100`.

Aplicado:

- `views/registro.ejs` agrega `viewport`, fondo de estadio y layout scrolleable.
- `views/registro.ejs` reemplaza el centrado vertical forzado por inicio superior con padding seguro.
- `views/registro.ejs` usa tarjeta responsive y campos con altura estable.
- `views/login.ejs` recibe el mismo criterio preventivo para evitar el problema al abrir teclado.

Verificado:

```txt
EJS_OK auth torneos
node --check controllers\equipoController.js
node --check controllers\torneoController.js
```

## Cambio posterior: home inicial mas pareja

Pedido:

- Confirmar que cerrar sesion manual y cierre por abandono vuelven a `https://torneos-production.up.railway.app/`.
- Ajustar la pantalla inicial para que se vea mas pareja.

Estado confirmado:

- `/logout` redirige a `LOGOUT_REDIRECT_URL` o por default a `https://torneos-production.up.railway.app/`.
- `public/js/session-abandon-guard.js` redirige a `/logout?motivo=abandono`, por lo que tambien termina en la raiz oficial.

Aplicado:

- `views/index.ejs` unifica ancho de las cards principales.
- Se ajusta espaciado, botones, titulo y responsive mobile/APK.
- La pantalla inicial mantiene el fondo de estadio y queda alineada visualmente.

Verificado:

```txt
EJS_OK main auth torneos
```

## Corte de contexto: pausa en ajuste de deuda

Estado:

- Se pidio mejorar la vista de detalles de deuda agrupando por fecha.
- El trabajo fue interrumpido antes de completar el ajuste visual.
- No continuar desde este punto sin revisar primero el diff actual de `views/torneos/index.ejs`.
- Quedan cambios locales acumulados sin subir.

## Cambio posterior: menu superior APK

Pedido:

- En APK, ocultar los botones `Ir a Torneos`, `Ir a Entidades` y `Cerrar sesion`.
- Mostrarlos desde el icono de tres rayitas ubicado arriba a la derecha.
- Ocultar el menu automaticamente despues de 3 segundos.

Aplicado en `views/torneos/index.ejs`:

- Se agrego boton `appNavToggle` con icono `bi-list`.
- En mobile/APK, `.app-nav-actions` queda oculto por defecto.
- Al tocar el boton, se muestra un panel flotante con las acciones.
- El panel se cierra:
  - a los 3 segundos;
  - al tocar fuera;
  - al elegir una accion;
  - al cambiar de pestana.
- En escritorio se conserva el comportamiento anterior.

Verificado:

```txt
EJS_OK views/torneos/index.ejs
```

## Cambio posterior: buscador Finanzas y lupa Usuarios APK

Pedido:

- Agregar buscador en pestana `Finanzas` para web y APK.
- Visible para admin y super admin.
- Buscar por nombre de equipo.
- Usar como referencia el buscador de `Usuarios`, que funciona bien en APK.
- Corregir que la lupa de `Usuarios` se pierde visualmente por quedar blanca.

Aplicado en `views/torneos/index.ejs`:

- `Finanzas` ahora tiene buscador por nombre de equipo para `rol_id = 3` y `rol_id = 99`.
- El filtro funciona:
  - mientras se escribe;
  - con Enter;
  - con boton de lupa.
- Se agrego contador:
  - `Equipos visibles: X / Y`.
- Si no hay coincidencias, se muestra mensaje claro.
- El filtro se reaplica despues de sincronizar resumen financiero desde servidor.
- La lupa de `Usuarios` y `Finanzas` usa clase `btn-buscar-gris`, con fondo gris claro e icono oscuro para que sea visible en APK.

Verificado:

```txt
EJS_OK views/torneos/index.ejs
```
