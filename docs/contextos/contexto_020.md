# Contexto 020

Fecha: 2026-05-14

## Estado acordado

- Se decide avanzar con una primera beta Android para Play Store mas adelante.
- La version Android inicial sera una app contenedora/WebView con Capacitor.
- La APK no contiene una copia completa independiente de la app.
- La APK carga la web desde un servidor configurado en Capacitor.
- En pruebas locales, la app Android apunta a la PC servidor por IP local.
- Para Play Store se debe cambiar a una URL publica HTTPS.

## Beta Android con Capacitor

Se instalo Capacitor:

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`

Archivos/carpetas creados:

- `capacitor.config.js`
- `android-web/index.html`
- `android/`
- `android/local.properties`

Configuracion actual:

- `appId`: `com.torneosv2.app`
- `appName`: `Torneos`
- `webDir`: `android-web`
- URL por defecto en `capacitor.config.js`:
  - `http://10.0.2.2:3000`
- Para celular real se usa variable:
  - `CAPACITOR_SERVER_URL`

Ejemplo usado para celular real:

```powershell
cd C:\torneos_v2
$env:CAPACITOR_SERVER_URL="http://192.168.100.16:3000"
npx.cmd cap sync android
```

Luego compilar:

```powershell
cd C:\torneos_v2\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat assembleDebug
```

APK debug generado:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\app-debug.apk
```

Notas tecnicas:

- `android/app/src/main/assets/capacitor.config.json` es generado por `npx.cmd cap sync android`.
- Ese archivo contiene la URL final que abre la APK.
- Para confirmar IP configurada, revisar:

```json
"server": {
  "url": "http://192.168.100.16:3000",
  "cleartext": true
}
```

## Requisitos encontrados para compilar Android

- Java 25 instalado, pero no sirve con Gradle/Android actual:
  - error observado: `Unsupported class file major version 69`
- Java 17 instalado, pero queda corto para Capacitor 8:
  - error observado: `invalid source release: 21`
- Android Studio incluye JDK 21 en:
  - `C:\Program Files\Android\Android Studio\jbr`
- Con ese JDK 21 la compilacion debug funciono.
- Android SDK ubicado en:
  - `C:\Users\Julio Mendoza\AppData\Local\Android\Sdk`
- Se creo:
  - `android/local.properties`

Contenido:

```properties
sdk.dir=C\:\\Users\\Julio Mendoza\\AppData\\Local\\Android\\Sdk
```

## Acceso web desde otro equipo/celular

IP de la PC servidor usada:

```txt
192.168.100.16
```

Levantar app:

```powershell
cd C:\torneos_v2
npm.cmd start
```

Probar local:

```txt
http://localhost:3000
```

Probar desde otro equipo/celular:

```txt
http://192.168.100.16:3000
```

Diagnostico realizado:

- En PC servidor:

```powershell
Test-NetConnection 192.168.100.16 -Port 3000
```

Resultado local:

```txt
TcpTestSucceeded : True
```

- Desde otra PC:

```powershell
ping 192.168.100.16
```

Resultado:

```txt
PingSucceeded : True
```

- Desde otra PC:

```powershell
Test-NetConnection 192.168.100.16 -Port 3000
```

Resultado inicial:

```txt
TcpTestSucceeded : False
```

Confirmacion de Node escuchando:

```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Resultado:

```txt
0.0.0.0  3000  Listen  22716
```

Ruta de Node:

```powershell
$node = (Get-Process -Id 22716).Path
$node
```

Resultado:

```txt
C:\Program Files\nodejs\node.exe
```

Reglas probadas:

```powershell
New-NetFirewallRule -DisplayName "Torneos App Local 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "Torneos App 3000 All Profiles Test" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "Torneos Node App" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow -Profile Any
```

La conexion termino funcionando al apagar temporalmente el firewall:

```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

Importante:

- No dejar firewall apagado.
- Volver a activarlo al terminar:

```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

Resumen simple guardado para proximas pruebas:

```txt
ABRIR APP EN RED LOCAL

1. En la PC servidor:
cd C:\torneos_v2
npm.cmd start

2. Ver IP:
ipconfig

3. Confirmar que Node escucha:
Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalAddress,LocalPort,State,OwningProcess

Debe salir:
0.0.0.0  3000  Listen

4. Probar desde otro equipo/celular:
http://192.168.100.16:3000
```

Resumen para cerrar:

```txt
CERRAR Y RESTABLECER

1. Detener app:
Ctrl + C

2. Activar firewall:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True

3. Eliminar reglas si corresponde:
Remove-NetFirewallRule -DisplayName "Torneos App Local 3000"
Remove-NetFirewallRule -DisplayName "Torneos App 3000 All Profiles Test"
Remove-NetFirewallRule -DisplayName "Torneos Node App"

4. Confirmar puerto cerrado:
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

## Ajuste visual movil/app

Problema observado en captura del celular:

- Barra superior demasiado alta.
- Tabs ocupaban demasiado espacio vertical.
- Botones demasiado grandes.
- La pantalla parecia una version de escritorio comprimida.

Se aclaro:

- La APK carga la misma vista web del servidor.
- Por eso los ajustes visuales se hacen en `views/torneos/index.ejs`.
- Si la APK apunta al servidor local, no hace falta recompilar para ver cambios de vista.
- Basta refrescar/cerrar y abrir la app si quedo cacheada.

Cambios aplicados en `views/torneos/index.ejs`:

- Se agrego clase al body:
  - `torneos-page`
- Se agrego clase a botones superiores:
  - `app-nav-actions`
- Se agrego clase a accesos rapidos del dashboard:
  - `dashboard-quick-actions`
- Se agrego CSS responsive dentro de la vista:
  - neutraliza CSS global que agrandaba `.btn` y `.card`;
  - compacta navbar;
  - tabs superiores como chips horizontales con scroll;
  - botones superiores mas pequenos;
  - dashboard con grilla mas compacta;
  - cards y tablas con menos padding en movil.

Archivos tocados en esta tanda:

- `package.json`
- `package-lock.json`
- `capacitor.config.js`
- `android-web/index.html`
- `android/local.properties`
- `android/`
- `views/torneos/index.ejs`
- `public/contexto_020.md`

## Pendientes

### Para Android / Play Store

- Definir dominio publico HTTPS.
- Cambiar `CAPACITOR_SERVER_URL` a ese dominio.
- Crear icono/splash definitivos.
- Crear keystore de firma.
- Generar `app-release.aab`.
- Subir a prueba interna en Play Console.
- Definir si la app sera:
  - gratis;
  - freemium;
  - pro por suscripcion;
  - pro por torneo.

### Para UX movil

- Probar en celular real el nuevo layout.
- Ajustar si aun queda grande:
  - navbar;
  - tabs;
  - botones verdes;
  - cards del dashboard;
  - tablas en fixture/usuarios/auditoria.

### Seguridad red local

- Revisar por que las reglas de firewall no bastaron y solo funciono apagando firewall temporalmente.
- No usar firewall apagado como solucion permanente.
- Para pruebas futuras, buscar regla exacta que permita Node/puerto sin abrir todo.

## Verificaciones realizadas

- `npm.cmd test`
- `node --check index.js`
- `node --check capacitor.config.js`
- `.\gradlew.bat assembleDebug` usando JDK 21 de Android Studio
- `Invoke-WebRequest http://localhost:3000 -UseBasicParsing`

Resultados:

- APK debug generado correctamente.
- Servidor local respondio `STATUS=200`.
- Tests del proyecto siguen siendo placeholder:

```txt
No hay tests definidos
```
