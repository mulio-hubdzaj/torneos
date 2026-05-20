# Despliegue QA/PRD 2026-05-20

## Estado base

- Rama de trabajo local: `qa`.
- Remoto: `origin` apunta a `https://github.com/mulio-hubdzaj/torneos.git`.
- Railway PRD quedo documentado previamente como desplegando desde rama `qa`.
- Railway muestra los despliegues pausados temporalmente; subir a GitHub no actualizara PRD hasta reanudar o disparar deploy manual.
- Antes de probar en PRD, confirmar en Railway que el servicio Node sigue apuntando a la rama esperada.

## Base de datos

Backups PRD locales recientes guardados fuera de Git:

- `docs/_privado/db_backups/railway_prd_20260518_2132.sql`
- `docs/_privado/db_backups/railway_prd_20260518_2132.zip`
- `docs/_privado/db_backups/railway_prd_20260518_2129.sql`
- `docs/_privado/db_backups/railway_prd_20260518_2129.zip`

No subir `docs/_privado/` a GitHub.

## SQL a aplicar en PRD

Aplicar manualmente en PostgreSQL PRD antes o junto con el despliegue de codigo:

1. `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`
   - Agrega `torneos.permitir_modificar_iconos_equipo`.
   - Necesario para el switch `Delegados modifican iconos`.

2. `docs/sql/auditoria_jugadores_equipos_solo_altas_bajas_20260520.sql`
   - Reemplaza `public.fn_audit_jugadores_equipos()`.
   - `UPDATE` no audita cambios internos como capitan/camiseta.
   - `INSERT` y `DELETE` auditan altas/bajas con detalle legible.

3. `docs/sql/auditoria_detalle_equipos_delegados_20260520.sql`
   - Reemplaza `public.fn_auditoria_detalle_simple(...)`.
   - Mejora detalle futuro de `equipos` y `delegados_equipos`.
   - Evita inferir mal el equipo afectado cuando cambia un icono sin nombre/id claro.

## APK / Capacitor

El archivo fuente `capacitor.config.js` toma la URL desde:

```powershell
$env:CAPACITOR_SERVER_URL
```

Para PRD:

```powershell
$env:CAPACITOR_SERVER_URL="https://torneos-production.up.railway.app"
$env:CAPACITOR_APP_NAME="Torneos Pro"
$env:CAPACITOR_APP_ID="com.torneosv2.prd"
npx.cmd cap sync android
```

Nota:

- El archivo generado localmente en Android puede apuntar a IP local si se hizo `cap sync` para pruebas.
- Para trabajar localmente no cambiar la URL: `10.0.2.2:3000` es emulador Android y `192.168.100.16:3000` es la PC local en red.
- Antes de generar APK/AAB PRD, resincronizar con la URL HTTPS de PRD.
- Antes de generar APK/AAB `Torneos Pro`, revisar y ajustar el icono adaptativo APK.
- El icono adaptativo PRD usa una pelota frontal con fondo oscuro premium en `android/app/src/main/res/drawable/ic_launcher_foreground_prd.xml`.

## Flujo Git recomendado

1. Verificar:

```powershell
git status --short --branch
node --check index.js
node --check controllers\equipoController.js
node --check controllers\grupoController.js
node --check controllers\partidoController.js
node --check controllers\torneoController.js
node --check routes\authRoutes.js
node --check routes\entidadRoutes.js
node --check routes\equipoRoutes.js
node --check routes\torneoRoutes.js
npm.cmd test
```

2. Commit en `qa`.
3. Push a `origin/qa`.
4. Cuando se pueda desplegar, reanudar despliegues o disparar deploy manual en Railway.
5. Aplicar SQL pendiente en PRD.
6. Probar PRD.
7. Cuando quede validado, copiar/mergear a `main` como version estable.
