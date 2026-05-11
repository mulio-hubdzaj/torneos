# Contexto 010

Fecha: 2026-05-08

## Tema de la sesion

- Pruebas de acceso a la app desde otro dispositivo en la misma red local.
- Objetivo: abrir la app desde otra PC/celular usando la IP local de la PC principal.

## Guia creada

- Se creo:
  - `public/guia_acceso_red_local.md`
- Tambien se creo una version compatible con Word basada en HTML:
  - `public/guia_acceso_red_local_word.doc`
- La version Word no es `.docx` real; es un `.doc` que Word puede abrir.
- Se intento generar `.docx` automatico con imagenes, pero el comando fue rechazado por el entorno.

## Configuracion de Express

- Se modifico `index.js` para escuchar explicitamente en todas las interfaces:

```js
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

- Antes estaba solo:

```js
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

- Se verifico sintaxis con:

```powershell
node --check index.js
```

## Pruebas realizadas

- IP usada en la PC principal:
  - `192.168.100.16`
- URL de prueba:
  - `http://192.168.100.16:3000/login`
- Desde la PC principal se verifico que respondia:
  - `STATUS=200`
- Se verifico que Node escuchaba en:
  - `0.0.0.0:3000`
- Desde otra PC inicialmente:
  - `ping` respondia;
  - `curl http://192.168.100.16:3000` no conectaba.
- Luego se logro acceder desde otra PC.
- Quedo pendiente solo probar desde celular, pero ya estaba encaminado.

## Firewall

- Se creo temporalmente una regla:

```powershell
New-NetFirewallRule -DisplayName "Node Torneos 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

- Luego se elimino correctamente con:

```powershell
Remove-NetFirewallRule -DisplayName "Node Torneos 3000"
```

- El segundo intento de eliminar y el intento de deshabilitar fallaron porque la regla ya no existia. Esto fue correcto.

## Firewall general

- Durante la prueba se desactivo temporalmente:

```powershell
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False
```

- Al cierre se volvio a activar:

```powershell
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True
```

- Se verifico:

```powershell
Get-NetFirewallProfile | Select-Object Name,Enabled
```

- Resultado final:
  - `Domain True`
  - `Private True`
  - `Public True`

## Estado final de seguridad

- Firewall general: activado.
- Regla `Node Torneos 3000`: eliminada.
- Servidor Node: detenido con `Ctrl + C`.
- Estado final considerado seguro y limpio.

## Para volver a probar en red local

1. Levantar la app:

```powershell
cd C:\torneos_v2
node index.js
```

2. Si otro dispositivo no accede, volver a crear la regla:

```powershell
New-NetFirewallRule -DisplayName "Node Torneos 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

3. Abrir desde otro dispositivo en la misma red:

```text
http://192.168.100.16:3000/login
```

4. Al terminar, se puede eliminar la regla:

```powershell
Remove-NetFirewallRule -DisplayName "Node Torneos 3000"
```

## Nota sobre acceso fuera de la red

- No se habilito acceso desde fuera de la red.
- Se converso que para eso existen opciones como:
  - ngrok;
  - Cloudflare Tunnel;
  - VPS/servidor con HTTPS;
  - port forwarding del router.
- Decision actual: no avanzar con esas opciones todavia.

## Nota sobre apariencia tipo app

- Se converso que para verse mas como app en celular se podria convertir en PWA:
  - `manifest.json`;
  - iconos;
  - `service worker`;
  - modo `display: standalone`;
  - meta tags mobile.
- No se implemento todavia.
