# Contexto 008

Fecha: 2026-05-07

## Estado acordado

- La vista principal sigue siendo `views/torneos/index.ejs`.
- La copia grande `public/torneo_20260507_0901.sql` es referencia y no se toca.
- `public/auditoria_detalle_simple_20260507.sql` corresponde al parche de auditoria ya aplicado antes.
- El usuario aplico manualmente en PostgreSQL los SQL auxiliares de:
  - items automaticos de tarjetas;
  - reglas de tarjetas por torneo.

## Items automaticos de tarjetas

- Se preparo y el usuario aplico manualmente el trigger para crear:
  - `TARJETA AMARILLA`
  - `TARJETA ROJA`
- Los items se crean con `monto = 1`.
- La regla evita duplicados por `id_torneo`, `entity_id` y nombre normalizado.
- Se aclaro que el trigger inicial sobre `grupos` se dispara al crear grupos, no al crear solo el torneo.
- Tambien se hablo de la alternativa por `torneos`, pero el punto importante es que ya quedo aplicado manualmente segun el usuario.

## Regla de tarjetas por torneo

- Se agrego tabla en DB viva, aplicada manualmente por el usuario:
  - `public.torneos_reglas_tarjetas`
- Campos principales:
  - `acumula_amarillas`
  - `amarillas_para_suspension`
  - `fechas_suspension_acumulacion`
  - `reiniciar_al_sancionar`
  - `aplicar_item_amarilla`
  - `aplicar_item_roja`
- Tambien se agrego trigger de auditoria:
  - `trg_torneos_reglas_tarjetas_auditoria`
- En la app se agrego:
  - boton `Regla tarjetas` en pestana Items;
  - modal de configuracion por torneo;
  - ruta `POST /torneos/:id_torneo/regla-tarjetas`;
  - guardado mediante `controllers/torneoController.js`.
- Se corrigio el guardado de switches porque Express recibia valores como arreglo `['0','1']`.

## Decision funcional sobre tarjetas e items

- Si se cargan tarjetas a jugadores, el sistema suma:
  - amarillas;
  - rojas.
- Si existe en ese torneo/entity el item:
  - `TARJETA AMARILLA`
  - `TARJETA ROJA`
  entonces se agrega automaticamente en `Items y finanzas` con la cantidad marcada.
- Si el item no existe, no hace nada.
- El admin igual puede agregar items manualmente aunque no declare tarjetas a jugadores.
- Se quitaron de la vista los checks de item automatico para no confundir.

## Decision funcional sobre acumulacion

- No se implementa por trigger automatico de DB.
- La regla recomendada es desde la app:
  - al guardar tarjetas, calcular acumulacion por torneo;
  - si llega al limite, mostrar aviso/propuesta al admin;
  - el admin confirma la suspension/deshabilitacion;
  - se registra en `sanciones`.
- No borrar historial de tarjetas.
- Para reiniciar conteo operativo, calcular desde la ultima sancion por acumulacion hacia adelante.

## Ajustes visuales

- En modal de regla de tarjetas se mejoraron etiquetas:
  - `Suspension automatica por acumulacion`
  - `Amarillas para suspender`
  - `Fechas de suspension`
  - `Reiniciar conteo`
- Las etiquetas de los campos numericos quedaron en negro.
- Se reorganizo el modal para que los switches tengan titulo y descripcion visibles.

## Lapiz de carga por equipo/fecha

- Si un equipo ya tiene carga registrada en una fecha, el lapiz debe verse verde.
- Si no tiene carga, amarillo.
- Se agrego cambio inmediato a verde al guardar carga por `fetch`, sin recargar navegador.
- Aplica para:
  - equipos en partidos normales;
  - equipos libres.

## Archivos principales modificados

- `views/torneos/index.ejs`
- `controllers/torneoController.js`
- `routes/torneoRoutes.js`

## Verificaciones usadas

- `node --check controllers/torneoController.js`
- `node --check routes/torneoRoutes.js`
- compilacion EJS de `views/torneos/index.ejs`
- `npm.cmd test`

## Pendientes para retomar

- Implementar alerta/propuesta real de suspension cuando el jugador alcance acumulacion configurada.
- Mostrar acumulado de tarjetas debajo de cada jugador en la seccion de jugadores/items.
- Definir como se visualizara el historico de tarjetas y sanciones por acumulacion.
- Revisar si conviene mantener campos `aplicar_item_amarilla` y `aplicar_item_roja` en DB aunque ya no se muestren en la vista.
