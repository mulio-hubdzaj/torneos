# Contexto 007

Fecha: 2026-05-07

## Estado acordado

- `rol_id = 99` sigue siendo `super admin`.
- La copia SQL en `public` se usa solo como referencia.
- Auditoria principal por triggers de BD; `registrarAuditoria` sigue neutralizado.
- Vista principal activa: `views/torneos/index.ejs`.

## Marcadores en Partidos

- Se corrigio la carga de marcador para no permitir:
  - negativos;
  - valores con ceros a la izquierda como `03` o `0001`;
  - formatos no numericos.
- El backend en `controllers/partidoController.js` tambien valida el marcador.
- Se cambio el cierre del modal de marcador para evitar que quede bloqueado el navegador al cerrar con X o Cancelar.
- Verificaciones usadas:
  - `node --check controllers/partidoController.js`
  - compilacion EJS de `views/torneos/index.ejs`
  - `npm.cmd test`

## Iconos en grilla de Partidos

- En la tabla de partidos sorteados se agregaron iconos al lado izquierdo de Equipo A y Equipo B.
- `controllers/torneoController.js` ahora trae:
  - `icono_equipo_a`
  - `icono_equipo_b`
- La vista usa fallback:
  - `/images/default_team.png`

## Prototipo de carga por equipo y encuentro

- En la grilla de Partidos se agrego un boton con lapiz al lado derecho del nombre de cada equipo.
- El lapiz abre el modal `modalCargaEquipoPartido`.
- El modal permite cargar por equipo y encuentro:
  - goles por jugador;
  - tarjetas amarillas;
  - tarjetas rojas;
  - `Susp. Fechas`;
  - motivo de suspension;
  - items aplicados al equipo en ese partido;
  - entrega del delegado;
  - deuda anterior;
  - total de items;
  - saldo calculado.
- El saldo se calcula como:
  - deuda anterior + total items - entrega del delegado.
- Los campos de dinero se formatean mientras se escribe con miles estilo:
  - `100000` -> `100.000`
- Antes de guardar, la vista envia los montos limpios al backend.

## Rutas agregadas

- `GET /partidos/:partido_id/equipo/:equipo_id/carga`
- `POST /partidos/:partido_id/equipo/:equipo_id/carga`

## Guardado del prototipo

- `controllers/partidoController.js` guarda con SQL directo usando `sequelize.query`, porque algunos modelos locales no estan alineados con el dump real.
- Se registran datos en:
  - `estadisticas`
  - `sanciones`
  - `items_equipo`
  - `finanzas`
- Para evitar duplicados del mismo partido/equipo, al guardar se reemplazan los datos previos de:
  - estadisticas de jugadores de ese equipo en ese partido;
  - sanciones de jugadores de ese equipo en ese partido;
  - items del equipo en ese partido;
  - movimiento financiero con concepto `Encuentro #<id_partido> - <equipo>`.

## Estado de DB revisado desde el backup

- Tablas preparadas y con relaciones:
  - `estadisticas`
  - `eventos_partido`
  - `finanzas`
  - `items_equipo`
  - `sanciones`
- Triggers de auditoria detectados en el dump:
  - `estadisticas`
  - `finanzas`
- No se vieron triggers directos para:
  - `items_equipo`
  - `sanciones`
  - `eventos_partido`

## Pendientes recomendados

- Probar el modal con datos reales desde la app.
- Crear/aplicar triggers de auditoria para:
  - `items_equipo`
  - `sanciones`
  - `eventos_partido`
- Evaluar si conviene usar `eventos_partido` para goles/tarjetas en vez de solo `estadisticas`, o mantener ambos con una regla clara.
- Revisar pestaña Finanzas para que refleje claramente los movimientos tipo `partido`.
- Alinear modelos locales `Finanzas` y `Estadistica` con la estructura real del dump si se van a usar directamente.
- Seguir refinando textos y distribucion del modal despues de probar el prototipo.
