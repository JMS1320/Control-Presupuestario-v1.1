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
