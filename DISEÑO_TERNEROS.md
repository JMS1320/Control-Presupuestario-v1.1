# DISEÑO: Módulo Terneros — Caravanas, Pesadas y Vista Recría

> **Estado**: DISEÑO COMPLETO — Pendiente implementación
> **Fecha diseño**: 2026-02-28
> **Prioridad**: Media — nueva fase del módulo productivo ganadero
> **Contexto**: Extensión del sector ganadero existente

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
  → Se le pone caravana oficial (alfanumérica, ej: "MSA0015")
  → Se registra fecha_destete
  → Primera pesada (peso al destete = punto de partida ganancia)

RECRÍA (post-destete)
  → Pesadas periódicas (cada 30-60 días típicamente)
  → Cálculo ganancia entre últimas 2 pesadas
  → Cálculo ganancia de punta a punta desde primera pesada post-destete
```

### Identificadores

| Campo | Momento | Formato | ¿Obligatorio para el sistema? |
|---|---|---|---|
| `caravana_interna` | Nacimiento | Numérico | No (puede no tenerse) |
| `caravana_oficial` | Destete | Alfanumérico (ej: MSA0015) | Sí — clave de import pesadas |

La caravana oficial es el identificador principal para cruzar con las pesadas.

---

## 3. Datos del ternero

### Datos fijos (no cambian)

| Campo | Tipo | Valores | Notas |
|---|---|---|---|
| `caravana_interna` | VARCHAR(50) | Ej: "1234" | Opcional, único si se ingresa |
| `caravana_oficial` | VARCHAR(50) | Ej: "MSA0015" | Obligatorio una vez destetado |
| `sexo` | VARCHAR(10) | Macho / Hembra | Obligatorio |
| `pelo` | VARCHAR(50) | Ver tabla abajo | Obligatorio |
| `fecha_nacimiento` | DATE | — | Opcional |
| `fecha_destete` | DATE | — | Punto de partida ganancia |
| `rodeo_id` | UUID FK | productivo.rodeos | Opcional, para agrupación |
| `observaciones` | TEXT | — | Libre |

### Colores de pelo

| Valor en BD | Display |
|---|---|
| `Colorado` | Colorado |
| `Negro` | Negro |
| `Careta Colorado` | Careta Colorado |
| `Careta Negro` | Careta Negro |
| `Otros` | Otros |

### Pesadas (datos variables)

| Campo | Tipo | Notas |
|---|---|---|
| `ternero_id` | UUID FK | Referencia al ternero |
| `fecha` | DATE | Fecha de la pesada |
| `peso_kg` | DECIMAL(8,2) | Peso en kilogramos |
| `observaciones` | TEXT | Opcional |

---

## 4. Cálculos de ganancia diaria

### Ganancia entre últimas 2 pesadas (default display)
```
Si el ternero tiene >= 2 pesadas:
  ganancia_ult2 = (peso_pesada_n - peso_pesada_{n-1}) / dias_entre_ambas
  [kg/día]
```

### Ganancia punta a punta desde destete
```
Si el ternero tiene >= 2 pesadas (primera = pesada al destete):
  ganancia_total = (ultimo_peso - primer_peso) / (fecha_ultima - fecha_primera)
  [kg/día]
```

### Peso estimado a la fecha actual (Vista Recría)
```
El usuario ingresa un valor de ganancia_diaria_estimada [kg/día]

peso_estimado_hoy = ultimo_peso + (ganancia_diaria_estimada × dias_desde_ultima_pesada)
dias_desde_ultima_pesada = hoy - fecha_ultima_pesada
```

### Tabla resumen de ganancia (individual)

```
Ternero MSA0015 — Macho — Colorado
  Pesada 1:  15/06/2025 — 120 kg  (al destete)
  Pesada 2:  15/07/2025 — 152 kg  (+32 kg en 30 días = 1.067 kg/día)
  Pesada 3:  14/08/2025 — 181 kg  (+29 kg en 30 días = 0.967 kg/día)

  Ganancia últimas 2 pesadas: 0.967 kg/día
  Ganancia punta a punta:     (181-120) / (14/08 - 15/06) = 61 kg / 60 días = 1.017 kg/día

  Con estimación 0.800 kg/día y última pesada hace 14 días:
  Peso estimado hoy: 181 + (0.800 × 14) = 192.2 kg
```

---

## 5. Estructura de base de datos

### Migración 1: `crear_tabla_terneros`

```sql
CREATE TABLE productivo.terneros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caravana_interna VARCHAR(50),
  caravana_oficial VARCHAR(50) UNIQUE,
  sexo VARCHAR(10) NOT NULL CHECK (sexo IN ('Macho', 'Hembra')),
  pelo VARCHAR(50) NOT NULL,
  fecha_nacimiento DATE,
  fecha_destete DATE,
  rodeo_id UUID REFERENCES productivo.rodeos(id),
  observaciones TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON productivo.terneros TO anon, authenticated;
```

> **Nota FK**: Verificar nombre exacto de la tabla de rodeos en el schema productivo
> antes de implementar. Si se llama diferente, ajustar la referencia.

### Migración 2: `crear_tabla_pesadas_terneros`

```sql
CREATE TABLE productivo.pesadas_terneros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ternero_id UUID NOT NULL REFERENCES productivo.terneros(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  peso_kg DECIMAL(8,2) NOT NULL CHECK (peso_kg > 0),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para queries frecuentes: pesadas de un ternero ordenadas por fecha
CREATE INDEX idx_pesadas_ternero_fecha
  ON productivo.pesadas_terneros(ternero_id, fecha DESC);

GRANT ALL ON productivo.pesadas_terneros TO anon, authenticated;
```

---

## 6. Importación desde Excel

### Estado actual del formato

El formato de export del lector de caravanas aún no está definido — depende del dispositivo.
Por lo tanto se diseñan **dos flujos separados** según lo que hoy se puede proveer:

---

### Flujo A — Importar terneros al destete (disponible ahora)

**Cuándo se usa**: una vez al año al momento del destete. El usuario arma esta planilla manualmente.

**Columnas del Excel**:

| Columna Excel | Campo BD | Obligatorio | Notas |
|---|---|---|---|
| `Caravana Interna` / `Carav Int` | `caravana_interna` | No | Numérica, puede faltar |
| `Caravana Oficial` / `Carav Of` | `caravana_oficial` | Sí | Clave de upsert |
| `Sexo` | `sexo` | Sí | "Macho"/"M" o "Hembra"/"H" |
| `Pelo` | `pelo` | Sí | Ver valores válidos sección 3 |
| `Peso Destete` / `Peso` | → primera pesada en `pesadas_terneros` | Sí | kg, es el punto de partida |
| `Fecha Destete` / `Destete` | `fecha_destete` + fecha de la pesada | No | DD/MM/YYYY. Si falta, usar fecha import |
| `Observaciones` / `Obs` | `observaciones` | No | — |

**Lógica de procesamiento**:
1. Upsert en `terneros` por `caravana_oficial`
   - Si no existe → crear
   - Si ya existe → actualizar datos fijos (sexo, pelo, fechas)
2. Si viene `peso_destete` → insertar en `pesadas_terneros` con `fecha = fecha_destete` (o fecha import)
   - Si ya existe una pesada en esa fecha para ese ternero → no duplicar (ignorar o sobreescribir)
3. Si solo viene `caravana_interna` (sin oficial) → crear ternero sin oficial (no aparece en recría hasta que se le asigne)

> **Importante**: El `peso_destete` se registra como la primera pesada en `pesadas_terneros`.
> Es el punto de partida de todos los cálculos de ganancia. No es un campo separado en `terneros`.

---

### Flujo B — Importar pesadas periódicas (formato a definir)

**Cuándo se usa**: cada vez que se pesa el rodeo (cada 30-60 días). Viene del lector de caravanas.

**Estado**: formato de export del lector pendiente de verificar. Una vez conocido el formato,
se mapearán las columnas. Las columnas mínimas necesarias son:

| Dato mínimo | Campo BD |
|---|---|
| Identificador del animal (caravana oficial o interna) | Lookup en `terneros` |
| Peso en kg | `peso_kg` |
| Fecha de la pesada | `fecha` |

**Lógica** (igual independientemente del formato):
- Identificar ternero por caravana (oficial primero, interna como fallback)
- Si no se encuentra el ternero → reportar en errores
- Si ya existe pesada en la misma fecha → sobreescribir
- Si es fecha nueva → insertar nueva pesada

---

### API Routes necesarias

```
POST /api/import-terneros       → Flujo A (upsert terneros + primera pesada)
POST /api/import-pesadas        → Flujo B (pesadas periódicas — a implementar cuando se defina formato)
```

Mismo patrón que rutas de import existentes: FormData con archivo Excel,
devuelven `{ procesados, importados, errores[], resumen }`.

---

## 7. Estructura UI

### Navegación

```
VistaSectorProductivo
├── Tab Hacienda (sin cambios)
├── Tab Insumos (sin cambios)
├── Tab Lotes Agrícolas (sin cambios)
└── Tab Terneros  ← NUEVA
    ├── Sub-tab "Recría"       → Vista resumen + tabla individual
    ├── Sub-tab "Terneros"     → ABM de animales + importar
    └── Sub-tab "Pesadas"      → Historial + importar pesadas
```

---

## 8. Sub-tab "Recría" — Diseño detallado

### Header con input de ganancia estimada

```
[Input] Ganancia diaria estimada: [___] kg/día    Hoy: 28/02/2026
```

El usuario puede modificar este valor en cualquier momento → los estimados se recalculan instantáneamente (no se guarda en BD, solo estado React).

### Tarjetas de resumen (sección superior)

Tres grupos: **Machos** | **Hembras** | **Total Rodeo**

Para cada grupo, dos columnas:

```
                         Última pesada real    Estimado hoy (X días promedio)
Cantidad animales:       45                    45
Promedio peso:           420.3 kg              427.5 kg
Total kg del grupo:      18,913 kg             19,237 kg
Fecha última pesada:     14/08/2025            —
```

- "X días promedio" = promedio de días transcurridos desde la última pesada de cada animal
- El estimado usa: `peso_estimado_i = peso_ult_i + (ganancia_estimada × dias_desde_ult_i)` para cada animal, luego promedia

### Tabla individual (sección inferior)

Expansible / colapsable. Columnas:

| # | Caravana Of. | Carav. Int. | Pelo | Destete | Última Pesada | Peso | Gan. últ. 2 | Gan. desde destete | Peso est. hoy |
|---|---|---|---|---|---|---|---|---|---|
| | MSA0015 | 1234 | Colorado | 15/06 | 14/08 | 181 kg | 0.97 kg/d | 1.02 kg/d | 192.2 kg |

**Ordenamiento default**: por ganancia últimas 2 pesadas descendente (los que más crecen primero).

**Indicadores visuales**:
- Ganancia últimas 2 > ganancia total desde destete → verde (acelerando)
- Ganancia últimas 2 < ganancia total desde destete → rojo (desacelerando)
- Sin suficientes pesadas para calcular → gris con "—"

**Filtros disponibles**:
- Por sexo (Machos / Hembras / Todos)
- Por pelo
- Por rodeo (si se tiene asignado)

---

## 9. Sub-tab "Terneros" — ABM individual

### Tabla listado

Columnas: Caravana Oficial | Caravana Interna | Sexo | Pelo | Nacimiento | Destete | Rodeo | N° Pesadas | Último Peso | Acciones

Acciones por fila:
- **Ver pesadas**: expande/modal con historial de pesadas y gráfico de progresión
- **Editar**: modificar datos fijos del ternero
- **Inactivar**: marcar como `activo = false` (no aparece en recría)

### Botones de importación

```
[Importar Terneros (Excel)]    [Importar Pesadas (Excel)]    [+ Nuevo Ternero (manual)]
```

### Modal historial de pesadas (por ternero)

```
Ternero MSA0015 — Macho — Colorado — Destetado: 15/06/2025
─────────────────────────────────────────────────────
Fecha        Peso     Gan. desde anterior   Gan. acumulada
15/06/2025   120 kg   —                     —
15/07/2025   152 kg   +1.067 kg/día         +1.067 kg/día
14/08/2025   181 kg   +0.967 kg/día         +1.017 kg/día
─────────────────────────────────────────────────────
Estimado hoy (con 0.800 kg/día): 192.2 kg
```

---

## 10. Sub-tab "Pesadas"

### Vista

Tabla con todas las pesadas registradas en el sistema, filtrable por:
- Fecha (rango)
- Ternero (buscar por caravana)
- Rodeo

Permite:
- **Importar pesadas Excel**: botón principal
- **Ingresar pesada manual**: para una o varias caravanas
- **Eliminar pesada**: solo admin

---

## 11. Fases de implementación

| Fase | Descripción | Dependencias |
|---|---|---|
| **1** | 2 migraciones BD (terneros + pesadas) | Verificar nombre tabla rodeos |
| **2** | API route import-terneros (Flujo A) | — |
| **3** | API route import-pesadas (Flujo B) | Fase 2 |
| **4** | Sub-tab Terneros: listado + ABM + import | Fases 2-3 |
| **5** | Sub-tab Recría: tarjetas + tabla individual | Fase 4 |
| **6** | Sub-tab Pesadas: historial completo | Fase 4 |
| **7** | Modal historial individual + indicadores visuales | Fase 5-6 |

**Recomendación**: Implementar fases 1-5 juntas (core funcional). Fases 6-7 son mejoras sobre la base.

---

## 12. Verificaciones post-implementación

1. BD: tablas `terneros` y `pesadas_terneros` creadas con permisos
2. Import Excel terneros: carga correcta, upsert funciona (sin duplicados)
3. Import Excel pesadas: identifica ternero por caravana_oficial, acumula pesadas
4. Sub-tab Recría: tarjetas muestran N animales, promedio y total por sexo
5. Estimado hoy: cambia en tiempo real al modificar ganancia diaria estimada
6. Ganancia últimas 2: calcula correctamente con 2+ pesadas
7. Ganancia punta a punta: calcula desde primera pesada registrada
8. Indicadores visuales acelerando/desacelerando correctos
9. Ternero con solo 1 pesada: muestra peso sin cálculo de ganancia (no error)
10. Ternero sin caravana oficial: no aparece en Vista Recría
11. `npm run build` sin errores

---

## 13. Preguntas abiertas (a confirmar antes de implementar)

1. **Nombre exacto tabla rodeos**: ¿`productivo.rodeos`? Verificar contra schema actual antes de crear FK.
2. **Normalización de pelo**: ¿"Careta Colorado" y "Careta Negro" siempre con ese formato exacto o puede variar en el Excel? → Definir mapeo de normalización en import.
3. **Sexo en Excel**: ¿Puede venir como "M"/"H" además de "Macho"/"Hembra"? → Confirmar variantes a soportar.
4. **Eliminación de pesadas**: ¿Solo admin puede eliminar o cualquiera? ¿Con confirmación?
5. **Fecha de pesada en import Flujo A**: Si el Excel no tiene columna de fecha destete, ¿se usa la fecha del día de importación o se deja null?
6. **Formato lector de caravanas**: ⏳ Pendiente — ver el export del dispositivo para diseñar Flujo B. Columnas mínimas necesarias: identificador del animal + peso + fecha.
7. **Caravana interna como fallback en Flujo B**: Si el lector solo guarda caravana interna (no oficial), ¿se busca el ternero por caravana_interna? → Confirmar una vez visto el formato del lector.

---

**📅 Última actualización:** 2026-02-28 (rev. 2 — aclaración formato Excel)
**Estado**: Diseño completo — Flujo A listo para implementar. Flujo B pendiente formato lector de caravanas.
