# Contexto 040

Fecha: 2026-05-26

## Tema

Ajustes desplegados a PRD: sorteo combinado, APK PRD, descarga PDF en Android, volumen persistente de uploads y definicion pendiente para penales.

## Estado Git

Rama actual:

```txt
qa
```

Estado observado al actualizar este contexto:

```txt
qa == origin/qa
main == origin/main
HEAD: 9e0a10b reforzar descarga pdf apk prd
```

Commits enviados:

```txt
34788cd ajustar sorteo combinado y apk prd
9e0a10b reforzar descarga pdf apk prd
```

## Sorteo combinado

Problema reportado:

- Con dos grupos de 7 equipos cada uno, al pedir 10 fechas combinadas solo se generaban 7.
- Se necesitaba que la cantidad pedida se respete cuando sea posible.
- Regla obligatoria:
  - ningun equipo debe jugar mas de un encuentro en la misma fecha.
  - si la cantidad elegida deja desigualdad de partidos por equipo, la app debe avisar claramente.

Aplicado:

- `controllers/partidoController.js`
  - se agrego `calcularFechasRoundRobinSimple`.
  - `generarRoundRobinConLibres` ahora respeta cantidades exactas/intermedias en modalidad simple, por ejemplo 10 fechas para 7 equipos.
  - se agrego `validarUnEncuentroPorEquipoYFecha`.
  - el backend rechaza cualquier sorteo donde un equipo quede dos veces en la misma fecha.
  - el sorteo combinado calcula dinamicamente segun cantidad real de grupos/equipos, no solo para 7+7.

- `views/torneos/index.ejs`
  - el resumen de sorteo normal y combinado usa la regla correcta para grupos impares.
  - si hay riesgo de desigualdad, muestra alerta roja (`alert-danger`).
  - si queda equilibrado, muestra alerta verde.

Prueba logica realizada:

```txt
2 grupos de 7 equipos, 10 fechas:
- 10 fechas generadas
- 7 partidos por fecha
- 14 equipos jugando por fecha
- sin equipos duplicados en una misma fecha
```

## Estado finalizado a en curso

Pedido:

- Permitir que un encuentro `Finalizado` pueda volver a `En curso`.

Aplicado:

- `controllers/partidoController.js`
  - se permite solo `finalizado -> en_curso`.
  - desde finalizado siguen bloqueados `programado` y `suspendido`.

- `views/torneos/index.ejs`
  - al cambiar `Finalizado -> En curso`, se recarga la pestana Fixture para re-renderizar botones que estaban deshabilitados por servidor.

## APK PRD y descarga PDF

Problema:

- En APK local la descarga/apertura de PDF funcionaba.
- En APK PRD llegaba a mostrar `PDF listo`, pero ni `Abrir PDF` ni `Descargar PDF` funcionaban.

Primer ajuste:

- `controllers/torneoController.js`
  - `prepararPdfFinanzas` devuelve `downloadUrl`.
  - `verPdfFinanzasTemporal` responde `inline` o `attachment` segun `?descargar=1`.

- `views/torneos/index.ejs`
  - modal `PDF listo` muestra botones `Abrir PDF` y `Descargar PDF`.

- `android/app/src/main/java/com/torneosv2/app/MainActivity.java`
  - se agrego `DownloadListener` usando `DownloadManager`.

Hotfix posterior:

- Se agrego puente nativo:

```txt
window.AndroidDownloader.open(url)
window.AndroidDownloader.download(url)
```

- `Abrir PDF` intenta abrir con Android nativo.
- `Descargar PDF` llama directo al `DownloadManager` nativo.
- Mantiene fallback para web/Capacitor Browser.

APK generadas:

```txt
public/downloads/torneos-pro-a08315dc.apk
public/downloads/torneos-pro-6625559a.apk
```

La version vigente del login apunta a:

```txt
/downloads/torneos-pro-6625559a.apk
```

Configuracion PRD verificada dentro de Capacitor:

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

Importante:

- Para probar el hotfix PDF en PRD hay que instalar la APK nueva `torneos-pro-6625559a.apk`.
- La APK anterior no tiene el puente nativo reforzado.

## Uploads persistentes en Railway

Problema:

- Las imagenes se rompian despues de deploy porque se guardaban en filesystem local.

Se confirmo:

- `multer` esta configurado en:
  - `routes/equipoRoutes.js`
  - `routes/torneoRoutes.js`
- Guarda fisicamente en:

```txt
public/uploads/
```

- Express sirve `/uploads/...` desde:

```js
app.use(express.static(path.join(__dirname, 'public')))
```

Por lo tanto, en Railway el volumen debe montarse en:

```txt
/app/public/uploads
```

Resultado informado:

- Railway remonto el volumen `uploads` en `/app/public/uploads`.
- Despues del deploy, el usuario confirmo que las imagenes se mantienen.

Notas:

- El volumen protege imagenes nuevas desde ese momento.
- Imagenes antiguas que ya se habian perdido deben volver a subirse una vez.
- No se subieron nuevos archivos de `public/uploads` en los commits de esta tanda.

## Seguridad / privados

Se verifico despues del deploy:

- `docs/_privado/` esta ignorado.
- `.env` esta ignorado.
- `public/uploads/*` esta ignorado para archivos nuevos.
- El commit `34788cd` no incluyo archivos privados.

Nota:

- Existen uploads antiguos ya trackeados historicamente en Git.
- No se tocaron ni se agregaron nuevos uploads en esta tanda.
- Queda como posible limpieza futura quitar esos uploads historicos del repositorio sin borrar imagenes PRD.

## Penales: pedido en definicion

Nuevo tema propuesto:

- Agregar definicion por penales en encuentros del Fixture.
- Flujo deseado:
  - se carga marcador normal, por ejemplo `1-1`.
  - debajo aparece boton `Definicion en penales`.
  - al tocarlo abre modal con jugadores de ambos equipos.
  - por cada jugador permitir cargar:
    - goles en penales convertidos.
    - penales fallados.
  - un jugador puede patear mas de una vez, por ejemplo `2` convertidos.

Recomendacion tecnica dada:

- No mezclar goles de penales con `estadisticas.goles` normales.
- Los penales no deben sumar al ranking de goleadores normal ni a GF/GC.
- Deben verse en:
  - Fixture.
  - Dashboard.
  - Estadisticas del encuentro.

Decision pendiente del usuario:

- Confirmar como debe afectar la tabla de posiciones.

Pregunta abierta:

```txt
Si un partido termina 1-1 y Equipo A gana por penales 2-1,
la tabla debe contarlo como empate o como victoria por penales?
```

Recomendacion inicial:

- En fase de grupos: mantener empate en tabla y usar penales como definicion visual.
- En eliminatorias: usar ganador por penales para definir avance.

## Verificaciones ejecutadas

Durante esta tanda se ejecutaron:

```txt
node --check controllers/partidoController.js
node --check controllers/torneoController.js
EJS_OK views/torneos/index.ejs
EJS_OK views/login.ejs
npm test
git diff --check
gradlew assembleDebug
```

Resultados:

- Checks JS OK.
- EJS OK.
- Gradle OK usando JDK 21 de Android Studio.
- `npm test` OK, pero el proyecto informa `No hay tests definidos`.
- `git diff --check` solo mostro avisos CRLF.

## Tanda posterior: PDF lista, uso app y eventos de partido

Estado de trabajo al detener:

- Rama `qa`.
- Hay cambios locales sin commitear.
- Archivos modificados:
  - `controllers/partidoController.js`
  - `controllers/torneoController.js`
  - `index.js`
  - `public/js/session-abandon-guard.js`
  - `routes/torneoRoutes.js`
  - `views/torneos/index.ejs`
- Archivos nuevos sin trackear:
  - `controllers/usoController.js`
  - `routes/usoRoutes.js`
  - `docs/Planilla_resumen encuentros .pdf`
  - `docs/sql/app_uso_diario_20260526.sql`
  - `docs/sql/partidos_eventos_json_20260526.sql`
  - `docs/contextos/contexto_040.md`

### PDF lista de jugadores por partido/equipo

Pedido implementado:

- En Fixture se agrego descarga de lista de jugadores por equipo del partido.
- Ruta nueva:
  - `GET /torneos/:id_torneo/partidos/:id_partido/equipos/:id_equipo/lista-jugadores`
- Controlador:
  - `controllers/torneoController.js`
  - funcion `listaJugadoresPartidoPdf`.
- Ruta:
  - `routes/torneoRoutes.js`.
- Vista:
  - `views/torneos/index.ejs`.

Reglas aplicadas:

- El boton queda oculto hasta usar `Habilitar admin` en Fixture.
- Solo roles admin y super admin pueden usarlo:
  - `rol_id == 3`
  - `rol_id == 99`
- Backend tambien valida esos roles.
- El PDF usa flujo compatible con web y APK.

Formato del PDF:

- Cabecera:
  - lista de jugadores.
  - nombre de equipo.
  - numero de fecha.
  - equipo 1 vs equipo 2.
  - fecha/hora de juego.
- Cuerpo:
  - `#`
  - `# ` para corregir numero.
  - Documento.
  - Nombre y apellido con `(C)` si es capitan.
  - Goles acumulados hasta antes del partido actual.
  - Estado: `Habilitado` o `**Inhabilitado`.
  - Firma jugador sin linea interna.
- Abajo:
  - firma de delegados.

Detalle importante:

- Los goles del PDF se calculan por `id_partido < partido actual` dentro del mismo torneo.
- Si cuartos/semis vuelven a sortearse como fecha 1, no se pierden los goles anteriores porque no depende del numero de fecha sino del `id_partido`.

### Uso diario app/web

SQL aplicado por el usuario:

```sql
CREATE TABLE IF NOT EXISTS public.app_uso_diario (
  fecha date NOT NULL,
  usuario_id uuid NOT NULL,
  entity_id integer,
  rol_id integer,
  origen varchar(10) NOT NULL DEFAULT 'web',
  primer_acceso timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso timestamptz NOT NULL DEFAULT now(),
  cantidad_pings integer NOT NULL DEFAULT 1,
  CONSTRAINT app_uso_diario_origen_chk CHECK (origen IN ('apk', 'web')),
  CONSTRAINT app_uso_diario_pings_chk CHECK (cantidad_pings >= 1),
  CONSTRAINT app_uso_diario_pk PRIMARY KEY (fecha, usuario_id, origen)
);

CREATE INDEX IF NOT EXISTS idx_app_uso_diario_entity_fecha
  ON public.app_uso_diario (entity_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_app_uso_diario_origen_fecha
  ON public.app_uso_diario (origen, fecha DESC);
```

Implementado:

- `controllers/usoController.js`
  - `POST /uso/ping`.
  - upsert por `fecha + usuario_id + origen`.
  - incrementa `cantidad_pings`.
  - actualiza `ultimo_acceso`.
  - si falta tabla, responde 204 sin romper la app.
- `routes/usoRoutes.js`.
- `index.js` monta rutas de uso.
- `public/js/session-abandon-guard.js`
  - envia ping al abrir.
  - envia ping cada 10 minutos.
  - detecta `apk` si hay WebView/Capacitor/AndroidDownloader, si no `web`.
- `controllers/torneoController.js`
  - agrega resumen `obtenerUsoAppResumen`.
- `views/torneos/index.ejs`
  - nueva pestana `Uso app`.
  - solo visible para super admin `rol_id == 99`.
  - muestra hoy, ultimos 7 dias, mes y detalle diario.

### Eventos con minutos y cambios

SQL aplicado por el usuario:

```sql
ALTER TABLE public.estadisticas
ADD COLUMN IF NOT EXISTS goles_minutos jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS amarillas_minutos jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS rojas_minutos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.partidos
ADD COLUMN IF NOT EXISTS cambios_json jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Archivo creado:

- `docs/sql/partidos_eventos_json_20260526.sql`

Decision:

- No se crearon tablas nuevas para no alterar demasiado PRD.
- Los minutos son opcionales.
- No es obligatorio marcar jugador del gol.
- Los contadores viejos siguen funcionando.
- La nueva vista muestra detalle parcial cuando exista JSON cargado.

Backend:

- `controllers/partidoController.js`
  - lee y guarda:
    - `estadisticas.goles_minutos`
    - `estadisticas.amarillas_minutos`
    - `estadisticas.rojas_minutos`
    - `partidos.cambios_json`
  - valida minutos opcionales en formato entero o `mm:ss`.
  - permite minuto vacio.
  - mantiene `estadisticas.goles`, `tarjetas_amarillas`, `tarjetas_rojas` como fuente numerica para ranking/dashboard.
  - cambios se guardan en `cambios_json` filtrando por equipo para no pisar el otro equipo.

Frontend:

- `views/torneos/index.ejs`
  - modal de carga tiene pestanas:
    - `Jugadores`
    - `Items y finanzas`
    - `Cambios`
  - en jugadores:
    - `+ Gol`
    - `+ Amarilla`
    - `+ Roja`
  - cada evento agrega campo de minuto.
  - formato automatico `mm:ss` al escribir:
    - ejemplo `1830` queda `18:30`.
  - el mismo formatter se usa para goles, amarillas, rojas y cambios.
  - cambios permiten elegir:
    - jugador que sale.
    - jugador que entra.
    - minuto opcional.

Ultimo cambio parcial antes de detener:

- Se empezo a agregar placeholder `Sin detalle` en columnas vacias de goles/amarillas/rojas cuando no hay ningun evento cargado.
- Funcion agregada:
  - `actualizarEstadoVacioEventos(tr, tipo)`
- Esta parte aun necesita verificacion final antes de continuar:
  - compilar EJS.
  - `node --check controllers/partidoController.js`.
  - revisar que no se haya roto el render de la tabla.

### Verificaciones realizadas antes del ultimo parche parcial

Antes del ajuste `Sin detalle` se ejecuto:

```txt
node --check controllers/partidoController.js
node --check controllers/torneoController.js
node --check index.js
node --check public/js/session-abandon-guard.js
EJS_OK views/torneos/index.ejs
npm test
git diff --check
```

Resultados:

- JS OK.
- EJS OK.
- `npm test` OK, pero el proyecto informa `No hay tests definidos`.
- `git diff --check` solo CRLF warnings.

Pendiente inmediato al retomar:

1. Revisar el ultimo parche de `Sin detalle`.
2. Verificar EJS y JS.
3. Confirmar al usuario que amarillas y rojas tienen separador automatico igual que goles/cambios.

## Tanda posterior: planillas, docs y selector de entidad favorito

Estado:

- Rama `qa`.
- Sigue habiendo cambios locales sin commitear.
- Se continuo trabajando principalmente en:
  - `views/torneos/index.ejs`
  - `controllers/torneoController.js`
  - `routes/authRoutes.js`
  - `views/login.ejs`
  - `views/registro.ejs`
  - `views/index.ejs`
  - `views/restablecer_contrasena.ejs`
  - `public/js/entity-selector.js`
  - `public/css/style.css`
  - `index.js`

### Modal de carga de partido

Pedidos aplicados:

- En carga de partido, los campos de texto de eventos no aparecen si no hay nada cargado.
- Los eventos existentes permiten agregar minuto de gol/tarjeta si se desea.
- Al guardar gol, tarjeta, cambios o items, el modal ya no se cierra automaticamente.
- La vista movil se aliviano con pestanas:
  - `Jugadores/goles`
  - `Tarjetas`
  - `Cambios`
  - `Finanzas`
- `Items y finanzas` se movio al ultimo lugar.

### Cambios de jugadores en dashboard/estadisticas

Pedidos aplicados:

- Los cambios de jugadores se actualizan en dashboard de partidos en curso.
- Tambien se muestran al abrir estadisticas de encuentros finalizados.
- En estadisticas, los nombres de jugadores de cambios se pusieron en negro para mejorar contraste.

### Boton Docs y modal de documentos

Pedidos aplicados:

- En Fixture se agrego boton visual `Docs` al lado izquierdo de cada encuentro.
- El boton abre un modal nuevo con dos columnas, una por equipo.
- Las acciones de planillas/documentos se movieron dentro de ese modal.
- La planilla de jugadores se etiqueta como `Jugadores` y usa icono tipo persona.
- Se ajusto el aspecto del boton `Docs` para que no se vea roto/encimado.

### Lista de jugadores por partido

Pedidos aplicados:

- En la lista de jugadores se retiro la segunda columna que sobraba.
- Se agrego fecha de nacimiento.

### Planilla final del encuentro

Pedidos aplicados:

- Se agrego PDF de `Planilla final del encuentro` desde el modal `Docs`.
- Se genera una planilla por equipo.
- Incluye:
  - cabecera del encuentro.
  - `DETALLE DE JUGADORES (Nombre del equipo)`.
  - goles con minutos.
  - amarillas con minutos.
  - rojas con minutos.
  - gastos/items de la fecha.
  - entrega/monto aportado.
  - cambios realizados.
  - firmas al pie.
- Se retiro `Tiempo muerto solicitado`.
- Los cambios se movieron a una caja separada inmediatamente debajo de la lista de jugadores.
- Los cambios se muestran en pares:
  - minuto.
  - jugador que sale con numero de camiseta.
  - jugador que entra con numero de camiseta.
- La caja de gastos se corrigio para que no se desencuadre ni encime textos.
- Se retiro el bloque `CONFORMIDAD DEL ENCUENTRO`.
- Se retiro `Firma capitan`.
- Las firmas finales quedan al pie, centradas en cajas logicas individuales:
  - `Firma delegado`
  - `Firma arbitro`
  - `Firma mesa de control`

Verificaciones realizadas para esta parte:

```txt
EJS_OK views/torneos/index.ejs
```

### Selector de entidad con buscador y favorito

Pedido:

- Para login, registro, sin login y admin, usar selector de entidad con:
  - campo de texto.
  - coincidencias mientras se escribe.
  - desplegable visible.
  - estrella para marcar favorita.
  - precarga de favorita al volver a entrar.
- En APK debe quedar guardado en memoria local de la app/navegador.
- El usuario debe poder ver cual entidad esta marcada como favorita y cambiarla.

Aplicado:

- Se creo componente compartido:
  - `public/js/entity-selector.js`
- Se agregaron estilos:
  - `public/css/style.css`
- Se agrego endpoint publico:
  - `GET /entidades/buscar?q=...`
  - en `routes/authRoutes.js`.
- `index.js` permite `/entidades/buscar` como ruta publica.
- El favorito se guarda en `localStorage` con clave:
  - `torneos_entidad_favorita`
- Esto aplica tambien en APK porque el WebView conserva `localStorage` mientras no se borren datos de la app.

Pantallas actualizadas:

- `views/login.ejs`
- `views/registro.ejs`
- `views/index.ejs` para acceso sin login/comunidad publica.
- `views/restablecer_contrasena.ejs`

Logica de login aplicada:

- Si el usuario selecciona entidad, se valida contra esa entidad.
- Si no selecciona entidad:
  - si el documento existe en una sola entidad, usa automaticamente esa entidad registrada.
  - si el documento existe en varias entidades, pide seleccionar entidad.
- No se agrego migracion de base de datos porque `usuarios.entity_id` ya funciona como entidad registrada/principal.

Verificaciones realizadas:

```txt
EJS_OK views/login.ejs
EJS_OK views/registro.ejs
EJS_OK views/index.ejs
EJS_OK views/restablecer_contrasena.ejs
node --check routes/authRoutes.js
node --check public/js/entity-selector.js
node --check index.js
npm test
```

Resultados:

- EJS OK.
- JS OK.
- `npm test` OK, pero el proyecto informa `No hay tests definidos`.

Nota:

- Al intentar levantar servidor en background para probar HTTP, el proceso salio inmediatamente con codigo 0 en esa corrida.
- Ejecutar `node index.js` directo mostro:

```txt
Servidor corriendo en http://localhost:3000
```

Pendiente sugerido:

- Probar manualmente en navegador/APK:
  - buscar entidad por texto.
  - marcar estrella.
  - cerrar/abrir y confirmar precarga.
  - login sin entidad con documento unico.
  - login sin entidad con documento repetido en varias entidades.
