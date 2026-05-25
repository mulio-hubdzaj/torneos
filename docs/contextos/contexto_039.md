# Contexto 039

Fecha: 2026-05-25

## Tema

Sorteos combinados, eliminacion segura de fechas/encuentros, ajustes APK PRD y preparacion para despliegue.

## Cambios principales

- En `Grupos`, se agrego boton central `Sorteos combinados`.
- El boton queda visible para admin/super admin y solo se habilita si hay al menos dos grupos sin sorteo y con equipos suficientes.
- El sorteo combinado:
  - selecciona grupos sin sorteo;
  - genera fixture interno por grupo;
  - cruza equipos libres de la misma fecha como `CONV`;
  - muestra `CONV` en Fixture.
- En el modal combinado:
  - `Solo ida` e `Ida y vuelta` calculan cantidad sugerida fija;
  - se agrego checkbox para permitir cantidad exacta manual;
  - la ayuda visual advierte cuando una cantidad exacta puede quedar dispareja.
- Se corrigio eliminacion de fecha:
  - permite eliminar fecha si no tiene encuentros jugados ni cargas;
  - bloquea si hay goles, estado en curso/finalizado, items, finanzas u otras cargas.
- Se bloqueo visualmente el borrado individual de encuentros con cargas registradas.
- Se corrigio SQL de `items_equipo` al compactar fechas libres, porque esa tabla no tiene `id_torneo`.

## APK / PRD

- Capacitor fue sincronizado para PRD con:

```txt
CAPACITOR_SERVER_URL=https://torneos-production.up.railway.app
CAPACITOR_APP_NAME=Torneos Pro
CAPACITOR_APP_ID=com.torneosv2.prd
```

- APK debug PRD generada:

```txt
C:\torneos_v2\android\app\build\outputs\apk\debug\app-debug.apk
```

- Config verificada dentro de `android/app/src/main/assets/capacitor.config.json`:

```json
{
  "appId": "com.torneosv2.prd",
  "appName": "Torneos Pro",
  "server": {
    "url": "https://torneos-production.up.railway.app",
    "cleartext": false
  }
}
```

## Proteccion de imagenes PRD

- Se verifico no incluir cambios en:
  - `public/`
  - `public/uploads/`
  - `android/app/src/main/assets/public`
- Regla recordada:
  - no enviar uploads locales;
  - conservar en PRD portadas de torneos e iconos de equipos.

## Verificaciones

Ejecutadas correctamente:

```txt
node --check index.js
node --check controllers/equipoController.js
node --check controllers/partidoController.js
node --check controllers/torneoController.js
node --check routes/partidoRoutes.js
node --check routes/torneoRoutes.js
EJS_OK vistas principales
npm test
git diff --check
gradlew assembleDebug
```

Notas:

- `npm test` informa `No hay tests definidos`.
- `git diff --check` solo mostro avisos CRLF.
