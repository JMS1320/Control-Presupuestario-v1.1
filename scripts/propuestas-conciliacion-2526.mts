/**
 * 🔎 PROPUESTAS DE CONCILIACIÓN 25/26 — MSA, PAM y MA (Camino 1, 2026-10-30). **SOLO LEE LA BASE.**
 *
 * Pedido de JMS: *«muchas cosas quedaron sin conciliar pero están pagadas, por ahí quedó mal registrado el pago y
 * no coincide… dale tiempo, vas a poder ver qué correcciones hace falta hacerle a cada cosa para que pueda conciliar
 * o incluso conciliarlas manualmente. Si no conciliamos, no podemos entregar»*.
 *
 * El motor de la app busca la pareja **sólo entre lo que sigue en el Cash Flow** (pendiente) y por importe exacto
 * ±5 días. Acá se busca en **todo** lo registrado —facturas, cuotas, sueldos, anticipos, cobros de ventas— aunque
 * figure pagado, y se mira por las dos puntas:
 *
 *  - **Movimiento sin conciliar → qué lo explica** (y qué hay que corregir para que concilie).
 *  - **Deuda del ejercicio sin pago → qué movimiento la pagó**. Ésta es la que pega en el balance: una factura
 *    «pendiente» al 30/06 sale como cuenta a pagar.
 *
 * Criterios, del más firme al más flojo (ninguno escribe: todo es propuesta para JMS):
 *  1. EXACTO        mismo importe (±$1), misma empresa, una sola pareja libre.
 *  2. AGRUPADO      mismo CUIT, 2 a 5 facturas/cuotas libres que suman el importe.
 *  3. CON_DIF       mismo CUIT, una pareja libre con diferencia ≤ 3 % (retención, descuento, redondeo).
 *  4. OTRA_EMPRESA  la pareja exacta es de otra empresa → pagado por cuenta y orden (aporte / retiro).
 *  5. YA_USADA      la pareja exacta ya tiene otro movimiento vinculado → ¿duplicado o vínculo equivocado?
 *  6. VARIOS        más de una pareja exacta: elegir sería adivinar (regla del motor).
 *  7. SIN_PAREJA    nada; se dice qué falta (factura, template, sueldo) según lo que trae el banco.
 *
 * Decisión vigente (A-FEAT-1315, JMS 21/10): **en el histórico jul–nov 2025 los pagos de FACTURAS no se concilian**
 * (el balance los da por pagados); sólo lo que va a templates. Esos movimientos se marcan HISTORICO_FACTURA.
 *
 * Uso (desde la carpeta que tiene `.env.local`):  npx tsx <ruta>/scripts/propuestas-conciliacion-2526.mts [salida.json]
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SALIDA = process.argv[2] ?? "propuestas-conciliacion-2526.json"

const DESDE = "2025-07-01", HASTA = "2026-06-30"
const CORTE_HIST_FACTURAS = "2025-12-01" // antes de esto, las facturas viven en el histórico del contador

type Fila = Record<string, any>
async function todo(schema: string, tabla: string, cols: string, filtro?: (q: any) => any): Promise<Fila[]> {
  const out: Fila[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = sb.schema(schema).from(tabla).select(cols).range(desde, desde + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw new Error(`${schema}.${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

const n = (x: any) => Number(x) || 0
const dias = (a?: string | null, b?: string | null) => (!a || !b) ? 9999 : Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86400000)
const cuitDe = (x: any) => String(x ?? "").replace(/\D/g, "")
const plata = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Cuentas ──────────────────────────────────────────────────────────────────────────────
const CUENTAS = [
  { emp: "MSA", schema: "public", tabla: "msa_galicia", nombre: "MSA Galicia", leyendas: true },
  { emp: "PAM", schema: "public", tabla: "pam_galicia", nombre: "PAM Galicia CA", leyendas: true },
  { emp: "PAM", schema: "public", tabla: "pam_galicia_cc", nombre: "PAM Galicia CC", leyendas: true },
  { emp: "MA", schema: "ma", tabla: "ma_galicia", nombre: "MA Galicia", leyendas: true },
  { emp: "MSA", schema: "msa", tabla: "tarjeta_visa_business", nombre: "MSA Visa", leyendas: false },
  { emp: "MSA", schema: "msa", tabla: "caja_sigot", nombre: "MSA Caja Sigot", leyendas: false },
]
// Todas las tablas con vínculos (para saber qué factura/cuota ya está usada). Lista de lib/conciliacion/tablas-con-vinculo-arca.ts
const TODAS = [
  ["public", "msa_galicia"], ["public", "pam_galicia"], ["public", "pam_galicia_cc"], ["ma", "ma_galicia"],
  ["msa", "tarjeta_visa_business"], ["pam", "tarjeta_visa"], ["ma", "tarjeta_visa"], ["msa", "caja_general"],
  ["msa", "caja_ams"], ["msa", "caja_sigot"], ["msa", "echeqs_terceros"], ["msa", "cc_usd"], ["msa", "caja_usd"],
  ["ma", "ca_usd"], ["ma", "caja_usd"], ["public", "cotitulares_ca_usd"], ["public", "cotitulares_ca_pesos"],
  ["public", "cotitulares_caja_usd"], ["msa", "santander"], ["msa", "provincia"],
]
const COLS_VINC = ["comprobante_arca_id", "template_cuota_id", "sueldo_pago_id", "anticipo_id", "comprobante_venta_id"]

async function main() {
  // 1 · Vínculos existentes: id de obligación → movimientos que la usan
  const usadoPor = new Map<string, string[]>()
  const movsConciliados: Fila[] = []
  for (const [s, t] of TODAS) {
    const cv: string[] = []
    for (const c of COLS_VINC) { const { error } = await sb.schema(s).from(t).select(c).limit(1); if (!error) cv.push(c) }
    const filas = await todo(s, t, ["id", "fecha", "debitos", "creditos", "estado", "descripcion", ...cv].join(","))
    for (const f of filas) {
      for (const c of cv) if (f[c]) {
        const k = String(f[c]); const l = usadoPor.get(k) ?? []; l.push(`${t}:${f.id}`); usadoPor.set(k, l)
      }
      if (String(f.estado).toLowerCase() === "conciliado" && f.fecha >= "2025-06-01" && f.fecha <= "2026-07-31")
        movsConciliados.push({ ...f, _tabla: t })
    }
  }

  // 2 · Obligaciones (todo lo registrado, cualquier estado)
  type Obl = { emp: string; org: string; id: string; fecha: string; imp: number; estado: string; quien: string; cuit: string; grupo?: string | null; signo: "D" | "C"; extra?: string }
  const obl: Obl[] = []
  for (const [emp, s] of [["MSA", "msa"], ["PAM", "pam"], ["MA", "ma"]]) {
    const fs = await todo(s, "comprobantes_arca", "id,fecha_emision,fecha_estimada,fecha_pago,tipo_comprobante,punto_venta,numero_desde,cuit,denominacion_emisor,imp_total,monto_a_abonar,monto_sicore,estado,grupo_pago_id",
      q => q.gte("fecha_emision", "2025-03-01").lte("fecha_emision", "2026-07-31"))
    for (const f of fs) {
      const nc = [3, 8, 13, 53, 113].includes(n(f.tipo_comprobante))
      const imp = Math.abs(n(f.monto_a_abonar) || n(f.imp_total))
      obl.push({ emp, org: nc ? "NC" : "factura", id: f.id, fecha: f.fecha_pago ?? f.fecha_emision, imp, estado: f.estado, quien: f.denominacion_emisor, cuit: cuitDe(f.cuit), grupo: f.grupo_pago_id, signo: nc ? "C" : "D",
        extra: `${f.tipo_comprobante}-${f.punto_venta}-${f.numero_desde} emitida ${f.fecha_emision}${n(f.monto_sicore) ? ` · SICORE ${plata(n(f.monto_sicore))}` : ""}` })
      if (n(f.monto_sicore) > 0) // la variante neta de retención: cómo suele salir del banco
        obl.push({ emp, org: "factura-neta-sicore", id: f.id, fecha: f.fecha_pago ?? f.fecha_emision, imp: imp - n(f.monto_sicore), estado: f.estado, quien: f.denominacion_emisor, cuit: cuitDe(f.cuit), grupo: f.grupo_pago_id, signo: "D", extra: `neta de SICORE ${plata(n(f.monto_sicore))}` })
    }
    const vs = await todo(s, "comprobantes_venta", "id,fecha_liquidacion,fecha_acreditacion,fecha_cobro_estimada,cuit_cliente,denominacion_cliente,imp_total,ret_iva,ret_iibb,estado,tipo_comprobante,numero_desde,grupo_cobro_id",
      q => q.gte("fecha_liquidacion", "2025-03-01").lte("fecha_liquidacion", "2026-07-31"))
    for (const v of vs) {
      const neto = n(v.imp_total) - n(v.ret_iva) - n(v.ret_iibb)
      obl.push({ emp, org: "venta", id: v.id, fecha: v.fecha_acreditacion ?? v.fecha_cobro_estimada ?? v.fecha_liquidacion, imp: neto, estado: v.estado, quien: v.denominacion_cliente, cuit: cuitDe(v.cuit_cliente), grupo: v.grupo_cobro_id, signo: "C",
        extra: `venta ${v.tipo_comprobante}-${v.numero_desde} liq ${v.fecha_liquidacion}${neto !== n(v.imp_total) ? ` · total ${plata(n(v.imp_total))} menos retenciones` : ""}` })
    }
  }
  const egresos = await todo("public", "egresos_sin_factura", "id,nombre_referencia,responsable,cuit_quien_cobra,nombre_quien_cobra,categ,tipo_movimiento:tipo")
  const egr = new Map(egresos.map(e => [e.id, e]))
  const cuotas = await todo("public", "cuotas_egresos_sin_factura", "id,egreso_id,fecha_estimada,fecha_vencimiento,fecha_pago,monto,estado,tipo_movimiento,grupo_pago_id",
    q => q.gte("fecha_estimada", "2025-05-01").lte("fecha_estimada", "2026-08-31"))
  for (const c of cuotas) {
    if (!n(c.monto)) continue
    const e = egr.get(c.egreso_id) ?? {}
    const ingreso = /ingreso|credito|crédito/i.test(String(c.tipo_movimiento ?? ""))
    obl.push({ emp: String(e.responsable ?? "?").split("/")[0], org: "cuota", id: c.id, fecha: c.fecha_pago ?? c.fecha_estimada ?? c.fecha_vencimiento, imp: Math.abs(n(c.monto)), estado: c.estado,
      quien: e.nombre_referencia ?? "?", cuit: cuitDe(e.cuit_quien_cobra), grupo: c.grupo_pago_id, signo: ingreso || n(c.monto) < 0 ? "C" : "D", extra: `template ${e.nombre_referencia} (${e.categ ?? "sin categ"})` })
  }
  const anticipos = await todo("public", "anticipos_proveedores", "id,cuit_proveedor,nombre_proveedor,monto,fecha_pago,estado,empresa,tipo")
  for (const a of anticipos) obl.push({ emp: a.empresa ?? "MSA", org: "anticipo", id: a.id, fecha: a.fecha_pago, imp: Math.abs(n(a.monto)), estado: a.estado, quien: a.nombre_proveedor, cuit: cuitDe(a.cuit_proveedor), signo: /cobro|cliente|venta/i.test(String(a.tipo)) ? "C" : "D" })
  const empleados = new Map((await todo("sueldos", "empleados", "id,nombre,empresa,cuit_empleado")).map(e => [e.id, e]))
  const pagos = await todo("sueldos", "pagos", "id,empleado_id,fecha,monto,estado,tipo", q => q.gte("fecha", "2025-05-01").lte("fecha", "2026-08-31"))
  for (const p of pagos) { const e = empleados.get(p.empleado_id) ?? {}
    obl.push({ emp: e.empresa ?? "MSA", org: "sueldo", id: p.id, fecha: p.fecha, imp: Math.abs(n(p.monto)), estado: p.estado, quien: e.nombre ?? "?", cuit: cuitDe(e.cuit_empleado), signo: "D", extra: `sueldo ${p.tipo ?? ""}` }) }

  // Una obligación está libre si nadie la usa (ni ella ni su grupo de pago)
  const usada = (o: Obl) => usadoPor.get(o.id) ?? (o.grupo ? usadoPor.get(o.grupo) : undefined)
  const libre = (o: Obl) => !usada(o)

  // 3 · Movimientos sin conciliar
  type Prop = { cuenta: string; emp: string; id: string; fecha: string; importe: number; lado: "D" | "C"; estado: string; descripcion: string; banco_quien?: string; banco_cuit?: string; detalle_jms?: string; categ?: string; tipo: string; propuesta: string; parejas: any[] }
  const props: Prop[] = []
  const vista = (o: Obl, extra: Record<string, any> = {}) => ({ org: o.org, emp: o.emp, id: o.id, quien: o.quien, importe: o.imp, fecha: o.fecha, estado: o.estado, ref: o.extra, ...extra })

  for (const c of CUENTAS) {
    const cols = ["id", "fecha", "debitos", "creditos", "estado", "descripcion", "categ", "detalle", ...(c.leyendas ? ["leyendas_adicionales_1", "leyendas_adicionales_2"] : [])].join(",")
    const movs = await todo(c.schema, c.tabla, cols, q => q.gte("fecha", DESDE).lte("fecha", HASTA).in("estado", ["pendiente", "auditar", "historico"]))
    for (const m of movs) {
      const lado: "D" | "C" = n(m.debitos) > 0 ? "D" : "C"
      const imp = lado === "D" ? n(m.debitos) : n(m.creditos)
      if (imp < 0.005) continue
      const bcuit = cuitDe(m.leyendas_adicionales_2)
      const p: Prop = { cuenta: c.nombre, emp: c.emp, id: m.id, fecha: m.fecha, importe: imp, lado, estado: m.estado, descripcion: m.descripcion, banco_quien: m.leyendas_adicionales_1 ?? undefined,
        banco_cuit: bcuit.length === 11 ? bcuit : undefined, detalle_jms: m.detalle ?? undefined, categ: m.categ ?? undefined, tipo: "SIN_PAREJA", propuesta: "", parejas: [] }
      const cerca = (o: Obl, d = 60) => o.signo === lado && dias(o.fecha, m.fecha) <= d
      const exactas = obl.filter(o => cerca(o) && Math.abs(o.imp - imp) < 1)
      const exLibreMia = exactas.filter(o => libre(o) && o.emp === c.emp)
      const exLibreOtra = exactas.filter(o => libre(o) && o.emp !== c.emp)
      const exUsadas = exactas.filter(o => !libre(o))
      const delCuit = p.banco_cuit ? obl.filter(o => o.cuit === p.banco_cuit && o.signo === lado && libre(o) && o.org !== "factura-neta-sicore" && dias(o.fecha, m.fecha) <= 150) : []
      const histFactura = m.estado === "historico" && m.fecha < CORTE_HIST_FACTURAS

      const unicos = (l: Obl[]) => [...new Map(l.map(o => [o.id, o])).values()]
      if (unicos(exLibreMia).length === 1) {
        const o = exLibreMia[0]
        p.tipo = "EXACTO"; p.parejas = [vista(o, { dias: dias(o.fecha, m.fecha) })]
        p.propuesta = `Conciliar con ${o.org} ${o.quien} (${o.extra ?? ""}).` + (o.estado === "pagado" ? " Figura «pagado» sin movimiento: es el pago." : "")
      } else if (unicos(exLibreMia).length > 1) {
        p.tipo = "VARIOS"; p.parejas = unicos(exLibreMia).map(o => vista(o, { dias: dias(o.fecha, m.fecha) }))
        p.propuesta = `${unicos(exLibreMia).length} parejas del mismo importe: elegir cuál.`
      } else if (delCuit.length >= 2 && (() => { // subconjunto que suma
        const cand = delCuit.filter(o => o.imp <= imp + 1).slice(0, 18)
        let mejor: Obl[] | null = null
        const rec = (i: number, suma: number, sel: Obl[]) => {
          if (mejor) return
          if (sel.length >= 2 && Math.abs(suma - imp) < 1) { mejor = [...sel]; return }
          if (i >= cand.length || sel.length >= 5 || suma > imp + 1) return
          rec(i + 1, suma + cand[i].imp, [...sel, cand[i]]); rec(i + 1, suma, sel)
        }
        rec(0, 0, [])
        if (mejor) { p.tipo = "AGRUPADO"; p.parejas = (mejor as Obl[]).map(o => vista(o)); p.propuesta = `Pago agrupado de ${(mejor as Obl[]).length} comprobantes de ${(mejor as Obl[])[0].quien} que suman el importe exacto.`; return true }
        return false
      })()) {
        // asignado adentro
      } else if (delCuit.some(o => Math.abs(o.imp - imp) / imp <= 0.03)) {
        const o = delCuit.filter(o => Math.abs(o.imp - imp) / imp <= 0.03).sort((a, b) => Math.abs(a.imp - imp) - Math.abs(b.imp - imp))[0]
        p.tipo = "CON_DIF"; p.parejas = [vista(o, { diferencia: +(imp - o.imp).toFixed(2) })]
        p.propuesta = `${o.org} de ${o.quien} por ${plata(o.imp)}: el banco pagó ${plata(imp)} (diferencia ${plata(imp - o.imp)}). Corregir el monto a abonar / registrar la retención o el descuento.`
      } else if (unicos(exLibreOtra).length >= 1) {
        p.tipo = "OTRA_EMPRESA"; p.parejas = unicos(exLibreOtra).map(o => vista(o))
        p.propuesta = `La pareja exacta es de ${exLibreOtra[0].emp}: ${exLibreOtra[0].org} ${exLibreOtra[0].quien}. Pagado por cuenta y orden → aporte/retiro, a confirmar.`
      } else if (unicos(exUsadas).length >= 1) {
        const o = exUsadas[0]
        p.tipo = "YA_USADA"; p.parejas = unicos(exUsadas).map(o => vista(o, { vinculada_a: usada(o) }))
        p.propuesta = `${o.org} ${o.quien} por el mismo importe ya está vinculada a otro movimiento (${(usada(o) ?? []).join(", ")}). ¿Duplicado, o el vínculo está mal?`
      } else if (delCuit.length) {
        p.tipo = "CUIT_SIN_CIERRE"; p.parejas = delCuit.slice(0, 8).map(o => vista(o))
        p.propuesta = `${p.banco_quien} tiene ${delCuit.length} comprobante(s) libres, pero ninguno (ni sumados) da ${plata(imp)}. Revisar montos o falta un comprobante.`
      } else {
        p.propuesta = histFactura ? "Histórico jul–nov 2025: si es pago de factura, por decisión NO se concilia (A-FEAT-1315)." : "Sin pareja en lo registrado: falta la factura, el template o el sueldo."
      }
      if (histFactura && p.tipo !== "EXACTO" && p.tipo !== "AGRUPADO" && !p.parejas.some(x => x.org === "cuota")) p.tipo = p.tipo === "SIN_PAREJA" ? "HISTORICO_FACTURA" : p.tipo
      props.push(p)
    }
  }

  // 4 · Deudas del ejercicio sin pago (lo que sale como cuenta a pagar / a cobrar al 30/06)
  const ABIERTAS = ["pendiente", "pagar", "preparado", "pagado", "cuotas", "credito", "debito", "a cobrar", "cobrado"]
  const deudas = obl.filter(o => o.org !== "factura-neta-sicore" && o.fecha >= DESDE && o.fecha <= HASTA && ABIERTAS.includes(String(o.estado).toLowerCase()) && libre(o) && o.org !== "anticipo")
  const movSinConc = props
  const deudaProps = deudas.map(o => {
    const candSin = movSinConc.filter(m => m.lado === o.signo && Math.abs(m.importe - o.imp) < 1 && dias(m.fecha, o.fecha) <= 90)
    const candConc = movsConciliados.filter(m => Math.abs((o.signo === "D" ? n(m.debitos) : n(m.creditos)) - o.imp) < 1 && dias(m.fecha, o.fecha) <= 90)
    return { ...vista(o), cuit: o.cuit, mov_sin_conciliar: candSin.map(m => ({ cuenta: m.cuenta, id: m.id, fecha: m.fecha, desc: m.descripcion, quien: m.banco_quien })),
      mov_ya_conciliado_mismo_importe: candConc.slice(0, 5).map(m => ({ tabla: m._tabla, id: m.id, fecha: m.fecha, desc: m.descripcion })) }
  })

  writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), movimientos: props, deudas: deudaProps }, null, 1))

  // Resumen
  const porTipo = new Map<string, { n: number; m: number }>()
  for (const p of props) { const k = `${p.cuenta} · ${p.tipo}`; const v = porTipo.get(k) ?? { n: 0, m: 0 }; v.n++; v.m += p.importe; porTipo.set(k, v) }
  console.log("MOVIMIENTOS SIN CONCILIAR 25/26 — por cuenta y tipo de propuesta")
  for (const [k, v] of [...porTipo].sort()) console.log(`  ${k.padEnd(42)} ${String(v.n).padStart(4)}  ${plata(v.m).padStart(18)}`)
  const pd = new Map<string, { n: number; m: number; conMov: number }>()
  for (const d of deudaProps) { const k = `${d.emp} · ${d.org} · ${d.estado}`; const v = pd.get(k) ?? { n: 0, m: 0, conMov: 0 }; v.n++; v.m += d.importe; if (d.mov_sin_conciliar.length) v.conMov++; pd.set(k, v) }
  console.log("\nDEUDAS/COBROS DEL EJERCICIO SIN MOVIMIENTO VINCULADO")
  for (const [k, v] of [...pd].sort()) console.log(`  ${k.padEnd(42)} ${String(v.n).padStart(4)}  ${plata(v.m).padStart(18)}  con mov. candidato: ${v.conMov}`)
  console.log(`\n→ ${SALIDA}`)
}
main().catch(e => { console.error(e); process.exit(1) })
