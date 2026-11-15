/**
 * 🧱 LA CAPA INTERNA — lo real encima de lo contable (A-FEAT-1288). Lógica pura, sin base.
 *
 * JMS 14/11: *«interno podría ser algo que se ponga encima de contable como una capa sobre la otra y corrija las diferencias
 * simplemente arrojando nuevos saldos entre cuentas a ser compensadas de manera interna»*.
 *
 * O sea: **no se reescribe ningún código contable**. Cada movimiento con un interno que manda la plata a OTRO lado que su contable
 * produce un AJUSTE: se le saca a la cuenta del contable y se le pone a la cuenta real. La suma de los ajustes de movimientos es 0
 * (el interno mueve plata, no la crea) — ése es el control. Aparte van los ajustes que no son movimientos (el sueldo de MA: sólo
 * contable, en lo real es dividendo).
 *
 * Reglas (JMS 16/10, 06-07/11 y 14/11):
 *  1. Interno vacío = lo real es igual al contable.
 *  2. «DIST X» / «GASTO X» en el interno = en lo real es de X.
 *  3. «DESGLOSAR» = se reparte: un PAGO DE TARJETA se abre con su resumen (los consumos traen su propia marca → el pago no mueve
 *     nada), un SEGURO por la prima de cada bien × su responsable interno (`polizas_responsables`); lo que no se pueda abrir queda
 *     «sin resolver» y se lista (no se adivina).
 *  4. «VER» o «X» → sin resolver: queda como el contable y se lista. Un código que no es de nadie es una ACTIVIDAD (p. ej. «IATF»):
 *     queda en la empresa de la cuenta (JMS 14/11: «IATF es de MSA»).
 *  5. Una transferencia entre dos cuentas de la app se cuenta UNA vez, del lado de más arriba (MSA > PAM > MA > Cotitulares).
 *  6. Lo que va a nombre de la misma empresa de la cuenta es «propio» (no es cuenta con nadie).
 */

export type Titular = "MSA" | "PAM" | "MA" | "Cotitulares"
export type TipoDestino = "CTA" | "DIST" | "RET" | "AP" | "LIB" | "GASTO" | "DESGLOSAR" | "VER" | "OTRO"
export interface Destino { tipo: TipoDestino; quien: string }

/** Un movimiento de cualquier cuenta de la app, con sus dos marcas (la de la nota del histórico ya resuelta). */
export interface MovCapa {
  id: string
  fecha: string
  cuenta: string
  titular: Titular
  deb: number
  cred: number
  contable: string
  interno: string
  detalle?: string
  desc?: string
  categ?: string
  /** El pago del resumen de una tarjeta (su detalle son los consumos, que ya están con su propia marca). */
  esPagoTarjeta?: boolean
  /** El reparto de un seguro por bien: quién (responsable interno) y qué parte de la prima (0..1). */
  partesPoliza?: { quien: string; parte: number; que?: string }[]
}

/** La escritura se unifica (DITRI → DIST, «JMS CTA» → «CTA JMS», mayúsculas); los códigos NO se cambian entre sí. */
export const normalizarCodigo = (x: string): string => String(x ?? "").toUpperCase().replace(/\s+/g, " ").trim()
  .replace(/^DI?STRI? /, "DIST ").replace(/^(\w+) CTA$/, "CTA $1").replace(/^CUENTA /, "CTA ")

const QUIENES: Record<string, string> = { MA: "MA", MAMA: "MA", PAM: "PAM", JMS: "JMS", JOSE: "JMS", AMS: "AMS", ANDRES: "AMS", MSA: "MSA",
  COTITULARES: "COTITULARES", COTIT: "COTITULARES" }

export function destinoDeCodigo(codigo: string): Destino | null {
  const x = normalizarCodigo(codigo); if (!x) return null
  let r: RegExpMatchArray | null
  if ((r = x.match(/^(CTA|DIST|RET\s*[0-9I]*)\s+(\w+)/))) return { tipo: r[1].startsWith("RET") ? "RET" : (r[1] as "CTA" | "DIST"), quien: QUIENES[r[2]] ?? r[2] }
  if (/^AP\b/.test(x)) return { tipo: "AP", quien: x.split(" ").at(-1)! }
  if (/^LIB/.test(x)) return { tipo: "LIB", quien: "LIB" }
  if ((r = x.match(/^GASTO (\w+)/))) return { tipo: "GASTO", quien: QUIENES[r[1]] ?? r[1] }
  if (/^DESGLOS/.test(x)) return { tipo: "DESGLOSAR", quien: "" }
  if (/^(X|VER)$/.test(x)) return { tipo: "VER", quien: "" }
  return { tipo: "OTRO", quien: x }
}

/** Lo que la nota del histórico dice («tu planilla: CATEG X · Contable Y · Interno Z»). */
export function marcaDeLaNota(nota: string | null | undefined, campo: "Contable" | "Interno"): string {
  const m = String(nota ?? "").match(/tu planilla:[^\n]*/i)?.[0] ?? ""
  return (m.match(new RegExp(`${campo} ([^·\\n»]+)`, "i"))?.[1] ?? "").trim()
}

const RANGO: Record<string, number> = { MSA: 1, PAM: 2, MA: 3, COTITULARES: 4 }
/** Rótulo de la cuenta a la que va la plata desde una empresa: «propio», un socio o un pozo («LIB», «a repartir»). */
export const PROPIO = "(propio)"
function cuentaDe(titular: Titular, d: Destino | null): string {
  if (!d) return PROPIO
  if (d.tipo === "CTA" || d.tipo === "DIST" || d.tipo === "RET" || d.tipo === "GASTO") return d.quien === titular.toUpperCase() ? PROPIO : d.quien
  if (d.tipo === "LIB") return "LIB (50/50)"
  if (d.tipo === "AP") return d.quien === titular.toUpperCase() ? PROPIO : `AP ${d.quien}`
  return PROPIO
}
const esEspejo = (titular: Titular, d: Destino | null) => !!d && (d.tipo === "CTA" || d.tipo === "DIST") && (RANGO[d.quien] ?? 99) < (RANGO[titular.toUpperCase()] ?? 99)

/** Un ajuste de la capa: plata que, desde la empresa `empresa`, sale de la cuenta `de` (la del contable) y va a la cuenta `a` (la real). */
export interface AjusteCapa {
  mov?: MovCapa
  empresa: string
  de: string
  a: string
  /** + = el socio de destino se llevó plata (débito de la empresa); − = la puso. */
  importe: number
  porque: string
}
export interface SinResolver { mov: MovCapa; porque: string }
export interface ResultadoCapa {
  ajustes: AjusteCapa[]
  sinResolver: SinResolver[]
  /** Por cuenta «EMPRESA→SOCIO»: cuánto suma la capa (+ el socio se llevó más en lo real). */
  porCuenta: Map<string, number>
  /** Suma de los ajustes de MOVIMIENTOS: tiene que ser 0. */
  control: number
  espejos: number
}

/** Ajustes que no son movimientos (p. ej. el sueldo de MA: en lo contable es haber; en lo real no existe). */
export interface AjusteFijo { empresa: string; socio: string; importe: number; porque: string }

const r2 = (x: number) => Math.round(x * 100) / 100

export function capaInterna(movs: MovCapa[], fijos: AjusteFijo[] = []): ResultadoCapa {
  const ajustes: AjusteCapa[] = [], sinResolver: SinResolver[] = []
  let espejos = 0
  for (const m of movs) {
    const dc = destinoDeCodigo(m.contable), di = destinoDeCodigo(m.interno)
    if (esEspejo(m.titular, dc)) { espejos++; continue }   // regla 5
    if (!di) continue                                       // regla 1
    const neto = r2(m.deb - m.cred), de = cuentaDe(m.titular, dc)
    if (di.tipo === "DESGLOSAR") {
      if (m.esPagoTarjeta) { if (de !== PROPIO) ajustes.push({ mov: m, empresa: m.titular, de, a: PROPIO, importe: neto, porque: "pago de tarjeta: se abre con su resumen (cada consumo trae su marca)" }); continue }
      const partes = (m.partesPoliza ?? []).filter(p => p.parte > 0)
      const suma = partes.reduce((t, p) => t + p.parte, 0)
      if (partes.length && Math.abs(suma - 1) < 0.001) {
        let resto = neto
        partes.forEach((p, i) => {
          const imp = i === partes.length - 1 ? r2(resto) : r2(neto * p.parte); resto -= imp
          const a = p.quien.toUpperCase() === m.titular.toUpperCase() ? PROPIO : p.quien.toUpperCase()
          if (a !== de) ajustes.push({ mov: m, empresa: m.titular, de, a, importe: imp, porque: `seguro: ${p.que ?? "bien"} ${(p.parte * 100).toFixed(1)} % (responsable interno ${p.quien})` })
        })
        continue
      }
      sinResolver.push({ mov: m, porque: partes.length ? `el reparto de la póliza suma ${(suma * 100).toFixed(1)} %, no 100 %` : "«Desglosar» sin un dato que lo abra (no es tarjeta ni póliza)" }); continue
    }
    if (di.tipo === "OTRO") { if (de !== PROPIO) ajustes.push({ mov: m, empresa: m.titular, de, a: PROPIO, importe: neto, porque: `interno «${m.interno}»: es una actividad, queda en ${m.titular}` }); continue }
    if (di.tipo === "VER" || di.tipo === "AP") { sinResolver.push({ mov: m, porque: `interno «${m.interno}»: no dice de quién es` }); continue }
    const a = cuentaDe(m.titular, di)
    if (a !== de) ajustes.push({ mov: m, empresa: m.titular, de, a, importe: neto, porque: `interno «${normalizarCodigo(m.interno)}»` })
  }
  const porCuenta = new Map<string, number>()
  const sumar = (k: string, x: number) => porCuenta.set(k, r2((porCuenta.get(k) ?? 0) + x))
  for (const a of ajustes) { sumar(`${a.empresa}→${a.de}`, -a.importe); sumar(`${a.empresa}→${a.a}`, a.importe) }
  // Integridad: cada ajuste le saca a una cuenta lo que le pone a otra → la suma por cuenta (antes de los fijos) tiene que dar 0.
  const control = r2([...porCuenta.values()].reduce((t, x) => t + x, 0))
  for (const f of fijos) sumar(`${f.empresa}→${f.socio}`, f.importe)
  return { ajustes, sinResolver, porCuenta, control, espejos }
}

/**
 * 🧩 El reparto de un seguro por bien: la prima de cada bien del endoso vigente a esa fecha × su responsable (interno o contable).
 * Mismo criterio que `scripts/excel-cuenta-socio.mts` (03/11), traído acá para que lo usen todos.
 */
export interface PolizaRep { id: string; poliza: string; template_id: string | null }
export interface EndosoRep { id: string; poliza_id: string; endoso: string; periodo_desde: string; es_nota_credito: boolean }
export interface BienRep { endoso_id: string; clave: string; descripcion: string | null; prima: number }
export function partesDeLaPoliza(egresoId: string | null | undefined, fecha: string, polizas: PolizaRep[], endosos: EndosoRep[], bienes: BienRep[],
  responsable: (clave: string) => string | null | undefined): { quien: string; parte: number; que: string }[] | null {
  const p = egresoId ? polizas.find(x => x.template_id === egresoId) : undefined
  if (!p) return null
  const vig = endosos.filter(e => e.poliza_id === p.id && !e.es_nota_credito && String(e.periodo_desde) <= fecha)
    .sort((a, b) => String(b.periodo_desde).localeCompare(String(a.periodo_desde)))
  const e = vig.find(x => bienes.some(b => b.endoso_id === x.id)); if (!e) return null
  const bs = bienes.filter(b => b.endoso_id === e.id), tot = bs.reduce((t, b) => t + (Number(b.prima) || 0), 0)
  if (!tot) return null
  const porQuien = new Map<string, { parte: number; que: string[] }>()
  for (const b of bs) {
    const q = String(responsable(b.clave) || "MSA").toUpperCase()
    const x = porQuien.get(q) ?? { parte: 0, que: [] }; porQuien.set(q, x)
    x.parte += (Number(b.prima) || 0) / tot; x.que.push(`${b.clave} ${String(b.descripcion ?? "").slice(0, 20)}`.trim())
  }
  return [...porQuien].map(([quien, x]) => ({ quien, parte: x.parte, que: `póliza ${p.poliza} endoso ${e.endoso}: ${x.que.join(", ")}` }))
}
