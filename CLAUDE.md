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

# 🎯 **OBJETIVO ACTUAL: Conciliación Bancaria Nivel 3 - Testing**

## 📍 **Estado Objetivo:**
**Progreso**: Contexto técnico cargado ✅ - Listo para testing
**Iniciado**: 2025-08-18

## 💡 **Avances Sesión Actual:**
- [2025-08-18] Corrección: Nivel 3 YA implementado (motor automático funcionando)
- [2025-08-18] Contexto BD cargado: msa_galicia (858 registros), reglas_conciliacion (22 reglas)
- [2025-08-18] Contexto hooks cargado: useMotorConciliacion.ts, useReglasConciliacion.ts
- [2025-08-18] Algoritmo confirmado: Cash Flow matching + reglas por prioridad + estados
- [2025-08-18] Protocolo validación usuario establecido para carga contexto
- [2025-08-18] Estado actual BD confirmado: 858 movimientos TODOS "Conciliados", 0 pendientes
- [2025-08-18] Sistema completamente funcional - necesita datos nuevos para testing

## 📋 **Contexto Cargado:**
- **Tablas BD**: msa_galicia (858 reg TODOS "Conciliados"), reglas_conciliacion (22 reg), cuentas_contables (67 cat)
- **Motor**: useMotorConciliacion.ts:35 - matching Cash Flow + reglas configurables
- **Reglas**: useReglasConciliacion.ts:7 - gestión completa reglas con prioridades
- **Estados**: Pendiente → Conciliado con campos categ/centro_costo/detalle
- **Algoritmo**: 1) Cash Flow ±5 días, 2) Reglas por orden, 3) Estados automáticos
- **Cuentas**: MSA/PAM Galicia configuradas, solo MSA con datos reales

## 🎯 **Próximos Pasos Acordados:**
1. ✅ Contexto técnico completo cargado
2. 📋 Usuario carga movimientos bancarios que coincidan con facturas registradas
3. 📋 Ejecutar motor conciliación y evaluar matching automático
4. 📋 Ajustar algoritmo/reglas según resultados testing

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
**📅 Última actualización**: 2025-08-18