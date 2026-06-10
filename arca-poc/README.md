# POC ARCA — Mis Comprobantes Recibidos

POC standalone para validar que es viable scrapear el portal de ARCA
(ex-AFIP) usando solo CUIT + clave fiscal (sin Selenium, sin browser visual).

**Es un módulo APARTE de la app**. No toca el código de Next.js. Cuando
funcione, lo integramos como API Route.

## Setup

```bash
cd arca-poc
npm install
cp .env.example .env
# Editar .env con tus credenciales reales
```

## Comandos

```bash
# 1. Verificar que el login funciona (más simple)
npm run login

# 2. Login + navegación + descarga + parseo (POC completo)
npm run fetch
```

## Cómo funciona

El portal de ARCA usa **JSF (JavaServer Faces)** que requiere:
- Cookies de sesión (JSESSIONID + otras)
- Token `javax.faces.ViewState` que cambia en cada respuesta
- 2 forms encadenados: primero CUIT, después clave fiscal

El script simula exactamente eso con:
- `axios` + `tough-cookie` → maneja cookies como un browser
- `cheerio` → parsea HTML para extraer ViewState

## Archivos de debug

Cuando algo no anda, el script guarda los HTML/JSON intermedios:
- `debug-home.html` — primer GET después de login
- `debug-mis-comprobantes.html` — formulario de filtros
- `debug-listado.html` — respuesta con los comprobantes
- `comprobantes.json` — parseados como array

Inspeccionando esos archivos podemos ajustar selectores en el parser.

## Errores esperables

- **"No se encontró javax.faces.ViewState"** → el portal cambió de framework, hay que rever.
- **"ARCA pidió captcha"** → tu cuenta tiene 2FA o ARCA bloqueó por IP sospechosa. El scraping requests no funciona en ese caso.
- **"CUIT no válido"** → revisar `.env`.
- **"Clave fiscal incorrecta"** → ojo con el bloqueo por intentos.

## Cuando funcione

Pasos siguientes (en otra sesión):
1. Encapsular el script en un módulo importable.
2. Crear `app/api/arca/import-mis-comprobantes/route.ts` en la app principal
   que reciba `{ empresa, fechaDesde, fechaHasta }` y use el módulo.
3. Insertar en `comprobantes_arca` con el mismo importer existente (anti-dups OK).
4. Tabla `arca_descargas_log` con histórico de cada descarga.
5. Botón "Importar de ARCA" en la vista Facturas.
