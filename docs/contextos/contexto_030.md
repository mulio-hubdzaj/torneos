# Contexto 030

Fecha: 2026-05-19

## Tema

Cierre de tanda: correccion para permitir que un usuario delegado en un torneo pueda ser delegado en otro torneo distinto.

## Estado Git / workspace

- Rama actual:
  - `qa`
- Hay cambios locales sin commit.
- Archivos modificados observados:
  - `controllers/equipoController.js`
  - `controllers/partidoController.js`
  - `controllers/torneoController.js`
  - `index.js`
  - `routes/authRoutes.js`
  - `views/equipos/administrar.ejs`
  - `views/index.ejs`
  - `views/login.ejs`
  - `views/torneos/index.ejs`
- Archivos nuevos sin trackear:
  - `docs/contextos/contexto_027.md`
  - `docs/contextos/contexto_028.md`
  - `docs/contextos/contexto_029.md`
  - `docs/contextos/contexto_030.md`

## Cambio: delegado reusable en torneos distintos

Problema:

- Usuario documento `4444444` ya era delegado en un torneo.
- Al intentar asignarlo como delegado a un equipo de otro torneo, no se permitia.
- Causa:
  - La busqueda y la asignacion solo permitian usuarios con `rol_id = 1`.
  - Cuando un usuario ya es delegado en algun torneo, su `rol_id` pasa a `2`.
  - Entonces quedaba bloqueado aunque no tuviera vinculo en el torneo actual.

Regla correcta:

- Un usuario con rol:
  - `1` espectador;
  - `2` delegado;
- puede asignarse como delegado si:
  - pertenece a la misma entidad;
  - esta activo;
  - no tiene vinculo activo como delegado en otro equipo del mismo torneo.
- Si ya es delegado en otro torneo, debe seguir disponible para este torneo.

Aplicado:

- En `administrar` de equipo:
  - `puede_asignar_delegado` ahora permite `u.rol_id IN (1, 2)`.
- En `buscarUsuariosEntidad`:
  - busqueda con torneo tambien permite `u.rol_id IN (1, 2)`;
  - busqueda sin torneo tambien permite `u.rol_id IN (1, 2)`.
- En `asignarDelegados`:
  - validacion final del backend ahora permite `u.rol_id IN (1, 2)`;
  - sigue bloqueando si ya existe delegado activo en el mismo torneo.
- Mensaje de advertencia ajustado:
  - `Solo se pueden asignar usuarios sin vinculo de delegado en este torneo`.

Archivo:

- `controllers/equipoController.js`

## Verificacion con usuario 4444444

Consulta local observada:

- Documento:
  - `4444444`
- Usuario:
  - `JULIO PRUEBA`
- `rol_id`:
  - `2`
- Delegado activo en:
  - equipo `ARSENAL`
  - torneo `17`
  - torneo `misiones i`

Disponibilidad calculada:

- Torneo `17`:
  - `NO DISPONIBLE`
- Otros torneos de la misma entidad:
  - `DISPONIBLE`

Esto coincide con la regla esperada.

## Verificaciones realizadas

Ejecutado:

```powershell
node --check controllers\equipoController.js
```

Resultado:

```txt
JS_OK controllers/equipoController.js
```

Tambien se ejecuto consulta local con Sequelize para confirmar vinculos y disponibilidad del documento `4444444`.

## Pendientes recomendados al retomar

Probar manualmente:

- Ir a administrar equipo en un torneo distinto al `17`.
- Buscar documento `4444444`.
- Confirmar que aparece seleccionable.
- Guardar como delegado.
- Confirmar que:
  - se asigna correctamente;
  - no permite asignarlo a dos equipos del mismo torneo;
  - sigue apareciendo no disponible en el torneo donde ya tiene vinculo.

Pendientes pedidos al cierre:

- Revisar eliminacion de fechas vacias:
  - validar caso donde Fecha 4 y Fecha 5 estan vacias y sin cruces;
  - confirmar que aparezca habilitado `Eliminar fecha`;
  - corregir si sigue mostrando/bloqueando con mensaje `Solo se puede eliminar una fecha vacia`.
- En administracion de equipos:
  - actualmente existe opcion `Delegados agregan jugadores`;
  - agregar switch/opcion `Delegados modifican iconos de sus equipos`;
  - corregir que el delegado no esta pudiendo cambiar icono de su equipo.
- Portada de torneo:
  - al agregar portada, permitir ajustar antes de guardar;
  - incluir vista previa;
  - permitir mover/reencuadrar;
  - permitir agrandar y achicar;
  - guardar el resultado ajustado.
- Icono de equipo:
  - permitir eliminar icono personalizado;
  - al eliminar, volver al icono default.

Antes de commit:

```powershell
git status --short
node --check index.js
node --check controllers\equipoController.js
node --check controllers\partidoController.js
node --check controllers\torneoController.js
node --check routes\authRoutes.js
node -e "const ejs=require('ejs'); for (const f of ['views/index.ejs','views/login.ejs','views/equipos/administrar.ejs','views/torneos/index.ejs']) ejs.compile(require('fs').readFileSync(f,'utf8')); console.log('EJS_OK')"
npm.cmd test
```

## Nota final

No se hizo commit en esta tanda.
