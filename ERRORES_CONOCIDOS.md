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
app/api/lotes/preview/route.ts           ← 'Empresa' no exportado de types
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
