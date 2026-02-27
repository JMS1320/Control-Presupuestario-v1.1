# DISEÑO: Sistema Mail + BBDD Proveedores

> **Estado**: DISEÑO — Pendiente implementación
> **Fecha inicio diseño**: 2026-02-26
> **Prioridad**: Media — funcionalidad de valor pero no bloqueante

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
- Vista de administración separada para gestión completa

---

## 2. Sistema Mail

### Trigger
- **Evento**: cambio de estado a `pagado` o `programado` (en Vista de Pagos o ARCA Facturas)
- **Activación**: checkbox opcional en el modal, **default: OFF** (no envía nada por defecto)

### Flujo completo

```
1. Usuario cambia estado → pagado/programado
2. Checkbox "Enviar aviso al proveedor" (default: desmarcado)
   └── Si desmarcado → flujo normal, sin mail
   └── Si marcado:
       a. Sistema busca proveedor por CUIT en tabla proveedores
       b. Si no encuentra → modal rápido para ingresar nombre + email
       c. Genera borrador editable con template base
       d. Usuario revisa/modifica cualquier parte del texto
       e. Confirma envío → mail sale
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

### Casos de uso especiales (mensaje personalizado)
- Descuento por factor convenido
- Pago parcial con acuerdo
- Nota de pedido de factura/recibo
- Cualquier aviso adicional al proveedor

---

## 3. Implementación técnica

### Opción recomendada: SMTP Gmail con App Password

**Ventajas:**
- Simple de configurar (no requiere Google Cloud Console)
- Sin dependencias externas pagas
- Control total desde la cuenta Gmail existente

**Configuración:**
1. Habilitar 2FA en cuenta Gmail emisora
2. Generar "Contraseña de aplicación" en cuenta Google
3. Guardar en variables de entorno:
   ```
   GMAIL_USER=cuenta@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

**Alternativa si Google complica:** Resend (resend.com) — API key simple, 100 mails/día gratis

### API Route Next.js
```typescript
// app/api/send-mail/route.ts
// Recibe: { to, subject, body }
// Usa nodemailer con SMTP Gmail
// Retorna: { success, messageId }
```

### Librerías
- `nodemailer` — envío SMTP (ya disponible en Node.js/Next.js)

---

## 4. Configuración del sistema

### Variables configurables (localStorage o BD)
- `mailFrom` — cuenta emisora
- `mailFirma` — texto de firma
- `mailDefaultCC` — CC por defecto (ej: contador)
- `mailHabilitado` — master switch on/off

### Vista de configuración
- Tab en Configuración existente o modal dedicado
- Campos: cuenta Gmail, firma, CC por defecto, test de envío

---

## 5. Pendientes a definir

- [ ] ¿La firma es fija o por empresa (MSA/PAM)?
- [ ] ¿Se guarda historial de mails enviados?
- [ ] ¿El proveedor puede responder al mail (reply-to)?
- [ ] ¿Adjuntar PDF del comprobante de retención SICORE al mail?
- [ ] ¿Desde qué cuenta Gmail específica sale (la de MSA, PAM, o una genérica)?

---

## 6. Fases de implementación sugeridas

| Fase | Descripción | Complejidad |
|------|-------------|-------------|
| **1** | Tabla `proveedores` + alta rápida desde modal | Baja |
| **2** | API route SMTP + configuración básica | Media |
| **3** | Checkbox en Vista Pagos + borrador editable | Media |
| **4** | Auto-vinculación CUIT + historial mails | Media |
| **5** | Adjuntar PDF SICORE + mejoras UX | Alta |

**Recomendación**: Implementar Fase 1 + 2 + 3 juntas como MVP funcional.

---

**📅 Última actualización:** 2026-02-26
**Estado decisiones pendientes:** Ver sección 5
