# Plan: rediseño del Dashboard de Resumen Financiero

> **Última actualización**: 2026-06-01
> **Estado**: Paso 0 ejecutado. Decisión arquitectural pendiente antes de Paso 1.
> **Origen**: El dashboard hoy solo lee MSA, descarta movimientos sin categ en cuentas_contables, y no maneja multi-empresa ni distribuciones cruzadas (DIST MA).

---

## 🎯 Objetivo del rediseño

Que el dashboard de Resumen Financiero permita:

1. **Selector multi-empresa**: consolidado MSA+PAM+MA o cada una individual.
2. **Filtro multi-select por medio de pago**: banco / caja / tarjeta (dentro de cada empresa).
3. **Subtotales jerárquicos**:
   ```
   INGRESOS REALES                            + X
   EGRESOS REALES                             − Y
   ─────────────────────────────────
   RESULTADO OPERATIVO                          (X−Y)
   ± MOVIMIENTOS FINANCIEROS                   ± Z
   ─────────────────────────────────
   RESULTADO ANTES DE DISTRIBUCIONES            (X−Y±Z)
   ± DISTRIBUCIONES                            ± W
   ─────────────────────────────────
   RESULTADO FINAL                              (X−Y±Z−W)
   ```
4. **Doble entrada DIST MA**: cuando MSA o PAM pagan algo con `interno=DIST MA`, MA debe ver:
   - Ingreso "aporte de MSA/PAM"
   - Egreso por la categoría original (ej Expensas Libertad)
5. **Toggle contable vs interno** (complementario al W de doble entrada): para ver lo "real interno" vs "lo estrictamente contable".
6. **Consolidado que netea**: en modo "MSA+PAM+MA", una DIST MA se compensa (sale de PAM, entra a MA → neto cero). Pero DIST MANU/SOLE/MECHI/AMS/JMS son externas (a personas) → no se netean.

---

## 📚 Estado actual de la arquitectura

### Tabla `cuentas_contables` (plan formal)
- 143 cuentas (143 después del Paso 0; antes 122).
- Tipos: `ingreso (26)`, `egreso (108)`, `financiero (8)`, `NO (1)`.
- Las facturas ARCA apuntan a una cuenta del plan vía `categ`.

### Tabla `egresos_sin_factura` (templates)
- 151 templates (Inmobiliario Rojas, FCI, Comisión Cuenta Bancaria, etc.).
- Cada template tiene su propio `categ`, `cuenta_agrupadora`, `responsable`, etc.
- Las cuotas (`cuotas_egresos_sin_factura`) heredan el `categ` del template.

### Tabla `distribucion_socios`
- 8 conceptos en 2 secciones:
  - **Sección 1**: DIST MA, DIST MANU, DIST SOLE, DIST MECHI, DIST AMS, DIST JMS
  - **Sección 2**: CTA HIJOS, VER
- Después del Paso 0: agregada columna `empresa_destino` (DIST MA = 'MA', resto = NULL).
- Nombres corregidos: DIST MA = "Distribución MA" (no "Manuel Andrés"), DIST MECHI = "Distribución Mechi" (no "Mercedes").

### Movimientos del extracto
- `msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `ma.ma_galicia`, 3 cajas (`msa.caja_*`), 3 tarjetas (`*.tarjeta_*`).
- Cada movimiento tiene:
  - `categ` (texto libre) — puede ser de una cuenta o de un template.
  - `template_id` (UUID, opcional) — si vino conciliado a un template.
  - `comprobante_arca_id` (UUID, opcional) — si vino conciliado a una factura ARCA.
  - `contable` y `interno` (texto libre) — códigos de imputación (CTA MA, DIST MA, etc.).

### Hook actual `useFinancialData.ts`
- Solo lee `msa_galicia`.
- Agrupa por `cuenta_agrupadora` (templates) o `nombre_totalizadora` (cuentas).
- Si el `movimiento.categ` no está en `cuentas_contables`, usa el `nombre_referencia` del template como fallback.
- No clasifica como `financiero` ni `distribucion` (los datos no estaban tipados así).

---

## ✅ Paso 0 — Lo que ya se hizo (aplicado en BD el 2026-06-01)

### 1. `distribucion_socios`
- `ALTER TABLE ... ADD COLUMN empresa_destino TEXT`.
- `UPDATE` para corregir nombres y setear `empresa_destino='MA'` para DIST MA.

### 2. `cuentas_contables` — INTERESES movido
- Tipo cambiado de `egreso` a `financiero`.
- Totalizadora cambiada a `MOVIMIENTOS FINANCIEROS`.

### 3. `cuentas_contables` — 21 cuentas nuevas creadas (todas creadas el 2026-06-01)

| Totalizadora | Categs | Tipo final |
|---|---|---|
| MOVIMIENTOS FINANCIEROS | FCI, CRED P, CRED T | financiero |
| GASTOS BANCARIOS | Comision Cuenta Bancaria, Comision Cheques, Comision Transferencias, Comision Extraccion Efectivo, Comision Caja de Seguridad, Comision Certificaciones de Firma, Com. Uso Atm | **egreso** (ajustado) |
| IMPUESTOS BANCARIOS | Debitos / Creditos, IIBB Bancario, Iva Bancario, Sellos Bancario, Impuesto Pais, Percepcion IVA, Percepcion Rg 5463/23 | **egreso** (ajustado) |
| MOVIMIENTOS ENTRE CANALES | CAJA, Tarjetas MSA, Tarjetas PAM, Transferencias Interbancarias | financiero |

→ Originalmente las puse todas como `financiero`. Después el usuario aclaró que comisiones e impuestos bancarios son gastos reales (egreso). Se ajustó.

### 4. Excel auditoría
- `exports_app/PASO_0_Reclasificacion_Cuentas.xlsx` (generado al inicio, **desactualizado** respecto al ajuste posterior de tipos).
- TODO: regenerar Excel con tipos definitivos cuando se cierre la decisión arquitectural.

### Distribución final cuentas_contables
- `ingreso: 26`
- `egreso: 108` (era 95, +13 por las que se reclasificaron de financiero a egreso)
- `financiero: 8` (era 0, +8: FCI, CRED P, CRED T, INTERESES + CAJA, Tarjetas MSA, Tarjetas PAM, Transferencias Interbancarias)
- `NO: 1`

### ⚠️ NO está en backup
Si se reconstruye la BD desde el backup original, hay que rehacer los UPDATEs + INSERTs + el ALTER de distribucion_socios. Documentado en memoria.

---

## 🚧 Problema arquitectural detectado (decisión pendiente)

El usuario detectó que **hay dos sistemas de clasificación paralelos**:

```
cuentas_contables (plan formal)         egresos_sin_factura (templates)
        ▲                                       ▲
        │                                       │
        └───── ambos aparecen en categ del extracto ─────┘
                              │
                              ▼
                       Dashboard busca solo en cuentas_contables
```

### Síntoma
- Las categs de templates (FCI, Comisión X, etc.) no estaban en `cuentas_contables`.
- Por eso el Paso 0 las creó.
- Pero esto crea sincronización manual perpetua.

### El usuario propone pensamiento lateral
"Tener un sistema de cuentas que absorba cuentas y templates (plan integrado)".

---

## 🎯 Las 5 opciones analizadas

### A. Sincronización manual (lo que se hizo en Paso 0)
Mantener dos tablas, copiar manualmente cuando se crea un template.
- Costo implementación: bajo
- Costo mantenimiento: alto eterno
- Calidad: mala (dos fuentes de verdad)

### B. Templates apuntan a una cuenta (FK) ⭐ RECOMENDADA
Agregar `cuenta_contable_id` (FK) a `egresos_sin_factura`. El plan formal sigue siendo `cuentas_contables`, fuente única.

**Modelo nuevo**:
```
egresos_sin_factura
├── id
├── nombre_referencia: "Inmobiliario Rojas 2026"
├── cuenta_contable_id: FK → cuentas_contables.id   ← NUEVO
├── responsable, cuit_quien_cobra, etc.

cuentas_contables (fuente única)
├── categ, tipo, nombre_totalizadora
```

**Lógica dashboard**:
- Si `movimiento.template_id` no es null → toma `template.cuenta_contable_id` → lee cuenta del plan.
- Si no, busca `movimiento.categ` en `cuentas_contables`.
- En ambos casos, termina en UNA cuenta del plan formal.

**Beneficio extra**: dos templates pueden compartir cuenta (ej Inmobiliario Rojas MSA + Inmobiliario Rojas PAM → ambos apuntan a "Impuesto inmobiliario" → suman juntos en el dashboard).

**Costo implementación**: medio
- Agregar columna FK
- Migrar los 151 templates existentes (asignar cuenta)
- Adaptar wizard de creación de templates (selector de cuenta con opción "crear nueva")
- Adaptar hook `useFinancialData`

**Costo mantenimiento**: bajo (una sola fuente de verdad).

### C. Cuentas absorben templates
Una sola tabla `cuentas_contables` con campos opcionales de template (responsable, cuotas, etc.).
- Costo implementación: muy alto (refactor wizard, cuotas, motor, todo).
- Mezcla conceptos distintos. ❌

### D. Templates absorben cuentas
Eliminar `cuentas_contables`, plan único = `egresos_sin_factura`.
- Facturas ARCA tendrían que apuntar a templates (forzado). ❌

### E. Vista derivada `plan_unificado`
View SQL que une ambas tablas.
- Cambio chico, pero no resuelve el problema de duplicados ni la divergencia.
- Compromiso intermedio.

---

## 🧭 Lectura conceptual de fondo

Un template y una cuenta contable **no son lo mismo**:

| Concepto | Qué representa | Granularidad |
|---|---|---|
| **Cuenta contable** | Tipo de gasto/ingreso. Lo que aparece en el estado de resultados. | Conceptual. "Impuesto inmobiliario". |
| **Template** | Una recurrencia concreta. Quién paga, cuándo, cuánto. | Operativa. "Inmobiliario Rojas 2026 MSA, 4 cuotas". |

**Un template siempre se reduce a una cuenta contable**. El error original fue no declarar esa reducción al crear el template. Opción B formaliza eso.

---

## 📋 Estado de decisión

**Decisión pendiente del usuario**: cuál de las 5 opciones (A/B/C/D/E) implementar para resolver la dualidad de clasificación.

**Recomendación del asistente**: B (templates apuntan a cuenta vía FK).

**Si se elige B, plan de implementación tentativo**:

1. **Migración BD**:
   - `ALTER TABLE egresos_sin_factura ADD COLUMN cuenta_contable_id UUID REFERENCES cuentas_contables(id)`.
   - Script para asignar `cuenta_contable_id` a los 151 templates existentes basándose en su `categ` actual (matchea con cuentas existentes; los que no, requieren decisión).

2. **UI**:
   - Wizard de templates: cambiar input "categ" libre por `SelectorCuentaContable` con opción "crear nueva cuenta".
   - Vista de templates: mostrar la cuenta a la que apuntan.

3. **Hook dashboard**:
   - Refactor de `useFinancialData.ts` para resolver siempre vía `cuentas_contables`.
   - Simplifica significativamente la lógica actual (no hay fallback a nombre de template).

4. **Reportes futuros**:
   - El próximo reporte (sobre facturas + templates) ya tiene la pieza correcta.

**Si se elige otra opción**: replanificar.

---

## 📅 Siguientes pasos del rediseño dashboard (cuando se cierre la decisión arquitectural)

### Paso 1: Hook lee de las 3 empresas
Modificar `useFinancialData.ts` para consultar las 10 tablas (4 bancos + 3 cajas + 3 tarjetas). Procesar todo unificado con metadata `empresa` por movimiento.

### Paso 2: Subtotales jerárquicos
Implementar los 3 niveles: Operativo / Financiero / Final. La estructura de cuentas (`tipo`) ya está preparada después del Paso 0.

### Paso 3: Selector empresa
Combo: Consolidado / MSA / PAM / MA.

### Paso 4: Filtro multi-select medio de pago
Banco / Caja / Tarjeta.

### Paso 5: Doble entrada DIST MA (espejo en MA)
Cuando MSA o PAM pagan con `interno=DIST MA`, el hook genera virtualmente:
- En MSA/PAM: distribución (no egreso operativo).
- En MA: ingreso por aporte + egreso por la categ original.
- Usa `empresa_destino` de `distribucion_socios` para saber a qué empresa va.

### Paso 6: Toggle contable vs interno
Switch en la UI. Cambia cómo se interpretan los movimientos.

### Paso 7: Compensación inter-empresa en consolidado
Cuando se ve "MSA + PAM + MA", las distribuciones internas (DIST MA) se compensan. Las externas (DIST MANU, SOLE, etc.) quedan como salida del consolidado.

---

## 🗂️ Memorias relacionadas

- `memory/project_dashboard_paso_0_reclasificacion.md` — detalle del Paso 0 (lo aplicado).
- `memory/project_dashboard_agrupado.md` — estado del dashboard antes del rediseño.
- `memory/project_tarjetas_testing_pendiente.md` — tarjetas en main, falta probar.

---

## 🔄 Cómo retomar la próxima sesión

1. Leer este archivo.
2. Confirmar con el usuario qué opción elige (A/B/C/D/E).
3. Si la decisión es B (recomendada), arrancar con la migración BD + script de asignación de cuentas a templates existentes.
4. Si es otra opción, replanificar pasos 1-7.

**Estado del proyecto al cierre del 2026-06-01**: Paso 0 aplicado en BD. Decisión arquitectural pendiente. Cambios no propagados al hook todavía (el dashboard sigue funcionando como antes — solo MSA, fallback nombre template).
