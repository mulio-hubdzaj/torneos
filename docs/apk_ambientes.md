# APK por ambiente

La APK no contiene una copia completa de la app. Es una WebView que abre la URL indicada en `CAPACITOR_SERVER_URL`.

## Local

Para probar contra tu servidor local:

```powershell
$env:CAPACITOR_SERVER_URL="http://10.0.2.2:3000"
$env:CAPACITOR_APP_NAME="Torneos"
$env:CAPACITOR_APP_ID="com.torneosv2.app"
npx cap sync android
```

## PRD

Para generar la APK de produccion:

```powershell
$env:CAPACITOR_SERVER_URL="https://torneos-production.up.railway.app"
$env:CAPACITOR_APP_NAME="Torneos PRD"
$env:CAPACITOR_APP_ID="com.torneosv2.prd"
npx cap sync android
```

La version PRD queda identificada visualmente como `Torneos PRD` y usa icono con pelota.

## Regla

Local, QA y PRD deben diferenciarse por:

- URL de servidor;
- nombre visible de APK;
- package id;
- variables de entorno.

El codigo base debe mantenerse alineado entre ambientes.
