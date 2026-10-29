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
  return buscarFechas(cliente, ids, TABLAS_CON_VINCULO_ARCA, "comprobante_arca_id")
}

/**
 * 🛡️ **CUÁNDO se pagó cada CUOTA DE TEMPLATE** — lo mismo, por el vínculo de las cuotas (`template_cuota_id`).
 *
 * Lo usa el papel 04 para los seguros en `cuotas` (A-FEAT-1385): la factura de la póliza no se concilia, se
 * concilian las cuotas de su template. Las mismas tablas que `TABLAS_CON_VINCULO_ARCA`: todas llevan también
 * `template_cuota_id` (leído de `information_schema` el 28/10/2026).
 */
export async function buscarFechasDePagoDeCuotas(
  cliente: ClienteMinimo,
  ids: string[],
): Promise<FechasDePago> {
  return buscarFechas(cliente, ids, TABLAS_CON_VINCULO_ARCA, "template_cuota_id")
}

/**
 * 💰 **CUÁNDO se cobró cada VENTA** — lo mismo que `buscarFechasDePagoBancarias`, por el vínculo de las ventas.
 *
 * 🧨 A-FEAT-1388 (U6, 27/10): el papel 03 buscaba el cobro de las ventas por `comprobante_arca_id`, que es el
 * vínculo de las COMPRAS. Las ventas se atan al banco por **`comprobante_venta_id`**: por eso 10 ventas
 * conciliadas ($459.630.934,98) salían «conciliadas pero sin ninguna fecha» — estaban cobradas, el papel no lo
 * encontraba. JMS: *«¿o sea que no están conciliadas?»*.
 */
export async function buscarFechasDeCobroBancarias(
  cliente: ClienteMinimo,
  ids: string[],
): Promise<FechasDePago> {
  return buscarFechas(cliente, ids, TABLAS_CON_VINCULO_VENTA, "comprobante_venta_id")
}

/**
 * Las tablas donde un cobro queda atado a su venta (`comprobante_venta_id`), leídas de la base el 27/10
 * (`information_schema`): los cuatro extractos y los echeqs recibidos. Las retenciones también llevan el
 * vínculo pero no son un cobro con fecha propia, y los anticipos van por su papel (04.2).
 */
export const TABLAS_CON_VINCULO_VENTA: Array<{ schema: string; tabla: string }> = [
  { schema: "public", tabla: "msa_galicia" },
  { schema: "public", tabla: "pam_galicia" },
  { schema: "public", tabla: "pam_galicia_cc" },
  { schema: "ma", tabla: "ma_galicia" },
  { schema: "msa", tabla: "echeqs_terceros" },
]

async function buscarFechas(
  cliente: ClienteMinimo,
  ids: string[],
  tablas: Array<{ schema: string; tabla: string }>,
  columna: "comprobante_arca_id" | "comprobante_venta_id" | "template_cuota_id",
): Promise<FechasDePago> {
  const porComprobante = new Map<string, string>()
  const tablasQueFallaron: string[] = []
  if (ids.length === 0) return { porComprobante, tablasQueFallaron }

  /** Postgres tolera `in` grandes, pero la URL de PostgREST no: se parte en tandas. */
  const TANDA = 300
  const tandas: string[][] = []
  for (let i = 0; i < ids.length; i += TANDA) tandas.push(ids.slice(i, i + TANDA))

  for (const t of tablas) {
    const nombre = `${t.schema}.${t.tabla}`
    for (const tanda of tandas) {
      // `public` se consulta sin `.schema()`: es el default del cliente y pedirlo explícito
      // funciona, pero el resto del repo lo escribe así y conviene no abrir una segunda forma.
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      const { data, error } = await q
        .select(`${columna}, fecha`)
        .in(columna, tanda)

      if (error) {
        if (!tablasQueFallaron.includes(nombre)) tablasQueFallaron.push(nombre)
        continue
      }
      for (const fila of (data ?? []) as Array<Record<string, string | undefined>>) {
        const id = fila[columna]
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

/**
 * 🔗 **El cobro AGRUPADO**: varias ventas de un cliente cobradas con varios movimientos (A-FEAT-167, `grupo_cobro_id`).
 * El banco puede estar atado a una sola de las ventas del grupo; las otras se cobraron en el mismo acto. Toman la
 * fecha más temprana de las ventas de su grupo que sí la tienen. Caso real (27/10): Sáenz Valiente, 2 ventas del
 * 27/01, una atada al cobro del 28/01 y la otra sin vínculo directo.
 *
 * Pura: recibe las ventas con su grupo y las fechas ya encontradas; devuelve las fechas completadas.
 */
export function completarConGrupoDeCobro(
  ventas: Array<{ id: string; grupo_cobro_id?: string | null }>,
  fechas: Map<string, string>,
): Map<string, string> {
  const out = new Map(fechas)
  const porGrupo = new Map<string, string>()
  for (const v of ventas) {
    const f = fechas.get(v.id)
    if (!v.grupo_cobro_id || !f) continue
    const ya = porGrupo.get(v.grupo_cobro_id)
    if (!ya || f < ya) porGrupo.set(v.grupo_cobro_id, f)
  }
  for (const v of ventas) {
    if (out.has(v.id) || !v.grupo_cobro_id) continue
    const f = porGrupo.get(v.grupo_cobro_id)
    if (f) out.set(v.id, f)
  }
  return out
}
