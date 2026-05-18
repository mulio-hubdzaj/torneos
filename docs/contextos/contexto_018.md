# Contexto 018

Fecha: 2026-05-14

## Estado acordado

- Archivo SQL de referencia actual:
  - `public/torneo_20260514_1014.sql`
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- El usuario aplica manualmente los SQL que decide ejecutar.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.
- Vista principal activa:
  - `views/torneos/index.ejs`

## Cambio: correos repetidos por entidad

Problema reportado:

- Se intento crear un usuario en A22 con los mismos datos existentes en A2:
  - `documento=999888`
  - `correo=sdcdscsd@gmail.com`
- La app bloqueaba con:
  - `El correo ya esta registrado en otro usuario. Use otro correo o comuniquese con el admin`

Causa encontrada:

- `routes/authRoutes.js` validaba correo de forma global.
- La DB tenia restriccion global:
  - `usuarios_correo_key UNIQUE (correo)`
- El dump `public/torneo_20260514_1014.sql` confirma:
  - `ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);`
  - `CREATE UNIQUE INDEX usuarios_documento_entity_id ON public.usuarios (documento, entity_id);`

Cambios de codigo realizados:

- `routes/authRoutes.js`
  - registro publico ahora valida duplicado de correo por:
    - `correo`
    - `entity_id`
  - el mensaje queda:
    - `Ya existe un usuario con ese correo en la entidad seleccionada`
- `models/Usuario.js`
  - se quito `unique: true` del campo `correo`.
- `controllers/torneoController.js`
  - edicion de datos de usuario por super admin valida correo por entidad:
    - `correo`
    - `entity_id`
    - excluyendo el usuario actual.

SQL pasado al usuario para permitir correo repetido entre entidades:

```sql
BEGIN;

SELECT
  entity_id,
  lower(btrim(correo)) AS correo_normalizado,
  COUNT(*) AS cantidad
FROM public.usuarios
WHERE correo IS NOT NULL
  AND btrim(correo) <> ''
GROUP BY entity_id, lower(btrim(correo))
HAVING COUNT(*) > 1;

ALTER TABLE public.usuarios
DROP CONSTRAINT IF EXISTS usuarios_correo_key;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_entity_id_key
ON public.usuarios (entity_id, lower(btrim(correo)))
WHERE correo IS NOT NULL
  AND btrim(correo) <> '';

COMMIT;
```

## Bug: delegado 999888 no podia administrar su equipo B

Problema reportado:

- Se agrego el usuario `999888` como delegado del equipo `B` en entidad A2.
- Al entrar a administrar el equipo, redirigia/rompia hacia:
  - `http://localhost:3000/torneos`

Verificacion en DB:

- Usuarios encontrados:
  - `999888` en `entity_id=2`, rol delegado, correo `sdcdscsd@gmail.com`
  - `999888` en `entity_id=27`, rol espectador, mismo correo
- Vinculo real:
  - usuario de `entity_id=2`
  - equipo `B`
  - `id_equipo=131`
  - `id_torneo=12`

Causa:

- En `controllers/equipoController.js`, `administrar` llamaba:
  - `puedeAdministrarEquipo(req, equipo)`
- Eso no permitia rol delegado.
- La validacion especifica de delegado existia mas abajo, pero nunca se alcanzaba.

Correccion:

- En `controllers/equipoController.js`, `administrar` ahora llama:

```js
puedeAdministrarEquipo(req, equipo, { permitirDelegado: true })
```

Verificacion puntual:

```txt
RENDER equipos/administrar
EQUIPO=B
USUARIOS=6
JUGADORES=0
DELEGADOS=1
EJS_OK
```

## Switch por torneo: delegados agregan jugadores

Pedido:

- Agregar un switch dentro del torneo seleccionado, en la pestana Equipos.
- Visible solo para admin y super admin.
- Controla si los delegados pueden agregar jugadores a sus equipos en ese torneo.
- Al desactivar debe avisar:
  - los delegados ya no podran agregar jugadores a sus equipos.
- Al activar debe avisar:
  - permitira que los delegados puedan ingresar nuevos jugadores a sus equipos.
- La confirmacion debe ser modal de la app, no alerta nativa del navegador.

Cambios de codigo realizados:

- `controllers/torneoController.js`
  - helper tolerante:
    - `obtenerPermitirAgregarJugadores(torneoId)`
  - si la columna aun no existe en DB, asume `true` para no romper la app.
  - en `gestionar`, agrega:
    - `torneoData.permitir_agregar_jugadores`
  - nuevo controlador:
    - `actualizarPermitirAgregarJugadores`
  - guarda el valor en `public.torneos.permitir_agregar_jugadores`.

- `routes/torneoRoutes.js`
  - nueva ruta:
    - `POST /torneos/:id_torneo/permitir-agregar-jugadores`
  - protegida por `requiereAdmin`.

- `controllers/equipoController.js`
  - helper tolerante:
    - `torneoPermiteAgregarJugadores(idTorneo)`
  - si la columna aun no existe en DB, asume `true`.
  - `administrar` pasa a la vista:
    - `permitirAgregarJugadores`
  - `asignarJugadores` bloquea a delegados cuando el torneo no permite agregar jugadores:
    - `El torneo no permite que los delegados agreguen jugadores a sus equipos`

- `views/torneos/index.ejs`
  - switch en pestana Equipos:
    - `Delegados agregan jugadores`
  - visible solo para `rol_id=3` o `rol_id=99`.
  - usa `confirmarApp()` y `modalAvisoApp`, no `confirm()` del navegador.
  - botones:
    - `Aceptar`
    - `Cancelar`
  - al cancelar, el switch vuelve a su estado anterior.

- `views/equipos/administrar.ejs`
  - si el usuario es delegado y el torneo tiene apagado el permiso, el boton:
    - `Asignar Jugador`
  - queda deshabilitado.

SQL pendiente para que el switch persista:

```sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_agregar_jugadores boolean NOT NULL DEFAULT true;
```

Nota:

- Se verifico que la DB actual todavia no tenia la columna:
  - `permitir_agregar_jugadores`
- El codigo esta hecho para no romper si aun no se aplico el SQL, pero el switch no podra guardar hasta aplicarlo.

## Finanzas: delegado ve detalles de su propio equipo

Pedido:

- En Finanzas, permitir que el delegado vea detalles de su propio equipo.

Hallazgo:

- El backend ya filtraba `finanzasResumen` para delegados en la carga principal.
- El endpoint AJAX `resumenFinanzas` tambien filtraba a equipos vinculados del delegado.
- El problema visible era la UI:
  - el boton `Detalles` estaba dentro de clase `finanzas-admin-only`.
  - por eso el delegado no podia abrir el modal.

Cambios realizados:

- `views/torneos/index.ejs`
  - el boton `Detalles` ya no esta oculto para delegados.
  - la columna `Acciones` ya no es `finanzas-admin-only`.
  - el saldo en tabla sigue oculto para vista publica/delegado con `finanzas-admin-only`.
  - el modal `Detalle financiero` queda disponible para los equipos que recibe el delegado.

- `controllers/torneoController.js`
  - `resumenFinanzas` fue endurecido:
    - solo roles `2`, `3`, `99` pueden ver finanzas.
    - valida que el torneo exista.
    - valida entidad salvo super admin.
    - delegado recibe solo equipos donde tiene vinculo activo en ese torneo.

Prueba puntual con delegado `999888`:

```txt
STATUS=200
SUCCESS=true
EQUIPOS=131:B
MOVS=0
```

Conclusion:

- El delegado `999888` solo recibe el equipo `B`.
- En ese momento no habia movimientos financieros registrados para ese equipo.

## Verificaciones realizadas

Se corrieron varias verificaciones durante la sesion:

```bash
node --check routes/authRoutes.js
node --check controllers/torneoController.js
node --check controllers/equipoController.js
node --check models/Usuario.js
node --check routes/torneoRoutes.js
```

Compilacion EJS:

```txt
EJS_TORNEOS_OK
EJS_EQUIPOS_OK
```

Tests:

```bash
npm.cmd test
```

Resultado:

```txt
No hay tests definidos
```

## Pendientes actuales

### Aplicar SQL pendiente

Para persistir el switch por torneo:

```sql
ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS permitir_agregar_jugadores boolean NOT NULL DEFAULT true;
```

### Probar en navegador

Probar con admin/super admin:

- Entrar al torneo.
- Pestana Equipos.
- Cambiar switch `Delegados agregan jugadores`.
- Confirmar que se abre modal de la app.
- Cancelar:
  - el switch vuelve al estado anterior.
- Aceptar:
  - guarda y vuelve a `#equipos`.

Probar con delegado:

- Entrar como delegado del equipo.
- Si el switch esta activo:
  - puede ver boton `Asignar Jugador`.
- Si el switch esta inactivo:
  - boton `Asignar Jugador` deshabilitado.
  - si intenta por POST directo, backend bloquea.

Probar finanzas como delegado:

- Pestana Finanzas.
- Debe ver solo su equipo.
- Debe poder abrir `Detalles`.
- No debe ver equipos ajenos por UI ni por endpoint:
  - `/torneos/:id_torneo/finanzas/resumen`

## Archivos tocados en esta sesion

- `routes/authRoutes.js`
- `models/Usuario.js`
- `controllers/torneoController.js`
- `controllers/equipoController.js`
- `routes/torneoRoutes.js`
- `views/torneos/index.ejs`
- `views/equipos/administrar.ejs`
- `public/contexto_018.md`

