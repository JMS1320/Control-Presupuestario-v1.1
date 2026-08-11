# 🐞 ERRORES CONOCIDOS — baseline de errores pre-existentes

> Log de errores que aparecen al compilar/probar y **NO** son del cambio en curso (preexistentes).
> Captura barata: se anota la salida cruda con fecha, SIN investigar en el momento.
> Se triagea/investiga después, desde el pendiente **A-OP-07** de `PENDIENTES.md`.

**Adoptado:** 2026-06-21

---

## 📐 Cómo se usa (regla)

**Captura (en cada build/type-check/test durante desarrollo):**
- Si aparece un error que NO es del cambio actual → anotarlo en la tabla de abajo. Pegar `archivo:línea + mensaje` tal cual, con fecha.
- **NO investigar la causa en el momento** (eso consume el desarrollo actual).
- **Solo errores reales.** NO warnings de formato (LF/CRLF, prettier, etc.) ni ruido.
- **Dedup por firma**: si el error ya está en la tabla → NO crear fila nueva; actualizar "Última vez" + sumar 1 a "Veces".

**Para qué sirve (el valor):**
- Baseline verificable: si aparece un error que NO está acá → lo causó el cambio actual (no es preexistente). Vuelve comprobable el "no rompí nada".
- Backlog triageable: los que se repiten mucho o empiezan a bloquear suben a la lista de fixes.

**Triage (cuando haya tiempo o el error moleste):** se investiga desde A-OP-07. Al resolver → marcar fila como ✅ resuelto (con commit) o moverla a un bug de `PENDIENTES.md` si amerita trabajo.

**Estados de fila:** 🆕 nuevo · 🔁 recurrente · 🔍 en triage · ✅ resuelto

---

## 🔢 Baseline de errores de TIPOS — por archivo (desde 2026-08-11)

> **Se chequea con un comando, no de memoria:**
> ```
> npm run type-check:diff       compara contra el baseline · falla si algún archivo empeoró
> npm run type-check:baseline   acepta el estado actual como nuevo piso
> ```
> El dato vive en `scripts/type-errors-baseline.json` (commiteado, así el chequeo corre en
> cualquier máquina y la diferencia se ve en el diff). La tabla de abajo es la copia legible.

### 🔴 Por qué es POR ARCHIVO y no un total
Hasta 2026-08-10 el chequeo era comparar **el total**: 117 antes, 117 después → *"no rompí nada"*.
Adentro de esos 117 estaban las causas de **dos bugs de una misma sesión**:

| Bug | Qué había en el baseline | Qué costó |
|---|---|---|
| `A-BUG-19` | 4 errores en `vista-cash-flow.tsx` señalando el tipo mal | pagos de sueldos que la pantalla daba por guardados y **nunca se guardaban** |
| `A-BUG-22` | *nada* — un `as any` lo silenció al escribirlo | a las **Fac C** se les proponía retención SICORE |

El problema no era falta de atención: **117 es un muro que nadie lee**. Pero `vista-cash-flow.tsx`
tenía **13**, y trece líneas se leen en diez segundos. Cambiar la unidad de medida es lo que
convierte *"no rompí nada"* en algo **verificable por el usuario**, en vez de una afirmación de Claude.

### 📋 El baseline (generado 2026-08-11 — 113 errores en 16 archivos)

| Archivo | Errores |
|---|---|
| `components/vista-facturas-arca.tsx` | 45 |
| `app/api/import-excel-dinamico/route.ts` | 14 |
| `components/vista-extracto-bancario.tsx` | 11 |
| `components/vista-cash-flow.tsx` | 9 |
| `components/vista-templates-egresos.tsx` | 9 |
| `components/vista-sector-productivo.tsx` | 6 |
| `components/vista-asignacion-arca.tsx` | 4 |
| `components/vista-historico-facturas.tsx` | 3 |
| `hooks/useMultiCashFlowData.ts` | 3 |
| `app/api/import-excel/route.ts` | 2 |
| `hooks/useAlertasTemplates.ts` | 2 |
| `app/importador-nuevo/page.tsx` | 1 |
| `components/reporte-detallado.tsx` | 1 |
| `components/tab-terneros.tsx` | 1 |
| `config/access-routes.ts` | 1 |
| `scripts/reporte-categorias-templates.ts` | 1 |

> **Nota**: 45 de los 113 están en `components/vista-facturas-arca.tsx`, la pantalla que el
> usuario decidió dar de baja cuando Cash Flow esté al 100 % (ver `PENDIENTES.md` § A-BUG-21). Sin
> ella son 68 en 15 archivos.

### 🧭 Cómo se usa al desarrollar
1. **Antes de tocar un archivo**, mirar cuántos tiene y leerlos:
   `npx tsc --noEmit -p tsconfig.json | grep "<archivo>"`. Son entre 1 y 14 en casi todos.
2. **Al terminar**, `npm run type-check:diff`. Si un archivo que tocaste empeoró, **lo causó el
   cambio en curso** — no es preexistente.
3. **Si bajó**, fijar el nuevo piso con `npm run type-check:baseline` y decir en el commit cuáles
   se arreglaron. Así el número nunca vuelve a subir en silencio.

⚠️ **`as any` no aparece acá** — justamente porque silencia el error antes de que llegue. Hay **200**
en el código. La variante peligrosa es la que **afirma que una propiedad existe**
(`(fila as any).tipo_comprobante`): eso fue `A-BUG-22`. Repaso pendiente en `A-OP-07`.

---

## 📋 Log de errores

| Estado | Firma (archivo:línea + mensaje corto) | Comando | 1ª vez | Última vez | Veces | Notas |
|--------|----------------------------------------|---------|--------|------------|-------|-------|
| 🆕 | **`tsc --noEmit` → 119 errores TS preexistentes en 18 archivos** | `npx tsc --noEmit` | 2026-06-21 | 2026-06-21 | 1 | NO bloquean build: `next.config` tiene `typescript.ignoreBuildErrors=true`. Ver desglose abajo. Ninguno en código tocado en A-FEAT-01. |

### Desglose del baseline TS (2026-06-21) — capturado, sin investigar

18 archivos con errores TS (no bloqueantes por `ignoreBuildErrors`). Para triagear desde **A-OP-07**:

```
app/api/import-excel-dinamico/route.ts   ← parece archivo roto/stub (NextResponse, supabase, XLSX, parseNumber, parseDate "Cannot find name")
app/api/import-excel/route.ts            ← rawHeaders unknown / map type
app/api/lotes/preview/route.ts           ← ✅ RESUELTO 2026-06-21 ('Empresa' re-exportado en lotes-galicia/types). Baseline ahora 118.
app/importador-nuevo/page.tsx            ← boolean|null vs boolean|undefined
components/reporte-detallado.tsx
components/tab-terneros.tsx               ← 'SubTabRecria' no existe
components/vista-asignacion-arca.tsx     ← ParserError / Sugerencia vs CuentaSistema / 'usos'
components/vista-cash-flow.tsx           ← uniones de campos/origen ('ANTICIPO'/'SUELDO' vs 'ARCA'|'TEMPLATE')
components/vista-extracto-bancario.tsx   ← egreso[] (nombre_quien_cobra/responsable...), propuestas any[], setSoloSinRevisar, editData
components/vista-facturas-arca.tsx
components/vista-historico-facturas.tsx
components/vista-sector-productivo.tsx
components/vista-templates-egresos.tsx
components/wizard-templates-egresos.tsx
config/access-routes.ts
hooks/useAlertasTemplates.ts
hooks/useInlineEditor.ts
hooks/useMultiCashFlowData.ts
```

> Nota: muchos son `any`/uniones de tipos que funcionan en runtime. El más sospechoso es `app/api/import-excel-dinamico/route.ts` (parece un archivo a medio hacer — imports faltantes). Candidato a revisar si ese endpoint se usa o se borra.

### 🔬 TRIAGE 1er análisis (2026-06-21) — de los 119, lo que importa

**Grupo 1 — Crashes latentes (nombres indefinidos, TS2304). Rompen SI se ejecuta el path:**
| Error | Archivo:línea | Impacto | Fix |
|---|---|---|---|
| `toast` no definido | `useMultiCashFlowData.ts:732` | **Bug confirmado**: editar categ de template normal desde Cash Flow → crashea el handler en vez de mostrar el toast de bloqueo | `import { toast } from 'sonner'` (o el que use) |
| `setSoloSinRevisar` | `vista-extracto-bancario.tsx:1517` | Setter de filtro inexistente → crashea al togglear ese filtro | declarar el useState o sacar la llamada |
| `setSoloActivos` | `vista-templates-egresos.tsx:507` | Ídem (filtro templates) | ídem |
| `categorias` (×2) | `vista-sector-productivo.tsx:379,4506` | Nombre no definido → crash si se ejecuta | revisar de dónde sale `categorias` |
| `SubTabRecria` | `tab-terneros.tsx:264` | Nombre/tipo no definido | revisar |

**Grupo 2 — Endpoint roto/abandonado:**
- `app/api/import-excel-dinamico/route.ts` (14 errores): faltan TODOS los imports (NextResponse, supabase, XLSX, parseNumber, parseDate). Enganchado a `app/importador-nuevo/page.tsx` + `components/importador-excel-dinamico.tsx`. Importador experimental **100% roto**. Los reales son `import-facturas-arca` + `import-excel`. → Candidato a **BORRAR** (endpoint + página + componente), confirmando que `/importador-nuevo` no esté linkeado.

**Grupo 3 — Reporte con campos inexistentes (salida en blanco):**
- `vista-facturas-arca.tsx:2675-2766`: función de export accede a `fecha_factura`/`razon_social`/`cuit_emisor`/`numero_factura`/`cai`/`categ` que NO existen en `FacturaArca` (reales: `fecha_emision`/`denominacion_emisor`/`cuit`/`numero_desde`...). Si esa función se usa → columnas en blanco. A verificar si está viva.

**Grupo 4 — Ruido de tipos (~75, la mayoría). Funcionan en runtime:**
- jsPDF (`'a4'` orientation, `lastAutoTable`, `undefined`→string en autoTable), Supabase joins (`egreso[]`), implicit any, uniones `'ANTICIPO'|'SUELDO'` vs `'ARCA'|'TEMPLATE'`, TS2737 (BigInt), TS18048 (posibles undefined). No rompen nada.

**Quick win:** el `toast` de `useMultiCashFlowData` (1 import) arregla un bug real de UX.

---

## 🧮 Baseline de type-check — 2026-08-02 (121 errores preexistentes)

**Hallazgo importante:** `next.config.mjs` tiene **`typescript: { ignoreBuildErrors: true }`**.
Por eso `npm run build` **pasa limpio (exit 0) con 121 errores de tipos**. El build compila y
empaqueta, pero **NO valida tipos**. Para el chequeo real hay que correr aparte:

```bash
npx tsc --noEmit -p tsconfig.json
```

**Consecuencia práctica:** "el build pasó" **no** significa "no rompí nada a nivel tipos". Ese
baseline es éste.

### Distribución (captura barata, sin investigar — se triagea en A-OP-07)

| Archivo | Errores | Estado |
|---|---:|---|
| `components/vista-facturas-arca.tsx` | 45 | 🆕 |
| `app/api/import-excel-dinamico/route.ts` | 14 | 🆕 |
| `components/vista-extracto-bancario.tsx` | 13 | 🆕 |
| `components/vista-cash-flow.tsx` | 13 | 🆕 |
| `components/vista-templates-egresos.tsx` | 9 | 🆕 |
| `components/vista-sector-productivo.tsx` | 6 | 🆕 |
| `hooks/useMultiCashFlowData.ts` | 4 | 🆕 |
| `components/vista-asignacion-arca.tsx` | 4 | 🆕 |
| `components/vista-historico-facturas.tsx` | 3 | 🆕 |
| `hooks/useAlertasTemplates.ts` | 2 | 🆕 |
| `app/api/import-excel/route.ts` | 2 | 🆕 |
| `app/importador-nuevo/page.tsx` · `components/reporte-detallado.tsx` · `components/tab-terneros.tsx` · `config/access-routes.ts` · `hooks/useInlineEditor.ts` · `scripts/reporte-categorias-templates.ts` | 1 c/u | 🆕 |

**El más llamativo:** `app/api/import-excel-dinamico/route.ts` tiene **14 errores de identificadores
inexistentes** (`NextResponse`, `supabase`, `XLSX`, `parseNumber`, `parseDate` — todos "Cannot find
name"). Parece un archivo **al que le faltan los imports enteros**; probablemente ese endpoint está
roto en runtime, no sólo en tipos. Candidato a mirar primero en el triage.

**Verificado el 2026-08-02:** `lib/presupuesto/*` y `components/panel-presupuesto-cuentas.tsx`
tienen **0 errores** — el fix de P-16 de ese día no agregó ninguno.

---

## 2026-08-08 — Resueltos de paso, al tocar el Cash Flow multiempresa (A-FEAT-13)

No fueron un triage: aparecieron al re-chequear archivos que había que modificar igual. El resto
del baseline sigue intacto.

| Archivo | Error | Qué era | Estado |
|---|---|---|---|
| `hooks/useInlineEditor.ts` | TS2484 | `CeldaEnEdicion` exportada dos veces (en su declaración y en un `export type {}` al final) | ✅ resuelto |
| `hooks/useMultiCashFlowData.ts` | TS2304 `toast` | **Faltaba el `import { toast } from "sonner"`.** No era sólo de tipos: la rama que bloquea editar la categ de un template desde Cash Flow habría tirado `ReferenceError` en runtime | ✅ resuelto |

### 🔍 Queda abierto y vale la pena mirarlo (3 errores)
`hooks/useMultiCashFlowData.ts` — `filaActualArca?.fecha_emision` (3 usos, TS2339):
**`CashFlowRow` no tiene `fecha_emision`**, así que la propiedad es siempre `undefined` y la regla
*"si pasa a estado `debito`, `fecha_estimada` = `fecha_emision`"* **nunca se ejecuta**. No es un
error de tipos nada más: es una regla de negocio muerta desde que se escribió.

No se arregló ahora **a propósito**: hacerla funcionar cambia el comportamiento (empezarían a
moverse fechas que hoy no se mueven) y eso se decide con el usuario, no de pasada.
