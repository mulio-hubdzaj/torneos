# Contexto 002

Fecha: 2026-05-06

## Estado acordado

- `rol_id = 99` es `super admin`.
- `super admin` no requiere `entity_id` al login.
- Para escrituras, `entity_id` se resuelve por el contexto del torneo/entrada.
- Para el resto de roles, `entity_id` es obligatorio.
- No tocar la lógica de jugadores salvo que se pida explícitamente.

## Tablero central

- El panel principal sigue siendo `views/torneos/index.ejs`.
- Las pestañas activas de trabajo son:
  - Torneos
  - Grupos
  - Jugadores
  - Equipos
  - Partidos
  - Finanzas
  - Estadísticas
  - Items

## Lo que se ajustó en esta sesión

- `Items` quedó ligado a `entity_id` e `id_torneo`.
- El modal de `Items` ahora marca obligatorios:
  - `Nombre`
  - `Monto`
- `Monto` solo acepta valores positivos.
- Se eliminó cualquier referencia a `documento` en el flujo de `items` porque `public.auditoria` no tiene esa columna.
- La auditoría de `items` quedó alineada a:
  - `id_usuario`
  - `accion`
  - `tabla_afectada`
  - `detalle`
  - `fecha_hora`
  - `entity_id`
- `detalle` en auditoría debe manejarse como `jsonb`.
- Se agregó validación para que no se repitan items por nombre dentro del mismo torneo y entidad, sin importar mayúsculas/minúsculas ni espacios.

## Reglas de `items`

- No permitir montos negativos.
- No permitir duplicados como `Tarjeta Roja` / `tarjeta roja`.
- La validación aplica al crear y al editar.

## Pendiente o siguiente paso

- Probar un `INSERT` real de `items` desde la app.
- Si hace falta, afinar el aviso visual de error en el modal.
- Mantener el alcance fuera de jugadores.
