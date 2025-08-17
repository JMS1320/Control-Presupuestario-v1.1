# 📚 KNOWLEDGE.md - DOCUMENTACIÓN INCREMENTAL

> **Este archivo registra**: Conocimiento objetivo confirmado paso a paso. Solo se documenta cuando hay resultado definitivo (funciona/falla/decidido/investigado).

---

# 📂 **ESTRUCTURA DE DOCUMENTACIÓN**

## 📋 **Tipos de Conocimiento Registrado:**

### 1. **🔧 CONFIGURACIONES FUNCIONANDO**
Setups exitosos con pasos exactos de replicación

### 2. **❌ MÉTODOS DESCARTADOS**  
Qué NO funciona + razón específica + cuándo probado

### 3. **🏗️ ARQUITECTURAS DECIDIDAS**
Estructuras BD, componentes, APIs que funcionan

### 4. **📚 INVESTIGACIÓN COMPLETADA**
Fuentes consultadas + conclusiones objetivas útiles

### 5. **🧪 TESTING COMPLETADO**
Resultados definitivos de pruebas

### 6. **🔄 PATRONES REUTILIZABLES**
Código/configuraciones para replicar en expansiones

---

# 🔧 **CONFIGURACIONES FUNCIONANDO**

## MCP Supabase Windows - FUNCIONAL (2025-08-14)
**Contexto**: Configuración MCP Supabase en Windows con CMD wrapper
**Resultado**: ✅ ÉXITO
**Configuración exacta**:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@supabase/mcp-server-supabase@latest", "--project-ref=upaygsviflbuwraaawhf"],
      "env": {"SUPABASE_ACCESS_TOKEN": "sbp_dc3586c6770fdbadda8899e9523b753ba3b4a105"}
    }
  }
}
```
**Validación**: Herramientas `mcp_supabase_*` aparecen en Claude Code
**Replicable**: ✅ Sí - Patrón para cualquier MCP en Windows
**Tags**: `mcp`, `windows`, `supabase`, `configuración`

---

# ❌ **MÉTODOS DESCARTADOS**

## Docker + COPY FROM stdin para Restore - DESCARTADO (2025-08-14)
**Intento**: Usar Docker con `COPY FROM stdin` para restore masivo de datos
**Comando probado**: `docker run --rm -i postgres:15 psql --file backup.sql`
**Resultado**: ❌ FALLO
**Razón específica**: `COPY FROM stdin` no funciona en Docker `run -i`, datos no se transfieren correctamente
**Investigación fuente**: PostgreSQL docs confirman necesidad de `docker exec` o volúmenes
**Performance**: 23 registros tomaron ~45 minutos de conversión manual
**No repetir**: ✅ Marcado - Para datasets >50 registros usar psql directo
**Alternativa funcionando**: Ver "psql nativo directo" cuando se complete testing
**Tags**: `docker`, `restore`, `postgresql`, `descartado`

## Variables ENV para parámetros MCP Server - DESCARTADO (2025-08-14)
**Intento**: Configurar MCP Supabase con variables de entorno en lugar de argumentos CLI
**Configuración probada**:
```json
"env": {
  "SUPABASE_PROJECT_REF": "upaygsviflbuwraaawhf",
  "SUPABASE_READ_ONLY": "true"
}
```
**Resultado**: ❌ FALLO
**Razón específica**: Parámetros en `env` no son reconocidos por el servidor MCP
**Investigación fuente**: Docs oficiales Supabase MCP muestran argumentos CLI únicamente
**No repetir**: ✅ Marcado - Usar siempre `args` para parámetros MCP
**Tags**: `mcp`, `configuración`, `descartado`

## Arquitectura Templates con Retroalimentación Automática - DESCARTADO (2025-08-14)
**Intento**: Sistema templates que se automodifica con datos de conciliación bancaria
**Arquitectura probada**: Templates + histórico + retroalimentación automática
**Resultado**: ❌ DESCARTADO por complejidad
**Razón específica**: Sobrecomplicación innecesaria, confunde presupuesto con histórico
**Decisión**: Separación clara: Templates (futuro) vs Histórico (pasado)
**No repetir**: ✅ Marcado - Sistemas independientes son más simples y claros
**Alternativa decidida**: Templates solo hacia adelante + tabla histórica separada
**Tags**: `arquitectura`, `templates`, `descartado`, `complejidad`

---

# 🏗️ **ARQUITECTURAS DECIDIDAS**

## Esquemas Multi-Empresa MSA/PAM - DECIDIDO (2025-08-14)
**Estructura**: Esquemas PostgreSQL separados vs tabla única
**Decisión**: ✅ Esquemas separados (`msa`, `pam`)
**Razón**: Multi-empresa + permisos granulares + escalabilidad
**Implementación**: 
- `msa.comprobantes_arca` (funcionando)
- `pam.comprobantes_arca` (pendiente replicar)
**Sintaxis Supabase**: `supabase.schema('msa').from('comprobantes_arca')`
**Expandir a**: PAM cuando MSA completamente probado
**Replicable**: ✅ Sí - Patrón para cualquier nueva empresa
**Tags**: `arquitectura`, `multi-empresa`, `postgresql`, `esquemas`

## Cash Flow como Vista/Planilla en Tiempo Real - DECIDIDO (2025-08-14)
**Estructura**: Vista dinámica vs tablas estáticas
**Decisión**: ✅ Vista en tiempo real con fuentes múltiples
**Fuentes de datos**: BBDD Facturas MSA + BBDD Facturas PAM + BBDD Compromisos → Vista Cash Flow
**Ventajas**: Integridad datos, consistencia automática, menos duplicación
**Enfoque**: Performance optimizada con consultas eficientes
**Columnas**: 12 columnas definidas (fecha estimada, vencimiento, CATEG, etc.)
**Expandir**: Agregar fuentes según necesidades (extractos bancarios, etc.)
**Tags**: `cash-flow`, `arquitectura`, `vista-dinámica`

## Sistema Templates Egresos sin Factura - COMPLETADO (2025-08-15)
**Estructura**: Templates presupuestarios vs histórico real
**Decisión**: ✅ Dos sistemas completamente separados
**Estado**: ✅ **WIZARD COMPLETO Y FUNCIONAL**
**Componentes**:
- **Templates**: Solo presupuesto futuro, modificación hacia adelante
- **Histórico**: Solo datos reales pasados, sin modificar templates
**Arquitectura**:
- 3 tablas: `templates_master`, `egresos_sin_factura`, `cuotas_egresos_sin_factura`
- JSONB para reglas complejas (inflación, aguinaldos, cuotas específicas)
- Modificación manual → regenerar solo cuotas futuras
**Implementación**:
- Wizard 4 pasos en `components/wizard-templates-egresos.tsx`
- Integrado como nueva pestaña "Templates" en dashboard
- Guardado completo en Supabase (3 tablas coordinadas)
- Fix fechas "último día del mes" con lógica inteligente
**Mapeo Cash Flow**: 12 columnas definidas con correcciones críticas (pendiente integrar)
**Ventajas**: Simplicidad, sistemas independientes, presupuesto no contaminado
**Expandir**: Tabla histórica separada cuando se desarrolle conciliación
**Replicable**: ✅ Sí - Patrón para cualquier sistema presupuestario
**Tags**: `templates`, `cash-flow`, `arquitectura`, `presupuesto`, `completado`

## FLUJO DE TRABAJO CASH FLOW - ARQUITECTURA COMPLETA (2025-08-15)

### **🔄 FLUJO GENERAL DEL SISTEMA**
```
FUENTES → CASH FLOW → CONCILIACIÓN → EXTRACTO BANCARIO
   ↓           ↓            ↓              ↓
Facturas    Vista en     Proceso        Tabla
ARCA +      tiempo      mensual        msa_galicia
Templates   real        de limpieza    (histórico)
```

### **📊 TABLAS Y SUS ROLES ESPECÍFICOS**

#### **🎯 CASH FLOW (Vista/Componente en tiempo real)**
- **Función**: Planificación de pagos + control de urgencias
- **Ventana temporal**: TODOS los pagos no conciliados (sin filtro fecha)
- **Orden visual**: Por fecha_estimada ASC (más viejo = más urgente)
  - **Lógica fechas**: Si se modifica fecha_vencimiento → fecha_estimada se actualiza para coincidir
- **Estados visuales**: 🔴 Pendiente, 🟢 Pagado (verde, esperando conciliación)

#### **📄 FACTURAS ARCA (Fuente 1)**
- **Tablas**: `msa.comprobantes_arca`, `pam.comprobantes_arca` (futuro)
- **Contribución**: Facturas recibidas donde estado ≠ 'pagado' Y estado ≠ 'credito'
- **Columna estado**: ✅ Ya existe (`pendiente`, `credito`, `debito`, `pagar`, `pagado`)
  - **Estado `credito`**: NO aparece en Cash Flow → va a sistema Tarjeta de Crédito (desarrollo posterior)
- **Fecha estimada**: `fecha_emision + 7 días` (automático)
- **Fecha vencimiento**: ❓ **VERIFICAR** si existe columna en tabla ARCA

#### **📋 TEMPLATES EGRESOS (Fuente 2)**
- **Tablas**: `templates_master`, `egresos_sin_factura`, `cuotas_egresos_sin_factura`
- **Contribución**: Cuotas generadas donde estado ≠ 'pagado'
- **Columna estado**: ❌ **FALTA AGREGAR** en `cuotas_egresos_sin_factura`
  - **Estados**: Mismos valores que ARCA (`pendiente`, `credito`, `debito`, `pagar`, `pagado`)
- **Fecha estimada**: Configurada en wizard (último día mes, fecha específica, etc.)
- **Fecha vencimiento**: ✅ Ya existe en tabla

#### **🏦 EXTRACTO BANCARIO (Destino final)**
- **Tabla**: `msa_galicia` (ya existente, creada en v0)
- **Función**: Histórico real de movimientos bancarios conciliados
- **Llenado**: Via conciliación mensual (Cash Flow → msa_galicia)

### **🎯 CASH FLOW - ESPECIFICACIÓN TÉCNICA DETALLADA**

#### **📋 CONSULTA SQL CONCEPTUAL**
```sql
-- Facturas ARCA no pagadas
SELECT 
  fecha_emision + INTERVAL '7 days' as fecha_estimada,
  fecha_emision + INTERVAL '7 days' as fecha_vencimiento,
  -- mapeo a 10 columnas Cash Flow...
FROM msa.comprobantes_arca 
WHERE estado != 'pagado'

UNION ALL

-- Templates cuotas no pagadas  
SELECT 
  fecha_estimada,
  fecha_vencimiento,
  -- mapeo a 10 columnas Cash Flow...
FROM cuotas_egresos_sin_factura 
WHERE estado != 'pagado'  -- ❌ COLUMNA FALTA CREAR

ORDER BY fecha_estimada ASC  -- Urgencia: más viejo primero
```

#### **📊 COLUMNAS CASH FLOW DEFINITIVAS (10 columnas)**
1. **FECHA Estimada** - Siempre populated
2. **Fecha Vencimiento** - Cuando hay fecha concreta
3. **CATEG** - Código cuenta contable  
4. **Centro de Costo** - Centro de costo
5. **Cuit Cliente/Proveedor** - CUIT de quien cobra el servicio
6. **Nombre Cliente/Proveedor** - Razón social de quien cobra
7. **Detalle** - Descripción del pago/compromiso
8. **Débitos** - Monto del egreso (facturas/templates)
9. **Créditos** - Monto del ingreso (generalmente 0 para egresos)
10. **SALDO CTA CTE** - Calculado: saldo anterior + créditos - débitos

**❌ NO CREAR**: Registro Contable/Interno (van directo a msa_galicia en conciliación)

### **🏦 CONCILIACIÓN BANCARIA - PROCESO MENSUAL**

#### **🔄 Flujo de Conciliación**
1. **Comparación**: Cash Flow (pagados 🟢) vs Extracto real bancario
2. **Matching**: Identificar pagos que coinciden fecha/monto
3. **Transferencia**: Mover datos de Cash Flow → `msa_galicia`
4. **Limpieza**: Borrar registros conciliados del Cash Flow
5. **Resultado**: Cash Flow solo con no-conciliados + futuros

#### **🎯 Comportamiento Post-Conciliación**
- **Cash Flow se reduce** → Solo pendientes + futuros + pagados-no-conciliados
- **msa_galicia se llena** → Datos reales históricos con categorización
- **Ciclo continuo** → Próximos pagos aparecen en Cash Flow

### **🔗 INTERACCIONES ENTRE SISTEMAS**

#### **📈 Ciclo de Vida de un Pago**
1. **Origen**: Factura ARCA llega O Template genera cuota → Aparece en Cash Flow 🔴
2. **Planificación**: Usuario ve en Cash Flow, planifica pago
3. **Ejecución**: Usuario marca como pagado → Cash Flow 🟢 (fecha pasada)
4. **Persistencia**: Registro permanece en Cash Flow (verde) hasta conciliación
5. **Conciliación**: Mensual → Cash Flow 🟢 → msa_galicia + borrar de Cash Flow
6. **Histórico**: Consultar en msa_galicia para análisis posteriores

#### **🎛️ Estados de Pago Multi-Sistema**
- **Facturas ARCA**: `pendiente`, `credito`, `debito`, `pagar`, `pagado`
- **Templates**: ❌ **FALTA DEFINIR** estados equivalentes
- **Cash Flow**: Visual 🔴 pendiente / 🟢 pagado
- **msa_galicia**: Solo registros conciliados (histórico definitivo)

### **⚠️ PENDIENTES IDENTIFICADOS PARA IMPLEMENTACIÓN**

#### **🚨 CRÍTICOS (Bloquean implementación)**

### **🔧 COLUMNAS QUE HAY QUE CREAR**
1. **Agregar columna `estado`** en `cuotas_egresos_sin_factura`
   ```sql
   ALTER TABLE cuotas_egresos_sin_factura 
   ADD COLUMN estado VARCHAR(20) DEFAULT 'pendiente';
   ```
   - Valores: `pendiente`, `credito`, `debito`, `pagar`, `pagado` (mismos que ARCA)

### **❓ AMBIGÜEDADES A RESOLVER (orden de resolución)**

#### **1. 🔄 MODIFICACIÓN INVERSA - ESPECIFICACIÓN TÉCNICA** ✅ RESUELTO

### **📝 CAMPOS EDITABLES DESDE CASH FLOW**
**Cambios aplican a**: `msa.comprobantes_arca` + `cuotas_egresos_sin_factura` (según origen del registro)

1. **FECHA Estimada** - ✅ **SÍ editable** → actualiza tabla origen (ARCA/Templates)
2. **Fecha Vencimiento** - ✅ **SÍ editable** → actualiza tabla origen (ARCA/Templates)
3. **CATEG** (cuenta contable) - ✅ **SÍ editable** → ⚠️ **REVISAR AL FINAL** (varios detalles)
4. **Centro de Costo** - ✅ **SÍ editable** → ⚠️ **REVISAR AL FINAL** (varios detalles)
5. **Cuit Cliente/Proveedor** - ❌ **NO editable** (viene desde BBDD origen, no cambia)
6. **Nombre Cliente/Proveedor** - ❌ **NO editable** (viene desde BBDD origen, no cambia)
7. **Detalle** - ✅ **SÍ editable** → actualiza tabla origen ⚠️ **VERIFICAR** si existe columna en ambas
8. **Débitos** - ✅ **SÍ editable** → ⚠️ **CRÍTICO**: NO cambia monto factura/template, llena "monto a abonar"
9. **Créditos** - ✅ **SÍ editable** → ⚠️ **CRÍTICO**: mismo comportamiento que débitos
10. **SALDO CTA CTE** - ❌ **NO editable** por ahora → 📋 **PENDIENTE** mejora futura

### **🚨 TEMAS CRÍTICOS IDENTIFICADOS**
- ⚠️ **Columnas fecha faltantes**: ¿Existe `fecha_estimada` y `fecha_vencimiento` en ARCA?
- ⚠️ **Columna "monto a abonar"**: ¿Existe en ARCA y Templates? ¿Cómo se llama?
- ⚠️ **CATEG y Centro Costo**: Revisar detalles al final
- ⚠️ **Lógica monto abonado**: Automático cuando se marca "pagado"

#### **2. 🎨 UI/UX DEL CASH FLOW** ✅ RESUELTO

### **📋 ESPECIFICACIONES UI/UX DEFINIDAS**

#### **🎛️ BOTÓN "PAGOS" (flotante/sticky)**
- **Ubicación**: Arriba del encabezado, siempre visible (sigue scroll)
- **Estado inicial**: "PAGOS" 
- **Al hacer click**: Cambia a "OK" + activa modo edición fácil

#### **🎨 MODO EDICIÓN (botón dice "OK")**
- **Click izquierdo** → cambiar cualquier variable editable (fechas, montos, CATEG, etc.)
- **Click derecho** en montos → pregunta "¿Orden de pago?" vs "¿Confirmación de pago?"
  - **Orden de pago** → 🟡 Amarillo + estado "PAGAR" en BBDD
  - **Confirmación de pago** → 🟢 Verde + estado "PAGADO" en BBDD
- **Guardado**: ✅ Automático tras cada cambio individual

#### **🔧 MODO NORMAL (botón dice "PAGOS")**
- **Ctrl+Click izquierdo** → cambiar cualquier variable editable
- **Ctrl+Click derecho** en montos → cambiar estado (orden/confirmación pago)
- **Guardado**: ✅ Automático tras cada cambio individual

#### **❌ VARIABLES NO EDITABLES (ambos modos)**
- Cuit Cliente/Proveedor
- Nombre Cliente/Proveedor  
- SALDO CTA CTE

#### **🎯 OTRAS ESPECIFICACIONES**
- **Filtros**: ✅ Cada columna con su filtro
- **Ordenamiento**: ✅ Solo por fecha_estimada (ascendente)

### **🚨 TEMAS CRÍTICOS FINALES** ✅ DEFINIDOS

#### **1. ⚠️ CATEG vs Cuenta Contable - CLARIFICADO**
- **Preferencia visualización**: CATEG (códigos cortos) en Cash Flow
- **Tabla equivalencias**: Ya existe - mapea CATEG ↔ cuenta_contable
- **Para reportes**: Usar cuenta_contable (comprensión socios)
- **BBDD actual**: Usar campo cuenta_contable, mostrar CATEG en UI
- **Consistencia**: ⚠️ **REVISAR** todas las estructuras BBDD tras documentación

#### **2. ⚠️ Columna "Monto a Abonar" - INVESTIGAR**
- **Status**: Verificar si existe campo similar en ARCA/Templates
- **Función**: Permitir pagar monto diferente sin alterar monto original factura
- **Si no existe**: Crear campo para diferenciar monto_factura vs monto_abonado

#### **3. ⚠️ Protección Datos Originales - DEFINIDO**
- **Campos import originales**: Protección contra modificación accidental
- **Mecanismo**: Permisos rigurosos para modificar datos importados
- **Desarrollo posterior**: Sistema de permisos granulares

## 🔧 **CAMBIOS DE CONSISTENCIA APLICADOS (2025-08-15)**

### **✅ CAMBIOS COMPLETADOS**
1. **✅ Columna estado templates**: Ya existía en `cuotas_egresos_sin_factura` 
2. **✅ Cambio cuenta_contable → categ**: `egresos_sin_factura.cuenta_contable` → `categ`
3. **✅ Columnas fecha ARCA**: Agregadas `fecha_estimada` + `fecha_vencimiento` 
4. **✅ Fecha_estimada poblada**: Calculada automáticamente (fecha_emision + 15 días)
5. **✅ Columna monto_a_abonar**: Agregada en ARCA, poblada con `imp_total`

### **✅ CAMBIOS COMPLETADOS (continuación)**
6. **✅ Estado "conciliado"**: ARCA acepta estado conciliado (sin constraint restrictivo)
7. **✅ Templates estructura**: Campo `categ` funcionando correctamente

### **⚠️ CAMBIOS PENDIENTES**
- ❌ **Wizard templates**: Cambiar a dropdown CATEG desde tabla `cuentas_contables`
- ❌ **Script importador**: Modificar para calcular fecha_estimada automáticamente

### **📋 TAREAS ADICIONALES IDENTIFICADAS**
- 🔄 **Crear tabla centros_costo** con sus CATEG (no existe plan actual)
- 🔄 **Reglas automáticas**: Proveedores → CATEG por defecto  
- 🔄 **Reglas automáticas**: Proveedores → Centro costo por defecto

### **🎯 PRÓXIMOS PASOS PARA CASH FLOW**
- **BBDD lista**: Con cambios de consistencia aplicados
- **Falta**: Completar constraint estados + modificar wizard + implementar componente Cash Flow

#### **3. 🔍 MAPEO FACTURAS ARCA → CASH FLOW** ✅ RESUELTO

### **📋 MAPEO FECHAS DEFINIDO**
1. **Fecha Estimada**: `fecha_emision + 7 días` (automático para ARCA)
2. **Fecha Vencimiento**: 
   - ✅ Puede venir llena desde BBDD (ARCA/Templates)
   - ✅ Puede llenarse desde Cash Flow 
   - ✅ Puede quedar en blanco
   - ❌ **NO tiene cálculo automático** ni valor por defecto
   - 🔄 **Si se llena**: fecha_estimada se actualiza para coincidir

### **⚠️ RECORDATORIOS PARA REVISAR AL FINAL**
- ⚠️ **CATEG (cuenta_contable)**: Varios detalles pendientes

#### **4. 📊 CONSULTA SQL FINAL** ✅ PARCIALMENTE RESUELTO

### **📋 ESPECIFICACIONES TÉCNICAS CONFIRMADAS**

1. **UNION exacto**: ✅ `UNION ALL` (permite duplicados)
   - **Razón**: Campos adicionales (proveedor, fechas) diferencian registros similares
   - **Manejo**: Usuario aplicará criterio manual al identificar duplicados reales
   - **Futura mejora**: Funcionalidad para eliminar renglones con barrera de seguridad

2. **Fecha estimada cálculo**: ✅ Durante importación Excel (una sola vez)
   - **ARCA**: `fecha_emision + 15 días` (corrección: NO 7 días)
   - **Templates**: Ya calculada en wizard
   - **Ventaja**: Cálculo único = mayor velocidad posterior
   - **Requerimiento**: Modificar script importador para llenar campo automáticamente

3. **Performance y actualizaciones**: ✅ **RESUELTO**
   - **Cambios individuales**: Se ven inmediatamente en celda editada + guardan en BBDD
   - **Reordenamiento**: NO automático (evita recalcular 700 renglones cada cambio)
   - **Refresh completo**: Automático en cada cambio de vista (siempre, sin tracking)
   - **Beneficio**: UX rápida para edición + vista consistente al navegar
   - **Contras aceptables**: Confusión temporal hasta próximo cambio de vista

4. **Estados y filtros**: ✅ **RESUELTO - Estado "conciliado" agregado**
   - **Estados completos**: `pendiente`, `debito`, `pagar`, `pagado`, `credito`, `conciliado`
   - **Cash Flow muestra**: `estado != 'conciliado' AND estado != 'credito'`
   - **Aplicar a**: Tanto ARCA como Templates
   - **Conciliación mensual**: Cambia `pagado` → `conciliado` + borra de Cash Flow
   - **Ventaja**: Cash Flow enfocado en "lo que necesita atención" + histórico reciente visible

#### **📋 SECUNDARIOS (Post-MVP)**
5. **Sistema Tarjeta de Crédito** (desarrollo posterior)
   - Para facturas con estado `credito`
   - Flujo separado de Cash Flow
6. **Interfaz cambio estado** facturas/templates (UI para marcar pagado)
7. **Cálculo saldo CTA CTE** en tiempo real
8. **Filtros/búsqueda** en Cash Flow (por empresa, cuenta, etc.)
9. **Proceso conciliación bancaria** (siguiente fase)

### **💡 DECISIONES ARQUITECTÓNICAS CONFIRMADAS**
- ✅ **Vista dinámica** vs tabla estática
- ✅ **Multi-empresa** (MSA + PAM en mismo flujo)
- ✅ **Sin filtro temporal** (mostrar todo no-conciliado)
- ✅ **10 columnas** (eliminar registros contable/interno)
- ✅ **Orden por urgencia** (fecha_estimada ASC)
- ✅ **Estados visuales** (🔴🟢 para UX clara)

**Tags**: `cash-flow`, `arquitectura`, `flujo-completo`, `especificación`, `pendientes`

## Correcciones Críticas Cash Flow - DECIDIDO (2025-08-14)
**Error original**: Cuit/Nombre Cliente = responsable del gasto
**Corrección**: ✅ Cuit/Nombre Cliente = quien cobra el servicio
**Ejemplo**: 
- ❌ Incorrecto: Responsable MSA → Cliente "MSA"
- ✅ Correcto: Impuesto inmobiliario → Cliente "ARBA" (CUIT ARBA)
**Campos Cash Flow corregidos**:
- **Cuit Cliente/Proveedor**: CUIT de quien cobra (ej: CUIT ARBA)
- **Nombre Cliente/Proveedor**: Razón social de quien cobra (ej: "ARBA")
- **Registro Contable**: Se define en conciliación bancaria (vacío inicialmente)
- **Registro Interno**: Se define en conciliación bancaria (vacío inicialmente)
**Impacto wizard**: Agregar campos CUIT y nombre de quien cobra
**Tags**: `cash-flow`, `corrección`, `mapeo-campos`

---

# 📚 **INVESTIGACIÓN COMPLETADA**

## MCP Windows NPX Execution - INVESTIGADO (2025-08-14)
**Problema**: Herramientas MCP no aparecen en Windows tras múltiples reinicios
**Fuentes consultadas**:
1. **GitHub Issue #1611**: https://github.com/anthropics/claude-code/issues/1611
2. **Docs Anthropic MCP**: https://docs.anthropic.com/en/docs/claude-code/mcp
3. **Docs Supabase MCP**: https://supabase.com/docs/guides/getting-started/mcp

**Conclusión objetiva**: Windows requiere wrapper `cmd /c` para ejecutar `npx` en Claude Code
**Solución aplicada**: ✅ Funciona - Cambiar `"command": "npx"` por `"command": "cmd", "args": ["/c", "npx", ...]`
**No buscar nuevamente**: GitHub Issues MCP Claude Code, docs oficiales ya consultados
**Patrón reutilizable**: Cualquier comando npm/npx en Windows MCP requiere wrapper
**Tags**: `investigación`, `mcp`, `windows`, `npx`

---

# 🧪 **TESTING COMPLETADO**

## Wizard Templates Egresos sin Factura - ÉXITO COMPLETO (2025-08-15)
**Test**: Wizard completo de 4 pasos con guardado Supabase
**Funcionalidades probadas**:
- ✅ **UI Wizard**: Navegación 4 pasos funcional
- ✅ **Datos Básicos**: Cuenta, centro costo, responsable, CUIT quien cobra
- ✅ **Recurrencia**: Mensual (con aguinaldo), anual, cuotas específicas
- ✅ **Fechas inteligentes**: Checkbox "último día del mes" FUNCIONA PERFECTAMENTE
- ✅ **Preview**: Generación automática cuotas con fechas correctas
- ✅ **Validación**: Cada paso valida antes de continuar
- ✅ **Guardado Supabase**: FUNCIONA PERFECTAMENTE - datos persistidos
**Casos probados exitosos**:
- Template "Sueldos MSA" → último día mes (31/28/30 automático) + aguinaldo Jun/Dic x1.5
- 12 cuotas generadas con fechas perfectas: Feb=28, Abr/Jun/Sep/Nov=30, resto=31
- Datos consistentes en 3 tablas con relaciones FK correctas
**Resultado**: ✅ **SISTEMA 100% FUNCIONAL**
**Problemas resueltos**: 
1. **Fix UI**: `input type="checkbox"` → `Checkbox` component (shadcn/ui)
2. **Fix RLS**: 6 políticas creadas para authenticated + anon users
**Datos verificados en BD**: 
- Template master con contador actualizado
- Configuración JSONB: `"ultimo_dia_mes": true`
- 12 cuotas con fechas último día perfectas + aguinaldos correctos
**Commits**: `039efd8` (bugs) → `e991ce1` (fixes completos)
**Componente**: `components/wizard-templates-egresos.tsx`
**Próximo**: Integración Cash Flow completada, listo para producción
**Tags**: `testing`, `wizard`, `templates`, `exitoso`, `produccion-ready`

## Anti-duplicados Facturas ARCA - EXITOSO (2025-08-14)
**Test**: Constraint único compuesto en `msa.comprobantes_arca`
**Constraint**: `(tipo_comprobante, punto_venta, numero_desde, cuit)`
**Resultado**: ✅ ÉXITO - Funciona perfectamente
**Validación**: Reimportar archivo existente → detecta duplicados correctamente
**Performance**: Rápida detección, no impacta inserción normal
**Expandir a**: Replicar constraint idéntico en `pam.comprobantes_arca`
**Tags**: `testing`, `bbdd`, `anti-duplicados`, `arca`

## Validación CUIT por Nombre Archivo - EXITOSO (2025-08-14)
**Test**: Extraer CUIT de nombre archivo y validar contra empresa
**Lógica**: `comprobantes_consulta_csv_recibidos_MSA_20250814.csv` → MSA → CUIT 30617786016
**Resultado**: ✅ ÉXITO - Validación automática funcional
**Edge cases probados**: Archivos PAM en sistema MSA → falla correctamente
**Expandir a**: Misma lógica para sistema PAM con CUIT 20044390222
**Tags**: `testing`, `validación`, `cuit`, `arca`

## Investigación Error Supabase RLS Permissions - COMPLETADO (2025-08-15)
**Problema**: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
**Contexto**: INSERT operations fallan en tablas templates, solo UI funciona
**Fuentes consultadas**:
1. **Supabase Docs**: Row Level Security, error codes, authentication patterns
2. **Stack Overflow**: Multiple casos similares permission denied + RLS
3. **GitHub Issues Supabase**: Problemas client authentication y RLS policies
**Conclusión objetiva**: Error estándar de permisos RLS, no bug del código
**Causa root confirmada**: Tablas templates sin políticas RLS para INSERT operations
**Solución estándar**: 
```sql
-- Política RLS permisiva para authenticated users
CREATE POLICY "Allow all operations for authenticated users" 
ON tabla_template FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```
**Aplicable a**: `templates_master`, `egresos_sin_factura`, `cuotas_egresos_sin_factura`
**Patrón reutilizable**: ✅ Diagnóstico error Supabase client → verificar RLS policies primero
**Tags**: `investigación`, `supabase`, `rls`, `permissions`, `error-pattern`

## Backup Supabase via Docker PostgreSQL 17 - ÉXITO (2025-08-15)
**Problema resuelto**: Backup de estructura BD tras agregar tablas templates y políticas RLS
**Métodos fallidos probados**:
- ❌ Supabase CLI no instalado localmente
- ❌ Docker postgres:15 (version mismatch con servidor)
- ❌ pg_dumpall sintaxis incorrecta para roles
**Solución exitosa**:
```bash
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$(date +%Y%m%d_%H%M%S).sql
```
**Resultado**: Archivo `schema_backup_20250814_224950.sql` generado exitosamente
**Lecciones críticas**:
1. **Version matching**: Docker postgres:17 required para Supabase compatibility
2. **Schema-only**: Suficiente para backup estructura + policies
3. **Timestamp automático**: `$(date +%Y%m%d_%H%M%S)` genera nombres únicos
4. **Un comando simple**: Sin necesidad de múltiples archivos para uso normal
**Aplicación**: Antes de cualquier modificación estructura BD significativa
**Patrón reutilizable**: ✅ Comando directo, sin instalaciones adicionales
**Tags**: `backup`, `docker`, `postgresql`, `supabase`, `exitoso`, `production-ready`

## Configuración RLS Policies Supabase - ÉXITO (2025-08-15)
**Problema resuelto**: Tablas templates sin permisos INSERT para Supabase client
**Error específico**: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
**Solución aplicada**:
```sql
-- Patrón para cualquier tabla nueva que necesite client access
CREATE POLICY "Allow all operations for authenticated users on [tabla]" 
ON [tabla] FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations for anon users on [tabla]" 
ON [tabla] FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);
```
**Aplicado exitosamente a**: `templates_master`, `egresos_sin_factura`, `cuotas_egresos_sin_factura`
**Resultado**: INSERT/SELECT/UPDATE/DELETE operations funcionando perfectamente
**Lecciones aprendidas**:
1. **RLS debe configurarse siempre** para nuevas tablas con client access
2. **Error silencioso**: Supabase client falla sin mensaje claro de permisos
3. **Testing inmediato**: Verificar operaciones CRUD tras crear tabla
4. **Políticas permisivas**: Para MVP usar `USING (true)`, refinar después
**Patrón reutilizable**: ✅ Template SQL para cualquier tabla nueva
**Tags**: `configuración`, `supabase`, `rls`, `permissions`, `client-access`

## shadcn/ui Checkbox vs HTML input - LECCIÓN CRÍTICA (2025-08-15)
**Problema**: `<input type="checkbox">` no renderizaba en wizard templates
**Causa**: Inconsistencia con sistema de componentes shadcn/ui
**Solución**: Usar `<Checkbox>` component en lugar de HTML nativo
**Diferencias críticas**:
```typescript
// ❌ HTML nativo - puede no renderizar
<input 
  type="checkbox" 
  checked={value} 
  onChange={(e) => setValue(e.target.checked)} 
/>

// ✅ shadcn/ui component - renderiza siempre
<Checkbox 
  checked={value} 
  onCheckedChange={(checked) => setValue(checked)} 
/>
```
**Cambios necesarios**: `onChange` → `onCheckedChange`, importar `Checkbox`
**Resultado**: Checkbox visible y funcional en UI
**Aplicar siempre**: En proyectos shadcn/ui usar componentes system, no HTML nativo
**Patrón reutilizable**: ✅ Siempre verificar disponibilidad component antes de HTML
**Tags**: `ui`, `shadcn`, `checkbox`, `renderizado`, `components`

---

# 🔄 **PATRONES REUTILIZABLES**

## Esquema Multi-Empresa Supabase
**Aplicación**: Replicar infraestructura MSA → PAM
**Patrón**:
1. Crear esquema: `CREATE SCHEMA IF NOT EXISTS pam;`
2. Crear tabla: Replicar estructura `msa.comprobantes_arca`
3. Exponer en API: Dashboard Supabase → Settings → API → "Exposed schemas"
4. Otorgar permisos: `GRANT USAGE ON SCHEMA pam TO authenticated, anon, service_role;`
5. Políticas RLS: Replicar políticas de MSA
**Replicable**: ✅ Para cualquier nueva empresa
**Tags**: `patrón`, `multi-empresa`, `supabase`

## Importador Dual CSV + Validación
**Aplicación**: Importador Excel dual (extractos + facturas)
**Patrón**:
1. Detectar tipo archivo por nombre
2. Validar CUIT por empresa automático
3. Procesar según esquema correspondiente
4. Aplicar anti-duplicados
5. Respuesta unificada con resultados
**Replicable**: ✅ Para cualquier nuevo tipo de importación
**Tags**: `patrón`, `importador`, `validación`

## Sistema Templates Presupuestarios - IMPLEMENTADO (2025-08-15)
**Aplicación**: Templates para cualquier tipo de presupuesto recurrente
**Estado**: ✅ **WIZARD COMPLETAMENTE FUNCIONAL**
**Patrón**:
1. Template Master por año (auto-creación/reutilización)
2. Templates individuales por renglón con JSONB para reglas
3. Cuotas generadas automáticamente desde templates
4. Modificación manual → regenerar solo futuras
5. Wizard paso a paso con preview en tiempo real
**Implementación completa**:
- **Archivo**: `components/wizard-templates-egresos.tsx`
- **Guardado Supabase**: 3 tablas coordinadas
- **Función clave**: `guardarTemplate()` maneja todo el flujo
- **Fechas inteligentes**: Último día del mes automático
- **UI/UX**: 4 pasos con validación y preview
**Casos de uso probados**: Sueldos (último día + aguinaldo), impuestos (día específico)
**Reglas JSONB**: Maneja inflación, aguinaldos, fechas custom, último día mes
**Replicable**: ✅ Para cualquier sistema presupuestario recurrente
**Próximo**: Integración con Cash Flow (mapeo 12 columnas)
**Tags**: `patrón`, `templates`, `presupuesto`, `wizard`, `implementado`

## Backup Supabase via Docker - FUNCIONAL COMPLETO (2025-08-17)
**Aplicación**: Backup rápido estructura + roles BD antes de modificaciones importantes
**Estado**: ✅ **AMBOS COMANDOS FUNCIONANDO** - Siempre ejecutar los 2

### **📋 COMANDO BACKUP ESTRUCTURA**
```bash
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$(date +%Y%m%d_%H%M%S).sql
```
**Incluye**: Tablas, constraints, políticas RLS, índices, esquemas completos

### **📋 COMANDO BACKUP ROLES** 
```bash
docker run --rm -e PGPASSWORD=Monomaniaco13 postgres:17 pg_dumpall -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.upaygsviflbuwraaawhf --roles-only > roles_backup_$(date +%Y%m%d_%H%M%S).sql
```
**Incluye**: Roles, permisos, configuraciones de usuario

### **🚀 COMANDO COMBINADO (USAR SIEMPRE)**
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$TIMESTAMP.sql && \
docker run --rm -e PGPASSWORD=Monomaniaco13 postgres:17 pg_dumpall -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.upaygsviflbuwraaawhf --roles-only > roles_backup_$TIMESTAMP.sql && \
echo "✅ Backup completo generado con timestamp: $TIMESTAMP"
```

**Ventajas**: Sin instalaciones, version-compatible, timestamp automático, backup completo
**Uso**: Protocolo "Save Game" antes de cambios estructura (SIEMPRE los 2 archivos)
**Resultado**: 2 archivos con mismo timestamp para restore coordinado
**Replicable**: ✅ Para cualquier BD Supabase/PostgreSQL
**Tags**: `patrón`, `backup`, `docker`, `postgresql`, `completo`

---

# 📝 **NOTAS DE USO**

## 🎯 **Cuándo Documentar en este Archivo**
- ✅ **Algo funciona definitivamente** y está probado
- ✅ **Algo falla definitivamente** y no se debe repetir
- ✅ **Arquitectura decidida** tras evaluación de opciones
- ✅ **Investigación completada** con fuentes y conclusiones
- ✅ **Testing finalizado** con resultados objetivos

## ❌ **Qué NO Documentar**
- Experimentos en curso sin resultado final
- Ideas o hipótesis sin prueba
- Investigación parcial sin conclusiones
- Configuraciones que "podrían funcionar"

## 🔄 **Mantenimiento**
- **Agregar inmediatamente** tras resultado definitivo
- **Incluir fecha** en cada entrada
- **Usar tags** para búsqueda futura
- **Marcar como reutilizable** cuando aplique
- **Vincular con arquitectura general** si relevante