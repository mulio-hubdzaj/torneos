# Contexto 024

Fecha: 2026-05-17

## Tema

Revision de Finanzas por caso NACIONAL:

- En el detalle financiero se veia `A - Fecha 2` con `Deuda anterior 120.000`.
- El usuario indico que en Fecha 1 no habia nada cargado, por lo que ese saldo anterior no correspondia.

## Causa encontrada

- La tabla `finanzas` guarda snapshots:
  - `deuda_inicial`
  - `deuda_total`
  - `monto_aportado`
  - `saldo`
- Al guardar una carga, el codigo buscaba la deuda anterior usando el ultimo movimiento por:
  - `fecha_registro DESC`
  - `id_finanza DESC`
- Eso mezcla el orden de carga con el orden real del fixture.
- Si se carga Fecha 3, Fecha 4 o Fecha 5 antes que Fecha 2, la Fecha 2 puede heredar deuda de fechas futuras.

Ejemplo visto en la copia SQL:

- NACIONAL tiene movimientos guardados para:
  - Encuentro #321 - Fecha 4
  - Encuentro #323 - Fecha 5
  - Encuentro #319 - Fecha 3
  - Encuentro #317 - Fecha 2
- El encuentro #317 fue guardado despues y quedo con `deuda_inicial = 120.000`.

## Cambios aplicados

### `controllers/torneoController.js`

- Se agrego recalculo visual de movimientos financieros por orden de fixture:
  - `numero_fecha ASC`
  - `fecha_calendario ASC`
  - `id_finanza ASC`
- El resumen de Finanzas ya no confia ciegamente en los snapshots guardados para mostrar:
  - `deuda_inicial`
  - `saldo`
- Para mostrar el detalle, recalcula:
  - `deuda anterior = saldo acumulado hasta la fecha anterior`
  - `saldo = deuda anterior + items/gastos - entrega`

### `controllers/partidoController.js`

- Se agrego `calcularSaldoAnteriorFinanzas(...)`.
- Al abrir o guardar carga de partido, la deuda anterior se calcula usando solo movimientos de fechas anteriores del fixture.
- Al abrir o guardar fecha libre, se aplica el mismo criterio.
- Esto evita que una Fecha 2 tome deuda de Fecha 3/4/5 solo porque esas cargas fueron registradas antes.

## Verificaciones

```txt
node --check controllers/torneoController.js
node --check controllers/partidoController.js
EJS_OK views/torneos/index.ejs
npm.cmd test -> No hay tests definidos
```

## Nota importante

- No se modifico la base de datos.
- El ajuste corrige el calculo mostrado y los nuevos calculos al abrir/guardar cargas.
- Si se quiere limpiar los snapshots viejos en DB, conviene generar un SQL de recalculo y pasarlo primero al usuario antes de ejecutarlo.
