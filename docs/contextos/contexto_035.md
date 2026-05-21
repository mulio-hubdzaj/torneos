# Contexto 035

Fecha: 2026-05-21

## Tema

Ultimos ajustes enviados a `qa`: tabs sin salto por Torneos, permiso financiero para delegados, auditoria resumida de sorteo y limpieza de logs. Queda pendiente desplegar a PRD.

## Estado Git

Rama:

- `qa`

Commit creado y pusheado:

```txt
da8e78c ajustar finanzas tabs y auditoria sorteo
```

Estado despues del push:

```txt
qa == origin/qa
working tree limpio
```

## Cambios incluidos

### Navegacion por pestanas

Problema observado en PRD:

- En web y APK, al recargar o filtrar dentro de cualquier pestana, la vista pasaba visualmente por `Torneos`.
- Esto ocurria porque el hash `#finanzas`, `#estadisticas`, `#partidos`, etc. no llega al backend.
- El servidor renderizaba inicialmente `Torneos` y luego el JS activaba la pestana correcta.

Aplicado:

- Se agrego parametro `tab=...` para indicar al backend la pestana inicial.
- El render inicial marca activa la pestana correcta.
- Se reforzaron recargas, filtros y redirects internos para conservar:
  - `tab=partidos#partidos`
  - `tab=estadisticas#estadisticas`
  - `tab=finanzas#finanzas`
  - `tab=jugadores#jugadores`
  - `tab=equipos#equipos`
- Pull-to-refresh conserva la pestana activa.
- Cancelar/volver desde formularios de jugadores conserva `Jugadores`.

Archivos principales:

- `controllers/torneoController.js`
- `views/torneos/index.ejs`
- `controllers/jugadorController.js`
- `views/jugadores/nuevo.ejs`
- `views/jugadores/editar.ejs`

### Finanzas: permiso para delegados

Pedido:

- Agregar switch para admin/super admin:
  - `Delegados pueden ver estado de otros equipos`
- El switch debe estar en `Finanzas`, visible despues de `Habilitar admin`.
- Si esta activo, el delegado puede ver si otros equipos estan al dia o adeudan.
- No debe poder ver detalle, saldo, totales ni movimientos de equipos ajenos.

Aplicado:

- Nueva columna:
  - `torneos.permitir_delegados_ver_estado_finanzas`
- Nueva ruta:
  - `POST /torneos/:id_torneo/permitir-delegados-ver-estado-finanzas`
- Backend recorta datos sensibles para delegados:
  - equipos propios: saldo, totales, movimientos y detalle;
  - equipos ajenos: solo estado `adeuda/al dia`, sin saldo ni detalle.
- UI muestra `Sin detalle` para equipos ajenos.

SQL local aplicado:

```sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_delegados_ver_estado_finanzas boolean NOT NULL DEFAULT false;
```

SQL documentado:

- `docs/sql/torneos_permitir_delegados_ver_estado_finanzas_20260521.sql`

### Auditoria de sorteo

Problema observado en PRD:

- Al sortear Fixture se generaba un registro de auditoria por cada `INSERT` en `partidos`.
- Ejemplo repetido:
  - `Se creo partidos: registro`

Regla nueva:

- Para sorteos, registrar un solo movimiento resumen.
- Mantener auditoria normal para altas manuales, ediciones y eliminaciones de partidos.

Aplicado:

- `controllers/partidoController.js` ahora:
  - abre transaccion durante el sorteo;
  - setea `app.omitir_auditoria_partidos_insert = '1'` solo dentro de esa transaccion;
  - inserta todos los partidos;
  - crea una sola fila en `auditoria` con accion `SORTEO`.

Ejemplo esperado:

```txt
Se sorteo fixture de Grupo 1 en torneo Apertura: 30 encuentros, 5 fechas, modalidad ida
```

SQL local aplicado:

- `docs/sql/auditoria_partidos_sorteo_resumen_20260521.sql`

Resultado local:

```txt
SQL_OK omit flag installed
```

### Limpieza de logs

Se quitaron logs ruidosos:

- `Sesión actual: ...` en carga de torneo.
- Logs de sorteo por cada paso/partido insertado.

## Verificaciones ejecutadas

```powershell
node --check controllers\partidoController.js
node --check controllers\torneoController.js
node --check routes\torneoRoutes.js
node --check controllers\jugadorController.js
node -e "const ejs=require('ejs'),fs=require('fs'); for (const f of ['views/torneos/index.ejs','views/jugadores/nuevo.ejs','views/jugadores/editar.ejs']) ejs.compile(fs.readFileSync(f,'utf8')); console.log('EJS_OK vistas tocadas')"
npm.cmd test
git diff --check
```

Resultados:

- checks JS OK;
- EJS OK;
- `npm.cmd test` OK, pero el proyecto informa `No hay tests definidos`;
- `git diff --check` sin errores, solo avisos CRLF.

## Pendiente PRD

Estado actualizado:

- El codigo de esta tanda y los ajustes posteriores ya fueron enviados a Git:
  - `qa`: `8051ffb mejorar dashboard app y finanzas`
  - `main`: `6703d43 merge qa a main para pruebas`
- No se ejecuto deploy desde Codex.
- Los SQL de DB PRD ya fueron aplicados por el usuario.
- Railway PRD mostro deploy activo y exitoso para:
  - `6703d43 merge qa a main para pruebas`
  - servicio `torneos-production.up.railway.app`
  - estado observado: `Deployment successful`

SQL aplicados en PostgreSQL PRD:

```sql
-- docs/sql/torneos_permitir_delegados_ver_estado_finanzas_20260521.sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_delegados_ver_estado_finanzas boolean NOT NULL DEFAULT false;
```

```sql
-- docs/sql/auditoria_partidos_sorteo_resumen_20260521.sql
CREATE OR REPLACE FUNCTION public.fn_auditoria()
...
```

Notas:

- El usuario indico que ya tiene el ultimo backup antes de avanzar.
- Los cambios de auditoria afectan registros futuros; no limpian registros viejos.
- Despues de deploy/carga de codigo PRD, validar:
  - recarga web/APK conserva pestana actual sin pasar por `Torneos`;
  - switch en `Finanzas` aparece solo en modo admin;
  - delegado ve estado de equipos ajenos sin detalles;
  - sorteo nuevo genera una sola auditoria resumen.
  - dashboard `Torneos > En curso` muestra estadisticas en vivo separadas por equipo;
  - detalle financiero permite descargar PDF;
  - APK/login vuelve a pantalla inicial al usar atras.

## Cierre de sesion

Estado al cerrar:

- DB PRD ajustada.
- Codigo en `origin/qa` y `origin/main`.
- Deploy PRD observado como exitoso en Railway.
- Usuario queda probando manualmente en PRD web/APK.
- Pendiente segun prueba:
  - reportar cualquier ajuste visual/funcional encontrado en PRD.

## Railway / costos

Se reviso documentacion oficial de Railway:

- Hobby cuesta USD 5/mes e incluye USD 5 de uso mensual.
- Si el uso es menor o igual a USD 5, se paga USD 5.
- Si el uso supera USD 5, se paga la diferencia.
- No se encontro limite de deploys que bloquee por cantidad de deploys.
- Puede detener workloads si:
  - se alcanza un hard usage limit configurado;
  - se agotan creditos trial;
  - falla el pago;
  - queda factura impaga.

Recomendado:

- configurar alerta de uso;
- usar hard limit solo sabiendo que puede apagar servicios;
- revisar red privada entre app y base si ambos estan en Railway.

## Hotfix posterior: carga de torneo y portada rota PRD

Fecha: 2026-05-21

Problemas observados en PRD:

- En `Fixture` / pantalla de torneo, el navegador tardaba mucho en terminar de mostrar la carga arriba.
- La portada del torneo aparecia rota en varias pestanas, por ejemplo `Estadisticas`.

Causa probable:

- La vista hacia un refresco automatico de `Dashboard > En curso` al cargar y cada 10 segundos.
- Si PRD/DB demoraba, podia quedar una peticion activa o solaparse con otra.
- La portada guardada apuntaba a `/uploads/...`, pero el archivo no estaba disponible en Railway.
- Esto es esperable si se usan archivos en filesystem del deploy sin storage persistente.

Aplicado localmente y subido a `qa`:

- Commit:
  - `b3ebd8f ajustar carga de torneo en prd`
- Archivos:
  - `controllers/torneoController.js`
  - `views/torneos/index.ejs`

Cambios:

- Se quito el refresco automatico de fondo:
  - ya no llama `refrescarDashboardEnCurso()` al cargar;
  - ya no ejecuta `setInterval(..., 10000)`;
  - la pantalla se actualiza con refresh normal o pull-to-refresh.
- Se dejo `refrescarDashboardEnCurso` con candado anti-solapamiento y timeout de 8 segundos para usos puntuales, como guardar carga desde la misma pantalla.
- Bootstrap JS carga con `defer`.
- Si `torneo.portada` apunta a `/uploads/...` y el archivo no existe en `public/uploads`, el backend envia `portada = null`.
- Si aun asi una portada falla en navegador, el bloque visual se oculta con `onerror`.

Verificaciones ejecutadas:

```powershell
node --check controllers\torneoController.js
node -e "const ejs=require('ejs'),fs=require('fs'); ejs.compile(fs.readFileSync('views/torneos/index.ejs','utf8')); console.log('EJS_OK views/torneos/index.ejs')"
npm.cmd test
git diff --check
```

Resultados:

- JS OK.
- EJS OK.
- `npm.cmd test` OK, el proyecto informa `No hay tests definidos`.
- `git diff --check` sin errores, solo avisos CRLF.

Pendiente inmediato:

- Commit del contexto.
- Merge de `qa` a `main`.
- Push a `origin/main` para PRD.
- No se encontro Railway CLI/config local para forzar deploy desde Codex; si Railway no despliega automaticamente, forzar desde el panel de Railway.
