# Base de datos por ambiente

La app usa una sola configuracion de Sequelize:

- `config/sequelize.js`
- `models/index.js` importa esa conexion
- `config/config.js` queda como puente para archivos viejos que aun lo importan

## Local

Crear o ajustar `.env` en la raiz del proyecto:

```txt
NODE_ENV=development
PORT=3000
SESSION_SECRET=change_me_local

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD_LOCAL
DB_NAME=torneos_db
DB_SSL=false
```

## PRD Railway

En Railway, configurar variables de entorno:

```txt
NODE_ENV=production
SESSION_SECRET=valor_largo_y_privado

DB_HOST=valor_de_PGHOST
DB_PORT=5432
DB_USER=valor_de_PGUSER
DB_PASSWORD=valor_de_PGPASSWORD
DB_NAME=valor_de_PGDATABASE
DB_SSL=true
```

Si la app corre dentro de Railway puede usar el host interno. Si se conecta desde tu PC a la base PRD, normalmente hace falta el host publico de Railway.

## Verificacion

```powershell
node testConnection.js
```

Si aparece `password fallo para el usuario postgres`, revisar el valor local de `DB_PASSWORD` en `.env`.
