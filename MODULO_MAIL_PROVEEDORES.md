# DISEÑO: Sistema Mail + BBDD Proveedores

> **Estado**: DISEÑO COMPLETO — Pendiente implementación
> **Fecha inicio diseño**: 2026-02-26
> **Prioridad**: Media — funcionalidad de valor pero no bloqueante
> **Prerequisito técnico**: Verificar 2FA activo en sanmanuel.sp@gmail.com

---

## 1. BBDD Proveedores

### Principio fundamental
> "Mantener la versatilidad del sistema sin tornarlo burocrático — ningún campo debe ser obligatorio excepto el mínimo para operar"

### Tabla propuesta: `proveedores`

```sql
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,        -- Único campo verdaderamente requerido
  cuit VARCHAR(20),                    -- Opcional (pero permite auto-vinculación)
  email VARCHAR(200),                  -- Requerido solo si se quiere usar mail
  telefono VARCHAR(50),                -- Opcional
  notas TEXT,                          -- Opcional — info libre
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vinculación automática (sin burocracia)
- Si el proveedor tiene `cuit` → se vincula automáticamente con facturas ARCA y templates que tengan ese CUIT
- Si no tiene CUIT → existe igual, solo sin vinculación automática
- La BBDD de proveedores es **complementaria**, no reemplaza el flujo actual

### Alta no burocrática
- Alta rápida desde el momento del envío de mail (sin salir de la pantalla)
- Solo pide `nombre` + `email` para enviar (CUIT y resto opcionales)
- Si proveedor no tiene email cargado → alerta + opción de ingresar en el momento sin perder el avance
- Vista de administración separada para gestión completa

---

## 2. Sistema Mail

### Principio de uso
> El admin asienta el pago como `pagado` o `programado` CUANDO ya lo ejecutó, nunca antes.
> En ese momento —y solo en ese momento— tiene sentido avisar al proveedor.
> El sistema nunca envía nada automáticamente: siempre requiere acción consciente del admin.

### Trigger
- **Evento**: cambio de estado a `pagado` o `programado` — **independiente de SICORE**
- **Quién**: solo el admin (es quien asienta pagos reales)
- **Activación**: checkbox opcional a la izquierda del selector de estado, **default: OFF**

### Relación con SICORE
- Si la factura pasa por el modal SICORE: primero se confirma la retención, después aparece la opción de mail
- Si no aplica SICORE: la opción de mail aparece igual al cambiar el estado
- Son flujos independientes — el mail no depende de SICORE

### Flujo desde ARCA Facturas (inline)

```
1. Admin cambia estado → pagado/programado (inline o modal)
2. A la izquierda del selector de estado: checkbox "Avisar al proveedor" (default: desmarcado)
   └── Si desmarcado → estado se guarda, sin mail
   └── Si marcado:
       a. Sistema busca proveedor por CUIT en tabla proveedores
       b. Si no encuentra proveedor o no tiene email:
          → Alerta: "Proveedor sin email cargado"
          → Opción: ingresar nombre + email en el momento (sin perder lo anterior)
          → Opción: continuar sin enviar
       c. Genera borrador editable con template base
       d. Admin revisa/modifica cualquier parte del texto (incluido asunto)
       e. Confirma → mail sale
```

### Flujo desde Cash Flow

```
1. Admin cambia estado → pagado/programado en Cash Flow
2. Sistema pregunta: "¿Querés enviar aviso al proveedor?"
   └── No → flujo normal
   └── Sí → mismo flujo desde paso (a) anterior
```

### Template base (borrador editable)

```
Asunto: Pago [Proveedor] - [DD/MM/AAAA]

Estimado/a [Nombre Proveedor]:

Le informamos que el pago correspondiente a [descripción/detalle factura]
fue [programado para el DD/MM/AAAA] / [acreditado el DD/MM/AAAA].

  Importe transferido:          $ XXX.XXX,XX
  Retención Ganancias (SICORE): $ XX.XXX,XX  ← solo si aplica
  Importe neto acreditado:      $ XXX.XXX,XX

[Campo libre — mensaje personalizado opcional]
Ej: "El descuento convenido de $X.XXX corresponde a..."

Saludos,
[Firma configurable]
```

**Reglas del template:**
- Si no hay SICORE (`monto_sicore = 0` o `null`) → se omite la línea de retención
- Si estado es `programado` → dice "fue programado para el DD/MM"
- Si estado es `pagado` → dice "fue acreditado el DD/MM"
- Todo el texto es editable antes de enviar (incluido asunto)
- El campo libre es opcional (si está vacío se omite)

### Caso de uso alternativo: generador de texto para portal bancario
> El sistema puede usarse como **generador de borrador** sin enviar mail directamente.
> Cuando la transferencia bancaria genera un mail automático del banco, el admin
> puede copiar el texto pre-generado por el sistema y pegarlo en el campo de referencia
> o descripción de la transferencia.
>
> Esto hace que la funcionalidad tenga valor incluso sin configurar SMTP.

### Casos de uso especiales (mensaje personalizado)
- Descuento por factor convenido
- Pago parcial con acuerdo
- Nota de pedido de factura/recibo
- Cualquier aviso adicional al proveedor

### Reply-to
- Los proveedores pueden responder al mail
- `reply-to: sanmanuel.sp@gmail.com` (misma cuenta emisora, configurable)

---

## 3. Implementación técnica

### Cuenta emisora
- **Cuenta principal**: `sanmanuel.sp@gmail.com`
- **Arquitectura multi-cuenta**: Variables de entorno por empresa desde el inicio
  ```
  GMAIL_USER_DEFAULT=sanmanuel.sp@gmail.com
  GMAIL_APP_PASSWORD_DEFAULT=xxxx xxxx xxxx xxxx
  # Futuro:
  # GMAIL_USER_MSA=cuenta_msa@gmail.com
  # GMAIL_USER_PAM=cuenta_pam@gmail.com
  ```
- Agregar nueva cuenta en el futuro = agregar variable de entorno + una línea de config

### Opción recomendada: SMTP Gmail con App Password

**Ventajas:**
- Simple de configurar (no requiere Google Cloud Console)
- Sin dependencias externas pagas
- Mail queda en "Enviados" de Gmail automáticamente → historial gratuito sin BD extra

**Prerequisito — configuración una sola vez:**
1. Verificar 2FA activo en `sanmanuel.sp@gmail.com` → myaccount.google.com → Seguridad ← **PENDIENTE**
2. Si no está activo: habilitar 2FA primero
3. Generar "Contraseña de aplicación": myaccount.google.com → Seguridad → Contraseñas de aplicación
4. Guardar en variables de entorno Vercel

**Alternativa si Google complica:** Resend (resend.com) — API key simple, 100 mails/día gratis

### API Route Next.js
```typescript
// app/api/send-mail/route.ts
// Recibe: { to, subject, body, replyTo? }
// Usa nodemailer con SMTP Gmail
// Retorna: { success, messageId }
```

### Historial de mails enviados
- **Gmail como historial**: Todo mail enviado vía SMTP queda en "Enviados" de `sanmanuel.sp@gmail.com` automáticamente ✅
- No se necesita tabla BD para historial básico
- Tabla BD opcional en fase futura si se quiere consultar desde la aplicación

### Librerías
- `nodemailer` — envío SMTP (ya disponible en Node.js/Next.js)

---

## 4. Configuración del sistema

### Variables configurables (BD o localStorage)
- `mailFrom` — cuenta emisora (sanmanuel.sp@gmail.com)
- `mailFirma` — texto de firma (genérica para empezar, por empresa MSA/PAM en fase futura)
- `mailDefaultCC` — CC por defecto (ej: contador)
- `mailReplyTo` — dirección para respuestas del proveedor
- `mailHabilitado` — master switch on/off

### Firma
- **Versión inicial**: Firma genérica única
- **Versión futura**: Firma configurable por empresa (MSA/PAM) según responsable contable del pago

### Vista de configuración
- Tab en Configuración existente o modal dedicado
- Campos: cuenta Gmail, firma, CC por defecto, reply-to, test de envío

---

## 5. Decisiones tomadas

| Pregunta | Decisión |
|----------|----------|
| ¿Quién puede enviar mails? | Solo admin — quien asienta pagos reales |
| ¿Trigger? | Cambio estado → `pagado` o `programado` (independiente de SICORE) |
| ¿Dónde aparece el checkbox? | A la izquierda del selector de estado (ARCA Facturas). Pregunta en Cash Flow |
| ¿Firma por empresa? | Genérica para empezar. Por empresa (MSA/PAM) en fase futura |
| ¿Historial en BD? | No por ahora — Gmail guarda en "Enviados" automáticamente |
| ¿Reply-to? | Sí — proveedores pueden responder (misma cuenta o configurable) |
| ¿PDF SICORE adjunto o en cuerpo? | Flexible — a definir en implementación (el borrador es editable) |
| ¿Proveedor sin email? | Alerta + ingresar email en el momento sin perder avance |
| ¿2FA Gmail activo? | A verificar en `sanmanuel.sp@gmail.com` antes de implementar |
| ¿Multi-cuenta futura? | Arquitectura preparada: variables de entorno por empresa |

---

## 6. Fases de implementación sugeridas

| Fase | Descripción | Complejidad |
|------|-------------|-------------|
| **1** | Tabla `proveedores` + alta rápida desde modal | Baja |
| **2** | API route SMTP + configuración básica + test envío | Media |
| **3** | Checkbox en ARCA Facturas + pregunta en Cash Flow + borrador editable | Media |
| **4** | Auto-vinculación CUIT + reply-to configurable | Baja |
| **5** | Historial BD interno + PDF SICORE adjunto | Media |
| **6** | Firma por empresa (MSA/PAM) + multi-cuenta | Media |

**Recomendación**: Implementar Fase 1 + 2 + 3 juntas como MVP funcional.

**Prerequisito antes de implementar**: Verificar 2FA en `sanmanuel.sp@gmail.com` y generar App Password.

---

**📅 Última actualización:** 2026-02-26
**Estado**: Diseño completo. Solo prerequisito técnico pendiente de verificación por usuario.

## 7. 📨 QUÉ DETALLES DE PAGO FALTAN MANDAR *(medido 2026-09-13/16)*

*Pedido del usuario: **«quisiera ver cuáles tengo pendientes de mandar a Alcorta y otros — todos los
que tuvieron ret. gan. y/o descuento»**.*

### 7.1 · ⚠️ Lo primero: qué SABE y qué NO sabe la app

> **`enviado_at` en `NULL` no significa «no se mandó». Significa que la app no se enteró.**

*Aclaración del usuario, y corrige el diagnóstico entero:* **«los mails la app no sabe si los envié,
pero sí envié varios»**. El circuito deja el **borrador en Gmail** y ahí termina su conocimiento: el
envío lo hace una persona, fuera de la app.

Por eso el estado se lee en **tres escalones, y sólo los dos primeros son hechos**:

| | Qué significa | ¿Es un hecho? |
|---|---|---|
| **No hay fila en `mails_pago`** | nunca se generó el detalle: **no hay nada que mandar** | ✅ sí |
| **Hay fila con `gmail_draft_id`** | el borrador se creó en Gmail | ✅ sí |
| **¿Se envió?** | **no se sabe** | ❌ no |

🛑 **Cualquier panel que lea `enviado_at` va a mentir** hasta que se cierre el circuito
→ [A-FEAT-147](PENDIENTES.md#a-feat-147) y [A-FEAT-151](PENDIENTES.md#a-feat-151).

📌 **La regla provisoria del usuario** —*«si se pidió que se genere en Gmail, se debe suponer que se
mandó»*— hoy daría **los 22 borradores por enviados**. Sirve como aproximación, pero en pantalla va
**como supuesto, no como hecho**.

### 7.2 · El estado de la cola al 2026-09-16

**22 mails, todos en `borrador`, los 22 con `gmail_draft_id` y ninguno con error.**

⚠️ **Y hay duplicados**: 22 mails para **11 asuntos distintos** —
`Detalle de pago — MASSAGLIA ALDO ENRIQUE` aparece **4 veces**. Encolar dos veces no se bloquea.
🔑 **Ese es el motivo por el que buscar el envío POR ASUNTO no sirve**: el asunto no identifica al
mail. El `gmail_draft_id` sí, y ya está guardado en los 22.

### 7.3 · 🔴 Lo que falta: 38 pagos nunca llegaron a borrador

Cruzando los pagos que tuvieron **retención y/o descuento** (`msa.sicore_retenciones`) contra la cola:

| | Pagos | Proveedores | Pagado | Retención | Descuento |
|---|---|---|---|---|---|
| ✅ Con borrador | 11 | 7 | $43,40 M | $664.077,41 | $27.419,93 |
| 🔴 **Sin borrador** | **38** | **23** | **$69,56 M** | **$1.031.181,05** | **$556.558,97** |

🔑 **Son detalles que el proveedor nunca vio**, y son justamente los pagos donde más falta hacen: un
pago con retención o descuento **llega al proveedor por menos de lo facturado**, y sin el detalle no
tiene cómo saber por qué.

⚠️ **Y NO es deuda acumulada por olvido.** *(Aclaración del usuario, 2026-09-13.)* La feature **es
nueva**: se empezó a usar y **se frenó con Alcorta por errores de diseño del PDF**
([A-BUG-173](PENDIENTES.md#a-bug-173), corregido). La mayoría de esos 38 son **anteriores a que el
circuito existiera**.

### 7.4 · ALCORTA — el caso testigo, el que frenó todo

| Pago | FC | Total pagado | Retención | Descuento | Borrador |
|---|---|---|---|---|---|
| **10/09/2026** | 4 | $2.056.814,20 | $29.516,93 | $19.254,70 | 🔴 no — **desbloqueado el 13/09** |
| 10/08/2026 | 1 | $520.978,69 | $4.131,22 | $27.419,93 | ✅ sí |
| **10/06/2026** | 3 | $4.226.572,80 | $65.380,71 | $104.045,26 | 🔴 no |
| **11/05/2026** | 3 | $1.165.327,95 | $14.781,62 | $61.333,05 | 🔴 no |
| **10/04/2026** | 3 | $1.316.776,31 | $17.284,90 | $42.288,56 | 🔴 no |
| **10/03/2026** | 5 | $1.055.469,10 | $13.705,08 | $55.551,01 | 🔴 no |

**5 de 6 sin borrador — $9,82 M**, con **$140.668,54** de retención y **$282.472,58** de descuento
que el proveedor nunca vio detallados.

### 7.5 · Los otros 22 proveedores, por antigüedad

Los más pesados de cada tanda (la lista entera sale del cruce de § 7.3):

| Pago | Proveedor | Pagado | Retención | Descuento |
|---|---|---|---|---|
| 10/09/26 | MASSAGLIA ALDO ENRIQUE | $2.067.502,80 | $32.830,20 | — |
| **04/09/26** | **IGLESIAS NORBERTO HUGO** | $3.554.000,00 | $57.400,40 | — |
| 10/08/26 | BIOFARMA S A | $2.646.270,00 | $39.260,00 | — |
| 05/08/26 | HIDRAULICA CURRA | $615.890,00 | $8.836,60 | — |
| 03/07/26 | MORAGUES JORGE HUGO | $2.646.696,00 | $46.560,60 | — |
| 29/06/26 | FUNDACION VIDAS SADIV | $739.583,48 | $10.881,12 | — |
| 08/06/26 | **GARMENDIA SANTIAGO** | $6.334.539,97 | $100.223,14 | — |
| 08/06/26 | ARROYO TALA SH | $2.121.865,20 | $33.924,80 | — |
| 26/05/26 | ARROYO TALA SH | $2.113.423,00 | $33.772,00 | — |
| 30/04/26 | STRINGHINI DAMIAN | $3.028.252,50 | $53.466,60 | — |
| 20/04/26 | Biscayart | $3.042.557,10 | $45.810,20 | — |
| **07/04/26** | **RIGO MATIAS Y RAUL** | $2.315.963,60 | $36.936,99 | **$121.892,82** |
| **26/03/26** | **FERRETERIA SARMIENTO** | $862.430,20 | $9.812,63 | **$152.193,57** |
| **05/03/26** | **SJC ENERGY STORE** | $6.580.000,00 | $87.916,03 | — |
| 04/03/26 | TRANSPORTE FABIAN BLANCO | $1.053.426,00 | $2.008,58 | — |

*(Completan la lista: La Mercure ×3, Massaglia ×3 más, Stringhini ×2 más, García Eugenio, Almacén
Veterinario, Hernández Cristóbal, Agro Centros, Grupo Campo, Degraf, Rigo 05/03.)*

### 7.6 · ⚠️ Cómo se midió, y qué tiene de flojo

El cruce empareja **proveedor normalizado + una ventana de fechas de −2 a +4 días** alrededor del
pago, porque **`mails_pago` no guarda contra qué pago se generó**: `grupo_pago_id` y
`comprobante_arca_id` están en `∅` en las 22 filas.

🔑 **Ese es el hueco de fondo**, y vale más que la lista: **si el mail guardara su vínculo al pago,
esto sería una consulta exacta en vez de una aproximación por fecha**. Mientras tanto, la lista
puede tener falsos positivos si un detalle se generó mucho después del pago.
→ [A-FEAT-147](PENDIENTES.md#a-feat-147).

## 8. 📄 EL PAPEL DEL DETALLE DE PAGO — qué se dice, dónde y con qué letras

*Escrito 2026-09-22 después de leer el PDF real del pago de ALCORTA del 10/06 →
[A-BUG-190](PENDIENTES.md#a-bug-190). Los tres defectos estaban en **un solo renglón**.*

### 8.1 · Un aviso, una vez, y al pie

El papel tenía **tres formas de decir lo mismo** cuando el pago no cerraba contra lo facturado:

| Dónde | Qué decía |
|---|---|
| Entre las dos tablas | *«Se cancela $4.480,00 MÁS que el total facturado»* ← **el bueno** |
| Última fila del desglose | **Pagado a cuenta · $4.480,00** ← correcto, es un dato |
| Bajo el desglose, en rojo | *«el desglose ($4.335.098,06) no coincide con el total de factura ($4.330.618,06)»* ← **ruido** |

> **El aviso del control va SOLO y va al PIE**, después del desglose. El cartel de descuadre queda
> como red, para cuando no hubo control que comparar.

**Por qué al pie y no arriba**, que es lo que parecía natural: el aviso **explica la última fila de
esa tabla**. Y además arriba **no entraba**: el título *«Desglose del pago»* se posiciona desde
`lastAutoTable`, que no sabe que alguien escribió un renglón suelto en el medio, así que **lo tapaba**.

📌 Y el cartel de descuadre hablaba en el idioma equivocado: *«el desglose no coincide»* describe una
suma; *«se cancela $4.480 más que lo facturado»* describe **lo que pasó con la plata**. Al proveedor
le sirve el segundo (§ `CLAUDE.md` 🗣️ *el glosario es el de la app*).

### 8.2 · 🛑 En este PDF sólo se escribe LATIN-1

> **Nada de emoji ni de símbolos técnicos en `doc.text()`.** `⚠`, `✓`, `→` y compañía **no existen
> en WinAnsiEncoding**, que es lo que usan las fuentes estándar de jsPDF, y meter uno **rompe la
> codificación de la línea entera**: sale `& S e   c a n c e l a   $ 4 . 4 8 0 , 0 0 …`, letra por
> letra. Se escribe `ATENCION:` en texto plano.

🧨 **Y esto ya había pasado.** [A-BUG-150](PENDIENTES.md#a-bug-150) lo arregló en el cartel de
descuadre… y **dejó vivo el gemelo** en el aviso del control, doce líneas más arriba del mismo
archivo. Es el modo de falla de § 30.9.5 de `MODULO_CONCILIACION.md` —*se arregla un camino de los
dos*— en su versión más barata de evitar: **los dos estaban en la misma pantalla del editor**.

⚠️ **Y queda uno suelto**: `components/vista-facturas-arca.tsx` usa `⚠️` dentro de `doc.text()` en
dos líneas del export de facturas. Mismo defecto, otro papel, sin tocar.

### 8.3 · Un pago de más NO frena la emisión

Vale la § 🚦 de `CLAUDE.md`: pagar de más o de menos es una **discrepancia** —tiene explicación de
negocio— así que el papel **avisa y se emite igual**. Lo que frenaría es que las líneas no sumen el
total que el propio comprobante imprime, porque eso sí es el sistema contradiciéndose.

## 9. 📬 REGISTRO DE TODO LO QUE PASA POR EL MAIL *(A-FEAT-1425, 2026-10-30)*

**Para qué** (JMS): *«cada mail se registra quedando indexado para posterior referencia y consulta, con link para ir a verlo»* — y un reporte que reemplaza leer la casilla: *«va a ser más fácil leer un reporte que ver la casilla»*.

**Cómo está armado**
- **El GAS escribe, la app lee.** `gas-buscar-pdf/RegistroMails.gs` corre en la casilla (cada 15 min), recorre día por día desde un cursor y escribe cada mensaje en `public.mails_registro` (único por canal + casilla + id de Gmail: volver a pasar no duplica). Sólo lee la casilla.
- **Clasificación por reglas editables** (`public.mails_reglas`): remitente (mail o `@dominio`, con subdominios) + opcional «el asunto contiene» → tipo y acción. Gana la primera por `orden`; a igual orden, la que pide asunto. Sin regla → queda «sin regla» y el reporte lo muestra para agregarla.
- **Tres acciones**: *avisar* (va arriba, en rojo) · *guardar* (se registra y se agrupa por tipo) · *archivar* (se registra y sólo se cuenta). **Nada se descarta**: la propaganda también queda registrada.
- **El tipo a mano manda** (`tipo_manual`, § Default del dato real): corrige sin tocar la regla.
- **Agnóstico del canal desde el día 1** (`canal` = mail / whatsapp): WhatsApp entra después como otro alimentador (la «cola agnóstica» de A-FEAT-123). JMS 30/10: *«habrá un reporte total por mail y parciales por WhatsApp»* (a José: impuestos, legales, informes productivos, facturas, avance del procesamiento).
- **Lo que generó cada mail** (`procesado_por`, `vinculos`): lo van a escribir los procesadores (buscador de facturas, boletas ARBA). JMS: el buscador de facturas consulta PRIMERO el registro y sólo busca en Gmail si no hay registro.
- **El control**: cada recibido cae en exactamente un grupo (para mirar / sin regla / guardado / archivado); el reporte y la pantalla muestran la suma contra el total.
- **El link** se arma de casilla + id (`#all/<id>`), igual en el GAS (`linkGmail_`) y en la app (`lib/mails/registro.ts`); un caso de `npm run probar` vigila que coincidan.
- 🔒 **Privacidad**: la pantalla es sólo admin (mails de familia y sucesión). Las reglas iniciales tienen mails de personas y **no están en el repo** (público): viven en la carpeta de comunicación (`Mails/140 reglas iniciales - FUERA DE GIT.sql`). ✅ **La base también es sólo admin** (script 142, 30/10): las 2 tablas cuelgan del recurso `importar.mails` con `restringe_lectura`. ⚠️ cambió 30/10: hasta el 142 estaban bajo `egresos` sin restringir y las leía cualquier rol logueado (medido: los 5 roles leían; contable, socio y pruebas escribían). Si un rol recibe la sección `importar`, vería los mails.

**De dónde salió**: el catálogo del 30/10 (90 días): ≈1.180 hilos recibidos, ≈70 % propaganda, ≈4 útiles por día; lo único que dejaba rastro en la app eran las facturas, las boletas de ARBA y los detalles de pago.

### 9.1 · 🔜 El buscador de facturas consulta PRIMERO el registro *(diseño, 30/10 — no construido)*

JMS: *«el buscador de facturas, luego de importarlas, muchas veces ya tendrá la info en los registros y sólo deberá ir ahí; el procesamiento no se hará ahí salvo que no haya registros del procesador automático»*.

**Cómo quedaría, en tres pasos:**
1. **Antes de llamar al GAS**, la ruta `app/api/gas/buscar-pdf` mira el registro: mails **recibidos** del proveedor (remitente = algún mail del proveedor en `public.proveedores`, o el CUIT en el asunto), **con PDF o imagen adjunta**, desde la fecha de emisión de la factura. Si ya hay uno **procesado** para esa factura (historial del buscador con ese `gmail_message_id` y resultado `descargado`), no se busca de nuevo.
2. **Si hay candidatos en el registro**, se le pasan al GAS sus ids (`mensaje_ids`) y el GAS lee **sólo esos** mensajes (`GmailApp.getMessageById`) en vez de buscar en toda la casilla. Es más rápido y no depende de que el asunto del proveedor no haya cambiado.
3. **Si el registro no tiene nada** (el GAS del registro todavía no pasó por ese día, o el mail llegó por otro lado), el buscador busca en Gmail como hoy. Nunca se pierde una factura por confiar en el registro.

**Lo que ya está para esto (30/10):** el registro con remitente y adjuntos; la pantalla cruza cada mail con el historial del buscador y el inventario de reenvíos; y el GAS 0.19.2 devuelve el mail de origen también en el match único (antes la app lo guardaba vacío en 476 de 479 búsquedas).
**Lo que falta:** el paso 1 en la ruta, el parámetro `mensaje_ids` en el GAS, y probarlo contra la casilla real con JMS presente (toca el camino central del buscador).

### 9.2 · 🔎 A mirar con el registro funcionando
- El GAS se manda a la propia casilla **«Resumen FC»** y **«Supervisión facturas archivo digital»** a veces **3 a 6 iguales el mismo día** (catálogo del 30/10). No hay un bug evidente: cada corrida de un lote o de «Contar, re-vincular todo y mandar el estado por mail» manda el suyo. Con el registro se ve exactamente a qué hora salió cada uno y se decide si conviene uno solo por día.

## 10. 📋 PROPUESTAS DE PROCESAMIENTO POR TIPO DE MAIL *(30/10, sólo propuestas — nada se construye sin el OK de JMS)*

JMS 30/10: *«dejá propuestas: en cada sección qué se guarda, qué no, qué datos se toman, cómo propagar en caso de OK mío; fijate contra los templates que se cargan a mano y se pagan»*.

**La regla que vale para todas** (la misma del panel de ARBA desde A-FEAT-95): **el mail nunca pisa un template solo.** El procesador lee, **propone** el número al lado del que hoy tiene la cuota, y JMS aplica (fila por fila o todas). Lo aplicado deja **huella**: qué leyó y qué se aplicó (§ «Importar un documento» de `CLAUDE.md`). Y cada uno tiene su **control por dos caminos** cuando el mismo número llega por otro lado.

| # | Mail (remitente) | Qué dato trae | A dónde iría (template / cuota que hoy se carga a mano) | Cómo se propaga con OK | Control por dos caminos | Hoy |
|---|---|---|---|---|---|---|
| 1 | **ARBA boletas** (`boletaelectronica@`) — Inmobiliario rural y complementario | por partida: importe y vencimiento de la cuota | las **23 cuotas de Inmobiliario 2026** (`partida_arba`; el complementario por CUIT) | panel 🏛️ Boletas ARBA: monto y vencimiento de la cuota, con OK | la **tabla del mail** contra el **PDF** (ya existe) | ✅ existe (A-FEAT-95/104/107), falta disparo desde el registro |
| 1b | **ARBA aviso de débito** | qué cuota se debita sola y cuándo | la misma cuota: **medio de pago = débito automático** + fecha | marcar la cuota «se debita el …» → el Cash Flow la muestra como débito, no como pago a hacer | el **débito real** del extracto contra el aviso | ❌ se ignora (el GAS lo saltea: no trae link) |
| 1c | **ARBA mora** (`novedades@`) | qué cuota quedó impaga | la cuota **pendiente** con vencimiento pasado | **alerta**, nada que escribir: link a la cuota | la cuota pendiente en la app contra el aviso de ARBA | ❌ sólo el reporte |
| 2 | **AGIP ABL** (`no-responder@agip.gob.ar`) | boleta mensual: importe y vencimiento | **ABL Libertad Cuota** (MA, 12 cuotas) · ABL cocheras (anuales) | igual que ARBA: proponer monto/venc. de la cuota del mes | boleta contra el débito del extracto | ❌ |
| 3 | **Red Vial** (`avisos@rojas.gov.ar`, `@sanpedro.gob.ar`) | liquidación por partida: importe y vencimiento | **Red Vial Cuota Rojas** (MSA) · las **16 de San Pedro** (MSA y PAM) · Red Vial Lima (Zárate) | por partida, como ARBA | liquidación contra el pago | ❌ |
| 4 | **Expensas** (`libertad1366caba@`, `consorcioposadas1265@`, cochera Zapiola) | importe del mes | **Expensas Libertad** (MA) · **Expensas Posadas** (PAM) · ⚠️ **cochera Zapiola: no hay template** | monto de la cuota del mes | el pago del extracto | ❌ (Zapiola = hueco) |
| 5 | **Servicios** (Movistar, Personal, Coopser) | factura del mes: importe y vencimiento | **Teléfono Fijo 812** y **Paquete TV MA** (abiertos, sin cuotas) · ⚠️ **Coopser (luz): no hay template** | crear la cuota del mes con el importe | factura del mail contra el débito | ❌ (Coopser = hueco; ¿va por ARCA?) |
| 6 | **Contador de sueldos** (Pittaluga: «Sueldos / Impuestos del mes») | sueldo y aportes de domésticas | **Aportes Domésticas** (MA) + Sueldos | proponer el monto del mes | mail contra el pago | ❌ |
| 7 | **Contadores** (Noltfuentes: «DJ IIBB MA», subdiarios; AB Consultores: honorarios, DDJJ) | importe a pagar de la DJ · factura de honorarios | **IIBB Mensual MA** · honorarios = factura ARCA (buscador) · DDJJ → `ddjj_presentadas` (A-AUTO-09) | monto de la cuota de IIBB del mes | la DJ contra el VEP / débito | 🟡 DDJJ existe; IIBB ❌ |
| 8 | **Galicia resumen de tarjeta** (`e-resumen@`, «Visa Business ya está listo») | total del resumen y vencimiento | **Tarjeta Visa Business MSA** (12 cuotas) + importar el resumen | monto de la cuota del mes = total del resumen | **total del mail contra total del PDF** (el caso modelo, A-AUTO-01) | 🟡 diseñado (A-AUTO-01) |
| 9 | **Santander / Provincia / PPI / Galicia Securities / Dracma** (resúmenes) | «resumen disponible» · saldos | cargar el resumen (lectores Santander/Galicia ya hechos) · saldos de inversiones para el balance | recordatorio de carga; el saldo del mail como control | saldo del mail contra el último saldo cargado | ❌ |
| 10 | **Federación Patronal** (emisión de póliza) | póliza nueva | módulo Seguros (pólizas, A-FEAT-1309) | proponer cargar la póliza | cuotas de la póliza contra los débitos (ya existe) | 🟡 |
| 11 | **Productivo** (Bunge, San Pa, Ceibos: fijaciones; Arrebeef: romaneos) | fijación: tn, precio, fecha · romaneo | ventas / cuotas de **arrendamiento** (Ceibos = fijaciones de arrendamiento MSA/PAM) · importador de romaneos | proponer la cuota de ingreso con el precio fijado | fijación contra la factura de venta | ❌ |
| 12 | **Avisos con fecha** (VTV, Calendar, MiPyme, Banco Provincia cierre, Santander saldo negativo) | un vencimiento o un riesgo | nada que escribir | **alerta** en el reporte (ya clasifican como «avisar») y después WhatsApp a José | — | ✅ (reporte) |
| — | **Propaganda, notificaciones** | nada | nada | archivar, contado en el reporte | — | ✅ |

**Huecos que salen de cruzar con los templates** (mails que llegan todos los meses y no tienen template): **cochera Zapiola** (expensas), **Coopser** (luz del campo), **Zoom** y **Google One** (suscripciones pagas). Se registran; si deben ir al presupuesto, se crean con su categoría en el plan de cuentas (§ Templates de `CLAUDE.md`).

**Orden propuesto**: ARBA primero (ya existe casi todo y llegaron los de la cuota 4) → aviso de débito y mora de ARBA → AGIP/Red Vial (mismo molde que ARBA) → tarjeta Galicia (A-AUTO-01) → servicios/expensas → productivo.

### 10.1 · 🏛️ Chequeo previo de ARBA cuota 4 *(30/10, sólo lectura: mails reales contra las cuotas de la app)*

**Llegaron 6 mails de boletas** (28-30/10): Rural cuota 4 en **4 mails** (MSA, PAM, «San Manuel» con el CUIT de MSA, MA), Complementario cuota 4 de **PAM** (boleta) y de **MSA** (**aviso de débito**). **Todas vencen el 12/11**; las cuotas de la app dicen **05/11**.

**Los importes suben ~11 % contra lo proyectado** (la cuota 4 de la app repite el monto de la 2):

| Cuota 4 | App hoy | Mail ARBA |
|---|---|---|
| Rojas (MSA) | 2.214.038,50 | **2.460.212,60** |
| Casco (PAM) | 1.265.318,00 | **1.406.006,00** |
| Lima (MA) | 764.419,00 | **836.860,30** |
| Ombú (PAM) | 489.594,40 | **544.031,40** |
| las otras 15 partidas chicas | — | todas +11 % (ej. Anexo 70.757,50 → 78.624,90) |
| Complementario MSA (débito automático 12/11) | 915.647,30 | **1.002.419,80** |
| Complementario PAM | 1.373.639,50 | **1.105.502,50** ⚠️ *baja ~20 %: revisar* |

**Lo que el panel va a mostrar, y está bien que lo muestre:**
- **Partidas repetidas entre mails** (3 de MSA vuelven en el de PAM; Tango Parra 1 y 2 vuelven en el de PAM y en el de «San Manuel»): es el patrón conocido (KNOWLEDGE § ARBA); la carpeta replica «MSA - viene PAM».
- **2 partidas sin template**: 099-001274-1 ($ 526.767) y 099-025089-8 El Relincho ($ 180.573,20), las dos en el mail de PAM → [A-DAT-26](PENDIENTES.md#a-dat-26).
- **2 templates sin boleta**: Quinta Roselló 1 (099-001854-5) y Tapera 3 (099-015886-0), de PAM, **no vinieron en ningún mail**: ¿se pagan de otra forma, o falta un mail?

**¿Andaría hoy?** Sí, con dos arreglos chicos y un pendiente grande:
- ✅ el GAS busca los últimos 60 días de `boletaelectronica@`: entran los 6.
- 🔧 **arreglado hoy** (`jms/tanda-gas-2026-10-30`, sin mergear): el aviso de débito trae la boleta en un link «AQUÍ»; antes se caía al modo viejo y bajaba también el pie del mail.
- ⚠️ **lo grande: las CUOTAS 3 están todas «pendientes» en la app** (vencieron el 08/09). En el extracto de MSA del **08/09** hay **8 pagos sin conciliar** («Pago De Servicios» / «Deb. Autom. De Serv.», **$ 6.674.523,20** en total). Son las cuotas 3 pagadas y nunca atadas a su cuota. Conviene conciliarlas **antes** de aplicar la cuota 4, si no el Cash Flow muestra las cuotas 3 como deuda vencida.
- 🔴 **El Complementario de PAM cuota 3 está IMPAGO**: ARBA avisa mora al 09/10 (mail del 21/10, sin leer) y lo repite en el Domicilio Fiscal Electrónico (26/10). En los pagos del 08/09 no hay nada de ese monto. El de MSA sí se pagó (débito de $ 971.114,20).
- 🔴 **Otro aviso en el Domicilio Fiscal de MSA (05/10): «Mora temprana Ingresos Brutos, anticipo 5-2026»**. No hay template de IIBB de MSA en la app (sí de MA y PAM).

### 10.2 · 🗄️ Todo lo procesado deja su DOCUMENTO en el archivo digital — cada cosa en lo suyo *(JMS 30/10)*

JMS: *«siempre lo que se elige procesar deberá guardarse el documento en un archivo digital tipo subdiarios, pero cada cosa lo suyo»*. Es la condición 5 de «Importar un documento» (`CLAUDE.md`) aplicada a todo el mail.

**El modelo ya existe dos veces y se repite:** las facturas (`arca_pdf_archivo_digital`: carpeta del Drive por ejercicio y mes, cada PDF vinculado a su factura) y las boletas de ARBA (`boletas_arba`: archivo + cuota vinculada + lo leído del mail + correcciones — la tabla está lista y **todavía vacía**).

**Propuesta de carpetas** (una raíz «Archivo digital» en el Drive de la casilla; el GAS hace *find-or-create*, nunca borra ni reemplaza carpetas):

| Tipo | Carpeta | Nombre del archivo | Se vincula a |
|---|---|---|---|
| Facturas | `Facturas/<empresa>/<ejercicio>/<AA-MM>` (la de hoy) | la de hoy | la factura |
| ARBA Inmobiliario | `Impuestos/ARBA Inmobiliario/<año>/Cuota <n>/<empresa>` | `2026 - Inmob - Cuota 4 - Rojas.pdf` (la de hoy) | la cuota del template (`boletas_arba`) |
| ABL · Red Vial | `Impuestos/<ABL · Red Vial <municipio>>/<año>` | `2026 - ABL - Cuota 10 - Libertad.pdf` | la cuota del template |
| Resúmenes bancarios | `Bancos/<empresa> <banco> <cuenta>/<año>` | `MSA - Santander - CC - Pesos - 26-09.pdf` (la que usamos hoy) | los movimientos que cargó |
| Tarjetas | `Tarjetas/<tarjeta>/<año>` | `MA - VISA - 26-09.pdf` | el resumen cargado |
| Contador | `Contador/<empresa>/<impuesto>/<año>` | `MA - IIBB - 2026-09.pdf` | la cuota de IIBB / `ddjj_presentadas` |
| Sueldos domésticas | `Sueldos/Domésticas/<año>` | `2026-10 - Sueldos.pdf` | el período de sueldos |
| Servicios y expensas | `Servicios/<servicio>/<año>` | `2026-10 - Expensas Libertad.pdf` | la cuota del template |
| Productivo | `Productivo/<Fijaciones · Romaneos>/<campaña>` | `2026-10 - Bunge - Fij 1000579367.pdf` | la venta / cuota de arrendamiento |

**Y un solo lugar que diga qué documento se archivó, de qué mail salió y qué generó**: el registro de mails ya tiene `vinculos`; falta guardar ahí también el archivo (id y link del Drive). Para lo que no llega por mail (un PDF subido a mano), lo mismo con canal «manual». Cambio de estructura → con aviso y OK.

**El diseño se hace con VISTA PREVIA** (JMS: *«el preview se debe poder hacer en el proceso de diseñar esto: deberé poder ver ejemplos para responderte»*): una página con un mail real de cada tipo → qué se lee → qué cuota se propone cambiar → dónde se archiva y con qué nombre. JMS responde sobre cada ejemplo y recién ahí se construye.

**Vista previa publicada (30/10):** https://claude.ai/artifact/3uD8ZPgEDFk9PDRXb39VsH — 12 ejemplos reales (ARBA rural / aviso de débito / mora, Red Vial Rojas, ABL, tarjeta Galicia, expensas, IIBB MA, sueldos domésticas, Coopser, honorarios, Santander) con «Así sí / Cambiar / No» y nota; las respuestas quedan en la base de la página (colección `respuestas`) y Claude las lee desde la terminal. **Hallazgo al juntar los ejemplos:** sólo las tarjetas Galicia y la Red Vial de Rojas traen el importe en el texto del mail; el resto lo trae en el PDF adjunto o en la boleta del link → el procesador tiene que **leer el documento**, no el mail.
