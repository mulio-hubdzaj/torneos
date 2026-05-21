# Contexto 036

Fecha: 2026-05-21

## Tema

Ajustes locales pendientes de commit en `qa`: Finanzas vista usuario/admin, modal de carga de items, marcador/estado al cargar goles, visual de ultimos resultados/estadisticas, descarga PDF en Android y pull-to-refresh APK.

## Estado Git

Rama:

- `qa`

Estado al cerrar este contexto:

```txt
qa...origin/qa
 M controllers/partidoController.js
 M controllers/torneoController.js
 M index.js
 M routes/torneoRoutes.js
 M views/torneos/index.ejs
?? docs/contextos/contexto_036.md
```

No se hizo commit ni push en esta tanda.

## Cambios aplicados

### Finanzas: switch visible en vista usuario

Pedido:

- En `Finanzas`, para admin y super admin, dejar visible el switch:
  - `Delegados pueden ver estado de otros equipos`
- En vista usuario debe verse pero no permitir accion.
- Al tocar `Habilitar admin`, debe habilitarse.

Aplicado en `views/torneos/index.ejs`:

- El bloque del switch ya no queda oculto por `.finanzas-admin-only`.
- El input inicia `disabled`.
- `activarVistaPublicaFinanzas()` lo deshabilita.
- `activarVistaAdminFinanzas()` lo habilita.

### Modal carga partido: items sin scroll horizontal web

Problema:

- En version web, la pestana `Items y finanzas` del modal de carga obligaba a usar scroll horizontal.

Aplicado en `views/torneos/index.ejs`:

- La tabla de items usa clase `carga-items-table`.
- Se agregaron clases de columnas para item, monto, cantidad, observacion, total, agregado y accion.
- En escritorio se aplica `table-layout: fixed` con anchos compactos.
- Se mantiene comportamiento responsive para mobile/APK.

Correcciones posteriores:

- Se quito visualmente la columna `Agregado` de la tabla de items para recuperar ancho.
- Se ensancho el modal de carga solo en web:
  - `width: calc(100vw - 12px)`;
  - `max-width: 1440px`.
- Se corrigio una clase que habia quedado por error en la tabla de jugadores.
- Se dejo el overflow visible para no esconder la parte derecha de `Total` y acciones.

### Marcador, carga de goles y estado del partido

Pedidos:

- Al guardar marcador, si el encuentro esta `pendiente` o `programado`, preguntar si quedara:
  - `En curso`
  - `Finalizado`
  - `Cancelar`
- Si el encuentro ya esta `En curso` o `Finalizado`, no preguntar de nuevo.
- Al cargar goles en jugadores, actualizar el marcador del encuentro segun esos goles.
- El admin debe poder ajustar marcador final sin asignar goles a jugadores.
- Al registrar carga de jugadores desde pendiente/programado, preguntar si pasa a `En curso` o `Finalizado`.

Aplicado:

- `views/torneos/index.ejs`
  - Se agrego selector modal de estado con tres acciones: `En curso`, `Finalizado`, `Cancelar`.
  - `guardarMarcador()` pregunta solo si el estado actual no es `en_curso` ni `finalizado`.
  - `guardarCargaEquipoPartido()` pregunta estado si el partido estaba pendiente/programado.
  - La vista del marcador se actualiza en pantalla despues del guardado.

Correccion posterior de regla:

- Agregar items/finanzas NO debe preguntar estado del encuentro.
- La pregunta de `En curso` / `Finalizado` aplica solo:
  - al guardar marcador manual si estaba pendiente/programado;
  - al agregar o modificar goles de un jugador.
- `guardarCargaEquipoPartido()` ahora detecta si el valor de goles del jugador cambio respecto al valor original cargado en el modal.

- `controllers/partidoController.js`
  - `obtenerCargaEquipoPartido` devuelve tambien `goles_a`, `goles_b` y `estado`.
  - `guardarCargaEquipoPartido` acepta `estado_partido`.
  - Suma los goles de jugadores del equipo cargado.
  - Actualiza solo el lado del marcador correspondiente a ese equipo cuando hay goles de jugadores o ya existian goles individuales previos para ese equipo.
  - Si solo se cargan items/finanzas sin goles, no pisa un marcador manual del admin.

### Ultimos resultados / Estadisticas del encuentro

Pedido corregido:

- La cajita de marcador no era para `Fixture`; se revirtio Fixture a su marcador simple.
- La cajita debia aplicarse en:
  - `Ultimos resultados`;
  - modal `Estadisticas del encuentro`;
  - version APK/mobile.
- En detalles de eventos, quitar negritas de jugador/goles.

Aplicado en `views/torneos/index.ejs`:

- `Ultimos resultados` usa:
  - equipo A;
  - marcador centrado en caja;
  - equipo B.
- `Fixture` quedo con marcador simple como estaba.
- `Estadisticas del encuentro` usa marcador centrado en caja.
- Se agregaron ajustes mobile/APK para achicar caja y evitar cortes.
- Jugadores y eventos de goles en detalle quedan sin negrita.

### Descargar PDF de detalle de deuda en Android/APK

Problema:

- En Android/APK, el boton `Descargar PDF` del detalle financiero no hacia nada.
- Causa probable:
  - se generaba un `Blob` local y se descargaba con `a.download`;
  - Android WebView suele ignorar ese flujo.

Aplicado:

- `views/torneos/index.ejs`
  - En web mantiene descarga por `Blob`.
  - En Android/Capacitor manda el PDF generado a una ruta HTTP normal.

- `routes/torneoRoutes.js`
  - Nueva ruta:

```txt
POST /torneos/:id_torneo/finanzas/pdf-descarga
```

- `controllers/torneoController.js`
  - Nuevo handler `descargarPdfFinanzas`.
  - Valida rol `2`, `3` o `99`.
  - Valida entidad del torneo.
  - Recibe `pdf_base64` y `nombre_archivo`.
  - Responde `application/pdf` con `Content-Disposition: attachment`.

- `index.js`
  - Se aumento limite de body a `2mb` para permitir PDFs con varios movimientos.

### APK: refresh que queda cargando

Problema:

- Si por accidente se actualizaba desde APK, la pantalla podia quedar sin terminar de refrescar.
- En web volvia enseguida.

Causa probable:

- El pull-to-refresh propio reenviaba a la misma URL.
- Android WebView puede ignorar navegaciones a la misma URL y dejar el indicador en `Actualizando...`.

Aplicado en `views/torneos/index.ejs`:

- Al refrescar desde APK/mobile se agrega parametro temporal:

```txt
_apk_refresh=<timestamp>
```

- Se usa `window.location.replace(...)` para forzar navegacion.
- Al cargar, se limpia `_apk_refresh` con `history.replaceState`.
- Se agrego timeout de 12 segundos para apagar el indicador y mostrar aviso si no termina.

### Limpieza de logs de auditoria

Problema:

- Se repetia en consola:

```txt
>>> registrarAuditoria deshabilitada (auditoría se maneja por triggers en BD)
```

Aplicado:

- `utils/helpers.js`
  - Se quito el `console.log` de `registrarAuditoria`.
  - La funcion queda neutralizada y sigue devolviendo `true`, sin cambiar el comportamiento.

### Auditoria: items de equipo sin afectado

Problema observado:

- Al cargar un item financiero a un equipo, Auditoria mostraba:
  - pantalla: `Items equipo`;
  - afectado: `-`;
  - detalle: `Se creo items_equipo: BOTELLA DE AGUA`.
- No indicaba a que equipo correspondia el item, por ejemplo `RIVER`.

Aplicado:

- `controllers/torneoController.js`
  - `obtenerAfectadoAuditoria` tambien intenta inferir equipo en registros futuros de Finanzas con formato `Encuentro #... - EQUIPO`.
  - Correccion posterior:
    - el parser ahora reconoce prefijos `items_equipo: EQUIPO; ...`;
    - tambien infiere equipo en `Se elimino finanzas: Encuentro #... - EQUIPO`, no solo en `Se creo finanzas`.

- SQL preparado:
  - `docs/sql/auditoria_items_equipo_finanzas_equipo_20260521.sql`
  - Reemplaza `public.fn_auditoria_detalle_simple(...)`.
  - Para registros futuros de `items_equipo`, el detalle quedara con prefijo:

```txt
items_equipo: RIVER; Se cargo item BOTELLA DE AGUA al equipo RIVER
```

Nota:

- No reescribe auditoria vieja. Los registros ya guardados que solo dicen `BOTELLA DE AGUA` no tienen el equipo en el texto, por lo que no se puede reconstruir de forma confiable desde esa fila.

## Verificaciones ejecutadas

```powershell
node --check index.js
node --check controllers\partidoController.js
node --check controllers\torneoController.js
node --check routes\torneoRoutes.js
node --check utils\helpers.js
node -e "const ejs=require('ejs'),fs=require('fs'); ejs.compile(fs.readFileSync('views/torneos/index.ejs','utf8')); console.log('EJS_OK views/torneos/index.ejs')"
npm.cmd test
git diff --check
```

Resultados:

- Checks JS OK.
- EJS OK.
- `npm.cmd test` OK, el proyecto informa `No hay tests definidos`.
- `git diff --check` sin errores; solo avisos CRLF.

## Pendiente recomendado

Antes de commit/push:

1. Probar manualmente en web:
   - switch Finanzas visible/deshabilitado en vista usuario;
   - habilitar admin y cambiar switch;
   - modal carga items sin scroll horizontal;
   - guardar marcador desde pendiente/programado;
   - cargar goles a jugadores y verificar marcador;
   - ajustar marcador manual sin goles individuales.
2. Probar en APK:
   - PDF de detalle de deuda;
   - pull-to-refresh accidental;
   - `Ultimos resultados` y modal `Estadisticas del encuentro` con caja de marcador.
3. Si todo esta OK:

```powershell
git status --short --branch
git diff --check
git add controllers/partidoController.js controllers/torneoController.js index.js routes/torneoRoutes.js utils/helpers.js views/torneos/index.ejs docs/sql/auditoria_items_equipo_finanzas_equipo_20260521.sql docs/contextos/contexto_036.md
git commit -m "ajustar finanzas marcador pdf y refresh apk"
git push origin qa
```
