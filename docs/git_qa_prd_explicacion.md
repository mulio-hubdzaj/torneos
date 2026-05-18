# Git, GitHub, QA y Produccion Explicado Simple

## La idea base

GitHub es como una nube donde guardas copias del proyecto.

Tu PC tiene una copia:

```txt
C:\torneos_v2
```

GitHub tiene otra copia:

```txt
https://github.com/mulio-hubdzaj/torneos
```

- Local: lo que esta en tu PC.
- Remoto: lo que esta en GitHub.
- Git: el sistema que compara y mueve cambios entre tu PC y GitHub.
- GitHub: la pagina donde vive el proyecto remoto.

## Que es un commit

Un commit es como una foto guardada del proyecto en un momento exacto.

Ejemplo:

```txt
Commit 1: app inicial
Commit 2: agregue jugadores
Commit 3: corregi finanzas
Commit 4: prepare version PRD
```

Cada commit tiene un codigo y un mensaje.

Cuando haces:

```powershell
git commit -m "corregir conexion prd"
```

le estas diciendo a Git:

```txt
Guarda una foto de estos cambios con este nombre.
```

## Que es una branch

Una branch es como una linea paralela de trabajo.

Pensalo asi:

```txt
main        = produccion, lo estable
qa          = pruebas antes de produccion
feature-x   = cambios nuevos que estoy probando
```

Ejemplo simple:

```txt
main: version que usa la gente
qa:   version donde pruebo antes
dev:  version donde puedo romper cosas tranquilo
```

La branch te permite trabajar sin romper produccion.

## Ejemplo del restaurante

Imagina que tu app es un restaurante.

- main: el plato que ya servis a clientes.
- qa: la cocina de prueba.
- dev: donde inventas recetas nuevas.

No queres servir una receta nueva directo a clientes sin probarla.

Entonces el camino ideal es:

```txt
dev -> qa -> main
```

Primero trabajas en dev.

Si parece bien, pasas a qa.

Si QA funciona, pasas a main.

## Local y remoto

Cada branch puede existir en tu PC y en GitHub.

Ejemplo:

```txt
Local:
main
qa
dev

Remoto GitHub:
origin/main
origin/qa
origin/dev
```

origin normalmente significa GitHub.

Cuando haces:

```powershell
git push
```

subis tus cambios locales a GitHub.

Cuando haces:

```powershell
git pull
```

bajas cambios desde GitHub a tu PC.

## Que es JIT o el servidor

En esta explicacion, JIT representa el lugar donde desplegaste la app: hosting, servidor o panel donde corre la aplicacion.

Pensalo asi:

```txt
Tu PC         = donde programas
GitHub        = donde guardas versiones
JIT/hosting   = donde corre la app para que otros la usen
Base PRD      = donde viven los datos reales
```

Flujo ideal:

```txt
PC local -> GitHub -> servidor/JIT -> usuarios
```

Vos cambias codigo en tu PC.

Lo subis a GitHub.

El servidor/JIT toma esa version y la ejecuta.

## Produccion vs QA

Produccion es lo real.

```txt
PRD / produccion = lo que usan usuarios reales
QA / pruebas     = una copia para probar antes
Local            = tu PC
```

Idealmente tendrias:

```txt
Local:
http://localhost:3000

QA:
https://qa-tuapp.com

PRD:
https://tuapp.com
```

Y tambien bases separadas:

```txt
DB_LOCAL = para tu PC
DB_QA    = para pruebas
DB_PRD   = datos reales
```

Nunca conviene probar cosas peligrosas directo en DB_PRD.

## La regla de oro

Codigo y base de datos tienen que avanzar juntos.

Ejemplo:

Tu codigo nuevo espera una columna:

```txt
grupos.visible_fixture
```

Pero si en PRD esa columna no existe, la app puede fallar.

Entonces cada version deberia tener:

```txt
1. Codigo
2. SQL necesario
3. Instrucciones de despliegue
```

Ejemplo:

```txt
Version 2026-05-18
- subir codigo
- ejecutar SQL grupos_visible_fixture_20260517.sql
- reiniciar app
- probar login
- probar fixture
```

## Como podrias manejar branches

Una forma simple y sana:

```txt
main = produccion
qa   = pruebas
dev  = trabajo diario
```

Flujo:

```txt
dev -> qa -> main
```

1. Trabajas en dev.
2. Cuando algo esta listo, lo pasas a qa.
3. Probas en QA.
4. Si funciona, lo pasas a main.
5. Produccion usa main.

## Comandos basicos

Ver donde estas:

```powershell
git branch
```

Crear branch QA:

```powershell
git checkout -b qa
```

Subir branch QA a GitHub:

```powershell
git push -u origin qa
```

Volver a main:

```powershell
git checkout main
```

Crear branch de trabajo:

```powershell
git checkout -b dev
```

Subir dev:

```powershell
git push -u origin dev
```

Ver el estado de archivos:

```powershell
git status
```

Ver archivos en forma corta:

```powershell
git status --short
```

Ver a que GitHub apunta el proyecto:

```powershell
git remote -v
```

## Que no debe ir a GitHub

No subir:

```txt
contrasenas
credenciales PRD
archivos .env reales
backups con datos sensibles
```

Si subir:

```txt
.env.example
SQL de migraciones sin passwords
codigo
documentacion de despliegue
```

## Como resolver el caso del proyecto Torneos

El problema actual es de orden, no solo de codigo.

Conviene separar:

```txt
Codigo
Configuracion
Base de datos
Documentacion de despliegue
```

Una estructura saludable podria ser:

```txt
main
  version estable para PRD

qa
  version para probar antes

db/migrations
  cambios SQL ordenados

docs/despliegues
  notas de que se subio y que SQL se ejecuto
```

Las credenciales se ponen en el panel del servidor/JIT o en variables de entorno, no dentro del codigo.

## Frase clave

```txt
El codigo viaja por GitHub.
Las credenciales viven en el servidor.
La base de datos cambia con SQL registrado y ordenado.
```

