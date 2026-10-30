/**
 * 🧾🏦 **ECHEQS EMITIDOS VENCIDOS CONTRA SU DÉBITO EN EL BANCO** — A-AUTO-10 / A-FEAT-1430 (JMS 30/10: *«eso será en el
 * recorrido del balance, ¿verdad?»*).
 *
 * El cartel de Principal muestra los echeqs `vigente` con la fecha de cobro pasada (nadie los marcó «cobrado»). Medido
 * 30/10: 10, ninguno viejo; 4 ya conciliados en el banco, 3 con el débito sin cerrar, Longo cargado sin número (el banco
 * lo debitó como «Echeq Galicia Nro 107»), 2 sin extracto todavía.
 *
 * Acá se cruza cada cheque con su débito: **por número** cuando la descripción del banco lo trae («Echeq 48 Hs. Nro. 101»),
 * y si no, **por importe** (±$0,01) dentro de 45 días. Con el débito encontrado, la acción es clara: marcar «cobrado» con la
 * FECHA DEL DÉBITO (el dato real, § 🎚️) y, si el cheque no tenía número, completarlo con el del banco.
 */

export interface ChequeVencido {
  id: string
  numero: string | null
  monto: number
  fecha_cobro: string | null
  beneficiario_nombre: string | null
}

export interface DebitoBanco {
  tabla: string
  cuentaId: string
  id: string
  fecha: string
  debitos: number
  descripcion: string
  estado: string
}

export interface CruceCheque {
  cheque: ChequeVencido
  debito: DebitoBanco | null
  /** Cómo se encontró el débito. */
  por: "numero" | "importe" | null
  /** El número que trae el banco (para completar el del cheque si falta). */
  numeroBanco: string | null
}

/** El número de cheque que trae la descripción del banco («… Nro. 101», «… Nro: 107»). */
export function numeroEnDescripcion(desc: string): string | null {
  const m = /nro\.?:?\s*0*(\d+)/i.exec(desc ?? "")
  return m ? m[1] : null
}

const dias = (a?: string | null, b?: string | null) => (!a || !b) ? 9999 : Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86400000)
const sinCeros = (s: string | null) => (s ?? "").replace(/^0+/, "")

/** Cruza cada cheque vencido con su débito. Un débito se usa una sola vez (primero los cruces por número). */
export function cruzarChequesConDebitos(cheques: ChequeVencido[], debitos: DebitoBanco[]): CruceCheque[] {
  const usados = new Set<string>()
  const porNumero = new Map<string, DebitoBanco>()
  for (const d of debitos) { const nro = numeroEnDescripcion(d.descripcion); if (nro && /echeq|cheque/i.test(d.descripcion)) porNumero.set(nro, d) }
  const cruces: CruceCheque[] = cheques.map(ch => {
    const d = ch.numero ? porNumero.get(sinCeros(ch.numero)) : undefined
    if (d && Math.abs(d.debitos - ch.monto) < 0.01) { usados.add(d.id); return { cheque: ch, debito: d, por: "numero" as const, numeroBanco: numeroEnDescripcion(d.descripcion) } }
    return { cheque: ch, debito: null, por: null, numeroBanco: null }
  })
  for (const c of cruces) {
    if (c.debito) continue
    const cand = debitos.filter(d => !usados.has(d.id) && Math.abs(d.debitos - c.cheque.monto) < 0.01 && /echeq|cheque/i.test(d.descripcion)
      && dias(d.fecha, c.cheque.fecha_cobro) <= 45)
      .sort((a, b) => dias(a.fecha, c.cheque.fecha_cobro) - dias(b.fecha, c.cheque.fecha_cobro))
    if (cand[0]) { usados.add(cand[0].id); c.debito = cand[0]; c.por = "importe"; c.numeroBanco = numeroEnDescripcion(cand[0].descripcion) }
  }
  return cruces
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/** Lee los echeqs vencidos sin marcar y los débitos de cheques del banco de MSA alrededor de sus fechas. */
export async function leerChequesVencidos(sb: Cliente, hoy: string): Promise<{ cruces: CruceCheque[]; extractoHasta: string | null; error: string | null }> {
  const { data: ch, error: e1 } = await sb.schema("msa").from("cheques")
    .select("id, numero, monto, fecha_cobro, beneficiario_nombre").eq("estado", "vigente").lte("fecha_cobro", hoy).order("fecha_cobro")
  if (e1) return { cruces: [], extractoHasta: null, error: e1.message }
  const cheques = ((ch ?? []) as Array<Record<string, unknown>>).map(c => ({ id: String(c.id), numero: c.numero == null ? null : String(c.numero),
    monto: Number(c.monto) || 0, fecha_cobro: c.fecha_cobro ? String(c.fecha_cobro) : null, beneficiario_nombre: c.beneficiario_nombre ? String(c.beneficiario_nombre) : null }))
  const { data: ult } = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
  const extractoHasta = ult?.[0]?.fecha ? String(ult[0].fecha) : null
  if (!cheques.length) return { cruces: [], extractoHasta, error: null }
  const fechas = cheques.map(c => c.fecha_cobro).filter((x): x is string => !!x).sort()
  const desde = new Date(Date.parse(fechas[0]) - 15 * 86400000).toISOString().slice(0, 10)
  const { data: deb, error: e2 } = await sb.from("msa_galicia").select("id, fecha, debitos, descripcion, estado")
    .gte("fecha", desde).gt("debitos", 0).or("descripcion.ilike.%echeq%,descripcion.ilike.%cheque%").order("fecha").limit(2000)
  if (e2) return { cruces: [], extractoHasta, error: e2.message }
  const debitos = ((deb ?? []) as Array<Record<string, unknown>>).map(d => ({ tabla: "msa_galicia", cuentaId: "msa_galicia", id: String(d.id), fecha: String(d.fecha),
    debitos: Number(d.debitos) || 0, descripcion: String(d.descripcion ?? ""), estado: String(d.estado ?? "") }))
  return { cruces: cruzarChequesConDebitos(cheques, debitos), extractoHasta, error: null }
}
