# Contexto 016

Fecha: 2026-05-13

## Estado acordado

- La copia SQL en `public` sigue siendo solo referencia.
- No se aplican cambios directos a DB desde codigo/app sin pasar primero el SQL al usuario.
- El usuario aplica manualmente los SQL que decide ejecutar.
- Auditoria principal por triggers de BD.
- `rol_id = 99` sigue siendo super admin.

## Auditoria revisada

- Se verifico la copia:
  - `public/torneo_20260513_1656.sql`
- Se detecto que `utils/helpers.js` tiene `registrarAuditoria()` neutralizada:
  - no inserta registros;
  - solo imprime que la auditoria se maneja por triggers.
- Por eso la cobertura real depende de triggers en la BD y del contexto:
  - `app.usuario_id`
  - `app.entity_id`

## SQL aplicado manualmente por el usuario

El usuario aplico correctamente triggers nuevos para:

- `partidos`
- `items_equipo`
- `sanciones`
- `eventos_partido`
- `resultados`
- `usuarios`

SQL aplicado:

```sql
CREATE TRIGGER trg_partidos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.partidos
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_items_equipo_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.items_equipo
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_sanciones_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.sanciones
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_eventos_partido_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.eventos_partido
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_resultados_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.resultados
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_usuarios_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
```

Resultado informado:

- `Query returned successfully in 182 msec.`

## Cambios de codigo realizados

Se ajusto contexto de auditoria para que los triggers puedan registrar usuario/entidad.

### `controllers/partidoController.js`

- Se agrego helper local:
  - `setAuditContext(req, entityId = null, transaction = null)`
- Setea:
  - `app.usuario_id`
  - `app.entity_id`
- Usa `SET LOCAL` cuando hay transaccion.
- Usa `SET` cuando no hay transaccion.
- Se llama antes de acciones sobre:
  - crear cruce manual;
  - editar horario/cancha;
  - intercambiar equipos;
  - guardar horarios comunes;
  - actualizar marcador;
  - guardar carga de equipo por partido;
  - guardar carga de fecha libre;
  - sortear encuentros;
  - actualizar estado;
  - eliminar partido;
  - eliminar fecha.

### `controllers/equipoController.js`

- Se agrego helper local:
  - `setAuditContext(req, entityId = null, transaction = null)`
- Se llama antes de:
  - editar equipo;
  - activar/desactivar equipo.

### `controllers/finanzasController.js`

- Se importa `sequelize`.
- Se agrego helper local:
  - `setAuditContext(req, entityId = null)`
- Se llama antes de:
  - crear finanza;
  - actualizar finanza.
- Al crear finanza se completa `entity_id` desde el torneo o la sesion.

### `controllers/torneoController.js`

- En `actualizarReglaTarjetas` se setea:
  - `app.usuario_id`
  - `app.entity_id`
- Esto cubre el trigger de `torneos_reglas_tarjetas`.

## Verificaciones realizadas

- `node --check controllers/partidoController.js`
- `node --check controllers/equipoController.js`
- `node --check controllers/finanzasController.js`
- `node --check controllers/torneoController.js`
- `npm.cmd test`
  - responde `No hay tests definidos`.

## Pendientes de auditoria

### Importante

Aplicar SQL para que `DELETE` tambien audite en:

- `jugadores`
- `jugadores_equipos`

Motivo:

- en la copia SQL los triggers existentes eran solo `INSERT OR UPDATE`;
- quitar/desvincular jugadores necesita `DELETE`.

### SQL pendiente sugerido

Actualizar funcion y trigger de `jugadores` para soportar `DELETE`.

Actualizar funcion y trigger de `jugadores_equipos` para soportar `DELETE`.

El SQL completo ya fue pasado en chat al usuario y no se aplico desde la app.

### Pendientes secundarios

- Revisar si `roles` necesita trigger:

```sql
CREATE TRIGGER trg_roles_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
```

- Revisar acciones de usuarios fuera del panel de torneo:
  - cambio obligatorio de contrasena;
  - registro;
  - rutas antiguas de usuarios/admin.

## Proxima sesion

- Crear una nueva pestana visible:
  - `Audit`
- Objetivo probable:
  - visualizar auditoria dentro de la gestion del torneo;
  - filtrar por tabla/accion/usuario/fecha;
  - mostrar detalle legible;
  - respetar entidad/torneo segun permisos;
  - super admin puede ver mas alcance si se define.

## Notas

- No se revirtieron cambios previos ni archivos sin trackear.
- La copia SQL `public/torneo_20260513_1656.sql` no fue modificada.
