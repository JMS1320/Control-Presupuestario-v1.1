# Plan de Test del POC ARCA — Mis Comprobantes

Documento operativo para **iterar el POC** hasta que funcione. Cada vez
que algo falle, los archivos `debug-*.html` muestran qué devolvió ARCA y
ajustamos los selectores.

## Pasos

### Paso 1 — Setup local (una sola vez)

```bash
cd arca-poc
npm install
cp .env.example .env
```

Editar `.env`:
```
ARCA_CUIT_PERSONAL=20XXXXXXXXX           # tu CUIT real
ARCA_PASSWORD_PERSONAL=tu_clave_fiscal
ARCA_CUIT_EMPRESA_MSA=30617786016
ARCA_FECHA_DESDE=2026-05-01
ARCA_FECHA_HASTA=2026-05-31
ARCA_EMPRESA=MSA
ARCA_TIPO=recibidos
```

⚠️ El `.env` está en `.gitignore`. No se va a commitear.

### Paso 2 — Test de login

```bash
npm run login
```

**Si va bien**: termina con `✅ POC LOGIN OK`.

**Si falla**:
1. Pegame el output completo de la consola.
2. Adjuntá el archivo `debug-home.html` que se haya generado.
3. NO reintentes inmediatamente si tu cuenta tiene bloqueo por intentos.

### Paso 3 — Test de descarga completa

```bash
npm run fetch
```

**Si va bien**: termina con `✅ POC FETCH terminado` y deja `comprobantes.json` con los datos.

**Si falla**: hay 4 archivos de debug que se pueden generar:
- `debug-home.html` — post login
- `debug-mis-comprobantes.html` — pantalla del filtro
- `debug-listado.html` — resultado de la consulta

Pasamelos y vemos cómo ajustar.

## Errores posibles y qué hacer

| Error | Causa probable | Acción |
|---|---|---|
| `No se encontró javax.faces.ViewState` | El portal ya no usa JSF (cambió de framework) | Inspeccionar `debug-home.html`, ver qué framework usa, ajustar `login.ts` |
| `CUIT no válido` | CUIT mal escrito en `.env` | Verificar `.env`, sin guiones |
| `Clave fiscal incorrecta` | Clave mal | Verificar, **NO reintentar muchas veces** (riesgo bloqueo) |
| `Cuenta bloqueada` | Demasiados intentos fallidos | Esperar al menos 30 minutos |
| `ARCA pidió captcha` | Tu cuenta tiene 2FA o ARCA bloqueó IP | El scraping con requests no sirve. Pivote: Selenium o WS oficial (no existe para Mis Comprobantes Recibidos en bulk) |
| Status 403 / 401 | Acceso denegado al servicio | Verificar que tu CUIT tenga el servicio "Mis Comprobantes" habilitado |
| `0 comprobantes detectados` con rango válido | Selectores HTML no coinciden | Inspeccionar `debug-listado.html`, ajustar el parser `parsearListadoComprobantes` |

## Lo que sigue cuando el POC funcione

1. Ajustar selectores con HTML real → POC corre limpio.
2. Agregar parser de importes (`imp_neto_gravado`, `iva`, `imp_total`).
3. Mapear a formato de `comprobantes_arca` (igual que el importer manual existente).
4. Mover de `arca-poc/` a `app/api/arca/import-mis-comprobantes/route.ts` en la app principal.
5. Tabla `arca_descargas_log` con histórico.
6. Botón "Importar de ARCA" en la vista Facturas (selector empresa + rango fechas + atajos "mes anterior" / "últimos 30 días").
7. Documentar credenciales en Vercel (env vars de producción).

## Decisiones ya tomadas (no re-discutir)

- **Lenguaje**: Node.js + TypeScript.
- **Runtime**: API Route de Next.js. Si excede 30s en Vercel → cortamos con error y manual fallback.
- **Almacenamiento credenciales**: env vars del servidor. Sin tabla BD. Sin vault externo.
- **Empresas**: tu CUIT personal puede consultar MSA + PAM (relaciones AFIP). MA usa otro CUIT y otra clave.
- **PAM no factura hoy**: ignorar por ahora.
- **2FA**: no hay en tu cuenta. Si AFIP lo activa a futuro, el POC muere y hay que pivotar.
- **Importación directa vs Excel**: parseamos respuesta HTML/JSON directo, sin descargar Excel intermedio. Más rápido, menos puntos de falla.
- **Anti-duplicado**: usa la lógica del importer actual (`tipo + pto vta + nº + cuit`).
- **Manual fallback**: el import por Excel manual siempre queda disponible. Nunca dependemos 100% del scraping.

## Lo que NO existe en AFIP/ARCA hoy (jun 2026)

- ❌ **No hay WS oficial SOAP para descargar Mis Comprobantes Recibidos en bulk**. Hay WS para emisión propia (WSFEv1) y para constatar uno por uno (WSCDC) pero ninguno te da el listado de lo que tus proveedores te emitieron.
- ✅ El scraping del portal web es la única vía hoy.

Si ARCA lanza una API oficial en el futuro, migrar es trivial: solo cambia `fetch-comprobantes.ts`.
