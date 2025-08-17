# 📚 DOCUMENTACIÓN HISTÓRICA Y TROUBLESHOOTING

> **Este archivo contiene**: Históricos de configuración, troubleshooting completo, testing realizado y diseños completados no en desarrollo inmediato.

---

# 🔗 INTEGRACIÓN ARCA API - WEB SERVICES OFICIALES

## 📊 Resumen Ejecutivo
**Estado**: ✅ **MVP COMPLETADO** - Testing funcional
**Objetivo**: Automatizar descarga de comprobantes ARCA via API oficial
**Beneficio**: Eliminar proceso manual de descarga CSV semanal

### **🎯 Funcionalidad Implementada**
- **Autenticación WSAA**: Certificados X.509 + tokens automáticos
- **Consulta WSFEv1**: Facturas recibidas por período
- **Integración BD**: Reutiliza esquemas MSA/PAM existentes
- **Validaciones**: Anti-duplicados + CUIT empresarial
- **Testing**: Ambiente homologación ARCA funcionando

## 📁 Estructura de Archivos ARCA

### **Módulos Core (`arca-integration/`)**
```
arca-integration/
├── lib/
│   ├── auth.ts              # Autenticación WSAA + certificados
│   ├── wsfe.ts              # Cliente WSFEv1 + consultas
│   └── adapter.ts           # Mapeo API → BD + validaciones
├── certificates/
│   ├── testing.crt          # Certificado auto-firmado testing
│   ├── testing-private.key  # Clave privada testing
│   └── production/          # Certificados producción (futuro)
└── scripts/
    ├── generate-certs.sh    # Script generación certificados
    └── test-connection.js   # Script prueba conexión
```

### **API Endpoints (`app/api/arca/`)**
```
app/api/arca/
├── sync-testing/route.ts    # ✅ Sincronización testing
├── sync-production/         # 🔄 Sincronización producción (futuro)
└── status/route.ts          # 📊 Estado servicio + diagnósticos
```

## 🔧 Configuración Técnica

### **Variables de Entorno**
```env
# ARCA API Configuration
ARCA_ENVIRONMENT=testing  # testing | production
ARCA_CUIT=20123456789     # CUIT testing (30617786016 para MSA real)

# Testing URLs (actuales)
ARCA_WSAA_URL=https://wsaahomo.afip.gov.ar/ws/services/LoginCms
ARCA_WSFE_URL=https://wswhomo.afip.gov.ar/wsfev1/service.asmx

# Production URLs (futuro)
# ARCA_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
# ARCA_WSFE_URL=https://servicios1.afip.gov.ar/wsfev1/service.asmx
```

### **Dependencias Nuevas**
```json
{
  "fast-xml-parser": "^4.x"  // Parsing SOAP responses
}
```

## 🚀 Comandos y Scripts

### **Testing**
```bash
# Probar endpoint testing
curl -X POST http://localhost:3000/api/arca/sync-testing \
  -H "Content-Type: application/json" \
  -d '{"empresa": "MSA", "diasAtras": 30}'

# Verificar estado servicio  
curl http://localhost:3000/api/arca/status
```

### **Generación Certificados**
```bash
# Testing (auto-firmados)
cd arca-integration/certificates
openssl genrsa -out testing-private.key 2048
openssl req -new -key testing-private.key -out testing.csr
openssl x509 -req -in testing.csr -signkey testing-private.key -out testing.crt
```

## 📋 Flujo de Datos

### **CSV Manual → API Automática**
```
ANTES (Manual):
Portal ARCA → Descargar CSV → Upload app → Procesar

DESPUÉS (Automático):  
Cron/Trigger → ARCA API → Procesar directo → BD
```

### **Mapeo de Datos**
```typescript
// CSV: "Fecha de Emisión" → API: fecha_emision
// CSV: "Nro. Doc. Emisor" → API: cuit  
// CSV: "Imp. Total" → API: imp_total
// Mismo formato final → msa.comprobantes_arca
```

## ✅ Testing Completado

### **Funcionalidades Verificadas**
- ✅ **Certificados auto-firmados**: Generación OpenSSL
- ✅ **Autenticación WSAA**: Token 24h automático
- ✅ **Consulta WSFEv1**: Facturas por período
- ✅ **Validaciones**: CUIT empresa + anti-duplicados  
- ✅ **Inserción BD**: Esquema MSA/PAM existente
- ✅ **Error handling**: SOAP errors + network

### **Datos Testing**
```json
{
  "ambiente": "homologacion",
  "cuit_testing": "20123456789",
  "datos": "ficticios_arca",
  "certificados": "auto_firmados"
}
```

## 🎯 Roadmap Producción

### **Fase 1: Certificados Oficiales** (1 semana)
- [ ] Tramitar certificado ARCA producción MSA (CUIT: 30617786016)
- [ ] Configurar ambiente producción  
- [ ] Testing con datos reales MSA

### **Fase 2: Automatización** (1 semana)  
- [ ] Cron job sincronización diaria
- [ ] UI botón "Sincronizar ARCA" en dashboard
- [ ] Notificaciones email resultados

### **Fase 3: Multi-Empresa** (1 semana)
- [ ] Certificado PAM (CUIT: 20044390222)
- [ ] Sincronización dual MSA+PAM
- [ ] Dashboard consolidado

## 🔍 Debugging y Logs

### **Logs Importantes**
```typescript
// Autenticación WSAA
🔐 Enviando request WSAA a: [URL]
✅ Respuesta WSAA recibida
🎫 Token válido hasta: [timestamp]

// Consulta WSFEv1  
📡 Consultando comprobantes ARCA desde [fecha] hasta [fecha]
📊 Comprobantes obtenidos de ARCA API: [cantidad]

// Procesamiento
💾 Insertando comprobante [N]...
⏭️ Comprobante ya existe, ignorando
✅ Sincronización completada: [nuevos] nuevos, [duplicados] duplicados
```

### **Errores Comunes**
```
❌ Error en ARCA API: Certificate expired
→ Renovar certificados producción

❌ Error WSFEv1: Token expired  
→ Regenerar token WSAA (automático cada 24h)

❌ No se puede conectar a msa.comprobantes_arca
→ Verificar permisos Supabase esquema
```

## 📊 Comparativa: CSV vs API

| Aspecto | CSV Manual | ARCA API |
|---------|------------|----------|
| **Proceso** | Manual semanal | Automático diario |
| **Datos** | Hasta descarga | Tiempo real |
| **Errores** | Humanos frecuentes | Validaciones automáticas |
| **Multi-empresa** | 2 procesos separados | 1 proceso integrado |
| **Trazabilidad** | Archivo origen | API + timestamp |
| **Mantenimiento** | Alto (manual) | Bajo (renovar certs) |

## 🔒 Seguridad y Compliance

### **Certificados**
- **Testing**: Auto-firmados (temporal)
- **Producción**: Firmados por ARCA (oficial)
- **Renovación**: Manual anual
- **Almacenamiento**: Fuera del repositorio

### **Tokens WSAA**
- **Duración**: 24 horas
- **Renovación**: Automática
- **Almacenamiento**: Memoria (no persistir)

## 📞 Contactos y Soporte

### **ARCA Oficial**
- **Consultas técnicas**: webservices-desa@arca.gob.ar
- **Documentación**: https://www.afip.gob.ar/ws/
- **Status servicios**: https://www.afip.gob.ar/ws/monitoreo/

### **Próximos Pasos**
1. **Aprobar testing**: Revisar logs y resultados
2. **Certificados producción**: Tramitar en portal ARCA
3. **Go-live**: Reemplazar proceso manual CSV

---

# 🔗 CONFIGURACIÓN MCP SUPABASE

## 📊 Estado Actual
**✅ CONFIGURADO** - MCP Supabase en modo read-only

### **🔧 Configuración Final Funcional (DEPRECADA - No funciona en Windows)**
```json
// .mcp.json (raíz del proyecto) - CONFIGURACIÓN ANTERIOR SIN WRAPPER
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
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

### **🔧 NUEVA Configuración Windows (ACTUAL 2025-08-14)**
```json
// .mcp.json (raíz del proyecto) - CON WRAPPER CMD PARA WINDOWS
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

## 🚨 TROUBLESHOOTING MCP - HISTORIAL DE PROBLEMAS

### **❌ Configuración que NO FUNCIONÓ (Variables ENV)**
```json
// DESCARTADO - Configuración con variables de entorno
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_PROJECT_REF": "upaygsviflbuwraaawhf",  // ❌ NO va en env
        "SUPABASE_ACCESS_TOKEN": "sbp_...",
        "SUPABASE_READ_ONLY": "true"                     // ❌ NO va en env
      }
    }
  }
}
```

**¿Por qué falló?**
- ❌ Las herramientas MCP nunca aparecieron en Claude Code
- ❌ El servidor MCP existe (`npx @supabase/mcp-server-supabase` funciona)
- ❌ Pero parámetros en `env` no son reconocidos por el servidor

### **🔍 Proceso de Diagnóstico Realizado**

**1. Verificación inicial:**
- ✅ Token correcto: `sbp_dc3586c6770fdbadda8899e9523b753ba3b4a105`
- ✅ Project ID correcto: `upaygsviflbuwraaawhf`
- ❌ Configuración incorrecta (env vs args)

**2. Confusión Project ID vs Project Ref:**
- 🔍 **Investigación**: Project ID = Project Ref (son lo mismo)
- 📍 **Fuente**: Dashboard Supabase muestra "Project ID"
- 📍 **MCP**: Documentación pide `--project-ref=<valor>`
- ✅ **Conclusión**: Usar Project ID en parámetro `--project-ref`

**3. Variables de entorno vs Argumentos CLI:**
- 📖 **Documentación oficial**: Muestra argumentos CLI
- ❌ **Mi intento**: Variables de entorno (no funciona)
- ✅ **Corrección**: `--project-ref` y `--read-only` van en `args`

### **📖 Investigación de Documentación**

**Fuentes consultadas:**
1. **Supabase MCP Docs**: https://supabase.com/docs/guides/getting-started/mcp
2. **GitHub Oficial**: https://github.com/supabase-community/supabase-mcp
3. **Ejemplos configuración**: Múltiples clientes (Cursor, VS Code, etc.)

**Patrón encontrado en TODOS los ejemplos:**
```json
"args": [
  "-y",
  "@supabase/mcp-server-supabase@latest",
  "--read-only",
  "--project-ref=<PROJECT_ID>"
]
```

### **⚠️ ERRORES COMUNES A EVITAR**

1. **❌ NO usar variables ENV para parámetros del servidor**
   ```json
   // MAL
   "env": {
     "SUPABASE_PROJECT_REF": "...",  // NO funciona
     "SUPABASE_READ_ONLY": "true"    // NO funciona
   }
   ```

2. **❌ NO confundir Project ID con Project Ref**
   - Son lo mismo, usar el valor del dashboard

3. **❌ NO olvidar --read-only en args**
   ```json
   // BIEN
   "args": ["...", "--read-only", "--project-ref=..."]
   ```

### **🔄 PROCESO PARA FUTURAS CONFIGURACIONES MCP**

**Cuando Claude Code pida reinicio para MCP:**
1. **📝 Documentar configuración actual** en CLAUDE.md
2. **🔍 Verificar síntomas** (herramientas MCP no aparecen)
3. **📖 Consultar documentación oficial** del servidor MCP específico
4. **⚡ Aplicar configuración según documentación oficial**
5. **📋 Documentar cambios y razones** antes de reiniciar
6. **🔄 Reiniciar y verificar**

### **🎯 Capacidades MCP Read-Only**
- ✅ **Ver estructura** de todas las tablas
- ✅ **Leer datos** existentes (SELECT queries)
- ✅ **Analizar esquemas** (public, msa, pam)
- ✅ **Ver relaciones** entre tablas
- ❌ **No puede modificar** estructura ni datos

### **🚀 Próximos Pasos MCP**
1. **🔄 Reiniciar Claude Code** para activar configuración corregida
2. **🔍 Verificar herramientas MCP** aparecen (mcp_supabase_*)
3. **📊 Probar consultas** a esquemas msa/pam
4. **📋 Documentar resultados** para referencia futura

### **🔒 Seguridad MCP**
- **Modo**: Read-only (sin riesgo modificaciones)
- **Scope**: Solo proyecto Control Presupuestario  
- **Token**: Personal Access Token (renovar según necesidad)

---

# 🆘 INVESTIGACIÓN MCP AGOSTO 2025 - PROBLEMAS WINDOWS

## 📊 Estado Actual 
**❌ PROBLEMA PERSISTENTE** - Las herramientas MCP no aparecen después de múltiples reinicios

### **🔍 Problema Identificado: Windows NPX Execution**

**Fechas**: 2025-08-14
**Síntomas**: 
- Configuración `.mcp.json` correcta
- Múltiples reinicios de Claude Code realizados
- Herramientas MCP (`mcp_supabase_*`) nunca aparecen
- No hay mensajes de error visibles

### **🌐 Investigación Web Completada**

**Fuentes consultadas (NO volver a buscar):**
1. **GitHub Issue #1611**: https://github.com/anthropics/claude-code/issues/1611
   - **Problema confirmado**: MCP servers fallan consistentemente en Claude Code
   - **Síntoma**: "Connection closed" errors en Windows
   - **Usuarios afectados**: Múltiples reportes similares

2. **Documentación Oficial Anthropic**: https://docs.anthropic.com/en/docs/claude-code/mcp
   - **Requisito Windows**: Usar wrapper `cmd /c` para `npx`
   - **Comando alternativo**: `claude mcp add` via CLI

3. **Documentación Supabase**: https://supabase.com/docs/guides/getting-started/mcp
   - **Configuración estándar**: Confirmada correcta (args vs env)
   - **Capacidades**: 20+ herramientas disponibles cuando funciona

4. **Búsquedas adicionales**:
   - "MCP Supabase server Claude Code configuration troubleshooting 2025"
   - Múltiples fuentes confirman problema Windows + `npx`

### **💡 Solución Intentada: Windows CMD Wrapper**

**Cambio realizado 2025-08-14:**
```json
// ANTES (no funcionaba)
"command": "npx"

// DESPUÉS (wrapper Windows)
"command": "cmd",
"args": ["/c", "npx", ...]
```

**Razón técnica**: 
- Windows nativo no puede ejecutar `npx` directamente
- Requiere `cmd /c` como wrapper para shells npm

### **🔄 Configuraciones Alternativas Documentadas**

**Opción A: CLI Installation (backup)**
```bash
claude mcp add supabase -s local -e SUPABASE_ACCESS_TOKEN=sbp_... -- cmd /c npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=upaygsviflbuwraaawhf
```

**Opción B: Verificación Estado**
```bash
claude mcp list      # Ver servidores configurados
claude --debug       # Diagnósticos detallados
```

### **📋 Histórico Troubleshooting MCP**

> **Protocolo operativo actual**: Ver CLAUDE.md sección "Protocolo Troubleshooting MCP"

**Registro histórico de cambios realizados:**

### **🎯 Siguiente Intento Si Falla**

**Hipótesis**: Wrapper `cmd /c` debería resolver problema Windows
**Expectativa**: Herramientas `mcp_supabase_*` aparecen tras reinicio
**Si falla**: Probar Opción A (CLI installation) 

### **⚠️ NO BUSCAR NUEVAMENTE EN WEB (Ya consultado 2025-08-14)**
- GitHub Issues MCP Claude Code
- Documentación oficial Anthropic MCP
- Documentación Supabase MCP  
- Guides configuración Windows + npx

**Próximas búsquedas (si falla)**: Problemas específicos Node.js, PATH Windows, instalación local MCP servers

# 🔒 PROTOCOLO DE SEGURIDAD MCP SUPABASE - SISTEMA "SAVE GAME"

## 📊 Estado Actual
**⚠️ LIMITACIONES CRÍTICAS IDENTIFICADAS** - Ver sección Testing Completado

### **🔧 Estado MCP Actual**
**MODO**: **WRITE/UPDATE** ⚠️ (permisos completos de modificación)
**Última actualización**: 2025-08-14 (Testing completado)
**Cambio**: Protocolo reescrito según hallazgos reales

### **🎯 Concepto: Backup = "Save Game"**
- **Backup**: Punto de restauración seguro de estructura BD
- **Operaciones MCP**: Solo con backup reciente disponible
- **Regla automática**: Avance exitoso = propuesta backup inmediata
- **Rollback**: Capacidad de volver al estado anterior

## 🔧 **Comandos de Backup - Estructura Solamente**

### **📋 Variables de Conexión**
```bash
# Datos de conexión (Control Presupuestario)
PROJECT_REF="upaygsviflbuwraaawhf"
PASSWORD="Monomaniaco13"
CONNECTION_STRING="postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### **💾 Comandos de Backup**

## 📋 **ESTRATEGIA A: Backup Solo Estructura/Configuración**
*Ideal para: Cambios en estructura, columnas, constraints, permisos*
*Ventaja: Rápido, pequeño, preserva datos actuales*

```bash
# A1. BACKUP DE ESTRUCTURA SOLAMENTE (tablas, vínculos, constraints)
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f schema_backup_$(date +%Y%m%d_%H%M%S).sql

# A2. BACKUP DE ROLES Y PERMISOS SOLAMENTE  
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f roles_backup_$(date +%Y%m%d_%H%M%S).sql --role-only

# A3. BACKUP COMBINADO ESTRUCTURA (un comando)
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f schema_backup_$TIMESTAMP.sql && \
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f roles_backup_$TIMESTAMP.sql --role-only && \
echo "✅ Backup estructura generado con timestamp: $TIMESTAMP"
```

## 🎯 **ESTRATEGIA B: Backup Total (Estructura + Datos)**
*Ideal para: Cambios riesgosos, experimentos, datos de prueba valiosos*
*Ventaja: Restore completo a punto exacto, incluye todos los datos*

```bash
# B1. BACKUP COMPLETO: Estructura + Datos + Permisos
TIMESTAMP=$(date +%Y%m%d_%H%M%S) && \
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f schema_backup_$TIMESTAMP.sql && \
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f data_backup_$TIMESTAMP.sql --use-copy --data-only && \
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f roles_backup_$TIMESTAMP.sql --role-only && \
echo "✅ Backup completo (estructura + datos) generado con timestamp: $TIMESTAMP"

# B2. BACKUP SOLO DATOS (mantener estructura actual)
supabase db dump --db-url "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f data_backup_$(date +%Y%m%d_%H%M%S).sql --use-copy --data-only
```

## 🔄 **Comandos de Restore**

### **🔹 RESTORE ESTRATEGIA A: Solo Estructura/Configuración**
*Restaura estructura pero mantiene datos actuales*

```bash
# A-RESTORE: Estructura + Permisos (preserva datos existentes)
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles_backup_YYYYMMDD_HHMMSS.sql \
  --file schema_backup_YYYYMMDD_HHMMSS.sql \
  --dbname "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### **🎯 RESTORE ESTRATEGIA B: Completo (Estructura + Datos)**
*Restaura TODO al punto exacto del backup*

```bash
# B-RESTORE: Estructura + Datos + Permisos (rollback completo)
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles_backup_YYYYMMDD_HHMMSS.sql \
  --file schema_backup_YYYYMMDD_HHMMSS.sql \
  --command 'SET session_replication_role = replica' \
  --file data_backup_YYYYMMDD_HHMMSS.sql \
  --dbname "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### **🆘 Restore de Emergencia Rápido**
```bash
# EMERGENCIA: Solo estructura (más rápido)
psql --single-transaction --variable ON_ERROR_STOP=1 --file schema_backup_TIMESTAMP.sql --dbname "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# EMERGENCIA: Completo con datos
psql --single-transaction --variable ON_ERROR_STOP=1 --file schema_backup_TIMESTAMP.sql --command 'SET session_replication_role = replica' --file data_backup_TIMESTAMP.sql --dbname "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

## 📋 **Notas Técnicas sobre Operaciones MCP**

> **Reglas operativas consolidadas**: Ver CLAUDE.md sección "REGLAS OPERATIVAS CONSOLIDADAS"

### **🔍 Validaciones Técnicas Pre-Operación**

**Verificar MCP Funcionando**
```bash
# Test rápido MCP
mcp__supabase__list_tables  # Debe funcionar
```

**Verificar Estado BD Actual**
```sql
-- Ver esquemas existentes
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'msa', 'pam');

-- Ver tablas por esquema
SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'msa', 'pam');
```

**Verificar Último Backup**
```bash
ls -la *backup*.sql | tail -5  # Ver backups recientes
```


## 📁 **Convenciones de Naming**

### **Archivos de Backup - Estrategia A (Solo Estructura)**
```
schema_backup_YYYYMMDD_HHMMSS.sql      # Estructura (tablas, constraints, índices)
roles_backup_YYYYMMDD_HHMMSS.sql       # Permisos y roles
```

### **Archivos de Backup - Estrategia B (Completo)**
```
schema_backup_YYYYMMDD_HHMMSS.sql      # Estructura
data_backup_YYYYMMDD_HHMMSS.sql        # Datos (contenido tablas)
roles_backup_YYYYMMDD_HHMMSS.sql       # Permisos y roles
```

### **Ejemplos Reales**
```
# Estrategia A - Solo estructura
schema_backup_20250814_143022.sql
roles_backup_20250814_143022.sql

# Estrategia B - Completo  
schema_backup_20250814_143022.sql
data_backup_20250814_143022.sql
roles_backup_20250814_143022.sql
```

## 🚨 **Casos de Emergencia**

### **Escenario 1: Tabla Corrupta**
```bash
# 1. Evaluar daño
psql -d "CONNECTION_STRING" -c "SELECT count(*) FROM esquema.tabla_problema;"

# 2. Restore selectivo (si se puede)
psql -d "CONNECTION_STRING" -f schema_backup_ULTIMO.sql

# 3. Validar resultado
# Test funcionalidad básica
```

### **Escenario 2: Permisos Rotos**
```bash
# Restore solo roles
psql --single-transaction --file roles_backup_ULTIMO.sql --dbname "CONNECTION_STRING"
```

### **Escenario 3: Rollback Completo**
```bash
# Rollback completo a estado anterior
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles_backup_ULTIMO.sql --file schema_backup_ULTIMO.sql --dbname "CONNECTION_STRING"
```

# 🧪 **TESTING PROTOCOLO BACKUP/RESTORE COMPLETADO (2025-08-14)**

## 📋 **RESUMEN EJECUTIVO DE TESTING**

**Estado**: ✅ **FUNCIONAMIENTO BÁSICO CONFIRMADO** con ⚠️ **LIMITACIONES CRÍTICAS**

### **✅ Éxitos Confirmados**
1. **MCP Supabase funcionando** en modo WRITE/UPDATE
2. **TRUNCATE funcional** para limpiar tablas
3. **INSERT via MCP funcional** para restaurar datos
4. **Protocolo básico viable** para emergencias pequeñas

### **❌ Limitaciones Críticas Identificadas**
1. **NO ESCALABLE**: 23 registros tomaron ~45 minutos
2. **PROCESO MANUAL**: Requiere conversión línea por línea
3. **PROPENSO A ERRORES**: Fallos en batches grandes
4. **NO AUTOMATIZABLE**: Imposible para 1000+ registros

---

## 🔍 **TESTING DETALLADO**

### **🧪 PRUEBA 1: Borrar Registro → Restore Completo**
**Estado**: ✅ **EXITOSA** (con limitaciones)

#### **Proceso Ejecutado**
1. **Borrado exitoso**: Registro `7f25bb48-3f39-4e78-88f2-57c32f25b03c` eliminado
2. **TRUNCATE exitoso**: Tabla `msa.comprobantes_arca` vaciada (0 registros)  
3. **Restore exitoso**: 23 registros restaurados usando INSERT via MCP
4. **Verificación exitosa**: Registro específico recuperado correctamente

#### **Métodos Probados y Resultados**

**❌ FALLO: Docker + COPY FROM stdin**
```bash
# INTENTADO - NO FUNCIONA
docker run --rm -i postgres:15 psql --single-transaction \
  --command 'SET session_replication_role = replica' \
  --file /data/data_backup_20250813_224657.sql
```
**Problema**: `COPY FROM stdin` no funciona en Docker `run -i`
**Error**: Datos no se transfieren correctamente via stdin
**Investigación**: Documentación PostgreSQL confirma necesidad de `docker exec` o volúmenes

**❌ FALLO: Docker + Volúmenes**
```bash
# INTENTADO - NO FUNCIONA  
docker run --rm -v "$(pwd):/data" postgres:15 psql \
  --file /data/backup.sql
```
**Problema**: Sintaxis de volúmenes Windows + Git Bash
**Error**: Rutas no reconocidas correctamente

**❌ FALLO: pgAdmin Query Tool**
```sql
-- INTENTADO - FUNCIONA PERO NO ESCALABLE
COPY "msa"."comprobantes_arca" (...) FROM stdin;
-- Datos del backup
```
**Problema**: Renderización visual excesivamente lenta
**Performance**: 5+ minutos para 23 registros (no viable)
**Conclusión**: pgAdmin excelente para administración, NO para restore masivo

**✅ ÉXITO: INSERT via MCP (con limitaciones)**
```sql
-- FUNCIONA PERO NO ESCALABLE
INSERT INTO msa.comprobantes_arca (...) VALUES 
('id1', 'campo1', ...),
('id2', 'campo2', ...);
-- Máximo 3-5 registros por batch
```
**Ventajas**: Funciona, confiable, sin dependencias externas
**Limitaciones**: Manual, lento, no escalable

#### **Problemas Específicos Encontrados**

**🚨 Escalabilidad Crítica**
- **23 registros**: ~45 minutos de trabajo manual
- **Batches máximos**: 3-5 registros (fallos en batches mayores)
- **Proyección 1000 registros**: ~48 horas de trabajo manual
- **Conclusión**: NO VIABLE para datasets reales

**🚨 Conversión Manual Requerida**
- Backup original formato `COPY FROM stdin`
- Conversión manual línea por línea a INSERT
- Proceso propenso a errores de sintaxis
- No hay script automático disponible

**🚨 Limitaciones MCP**
- INSERT statements largos generan errores
- Sin soporte nativo para restore masivo
- Timeouts en operaciones grandes
- No hay herramientas batch optimizadas

---

## 📖 **INVESTIGACIÓN DOCUMENTAL REALIZADA**

### **Fuentes Consultadas (2025-08-14)**
1. **PostgreSQL Official Docs**: pg_dump, COPY FROM stdin, restore methods
2. **Docker + PostgreSQL**: stdin issues, volume mounting, exec vs run
3. **Supabase MCP**: Limitaciones, capacidades, best practices
4. **Stack Overflow**: Específicos Docker + COPY FROM stdin errors

### **Hallazgos Clave de Documentación**
- **COPY FROM stdin**: Requiere acceso continuo a stdin (problemático en Docker)
- **pg_dump --inserts**: Genera INSERT statements (más compatible)
- **Docker exec vs run**: exec requiere container persistente
- **MCP limitations**: No diseñado para operaciones masivas

---

## ⚠️ **PROTOCOLOS RECOMENDADOS POST-TESTING**

### **🎯 Para Datasets Pequeños (<50 registros)**
**Método**: INSERT via MCP (método probado)
```sql
-- Viable para emergencias pequeñas
INSERT INTO tabla VALUES (...);
```

### **🎯 Para Datasets Medianos (50-500 registros)**  
**Método**: psql directo (sin interface gráfica)
```bash
# RECOMENDADO - Evitar pgAdmin para restore masivo
psql "CONNECTION_STRING" -f backup.sql
# O con Docker sin visualización:
docker run postgres:17 psql CONNECTION -f backup.sql
```

### **🎯 Para Datasets Grandes (500+ registros)**
**Método**: Solución externa especializada
- **psql directo** (sin interface gráfica)
- Container PostgreSQL persistente con volúmenes
- Scripts Python/Node.js para conversión automática
- **EVITAR pgAdmin** para operaciones masivas

---

## 📋 **PRÓXIMOS PASOS DE TESTING**

### **🔄 Testing Pendiente**
- **PRUEBA PSQL NATIVO**: Restore con PostgreSQL Command Line Tools (instalando 2025-08-14)
- **PRUEBA 2**: Borrar columna → Restore estructura (Estrategia A)
- **PRUEBA 3**: Modificar permisos → Restore roles  
- **PRUEBA 4**: Probar método pg_dump --inserts automatizado
- **PRUEBA 5**: Container PostgreSQL persistente con volúmenes

### **🎯 Optimizaciones a Probar**
1. **Script conversión COPY → INSERT**: Automatizar proceso manual
2. **Container persistente**: Evitar problemas Docker run/exec
3. **Backup incremental**: Solo cambios desde último backup
4. **Batching inteligente**: Encontrar tamaño óptimo de batch MCP

---

## 📁 **Archivos Generados Durante Testing**
```
# Backups originales (formato COPY)
data_backup_20250813_224657.sql (238KB) - 23 registros
schema_backup_20250813_224657.sql (10KB)
roles_backup_20250813_224657.sql (297B)

# Archivos testing
msa_only_restore.sql - Sección extraída MSA
msa_insert_backup_now.sql - Backup INSERT del estado actual
```

---

## 🚨 **ADVERTENCIAS CRÍTICAS**

### **⚠️ NO usar para Producción Real**
- Método actual NO escalable para datasets reales
- Proceso manual propenso a errores
- Tiempo de restore prohibitivo (>100 registros)

### **⚠️ Solo para Emergencias Pequeñas**
- Máximo recomendado: 50 registros
- Usar solo cuando otros métodos no disponibles
- Siempre tener backup alternativo

### **⚠️ Requiere Desarrollo Adicional**
- Script automatización COPY → INSERT
- Testing de métodos alternativos
- Optimización de performance

**🎯 CONCLUSIÓN**: El protocolo funciona pero requiere evolución significativa para ser viable en producción.

---

## 🚀 **PRÓXIMO TESTING PROGRAMADO (PSQL NATIVO)**

### **📋 Estado Actual (2025-08-14)**
- **Descarga en progreso**: PostgreSQL Command Line Tools para Windows
- **Fuente**: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- **Componentes**: Solo Command Line Tools (sin servidor, sin pgAdmin)
- **Tiempo estimado instalación**: 15 minutos

### **🎯 Próximos Pasos para Siguiente Sesión**

#### **1. Verificar Instalación**
```bash
psql --version
# Esperado: psql (PostgreSQL) 16.x
```

#### **2. Probar Restore Directo (Hipótesis: mucho más rápido)**
```bash
# Comando directo sin interface gráfica
psql "postgresql://postgres.upaygsviflbuwraaawhf:Monomaniaco13@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -f msa_only_restore.sql

# Expectativa: segundos en lugar de minutos
# Razón: Sin visualización ni renderización de datos
```

#### **3. Benchmark Performance**
- Medir tiempo exacto para 23 registros
- Comparar con métodos anteriores
- Evaluar escalabilidad real

### **💡 Hipótesis psql Nativo**
- **Sin interface gráfica** = Sin rendering overhead
- **Sin visualización** = Solo procesamiento puro
- **Optimizado para batch operations** = Performance real
- **Expectativa**: <10 segundos para 23 registros

### **📊 Si psql nativo es exitoso:**
- Protocolo backup/restore **VIABLE** para datasets medianos
- Actualizar recomendaciones en documentación
- Considerar script automatizado para uso frecuente

**🎯 PENDIENTE PARA PRÓXIMA SESIÓN**: Testing psql nativo + continuar con otros aspectos de la app

---

# 💰 **SISTEMA CASH FLOW - EGRESOS SIN FACTURA**

## 📊 **DISEÑO COMPLETADO (2025-08-14)**

### **🎯 Concepto Principal**
Sistema de **carga masiva** para compromisos de pagos y cobros que **no tienen comprobantes**, tales como:
- **Impuestos** (fechas fijas mensuales/anuales)
- **Sueldos** (fechas fijas mensuales + aguinaldos)
- **Créditos bancarios** (cuotas fijas)
- **Servicios recurrentes** (luz, gas, telefonía)
- **Otros compromisos contractuales**

### **🏗️ Arquitectura Híbrida Acordada**

#### **📋 Template Master Único**
- **Nombre**: "Egresos sin Factura 2025"
- **Función**: Contenedor de todos los renglones del año
- **Replicación**: Copia automática año siguiente (con/sin ajuste inflación)
- **Multi-responsable**: Un template para todas las empresas y personas

#### **🔧 Templates Individuales por Renglón**
- **Cada renglón** = 1 mini-template con reglas específicas
- **Ejemplos**: "IMP Inmobiliario", "SUELD Mensual", "IMP Complementario"
- **Flexibilidad**: Edición granular sin afectar otros renglones
- **Mantenimiento**: Agregar/borrar renglones individuales

### **👥 Responsables del Gasto (8 opciones)**

#### **🏢 Empresas (2)**
- **MSA** 
- **PAM**

#### **👤 Personas Físicas (6)**
- **MA**
- **Manuel**
- **Soledad**
- **Merceditas**
- **Andres**
- **Jose**

### **🧭 Wizard de Creación de Renglón**

#### **📋 Paso 1: Datos Básicos**
- **Cuenta contable** (dropdown desde tabla cuentas_contables)
- **Centro de costo** (dropdown)
- **Nombre de referencia** (ej: "Impuesto Inmobiliario")
- **Responsable** (dropdown: MSA, PAM, MA, Manuel, Soledad, Merceditas, Andres, Jose)
- **Monto base** (decimal)

#### **📅 Paso 2: Recurrencia**
**Opción A: Mensual**
- Día del mes (ej: día 15)
- Aplica a todos los 12 meses
- **Especial sueldos**: Junio y Diciembre x1.5 (aguinaldos)

**Opción B: Anual**
- Fecha específica única (ej: 10 de febrero)
- Un solo pago en el año

**Opción C: Cuotas específicas**
- Cantidad de cuotas (ej: 6)
- Meses específicos (ej: cada 2 meses)
- Día aproximado inicial
- **Botón "Editar cuota por cuota"**: Personalizar fecha de vencimiento individual

#### **📊 Paso 3: Fechas (Flexibilidad máxima)**
- **Fecha estimada** (para planning)
- **Fecha de vencimiento** (para compliance)
- **Edición granular**: Modificar fecha de cada cuota si necesario

#### **📋 Paso 4: Preview y Confirmación**
- **Vista previa** de todas las cuotas generadas
- **Tabla resultado** similar a ejemplo de impuestos (renglón con 12 columnas mensuales)
- **Confirmación** antes de guardar

### **💾 Estructura de Base de Datos**

#### **📊 Tabla Principal: `egresos_sin_factura`**
```sql
CREATE TABLE egresos_sin_factura (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_master_id UUID, -- referencia a "Egresos sin Factura 2025"
  cuenta_contable VARCHAR(20),
  centro_costo VARCHAR(20),
  nombre_referencia VARCHAR(100), -- "Impuesto Inmobiliario"
  responsable VARCHAR(20), -- MSA/PAM/MA/Manuel/etc.
  tipo_recurrencia VARCHAR(20), -- mensual/anual/cuotas_especificas
  configuracion_reglas JSONB, -- reglas específicas del renglón
  año INTEGER,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

#### **📅 Tabla Cuotas Generadas: `cuotas_egresos_sin_factura`**
```sql
CREATE TABLE cuotas_egresos_sin_factura (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  egreso_id UUID REFERENCES egresos_sin_factura(id),
  mes INTEGER, -- 1-12
  fecha_estimada DATE,
  fecha_vencimiento DATE,
  monto DECIMAL(15,2),
  descripcion TEXT, -- "Impuesto Inmobiliario MSA - Enero 2025"
  estado VARCHAR(20) DEFAULT 'pendiente' -- pendiente/pagado/vencido
);
```

#### **🎯 Tabla Templates Master: `templates_master`**
```sql
CREATE TABLE templates_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100), -- "Egresos sin Factura 2025"
  año INTEGER,
  descripcion TEXT,
  total_renglones INTEGER, -- calculado
  created_at TIMESTAMP DEFAULT now()
);
```

### **🔄 Configuración de Reglas (JSONB Examples)**

#### **📋 Regla Mensual:**
```json
{
  "tipo": "mensual",
  "dia_mes": 15,
  "monto_base": 100000,
  "especiales": {
    "aguinaldo": true,
    "meses_aguinaldo": [6, 12],
    "multiplicador": 1.5
  }
}
```

#### **📋 Regla Anual:**
```json
{
  "tipo": "anual",
  "fecha": "2025-02-10",
  "monto": 720000
}
```

#### **📋 Regla Cuotas Específicas:**
```json
{
  "tipo": "cuotas_especificas",
  "cantidad": 6,
  "meses": [1, 3, 5, 7, 9, 11],
  "dia_default": 15,
  "fechas_custom": [
    {"mes": 1, "fecha": "2025-01-15", "monto": 70000},
    {"mes": 3, "fecha": "2025-03-10", "monto": 70000},
    {"mes": 5, "fecha": "2025-05-15", "monto": 70000}
  ]
}
```

### **🎯 Integración con Cash Flow**

#### **📊 Mapeo a Columnas Cash Flow**
1. **FECHA Estimada**: `cuotas_egresos_sin_factura.fecha_estimada`
2. **Fecha Vencimiento**: `cuotas_egresos_sin_factura.fecha_vencimiento`
3. **CATEG**: `egresos_sin_factura.cuenta_contable`
4. **Centro de Costo**: `egresos_sin_factura.centro_costo`
5. **Cuit Cliente/Proveedor**: Derivado de `responsable`
6. **Nombre Cliente/Proveedor**: `egresos_sin_factura.responsable`
7. **Detalle**: `cuotas_egresos_sin_factura.descripcion`
8. **Débitos**: `cuotas_egresos_sin_factura.monto`
9. **Créditos**: 0 (solo egresos por ahora)
10. **SALDO CTA CTE**: Calculado
11. **Registro Contable**: `cuenta_contable`
12. **Registro Interno**: `centro_costo`

### **🔄 Flujo de Trabajo**

#### **📋 Carga Inicial (Una vez por año)**
1. **Crear Template Master**: "Egresos sin Factura 2025"
2. **Agregar renglones** uno por uno usando wizard
3. **Resultado**: Tabla consolidada como ejemplo de impuestos
4. **Vista previa** completa antes de confirmar

#### **🔧 Mantenimiento Durante el Año**
- **Cambio puntual**: Editar cuota individual en Cash Flow
- **Cambio masivo**: Editar template renglón → regenerar cuotas
- **Agregar renglón**: Wizard para nuevo concepto
- **Eliminar renglón**: Marcar como inactivo

#### **📅 Replicación Anual**
1. **Año siguiente**: Copiar template completo
2. **Ajuste inflación**: Aplicar % a todos los montos
3. **Modificaciones**: Editar renglones según necesidad
4. **Activación**: Generar cuotas para nuevo año

### **💡 Ventajas del Sistema**

#### **✅ vs Excel/CSV**
- **Interface guiada**: Imposible errores de carga
- **Validaciones**: Datos siempre correctos
- **Flexibilidad**: Cada tipo de egreso con su lógica
- **Integración**: Directo al Cash Flow

#### **✅ vs Carga Manual**
- **Velocidad**: Setup anual completo en minutos
- **Consistencia**: Mismas reglas aplicadas uniformemente
- **Mantenimiento**: Cambios granulares o masivos
- **Escalabilidad**: Fácil agregar nuevos conceptos

#### **✅ Templates Reutilizables**
- **Replicación**: Año siguiente automático
- **Ajustes**: Solo modificar lo necesario
- **Historia**: Mantener configuraciones anteriores
- **Backup**: Templates como respaldo de configuración

### **📋 Próximos Pasos de Implementación**

#### **🎯 Fase 1: Estructura Base**
- Crear tablas de base de datos
- Implementar Template Master único
- Wizard básico para renglón mensual

#### **🎯 Fase 2: Wizard Completo**
- Todos los tipos de recurrencia
- Edición cuota por cuota
- Preview antes de confirmar
- Integración con Cash Flow

#### **🎯 Fase 3: Funcionalidades Avanzadas**
- Replicación anual con inflación
- Edición granular post-creación
- Reportes por responsable
- Backup/restore de templates

**🚀 LISTO PARA IMPLEMENTAR**: Diseño completo acordado para desarrollo mañana