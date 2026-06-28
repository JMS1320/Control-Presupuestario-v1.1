# GAS Web App — Buscador de PDFs

Endpoint Google Apps Script que busca facturas en Gmail, valida contra los datos
informados por ARCA, y archiva el PDF en Drive.

Vive **fuera** de la app Next.js — corre en tu cuenta Google porque necesita
acceso a TU Gmail / TU Drive.

## Versión actual: **v0.9.10** (verificable con un GET a la URL `/exec` → `{version}`)

> **v0.9.10 — FIX OCR definitivo**: la extracción de texto se hace **100% por la API REST de Drive**
> (`UrlFetchApp` + token del script). **Ya NO requiere** habilitar el servicio avanzado "Drive API"
> (que daba `ReferenceError: Drive is not defined` = causa real del `OCR: 0 chars`). No usa scopes
> nuevos (alcanza con `drive` + `script.external_request`), así que **no hay que re-autorizar**.

Capacidades acumuladas (más allá del "buscar y archivar" original):
- **Catch-all de reenvíos** (`recolectores`: Jose/Andrés reenvían FC con su asunto).
- **OCR de imágenes** (fotos de WhatsApp) + **soft-match** por asunto.
- **Adjunto del mail OFICIAL del proveedor que no valida → `_Revisar`** (v0.9.8) en vez de perderse.
- **Mail resumen** del lote (acción `resumen`) — requiere `RESUMEN_DESTINATARIO` (ver paso 4).
- **Auditar período** (acción `auditar`, resumible por tandas) + **Confirmar VER** (acción `confirmar`)
  que mueve el PDF de `_Revisar` + **etiqueta `Facturas Descargadas` y marca leído el mail** (v0.9.7).

⚠️ **Regla dura**: el GAS **NUNCA** borra/mueve/reemplaza CARPETAS (solo find-or-create + mover/borrar
archivos puntuales por id). Único delete: el Google Doc temporal de extracción de texto.

## Arquitectura

```
Backend Next.js  ──POST {factura_id, cuit, nro, monto, email, ...}──►  GAS Web App
                                                                             │
                                                                             ├─ busca en Gmail
                                                                             ├─ valida CUIT+nro+monto
                                                                             ├─ archiva en Drive
                                                                             ▼
                       ◄────────── JSON {status, drive_url, observaciones, ...} ──────────
```

## Deploy paso a paso (primera vez)

### 1. Instalar clasp (CLI oficial Google)

```bash
npm install -g @google/clasp
clasp login   # abre browser para autenticar con TU cuenta Google
```

### 2. Crear el proyecto GAS

Desde esta carpeta (`gas-buscar-pdf/`):

```bash
clasp create --type webapp --title "Buscador PDFs Facturas"
```

Esto crea un proyecto GAS asociado a tu cuenta + un archivo `.clasp.json` local
(NO commitear, ya está en `.gitignore`).

### 3. Subir el código

```bash
clasp push
```

### 4. Configurar el token de seguridad

Andá al editor GAS:

```bash
clasp open
```

Project Settings (engranaje) → Script Properties → **Add script property** (dos):
- Key: `GAS_AUTH_TOKEN`
  Value: el mismo token que vas a poner en el backend (un string aleatorio largo,
  ej. `openssl rand -hex 32`)
- Key: `RESUMEN_DESTINATARIO` **(obligatorio desde v0.9.6)**
  Value: el email donde querés recibir el **mail resumen** del lote (ej. `sanmanuel.sp@gmail.com`).
  Sin esto el resumen falla con `Failed to send email: no recipient` (porque con
  Access:Anyone `getActiveUser()` devuelve vacío). Es a prueba de scopes — el GAS lo
  usa antes de intentar `getEffectiveUser`.

### 5. ~~Habilitar Drive Advanced Service~~ — YA NO HACE FALTA (desde v0.9.10)

La extracción de texto/OCR ahora va por la **API REST de Drive** (`UrlFetchApp`), así que **no**
necesitás agregar el servicio avanzado "Drive API" en Services. (Si lo tenías agregado, no molesta.)

### 6. Deploy como Web App

En el editor GAS → **Deploy → New deployment**:
- Type: **Web App**
- Description: "v1"
- Execute as: **Me** (tu cuenta — necesario para acceso Gmail/Drive)
- Who has access: **Anyone** (Anyone with the link)
- → Deploy

Copiá la URL del Web App (algo como `https://script.google.com/macros/s/.../exec`).

### 7. Configurar el backend con esa URL + token

En Vercel (Project Settings → Environment Variables, Production + Preview):
- `GAS_BUSCAR_PDF_URL` = la URL del Web App
- `GAS_AUTH_TOKEN` = mismo token que pusiste en GAS Script Properties

### 8. Probar

Desde el editor GAS, abrí `Main.gs` → seleccioná función `testManual` → Run.
La primera ejecución va a pedirte autorización para Gmail/Drive (autorizá).
Mirá `Logger.log` para ver qué pasó.

## Actualización (siguientes versiones)

Cuando yo (Claude) actualice el código, vos hacés:

```bash
clasp push
```

Y desde el editor GAS:

**Deploy → Manage deployments → tu deployment → Edit (lápiz) → Version: New version → Deploy.**

⚠️ Importante: la URL del Web App **no cambia** entre versiones si actualizás
el deployment existente. Si creás un deployment nuevo desde cero, la URL cambia
y tenés que actualizar el env var.

⚠️ **Si el cambio agregó scopes** (`appsscript.json` cambió — ej. `userinfo.email` en v0.9.6):
la próxima ejecución pide **re-autorizar**. Corré una función desde el editor (o abrí el `/exec`)
y aceptá los permisos nuevos. Si no, las funciones que usan ese scope fallan
(`You do not have permission to call Session.getEffectiveUser`).

> **Sin clasp**: si no usás `clasp push`, el flujo manual equivalente es: en el editor GAS,
> **pegar `Main.gs`** (y `appsscript.json` si cambió) → guardar → Deploy versión nueva.

## Variables de entorno necesarias en Vercel

| Env var | Dónde se setea | Para qué |
|---|---|---|
| `GAS_BUSCAR_PDF_URL` | Vercel Production + Preview | Backend conoce la URL del GAS Web App |
| `GAS_AUTH_TOKEN` | Vercel Production + Preview | Backend valida con este token al GAS |
| `GAS_FOLDER_ID_MSA` | Vercel Production + Preview | Carpeta Drive raíz facturas MSA |
| `GAS_FOLDER_ID_PAM` | Vercel Production + Preview | Carpeta Drive raíz facturas PAM |
| `GAS_FOLDER_ID_MA` | Vercel Production + Preview | Carpeta Drive raíz facturas MA |

## Estructura del JSON request → response

### Request (POST body)

```json
{
  "_token": "<el token>",
  "factura_id": "uuid",
  "cuit_emisor": "20103619115",
  "punto_venta": 10,
  "numero_desde": 6115,
  "tipo_comprobante_desc": "Factura A",
  "fecha_emision": "2026-05-16",
  "imp_total": 1068365.63,
  "denominacion_emisor": "ALCORTA EDMUNDO ERNESTO",
  "email_proveedor": "facturacion@proveedor.com",
  "patron_asunto": "Factura",
  "dias_busqueda": 7,
  "carpeta_drive_id": "1ABCDEF_id_de_la_carpeta"
}
```

### Response

```json
{
  "status": "ok | revisar | no_encontrada | error",
  "drive_url": "https://drive.google.com/file/d/.../view",
  "confianza": "alta | media | baja",
  "observaciones": "Match exacto CUIT+nro+monto",
  "monto_pdf": 1068365.63,
  "asunto": "Factura ...", "remitente": "...", "cuerpo": "...",
  "gmail_message_id": "18f...",   // en 'revisar' → permite etiquetar el mail al Confirmar (v0.9.7)
  "tiempo_ms": 4823
}
```

Otras acciones (mismo endpoint, según `accion` en el body): `resumen` (mail del lote),
`auditar` (releva carpeta de un período), `confirmar` (mueve de `_Revisar` + etiqueta el mail;
devuelve `mail_etiquetado`). El backend (`/api/gas/*`) las orquesta; no se llaman a mano.

## Notas operacionales

- **Quota GAS**: 6 min por exec / 90 min total por día. Cada búsqueda toma ~5-10s,
  así que da para ~500-1000 búsquedas/día. Sobra para uso normal.
- **PDFs imagen** (escaneados): el método `extraerTextoPdf` usa Drive Doc para
  extracción. Si el PDF no tiene capa de texto, devolverá pocas líneas y la
  validación CUIT+nro fallará → resultado `no_encontrada`. Casos esperables:
  facturas escaneadas a mano.
- **Carpeta `_Revisar`**: cuando el match es dudoso, GAS crea subcarpeta `_Revisar`
  dentro de la carpeta del período y deja ahí el archivo (sin renombrar, sin link en la
  factura) hasta que confirmes. Casos que van a `_Revisar` (status `revisar`): monto fuera
  de tolerancia · múltiples PDFs candidatos · **soft-match** (asunto nombra al proveedor pero
  el adjunto no validó) · **adjunto del mail oficial del proveedor que no validó** (v0.9.8).
  Desde la grilla, el botón **✓ Confirmar** lo mueve a la carpeta del mes + renombra + link +
  etiqueta/marca leído el mail.
- **Nombre del archivo**: `YY-MM-DD - Proveedor - Tipo PV-NRO_CUIT.pdf`
  Ejemplo: `26-06-15 - ALCORTA EDMUNDO ERNESTO - FA 00010-00006115_20103619115.pdf`

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Token inválido` | GAS_AUTH_TOKEN mismatch | Verificar que sea el mismo en GAS y Vercel |
| `Drive.Files.create not a function` | API Drive no habilitada | Editor GAS → Services → Add Drive |
| `Cannot read property 'getFolderById'` | carpeta_drive_id mal o sin permiso | Verificar ID y que tu cuenta tenga acceso |
| Devuelve `no_encontrada` siempre | Patrón asunto muy restrictivo | Probar con patron_asunto vacío y ver |
| Timeout / aborta a los 6 min | Búsqueda muy amplia | Achicar dias_busqueda, agregar patron asunto |
| `Failed to send email: no recipient` | Falta `RESUMEN_DESTINATARIO` (Access:Anyone → getActiveUser="") | Cargar la Script Property `RESUMEN_DESTINATARIO` (paso 4) |
| `You do not have permission to call Session.getEffectiveUser` | Scope `userinfo.email` no autorizado | Re-autorizar tras agregar scopes, o cargar `RESUMEN_DESTINATARIO` (lo evita) |
| Confirmar VER no etiqueta el mail | Búsqueda hecha con GAS < v0.9.7 (sin `gmail_message_id` en el log) | Re-buscar con v0.9.7+ y luego confirmar |
| El `/exec` muestra una versión vieja | Se guardó el código pero no se deployó versión nueva | Deploy → Manage deployments → New version |
