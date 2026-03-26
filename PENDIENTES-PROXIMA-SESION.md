# 🎯 PENDIENTES PRÓXIMA SESIÓN

> **Última actualización**: 2026-03-26
> **Sesión anterior**: Sistema Caja + fixes monetarios + preview import ARCA

---

## ✅ COMPLETADO EN SESIÓN 2026-03-26

| Feature | Commits |
|---------|---------|
| Fix separador decimal coma en todos los inputs monetarios (Cash Flow, ARCA, Templates, Extracto, Sueldos) | `a534219` (parcial) |
| Fix Sigot anticipo crash — `SelectItem value=""` → `value="__none__"` (Radix crash) | `a534219` |
| Preview import ARCA — muestra listado facturas antes de confirmar (nueva/duplicada/error) | `a534219` |
| BD: 3 tablas caja `msa.caja_general/ams/sigot` con misma estructura que extracto bancario | migrations |
| BD: campo `medio_pago` en `cuotas_egresos_sin_factura`, `sueldos.pagos`, `msa.comprobantes_arca` | migrations |
| `CuentaBancaria`: campo `tipo` (banco/caja) + `schema_bd` para routing schema automático | `a534219` |
| `useMovimientosBancarios`: soporte schema `msa` para tablas de caja | `a534219` |
| Extracto: selector expandido con dos grupos (Cuentas Bancarias / Cajas) | `a534219` |
| Cash Flow: filtro medio_pago en panel de filtros | `a534219` |
| Templates pago manual: selector medio_pago | `a534219` |
| Sueldos anticipo: selector medio_pago | `a534219` |
| ARCA: columna `medio_pago` disponible (oculta, activable) | `a534219` |
| Documentación: `CONCILIACION-CONTABILIDAD.md` sección 17 Sistema Caja | — |

---

## ✅ COMPLETADO EN SESIÓN 2026-03-22

| Feature | Commits |
|---------|---------|
| Fix schema `pam` HTTP 406 — `ALTER ROLE authenticator SET pgrst.db_schemas` | SQL directo |
| Selector de cuenta siempre visible en Extracto Bancario | `7d1b53f` |
| `useMovimientosBancarios` dinámico — acepta tabla como parámetro | `c6bfeca` |
| Toda propagación categ usa `tablaActiva` en lugar de `msa_galicia` hardcodeado | `c6bfeca` |
| Documentación `CONCILIACION-BANCARIA.md` y `ARQUITECTURA-BD.md` actualizadas | `3e7a056` |

---

## 🔧 PENDIENTES — CONCILIACIÓN BANCARIA (atacar de a uno)

### C1 — Traer cuenta contable automáticamente al vincular factura/template

**Situación actual**: Al conciliar un movimiento contra una factura ARCA o template que ya tiene `cuenta_contable` / `categ` asignada, ese valor NO se trae automáticamente al campo `categ` del extracto. El usuario lo tiene que escribir manualmente.

**Comportamiento deseado**:
- Al seleccionar una factura/template para vincular → pre-completar `categ` del extracto con la cuenta que ya tiene esa factura/template
- Si la factura/template no tiene cuenta → dejar vacío
- El usuario puede editar el valor pre-completado antes de confirmar

**Impacto**: Es el flujo más común — la mayoría de las facturas ya tienen cuenta contable asignada.

---

### C2 — Propagación factura → extracto no cubre `pam_galicia_cc`

**Situación actual**: En `vista-facturas-arca.tsx` línea 840, cuando se edita `cuenta_contable` en una factura, propaga a `msa_galicia` y `pam_galicia` pero **no a `pam_galicia_cc`**.

**Fix**: Agregar `pam_galicia_cc` al array `['msa_galicia', 'pam_galicia', 'pam_galicia_cc']`.

---

### C3 — Motor de reglas contable e interno (no implementado)

**Situación actual**:
- Tabla `reglas_contable_interno` existe pero está **vacía**
- Componente `configurador-reglas-contable.tsx` existe (CRUD de reglas) pero nunca fue testeado
- **No existe código** en el motor de conciliación que lea esas reglas y las aplique

**Pendiente**:
1. Definir estructura y lógica de las reglas (qué variables determinan contable e interno)
2. Implementar el motor que aplique las reglas al conciliar
3. Cargar las reglas iniciales en la tabla
4. Testear el configurador CRUD

---

### C4 — Verificar coherencia reglas_conciliacion vs cuentas_contables

**Situación actual**:
- `reglas_conciliacion` usa códigos cortos: `IMP 2`, `BANC`, `CRED P`
- `cuentas_contables` tiene nombres largos: `ADMINISTRACION Y ESTRUCTURA`, `HERBICIDAS`, etc.
- **No verificado** si los códigos cortos de las reglas existen como `categ` en `cuentas_contables`

**Pendiente**: Hacer query cruzada para identificar qué categ de las reglas no existen en `cuentas_contables` y decidir cómo unificar.

---

### C5 — Reglas de conciliación no asignan contable ni interno

**Situación actual**: La tabla `reglas_conciliacion` tiene columnas `categ`, `centro_costo`, `detalle` — pero **no tiene columnas `contable` ni `interno`**. Las reglas automáticas del motor solo pueden asignar categ/detalle, no los campos contable e interno.

**Pendiente**: Decidir si:
- (A) Agregar columnas `contable` e `interno` a `reglas_conciliacion`
- (B) Dejar contable/interno exclusivamente a cargo de `reglas_contable_interno`
- (C) Combinación: reglas_conciliacion para categ, reglas_contable_interno para contable+interno

---

### Contexto técnico para atacar los pendientes

**Import extracto (aclaración)**: El importador mapea CATEG, Contable, Interno, Centro de Costo del Excel si están presentes. Galicia en práctica no manda esas columnas → llegan vacías. No hay distinción histórico/actual en el import.

**30 reglas activas** en `reglas_conciliacion`, todas sobre `descripcion` tipo `contiene`. Asignan categ e interno. Ordenadas por prioridad (orden 1 a 30+).

**reglas_contable_interno**: Vacía.

---

---

## ✅ COMPLETADO EN SESIÓN 2026-03-20

| Feature | Commits |
|---------|---------|
| ECHEQ facturas: fix `setEcheqEstadoDestino` siempre `'pagar'` | `25b9ae1` |
| ECHEQ facturas: `setEcheqOrigen('facturas')` explícito | `25b9ae1` |
| ECHEQ facturas: ocultar botón en sección "Pagados" | `25b9ae1` |
| ECHEQ facturas: confirm dialog muestra `estadoEfectivo` ('echeq') | `25b9ae1` |
| ECHEQ: local state update no-SICORE usa `estadoEfectivo` correcto | `25b9ae1` |
| Documentación: `ECHEQ.md` creado completo | — |
| Documentación: `SICORE.md` sección 28 integración ECHEQ | — |

### Estado del módulo ECHEQ post-sesión

✅ Anticipos: flujo completo funcionando (SICORE + sin SICORE, con y sin retención previa)
✅ Facturas: flujo corregido — `echeqEstadoDestino` siempre `'pagar'`
✅ Cash Flow: filas ECHEQ en verde claro + posición por `fecha_cobro_echeq`
✅ Panel Gestión ECHEQs en Cash Flow
✅ Anti-duplicados en `guardarCheques`
✅ DB constraints incluyen `'echeq'` en ambas tablas

---

## ✅ COMPLETADO EN SESIÓN 2026-03-05

| Feature | Commits |
|---------|---------|
| Módulo Sueldos — BD + UI + Cash Flow 4ta fuente | múltiples |
| Anticipo: estado 'conciliado', semántica monto correcto | — |
| SICORE: botón "Sin SICORE" en anticipos | — |
| SICORE: skip Factura C (tipo_comprobante 11) | — |
| SICORE: descuento proporcional (% o monto fijo) | — |
| Vista Pagos: Preparado → Pagado directo | — |
| Anticipo "A Pagar" = monto - monto_sicore | — |
| Fix quincena: usar fecha_vencimiento (no fecha_estimada) | `560e56c` |
| Fix quincena en Vista Pagos (cambiarEstadoSeleccionadas) | `560e56c` |
| Ver Retenciones: muestra anticipos + facturas | `9bc5c1b` |
| Fix columna fecha_pago en query anticipos | `a6ce543` |
| BD: Rigo quincena corregida 26-03-2da → 26-03-1ra | SQL directo |

---

## 🚨 PENDIENTES INMEDIATOS (próxima sesión)

### 0b. Sistema Caja — Importador (Fase 1 pendiente)

- Definir formato del reporte físico de caja que se exportará
- Crear API `/api/import-caja` — leer Excel/CSV del reporte y poblar `msa.caja_general`, `msa.caja_ams` o `msa.caja_sigot` según corresponda
- Igual que import extracto pero sin campos bancarios (sin `origen`, `grupo_de_conceptos`, etc.)

### 0c. Sistema Caja — Interceptor template CAJA (Fase 5, al final)

- Cuando motor concilia movimiento bancario y detecta template CAJA:
  - El débito bancario representa una transferencia al efectivo (banco → caja)
  - Interceptar y pedir confirmación antes de ejecutar
  - Si confirma: crear registro de ingreso en la tabla de caja correspondiente
- Dejar para después de que el importador funcione y haya datos reales en las cajas

### 0. Testing ECHEQ facturas (nuevo)
- Probar botón ECHEQ en factura en estado 'pendiente' con SICORE → verificar queda en 'echeq'
- Probar botón ECHEQ en factura ya en 'pagar'/'preparado' → verificar queda en 'echeq' sin abrir SICORE de nuevo
- Verificar que aparece en Cash Flow en `fecha_cobro_echeq` con fila verde
- Verificar registro en Panel ECHEQs de Cash Flow

### 1. Verificar testing módulo Sueldos
- Registrar anticipo y verificar que `saldo_pendiente` baje
- Confirmar que los 35 períodos aparecen en Cash Flow como origen `SUELDO`
- Confirmar que vista Sueldos muestra correctamente todos los empleados

### 2. Ver Retenciones — mejora visual
- Actualmente anticipo Energy Store debería aparecer en quincena `26-03 - 1ra`
- Verificar que el badge "Anticipo" se muestra correctamente
- El neto gravado de anticipos aparece como `-` (no aplica) — confirmar si está bien

---

## 🗺️ OPCIONES PARA NUEVO MÓDULO

### Opción A — Templates masivos (11-61)
- Templates inmobiliarios 11-13 (ARBA MSA/PAM)
- Carga masiva hasta template 61 según Excel original
- Sistema alertas Vista Principal integrado

### Opción B — FCI / Templates bidireccionales
- Implementar arquitectura diseñada (CLAUDE.md sección FCI)
- Campos `tipo_movimiento` + `es_bidireccional` en BD
- Modal pago manual con Suscripción/Rescate

### Opción C — Módulo Terneros Flujo B
- Flujo B: lectura lector orejas (pendiente en DISEÑO_TERNEROS.md)
- Completar proceso destete UI (confirmar ciclos en BD)

### Opción E — Caja: importador y conciliación
- Importador API para los 3 reportes de caja
- Una vez cargados datos: motor conciliación de caja igual que bancos
- Interceptor template CAJA (banco → caja transfers)

### Opción D — Cierre Quincena SICORE mejorado
- Generación PDF comprobante retención formato AFIP oficial
- Templates SICORE 60-61 llenado automático al cerrar quincena
- Email automático proveedores

---

## 📋 DEUDA TÉCNICA CONOCIDA

| Issue | Prioridad | Notas |
|-------|-----------|-------|
| IPC real módulo Sueldos | Media | `public.indices_ipc` vacía, `sueldo_x_ipc = bruto_calculado` |
| Cerrar períodos Sueldos | Media | Cambiar proyectado → cerrado al pagar |
| Wilson Barreto monto_a = $0 | Baja | Confirmar si corresponde |
| Aguinaldo lógica | Baja | Jun/Dic no implementado |
| Sistema backup Supabase | Alta | Upload nunca funcionó |
