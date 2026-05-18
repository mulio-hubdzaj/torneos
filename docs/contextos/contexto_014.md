# Contexto 014

Fecha: 2026-05-13

## Estado acordado

- Vista principal activa: `views/torneos/index.ejs`.
- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.

## Sedes / canchas por torneo

- Se decidio agregar sedes/canchas por torneo dentro de cada entidad.
- La cancha es opcional en los encuentros ya sorteados.
- La administracion de sedes/canchas vive dentro de la pestana `Items`, como boton junto a `Regla tarjetas`.
- En `Partidos`, el modal de editar horario permite seleccionar:
  - `Sin cancha`;
  - o una cancha activa del torneo actual.

## SQL aplicado manualmente por el usuario

- Se creo tabla:
  - `public.canchas`
- Campos:
  - `id_cancha`
  - `id_torneo`
  - `entity_id`
  - `nombre`
  - `direccion`
  - `estado`
- Se agrego columna nullable:
  - `public.partidos.id_cancha`
- Se agrego FK:
  - `partidos.id_cancha -> canchas.id_cancha`
- Se agrego trigger:
  - `trg_canchas_auditoria`
- El trigger usa:
  - `public.fn_auditoria()`
- Se decidio no usar `creado_en` en `canchas` porque la auditoria ya registra los movimientos.

## Logica implementada

- Nuevo modelo:
  - `models/Cancha.js`
- `models/index.js`
  - registra `Cancha`.
- `models/Partido.js`
  - agrega campo `id_cancha`.
- `controllers/torneoController.js`
  - consulta canchas del torneo actual.
  - envia `canchas` a `views/torneos/index.ejs`.
  - agrega:
    - `crearCancha`
    - `actualizarCancha`
    - `toggleCancha`
  - Al crear cancha:
    - toma `id_torneo` desde la ruta;
    - busca el torneo;
    - toma `entity_id` desde el torneo;
    - no confia en `entity_id` enviado por formulario.
  - Protege administracion de canchas para `rol_id = 3` y `rol_id = 99`.

- `routes/torneoRoutes.js`
  - agrega:
    - `POST /torneos/:id_torneo/canchas`
    - `POST /torneos/:id_torneo/canchas/:id_cancha`
    - `POST /torneos/:id_torneo/canchas/:id_cancha/toggle`

- `controllers/partidoController.js`
  - `actualizarHorario` ahora recibe `id_cancha`.
  - Valida que la cancha exista, este activa y pertenezca al torneo real del partido.
  - Permite `id_cancha = null` para dejar el partido sin cancha.

## Ajustes visuales

- En `Items` se agrego boton:
  - `Sedes/canchas`
- El modal `Sedes/canchas` permite:
  - crear cancha;
  - editar nombre y direccion;
  - activar/desactivar cancha.
- En la tabla de `Partidos` se agrego columna:
  - `Cancha`
- En el modal `Editar horario` se agrego selector:
  - `Cancha`

## Verificaciones usadas

- `node --check controllers/torneoController.js`
- `node --check controllers/partidoController.js`
- `node --check routes/torneoRoutes.js`
- `node --check models/Cancha.js`
- `node --check models/Partido.js`
- Compilacion EJS de:
  - `views/torneos/index.ejs`
- `npm.cmd test`
  - actualmente responde `No hay tests definidos`.

## Estado del workspace observado

- Hay cambios no relacionados o previos en `public`:
  - `public/auditoria_detalle_simple_20260507.sql` aparece eliminado.
  - `public/torneo_20260513_1107.sql` aparece sin trackear.
  - hay uploads sin trackear.
- No se revirtieron ni se tocaron esos cambios.

## Pendientes recomendados

- Probar en navegador:
  - crear cancha desde `Items -> Sedes/canchas`;
  - editar cancha;
  - activar/desactivar cancha;
  - asignar cancha desde `Partidos -> editar horario`;
  - dejar un encuentro en `Sin cancha`;
  - confirmar que la grilla de Partidos muestra la cancha correcta.
- Si mas adelante se requiere evitar duplicados, agregar validacion por nombre normalizado dentro del mismo torneo/entity.
