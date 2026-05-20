# Contexto 028

Fecha: 2026-05-19

## Tema

Ajustes de vista central de Torneos, Fixture responsive web/APK, vista publica sin login y comportamiento de estados.

## Estado Git / workspace

- Rama actual:
  - `qa`
- Hay cambios locales sin commit.
- Archivos modificados observados:
  - `controllers/torneoController.js`
  - `index.js`
  - `routes/authRoutes.js`
  - `views/index.ejs`
  - `views/login.ejs`
  - `views/torneos/index.ejs`
- Archivos nuevos sin trackear:
  - `docs/contextos/contexto_027.md`
  - `docs/contextos/contexto_028.md`

Nota:

- Los cambios de acceso publico/login venian de la tanda anterior (`contexto_027`).
- Esta tanda trabajo principalmente sobre `views/torneos/index.ejs` y un ajuste de orden/limite en `controllers/torneoController.js`.

## Cambio: quitar accesos rapidos del dashboard central

Pedido retomado desde `contexto_027`:

- Quitar la fila `dashboard-quick-actions` de la pestana `Torneos`.
- Se eliminaron los botones:
  - `Tabla`
  - `Goleadores`
  - `Fixture`
  - `Jugadores`
  - `Ultimos partidos`
  - `Proximos encuentros`
- Tambien se limpiaron reglas CSS muertas de `.dashboard-quick-actions`.

Archivo:

- `views/torneos/index.ejs`

## Cambio: refresco de pestanas

Problema:

- La pestana `Torneos` no actualizaba su resumen central al volver desde otras pestanas despues de acciones AJAX.

Aplicado:

- Se agrego marca interna `dashboardInicioDesactualizado`.
- Se marca como desactualizado cuando cambian:
  - horarios comunes;
  - estado de partido;
  - marcador;
  - carga de encuentro.
- Al volver a `#torneos`, si el dashboard esta desactualizado, se recarga la pagina manteniendo `#torneos`.
- Al entrar a:
  - `#finanzas`: sincroniza resumen financiero;
  - `#estadisticas`: recalcula estadisticas cliente;
  - `#usuarios`: reaplica filtros;
  - `#auditoria`: refresca auditoria como ya venia funcionando.
- El hash de URL se actualiza al cambiar de pestana.

Archivo:

- `views/torneos/index.ejs`

## Cambio: dashboard con scroll

Pedido:

- Permitir scroll en tarjetas del dashboard:
  - `Goleadores`
  - `Ultimos resultados`
  - `Proximos encuentros`

Aplicado:

- Se agrego clase `dashboard-scroll-area`.
- Tambien se aplico a `En curso` por consistencia cuando esa tarjeta aparece.
- Se subio el limite del backend de 5 a 20 registros para:
  - `partidosEnCurso`
  - `ultimosResultados`
  - `proximosPartidos`
  - `goleadoresTop`

Archivos:

- `views/torneos/index.ejs`
- `controllers/torneoController.js`

## Cambio: orden de ultimos resultados

Problema:

- `Ultimos resultados` podia empezar por Fecha 1.

Aplicado:

- Se ordenan finalizados primero por `numero_fecha` descendente.
- Desempate por fecha/hora y `id_partido` descendente.

Archivo:

- `controllers/torneoController.js`

## Cambio: Estadisticas responsive

Problema visto en captura:

- En `Estadisticas`, la tabla cortaba nombres como `MENDOZA` en `MENDOZ / A`.
- Algunas columnas se pegaban (`Grupo`, `PJ`, etc.).

Aplicado:

- Se evito partir palabras dentro de `.estadisticas-nombre`.
- En movil se ajustaron anchos de columnas:
  - `Equipo`
  - `Grupo`
  - `PJ`
  - `DG`
  - `PTS`
- El texto de grupo puede ocupar linea de forma controlada.

Archivo:

- `views/torneos/index.ejs`

## Cambio: Fixture - fecha, hora y cancha

Pedido:

- Quitar columnas `Fecha`, `Hora` y `Cancha`.
- Mostrar esos datos debajo de cada encuentro.
- `Cancha` solo debe mostrarse si esta asignada.

Aplicado:

- La fila principal del Fixture quedo con:
  - `Equipo A`
  - `Marcador`
  - `Equipo B`
  - `Estado`
  - `Acciones` solo en admin
- Se agrego una fila secundaria por encuentro.
- En esa fila se muestra:
  - nombre del grupo directamente, sin icono y sin texto `Grupo:`;
  - fecha;
  - hora;
  - cancha solo si existe `partido.nombre_cancha`.
- El JS de horarios comunes ahora actualiza `.partido-detalle-fecha` y `.partido-detalle-hora`.

Archivo:

- `views/torneos/index.ejs`

## Cambio: Fixture publico sin login

Problema:

- En vista publica, al filtrar Fixture por grupo, el `select` enviaba a:
  - `/torneos/gestionar/:id`
- Eso obligaba a iniciar sesion.

Aplicado:

- El filtro por grupo del Fixture ahora usa:
  - `/publico/torneo/:id_torneo` si `esVistaPublica`;
  - `/torneos/gestionar/:id_torneo` si hay sesion.
- El filtro por grupo de `Estadisticas` ya tenia esta logica.

Archivo:

- `views/torneos/index.ejs`

## Cambio: Fixture responsive web/APK

Trabajo realizado:

- Se centro el panel de Fixture en web:
  - `card-partidos` con `max-width` y margen automatico.
- Se ajusto para que no quede desbordado a la derecha.
- Para APK/movil:
  - se intento compactar la tabla publica;
  - se paso la fila de partido a una grilla responsive;
  - se redujeron tamanos de texto/badges;
  - se elimino la columna `Grupo` para dar mas espacio a los equipos.
- Para modo admin:
  - se volvio a permitir scroll horizontal;
  - se agrego `min-width` a la tabla admin;
  - se amplio columna `Acciones`.

Estado:

- El responsive APK tuvo varios ajustes iterativos por capturas.
- Ultimo estado esperado:
  - vista publica mas compacta;
  - grupo abajo junto a fecha/hora;
  - admin con acciones visibles usando scroll horizontal si hace falta.

Archivo:

- `views/torneos/index.ejs`

## Cambio: acciones de Fixture

Pedidos:

- Quitar engranaje sin funcion activa.
- Quitar boton de guardar/actualizar estado visible.
- Al cambiar estado, pedir confirmacion y guardar.

Aplicado:

- Se quito boton `bi-gear-fill` de la columna `Acciones` del Fixture.
- Se quito boton `bi-save` / `.btn-guardar-match`.
- Cada `select.estado-select` guarda `data-estado-actual`.
- Al cambiar el estado:
  - se abre `confirmarApp`;
  - si se acepta, llama a `guardarEstadoPartido`;
  - si se cancela o falla, vuelve al estado anterior.
- Si se actualiza marcador y el estado cambia a finalizado, tambien se actualiza `data-estado-actual`.

Archivo:

- `views/torneos/index.ejs`

## Verificaciones realizadas

Ejecutado varias veces durante la tanda:

```txt
EJS_OK views/torneos/index.ejs
JS_OK controllers/torneoController.js
```

Comandos usados:

```powershell
node -e "const ejs=require('ejs'); ejs.compile(require('fs').readFileSync('views/torneos/index.ejs','utf8')); console.log('EJS_OK views/torneos/index.ejs')"
node --check controllers/torneoController.js
```

## Pendientes recomendados

Antes de commit:

```powershell
git status --short
node --check index.js
node --check routes/authRoutes.js
node --check controllers/torneoController.js
node -e "const ejs=require('ejs'); ejs.compile(require('fs').readFileSync('views/index.ejs','utf8')); ejs.compile(require('fs').readFileSync('views/login.ejs','utf8')); ejs.compile(require('fs').readFileSync('views/torneos/index.ejs','utf8')); console.log('EJS_OK')"
npm.cmd test
```

Probar manualmente:

- Vista publica sin login:
  - entrar por inicio;
  - seleccionar comunidad;
  - abrir Fixture;
  - filtrar por grupo sin que pida login;
  - revisar APK/movil.
- Admin:
  - activar `Habilitar admin` en Fixture;
  - confirmar que acciones se ven completas o hay scroll horizontal;
  - cambiar estado y confirmar guardado;
  - cancelar cambio de estado y verificar que vuelve al valor anterior;
  - editar marcador y confirmar que dashboard/estadisticas se actualizan.
- Dashboard:
  - scroll en goleadores, ultimos resultados y proximos encuentros;
  - ultimos resultados empieza por fechas finalizadas mas recientes.

## Nota

No se hizo commit en esta tanda.
