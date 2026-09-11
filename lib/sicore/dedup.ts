/**
 * 🔁 Filas REPETIDAS en `sicore_retenciones` — la red antes de armar el TXT que va a ARCA.
 *
 * ## El problema que resuelve (A-BUG-146)
 * El 10/09/2026 la FC 10-6337 de ALCORTA quedó con **dos filas vigentes idénticas**, creadas con
 * **0,69 s de diferencia**: el botón «✅ Confirmar y pasar a Pagar» no tenía guarda de re-entrada y
 * un doble click corrió el flujo entero dos veces.
 *
 * `generarTXTCierreV2` agrupa por `cuit_emisor||tipo_sicore` **sumando fila por fila**, así que la
 * duplicada se sumaba:
 *
 * | | Pago declarado | Base declarada | Retención |
 * |---|---:|---:|---:|
 * | con la duplicada | $534.631,16 | $443.138,95 | $1.566,93 |
 * | correcto | $364.272,27 | $302.346,46 | $1.566,93 |
 *
 * 🧨 **La retención salía bien; lo que quedaba mal era lo DECLARADO.** Por eso ningún control de
 * plata lo agarraba: el dinero retenido es correcto y el error está en el renglón de la DDJJ.
 *
 * ## Por qué la causa no alcanza
 * La causa se tapó en `registrarEnSicoreRetenciones` (guarda de idempotencia), pero eso sólo evita
 * filas **nuevas**: las que ya están en la base siguen ahí y el TXT las leería igual. **Hacen falta
 * los dos.**
 *
 * ## ⚠️ Qué NO se colapsa
 * Dos **pagos parciales legítimos** de la misma factura en la misma quincena. Por eso la clave
 * incluye los importes: sólo se descarta lo que es idéntico renglón por renglón. Un segundo pago
 * real tiene otro `total_pagado`.
 *
 * ## 🧮 Y nada se descarta en silencio
 * Devuelve también los descartados, para que quien llame pueda decirlo (§ CLAUDE.md — *«si algo no
 * se pudo verificar, se muestra que no se pudo»*). Un dedup mudo taparía justamente el síntoma que
 * avisa que algo está insertando de más.
 */

export interface FilaSicore {
  id?: string | null
  factura_id?: string | null
  anticipo_id?: string | null
  quincena?: string | null
  tipo_sicore?: string | null
  total_pagado?: number | string | null
  retencion?: number | string | null
  pago?: number | string | null
  [k: string]: unknown
}

export interface ResultadoDedup<T> {
  /** Las filas que entran al cálculo, en el orden original. */
  vigentes: T[]
  /** Las repetidas que quedaron afuera. Se muestran, no se esconden. */
  descartados: T[]
}

/**
 * La clave de identidad de una fila.
 *
 * El documento primero (`factura_id` → `anticipo_id` → `id`): dos filas de **facturas distintas**
 * nunca son la misma, aunque los importes coincidan. Y si no hay ni factura ni anticipo, la fila
 * cae en su propio `id` y **nunca se descarta** — ante la duda, se conserva.
 */
export function claveFilaSicore(r: FilaSicore): string {
  const doc = r.factura_id ?? r.anticipo_id ?? r.id ?? ''
  return [doc, r.quincena ?? '', r.tipo_sicore ?? '', r.total_pagado ?? '', r.retencion ?? '', r.pago ?? '']
    .map(String).join('||')
}

/** Descarta las filas repetidas, conservando **la primera** de cada grupo. */
export function deduplicarFilasSicore<T extends FilaSicore>(registros: T[]): ResultadoDedup<T> {
  const vistos = new Set<string>()
  const vigentes: T[] = []
  const descartados: T[] = []

  for (const r of registros) {
    const clave = claveFilaSicore(r)
    if (vistos.has(clave)) { descartados.push(r); continue }
    vistos.add(clave)
    vigentes.push(r)
  }

  return { vigentes, descartados }
}
