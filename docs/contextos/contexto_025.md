# Contexto 025

Fecha: 2026-05-17

## Pedido

En la pestana `Grupos`, debajo de `Agregar`, agregar una accion con ojo tachado:

- Texto:
  - `Dejar de ver en Fixture`
- Descripcion:
  - `Se vera el historico en dashboard, pero no en Fixture.`
- Uso:
  - Cuando se pase a liguilla, ocultar grupos/fases anteriores del Fixture sin borrar historico.
- Disponible solo para:
  - admin (`rol_id = 3`)
  - super admin (`rol_id = 99`)

## Cambios aplicados

### SQL preparado

Archivo:

- `public/grupos_visible_fixture_20260517.sql`

Contenido:

```sql
ALTER TABLE grupos
ADD COLUMN IF NOT EXISTS visible_fixture boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN grupos.visible_fixture IS
'Controla si los partidos del grupo se muestran en Fixture. Si es false, el historico sigue disponible para dashboard/estadisticas.';
```

Importante:

- No se aplico a la DB desde la app.
- Hay que ejecutar este SQL antes de usar el boton.

### Backend

- `controllers/grupoController.js`
  - Nueva accion `actualizarVisibilidadFixture`.
  - Valida permisos admin/super admin y entidad.
  - Actualiza `grupos.visible_fixture`.
  - Si falta la columna, muestra mensaje indicando que falta aplicar SQL.

- `routes/grupoRoutes.js`
  - Nueva ruta:
    - `POST /grupos/fixture-visibilidad/:id_grupo`

- `controllers/torneoController.js`
  - Lee grupos ocultos del fixture con tolerancia si la columna no existe.
  - El Fixture excluye partidos de grupos con `visible_fixture = false`.
  - Dashboard/estadisticas siguen usando el historico completo.
  - Se pasa `gruposFixture` a la vista para filtros y cruces manuales.

### Vista

- `views/torneos/index.ejs`
  - En cada tarjeta de grupo se agrego boton solo para admin/super admin:
    - `Dejar de ver en Fixture`
    - `Volver a ver en Fixture`
  - Usa iconos Bootstrap:
    - `bi-eye-slash`
    - `bi-eye`
  - Tiene confirmacion interna con `form-confirmar-app`.
  - Filtro de Fixture y cruce manual usan solo grupos visibles en Fixture.

## Verificaciones

```txt
node --check controllers/torneoController.js
node --check controllers/grupoController.js
node --check routes/grupoRoutes.js
EJS_OK views/torneos/index.ejs
npm.cmd test -> No hay tests definidos
```

## Cierre de tanda

- El boton queda habilitado solo para:
  - admin (`rol_id = 3`)
  - super admin (`rol_id = 99`)
- No se ejecuto SQL directo contra la DB.
- Antes de probar el boton en navegador/APK, aplicar manualmente:
  - `public/grupos_visible_fixture_20260517.sql`
- Luego de aplicar el SQL, flujo recomendado para probar:
  - entrar a `Grupos`;
  - tocar `Dejar de ver en Fixture` en una fase vieja;
  - confirmar que desaparece de `Fixture`;
  - confirmar que dashboard/estadisticas siguen mostrando historico;
  - tocar `Volver a ver en Fixture` si se quiere restaurar.
