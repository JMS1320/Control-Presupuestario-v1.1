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
- **`msa_galicia`**: Movimientos bancarios importados
- **`cuentas_contables`**: Mapeo de categorías a tipos de cuenta
- **`msa.comprobantes_arca`**: Facturas recibidas de MSA (esquema separado)

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
│   │   ├── import-excel/       # Importador Excel principal
│   │   ├── import-excel-dinamico/ # Versión experimental
│   │   └── verificar-tabla/    # Verificaciones de BD
│   ├── importador-nuevo/       # Página experimental
│   └── page.tsx               # Página principal
├── components/
│   ├── ui/                    # Componentes base shadcn/ui
│   ├── filtros-financieros.tsx # Filtros de período
│   ├── tabla-resumen-financiero.tsx # Resumen mensual
│   ├── importador-excel.tsx   # Componente importador
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

### Dashboard
- Resumen financiero mensual por categorías
- Filtros por año y semestre
- Toggle decimales/formato argentino

### Importador Excel
- Procesa archivos de MSA Galicia
- Validaciones automáticas de formato
- Control de duplicados y errores

### Reportes
- Vista detallada línea por línea
- Análisis de distribución por socios
- Exportación de datos (próximamente)

## 📞 Soporte

Para problemas o mejoras, crear issue en este repositorio.

## 🚧 Estado Actual del Desarrollo

### ✅ **Funcionalidades Completas**
- **MSA Galicia**: Importador completamente funcional (`importador-excel.tsx` + `/api/import-excel`)
- Dashboard con reportes y análisis
- Corrección de categorías y distribución por socios
- Base de datos configurada con tabla `msa_galicia`

### 🔄 **En Desarrollo**
- **PAM Galicia**: Importador experimental en progreso (`importador-excel-dinamico.tsx` + `/api/import-excel-dinamico`)
  - **Objetivo**: Procesar archivos Excel de PAM Galicia (estructura diferente a MSA)
  - **Estado**: Funcionalidad básica implementada, pendiente de debugging y unificación
  - **Próximos pasos**: 
    1. Resolver problemas de importación específicos de PAM
    2. Unificar ambos importadores en un solo componente
    3. Integrar al dashboard principal

### 📋 **Tareas Pendientes - Próxima Fase (Orden de Ejecución)**

#### **Fase 1: Visualización y Testing MSA** 
- [ ] **Vista de facturas importadas**: Crear componente para visualizar datos de `msa.comprobantes_arca`
- [ ] **Testing de rigurosidad del sistema MSA**:
  - [ ] Intentar importar archivo PAM en sistema MSA (debe rechazarlo por CUIT)
  - [ ] Probar importación con facturas repetidas (sistema anti-duplicados)
  - [ ] Validar edge cases y manejo de errores

#### **Fase 2: Desarrollo Cash Flow MSA**
- [ ] **Vista Flujo de Fondos**: Crear sistema de gestión de cash flow
- [ ] **Vincular facturas ARCA con Flujo de Fondos**: Sistema de matching/conciliación
- [ ] **Completar proceso MSA**: Integrar todo el workflow MSA

#### **Fase 3: Expansión PAM y Convergencia** 
- [ ] **Replicar sistema para PAM**: Una vez MSA afilado y funcionando
  - [ ] Crear esquema `pam` y tabla `pam.comprobantes_arca` 
  - [ ] Configurar permisos y exposición API para esquema PAM
  - [ ] Testing completo del flujo PAM
- [ ] **Convergencia multi-empresa**: Hacer confluir ambos sistemas
- [ ] **Integrar reportes de facturas ARCA al dashboard principal**

#### **Fase 4: Limpieza y Optimización**
- [ ] Limpiar código debug del test de conexión
- [ ] Documentar flujo completo multi-empresa
- [ ] Unificar `importador-excel.tsx` e `importador-excel-dinamico.tsx` (si aplica)
- [ ] Documentar diferencias entre formatos de bancos

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