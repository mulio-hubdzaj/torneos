# Contexto 023

Fecha: 2026-05-17

## Estado acordado

- Se sigue trabajando sobre la version APK/WebView.
- Nombre de trabajo de la capa movil:
  - `Modo APK Responsive`
- La APK carga la web desde el servidor, por lo que los ajustes se hacen en EJS/CSS/JS web.
- Vista principal de gestion:
  - `views/torneos/index.ejs`
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de PostgreSQL.
- `rol_id = 99` sigue siendo super admin.

## Trabajo reciente completado

### Pantalla inicial super admin

- Se ajusto `views/admin/index.ejs` para APK/celular.
- La tabla de entidades puede verse como tarjetas en movil.
- Se agrego buscador de entidades.
- Las entidades activas se ordenan arriba desde:
  - `routes/adminRoutes.js`

### Entidad / torneos

- Se ajusto `views/entidad/index.ejs`.
- Se agrego buscador de torneos dentro de la entidad.
- Los torneos activos se ordenan arriba desde:
  - `routes/entidadRoutes.js`
  - `controllers/entityController.js`

### Pestana Jugadores

- Se ajusto `views/torneos/index.ejs` para que la tabla de jugadores en movil pase a formato tarjeta.
- Se agregaron `data-label` en las celdas.
- Se compacto buscador y botones.

### Fecha de nacimiento en jugadores

- En `views/jugadores/nuevo.ejs` y `views/jugadores/editar.ejs`:
  - `fecha_nacimiento` dejo de ser `type="date"`;
  - ahora es texto con `inputmode="numeric"`;
  - formato visible: `DD/MM/AAAA`;
  - mascara simple agrega `/` automaticamente.
- En `controllers/jugadorController.js`:
  - se agrego normalizacion de fecha;
  - acepta `DD/MM/AAAA`;
  - valida fecha real y no futura;
  - guarda como `AAAA-MM-DD`.
- Se corrigio el `pattern` HTML para que Android no muestre:
  - `Haz coincidir el formato solicitado`
  cuando se escribe una fecha valida como `22/10/2001`.

### Estadisticas / tabla de posiciones

- Se ajusto `views/torneos/index.ejs`.
- Los nombres de equipos ya no se truncan con `...`.
- En movil se ocultan columnas secundarias:
  - `G`
  - `E`
  - `P`
  - `GF`
  - `GC`
- Se mantienen visibles:
  - Equipo;
  - Grupo;
  - PJ;
  - DF;
  - PTS.

## Cambio aplicado: pestana inicial Torneos

El usuario pidio:

- Que todos los usuarios al ingresar vean primero la pestana `Torneos`.
- Motivo:
  - ahi esta el dashboard con resumenes rapidos.

Hallazgo:

- El link de `TORNEOS` actualmente queda activo solo para `rol_id == 1` o `rol_id == 2`.
- Para admin/super admin, `Grupos` aparece con `active`.
- Hay JavaScript en `DOMContentLoaded` que respeta `window.location.hash`.

Cambios aplicados en `views/torneos/index.ejs`:

- `torneos-tab` queda con `class="nav-link active"` para todos los roles.
- `grupos-tab` ya no queda activo inicialmente.
- El `tab-pane` `#torneos` queda con:
  - `fade show active`
- El `tab-pane` `#grupos` ya no queda activo inicialmente.
- Se conserva el JavaScript que respeta `window.location.hash`:
  - si se entra con `#jugadores`, `#equipos`, etc., se sigue abriendo esa pestana;
  - si se entra sin hash, abre `Torneos`.

Verificacion:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
npm.cmd test -> No hay tests definidos
```

## Verificaciones recientes

Se realizaron durante la tanda anterior:

```txt
node --check routes/adminRoutes.js
node --check routes/entidadRoutes.js
node --check controllers/entityController.js
EJS_OK views/admin/index.ejs
EJS_OK views/entidad/index.ejs
npm.cmd test -> No hay tests definidos
```

Tambien:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
node --check controllers/jugadorController.js
EJS_OK views/jugadores/nuevo.ejs
EJS_OK views/jugadores/editar.ejs
```

## Archivos relevantes tocados recientemente

- `views/admin/index.ejs`
- `views/entidad/index.ejs`
- `views/index.ejs`
- `views/grupos/index.ejs`
- `views/torneos/index.ejs`
- `views/jugadores/nuevo.ejs`
- `views/jugadores/editar.ejs`
- `public/css/style.css`
- `controllers/jugadorController.js`
- `controllers/entityController.js`
- `routes/adminRoutes.js`
- `routes/entidadRoutes.js`
- `public/contexto_022.md`
- `public/contexto_023.md`

## Cambio aplicado: estado En curso en Fixture

Pedido:

- Agregar un nuevo estado para partidos:
  - `En curso`
- Color sugerido:
  - naranja, distinto a los demas.
- En ese estado, permitir que el admin actualice el marcador/datos en tiempo real sin cerrar el partido.
- Reflejar partidos `En curso` en el dashboard inicial de `Torneos`.

Cambios realizados:

- `controllers/partidoController.js`
  - se agrego estado interno:
    - `en_curso`
  - transiciones permitidas:
    - `programado -> en_curso/finalizado/suspendido`
    - `en_curso -> programado/finalizado/suspendido`
    - `suspendido -> programado/en_curso/finalizado`
  - `finalizado` sigue bloqueado para cambios posteriores.
  - `actualizarMarcador` valida estados permitidos:
    - `programado`
    - `en_curso`
    - `suspendido`
    - `finalizado`

- `controllers/torneoController.js`
  - `armarDashboardInicio(...)` ahora separa:
    - `partidosEnCurso`
    - `ultimosResultados`
    - `proximosPartidos`
  - `proximosPartidos` ya no incluye partidos `finalizado` ni `en_curso`.

- `views/torneos/index.ejs`
  - Fixture:
    - selector de estado agrega opcion `En curso`;
    - estado `En curso` usa color naranja;
    - estado publico tambien muestra badge naranja.
  - Marcador:
    - si el partido esta `En curso`, guardar marcador mantiene estado `en_curso`;
    - si no esta `En curso`, guardar marcador mantiene comportamiento anterior y lo pasa a `finalizado`.
  - Dashboard inicial:
    - se agrego tarjeta `En curso`;
    - muestra partidos en vivo con marcador actual y fecha.

Verificaciones:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
node --check controllers/partidoController.js
npm.cmd test -> No hay tests definidos
```

## Cambio aplicado: orden visual de torneos por entidad

Pedido:

- Ordenar/mejorar la vista web de torneos dentro de una entidad.
- La captura mostraba una tarjeta angosta con filas apretadas, nombres pequenos y botones poco alineados.

Cambios:

- `views/entidad/index.ejs`
  - se agrego estructura visual:
    - `entity-page-shell`
    - `entity-tournaments-card`
    - `entity-title-block`
    - `entity-section-title`
    - `entity-tournament-list`
    - `entity-tournament-main`
    - `entity-tournament-name`
    - `entity-tournament-season`
    - `entity-status-badge`
  - cada torneo ahora separa:
    - nombre;
    - temporada;
    - estado;
    - acciones.

- `public/css/style.css`
  - la vista de entidad ahora usa mas ancho en web:
    - `width: min(920px, calc(100vw - 32px))`
  - filas de torneos con grilla:
    - informacion a la izquierda;
    - acciones alineadas a la derecha.
  - botones con ancho minimo uniforme.
  - en movil, cada torneo se ve como tarjeta:
    - datos arriba;
    - acciones en dos columnas.

Verificacion:

```txt
EJS_OK views/entidad/index.ejs
node --check routes/entidadRoutes.js
```

## Correccion: En curso no aparecia en dashboard

Problema observado:

- Habia un encuentro marcado como `En Curso`, pero la tarjeta `En curso` del dashboard mostraba:
  - `Sin encuentros en curso.`

Causa probable:

- El dashboard buscaba exactamente el valor interno `en_curso`.
- Si el dato venia guardado como:
  - `En Curso`
  - `en curso`
  - `en-curso`
  no coincidia.

Cambios:

- `controllers/torneoController.js`
  - se agrego normalizacion de estado:
    - trim;
    - minusculas;
    - espacios/guiones a `_`.
  - `partidosEnCurso`, `ultimosResultados` y `proximosPartidos` usan esa normalizacion.
- `controllers/partidoController.js`
  - `actualizarEstado` y `actualizarMarcador` normalizan estados recibidos.
  - si llega `En Curso` o `en curso`, se guarda/usa como `en_curso`.
- `views/torneos/index.ejs`
  - normaliza estado para:
    - `data-estado`;
    - selector de estado;
    - badge publico;
    - clase naranja.

Verificaciones:

```txt
node --check controllers/torneoController.js
node --check controllers/partidoController.js
EJS_OK views/torneos/index.ejs
npm.cmd test -> No hay tests definidos
```

## Ajuste dashboard En curso

Pedido:

- La tarjeta `En curso` del dashboard solo debe mostrarse si existe al menos un encuentro en curso.
- Si no hay partidos en curso, no debe aparecer la tarjeta.
- Corregir visual del partido en curso porque mostraba separadores codificados raros.

Cambios:

- `views/torneos/index.ejs`
  - la tarjeta `En curso` queda envuelta en:
    - `if ((dashboardInicio.partidosEnCurso || []).length)`
  - se reemplazo la linea visual del partido por:
    - Equipo A;
    - marcador;
    - Equipo B;
    - Fecha;
    - fecha calendario si existe;
    - hora si existe.
  - se agrego clase:
    - `dashboard-en-curso-card`
  - se oculta el texto viejo con separadores codificados raros para que no se vea duplicado.

Verificacion:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
npm.cmd test -> No hay tests definidos
```

## Ajuste Finanzas: espacio innecesario

Problema observado:

- En la pestana `Finanzas`, en vista usuario/publica, quedaba un espacio grande vacio entre `Equipo` y `Grupo`.
- En telefono eso obligaba a scrollear horizontalmente.

Causa:

- La tabla mantenia `min-width: 760px`, pensado para vista admin.
- En vista publica se ocultaba `Saldo actual`, pero la tabla seguia repartiendo demasiado ancho.

Cambios en `views/torneos/index.ejs`:

- Para `#finanzas.finanzas-vista-publica`:
  - `.finanzas-table` pasa a `min-width: 0`;
  - usa `width: 100%`;
  - usa `table-layout: fixed`;
  - columnas visibles quedan repartidas:
    - Equipo 44%;
    - Grupo 18%;
    - Estado 18%;
    - Acciones 20%.
  - se compacta padding horizontal.
  - se evita scroll horizontal innecesario.

Verificacion:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
npm.cmd test -> No hay tests definidos
```

## Ajuste Finanzas movil: columnas cortadas

Problema observado:

- En celular, `Grupo`, `Estado` y `Acciones` quedaban cortados por columnas estrechas.
- Los encabezados se partian:
  - `Grup o`
  - `Estad o`
  - `Accio nes`

Cambios en `views/torneos/index.ejs`:

- Se agregaron `data-label` a las celdas de Finanzas:
  - Equipo;
  - Grupo;
  - Estado;
  - Saldo;
  - Acciones.
- El render dinamico de Finanzas tambien agrega esos `data-label`.
- En `@media (max-width: 768px)`:
  - Finanzas deja de ser tabla horizontal;
  - cada equipo pasa a tarjeta vertical;
  - encabezado de tabla se oculta;
  - cada dato muestra su etiqueta;
  - boton `Detalles` ocupa todo el ancho.

Verificacion:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
npm.cmd test -> No hay tests definidos
```
