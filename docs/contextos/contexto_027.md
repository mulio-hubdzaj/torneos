# Contexto 027

Fecha: 2026-05-19

## Tema

Mejoras locales en `qa` para acceso publico sin login y ajustes de login/inicio.

## Estado Git / workspace

- Rama actual:
  - `qa`
- Hay cambios locales sin commit.
- Archivos modificados:
  - `controllers/torneoController.js`
  - `index.js`
  - `routes/authRoutes.js`
  - `views/index.ejs`
  - `views/login.ejs`
  - `views/torneos/index.ejs`

## Cambio: recuperar localhost

- Se detecto que local no tenia `.env`.
- La app intentaba conectar a PostgreSQL local con password vacio.
- `node testConnection.js` mostraba:
  - password fallido para usuario `postgres`.
- Se probo el password local historico configurado en la maquina.
- Conexion local quedo OK.
- Se creo `.env` local ignorado por Git con:
  - `PORT=3000`
  - `DB_HOST=localhost`
  - `DB_PORT=5432`
  - `DB_USER=postgres`
  - `DB_PASSWORD=TU_PASSWORD_LOCAL`
  - `DB_NAME=torneos_db`
  - `DB_SSL=false`

## Cambio: boton Entrar en login

Archivo:

- `views/login.ejs`

Se ajusto:

- El boton `Entrar` inicia deshabilitado.
- Se habilita solo cuando `Documento` y `Contrasena` tienen valor.
- Se mantiene validacion interna del formulario.

## Cambio: acceso publico sin login

Pedido:

- Permitir acceso visual basico sin registro/login.
- El usuario selecciona comunidad.
- Luego entra a una vista basica del torneo con pestañas.

Rutas agregadas:

- `GET /publico/comunidad?entity_id=...`
- `GET /publico/torneo/:id_torneo`

Archivos:

- `routes/authRoutes.js`
- `controllers/torneoController.js`
- `views/torneos/index.ejs`

Comportamiento:

- `/publico/comunidad` valida comunidad activa.
- Busca el primer torneo activo de la comunidad.
- Redirige a:
  - `/publico/torneo/:id_torneo#torneos`
- Si no hay comunidad o torneo activo, vuelve a `/`.

Modo publico en `torneoController`:

- Usa `vistaPublica = true`.
- Renderiza con `rol_id = 0`.
- No exige sesion.
- No registra acceso en auditoria.
- No carga usuarios, jugadores ni datos privados.
- Oculta acciones privadas en la vista.

Vista publica en `views/torneos/index.ejs`:

- Navbar muestra:
  - `Torneos`
  - `Fixture`
  - `Estadisticas`
- No muestra:
  - Grupos
  - Jugadores
  - Equipos
  - Finanzas
  - Items
  - Usuarios
  - Auditoria
  - Cerrar sesion
- Muestra boton:
  - `Iniciar sesion`

## Cambio: boton publico movido al inicio

Al principio el boton se agrego dentro de `login`.

Luego se pidio moverlo a la pantalla inicial:

- `views/index.ejs`

Estado actual:

- `/` muestra la tarjeta:
  - `Bienvenido a la App de gestion deportiva`
  - `Iniciar sesion`
  - `Crear cuenta`
- Debajo queda un bloque suelto:
  - boton verde `Ver torneos sin iniciar sesion`
- El boton abre modal:
  - `Selecciona comunidad`
- El modal lista comunidades activas con scroll.
- Cada comunidad tiene boton:
  - `Ver torneos`

`/login` vuelve a quedar solo para credenciales.

## Cambio pendiente pedido al final

Ultimo pedido antes de parar:

- Quitar para todos los usuarios la fila de accesos rapidos en la pestaña `Torneos`:
  - `Tabla`
  - `Goleadores`
  - `Fixture`
  - `Ultimos partidos`
  - `Proximos encuentros`

No se aplico porque se pidio parar y actualizar contexto.

Retomar mañana en:

- `views/torneos/index.ejs`

Buscar bloque:

```txt
dashboard-quick-actions
```

Y eliminar/ocultar esa fila completa para todos los roles.

## Verificaciones realizadas

Sintaxis:

```txt
node --check index.js
node --check routes/authRoutes.js
node --check controllers/torneoController.js
EJS_OK views/index.ejs
EJS_OK views/login.ejs
EJS_OK views/torneos/index.ejs
```

Pruebas HTTP con servidor local alternativo `PORT=3099`:

```txt
HOME_STATUS=200
HOME_HAS_PUBLIC_BUTTON=True
HOME_HAS_COMMUNITY_LINK=True
LOGIN_STATUS=200
LOGIN_HAS_PUBLIC_BUTTON=False
```

Tambien se verifico antes:

```txt
PUBLIC_STATUS=200
HAS_LOGIN_LINK=True
HAS_LOGOUT=False
```

Tests:

```txt
npm.cmd test
No hay tests definidos
```

## Nota importante para probar

Si `localhost:3000` sigue mostrando una version anterior:

1. Detener Node:

```powershell
Ctrl + C
```

2. Levantar de nuevo:

```powershell
npm.cmd start
```

3. Refrescar navegador:

```txt
Ctrl + F5
```

## Pendiente de commit

Nada fue commiteado.

Antes de cerrar definitivamente esta tanda:

```powershell
git status --short
node --check index.js
node --check routes/authRoutes.js
node --check controllers/torneoController.js
npm.cmd test
```

Luego decidir commit en `qa`.
