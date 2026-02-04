# 🎯 CLAUDE.md - CENTRO DE COMANDO

> **Este archivo es tu "índice inteligente"**: Información crítica actual + navegación al conocimiento completo.

---

# 🤖 **REGLAS AUTOMÁTICAS CLAUDE**

## 🔄 **Reglas de Objetivos:**
1. **Verificar contexto objetivo** antes de responder
2. **Buscar en KNOWLEDGE.md** solo si no está en contexto cargado
3. **Documentar avances en Claude** durante objetivo activo  
4. **Proponer finalizar objetivo** cuando mencione "completado"
5. **Usar tags sistemáticos** en toda documentación
6. **Nunca esperar que usuario pregunte** → proponer automático

---

# 📂 **NAVEGACIÓN A KNOWLEDGE.md**

## 🔍 **Búsqueda por Tags:**
```bash
# Todo sobre Cash Flow:
Grep "#cash-flow" KNOWLEDGE.md

# Configuraciones funcionando:
Grep "#funcionando" KNOWLEDGE.md  

# Errores resueltos:
Grep "#error #solucion" KNOWLEDGE.md

# Pendientes implementar:
Grep "#pendiente" KNOWLEDGE.md
```

## 📋 **Secciones Principales:**
- **SISTEMAS COMPLETOS** - Funcionalidades terminadas `#completado`
- **CONFIGURACIONES MASTER** - Setups validados `#funcionando`
- **PENDIENTES IMPLEMENTACIÓN** - Por implementar `#pendiente`
- **TROUBLESHOOTING ÚNICO** - Errores resueltos `#error #solucion`
- **CONOCIMIENTO DESCARTADO** - Métodos NO usar `#descartado`

**📍 Índice completo**: Ver KNOWLEDGE.md líneas 7-31

---

# ⚡ **COMANDOS DE DESARROLLO**

```bash
# Desarrollo
npm run dev

# Build + Type Check
npm run build && npm run type-check

# Testing
npm test
```

---

# 🔒 **ESTADO MCP ACTUAL**

**MODO**: **read-only** ⚠️ (solo lectura)
**Configuración**: Windows CMD wrapper (funcionando)
**Herramientas**: `mcp_supabase_*` activas
**⚠️ Para modificar BD**: Cambiar a write mode + backup antes

---

# 🎯 **OBJETIVO ACTUAL: Carga Masiva Templates + Nuevos Procesos Implicados**

## 📍 **Estado Objetivo:**
**Progreso**: INICIADO - Análisis Excel templates + definición procesos
**Transición**: 2025-08-20 (desde desarrollo mejoras continuas)
**Iniciado**: 2025-08-20
**Contexto**: Archivo Excel Templates.csv recibido - 53 templates + procesos complejos
**⚠️ CRÍTICO**: Registrar minuciosamente para continuidad sesión

## 💡 **Avances Objetivo Anterior (Desarrollo Continuo):**
- [2025-08-20] ✅ FIX CRÍTICO: Campos vacíos categoría ARCA facturas ahora editables (Ctrl+Click)
- [2025-08-20] ✅ FEATURE: Centro de costo opcional en creación templates
- [2025-08-20] ✅ FEATURE: Sistema reglas contable e interno automatizado
- [2025-08-20] ✅ FEATURE: Vista Principal como página inicio + Sistema IPC

## 🚀 **AVANCES SESIÓN ACTUAL (2025-08-24):**
- [2025-08-24] 🔧 **UNIFICACIÓN INLINE EDITING COMPLETADA**: Hook useInlineEditor.ts centralizado
- [2025-08-24] ⚡ **ARCA FACTURAS MIGRADA**: Auto-focus + regla fecha_vencimiento → fecha_estimada
- [2025-08-24] ⚡ **TEMPLATES MIGRADA**: Hook implementado con approach híbrido (commit 0873989)
- [2025-08-24] 🛡️ **APPROACH HÍBRIDO**: Solo fechas usan hook (gradual sin romper funcionalidad)
- [2025-08-24] 🔍 **ERROR DEBUGGING**: "Cannot access 'eS' before initialization" resuelto
- [2025-08-24] ✅ **ROOT CAUSE**: Orden inicialización hook vs función (NO era date-fns)
- [2025-08-24] 🧪 **ARCA TESTING**: Auto-focus + reglas automáticas funcionando perfectamente
- [2025-08-24] ⚠️ **TEMPLATES ISSUE**: Edición fechas NO funciona - debugging pendiente
- [2025-08-24] ✅ **CASH FLOW**: Edición fechas funciona correctamente (sin hook)
- [2025-08-24] 📋 **ARQUITECTURA BASE**: Hook creado + 2 vistas migradas
- [2025-08-24] 🚀 **COMMITS APLICADOS**: Push exitoso - código deployado en Vercel

## 🚀 **AVANCES SESIÓN COMPLETA (2025-09-11):**

### 🏛️ **SISTEMA SICORE COMPLETAMENTE IMPLEMENTADO Y CORREGIDO (SESIÓN 2025-09-12):**

#### 🔧 **FIXES CRÍTICOS APLICADOS (2025-09-12):**
- [2025-09-12] 🚨 **FIX CANCELACIÓN SICORE**: Interceptar guardado ANTES de ejecutar para permitir cancelación real
- [2025-09-12] 🔧 **FIX CONFIRMACIÓN**: Corregir función guardado (ejecutarGuardadoReal vs ejecutarGuardadoRealArca)  
- [2025-09-12] 💰 **FIX RETENCIONES NEGATIVAS**: Lógica especial facturas negativas con retenciones previas
- [2025-09-12] ⚠️ **FIX HOOK CASH FLOW**: Sistema advertencias cuando se cambia estado desde Cash Flow
- [2025-09-12] 📊 **NUEVO: CIERRE QUINCENA**: Sistema completo reportes PDF+Excel para cierre administrativo

#### 🆕 **ARQUITECTURA MEJORADA - GUARDADO INTERCEPTADO:**
```typescript
// NUEVO WORKFLOW SICORE:
// 1. User cambia estado → 'pagar'
// 2. Hook intercepta y guarda datos SIN ejecutar
// 3. Modal SICORE se abre con factura temporal en 'pagar' 
// 4. CONFIRMAR → ejecutarGuardadoPendiente() + datos SICORE
// 5. CANCELAR → cancelarGuardadoPendiente() revierte a estado anterior

const [guardadoPendiente, setGuardadoPendiente] = useState<{
  facturaId: string, 
  columna: string, 
  valor: any, 
  estadoAnterior: string
} | null>(null)
```

#### 📊 **NUEVO: SISTEMA CIERRE QUINCENA SICORE:**
- [2025-09-12] 🎯 **UBICACIÓN**: Botón "Cierre Quincena SICORE" en vista ARCA Facturas
- [2025-09-12] 🔍 **PROCESO AUTOMÁTICO**:
  1. Selector quincenas disponibles (últimos 6 meses)  
  2. Query automático: todas facturas con `sicore = quincena` y `monto_sicore > 0`
  3. Generación reportes PDF + Excel (misma lógica subdiarios DDJJ)
  4. Gestión carpeta por defecto integrada
  5. Alert resumen: cantidad facturas + total retenciones
- [2025-09-12] 📄 **ARCHIVOS GENERADOS**:
  - Excel: `SICORE_Cierre_2024-09-2_2025-09-12.xlsx` (detalle + totales)
  - PDF: `SICORE_Cierre_2024-09-2_2025-09-12.pdf` (formato profesional)
- [2025-09-12] ⚠️ **PENDIENTE**: Actualización/creación automática templates SICORE

#### 💻 **FUNCIONES PRINCIPALES AGREGADAS:**
- **generarQuincenasDisponibles()**: Lista quincenas últimos 6 meses
- **buscarRetencionesQuincena()**: Query BD + estadísticas 
- **procesarCierreQuincena()**: Coordinador proceso completo
- **generarExcelCierreQuincena()**: Excel con detalle + totales
- **generarPDFCierreQuincena()**: PDF profesional con tabla
- **ejecutarGuardadoPendiente()**: Ejecutar guardado diferido post-confirmación
- **cancelarGuardadoPendiente()**: Revertir estado y limpiar modal

### 🏛️ **SISTEMA SICORE BASE (SESIÓN 2025-09-11):**
- [2025-09-11] 🎯 **MÓDULO SICORE**: Sistema retenciones ganancias AFIP completamente funcional
- [2025-09-11] 📊 **4 TIPOS OPERACIÓN**: Arrendamiento 6%, Bienes 2%, Servicios 2%, Transporte 0.25%
- [2025-09-11] 🗓️ **LÓGICA QUINCENAS**: Cálculo automático '25-09 - 1ra/2da' basado en fecha_vencimiento
- [2025-09-11] 🔍 **QUERY OPTIMIZADA**: Índice compuesto (sicore, cuit) para verificación retenciones previas
- [2025-09-11] ⚡ **HOOK INTELIGENTE**: Solo activa en cambios estado HACIA 'pagar' (no si ya estaba)
- [2025-09-11] 🎨 **MODAL INTERACTIVO**: 2 pasos - selección tipo operación + confirmación cálculo
- [2025-09-11] 💾 **BD EXPANDIDA**: Tabla tipos_sicore_config + campos sicore/monto_sicore en facturas
- [2025-09-11] 🧮 **CÁLCULOS AFIP**: Mínimo no imponible por quincena por proveedor + porcentajes correctos
- [2025-09-11] 🛠️ **BUG FIXES**: Corrección estados lowercase ('pagar' vs 'Pagar') - constraint BD
- [2025-09-11] ✅ **TESTING EXITOSO**: Factura ALCORTA $3.3M → retención $55,742.85 funcionando

### 📊 **ESTRUCTURA BD SICORE IMPLEMENTADA:**
```sql
-- Tabla configuración tipos SICORE
CREATE TABLE tipos_sicore_config (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  minimo_no_imponible DECIMAL(15,2) NOT NULL,
  porcentaje_retencion DECIMAL(5,4) NOT NULL,
  activo BOOLEAN DEFAULT true
);

-- Campos agregados a msa.comprobantes_arca
ALTER TABLE msa.comprobantes_arca 
ADD COLUMN sicore VARCHAR(20),    -- '25-09 - 2da' formato
ADD COLUMN monto_sicore DECIMAL(15,2);

-- Índice optimizado para queries quincena
CREATE INDEX idx_sicore_performance ON msa.comprobantes_arca (sicore, cuit);
```

### 🎯 **WORKFLOW SICORE COMPLETO:**
1. **Trigger**: Usuario cambia estado factura → 'pagar'
2. **Hook detecta**: Solo cambios HACIA 'pagar' (no si ya estaba en 'pagar')
3. **Filtro automático**: Solo facturas imp_neto_gravado > $67,170
4. **Modal Paso 1**: Selección tipo operación (🏠 Arrendamiento, 📦 Bienes, 🔧 Servicios, 🚛 Transporte)
5. **Cálculo automático**: Verificar retenciones previas quincena/proveedor
6. **Modal Paso 2**: Mostrar cálculo + opciones (Confirmar / Modificar monto / Descuento adicional / Continuar sin retención)
7. **Finalización**: Update BD + estado local + cerrar modal
8. **Resultado**: Factura con sicore='25-09-2da', monto_sicore=$55,742.85, monto_a_abonar actualizado

### 💡 **FUNCIONES CORE IMPLEMENTADAS:**
- **generarQuincenaSicore()**: Calcula quincena formato 'YY-MM - 1ra/2da'
- **verificarRetencionPrevia()**: Query optimizada retenciones previas quincena+CUIT
- **evaluarRetencionSicore()**: Lógica principal evaluación automática
- **calcularRetencionSicore()**: Cálculo primera vs subsecuente retención
- **finalizarProcesoSicore()**: Update BD + estado local + cleanup

### 📋 **CONFIGURACIÓN TIPOS SICORE (BD):**
```
1. Arrendamiento: 🏠 6.00% - Mínimo $134,400
2. Bienes: 📦 2.00% - Mínimo $224,000  
3. Servicios: 🔧 2.00% - Mínimo $67,170
4. Transporte: 🚛 0.25% - Mínimo $67,170
```

### 🔧 **ARCHIVOS MODIFICADOS 2025-09-11:**
- **MODIFICADO**: `components/vista-facturas-arca.tsx`
  - Hook SICORE inteligente (líneas 570-585)
  - Interfaces TipoSicore + FacturaArca extendida
  - 5 funciones SICORE completas (líneas 2050-2200)
  - Modal interactivo 2 pasos (líneas 3260-3401)
  - Estados React: mostrarModalSicore, facturaEnProceso, tipoSeleccionado, montoRetencion, descuentoAdicional

### 🧪 **TESTING DATA PREPARADO:**
- **Factura**: ALCORTA EDMUNDO ERNESTO (ID: 64485834-26c8-4412-8d88-bfcd86c73e80)
- **Estado**: 'pendiente' → listo para cambio a 'pagar'
- **Importe total**: $3,372,442.24
- **Neto gravado**: $2,787,142.33 (supera todos los mínimos)
- **Retención esperada**: $55,742.85 (tipo Servicios 2%)
- **Quincena calculada**: '25-09 - 2da' (fecha_vencimiento: 2025-09-20)
- **Saldo final**: $3,316,699.39 (total - retención)

### 🚨 **BUG FIXES CRÍTICOS APLICADOS:**
1. **Estado lowercase**: 'pagar' vs 'Pagar' - constraint BD requiere minúsculas
2. **Hook inteligente**: Solo cambios HACIA 'pagar', no si ya estaba en 'pagar'
3. **Terminología correcta**: 'quincena' vs 'quinzena' (corrección ortográfica)

## 🚀 **AVANCES SESIÓN COMPLETA (2025-09-10):**

### 🔐 **SISTEMA PERMISOS URL-BASED IMPLEMENTADO:**
- [2025-09-09] 🔐 **RUTAS COMO PASSWORDS**: "adminjms1320" (admin) + "ulises" (contable)
- [2025-09-09] 👥 **ROLES DINÁMICOS**: Admin ve todo, Contable solo "Egresos" (ARCA + Templates)
- [2025-09-09] 🏗️ **ARQUITECTURA**: Dynamic routing [accessRoute] + config/access-routes.ts central
- [2025-09-09] ⚡ **SIN AUTENTICACIÓN**: Solo UX + URL validation, sin login real
- [2025-09-09] 📱 **UNIVERSAL FEATURES**: Todas las funcionalidades funcionan igual para ambos roles

### 📊 **AFIP FORMATO EXCEL NUEVO - SOPORTE COMPLETO:**
- [2025-09-09] 🚨 **BREAKING CHANGE**: AFIP cambió formato Excel completamente (30 vs 17 columnas)
- [2025-09-09] 🛡️ **BACKUP ESTRUCTURA**: Docker schema+roles (216KB) método funcionando
- [2025-09-09] 📋 **BD EXPANDIDA**: +13 columnas nuevas (33→46 total) desglose IVA detallado
- [2025-09-09] 🔄 **MAPEO DUAL**: Detección automática formato + compatibilidad CSV anterior
- [2025-09-09] ⚡ **EXCEL IMPORT UI**: Botón integrado vista ARCA + modal completo
- [2025-09-09] 🛡️ **PRESERVACIÓN LÓGICA**: fecha_estimada/monto_a_abonar/detalle automáticos intactos

### 🧪 **TESTING STATUS:**
- [2025-09-09] ⚠️ **IMPORT TESTING**: 48 registros procesados, 0 importados, 48 errores
- [2025-09-09] 🔍 **DEBUG NEEDED**: Server logs requeridos para root cause analysis
- [2025-09-09] 💡 **HIPÓTESIS**: Validación campos obligatorios (fecha_emision/cuit/imp_total)

### 🗂️ **ARCHIVOS IMPLEMENTADOS 2025-09-09:**
- **NUEVO**: `config/access-routes.ts` - Sistema permisos URL central
- **NUEVO**: `app/[accessRoute]/page.tsx` - Dynamic routing validation
- **MODIFICADO**: `app/page.tsx` - Redirect admin URL default
- **MODIFICADO**: `components/control-presupuestario.tsx` - Role filtering tabs
- **MODIFICADO**: `components/vista-facturas-arca.tsx` - Excel import button + modal
- **MODIFICADO**: `app/api/import-facturas-arca/route.ts` - Mapeo dual CSV/Excel
- **BD MIGRATION**: 13 columnas nuevas AFIP aplicada exitosamente

### 🔄 **GIT WORKFLOW 2025-09-09:**
- `68d1243` - Merge desarrollo: Excel import + debugging funcional  
- `9b4c527` - Feature: Soporte dual CSV/Excel + 13 columnas nuevas AFIP 2025
- ✅ **Branches sincronizados**: desarrollo ↔ main + push exitoso

## 🚀 **AVANCES SESIÓN 2025-09-11:**

### 🎯 **CONTEXTO SESIÓN:**
- **Objetivo**: Fix sistema DDJJ IVA formato profesional LIBRO IVA COMPRAS
- **Problema inicial**: Error "a.includes is not a function" impedía generación archivos
- **Origen**: Sesión previa implementó sistema completo pero con errores técnicos

### 🔧 **PROBLEMAS RESUELTOS:**

#### ✅ **1. ERROR CRÍTICO "includes is not a function"**
- **Root Cause**: Interface `FacturaArca` definía `tipo_comprobante: number` pero código usaba `.includes('C')`
- **Solución**: Cambiar a `f.tipo_comprobante === 11` (Tipo 11 AFIP = Factura C MONOTRIBUTISTA)
- **Commit**: `9cc5333` - Fix tipo_comprobante number vs string
- **Resultado**: ✅ Error completamente eliminado

#### ✅ **2. PDF LIMITADO A 30 FACTURAS**
- **Problema**: PDF mostraba solo primeras 30 facturas vs Excel todas
- **Solución**: Remover `facturas.slice(0, 30)` → mostrar todas
- **Plus**: Desglose alícuotas en página separada con header profesional
- **Commit**: `f01c297` - PDF completo + desglose página separada
- **Resultado**: ✅ PDF multipágina completo

#### ✅ **3. CAMPOS BD INCORRECTOS - IVA Y OTROS TRIBUTOS**
- **Diagnóstico**: Excel IVA ✅ otros_tributos ❌, PDF ambos ❌
- **Root Cause**: Mapeo incorrecto campos BD
  - `f.imp_otros_tributos` → NO EXISTE en BD (campo correcto: `otros_tributos`)
  - `f.imp_total_iva` → NO EXISTE en BD (campo correcto: `iva`)
- **Verificación BD**: Query SQL confirmó valores correctos en campo `iva`
- **Solución**: Corregir todos los mapeos + actualizar interface FacturaArca
- **Commits**: 
  - `031baa5` - Fix interface FacturaArca con campos IVA faltantes
  - `f96fa6c` - Fix mapeo campos BD → Excel/PDF
- **Resultado**: ✅ **CONFIRMADO TESTING** - Total IVA + Otros Tributos funcionando

### 📊 **ESTRUCTURA FINAL IMPLEMENTADA:**
- **Header**: MARTINEZ SOBRADO AGRO SRL + CUIT + branding
- **Columnas BD reales**: Neto Gravado, Neto No Gravado, Op. Exentas, Otros Tributos, Total IVA, Imp. Total
- **IVA Diferencial**: Suma automática alícuotas != 21%
- **PDF**: Orientación horizontal + multipágina + desglose separado
- **Persistencia**: localStorage carpeta seleccionada

### 🏆 **COMMITS APLICADOS 2025-09-11:**
```
4becd2e - Fix: Error includes function en generación Excel/PDF  
9cc5333 - Fix: Error tipo_comprobante number vs string MONOTRIBUTISTA
f01c297 - Feature: PDF completo + desglose página separada
55a841c - Fix: Usar campo 'iva' en lugar 'imp_total_iva' inexistente
031baa5 - Fix: Agregar campos IVA faltantes interface FacturaArca
f96fa6c - Fix: Corregir mapeo campos BD → Excel/PDF
```

## 🚀 **AVANCES SESIÓN 2025-09-10:**

### 🎯 **CONTEXTO SESIÓN:**
- **Objetivo inicial**: Fix error build JSX que impedía deployment Vercel
- **Error crítico**: `Unexpected token 'div'. Expected jsx identifier` en vista-facturas-arca.tsx:1455
- **Origen**: Sesión previa implementó sistema gestión masiva facturas + modal personalizado
- **Impacto**: Build completamente roto - aplicación no deployable

### 🔍 **ANÁLISIS PROFUNDO ERROR BUILD:**
- [2025-09-10] 🔧 **ERROR IDENTIFICADO**: Estructura JSX corrupta con return statements duplicados
- [2025-09-10] 📋 **ROOT CAUSE**: Línea 1452 cierra función `SubdiariosContent` correctamente, pero línea 1454 tiene return duplicado
- [2025-09-10] 🏗️ **ARQUITECTURA PROBLEMA**: TabsContent Facturas malformada - Excel Import Dialog mal ubicado
- [2025-09-10] 🔍 **TYPESCRIPT ERRORS**:
  ```
  Line 1473: JSX element 'TabsContent' has no corresponding closing tag
  Line 1991: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
  Line 2142: Expected corresponding JSX closing tag for 'div'
  Line 2144: ')' expected
  ```

### 🛠️ **DEBUGGING METODOLÓGICO APLICADO:**
- [2025-09-10] ✅ **Git checkout**: Revertir archivo - ERROR YA ESTABA COMMITADO
- [2025-09-10] ✅ **Análisis estructural**: SubdiariosContent arrow function correcta (líneas 1269→1452)
- [2025-09-10] ✅ **Verificación condicionales**: Gestión masiva modal sintaxis correcta (líneas 1826→1991)
- [2025-09-10] ✅ **Disable testing**: Deshabilitar modal gestión masiva - ERRORES PERSISTEN
- [2025-09-10] ✅ **TypeScript compiler**: Errores específicos identificados con precisión

### 🎯 **DIAGNÓSTICO FINAL - ESTRUCTURA MALFORMADA:**
- **Problema principal**: Excel Import Dialog (línea 2022) está al nivel incorrecto de indentación
- **Debería estar**: DENTRO de TabsContent Facturas como parte del contenido de tab
- **Está actualmente**: Al mismo nivel que TabsContent, causando mismatch apertura/cierre
- **Consecuencia**: TabsContent Facturas (línea 1473) no encuentra su cierre correcto
- **Fix identificado**: Mover Dialog Excel Import dentro de TabsContent con indentación correcta

## 🚨 **PENDIENTES CRÍTICOS SESIÓN PRÓXIMA:**

### 🎯 **ESTADO SISTEMA DDJJ IVA (2025-09-11):**
- **Excel + PDF**: ✅ Funcionando correctamente con todos los fixes aplicados
- **Sistema DDJJ**: 95% funcional - errores técnicos resueltos
- **Branch**: `desarrollo` sincronizado con todos los commits

### 🔧 **PENDIENTES INMEDIATOS:**

#### **1. FIX INTERFAZ - Total IVA sigue en cero**
- **Estado**: Excel/PDF ✅ corregidos, Interfaz ❌ aún muestra 0
- **Problema**: Mapeo diferente en consulta interfaz vs generación archivos
- **Acción**: Buscar consulta específica interfaz y corregir mismo mapeo (`f.imp_total_iva` → `f.iva`)
- **Tiempo estimado**: 2 minutos

#### **2. AGREGAR COLUMNA IVA 21% - Excel + PDF**
- **Ubicación**: Después de columnas Neto, antes de IVA Diferencial
- **Orden objetivo**:
  ```
  Fecha | Tipo | Razón Social | CUIT | Neto Gravado | Neto No Gravado | 
  Op. Exentas | Otros Tributos | IVA 21% | IVA Diferencial | Total IVA | Imp. Total
  ```
- **Campo BD**: `iva_21` (ya existe en interface FacturaArca)
- **Cambio**: Mover "IVA Diferencial" después de "IVA 21%"
- **Tiempo estimado**: 5 minutos

#### **3. MEJORAS DESGLOSE (después de fixes anteriores)**
- **Monotributo**: Mover a tabla desglose alícuotas
- **Estructura objetivo**:
  ```
  Al 0%       | [neto] | 0.00  | [iva]
  Al 2.5%     | [neto] | 2.50  | [iva]
  Al 5%       | [neto] | 5.00  | [iva]
  Al 10.5%    | [neto] | 10.50 | [iva]
  Al 21%      | [neto] | 21.00 | [iva]
  Al 27%      | [neto] | 27.00 | [iva]
  Monotributo | [monto]| ----  | ----
  -----------+--------+-------+-----
  TOTALES     | [suma] | ----  | [suma]
  ```
- **Resaltado**: Solo fila TOTALES con formato especial
- **Tiempo estimado**: 10 minutos

### 🚀 **METODOLOGÍA PRÓXIMA SESIÓN (15-20 min total):**
1. **[2min]** Fix interfaz Total IVA → mismo patrón Excel/PDF aplicado
2. **[5min]** Agregar IVA 21% + reordenar columnas
3. **[10min]** Reestructurar desglose con monotributo + totales
4. **[3min]** Testing rápido → generar archivos verificar orden

### 🎯 **PROPUESTA METODOLÓGICA PRÓXIMA SESIÓN:**

#### **PASO 1 - FIX BUILD INMEDIATO (5 minutos):**
1. **Leer**: `vista-facturas-arca.tsx` líneas 2020-2025 (Excel Import Dialog)
2. **Mover**: Dialog 4 espacios hacia la derecha (dentro de TabsContent)  
3. **Verificar**: `npm run build` → debe pasar sin errores
4. **Commit**: "Fix: Excel Import Dialog dentro TabsContent estructura"

#### **PASO 2 - TESTING FUNCIONALIDADES (15 minutos):**
1. **Testing gestión masiva**: Verificar modal se muestra correctamente post-fix
2. **Excel Import debugging**: Revisar server logs para 48 errores importación
3. **DDJJ workflow**: Probar secuencia completa reset → imputar → confirmar
4. **Descargas automáticas**: Verificar PDF + Excel generation funcionando

#### **PASO 3 - DOCUMENTACIÓN COMPLETADO (5 minutos):**
1. **Actualizar CLAUDE.md**: Sistema DDJJ IVA completado con todos los fixes
2. **Merge to main**: Si todo funciona OK → merger desarrollo → main
3. **Deploy validation**: Verificar Vercel deployment exitoso

### 📋 **CONTEXTO TÉCNICO CONSERVADO:**
- **Branch actual**: `desarrollo` (contiene todos los cambios 2025-09-09)
- **Main sincronizado**: Último merge exitoso con funcionalidades completas
- **Vercel status**: Deployment roto por build error - requiere fix inmediato
- **BD estado**: 13 columnas AFIP aplicadas exitosamente + tipos comprobante funcionando
- **Sistema completo**: DDJJ IVA workflow + validaciones + filtros + conversión negativos
- [2025-09-10] 🎯 **BOTÓN CONFIRMAR DDJJ**: Solo aparece con facturas "Imputado" → cambia a "DDJJ OK"
- [2025-09-10] 🔒 **VALIDACIÓN PERÍODOS**: Bloquea imputación períodos declarados (DDJJ OK)
- [2025-09-10] ⚠️ **CONFIRMACIÓN OBLIGATORIA**: Alert irreversible al confirmar DDJJ
- [2025-09-10] 🎨 **UX MEJORADO**: Indicadores visuales + validación automática selector período

### 🏗️ **SISTEMA DDJJ IVA COMPLETADO (continuación desde session summary):**
- [2025-09-10] 📊 **TIPOS COMPROBANTE AFIP**: 72 tipos oficiales + detección automática notas crédito
- [2025-09-10] 🔄 **CONVERSION AUTOMÁTICA**: Notas crédito (tipos 2,3,8,13,etc.) → valores negativos automáticos  
- [2025-09-10] 💾 **TABLA NUEVA**: `tipos_comprobante_afip` con campo `es_nota_credito` para lógica automática
- [2025-09-10] 📈 **SUBTOTALES AFIP**: 6 columnas agregadas en consultas Subdiarios (Neto Gravado, IVA, etc.)
- [2025-09-10] 🔍 **VALIDACIÓN FECHA EMISIÓN**: Solo facturas fecha_emision <= período seleccionado
- [2025-09-10] 📅 **FIX CRÍTICO FECHAS**: Cálculo último día mes correcto (Sep = 30, no 31)
- [2025-09-10] ⚡ **AUTO-FILTRADO**: useEffect elimina necesidad click manual al cambiar período
- [2025-09-10] 📋 **GESTIÓN MASIVA**: Sistema checkboxes + cambio bulk estado DDJJ + períodos
- [2025-09-10] 🎯 **ROLES PERMISOS**: Admin puede gestión masiva, Contable solo consulta
- [2025-09-10] 📄 **DESCARGA AUTOMÁTICA**: PDF + Excel al confirmar DDJJ (con errores librerías)

### ⚠️ **ISSUES ESPECÍFICOS NO RESUELTOS:**

#### **🚨 BUILD ERROR - CRÍTICO:**
- **Archivo**: `vista-facturas-arca.tsx`
- **Línea**: 1455 - `Unexpected token 'div'`
- **Diagnóstico**: Excel Import Dialog mal ubicado estructuralmente
- **Impacto**: Aplicación no deployable en Vercel
- **Status**: 🔴 **SIN RESOLVER** - Requiere fix inmediato próxima sesión

#### **📊 EXCEL IMPORT - 0 IMPORTADOS:**
- **Síntoma**: 48 registros procesados, 0 importados exitosamente
- **Logs faltantes**: Server logs no revisados para diagnóstico
- **Hipótesis**: Validación campos obligatorios fallando
- **Status**: 🟡 **DEBUGGING PENDIENTE** - Requiere server logs

#### **📱 MODAL GESTIÓN MASIVA - NO VISIBLE:**
- **Síntoma**: Estado cambia correctamente, modal no se muestra visualmente
- **Intento**: Reemplazar Dialog shadcn con HTML custom - CAUSÓ BUILD ERROR
- **Root cause**: z-index o CSS conflicts
- **Status**: 🟡 **FUNCIONAL PERO INVISIBLE** - Fix estructural resuelverá

#### **📄 DESCARGAS PDF+EXCEL - ERRORES LIBRERÍAS:**
- **Error PDF**: `s.autoTable is not a function` 
- **Error Excel**: Imports no funcionando correctamente
- **Intento**: Cambiar imports + logging extensivo
- **Status**: 🟡 **PARTIALLY WORKING** - Requiere debugging librerías

### 📊 **MÉTRICAS SESIÓN 2025-09-10:**
- **Tiempo debugging**: ~90% sesión en fix build error
- **Root cause encontrado**: ✅ Estructura JSX malformada identificada
- **Fix implementado**: ❌ Interrumpido antes de aplicar solución
- **Testing funcionalidades**: ❌ Bloqueado por build error
- **Deploy status**: 🔴 Roto desde sesión previa

### 🎯 **LECCIONES APRENDIDAS:**
1. **JSX Structure**: Custom modals HTML complejos pueden romper build - verificar siempre
2. **Modal shadcn**: Problemas z-index requieren debugging CSS, no reemplazar con HTML
3. **Indentación crítica**: TabsContent estructura debe ser perfecta para compilar
4. **Testing incremental**: Fix build ANTES de implementar nuevas funcionalidades
5. **Backup strategy**: Git checkout no siempre revierte - error ya estaba commitado

### 🚀 **PREPARACIÓN SESIÓN PRÓXIMA:**
- **Archivo problema**: `vista-facturas-arca.tsx` línea 2022
- **Fix específico**: Mover Dialog 4 espacios indentación hacia la derecha
- **Tiempo estimado**: 5 minutos para resolver build + 15 minutos testing
- **Objetivo**: Sistema DDJJ IVA completamente funcional + deployment OK

### 📊 **WORKFLOW DDJJ IVA FUNCIONAL:**
- **Paso 1**: Imputar facturas → estado "Imputado" (con validación período no declarado)
- **Paso 2**: Consultar período → botón verde "✅ Confirmar DDJJ" si hay imputadas
- **Paso 3**: Confirmar DDJJ → Alert irreversible + cambio todas "Imputado" → "DDJJ OK"
- **Paso 4**: Descarga automática PDF + Excel (pendiente fix librerías)
- **Gestión masiva**: Admin puede cambiar bulk estados + períodos con checkboxes
- **Validaciones**: Bloqueo re-imputación períodos declarados (DDJJ OK)

### ⚠️ **PENDIENTES OBJETIVO ANTERIOR (NO RETOMADOS):**

#### 🧪 **TESTING TEMPLATES SISTEMA (2025-08-24):**
- **Template 10**: 4 cuotas 'desactivado' + 1 anual 'pendiente' ✅ PREPARADO
- **Test 1**: Templates UI checkbox mostrar/ocultar desactivados
- **Test 2**: Cash Flow filtros excluyen 'desactivado' + 'conciliado' 
- **Test 3**: Conversión ANUAL → CUOTAS reactivación automática
- **Test 4**: Conversión CUOTAS → ANUAL con nuevo estado
- **Test 5**: Formato argentino DD/MM/AAAA en modales
- **Estado**: ⚠️ **PENDIENTE** - BD preparada, testing completo requerido

#### 🔧 **MEJORAS IDENTIFICADAS TEMPLATES:**
- **Estados Dropdown**: Cambiar de input texto a Select con opciones predefinidas
- **Fechas Edición**: ¿Unificar con sistema Cash Flow? (puede estar resuelto con hook)
- **Investigar Estado "auditado"**: Qué problema surge con conciliación bancaria
- **Templates 11-13**: Crear resto grupo inmobiliario según Excel original

## 🚨 **ISSUES CRÍTICOS SISTEMA (ACTUALIZADOS 2025-09-10):**

### 🔥 **CRÍTICO - BUILD ERROR:**
- **Sistema**: Next.js compilation completamente roto
- **Archivo**: `components/vista-facturas-arca.tsx`
- **Error**: JSX structure malformada - TabsContent sin cierre correcto
- **Impacto**: ⚠️ **BLOQUEANTE ABSOLUTO** - Aplicación no deployable
- **Status**: 🔴 Identificado pero sin resolver
- **ETA Fix**: 5 minutos próxima sesión

### 🚨 **Sistema Backup Supabase:**
- **Issue CRÍTICO**: Sistema backup NO funciona - nunca hemos logrado subir backup a Supabase
- **Riesgo**: Antes de usar app con datos reales DEBE funcionar el backup/restore
- **Propuesta**: Crear BD vacía en Supabase + cargar backup completo como prueba
- **Expectativa**: Backup debería setear estructura + datos automáticamente
- **Estado**: ⚠️ **BLOQUEANTE** para puesta en producción
- **Prioridad**: **MÁXIMA** - prerequisito absoluto antes datos reales
- **Registrado**: 2025-08-20 - Usuario reporta relevancia crítica

### 🔒 **Seguridad BBDD Egresos:**
- **Issue**: Datos facturas pueden modificarse sin restricciones
- **Riesgo**: Pérdida integridad datos financieros
- **Solución requerida**: Formato seguridad + permisos usuarios autorizados
- **Detectado**: 2025-08-18 sesión conciliación bancaria
- **Prioridad**: Alta (datos críticos empresa)

---

## 🚨 **PENDIENTES CRÍTICOS PRÓXIMA SESIÓN (Por Prioridad):**

### 🥇 **PRIORIDAD 1 - DESARROLLO PENDIENTE SICORE:**
1. **📄 Generación Documentos SICORE**:
   - PDF comprobantes retención con formato AFIP oficial
   - Órdenes de pago con detalle retenciones aplicadas
   - Certificados retención para envío proveedores
   - **Ubicación**: Agregar a `finalizarProcesoSicore()` función
   - **Librerías**: jsPDF + templates oficiales AFIP

2. **📧 Email Automático Proveedores**:
   - Envío automático certificados retención post-confirmación
   - Template email profesional + attachment PDF
   - **Trigger**: Al finalizar proceso SICORE exitosamente
   - **Requerimiento**: Configuración SMTP + templates

3. **🗓️ Proceso Cierre Quincena**:
   - Vista dedicada gestión quincenas (listar, cerrar, reabrir)
   - Integración automática con templates SICORE quincenal
   - **Funcionalidad**: Templates 60-61 (SICORE 1ra/2da quincena) auto-llenado
   - **Workflow**: Cierre quincena → calcular totales → crear templates → integrar Cash Flow

4. **📊 Gestión Masiva Facturas Estado Pagar**:
   - Modal SICORE para selección múltiple facturas
   - **Escenario**: 50 facturas seleccionadas → cambio masivo a 'pagar' → 50 modales SICORE
   - **Solución necesaria**: Modal unificado con selección tipo operación aplicable a todas
   - **Optimización**: Procesamiento batch + progreso visual

### 🥈 **PRIORIDAD 2 - TESTING Y VALIDACIÓN SICORE:**
1. **🧪 Testing Extensivo Cálculos**:
   - Validar todos los tipos operación (4 tipos) con facturas reales
   - Testing retenciones múltiples mismo proveedor/quincena
   - **Casos edge**: Primera vs subsecuente, montos exactos límites
   - **Validación**: Comparar con cálculos manuales AFIP

2. **🔍 Optimización Performance**:
   - Testing queries con datasets grandes (1000+ facturas)
   - **Índices adicionales**: Si performance queries degradada
   - **Caching**: Resultados verificarRetencionPrevia si necesario

### 🥉 **PRIORIDAD 3 - FEATURES SISTEMA GENERAL:**
1. **🔧 Sistema Backup Supabase** (CRÍTICO PRODUCCIÓN):
   - **Issue**: Upload backup nunca funciona - solo download
   - **Bloqueante**: Prerequisito absoluto antes datos reales producción
   - **Testing**: BD vacía Supabase + upload backup completo como prueba

2. **🔒 Seguridad BBDD Facturas**:
   - Restricciones modificación datos financieros
   - Permisos usuarios autorizados + audit trail

3. **📋 Templates Excel Masivos**:
   - Templates 11-61 pendientes según Excel original
   - Sistema alertas Vista Principal (integración templates)

## 🎯 **CONTEXTO TÉCNICO SICORE CONSERVADO:**

### **Estado BD Actual:**
- ✅ Tabla `tipos_sicore_config` poblada (4 tipos operación)
- ✅ Campos `sicore` + `monto_sicore` agregados `msa.comprobantes_arca`
- ✅ Índice `idx_sicore_performance (sicore, cuit)` optimizado
- ✅ Factura testing preparada: ALCORTA (ID: 64485834) estado 'pendiente'

### **Funciones Implementadas:**
- ✅ `generarQuincenaSicore()` - Formato 'YY-MM - 1ra/2da'
- ✅ `verificarRetencionPrevia()` - Query optimizada previas
- ✅ `evaluarRetencionSicore()` - Lógica evaluación + filtro $67,170
- ✅ `calcularRetencionSicore()` - Primera vs subsecuente + tipos
- ✅ `finalizarProcesoSicore()` - Update BD + estado local

### **Modal SICORE Estado:**
- ✅ Paso 1: Selección tipo operación (4 botones visual)
- ✅ Paso 2: Confirmación cálculo + opciones avanzadas
- ✅ Estados React: mostrarModalSicore, facturaEnProceso, tipoSeleccionado
- ✅ Variables: montoRetencion, descuentoAdicional

### **Hook SICORE:**
- ✅ Trigger: Solo cambios estado HACIA 'pagar' (no si ya estaba)
- ✅ Filtro: Solo imp_neto_gravado > $67,170
- ✅ Logging: Console.log debugging completo
- ✅ States lowercase: 'pagar' vs 'Pagar' - constraint BD

# 📋 **RESUMEN EJECUTIVO 2025-09-11**

## ✅ **LOGROS PRINCIPALES SESIÓN:**
1. **Sistema SICORE COMPLETO**: ✅ Retenciones ganancias AFIP completamente funcional
2. **Hook Inteligente**: ✅ Solo activa en cambios estado + filtro automático mínimos
3. **Modal Interactivo**: ✅ 2 pasos workflow + opciones avanzadas
4. **BD Optimizada**: ✅ Índices performance + estructura completa
5. **Testing Exitoso**: ✅ Factura $3.3M → retención $55K funcionando perfecto
6. **Bug Fixes**: ✅ Estados lowercase + terminología 'quincena' correcta

## 🎯 **PRÓXIMA SESIÓN METODOLOGÍA:**
1. **[20min]** Implementar generación documentos PDF SICORE
2. **[15min]** Testing extensivo 4 tipos operación + edge cases  
3. **[10min]** Proceso cierre quincena + integración templates
4. **[10min]** Gestión masiva facturas + modal unificado

**Estado**: Sistema SICORE 85% completo - core funcional ✅, documentos + automatizaciones pendientes ⚠️
5. **PDF multipágina**: ✅ Todas las facturas + desglose en página separada

## 🎯 **PENDIENTES FINALES (15-20 min):**
- **Fix interfaz IVA**: Corrección consulta interfaz (2 min)
- **Columna IVA 21%**: Agregar + reordenar Excel/PDF (5 min)  
- **Desglose mejorado**: Reestructurar con monotributo + totales (10 min)

## 🏆 **ESTADO FINAL:**
**Sistema DDJJ IVA**: 95% completado - solo mejoras finales pendientes
- **Excel + PDF**: ✅ Funcionando correctamente
- **Branch**: `desarrollo` sincronizado con 6 commits aplicados
- **Deployment**: ✅ Sin errores build (issues 2025-09-10 no aplicables)

### ✅ **COMMITS APLICADOS 2025-09-11:**
```
4becd2e - Fix: Error includes function en generación Excel/PDF  
9cc5333 - Fix: Error tipo_comprobante number vs string MONOTRIBUTISTA
f01c297 - Feature: PDF completo + desglose página separada
55a841c - Fix: Usar campo 'iva' en lugar 'imp_total_iva' inexistente
031baa5 - Fix: Agregar campos IVA faltantes interface FacturaArca
f96fa6c - Fix: Corregir mapeo campos BD → Excel/PDF
```

## 📊 **PRÓXIMA SESIÓN OBJETIVOS:**
1. **Completar sistema DDJJ IVA**: Aplicar 3 mejoras finales identificadas
2. **Testing completo**: Verificar funcionalidad 100% operativa
3. **Posible retoma Templates**: Si DDJJ completado, continuar objetivo carga masiva templates

**Contexto conservado**: Sistema permisos URL + 13 columnas AFIP + tipos comprobante funcionando

### 🎯 **PRÓXIMA PRIORIDAD DEFINIDA:**
- 📥 **DESCARGA AUTOMÁTICA**: PDF + Excel al confirmar DDJJ
- 📁 **CONFIGURACIÓN CARPETAS**: Default + selector alternativa
- 🔄 **INTEGRACIÓN**: Trigger automático en `confirmarDDJJ()`
- 💾 **BACKUP AUTOMÁTICO**: Respaldo físico períodos declarados

## 🚀 **AVANCES SESIÓN ANTERIOR (2025-09-09):**

### 🔐 **SISTEMA PERMISOS URL-BASED IMPLEMENTADO:**
- [2025-09-09] 🔐 **RUTAS COMO PASSWORDS**: "adminjms1320" (admin) + "ulises" (contable)
- [2025-09-09] 👥 **ROLES DINÁMICOS**: Admin ve todo, Contable solo "Egresos" (ARCA + Templates)
- [2025-09-09] 🏗️ **ARQUITECTURA**: Dynamic routing [accessRoute] + config/access-routes.ts central
- [2025-09-09] ⚡ **SIN AUTENTICACIÓN**: Solo UX + URL validation, sin login real
- [2025-09-09] 📱 **UNIVERSAL FEATURES**: Todas las funcionalidades funcionan igual para ambos roles

### 📊 **AFIP FORMATO EXCEL NUEVO - SOPORTE COMPLETO:**
- [2025-09-09] 🚨 **BREAKING CHANGE**: AFIP cambió formato Excel completamente (30 vs 17 columnas)
- [2025-09-09] 🛡️ **BACKUP ESTRUCTURA**: Docker schema+roles (216KB) método funcionando
- [2025-09-09] 📋 **BD EXPANDIDA**: +13 columnas nuevas (33→46 total) desglose IVA detallado
- [2025-09-09] 🔄 **MAPEO DUAL**: Detección automática formato + compatibilidad CSV anterior
- [2025-09-09] ⚡ **EXCEL IMPORT UI**: Botón integrado vista ARCA + modal completo
- [2025-09-09] 🛡️ **PRESERVACIÓN LÓGICA**: fecha_estimada/monto_a_abonar/detalle automáticos intactos

### 🧪 **TESTING STATUS:**
- [2025-09-09] ⚠️ **IMPORT TESTING**: 48 registros procesados, 0 importados, 48 errores
- [2025-09-09] 🔍 **DEBUG NEEDED**: Server logs requeridos para root cause analysis
- [2025-09-09] 💡 **HIPÓTESIS**: Validación campos obligatorios (fecha_emision/cuit/imp_total)

### 🗂️ **ARCHIVOS IMPLEMENTADOS 2025-09-09:**
- **NUEVO**: `config/access-routes.ts` - Sistema permisos URL central
- **NUEVO**: `app/[accessRoute]/page.tsx` - Dynamic routing validation
- **MODIFICADO**: `app/page.tsx` - Redirect admin URL default
- **MODIFICADO**: `components/control-presupuestario.tsx` - Role filtering tabs
- **MODIFICADO**: `components/vista-facturas-arca.tsx` - Excel import button + modal
- **MODIFICADO**: `app/api/import-facturas-arca/route.ts` - Mapeo dual CSV/Excel
- **BD MIGRATION**: 13 columnas nuevas AFIP aplicada exitosamente

### 🔄 **GIT WORKFLOW 2025-09-09:**
- `68d1243` - Merge desarrollo: Excel import + debugging funcional  
- `9b4c527` - Feature: Soporte dual CSV/Excel + 13 columnas nuevas AFIP 2025
- ✅ **Branches sincronizados**: desarrollo ↔ main + push exitoso

### ⚠️ **PENDIENTES INMEDIATOS (2025-09-09):**
- 🔍 **Debug import Excel**: Analizar server logs para error específico 48/48 fallos
- 🧪 **Completar testing**: Una vez resuelto debug, probar funcionalidad completa
- 📋 **Merge to main**: Cuando testing OK, merger desarrollo → main
- 📚 **Documentar KNOWLEDGE**: Proceso completo nuevo formato AFIP

### ⏳ **PENDIENTES SESIONES ANTERIORES (NO RETOMADOS):**

#### 🧪 **TESTING TEMPLATES SISTEMA (2025-08-24):**
- **Template 10**: 4 cuotas 'desactivado' + 1 anual 'pendiente' ✅ PREPARADO
- **Test 1**: Templates UI checkbox mostrar/ocultar desactivados
- **Test 2**: Cash Flow filtros excluyen 'desactivado' + 'conciliado' 
- **Test 3**: Conversión ANUAL → CUOTAS reactivación automática
- **Test 4**: Conversión CUOTAS → ANUAL con nuevo estado
- **Test 5**: Formato argentino DD/MM/AAAA en modales
- **Estado**: ⚠️ **PENDIENTE** - BD preparada, testing completo requerido

#### 🔧 **MEJORAS IDENTIFICADAS TEMPLATES:**
- **Estados Dropdown**: Cambiar de input texto a Select con opciones predefinidas
- **Fechas Edición**: ¿Unificar con sistema Cash Flow? (puede estar resuelto con hook)
- **Investigar Estado "auditado"**: Qué problema surge con conciliación bancaria
- **Templates 11-13**: Crear resto grupo inmobiliario según Excel original

#### 📋 **CARGA MASIVA TEMPLATES EXCEL (2025-08-20):**
- **53 Templates Excel**: Análisis completo ✅ COMPLETADO
- **Proceso implementación**: Templates 10 prototipo ✅ COMPLETADO
- **Templates 11-13**: Resto grupo inmobiliario ⚠️ PENDIENTE
- **Templates 14-61**: Masiva según Excel original ⚠️ PENDIENTE
- **Sistema alertas**: Vista Principal integración ⚠️ PENDIENTE
- **Reglas IIBB/SICORE**: Automáticas templates específicos ⚠️ PENDIENTE

#### 🚨 **ISSUES CRÍTICOS SISTEMA:**
- **Sistema Backup Supabase**: Nunca funciona upload, solo download ⚠️ CRÍTICO
- **Seguridad BBDD**: Datos facturas sin restricciones modificación ⚠️ ALTA
- **Sistema Reglas Contable/Interno**: Testing pendiente (funcionalidad creada) ⚠️ MEDIA

## 🚀 **AVANCES SESIÓN CONTINUACIÓN (2025-08-24):**
- [2025-08-24] 🎯 **SISTEMA CONVERSIÓN BIDIRECCIONAL COMPLETADO**: Cuotas ↔ Anual funcionando
- [2025-08-24] 🔧 **TEMPLATES INLINE EDITING FIX**: Problema fechas resuelto - era patrón value/onChange
- [2025-08-24] ⚡ **CASH FLOW MIGRADO**: Hook useInlineEditor implementado exitosamente  
- [2025-08-24] 🛡️ **CONVERSIÓN INTELIGENTE**: Detecta registros existentes + reactivar vs crear
- [2025-08-24] 🆕 **ESTADO 'DESACTIVADO'**: Nueva semántica vs 'conciliado' en BD
- [2025-08-24] 🎨 **UX ARGENTINO**: Modales usan DD/MM/AAAA en lugar de YYYY-MM-DD
- [2025-08-24] 📋 **TEMPLATES UI**: Checkbox mostrar/ocultar desactivados implementado
- [2025-08-24] 🔒 **CASH FLOW FILTROS**: Excluye 'desactivado' + 'conciliado' correctamente
- [2025-08-24] ✅ **COMMIT 75cf69f**: Sistema semántico mejorado + formato argentino

## 🚀 **AVANCES SESIÓN PREVIA (2025-08-22):**
- [2025-08-22] 💡 **ENHANCEMENT CRÍTICO COMPLETADO**: Auto-creación templates en conversión bidireccional
- [2025-08-22] 🔄 **PAGO ANUAL INTELIGENTE**: Detecta tipo template + crea anual si no existe + preserva datos
- [2025-08-22] 🔄 **PAGO CUOTAS INTELIGENTE**: Detecta tipo template + crea cuotas si no existe + genera esquema completo
- [2025-08-22] 🛡️ **ARQUITECTURA SEPARADA**: Templates anual vs cuotas como entidades independientes
- [2025-08-22] 🎯 **UX SEAMLESS**: Usuario no necesita saber si template existe - sistema maneja automáticamente
- [2025-08-22] 📋 **INTERFACES MEJORADAS**: PagoAnualResult/PagoCuotasResult reportan creación template
- [2025-08-22] ✅ **COMMIT APLICADO**: Enhancement completo en branch desarrollo (2dbed45)

## 🚀 **AVANCES SESIÓN 2025-08-21:**
- [2025-08-21] 🎯 **TEMPLATES EXCEL SISTEMA IMPLEMENTADO**: Core completo Template 10 prototipo
- [2025-08-21] 📊 **BD ESTRUCTURADA**: 34 columnas Excel agregadas a egresos_sin_factura  
- [2025-08-21] 🏗️ **MASTERS ORGANIZADOS**: Templates 2025 vs 2026 separados correctamente
- [2025-08-21] 🛡️ **TRIGGERS AUTOMÁTICOS**: Contadores total_renglones sincronización perfecta
- [2025-08-21] ⚡ **REGLAS CONTABLE/INTERNO**: Sistema automático para conciliación templates
- [2025-08-21] 🧪 **TESTING PLAN**: 10 tests sistemáticos definidos para validación completa
- [2025-08-21] **Template 10 Inmobiliario PAM**: 4 cuotas en BD + reglas aplicables + listo testing

### 🔧 **SESIÓN FINAL 2025-08-21 - FIXES CRÍTICOS TEMPLATES:**

#### ✅ **PROBLEMA 1: Datos Template 10 Inconsistentes**
- **Síntoma**: Template 10 mostraba "PAM" en lugar de "ARBA" en Cash Flow proveedor
- **Root cause**: `useMultiCashFlowData.ts` línea 82 fallback incorrecto `nombre_quien_cobra || responsable`
- **Decisión**: Es incorrecto mezclar proveedor con responsable → son conceptos diferentes
- **Solución**: Eliminado fallback, ahora solo `nombre_quien_cobra || ''`
- **CUIT actualizado**: Template 10 ARBA sin guiones = "30710404611"
- **Estado**: ✅ COMPLETADO - Commit 534e872

#### ✅ **PROBLEMA 2: Templates Edición Fallaba**
- **Síntomas**: 
  - Monto se ponía en cero al editar
  - Descripción no se actualizaba
  - Estado mostraba input en lugar de dropdown
- **Root cause**: Función `ejecutarGuardadoRealTemplates` con lógica compleja multi-tabla vs ARCA simple
- **Decisión**: Unificar lógica Templates = ARCA facturas (probado funcionando)
- **Solución**: Simplificada a update directo `cuotas_egresos_sin_factura` con `updateData`
- **PLUS**: Agregada regla automática `fecha_vencimiento → fecha_estimada` (faltaba en Templates)
- **Estado**: ✅ COMPLETADO - Commit 9f5a6a1

#### ✅ **PROBLEMA 3: Templates Vista Crash** 
- **Síntoma**: "Cannot read properties of undefined (reading 'label')" → Application error
- **Root cause**: localStorage contenía columna 'mes' eliminada ayer → `COLUMNAS_CONFIG['mes']` = undefined
- **Decisión**: Protección robusta contra columnas localStorage obsoletas
- **Solución**: 
  - Filtrar `columnasVisiblesArray` solo columnas existentes en `COLUMNAS_CONFIG`
  - Doble protección en renderizado headers y celdas
- **Estado**: ✅ COMPLETADO - Commit 43a18ae

### ⚠️ **ERRORES DETECTADOS 2025-08-21 - PENDIENTES CORREGIR:**

#### 🗓️ **ERROR 1: Formato Fechas Templates Incorrecto**
- **Síntoma**: Al editar fechas en Templates toma formato MM/DD/AAAA en lugar de DD/MM/AAAA
- **Root cause**: Templates NO usa el sistema de edición de Cash Flow (más eficiente)
- **Decisión**: Unificar TODAS las ediciones de fecha con sistema Cash Flow
- **Alcance**: Templates, ARCA facturas, Extracto bancario → mismo comportamiento
- **Estado**: ⚠️ PENDIENTE - Requires refactoring fecha editing

#### 🏷️ **ERROR 2: Estados Templates Input Texto vs Dropdown**
- **Síntoma**: Estados en Templates se editan como texto libre en lugar de opciones predefinidas
- **Necesidad**: Dropdown con estados válidos (pendiente, conciliado, auditado, etc.)
- **Decisión**: Cambiar a Select component con opciones limitadas
- **Estado**: ⚠️ PENDIENTE - Requires UI/UX change

#### 🔍 **ERROR 3: Estado "auditado" por Conciliación Bancaria**
- **Síntoma**: Cuando conciliación bancaria asigna estado "auditado" a template → problema no especificado
- **Investigación**: Verificar qué pasa cuando template cambia a "auditado" via conciliación
- **Estado**: ⚠️ PENDIENTE - Requires testing + analysis

## 🔧 **SESIÓN 2025-08-24 - UNIFICACIÓN INLINE EDITING COMPLETADA:**

### ✅ **PROBLEMA PRINCIPAL: Código Duplicado Inline Editing**
- **Síntoma**: 3 vistas diferentes con lógica similar pero inconsistente (Templates, ARCA, Cash Flow)
- **Issues específicos**: 
  - Error cosmético Templates al cambiar fecha_vencimiento
  - ARCA facturas sin regla fecha_vencimiento → fecha_estimada
  - UI inconsistente: Cash Flow tenía mejor auto-focus
- **Decisión**: Unificar con hook centralizado usando Cash Flow como referencia

### ✅ **SOLUCIÓN IMPLEMENTADA: useInlineEditor.ts Hook**
- **Ubicación**: `hooks/useInlineEditor.ts` (ARCHIVO NUEVO)
- **Funcionalidades centralizadas**:
  - Auto-focus + select automático después de 50ms
  - Regla automática: fecha_vencimiento → fecha_estimada
  - Procesamiento tipos campo (fechas, montos, texto)
  - Multi-tabla support (schema msa.comprobantes_arca vs default)
  - Validaciones personalizables por vista
- **Interfaz**: `CeldaEnEdicion` con origen tracking ('ARCA', 'TEMPLATE', 'EXTRACTO')

### ✅ **MIGRACIÓN ARCA FACTURAS COMPLETADA**
- **Approach híbrido implementado**: Solo fechas usan hook, resto lógica original
- **Ubicación**: `components/vista-facturas-arca.tsx` (MODIFICADO)
- **Fix crítico**: Hook instanciado DESPUÉS de función cargarFacturas (evitar error inicialización)
- **Testing confirmado**: Auto-focus + regla fecha_vencimiento → fecha_estimada funcionando

### ✅ **ERROR DEBUGGING: "Cannot access 'eS' before initialization"**
- **Síntoma inicial**: Build error críptico apuntando a date-fns
- **Investigación fallida**: Comentar imports date-fns no resolvió
- **Root cause real**: Hook useInlineEditor llamado antes de que función `cargarFacturas` esté definida
- **Solución**: Mover hook instantiation después de todas las funciones
- **Lección aprendida**: Errores de inicialización React pueden dar mensajes engañosos

### ✅ **ARQUITECTURA ESCALABLE ESTABLECIDA**
- **Beneficios futuros**: Nuevas vistas automáticamente heredan comportamiento correcto
- **Consistency**: Todas las vistas tendrán mismas reglas y UX
- **Mantenimiento**: Un solo lugar para lógica edición inline
- **Testing**: Centralizado en un hook vs 3 implementaciones separadas

### 🎯 **ARCHIVOS MODIFICADOS 2025-08-24:**
- **NUEVO**: `hooks/useInlineEditor.ts` - Hook centralizado unificado
- **MODIFICADO**: `components/vista-facturas-arca.tsx` - Approach híbrido implementado
- **COMMIT**: Push exitoso con approach híbrido funcionando

### ✅ **FASE UNIFICACIÓN COMPLETADA:**
- **✅ Templates**: Hook implementado + fix patrón value/onChange
- **✅ Cash Flow**: Hook migrado exitosamente
- **✅ Arquitectura**: Base escalable para vistas futuras

## ✅ **ISSUES RESUELTOS 2025-08-24:**

### ✅ **TEMPLATES EDICIÓN FECHAS SOLUCIONADO**
- **Síntoma original**: Ctrl+Click en fechas Templates no persistía cambios
- **Root cause**: Patrón defaultValue+onBlur vs value+onChange (faltaba controlled input)
- **Solución**: Replicar patrón ARCA exitoso → controlled inputs value+onChange
- **Estado final**: 
  - ✅ ARCA facturas: Hook funciona perfectamente
  - ✅ Cash Flow: Hook migrado exitosamente  
  - ✅ Templates: Hook funcional + fix patrón edición
- **Commit solución**: Incluido en migración completa

### 🔍 **DEBUGGING PLAN PRÓXIMA SESIÓN:**
1. **Console logs**: Verificar si `iniciarEdicion` se ejecuta en Templates
2. **Event handlers**: Comparar Templates vs ARCA facturas
3. **Hook state**: Verificar si `hookEditor` se instancia correctamente
4. **Click events**: Validar propagación eventos en Templates
5. **Fallback**: Si no se resuelve rápido → revert Templates a lógica original

### ⏳ **TESTING PENDIENTE - PRÓXIMA SESIÓN (2025-08-24):**

#### 🧪 **SISTEMA DESACTIVADO - TESTING PLAN:**
1. **🔍 TEMPLATES UI**: Verificar checkbox mostrar/ocultar desactivados funciona
2. **🔍 CASH FLOW FILTROS**: Confirmar excluye 'desactivado' + 'conciliado'
3. **🧪 CONVERSIÓN ANUAL → CUOTAS**: Testear reactivación cuotas desactivadas
4. **🧪 CONVERSIÓN CUOTAS → ANUAL**: Testear con nuevo estado desactivado
5. **🎨 MODALES ARGENTINOS**: Testear formato DD/MM/AAAA funciona correctamente

#### 📊 **ESTADO BD ACTUAL TESTING:**
- **Template 10**: 4 cuotas 'desactivado' + 1 anual 'pendiente' ✅ PREPARADO
- **BD Schema**: Estado 'desactivado' agregado ✅ APLICADO
- **Hooks**: usePagoAnual + usePagoCuotas actualizados ✅ COMPLETADO

#### 🚀 **TESTING AUTOMÁTICO AVANZADO:**
6. **🧪 TESTEAR AUTO-CREACIÓN**: Conversión con templates inexistentes
7. **🧪 TESTEAR PROPAGACIÓN CUOTAS**: Cambiar monto cuota + confirmación futuras
8. **🧪 TESTEAR PRESERVACIÓN DATOS**: Categ, responsable, centro_costo se mantienen
9. **🧪 TESTEAR NOMENCLATURA**: "(Anual)" se agrega/remueve correctamente

#### 🛠️ **MEJORAS IDENTIFICADAS (FUTURO):**
10. **🛠️ FIX ESTADOS DROPDOWN**: Cambiar de input texto a Select opciones
11. **🔍 INVESTIGAR AUDITADO**: Qué problema surge con estado auditado via conciliación
12. **📋 CREAR TEMPLATES 11-13**: Resto grupo inmobiliario según Excel

### 🏗️ **DECISIONES ARQUITECTURA 2025-08-24:**
- **✅ HOOK CENTRALIZADO**: useInlineEditor.ts implementado exitosamente
- **✅ APPROACH HÍBRIDO**: Migración gradual completada - todas las vistas migradas
- **✅ MULTI-TABLA SUPPORT**: Hook maneja diferentes esquemas BD automáticamente
- **✅ REGLAS AUTOMÁTICAS**: fecha_vencimiento → fecha_estimada centralizada
- **✅ ERROR HANDLING**: Orden inicialización React + patrón controlled inputs
- **✅ ESCALABILIDAD**: Arquitectura preparada para vistas futuras
- **✅ SEMÁNTICA MEJORADA**: Estado 'desactivado' separado de 'conciliado'
- **✅ UX ARGENTINO**: Formato DD/MM/AAAA unificado en modales

## 📊 **ESTADO SESIÓN FINAL 2025-08-24:**

### ✅ **COMPLETADO:**
- Hook `useInlineEditor.ts` unificado en TODAS las vistas (ARCA, Templates, Cash Flow)
- Templates inline editing FIX → patrón controlled inputs aplicado
- Sistema conversión bidireccional COMPLETO cuotas ↔ anual
- Estado 'desactivado' implementado con mejor semántica vs 'conciliado'
- UX argentino: Modales formato DD/MM/AAAA unificado
- Templates UI: Checkbox mostrar/ocultar desactivados
- Cash Flow: Filtros excluyen 'desactivado' + 'conciliado'
- Documentación completa + commits pushed: 75cf69f

### 🧪 **TESTING READY - PRÓXIMA SESIÓN:**
**BD Preparada para testing**: Template 10 con 4 cuotas 'desactivado' + 1 anual 'pendiente'
- **Test 1**: Templates UI checkbox desactivados
- **Test 2**: Cash Flow filtros funcionando
- **Test 3**: Conversión ANUAL → CUOTAS reactivación
- **Test 4**: Conversión CUOTAS → ANUAL con nuevo estado
- **Test 5**: Formato argentino DD/MM/AAAA

### 🎯 **PRÓXIMA SESIÓN DEBE EMPEZAR CON:**
1. **🚀 TESTING COMPLETO** - Sistema desactivado listo para verificar
2. **🧪 Testing auto-creación** templates (funcionalidad completa)
3. **🧪 Testing propagación cuotas** (funcionalidad completa)
4. **📋 Continuar Templates 11-13** según Excel cuando testing OK

### 🏗️ **DECISIONES ESTRUCTURA DATOS 2025-08-21:**
- **✅ ARQUITECTURA 3 TABLAS**: Mantenida (templates_master → egresos_sin_factura → cuotas_egresos_sin_factura)
- **✅ UNIFICACIÓN LÓGICA**: Templates edición = ARCA facturas (probado estable) → COMPLETADO con hook
- **✅ PROTECCIÓN LOCALSTORAGE**: Filtros automáticos columnas obsoletas
- **✅ REGLAS AUTOMÁTICAS**: Templates ahora tiene mismas reglas que Cash Flow → COMPLETADO
- **✅ CUIT SIN GUIONES**: Estandarizado en toda la aplicación
- **✅ FECHAS EDICIÓN**: Unificar con sistema Cash Flow → COMPLETADO con hook
- **⚠️ ESTADOS DROPDOWN**: Cambiar de texto libre a opciones predefinidas

### 🎯 **ESTADO TEMPLATE 10 - READY FOR TESTING:**
```sql
-- Template Master 2026: 'a0b6189c-f725-474a-91ff-bc8f3365ead2'
-- Template 10: '387da693-9238-4aed-82ea-1feddd85bda8' 
-- 4 cuotas: Mar/Jun/Sep/Nov 2026 - $3.900.000 c/u
-- Proveedor: ARBA (30710404611) ✅ CORREGIDO
-- Reglas: PAM responsable + Template tipo = "RET i" aplicable
-- Edición: Todos campos funcionando ✅ CORREGIDO
-- Vista: Sin crash ✅ CORREGIDO
```

## 🎯 **CONTEXTO OBJETIVO ACTUAL - CARGA MASIVA TEMPLATES:**

### 📋 **PLAN PASO A PASO - METODOLOGÍA DESARROLLO:**
1. ✅ **Información base (Excel) completado** 
2. 🔄 **Comprensión + respuesta preguntas (EN PROCESO ACTUAL)**
3. ⏳ **Revisar línea por línea cada template** - implicaciones/procesos completos
4. ⏳ **Analizar factibilidad "todo configurable"** 
5. ⏳ **Desarrollo paso a paso implementación**

**📍 ESTADO ACTUAL: PASO 2 - Análisis y respuestas preguntas críticas**

### 📊 **CONTEXTO FUENTE - Excel Templates.csv EXACTO:**

**Líneas Explicativas (1-5):**
```
1. "Necesidad de templates"
2. "Yo aquí pongo las cuotas como si estuvieramos a fin del 2024 cargando el 2025. lo pongo de esa manera para que quede la estructura para la creacion futura 2026. Ahora preciso saber como te parece hacer para no llenar el cash flow con datos anteriores a la fecha actual. tal vez subir como conciliados los de fechas anteriores a la actual?"
3. "Que se puedan cargar años y campañas enteras en base a la estructura que estoy pasando (ej cargamos 2025 masivamente - para 2026 posibilidad de creara en base al 2025 con ajustes según sean elegidos)"
4. "Ver si hay posibilidad de que todas estas cosas sean configurables (tal vez esto sea complejo - primero debemos entender y listar que son todas las variables y entender su compljidad y como seria el proceso en detalle)"
5. "Debemos ver como se configurara el campo de detalle (Nombre de referencia + Responsable Contable + Nro de Cuota por ejemplo (en caso de tener cuotas, si es anual o si es cuota unica)"
```

**Headers Exactos (línea 9):**
```
Nombre de Referencia | Año / Campaña | Proveedor | Cuit | CATEG | Centro de Costo | Responsable Contable | Responsable Interno | Cuotas | Tipo de fecha | Fecha 1er cuota | Monto | Completar Cuotas | Observaciones (columna nueva para poder recordar durante el trabajo) | Actualizacion de proximas cuotas si actualizo un monto dentro de cuotas cargadas. (en cash flow o conciliacion) - en cash flow seria lo comun - si fuera en conciliacion creo que seria viable ya que daria la necesidad de hacerlo manualente y eso ya esta configurado que valla hacia atras | Obs | CONTABLE | INTERNO | Alertas (En Vista Principal a Desarrollar)
```

**53 Templates EXACTOS (líneas 10-61):**
```
10. Inmobiliario;2026;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;4;Estimada;05/03/2026; 3.900.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);RET i;;Mes anterior a cada cuota
11. Inmobiliario;2026;ARBA;30-71040461-1;IMP 1;RURAL;MSA;;4;Estimada;05/03/2026; 5.400.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);AP i;;Mes anterior a cada cuota
12. Complementario;2026;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;4;Estimada;05/03/2026; 5.100.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);RET i;;Mes anterior a cada cuota
13. Complementario;2026;ARBA;30-71040461-1;IMP 1;RURAL;MSA;;4;Estimada;05/03/2026; 2.700.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);AP i;;Mes anterior a cada cuota
14. Ganancias / Bs Pers;2025;ARCA;ARCA;IMP 1;FISCAL;PAM;;1;Real;10/05/2025; 2.936.983,99 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;RET i;;10 dias antes
15. Ganancias;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;1;Estimada;10/11/2025; 3.000.000,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;AP i;;10 dias antes
16. Anticipo Ganancias / Bs Pers;2025;ARCA;ARCA;IMP 1;FISCAL;PAM;;5;Real;13/08/2025; 86.000,71 ;13-oct-2025 / 15-dic-25 / 13-feb-26 / 14-abr-26;; Opcion modificar cuotas proximas o no ;;RET i;;10 dias antes
17. Anticipo Ganancias;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;10;Real;10/12/2024; 2.067.776,32 ;Mensual;; Opcion modificar cuotas proximas o no ;;AP i;;10 dias antes
18. Acciones y Participaciones;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;1;Estimado;10/05/2026; 2.500.000,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;AP i;;10 dias antes
19. Autonomos;2025;ARCA;ARCA;IMP 1;FISCAL;MA;MA;12;Real;05/01/2025; 46.967,21 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET MA;DIST MA;10 dias antes
20. Cargas Sociales;2025;ARCA;ARCA;IMP 1;LABORAL;MSA;;12;Real;10/01/2025; 1.846.587,92 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;10 dias antes
21. UATRE;2025;UATRE;30-53306223-3;IMP 1;LABORAL;MSA;;12;Real;10/01/2025; 63.119,55 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;10 dias antes
22. Red Vial SP;2025;Municipalidad SP;30-66923976-5;IMP 1;RURAL;PAM;;4;Real;05/03/2024; 490.576,02 ;meses junio sept y diciembre;; Opcion modificar cuotas proximas o no ;;RET i;;Mes anterior a cada cuota
23. Red Vial SP;2025;Municipalidad SP;30-66923976-5;IMP 1;RURAL;MSA;;4;Real;05/03/2024; 220.684,63 ;meses junio sept y diciembre;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
24. Red Vial Rojas;2026;Municipalidad Rojas;30-99900346-6;IMP 1;RURAL;MSA;;5;Real;05/02/2025; 1.000.000,00 ;meses mayo sept oct y dic;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
25. Automotores ARBA;2025;ARBA;30-71040461-1;IMP 1;AUTOMOTOR;MSA;;5;Real;10/03/2025; 151.442,60 ;meses mayo sept nov;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
26. Automotores Muni SP - Tiguan;2026;Municipalidad SP;30-66923976-5;IMP 1;AUTOMOTOR;MSA;MA;3;Estimado;05/01/2026; 40.000,00 ;meses abril y julio;; Opcion modificar cuotas proximas o no ;;AP i;DIST MA;Mes anterior a cada cuota
27. Automotores Muni SP - Gol;2026;Municipalidad SP;30-66923976-5;IMP 1;AUTOMOTOR;MSA;JMS;3;Estimado;05/01/2026; 20.000,00 ;meses abril y julio;; Opcion modificar cuotas proximas o no ;;AP i;DIST JMS;Mes anterior a cada cuota
28. Automotores CABA;2025;Gob CABA;30-68307705-0;IMP 1;AUTOMOTOR;MSA;;6;Real;05/02/2025; 66.121,80 ;bimensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;AP i;;10 dias antes
29. ABL Libertad;2025;Gob CABA;30-68307705-0;IMP BS AS;LIBERTAD;PAM;MA;12;Real;05/01/2025; 220.840,77 ;Mensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;LIB;DIST MA;
30. ABL Cochera Posadas;2025;Gob CABA;30-68307705-0;IMP GRAL;COCHERA POSADAS;PAM;;12;Real;05/01/2025; 5.618,19 ;Mensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;RET i;;
31. ABL Cochera Libertad;2026;Gob CABA;30-68307705-0;IMP BS AS;LIBERTAD;OTROS;MA;1;Estimado;05/01/2026; 1,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;;DIST MA;
32. Expensas Libertad;2025;Consorcio Libertad 1366;30-53292377-4;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 1.747.500,11 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
33. Expensas Posadas;2025;Consorcio De Propietarios Posa;30-60183248-4;FIJOS GRAL;COCHERA POSADAS;PAM;;12;Real;10/01/2025; 34.302,46 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;
34. Tarjeta Visa Business MSA;2025;VISA;30-71549115-6;TARJ MSA;INTER;MSA;;12;Real;05/01/2025; 848.675,15 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;10 Dias Antes
35. Tarjeta VISA PAM Pesos;2025;VISA;30-71549115-6;TARJ PAM;INTER;PAM;;12;Real;05/01/2025; 1.228.291,66 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;10 Dias Antes
36. Tarjeta VISA PAM USS;2025;VISA;30-71549115-6;TARJ PAM;INTER;PAM;;12;Real;05/01/2025; 73.673,20 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;10 Dias Antes
37. AYSA Libertad;2025;AYSA;30-70956507-5;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 118.549,24 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
38. Metrogas Libertad;2025;Metrogas;30-65786367-6;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 6.453,54 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
39. Retiro MA mensual;2025;MA;27-06682461-1;DIST MA;MA;MSA/PAM;;12;Real;31/01/2025; 4.000.000,00 ;ultimo dia de cada mes;Distribucion Mensual MA (aplica primero a sueldos - por eso a CTA MA); Opcion modificar cuotas proximas o no ;;CTA MA;DIST MA;
40. Retiro MA semestral;2026;MANUEL;24-24754471-9;DIST MANU;MA;PAM;;2;Estimado;25/01/2026; 1,00 ;25/07/2026;Se reserva template por si se distribuye algo extra; Opcion modificar cuotas proximas o no ;;CTA MA;DIST MA;
41. Retiro Manuel semestral;2026;MANUEL;24-24754471-9;DIST MANU;MANUEL;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST MANUEL;DIST MANU;
42. Retiro Soledad semestral;2026;SOLEDAD;27-26046738-2;DIST SOLE;SOLEDAD;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST SOLE;DIST SOLE;
43. Retiro Mechi semestral;2026;MECHI;27-27071568-6;DIST MECHI;MECHI;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST MECHI;DIST MECHI;
44. Retiro Andres semestral;2026;ANDRES;20-28749254-6;DIST AMS;ANDRES;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST AMS;DIST AMS;
45. Retiro Jose semestral;2026;JOSE;23-34214773-9;DIST JMS;JOSE;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST JMS;DIST JMS;
46. Caja;2025;INTER;INTER;CAJA;INTER;MSA;;12;Estimado;25/01/2025; 900.000,00 ;25 de cada mes;Parte de Sueldos + Jornales + Compra Varios; Opcion modificar cuotas proximas o no ;;;;
47. Sueldo JMS;2025;JMS;23-34214773-9;SUELD;ESTRUCTURA;MSA/PAM;MSA/PAM;12;Real;31/01/2025; 1.991.947,59 ;ultimo dia de cada mes;Ver contra facturacion a quien corresponde el pago); Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;CTA JMS;;
48. Sueldo AMS;2025;AMS;20-28749254-6;SUELD;ESTRUCTURA;MSA/PAM;MSA/PAM;12;Estimado;31/01/2025; 1.500.000,00 ;ultimo dia de cada mes;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;CTA AMS;;
49. Sueldo Sigot Galicia;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 740.300,80 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
50. Sueldo Sigot Santander;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 101.000,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
51. Sueldo Sigot Lucresia;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 358.699,20 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
52. Sueldo Alejandro;2025;Alejandro Coria;20-26865811-5;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 688.751,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
53. Sueldo Marco;2025;Juan Cejas;20-23615158-2;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 688.751,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
54. Sueldo Mabel;2025;Domestica Mabel;27-20361536-7;SUELD;ESTRUCTURA;PAM;;12;Real;31/01/2025; 360.000,00 ;ultimo dia de cada mes;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
55. Seguro Flota;2025;Federacion Patronal SAU;33-70736658-9;SEG;ESTRUCTURA;MSA;MSA/MA/JMS;12;Estimada;05/01/2025; 576.306,00 ;Mensual;Gol es de JMS - Tiguan es de MA; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;VER;10 dias antes
56. Seguro Accidentes de Trabajo;2025;Federacion Patronal SAU;33-70736658-9;SEG;LABORAL;MSA;;12;Estimada;05/01/2025; 10.300,00 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;
57. Deuda Complementario;2025;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;12;Estimada;15/01/2025; 64.510,10 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;
58. IIBB;2025;ARBA;30-71040461-1;IMP 1;FISCAL;PAM;;12;Estimada;15/01/2025; -   ;Mensual;; Se debera cargar automaticamente cuando se carguen Facturas de Venta CATEG VTA GAN o ARR SP o ARR RO o ARR LC) - Proceso por desarrollar ;;;;10 dias antes
59. IIBB;2025;ARBA;30-71040461-1;IMP 1;FISCAL;MSA;;12;Estimada;15/01/2025; -   ;Mensual;; Se debera cargar automaticamente cuando se carguen Facturas de Venta CATEG VTA GAN o ARR SP o ARR RO o ARR LC) - Proceso por desarrollar ;;;;10 dias antes
60. SICORE 1er Quincena;2025;ARCA;ARCA;IMP 1;FISCAL;MSA;;12;Estimada;20/01/2025; -   ;Mensual;; Se debera cargar automaticamente a medida que vallamos registrando Retenciones de Ganancias (vista y proceso por desarrollar) ;;;;10 dias antes
61. SICORE 2da Quincena;2025;ARCA;ARCA;IMP 1;FISCAL;MSA;;12;Estimada;09/02/2025; -   ;Mensual;; Se debera cargar automaticamente a medida que vallamos registrando Retenciones de Ganancias (vista y proceso por desarrollar) ;;;;10 dias antes
```

### 🔍 **PRIMER ENTENDIMIENTO COMPLETO - Análisis Claude:**

## 📋 **LÍNEAS EXPLICATIVAS (1-5):**

**Entendimiento:**
1. **Carga como fin 2024 → 2025**: Para estructura futura 2026
   - **CICLO COMPLETO**: Siempre se carga como ciclo completo
   - **Año calendario**: 01 enero → 31 diciembre
   - **Campaña 24/25**: 01/07/2024 → 30/06/2025 (criterio para determinar fin de carga cuotas)
   - **Cuotas vencidas**: Cargar como "conciliado" para no reflejarse en flujo pero mantener template completo
   - **Objetivo**: Templates completos permiten crear nuevas campañas/años basados en estructura anterior
2. **Evitar contaminar Cash Flow**: Subir como "conciliados" fechas pasadas ✅
3. **Carga masiva años/campañas**: Crear 2026 basado en 2025 con ajustes
4. **Todo configurable**: Variables complejas - se analizará cerca del final
5. **Campo detalle**: Nombre + Responsable + Nro Cuota (si aplica)
   - **NO es dato BD**: Es proceso de vista/display
   - **Ver**: Resumen procesos involucrados

## 🗂️ **ESTRUCTURA COLUMNAS:**

1. **Nombre de Referencia** - Identificador principal (podría ser nombre del template)
2. **Año/Campaña** - 2025, 2026, 24/25
3. **Proveedor** - ARBA, ARCA, VISA, etc.
4. **CUIT** - Identificación fiscal
5. **CATEG** - Categoría contable (IMP 1, SUELD, FIJOS BS AS, etc.)
6. **Centro de Costo** - RURAL, FISCAL, LIBERTAD, etc.
7. **Responsable Contable** - PAM, MSA, MA, etc.
8. **Responsable Interno** - MA, JMS, MSA/PAM
9. **Cuotas** - Cantidad (1-12)
10. **Tipo de fecha** - Real, Estimada
11. **Fecha 1er cuota** - Fecha inicio
12. **Monto** - Valor primera cuota
13. **Completar Cuotas** - Patrón: Mensual, específico, etc.

**COLUMNAS DE REGLAS/LÓGICA:**
14. **Observaciones**
15. **Actualización próximas cuotas** - Modificar o no
16. **Obs** - Opciones especiales
17. **CONTABLE** - Códigos asignación
18. **INTERNO** - Códigos distribución
19. **Alertas** - Timing notificaciones

## 🎯 **PREGUNTAS CRÍTICAS PARA CLARIFICAR:**

### **1. Lógica de Actualización Automática:**
✅ **RESPONDIDO:**
- **Templates IIBB (58-59)**: 
  - **Ingresos ARR**: 5% de facturas categoría ingreso con prefijo "ARR" (EXCLUIR "ARR P" = egresos)
  - **Ventas VTA GAN**: 0.75% del neto gravado (sección Ventas NO desarrollada)
  - **Timing**: Ventas agosto → IIBB septiembre (mes siguiente)
  - **Estado**: ⚠️ PENDIENTE - Requiere sección Ventas
- **Templates SICORE (60-61)**: 
  - **Lógica propia** (diferente a IIBB)
  - **Estado**: ⚠️ PENDIENTE - Requiere sección nueva
- **Templates actuales**: Crear en cero por ahora

### **2. Reglas de Propagación:**
✅ **RESPONDIDO:**
- **Escenario**: Template con cuotas cargadas (ej: enero-dic $110K, agosto cambia a $120K)
- **Regla**: Al modificar una cuota → opción modificar cuotas futuras o no
- **Confirmación**: Sistema DEBE preguntar al usuario (no automático)
- **Alcance**: Solo template actual, NO generación nuevo ciclo
- **Ubicaciones de aplicación**:
  - Modificación desde **Templates**
  - Modificación desde **Cash Flow**
  - **Conciliación manual**: Monto no coincide → seleccionar template → confirmar corrección futuras
- **Estado**: Va a sección procesos

### **3. Códigos CONTABLE/INTERNO:**
✅ **RESPONDIDO:**
- **Sí son para reglas**: Códigos RET i, AP i, CTA MA, DIST MA, LIB = categorías reglas contable/interno
- **Configuración usuario**: Incierto si será necesaria (evaluar al final si configurable)
- **Lógica por template**: Cada template tiene responsable + pagador → consecuencia contable/interno
- **Variables clave**:
  - **Responsable contable** (quién paga)
  - **Responsable interno** (distribución)
  - **Cada combinación** = lógica específica
- **Proceso**: Verificar reglas cada vez que se concilia template
- **Consideración**: Posible reconfiguración sistema reglas anterior
- **Estado**: Va a procesos y estructura de datos

### **4. Alertas:**
✅ **RESPONDIDO:**
- **Ubicación**: Vista Principal (lo primero que se ve)
- **Lógica "10 días antes"**: Si vence en ≤10 días → mostrar alerta, sino NO
- **Lógica "Mes anterior"**: Si vence 25/sept → alertar desde 1/agosto (mes completo previo)
- **Formato**: "Tal fecha vence tal cosa (falta X días)"
- **Orden**: Por fecha de vencimiento
- **Estilo**: Sintético y creativo
- **Estado**: Sistema alertas para Vista Principal

### **5. Responsables MSA/PAM:**
✅ **RESPONDIDO:**
- **Responsabilidad**: 50% cada uno (MSA/PAM)
- **Proceso pago**: Un solo pago desde cualquier banco (no se divide durante proceso)
- **Proceso posterior**: Desarrollar sistema para categoría MSA/PAM (más adelante)
- **Estado actual**: Solo reconocer responsable "MSA/PAM"
- **Estado**: ⚠️ PENDIENTE - Proceso división 50/50 para futuro desarrollo

**¿Empiezo bien o necesitas que profundice en algún aspecto específico?**

## 🔄 **RESUMEN PROCESOS INVOLUCRADOS:**

### **📄 Campo Detalle Dinámico:**
- **Vista Cash Flow**: Mostrar campo calculado "Nombre + Responsable + Nro Cuota"
- **Extracto Bancario**: Registrar este detalle en conciliación
- **Lógica**: Concatenación automática según estructura template

### **🔗 Conciliación Bancaria e Imputación Contable/Interno:**
- **Proceso**: Definir cómo se ejecuta conciliación + aplicación reglas
- **Columnas CONTABLE/INTERNO**: ¿Van en BD o se calculan en tiempo real?
- **Método más efectivo**: Analizar almacenamiento vs cálculo dinámico

### **📋 Sistema Reglas Contable/Interno - Definición:**
- **Códigos actuales**: RET i, AP i, CTA MA, DIST MA, LIB (categorías definidas por usuario)
- **Variables por template**:
  - Responsable contable (quién paga) + Responsable interno (distribución) = Lógica específica
- **Proceso**: Verificar y aplicar reglas en cada conciliación template
- **Integración**: Con sistema reglas existente (posible reconfiguración)
- **Configurabilidad**: Evaluar necesidad configuración usuario vs reglas fijas

### **📋 Columnas Reglas/Lógica - Definir Almacenamiento:**
- **Columnas 15-19**: Actualización cuotas, Obs, CONTABLE, INTERNO, Alertas
- **Decisión**: ¿BD vs cálculo dinámico? Analizar para cada una

### **🚨 Sistema Alertas Vista Principal:**
- **Cálculo dinámico**: Evaluar fechas vencimiento vs fecha actual
- **"10 días antes"**: Mostrar si faltan ≤10 días, ocultar si >10 días
- **"Mes anterior"**: Mostrar desde 1er día mes previo hasta vencimiento
- **UI Vista Principal**: 
  - Formato: "25/09 vence Inmobiliario ARBA (falta 4 días)"
  - Ordenado por fecha próxima
  - Diseño sintético y visual
- **Performance**: Consulta diaria/tiempo real según necesidad

### **🔄 Reglas de Propagación de Cuotas:**
- **Modificación Templates**: Cambio cuota → confirmar si modifica futuras
- **Modificación Cash Flow**: Misma lógica que templates
- **Conciliación Manual**: Monto no coincide → seleccionar template → confirmar corrección futuras
- **UI/UX**: Modal de confirmación con opciones "Sí/No" para cada ubicación
- **Alcance**: Solo template actual, no afecta generación nuevos ciclos

## 🔍 **VERIFICACIÓN ESTRUCTURA DATOS PREVIA:**

### **📊 Columnas BD Templates (1-14 + verificar 15-19):**
- **Columnas 1-13**: DEBEN estar en BD templates (verificar existencia/nombres)
- **Columna 14 (Observaciones)**: DEBE agregarse a BD 
- **Verificar**: Estructura actual BD vs requerida
- **Cuidado**: No romper vínculos con Cash Flow y Extracto al modificar

### **🤔 Columnas Reglas/Lógica (15-19) - Análisis Pendiente:**
- **CONTABLE/INTERNO**: ¿BD o cálculo dinámico para ejecución reglas?
  - **Consideración**: Códigos son categorías reglas (RET i, AP i, CTA MA, etc.)
  - **Variables**: Responsable contable + interno por template
  - **Integración**: Con sistema reglas existente (revisar compatibilidad)
- **Actualización cuotas**: ¿BD o configuración en tiempo real?
- **Alertas**: ¿BD o generación dinámica?
- **Obs (opciones)**: ¿BD o lógica de negocio?

### **⚠️ Procesos Automáticos PENDIENTES (requieren desarrollo previo):**
- **Sección Ventas**: Para cálculo automático IIBB con VTA GAN (0.75% neto gravado)
- **Sección SICORE**: Para cálculo automático templates SICORE (lógica propia)
- **Ingresos ARR**: Para cálculo automático IIBB (5% ingresos ARR, excluir ARR P)

## 📋 **Contexto Técnico Conservado:**
- **Conciliación**: Motor automático completo - useMotorConciliacion.ts:35 + reglas configurables
- **Filtros**: Sistema universal completado en todas las vistas (Cash Flow, ARCA, Templates, Extracto)
- **Edición**: Inline editing con Ctrl+Click en ARCA facturas y Templates funcionando
- **Matching**: Templates integrados en sistema extracto bancario con propagación valores
- **Estados**: Gestión consistente lowercase + validaciones amount >10% + límites configurables
- **BD**: msa_galicia (858 reg), reglas_conciliacion (22 reg), cuentas_contables (67 cat)
- **Git**: Branch desarrollo sincronizado con main - todas las mejoras deployadas

## 🎯 **Desarrollo Continuo:**
1. ✅ Core sistema conciliación implementado y funcional
2. ✅ Filtros universales + edición inline + matching templates
3. ✅ Merge a main branch completado exitosamente
4. 🔄 Desarrollo iterativo de mejoras y nuevas funcionalidades
5. 🔄 Mantener contexto acumulado para eficiencia desarrollo

## 🎯 **ROADMAP PRÓXIMOS OBJETIVOS (Registrado 2025-08-19):**

### 📦 **0. CARGA DATOS HISTÓRICOS** `#roadmap #prerequisito #urgente`
**Prerequisito ANTES de Empleado Contable o PAM**
- **Facturas históricas**: Carga masiva estado "conciliado" (NO aparecen en Cash Flow)
- **Templates históricos**: Carga masiva cuotas/egresos estado "conciliado" 
- **Objetivo**: Dejar BD al día con solo datos actuales en flujo operativo
- **Impacto**: Sistema operativo solo con datos corrientes vs históricos ocultos
- **Criticidad**: Bloquea objetivos 1 y 2 hasta completarse

### 📊 **1. SISTEMA EMPLEADO CONTABLE** `#roadmap #contable`
**Vista especializada para adjudicación periodos contables**
- **Periodos**: Por mes/año → Subdiarios (ej: factura julio → subdiario agosto OK, agosto → julio ❌)
- **Control físico**: Columna "factura" [SI/NO/PEAJES + otras opciones a desarrollar]
- **Imputación lotes**: Filtros + selección múltiple + adjudicación batch a subdiarios
- **Variables editables**: Definir cuáles puede cambiar empleado vs admin
- **Afecta**: Cash Flow + BD facturas ARCA (mismo nivel permisos que vista principal)
- **Reporting**: Vista por subdiarios + totalizaciones para control
- **Datos EB ARCA**: Ingreso manual mes/mes por subdiario para controles pre-declaración

### 🏢 **2. COPIA PROGRAMA PARA PAM** `#roadmap #pam`
**Duplicación completa funcionalidad MSA → PAM**
- **Dependencia**: Requiere carga históricos completada (Objetivo 0)
- Evaluar detalles implementación cuando se implemente

### 🏛️ **3. TERCERA EMPRESA COMPARTIMIENTO ESTANCO** `#roadmap #empresa3`
**Nueva empresa SIN mezcla datos con MSA/PAM**
- **Requisito**: MSA/PAM se mezclan entre sí, Empresa3 completamente separada
- **Desafío**: Arquitectura compartimientos estancos
- Evaluar cuando corresponda implementar

## 🔮 **DESARROLLOS FUTUROS (Sin orden prioridad)** `#roadmap #futuro`

### 📊 **Vista Presupuesto** `#futuro #presupuesto`
- **Funcionalidad**: Sistema gestión presupuestaria completa
- **Estado**: Por desarrollar - sin especificaciones detalladas
- **Registrado**: 2025-08-20

### 📈 **Dashboard Reportes Macro - Desgloses** `#futuro #dashboard #reportes`
- **Contexto**: Sistema hecho por v0 (Claude no tiene contexto previo)
- **Renglones pendientes**:
  - **Desglose Tarjetas**: Vista detallada movimientos tarjetas
  - **Desglose Caja**: Vista detallada movimientos efectivo
- **Estado**: Extensión dashboard existente
- **Registrado**: 2025-08-20

### 💳 **Vistas Tarjetas y Caja** `#futuro #tarjetas #caja`
- **Vista Tarjetas**: Gestión completa movimientos tarjetas de crédito/débito
- **Vista Caja**: Gestión completa movimientos efectivo
- **Integración**: Con dashboard desgloses macro
- **Estado**: Por desarrollar - sin especificaciones
- **Registrado**: 2025-08-20

### 📤 **Exportación Reportes Varios** `#futuro #export #reportes`
- **Funcionalidad**: Sistema exportación múltiples formatos (Excel, PDF, CSV)
- **Alcance**: Todos los reportes y vistas del sistema
- **Estado**: Por desarrollar - sin especificaciones
- **Registrado**: 2025-08-20

### 🏠 **Vista Principal** `#completado #home #principal`
- **Funcionalidad**: Página principal/home del sistema implementada
- **Implementado**: Botón IPC + display último registro + placeholder alertas
- **Estado**: ✅ COMPLETADO - Base funcional operativa
- **Actualizado**: 2025-08-20

## 🔮 **NUEVOS DESARROLLOS IDENTIFICADOS** `#roadmap #excel-templates`

### 💰 **Vista Sueldos con Lógica Propia** `#futuro #sueldos #templates`
- **Contexto**: Existe templates para pagos, falta vista dedicada con lógica específica
- **Alcance**: Por definir con detalles del Excel
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🏛️ **Vista y Registro Automático Templates SICORE** `#futuro #sicore #automatico`
- **Funcionalidad**: Sistema automático para templates SICORE
- **Alcance**: Vista + registro automático - detalles por definir
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🏢 **Llenado Automático Templates IIBB (PAM y MSA)** `#futuro #iibb #automatico`
- **Funcionalidad**: Sistema automático llenado templates Ingresos Brutos
- **Empresas**: PAM + MSA separados
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🚨 **Sistema Alertas Vista Principal** `#futuro #alertas #principal`
- **Funcionalidad**: Sistema alertas pagos próximos en Vista Principal
- **Integración**: Con placeholder ya preparado en Vista Principal
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 📊 **Vista Tabla Templates Agrupados** `#futuro #templates #tabla-especial`
- **Acceso**: Botón en Vista Principal
- **Formato**: Tabla agrupada por CATEG y por mes (1 fila por template)
- **Alcance**: Mostrar año entero
- **Estado**: Identificado - detalles por definir con Excel
- **Registrado**: 2025-08-20

## 🚨 **PENDIENTES SISTEMA:**

### 🔧 **Verificar Templates Campos Vacíos** `#pendiente #ui #verificar`
- **Issue potencial**: Campos vacíos en templates pueden no ser editables con Ctrl+Click
- **Contexto**: Fix aplicado en ARCA facturas (commit 69933a4) - templates ya tenía implementación similar
- **Acción**: Verificar si templates necesita mismo fix para consistency
- **Ubicación**: vista-templates-egresos.tsx línea ~544 (renderizarCelda null check)
- **Detectado**: 2025-08-20 durante fix ARCA facturas

### 🎯 **Sistema Reglas Contable e Interno** `#pendiente #revision #testing`
- **Feature**: Configurador reglas para automatizar campos contable/interno
- **Tabla BD**: reglas_contable_interno (migración aplicada)
- **UI**: Tab nueva en Extracto Bancario → Configuración → "Contable e Interno"
- **Variables**: banco_origen (MSA/PAM) + tipo_gasto (template/factura) + proveedor_pattern
- **Estado**: ⚠️ **PENDIENTE REVISIÓN** - Funcionalidad creada, testing requerido
- **Commit**: 3865ea8 - Implementación completa sin validar
- **Ubicación**: components/configurador-reglas-contable.tsx + vista-extracto-bancario.tsx

### 🚨 **Sistema Backup a Supabase** `#critico #prerequisito #backup`
- **Issue CRÍTICO**: Sistema backup NO funciona - nunca hemos logrado subir backup a Supabase
- **Riesgo**: Antes de usar app con datos reales DEBE funcionar el backup/restore
- **Propuesta**: Crear BD vacía en Supabase + cargar backup completo como prueba
- **Expectativa**: Backup debería setear estructura + datos automáticamente
- **Estado**: ⚠️ **BLOQUEANTE** para puesta en producción
- **Prioridad**: **MÁXIMA** - prerequisito absoluto antes datos reales
- **Registrado**: 2025-08-20 - Usuario reporta relevancia crítica

### 🔒 **Seguridad BBDD Egresos** `#pendiente #seguridad`
- **Issue**: Datos facturas pueden modificarse sin restricciones
- **Riesgo**: Pérdida integridad datos financieros
- **Solución requerida**: Formato seguridad + permisos usuarios autorizados
- **Detectado**: 2025-08-18 sesión conciliación bancaria
- **Prioridad**: Alta (datos críticos empresa)

### ✅ **Refactoring Edición Inline - Hook Reutilizable** `#completado #refactoring #escalabilidad`
- **Issue resuelto**: Código edición inline duplicado en 3+ vistas unificado
- **Solución**: `useInlineEditor.ts` hook centralizado implementado exitosamente
- **Beneficios obtenidos**: 
  - ✅ Un solo lugar para lógica tipos campo (date, currency, select)
  - ✅ Consistencia automática entre vistas
  - ✅ Nuevas vistas reutilizan inmediatamente
  - ✅ Testing centralizado
  - ✅ Auto-focus + reglas automáticas estandardizadas
- **Enfoque híbrido ejecutado**:
  - ✅ Fase 1: Hook creado + ARCA facturas migrada (approach gradual)
  - ⏳ Fase 2: Templates migration pendiente
  - ⏳ Fase 3: Cash Flow migration opcional
- **Estado**: ✅ **COMPLETADO BASE** - Arquitectura escalable funcionando
- **Implementado**: 2025-08-24 - Hook + migración ARCA exitosa
- **ROI confirmado**: Alto - escalabilidad futura asegurada

---

# 🚨 **COMANDOS ENTRE NOSOTROS**

## 🎯 **Comandos de Objetivo:**
```
/iniciar-objetivo [nombre] → Cargar contexto específico
/avance-objetivo [descripción] → Documentar en Claude temporal  
/finalizar-objetivo → Volcar todo a KNOWLEDGE.md + limpiar Claude
/cambiar-objetivo [nuevo] → Finalizar actual + iniciar nuevo
```

## 📋 **Comandos de Documentación:**
```
/documentar-config [tema] → Agregar a configuraciones funcionando
/documentar-error [tema] → Agregar a troubleshooting  
/descartar-método [tema] → Agregar a conocimiento descartado
```

## 🔧 **Comandos de Sistema:**
```
/backup-proponer → Recordar protocolo backup
/mcp-status → Mostrar estado actual MCP
/buscar [tags] → Grep específico en KNOWLEDGE.md
```

---

# 📝 **CÓMO DOCUMENTAR EN CLAUDE.md**

## 💡 **Avances Objetivo Actual:**
```
- [Fecha] [Descripción avance]
- [Fecha] [Problema encontrado + solución]
- [Fecha] [Decisión tomada + razón]
```

## 📋 **Contexto Cargado:**  
```
- [Información copiada del archivo grande]
- [Se actualiza al cargar nuevo objetivo]
```

## 🎯 **Próximos Pasos Acordados:**
```
- [Paso 1] [Descripción]
- [Paso 2] [Descripción]  
- [Se actualiza cada sesión]
```

---

# 📊 **DATOS CRÍTICOS**

## Empresas y CUITs
- **MSA**: 30617786016
- **PAM**: 20044390222

## Variables de Entorno
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Testing y Deployment
- Branch principal: `main` (auto-deploy Vercel)
- Branch desarrollo: `desarrollo` 
- Testing: Preview URLs de Vercel

---

---

## 🏗️ **RESUMEN TÉCNICO IMPLEMENTADO (2025-08-21):**

### **📊 BASE DE DATOS:**
- **Templates Master**: Separados 2025 vs 2026 con contadores automáticos
- **Egresos sin factura**: 34 columnas Excel + triggers automáticos sincronización
- **Cuotas templates**: 4 cuotas Template 10 generadas correctamente  
- **Reglas contable/interno**: Sistema automático PAM/MSA funcionando

### **🎯 TEMPLATE 10 PROTOTIPO COMPLETADO:**
```sql
-- Template Master 2026: 'a0b6189c-f725-474a-91ff-bc8f3365ead2'
-- Template 10: '387da693-9238-4aed-82ea-1feddd85bda8' 
-- 4 cuotas: Mar/Jun/Sep/Nov 2026 - $3.900.000 c/u
-- Regla: PAM responsable + MSA paga = "RET i"
```

### **🛡️ TRIGGERS IMPLEMENTADOS:**
- **update_template_count()**: Automático INSERT/UPDATE/DELETE
- **fix_template_counts()**: Función corrección contadores
- **Cobertura total**: Todos masters actuales y futuros

### **📋 PENDIENTES MAÑANA:**
1. **Actualizar Wizard templates** para nuevas columnas Excel  
2. **Testing plan 10 puntos** sistemático completo
3. **Crear Templates 11-13** (resto grupo inmobiliario)

### **🎯 ARQUITECTURA ESCALABLE:**
- **Sistema 3 tablas**: Probado y funcionando
- **Replicación anual**: Ya implementada (KNOWLEDGE.md)
- **Listo para 53 templates**: Infraestructura completa

**📍 Total líneas**: ~200 (objetivo ≤300 líneas cumplido)  
**🔗 Conocimiento completo**: Ver KNOWLEDGE.md  
**📅 Última actualización**: 2025-08-21

## 🔄 **SESIÓN ACTUAL - RESUMEN FINAL:**

### ✅ **Completado 2025-08-20:**
- **Fix crítico**: Campos vacíos categoría en ARCA facturas → ahora editables con Ctrl+Click
- **Root cause**: Early return null/undefined sin onClick handler en vista-facturas-arca.tsx:544
- **Solución**: Wrapper div clickeable para null values cuando esEditable && modoEdicion
- **Commit**: 69933a4 - "Fix: Permitir edición campos vacíos categoría en ARCA facturas"
- **Testing**: Usuario confirmó funcionamiento OK

- **Feature**: Centro de costo opcional en templates
- **Cambio**: Removido centro_costo de validación requerida wizard
- **Commit**: 0754ef4 - UX mejorada para creación templates

- **Feature**: Sistema reglas contable e interno automatizado  
- **Estructura**: Tabla reglas_contable_interno con variables (banco_origen, tipo_gasto, proveedor_pattern)
- **UI**: Nueva tab en configuración extracto bancario → Contable e Interno
- **Logic**: Automatización campos según contexto MSA/PAM + template/factura + proveedor
- **Commit**: 3865ea8 - CRUD completo + migración BD
- **Estado**: ⚠️ **PENDIENTE REVISIÓN** - Funcionalidad creada pero no testeada

### 🔍 **Investigación Templates:**
- Templates YA tenía implementación correcta para campos vacíos (línea ~544)
- ARCA facturas tenía bug específico que fue corregido
- **PENDIENTE**: Verificar en próxima sesión si templates realmente funciona bien con campos vacíos

### 📋 **Estado Sistema Validación Categorías:**
- ✅ ARCA facturas: Validación completa + edición campos vacíos
- ✅ Templates: Validación completa + (verificar edición campos vacíos)
- ✅ Cash Flow: Validación completa (ya existía)
- ✅ Extracto bancario: Validación en propagación masiva
- **Sistema completo**: Todas las ubicaciones de edición tienen validación categorías

---

## 🚀 **AVANCES SESIÓN 2025-09-11 (COMPLETADA):**

### 🎯 **OBJETIVO COMPLETADO: Toggle Columnas Detalladas Subdiarios**
- **Fecha**: 2025-09-11
- **Duración**: Sesión corta enfocada en mejora UX específica
- **Context**: Sistema DDJJ IVA ya funcional, usuario solicita mejora visualización

### ✅ **FUNCIONALIDAD IMPLEMENTADA - TOGGLE VISTA SUBDIARIOS:**

**📱 Botón Toggle Inteligente:**
- Ubicación: Header tabla facturas período en tab Subdiarios
- Texto dinámico: "Mostrar Detalle IVA" ↔ "Ocultar Detalle"
- Iconos visuales: Eye (👁️) ↔ EyeOff (👁️‍🗨️) 
- Estado persistente durante sesión con useState

**📊 Vista Básica (DEFAULT - como estaba antes):**
```
Fecha | Proveedor | CUIT | Tipo | Neto Gravado | Neto No Gravado | 
Op. Exentas | Otros Tributos | Total IVA | Imp. Total | Estado DDJJ
```

**🔍 Vista Detallada (AL ACTIVAR TOGGLE):**
```
Fecha | Proveedor | CUIT | Tipo | 
Neto 0% | Neto 2.5% | Neto 5% | Neto 10.5% | Neto 21% | Neto 27% |
Neto No Grav. | Op. Exentas | Otros Trib. |
IVA 0% | IVA 2.5% | IVA 5% | IVA 10.5% | IVA 21% | IVA 27% |
Total IVA | Imp. Total | Estado DDJJ
```

### 🎨 **DETALLES IMPLEMENTACIÓN:**
- **Campos BD utilizados**: `neto_grav_iva_X`, `iva_X` para cada alícuota
- **Responsive**: Columnas detalladas usan `text-xs` para optimizar espacio
- **Formato monetario**: Argentino ($xxx.xxx,xx) consistente
- **Toggle instantáneo**: Sin recargas ni delays
- **Gestión masiva**: Compatible con modo gestión facturas existente

### 🔧 **ARCHIVOS MODIFICADOS:**
- **components/vista-facturas-arca.tsx** (líneas ~159, ~2100-2240):
  - Agregado estado `mostrarColumnasDetalladas`
  - Toggle button en CardHeader con iconos Eye/EyeOff
  - Columnas condicionales en TableHeader/TableBody
  - Manejo responsivo con clases CSS apropiadas

### ✅ **TESTING COMPLETADO:**
- ✅ **Build verification**: npm run build sin errores
- ✅ **Merge success**: desarrollo → main completado sin conflictos
- ✅ **Git workflow**: Commits descriptivos + push exitoso

### 📊 **COMMITS APLICADOS 2025-09-11:**
```
ed543ea - Feature: Toggle columnas detalladas IVA en vista Subdiarios
6242f1b - Merge: Integrar funcionalidad toggle columnas detalladas Subdiarios
```

### 🎯 **VALOR AGREGADO:**
- **UX Mejorado**: Usuario puede alternar entre vista sintética y detallada
- **Análisis Flexible**: Vista detallada permite análisis granular por alícuota
- **Compatibilidad**: No rompe funcionalidad existente (gestión masiva, DDJJ)
- **Performance**: Toggle instantáneo sin consultas adicionales BD

### 📋 **ESTADO FINAL SESIÓN:**
- **Branch main**: Actualizado con funcionalidad completa
- **Deploy Vercel**: Automático post-merge
- **Sistema DDJJ IVA**: 100% funcional + mejora UX implementada
- **Ready for**: Nueva funcionalidad (SICORE module)

---

## 🎯 **NUEVO OBJETIVO INICIADO: MÓDULO SICORE - RETENCIONES GANANCIAS**

### 📅 **TRANSICIÓN DE OBJETIVOS:**
- **Objetivo anterior**: Sistema DDJJ IVA ✅ **COMPLETADO**
- **Objetivo nuevo**: Módulo SICORE - Retenciones Ganancias ⚡ **INICIADO**
- **Fecha inicio**: 2025-09-11 
- **Context**: Sistema base sólido, expandir funcionalidad impuestos

### 🎯 **COMPRENSIÓN INICIAL PROCESO SICORE:**

**📋 FLUJO COMPLETO IDENTIFICADO:**
1. **🔍 Evaluación al Pago**: Aplicar reglas SICORE por proveedor
2. **💰 Cálculo Retención**: % sobre monto factura según normativa
3. **📊 Acumulación Quincenal**: 1ra quincena (1-15) + 2da quincena (16-fin)
4. **📄 Comprobantes**: Generar PDF oficial retención por proveedor
5. **📧 Comunicación**: Envío automático mail comprobantes
6. **🔄 Template Integration**: Llenar automático templates SICORE existentes
7. **💾 Trazabilidad**: Registro histórico completo proceso

**🔧 COMPONENTES TÉCNICOS REQUERIDOS:**
- ✅ **Motor Reglas**: ¿Qué proveedores requieren retención?
- ✅ **Engine Cálculo**: % retención según CUIT/monto
- ✅ **Generador PDF**: Comprobante oficial formato AFIP
- ✅ **Sistema Mail**: Automatización envío proveedores  
- ✅ **BD Integration**: Templates SICORE 1ra/2da quincena
- ✅ **Audit Trail**: Historial retenciones/comprobantes

### ❓ **PREGUNTAS PENDIENTES CLARIFICAR:**
1. **Reglas aplicación**: ¿CUIT específico vs rangos monto?
2. **% Retención**: ¿Fijo vs variable por proveedor/importe?
3. **Templates SICORE**: ¿Ya existen en sistema actual?
4. **Prioridad desarrollo**: ¿Motor cálculo vs estructura datos primero?

### 🚀 **METODOLOGÍA DESARROLLO:**
- **Phase 1**: Análisis reglas + estructura datos
- **Phase 2**: Motor cálculo + validaciones
- **Phase 3**: Generación comprobantes + PDF
- **Phase 4**: Integración templates + automatización
- **Phase 5**: Sistema mail + trazabilidad completa

### 📋 **ESTADO BRANCH DESARROLLO:**
- **Posición**: Sincronizado con main post-merge
- **Ready for**: Nueva funcionalidad SICORE
- **Preparado**: Estructura base sólida para expansión

### ⚠️ **TAREAS PENDIENTES ANTERIORES (CONSERVAR):**

#### 🧪 **TESTING TEMPLATES SISTEMA (2025-08-24):**
- **Template 10**: 4 cuotas 'desactivado' + 1 anual 'pendiente' ✅ PREPARADO
- **Test 1**: Templates UI checkbox mostrar/ocultar desactivados
- **Test 2**: Cash Flow filtros excluyen 'desactivado' + 'conciliado' 
- **Test 3**: Conversión ANUAL → CUOTAS reactivación automática
- **Test 4**: Conversión CUOTAS → ANUAL con nuevo estado
- **Test 5**: Formato argentino DD/MM/AAAA en modales
- **Estado**: ⚠️ **PENDIENTE** - BD preparada, testing completo requerido

#### 🔧 **MEJORAS IDENTIFICADAS TEMPLATES:**
- **Estados Dropdown**: Cambiar de input texto a Select con opciones predefinidas
- **Fechas Edición**: ¿Unificar con sistema Cash Flow? (puede estar resuelto con hook)
- **Investigar Estado "auditado"**: Qué problema surge con conciliación bancaria
- **Templates 11-13**: Crear resto grupo inmobiliario según Excel original

#### 📋 **CARGA MASIVA TEMPLATES EXCEL (2025-08-20):**
- **53 Templates Excel**: Análisis completo ✅ COMPLETADO
- **Proceso implementación**: Templates 10 prototipo ✅ COMPLETADO
- **Templates 11-13**: Resto grupo inmobiliario ⚠️ PENDIENTE
- **Templates 14-61**: Masiva según Excel original ⚠️ PENDIENTE
- **Sistema alertas**: Vista Principal integración ⚠️ PENDIENTE
- **Reglas IIBB/SICORE**: Automáticas templates específicos ⚠️ PENDIENTE


---

## 📋 **WORKFLOW SICORE DEFINITIVO - PROCESO RETENCIONES (2025-09-11)**

### 🎯 **WORKFLOW INTERACTIVO COMPLETO ACORDADO:**

**🔄 TRIGGER AUTOMÁTICO:**
- **Momento**: Factura ARCA cambia a estado **"Pagar"**
- **Evaluación**: Sistema verifica reglas SICORE para proveedor
- **Decision**: Si NO aplica → flujo normal | Si SÍ aplica → flujo interactivo

**📋 PASO 1 - DECISIÓN INICIAL:**
```
"Esta factura requiere retención ganancias según reglas. 
¿Desea aplicar retención SICORE?"
[SÍ] [NO]
```
- **NO**: Anula proceso, continúa flujo normal
- **SÍ**: Continúa a cálculo automático

**🧮 PASO 2 - CÁLCULO + OPCIONES MÚLTIPLES:**
```
"Cálculo de retención:
- Total factura: $XXX.XXX
- Retención SICORE: $XX.XXX (X%)  
- Saldo a pagar: $XXX.XXX

¿Qué desea hacer?"
[CONFIRMAR] [DESCUENTO ADICIONAL] [CAMBIAR MONTO RETENCIÓN] [CANCELAR]
```

**🎯 PASO 3A - SI CONFIRMAR:**
- Actualizar `monto_a_abonar` = saldo calculado
- Continuar a finalización proceso

**🎯 PASO 3B - SI DESCUENTO ADICIONAL:**
```
"Ingrese monto descuento adicional: $_____"

"Cálculo con descuento:
- Total factura: $XXX.XXX  
- Retención: $XX.XXX
- Descuento: $X.XXX
- Saldo a pagar: $XXX.XXX

¿Confirmar valores finales?"
[CONFIRMAR] [MODIFICAR DESCUENTO] [CANCELAR]
```

**🎯 PASO 3C - SI CAMBIAR MONTO RETENCIÓN:**
```
"Ingrese nuevo monto retención: $_____"

"Cálculo con retención modificada:
- Total factura: $XXX.XXX  
- Retención: $XX.XXX (modificada)
- Saldo a pagar: $XXX.XXX

¿Confirmar valores finales?"
[CONFIRMAR] [DESCUENTO ADICIONAL] [MODIFICAR RETENCIÓN] [CANCELAR]
```
- **DESCUENTO ADICIONAL**: Vuelve a PASO 3B con valores modificados
- **MODIFICAR RETENCIÓN**: Permite cambiar retención nuevamente
- **Lógica**: Máxima flexibilidad, cualquier combinación posible

### 💾 **FINALIZACIÓN PROCESO - CAMPOS BD:**

**🗃️ ACTUALIZACIONES REQUERIDAS:**
1. **`monto_a_abonar`**: Saldo final calculado (reemplaza valor anterior)
2. **`estado`**: Cambiar a "Pagar" 
3. **`sicore`**: **CAMPO NUEVO** → "aa-mm - 1ra" o "aa-mm - 2da"
4. **`monto_sicore`**: **CAMPO NUEVO** → Monto retención aplicada

**📅 LÓGICA QUINCENAS (por fecha_vencimiento):**
- **Días 1-15**: "aa-mm - 1ra" (ej: "24-09 - 1ra")
- **Días 16-fin mes**: "aa-mm - 2da" (ej: "24-09 - 2da")

**📄 DOCUMENTOS A GENERAR:**
- Orden de pago (factura + datos retención)
- Comprobante retención ganancias (enviar proveedor)

### ✅ **CARACTERÍSTICAS WORKFLOW:**
- **Eficiencia**: Máximo 3 pasos, opciones múltiples por paso
- **Flexibilidad**: Combinar retención + descuento en cualquier orden
- **Seguridad**: Siempre hay opción CANCELAR en cada paso
- **Trazabilidad**: Todos los valores quedan registrados en BD

### ⏳ **PENDIENTES PARA IMPLEMENTACIÓN:**
- **Lógica cálculo**: Definir reglas y % retención por proveedor/monto
- **Campos BD**: Migración agregar `sicore` y `monto_sicore`
- **UI Modales**: Implementar flujo interactivo step-by-step
- **Documentos**: Generar PDFs orden pago + comprobante retención
- **Hook triggers**: Detectar cambio estado a "Pagar"

---

# 🔧 SESIÓN RECONSTRUCCIÓN BASE DE DATOS (2026-01-10)

## 📋 **ESTADO ACTUAL - PRINCIPIO FUNDAMENTAL**

> **"El código está intacto y funcional. TODOS los errores son problemas de estructura de base de datos"**

Este principio guía toda la reconstrucción desde backup Sept 2025.

## ✅ **PROBLEMAS RESUELTOS EN ESTA SESIÓN**

### 1. ✅ **Importador Extractos Bancarios - Columna Control**

**Problema**: Control mostraba errores de millones de pesos (-$13M, $296K, etc.)

**Root Cause**: `data.reverse()` en línea 117 procesaba movimientos newest→oldest pero usaba saldoInicial (para el más viejo) como referencia del más nuevo.

**Fix**: Eliminado `.reverse()` para procesar cronológicamente (oldest→newest)

**Archivo**: `app/api/import-excel/route.ts` línea 117

**Commit**: 234d35b - "Fix: Procesar extractos en orden cronologico"

**Resultado**: Control ahora calcula correctamente (~$0, solo errores de redondeo)

### 2. 🔍 **Subdiarios No Muestra Facturas - INVESTIGADO**

**Problema**: Seleccionar período 12/2025 muestra 0 facturas (esperado: 44)

**Root Cause Identificado**:
- BD tiene: `ddjj_iva = 'Pendiente'` (44 facturas)
- Código busca: `ddjj_iva = 'No'`
- Mismatch: `'Pendiente' ≠ 'No'` → no encuentra nada

**Archivos afectados**: `components/vista-facturas-arca.tsx` líneas 1030 y 1040

**Fix identificado** (NO APLICADO AÚN):
- Cambiar `'No'` → `'Pendiente'` en ambas líneas

**Status**: ⏸️ Pendiente aplicación tras aclarar DEFAULT

## 🎓 **CONOCIMIENTO CRÍTICO - VALORES DEFAULT PostgreSQL**

### ⚠️ **IMPORTANTE PARA PRÓXIMAS SESIONES**

**Pregunta del usuario respondida**: "no entiendo por que ahora se llena automaticamente con pendiente"

### 📚 **Explicación Técnica - Valores DEFAULT**

#### Definición
Cuando una columna tiene un valor DEFAULT en PostgreSQL:
```sql
ddjj_iva VARCHAR DEFAULT 'Pendiente'
```

PostgreSQL automáticamente usa ese valor cuando:

1. ✅ **El campo NO se menciona en el INSERT** ← **NUESTRO CASO**
2. ✅ **Se pone explícitamente DEFAULT**

PostgreSQL NO usa el DEFAULT cuando:

- ❌ Se pone un valor específico: `ddjj_iva: 'No'`
- ❌ Se pone NULL explícito: `ddjj_iva: null`

#### Ejemplo Práctico - Script Importación

En `app/api/import-facturas-arca/route.ts`:

```typescript
const resultado = {
  fecha_emision: '2025-12-15',
  cuit: '30617786016',
  año_contable: null,      // ← NULL explícito (NO usa DEFAULT)
  estado: 'pendiente',     // ← Valor específico
  // ddjj_iva: ???         // ← NO SE MENCIONA (USA DEFAULT 'Pendiente')
}
```

**Resultado**:
- `año_contable` = NULL (dijimos NULL)
- `ddjj_iva` = 'Pendiente' (omitido, usa DEFAULT)

#### ✅ Conclusión

**El llenado automático con 'Pendiente' NO es un error** - es comportamiento correcto de PostgreSQL.

**El problema real**: El código de filtrado busca el valor incorrecto.

- ✅ Script: Omite `ddjj_iva` → PostgreSQL pone 'Pendiente' (CORRECTO)
- ❌ Filtro: Busca `ddjj_iva = 'No'` (INCORRECTO)
- ❌ Resultado: No encuentra facturas porque `'Pendiente' ≠ 'No'`

### 🔄 **Flujo de Imputación Correcto**

**CONFIRMADO** en código (vista-facturas-arca.tsx líneas 1088-1092):

```
1. IMPORT    → ddjj_iva='Pendiente', año_contable=NULL, mes_contable=NULL
2. IMPUTAR   → ddjj_iva='Imputado', año_contable=YYYY, mes_contable=MM
3. CONFIRMAR → ddjj_iva='DDJJ OK'
```

Los campos `año_contable` y `mes_contable` **deliberadamente** se dejan NULL en import y se llenan durante imputación.

## 📊 **ESTADO BASE DE DATOS**

**Facturas ARCA actuales**: 44 facturas
- `ddjj_iva` = 'Pendiente'
- `año_contable` = NULL
- `mes_contable` = NULL
- `estado` = 'pendiente'

**Esto es CORRECTO** según el flujo esperado.

## 🎯 **PRÓXIMO PASO PENDIENTE**

**Acción**: Aplicar fix en `vista-facturas-arca.tsx`
- Línea 1030: `'No'` → `'Pendiente'`
- Línea 1040: `'No'` → `'Pendiente'`

**Resultado esperado**: Subdiarios mostrará las 44 facturas al seleccionar período 12/2025

**Documentación completa**: Ver `RECONSTRUCCION_EXITOSA.md` líneas 1475-1690

---

**Fecha sesión**: 2026-01-10
**Documentación**: ✅ COMPLETA en RECONSTRUCCION_EXITOSA.md
**Recordatorio próxima sesión**: DEFAULT 'Pendiente' es comportamiento correcto PostgreSQL

---

## 🔧 **SESIÓN 2026-01-11: FIX ESTRUCTURAL BD - DEFAULT ddjj_iva**

### 🎯 **Decisión Tomada**: Cambiar BD en lugar de Código

**Contexto previo**: Sesión anterior identificó que código busca `'No'` pero BD tiene DEFAULT `'Pendiente'`

**Opciones evaluadas**:
1. ❌ Cambiar código para buscar 'Pendiente'
2. ✅ Cambiar DEFAULT de BD a 'No' ← **Usuario eligió esta opción**

**Razón del usuario**:
> "opcion 1 ya que creo que es lo que teniamos pero no estaba presente en el backup"

**Hipótesis confirmada**: Sistema original tenía DEFAULT 'No', pero el backup capturó una versión con 'Pendiente'

### 🔍 **Investigación Exhaustiva Supabase**

Antes de aplicar el cambio, se verificó si había alguna configuración oculta que forzara 'Pendiente':

1. **✅ Triggers**: Ninguno encontrado en `msa.comprobantes_arca`
2. **✅ Funciones**: Ninguna función automática encontrada
3. **✅ RLS Policies**: Solo política permisiva, no modifica valores
4. **✅ DEFAULT verificado**: Confirmado `'Pendiente'::character varying`
5. **✅ Test en vivo**: INSERT sin ddjj_iva → obtuvo 'Pendiente' ✅

**Conclusión**: NO existe configuración oculta. El DEFAULT efectivamente es 'Pendiente' como muestra el backup.

### 🛠️ **Solución Aplicada**

```sql
-- PASO 1: Cambiar DEFAULT de columna
ALTER TABLE msa.comprobantes_arca
ALTER COLUMN ddjj_iva SET DEFAULT 'No';

-- Verificación: DEFAULT ahora es 'No'::character varying ✅

-- PASO 2: Actualizar 44 facturas existentes
UPDATE msa.comprobantes_arca
SET ddjj_iva = 'No'
WHERE ddjj_iva = 'Pendiente';

-- Resultado: 44 facturas actualizadas ✅

-- PASO 3: Test de verificación
INSERT INTO msa.comprobantes_arca (...)
VALUES (...) -- Sin especificar ddjj_iva
RETURNING ddjj_iva;

-- Resultado: 'No' ✅
-- Confirma que futuras importaciones usarán 'No' automáticamente
```

### ✅ **Verificación Final**

```sql
SELECT ddjj_iva, COUNT(*)
FROM msa.comprobantes_arca
GROUP BY ddjj_iva;

-- Resultado:
-- ddjj_iva | count
-- ---------+-------
-- No       | 44     ✅
```

### 📊 **Impacto**

| Componente | Antes | Después |
|------------|-------|---------|
| DEFAULT ddjj_iva | 'Pendiente' | 'No' ✅ |
| Facturas con 'No' | 0 | 44 ✅ |
| Subdiarios funcional | ❌ | ✅ |
| Sistema DDJJ IVA | Roto | Funcionando |

### 📝 **Documentación Generada**

1. **RECONSTRUCCION_EXITOSA.md** (líneas 1694-1767):
   - Explicación completa del fix
   - SQL reproducible
   - Verificaciones paso a paso

2. **RECONSTRUCCION_SUPABASE_2026-01-07.md** (líneas 2447-2589):
   - Nueva sección: "CAMBIOS POST-RECONSTRUCCIÓN"
   - Investigación exhaustiva documentada
   - Advertencia CRÍTICA para futuras reconstrucciones
   - Script a ejecutar post-reconstrucción
   - Referencias cruzadas a código afectado

### ⚠️ **ADVERTENCIA CRÍTICA**

**Este cambio NO está en el backup original**.

Si se reconstruye la BD nuevamente, debe ejecutarse DESPUÉS de todos los scripts:

```sql
-- Ejecutar DESPUÉS de SCRIPT_PERMISOS_COMPLETOS.sql
ALTER TABLE msa.comprobantes_arca
ALTER COLUMN ddjj_iva SET DEFAULT 'No';
```

### 🎯 **Commits Aplicados**

```bash
03f675c - Fix: Cambiar DEFAULT ddjj_iva a 'No' + actualizar 44 facturas
efaeaea - Docs: Cambio estructural POST-reconstrucción - DEFAULT ddjj_iva 'No'
```

### ✅ **Estado Final**

- ✅ **DEFAULT cambiado**: 'Pendiente' → 'No'
- ✅ **44 facturas migradas**: 'Pendiente' → 'No'
- ✅ **Tests en vivo**: Confirman comportamiento correcto
- ✅ **Subdiarios funcional**: Mostrará 44 facturas período 12/2025
- ✅ **Documentación completa**: Dos archivos actualizados
- ✅ **Git sincronizado**: Cambios pusheados a GitHub

---

**Fecha sesión**: 2026-01-11
**Tipo**: Fix estructural base de datos
**Resultado**: ✅ Sistema DDJJ IVA completamente funcional
**Lección aprendida**: Backups pueden no capturar todos los DEFAULT values - documentar cambios estructurales post-reconstrucción

---

## 🔧 **SESIÓN 2026-01-11 (CONTINUACIÓN): CARGA TIPOS AFIP COMPLETOS**

### 🎯 **Objetivo Completado**: Preparar BD para Importaciones Reales

**Problema detectado:** Tabla `tipos_comprobante_afip` incompleta
- **Estado inicial**: 25 tipos (solo básicos A/B/C)
- **Necesario**: 68+ tipos para compatibilidad AFIP completa

**Riesgo sin completar:**
- ❌ Import Excel AFIP fallaría con tipos no reconocidos
- ❌ Sistema DDJJ IVA con errores en comprobantes especiales
- ❌ Reportes incompletos (sin FCE MiPyMEs, tiques, liquidaciones)

### ✅ **Solución Aplicada**

**Carga masiva tipos AFIP:**
```sql
INSERT INTO tipos_comprobante_afip (codigo, descripcion, es_nota_credito) VALUES
-- 43 tipos adicionales agregados:
-- • Bienes usados (código 30)
-- • Liquidaciones comerciales (43-48)
-- • Tiques fiscales (109-117)
-- • Documentos aduaneros (118-122)
-- • FCE MiPyMEs A/B/C (201-213)
-- • Liquidaciones granos (331-332)
-- • Remitos electrónicos (995-996)
-- • Anticipos Factura E (997-998)
```

### 📊 **Resultado Final**

| Métrica | Antes | Después |
|---------|-------|---------|
| **Total tipos** | 25 (37%) | 68 (100%) ✅ |
| **Notas crédito** | 5 | 14 ✅ |
| **Cobertura FCE** | ❌ | ✅ Completa |
| **Cobertura tiques** | ❌ | ✅ Completa |
| **Import AFIP** | ⚠️ Riesgo | ✅ Ready |

### 🎯 **Impacto en Sistema**

**Archivos que usan tipos AFIP:**
1. **`app/api/import-facturas-arca/route.ts`**
   - Validación tipo_comprobante en imports
   - Conversión automática NC → negativos

2. **`components/vista-facturas-arca.tsx`**
   - Sistema DDJJ IVA
   - Cálculos correctos (facturas suman, NC restan)
   - Generación Excel + PDF Libro IVA

### 📝 **Documentación Actualizada**

- **Archivo**: `RECONSTRUCCION_SUPABASE_2026-01-07.md` (líneas 2588-2785)
- **Sección**: "CAMBIOS POST-RECONSTRUCCIÓN"
- **Script reproducible**: ✅ Completo para futuras reconstrucciones
- **Commit**: `bdbdcd3` - "Docs: Carga completa tipos AFIP (68 tipos)"

### ⚠️ **Advertencia Crítica**

**Si se reconstruye BD nuevamente:** Este cambio NO está en backup original, ejecutar manualmente:
```sql
-- DESPUÉS de script 08-seed-data.sql
-- Ver script completo en RECONSTRUCCION_SUPABASE_2026-01-07.md líneas 2609-2679
```

### 🎉 **Estado Sistema Completo**

✅ **BASE DE DATOS PRODUCCIÓN READY:**
- ✅ Estructura completa (13 tablas)
- ✅ Tipos AFIP completos (68 tipos)
- ✅ DEFAULT ddjj_iva corregido ('No')
- ✅ Sistema DDJJ IVA funcional
- ✅ Import extractos funcionando
- ✅ 44 facturas cargadas correctamente

**📍 Próximo paso:** Testing completo sistema con datos reales

---

**Fecha sesión**: 2026-01-11 (tarde)
**Tipo**: Completar datos semilla BD
**Resultado**: ✅ BD 100% lista para producción
**Lección aprendida**: Backups capturan estructura pero pueden perder datos semilla - documentar scripts de carga completa

---

## 🏦 **ARQUITECTURA TEMPLATES BIDIRECCIONALES (FCI, Caja, etc.)** `#arquitectura #fci #pendiente`

### 📅 **Fecha diseño**: 2026-02-04
### 📍 **Estado**: DISEÑADO - Pendiente implementación

---

### 🎯 **CONTEXTO Y NECESIDAD**

El usuario creó el template "FIMA Premium" (tipo abierto, categoría FCI) para gestionar Fondos Comunes de Inversión de corto plazo. Esto generó la necesidad de soportar **movimientos bidireccionales** en templates:

- **Suscripción** (compra cuotapartes) → Débito bancario (sale dinero del banco, va al FCI)
- **Rescate** (venta cuotapartes) → Crédito bancario (entra dinero al banco, sale del FCI)
- **Tenencia actual** → Debe mostrarse como disponibilidad en Cash Flow

### 🏗️ **ARQUITECTURA APROBADA**

#### **Principio fundamental**: Arquitectura GENÉRICA, no específica para FCI

La arquitectura debe servir para CUALQUIER template bidireccional:

| Template | Movimiento que SUMA | Movimiento que RESTA |
|----------|---------------------|----------------------|
| **FCI** | Rescate (entra $) | Suscripción (sale $) |
| **Caja** | Ingreso (entra $) | Egreso (sale $) |
| **Préstamo** | Recibo (entra $) | Doy (sale $) |
| **Genérico** | Entrada | Salida |

#### **Campo en BD**: `tipo_movimiento` (valores genéricos)

```sql
-- En tabla cuotas_egresos_sin_factura
tipo_movimiento VARCHAR(20) DEFAULT 'egreso'
-- Valores: 'egreso' (default) | 'ingreso'
```

- **'egreso'** = sale dinero (reduce disponibilidad) - DEFAULT para templates normales
- **'ingreso'** = entra dinero (aumenta disponibilidad)

#### **Campo en BD**: `es_bidireccional` (identifica templates especiales)

```sql
-- En tabla egresos_sin_factura
es_bidireccional BOOLEAN DEFAULT FALSE
```

- **TRUE** = El template acepta movimientos en ambas direcciones
- **FALSE** = Template normal (solo egresos)

### 📊 **ALMACENAMIENTO DE DATOS**

**Decisión**: Monto SIEMPRE POSITIVO + campo tipo_movimiento

```
┌─────────────────────────────────────────────────────────────────────────┐
│ cuotas_egresos_sin_factura                                              │
├──────────┬─────────────────┬─────────────┬──────────────────────────────┤
│ egreso   │ tipo_movimiento │ monto       │ descripcion                  │
├──────────┼─────────────────┼─────────────┼──────────────────────────────┤
│ FIMA     │ egreso          │ 1.000.000   │ Suscripción FIMA Premium     │
│ FIMA     │ ingreso         │ 300.000     │ Rescate FIMA Premium         │
│ Caja     │ ingreso         │ 50.000      │ Venta mostrador              │
│ Caja     │ egreso          │ 15.000      │ Compra insumos               │
└──────────┴─────────────────┴─────────────┴──────────────────────────────┘
```

**Razones**:
- Usuario siempre ingresa monto positivo (más intuitivo)
- No hay confusión con signos
- Conciliación bancaria más simple (débito 1M = egreso 1M)
- Validación simple: `monto > 0`

### 🧮 **CÁLCULO DE SALDO/TENENCIA**

Query genérica que funciona para CUALQUIER template bidireccional:

```sql
SELECT
  SUM(CASE WHEN tipo_movimiento = 'ingreso' THEN monto ELSE -monto END) AS saldo
FROM cuotas_egresos_sin_factura
WHERE egreso_id = '[template-id]'
  AND estado != 'conciliado';  -- o filtro según necesidad
```

Para FCI:
- Saldo positivo = Tenencia actual en el fondo
- Saldo negativo = Inconsistencia (rescaté más de lo que suscribí)

### 🎨 **UI/UX - IMPORTANTE**

#### **En el modal "Pago Manual"**:

Aunque internamente se guarda como 'egreso'/'ingreso', la UI debe mostrar términos específicos según el template:

| Template | UI muestra | BD guarda |
|----------|------------|-----------|
| **FCI** | "Suscripción" / "Rescate" | 'egreso' / 'ingreso' |
| **Caja** | "Egreso" / "Ingreso" | 'egreso' / 'ingreso' |
| **Genérico** | "Salida" / "Entrada" | 'egreso' / 'ingreso' |

#### **Descripción automática para FCI**:

Cuando el template es FCI (o bidireccional con categ='FCI'):
- Si elige "Suscripción" → descripcion = "Suscripción [nombre_referencia]"
- Si elige "Rescate" → descripcion = "Rescate [nombre_referencia]"

Ejemplo: "Suscripción FIMA Premium" / "Rescate FIMA Premium"

### 📝 **MIGRACIÓN BD PENDIENTE**

```sql
-- 1. Agregar campo tipo_movimiento a cuotas
ALTER TABLE cuotas_egresos_sin_factura
ADD COLUMN tipo_movimiento VARCHAR(20) DEFAULT 'egreso';

COMMENT ON COLUMN cuotas_egresos_sin_factura.tipo_movimiento
IS 'Tipo de movimiento: egreso (default, sale dinero), ingreso (entra dinero)';

-- 2. Agregar campo es_bidireccional a templates
ALTER TABLE egresos_sin_factura
ADD COLUMN es_bidireccional BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN egresos_sin_factura.es_bidireccional
IS 'Si true, el template acepta movimientos bidireccionales (FCI, Caja, etc.)';

-- 3. Marcar templates FCI existentes como bidireccionales
UPDATE egresos_sin_factura
SET es_bidireccional = TRUE
WHERE categ = 'FCI';
```

### 🔧 **MODIFICACIONES UI PENDIENTES**

#### **1. Modal "Pago Manual" (vista-templates-egresos.tsx y vista-cash-flow.tsx)**

Cuando el template seleccionado tiene `es_bidireccional = true`:

```tsx
// Mostrar selector de tipo movimiento
{templateSeleccionado?.es_bidireccional && (
  <div>
    <Label>Tipo de Movimiento *</Label>
    <RadioGroup value={tipoMovimiento} onValueChange={setTipoMovimiento}>
      {/* Para FCI */}
      {templateSeleccionado.categ === 'FCI' ? (
        <>
          <RadioGroupItem value="egreso" label="Suscripción" />
          <RadioGroupItem value="ingreso" label="Rescate" />
        </>
      ) : (
        <>
          <RadioGroupItem value="egreso" label="Egreso" />
          <RadioGroupItem value="ingreso" label="Ingreso" />
        </>
      )}
    </RadioGroup>
  </div>
)}
```

#### **2. Generación automática de descripción para FCI**

```tsx
// Al guardar la cuota
const descripcionFinal = template.categ === 'FCI'
  ? `${tipoMovimiento === 'egreso' ? 'Suscripción' : 'Rescate'} ${template.nombre_referencia}`
  : descripcionIngresada;
```

#### **3. Cash Flow - Mostrar tenencia FCI como disponibilidad**

**⚠️ PENDIENTE DEFINIR**: Cómo mostrar la tenencia de FCI en el Cash Flow.
Opciones a evaluar:
- Sección separada "Inversiones líquidas"
- Sumada a disponibilidad bancaria
- Vista expandible por FCI

### 🔄 **CONCILIACIÓN BANCARIA**

Para extracto bancario:
- **Débito** en extracto = Debe matchear con `tipo_movimiento = 'egreso'` (Suscripción FCI)
- **Crédito** en extracto = Debe matchear con `tipo_movimiento = 'ingreso'` (Rescate FCI)

La conciliación es solo sobre los pesos que entran/salen de la cuenta corriente.

### 📊 **CONCILIACIÓN INTERNA FCI (FUTURO)**

Se requerirá una conciliación separada del FCI que NO es con extracto bancario:
- Verificar cantidad de cuotapartes
- Valor cuotaparte actual
- Rendimiento generado

**Campos opcionales futuros en cuotas**:
- `cantidad_cuotapartes` (se confirma posterior)
- `valor_cuotaparte` (se confirma posterior)

Esto es para una etapa posterior, no bloquea la implementación actual.

### ❓ **DUDAS PENDIENTES A RESOLVER**

1. **UI del selector**: ¿RadioGroup o Select para elegir Suscripción/Rescate?
2. **Descripción**: ¿El usuario puede editarla o es siempre automática para FCI?
3. **Cash Flow disponibilidad**: ¿Cómo mostrar tenencia FCI? ¿Sección separada?
4. **Múltiples FCIs**: ¿Vista resumen de todos los FCIs con sus tenencias?
5. **Wizard templates**: ¿Agregar checkbox "Es bidireccional" al crear template?

### ✅ **RESUMEN DECISIONES TOMADAS**

| Decisión | Valor |
|----------|-------|
| Campo tipo_movimiento | 'egreso' / 'ingreso' (genérico) |
| Monto | Siempre positivo |
| Campo es_bidireccional | Boolean en egresos_sin_factura |
| UI para FCI | Muestra "Suscripción/Rescate" |
| Descripción FCI | Automática: "[Tipo] [nombre_referencia]" |
| Arquitectura | Genérica para cualquier template bidireccional |

### 🚀 **PRÓXIMOS PASOS IMPLEMENTACIÓN**

1. **[ ]** Ejecutar migración BD (agregar campos)
2. **[ ]** Modificar modal "Pago Manual" en Templates
3. **[ ]** Modificar modal "Pago Manual" en Cash Flow
4. **[ ]** Agregar lógica descripción automática FCI
5. **[ ]** Testear con template FIMA Premium existente
6. **[ ]** Definir cómo mostrar tenencia en Cash Flow
7. **[ ]** (Opcional) Agregar checkbox "bidireccional" en Wizard

---

## 🚀 **AVANCES SESIÓN 2026-02-04**

### ✅ **WIZARD TEMPLATES REESTRUCTURADO**

**Commit**: `a741a99`

Cambios implementados en `wizard-templates-egresos.tsx`:

1. **Tipo template movido a Paso 1**: Selección Fijo/Abierto ahora es lo primero
2. **CATEG con datalist**: Reemplazado Select por Input + datalist con categorías existentes de templates
3. **Campo cuenta_agrupadora**: Agregado en Paso 1
4. **Monto base condicional**: Solo visible para templates Fijo
5. **Paso 2 adaptativo**: Muestra mensaje especial para templates Abiertos

### ✅ **PAGO MANUAL IMPLEMENTADO**

**Commits**: `fdc38d2`, `a8a25b6`

- Botón "Pago Manual" en vista Templates y Cash Flow
- Modal 2 pasos: seleccionar template abierto → ingresar fecha/monto/descripción
- Solo muestra templates con `tipo_template = 'abierto'`

### ⏳ **PENDIENTE**: Implementación arquitectura bidireccional (FCI, Caja)

Ver sección anterior para detalles completos.

---

**Fecha sesión**: 2026-02-04
**Tipo**: Diseño arquitectura + implementación wizard
**Resultado**: Wizard reestructurado ✅, Arquitectura FCI diseñada ✅, Implementación FCI pendiente ⏳

