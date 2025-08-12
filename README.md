# 📊 Control Presupuestario

Sistema de análisis financiero para procesar movimientos bancarios de MSA Galicia, organizarlos por categorías y generar reportes presupuestarios.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/josemartinezsobrado-gmailcoms-projects/v0-control-presupuestario-1-1)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/uZ14eJ2Mv3n)

## 🎯 ¿Qué hace esta aplicación?

- **Importa archivos Excel** de MSA Galicia con movimientos bancarios
- **Categoriza automáticamente** ingresos, egresos, financieros y distribuciones
- **Genera reportes mensuales** agrupados por tipo y cuenta contable
- **Análisis de distribución** de gastos por socios
- **Corrección de categorías** inválidas o mal clasificadas
- **Reportes detallados** línea por línea con filtros por período

## 🚀 Instalación Rápida

### 1. Clonar el repositorio
```bash
git clone https://github.com/JMS1320/Control-Presupuestario-v1.1.git
cd Control-Presupuestario-v1.1
```

### 2. Instalar dependencias
```bash
npm install
# o
pnpm install
```

### 3. Configurar variables de entorno
Crear archivo `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_clave_servicio_supabase
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## 🗄️ Base de Datos (Supabase)

### Tablas principales:
- **`msa_galicia`**: Movimientos bancarios importados (esquema público)
- **`cuentas_contables`**: Mapeo de categorías a tipos de cuenta (esquema público)
- **`msa.comprobantes_arca`**: Facturas recibidas MSA con 26 campos ARCA (esquema msa)
- **`pam.comprobantes_arca`**: Facturas recibidas PAM - *próximamente* (esquema pam)

### Configurar Supabase:
1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar migraciones SQL (ver sección "Configuración Crítica")
3. Copiar las claves del proyecto a `.env.local`

## 🔧 Configuración Crítica de Supabase (IMPORTANTE)

### 📋 Pasos obligatorios para multi-empresa con esquemas personalizados

Esta sección documenta los pasos esenciales aprendidos durante el desarrollo para configurar Supabase con **esquemas personalizados** (MSA/PAM). **No omitir ningún paso**.

#### 1️⃣ **Crear esquemas y tablas en SQL Editor**
```sql
-- Crear esquema MSA
CREATE SCHEMA IF NOT EXISTS msa;

-- Crear tabla de facturas ARCA para MSA
CREATE TABLE IF NOT EXISTS msa.comprobantes_arca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos originales de ARCA (17 campos del CSV)
    fecha_emision DATE,
    tipo_comprobante INTEGER,
    punto_venta INTEGER,
    numero_desde INTEGER,
    numero_hasta INTEGER,
    codigo_autorizacion TEXT,
    tipo_doc_emisor INTEGER,
    cuit TEXT NOT NULL,
    denominacion_emisor TEXT NOT NULL,
    tipo_cambio DECIMAL(10,4) DEFAULT 1.0000,
    moneda VARCHAR(3) DEFAULT 'PES',
    imp_neto_gravado DECIMAL(15,2) DEFAULT 0.00,
    imp_neto_no_gravado DECIMAL(15,2) DEFAULT 0.00,
    imp_op_exentas DECIMAL(15,2) DEFAULT 0.00,
    otros_tributos DECIMAL(15,2) DEFAULT 0.00,
    iva DECIMAL(15,2) DEFAULT 0.00,
    imp_total DECIMAL(15,2) NOT NULL,
    
    -- Campos adicionales para gestión
    campana TEXT,
    fc TEXT,
    cuenta_contable TEXT,
    centro_costo TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    observaciones_pago TEXT,
    detalle TEXT,
    archivo_origen TEXT,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_msa_comprobantes_unique 
ON msa.comprobantes_arca (tipo_comprobante, punto_venta, numero_desde, cuit);
```

#### 2️⃣ **Exponer esquema en la API** (CRÍTICO)
- **Dashboard Supabase** → **Settings** → **API**
- **"Exposed schemas"**: Agregar `msa` junto a `public` y `graphql_public`
- ⚠️ **Sin este paso, el cliente JavaScript de Supabase no puede acceder al esquema**

#### 3️⃣ **Otorgar permisos de acceso** (CRÍTICO)
```sql
-- Permisos sobre el esquema
GRANT USAGE ON SCHEMA msa TO authenticated;
GRANT USAGE ON SCHEMA msa TO anon;
GRANT USAGE ON SCHEMA msa TO service_role;

-- Permisos sobre la tabla
GRANT ALL ON msa.comprobantes_arca TO authenticated;
GRANT ALL ON msa.comprobantes_arca TO anon; 
GRANT ALL ON msa.comprobantes_arca TO service_role;
```

#### 4️⃣ **Sintaxis correcta en el código JavaScript**
```typescript
// ❌ INCORRECTO - No funciona con Supabase
const { data, error } = await supabase
  .from('msa.comprobantes_arca')  // No reconoce el punto

// ✅ CORRECTO - Sintaxis requerida por Supabase
const { data, error } = await supabase
  .schema('msa')                  // Especificar esquema primero
  .from('comprobantes_arca')      // Luego la tabla
```

#### 5️⃣ **Políticas RLS (Row Level Security)**
```sql
-- Habilitar RLS en la tabla
ALTER TABLE msa.comprobantes_arca ENABLE ROW LEVEL SECURITY;

-- Crear política permisiva (ajustar según necesidades de seguridad)
CREATE POLICY IF NOT EXISTS "Allow all operations on msa.comprobantes_arca" 
ON msa.comprobantes_arca FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);
```

### 🚨 **Errores Comunes y Soluciones**

| Error | Causa | Solución |
|-------|-------|----------|
| `The schema must be one of the following: public, graphql_public` | Esquema no expuesto en API | Paso 2: Exponer esquema |
| `permission denied for schema msa` | Falta otorgar permisos | Paso 3: Ejecutar GRANT |
| `relation "msa.comprobantes_arca_id_seq" does not exist` | UUID vs SERIAL | Usar UUID con `gen_random_uuid()` |
| Errores vacíos `{}` en inserción | Múltiples causas posibles | Verificar pasos 1-4 en orden |

### 🔄 **Para replicar en PAM**
Repetir estos 5 pasos reemplazando `msa` por `pam` en todos los comandos.

## 📁 Estructura del Proyecto

```
├── app/
│   ├── api/                    # Endpoints de la API
│   │   ├── import-excel/       # Importador Excel extractos bancarios
│   │   ├── import-facturas-arca/ # ✨ Importador facturas ARCA (MSA/PAM)
│   │   ├── import-excel-dinamico/ # Versión experimental (legacy)
│   │   └── verificar-tabla/    # Verificaciones de BD
│   ├── importador-nuevo/       # Página experimental (legacy)
│   └── page.tsx               # Página principal
├── components/
│   ├── ui/                    # Componentes base shadcn/ui
│   ├── filtros-financieros.tsx # Filtros de período
│   ├── tabla-resumen-financiero.tsx # Resumen mensual
│   ├── importador-excel.tsx   # ✨ Importador dual: extractos + facturas ARCA
│   ├── vista-facturas-arca.tsx # ✨ Vista gestión facturas con selector columnas
│   └── corrector-categorias.tsx # Corrector de categorías
├── hooks/
│   ├── useFinancialData.ts    # Hook datos financieros
│   ├── useDistribucionSociosData.ts # Hook distribución
│   └── useReporteDetallado.ts # Hook reportes detallados
├── lib/
│   ├── supabase.ts           # Cliente Supabase
│   ├── excel-utils.ts        # Utilidades Excel
│   └── format.ts             # Formateo de números
└── dashboard.tsx             # Componente principal dashboard
```

## 🛠️ Tecnologías

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI  
- **Backend**: Next.js API Routes + Supabase
- **Base de datos**: PostgreSQL (Supabase)
- **Deploy**: Vercel con auto-deploy

## 🔄 Flujo de Trabajo de Desarrollo

1. **Rama principal**: `main` (producción en Vercel)
2. **Desarrollo**: Crear rama `desarrollo` para cambios
3. **Testing**: Probar en preview URL de Vercel
4. **Deploy**: Merge a `main` despliega automáticamente

## 📈 Funcionalidades Principales

### Dashboard Multi-Vista (5 solapas)
- **Dashboard**: Resumen financiero mensual por categorías
- **Distribución Socios**: Análisis de gastos por personas
- **Reporte Detallado**: Vista línea por línea con filtros
- **✨ Facturas ARCA**: Gestión completa de comprobantes recibidos
- **Importar Excel**: Dual para extractos bancarios y facturas ARCA

### ✨ Sistema Facturas ARCA (Nuevo)
- **Importación CSV**: Procesa archivos descargados de ARCA
- **Validación CUIT**: Automática por empresa (MSA: 30617786016, PAM: 20044390222)
- **26 campos ARCA**: Preserva toda la información fiscal original
- **Anti-duplicados**: Por tipo_comprobante + punto_venta + numero_desde + cuit
- **Vista personalizable**: Selector de columnas, fechas corregidas, scroll horizontal
- **Arquitectura multi-empresa**: Esquemas separados (msa/pam)

### Importador Excel Dual
- **Extractos bancarios**: MSA Galicia (funcionalidad original)
- **Facturas ARCA**: CSV con validación empresarial integrada
- **Validaciones automáticas**: Formato, duplicados, integridad

### Reportes y Análisis
- Vista detallada línea por línea con filtros avanzados
- Análisis de distribución por socios
- Dashboard con filtros por año/semestre y formato argentino

## 📞 Soporte

Para problemas o mejoras, crear issue en este repositorio.

## 🚧 Estado Actual del Desarrollo

### ✅ **Funcionalidades Completas**

#### **Sistema MSA Galicia - COMPLETO**
- **✅ Extractos bancarios**: Importador Excel completamente funcional (`/api/import-excel`)
- **✅ Facturas ARCA**: Sistema completo de gestión de comprobantes recibidos
  - ✅ **Importación CSV**: Procesamiento automático 26 campos ARCA (`/api/import-facturas-arca`)
  - ✅ **Validación CUIT**: Automática por nombre archivo (MSA: 30617786016)
  - ✅ **Vista gestión**: Selector columnas, fechas corregidas, scroll horizontal (`vista-facturas-arca.tsx`)
  - ✅ **Sistema anti-duplicados**: Por clave única compuesta (tipo_comprobante + punto_venta + numero_desde + cuit)
  - ✅ **Base de datos**: Esquema `msa.comprobantes_arca` completamente configurado
  - ✅ **Integración UI**: Nueva solapa "Facturas ARCA" en dashboard principal

#### **Infraestructura y Core**
- **✅ Dashboard multi-vista**: 5 solapas funcionales (Dashboard, Distribución, Reportes, Facturas ARCA, Importar)
- **✅ Importador dual**: Extractos bancarios + facturas ARCA en componente unificado
- **✅ Arquitectura multi-empresa**: Esquemas PostgreSQL separados con documentación crítica
- **✅ Reportes y análisis**: Dashboard financiero, distribución socios, reportes detallados
- **✅ Configuración Supabase**: Documentación paso a paso para esquemas personalizados

### 🔄 **En Desarrollo Activo**

#### **Testing de Rigurosidad MSA** (Próximo inmediato)
- [ ] **Validación cruzada**: Probar archivo PAM en sistema MSA (debe fallar por CUIT)
- [ ] **Anti-duplicados**: Reimportar facturas existentes (debe detectar duplicados)
- [ ] **Edge cases**: Archivos corruptos, formatos incorrectos, validaciones límite

#### **Desarrollo Flujo de Fondos** (Cash Flow)
- [ ] **Vista gestión**: Sistema CRUD para presupuesto/pagos planificados
- [ ] **Conciliación**: Matching automático facturas ARCA ↔ flujo fondos
- [ ] **Reportes integrados**: Comparativas presupuesto vs real

#### **Expansión PAM** (Una vez MSA probado)
- [ ] **Replicar infraestructura**: Esquema `pam` + tabla `pam.comprobantes_arca`
- [ ] **Configurar Supabase**: Permisos y exposición API para esquema PAM
- [ ] **Validación CUIT PAM**: 20044390222 en sistema dual
- [ ] **Testing completo**: Flujo PAM independiente + convergencia multi-empresa

#### **Mejoras UX** (Para el final)
- [ ] **Vista facturas**: Columnas redimensionables tipo Excel con v0
- [ ] **Scroll mejorado**: Drag horizontal/vertical optimizado
- [ ] **Integración dashboard**: Métricas facturas ARCA en vista principal

## 🚀 **Visión Futura - Rediseño Completo del Sistema**

### 🔄 **Flujo de Trabajo Actual (Estado Presente)**

#### **Proceso en 3 Etapas:**

1. **📊 Cash Flow Excel** (Origen)
   - Pagos realizados + pagos futuros presupuestados
   - Información adicional de cada transacción
   - Base de datos manual en Excel

2. **🏦 Extracto Bancario** (Descarga mensual)
   - Descarga directa del banco (MSA/PAM)
   - Solo información bancaria básica
   - Sin contexto de presupuesto

3. **🔀 Conciliación Bancaria** (Resultado VBA)
   - **Macro VBA** combina Cash Flow + Extracto
   - Excel unificado con información completa
   - **Este es el que importa el sistema actual**

### 🎯 **Objetivo: Eliminar Dependencia de Excel/VBA**

#### **Nuevo flujo propuesto:**
- ✅ **Todo integrado en la app**
- ✅ **Más confiable** (menos errores manuales)
- ⚠️ **Más lento** que Excel (pero más robusto)

1. **Generar Cash Flow** directo en la app
2. **Importar extracto bancario** crudo
3. **Proceso de conciliación** automático en la app
4. **Eliminar macro VBA** y Excel intermedio

### 📋 **Nuevas Funcionalidades Requeridas**

#### **Roadmap de Desarrollo:**
- [ ] **Vista Cash Flow**: Crear/editar pagos presupuestados
- [ ] **Import crudo**: Extractos bancarios sin procesar
- [ ] **Motor de conciliación**: Matching automático
- [ ] **Vistas de conciliación**: UI para revisar/ajustar matching
- [ ] **Migración de datos**: Importar Cash Flow existente
- [ ] **Reportes avanzados**: Comparativas presupuesto vs real

#### **Beneficios esperados:**
- Proceso unificado sin dependencias externas
- Trazabilidad completa en la app
- Reducción de errores manuales
- Escalabilidad para múltiples bancos
- Control de versiones y historial completo

## 🚧 **Estado Actual - Desarrollo de Cash Flow (En Progreso)**

### 📋 **Análisis del Proceso Actual Identificado**

**Archivo fuente identificado**: `comprobantes_consulta_csv_recibidos_*.csv` (ARCA)
- **Origen**: Descarga mensual de comprobantes recibidos desde ARCA
- **Campos**: 17 columnas con información fiscal completa
- **Decisión**: Conservar TODOS los campos de ARCA (nunca se sabe qué se necesitará para auditorías)

### 🗄️ **Propuesta de Base de Datos - Tabla Única**

**Enfoque decidido**: Una sola tabla con todos los datos + Views personalizadas por área

```sql
CREATE TABLE comprobantes_arca (
  -- === CAMPOS SISTEMA ===
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- === DATOS ARCA ORIGINALES ===
  fecha_emision DATE NOT NULL,
  tipo_comprobante INTEGER NOT NULL,
  punto_venta INTEGER,
  numero_desde BIGINT,
  numero_hasta BIGINT,
  codigo_autorizacion VARCHAR(20),           -- Números grandes (ej: 75315849908111)
  tipo_doc_emisor INTEGER,
  cuit VARCHAR(11) NOT NULL,                 -- CUIT como identificador único
  denominacion_emisor TEXT NOT NULL,
  tipo_cambio DECIMAL(10,2),
  moneda VARCHAR(3) DEFAULT 'PES',
  imp_neto_gravado DECIMAL(15,2),
  imp_neto_no_gravado DECIMAL(15,2),
  imp_op_exentas DECIMAL(15,2),
  otros_tributos DECIMAL(15,2),
  iva DECIMAL(15,2),
  imp_total DECIMAL(15,2) NOT NULL,
  
  -- === DATOS CONTABLES ===
  campana TEXT,
  año_contable INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  mes_contable INTEGER CHECK (mes_contable >= 1 AND mes_contable <= 12),
  fc TEXT,                                   -- Estado factura física
  cuenta_contable TEXT,
  centro_costo TEXT,
  
  -- === DATOS FINANCIEROS ===
  estado VARCHAR(20) DEFAULT 'pendiente',   -- pendiente,pagar,preparada,pagada
  observaciones_pago TEXT,
  
  -- === DATOS DE REGISTRO ===
  detalle TEXT,
  
  -- === METADATOS ===
  archivo_origen TEXT,
  fecha_importacion TIMESTAMP DEFAULT NOW(),
  fecha_modificacion TIMESTAMP DEFAULT NOW(),
  
  -- === CONSTRAINTS ===
  UNIQUE(tipo_comprobante, punto_venta, numero_desde, cuit)
);
```

### 📝 **Próximos Pasos Definidos**
1. **Crear tabla en Supabase** con la estructura propuesta
2. **Agregar constraints de opciones** múltiples posteriormente
3. **Desarrollar importador** para archivos CSV de ARCA
4. **Crear views personalizadas** por área (contable, financiera, etc.)
5. **Integrar al dashboard** principal

### 🎯 **Decisiones de Diseño Tomadas**
- **Tabla única**: Mejor que múltiples tablas normalizadas
- **CUIT como VARCHAR(11)**: Preserva ceros iniciales
- **Constraints flexibles**: Se agregan después según necesidades
- **Información completa**: Conservar todos los datos de ARCA

---

**Aplicación desplegada**: [Ver en vivo](https://vercel.com/josemartinezsobrado-gmailcoms-projects/v0-control-presupuestario-1-1)