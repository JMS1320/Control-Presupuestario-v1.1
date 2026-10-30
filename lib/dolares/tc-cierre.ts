/**
 * 💵 **EL DÓLAR AL CIERRE — una sola forma de leerlo** (A-FEAT-1427, 2026-10-30).
 *
 * ## El bug que la originó
 * La serie `dolar_bna_divisas` de `public.cotizaciones` guarda **compra y venta**, nunca `valor` (medido 30/10:
 * 456 filas, 0 con `valor`). Tres lugares la leían por `valor` —el papel 07 Bancos, la foto del Balance propio
 * y la foto propuesta desde los papeles— y los tres recibían **siempre vacío**: la cuenta corriente en dólares
 * de MSA (US$ 35.001,63) salía en el 07 sin saldo en pesos, y las fotos sin TC. Es el modo de falla de
 * *«se arregló un camino de los dos»*: por eso vive acá y los tres la importan.
 *
 * ## Qué lado se toma
 * Para valuar dólares que la empresa **tiene** (caja, cuenta) se usa el **comprador**: es lo que se obtendría al
 * venderlos, y es el criterio contable para activos en moneda extranjera. Si una serie trae `valor` (las de
 * granos, o una carga manual), manda `valor`. La fuente queda escrita para que se note al pisarla (§ 🎚️).
 */

export interface FilaCotizacion {
  fecha: string
  valor?: number | string | null
  compra?: number | string | null
  venta?: number | string | null
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null
  const x = Number(v)
  return Number.isFinite(x) && x > 0 ? x : null
}

/** El número de una fila: `valor` si lo tiene; si no, el comprador. `null` = la fila no sirve. */
export function tcDeFila(f: FilaCotizacion | null | undefined): { tc: number; lado: "valor" | "comprador" } | null {
  if (!f) return null
  const v = num(f.valor)
  if (v != null) return { tc: v, lado: "valor" }
  const c = num(f.compra)
  if (c != null) return { tc: c, lado: "comprador" }
  return null
}

export interface TcAlCierre {
  tc: number
  /** La fecha de la cotización usada (la del cierre o la anterior más cercana). */
  fecha: string
  /** Cómo se lee en pantalla y en el Excel: «dólar BNA divisas comprador del 30/06/2026». */
  fuente: string
}

/** De varias filas (cualquier orden), la última con número hasta `fecha`. Pura, para los casos. */
export function elegirTcAl(filas: FilaCotizacion[], fecha: string): TcAlCierre | null {
  const validas = filas
    .filter(f => f.fecha && f.fecha.slice(0, 10) <= fecha && tcDeFila(f))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const f = validas[0]
  if (!f) return null
  const t = tcDeFila(f)!
  const dmy = f.fecha.slice(0, 10).split("-").reverse().join("/")
  return { tc: t.tc, fecha: f.fecha.slice(0, 10), fuente: `dólar BNA divisas ${t.lado === "valor" ? "" : "comprador "}del ${dmy}`.replace("  ", " ") }
}

/**
 * Lee de la base el dólar BNA divisas al `fecha` (o el día publicado anterior más cercano, hasta 15 días antes).
 * `null` = no hay cotización: quien la usa deja el saldo vacío y avisa — nunca un cero inventado.
 */
export async function tcDolarAl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, fecha: string, serie = "dolar_bna_divisas",
): Promise<TcAlCierre | null> {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 15)
  const desde = d.toISOString().slice(0, 10)
  const { data } = await supabase.from("cotizaciones").select("fecha, valor, compra, venta")
    .eq("serie", serie).gte("fecha", desde).lte("fecha", fecha).order("fecha", { ascending: false }).limit(20)
  return elegirTcAl((data ?? []) as FilaCotizacion[], fecha)
}
