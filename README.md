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

### Configurar Supabase:
1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar migraciones SQL (pendiente documentar)
3. Copiar las claves del proyecto a `.env.local`

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

### 📋 **Tareas Pendientes - Fase Actual**
- [ ] Terminar desarrollo del importador PAM Galicia
- [ ] Unificar `importador-excel.tsx` e `importador-excel-dinamico.tsx`
- [ ] Integrar selector de banco en la UI principal
- [ ] Testing completo del flujo PAM
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