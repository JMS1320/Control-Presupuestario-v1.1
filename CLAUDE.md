# 🎯 CLAUDE.md - CENTRO DE COMANDO

> **Este archivo es tu "índice inteligente"**: Información crítica actual + reglas de navegación a archivos especializados.

---

# 🤖 **REGLAS AUTOMÁTICAS CLAUDE - CHECKLIST OBLIGATORIO**

## 🔄 **DESPUÉS DE CADA OPERACIÓN EXITOSA - REVISAR SIEMPRE:**

### **🎯 SITUACIONES QUE REQUIEREN BACKUP INMEDIATO:**
- ✅ **Nueva tabla BD creada Y datos insertándose/leyéndose correctamente**
- ✅ **Nuevo componente React funcionando Y renderizando en UI** 
- ✅ **Nueva configuración aplicada Y operación básica exitosa** (MCP, RLS, API)
- ✅ **Nueva integración conectada Y respuesta básica funcional** (ARCA, Supabase)

→ **ACCIÓN AUTOMÁTICA**: Proponer backup con comando Docker documentado

### **📚 SITUACIONES QUE REQUIEREN DOCUMENTACIÓN INMEDIATA:**
- ✅ **Comando funcionando DESPUÉS de fallos previos** (encontré el método correcto)
- ✅ **Error resuelto DESPUÉS de investigación/testing** (solución aplicada funciona)
- ✅ **Configuración exitosa DESPUÉS de múltiples intentos** (setup completo)
- ✅ **Decisión arquitectónica tomada Y implementada básicamente** (patrón decidido)

→ **ACCIÓN AUTOMÁTICA**: Proponer documentar en KNOWLEDGE.md con detalles específicos

### **⚡ PALABRAS CLAVE QUE DEBO DETECTAR:**
- "funcionando", "exitoso", "completado", "creado", "resuelto"
- "datos guardándose", "renderizando", "conectando"
- "tras fallos", "después de", "método correcto", "solución encontrada"

### **🚨 NUNCA ESPERAR A QUE EL USUARIO PREGUNTE:**
- Si detecto situación de la lista → PROPONER inmediatamente
- Si usuario confirma éxito → ACTIVAR protocolo automáticamente
- Si veo testing básico exitoso → CONSIDERAR logro definitivo

**NOTA CRÍTICA**: Pruebas de rigor pendientes NO bloquean backup/documentación

---

# 📂 ARQUITECTURA DE DOCUMENTACIÓN

## 📋 **Nuestros 4 Archivos Principales**

### 1. **CLAUDE.md** (Este archivo) 📍
**Contiene**: Configuración activa, comandos, desarrollo en curso, reglas de navegación
**Cuándo usar**: Siempre leer primero para orientación

### 2. **README.md** 📖  
**Contiene**: Overview del proyecto, instalación, tecnologías, estructura general
**Cuándo usar**: Para entender el proyecto completo, instalación, tecnologías

### 3. **DOCS.md** 📚
**Contiene**: Troubleshooting, configuraciones históricas, testing completado, diseños finalizados
**Cuándo usar**: Para problemas específicos, consultas históricas, configuraciones pasadas

### 4. **KNOWLEDGE.md** 🧠
**Contiene**: Conocimiento objetivo confirmado, configuraciones funcionando, métodos descartados, arquitecturas decididas
**Cuándo usar**: Para consultar qué funciona/no funciona, patrones reutilizables, investigación completada

---

# 📋 **ÍNDICE DE CONOCIMIENTO DOCUMENTADO**

## 🧠 **Temas con Información Confirmada en KNOWLEDGE.md:**
- **MCP Supabase configuración** (Windows CMD wrapper, variables ENV descartadas)
- **Restore masivo PostgreSQL** (Docker descartado, psql nativo recomendado)
- **Esquemas multi-empresa Supabase** (MSA/PAM separados, permisos, sintaxis)
- **Anti-duplicados facturas ARCA** (constraint único, validación CUIT)
- **Importador dual CSV/Excel** (patrón reutilizable, validaciones)
- **Sistema Templates Egresos sin Factura** (arquitectura decidida, 3 tablas, JSONB)
- **Correcciones Cash Flow** (mapeo campos, CUIT quien cobra, registros en conciliación)
- **FASE COMPLETADA Sistema CATEG + Cash Flow + Backups** (implementación completa, production ready)
- **🏦 CONCILIACIÓN BANCARIA** (proceso, reglas, algoritmos, arquitectura decidida)

## 📚 **Temas con Troubleshooting en DOCS.md:**
- **MCP problemas Windows** (NPX execution, herramientas no aparecen)
- **Backup/restore protocolo** (comandos específicos, limitaciones escalabilidad)
- **Configuración Supabase esquemas** (exposición API, permisos RLS)
- **Integración ARCA API** (certificados, autenticación WSAA, WSFEv1)

## ✅ **COMANDOS BACKUP DOCKER FUNCIONALES (2025-08-17):**

### **🚀 COMANDO COMBINADO (USAR SIEMPRE):**
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$TIMESTAMP.sql && \
docker run --rm -e PGPASSWORD=Monomaniaco13 postgres:17 pg_dumpall -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.upaygsviflbuwraaawhf --roles-only > roles_backup_$TIMESTAMP.sql && \
echo "✅ Backup completo generado con timestamp: $TIMESTAMP"
```

### **📋 COMANDOS INDIVIDUALES:**
```bash
# BACKUP ESTRUCTURA SOLAMENTE
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$(date +%Y%m%d_%H%M%S).sql

# BACKUP ROLES SOLAMENTE  
docker run --rm -e PGPASSWORD=Monomaniaco13 postgres:17 pg_dumpall -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.upaygsviflbuwraaawhf --roles-only > roles_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Resultado**: ✅ Genera 2 archivos: `schema_backup_YYYYMMDD_HHMMSS.sql` + `roles_backup_YYYYMMDD_HHMMSS.sql`
**Incluye**: Estructura completa (tablas, constraints, índices, políticas RLS, esquemas MSA/PAM) + Roles y permisos
**Uso**: SIEMPRE ambos antes de modificaciones importantes en BD

## 📖 **Temas con Setup en README.md:**
- **Instalación proyecto** (dependencias, variables entorno, pasos exactos)
- **Configuración Supabase crítica** (esquemas, permisos, políticas RLS)
- **Stack tecnológico** (Next.js, Tailwind, shadcn/ui, versiones)
- **Estructura archivos** (organización carpetas, API routes, componentes)

---

# 🚨 **REGLAS DE CONSULTA OBLIGATORIA**

## ⚡ **ANTES de responder/proponer/implementar:**

### **✅ SIEMPRE verificar PRIMERO si el tema está en el ÍNDICE**
- Si **SÍ está** → **OBLIGATORIO** leer archivo correspondiente antes de responder
- Si **NO está** → Proceder normal pero documentar resultado después

### **🧠 Si tema está en KNOWLEDGE.md:**
- **LEER configuraciones funcionando** → Usar esas exactas
- **LEER métodos descartados** → NO proponer esos nunca
- **LEER arquitecturas decididas** → Seguir esas decisiones
- **LEER patrones reutilizables** → Aplicar esos patrones

### **📚 Si tema está en DOCS.md:**
- **LEER troubleshooting** → Aplicar soluciones conocidas
- **LEER históricos** → No repetir errores documentados
- **LEER comandos específicos** → Usar esos exactos

### **📖 Si tema está en README.md:**
- **LEER pasos instalación** → Seguir secuencia exacta
- **LEER configuración** → Aplicar setup documentado
- **LEER estructura** → Respetar organización

### **❌ PROHIBIDO:**
- **Proponer algo ya descartado** sin leer KNOWLEDGE.md primero
- **Inventar configuraciones** sin verificar las funcionando
- **Sugerir pasos instalación** sin leer README.md
- **Diagnosticar errores** sin revisar troubleshooting DOCS.md

---

# 🧭 REGLAS DE NAVEGACIÓN INTELIGENTE

## 🔍 **Cuándo ir a DOCS.md**

### **Para Troubleshooting:**
- ❌ **MCP no aparece herramientas** → DOCS.md sección "MCP AGOSTO 2025 - PROBLEMAS WINDOWS"
- ❌ **Problemas configuración Supabase** → DOCS.md sección "CONFIGURACIÓN MCP SUPABASE"  
- ❌ **Errores de backup/restore** → DOCS.md sección "PROTOCOLO DE SEGURIDAD MCP SUPABASE"
- ❌ **Integración ARCA API** → DOCS.md sección "INTEGRACIÓN ARCA API"

### **Para Consultas Históricas:**
- 📖 **Testing ya completado** → DOCS.md sección "TESTING PROTOCOLO BACKUP/RESTORE"
- 📖 **Diseños finalizados** → DOCS.md sección "SISTEMA CASH FLOW - EGRESOS SIN FACTURA"
- 📖 **Configuraciones que fallaron** → DOCS.md historial troubleshooting

## 🧠 **Cuándo ir a KNOWLEDGE.md**

### **Para Conocimiento Confirmado:**
- ✅ **Qué configuraciones funcionan** → KNOWLEDGE.md sección "CONFIGURACIONES FUNCIONANDO"
- ❌ **Métodos ya descartados** → KNOWLEDGE.md sección "MÉTODOS DESCARTADOS"
- 🏗️ **Arquitecturas decididas** → KNOWLEDGE.md sección "ARQUITECTURAS DECIDIDAS"
- 📚 **Investigación completada** → KNOWLEDGE.md sección "INVESTIGACIÓN COMPLETADA"
- 🔄 **Patrones para reutilizar** → KNOWLEDGE.md sección "PATRONES REUTILIZABLES"

## 📖 **Cuándo ir a README.md**
- 🚀 **Instalación del proyecto** 
- 🛠️ **Tecnologías utilizadas**
- 📁 **Estructura general del proyecto**
- 🔧 **Configuración Supabase multi-empresa**
- 📊 **Estado funcionalidades completadas**
- 🎯 **Visión futura del sistema**

---

# ⚡ COMANDOS DE DESARROLLO

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Lint/Formato
npm run lint
npm run type-check

# Testing
npm test
```

---

# 🏗️ ESTRUCTURA DEL PROYECTO (Para Claude)

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── import-excel/          # Extractos bancarios MSA Galicia
│   │   ├── import-facturas-arca/  # Facturas ARCA MSA/PAM
│   │   └── verificar-tabla/       # Validaciones BD
│   └── page.tsx           # Dashboard principal
├── components/
│   ├── ui/                # shadcn/ui components (NO MODIFICAR base)
│   ├── importador-excel.tsx       # Importador dual
│   ├── vista-facturas-arca.tsx    # Vista gestión facturas
│   └── dashboard.tsx              # Componente principal
├── hooks/                 # Custom hooks para data fetching
└── lib/
    ├── supabase.ts       # Cliente Supabase configurado
    └── excel-utils.ts    # Utilidades para Excel/CSV
```

---

# 🔧 CONVENCIONES DE CÓDIGO

## Base de Datos
- **Esquemas**: `public` (extractos), `msa` (facturas MSA), `pam` (facturas PAM)
- **Sintaxis Supabase**: `supabase.schema('msa').from('comprobantes_arca')`
- **NUNCA**: `supabase.from('msa.comprobantes_arca')` ❌

## TypeScript
- Usar tipos estrictos
- Interfaces para datos de BD
- Props tipadas en componentes

## Componentes React
- Usar shadcn/ui como base
- Componentes funcionales con hooks
- Estado local con useState/useEffect

---

# 📊 DATOS CRÍTICOS

## Empresas y CUITs
- **MSA**: 30617786016
- **PAM**: 20044390222

## Variables de Entorno Requeridas
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

# 🎯 ESTADO ACTUAL DEL PROYECTO

## ✅ **Sistema MSA Completo**
- Extractos bancarios MSA Galicia funcional
- Facturas ARCA MSA: importación, validación CUIT, vista gestión, anti-duplicados
- Esquema `msa.comprobantes_arca` configurado

## ✅ **Sistema Conciliación Bancaria Completo (2025-08-17)**
- ✅ **Motor de conciliación**: Matching Cash Flow + reglas configurables
- ✅ **UI completa**: Configurador reglas + selector multicuenta + resultados
- ✅ **Base de datos**: Tabla `reglas_conciliacion` + 8 reglas ejemplo
- ✅ **Multi-banco**: Soporte MSA/PAM Galicia + escalable
- ✅ **Funcionalidades**: CRUD reglas + prioridades + matching inteligente

## ✅ **Testing Completado**
- ✅ Anti-duplicados: constraint funciona perfectamente
- ✅ Validación CUIT por nombre archivo: funcional
- ✅ Build del proyecto: compila sin errores
- ✅ Motor conciliación: arquitectura completa implementada
- Constraint único: (tipo_comprobante, punto_venta, numero_desde, cuit)

---

# 💰 **CASH FLOW - EN DESARROLLO ACTIVO**

## 📋 **Análisis del Proceso**

### **Conceptos Diferenciados**
- **Cash Flow**: Pago por pago, día a día, vista detallada
- **Presupuesto Financiero**: Por cuenta contable, mes x mes, vista agregada
- **Mismos datos base**, diferentes formatos y niveles de detalle

### **Función del Cash Flow**
- Ver último bancario conciliado + pagos posteriores (hechos/pendientes)
- Evolución del saldo en tiempo real
- Pagos próximos y mediano plazo
- Comparación posterior con extracto bancario

### **Fuentes de Datos**
1. **Facturas BBDD**: Estado ≠ PAGADO
   - Cambio estado desde Cash Flow → actualiza BBDD facturas
2. **Otros compromisos sin factura**:
   - Impuestos, Sueldos, Créditos bancarios
   - **Método carga masiva**: Ver diseño en DOCS.md

### **Flujo de Trabajo**
Cash Flow → **Conciliación Bancaria** → Extracto Bancario (nueva BBDD)

## 🏗️ **Arquitectura Decidida**
**Cash Flow como Vista/Planilla en tiempo real**
- Fuentes: BBDD Facturas MSA + BBDD Facturas PAM + BBDD Compromisos → Vista Cash Flow
- **Multi-empresa**: Cash Flow MSA se alimentará también de PAM en el futuro
- Ventajas: Integridad datos, consistencia automática, menos duplicación
- Enfoque: Performance optimizada con consultas eficientes

## 📋 **Estructura Columnas Cash Flow**
1. **FECHA Estimada**: Se pone siempre
2. **Fecha Vencimiento**: Cuando hay fecha concreta
3. **CATEG**: Código referencia a Cuenta Contable
4. **Centro de Costo**: Centro de Costo
5. **Cuit Cliente / Proveedor**: Cuit
6. **Nombre Cliente / Proveedor**: Nombre de la empresa
7. **Detalle**: Texto para poder llenar con detalles
8. **Débitos**: Número con decimal: trae el pago comprometido o concreto
9. **Créditos**: Número con decimal: trae el cobro presupuestado o concreto
10. **SALDO CTA CTE**: Número con decimal que se calcula vía saldo anterior más créditos menos débitos
11. **Registro Contable**: Códigos para poder hacer Reportes Contables posteriores
12. **Registro Interno**: Códigos para poder hacer Reportes Internos posteriores

## 🎯 **Lógica Multi-Empresa (MSA-PAM)**
- **Flujo único consolidado**: MSA + PAM en mismo Cash Flow
- **Retiros automáticos**: MSA paga algo de PAM → "RET 3" (retiro vía pago a terceros)
- **Lógica de clasificación**:
  - A QUIÉN corresponde el gasto (de facturas ARCA)
  - DE DÓNDE sale el pago (durante conciliación bancaria)
  - = Determina automáticamente: retiro/aporte/pago genuino

## ✅ **Definiciones Críticas MVP Cash Flow**

### **Estados de Facturas**:
- `pendiente` (default)
- `credito` (automático para ciertos proveedores - por definir cuáles)
- `debito` (automático para ciertos proveedores - por definir cuáles) 
- `pagar`
- `pagado`

### **Mapeo Facturas ARCA → Cash Flow**:
- `cuit` → Cuit Cliente/Proveedor
- `denominacion_emisor` → Nombre Cliente/Proveedor
- `imp_total` → Débitos (inicialmente)
- `fecha_emision + 7 días` → Fecha Estimada
- Cuenta contable y centro de costo desde BBDD

### **Modificación BBDD Facturas**:
- ✅ Agregar columna `monto_a_pagar DECIMAL(15,2)` 
- Permite modificar monto en Cash Flow sin alterar factura original

### **MVP Columnas Cash Flow**:
Todas las 12 columnas definidas anteriormente (las vacías no molestan)

## 📋 **Pendiente Definir**
- Proveedores específicos para estados automáticos credito/debito
- Lógica de inferencia automática retiros/aportes

---

# 🔒 **MCP SUPABASE - CONFIGURACIÓN ACTUAL**

## 📊 **Estado Actual MCP**
**MODO**: **WRITE/UPDATE** ⚠️ (permisos completos de modificación)
**Configuración**: Windows CMD wrapper (2025-08-14)
**⚠️ Si herramientas MCP no aparecen**: Ver DOCS.md sección troubleshooting MCP

## 🔧 **Configuración Actual (.mcp.json)**
```json
{
  "mcpServers": {
    "supabase": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y", 
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=upaygsviflbuwraaawhf"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_dc3586c6770fdbadda8899e9523b753ba3b4a105"
      }
    }
  }
}
```

## 🔒 **Protocolo de Seguridad - REGLAS CRÍTICAS**
- **Backup antes de modificaciones**: SIEMPRE
- **Comandos backup**: Ver DOCS.md sección "PROTOCOLO DE SEGURIDAD MCP SUPABASE"
- **Limitaciones**: Métodos actuales NO escalables para >50 registros
- **Emergencias**: Protocolo restore documentado en DOCS.md

### **🚨 REGLA AUTOMÁTICA CRÍTICA**
- **Avance exitoso** = **propuesta backup inmediata** automática
- **Nunca modificar BD** sin backup reciente (<24h)
- **Una modificación a la vez** + validar resultado inmediatamente

---

# 🔒 **REGLAS OPERATIVAS CONSOLIDADAS**

## 🤖 **Responsabilidades de Claude - SIEMPRE/NUNCA**

### **✅ SIEMPRE debo:**
- **Verificar ÍNDICE** antes de responder sobre cualquier tema documentado
- **Leer archivo correspondiente** si tema está en índice
- **Preguntar por backup** antes de operaciones MCP modificadoras
- **Proponer backup automáticamente** después de avances exitosos
- **Recordar el protocolo** automáticamente sin que me lo pidas
- **Ofrecer comandos restore** si algo falla
- **Informar estado MCP actual** (read-only vs write)
- **Actualizar CLAUDE.md** cuando cambie modo MCP
- **Documentar inmediatamente** tras resultado definitivo (éxito/fallo)
- **Proponer documentación** tras completar test/implementación/investigación
- **Registrar fuentes consultadas** con conclusiones específicas
- **Documentar configuraciones funcionando** con pasos exactos de replicación
- **Registrar métodos descartados** con razón específica y fecha
- **Actualizar ÍNDICE** cuando documente nuevo tema

### **❌ NUNCA debo:**
- **Modificar BD** sin backup reciente disponible
- **Hacer múltiples cambios** sin backup intermedio
- **Olvidar proponer backup** tras éxito
- **Cambiar modo MCP** sin documentar en CLAUDE.md
- **Documentar experimentos en curso** sin resultado definitivo
- **Dejar múltiples resultados** sin documentar al final del día
- **Documentar sin especificar** qué funcionó/falló exactamente
- **Olvidar registrar fuentes** de investigación completada

## 📋 **Protocolo de Operación Segura MCP**

### **🔄 Flujo de Trabajo Estándar**

**1. PRE-OPERACIÓN** (Antes de usar MCP para modificar BD)
- ✅ Verificar backup reciente (<24h disponible)
- ✅ Documentar objetivo de la operación

**2. OPERACIÓN MCP**
- ✅ Solo modificaciones con backup disponible
- ✅ Una modificación a la vez
- ✅ Validar resultado inmediatamente

**3. POST-OPERACIÓN EXITOSA**
- 🎯 **REGLA AUTOMÁTICA**: Claude propone hacer backup
- ✅ Ejecutar backup si operación fue exitosa
- ✅ Documentar cambio realizado
- ✅ Continuar con siguiente tarea

**4. PROTOCOLO DE EMERGENCIA**
- ❌ Si algo sale mal: DETENER inmediatamente
- 🔄 Evaluar si se necesita rollback
- 📞 Usar comandos restore documentados en DOCS.md

## 📋 **Protocolo Troubleshooting MCP**

### **Antes de reiniciar Claude Code:**
1. ✅ **Documentar síntomas específicos** en CLAUDE.md
2. ✅ **Revisar configuración actual** (.mcp.json)
3. ✅ **Consultar fuentes web** SOLO si no están en CLAUDE.md
4. ✅ **Agregar nuevas fuentes** a DOCS.md
5. ✅ **Documentar cambios realizados** con timestamp
6. 🔄 **Reiniciar y verificar resultados**

### **Después del reinicio:**
7. ✅ **Verificar herramientas MCP** aparecen (mcp_supabase_*)
8. ✅ **Documentar resultado** (éxito/fallo)
9. ✅ **Si falla**: Agregar al historial DOCS.md y buscar siguientes opciones

## 📝 **Protocolo de Documentación Incremental**

### **🎯 Principio: "Documentar al saber, no al intentar"**

**✅ Documentar INMEDIATAMENTE cuando:**
1. **Algo funciona definitivamente** (test exitoso, implementación completa)
2. **Algo falla definitivamente** (error reproducible, método descartado)
3. **Arquitectura decidida** (estructura BD, componente React, API endpoint)
4. **Investigación completada** (fuentes consultadas + conclusiones útiles)
5. **Configuración funcionando** (setup que funciona + pasos exactos)

**❌ NO documentar cuando:**
- Experimento en curso sin resultado definitivo
- "Creemos que podría funcionar" sin prueba
- Investigación parcial sin conclusiones

### **📋 Protocolo Documentación Paso a Paso:**

**1. RESULTADO DEFINITIVO OBTENIDO**
- ✅ Identificar tipo: funciona/falla/arquitectura/investigación
- ✅ Documentar inmediatamente en KNOWLEDGE.md
- ✅ Incluir: qué, cuándo, cómo, por qué (si falla)

**2. DOCUMENTAR CON DETALLE OBJETIVO**
- ✅ Pasos exactos si funciona (para replicar)
- ✅ Error específico si falla (para evitar repetir)
- ✅ Fuentes consultadas con conclusiones útiles
- ✅ Fecha y contexto del resultado

**3. CLASIFICACIÓN PARA REUTILIZACIÓN**
- ✅ Marcar como "patrón reutilizable" si aplica
- ✅ Agregar tags para búsqueda futura
- ✅ Vincular con arquitectura general si relevante

## 👤 **Responsabilidades del Usuario**

**Tu decides:**
- ✅ Cuándo hacer el backup (Claude solo propone)
- ✅ Si continuar tras warning de Claude
- ✅ Cuándo usar restore en emergencia
- ✅ Cuándo documentar (Claude solo propone tras resultado definitivo)

---

# 📝 **PROYECTO RESUMEN (del README.md)**

## 🎯 **Qué hace la aplicación**
Sistema de análisis financiero que procesa movimientos bancarios MSA Galicia, organizándolos por categorías y generando reportes presupuestarios.

## 🚀 **Funcionalidades Principales**
- **Dashboard Multi-Vista**: 5 solapas (Dashboard, Distribución Socios, Reportes, Facturas ARCA, Importar)
- **Sistema Facturas ARCA**: Importación CSV con validación CUIT y 26 campos preservados
- **Importador Excel Dual**: Extractos bancarios + facturas ARCA en componente unificado
- **Arquitectura Multi-Empresa**: Esquemas PostgreSQL separados (msa/pam)

## 🛠️ **Stack Tecnológico**
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI  
- **Backend**: Next.js API Routes + Supabase
- **Base de datos**: PostgreSQL (Supabase)
- **Deploy**: Vercel con auto-deploy

## 📋 **Estado Desarrollo**
### ✅ **Completo**
- Sistema MSA Galicia (extractos + facturas ARCA)
- Dashboard multi-vista funcional
- Arquitectura multi-empresa configurada

### 🔄 **En Desarrollo**
- **Cash Flow**: Vista gestión presupuesto/pagos planificados  
- **Expansión PAM**: Replicar infraestructura para segunda empresa
- **Conciliación**: Matching automático facturas ↔ flujo fondos

---

# 🚨 **TROUBLESHOOTING RÁPIDO**

## ❌ **Herramientas MCP no aparecen**
→ **Ir a DOCS.md** sección "INVESTIGACIÓN MCP AGOSTO 2025"

## ❌ **Error conexión Supabase esquema**
→ **Ir a README.md** sección "Configuración Crítica de Supabase"

## ❌ **Problemas backup/restore**
→ **Ir a DOCS.md** sección "PROTOCOLO DE SEGURIDAD MCP SUPABASE"

## ❌ **Integración ARCA API**
→ **Ir a DOCS.md** sección "INTEGRACIÓN ARCA API"

---

# ✅ **CAMBIOS COMPLETADOS (2025-08-15)**

## 🔧 **Dropdown CATEG en Wizard Templates**
**Estado**: ✅ **COMPLETADO**
**Archivos modificados**: `components/wizard-templates-egresos.tsx`

### **Cambios implementados**:
1. **Interface actualizada**: `DatosBasicos.cuenta_contable` → `DatosBasicos.categ`
2. **Carga automática BD**: `useEffect` carga datos de `cuentas_contables`
3. **Dropdown Select**: Reemplaza Input de texto con Select de shadcn/ui
4. **Formato visual**: "CATEG - cuenta_contable" (ej: "AGUADAS - Aguadas")
5. **Consistencia completa**: Guardado, validación, preview, reset

### **Beneficios**:
- ✅ **Previene errores**: Imposible ingresar códigos CATEG inexistentes
- ✅ **Experiencia mejorada**: Dropdown con descripción legible
- ✅ **Consistencia BD**: Mismo formato que otras tablas del sistema
- ✅ **Mantenimiento**: Cambios en `cuentas_contables` reflejados automáticamente

### **Estructura final Dropdown**:
```typescript
interface CuentaContable {
  categ: string          // Código corto (ej: "AGUADAS")
  cuenta_contable: string // Descripción (ej: "Aguadas")
  tipo: string           // ingreso/egreso/financiero/distribucion
}
```

---

# 💰 **CASH FLOW - IMPLEMENTACIÓN COMPLETADA (PASOS 1-4)**

## 🎯 RESUMEN EJECUTIVO (2025-08-15)

### **✅ PASOS COMPLETADOS**

#### **📋 PASO 1: Hook useMultiCashFlowData**
- **Archivo**: `hooks/useMultiCashFlowData.ts`
- **Funcionalidad**: Consultas unificadas ARCA + Templates 
- **Filtro**: `estado ≠ 'conciliado' AND estado ≠ 'credito'` para ambas fuentes
- **Interface**: CashFlowRow unificada con 13 campos
- **Funciones**: `actualizarRegistro()` y `actualizarBatch()`

#### **📋 PASO 2: Componente vista-cash-flow.tsx** 
- **Archivo**: `components/vista-cash-flow.tsx`
- **UI**: Tabla 10 columnas + 4 cards estadísticas
- **Formateo**: Moneda argentina, fechas locales, responsive

#### **📋 PASO 3: Integración Dashboard**
- **Archivo**: `dashboard.tsx` 
- **Nueva pestaña**: "Cash Flow" con ícono TrendingUp
- **Grid actualizado**: 6 → 7 columnas

#### **📋 PASO 4: Edición Ctrl+Click**
- **Funcionalidad**: Edición inline en celdas editables
- **Editables**: fecha_estimada, fecha_vencimiento, categ, centro_costo, detalle, debitos, creditos
- **Readonly**: cuit_proveedor, nombre_proveedor, saldo_cta_cte
- **Controles**: Save/Cancel, Enter/Escape, validaciones
- **Mapeo**: `detalle` → `descripcion` para templates
- **RLS**: Políticas UPDATE habilitadas

### **🔧 Arquitectura Implementada**
- **Multi-fuente**: ARCA + Templates unificados
- **Ordenamiento**: Por fecha_estimada
- **Estados**: pendiente, debito, pagar, pagado
- **Performance**: Consultas optimizadas con schemas

---

# 🧪 **PRÓXIMO: TESTING RIGUROSO CASH FLOW**

## 📋 **PROTOCOL DE TESTING DEFINIDO**

### **🎯 Preparación Testing**
1. **Limpiar datos**: Dejar solo 1 factura ARCA + 1 cuota template
2. **Testing masivo**: Modificar TODAS las columnas editables de una vez
3. **Verificación MCP**: Comprobar cambios en BD después de cada edición
4. **Debug sistemático**: Atacar errores uno por uno hasta resolverlos

### **🔬 Estrategia Testing**
- **Objetivo**: Verificar que TODAS las columnas editables funcionen correctamente
- **Método**: Cambio simultáneo para detectar todos los errores juntos
- **Validación**: Via MCP para confirmar persistencia en BD
- **Scope**: Tanto registros ARCA como Templates

### **📊 Post-Testing**
- **PASO 5**: Modo PAGOS (botón flotante)
- **PASO 6**: Filtros y ordenamiento avanzado

**🎯 Para desarrollo**: Testing riguroso antes de continuar con nuevas funcionalidades.