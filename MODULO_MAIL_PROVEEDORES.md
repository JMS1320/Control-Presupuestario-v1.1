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
