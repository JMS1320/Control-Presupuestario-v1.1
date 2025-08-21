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

# 🎯 **OBJETIVO ACTUAL: Desarrollo Continuo - Mejoras Sistema**

## 📍 **Estado Objetivo:**
**Progreso**: Core completado ✅ - Desarrollando mejoras activamente
**Transición**: 2025-08-19 (desde testing conciliación)
**Iniciado originalmente**: 2025-08-18

## 💡 **Avances Sesión Actual:**
- [2025-08-19] TRANSICIÓN: Core conciliación completado → desarrollo mejoras continuas
- [2025-08-19] Contexto preservado: Motor conciliación + filtros + edición inline funcionando
- [2025-08-19] Sistema integrado: ARCA facturas + Templates + Extracto bancario operativo
- [2025-08-19] Todas las funcionalidades principales implementadas y mergeadas a main
- [2025-08-19] Contexto técnico conservado para desarrollo iterativo sin pérdida información
- [2025-08-20] ✅ FIX CRÍTICO: Campos vacíos categoría ARCA facturas ahora editables (Ctrl+Click)
- [2025-08-20] COMMIT: 69933a4 - Fix edición campos null/undefined con onClick handler
- [2025-08-20] ✅ FEATURE: Centro de costo opcional en creación templates
- [2025-08-20] COMMIT: 0754ef4 - Removido centro_costo como requerido en wizard
- [2025-08-20] ✅ FEATURE: Sistema reglas contable e interno automatizado
- [2025-08-20] COMMIT: 3865ea8 - Tabla + CRUD + UI configuración completa
- [2025-08-20] VERIFICAR: Templates posiblemente necesite mismo fix para campos vacíos

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

### 🏠 **Vista Principal** `#futuro #home #principal`
- **Funcionalidad**: Página principal/home del sistema
- **Alcance**: Por definir - se irá viendo
- **Estado**: Por desarrollar - sin especificaciones
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

**📍 Total líneas**: ~150 (cumple objetivo ≤300 líneas)  
**🔗 Conocimiento completo**: Ver KNOWLEDGE.md  
**📅 Última actualización**: 2025-08-20

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