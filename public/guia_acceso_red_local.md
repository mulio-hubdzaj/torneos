# Guia para acceder a la app desde un celular en la misma red

Fecha: 2026-05-08

Objetivo: abrir la app de `C:\torneos_v2` desde un celular o tablet conectado a la misma red Wi-Fi que la PC con Windows 11 Pro.

## 1. Confirmar que la app corre en la PC

Desde PowerShell, entrar al proyecto:

```powershell
cd C:\torneos_v2
```

Iniciar la app:

```powershell
npm start
```

O, si se usa nodemon:

```powershell
npx nodemon index.js
```

La app deberia quedar disponible en la PC en:

```text
http://localhost:3000
```

## 2. Revisar que Express escuche desde la red

En `index.js`, se recomienda que el servidor escuche en `0.0.0.0`.

Ejemplo:

```js
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

Si esta solo como:

```js
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

normalmente tambien funciona, pero `0.0.0.0` deja explicito que acepta conexiones desde otros dispositivos de la red.

## 3. Obtener la IP local de la PC

En PowerShell:

```powershell
ipconfig
```

Buscar el adaptador de Wi-Fi y la linea:

```text
Direccion IPv4 . . . . . . . . . . : 192.168.x.x
```

Ejemplo:

```text
192.168.1.45
```

Esa IP es la direccion que usara el celular.

## 4. Abrir desde el celular

El celular debe estar conectado a la misma red Wi-Fi que la PC.

En el navegador del celular abrir:

```text
http://IP-DE-LA-PC:3000
```

Ejemplo:

```text
http://192.168.1.45:3000
```

Para entrar directo a un torneo:

```text
http://192.168.1.45:3000/torneos/gestionar/12
```

## 5. Permitir el puerto en Windows Firewall

Si desde la PC funciona pero desde el celular no abre, probablemente Windows Firewall esta bloqueando el puerto.

Abrir PowerShell como Administrador y ejecutar:

```powershell
New-NetFirewallRule -DisplayName "Torneos Node 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Tambien se puede permitir `node.exe` desde:

```text
Panel de control > Sistema y seguridad > Firewall de Windows Defender > Permitir una aplicacion
```

Marcar la red como privada si corresponde.

## 6. Verificar tipo de red en Windows

En Windows 11:

```text
Configuracion > Red e Internet > Wi-Fi > Propiedades de la red
```

Seleccionar:

```text
Red privada
```

Esto facilita que otros dispositivos de la misma red puedan acceder a servicios locales de la PC.

## 7. Checklist rapido si no conecta

- La app esta corriendo en la PC.
- En la PC abre `http://localhost:3000`.
- El celular y la PC estan en la misma red Wi-Fi.
- Se uso la IP correcta de la PC, no `localhost`.
- La URL tiene `http://`, no `https://`.
- El puerto es `3000`.
- Windows Firewall permite conexiones entrantes al puerto `3000`.
- Express escucha en `0.0.0.0`.
- No hay VPN activa que separe las redes.
- El router no tiene aislamiento de clientes Wi-Fi activado.

## 8. Nota sobre ambiente tipo produccion

Este metodo sirve para probar desde celulares dentro de la misma red local.

No es una publicacion real a internet.

Para produccion real haria falta:

- servidor accesible publicamente;
- dominio o IP publica;
- HTTPS;
- variables de entorno;
- configuracion segura de sesiones;
- base de datos gestionada o servidor PostgreSQL protegido;
- firewall y backups.

Para pruebas visuales y de uso movil, la red local es suficiente.
