# Contexto 021

Fecha: 2026-05-17

## Estado acordado

- Se trabaja sobre la version web.
- Vista principal activa:
  - `views/torneos/index.ejs`
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de PostgreSQL.
- `rol_id = 99` sigue siendo super admin.

## Login en espanol

Se reviso `views/login.ejs` para evitar textos del navegador en ingles:

- Se agrego:
  - `lang="es"`
  - `meta charset="UTF-8"`
- Se corrigieron textos visibles:
  - `Iniciar sesión`
  - `Contraseña`
  - `código`
  - `sesión`
  - `Restablecer contraseña`
- Se agrego validacion propia en la vista con `novalidate`:
  - si falta documento, muestra `Ingrese su documento.`
  - si falta contrasena, muestra `Ingrese su contraseña.`
- Se agrego autocomplete:
  - `documento`: `autocomplete="username"`
  - `contrasena`: `autocomplete="current-password"`

## Alertas y confirmaciones internas

Se hizo una revision para quitar `alert()`, `confirm()` y `prompt()` nativos del navegador en vistas principales.

Cambios:

- En `views/torneos/index.ejs` se reemplazaron avisos/confirmaciones por:
  - `mostrarAvisoApp(...)`
  - `confirmarApp(...)`
  - formularios con clase `form-confirmar-app`
- El modal general `modalAvisoApp` quedo normalizado:
  - cabecera azul;
  - boton principal verde;
  - boton cancelar con estilo outline azul.
- Se normalizaron confirmaciones de:
  - sorteo;
  - cruce manual;
  - eliminar encuentro;
  - intercambiar equipos;
  - horarios comunes;
  - marcador;
  - estado de partido;
  - desactivar equipo con partidos;
  - eliminar portada;
  - eliminar fecha;
  - eliminar item;
  - mudanza de equipo entre grupos.
- En `views/grupos/gestionar.ejs` se agrego un modal interno simple para reemplazar alertas del sorteo de grupos.
- En `views/grupos/index.ejs` se preparo el formulario de eliminar grupo con `form-confirmar-app`.

Verificacion realizada:

```bash
rg -n "alert\(|confirm\(|prompt\(" views public/css -S
```

Resultado al momento:

- No se encontraron `alert()`, `confirm()` ni `prompt()` nativos en `views` ni `public/css`.

## Normalizacion visual web

Pedido del usuario:

- Mantener una paleta uniforme.
- Cabeceras de secciones en azul.
- Botones especiales/acciones principales en verde.
- Evitar cabeceras negras en modales.

Cambios aplicados en `views/torneos/index.ejs`:

- Cabeceras azules para:
  - `Fixture`
  - `Finanzas`
  - `Estadisticas`
  - `Items`
  - `Usuarios`
  - `Auditoria`
- Tablas con encabezados azules.
- Botones principales normalizados a verde.
- Boton activo superior de pestañas en azul.
- Se corrigio el contraste en Fixture:
  - labels de filtros en negro/negrita;
  - `Ver día` azul y negrita;
  - `Cruce manual` azul;
  - texto `Asigna fecha y horarios espaciados...` en negro fuerte/negrita.

## Fixture

Cambios funcionales/UX:

- Al entrar a `Fixture`, la fecha activa ya no es siempre la primera.
- Ahora se selecciona automaticamente la primera fecha que tenga algun partido no finalizado.
- Si Fecha 1 esta toda finalizada, abre Fecha 2 si tiene partidos pendientes/programados/suspendidos/en proceso.
- Si todas las fechas estan finalizadas, abre Fecha 1.
- Si la URL trae `?fecha=N`, se respeta esa fecha como antes.
- Las pestañas de fechas ahora tienen:
  - borde;
  - sombra suave;
  - color azul en activa;
  - aspecto claro de boton.

## Modales normalizados

Se recorrio `views/torneos/index.ejs` y se eliminaron cabeceras/botones oscuros o amarillos en modales.

Quedaron normalizados:

- `Cruce manual`
  - cabecera azul;
  - `Crear cruce` verde.
- `Editar marcador`
  - cabecera azul;
  - `Guardar` verde.
- `Carga del encuentro`
  - cabecera azul;
  - `Registrar carga` verde.
- `Detalle financiero`
  - cabecera azul;
  - `Cerrar` gris.
- `Regla de tarjetas`
  - cabecera azul;
  - `Guardar regla` verde.
- `Sedes/canchas`
  - cabecera azul;
  - `Agregar` verde.
- `Editar datos de usuario`
  - cabecera azul;
  - `Guardar datos` verde.
- `Asignar Jugadores`
  - cabecera azul.
- `Asignar Delegados`
  - cabecera azul.
- `modalAvisoApp`
  - cabecera azul;
  - aceptar verde.

Tambien se normalizo en:

- `views/equipos/administrar.ejs`
  - modales `Asignar Delegados` y `Asignar Jugadores` con cabecera azul.
- `views/equipos/ver.ejs`
  - boton `Cerrar` dejo de ser `btn-dark` y paso a `btn-secondary`.

Verificacion:

```bash
rg -n "modal-header bg-dark|btn btn-dark|modal-header bg-warning|btn btn-warning" views -S
```

Resultado:

- No quedan coincidencias en `views`.

## Modal Regla de tarjetas

Problema observado:

- Los switches apagados parecian deshabilitados por verse muy opacos.

Cambios:

- Switch apagado:
  - fondo azul claro;
  - borde azul;
  - opacidad completa.
- Switch prendido:
  - azul solido.
- Bloques internos:
  - borde azul suave;
  - fondo claro;
  - texto mas legible.

## Modal de carga por equipo / items por cruce

Problemas observados:

- `Jugadores` e `Items y finanzas` se perdian por contraste.
- Boton `Registrar carga` estaba oscuro.

Cambios:

- Tabs internos:
  - inactivos con texto verde fuerte, borde verde y fondo verde claro;
  - activo/hover con fondo verde y texto blanco;
  - ancho minimo para que ambos se vean como botones.
- `Registrar carga` paso a verde.

## Archivos tocados en esta tanda

- `views/login.ejs`
- `views/torneos/index.ejs`
- `views/grupos/gestionar.ejs`
- `views/grupos/index.ejs`
- `views/equipos/administrar.ejs`
- `views/equipos/ver.ejs`
- `public/contexto_021.md`

## Verificaciones realizadas

Compilacion EJS:

```txt
EJS_OK views/login.ejs
EJS_OK views/torneos/index.ejs
EJS_OK views/grupos/gestionar.ejs
EJS_OK views/grupos/index.ejs
EJS_OK views/equipos/administrar.ejs
EJS_OK views/equipos/ver.ejs
```

Tests:

```bash
npm.cmd test
```

Resultado:

```txt
No hay tests definidos
```

## Pendientes recomendados

- Probar en navegador:
  - Login sin documento/contrasena para confirmar mensajes internos en espanol.
  - Fixture con Fecha 1 finalizada y Fecha 2 programada para confirmar apertura automatica.
  - Modales:
    - Cruce manual;
    - Carga del encuentro;
    - Regla tarjetas;
    - Sedes/canchas;
    - Detalle financiero;
    - Editar marcador;
    - Asignar jugadores/delegados.
- Revisar responsive en celular real despues de los cambios visuales.
- Si aparecen modales en otras vistas fuera del flujo principal, aplicar el mismo patron:
  - cabecera azul;
  - accion principal verde;
  - cancelar/cerrar gris u outline azul.
