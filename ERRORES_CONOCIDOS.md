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
