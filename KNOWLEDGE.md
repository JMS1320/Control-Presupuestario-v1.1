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

## 🗺️ Dónde vive cada cosa en la app — lo que el nombre no dice `#navegacion #2026-08-19`

Salió al ubicar los 260 pendientes por pantalla. Tres cosas que **no se deducen del nombre de la
solapa** y que hacen perder tiempo cada vez:

**PRESUPUESTO no es sólo proyección: es donde se administran los maestros.** Concentra 10 botones:
proveedores · cuentas contables · actividades · campos · variables · inversiones · sueldos ·
ingresos por actividad · margen · precios y TC. Por eso acumula el doble de pendientes que cualquier
otra pantalla — no está más atrasada, **abarca más**.

**El plan de cuentas NO tiene pantalla propia.** Se toca desde dos lugares:
- **Dashboard** → categorías, interno
- **Presupuesto** → cuentas contables

**TARJETAS no tiene vista propia**: vive dentro de `components/vista-extracto-bancario.tsx`.

## ⚠️ `npm run build` NO valida tipos — usar `type-check:diff` `#build #tipos #2026-08-18`

**Verificado el 2026-08-18**: el build imprimió `✓ Compiled successfully` con **2 errores de tipos
adentro** (un rename dejó una referencia colgada en `useMultiCashFlowData.ts`). Los agarró
`npm run type-check:diff`; el build no.

**Consecuencia práctica:** "compila" no es evidencia de nada. Antes de decir que algo anda:

```bash
npm run type-check:diff    # compara POR ARCHIVO contra el baseline; sale 1 si alguno empeoró
npm run build              # recién después, y para otra cosa
```

**Y aun con las dos en verde, la funcionalidad puede no estar alcanzable.** El mismo día se
implementó la vinculación de anticipos de cobro con tipos y build OK, y el botón **no se dibujaba**
porque dos condiciones filtraban por `tipo === 'pago'`. Compilar ≠ estar disponible: hay que llegar
hasta el botón. Ver `PENDIENTES.md` § A-TEST-32.

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

### **🔗 Templates — hallazgos (2026-07-19, generador Renovar campaña):**
- **El vínculo movimiento↔cuota de template es la columna `template_cuota_id`** en las tablas de movimientos (`public.msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `msa.caja_ams/caja_general/caja_sigot`, `ma.ma_galicia`, tarjetas). NO hay FK formal (se linkea por esa columna sin constraint). Para saber si una cuota está conciliada de verdad, buscar su `id` en `template_cuota_id`.
- **Templates ABIERTOS son año-agnósticos:** el selector de Pago Manual (`vista-cash-flow.tsx:1260`) los trae por `tipo_template='abierto'` + `activo=true`, **sin filtrar `año`** → un abierto (Caja, comisiones) **persiste entre campañas/años solo**, no necesita "renovarse". Los que se renuevan (generan cuotas por período) son los **fijo** + los que tengan `aplica_generacion=true`.
- **anual vs bianual** ya NO se infiere del string `año` — es la columna `periodicidad` ('anual' calendario | 'bianual' campaña jul-jun). El wizard la captura. Ver [[project_generador_renovacion_templates]].

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
- 🔴 **La fecha se CONFIRMA, no se detecta** (2026-08-03). Es editable en el paso 1 y, si el serial
  y el texto de la celda no coinciden, aparece un aviso con las dos opciones. Motivo: un `3/8` mandó
  176 pesadas a marzo en silencio → ver § *Fechas de Excel* en Troubleshooting.
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

## Que la función esté probada no significa que la pantalla la use `#leccion #testing #2026-08-04`

**Aplica a cualquier feature que se construya como lib + UI.**

**Qué pasó.** Se construyó `lib/ganaderia/comercializacion.ts` y se **verificó con datos reales**
—se corrió un script, se mostraron los números, cerraban—. Después se enchufó en la pantalla. De
los 5 bugs que encontró el usuario probando, **dos eran de conexión**: la conversión res→vivo y el
desbaste estaban **correctos en la lib** pero **nunca llegaban a la pantalla**.

- El desbaste no se aplicaba sin destino elegido (el efecto arrancaba con `if (!res) return`).
- La conversión por el rinde se calculaba en la lib, pero al análisis sólo se le devolvían dos
  porcentajes: el precio de la carne terminaba multiplicado por kilos vivos, **72 % de más**.

**La lección.** Verificar el módulo aislado prueba el módulo, no el sistema. **El test que vale es
el de punta a punta**, con la pantalla abierta y un número que se pueda contrastar contra algo
conocido.

**Cómo se caza barato.** Para cada dato derivado, un chequeo de una línea con un valor esperado:
*"el $/kg vivo tiene que ser ~58 % del precio de la carne"*, *"si el desbaste no cambia al pasar de
gordo a invernada, la derivación no corre"*. Van en el `🧪 Cómo probarlo` del manual.

**Corolario, y es el peor de los dos:** un número mal calculado **con un aviso de faltante al
lado** es peor que no tener número. El aviso se ignora y el número se usa. Cuando falta un dato
que cambia el resultado, hay que **negarse a calcular**, no calcular y avisar. Ver
`evaluarOpcion()` y el guard `czListo`.


## Fechas de Excel: un "3/8" NO se puede resolver con certeza `#import #excel #fechas #2026-08-03`

**Aplica a cualquier importador que lea fechas de una planilla.** No es un problema de pesadas.

**Síntoma**: el usuario carga **3/8 (agosto)** y entran **176 pesadas con fecha 8 de marzo**, en
silencio. Nadie se entera hasta que el peso promedio del rodeo hace un pico y vuelve a bajar.

**Causa**: hay **dos fuentes** de la fecha y pueden contradecirse.

| Fuente | Qué es | Cuándo miente |
|---|---|---|
| **El serial** (el número que guardó Excel) | fecha absoluta, sin ambigüedad | si la planilla estaba en locale **US**, Excel interpretó mal lo que el usuario tipeó |
| **El texto mostrado** (`.w`) | conserva el orden de dígitos | ese orden lo pone el **formato de la celda**, que puede ser `m/d` aunque el dato esté bien |

**Ya falló en las dos direcciones, y ése es el punto:**
- **2026-07** — US Excel guardó `05/06` (5 de junio) como *May 6*: **el serial mentía**. Se
  "arregló" priorizando el texto.
- **2026-08-03** — el serial decía *Aug 3* y el formato lo mostraba `8/3`: **el texto mentía**.
  Leerlo como dd/mm lo mandó a marzo.

⚠️ **La lección**: no hay heurística que gane siempre. Cambiar de bando **mueve** el bug, no lo
saca. El primer fix fue exactamente eso y por eso volvió dos semanas después con el signo cambiado.

**Solución**: dejar de adivinar. Se calculan **las dos lecturas**, se propone el serial, y si
difieren la otra viaja como alternativa con los dos botones a la vista. Y sobre todo: **la fecha
es EDITABLE antes de confirmar**, validada también en el endpoint. Una fecha mal leída se
multiplica por todas las filas del archivo en silencio; el arreglo de fondo es que **haya que
confirmarla**, no acertarle.

**Regla general**: si un dato del archivo se aplica a **todas** las filas, tiene que pasar por una
confirmación humana antes de grabarse.

**Dónde**: `app/api/import-pesadas/route.ts` (`parseFecha`) + `components/tab-terneros.tsx`.
Los demás importadores leen el serial (`cellDates:false`) y **no** hacen el truco del texto.

## SICORE — TXT no importa en ARCA "debería ser Numérico Positivo" `#sicore #arca #retenciones #2026-07-13`
**Contexto**: El TXT de retenciones que exporta la app (Formato Estándar Retenciones **v9.0**) se sube a ARCA/SICORE. Mayo 2026 (2 quincenas) subió OK; **junio no** → error en cada renglón.
**Síntoma**: "En la línea N el campo **Importe del comprobante / Base de cálculo / Importe de la retención** debería ser Numérico Positivo".
**Causa (NO es bug de la app)**: en ARCA → "Configuración de Importación de Retenciones" el **Separador decimal viene por defecto en PUNTO** (SICORE 9.0), pero el archivo usa **coma** (`728702,36`). Con separador=Punto, ARCA no parsea la coma como número. Mayo funcionó porque estaba en Coma; al actualizar a v9.0 se reseteó a Punto. Los archivos de mayo y junio son idénticos en formato (145 chars, coma, CRLF) → el archivo no cambió.
**Solución (CONFIRMADA empíricamente 2026-07-13)**: los archivos con **PUNTO** decimal subieron OK con la config de ARCA en **Punto** (el default de v9.0). Se probó generando `exports_app/sicore_bug/*_PUNTO.TXT` (coma→punto con `tr`). NO se probó la vía alternativa (config=Coma + archivos coma), pero según las guías de terceros también debería andar. ⚠️ **No es dato oficial de AFIP** — fue diagnóstico + guías de terceros (gestormax/planillasutiles/axoft) + prueba real del usuario.
**Estado**: workaround manual OK. **PENDIENTE**: que el export de la app genere el TXT con **punto** directamente (hoy usa coma) → ver PENDIENTES. Detalle en `memory/project_sicore_error_importacion_arca.md`.


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
---

## Fechas de corte con "-31" fijo — ROMPE LA QUERY ENTERA `#fechas #supabase #bug #2026-07-29`
**Contexto**: en Presupuesto, al ampliar el horizonte de 13 a 24 meses **desaparecieron todos
los templates** de la vista (sueldos e ingresos seguían bien).

**Causa**: el tope del rango se armaba concatenando `-31`:
```ts
const fechaHasta = `${ultimoMes.anio}-${String(ultimoMes.mes).padStart(2,"0")}-31`
```
Con 13 meses caía en julio (31 días, válido). Con 24 caía en **junio** → `"2028-06-31"` →
Postgres: `date/time field value out of range`. La query fallaba **entera** y devolvía `null`.

**Por qué fue invisible**: el código hacía `const { data: cuotas } = await …` **sin mirar
`error`**. Sin cuotas, el filtro "agrupadores con algún monto > 0" descartaba todos los
agrupadores → tabla sin templates, sin ningún mensaje.

**Solución**: tope **exclusivo** en el primer día del mes siguiente + `.lt()` en vez de `.lte()`:
```ts
const finExclusivo = new Date(ultimoMes.anio, ultimoMes.mes, 1) // mes es 1-based → mes siguiente
const fechaHasta = `${finExclusivo.getFullYear()}-${String(finExclusivo.getMonth()+1).padStart(2,"0")}-01`
… .gte("fecha_estimada", fechaDesde).lt("fecha_estimada", fechaHasta)
```
**NO repetir**: armar fechas de fin de mes por concatenación (`-31`, `-30`). Usar día 0 del mes
siguiente (`new Date(a, m, 0)`) o rango exclusivo.
**Lección transversal**: **siempre desestructurar `error`** en las queries de supabase-js y
loguearlo. Un `data` en `null` silencioso se ve igual que "no hay datos".
**Tags**: `#fechas` `#supabase` `#silent-failure` `#presupuesto`

---

## Componente definido DENTRO de otro — el input pierde el foco al tipear `#react #ui #bug #2026-07-29`
**Síntoma**: en el modal del ciclo ganadero, al editar un porcentaje se perdía la selección
después de **cada tecla**. Borrabas un dígito y tenías que volver a hacer click para borrar el
siguiente.

**Causa**: `Seccion` estaba definido **adentro** de `ModalCiclo`:
```tsx
function ModalCiclo(...) {
  const Seccion = ({ titulo, children }) => (<div>…</div>)   // ❌
  return <Seccion titulo="…"><Input value={f.x} onChange={…} /></Seccion>
}
```
Cada render crea una **función nueva**, o sea un **tipo de componente distinto** para React →
desmonta y remonta todo el subárbol → el `<Input>` se recrea y pierde foco y selección.

**Solución**: definirlo a **nivel de módulo**.

**Ojo con la distinción**: `const campo = (k, label) => (<div>…</div>)` invocado como
`{campo("x", "X")}` **NO tiene el problema** — devuelve elementos inline, no crea un tipo de
componente. El problema es sólo cuando se usa como `<Componente>` en JSX.

**NO repetir**: definir componentes (usados como `<X/>`) dentro del cuerpo de otro componente.
**Tags**: `#react` `#focus` `#remount` `#modal`

---

## Modales más altos que la pantalla — se corta el fondo `#ui #modales #2026-07-30`
**Síntoma**: en modales largos no se llegaba a los botones de abajo; había que hacer zoom out
del navegador. Pasaba en **varios** modales del sistema, no en uno.

**Causa**: `components/ui/dialog.tsx` → `DialogContent` no tenía `max-height` ni scroll. Los
modales que sí funcionaban era porque cada uno se había puesto su `max-h-[90vh] overflow-y-auto`
a mano. Al 2026-07-30 había **~30 sin él**.

**Solución**: se arregla **UNA vez en el componente base**, no modal por modal:
```tsx
// components/ui/dialog.tsx — DialogContent
"… max-w-lg max-h-[90vh] overflow-y-auto …"
```
Los que ya traían su propio `max-h` lo siguen pisando por orden de clases.

**Regla**: cuando algo se repite en muchos componentes que usan un primitivo de `components/ui/`,
mirar primero si se arregla en el primitivo. Es la diferencia entre un cambio y treinta.
**Tags**: `#dialog` `#shadcn` `#overflow` `#un-solo-lugar`

---

## Input que se reformatea mientras se escribe: imposible tipear `#ui #inputs #bug #2026-07-30`

El usuario quiso cargar 85 % y 15 % de ración y quedaron 8 % y 10 %. No fue error suyo.

El campo mostraba `value={fmt(valorDelEstado)}` y guardaba en `onChange`. Al tipear `8` el estado
pasaba a 8, el `value` se volvía `"8,00"` y el cursor saltaba al final: el `5` siguiente caía
después de los decimales. **Cualquier número de más de un dígito era imposible de escribir.**

**La regla**: un input controlado no puede reformatear su contenido en cada tecla. Mientras el
campo está tocado hay que conservar el **texto crudo** y parsear/formatear recién en `onBlur`.

```tsx
const [crudo, setCrudo] = useState<string | null>(null)
value={crudo ?? fmt(valor)}
onChange={e => setCrudo(e.target.value)}
onBlur={() => { if (crudo !== null) { onCommit(parse(crudo)); setCrudo(null) } }}
```

Es la contracara del bug de parseo es-AR (más abajo): allá el problema era **leer** el formato,
acá es **imponerlo antes de tiempo**. Los dos salen de formatear y parsear en el mismo campo.

**Ojo con el guardado**: si el commit pasa en `onBlur`, un `onBlur={() => guardar(item)}` al lado
lee el estado **anterior** — los dos corren en el mismo tick. El guardado tiene que recibir los
cambios explícitos, no leerlos del estado.

**Tags**: `#input-controlado` `#onBlur` `#texto-crudo` `#es-ar`

---

## "El último mes" no se sabe hasta tener la lista entera `#fechas #calculo #bug #2026-07-30`

Un costo marcado "al terminar" (la cosecha) nunca aparecía en un tramo que termina un día 1
— o sea, en el caso normal de un cultivo (oct → abr).

El recorrido mes a mes marcaba `esUltimo = fin >= hasta` sobre la marcha. En marzo `fin` es el
31/3, menor que `hasta` (1/4). Y abril tiene **cero días** de tramo, así que se descartaba antes
de evaluarse. Ningún mes quedaba marcado como último y el costo se perdía en silencio.

**La regla**: "el primero" y "el último" son propiedades de la **lista filtrada**, no de cada
elemento mientras se lo genera. Dos pasadas: armar los buckets con contenido, después recorrerlos
por índice. Vale para cualquier reparto en el que algunos períodos pueden quedar vacíos.

**Tags**: `#dos-pasadas` `#primero-ultimo` `#periodos-vacios` `#mes-partido`

---

## Antes de decir "esa columna está muerta", buscarla en el código `#deuda #datos #2026-07-31`

Se dio por muerta `egresos_sin_factura.codigo_contable` porque 154 de 173 filas decían
`"No lleva"` o `null`. Estaba **en uso**: el motor de conciliación la lee de las reglas y la
estampa en el movimiento, y `"No lleva"` es un **valor con significado** — hay una función
`esValorContableValido()` que busca exactamente esa cadena para saber que ese movimiento no
lleva código contable.

**La regla**: una columna con muchos valores repetidos o "vacíos aparentes" no está muerta hasta
que se la busca en el código. Un `"No lleva"` puede ser una decisión registrada, no un hueco.
Muerta es la que no aparece en ningún `.ts`/`.tsx` **y** está NULL en el 100 % de las filas
(en este proyecto, sólo `cuentas_contables.grupo_cuenta`).

**Tags**: `#columna-muerta` `#valor-centinela` `#antes-de-borrar`

---

## Etiqueta denormalizada: mirar quién la usa como IDENTIDAD `#modelado #ids #2026-07-31`

Antes de renombrar una etiqueta que está copiada en muchas tablas, la pregunta no es *"¿en
cuántas filas está?"* sino **"¿en cuáles es la identidad y no una copia para mostrar?"**.

Caso concreto: `categ` estaba en 776 filas y parecía intocable. Pero el extracto bancario ya
vincula por **UUID** (612 de 661 filas tienen `template_id`, `comprobante_arca_id`, etc.) — ahí
`categ` es sólo una copia para no hacer joins. El **único** lugar donde el texto es la identidad
real son las **77 reglas de conciliación**.

El riesgo pasó de "776 filas" a "77 reglas", que es otra conversación. Y las reglas son
justamente las peores, porque **clasifican hacia adelante**: si escriben un nombre que ya no
existe, cada registro nuevo nace huérfano y nadie se entera.

**Corolario**: el orden de una migración así es siempre el mismo — **primero** que todo apunte
por número, **después** renombrar. Al revés se rompe.

**Tags**: `#renombrar` `#denormalizado` `#identidad-vs-copia` `#orden-de-migracion`

---

## Netear stock: cruzar por NOMBRE de categoría duplica `#ganaderia #modelado #2026-07-30`

Al desglosar la venta de hacienda por categoría, el disponible salía duplicado.

**Por qué**: el mismo animal cambia de nombre según cuándo se vende. Sale `Ternero al Pie` si se
vende dentro de los 45 días del destete y `Ternero Recria` si se vende después
(`categoriaSegunFecha`). Entonces la existencia del destete (`Ternero al Pie`) y el lote que la
consumía podían quedar bajo nombres distintos: no neteaban, y las cabezas se contaban dos veces.

**La regla**: para restar stock hay que cruzar por **de dónde salió el animal**, no por cómo se
lo llama hoy. La identidad de la tropa (`pesada|macho`, `ciclo:<uuid>|hembra`) es estable; el
nombre de la categoría es una etiqueta de presentación que depende de una fecha.

Vale para cualquier stock cuya categoría dependa del momento: hacienda, granos por posición,
cualquier cosa que se reclasifique con el tiempo. Si la clave de agrupación puede cambiar sola,
no sirve como clave de neteo.

**Y el promedio del saldo no es el promedio general.** Si se retiran los más pesados, los que
quedan pesan menos. Hay que restar cabezas **y** kilos, medidos a la **misma fecha** — mezclar un
peso de hoy con uno proyectado a la venta (que ya tiene la ganancia diaria adentro) mete kilos
que todavía no existen.

**Tags**: `#neteo` `#doble-conteo` `#clave-estable` `#promedio-ponderado`

---

## Parseo es-AR: el punto de miles rompe el round-trip `#es-ar #numeros #bug #2026-07-30`
**Rompió dos veces en el mismo módulo**, con síntomas distintos:
1. **Porcentajes**: los defaults venían en fracción con punto (`0.105`) y el parser de montos
   borra el punto → `105` → `/100` → **IVA 105%**. (`0.85` daba bien de casualidad.)
2. **Precios**: la app formatea con `toLocaleString("es-AR")` → muestra `5.700,00`; ese texto
   vuelve a entrar al parser, que hacía `parseFloat("5.700")` → **5,7**.

**La raíz es la misma**: el punto es **separador de miles** en es-AR pero **decimal** para mucha
gente que tipea, y encima el formateo de salida mete puntos que la entrada tiene que entender.
Un `replace(/\./g,'')` a secas rompe `0.5`; un `parseFloat` a secas rompe `5.700`.

**Solución**: `lib/format/numero.ts` → `parseNumeroAR()`, tolerante a las dos escrituras:
```
hay coma            → coma decimal, puntos miles    "7.000,50" → 7000.5
empieza con "0."    → punto decimal                 "0.105"    → 0.105
punto + 3 dígitos   → eran miles                    "5.700"    → 5700
si no               → punto decimal                 "5.75"     → 5.75
```
Más `fmtNumeroAR()` (inverso) y `parsePorcentajeAR()` (% → fracción).

**NO repetir**: escribir el parser inline en cada componente. Si un campo se **formatea** al
mostrarlo, su parser tiene que poder **leer ese mismo formato**.
**Tags**: `#parseAR` `#round-trip` `#toLocaleString` `#un-solo-lugar`

---

## Dos tablas con la misma columna no siempre son duplicación `#modelado #2026-07-31`

Se resistió durante toda una conversación la idea de poner `tipo` en `egresos_sin_factura`
porque `cuentas_contables.tipo` ya existía: "dos fuentes de verdad, van a divergir". El
argumento estaba mal, y el usuario lo cortó con *"ya nos olvidamos de cómo trabaja los
templates dentro de cuentas"*.

**La pregunta correcta no es "¿el dato ya existe en otra tabla?" sino "¿clasifica a la misma
población?"**. Acá no: `cuentas_contables.tipo` clasifica **facturas** (que llegan por
`cuenta_contable`), `egresos_sin_factura.tipo` clasifica **templates** (que no tienen factura —
por eso son templates). Cada tabla clasifica sus propias filas. No hay nada que pueda divergir
porque nunca describen la misma cosa.

Lo que sí era duplicación real: llegar al tipo de un template **cruzando por el nombre de la
categoría**. Eso fallaba en **70 de 123 templates activos** cuya `categ` no está en el plan, y
el fallback por signo mandaba los retiros de socios a egresos operativos ($43,65 M).

**Señal de alarma para la próxima**: si para saber un atributo de X hay que hacer un join por
texto a una tabla de Y, probablemente el atributo sea de X. La normalización que obliga a
adivinar es peor que la columna repetida.

**Corolario**: al agregar la columna, la precedencia va en **una** función
(`resolverTipo()`), no repetida en cada consumidor. Los fallbacks se dejan para lo que se cree
de acá en adelante, y el que se usó se **reporta** (`origen: 'template' | 'plan' | 'signo'`)
para poder marcar en pantalla cuándo el sistema adivinó.

**Tags**: `#duplicacion-aparente` `#poblaciones-distintas` `#join-por-texto` `#cascada`

---

## Un filtro `activo = true` puede romper datos históricos `#bugs #2026-07-31`

`useFinancialData` cargaba los templates con `.eq("activo", true)` para armar el resumen del
dashboard. Parece razonable — pero el resumen mira **movimientos pasados**, y un movimiento de
hace ocho meses cuyo template se dio de baja **perdía su clasificación** y caía al fallback.

**La regla**: filtrar por `activo` sirve para **elegir** (un desplegable, un alta). Para
**interpretar el pasado** hay que traer todo: lo que ya pasó, pasó, aunque el maestro se haya
dado de baja después.

**Tags**: `#activo` `#historico` `#filtro-de-mas`

---

## Si un total se parte en subtotales, el resto tiene que caer en alguno `#ui #totales #2026-07-31`

Al partir la grilla del presupuesto en secciones por `tipo` (EGRESOS / DISTRIBUCIONES) apareció
un agujero silencioso: si una agrupadora tuviera un tipo **sin sección definida**, no se
renderizaría en ninguna fila — pero **seguiría sumando en el TOTAL**, que se calcula aparte
recorriendo todo. El usuario vería un total que no coincide con la suma de lo que tiene delante,
sin nada que se lo indique.

Hoy no puede pasar (`financiero` e `ingreso` dan `no_proyectar` y quedan filtrados en cero),
pero "hoy no puede pasar" no es una garantía: alcanza con que alguien agregue un valor al enum.

**La regla**: cuando un total se descompone en secciones, la asignación a sección tiene que ser
**total** — con un default explícito que capture lo no previsto, no un filtro que lo descarte.
Acá: lo que no tiene sección cae en EGRESOS, que es el default seguro del resto del sistema.

**El olor a evitar**: `items.filter(x => x.tipo === s.tipo)` repetido por sección, sin nada que
garantice que la unión de los filtros sea el conjunto entero. Un `filter` por sección descarta
en silencio; un `switch` con `default` obliga a decidir.

**Tags**: `#subtotales` `#no-cierra` `#default-explicito` `#particion-total`

---

## `AutoMejoras/` es un subproyecto aparte — NO tocar `#repo #2026-08-02`

En la raíz del repo hay una carpeta **`AutoMejoras/`** (untracked, may-2026) con su propio índice,
objetivos y scripts (`automejoras.bat`, `automejoras-pausar.bat`, `automejoras-reanudar.bat`,
`settings-automejoras.json`, `CONFIG.md`, `OBJETIVOS - primeras ideas.md`, …).

**Qué es (usuario, 2026-08-02):** *"era un programa aparte que trabajé para nosotros, en el
relevamiento automático mientras no trabajo yo"*. O sea: una herramienta propia que corre sola
haciendo relevamiento cuando el usuario no está frente a la máquina.

**Regla:** **dejarlo como está.** No moverlo, no `.gitignore`-arlo, no borrarlo, no incluirlo en
la auditoría de dimensiones de documentación — sus `.md` son del subproyecto, no de este repo.
Decisión explícita del usuario al ordenar la documentación (`PENDIENTES.md` § A-DOC-05).

---

## Un cero calculado es indistinguible de un cero real `#presupuesto #bugs #2026-08-03`

El patrón detrás de **casi todos** los agujeros que aparecieron al auditar el Presupuesto
(2026-08-02/03). En todos los casos la pantalla mostraba un número tranquilizador:

| Caso | Qué mostraba | Qué pasaba |
|---|---|---|
| Modo "mismo del año pasado" | $0 en 7 de 8 cuentas | exigía 12 puntos de historia y un gasto anual tiene 1 |
| 3 empleados de sueldos | $0 | los períodos futuros se generaron vacíos |
| Cargas Sociales | $0 desde agosto | las cuotas se agotaron al cerrar la campaña |
| HONORARIOS AMS | nada, en ningún lado | excluido de cuentas *"porque va por sueldos"*, y en sueldos valía cero |
| 4 cuentas del plan | $0 | el usuario las apagó porque no se podían calcular bien |
| ROLLOS | $1 | era el monto de prueba, pero parecía un bug |

**La regla que salió de acá, y que se aplicó en todo el código nuevo:**
cuando falta un dato, **no se calcula cero: se marca "falta"**. `calcularVariable` devuelve
`faltantes[]`, `proyectarEmpleado` devuelve lista vacía en vez de ceros, y el control de cobertura
levanta esos faltantes. Un cero que se muestra igual que cualquier otro cero **no se puede
distinguir de una decisión**, y por eso nadie lo revisa.

**El corolario, que fue el pedido del usuario:** el control tiene que avisar **en las dos
direcciones** — lo que falta *y* lo que se cuenta dos veces. Los agujeros aparecieron de los dos
lados: cuatro templates estaban **de más** en el presupuesto de MSA.

---

## Al recrear una vista se pierden los GRANTs `#supabase #bd #2026-08-03`

`CREATE OR REPLACE VIEW` **no puede sacar columnas**: si la vista cambia de forma hay que
`DROP` + `CREATE`. Y ahí **se pierden todos los permisos**.

Pasó con `public.sueldos_empleados`, que es una vista espejo de `sueldos.empleados` y tenía
`GRANT ALL` a `anon`, `authenticated` y `service_role`. Sin restaurarlos, la app deja de leer
sueldos **sin que nada avise** hasta que alguien abre la pantalla.

**Antes de dropear una vista:**
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='<la vista>';
```
y devolver exactamente eso después del `CREATE`.

⚠️ **Y ojo con el otro lado**: al hacerlo quedó a la vista que `anon` tiene `DELETE` y `TRUNCATE`
sobre esa vista. Es [A-SEC-01](PENDIENTES.md#a-sec-01) — restaurar lo que había era lo correcto en
ese momento, pero refuerza que el módulo Usuarios (A-SEC-03) vale la pena.

---

## Postgres no actualiza la misma fila dos veces en una sentencia `#sql #2026-08-03`

Dos `UPDATE` escritos como CTEs en una sola sentencia, apuntando a **las mismas filas**: el segundo
reporta **0 filas y ningún error**.

Pasó normalizando `'No lleva'` → `'No Lleva'` en `codigo_interno` y `codigo_contable` de
`egresos_sin_factura`: eran las mismas 35 filas, el primer UPDATE las tomó y el segundo no pudo.
Si no se verificaba el resultado, **quedaba la mitad del bug vivo**.

**Regla:** cuando dos escrituras pueden tocar la misma fila, van en **sentencias separadas**. Y
siempre verificar el resultado contra la base, no contra el "success" de la herramienta.

---

## `sticky top-0` necesita un contenedor que scrollee `#ui #css #2026-08-03`

`sticky` se pega al **contenedor de scroll más cercano**, no a la ventana. Y `overflow-x-auto`
crea contenedor de scroll en **los dos ejes** (por CSS, si un eje deja de ser `visible`, el otro
pasa a `auto`).

Resultado: un `<div className="overflow-x-auto">` que crece con el contenido **nunca scrollea
vertical**, así que el encabezado se pega a algo que no se mueve y parece que el `sticky` no anda.

**Fix:** darle altura máxima al contenedor (`max-h-[70vh] overflow-auto`), así el scroll vertical
ocurre adentro y el `sticky` tiene contra qué pegarse. Y las celdas del encabezado necesitan
**fondo propio**: al despegarse del flujo, un fondo transparente deja ver las filas pasando debajo.

---

## El margen ganadero ya estaba en la app, repartido `#margen #productivo #2026-08-03`

Al estudiar el Excel `MARGENES` para llevarlo a la app, el relevamiento mostró que **cinco de las
siete hojas ya existían** como tablas. El margen no era un módulo nuevo: era **una vista**.

| Hoja del Excel | Dónde estaba |
|---|---|
| `has y stock` → hectáreas | `campo_campana_actividad` |
| `has y stock` → carga y % del rodeo | `productivo.stock_ciclos` |
| ciclo real (servicio→preñez→destete) | `productivo.ciclos_cria` |
| ventas | `productivo.stock_lotes` |
| `Precios` | `precios_hacienda` |
| `SUELDOS` | `sueldos_empleados` |

Y `stock_ciclos` tiene los `real_*` al lado de los proyectados: **la columna "Hoy" contra "Presup"
del Excel ya estaba modelada.**

**La lección:** antes de traducir una planilla a la app, mapear hoja por hoja contra lo que existe.
Lo que parece un módulo grande suele ser una consulta sobre datos que ya se cargan.

---

## Los precios de hacienda van por BANDA de peso, y las hembras no `#hacienda #precios #2026-08-03`

`precios_hacienda` no se busca por el nombre de la categoría del rodeo. La lógica canónica está en
`lib/ganaderia/calculo.ts` y tiene cuatro sutilezas que no son obvias:

1. **El peso de venta define la banda**, no la categoría. Un "Ternero al Pie" de 191 kg cotiza en
   `Ternero 180/200`; si se vende más tarde y pesa 210, pasa a `Ternero 200/220` y vale otra cosa.
2. **Las hembras NO cotizan por peso**: van por categoría plana (`Ternera`, `Vaquillona`,
   `Vaca CUT/Descarte`). Por eso no existe "Ternera 180/200" y buscar por rango nunca las encuentra.
3. **Un macho joven que pasa los 320 kg salta a la escalera de invernada.**
4. **El precio se arrastra** al mes siguiente cargado si el mes pedido no está.

Y el peso se cuenta **desde `fecha_peso`**, no desde `fecha_disponible`: si se cuenta desde la
disponibilidad se suma dos veces el engorde que ya está incluido en el peso cargado.

⚠️ `valuarLoteConPrecios()` dice en su comentario que *"es la función que usan tanto Productivo
como Presupuesto, para que den lo mismo"*. **Escribir una versión propia hace que la misma venta
valga distinto en dos pantallas.**

---

## Un costo nunca aplica sobre "todo": lleva su propia base `#margen #costos #2026-08-03`

Al llevar el margen ganadero del Excel a la app apareció dos veces el mismo error, de los dos
lados de la misma moneda:

| | Lo que hacía | Lo que corresponde | Error |
|---|---|---|---|
| **Por hectárea** | × las 175 has del campo | × las **15** de pastura, **÷ 4** años | **47×** |
| **Por cabeza** | × las 260 del rodeo | × los **12** toros · × los **destetados** | **>10×** |

Un `monto_ha` o un `monto_cabeza` **sin base declarada asume "todo"**, y "todo" casi nunca es la
respuesta correcta: el mantenimiento de pasturas no se hace en el campo natural, y la sanidad de
toros no se le aplica a las vacas.

**La solución que quedó**, y sirve para cualquier costo unitario:
- **La superficie o la cantidad son un DATO de la línea**, no del contexto (`has_aplicacion`,
  `base_cabezas`).
- **La amortización es otro dato** (`amortiza_anios`): una pastura que dura 4 años entra al 25 %
  por año. Lo formuló el usuario: *"si dura 5, el 20 % cada año"*.
- **Las bases de cabezas se DERIVAN del ciclo**, no se copian: cambian con la campaña.
- Lo que el modelo todavía no calcula —los toros— va **a mano y anotado**, no estimado.

**Cómo se detecta:** si dos costos con bases distintas dan el mismo número, la base no se está
aplicando. Es la prueba más rápida.

---

## Al cambiar un reporte, la foto anterior ES el control `#reportes #control #2026-08-21`

**El método**, que salió de corregir la Planilla de Hacienda y sirve para cualquier reporte
(subdiarios, Libro IVA, Cash Flow):

1. **Antes de tocar nada**, generar el reporte completo — todos los períodos — y guardarlo.
2. Hacer el cambio.
3. Regenerar en una **carpeta nueva** (nunca encima de la foto anterior) y **comparar celda por
   celda**.
4. **Escribir la predicción antes de mirar el diff.** Ahí está el valor: si predije que sólo se
   mueven dos filas y se movieron cinco, rompí algo. Sin predicción, el diff es un dato; con
   predicción, es un control.

**Lo que rindió en la práctica**: "42 celdas distintas y **0 fuera de la hoja Planilla**" es una
frase que prueba mucho más que "anda bien". Y en otra tanda: *"la hoja Planilla quedó idéntica en
las 7 mensuales, sólo cambió la página del CUT"* — eso descarta de un tiro toda una clase de
regresiones.

⚠️ **El script que genera la foto tiene que replicar la app, y hay que corregirlo junto con ella.**
Si la app se arregla y el generador no, el backup empieza a mentir y el método se da vuelta en
contra. Va escrito en el encabezado del script, con la lista de fixes aplicados.

**Un efecto lateral útil**: al comparar dos corridas apareció un diff de 60+ celdas que **no era un
cambio de contenido, era reordenamiento** — el detalle se ordenaba sólo por fecha y las filas del
mismo día salían en el orden que devolvía Postgres, que cambia con cada `UPDATE`. Se verificó
comparando las filas **como conjunto**. Moraleja: **un reporte que se archiva tiene que salir
siempre en el mismo orden**, o comparar dos versiones se vuelve imposible.

---

## Un roll-forward que "engancha" no prueba que el número esté bien `#reportes #control #2026-08-21`

En un reporte de existencias, el control obvio es que el **saldo inicial de un período sea el final
del anterior**. Sirve, pero **detecta el período en que se produce el error, no el error acumulado**:
un período tranquilo lo pasa intacto y el control da ✓ con el número mal.

Caso real: junio enganchaba perfecto con mayo (427 = 427) y **los dos venían con +12 cabezas de
más**, porque mayo no había tenido ni ventas ni muertes y se limitó a arrastrar el error.

**Los controles que sí prueban algo**, en orden de fuerza:
1. Contra el **mundo físico** (el recuento a campo). Es el único externo de verdad.
2. Contra **la misma cifra calculada por otro camino**: el reporte punta a punta arranca de cero y
   no puede arrastrar, así que si difiere del acumulado mes a mes, hay arrastre.
3. Contra **la misma cifra medida en otra unidad**: cabezas (agregado) contra individuos
   (nominal). El descuadre señala exactamente lo que falta cargar.

Los tres son baratos y ninguno depende de que el cálculo interno "cierre" — que es justo lo que un
cálculo hecho por construcción hace siempre.

---

## La misma cuenta escrita 4 veces: 2 bien y 2 mal `#refactor #2026-08-21`

`movimientos_hacienda` guarda `cantidad` **siempre positiva** salvo en `ajuste_stock` y
`cambio_categoria`. O sea que **el signo no alcanza para saber si un movimiento suma o resta: hay
que mirar el `tipo`**. Esa regla estaba implementada **cuatro veces** en el proyecto — dos
correctas (pestaña Stock y órdenes de aplicación) y dos incorrectas (el `Stock Anterior` de la
planilla y las filas fantasma de terneros, que mostraba **158** animales donde había **42**).

**Dos lecciones que tiran para lados opuestos, y las dos valen:**
- La duplicación es la causa: una sola definición no se puede desincronizar.
- **Pero unificarla no siempre es la jugada.** El usuario decidió tocar **sólo el lugar roto** y
  dejar los dos que funcionan como estaban: *"la app es muy extensa y tiene muchos lugares que
  afectan a otros; cambiar esto podría descompaginar cosas que hoy andan bien"*. Refactorizar
  código que funciona, en el mismo movimiento en que se arregla un bug, **mezcla un cambio
  verificable con uno que no lo es**.

**Y el mismo dato decidió otra cosa**: se corrigió **el reporte** y no el signo guardado en la BD,
justamente porque 2 de los 4 lugares ya dependían de la convención positiva. Contar quién depende de
qué **antes** de elegir el lado a tocar es lo que evitó romper lo que andaba.

---

## Repartir un costo medido: el total es real, la clave es teórica `#costos #productivo #2026-08-26`

Cómo costear algo que se consume en común y se vende por partes — la recría fue el caso, pero sirve
para cualquier insumo compartido.

**1 · Comprar no es consumir.** La compra entra a un stock (es un activo); el costo es el consumo.
Con eso, **el sobrante se queda en el stock y no se le carga a nadie** — y desaparece la necesidad
de inventariar en cada venta, que era el nudo del problema.

**2 · El total no se estima, se mide**: `stock inicial + entregas − stock final`. Y el corte existe
**cuando hay una medición**, no cuando llega un camión.

**3 · La clave sólo reparte.** Como el total ya es real, la clave no puede inventar ni perder nada:
las participaciones suman 1. Eso la vuelve barata de discutir — se puede cambiar el criterio y **el
total no se mueve**.

**4 · Y el parámetro que uno creía input, sale de dividir.** En vez de suponer *"comen el 1,5 % del
peso vivo"*:
```
% real = consumo medido ÷ (peso × días del rodeo)
lo de cada uno = ese % × su peso × sus días
```
El `%` deja de ser un supuesto que se carga y pasa a ser **un resultado que se mira y se juzga**. Dio
1,07 / 1,46 / 1,54 % — creciente, coherente. Si diera 0,4 %, falta una entrega.

⚠️ **Qué es exacto y qué es convención, y conviene decirlo:** el **total** es exacto; los
**parciales** llevan convenciones (a qué grupo se le carga el animal que murió antes de que la venta
existiera). Pero la convención **mueve plata entre grupos y nunca cambia el total** — por eso el
total es el control de los parciales.

**Y una regla que apareció en dos lugares distintos**: si el reparto es proporcional a una clave,
**repartir N grupos a la vez da lo mismo que repartir 2 y subdividir**. Sirve para agregar aperturas
sin rehacer el cálculo.

---

## Escribir el control encuentra errores que revisar el cálculo no `#control #2026-08-26`

Tres errores reales aparecieron **al escribir el control**, no al revisar la cuenta. Ninguno lo
habría encontrado releyendo el código:

| Error | Lo destapó |
|---|---|
| El `Stock Anterior` sumaba ventas y muertes (**16 cabezas**) | encadenar las planillas: el saldo de un mes tenía que ser el inicio del siguiente |
| Costear a un **precio promedio del período** le cargaba a lo vendido maíz comprado **después** | el control de plata punta a punta: comprado = imputado + remanente |
| El valor de entrada usaba el **promedio del grupo** por la cantidad de sobrevivientes (**$802.396**) | el control de mortandad: entrada de los vivos + los muertos = entrada de los que entraron |

El patrón: **un control que cruza dos caminos independientes hacia el mismo número**. No verifica
que la cuenta esté "bien hecha" — verifica que **dos maneras de llegar den lo mismo**, y ahí es
donde aparece lo que uno no estaba mirando.

**Y a veces el control no encuentra un error de cálculo sino un dato mal contado.** Simulando el
stock día a día apareció que **ninguna ración era posible** en marzo: 1.740 kg no alcanzaban para 197
cabezas durante los 56 días hasta la entrega siguiente. Probando fechas de inicio, la única
compatible con los 3 kg/día declarados era mayo. El usuario lo confirmó con el recibo.
**No faltaban 25 toneladas: sobraban 56 días.**

---

## Una maqueta en Excel antes de codificar — con fecha de vencimiento `#metodo #2026-08-26`

Antes de llevar un modelo de cálculo a la app, conviene **maquetarlo en Excel** — pero con dos
condiciones que lo separan de un prototipo cualquiera:

1. **Con los datos REALES del sistema, generados por script.** Un ejemplo inventado valida la
   fórmula pero **esconde los agujeros de datos**, que suelen ser la mitad del problema. Con datos
   reales la maqueta además ya contesta la pregunta del negocio.
2. **Con fórmulas de Excel, no con valores.** Si trae resultados es un informe; si trae fórmulas es
   auditable. Una hoja **día a día** donde se ve la decisión de cada jornada vale más que un total
   correcto, porque permite discutir el criterio y no sólo el número.

⚠️ **Y con fecha de vencimiento declarada adentro del propio archivo**: cuando la app lo calcule, el
Excel **deja de ser la herramienta y pasa a ser el caso de prueba**. Si sobrevive como herramienta,
se convierte en una segunda fuente de verdad — y este proyecto ya tiene esa cicatriz.

**Lo que rindió**: iterar el criterio cuesta segundos en Excel y minutos en la app. En una sola
sesión el usuario corrigió el modelo cinco veces —la fecha de inicio, la clave de reparto, el
desbaste en la entrada, los destetados, la mortandad—. Cada corrección en código habría costado diez
veces más.

**Y un subproducto**: el resumen de una carilla, aparte del archivo grande. El usuario lo pidió con
una frase que vale como criterio general — *"no tengo manera de auditar todo, sería larguísimo"*.
La herramienta de trabajo y el informe **son dos documentos distintos**, y el informe tiene que
llevar una sección de **"qué hay que creer para que esto valga"**, ordenada de mayor a menor impacto.

---

## Medido y proyectado no se actualizan igual `#control #productivo #2026-08-27`

Cuando mejora un dato de origen —una pesada, un precio— hay que saber qué se mueve. Y **medido y
proyectado se comportan al revés de como uno espera**:

| Al cambiar el peso de los animales | Qué pasa |
|---|---|
| Consumo **proyectado** (`% del peso vivo × peso × días`) | **el total cambia** |
| Consumo **MEDIDO** (`había + entró − quedó`) | ⚠️ **el total NO se mueve** · cambia **el reparto** |

> Si el animal pesaba más, **no comió más de lo que se midió**: comió **una porción mayor de lo
> mismo**. El peso mueve *quién paga*, no *cuánto se consumió*.

Es la consecuencia directa de que **la clave sólo reparte**. Y tiene un efecto práctico útil:
corregir un peso hacia atrás **no puede romper el control de plata**, porque el total sigue siendo
el medido. Sólo se mueve la columna de participaciones.

---

## Un número derivado no tiene dónde ponerse hasta que existe el campo `#diseño #2026-08-27`

Dos pesadas del mismo grupo no sólo actualizan el peso: **miden la ganancia diaria real**
(`peso nuevo − peso viejo ÷ días`). Ese dato existía desde siempre y **no se usaba** — porque la
ganancia salía de la actividad y no había dónde escribir la de un lote concreto.

El día que se agregó `lote_tramos.ganancia_diaria_kg`, el dato derivado **encontró destino**: la
pesada mide, el tramo lo guarda, la curva lo usa.

**La lección es sobre el orden**: el campo parecía un detalle de edición y era la condición para
que un cálculo entero sirviera. Cuando un dato observable no se aprovecha, conviene preguntarse si
lo que falta no es el cálculo sino **el lugar donde guardarlo** — y eso es una instancia de la
regla *dejar el campo previsto desde el día 1 aunque arranque vacío*.

---

## La campaña la decide la fecha del hecho, no de dónde cuelga el registro `#presupuesto #2026-08-27`

Un lote de venta se atribuía a una campaña por su `ciclo_id`. Los lotes de recría cuelgan de
`ciclo_recria_id` —otra columna—, así que tenían `ciclo_id` nulo, y el filtro
`campania == null || campania === campana` los dejaba pasar **en todas las campañas a la vez**.

**El fix no fue rellenar `ciclo_id`: fue dejar de preguntarle.** La campaña sale de la fecha del
hecho — `fecha_venta_estimada` para lo proyectado, `fecha_venta` para lo real— igual que ya salía
para las transferencias internas.

📌 **Y el usuario lo generalizó mejor de lo que estaba planteado**: *"desarrollar sin relacionar a
la campaña siempre parece que dará estos errores"*. No era un problema de ese filtro: **es que
cualquier cosa que no diga a qué período pertenece va a terminar contada de más o de menos**. Un
registro cuya fecha no manda es un registro que aparece donde no debe.

---

## Un total que cierra no prueba que las partes estén bien `#control #2026-08-28`

Al terminar de cargar el maíz, el control de plata daba **$45 de diferencia** sobre $17,4 M. Cerraba.
Y adentro había dos errores de **$1,3 M cada uno**:

```
FC 13/07   imputada de MENOS por  $1.310.750
FC 14/08   imputada de MÁS por    $1.310.795
                                  ───────────
         diferencia global:            $45
```

Los dos errores eran **el mismo hecho visto al revés** —un anticipo mal imputado— así que se
compensaban por construcción. **Ningún total los podía ver.**

**La regla que sale de ahí:** un control agregado tiene que exigir que **cada parte cierre por
separado**, no sólo la suma. Si las partes son N, el control son N+1 comparaciones y no una.

📌 Y es la segunda vez que este proyecto se lo come: la primera fue el reparto del consumo, donde
la clave sumaba 1 y aun así había grupos mal. **Cuando dos errores nacen del mismo hecho, tienden a
tener signos opuestos** — y esa es exactamente la condición que anula un total.

---

## Un tope silencioso no da error: da menos resultados `#control #2026-08-28`

El buscador de facturas precargaba *las últimas 400* de cada origen y filtraba en el navegador. El
usuario buscó una cuota por tres caminos distintos y no aparecía por ninguno.

No fallaba el filtro: **había 591 cuotas más nuevas y la fila nunca se cargaba.**

> **`limit(N)` no distingue "no hay" de "no traje".** Y para el que mira la pantalla, las dos se
> ven igual: una lista vacía.

**Cuándo se puede precargar y cuándo no**: precargar sirve para *mostrar algo sin escribir* —las
recientes, las del proveedor elegido—. Para **buscar** hay que ir al servidor, porque lo que se
busca suele ser justamente lo viejo. Tener las dos cosas es correcto; tener sólo la primera y
llamarla búsqueda, no.

**Y falta un tercer uso, que es el que volvió a morder al día siguiente** (2026-08-29, A-BUG-90):
**leer un vínculo que ya existe**. Ahí el tope no es "menos cómodo", es **incorrecto**. El costo de
alimentación no mostraba el primer tramo —21.560 kg, el 35 % del total— porque el respaldo estaba
fuera de las últimas N y el vínculo quedaba sin precio. Tres pantallas distintas cometían el mismo
error, y una de ellas ni siquiera consultaba el segundo origen.

> **Ofrecer una lista y resolver una referencia son dos operaciones distintas.** Ofrecer admite
> tope: el usuario ve lo que hay y puede escribir para buscar más. **Resolver no lo admite nunca**,
> porque no hay nadie a quien pedirle que escriba: la fila ya eligió su factura hace tres semanas.

**La forma de no repetirlo** es que se note en el nombre. Quedaron dos funciones separadas —
`traerRespaldos()` (con tope, para ofrecer) y `respaldosPorId()` (sin tope posible, para resolver)—
en vez de una con un parámetro. Un parámetro se olvida; dos nombres obligan a elegir.

---

## Un input que reformatea en cada tecla es imposible de editar `#ux #2026-08-28`

Un campo controlado que guarda y vuelve a formatear en cada `onChange`:

```
escribís "1"   →  se guarda 1  →  se redibuja "1,000"  →  el cursor salta
escribís "1,0" →  imposible: ya hay "1,000" adelante
```

Y borrar es peor. El usuario lo describió como *"no responden bien, borrar, escribir desde cero"* —
sin poder explicar la causa, que es lo típico: **el síntoma se siente, el mecanismo no se ve**.

**El patrón que lo resuelve** —usado ya en tres campos de este proyecto— es un **borrador por
campo**: se muestra el texto crudo mientras tiene foco y se formatea y guarda en el `onBlur`.

---

## Derivar un precio dividiendo sólo vale si el papel cubre exactamente eso `#costos #2026-08-28`

`precio = neto ÷ cantidad entregada` parece obvio y es una trampa: **sólo da bien si la factura
cubre exactamente esa entrega**. Con la de Longo —25 t facturadas, 20,1 entregadas— dio **$332,71**
en vez de **$267,50**.

Y lo peor: **el control quedaba conforme**, porque `20.100 × 332,71` da justo el neto. El error
se había comido el anticipo metiéndolo dentro del precio, y el número cerraba con el error adentro.

**Dos cosas ayudan y ninguna es un cálculo mejor:**
1. **Mostrar la división** — `$6.687.500 ÷ 20.100 = 332,71` — con la pregunta *"¿la factura cubre
   sólo esta entrega?"*. A la vista, se caza al cargarlo.
2. **Comparar contra los pares**: si una entrega del mismo insumo queda a un precio muy distinto
   de la mediana de las otras, avisar. Es el control que no depende de que alguien mire la cuenta.

⚠️ El dato que resolvería esto de raíz —**cuántos kilos declara la factura**— no está en ningún
lado, y sin él ninguna fórmula puede distinguir un precio raro de una factura parcial.

---

## Un parámetro fijo para algo estacional erra siempre, en los dos sentidos `#presupuesto #productivo #2026-08-29`

Primera comparación entre el consumo **medido** y el **proyectado**, posible recién cuando hubo
mediciones de silo. La receta de recría dice `racion_pct_pv = 1,5 %`. Lo medido:

| Tramo | días | % del peso vivo |
|---|---|---|
| 16/03 → 24/06 | 100 | **0,43 %** |
| 24/06 → 24/07 | 30 | **1,35 %** |
| 24/07 → 24/08 | 31 | **1,51 %** |

**La receta no está mal: describe otra cosa.** El 1,5 % es la suplementación **de invierno**, y pega
casi exacto con el último tramo. En otoño hay pasto y el suplemento es un cuarto de eso.

> **El error no es el valor, es la forma del parámetro.** Un escalar no puede representar algo que
> depende de la estación, y **ningún valor lo arregla**: 1,5 % sobreestima el año entero (2,2×,
> ~$19,7 M), y el promedio 0,69 % subestimaría el invierno — que es justo cuando el gasto duele.

**La trampa de "ajustarlo al promedio"** es que parece el arreglo obvio y produce un número que
cierra contra el pasado y falla contra el futuro mes a mes. Si el parámetro tiene que variar en el
tiempo, hay que **darle esa dimensión**, no elegirle mejor el punto.

**Cómo se detecta en cualquier otro lado**: cuando la comparación medido-vs-proyectado da un error
que **cambia de signo o de tamaño según el período** —en vez de un sesgo parejo—, el parámetro no
está mal calibrado: le falta un eje. Un sesgo parejo sí se arregla con un valor nuevo.

📌 Aplica igual a la mezcla de la dieta (85/15 en la receta, ~91/9 en el último mes) y a cualquier
coeficiente productivo con estacionalidad. Ver `PENDIENTES.md` § A-FEAT-68 y A-FEAT-69.

---

## El ruido también miente: un control que no puede estar en verde `#control #2026-08-29`

Contrapartida de *el silencio miente*, y menos obvia.

El control *«lo comprado está explicado»* comparaba **todo lo comprado** contra la identidad
`consumo + cierre − apertura`. Se puso en rojo con todo perfectamente cargado, porque había una
entrega **posterior a la última medición** — mercadería real, en el silo, que ninguna medición
confirmó todavía.

**El problema no fue el falso positivo: fue que iba a pasar siempre.** Cada vez que llega un camión
entre dos mediciones, o sea la mayor parte del tiempo.

> **Un control que está en rojo la mayor parte del tiempo entrena a ignorarlo.** El día que
> descuadre algo de verdad va a estar rojo igual que ayer, y nadie lo va a mirar.

**La regla que queda:** antes de dar por bueno un control, preguntarse *¿existe un estado normal de
operación en el que este control esté en rojo?* Si la respuesta es sí, **el control está mal
formulado**, aunque la identidad que verifica sea cierta.

**Cómo se arregla, casi siempre**: el control estaba mezclando dos preguntas distintas. Separarlas
da un control que sí puede cerrar (*«lo comprado dentro del período medido»*) y un dato informativo
al lado (*«24.920 entregados después de la última medición: los va a imputar la próxima»*). Lo
segundo sigue **visible** —no se descarta en silencio—, pero no grita.

📌 Contraparte necesaria: no usar esto como excusa para bajar el umbral de un control que sí debe
gritar. La pregunta no es *"¿molesta?"* sino *"¿puede estar en verde cuando todo está bien?"*.
