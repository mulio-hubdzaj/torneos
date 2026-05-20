# Contexto 033

Fecha: 2026-05-20

## Tema

Reducir ruido en auditoria de `jugadores_equipos`, ajustes APK de administrar equipo/fixture y orden de pestanas.

## Pedido

Al cambiar varias veces capitan o numero de camiseta, la auditoria generaba muchos registros `UPDATE` poco claros.

Se decidio que `jugadores_equipos` registre solo:

- alta/asignacion de jugador al equipo (`INSERT`);
- baja/desvinculacion de jugador del equipo (`DELETE`).

No debe registrar:

- cambio de capitan;
- cambio de numero de camiseta;
- otros ajustes internos por `UPDATE`.

## SQL preparado

Archivo:

- `docs/sql/auditoria_jugadores_equipos_solo_altas_bajas_20260520.sql`

El SQL reemplaza `public.fn_audit_jugadores_equipos()` para retornar sin insertar auditoria cuando `TG_OP = 'UPDATE'`.

## Ajuste posterior

Luego de aplicar localmente, se detecto que las altas/bajas seguian mostrando detalle generico:

- `Se creo jugadores_equipos: registro`
- `Se elimino jugadores_equipos: registro`

Se actualizo el mismo SQL para que el detalle de `INSERT` y `DELETE` indique:

- jugador;
- documento;
- equipo;
- torneo cuando este disponible.

Ejemplos esperados:

- `Se asigno jugador Sebastian Gomez (333222) al equipo RIVER en torneo Apertura`
- `Se quito jugador Sebastian Gomez (333222) del equipo RIVER en torneo Apertura`

## Pendiente

Reaplicar el SQL actualizado en la base local y luego aplicarlo tambien en PRD cuando corresponda.

Los registros viejos de auditoria no se eliminan automaticamente; el cambio afecta los movimientos futuros.

## Ajustes visuales APK

### Administrar equipo

Archivos:

- `views/equipos/administrar.ejs`
- `views/partials/listaJugadores.ejs`
- `views/partials/listaUsuarios.ejs`

Cambios:

- Modal `Asignar Jugadores`:
  - columnas compactas en APK;
  - seleccion angosta;
  - nombre/apellido preparado para partir en lineas;
  - badges de estado mas chicos;
  - modal con scroll interno.
- Modal `Asignar Delegados`:
  - mismo criterio compacto;
  - en APK oculta `Correo` y `Rol actual` para priorizar `Sel.`, `Nombre`, `Documento`, `Estado`, `Vinculado`;
  - nombre del delegado puede partirse en dos lineas.
- Lista principal de jugadores en `Administrar equipo`:
  - se intento primero formato tarjeta vertical, pero quedaba demasiado largo;
  - se ajusto a fila compacta para APK;
  - primera linea: `Doc.`, `Nro.`, `Cap.`, `Estado`, accion eliminar;
  - segunda linea: nombre y apellido del jugador;
  - se corrigio que contenido/accion quedara fuera del contenedor;
  - se oculto en web el texto auxiliar mobile para que no aparezca junto al nombre.

Verificado:

```txt
EJS_OK views/equipos/administrar.ejs
EJS_OK views/partials/listaJugadores.ejs
EJS_OK views/partials/listaUsuarios.ejs
```

### Fixture APK

Archivo:

- `views/torneos/index.ejs`

Cambios:

- En vista publica/APK, la fila del Fixture se ajusto para leer mejor:
  - `MENDOZA 3 - 0 TOLEDO`
- El badge de estado (`Finalizado`, `Programado`) baja a una segunda linea para no quitar ancho a los nombres.
- Se redujo levemente texto/iconos/marcador en movil para evitar cortes como `MENDOZ`.

Verificado:

```txt
EJS_OK views/torneos/index.ejs
```

## Orden de pestanas

Pedido:

- Reordenar pestanas sin alterar funcionalidad.

Orden aplicado:

- `Torneos`
- `Items`
- `Grupos`
- `Jugadores`
- `Equipos`
- `Fixture`
- `Estadisticas`
- `Finanzas`
- `Usuarios`
- `Auditoria`

Nota:

- El usuario no incluyo `Finanzas` en la lista, pero se mantuvo para no alterar funcionalidad.
- Luego se pidio mover `Finanzas` entre `Estadisticas` y `Usuarios`.
- Las condiciones por rol/vista publica siguen iguales; solo cambio el orden visual.

Archivo:

- `views/torneos/index.ejs`

Verificado:

```txt
EJS_OK views/torneos/index.ejs
```

## Estado workspace observado

Rama esperada:

- `qa`

Hay cambios locales sin commit. `git status --short` observado:

```txt
 M controllers/equipoController.js
 M controllers/grupoController.js
 M controllers/partidoController.js
 M controllers/torneoController.js
 M index.js
 M routes/authRoutes.js
 M routes/entidadRoutes.js
 M routes/equipoRoutes.js
 M routes/torneoRoutes.js
 M views/admin/index.ejs
 M views/entidad/index.ejs
 M views/equipos/administrar.ejs
 M views/equipos/listaUsuarios.ejs
 M views/equipos/ver.ejs
 M views/index.ejs
 M views/login.ejs
 M views/partials/footer.ejs
 M views/partials/listaJugadores.ejs
 M views/partials/listaUsuarios.ejs
 M views/torneos/index.ejs
?? docs/contextos/contexto_027.md
?? docs/contextos/contexto_028.md
?? docs/contextos/contexto_029.md
?? docs/contextos/contexto_030.md
?? docs/contextos/contexto_031.md
?? docs/contextos/contexto_032.md
?? docs/contextos/contexto_033.md
?? docs/sql/auditoria_jugadores_equipos_solo_altas_bajas_20260520.sql
?? docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql
?? public/js/
?? public/uploads/24dcff87f3567297ccb67441fecf85ed
?? public/uploads/2d8d7cd67b74a540ad0ef6d106f76627.jpg
?? public/uploads/33a0f53a588ed09f27ec15f9e5fa5a94
?? public/uploads/5740f523a6b3cdc642027043fb8ca223
?? public/uploads/a61614331b92a43c3cbb5492ac1538df
?? public/uploads/f5dec95462ce830d81d9d2c8e02dfb8e
```

Nota:

- Revisar uploads antes de commit.
- SQL pendiente para PRD:
  - `docs/sql/torneos_permitir_modificar_iconos_equipo_20260519.sql`
  - `docs/sql/auditoria_jugadores_equipos_solo_altas_bajas_20260520.sql`
