# Contexto 022

Fecha: 2026-05-17

## Estado acordado

- Se trabaja sobre la version APK/WebView.
- La APK carga la web, por lo que los ajustes responsive se hacen en las vistas EJS/CSS del servidor.
- Nombre de trabajo para esta capa:
  - `Modo APK Responsive`
- Vista principal de torneo sigue siendo:
  - `views/torneos/index.ejs`
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de PostgreSQL.
- `rol_id = 99` sigue siendo super admin.

## Problema reportado

- En el primer inicio como super admin dentro de la APK, la pantalla no se ajustaba al ancho del celular.
- La tabla de entidades quedaba corrida hacia la derecha.
- Se veia el fondo a la izquierda y las acciones quedaban parcialmente fuera de pantalla.
- La vista afectada corresponde al panel inicial de super admin:
  - `views/admin/index.ejs`

## Causa encontrada

- `public/css/style.css` tenia estilos globales pensados para pantallas tipo login:
  - `body` con `display: flex`;
  - contenido centrado vertical/horizontal;
  - `.card` con `max-width: 400px`;
  - botones grandes por defecto.
- Esos estilos globales tambien afectaban pantallas administrativas con tablas.
- Ademas habia un bloque JavaScript dentro de `public/css/style.css`, que no correspondia estar en un archivo CSS.

## Cambios realizados

### `views/admin/index.ejs`

- Se agrego:
  - `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Se reemplazo el body centrado por:
  - `admin-index-page app-responsive-page`
- Se agrego estructura:
  - `app-page-shell`
  - `app-page-header`
  - `app-panel`
- La tabla de entidades ahora usa:
  - `app-mobile-table`
  - `data-label` por celda.
- En celular la tabla puede convertirse en tarjetas verticales.
- Los botones `Editar` y `Administrar` quedan agrupados en:
  - `app-row-actions`

### `views/entidad/index.ejs`

- Se agrego viewport.
- Se agrego clase:
  - `entity-index-page app-responsive-page`
- Se reemplazo el ancho minimo fijo del card por:
  - `entity-card`
- Los torneos dentro de la entidad usan:
  - `entity-tournament-item`
  - `entity-row-actions`
- En celular las acciones pasan a una columna y ocupan el ancho disponible.

### `views/index.ejs`

- Se agrego viewport.
- Se corrigio estructura HTML del card de bienvenida.
- Se agrego:
  - `welcome-index-page`
  - `welcome-card`
  - `welcome-actions`
- Se quitaron anchos minimos inline para permitir ajuste en celular.

### `views/grupos/index.ejs`

- Aunque funciona como parcial dentro de Torneos, se ajusto porque tambien es un `index`.
- Se agregaron clases:
  - `grupos-index-partial`
  - `grupo-equipo-item`
  - `grupo-equipo-actions`
  - `grupo-equipo-edit`
- En celular, las acciones de editar/eliminar equipo se apilan y el input ocupa el ancho disponible.

### `views/torneos/index.ejs` - pestana Jugadores

- Se ajusto la pestana `Jugadores` para APK/celular.
- La tabla de jugadores ahora usa:
  - `jugadores-table-mobile`
  - `data-label` en cada celda.
- En pantallas chicas:
  - la tabla pasa a tarjetas por jugador;
  - se oculta el encabezado ancho de tabla;
  - cada dato muestra su etiqueta;
  - el buscador queda en grilla compacta;
  - el boton de buscar queda fijo a 44px;
  - `Nuevo` ocupa todo el ancho cuando esta visible;
  - `Habilitar admin`/`Vista usuario` se apilan para no desbordar.
- Se evita que `Fecha Nac.`, `Documento`, `Equipo` y `Observaciones` corten la pantalla horizontalmente.

### `views/torneos/index.ejs` - Estadisticas / Tabla de posiciones

- Problema observado en APK:
  - nombres de equipos cortados con puntos (`ARS...`, `CEN...`, etc.).
- Cambios:
  - `.estadisticas-nombre` ya no usa truncado con ellipsis;
  - permite salto de linea y `word-break`;
  - en pantallas chicas se ocultan columnas secundarias:
    - `G`
    - `E`
    - `P`
    - `GF`
    - `GC`
  - se mantienen visibles:
    - Equipo;
    - Grupo;
    - PJ;
    - DF;
    - PTS.
- Tambien se ajusto el render dinamico de `recalcularEstadisticasCliente()` para conservar las mismas clases.

### Fecha de nacimiento manual en jugadores

- Pedido:
  - permitir escribir directamente la fecha de nacimiento sin abrir calendario en Android/APK.
- Cambios:
  - `views/jugadores/nuevo.ejs`
    - `fecha_nacimiento` paso de `type="date"` a `type="text"`;
    - usa `inputmode="numeric"`;
    - placeholder `DD/MM/AAAA`;
    - mascara simple que agrega `/` automaticamente.
  - `views/jugadores/editar.ejs`
    - mismo comportamiento para editar jugador;
    - muestra la fecha existente como `DD/MM/AAAA`.
  - `controllers/jugadorController.js`
    - se agrego `normalizarFechaNacimiento(...)`;
    - acepta `DD/MM/AAAA`;
    - sigue tolerando `AAAA-MM-DD`;
    - valida fecha real y no futura;
    - guarda en DB como `AAAA-MM-DD`.
- Correccion posterior por validacion HTML en Android:
  - el `pattern` quedo como `[0-9]{2}/[0-9]{2}/[0-9]{4}`;
  - esto corrige el aviso nativo `Haz coincidir el formato solicitado` cuando se escribe una fecha valida como `22/10/2001`.

### `public/css/style.css`

- Se agrego la capa:
  - `Modo APK Responsive`
- Nuevas clases principales:
  - `.app-responsive-page`
  - `.app-page-shell`
  - `.app-page-header`
  - `.app-panel`
  - `.app-mobile-table`
  - `.app-row-actions`
  - `.entity-card`
  - `.entity-tournament-item`
  - `.welcome-card`
  - `.grupo-equipo-item`
  - `.grupo-equipo-actions`
- En `max-width: 576px`:
  - tablas `.app-mobile-table` pasan a formato tarjeta;
  - encabezado de tabla se oculta;
  - cada celda muestra su `data-label`;
  - botones se compactan;
  - acciones se apilan en una columna;
  - cards pierden ancho minimo y reducen padding.
- Se elimino del CSS el bloque JavaScript que manejaba `.estado-switch`.

## Verificaciones realizadas

Sintaxis JS:

```txt
node --check index.js
node --check routes/adminRoutes.js
node --check routes/entidadRoutes.js
node --check routes/torneoRoutes.js
```

Compilacion EJS:

```txt
EJS_OK views/admin/index.ejs
EJS_OK views/entidad/index.ejs
EJS_OK views/index.ejs
EJS_OK views/grupos/index.ejs
EJS_OK views/torneos/index.ejs
```

Verificacion adicional luego de ajustar `Jugadores`:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
npm.cmd test -> No hay tests definidos
```

Verificacion Estadisticas responsive:

```txt
EJS_OK views/torneos/index.ejs
node --check controllers/torneoController.js
```

Verificacion fecha manual:

```txt
node --check controllers/jugadorController.js
EJS_OK views/jugadores/nuevo.ejs
EJS_OK views/jugadores/editar.ejs
npm.cmd test -> No hay tests definidos
```

Verificacion correccion de pattern:

```txt
EJS_OK views/jugadores/nuevo.ejs
EJS_OK views/jugadores/editar.ejs
node --check controllers/jugadorController.js
```

Tests:

```txt
npm.cmd test
No hay tests definidos
```

## Pendientes recomendados

- Probar en APK/celular:
  - primer inicio como super admin;
  - panel de entidades;
  - entrar a una entidad;
  - lista de torneos de la entidad.
- Luego continuar aplicando el mismo patron responsive a otras pantallas `index` si aparecen desbordes.
- Revisar en particular:
  - `views/torneos/index.ejs`, aunque ya tiene una capa responsive propia;
  - parciales usados dentro de Torneos, como grupos/equipos/jugadores, si algun bloque aun queda ancho.

## Orden y busqueda en entidades/torneos

Pedido:

- Al entrar como admin/super admin, mostrar arriba las entidades activas.
- Agregar buscador en seccion de entidades.
- Dentro de una entidad, mostrar arriba los torneos activos.
- Agregar buscador de torneos dentro de entidad.

Cambios:

- `routes/adminRoutes.js`
  - `Entity.findAll()` ahora ordena:
    - `activo DESC`;
    - `codigo ASC`.
- `routes/entidadRoutes.js`
  - torneos por entidad ahora ordenan:
    - `estado DESC`;
    - `nombre_torneo ASC`.
- `controllers/entityController.js`
  - se dejo el mismo orden para el flujo alternativo que renderiza `entidad/index`.
- `views/admin/index.ejs`
  - se agrego buscador `buscarEntidadesAdmin`;
  - filtra por codigo, descripcion y estado;
  - muestra mensaje si no hay resultados.
- `views/entidad/index.ejs`
  - se agrego buscador `buscarTorneosEntidad`;
  - filtra por nombre, temporada y estado;
  - muestra mensaje si no hay resultados.
- `public/css/style.css`
  - se agrego estilo comun `.app-search-bar`.

Verificaciones:

```txt
node --check routes/adminRoutes.js
node --check routes/entidadRoutes.js
node --check controllers/entityController.js
EJS_OK views/admin/index.ejs
EJS_OK views/entidad/index.ejs
npm.cmd test -> No hay tests definidos
```
