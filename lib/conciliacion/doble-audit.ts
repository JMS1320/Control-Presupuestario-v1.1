/**
 * 🔁 **DOBLE AUDIT — lo que ya está «a auditar» en un extracto no se concilia solo desde otro.**
 * ([A-BUG-1290](../../PENDIENTES.md#a-bug-1290), diseño del usuario 2026-10-19.)
 *
 * ## El hueco
 * Cuando el motor ata un movimiento a una cuota o factura y el movimiento queda **a auditar**, la
 * cuota/factura **no cambia de estado** (sigue `pendiente`, `pagado`, `debito`…), así que el Cash Flow
 * la sigue ofreciendo. Al conciliar OTRO extracto —la tarjeta, la caja— un movimiento del mismo
 * importe la podía tomar y, con la fecha exacta, conciliarla sola. Caso medido: la cuota de julio de
 * Seguro Flota ($571.179,49) atada al débito del 02/07 de la cuenta corriente, a auditar.
 *
 * ## La regla (palabras del usuario)
 * > *«Lo automático no debe pisar lo que está a auditar, sino que quede 2 veces a auditar… incluso si
 * > es exacto en todo sentido.»*
 *
 * 1. Una cuota/factura atada a un movimiento **a auditar** se puede proponer, pero el nuevo
 *    movimiento **siempre** queda a auditar, con el motivo que dice dónde está el otro.
 * 2. Si hay una candidata **libre** que también coincide, **gana la libre**: la que ya está en audit
 *    sólo se propone si es la única.
 * 3. Vale para todos los extractos (banco, PAM, MA, tarjetas, cajas, echeqs).
 *
 * 📌 Lo atado a un movimiento **conciliado** ni siquiera llega acá: su cuota/factura queda
 * `conciliado` (o `anterior`) y el Cash Flow la excluye. Verificado en la base el 2026-10-19.
 */
import { TABLAS_CON_VINCULO_ARCA } from "./tablas-con-vinculo-arca"

/** Dónde está atada una cuota o factura que espera auditoría. */
export interface VinculoEnAuditar {
  /** Qué extracto, en el lenguaje de la app («extracto de la cuenta corriente de MSA»). */
  que: string
  /** Fecha del movimiento que ya la tomó (aaaa-mm-dd). */
  fecha: string | null
}

/** Lo mínimo de un resultado del buscador del motor. */
export interface ResultadoBusqueda {
  match: boolean
  cashFlowRow?: { id: string | number } & Record<string, any>
  requiere_revision?: boolean
  motivo_revision?: string | null
}

/**
 * Lee, de TODOS los extractos, qué cuotas y facturas están atadas a un movimiento **a auditar**.
 * Usa la lista única de extractos (`TABLAS_CON_VINCULO_ARCA`: las 11 llevan también
 * `template_cuota_id` — verificado en la base 2026-10-19). Una tabla que falla no frena al motor:
 * se devuelve en `tablasQueFallaron` para avisarlo (§ 🧮 nada se descarta en silencio).
 */
export async function cargarVinculosEnAuditar(cliente: any): Promise<{
  enAuditar: Map<string, VinculoEnAuditar>
  tablasQueFallaron: string[]
}> {
  const enAuditar = new Map<string, VinculoEnAuditar>()
  const tablasQueFallaron: string[] = []
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
    const { data, error } = await q
      .select("fecha, template_cuota_id, comprobante_arca_id")
      .eq("estado", "auditar")
    if (error) { tablasQueFallaron.push(`${t.schema}.${t.tabla}`); continue }
    for (const fila of (data ?? []) as Array<{ fecha?: string; template_cuota_id?: string; comprobante_arca_id?: string }>) {
      for (const id of [fila.template_cuota_id, fila.comprobante_arca_id]) {
        if (id && !enAuditar.has(String(id))) enAuditar.set(String(id), { que: t.que, fecha: fila.fecha ?? null })
      }
    }
  }
  return { enAuditar, tablasQueFallaron }
}

/** El texto del motivo. Se nombra una vez: la pantalla de auditoría lo muestra tal cual. */
export function motivoDobleAudit(v: VinculoEnAuditar, motivoOriginal?: string | null): string {
  const fecha = v.fecha ? String(v.fecha).slice(0, 10).split('-').reverse().join('/') : 'sin fecha'
  const base = `Doble audit: ya está atada a un movimiento del ${fecha} en ${v.que}, a auditar`
  return motivoOriginal ? `${base} · ${motivoOriginal}` : base
}

/**
 * Busca con la regla del doble audit. `buscar` es el buscador de siempre del motor; esta función sólo
 * decide **en qué pool** buscar primero y **qué hacer** si lo que encontró ya está en audit.
 *
 * @param enAuditar  id de cuota/factura → dónde está atada a auditar.
 */
export function buscarConDobleAudit<R extends ResultadoBusqueda>(
  buscar: (pool: any[]) => R,
  pool: any[],
  enAuditar: Map<string, VinculoEnAuditar>,
): R {
  if (enAuditar.size === 0) return buscar(pool)

  // 1 · Primero entre las libres: si alguna coincide, gana (regla 2).
  const libres = pool.filter(f => !enAuditar.has(String(f.id)))
  const enLibres = buscar(libres)
  if (enLibres.match) return enLibres

  // 2 · Si no, en todo el pool. Si lo que aparece ya está en audit → doble audit, nunca conciliado.
  const enTodo = buscar(pool)
  if (!enTodo.match || !enTodo.cashFlowRow) return enTodo
  const vinculo = enAuditar.get(String(enTodo.cashFlowRow.id))
  if (!vinculo) return enTodo
  return {
    ...enTodo,
    requiere_revision: true,
    motivo_revision: motivoDobleAudit(vinculo, enTodo.motivo_revision),
  }
}
