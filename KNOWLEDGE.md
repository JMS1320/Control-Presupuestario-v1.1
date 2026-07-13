# 🧠 KNOWLEDGE.md - ARCHIVO MASTER CONSOLIDADO

> **Este archivo contiene**: TODO el conocimiento del proyecto organizado por temas con sistema de tags para búsqueda eficiente.

---

# 📋 **ÍNDICE MASTER**

## 🎯 **Búsqueda Rápida por Status**
- [SISTEMAS COMPLETOS](#sistemas-completos) - Funcionalidades terminadas y funcionando
- [CONFIGURACIONES MASTER](#configuraciones-master) - Setups validados y estables
- [PENDIENTES IMPLEMENTACIÓN](#pendientes-implementación) - Funcionalidades definidas por implementar
- [TROUBLESHOOTING ÚNICO](#troubleshooting-único) - Errores resueltos con soluciones
- [CONOCIMIENTO DESCARTADO](#conocimiento-descartado) - Métodos que NO funcionan
- [ARCHIVO HISTÓRICO](#archivo-histórico) - Diseños completados no activos

## 🏷️ **Búsqueda por Tags Principales**
- `#cash-flow` - Todo sobre sistema Cash Flow
- `#mcp` - Configuración y problemas MCP Supabase
- `#conciliacion` - Sistema conciliación bancaria
- `#backup` - Protocolos backup/restore
- `#templates` - Sistema templates egresos
- `#funcionando` - Configuraciones validadas
- `#pendiente` - Funcionalidades por implementar
- `#error` - Problemas y soluciones
- `#descartado` - Métodos no usar

## 📅 **Por Fecha (más recientes primero)**
- 2025-08-18: Reestructuración documentación
- 2025-08-17: Sistema estados conciliación + extracto bancario
- 2025-08-15: Cash Flow edición inline completado
- 2025-08-14: MCP Supabase configuración Windows

---

# 📊 **ESTADO ACTUAL PROYECTO**

## ✅ **Funcionalidades Completadas (Production Ready)**
1. **Sistema Cash Flow completo** - Edición inline, modo PAGOS, multi-fuente, estados `#cash-flow #completado #2025-08-17`
2. **Conciliación Bancaria Nivel 1-2** - UI reglas, selector cuentas, estadísticas `#conciliacion #ui #2025-08-17` 
3. **Templates Egresos** - Wizard completo, validaciones CATEG `#templates #wizard #2025-08-15`
4. **Sistema Estados** - Pendiente/Conciliado optimiza performance `#estados #bd #2025-08-17`
5. **Vista Extracto Bancario** - 858 registros, filtros, estadísticas `#extracto #ui #2025-08-17`

## 🔄 **En Desarrollo Activo**
- **Próximo objetivo definido**: Reestructuración documentación `#documentacion #2025-08-18`

## 📋 **Pendientes Futuro**
- **Conciliación Bancaria Nivel 3** - Motor automático que aplique reglas `#conciliacion #motor #pendiente`
- **Cash Flow PASO 6** - Filtros y ordenamiento avanzado `#cash-flow #filtros #pendiente`
- **Optimización límite 200 registros** - Evaluación performance vs usabilidad `#extracto #performance #pendiente`
- **Templates funcionalidades avanzadas** - Replicación anual, ajuste inflación `#templates #avanzado #pendiente`
- **Expansión PAM** - Replicar infraestructura MSA `#pam #expansion #pendiente`

## ⚠️ **REGLA IMPORTANTE NUEVA ETAPA:**
**Al retomar objetivos**: Siempre reconfirmar qué está "terminado" vs "pendiente" para evitar complicaciones. El estado puede haber cambiado desde última documentación.

---

# 🏗️ **SISTEMAS COMPLETOS** `#implementado`

## Cash Flow Sistema Completo - FUNCIONANDO `#cash-flow #edicion #estados #2025-08-17`
**Contexto**: Sistema gestión presupuesto/pagos planificados multi-fuente
**Resultado**: ✅ COMPLETADO - 4 pasos implementados exitosamente
**Implementación completa**:

### **🔧 Arquitectura Multi-Fuente:**
- Hook `useMultiCashFlowData` unifica ARCA + Templates
- Filtro inteligente: `estado ≠ 'conciliado' AND estado ≠ 'credito'`
- Interface `CashFlowRow` con 13 campos estándar
- Funciones `actualizarRegistro()` y `actualizarBatch()`

### **🖥️ UI Completa:**
- Componente `vista-cash-flow.tsx` con tabla 10 columnas
- 4 cards estadísticas dinámicas
- Formato moneda argentina, fechas locales, responsive
- Integración dashboard con pestaña "Cash Flow"

### **✏️ Edición Inline (PASO 4):**
- Ctrl+Click para editar celdas
- Campos editables: fecha_estimada, fecha_vencimiento, categ, centro_costo, detalle, debitos, creditos
- Controles Save/Cancel, Enter/Escape
- Validaciones automáticas
- RLS políticas UPDATE habilitadas

### **🔄 Modo PAGOS (PASO 5):**
- Batch operations con checkboxes para selección múltiple
- Función `actualizarBatch()` para cambios masivos eficientes
- Auto-sync fecha_vencimiento → fecha_estimada en modo batch
- Controles fluidos Ctrl+Click + checkboxes
- Parent-child editing: categ/centro_costo Templates → tabla egreso padre

### **🎯 Estados y Flujo:**
- Estados: `pendiente`, `debito`, `pagar`, `pagado`
- Ordenamiento por fecha_estimada
- Performance optimizada con schemas MSA/PAM
- Mapeo `detalle` → `descripcion` para templates

**Ventajas confirmadas**:
- ✅ **Vista unificada**: ARCA + Templates en mismo Cash Flow
- ✅ **Edición granular**: Modificación inline sin modales
- ✅ **Consistencia BD**: Actualización directa tablas origen
- ✅ **Performance**: Consultas optimizadas por esquema

**Patrón reutilizable**: ✅ Sí - Arquitectura multi-fuente escalable
**Tags**: `#cash-flow` `#edicion` `#multi-fuente` `#completado` `#2025-08-17`

---

## Conciliación Bancaria Nivel 1-2 - FUNCIONANDO `#conciliacion #ui #reglas #2025-08-17`
**Contexto**: Motor matching automático Cash Flow ↔ movimientos bancarios
**Resultado**: ✅ NIVEL 1-2 COMPLETADO - UI completa, motor pendiente
**Implementación completa**:

### **🗃️ Base de Datos:**
- Tabla `reglas_conciliacion` con 8 reglas ejemplo
- Columna `estado` en `msa_galicia` (`'Conciliado'` | `'Pendiente'`)
- Índices optimizados para performance
- Soporte multi-banco MSA/PAM

### **🎨 UI Configurador Reglas:**
- Modal fullscreen con tabla reglas por prioridad
- CRUD completo: crear, editar, eliminar, activar/desactivar
- Reordenamiento prioridades con botones visuales
- Formulario validado con campos específicos
- Simulación conciliación con resultados

### **📊 Vista Extracto Bancario:**
- Hook `useMovimientosBancarios` con 858 registros reales
- Stats cards dinámicas con contadores BD
- Filtros por estado + búsqueda texto
- Auto-reload tras conciliación exitosa
- Badges coloreados por estado

### **⚙️ Motor Conciliación (Nivel 1-2):**
- Selector multicuenta antes de ejecutar
- Filtro automático: solo movimientos `estado = 'Pendiente'`
- Update automático: `estado = 'Conciliado'` tras match
- Logs específicos de proceso
- Error handling robusto

**Pendiente Nivel 3**: Motor automático que aplique reglas
**Patrón reutilizable**: ✅ Sí - Sistema reglas configurable escalable
**Tags**: `#conciliacion` `#ui` `#reglas` `#motor` `#completado` `#2025-08-17`

---

## Templates Egresos Sistema - FUNCIONANDO `#templates #wizard #validacion #2025-08-15`
**Contexto**: Carga masiva compromisos sin factura (impuestos, sueldos, etc)
**Resultado**: ✅ COMPLETADO - Wizard completo con validaciones
**Implementación completa**:

### **🧙 Wizard 4 Pasos:**
- Paso 1: Datos básicos con dropdown CATEG automático
- Paso 2: Recurrencia (mensual, anual, cuotas específicas)
- Paso 3: Fechas flexibles (estimada + vencimiento)
- Paso 4: Preview y confirmación

### **💾 Base de Datos:**
- Tabla `egresos_sin_factura` con configuración JSONB
- Tabla `cuotas_egresos_sin_factura` con cuotas generadas
- Tabla `templates_master` para contenedor anual
- Validaciones constraint y tipos

### **🔧 Validaciones CATEG:**
- Dropdown automático desde `cuentas_contables`
- 4 modos validación: estricto, crear, lista, dropdown
- Modal auditoría con logs detallados
- Prevención errores códigos inexistentes

### **🎯 Integración Cash Flow:**
- Mapeo automático 12 columnas Cash Flow
- Estados compatibles con sistema general
- Edición inline desde Cash Flow funcional
- Performance optimizada con schemas

**Ventajas confirmadas**:
- ✅ **Prevents errors**: Imposible códigos CATEG inválidos
- ✅ **UI guided**: Wizard paso a paso sin errores
- ✅ **Flexible**: Cada tipo egreso con lógica específica
- ✅ **Integrated**: Directo a Cash Flow sin fricción

**Patrón reutilizable**: ✅ Sí - Wizard + validaciones para otros formularios
**Tags**: `#templates` `#wizard` `#validacion` `#categ` `#completado` `#2025-08-15`

---

## Sistema Estados Conciliación - FUNCIONANDO `#estados #bd #performance #2025-08-17`
**Contexto**: Separar movimientos conciliados vs pendientes para optimizar motor
**Resultado**: ✅ ÉXITO - Sistema inteligente que solo procesa pendientes
**Implementación completa**:

### **🗃️ Base de Datos:**
- Columna `estado` en `msa_galicia` (`'Conciliado'` | `'Pendiente'`)
- Default `'Pendiente'` para nuevas importaciones
- Índice optimizado para consultas por estado
- Constraint valores válidos implementado

### **🔧 Motor Conciliación:**
- Filtro automático: `WHERE estado = 'Pendiente'`
- Update automático: `estado = 'Conciliado'` tras match exitoso
- Esquemas MSA/PAM soportados
- Logs específicos movimientos procesados

### **📤 Importador Excel:**
- Asignación automática `estado = 'Pendiente'`
- Compatible datos históricos ya conciliados
- Validaciones existentes preservadas

### **🖥️ Vista Extracto Bancario:**
- Stats dinámicas con contadores BD reales
- Tabla 858 movimientos reales visualizados
- Filtros por estado + búsqueda texto
- Auto-reload tras conciliación exitosa
- Formato moneda argentina + badges coloreados

**Ventajas confirmadas**:
- ✅ **Eficiencia**: Solo procesa movimientos que necesitan conciliación
- ✅ **Re-ejecutable**: Múltiples corridas sin re-procesar duplicados
- ✅ **Transparencia**: Vista clara qué está conciliado vs pendiente
- ✅ **Escalabilidad**: Performance optimizada grandes volúmenes
- ✅ **Control**: Reversibilidad y trazabilidad completa

**Flujo operativo**: Import Excel → Pendientes → Motor → Conciliados → Nueva Import
**Patrón reutilizable**: ✅ Sí - Estados aplicable PAM y futuras integraciones
**Tags**: `#estados` `#conciliacion` `#performance` `#bd` `#motor` `#completado` `#2025-08-17`

---

## Import de Pesadas (productivo) — comportamiento `#productivo #pesadas #import #2026-07-09`

Endpoint `app/api/import-pesadas/route.ts` (2 acciones: `?accion=analizar` y `?accion=confirmar`). Modal en `tab-terneros.tsx`.

- **Una fecha por archivo.** Si el Excel tiene fechas distintas → lo **rechaza** (separar en un archivo por fecha).
- **IDV → caravana_oficial** vía `idvACaravana` (padStart 15, espacio tras pos 3). Match contra `productivo.terneros` activos.
- **Clasificación:** `ok` (1 match) · `duplicadas` (>1 match → el usuario elige ternero) · `no_encontradas` (caravana en Excel pero no en BD → "sin vincular" con `ternero_id=null` + `caravana_idv`, o "crear nuevo" ternero) · **`sin_idv`** (fila con peso pero SIN caravana legible → hoy **solo se cuenta y se DESCARTA**, no se guarda). Ver pendiente B-FEAT-15.
- **Columnas del historial = por FECHA.** Importar más pesadas con la **misma fecha** → van a la **misma columna** (no crea columna nueva). Fecha distinta → columna nueva.
- ⚠️ **SIN dedup**: `productivo.pesadas_terneros` solo tiene **PK en `id`** (NO unique por `ternero_id+fecha`, verificado 2026-07-09). Re-importar un animal sobre una fecha ya cargada → **duplica** la pesada en silencio. Ver pendiente B-FEAT-16.
- **Segmentación** (multi-segmentador) excluye animales `activo=false` (bajas/mortandad) aunque tengan pesadas históricas. Las pesadas `ternero_id=null` (sin vincular) NO entran hoy al promedio.

**Tags**: `#productivo` `#pesadas` `#import` `#dedup` `#2026-07-09`

---

## Precios de mercado — scraping entresurcosycorralesya `#productivo #precios #scraping #2026-07-09`

Para poblar precios del análisis de engorde. `app/api/precios-mercado/route.ts` (server-side, evita CORS).

- **Endpoints** (la web carga la tabla por JS; el HTML de `terneros.html`/`terneras.html` NO trae la tabla): `https://www.entresurcosycorralesya.com/ajax-modulo-ternero.php?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (machos: Terneros/Novillitos/Novillos) y `ajax-modulo-ternera.php` (hembras: Terneras/Vaquillonas + "Ternera Holando" que se EXCLUYE). Devuelve tabla HTML: 8 cols (Categoría, Cantidad, Prom.Kilo, **Kilo+**, Kilo−, Prom.Bulto, Bulto+, Bulto−). Se parsea `<td>` por `<tr>`, filtrando filas con "Kg".
- **El route** acepta `sexo=macho|hembra`, parsea los límites de peso del rango (`pesoLo/pesoHi`), timeout 12s, y devuelve error claro si viene vacío.
- ⚠️ **El sitio publica con DEMORA**: los días más recientes vienen **vacíos** (0 bytes). El default de fechas del panel termina 3 días atrás. El usuario reportó (2026-07-09) que el sitio no abría ni desde Chrome → puede haber estado caído.
- **Modelo de precio (acordado con el user):** base = **Kilo+ (máx) asignado al extremo liviano del rango (pesoLo)**, interpolado por peso → escalera; se busca por **kg NETO** (post-desbaste) × (1+prima% calidad). Sexo derivado de la Fuente del segmento.

**Tags**: `#productivo` `#precios` `#scraping` `#mercado` `#2026-07-09`

---

## Mail "Detalle de pago" al proveedor — arquitectura `#mail #gas #pagos #sicore #2026-07-10`

Manda al proveedor el Detalle de pago (PDF) + certificado de retención (si hay SICORE), un mail por pago. **FUNCIONANDO** (testeado 2026-07-10, crea borradores en Gmail).

- **Cola:** `public.mails_pago` (creada 2026-07-09, ver RECONSTRUCCION). Columnas clave: `email_destino, asunto, cuerpo, detalle_pdf` (base64), `retencion_pdf` (base64), `tiene_sicore, adjuntar_detalle, adjuntar_retencion, estado` (pendiente/borrador/enviado/error), `gmail_draft_id`.
- **Fuente única (regla DRY):** `lib/pagos/encolar-mail-detalle.ts` (lógica, UI-agnóstica, devuelve `{ok,email,conCertificado,error}`), `lib/pagos/certificado-retencion.ts` (cert MSA), `lib/pagos/pdf-detalle-pago.ts` (con `returnBase64`). La llaman el **Modal de Pagos** (`vista-facturas-arca`, wrapper con alert) y **Cash Flow** (`encolarMailsSeleccionados`, botón "✉ Encolar mail detalle" — sirve para pagadas). Cash Flow = schema `msa`.
- **Certificado:** matchea por `sicore_retenciones.factura_id IN (ids)` — NO por `comprobantes_arca.fecha_pago` (suele estar NULL). En Cash Flow los ids salen de `row.id` o `row.ids_grupo` (grupos).
- **GAS = Web App** (`gas-mail-detalle/EnviarMailsDetalle.gs`): `doGet(e)` → `prepararBorradores(soloId?)` lee `mails_pago` estado=pendiente (con `?id=` uno solo), crea **borradores** (`GmailApp.createDraft`), marca `borrador`. Deployado en proyecto **SEPARADO** de la cuenta **sanmanuel.sp@gmail.com** (Execute as: Me · Anyone). Config: `SUPABASE_URL='https://lyojiaglcictmboqwxfm.supabase.co'` + anon key.
- **Anti-duplicados:** el disparo desde la app es `fetch(url, {mode:'no-cors'})` (fire-and-forget, no lee respuesta). Para que doble-disparo no duplique: **LockService.getScriptLock()** serializa + guarda `if (m.gmail_draft_id) return`.
- **UI:** panel `PanelMailsPago` (Cash Flow, "✉ Mails de detalle"): editar/togglear/borrar + botones "Enviar Borrador" (por fila, `?id=`) y "Enviar todos los pendientes" (sin id). URL del GAS se pide 1 vez → `localStorage.gas_mails_url`.
- **Cuerpo:** desglose + `Fecha de pago:` (de SICORE `fecha_pago` / estimada / puntos) + aviso de que el comprobante de transferencia llega del banco (`go@bancogalicia.com.ar`, asunto "Aviso de transferencia"). El mail del **lote Galicia es OTRO**, no se mezcla.
- ⚠️ Cambiar el código del GAS ⇒ redeploy "Gestionar implementaciones → Nueva versión" (la URL no cambia). Para envío directo (sin revisar): cambiar `createDraft`→`sendEmail` cuando el user valide.

**Tags**: `#mail #gas #pagos #sicore #detalle-pago #2026-07-10`

---

# 🔧 **CONFIGURACIONES MASTER** `#config #funcionando`

## MCP Supabase Windows CMD Wrapper - FUNCIONANDO `#mcp #windows #cmd-wrapper #2025-08-14`
**Contexto**: Configuración MCP Supabase en Windows con problemas NPX execution
**Resultado**: ✅ ÉXITO - Wrapper CMD resuelve problema Windows
**Configuración exacta**:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@supabase/mcp-server-supabase@latest", "--project-ref=upaygsviflbuwraaawhf"],
      "env": {"SUPABASE_ACCESS_TOKEN": "<TU_TOKEN_SUPABASE>"}   // ⚠️ NUNCA commitear el token real. Antes había uno hardcodeado → ROTARLO en Supabase (ver nota abajo).
    }
  }
}
```
**Validación**: Herramientas `mcp_supabase_*` aparecen en Claude Code
**Problema resuelto**: Windows no ejecuta `npx` directamente, requiere `cmd /c`
**Replicable**: ✅ Sí - Patrón para cualquier MCP en Windows
**Tags**: `#mcp` `#windows` `#supabase` `#configuracion` `#funcionando` `#2025-08-14`

---

## Backup Supabase Docker - FUNCIONANDO `#backup #docker #postgresql #2025-08-17`
**Contexto**: Protocolo backup/restore estructura BD antes modificaciones importantes
**Resultado**: ✅ FUNCIONANDO - Comandos Docker operativos
**Comandos exactos**:

### **🚀 Comando Combinado (usar siempre):**
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
docker run --rm postgres:17 pg_dump "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" --schema-only > schema_backup_$TIMESTAMP.sql && \
docker run --rm -e PGPASSWORD=Monomaniaco13 postgres:17 pg_dumpall -h aws-0-us-east-1.pooler.supabase.com -p 5432 -U postgres.upaygsviflbuwraaawhf --roles-only > roles_backup_$TIMESTAMP.sql && \
echo "✅ Backup completo generado con timestamp: $TIMESTAMP"
```

**Resultado**: Genera 2 archivos: `schema_backup_YYYYMMDD_HHMMSS.sql` + `roles_backup_YYYYMMDD_HHMMSS.sql`
**Incluye**: Estructura completa (tablas, constraints, índices, políticas RLS, esquemas MSA/PAM) + Roles y permisos
**Uso**: Antes de modificaciones importantes BD
**Replicable**: ✅ Sí - Funciona para cualquier proyecto Supabase
**Tags**: `#backup` `#docker` `#postgresql` `#comandos` `#funcionando` `#2025-08-17`

---

## Deploy Vercel Production - FUNCIONANDO `#deploy #vercel #security #2025-08-17`
**Contexto**: Deploy production sin archivos sensibles ARCA
**Resultado**: ✅ ÉXITO - Deploy limpio sin exposición certificados
**Configuración aplicada**:

### **🗃️ Archivos Excluidos (.gitignore):**
```
# ARCA Integration (sensible)
arca-integration/
certificados/
*.crt
*.key
*.p12
```

### **🚀 Deploy Automático:**
- Branch `main` → auto-deploy Vercel
- Branch `desarrollo` → preview URLs
- Variables entorno configuradas correctamente
- Build exitoso sin errores

**Beneficios**:
- ✅ **Seguridad**: Certificados ARCA no expuestos
- ✅ **Performance**: Deploy más rápido sin archivos innecesarios  
- ✅ **Limpieza**: Repositorio enfocado en funcionalidad core
- ✅ **Flexibilidad**: ARCA reintegrable cuando necesario

**Replicable**: ✅ Sí - Patrón para cualquier integración sensible/en desarrollo
**Tags**: `#deploy` `#vercel` `#security` `#arca` `#gitignore` `#production` `#funcionando` `#2025-08-17`

---

# 📋 **PENDIENTES IMPLEMENTACIÓN** `#pendiente`

## Cash Flow PASO 6 - Filtros y Ordenamiento Avanzado `#cash-flow #filtros #pendiente #paso6`
**Contexto**: Completar funcionalidades avanzadas Cash Flow tras PASO 5 exitoso
**Estado**: 📋 PENDIENTE - Funcionalidad definida, implementación requerida
**Funcionalidades requeridas**:

### **🔍 Sistema Filtros:**
- **Por empresa**: MSA, PAM, todas
- **Por estado**: pendiente, pagar, pagado, conciliado
- **Por cuenta contable**: dropdown CATEG
- **Por centro de costo**: dropdown opciones
- **Búsqueda texto**: descripción, proveedor, detalle
- **Por fechas**: rango fecha_estimada, fecha_vencimiento

### **📊 Ordenamiento Múltiple:**
- **Primario**: fecha_estimada (actual)
- **Secundario**: monto, proveedor, cuenta
- **Direccion**: ASC/DESC configurable
- **Persistencia**: recordar preferencias usuario

### **🎯 UX Mejorada:**
- **Filtros persistentes**: mantener entre sesiones
- **Clear all**: limpiar todos filtros
- **Contador registros**: "Mostrando X de Y"
- **Performance**: optimización para 858+ registros

**Dependencias**: Cash Flow PASO 5 completado ✅
**Prioridad**: Media - UX enhancement, no funcionalidad crítica
**Estimación**: 1-2 semanas implementación
**Tags**: `#cash-flow` `#filtros` `#ordenamiento` `#ux` `#pendiente` `#paso6`

---

## Conciliación Bancaria Nivel 3 - Motor Automático `#conciliacion #motor #pendiente #nivel3`
**Contexto**: Completar sistema conciliación con motor inteligente que aplique reglas
**Estado**: 📋 PENDIENTE - Arquitectura definida, motor por implementar
**Objetivo**: Matching automático Cash Flow ↔ movimientos bancarios

### **🤖 Motor Inteligente:**
- **Aplicar reglas**: Procesar tabla `reglas_conciliacion` por prioridad
- **Matching automático**: Algoritmos por tipo regla (monto exacto, descripción, etc)
- **Decision tree**: Si regla falla → continuar siguiente por prioridad
- **Logging detallado**: Qué regla matcheó cada movimiento

### **🎯 Proceso Automático:**
- **Input**: Movimientos `estado = 'Pendiente'` + reglas activas
- **Processing**: Aplicar reglas secuencialmente hasta match
- **Output**: Movimientos `estado = 'Conciliado'` + log proceso

### **📊 Resultados y Reporting:**
- **Estadísticas**: % conciliados automático vs manual
- **Problemas**: Movimientos sin match + sugerencias
- **Performance**: Tiempo proceso, reglas más efectivas
- **Manual override**: Posibilidad intervención usuario

**Dependencias**: Conciliación Nivel 1-2 completado ✅
**Prioridad**: Alta - Funcionalidad core del sistema
**Estimación**: 2-3 semanas implementación + testing
**Tags**: `#conciliacion` `#motor` `#matching` `#automatico` `#pendiente` `#nivel3`

---

## Optimización Límite 200 Registros Extracto `#extracto #performance #pendiente #limite`
**Contexto**: Evaluar límite actual 100/200 registros vs 858 totales disponibles
**Estado**: 💭 PENDIENTE CONVERSACIÓN - Decisión técnica requerida
**Problema**: Balance performance UI vs usabilidad completa

### **🔍 Análisis Actual:**
- **Total registros**: 858 movimientos msa_galicia
- **Límite actual**: 100 inicial, 200 con filtros
- **Hook**: `useMovimientosBancarios` línea 117
- **Performance**: Rendering tabla grande puede ser lento

### **📊 Opciones Evaluación:**
1. **Mantener límite** (100/200) - Conservador, performance garantizada
2. **Aumentar límite** (500/1000) - Más datos, riesgo performance
3. **Paginación real** - UX compleja, development adicional
4. **Scroll infinito** - UX moderna, complexity técnica
5. **Sin límite** - Máxima usabilidad, riesgo performance

### **🎯 Criterios Decisión:**
- **Performance frontend**: Tiempo renderización tabla
- **Ancho banda**: Transferencia datos inicial
- **Casos uso real**: ¿Usuarios necesitan ver 858 registros?
- **UX/navegación**: Facilidad encontrar movimientos específicos

**Dependencias**: Vista extracto bancario funcionando ✅
**Prioridad**: Media - Optimización, no funcionalidad crítica
**Decisión requerida**: Usuario debe evaluar opciones
**Tags**: `#extracto` `#performance` `#limite` `#ux` `#pendiente` `#conversacion`

---

## Templates Funcionalidades Avanzadas `#templates #avanzado #pendiente #replicacion`
**Contexto**: Completar sistema templates con funcionalidades año siguiente
**Estado**: 📋 PENDIENTE - Diseño completado en DOCS.md, implementación requerida
**Objetivo**: Templates auto-replicables con ajustes inteligentes

### **🔄 Replicación Anual:**
- **Copiar template completo**: "Egresos sin Factura 2025" → "2026"
- **Ajuste inflación**: Aplicar % configurable a todos montos
- **Fechas actualizadas**: Cambiar año automáticamente
- **Revisión manual**: Permitir modificaciones pre-activación

### **🧙 Wizard Tipos Recurrencia Complejos:**
- **Cuotas específicas**: Personalizar cada cuota individual
- **Fechas variables**: Diferentes vencimientos por mes
- **Montos progresivos**: Aumentos/descuentos por cuota
- **Excepciones**: Saltar meses específicos

### **✏️ Edición Granular Post-Creación:**
- **Modificar cuota individual**: Sin afectar resto template
- **Regenerar cuotas**: Tras cambio reglas recurrencia
- **Agregar/eliminar conceptos**: Durante año activo
- **Marcar inactivo**: Sin borrar histórico

### **📊 Gestión Multi-Año:**
- **Templates históricos**: Mantener configuraciones años anteriores
- **Comparación anual**: Ver evolución montos/conceptos
- **Backup configuración**: Templates como respaldo setup
- **Import/export**: Compartir configuraciones entre proyectos

**Dependencias**: Templates wizard básico completado ✅
**Prioridad**: Baja - Funcionalidad nice-to-have
**Estimación**: 2-3 semanas implementación completa
**Tags**: `#templates` `#replicacion` `#anual` `#inflacion` `#avanzado` `#pendiente`

---

## Sistema Documentación Objetivo-Based - FUNCIONANDO `#documentacion #protocolo #objetivos #2025-08-18`
**Contexto**: Crear sistema eficiente para gestionar conocimiento y trabajo por objetivos largo plazo
**Resultado**: ✅ ÉXITO - Sistema completo implementado y funcionando
**Implementación completa**:

### **🎯 Protocolo Trabajo por Objetivos:**
- **Carga contexto**: Una vez por objetivo (no por sesión)
- **Trabajo persistente**: Múltiples sesiones con mismo contexto
- **Documentación temporal**: En CLAUDE.md durante objetivo activo
- **Documentación permanente**: En KNOWLEDGE.md al finalizar objetivo
- **Contexto limpio**: CLAUDE.md se vacía entre objetivos

### **📋 Comandos Establecidos:**
```
/iniciar-objetivo [nombre] → Cargar contexto específico desde KNOWLEDGE.md
/avance-objetivo [descripción] → Documentar progreso en CLAUDE.md temporal
/finalizar-objetivo → Volcar todo a KNOWLEDGE.md + limpiar CLAUDE.md
/cambiar-objetivo [nuevo] → Finalizar actual + iniciar nuevo
/documentar-config [tema] → Agregar a configuraciones funcionando
/documentar-error [tema] → Agregar a troubleshooting
/descartar-método [tema] → Agregar a conocimiento descartado
/backup-proponer → Recordar protocolo backup
/mcp-status → Mostrar estado actual MCP
/buscar [tags] → Grep específico en KNOWLEDGE.md
```

### **🏗️ Estructura Híbrida Funcionando:**
- **CLAUDE.md**: ≤300 líneas, centro comando ligero con contexto objetivo actual
- **KNOWLEDGE.md**: Todo el conocimiento consolidado con sistema tags
- **Sistema tags**: `#tema #status #fecha` para búsqueda precisa
- **Índice navegable**: Por status, tags y fecha
- **6 secciones**: Completos, Configuraciones, Pendientes, Troubleshooting, Descartados, Histórico

### **🔍 Sistema Navegación por Tags:**
```bash
# Búsquedas funcionando:
Grep "#cash-flow" KNOWLEDGE.md      # Todo sobre Cash Flow
Grep "#funcionando" KNOWLEDGE.md    # Configuraciones validadas
Grep "#error #solucion" KNOWLEDGE.md # Errores resueltos
Grep "#pendiente" KNOWLEDGE.md      # Por implementar
Grep "#descartado" KNOWLEDGE.md     # Métodos NO usar
```

### **📊 Resultados Medibles:**
- **Reducción archivos**: 6 → 3 MD (50% menos fragmentación)
- **CLAUDE.md**: 666 → 176 líneas (73% reducción)
- **Navegación**: De múltiples archivos → sistema tags unificado
- **Mantenimiento**: De sincronizar 4 archivos → actualizar 1 sección

### **⚠️ Regla Crítica Nueva Etapa:**
**Al retomar objetivos**: Siempre reconfirmar qué está "terminado" vs "pendiente" para evitar complicaciones. El estado puede haber cambiado desde última documentación.

**Ventajas confirmadas**:
- ✅ **Eficiencia**: Contexto cargado una vez por objetivo, no por sesión
- ✅ **Navegación unificada**: Sistema tags elimina saltos entre archivos
- ✅ **Información consolidada**: Todo sobre X tema en una sección
- ✅ **Mantenimiento simplificado**: Solo actualizar sección relevante
- ✅ **Protocolo claro**: Flujo trabajo predecible y sistemático

**Patrón reutilizable**: ✅ Sí - Aplicable a cualquier proyecto documentación compleja
**Tags**: `#documentacion` `#protocolo` `#objetivos` `#tags` `#navegacion` `#funcionando` `#2025-08-18`

---

# 🚨 **TROUBLESHOOTING ÚNICO** `#error #solucion`

## SICORE — TXT no importa en ARCA "debería ser Numérico Positivo" `#sicore #arca #retenciones #2026-07-13`
**Contexto**: El TXT de retenciones que exporta la app (Formato Estándar Retenciones **v9.0**) se sube a ARCA/SICORE. Mayo 2026 (2 quincenas) subió OK; **junio no** → error en cada renglón.
**Síntoma**: "En la línea N el campo **Importe del comprobante / Base de cálculo / Importe de la retención** debería ser Numérico Positivo".
**Causa (NO es bug de la app)**: en ARCA → "Configuración de Importación de Retenciones" el **Separador decimal viene por defecto en PUNTO** (SICORE 9.0), pero el archivo usa **coma** (`728702,36`). Con separador=Punto, ARCA no parsea la coma como número. Mayo funcionó porque estaba en Coma; al actualizar a v9.0 se reseteó a Punto. Los archivos de mayo y junio son idénticos en formato (145 chars, coma, CRLF) → el archivo no cambió.
**Solución**: en ARCA cambiar **Separador decimal de Punto a Coma** (abajo-izquierda del diálogo de config de importación) y re-importar. Alternativa: exportar con punto (ver `exports_app/sicore_bug/*_PUNTO.TXT`, generados con `tr ',' '.'`).
**Estado**: ⏳ pendiente confirmación del usuario de que subió OK. Detalle en `memory/project_sicore_error_importacion_arca.md`.


## MCP Windows NPX Problems - RESUELTO `#mcp #windows #npx #2025-08-14`
**Contexto**: Herramientas MCP no aparecen tras múltiples reinicios Claude Code
**Síntomas**: 
- Configuración `.mcp.json` correcta
- Múltiples reinicios realizados
- Herramientas `mcp_supabase_*` nunca aparecen
- No mensajes error visibles

**Problema identificado**: Windows no puede ejecutar `npx` directamente desde Claude Code
**Solución aplicada**: Wrapper `cmd /c` para comandos NPX
```json
// ANTES (no funcionaba)
"command": "npx"

// DESPUÉS (funciona)
"command": "cmd",
"args": ["/c", "npx", ...]
```

**Resultado**: ✅ Herramientas MCP aparecen correctamente
**Fuentes investigadas**: GitHub Issue #1611, docs Anthropic MCP, múltiples reportes Windows
**Replicable**: ✅ Sí - Aplicar mismo patrón otros MCP Windows
**Tags**: `#mcp` `#windows` `#npx` `#error` `#cmd-wrapper` `#resuelto` `#2025-08-14`

---

## RLS Policy Violations - RESUELTO `#rls #policy #permisos #2025-08-17`
**Contexto**: Error "new row violates row-level security policy" en updates Cash Flow
**Síntomas**:
- INSERT funciona correctamente
- UPDATE falla con RLS violation
- Error específico: política bloquea modificaciones

**Problema identificado**: Políticas RLS solo tenían SELECT/INSERT, faltaba UPDATE
**Solución aplicada**: Agregar políticas UPDATE para tablas afectadas
```sql
-- Ejemplo política UPDATE agregada
CREATE POLICY "Allow UPDATE for authenticated users" ON msa.comprobantes_arca
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow UPDATE for authenticated users" ON cuotas_egresos_sin_factura  
FOR UPDATE USING (auth.role() = 'authenticated');
```

**Resultado**: ✅ Edición inline Cash Flow funciona sin errores
**Validación**: Testing exhaustivo con múltiples updates
**Replicable**: ✅ Sí - Verificar políticas UPDATE en todas las tablas editables
**Tags**: `#rls` `#policy` `#permisos` `#update` `#supabase` `#resuelto` `#2025-08-17`

---

## Validación CATEG Dropdown - RESUELTO `#categ #dropdown #validacion #2025-08-17`
**Contexto**: Error "Could not find the 'categ' column" en templates
**Síntomas**:
- Dropdown CATEG no carga opciones
- Console error sobre columna faltante
- Modal validación no abre

**Problema identificado**: Tabla `cuentas_contables` no tenía columna `activo` requerida
**Solución aplicada**: Agregar columna faltante con default
```sql
ALTER TABLE cuentas_contables ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
```

**Resultado**: ✅ Dropdown CATEG funciona, modal auditoría operativo
**Beneficio adicional**: Sistema validación 4 modos funcionando completo
**Replicable**: ✅ Sí - Verificar schema completo antes implementar UI
**Tags**: `#categ` `#dropdown` `#bd` `#schema` `#columna` `#resuelto` `#2025-08-17`

---

# ❌ **CONOCIMIENTO DESCARTADO** `#descartado #no-repetir`

## Variables ENV para MCP - NO FUNCIONA `#mcp #env #no-funciona #2025-08-14`
**Contexto**: Intento configurar MCP Supabase usando variables de entorno
**Configuración probada**:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_PROJECT_REF": "upaygsviflbuwraaawhf",  
        "SUPABASE_ACCESS_TOKEN": "sbp_...",
        "SUPABASE_READ_ONLY": "true"                     
      }
    }
  }
}
```

**Por qué falló**:
- ❌ Herramientas MCP nunca aparecieron
- ❌ Servidor MCP existe y funciona standalone
- ❌ Parámetros en `env` no son reconocidos por servidor
- ❌ Documentación oficial usa `args`, no `env`

**Lección aprendida**: Usar siempre argumentos CLI según documentación oficial
**NO repetir**: Variables ENV para parámetros específicos del servidor MCP
**Solución correcta**: `--project-ref` y `--read-only` van en `args`
**Tags**: `#mcp` `#env` `#variables-entorno` `#descartado` `#no-funciona` `#2025-08-14`

---

## Docker Restore Masivo - NO ESCALABLE `#backup #docker #restore #no-escalable #2025-08-14`
**Contexto**: Intento restore masivo usando Docker + COPY FROM stdin
**Configuración probada**:
```bash
docker run --rm -i postgres:15 psql --single-transaction \
  --command 'SET session_replication_role = replica' \
  --file /data/data_backup.sql
```

**Por qué falló**:
- ❌ `COPY FROM stdin` no funciona en Docker `run -i`
- ❌ Datos no se transfieren correctamente via stdin
- ❌ 23 registros tomaron ~45 minutos (manual)
- ❌ Proyección 1000 registros: ~48 horas trabajo manual

**Limitaciones identificadas**:
- Docker exec requiere container persistente
- Sintaxis volúmenes Windows + Git Bash problemática
- MCP no diseñado para operaciones masivas
- Proceso manual propenso a errores

**Lección aprendida**: Para restore masivo usar psql nativo, no Docker
**NO repetir**: Docker run con stdin para archivos grandes
**Solución recomendada**: PostgreSQL Command Line Tools nativo
**Tags**: `#backup` `#docker` `#restore` `#masivo` `#descartado` `#no-escalable` `#2025-08-14`

---

## Templates Auto-Modificables - DEMASIADO COMPLEJO `#templates #conciliacion #auto-modificacion #complejo #2025-08-16`
**Contexto**: Intento sistema templates que se automodifica con datos conciliación bancaria
**Concepto probado**: Templates egresos se actualizan automáticamente basado en conciliación histórica

**Por qué se descartó**:
- ❌ **Complejidad excesiva**: Lógica interdependencia templates ↔ conciliación
- ❌ **Debugging difícil**: Cambios automáticos impredecibles para usuario
- ❌ **Datos contaminados**: Templates pierden rol de "presupuesto limpio"
- ❌ **Arquitectura confusa**: Sistemas independientes más simples y claros

**Decisión tomada**: Sistemas independientes
- ✅ **Templates**: Solo para presupuestar (datos limpios)
- ✅ **Conciliación**: Solo para matching histórico
- ✅ **Cash Flow**: Vista consolidada sin modificar fuentes

**Lección aprendida**: Separación responsabilidades es más simple y mantenible
**NO repetir**: Auto-modificación cruzada entre sistemas independientes
**Arquitectura final**: Sistemas independientes + vista consolidada
**Tags**: `#templates` `#conciliacion` `#auto-modificacion` `#descartado` `#complejo` `#2025-08-16`

---

## UI Sin Validaciones CATEG - GENERA ERRORES `#ui #categ #validacion #errores #2025-08-15`
**Contexto**: Input texto libre para CATEG sin validación automática
**Implementación probada**: Campo texto donde usuario escribe código CATEG manual

**Por qué se descartó**:
- ❌ **Errores frecuentes**: Códigos CATEG inexistentes en BD
- ❌ **Inconsistencia datos**: Registros con códigos inválidos
- ❌ **UX pobre**: Usuario no sabe códigos válidos disponibles
- ❌ **Mantenimiento alto**: Limpiar datos inconsistentes manualmente

**Solución implementada**: Dropdown automático con validaciones
- ✅ **Previene errores**: Imposible ingresar códigos inexistentes
- ✅ **UX mejorada**: Usuario ve opciones disponibles con descripción
- ✅ **Consistencia BD**: Solo códigos válidos permitidos
- ✅ **Mantenimiento cero**: Datos siempre consistentes

**Lección aprendida**: Validación automática previene problemas futuros
**NO repetir**: Campos críticos sin validación automática
**Patrón recomendado**: Dropdown + validación para campos con opciones limitadas
**Tags**: `#ui` `#categ` `#validacion` `#dropdown` `#descartado` `#errores` `#2025-08-15`

---

# 📚 **ARCHIVO HISTÓRICO** `#completado #inactivo`

## ARCA API Integration - DISEÑO COMPLETADO `#arca #api #wsfe #homologacion #2025-08-14`
**Contexto**: Automatizar descarga comprobantes ARCA via API oficial WSFEv1
**Estado**: ✅ MVP COMPLETADO - Testing funcional en ambiente homologación
**Motivo histórico**: Removido del repositorio para deploy production limpio

### **🎯 Funcionalidad Implementada:**
- Autenticación WSAA con certificados X.509
- Consulta WSFEv1 facturas recibidas por período  
- Integración BD reutilizando esquemas MSA/PAM
- Validaciones anti-duplicados + CUIT empresarial
- Testing ambiente homologación funcionando

### **📁 Estructura Completa:**
```
arca-integration/
├── lib/ (auth.ts, wsfe.ts, adapter.ts)
├── certificates/ (testing.crt, testing-private.key)
├── scripts/ (generate-certs.sh, test-connection.js)
└── app/api/arca/ (sync-testing, status)
```

### **🔧 Variables ENV Configuradas:**
```env
ARCA_ENVIRONMENT=testing
ARCA_CUIT=20123456789
ARCA_WSAA_URL=https://wsaahomo.afip.gov.ar/ws/services/LoginCms
ARCA_WSFE_URL=https://wswhomo.afip.gov.ar/wsfev1/service.asmx
```

**Roadmap producción**: Certificados oficiales → cron diario → multi-empresa
**Reintegrable**: ✅ Sí - Código completo respaldado, reactivable cuando necesario
**Tags**: `#arca` `#api` `#wsfe` `#homologacion` `#completado` `#removido` `#2025-08-14`

---

*📝 Final del archivo - Total secciones: 6 principales + índice navegable*