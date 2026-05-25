# Contexto 037

Fecha: 2026-05-25

## Tema

Preparacion de prueba local APK/WebView antes de enviar a PRD: backup Railway PRD, servidor local por IP LAN, descarga PDF desde celular, actualizacion visual de horarios sin recargar y cancha en segundo renglon del fixture.

## Estado Git

Rama:

- `qa`

Estado observado al crear este contexto:

```txt
 M controllers/equipoController.js
 M controllers/partidoController.js
 M controllers/torneoController.js
 M index.js
 M routes/torneoRoutes.js
 M views/torneos/index.ejs
```

Nota:

- `controllers/equipoController.js` ya tenia un cambio menor: se comento un `console.log` de `BuscarJugadores`.
- No se hizo commit ni push en esta tanda.

## Backup PRD

El usuario genero una nueva copia de seguridad Railway PRD desde la PC.

Archivos mostrados por la consola:

```txt
C:\torneos_v2\docs\_privado\db_backups\railway_prd_20260525_1255.sql
C:\torneos_v2\docs\_privado\db_backups\railway_prd_20260525_1255.zip
C:\Users\Julio Mendoza\OneDrive\TORNEO_PRD_BK\railway_prd_20260525_1255.zip
```

Tamanos observados:

- SQL: `148391`
- ZIP: `20615`

El script informo:

```txt
Backup creado correctamente
```

## APK local / red local

Objetivo:

- Probar la APK contra el servidor local antes de enviar ajustes a PRD.

IP LAN compartida por el usuario:

```txt
192.168.63.167
```

URL usada por la APK local:

```txt
http://192.168.63.167:3000
```

Configuracion Capacitor sincronizada para prueba local:

```json
{
  "appId": "com.torneosv2.local",
  "appName": "Torneos Local",
  "server": {
    "url": "http://192.168.63.167:3000",
    "cleartext": true
  }
}
```

APK local generada:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\torneos-local.apk
```

El usuario primero vio en Android:

```txt
net::ERR_ADDRESS_UNREACHABLE
```

Luego confirmo:

```txt
ya me funciona y puedo acceder
```

Servidor local reiniciado al final de la tanda:

```txt
SERVER_PID=3712
STATUS=200
```

## Cambio: horarios comunes sin recargar

Problema:

- Al guardar fecha/hora comun con intervalos, los datos se guardaban pero la pantalla no se actualizaba sola.
- Habia que recargar manualmente.

Aplicado en `views/torneos/index.ejs`:

- Se agregaron clases a las celdas web:
  - `.fixture-fecha-cell`
  - `.fixture-hora-cell`
- `guardarHorariosComunes(numeroFecha)` ahora actualiza en memoria:
  - fecha visible de cada fila;
  - hora visible de cada fila;
  - detalle mobile/APK;
  - boton/tab de fecha activa.

Esto evita depender de recarga para ver el resultado.

## Cambio: editar horario/cancha sin recargar

Problema:

- Al editar un encuentro y seleccionar cancha, la cancha quedaba guardada pero no aparecia visualmente hasta recargar.

Aplicado en `controllers/partidoController.js`:

- `actualizarHorario` detecta request JSON por `Accept: application/json` o XHR.
- Mantiene el comportamiento anterior de redirect/flash para formularios normales.
- En modo JSON devuelve:

```js
{
  success: true,
  message: 'Horario actualizado correctamente',
  partido: {
    id_partido,
    fecha,
    fecha_formateada,
    hora,
    id_cancha,
    nombre_cancha
  }
}
```

Aplicado en `views/torneos/index.ejs`:

- El formulario `#formEditarHorario` se intercepta con `fetch`.
- Se agrego `actualizarHorarioPartidoEnVista(partidoId, partido)`.
- Al guardar:
  - cierra el modal;
  - actualiza fecha/hora en la fila web;
  - actualiza fecha/hora en detalle mobile/APK;
  - actualiza o crea el texto de cancha;
  - actualiza los `data-*` del boton editar;
  - marca dashboard de inicio como desactualizado.

## Cambio: cancha en segundo renglon

Pedido:

- No agregar columna nueva.
- Si el partido tiene cancha, mostrarla abajo del encuentro.
- Si no tiene cancha, no mostrar nada.
- Aplicar para web y APK sin modificar la vista principal.

Aplicado en `views/torneos/index.ejs`:

- La fila detalle queda oculta por defecto:

```css
.torneos-page #partidos .partido-detalle-row {
  display: none;
}
```

- Si existe cancha, la fila detalle se muestra:

```css
.torneos-page #partidos .partido-detalle-row.partido-detalle-row-cancha {
  display: table-row;
}
```

- En web, dentro de esa segunda fila se ocultan grupo/fecha/hora y queda solo cancha.
- En mobile/APK se conserva el detalle habitual, aprovechando el mismo renglon responsive.

## Cambio: PDF finanzas en Android/APK

Problema:

- En APK/celular, el boton `Descargar PDF` abria Chrome pero quedaba en:

```txt
about:blank
```

Causa:

- Se abria una ventana externa antes de tener una URL real del PDF.
- Android/Chrome quedaba en blanco si el PDF todavia no estaba preparado.

Aplicado en `controllers/torneoController.js`:

- Se agrego un almacen temporal en memoria:
  - `pdfFinanzasTemporales`
  - TTL: `10 minutos`
- Se agrego helper `leerPdfFinanzasDesdeBody`.
- `descargarPdfFinanzas` reutiliza el helper.
- Nuevo handler `prepararPdfFinanzas`:
  - valida torneo;
  - valida roles `2`, `3`, `99`;
  - valida entidad;
  - valida que el contenido sea PDF;
  - guarda el PDF temporalmente;
  - devuelve URL HTTP normal.
- Nuevo handler `verPdfFinanzasTemporal`:
  - recibe token;
  - responde `application/pdf`;
  - usa `Content-Disposition: inline`;
  - usa `Cache-Control: no-store`.

Aplicado en `routes/torneoRoutes.js`:

```txt
POST /torneos/:id_torneo/finanzas/pdf-preparar
GET  /torneos/:id_torneo/finanzas/pdf/:token
```

Aplicado en `index.js`:

- Se permite como ruta publica controlada:

```txt
/torneos/:id_torneo/finanzas/pdf/:token
```

- Se registra antes de `app.use('/torneos', requiereSesion, torneoRoutes)`.

Aplicado en `views/torneos/index.ejs`:

- En Android/Capacitor ya no se abre `about:blank`.
- Ahora:
  1. prepara el PDF con `fetch`;
  2. recibe una URL real;
  3. muestra modal `PDF listo`;
  4. el usuario toca `Abrir PDF`.

Flujo esperado en APK:

1. Tocar `Descargar PDF`.
2. Esperar modal `PDF listo`.
3. Tocar `Abrir PDF`.
4. Chrome abre una URL real del servidor local, no `about:blank`.

### Correccion posterior del boton `Abrir PDF`

Resultado de prueba del usuario:

- El modal `PDF listo` aparecia correctamente.
- Al tocar `Abrir PDF`, no se abria el navegador.

Causa probable:

- Android WebView no siempre respeta un enlace HTML con `target="_blank"` dentro de la WebView.

Aplicado:

- Se instalo plugin oficial:

```txt
@capacitor/browser@8.0.3
```

- Se sincronizo Android:

```txt
npx.cmd cap sync android
```

- Capacitor detecto:

```txt
Found 1 Capacitor plugin for android:
@capacitor/browser@8.0.3
```

- En `views/torneos/index.ejs`, `Abrir PDF` ahora es un boton JS.
- La funcion nueva `abrirUrlExternaPdf(url)` intenta, en orden:
  - `window.Capacitor.Plugins.Browser.open({ url })`;
  - `window.open(url, '_blank')`;
  - `intent://...` en Android;
  - `window.location.href = url` como ultimo recurso.

Compilacion:

- Con Java 25 fallo Gradle:

```txt
Unsupported class file major version 69
```

- Con Java 17 fallo porque Capacitor 8 requiere source 21:

```txt
invalid source release: 21
```

- Compilo correctamente usando JDK 21 de Android Studio:

```txt
JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
```

APK local actualizado:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\torneos-local.apk
```

Tamano observado:

```txt
4431217
```

## Verificaciones ejecutadas

Comandos ejecutados correctamente:

```txt
node --check controllers/partidoController.js
node --check controllers/torneoController.js
node --check routes/torneoRoutes.js
node --check index.js
```

Vista EJS:

```txt
EJS_OK views/torneos/index.ejs
```

Servidor local:

```txt
http://localhost:3000/
STATUS=200
```

## Pendiente inmediato

Probar en celular/APK local:

- `Descargar PDF` de detalle financiero:
  - debe mostrar modal `PDF listo`;
  - al tocar `Abrir PDF`, debe abrir Chrome con PDF real.
- Editar horario/cancha:
  - al seleccionar cancha debe aparecer abajo del encuentro sin recargar.
- Guardar horarios comunes con intervalo:
  - fecha/hora deben actualizarse en pantalla sin recargar.

Si todo queda bien en local:

- revisar diff final;
- commitear en `qa`;
- pushear;
- luego enviar/forzar deploy PRD cuando el usuario lo indique.

## Cambio posterior: PDF APK verificado

Resultado de prueba local en celular:

- La APK local corregida ya descarga/abre correctamente el PDF.
- Se confirmo que la APK debe apuntar a la IP LAN del equipo fisico:

```txt
http://192.168.63.167:3000
```

- Se detecto que al sincronizar Capacitor sin variables de entorno, la APK volvio a:

```txt
http://10.0.2.2:3000
```

Ese host es solo para emulador Android, no para celular fisico.

Correccion aplicada:

```txt
CAPACITOR_SERVER_URL=http://192.168.63.167:3000
CAPACITOR_APP_NAME=Torneos Local
CAPACITOR_APP_ID=com.torneosv2.local
npx.cmd cap sync android
```

Se recompilo usando JDK 21 de Android Studio.

APK local final de esta tanda:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\torneos-local.apk
```

## Cambio posterior: autocompletado de contrasena en APK

Objetivo aclarado:

- No guardar contrasenas de delegados/admins en la app ni en la base.
- Se quiere que cada telefono use su propio gestor de contrasenas/autocompletado, por ejemplo Google Password Manager.

Aplicado en vistas:

- `views/login.ejs`
  - `form autocomplete="on"`;
  - documento con `autocomplete="username"` e `inputmode="numeric"`;
  - contrasena con `autocomplete="current-password"`;
  - entidad con `autocomplete="organization"`.

- `views/registro.ejs`
  - `form autocomplete="on"`;
  - nombre/apellido/correo/documento con pistas de autocompletado;
  - documento con `autocomplete="username"`;
  - nueva contrasena con `autocomplete="new-password"`;
  - entidad con `autocomplete="organization"`.

- `views/cambiar_contrasena.ejs`
  - `form autocomplete="on"`;
  - nueva contrasena y confirmacion con `autocomplete="new-password"`.

- `views/restablecer_contrasena.ejs`
  - `form autocomplete="on"`;
  - documento/correo/entidad con pistas de autocompletado;
  - nueva contrasena y confirmacion con `autocomplete="new-password"`.

Aplicado en APK nativa:

- `android/app/src/main/java/com/torneosv2/app/MainActivity.java`
  - Se habilito autofill sobre la WebView:

```java
WebView webView = getBridge().getWebView();
if (webView != null) {
    webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
}
```

Verificaciones:

```txt
EJS_OK views/login.ejs
EJS_OK views/registro.ejs
EJS_OK views/cambiar_contrasena.ejs
EJS_OK views/restablecer_contrasena.ejs
```

Resultado de prueba local:

- En local/APK con `http://192.168.63.167:3000`, Android no mostro el aviso de guardar contrasena.
- Se decidio no seguir forzando este punto en local.
- Pendiente probar al final en produccion con HTTPS:

```txt
https://torneos-production.up.railway.app
```

Notas:

- El autoguardado de contrasenas en WebView no se puede garantizar desde HTML/JS.
- Depende del proveedor de autocompletado del telefono, version Android/WebView, configuracion de Google Password Manager y, probablemente, del uso de HTTPS real.
- Si en PRD tampoco aparece, la alternativa seria evaluar integracion nativa con Android Credential Manager, pero no se implemento en esta tanda.

## Estado final antes de cerrar

Servidor local activo:

```txt
http://192.168.63.167:3000
```

APK local usada para prueba:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\torneos-local.apk
```

Pendientes para retomar:

- Validar en PRD/HTTPS si Google Password Manager ofrece guardar/autocompletar.
- Revisar diff final completo antes de commit.
- Confirmar si se incluiran cambios nativos Android y `@capacitor/browser` en la APK PRD.
- Preparar commit/push a `qa` cuando el usuario lo pida.
