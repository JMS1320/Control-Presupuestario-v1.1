# Plan: Reglas + Templates bancarios PAM/MA — paso a paso

> **Última actualización**: 2026-05-28
> **Origen**: necesidad de crear reglas + templates de débitos bancarios para PAM y MA sin contaminar datos MSA.
> **Modo de trabajo**: el usuario va paso a paso, NO implementar varios pasos juntos.

---

## 🎯 Contexto y reglas de dominio

### Distinción clave entre tipos de template

| Tipo | Ejemplos | Empresa la define | # de templates |
|---|---|---|---|
| **Específico** | Red Vial Rojas, Inmobiliario, Sigot | El template (responsable fijo). Lo paga el banco que sea, el gasto sigue siendo de la empresa del template. | 1 |
| **Genérico bancario** | Comisión Cuenta, Comisión Cheques, IIBB Bancario, IVA Bancario, Sellos, Créditos Pagados/Tomados | El banco de origen del movimiento. Si fue en `pam_galicia` → la comisión es de PAM. | N (uno por empresa con cuenta bancaria) |

→ Para los específicos, si PAM paga un template MSA, eso es un **aporte de PAM a MSA** (registrable contablemente).
→ Para los bancarios, **no hay templates "globales"**, son N templates espejados (mismo `nombre_referencia` y `categ`, distinto `responsable`).

### Estado actual (verificado en BD, 2026-05-28)

- **Reglas**: 41 reglas (40 activas), todas en `msa_galicia`. 0 en PAM/MA.
- **Templates bancarios** (`solo_conciliacion=true` o equivalentes): existen 11 categs, **todos con responsable=MSA**. Faltan los espejos PAM (11) y MA (11) → 22 templates por crear.
- **Templates FCI**: ya tienen 2 espejos (MSA + PAM). Es el patrón a replicar.
- **Cuentas contables**: 122, **plan único compartido** (sin campo empresa). No hay nada que crear para PAM/MA.
- **Único lugar que crea templates**: `wizard-templates-egresos.tsx:281`. La app NUNCA crea templates automáticamente al conciliar.

### Bug latente del motor (`useMotorConciliacion.ts:685-741`)

`crearCuotaEnTemplate` filtra por empresa SOLO cuando hay >1 templates con esa categ. Si hay 1 solo (caso típico hoy), lo usa sin verificar la empresa. Resultado:

> Si una regla PAM matchea en `pam_galicia` y solo existe el template MSA con esa categ → la cuota se crea en el template MSA. Silencioso, sin warning. Contamina el Cash Flow MSA con un gasto que es de PAM.

### 🔑 Discriminador clave: `solo_conciliacion`

Verificado en BD (2026-05-28): los 14 templates bancarios genéricos (Comisión X, IIBB, IVA, Sellos, Débitos/Créditos, Impuesto País, Percepción IVA/Rg 5463) son **los únicos** con `solo_conciliacion=true`. Red Vial Rojas, Inmobiliario, Sigot, FCI, CAJA, etc. tienen `solo_conciliacion=false`.

| Template tiene | Semántica | Comportamiento del motor |
|---|---|---|
| `solo_conciliacion=true` | "Solo existe para conciliar movimientos bancarios" → banco define empresa | Filtro estricto por empresa (Capa 1) |
| `solo_conciliacion=false` | Template normal — cualquier banco lo paga, template define empresa | Comportamiento actual (no romper Red Vial Rojas pagada por PAM) |

### Notas sobre bidireccional

Los 14 templates bancarios YA tienen `es_bidireccional=true` (verificado). Las devoluciones (`Devolucion Comisiones Por Transferencias`, `Anulacion Percepcion Rg 5463/23`, etc.) ya están soportadas: el motor pone `tipo_movimiento='ingreso'` con monto positivo y Cash Flow lo trata como crédito. **No se guarda como débito negativo.** Ya funciona.

### Casos grises identificados (revisar después, no urgentes)

- **CAJA** (categ): 1 template MSA. Reglas "Extraccion En Autoservicio" / "Compra Cash Back" cargan acá. Si PAM también hace estos movimientos, ¿necesita su `CAJA` PAM? — pendiente decisión.
- **CRED P** (Créditos Pagados): 1 template MSA. Regla "Intereses Sobre Saldos Deudores" carga acá. ¿PAM tendrá su `CRED P` cuando empiece a tomar créditos? — pendiente decisión.

### Sobre `es_bidireccional` y créditos a templates "para débitos"

Verificado en código (`useMultiCashFlowData.ts:227-244`): Cash Flow lee `tipo_movimiento` directo del campo de la cuota, sin consultar `es_bidireccional` del template padre. El motor (`crearCuotaEnTemplate`) hace lo mismo. **El flag `es_bidireccional` es exclusivamente UI** (controla si el Pago Manual ofrece elegir entre egreso/ingreso al crear cuotas a mano).

Consecuencia: si llega un crédito a un template marcado `es_bidireccional=false`, **se guarda correctamente como `tipo_movimiento='ingreso'`** con monto positivo. Cash Flow lo procesa como crédito. No salta error, no guarda mal. Hay solo inconsistencia semántica del flag pero sin impacto funcional. **No requiere acción.**

### Tres caminos para crear/vincular una cuota — solo camino A se blinda

| Camino | Cómo | Templates afectados | ¿Toca el blindaje? |
|---|---|---|---|
| **A. Regla con `llena_template=true`** | Motor matchea texto del extracto → crea cuota nueva conciliada (`crearCuotaEnTemplate`) | Bancarios (siempre), FCI/CAJA (a veces) | ✅ SÍ — es lo que estamos blindando |
| **B. Match contra cuota existente** | Cuota proyectada en Cash Flow + extracto matchea monto/fecha → motor vincula | Templates Fijo con cuotas planificadas | ❌ NO — la cuota ya tiene su `egreso_id`, sin ambigüedad |
| **C. Asignación manual** | Usuario abre Tab Template del extracto y vincula | Cualquiera | ❌ NO — el usuario elige template explícitamente |

→ El blindaje del Paso 1 toca SOLO el camino A. B y C ya están bien.

### Tema futuro a revisar (no urgente)

¿Camino B puede equivocarse de template? Una cuota proyectada de Red Vial Rojas (responsable MSA) vive en el template MSA. Si por error humano el usuario asigna esa cuota al banco PAM (vía Pago Manual o edición), el motor podría vincularla cuando importe el extracto de `pam_galicia`. Probablemente sea OK porque la cuota lleva el template padre fijo, pero merece verificación cuando se llegue al refinamiento.

---

## 🛡️ Plan: 3 capas de defensa para máxima seguridad

### Capa 1 — Blindar el motor (red última)

Cambio acotado en `crearCuotaEnTemplate`: **filtrar por empresa solo cuando el template encontrado tenga `solo_conciliacion=true`**. Para templates `solo_conciliacion=false`, mantener el comportamiento actual.

| Caso | Templates con esa categ | Comportamiento propuesto |
|---|---|---|
| Bancario genérico — regla PAM, solo existe MSA (`solo_conciliacion=true`) | 1 (MSA) | ❌ NO crea cuota + warning "no hay template PAM con categ X" |
| Bancario genérico — existen MSA y PAM (`solo_conciliacion=true`) | 2 | Filtra por empresa → carga en el correcto ✓ |
| Específico — Red Vial Rojas, regla MSA, lo paga PAM desde su banco | 1 (MSA), `solo_conciliacion=false` | ✅ Carga en MSA (correcto — gasto MSA pagado por PAM) |
| FCI — ya hay MSA y PAM (`solo_conciliacion=false`) | 2 | Igual que hoy: filtra por empresa cuando hay >1 ✓ |
| Cualquier caso — regla MSA, solo MSA | — | Igual que hoy ✓ |

Sin esto, cualquier error en pasos posteriores contamina. Es la base.

### Capa 2 — Copia selectiva + creación orgánica de templates faltantes (estilo SICORE)

Flujo único reutilizable en 2 escenarios: **al copiar reglas** y **al activar reglas inactivas**.

**Modal "Copiar reglas entre cuentas"**:
- Select origen + destino (empresa A → empresa B)
- Lista con checkboxes de reglas a copiar (de a 1, varias, o todas)
- Búsqueda + filtros

**Al confirmar copia, sistema valida cada regla**:
- Busca template con `categ=regla.categ` AND responsable que matchee la empresa destino
- Las que tienen template → se copian **activas**
- Las que no tienen → entran al wizard secuencial

**Wizard secuencial "Templates faltantes" (estilo SICORE)**:
```
Faltan 15 templates. Querés crear alguno?
[#1 de 15] Comision Cuenta Bancaria — PAM
  nombre_referencia: [Comision Cuenta Bancaria]       (editable)
  categ:             [Comision Cuenta Bancaria]       (readonly)
  responsable:       [PAM]                            (readonly)
  cuenta_agrupadora: [heredado del template MSA]      (editable)
  solo_conciliacion: [heredado]                       (readonly)
  es_bidireccional:  [heredado]                       (readonly)
  
  [Crear]  [Saltar — regla queda inactiva]  [Crear todos los faltantes con defaults]
```

**Resultado**:
- Templates creados → reglas correspondientes nacen activas ✓
- Templates saltados → reglas correspondientes nacen `activo=false`

**Mismo wizard se dispara al "Activar regla inactiva"** (1 o varias): valida que exista template, si falta ofrece crearlo, si no se crea no se activa.

### Capa 3 — Validación al guardar regla nueva en Configurador

Cuando se crea/edita una regla nueva con `llena_template=true` y `cuenta_bancaria_id` definido, mismo chequeo + wizard. Cierra el círculo: cualquier vía de entrada valida igual.

---

## 📋 Secuencia de implementación recomendada

| Paso | Acción | Por qué este orden |
|---|---|---|
| **1** | Blindar el motor (Capa 1, con discriminador `solo_conciliacion`) | Red de seguridad última. Sin esto, todo lo demás puede contaminar. |
| **2** | Copia selectiva + wizard "templates faltantes" estilo SICORE (Capa 2 + 3 fusionadas) | Los templates emergen orgánicamente del flujo de copia. No hay paso "crear 22 templates por separado". |
| 3 | Validación al guardar regla nueva en Configurador (Capa 3) | Cierre del círculo: cualquier vía de entrada valida igual. |
| 4 | Decisión sobre casos grises: ¿CAJA PAM? ¿CRED P PAM? | Pendiente conversación con usuario, no bloqueante. |
| 5 | (Opcional) Mejora UX adicional según uso | Después de operar un tiempo con lo construido. |

---

## ⏳ Estado actual

- [x] **Paso 1 — Blindar el motor** ✅ implementado 2026-05-28 en `desarrollo`
- [x] **Paso 2 — Copia + wizard SICORE-style** ✅ implementado 2026-05-28 en `desarrollo`
- [ ] **Paso 3 — Validación al guardar regla nueva** ← próximo (pequeño)
- [ ] Paso 4 — Decidir grises (CAJA, CRED P)
- [ ] Paso 5 — Mejoras UX opcionales

### Detalle Paso 2 implementado

- `components/modal-copiar-reglas.tsx` (nuevo) — modal con 4 pasos:
  1. **Selección**: cuenta origen+destino, lista de reglas con checkboxes, búsqueda acento-insensible, toggle "solo activas"
  2. **Wizard templates faltantes** (estilo SICORE): uno por categ, editable nombre/agrupadora/centro_costo, hereda solo_conciliacion + es_bidireccional del template MSA. Botones: Crear / Saltar (regla queda inactiva) / Crear todos con defaults.
  3. **Confirmación**: resumen con cantidad de reglas activas/inactivas + templates a crear + listado completo.
  4. **Completado**: stats finales.
- `components/configurador-reglas.tsx` — botón "Copiar reglas" en header, integración del modal.
- Reglas cuyo template falta y NO se crea → se copian con `activo=false`.
- Reglas con `llena_template=false` o cuyo template ya existe → se copian activas.
- Templates nuevos se crean con `tipo_template='abierto'`, `tipo_recurrencia='abierto'`, `es_multi_cuenta=false`. Heredan `solo_conciliacion` y `es_bidireccional` del template origen.

---

## 📝 Notas / decisiones tomadas

- **2026-05-28**: el usuario priorizó "máxima seguridad" → empezar por blindar el motor antes de copiar reglas.
- **2026-05-28**: la app no debe activar reglas si no hay template — si las copia, nacen inactivas. Para activar, debe pedir crear el template (no auto-resolver).
- **2026-05-28**: el patrón "mismo nombre, distinto responsable" ya existe en producción para FCI (FIMA Premium MSA + PAM, creados manualmente el 2026-02-04). Es la referencia.
- **2026-05-28**: discriminador del blindaje = `solo_conciliacion`. NO romper Red Vial Rojas pagada por PAM (el `solo_conciliacion=false` la deja pasar). SÍ bloquear Comisión Bancaria PAM que iría a template MSA (`solo_conciliacion=true` activa filtro estricto).
- **2026-05-28**: reordenado por sugerencia del usuario — los 22 templates PAM/MA NO se crean por separado, emergen del wizard de copia (más orgánico, estilo SICORE). El paso "crear templates" del plan original desaparece.
- **2026-05-28**: bidireccional ya está OK — los 14 bancarios tienen `es_bidireccional=true` y el motor guarda `tipo_movimiento='ingreso'` con monto positivo (no como débito negativo). Devoluciones funcionan.
- **2026-05-28**: casos grises identificados (CAJA, CRED P): tratamiento decidido después, no bloqueante para arrancar.

---

## 🔗 Referencias

- `hooks/useMotorConciliacion.ts:685-741` — `crearCuotaEnTemplate` (función a blindar)
- `components/configurador-reglas.tsx` — UI del Configurador donde irán los nuevos modales
- `components/wizard-templates-egresos.tsx:281` — único lugar que hace INSERT en `egresos_sin_factura`
- `hooks/useReglasConciliacion.ts` — CRUD de reglas
- `DISEÑO_TEMPLATES.md` — arquitectura completa de templates
- `memory/project_proxima_sesion.md` — pendientes operacionales generales
