# Contexto 026

Fecha: 2026-05-18

## Tema

Orden de ambientes Local / QA / PRD y primer despliegue QA en Railway.

## Estado Git

- Se creo la rama:
  - `qa`
- Se subio a GitHub:
  - `origin/qa`
- Commit creado:
  - `dce7ea0 preparar qa para ambientes local y prd`
- `main` queda como referencia de produccion estable.
- `qa` queda como ambiente de prueba antes de pasar cambios a `main`.

## Cambios aplicados en QA

### Orden de archivos

- `public/` quedo reservado para assets publicos:
  - `public/css/`
  - `public/images/`
  - `public/uploads/`
- Se movieron contextos, guias y SQL a `docs/`.
- Se creo:
  - `docs/orden_archivos.md`
- Los archivos privados quedaron en:
  - `docs/_privado/`
- `docs/_privado/` esta ignorado por Git.

### Sequelize / DB

Se unifico la conexion:

- `config/sequelize.js`
  - usa variables de entorno;
  - soporta `DB_SSL=true`;
  - no tiene password hardcodeado.
- `config/config.js`
  - queda como puente:
    - `module.exports = require('./sequelize');`
- `models/index.js`
  - dejo de usar `localhost`, `postgres`, `Soporte2018` hardcodeado;
  - ahora importa `../config/sequelize`.

Se agrego documentacion:

- `docs/db_ambientes.md`

### APK PRD

Se preparo diferenciacion visual/configurable:

- `capacitor.config.js`
  - usa:
    - `CAPACITOR_SERVER_URL`
    - `CAPACITOR_APP_NAME`
    - `CAPACITOR_APP_ID`
- Android queda con nombre visible:
  - `Torneos PRD`
- Se agrego icono adaptativo con pelota:
  - `android/app/src/main/res/drawable/ic_launcher_foreground_prd.xml`
- Se agrego documentacion:
  - `docs/apk_ambientes.md`
- URL PRD documentada:
  - `https://torneos-production.up.railway.app`

## Verificaciones locales

Ejecutado correctamente:

```powershell
node --check index.js
node --check models/index.js
node --check config/sequelize.js
node --check config/config.js
npm.cmd test
```

`npm test` directo fallo por politica de PowerShell (`npm.ps1`), por eso se uso `npm.cmd test`.

`node testConnection.js` fallo en local por password local incorrecto del usuario `postgres`.
Esto es esperado hasta ajustar `.env` local con el password real.

## Railway

Proyecto correcto:

- `striking-playfulness`

Servicios:

- `torneos` = app Node/GitHub
- `Postgres` = base de datos

La app se cambio para desplegar desde rama:

- `qa`

Variables revisadas/agregadas:

- `NODE_ENV=production`
- `PORT=8080`
- `DB_SSL=true`
- `DB_PORT=5432`
- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `SESSION_SECRET`

Importante:

- `PORT=8080` es el puerto de la app en Railway.
- `DB_PORT=5432` es el puerto de PostgreSQL.
- Que el log diga `Servidor corriendo en http://localhost:8080` es normal dentro del contenedor Railway.

## Estado del despliegue

Railway levanto la app correctamente.

Log observado:

```txt
Starting Container
npm run start
node index.js
Servidor corriendo en http://localhost:8080
```

Al entrar a login, la app conecto a PostgreSQL pero fallo por falta de tabla:

```txt
SequelizeDatabaseError
relation "usuarios" does not exist
```

Diagnostico:

- La conexion app -> Postgres funciona.
- La base Railway esta vacia.
- Falta montar/restaurar el dump SQL.

## Dump a restaurar

Archivo local:

```txt
docs/_privado/db_backups/torneo_20260517_2216.sql
```

Se verifico que es base limpia:

- estructura completa de tablas;
- roles:
  - `1 espectador`
  - `2 delegado`
  - `3 admin`
  - `99 super_admin`
- usuario super admin:
  - Julio Mendoza
  - documento `5160826`
  - rol `99`
- tablas de negocio como torneos/equipos/grupos/partidos/jugadores aparecen sin datos.

## Datos Railway Postgres observados

Desde `Postgres > Connect > Public Network`:

- Host:
  - `caboose.proxy.rlwy.net`
- Port:
  - `12882`
- Database:
  - `railway`
- User:
  - `postgres`
- Password:
  - oculto en Railway

Connection URL:

```txt
postgresql://postgres:********@caboose.proxy.rlwy.net:12882/railway
```

Comando sugerido para restaurar con `psql`:

```powershell
$env:PGPASSWORD="PASSWORD_DE_RAILWAY"
psql -h caboose.proxy.rlwy.net -U postgres -p 12882 -d railway -f "C:\torneos_v2\docs\_privado\db_backups\torneo_20260517_2216.sql"
Remove-Item Env:PGPASSWORD
```

## Bloqueo pendiente

En la PC no se encontro `psql` en PATH:

```txt
psql : El termino 'psql' no se reconoce...
```

Se intento usar pgAdmin, pero al crear servidor aparecio error interno:

```txt
'ServerManager' object has no attribute 'user_info'
```

Siguiente paso recomendado:

1. Buscar `psql.exe` instalado:

```powershell
Get-ChildItem "C:\Program Files" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Select-Object -First 10 FullName
```

2. Si aparece, ejecutar el dump con la ruta completa a `psql.exe`.
3. Si no aparece, instalar PostgreSQL client o arreglar pgAdmin.
4. Restaurar:

```txt
C:\torneos_v2\docs\_privado\db_backups\torneo_20260517_2216.sql
```

5. Verificar en Railway Postgres que ya aparezcan tablas:

```txt
usuarios
roles
torneos
equipos
grupos
partidos
```

6. Probar login en:

```txt
https://torneos-production.up.railway.app/login
```

## Nota de seguridad

No subir dumps reales ni credenciales a GitHub.

`docs/_privado/` queda local e ignorado por Git.
