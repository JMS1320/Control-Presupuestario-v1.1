# DISEÑO E IMPLEMENTACIÓN: Módulo Terneros — Caravanas, Pesadas y Vista Recría

> **Estado**: ✅ IMPLEMENTADO — Operativo con datos reales
> **Fecha diseño**: 2026-02-28
> **Fecha implementación**: 2026-03-04
> **Prioridad**: Media — nueva fase del módulo productivo ganadero
> **Contexto**: Extensión del sector ganadero existente

---

## ✅ Resumen de lo implementado (sesión 2026-03-04)

| Feature | Estado |
|---------|--------|
| Tabla BD `terneros` | ✅ Creada y operativa |
| Tabla BD `pesadas_terneros` | ✅ Creada, `ternero_id` nullable + campo `caravana_idv` |
| API `POST /api/import-terneros` | ✅ Flujo A funcionando |
| API `POST /api/import-pesadas` (2 acciones) | ✅ Flujo B funcionando |
| UI Tab Terneros (tab única, no sub-tabs) | ✅ Implementado |
| Importar terneros desde Excel | ✅ |
| Importar pesadas con flujo analizar → confirmar | ✅ |
| Tarjetas resumen Machos / Hembras / Total Rodeo | ✅ |
| Columnas Últ. Pesada + Peso hoy est. | ✅ |
| Columnas Gan. últ. 2 + Gan. p→p con indicadores ▲▼ | ✅ |
| Tabla ordenada por ganancia desc | ✅ |
| Historial pivot (1 col por fecha) + totales extrapolados | ✅ |
| Tabla pivot ganancias (Δkg/día entre períodos) | ✅ |
| Sección "Caravanas no coincidentes" (pesadas sin vincular) | ✅ |
| Input ganancia diaria estimada (kg/día) | ✅ |

---

## 1. Objetivo

Registrar y analizar el crecimiento individual de los terneros desde su nacimiento hasta
que salen de la etapa de recría, con foco en:

- Identificación dual (caravana interna al nacer + caravana oficial al destete)
- Historial de pesadas con cálculo de ganancia diaria
- Vista Recría: resumen por sexo con datos reales y proyección a la fecha actual

---

## 2. Conceptos clave del proceso ganadero

### Ciclo de vida del ternero en el sistema

```
NACIMIENTO
  → Se le pone caravana interna (número)
  → Registrar: caravana_interna, sexo, pelo, fecha_nacimiento (si se tiene)

DESTETE (aprox. 6-8 meses)
  → Se le pone caravana oficial IDV (ej: "032 010012326425")
  → Se registra fecha_destete
  → Primera pesada (peso al destete = punto de partida ganancia)

RECRÍA (post-destete)
  → Pesadas periódicas (cada 30-60 días típicamente)
  → Cálculo ganancia entre últimas 2 pesadas
  → Cálculo ganancia de punta a punta desde primera pesada post-destete
```

### Identificadores

| Campo | Momento | Formato real | Notas |
|---|---|---|---|
| `caravana_interna` | Nacimiento | Numérico (ej: "184") | Opcional, del libro de partos |
| `caravana_oficial` | Destete | IDV formateado (ej: "032 010012326425") | Clave de match con pesadas |

La caravana oficial es el identificador principal para cruzar con las pesadas.

### ⚠️ Formato IDV — conversión crítica

El lector de caravanas exporta el IDV como un **número entero de 14 dígitos** (ej: `32010012326425`).
La caravana oficial en BD tiene formato `032 010012326425` (15 dígitos con espacio tras posición 3).

**Conversión IDV → caravana_oficial:**
```
IDV (14 dígitos): 32010012326425
Pad a 15:         032010012326425
Insertar espacio: 032 010012326425  ← caravana_oficial en BD
```

Esta conversión se hace en el servidor (`app/api/import-pesadas/route.ts`, función `idvACaravana`).
El Excel del lector puede tener el IDV como número o como texto con espacio — ambos funcionan
porque la función hace `.replace(/\D/g, '')` antes de procesar.

---

## 3. Estructura de base de datos — estado real

### Tabla `productivo.terneros`

```sql
CREATE TABLE productivo.terneros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caravana_interna VARCHAR(50),
  caravana_oficial VARCHAR(50) UNIQUE,
  sexo VARCHAR(10) CHECK (sexo IN ('Macho', 'Hembra')),
  pelo VARCHAR(50),
  fecha_nacimiento DATE,
  fecha_destete DATE,
  es_torito BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON productivo.terneros TO anon, authenticated, service_role;
```

> **Diferencia vs diseño**: `sexo` y `pelo` son NOT NULL en el diseño pero en la implementación
> se dejaron sin esa restricción para soportar import sin esos datos. La constraint
> `rodeo_id FK` tampoco se implementó aún (no se verificó si existe la tabla rodeos).

### Tabla `productivo.pesadas_terneros`

```sql
CREATE TABLE productivo.pesadas_terneros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ternero_id UUID REFERENCES productivo.terneros(id) ON DELETE CASCADE,  -- NULLABLE
  caravana_idv VARCHAR(50),   -- IDV original del archivo (para pesadas sin vincular)
  fecha DATE NOT NULL,
  peso_kg DECIMAL(8,2) NOT NULL CHECK (peso_kg > 0),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pesadas_ternero_fecha
  ON productivo.pesadas_terneros(ternero_id, fecha DESC);

GRANT ALL ON productivo.pesadas_terneros TO anon, authenticated, service_role;
```

> **Diferencia clave vs diseño original**: `ternero_id` es **NULLABLE** para soportar
> pesadas de animales no encontrados en BD ("sin vincular"). Se agregó `caravana_idv`
> para guardar el IDV original en esos casos.

### Migración aplicada post-creación

```sql
-- Hacer ternero_id nullable (si se creó NOT NULL inicialmente)
ALTER TABLE productivo.pesadas_terneros ALTER COLUMN ternero_id DROP NOT NULL;

-- Agregar columna IDV original
ALTER TABLE productivo.pesadas_terneros
  ADD COLUMN IF NOT EXISTS caravana_idv VARCHAR(50);

GRANT ALL ON productivo.pesadas_terneros TO service_role;
```

---

## 4. API Routes implementadas

### `POST /api/import-terneros`

Importa terneros desde Excel (Flujo A). Columnas reconocidas:

| Columna Excel | Campo BD |
|---|---|
| `Carav_Nacim` / `Caravana Interna` / `Carav Int` | `caravana_interna` |
| `Carav_Oficial` / `Caravana Oficial` / `Carav Of` | `caravana_oficial` |
| `Sexo` / `sexo` | `sexo` (normaliza M→Macho, H→Hembra) |
| `Pelo` / `pelo` | `pelo` (normaliza C→Colorado, N→Negro, CC→Careta Colorado, CN→Careta Negro) |
| `Torito` / `torito` | `es_torito` (Si/Sí/true/1/yes) |
| `Obs` / `Observaciones` | `observaciones` |

Retorna: `{ procesados, insertados, omitidos, duplicados_en_archivo[], duplicados_en_bd[], errores[] }`

> **Nota formato destete**: El CSV original `20260223_destete_transcripcionJMS.csv` solo tenía
> `Carav_Nacim` (→ caravana_interna) y `Carav_Nueva` (no mapeada). La caravana oficial
> se cargó desde otro Excel con la columna `Carav_Oficial`. La primera pesada se importó
> por separado con el Flujo B.

### `POST /api/import-pesadas?accion=analizar`

Recibe FormData con archivo Excel. Detecta la fecha de pesada (columna `Fecha`),
convierte IDVs (columna `IDV`), y cruza contra `productivo.terneros`.

Retorna clasificación en tres grupos:
```typescript
{
  fecha: string,           // fecha detectada del archivo
  sin_idv: number,         // filas sin IDV válido (ignoradas)
  total_con_idv: number,
  ok: [...],               // coincidencia exacta 1:1 con ternero
  no_encontradas: [...],   // IDV válido pero no hay ternero en BD
  duplicadas: [...],       // IDV que matchea >1 ternero en BD
}
```

### `POST /api/import-pesadas?accion=confirmar`

Recibe JSON con decisiones del usuario:
- `rows_ok`: insertar directamente
- `no_encontradas_decisiones`: accion = `'sin_vincular'` | `'crear_nuevo'` | `'ignorar'`
- `duplicadas_decisiones`: ternero_id elegido por el usuario

**`sin_vincular`**: guarda pesada con `ternero_id = null` + `caravana_idv` en la sección "no coincidentes".
**`crear_nuevo`**: crea ternero mínimo con solo `caravana_oficial` y luego asocia la pesada.

---

## 5. UI implementada — Tab Terneros

### Estructura (tab única, sin sub-tabs por ahora)

```
Tab Terneros
├── Header: badges resumen + botones importar
├── Input ganancia diaria estimada (kg/día)
├── Tarjetas resumen: ♂ Machos | ♀ Hembras | 🐄 Total Rodeo
├── Tabla principal de terneros
├── Sección "Caravanas no coincidentes" (solo si hay pesadas sin vincular)
└── Modales:
    ├── Resultado import terneros
    ├── Import pesadas (3 pasos: analizar → resolver → confirmar)
    └── Historial pesadas (tabla pivot pesos + tabla pivot ganancias)
```

### Tarjetas de resumen

Cada tarjeta muestra: Con pesada / Total kg / Promedio / Est. hoy total / Est. hoy prom.

**Cálculo de Total kg (extrapolado):**
```
totalKg = promedioKg * totalCabezas
```
Los animales sin pesada asumen el peso promedio del grupo. No se usa la suma directa
de pesadas reales (que dejaría fuera a los sin pesada).

### Tabla principal — columnas

| Col | Descripción |
|-----|-------------|
| ⚠️ | Advertencia si caravana duplicada en BD |
| Carav. Oficial | Formato `032 010012326425` |
| Carav. Interna | Número simple (ej: `184`) |
| Sexo | ♂ M / ♀ H |
| Pelo | Colorado / Negro / etc. |
| Torito | Badge 🐂 si aplica |
| Últ. Pesada | Fecha + peso de la última pesada |
| Peso hoy est. | Proyección con ganancia estimada |
| **Gan. últ. 2** | kg/día entre últimas 2 pesadas. ▲ verde si > p→p, ▼ rojo si < p→p |
| **Gan. p→p** | kg/día de primera a última pesada |
| Obs. | Observaciones |

**Ordenamiento**: por `Gan. últ. 2` descendente (nulos al final, luego por caravana).

### Modal Historial — tabla pivot de pesos

Filas: terneros con ≥1 pesada. Columnas: una por fecha de pesada.
Filas de totales al pie: ♂ Total / ♂ Promedio / ♀ Total / ♀ Promedio / 🐄 Total / 🐄 Prom.
(Total = promedio × cabezas totales del grupo, no solo los pesados.)

### Modal Historial — tabla pivot de ganancias

Solo aparece cuando hay ≥2 fechas de pesada.
Filas: terneros con ≥2 pesadas. Columnas: una por par de fechas consecutivas (header muestra ambas fechas + días entre ellas).

Cada celda: Δkg/día para ese período. Color por comparación vs período anterior:
- ▲ verde = mejoró vs período anterior
- ▼ rojo = empeoró vs período anterior
- gris = primer período (sin comparación) o sin datos para ese par

Filas de promedios al pie: ♂ Prom. / ♀ Prom. / 🐄 Prom.

---

## 6. Datos de producción cargados

### Primera carga (2026-02-23)

- **Terneros importados**: 189 animales del destete Feb 2026
- **Archivo origen**: `20260223_destete_transcripcionJMS.csv` (caravanas internas)
  + Excel separado con caravanas oficiales IDV
- **Primera pesada**: fecha `2026-02-23`, **185 terneros pesados** (4 sin pesada)
- **Rango pesos**: 63 kg (mínimo) — 268 kg (máximo)
- **Caravanas sin vincular**: 4 pesadas con IDV no encontrado en BD

### Archivos de test generados (pesos ficticios)

| Archivo | Fecha | Días desde anterior | Gain promedio |
|---------|-------|-------------------|---------------|
| `Pesadas_ficticias_25-03-2026.xlsx` | 25/03/2026 | 30 días | 0.488 kg/día (6 animales con baja) |
| `Pesadas_ficticias_25-04-2026.xlsx` | 25/04/2026 | 31 días | 0.491 kg/día (5 animales distintos con baja) |

Estos archivos sirven para probar el flujo completo, la tabla de ganancias y los indicadores ▲▼.

---

## 7. Cálculos de ganancia

### Ganancia entre últimas 2 pesadas
```
getGananciaUlt2(pesadas) → kg/día
  = (peso_n - peso_{n-1}) / dias_entre_ambas
  Requiere ≥ 2 pesadas. Si ≤1 → null → muestra "—"
```

### Ganancia punta a punta
```
getGananciaPuntaAPunta(pesadas) → kg/día
  = (peso_última - peso_primera) / días_totales
  Requiere ≥ 2 pesadas.
```

### Indicador ▲▼ en tabla principal
```
acelerando   = ganUlt2 > ganPaP  → verde ▲
desacelerando = ganUlt2 < ganPaP → rojo ▼
igual/nulo   = gris sin indicador
```

### Indicador ▲▼ en tabla pivot ganancias
```
mejora = ganancia_período_actual > ganancia_período_anterior → verde ▲
baja   = ganancia_período_actual < ganancia_período_anterior → rojo ▼
primer período → sin indicador
```

---

## 8. Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `components/tab-terneros.tsx` | Componente UI completo del tab |
| `app/api/import-terneros/route.ts` | API Flujo A — importar terneros desde Excel |
| `app/api/import-pesadas/route.ts` | API Flujo B — analizar + confirmar pesadas |

---

## 9. Pendientes / Mejoras futuras

| Feature | Prioridad | Notas |
|---------|-----------|-------|
| Sub-tabs dentro del Tab Terneros | Media | Por ahora todo en un tab único |
| Filtros por sexo / pelo en tabla principal | Media | |
| Modal historial individual (por ternero) | Media | Ver tabla de pesadas + gráfico |
| Edición/eliminación de pesada individual | Media | Solo admin |
| Campo `rodeo_id` FK | Baja | Verificar si existe tabla `productivo.rodeos` |
| Gráfico de progresión de peso por ternero | Baja | |
| Ingresar pesada manual (sin Excel) | Baja | |
| Vincular pesadas "sin vincular" a terneros | Media | UI para resolver luego del import |

---

## 10. Verificaciones de integridad

1. ✅ `npm run build` sin errores TypeScript
2. ✅ Import terneros: CSV destete 189 animales importados correctamente
3. ✅ Import pesadas: 185 pesadas del 23/02 importadas con flujo analizar → confirmar
4. ✅ Tarjetas de resumen: totalKg extrapolado (promedio × total cabezas)
5. ✅ Ganancia con 1 pesada: muestra "—" sin error
6. ✅ Tabla pivot ganancias: solo aparece con ≥2 fechas distintas
7. ✅ Sección "sin vincular": muestra solo pesadas con `ternero_id IS NULL`
8. ✅ Historial totales: misma fórmula extrapolada que tarjetas

---

**📅 Diseño original:** 2026-02-28
**📅 Implementado:** 2026-03-04
**Estado actual:** Operativo con datos reales · Listo para segunda pesada real
