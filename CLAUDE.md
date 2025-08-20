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

## 🚨 **PENDIENTES SISTEMA:**

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
**📅 Última actualización**: 2025-08-19