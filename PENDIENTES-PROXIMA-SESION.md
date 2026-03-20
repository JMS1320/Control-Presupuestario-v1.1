# 🎯 PENDIENTES PRÓXIMA SESIÓN

> **Última actualización**: 2026-03-20
> **Sesión anterior**: ECHEQ — integración facturas + anticipos

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
