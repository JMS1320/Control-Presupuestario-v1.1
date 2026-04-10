# ⚡ GUÍA RÁPIDA - RECONSTRUCCIÓN SUPABASE

> **Tiempo estimado total:** 2 horas
> **Prerequisito:** Documento completo en `RECONSTRUCCION_SUPABASE_2026-01-07.md`

---

## 📋 CHECKLIST PASO A PASO

### ☐ **PASO 1: Crear Nuevo Proyecto Supabase** (5 min)

1. Ir a: https://supabase.com/dashboard
2. Click en **"New project"**
3. Configurar:
   - **Name:** `control-presupuestario-v2` (o el nombre que prefieras)
   - **Database Password:** ⚠️ GUARDAR EN LUGAR SEGURO
   - **Region:** Closest to you (probablemente South America)
   - **Pricing Plan:** Free (o el que prefieras)
4. Click **"Create new project"**
5. ⏳ Esperar ~2 minutos mientras se crea

**✅ Verificación:**
- [ ] Proyecto creado correctamente
- [ ] Puedes acceder al dashboard
- [ ] Tienes la URL del proyecto (algo como: `https://xxx.supabase.co`)

---

### ☐ **PASO 2: Guardar Credenciales** (2 min)

1. En el proyecto → **Settings** (⚙️) → **API**
2. Copiar y guardar:
   ```
   Project URL: https://[tu-proyecto].supabase.co
   anon/public key: eyJhbG...
   service_role key: eyJhbG... (⚠️ SECRETO - NO COMPARTIR)
   ```

**✅ Verificación:**
- [ ] 3 valores guardados en lugar seguro
- [ ] Puedes acceder a ellos cuando necesites

---

### ☐ **PASO 3: Ejecutar Scripts SQL** (30-45 min)

#### 3.1. Abrir SQL Editor
1. En Supabase → Click **SQL Editor** (icono 📝)
2. Click **"New query"**

#### 3.2. Script 1 - Schemas y ENUMs
1. Abrir: `RECONSTRUCCION_SUPABASE_2026-01-07.md`
2. Ir a sección: **"SCRIPT 1: SCHEMAS Y ENUMS"** (línea ~1184)
3. Copiar TODO el código SQL del script
4. Pegar en SQL Editor de Supabase
5. Click **"Run"** (o Ctrl+Enter)
6. ✅ Verificar resultado: Debería mostrar 2 filas (schema 'msa' + tipo 'tipo_cuenta')

**✅ Verificación:**
```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'msa';
SELECT typname FROM pg_type WHERE typname = 'tipo_cuenta';
```
- [ ] Resultado: 2 filas encontradas

#### 3.3. Script 2 - Tablas Base
1. Buscar sección: **"SCRIPT 2: TABLAS BASE"** (línea ~1212)
2. Copiar TODO el código SQL
3. **Nuevo query** en SQL Editor
4. Pegar y ejecutar
5. ⏳ Tardará ~1-2 minutos

**✅ Verificación:**
```sql
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname IN ('msa', 'public')
ORDER BY schemaname, tablename;
```
- [ ] Resultado: 11 tablas creadas (1 en msa, 10 en public)

#### 3.4. Script 3 - Alteraciones comprobantes_arca
1. Buscar: **"SCRIPT 3: ALTERACIONES COMPROBANTES_ARCA"** (línea ~1542)
2. Copiar, nuevo query, pegar, ejecutar

**✅ Verificación:**
```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = 'msa' AND table_name = 'comprobantes_arca';
```
- [ ] Resultado: ~48 columnas (33 base + 15 nuevas)

#### 3.5. Script 4 - Tablas Nuevas
1. Buscar: **"SCRIPT 4: TABLAS NUEVAS"** (línea ~1599)
2. Copiar, nuevo query, pegar, ejecutar

**✅ Verificación:**
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tipos_sicore_config', 'tipos_comprobante_afip');
```
- [ ] Resultado: 2 tablas (tipos_sicore_config, tipos_comprobante_afip)

#### 3.6. Script 5 - Funciones
1. Buscar: **"SCRIPT 5: FUNCIONES"** (línea ~1647)
2. Copiar, nuevo query, pegar, ejecutar

**✅ Verificación:**
```sql
SELECT proname FROM pg_proc
WHERE proname LIKE 'update%' OR proname LIKE 'calcular%' OR proname LIKE 'fix%'
ORDER BY proname;
```
- [ ] Resultado: 6 funciones creadas

#### 3.7. Script 6 - Triggers
1. Buscar: **"SCRIPT 6: TRIGGERS"** (línea ~1825)
2. Copiar, nuevo query, pegar, ejecutar

**✅ Verificación:**
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```
- [ ] Resultado: 4 triggers creados

#### 3.8. Script 7 - RLS Policies
1. Buscar: **"SCRIPT 7: POLÍTICAS RLS"** (línea ~1872)
2. Copiar, nuevo query, pegar, ejecutar
3. ⏳ Tardará ~30 segundos

**✅ Verificación:**
```sql
SELECT COUNT(*) FROM pg_policies
WHERE schemaname IN ('public', 'msa');
```
- [ ] Resultado: 13 políticas creadas

#### 3.9. Script 8 - Datos Semilla
1. Buscar: **"SCRIPT 8: DATOS SEMILLA"** (línea ~2011)
2. Copiar, nuevo query, pegar, ejecutar
3. ⏳ Tardará ~10-15 segundos

**✅ Verificación final:**
```sql
SELECT
  'tipos_sicore_config' as tabla, COUNT(*)::text as registros
FROM public.tipos_sicore_config
UNION ALL
SELECT 'distribucion_socios', COUNT(*)::text FROM public.distribucion_socios
UNION ALL
SELECT 'cuentas_contables', COUNT(*)::text FROM public.cuentas_contables
UNION ALL
SELECT 'tipos_comprobante_afip', COUNT(*)::text FROM public.tipos_comprobante_afip;
```
- [ ] Resultado: 4 filas con totales (4, 8, 67, 5)

---

### ☐ **PASO 4: Obtener 72 Tipos AFIP** ⚠️ CRÍTICO (15-30 min)

#### Opción A: Descargar desde AFIP (Recomendado)
1. Ir a: https://www.afip.gob.ar/fe/documentos/TABLA_COMPROBANTES.xls
2. Descargar archivo Excel
3. Abrir y revisar columnas:
   - Código (1, 2, 3, ...)
   - Descripción ("Factura A", "Nota de Crédito B", ...)
   - Es Nota de Crédito (marca tipos NC/ND)

4. Convertir a SQL INSERT:
```sql
-- Ejemplo formato necesario:
INSERT INTO public.tipos_comprobante_afip (codigo, descripcion, es_nota_credito, activo)
VALUES
  (1, 'Factura A', false, true),
  (2, 'Nota de Débito A', false, true),
  (3, 'Nota de Crédito A', true, true),
  -- ... continuar hasta código 201
```

5. Ejecutar en SQL Editor

#### Opción B: Recuperar de BD Anterior (Si accesible)
```sql
-- En BD anterior (aunque esté corrupta):
SELECT codigo, descripcion, es_nota_credito
FROM tipos_comprobante_afip
ORDER BY codigo;
```

**✅ Verificación:**
```sql
SELECT COUNT(*) as total FROM public.tipos_comprobante_afip;
```
- [ ] Resultado: 72 tipos cargados

⚠️ **SIN ESTO:** El import de facturas Excel AFIP NO funcionará

---

### ☐ **PASO 5: Actualizar Variables de Entorno** (5 min)

1. Ir a la raíz del proyecto local
2. Editar archivo `.env.local`:

```bash
# Reemplazar con NUEVAS credenciales:
NEXT_PUBLIC_SUPABASE_URL=https://[TU-PROYECTO].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[TU-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[TU-SERVICE-ROLE-KEY]
```

3. Guardar archivo

**✅ Verificación:**
- [ ] 3 variables actualizadas con valores del PASO 2
- [ ] Archivo guardado correctamente

---

### ☐ **PASO 6: Testing Aplicación** (30 min)

#### 6.1. Iniciar Aplicación
```bash
npm run dev
```

Esperar mensaje: `Ready on http://localhost:3000`

#### 6.2. Testing Básico

**Test 1: Conexión BD**
1. Abrir: http://localhost:3000
2. Verificar que carga sin errores de conexión

- [ ] ✅ Aplicación carga correctamente

**Test 2: Vista Cuentas Contables**
1. Ir a: Configuración → Cuentas Contables
2. Verificar que muestra 67 cuentas

- [ ] ✅ 67 cuentas contables visibles

**Test 3: Vista ARCA Facturas (vacía)**
1. Ir a: Egresos → ARCA Facturas
2. Verificar que carga (tabla vacía es correcto)

- [ ] ✅ Vista carga sin errores

**Test 4: Vista Templates (vacía)**
1. Ir a: Egresos → Templates
2. Verificar que carga (tabla vacía es correcto)

- [ ] ✅ Vista carga sin errores

**Test 5: Vista Cash Flow (vacía)**
1. Ir a: Vista Principal → Cash Flow
2. Verificar que carga (tabla vacía es correcto)

- [ ] ✅ Vista carga sin errores

**Test 6: Sistema SICORE**
1. Ir a: ARCA Facturas → Configuración (si existe)
2. Verificar que muestra 4 tipos SICORE

- [ ] ✅ 4 tipos SICORE configurados

---

### ☐ **PASO 6b: GRANTs adicionales post-reconstrucción** (2 min)

Estos permisos no están en el backup original y deben aplicarse manualmente:

```sql
-- Permite al botón Reset borrar retenciones desde el navegador
GRANT DELETE ON msa.sicore_retenciones TO anon;

-- DEFAULT ddjj_iva debe ser 'No' (el backup puede traerlo como 'Pendiente')
ALTER TABLE msa.comprobantes_arca ALTER COLUMN ddjj_iva SET DEFAULT 'No';
UPDATE msa.comprobantes_arca SET ddjj_iva = 'No' WHERE ddjj_iva = 'Pendiente';

-- Columnas TXT SICORE (secuencial exportación + DDJJ)
ALTER TABLE msa.sicore_retenciones
  ADD COLUMN IF NOT EXISTS nro_comprobante BIGINT,
  ADD COLUMN IF NOT EXISTS nro_certificado VARCHAR(14),
  ADD COLUMN IF NOT EXISTS ddjj_confirmada BOOLEAN DEFAULT FALSE;

-- Código régimen ARCA por tipo SICORE
ALTER TABLE public.tipos_sicore_config
  ADD COLUMN IF NOT EXISTS codigo_regimen VARCHAR(3);
UPDATE public.tipos_sicore_config SET codigo_regimen = '032' WHERE tipo = 'Arrendamiento';
UPDATE public.tipos_sicore_config SET codigo_regimen = '078' WHERE tipo = 'Bienes';
UPDATE public.tipos_sicore_config SET codigo_regimen = '094' WHERE tipo = 'Servicios';
UPDATE public.tipos_sicore_config SET codigo_regimen = '095' WHERE tipo = 'Transporte';
```

**✅ Verificación:**
```sql
SELECT column_default FROM information_schema.columns
WHERE table_schema = 'msa' AND table_name = 'comprobantes_arca' AND column_name = 'ddjj_iva';
-- Debe retornar: 'No'::character varying

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'msa' AND table_name = 'sicore_retenciones'
  AND column_name IN ('nro_comprobante','nro_certificado','ddjj_confirmada');
-- Debe retornar: 3 filas

SELECT tipo, codigo_regimen FROM public.tipos_sicore_config ORDER BY id;
-- Debe retornar 4 filas con códigos 032/078/094/095
```

- [ ] GRANTs aplicados

---

### ☐ **PASO 7: Backup Inmediato** ⚠️ IMPORTANTE (10 min)

1. En Supabase Dashboard → **Database** → **Backups**
2. Click **"Create backup"** (manual backup)
3. Nombre: `post-reconstruccion-2026-01-07`
4. Esperar confirmación

**✅ Verificación:**
- [ ] Backup creado correctamente
- [ ] Visible en lista de backups

**Razón:** Si algo falla durante testing/uso, puedes volver a este punto.

---

### ☐ **PASO 8: Importar Datos Históricos** (OPCIONAL)

⚠️ **Solo si tienes backups de DATOS (no solo esquema)**

1. Identificar archivo de datos (ejemplo: `data_backup_*.sql`)
2. Revisar contenido:
```bash
head -100 data_backup_20250817_112258.sql
```

3. Si contiene `INSERT INTO` con datos reales:
   - Abrir en SQL Editor
   - Ejecutar con precaución
   - Verificar integridad después

**✅ Verificación:**
```sql
SELECT COUNT(*) FROM msa.comprobantes_arca;
SELECT COUNT(*) FROM public.cuotas_egresos_sin_factura;
```
- [ ] Datos históricos importados (si aplicable)

---

## 🎉 RECONSTRUCCIÓN COMPLETADA

### ✅ Checklist Final:

- [ ] **PASO 1:** Proyecto Supabase creado
- [ ] **PASO 2:** Credenciales guardadas
- [ ] **PASO 3:** 8 scripts SQL ejecutados exitosamente
- [ ] **PASO 4:** 72 tipos AFIP cargados
- [ ] **PASO 5:** Variables de entorno actualizadas
- [ ] **PASO 6:** Testing básico OK
- [ ] **PASO 7:** Backup post-reconstrucción creado
- [ ] **PASO 8:** Datos históricos importados (opcional)

---

## 🚨 TROUBLESHOOTING COMÚN

### Error: "relation does not exist"
**Causa:** Script anterior no se ejecutó
**Solución:** Volver a ejecutar scripts en orden desde el que falló

### Error: "permission denied"
**Causa:** RLS activado pero sin políticas
**Solución:** Verificar que Script 7 (RLS) se ejecutó completamente

### Error: "duplicate key value"
**Causa:** Script ya ejecutado previamente
**Solución:** No pasa nada, continuar con siguiente script

### Aplicación no conecta a BD
**Causa:** Variables de entorno incorrectas
**Solución:**
1. Verificar `.env.local` tiene valores correctos
2. Reiniciar `npm run dev`
3. Verificar que URL Supabase es correcta

### Vista carga pero sin datos
**Causa:** Normal - BD recién creada está vacía
**Solución:** Esto es correcto. Los datos se agregan usando la aplicación.

---

## 📞 CONTACTO SI HAY PROBLEMAS

Si encuentras errores durante la reconstrucción:

1. **Revisar logs SQL Editor** - Supabase muestra errores específicos
2. **Verificar cada paso** - Usar queries de verificación incluidas
3. **Consultar documento completo** - `RECONSTRUCCION_SUPABASE_2026-01-07.md` tiene más detalles
4. **Crear issue** - Si es problema del proyecto original

---

**Última actualización:** 2026-01-07
**Versión guía:** 1.0
**Documento base:** RECONSTRUCCION_SUPABASE_2026-01-07.md
