/**
 * 📅 **CUÁNDO se pagó cada comprobante — el dato que decide las cuentas a pagar al cierre.**
 *
 * Lo usa `armarCuentasAlCierre`, que necesita saber si un comprobante estaba pago **al 30/06**, no
 * si está pago hoy. Ver el encabezado de `cuentas-al-cierre.ts` para el porqué.
 *
 * ## De dónde sale la fecha, en orden
 *
 * 1. **`fecha_pago` del comprobante**, si la tiene.
 * 2. **La fecha del movimiento bancario conciliado.** Es el dato bueno: el banco diciendo cuándo
 *    salió la plata. Si hay varios, se toma **el más temprano** — es cuando la deuda dejó de serlo.
 *
 * ## 🔗 Y busca en LAS DIEZ tablas, no en tres
 *
 * Usa `TABLAS_CON_VINCULO_ARCA`, la lista única (§ 🔁 *La propagación del dato*). Mirar sólo los dos
 * Galicia dejaría afuera los 7 comprobantes pagados con la **tarjeta de MSA**, que aparecerían como
 * deuda al cierre sin serlo. Es el mismo error de [A-BUG-1221](../../PENDIENTES.md#a-bug-1221) con
 * otra consecuencia: allá no propagaba una cuenta, acá inventaría una deuda.
 *
 * 🛑 **Una tabla que no responde NO se saltea en silencio**: se devuelve en `tablasQueFallaron`, y
 * quien llame decide. Callarlo haría que unos comprobantes parezcan impagos por un error de lectura.
 */
import { TABLAS_CON_VINCULO_ARCA } from "@/lib/conciliacion/tablas-con-vinculo-arca"

/** Lo mínimo que se le pide al cliente de Supabase, para que sirvan el del navegador y el del script. */
export interface ClienteMinimo {
  schema(nombre: string): {
    from(tabla: string): {
      select(cols: string): {
        in(col: string, valores: string[]): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
      }
    }
  }
  from(tabla: string): {
    select(cols: string): {
      in(col: string, valores: string[]): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
    }
  }
}

export interface FechasDePago {
  /** id del comprobante → fecha del movimiento bancario más temprano (`AAAA-MM-DD`). */
  porComprobante: Map<string, string>
  /** Las que no se pudieron leer. Se informan: un error de lectura no puede parecer una deuda. */
  tablasQueFallaron: string[]
}

/**
 * Busca, para cada comprobante, la fecha del movimiento bancario al que está conciliado.
 *
 * @param cliente  el cliente de Supabase (navegador o service role)
 * @param ids      los comprobantes a buscar. Se consulta en tandas: un `in` con miles de ids no entra
 */
export async function buscarFechasDePagoBancarias(
  cliente: ClienteMinimo,
  ids: string[],
): Promise<FechasDePago> {
  const porComprobante = new Map<string, string>()
  const tablasQueFallaron: string[] = []
  if (ids.length === 0) return { porComprobante, tablasQueFallaron }

  /** Postgres tolera `in` grandes, pero la URL de PostgREST no: se parte en tandas. */
  const TANDA = 300
  const tandas: string[][] = []
  for (let i = 0; i < ids.length; i += TANDA) tandas.push(ids.slice(i, i + TANDA))

  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const nombre = `${t.schema}.${t.tabla}`
    for (const tanda of tandas) {
      // `public` se consulta sin `.schema()`: es el default del cliente y pedirlo explícito
      // funciona, pero el resto del repo lo escribe así y conviene no abrir una segunda forma.
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      const { data, error } = await q
        .select("comprobante_arca_id, fecha")
        .in("comprobante_arca_id", tanda)

      if (error) {
        if (!tablasQueFallaron.includes(nombre)) tablasQueFallaron.push(nombre)
        continue
      }
      for (const fila of (data ?? []) as Array<{ comprobante_arca_id?: string; fecha?: string }>) {
        const id = fila.comprobante_arca_id
        const fecha = fila.fecha ? String(fecha10(fila.fecha)) : null
        if (!id || !fecha) continue
        const actual = porComprobante.get(id)
        // El más temprano: es el momento en que la deuda dejó de serlo.
        if (!actual || fecha < actual) porComprobante.set(id, fecha)
      }
    }
  }

  return { porComprobante, tablasQueFallaron }
}

/** `2026-06-30T00:00:00` → `2026-06-30`. Comparar fechas ISO como texto sólo funciona recortadas. */
const fecha10 = (v: string) => String(v).slice(0, 10)
