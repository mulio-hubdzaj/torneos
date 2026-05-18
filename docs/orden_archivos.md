# Orden de archivos del proyecto

## Publico

`public/` queda reservado para archivos que la aplicacion puede servir al navegador:

- `public/css/`
- `public/images/`
- `public/uploads/`

No guardar aca credenciales, backups SQL, dumps de base de datos ni notas internas.

## Documentacion

`docs/` concentra la documentacion del proyecto:

- `docs/contextos/`: historial de trabajo y decisiones.
- `docs/guias/`: guias de uso o despliegue.
- `docs/sql/`: SQL preparado para ejecutar manualmente, como migraciones puntuales.

## Privado local

`docs/_privado/` es solo para esta maquina:

- credenciales reales;
- datos de PRD;
- dumps y backups de base de datos.

Esta carpeta esta ignorada por Git y no debe subirse a GitHub.

## Regla simple

El codigo viaja por GitHub. Las credenciales viven en variables de entorno del servidor. Los backups reales quedan fuera de `public` y fuera de Git.
