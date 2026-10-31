# GAS Web App — Buscador de PDFs

Endpoint Google Apps Script que busca facturas en Gmail, valida contra los datos
informados por ARCA, y archiva el PDF en Drive.

Vive **fuera** de la app Next.js — corre en tu cuenta Google porque necesita
acceso a TU Gmail / TU Drive.

## Versión actual: **v0.19.0** (verificable con un GET a la URL `/exec` → `{version}`)

> **0.19.0 (2026-10-20/21, A-FEAT-1287 y A-FEAT-1313)** — ⚠️ **dos archivos NUEVOS, `Inventario.gs` y `Pedido.gs`, y `appsscript.json`
> cambió (permiso nuevo `gmail.compose`, para los borradores): al desplegar, Google pide aceptarlo.** `Pedido.gs` = acción
> `pedir_factura` (mail al proveedor, borrador o envío; la firma viene escrita en el texto que arma la app).
> Los reenvíos ya no se leen factura por factura: la app los recorre una vez por tramos de días y guarda lo leído
> (`arca_pdf_inventario`, script 90). Acciones nuevas: `inventario_listar`, `inventario_leer`, `evaluar` (la regla de
> 5 datos sobre textos ya leídos) y `guardar_adjunto`. Del 22/10: `auditar` con `solo_file_ids` / `devolver_texto` (registro del
> archivo digital) y la búsqueda por factura con `respuesta_desde` (la respuesta del proveedor a un pedido). Además: tope de 40 s en la búsqueda por factura («búsqueda
> incompleta»), a Gmail se le piden sólo mails con PDF o imagen, y un PDF legible de otro comprobante ya no se
> informa como «ilegible».

> **0.18.0 (2026-10-20, A-FEAT-1287)** — un archivo es de la factura si coinciden **CUIT + número + monto + tipo + fecha**
> (`evaluarCoincidencia`, la misma para carpeta y mail); si fallan tipo o fecha queda a revisar con el motivo. Con más de un
> candidato no se elige ninguno: se devuelven todos (`candidatos` en la respuesta del mail; `matched[].tambien` y `dudosos` en
> `auditar`). Se prueba sin Google con `npm run probar:coincidencia`. El historial completo de versiones está en el `VERSION`
> de `Main.gs`.

> **OCR (v0.9.10)**: extracción **100% por la API REST de Drive** (`UrlFetchApp` + token). NO requiere
> habilitar el servicio avanzado "Drive API" (daba `ReferenceError: Drive is not defined`). Scopes:
> `drive` + `script.external_request` (+ `userinfo.email`).
>
> **Anti falsos-positivos (v0.9.14)**: la auditoría (`facturaCoincide`) exige **CUIT + número + MONTO**
> (valor absoluto, tolerancia $1). Antes validaba solo CUIT+número y se cruzaban comprobantes que
> comparten CUIT (ej. NC vs FC del mismo proveedor). El endpoint manda `imp_total` en el payload.
>
> **Acciones nuevas**: `listar` (v0.9.13 — enumera la carpeta SIN OCR, para "Conciliar saldos") ·
> `renombrar` (v0.9.12 — cambia el nombre de un archivo por id, sin mover).

Capacidades acumuladas (más allá del "buscar y archivar" original):
- **Catch-all de reenvíos** (`recolectores`: Jose/Andrés reenvían FC con su asunto).
- **OCR de imágenes** (fotos de WhatsApp) + **soft-match** por asunto.
- **Adjunto del mail OFICIAL del proveedor que no valida → `_Revisar`** (v0.9.8) en vez de perderse.
- **Mail resumen** del lote (acción `resumen`) — requiere `RESUMEN_DESTINATARIO` (ver paso 4).
- **Auditar período** (acción `auditar`, resumible por tandas) + **Confirmar VER** (acción `confirmar`)
  que mueve el PDF de `_Revisar` + **etiqueta `Facturas Descargadas` y marca leído el mail** (v0.9.7).

⚠️ **Regla dura**: el GAS **NUNCA** borra/mueve/reemplaza CARPETAS (solo find-or-create + mover/borrar
archivos puntuales por id). Único delete: el Google Doc temporal de extracción de texto.

## 🗂️ Carpetas del archivo digital (`Carpetas.gs`, v0.20.0, A-FEAT-1442, 2026-10-31)

Archivo NUEVO: acciones `resolver_carpeta` ({ ruta } como la escribe el usuario en su PC, o un link de Drive → id de la
carpeta; si una carpeta del camino no existe, dice cuál y NO crea nada) e `info_carpeta` ({ id } → dónde está hoy).
`boletas_arba` recibe por fin `carpeta_id` (A-BUG-1446: se perdía en `doPost`) y `anio` (adentro, la del año).
`leer_archivo` ({ file_id }): el texto de un documento archivado (el mismo OCR del buscador), para proponer el monto de la cuota.
`archivar_mail` ({ message_id, carpeta_id, anio }): los PDF/imágenes del mail a la carpeta → la del año, como «AAAA-MM-DD - nombre»; si ya existe, «ya estaba» (nunca pisa ni duplica). La carpeta del año se reconoce aunque se llame «Año 2026». La ruta se busca también entre las carpetas compartidas con la cuenta.
**Se despliega con «Nueva versión»** (lo llama la app como web app).

## 📬 Registro de mails (`RegistroMails.gs`, A-FEAT-1425, 2026-10-30)

Archivo NUEVO, independiente del buscador: registra cada mail de la casilla en `public.mails_registro`, lo clasifica con
`public.mails_reglas` (script 140) y manda un reporte diario **a la propia casilla**. **Sólo lee** la casilla.

Instalación (una vez, en el proyecto de Apps Script de esta casilla):
1. Pegar `RegistroMails.gs` como archivo nuevo del proyecto (o `clasp push`), **y reemplazar `appsscript.json`**: el registro crea disparadores y necesita el permiso `script.scriptapp` (⚠️ agregado 31/10 — sin él, `instalarTriggersRegistro` falla por permiso).
2. ⚙ Propiedades del script → agregar `SUPABASE_KEY` = la **service_role** (la misma del GAS de detalles de pago).
3. Correr `iniciarRegistroDesdeAgosto` (o `iniciarRegistro('AAAA-MM-DD')` con otra fecha): fija desde qué día se registra.
4. Correr `instalarTriggersRegistro` → crea «registrar cada 15 min» y «reporte a las 7». Google pide permisos (leer Gmail,
   enviar mail, conectarse a la base).
5. Probar a mano: correr `registrarMailsNuevos` (mirar el registro de ejecución) y después `enviarReporteDiario`.

La lógica que decide se prueba sin Google: `npm run probar:registro-mails`.

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

## 🔁 El ciclo de desarrollo — sin abrir el editor cada vez *(2026-09-30)*

Pregunta del usuario: *«¿hay una manera de hacerlo sin ir a Apps Script cada vez para probar
código?»*. Sí, y son **dos cosas distintas** que conviene no confundir:

| | Qué resuelve |
|---|---|
| **`clasp push`** | subir el código sin abrir el editor |
| **La URL `/dev`** | que el cambio se vea **sin crear una versión nueva del deployment** |

🔑 **La segunda es la que duele y casi nadie la conoce.** `clasp push` sube el código, pero la Web
App sigue sirviendo **la versión publicada**: si no creás una versión nueva, probás lo viejo y
parece que el cambio no funcionó.

Apps Script expone **dos URLs** del mismo proyecto:

```
https://script.google.com/macros/s/AKfy.../exec   ← la versión PUBLICADA (producción)
https://script.google.com/macros/s/AKfy.../dev    ← el ÚLTIMO código guardado (desarrollo)
```

**La `/dev` corre siempre lo último que subiste**, sin deployment nuevo. Se encuentra en el editor:
**Deploy → Test deployments**.

⚠️ **La `/dev` exige estar logueado** con una cuenta que tenga acceso al script. Por eso sirve para
probar desde tu máquina y **no** sirve para Vercel.

### Entonces, la configuración recomendada

| Dónde | Qué URL va en `GAS_BUSCAR_PDF_URL` |
|---|---|
| **`.env.local`** (tu máquina) | la **`/dev`** — ves el cambio apenas hacés `clasp push` |
| **Vercel** (Production + Preview) | la **`/exec`** — la versión publicada, estable |

No hace falta ningún cambio en el código: es la misma variable con distinto valor en cada lado.

```bash
npm install -g @google/clasp
clasp login
# en gas-buscar-pdf/, copiar .clasp.json.example a .clasp.json y poner el scriptId
# (Apps Script → ⚙️ Project Settings → Script ID)
clasp push          # sube
clasp push --watch  # o sube solo, cada vez que guardás
```

📌 Y para **publicar** lo probado: `clasp deploy` o, en el editor, *Deploy → Manage deployments →*
*editar → New version*. Recién ahí lo ve la `/exec` y, con ella, Vercel.

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

## 🤖 Que lo suba y lo publique Claude *(propuesto 2026-10-23 — SIN ARMAR, espera la decisión del usuario → [A-OP-26](../PENDIENTES.md#a-op-26))*

Pregunta del usuario (23/10, después de subir a mano la 0.19.1): *«¿tú podrías actualizar el GAS si tuviéramos un MCP?
¿cómo te puedo dar el acceso así como codificás Supabase?»*. **No hace falta un MCP**: es el mismo `clasp` de arriba,
corrido por Claude desde la terminal en vez de por el usuario. Lo que cambia es **quién aprieta**, y por eso lleva
resguardos que la guía de arriba no necesitaba.

**Una sola vez, el usuario:**
1. Activa la API de Apps Script en https://script.google.com/home/usersettings (*Google Apps Script API → Activado*). Sin
   esto `clasp push` falla con *«User has not enabled the Apps Script API»*.
2. Inicia sesión: en el chat de Claude Code escribe `! npx @google/clasp login` y acepta en el navegador con la **cuenta
   dueña del programa** (la de MSA, donde corre el buscador). El token queda en `~/.clasprc.json`, **fuera del repo**.
3. Le pasa a Claude el **Script ID** (*⚙️ Configuración del proyecto*) y el **ID de la implementación** de la `/exec`
   (*Implementar → Gestionar implementaciones*). Con el Script ID se arma `gas-buscar-pdf/.clasp.json` desde el
   `.example` (está en `.gitignore`: no se commitea).

**Cada vez, Claude — y en este orden:**
1. **Bajar antes de subir.** `clasp pull` a una carpeta APARTE (nunca sobre `gas-buscar-pdf/`) y comparar con el repo.
   🛑 **`clasp push` reemplaza TODOS los archivos del proyecto por los de la carpeta: un archivo que esté en Google y no en
   el repo SE BORRA.** Si aparece alguno así (editado a mano en el editor, de otro proyecto), se para y se le pregunta al
   usuario — es la regla de GAS/Drive *nunca destruir* (CLAUDE.md § 🛑).
2. **Pedir permiso** diciendo qué versión sube y qué cambia, como con la base. El permiso de una subida no vale para la
   siguiente.
3. `clasp push` y probar contra la **`/dev`** (ver arriba: corre lo último subido sin publicar).
4. **Publicar en la MISMA implementación**, para que la dirección `/exec` no cambie y Vercel no se entere:
   `clasp deploy -i <ID de la implementación> -d "0.19.x — qué cambió"`. 🛑 **Nunca `clasp deploy` sin `-i`**: crea una
   implementación nueva con OTRA dirección, y la app sigue llamando a la vieja.
5. **Verificar**: abrir la `/exec` (GET) y ver que `version` diga la nueva. Recién ahí se dice «subido».
6. Si cambió `appsscript.json` (permisos nuevos), **eso lo hace el usuario**: abrir la `/exec` o correr una función y
   aceptar. Claude no puede aceptar permisos de Google por él.

**Qué NO se automatiza**: los Script Properties (`GAS_AUTH_TOKEN`, `RESUMEN_DESTINATARIO`) y las variables de Vercel.
Son secretos y se quedan donde están.

⚠️ **Si el cambio agregó scopes** (`appsscript.json` cambió — ej. `userinfo.email` en v0.9.6):
la próxima ejecución pide **re-autorizar**. Corré una función desde el editor (o abrí el `/exec`)
y aceptá los permisos nuevos. Si no, las funciones que usan ese scope fallan
(`You do not have permission to call Session.getEffectiveUser`).

> **Sin clasp**: si no usás `clasp push`, el flujo manual equivalente es: en el editor GAS,
> **pegar `Main.gs`** (y `appsscript.json` si cambió) → guardar → Deploy versión nueva. Desde 0.19.0 también
> **`Inventario.gs`** y **`Pedido.gs`** (en el editor: ➕ Archivo → Script → nombre `Inventario` / `Pedido`, pegar, guardar), y
> el `appsscript.json` (⚙️ Configuración del proyecto → «Mostrar el archivo de manifiesto»).

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
