/**
 * 🔀 **Lo que en los extractos de PAM es en realidad de MSA — jul-2025 → ene-2026.** A-DAT-68 · 2026-10-04.
 *
 * Aclaración del usuario sobre el pedido anterior: *«te lo pasé porque esos extractos tienen del 1/7/25 al
 * 31/12/25, que es parte del ejercicio de MSA, entonces ahí hay data de templates que pueden ser de MSA.
 * Ej.: PAM retira x monto, eso es el template de retiros PAM de MSA. Si PAM hubiera pagado impuestos de
 * MSA como el inmobiliario, sería el template de MSA y sería RET 3 PAM. Si ves pagos que puedan
 * corresponderse con templates de MSA habría que marcarlo; luego yo audito. Archivo nuevo sin pisar»*.
 *
 * Su convención, leída de su extracto de MSA: `RET` · «Retiro PAM», `AP 1` · «Aporte PAM», `RET 3 …` ·
 * MSA paga algo de un tercero. **«RET 3» no existe como cuenta en la app**: es su marca, y acá se usa
 * igual que él la usa.
 *
 * ## Cuatro vínculos, de más a menos seguro
 *   1. **Retiro PAM** — un CRÉDITO de MSA a PAM (CUIT 30617786016 / «Martínez Sobrado Agro»): es el
 *      template «Retiro PAM» de MSA.
 *   2. **Aporte PAM** — un DÉBITO de PAM a MSA: en MSA es «AP 1 · Aporte PAM» (no hay template).
 *   3. **RET 3 PAM** — un gasto que su observación o CATEG dice que es de MSA: se busca el template de MSA.
 *   4. **posible MSA** — un débito que se parece a un template que **sólo MSA tiene** (sus campos, sus
 *      autos, seguros, cargas sociales, SICORE…): para auditar.
 *
 * Incluye enero 2026: también es del ejercicio de MSA y la app de PAM arranca en febrero.
 *
 * ```
 * npx tsx scripts/templates-msa-desde-pam.mts
 * ```
 * 🔴 **SÓLO LEE.** Escribe un archivo NUEVO; no pisa «Extractos_PAM_TEMPLATES_SUGERIDOS.xlsx».
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const ENTRADA = "- Comunicacion JMS Claude - Archivos/Balance/extractos PAM.xlsx"
const SALIDA = "- Comunicacion JMS Claude - Archivos/Balance/Extractos_PAM_jul25-ene26_TEMPLATES_DE_MSA.xlsx"
const DESDE = "2025-07-01", HASTA = "2026-01-31"
const CUIT_MSA = "30617786016"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const r2 = (n: number) => Math.round(n * 100) / 100
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
const palabras = (s: string) => new Set(norm(s).split(" ").filter(w => w.length >= 3 && !/\d/.test(w)))
const num = (v: unknown) => typeof v === "number" ? v : (parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0)
const tx = (v: unknown) => String(v ?? "").trim()
function fechaISO(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = tx(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null
}

interface Mov { cuenta: "CA" | "CC"; fecha: string; mes: string; desc: string; leyenda: string; texto: string; deb: number; cre: number; categ: string; obs: string }

// ── Leer las dos hojas (mismo formato que templates-sugeridos-pam.mts) ───────────────────────
const wb = XLSX.read(readFileSync(ENTRADA), { type: "buffer", cellDates: true })
const hoja = (n: string, enc: number) => {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: "" })
  const col: Record<string, number> = {}; (aoa[enc] as unknown[]).forEach((h, i) => { if (tx(h)) col[tx(h)] = i })
  return { aoa: aoa.slice(enc + 1), col }
}
const movs: Mov[] = []
{
  const { aoa, col } = hoja("Extracto PAM CA Pesos", 6)
  for (const r of aoa) {
    const f = fechaISO(r[col["Fecha"]]); if (!f || f < DESDE || f > HASTA) continue
    const lineas = tx(r[col["Movimiento"]]).split(/\n/).map(x => x.trim()).filter(Boolean)
    movs.push({ cuenta: "CA", fecha: f, mes: f.slice(0, 7), desc: lineas.join(" · "), leyenda: lineas.slice(1).join(" "),
      texto: lineas.join(" "), deb: num(r[col["Débito"]]), cre: num(r[col["Crédito"]]), categ: tx(r[col["Categ"]]), obs: tx(r[col["Observaciones"]]) })
  }
}
{
  const { aoa, col } = hoja("Extracto SUC PAM CC", 2)
  for (const r of aoa) {
    const f = fechaISO(r[col["Fecha"]]); if (!f || f < DESDE || f > HASTA) continue
    const ley = [1, 2, 3, 4].map(i => tx(r[col[`Leyendas Adicionales${i}`]])).filter(Boolean).join(" ")
    movs.push({ cuenta: "CC", fecha: f, mes: f.slice(0, 7), desc: tx(r[col["Descripción"]]), leyenda: ley, texto: `${tx(r[col["Descripción"]])} ${ley}`,
      deb: num(r[col["Débitos"]]), cre: num(r[col["Créditos"]]), categ: "", obs: tx(r[col["Observaciones Cliente"]]) })
  }
}
movs.sort((a, b) => a.fecha.localeCompare(b.fecha))

// ── Los templates de MSA, y cuáles son SÓLO de MSA ───────────────────────────────────────────
const { data: tmpls } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, categ, responsable, tipo, activo").eq("activo", true)
const todos = (tmpls ?? []) as any[]
const msa = todos.filter(t => /MSA/i.test(t.responsable || ""))
/** El nombre sin la empresa: «IIBB Mensual MSA» y «IIBB Mensual PAM» son el MISMO template, uno por empresa. */
const sinEmpresa = (n: string) => norm(n).split(" ").filter(w => !["msa", "pam", "ma"].includes(w)).join(" ")
const nombresPam = new Set(todos.filter(t => /PAM/i.test(t.responsable || "") && !/MSA/i.test(t.responsable || "")).map(t => sinEmpresa(t.nombre_referencia)))
// Un nombre que PAM también tiene no prueba nada; uno que sólo tiene MSA, sí. Lo financiero (caja, FCI,
// tarjeta) no es un gasto que se pueda «haber pagado por otro».
const soloMsa = msa.filter(t => !nombresPam.has(sinEmpresa(t.nombre_referencia)) && (t.tipo === "egreso" || !t.tipo))
const retiroPam = msa.find(t => norm(t.nombre_referencia) === "retiro pam")

const GENERICAS = new Set(["imp", "cuota", "pago", "anual", "pam", "msa", "semestral", "mensual"])
const SINONIMOS: Record<string, string> = { consorcio: "expensas", gcba: "abl" }
function mejorTemplate(m: Mov, candidatos: any[]): { t: any; p: number } | null {
  const suyas = new Set([...palabras(`${m.categ} ${m.obs} ${m.texto}`)].map(w => SINONIMOS[w] ?? w))
  if (suyas.has("complementario")) suyas.add("inmobiliario")
  const rank = candidatos.map(t => {
    const nombre = norm(t.nombre_referencia).split(" ").filter(w => w.length >= 3 && !/\d/.test(w))
    const concepto = nombre.find(w => !GENERICAS.has(w))
    if (!concepto || !suyas.has(concepto)) return { t, p: 0 }
    // Para campos y autos el NOMBRE PROPIO tiene que estar (Rojas, Cholo, Tiguan…): el concepto solo no alcanza.
    const propios = nombre.filter(w => !GENERICAS.has(w) && w !== concepto && !["cuota", "red", "vial", "inmobiliario", "automotores", "seguro"].includes(w))
    if (propios.length && !propios.some(w => suyas.has(w))) return { t, p: 0 }
    return { t, p: nombre.filter(w => suyas.has(w)).length / nombre.length }
  }).filter(x => x.p > 0).sort((a, b) => b.p - a.p)
  if (!rank.length || (rank.length > 1 && rank[0].p === rank[1].p)) return null
  return rank[0]
}

interface Marca { vinculo: string; t: any | null; conf: "alta" | "media" | "baja"; como: string }
function marcar(m: Mov): Marca | null {
  const conMsa = m.texto.includes(CUIT_MSA) || /martinez\s+sobrado\s+agro/i.test(m.texto)
  if (conMsa && m.cre > 0) return { vinculo: "Retiro PAM (MSA le paga a PAM)", t: retiroPam ?? null, conf: "alta", como: "crédito desde la cuenta de MSA" }
  if (conMsa && m.deb > 0) return { vinculo: "Aporte PAM (PAM le pone a MSA) — en MSA: AP 1", t: null, conf: "alta", como: "débito hacia la cuenta de MSA" }
  if (m.deb <= 0) return null
  /**
   * 🔑 Las referencias de ARBA llevan el CUIT del contribuyente adentro («270200443902» = PAM 20044390…):
   * con el de MSA (30617786…) el pago es de MSA aunque lo haya pagado PAM; con el de PAM, es propio.
   */
  const digitos = m.texto.replace(/\D/g, "")
  if (digitos.includes("30617786")) {
    const t = mejorTemplate(m, msa)
    return { vinculo: "RET 3 PAM (PAM pagó un gasto de MSA)", t: t?.t ?? null, conf: "alta", como: "la referencia del pago lleva el CUIT de MSA" }
  }
  if (digitos.includes("20044390")) return null
  const diceMsa = /\bmsa\b|ret\s*3/i.test(`${m.obs} ${m.categ}`)
  const t1 = mejorTemplate(m, diceMsa ? msa : soloMsa)
  if (diceMsa) return { vinculo: "RET 3 PAM (PAM pagó un gasto de MSA)", t: t1?.t ?? null, conf: "alta",
    como: `su observación/CATEG dice MSA${t1 ? ` · template por parecido (${Math.round(t1.p * 100)} %)` : " · sin template parecido: elegirlo a mano"}` }
  if (t1) return { vinculo: "posible MSA → RET 3 PAM", t: t1.t, conf: "media", como: `se parece a un template que SÓLO tiene MSA (${Math.round(t1.p * 100)} %)` }
  /**
   * Inmobiliario, red vial, municipalidad: el extracto NO trae el número de partida (se buscaron las 19
   * partidas de la app y no aparece ninguna), así que no se puede saber solo si era de PAM o de MSA.
   * Se marca para que lo audite él — su ejemplo del inmobiliario de MSA pagado por PAM cae acá.
   */
  if (/inmobiliario|arba|ministerio de ha|red vial|municipalidad|complementario/i.test(`${m.texto} ${m.obs} ${m.categ}`))
    return { vinculo: "revisar: impuesto sin partida (¿de PAM o de MSA?)", t: null, conf: "baja", como: "el banco no informa la partida: decidir con el papel" }
  return null
}

// ── Excel ────────────────────────────────────────────────────────────────────────────────────
const marcados = movs.map(m => ({ m, k: marcar(m) })).filter(x => x.k) as { m: Mov; k: Marca }[]
const meses = [...new Set(movs.map(m => m.mes))].sort()
const cab = ["Cuenta", "Fecha", "Descripción", "Leyenda", "Débitos", "Créditos", "Su CATEG", "Observaciones", "Vínculo con MSA", "Template de MSA", "Confianza", "Cómo"]
const fila = (m: Mov, k: Marca | null) => [m.cuenta, m.fecha, m.desc, m.leyenda, m.deb || "", m.cre || "", m.categ, m.obs, k?.vinculo ?? "", k?.t?.nombre_referencia ?? "", k?.conf ?? "", k?.como ?? ""]

const porVinculo = new Map<string, { n: number; deb: number; cre: number }>()
for (const { m, k } of marcados) {
  const v = porVinculo.get(k.vinculo) ?? { n: 0, deb: 0, cre: 0 }
  v.n++; v.deb += m.deb; v.cre += m.cre; porVinculo.set(k.vinculo, v)
}
const resumen: unknown[][] = [
  ["MOVIMIENTOS DE PAM (jul-2025 → ene-2026) QUE PUEDEN SER TEMPLATES DE MSA — para auditar, nada cargado"], [],
  ["Movimientos de PAM en el período", movs.length, "", ""],
  ["Marcados", marcados.length, "", ""], [],
  ["Vínculo", "Movimientos", "Débitos", "Créditos"],
  ...[...porVinculo.entries()].map(([v, x]) => [v, x.n, r2(x.deb), r2(x.cre)]), [],
  ["Cómo leer: «alta» = la contraparte es MSA o su observación dice MSA; «media» = se parece a un template que sólo MSA tiene;"],
  ["«baja» = impuesto inmobiliario / red vial / municipal SIN partida en el extracto: puede ser de PAM o de MSA, hay que mirar el papel."],
  ["«RET 3» no existe como cuenta en la app: es la marca de su extracto de MSA, y se usa acá igual."],
]
const piv = new Map<string, number[]>()
for (const { m, k } of marcados) {
  if (!k.t) continue
  const p = piv.get(k.t.nombre_referencia) ?? meses.map(() => 0)
  p[meses.indexOf(m.mes)] += m.deb - m.cre
  piv.set(k.t.nombre_referencia, p)
}
const pivHoja: unknown[][] = [["Template de MSA", ...meses, "TOTAL (débitos − créditos)"],
  ...[...piv.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([n, p]) => [n, ...p.map(r2), r2(p.reduce((a, b) => a + b, 0))])]

const out = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(resumen), "00 Resumen")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([cab, ...marcados.map(x => fila(x.m, x.k))]), "01 Marcados para MSA")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(pivHoja), "02 Template MSA x mes")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([cab, ...movs.map(m => fila(m, marcar(m)))]), "03 Todos los movimientos")
writeFileSync(SALIDA, XLSX.write(out, { type: "buffer", bookType: "xlsx" }))
for (const f of resumen) if (f.length) console.log(f.map(String).join("  "))
for (const [n, p] of piv) console.log("   ", n, r2(p.reduce((a, b) => a + b, 0)))
console.log("→", SALIDA)
