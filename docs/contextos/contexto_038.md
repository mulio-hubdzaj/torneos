# Contexto 038

Fecha: 2026-05-25

## Tema

Ajuste de Fixture: cruce manual entre equipos de grupos distintos, recalculo de equipos libres y visualizacion de grupo combinado.

## Estado Git

Rama esperada:

- `qa`

Estado observado al crear este contexto:

```txt
 M android/app/capacitor.build.gradle
 M android/app/src/main/java/com/torneosv2/app/MainActivity.java
 M android/capacitor.settings.gradle
 M controllers/equipoController.js
 M controllers/partidoController.js
 M controllers/torneoController.js
 M index.js
 M package-lock.json
 M package.json
 M routes/torneoRoutes.js
 M views/cambiar_contrasena.ejs
 M views/login.ejs
 M views/registro.ejs
 M views/restablecer_contrasena.ejs
 M views/torneos/index.ejs
?? docs/contextos/contexto_037.md
```

Nota:

- `contexto_037.md` sigue sin trackear en Git.
- No se hizo commit ni push en esta tanda.

## Cambio: cruce manual entre grupos distintos

Pedido:

- En Fixture, al usar `Cruce manual`, poder elegir de que grupo viene cada equipo:
  - Grupo Equipo A;
  - Equipo A;
  - Grupo Equipo B;
  - Equipo B.
- Permitir cruces del mismo grupo o de grupos distintos.

Aplicado en `views/torneos/index.ejs`:

- El modal `Cruce manual` ya no usa un unico selector `Grupo`.
- Se agregaron dos selectores:
  - `manualGrupoEquipoA` / `id_grupo_equipo_a`;
  - `manualGrupoEquipoB` / `id_grupo_equipo_b`.
- Cada selector de equipo se pobla segun su grupo correspondiente.
- El mensaje del modal ahora indica que se pueden seleccionar equipos del mismo grupo o de grupos distintos.
- Se conserva un hidden `manualGrupoFixtureId` / `id_grupo` para mantener compatibilidad con el grupo/fecha organizadora del partido.

Aplicado en `controllers/partidoController.js`:

- `crear` acepta:
  - `id_grupo_equipo_a`;
  - `id_grupo_equipo_b`;
  - `id_grupo` como grupo organizador/compatibilidad.
- Ya no valida que ambos equipos pertenezcan al mismo grupo.
- Ahora valida:
  - ambos equipos pertenecen al torneo;
  - Equipo A pertenece al grupo elegido para Equipo A;
  - Equipo B pertenece al grupo elegido para Equipo B;
  - no se permite usar el mismo equipo en ambos lados.

## Cambio: equipos libres con cruces intergrupo

Problema detectado durante prueba practica:

- Si en una misma fecha quedaba libre un equipo del Grupo 1 y otro del Grupo 2, y luego se cargaba manualmente un cruce entre esos dos equipos, uno o ambos podian seguir apareciendo como libres.
- La causa era que el calculo de libres miraba `partido.id_grupo`, no el grupo real de cada equipo.

Aplicado en `controllers/torneoController.js`:

- Se agrego mapa `grupoPorEquipo` para conocer el grupo real de cada equipo.
- El calculo de `fecha.equipos_libres` ahora registra cada equipo jugado en su grupo real:
  - Equipo A descuenta del grupo real de Equipo A;
  - Equipo B descuenta del grupo real de Equipo B.
- Con filtro por grupo activo, solo se muestran libres del grupo filtrado.

Resultado esperado:

- Si Grupo A tiene libre a `EQUIPO 1` y Grupo B tiene libre a `EQUIPO A`, al crear `EQUIPO 1 vs EQUIPO A`, ambos dejan de aparecer como libres en esa fecha.

## Cambio: columna Grupo en cruces intergrupo

Problema detectado:

- En un cruce intergrupo, la columna `Grupo` mostraba solo el grupo organizador del partido, por ejemplo `B`.
- Visualmente eso era confuso porque el partido en realidad combinaba equipos de dos grupos.

Aplicado en `controllers/torneoController.js`:

- Se agrego helper `obtenerNombreGrupoCruce(partido)`.
- El nombre visible del grupo ahora se calcula con el grupo real de Equipo A y Equipo B:
  - mismo grupo: `B`;
  - grupos distintos: `A-B` o `B-A`, segun el orden Equipo A vs Equipo B.
- Si el partido tiene fase ida/vuelta, se conserva el sufijo ya existente:
  - `A-B - Ida`;
  - `A-B - Vuelta`.

## Verificaciones ejecutadas

Comandos ejecutados correctamente:

```txt
node --check controllers/torneoController.js
node --check controllers/partidoController.js
```

Vista EJS:

```txt
EJS_OK views/torneos/index.ejs
```

## Pendientes recomendados

- Probar en navegador el caso practico:
  - grupo A con un libre;
  - grupo B con un libre;
  - crear cruce manual entre ambos libres;
  - confirmar que ninguno queda listado como libre;
  - confirmar que la columna Grupo muestra `A-B` o equivalente.
- Revisar diff final completo antes de commit.
- Confirmar si todos los cambios acumulados de `contexto_037` y `contexto_038` van juntos en el proximo commit a `qa`.
- Preparar commit/push cuando el usuario lo indique.
