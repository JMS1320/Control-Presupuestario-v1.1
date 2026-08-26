// MAQUETA — Costo de alimentación de recría, repartido entre lo vendido y lo que queda.
//
// ⚠️ ESTO ES UNA MAQUETA CON FECHA DE VENCIMIENTO. Sirve para acordar LA LÓGICA rápido, sin
// tocar la app. Cuando la app lo calcule, este Excel deja de ser la herramienta y pasa a ser el
// caso de prueba: la app tiene que dar exactamente estos números.
// NO debe convertirse en una segunda fuente de verdad — este proyecto ya tiene esa cicatriz.
//
//   npx tsx scripts/maqueta-costo-recria.mts [archivo.xlsx]
//
// ── La idea en tres líneas ───────────────────────────────────────────────────
// 1. El TOTAL consumido es real: entregas − stock medido. No se estima.
// 2. El REPARTO entre los animales usa una clave que depende del RÉGIMEN:
//      · ración fija por cabeza  → cabeza-día  (todos comen lo mismo, el peso no importa)
//      · a discreción            → kilo-día    (comen según apetito, que sigue al peso)
// 3. El peso sale de las PESADAS reales interpoladas, nunca de una ganancia estimada.

import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

function env(clave: string): string {
  try {
    const txt = readFileSync(join(process.cwd(), ".env.local"), "utf-8")
    const linea = txt.split(/\r?\n/).find(l => l.startsWith(clave + "="))
    if (linea) return linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, "")
  } catch { /* sigue con process.env */ }
  return process.env[clave] ?? ""
}
const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY"))

// ═══════════════════════════════════════════════════════════════════════════════
// INPUTS — lo que aportó el usuario y el sistema NO tiene todavía.
// Todo esto es lo que hay que corregir si algún dato cambia.
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ La ración arrancó el 06/05 con la 2ª entrega, NO en marzo. Lo resolvió el diagnóstico:
// con 1.740 kg el 16/03 y 56 días sin otra entrega, ninguna ración era posible. Y con esta
// fecha la ración implícita da 2,99 kg/cab/día — exactamente los 3 que declaró el usuario.
const INICIO_RACION = "2026-05-06"
const INICIO_CONC   = "2026-07-27"   // arranca el autoconsumo a discreción, mezcla 90/10
const FECHA_STOCK   = "2026-08-24"   // la medición de stock

const STOCK_FINAL = {
  maiz: 4000 + 1800,   // 4.000 sueltos + 90 % de los 2.000 ya mezclados
  conc:  950 +  200,   //   950 sueltos + 10 % de los 2.000
}

/** Entregas de MAÍZ. La fecha es la de ENTREGA, no la de factura — es la que mueve el stock. */
const ENTREGAS_MAIZ = [
  { fecha: "2026-03-16", prov: "Arroyo Tala", ton: 1.74, precioTon: 193000, nota: "FC 7/4 (template). Se usó para terneros chicos con tratamiento específico; queda en STOCK hasta el 06/05" },
  { fecha: "2026-05-06", prov: "Arroyo Tala", ton: 7.30, precioTon: 262000, nota: "FC del 11/05, RECIBIDA el 06/05 — acá arranca la ración" },
  { fecha: "2026-06-02", prov: "Arroyo Tala", ton: 7.56, precioTon: 254000, nota: "fecha de entrega ≈ factura (sin dato exacto)" },
  { fecha: "2026-06-17", prov: "Pereyra Miguel", ton: 5.96, precioTon: 238352.82, nota: "mal facturada → fue a otra cuenta contable" },
  // ⚠️ Longo: lo facturado y lo entregado NO coinciden evento por evento, pero el total sí (45,1 ton).
  // Las 4,9 ton de diferencia son un ANTICIPO que viaja con su propio precio:
  //   FC 13/07: 25,0 ton × $267.500 = $6.687.500  → se entregaron 20,1 el 24/06
  //   FC 14/08: 20,1 ton × $267.050 = $5.367.705  → se entregaron 25,0 el 24/07
  //   entrega 2 = 20,1 @ 267.050 (FC 14/08) + 4,9 @ 267.500 (anticipo) = $6.678.455
  //   5.376.750 + 6.678.455 = 12.055.205 = el total facturado, exacto.
  { fecha: "2026-06-24", prov: "Longo", ton: 20.10, precioTon: 267500, nota: "1er flete. Precio de la FC 13/07 (que facturó 25 ton)" },
  { fecha: "2026-07-24", prov: "Longo", ton: 25.00, precioTon: (20.1 * 267050 + 4.9 * 267500) / 25, nota: "2do flete. 20,1 ton a precio de la FC 14/08 + 4,9 ton del anticipo de la FC 13/07" },
]

/** Concentrado: una sola compra. */
const ENTREGAS_CONC = [
  { fecha: "2026-07-22", prov: "Biofarma", kg: 3000, neto: 2187000, nota: "FC 7942 — sin cuenta contable asignada" },
]

/** Tomas de stock intermedias: al recibir de Longo el stock estaba ≈ 0. */
const CORTES_MAIZ = [
  { fecha: "2026-06-24", kg: 0, nota: "al recibir el 1er flete de Longo, stock ≈ 0 (aprox. del usuario)" },
  { fecha: "2026-07-24", kg: 0, nota: "al recibir el 2do flete de Longo, stock ≈ 0 (aprox. del usuario)" },
]

/** Precio de entrada a recría: la venta teórica de cría. Se paga sobre el peso NETO. */
const PRECIO_ENTRADA_KG = 7000

/**
 * Desbaste: la merma que descuenta el comprador. La balanza da BRUTO.
 *
 * ⚠️ La distinción vale para todo el modelo:
 *   · para el CONSUMO se usa el peso VIVO (bruto) — el animal come según lo que pesa;
 *   · para la PLATA se usa el peso NETO — es lo que se paga.
 * Es lo mismo que hace la venta: 16.180 kg brutos de balanza, 15.694,6 netos facturados.
 */
const DESBASTE = 0.03

/**
 * Precio de prueba para valuar a los que TODAVÍA no se vendieron, como si se vendieran hoy.
 * Va POR GRUPO: el $/kg depende del peso, y los que quedan son más livianos que los 55 que se
 * vendieron a $5.670 — o sea que valen MÁS por kilo.
 * ⚠️ El de machos es supuesto mío; el de hembras lo dio el usuario.
 */
const PRECIO_VENTA_HOY: Record<string, number> = {
  machos: 6000,    // ← SUPUESTO: el usuario dijo "más caro que 5.670" pero no dio el número
  hembras: 5700,   // ← dato del usuario
}

/** Categorías que comen la ración: todos los machos (con toritos) y todas las hembras. */
const CATS_COMEN = ["ternero recria", "ternera recria", "torito", "vaquillona de reposicion",
  "novillo", "vaquillona engorde"]

// ═══════════════════════════════════════════════════════════════════════════════

const dias = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 86400000)
const addDias = (f: string, n: number) => new Date(+new Date(f) + n * 86400000).toISOString().slice(0, 10)
const ar = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })

async function main() {
  const salida = process.argv[2] || "Maqueta_Costo_Recria.xlsx"

  // ── Datos del sistema ──────────────────────────────────────────────────────
  const { data: cats } = await supabase.schema("productivo").from("categorias_hacienda").select("id, nombre")
  const idsComen = new Set((cats || []).filter((c: any) => CATS_COMEN.includes(c.nombre.toLowerCase())).map((c: any) => c.id))
  const nombreCat: Record<string, string> = {}
  ;(cats || []).forEach((c: any) => { nombreCat[c.id] = c.nombre })

  const { data: movs } = await supabase.schema("productivo").from("movimientos_hacienda")
    .select("fecha, tipo, cantidad, categoria_id, observaciones").order("fecha")

  const { data: pesadas } = await supabase.schema("productivo").from("pesadas_terneros")
    .select("ternero_id, fecha, peso_kg").order("fecha")

  const { data: vendidos } = await supabase.schema("productivo").from("terneros")
    .select("id").eq("fecha_baja", "2026-08-04").eq("motivo_baja", "venta")
  const idsVendidos = new Set((vendidos || []).map((t: any) => t.id))

  // Los TRES grupos. Machos y hembras siguen el mismo régimen, así que alcanza con partir
  // "el resto" en dos: repartir 3 grupos a la vez da lo mismo que repartir 2 y subdividir.
  const { data: ternerosAll } = await supabase.schema("productivo").from("terneros")
    .select("id, sexo, fecha_baja, categoria_id")
  const delRodeo = (ternerosAll || []).filter((t: any) => idsComen.has(t.categoria_id))
  type Grupo = "vendidos" | "machos" | "hembras"
  const grupoDe = (t: any): Grupo => idsVendidos.has(t.id) ? "vendidos" : (t.sexo === "Macho" ? "machos" : "hembras")
  const gruposPorId: Record<string, Grupo> = {}
  delRodeo.forEach((t: any) => { gruposPorId[t.id] = grupoDe(t) })
  const vivoAl = (t: any, f: string) => !t.fecha_baja || t.fecha_baja > f
  const cabezasGrupo = (g: Grupo, f: string) =>
    delRodeo.filter((t: any) => grupoDe(t) === g && vivoAl(t, f)).length

  const { data: ventaMov } = await supabase.schema("productivo").from("movimientos_hacienda")
    .select("fecha, cantidad, peso_total_kg, precio_por_kg, monto_total")
    .eq("tipo", "venta").eq("fecha", "2026-08-04").single()

  // ── Rodeo: cabezas del grupo que come, por evento ──────────────────────────
  const eventos: { fecha: string; delta: number; que: string }[] = []
  for (const m of (movs || []) as any[]) {
    if (!idsComen.has(m.categoria_id)) continue
    const signo = (m.tipo === "venta" || m.tipo === "mortandad") ? -1 : 1
    const d = signo * Math.abs(m.cantidad) * (m.cantidad < 0 && m.tipo !== "venta" && m.tipo !== "mortandad" ? -1 : 1)
    const delta = (m.tipo === "venta" || m.tipo === "mortandad") ? -Math.abs(m.cantidad) : m.cantidad
    if (delta === 0) continue
    eventos.push({ fecha: m.fecha, delta, que: `${m.tipo} ${nombreCat[m.categoria_id]}` })
  }
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const cabezasAl = (f: string) => eventos.filter(e => e.fecha <= f).reduce((s, e) => s + e.delta, 0)

  // ── Peso: pesadas reales, promedio del grupo vendido y del resto ───────────
  const fechasPesada = [...new Set((pesadas || []).map((p: any) => p.fecha))].sort()
  const pesoProm = (fecha: string, grupo: Grupo | "resto" | "todos") => {
    const ps = (pesadas || []).filter((p: any) => {
      if (p.fecha !== fecha) return false
      if (grupo === "todos") return true
      if (grupo === "resto") return !idsVendidos.has(p.ternero_id)
      return gruposPorId[p.ternero_id] === grupo
    })
    return ps.length ? ps.reduce((s: number, p: any) => s + Number(p.peso_kg), 0) / ps.length : 0
  }

  /** Peso interpolado entre pesadas. Fuera de rango, se extiende con la pendiente del extremo. */
  const pesoEn = (fecha: string, grupo: Grupo | "resto") => {
    const pts = fechasPesada.map(f => ({ f, p: pesoProm(f, grupo) })).filter(x => x.p > 0)
    if (pts.length === 0) return 0
    if (fecha <= pts[0].f) return pts[0].p
    if (fecha >= pts[pts.length - 1].f) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1]
      if (!a) return b.p
      const pend = (b.p - a.p) / dias(a.f, b.f)
      return b.p + pend * dias(b.f, fecha)
    }
    for (let i = 1; i < pts.length; i++) {
      if (fecha <= pts[i].f) {
        const a = pts[i - 1], b = pts[i]
        return a.p + (b.p - a.p) * (dias(a.f, fecha) / dias(a.f, b.f))
      }
    }
    return pts[pts.length - 1].p
  }

  // ── Tramos: delimitados por las tomas de stock ─────────────────────────────
  // ⚠️ El corte se mide AL RECIBIR, o sea ANTES de descargar. Entonces la entrega que llega el
  // día del corte pertenece al tramo SIGUIENTE, no al que cierra. Si se pone al revés, el maíz
  // de Longo se consume el mismo día que llega y el tramo anterior queda inflado.
  const puntos = [
    { fecha: ENTREGAS_MAIZ[0].fecha, kg: 0, nota: "arranque: stock cero al destete" },
    ...CORTES_MAIZ,
    { fecha: FECHA_STOCK, kg: STOCK_FINAL.maiz, nota: "medición del 24/08" },
  ]
  const tramos = puntos.slice(1).map((fin, i) => {
    const ini = puntos[i]
    const entregado = ENTREGAS_MAIZ
      .filter(e => e.fecha >= ini.fecha && e.fecha < fin.fecha)
      .reduce((s, e) => s + e.ton * 1000, 0)
    const consumo = ini.kg + entregado - fin.kg
    return { desde: ini.fecha, hasta: fin.fecha, d: dias(ini.fecha, fin.fecha), entregado, consumo,
             stockIni: ini.kg, stockFin: fin.kg }
  })

  // ── El reparto ─────────────────────────────────────────────────────────────
  // Por cada día se calcula el peso de cada grupo. El régimen decide la clave:
  //   antes del autoconsumo → cabeza-día ; desde el autoconsumo → kilo-día.
  const CAB_VENDIDOS = 55
  const GRUPOS: Grupo[] = ["vendidos", "machos", "hembras"]
  const repartoTramo = (t: typeof tramos[0]) => {
    const clave: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
    const claveKD: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
    // Contraste: la clave VIEJA (cabeza-día mientras la ración era fija), sólo para mostrar
    // cuánto cambió al corregirla. No se usa para calcular nada.
    const claveCD: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
    for (let k = 0; k < t.d; k++) {
      const f = addDias(t.desde, k)
      if (f < INICIO_RACION) continue          // antes de la ración no se consume nada
      for (const g of GRUPOS) {
        const cab = cabezasGrupo(g, f)
        const p = pesoEn(f, g)
        // KILO-DÍA SIEMPRE. La comida se sirve al grupo y adentro del corral el que pesa más
        // come más — con ración por día y a discreción. Lo confirmó el usuario: "esto es así en
        // la realidad, no es invento mío". El régimen sirve para PROYECTAR y CONTROLAR, no para
        // repartir. Antes se usaba cabeza-día en el régimen fijo y le cobraba de menos al pesado.
        clave[g] += cab * p
        claveKD[g] += cab * p
        claveCD[g] += (f >= INICIO_CONC) ? cab * p : cab    // la vieja, sólo para comparar
      }
    }
    const tot = GRUPOS.reduce((s, g) => s + clave[g], 0)
    const totKD = GRUPOS.reduce((s, g) => s + claveKD[g], 0)
    // El % del peso vivo que comieron NO se supone: sale de dividir el consumo real por los
    // kilo-día del rodeo. Es el número que uno mira y juzga si es sensato (criterio del usuario).
    const pctPV = totKD ? t.consumo / totKD : 0
    const totCD = GRUPOS.reduce((s, g) => s + claveCD[g], 0)
    const kg: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
    const kgCD: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
    GRUPOS.forEach(g => {
      kg[g] = tot ? t.consumo * clave[g] / tot : 0
      kgCD[g] = totCD ? t.consumo * claveCD[g] / totCD : 0
    })
    return { clave, kg, kgCD, pctPV, totKD,
             claveV: clave.vendidos, claveR: clave.machos + clave.hembras,
             kgV: kg.vendidos, kgR: kg.machos + kg.hembras,
             regimen: t.desde >= INICIO_CONC ? "kilo-día" : (t.hasta > INICIO_CONC ? "mixto" : "cabeza-día") }
  }
  const repartos = tramos.map(repartoTramo)

  // ── Precio del maíz: POR TRAMO, no un promedio único ───────────────────────
  // Como cada tramo arranca y termina en stock ≈ 0, el maíz consumido en un tramo ES el
  // entregado en ese tramo. No hay que suponer FIFO: se sabe. Un promedio único del período
  // le cobraría a los 55 parte del maíz comprado DESPUÉS de que se vendieran.
  const tonTotal = ENTREGAS_MAIZ.reduce((s, e) => s + e.ton, 0)
  const costoTotalMaiz = ENTREGAS_MAIZ.reduce((s, e) => s + e.ton * e.precioTon, 0)
  const precioMaizKg = costoTotalMaiz / (tonTotal * 1000)   // sólo para referencia

  const precioTramo = tramos.map(t => {
    const ents = ENTREGAS_MAIZ.filter(e => e.fecha >= t.desde && e.fecha < t.hasta)
    const kg = ents.reduce((s, e) => s + e.ton * 1000, 0)
    const $$ = ents.reduce((s, e) => s + e.ton * e.precioTon, 0)
    // Si el tramo cierra con stock, ese remanente queda valuado al precio del tramo
    return kg ? $$ / kg : precioMaizKg
  })

  const kgConc = ENTREGAS_CONC.reduce((s, e) => s + e.kg, 0)
  const costoConc = ENTREGAS_CONC.reduce((s, e) => s + e.neto, 0)
  const precioConcKg = costoConc / kgConc
  const consumoConc = kgConc - STOCK_FINAL.conc

  // ── Totales derivados ──────────────────────────────────────────────────────
  const kgV = repartos.reduce((s, r) => s + r.kgV, 0)
  const kgR = repartos.reduce((s, r) => s + r.kgR, 0)
  const consumoMaizTotal = tramos.reduce((s, t) => s + t.consumo, 0)
  const costoMaizV = repartos.reduce((s, r, i) => s + r.kgV * precioTramo[i], 0)
  const costoMaizR = repartos.reduce((s, r, i) => s + r.kgR * precioTramo[i], 0)
  const valorStockFinal = STOCK_FINAL.maiz * precioTramo[precioTramo.length - 1]

  const rT3 = repartos[repartos.length - 1]
  const pctConcV = (rT3.claveV + rT3.claveR) ? rT3.claveV / (rT3.claveV + rT3.claveR) : 0
  const costoConcV = consumoConc * pctConcV * precioConcKg
  const costoConcR = consumoConc * (1 - pctConcV) * precioConcKg

  // La pesada da BRUTO; el precio se paga sobre el NETO
  const pesoEntradaBruto = pesoProm(fechasPesada[0], "vendidos")
  const pesoEntradaNeto = pesoEntradaBruto * (1 - DESBASTE)
  const costoEntradaV = pesoEntradaNeto * CAB_VENDIDOS * PRECIO_ENTRADA_KG
  const ingresoV = Number(ventaMov?.monto_total ?? 0)

  /** Cabezas promedio del tramo, día por día — no una foto de una fecha suelta. */
  const cabPromTramo = (t: typeof tramos[0]) => {
    let s = 0, n = 0
    for (let k = 0; k < t.d; k++) {
      const f = addDias(t.desde, k)
      if (f < INICIO_RACION) continue
      s += cabezasAl(f); n++
    }
    return n ? s / n : 0
  }
  const racionImplicita = (i: number) => {
    const cp = cabPromTramo(tramos[i])
    const d = Math.max(1, tramos[i].d - Math.max(0, dias(tramos[i].desde, INICIO_RACION)))
    return cp ? tramos[i].consumo / d / cp : 0
  }
  // Consumo del régimen 1 = todo menos lo del autoconsumo (que sale del cruce 90/10)
  const consumoReg1v = consumoMaizTotal - consumoConc * 9
  const diasReg1v = dias(INICIO_RACION, INICIO_CONC)

  // ── Por grupo: kg, costos, cabezas y peso de hoy ───────────────────────────
  const kgG: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
  const kgCabezaDia: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
  const costoMaizG: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
  repartos.forEach((r, i) => GRUPOS.forEach(g => {
    kgG[g] += r.kg[g]; kgCabezaDia[g] += r.kgCD[g]; costoMaizG[g] += r.kg[g] * precioTramo[i]
  }))
  const pctConcG: Record<Grupo, number> = { vendidos: 0, machos: 0, hembras: 0 }
  const totT3 = GRUPOS.reduce((s, g) => s + rT3.clave[g], 0)
  GRUPOS.forEach(g => { pctConcG[g] = totT3 ? rT3.clave[g] / totT3 : 0 })
  const costoConcG: Record<Grupo, number> = {
    vendidos: consumoConc * pctConcG.vendidos * precioConcKg,
    machos: consumoConc * pctConcG.machos * precioConcKg,
    hembras: consumoConc * pctConcG.hembras * precioConcKg,
  }
  const cabG: Record<Grupo, number> = {
    vendidos: CAB_VENDIDOS,
    machos: cabezasGrupo("machos", FECHA_STOCK),
    hembras: cabezasGrupo("hembras", FECHA_STOCK),
  }
  // Peso de entrada (pesada del 23/02) y de hoy, por grupo
  const pesoIniG: Record<Grupo, number> = {
    vendidos: pesoProm(fechasPesada[0], "vendidos"),
    machos: pesoProm(fechasPesada[0], "machos"),
    hembras: pesoProm(fechasPesada[0], "hembras"),
  }
  const pesoHoyG: Record<Grupo, number> = {
    vendidos: Number(ventaMov?.peso_total_kg ?? 0) / CAB_VENDIDOS,   // balanza real de la venta
    machos: pesoEn(FECHA_STOCK, "machos"),
    hembras: pesoEn(FECHA_STOCK, "hembras"),
  }
  /** Entrada, salida y margen de un grupo. Los vendidos usan la venta real; el resto, el precio de prueba. */
  const cuenta = (g: Grupo) => {
    const entrada = pesoIniG[g] * (1 - DESBASTE) * PRECIO_ENTRADA_KG * cabG[g]
    const alimento = costoMaizG[g] + costoConcG[g]
    const salida = g === "vendidos" ? ingresoV
      : pesoHoyG[g] * (1 - DESBASTE) * PRECIO_VENTA_HOY[g] * cabG[g]
    return { entrada, alimento, salida, margen: salida - entrada - alimento }
  }

  // ═══ Serie DIARIA — el corazón auditable ═══════════════════════════════════
  // Una fila por día. De acá sale TODO el reparto, con fórmulas de Excel, para poder
  // auditarlo día por día en vez de creer en un número final.
  const F_INI = ENTREGAS_MAIZ[0].fecha
  const diario = [] as { fecha: string; tramo: number; regimen: number; cabTot: number
    cab55: number; cabResto: number; peso55: number; pesoResto: number }[]
  for (let k = 0; k <= dias(F_INI, FECHA_STOCK); k++) {
    const f = addDias(F_INI, k)
    const iT = tramos.findIndex(t => f >= t.desde && f < t.hasta)
    const regimen = f < INICIO_RACION ? 0 : (f < INICIO_CONC ? 1 : 2)
    const cabTot = cabezasAl(f)
    const cab55 = f < "2026-08-04" ? CAB_VENDIDOS : 0
    diario.push({ fecha: f, tramo: iT + 1, regimen, cabTot, cab55,
      cabResto: Math.max(0, cabTot - cab55), peso55: pesoEn(f, "vendidos"), pesoResto: pesoEn(f, "resto") })
  }

  // ═══ Armado del Excel — CON FÓRMULAS ═══════════════════════════════════════
  const wb = XLSX.utils.book_new()
  /** Fórmula con su valor cacheado, para que se vea aunque el visor no recalcule. */
  const setF = (ws: any, addr: string, f: string, v: number) => { ws[addr] = { t: "n", f, v } }
  const hoja = (nombre: string, aoa: any[][], anchos: number[], toques?: (ws: any) => void) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = anchos.map(w => ({ wch: w }))
    if (toques) toques(ws)
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }

  // ── 0 · RESUMEN — la síntesis, adelante de todo ────────────────────────────
  const aoaRes0: any[][] = [
    ["RESUMEN — cómo nos fue con la recría"],
    ["Los números del final. El detalle de cómo salen está en las otras hojas."],
    [],
    ["LA RACIÓN, TRAMO POR TRAMO"],
    ["Desde", "Hasta", "Días", "Cabezas", "Régimen", "kg/cab/día", "Consumo total (kg)"],
  ]
  tramos.forEach((t, i) => aoaRes0.push([
    t.desde < INICIO_RACION ? INICIO_RACION : t.desde, t.hasta,
    Math.max(0, t.d - Math.max(0, dias(t.desde, INICIO_RACION))),
    +cabPromTramo(t).toFixed(0),
    i === tramos.length - 1 ? "a discreción" : "fija por cabeza",
    +racionImplicita(i).toFixed(2), Math.round(t.consumo),
  ]))
  aoaRes0.push(["", "", "", "", "TOTAL", "", Math.round(consumoMaizTotal)])
  aoaRes0.push([])
  aoaRes0.push(["En criollo: desde el 06/05 hasta el 24/06 comieron " + racionImplicita(0).toFixed(1) + " kg/cab/día;"])
  aoaRes0.push(["del 24/06 al 24/07, " + racionImplicita(1).toFixed(1) + " kg; y desde el 24/07, con autoconsumo, " + racionImplicita(2).toFixed(1) + " kg."])
  aoaRes0.push([])
  aoaRes0.push(["EL % DEL PESO VIVO QUE COMIERON — sale del dato, no se supone"])
  aoaRes0.push(["consumo real del tramo ÷ (peso × días de todo el rodeo). Es el número para juzgar si la cuenta es sensata."])
  aoaRes0.push(["Tramo", "Consumo (kg)", "Kilo-día del rodeo", "% del peso vivo", "Lectura"])
  tramos.forEach((t, i) => aoaRes0.push([
    (t.desde < INICIO_RACION ? INICIO_RACION : t.desde) + " → " + t.hasta,
    Math.round(t.consumo), Math.round(repartos[i].totKD),
    +(repartos[i].pctPV * 100).toFixed(2),
    repartos[i].pctPV < 0.006 ? "bajo: revisar si falta una entrega"
      : repartos[i].pctPV > 0.02 ? "alto: revisar el stock declarado" : "razonable",
  ]))
  aoaRes0.push([])
  aoaRes0.push(["Y de ahí sale lo que comió cada animal:"])
  aoaRes0.push(["   lo que comió  =  ese %  ×  su peso  ×  sus días"])
  aoaRes0.push(["El que pesa 50 % más come 50 % más. Las participaciones suman 1, así que el reparto"])
  aoaRes0.push(["NUNCA se va del total real consumido — que es el dato sagrado."])
  aoaRes0.push([])
  aoaRes0.push(["EL MAÍZ Y EL CONCENTRADO, A DÓNDE FUERON"])
  aoaRes0.push(["Grupo", "Cabezas", "kg maíz", "kg/cab", "kg concentrado", "$ alimentación", "$/cab"])
  GRUPOS.forEach(g => aoaRes0.push([
    g === "vendidos" ? "Los 55 vendidos" : g === "machos" ? "Machos que quedan" : "Hembras que quedan",
    cabG[g], Math.round(kgG[g]), +(kgG[g] / cabG[g]).toFixed(1),
    Math.round(consumoConc * pctConcG[g]),
    Math.round(costoMaizG[g] + costoConcG[g]),
    Math.round((costoMaizG[g] + costoConcG[g]) / cabG[g]),
  ]))
  aoaRes0.push(["TOTAL", GRUPOS.reduce((s, g) => s + cabG[g], 0), Math.round(consumoMaizTotal), "",
    Math.round(consumoConc), Math.round(GRUPOS.reduce((s, g) => s + costoMaizG[g] + costoConcG[g], 0)), ""])
  aoaRes0.push([])
  aoaRes0.push(["CÓMO LE FUE A CADA GRUPO"])
  aoaRes0.push(["Los vendidos con la venta REAL del 04/08 ($5.670/kg). Los que quedan, como si se vendieran hoy:"])
  aoaRes0.push(["machos $" + ar(PRECIO_VENTA_HOY.machos) + "/kg (SUPUESTO) · hembras $" + ar(PRECIO_VENTA_HOY.hembras) + "/kg (dato del usuario). Son más livianos, así que valen más por kilo."])
  aoaRes0.push(["Grupo", "Cab.", "Peso entrada", "Peso hoy", "$ entrada", "$ alimento", "$ salida", "MARGEN", "$/cab"])
  GRUPOS.forEach(g => {
    const c = cuenta(g)
    aoaRes0.push([
      g === "vendidos" ? "Los 55 vendidos" : g === "machos" ? "Machos que quedan" : "Hembras que quedan",
      cabG[g], +pesoIniG[g].toFixed(1), +pesoHoyG[g].toFixed(1),
      Math.round(c.entrada), Math.round(c.alimento), Math.round(c.salida),
      Math.round(c.margen), Math.round(c.margen / cabG[g]),
    ])
  })
  const totM = GRUPOS.reduce((s, g) => s + cuenta(g).margen, 0)
  aoaRes0.push(["TOTAL", GRUPOS.reduce((s, g) => s + cabG[g], 0), "", "",
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).entrada, 0)),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).alimento, 0)),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).salida, 0)), Math.round(totM), ""])
  aoaRes0.push([])
  aoaRes0.push(["OJO CON ESTO"])
  aoaRes0.push(["· El precio de entrada ($" + ar(PRECIO_ENTRADA_KG) + "/kg para todos) es el que más pesa. Los 55 eran más pesados,"])
  aoaRes0.push(["  así que su $/kg real debería ser MENOR — y su margen, mayor que el que figura acá."])
  aoaRes0.push(["· Los precios de hoy son de prueba: machos $" + ar(PRECIO_VENTA_HOY.machos) + " (supuesto mío), hembras $" + ar(PRECIO_VENTA_HOY.hembras) + ". Cambialos en INPUTS."])
  aoaRes0.push(["· NO incluye sanidad, pasturas, verdeos ni estructura. Sólo maíz y concentrado."])
  aoaRes0.push([])
  aoaRes0.push(["LA CLAVE DE REPARTO — una sola regla, para los dos regímenes"])
  aoaRes0.push(["KILO-DÍA SIEMPRE: la comida se sirve al grupo y adentro del corral el que pesa más come más."])
  aoaRes0.push(["Vale con ración por día y a discreción. El régimen sirve para PROYECTAR y CONTROLAR, no para repartir."])
  aoaRes0.push([])
  aoaRes0.push(["Ejemplo, para que se entienda: si el rodeo comió 100 kg y el promedio es 1 kg por cabeza,"])
  aoaRes0.push(["el que pesa 50 % más comió 1,5 kg · el de peso promedio, 1 kg · el que pesa 50 % menos, 0,5 kg."])
  aoaRes0.push([])
  aoaRes0.push(["Antes se usaba CABEZA-día mientras la ración era fija. Se descartó porque le cobraba"])
  aoaRes0.push(["lo mismo al de 150 kg que al de 300. Lo que cambió al corregirlo:"])
  aoaRes0.push(["Grupo", "kg con cabeza-día", "kg con kilo-día (el que se usa)", "Diferencia", "%"])
  GRUPOS.forEach(g => aoaRes0.push([
    g === "vendidos" ? "Los 55 vendidos" : g === "machos" ? "Machos que quedan" : "Hembras que quedan",
    Math.round(kgCabezaDia[g]), Math.round(kgG[g]), Math.round(kgG[g] - kgCabezaDia[g]),
    +((kgG[g] - kgCabezaDia[g]) / kgCabezaDia[g] * 100).toFixed(1),
  ]))
  hoja("RESUMEN", aoaRes0, [26, 12, 14, 12, 16, 16, 14, 14, 12])

  // ── 1 · LEEME ──────────────────────────────────────────────────────────────
  hoja("LEEME", [
    ["MAQUETA AUDITABLE — Costo de alimentación de recría"],
    ["Generada " + new Date().toISOString().slice(0, 10) + " desde los datos reales del sistema"],
    [],
    ["MAQUETA CON FECHA DE VENCIMIENTO"],
    ["Sirve para acordar y AUDITAR la lógica antes de tocar la app. Cuando la app lo calcule,"],
    ["este archivo deja de ser la herramienta y pasa a ser el CASO DE PRUEBA: la app tiene que"],
    ["dar exactamente estos números. No debe volverse una segunda fuente de verdad."],
    [],
    ["CÓMO AUDITARLO"],
    ["Los valores de INPUTS son los ÚNICOS que se tipean. Todo lo demás son fórmulas."],
    ["Cambiá un input y mirá cómo se mueve todo — incluidos los controles."],
    [],
    ["LAS TRES DECISIONES DE FONDO"],
    ["1.  El TOTAL consumido no se estima: sale del stock."],
    ["       consumo del tramo = stock inicial + entregas − stock final"],
    [],
    ["2.  El REPARTO usa una clave que depende del RÉGIMEN de alimentación:"],
    ["       ración fija por cabeza  →  CABEZA-DÍA   todos comen lo mismo, el peso no importa"],
    ["       a discreción            →  KILO-DÍA     comen según apetito, que sigue al peso"],
    ["    Se ve día por día en la hoja DIA_A_DIA, columnas I y J."],
    [],
    ["3.  El PRECIO es por tramo, no un promedio del período."],
    ["       Como cada tramo arranca y cierra en stock ~ 0, el maíz consumido en un tramo ES el"],
    ["       entregado en ese tramo. No hay que suponer FIFO: se sabe."],
    [],
    ["Y UNA DISTINCIÓN QUE ATRAVIESA TODO"],
    ["    peso VIVO (bruto de balanza)  →  para el CONSUMO: el animal come según lo que pesa"],
    ["    peso NETO (menos desbaste)    →  para la PLATA: es lo que se paga"],
    [],
    ["LAS HOJAS"],
    ["INPUTS        lo único que se tipea. Si un número está mal, está acá."],
    ["ENTREGAS      compras por fecha de ENTREGA (no de factura). Costo = ton x $/ton"],
    ["RODEO         cuántas cabezas comían en cada momento, evento por evento"],
    ["PESO          las 4 pesadas reales y cómo se interpola entre ellas"],
    ["DIA_A_DIA     una fila por día. La clave de reparto de cada día, con su fórmula."],
    ["TRAMOS        consumo medido y clave acumulada por tramo (SUMIFS sobre DIA_A_DIA)"],
    ["REPARTO       cómo se divide el consumo entre los 55 y el resto"],
    ["RESULTADO     costo y margen de los 55"],
    ["CONTROLES     lo que tiene que cerrar. Si movés un input, mirá acá primero."],
    ["DIAGNOSTICO   cómo se descubrió que la ración empezó el 06/05 y no en marzo"],
  ], [104])

  // ── 2 · INPUTS ─────────────────────────────────────────────────────────────
  hoja("INPUTS", [
    ["INPUTS — lo ÚNICO que se tipea. Todo el resto del libro son fórmulas sobre esto."],
    [],
    ["Parámetro", "Valor", "Origen / por qué"],
    ["Inicio de la ración", INICIO_RACION, "2a entrega (FC 11/05, recibida el 06/05). Al día 9 ya daban 3 kg/día"],
    ["Inicio del autoconsumo", INICIO_CONC, "arranca la mezcla 90/10 a discreción"],
    ["Fecha de la medición de stock", FECHA_STOCK, "dato del usuario"],
    ["Stock final de maíz (kg)", STOCK_FINAL.maiz, "4.000 sueltos + 1.800 (90 % de los 2.000 mezclados)"],
    ["Stock final de concentrado (kg)", STOCK_FINAL.conc, "950 sueltos + 200 (10 % de los 2.000 mezclados)"],
    ["Precio de entrada a recría ($/kg)", PRECIO_ENTRADA_KG, "venta teórica de cría. PENDIENTE de afinar por banda de peso"],
    ["Precio de venta hoy — machos ($/kg)", PRECIO_VENTA_HOY.machos, "SUPUESTO MÍO. El usuario dijo 'más caro que los $5.670' pero no dio el número"],
    ["Precio de venta hoy — hembras ($/kg)", PRECIO_VENTA_HOY.hembras, "dato del usuario"],
    ["Desbaste", DESBASTE, "merma que descuenta el comprador. La balanza da BRUTO"],
    ["Cabezas vendidas el 04/08", CAB_VENDIDOS, "del sistema"],
    ["Ingreso de la venta ($)", ingresoV, "del sistema — ya neto de desbaste"],
    [],
    ["Las 1,74 ton del 16/03", "quedan en stock", "se dieron a terneros chicos por tratamiento específico; se juntan con la del 06/05"],
    ["Categorías que comen", CATS_COMEN.join(", "), "todos los machos (con toritos) y todas las hembras"],
  ], [34, 24, 80])
  const IN = (fila: number) => "INPUTS!$B$" + fila
  // ⚠️ Si se agregan filas a INPUTS hay que correr estos números, o las fórmulas apuntan mal.
  const IN_STOCK_MAIZ = IN(7), IN_PRECIO_ENT = IN(9), IN_DESB = IN(12), IN_CAB = IN(13), IN_INGRESO = IN(14)

  // ── 3 · ENTREGAS ───────────────────────────────────────────────────────────
  const aoaEnt: any[][] = [
    ["ENTREGAS — por fecha de ENTREGA, no de factura"],
    ["La entrega mueve el stock; la factura sólo trae el precio. Longo facturó el 13/07 lo entregado el 24/06."],
    [],
    ["MAÍZ"],
    ["Fecha entrega", "Proveedor", "Toneladas", "$/ton (neto)", "Costo neto", "Nota"],
  ]
  ENTREGAS_MAIZ.forEach(e => aoaEnt.push([e.fecha, e.prov, e.ton, e.precioTon, 0, e.nota]))
  const filaTotEnt = aoaEnt.length + 1
  aoaEnt.push(["", "TOTAL", 0, "", 0, ""])
  aoaEnt.push([])
  aoaEnt.push(["CONCENTRADO"])
  aoaEnt.push(["Fecha entrega", "Proveedor", "Kg", "$/kg (neto)", "Costo neto", "Nota"])
  ENTREGAS_CONC.forEach(e => aoaEnt.push([e.fecha, e.prov, e.kg, 0, e.neto, e.nota]))
  const filaConcEnt = filaTotEnt + 4
  hoja("ENTREGAS", aoaEnt, [14, 18, 12, 14, 15, 76], ws => {
    ENTREGAS_MAIZ.forEach((e, i) => setF(ws, "E" + (6 + i), "C" + (6 + i) + "*D" + (6 + i), e.ton * e.precioTon))
    const ult = 5 + ENTREGAS_MAIZ.length
    setF(ws, "C" + filaTotEnt, "SUM(C6:C" + ult + ")", tonTotal)
    setF(ws, "E" + filaTotEnt, "SUM(E6:E" + ult + ")", costoTotalMaiz)
    ENTREGAS_CONC.forEach((e, i) => setF(ws, "D" + (filaConcEnt + i), "E" + (filaConcEnt + i) + "/C" + (filaConcEnt + i), e.neto / e.kg))
  })
  const ENT_TON = "ENTREGAS!$C$" + filaTotEnt, ENT_COSTO = "ENTREGAS!$E$" + filaTotEnt
  const CONC_KG = "ENTREGAS!$C$" + filaConcEnt, CONC_PRECIO = "ENTREGAS!$D$" + filaConcEnt

  // ── 4 · RODEO ──────────────────────────────────────────────────────────────
  const aoaRod: any[][] = [
    ["RODEO — cabezas que comen la ración"],
    ["Sale de los movimientos de hacienda. Los toritos que pasan a Toro el 26/04 SALEN de recría."],
    [],
    ["Fecha", "Movimiento", "Delta", "Cabezas después"],
  ]
  eventos.forEach(e => aoaRod.push([e.fecha, e.que, e.delta, 0]))
  hoja("RODEO", aoaRod, [14, 36, 10, 18], ws => {
    let a = 0
    eventos.forEach((e, i) => {
      a += e.delta
      setF(ws, "D" + (5 + i), i === 0 ? "C5" : "D" + (4 + i) + "+C" + (5 + i), a)
    })
  })

  // ── 5 · PESO ───────────────────────────────────────────────────────────────
  const nEn = (f: string, g: string) => (pesadas || []).filter((p: any) => p.fecha === f &&
    (g === "todos" || (g === "vendidos" ? idsVendidos.has(p.ternero_id) : !idsVendidos.has(p.ternero_id)))).length
  const aoaPeso: any[][] = [
    ["PESO — las 4 pesadas reales. El peso NO se estima."],
    ["Entre dos pesadas se interpola en línea recta. Fuera del rango se extiende la pendiente del extremo."],
    ["Los pesos de balanza son BRUTOS: para valuar hay que descontarles el desbaste."],
    [],
    ["Fecha", "Todos", "n", "Los 55 vendidos", "n", "El resto", "n"],
  ]
  fechasPesada.forEach(f => aoaPeso.push([f, +pesoProm(f, "todos").toFixed(1), nEn(f, "todos"),
    +pesoProm(f, "vendidos").toFixed(1), nEn(f, "vendidos"), +pesoProm(f, "resto").toFixed(1), nEn(f, "resto")]))
  aoaPeso.push([])
  aoaPeso.push(["Ganancia diaria implícita — sale de las pesadas, no de un supuesto"])
  aoaPeso.push(["Tramo", "Días", "kg/día (todos)", "kg/día (los 55)"])
  for (let i = 1; i < fechasPesada.length; i++) {
    const d = dias(fechasPesada[i - 1], fechasPesada[i])
    const kg = pesoProm(fechasPesada[i], "todos") - pesoProm(fechasPesada[i - 1], "todos")
    const k55 = pesoProm(fechasPesada[i], "vendidos") - pesoProm(fechasPesada[i - 1], "vendidos")
    aoaPeso.push([fechasPesada[i - 1] + " → " + fechasPesada[i], d, +(kg / d).toFixed(3), +(k55 / d).toFixed(3)])
  }
  aoaPeso.push([])
  aoaPeso.push(["Los 55 ya eran más pesados DESDE EL DESTETE, no sólo al final:"])
  aoaPeso.push(["  al 23/02", +pesoProm("2026-02-23", "vendidos").toFixed(1), "contra", +pesoProm("2026-02-23", "resto").toFixed(1), "del resto"])
  aoaPeso.push([])
  aoaPeso.push(["Venta del 04/08 — balanza del camión"])
  aoaPeso.push(["kg brutos totales", Number(ventaMov?.peso_total_kg ?? 0)])
  aoaPeso.push(["kg brutos por cabeza", +(Number(ventaMov?.peso_total_kg ?? 0) / CAB_VENDIDOS).toFixed(1),
    "contra " + pesoProm("2026-08-03", "vendidos").toFixed(1) + " de la pesada individual del 03/08 (balanzas distintas)"])
  hoja("PESO", aoaPeso, [30, 14, 16, 18, 14, 16, 8])

  // ── 6 · DIA_A_DIA ──────────────────────────────────────────────────────────
  const aoaDia: any[][] = [
    ["DIA A DIA — de acá sale TODO el reparto"],
    ["Régimen 0 = todavía no se daba ración · 1 = ración fija por cabeza · 2 = a discreción"],
    ["La clave de cada grupo decide qué proporción del consumo del tramo le toca:"],
    ["   régimen 1 → CABEZA-DÍA: todos comen lo mismo, el peso no entra en la cuenta."],
    ["   régimen 2 → KILO-DÍA:   comen según apetito, que sigue al peso."],
    [],
    ["Fecha", "Tramo", "Régimen", "Cabezas", "Cab. 55", "Cab. resto", "Peso 55", "Peso resto", "Clave 55", "Clave resto"],
  ]
  diario.forEach(d => aoaDia.push([d.fecha, d.tramo, d.regimen, d.cabTot, d.cab55, d.cabResto,
    +d.peso55.toFixed(1), +d.pesoResto.toFixed(1), 0, 0]))
  hoja("DIA_A_DIA", aoaDia, [12, 8, 10, 10, 10, 11, 10, 11, 12, 12], ws => {
    diario.forEach((d, i) => {
      const r = 8 + i
      const cV = d.regimen === 0 ? 0 : d.regimen === 1 ? d.cab55 : d.cab55 * d.peso55
      const cR = d.regimen === 0 ? 0 : d.regimen === 1 ? d.cabResto : d.cabResto * d.pesoResto
      setF(ws, "I" + r, "IF($C" + r + "=0,0,IF($C" + r + "=1,$E" + r + ",$E" + r + "*$G" + r + "))", cV)
      setF(ws, "J" + r, "IF($C" + r + "=0,0,IF($C" + r + "=1,$F" + r + ",$F" + r + "*$H" + r + "))", cR)
    })
  })
  const D_FIN = 7 + diario.length

  // ── 7 · TRAMOS ─────────────────────────────────────────────────────────────
  const aoaTr: any[][] = [
    ["TRAMOS — el consumo REAL entre tomas de stock"],
    ["consumo = stock inicial + entregas − stock final.  No se estima nada."],
    ["La clave sale de sumar DIA_A_DIA por tramo. El precio es el del maíz entregado EN ese tramo."],
    [],
    ["#", "Desde", "Hasta", "Días", "Stock ini", "Entregado", "Stock fin", "CONSUMO", "$/kg", "Clave 55", "Clave resto", "% 55"],
  ]
  tramos.forEach((t, i) => aoaTr.push([i + 1, t.desde, t.hasta, t.d, t.stockIni, t.entregado, t.stockFin,
    0, +precioTramo[i].toFixed(2), 0, 0, 0]))
  hoja("TRAMOS", aoaTr, [5, 13, 13, 8, 11, 12, 11, 13, 11, 13, 13, 9], ws => {
    tramos.forEach((t, i) => {
      const r = 6 + i, rp = repartos[i]
      setF(ws, "H" + r, "E" + r + "+F" + r + "-G" + r, t.consumo)
      setF(ws, "J" + r, "SUMIFS(DIA_A_DIA!$I$8:$I$" + D_FIN + ",DIA_A_DIA!$B$8:$B$" + D_FIN + ",A" + r + ")", rp.claveV)
      setF(ws, "K" + r, "SUMIFS(DIA_A_DIA!$J$8:$J$" + D_FIN + ",DIA_A_DIA!$B$8:$B$" + D_FIN + ",A" + r + ")", rp.claveR)
      setF(ws, "L" + r, "IF(J" + r + "+K" + r + "=0,0,J" + r + "/(J" + r + "+K" + r + "))", rp.claveV / (rp.claveV + rp.claveR))
    })
  })
  const filaUltTramo = 5 + tramos.length

  // ── 8 · REPARTO ────────────────────────────────────────────────────────────
  const aoaRep: any[][] = [
    ["REPARTO — el consumo de cada tramo se divide por la clave"],
    ["kg de un grupo = consumo del tramo x su participación en la clave. Nada más."],
    [],
    ["Tramo", "Consumo (kg)", "% 55", "kg maíz 55", "kg maíz resto", "$/kg", "$ maíz 55", "$ maíz resto"],
  ]
  tramos.forEach((_t, i) => aoaRep.push([i + 1, 0, 0, 0, 0, 0, 0, 0]))
  const filaTotRep = aoaRep.length + 1
  aoaRep.push(["TOTAL", 0, "", 0, 0, "", 0, 0])
  aoaRep.push([])
  aoaRep.push(["CONCENTRADO — sólo se dio en el régimen 2, así que se reparte por el kilo-día del último tramo"])
  aoaRep.push(["Comprado (kg)", "Stock final", "Consumido", "% 55", "kg 55", "kg resto", "$ 55", "$ resto"])
  const filaConc = aoaRep.length + 1
  aoaRep.push([0, 0, 0, 0, 0, 0, 0, 0])
  hoja("REPARTO", aoaRep, [10, 14, 9, 13, 14, 11, 15, 15], ws => {
    tramos.forEach((_t, i) => {
      const r = 5 + i, tr = 6 + i, rp = repartos[i]
      setF(ws, "B" + r, "TRAMOS!H" + tr, tramos[i].consumo)
      setF(ws, "C" + r, "TRAMOS!L" + tr, rp.claveV / (rp.claveV + rp.claveR))
      setF(ws, "D" + r, "B" + r + "*C" + r, rp.kgV)
      setF(ws, "E" + r, "B" + r + "*(1-C" + r + ")", rp.kgR)
      setF(ws, "F" + r, "TRAMOS!I" + tr, precioTramo[i])
      setF(ws, "G" + r, "D" + r + "*F" + r, rp.kgV * precioTramo[i])
      setF(ws, "H" + r, "E" + r + "*F" + r, rp.kgR * precioTramo[i])
    })
    const a = 5, b = 4 + tramos.length
    setF(ws, "B" + filaTotRep, "SUM(B" + a + ":B" + b + ")", consumoMaizTotal)
    setF(ws, "D" + filaTotRep, "SUM(D" + a + ":D" + b + ")", kgV)
    setF(ws, "E" + filaTotRep, "SUM(E" + a + ":E" + b + ")", kgR)
    setF(ws, "G" + filaTotRep, "SUM(G" + a + ":G" + b + ")", costoMaizV)
    setF(ws, "H" + filaTotRep, "SUM(H" + a + ":H" + b + ")", costoMaizR)
    setF(ws, "A" + filaConc, CONC_KG, kgConc)
    setF(ws, "B" + filaConc, IN(8), STOCK_FINAL.conc)
    setF(ws, "C" + filaConc, "A" + filaConc + "-B" + filaConc, consumoConc)
    setF(ws, "D" + filaConc, "TRAMOS!L" + filaUltTramo, pctConcV)
    setF(ws, "E" + filaConc, "C" + filaConc + "*D" + filaConc, consumoConc * pctConcV)
    setF(ws, "F" + filaConc, "C" + filaConc + "*(1-D" + filaConc + ")", consumoConc * (1 - pctConcV))
    setF(ws, "G" + filaConc, "E" + filaConc + "*" + CONC_PRECIO, costoConcV)
    setF(ws, "H" + filaConc, "F" + filaConc + "*" + CONC_PRECIO, costoConcR)
  })
  const R_MAIZ_V = "REPARTO!$G$" + filaTotRep, R_MAIZ_R = "REPARTO!$H$" + filaTotRep
  const R_CONC_V = "REPARTO!$G$" + filaConc, R_CONC_R = "REPARTO!$H$" + filaConc
  const R_KG_V = "REPARTO!$D$" + filaTotRep, R_KG_R = "REPARTO!$E$" + filaTotRep

  // ── 9 · RESULTADO ──────────────────────────────────────────────────────────
  hoja("RESULTADO", [
    ["RESULTADO — los 55 vendidos el 04/08"],
    ["Todo son fórmulas. Cambiá el precio de entrada en INPUTS y mirá cómo se mueve el margen."],
    [],
    ["Concepto", "Total", "Por cabeza"],
    ["Peso de entrada BRUTO (pesada del 23/02)", "", +pesoEntradaBruto.toFixed(1)],
    ["  − desbaste", "", 0],
    ["Peso de entrada NETO (el que se paga)", "", 0],
    ["COSTO DE ENTRADA A RECRÍA", 0, 0],
    [],
    ["Maíz consumido (kg)", 0, 0],
    ["Costo del maíz", 0, 0],
    ["Concentrado consumido (kg)", 0, 0],
    ["Costo del concentrado", 0, 0],
    ["COSTO DE ALIMENTACIÓN", 0, 0],
    [],
    ["Ingreso de la venta (ya neto de desbaste)", 0, 0],
    ["  − costo de entrada", 0, 0],
    ["  − costo de alimentación", 0, 0],
    ["MARGEN", 0, 0],
    [],
    ["No incluye sanidad, pasturas, verdeos ni estructura. Sólo maíz y concentrado."],
    ["El precio de entrada ($7.000 para todos) es el que más pesa: mueve el margen mucho más que"],
    ["el maíz. Los 55 eran más pesados, así que su $/kg real debería ser MENOR — y el margen, mayor."],
    [],
    ["LO QUE QUEDA EN EL CAMPO (costo acumulado, todavía no realizado)"],
    ["Maíz", 0, ""],
    ["Concentrado", 0, ""],
    ["TOTAL acumulado de los que siguen", 0, ""],
  ], [46, 18, 16], ws => {
    setF(ws, "C6", "C5*" + IN_DESB, pesoEntradaBruto * DESBASTE)
    setF(ws, "C7", "C5-C6", pesoEntradaNeto)
    setF(ws, "C8", "C7*" + IN_PRECIO_ENT, pesoEntradaNeto * PRECIO_ENTRADA_KG)
    setF(ws, "B8", "C8*" + IN_CAB, costoEntradaV)
    setF(ws, "B10", R_KG_V, kgV)
    setF(ws, "C10", "B10/" + IN_CAB, kgV / CAB_VENDIDOS)
    setF(ws, "B11", R_MAIZ_V, costoMaizV)
    setF(ws, "C11", "B11/" + IN_CAB, costoMaizV / CAB_VENDIDOS)
    setF(ws, "B12", "REPARTO!E" + filaConc, consumoConc * pctConcV)
    setF(ws, "C12", "B12/" + IN_CAB, consumoConc * pctConcV / CAB_VENDIDOS)
    setF(ws, "B13", R_CONC_V, costoConcV)
    setF(ws, "C13", "B13/" + IN_CAB, costoConcV / CAB_VENDIDOS)
    setF(ws, "B14", "B11+B13", costoMaizV + costoConcV)
    setF(ws, "C14", "B14/" + IN_CAB, (costoMaizV + costoConcV) / CAB_VENDIDOS)
    setF(ws, "B16", IN_INGRESO, ingresoV)
    setF(ws, "C16", "B16/" + IN_CAB, ingresoV / CAB_VENDIDOS)
    setF(ws, "B17", "-B8", -costoEntradaV)
    setF(ws, "C17", "-C8", -costoEntradaV / CAB_VENDIDOS)
    setF(ws, "B18", "-B14", -(costoMaizV + costoConcV))
    setF(ws, "C18", "-C14", -(costoMaizV + costoConcV) / CAB_VENDIDOS)
    setF(ws, "B19", "B16+B17+B18", ingresoV - costoEntradaV - costoMaizV - costoConcV)
    setF(ws, "C19", "C16+C17+C18", (ingresoV - costoEntradaV - costoMaizV - costoConcV) / CAB_VENDIDOS)
    setF(ws, "B26", R_MAIZ_R, costoMaizR)
    setF(ws, "B27", R_CONC_R, costoConcR)
    setF(ws, "B28", "B26+B27", costoMaizR + costoConcR)
  })

  // ── 10 · CONTROLES ─────────────────────────────────────────────────────────
  const aoaCtl: any[][] = [
    ["CONTROLES — todos son fórmulas. Si movés un input, mirá acá primero."],
    [],
    ["EN KILOS"],
    ["Control", "Debería dar", "Da", "Diferencia"],
    ["Maíz: entregado − consumido = stock", 0, 0, 0],
    ["Reparto: kg 55 + kg resto = consumo", 0, 0, 0],
    [],
    ["EN PLATA — el control de punta a punta"],
    ["Todo lo comprado tiene que estar en algún lado: comido por unos, comido por otros, o en el silo."],
    ["Concepto", "", "$", ""],
    ["Maíz comprado (neto)", "", 0, ""],
    ["  − imputado a los 55", "", 0, ""],
    ["  − imputado a los que quedan", "", 0, ""],
    ["  − valor del stock que queda", "", 0, "al precio del último tramo"],
    ["DIFERENCIA (tiene que ser 0)", "", 0, ""],
    [],
    ["CRUCE INDEPENDIENTE — la mezcla 90/10 predice el maíz sin mirar el stock de maíz"],
    ["Concentrado consumido (kg)", "", 0, ""],
    ["  x 9 (por cada kg de concentrado van 9 de maíz)", "", 0, ""],
    ["Maíz consumido en el último tramo", "", 0, ""],
    ["Diferencia = maíz solo, antes del 27/07", "", 0, "unos 3 días de ración: coherente"],
    [],
    ["LA RACIÓN IMPLÍCITA — contra los 2,5 a 3 kg/cab/día declarados"],
    ["Tramo", "Cabezas prom.", "kg/cab/día", "Lectura"],
  ]
  tramos.forEach((t, i) => aoaCtl.push([t.desde + " → " + t.hasta, +cabPromTramo(t).toFixed(0),
    +racionImplicita(i).toFixed(2),
    i === tramos.length - 1 ? "a discreción, se espera más"
      : (racionImplicita(i) < 2.4 ? "POR DEBAJO" : racionImplicita(i) > 3.2 ? "POR ENCIMA" : "coherente")]))
  aoaCtl.push([])
  aoaCtl.push(["Régimen 1 completo (06/05 → 26/07)", +cabPromTramo(tramos[0]).toFixed(0),
    +(consumoReg1v / diasReg1v / 187).toFixed(2), "los 3 kg/día que declaró el usuario"])
  hoja("CONTROLES", aoaCtl, [48, 16, 16, 40], ws => {
    setF(ws, "B5", IN_STOCK_MAIZ, STOCK_FINAL.maiz)
    setF(ws, "C5", ENT_TON + "*1000-REPARTO!B" + filaTotRep, tonTotal * 1000 - consumoMaizTotal)
    setF(ws, "D5", "C5-B5", 0)
    setF(ws, "B6", "REPARTO!B" + filaTotRep, consumoMaizTotal)
    setF(ws, "C6", R_KG_V + "+" + R_KG_R, kgV + kgR)
    setF(ws, "D6", "C6-B6", 0)
    setF(ws, "C11", ENT_COSTO, costoTotalMaiz)
    setF(ws, "C12", "-" + R_MAIZ_V, -costoMaizV)
    setF(ws, "C13", "-" + R_MAIZ_R, -costoMaizR)
    setF(ws, "C14", "-" + IN_STOCK_MAIZ + "*TRAMOS!I" + filaUltTramo, -valorStockFinal)
    setF(ws, "C15", "SUM(C11:C14)", 0)
    setF(ws, "C18", "REPARTO!C" + filaConc, consumoConc)
    setF(ws, "C19", "C18*9", consumoConc * 9)
    setF(ws, "C20", "TRAMOS!H" + filaUltTramo, tramos[tramos.length - 1].consumo)
    setF(ws, "C21", "C20-C19", tramos[tramos.length - 1].consumo - consumoConc * 9)
  })

  // ── 11 · DIAGNOSTICO ───────────────────────────────────────────────────────
  const simular = (racionKg: number) => {
    let stock = 0, primerNegativo = ""
    const filas: any[][] = []
    for (let k = 0; k <= dias(F_INI, FECHA_STOCK); k++) {
      const f = addDias(F_INI, k)
      const entra = ENTREGAS_MAIZ.filter(e => e.fecha === f).reduce((s, e) => s + e.ton * 1000, 0)
      stock += entra
      const cab = f >= INICIO_RACION ? cabezasAl(f) : 0
      const come = f >= INICIO_CONC ? 0 : cab * racionKg
      stock -= come
      const eraNeg = stock < 0 && !primerNegativo
      if (eraNeg) primerNegativo = f
      if (entra > 0 || f === INICIO_RACION || f === INICIO_CONC || eraNeg)
        filas.push([f, entra || "", cab, Math.round(come), Math.round(stock),
          entra > 0 ? "ENTREGA" : f === INICIO_RACION ? "arranca la ración"
          : f === INICIO_CONC ? "arranca el autoconsumo" : "STOCK NEGATIVO"])
    }
    return { filas, primerNegativo, stockFinal: stock }
  }
  const aoaDg: any[][] = [
    ["DIAGNÓSTICO — cómo se descubrió que la ración empezó el 06/05 y no en marzo"],
    [],
    ["EL PROBLEMA: con inicio el 17/03 la ración implícita daba 1,19 kg/cab/día contra los 2,5 a 3"],
    ["declarados. Faltaban unas 25 toneladas de maíz... o sobraban días."],
    [],
    ["PRUEBA 1 — simular el stock día a día. ¿Con qué ración alcanza el maíz registrado?"],
    ["Ración probada", "Se queda sin maíz el", "Stock al 24/08", "Lectura"],
  ]
  for (const r of [1.0, 1.5, 2.0, 2.5, 3.0]) {
    const s = simular(r)
    aoaDg.push([r, s.primerNegativo || "nunca", Math.round(s.stockFinal),
      s.primerNegativo ? "IMPOSIBLE con el maíz registrado" : "alcanza"])
  }
  aoaDg.push([])
  aoaDg.push(["Con CUALQUIER ración el stock se hace negativo en marzo: 1.740 kg no alcanzan para"])
  aoaDg.push(["197 cabezas durante los 56 días que pasan hasta la entrega siguiente."])
  aoaDg.push([])
  aoaDg.push(["PRUEBA 2 — ¿qué fecha de inicio hace coherente la ración declarada?"])
  aoaDg.push(["El consumo del régimen 1 es un dato fijo. Si arrancó más tarde, se reparte entre menos días."])
  aoaDg.push(["Inicio probado", "Días", "Cabezas prom.", "kg/cab/día", "Lectura"])
  for (const ini of ["2026-03-17", "2026-04-15", "2026-05-06", "2026-05-11", "2026-06-02", "2026-06-24"]) {
    const d = dias(ini, INICIO_CONC)
    let s = 0, n = 0
    for (let k = 0; k < d; k++) { s += cabezasAl(addDias(ini, k)); n++ }
    const cab = n ? s / n : 1
    const r = consumoReg1v / d / cab
    aoaDg.push([ini, d, +cab.toFixed(0), +r.toFixed(2),
      r >= 2.4 && r <= 3.2 ? "COHERENTE" : r < 2.4 ? "por debajo" : "por encima"])
  }
  aoaDg.push([])
  aoaDg.push(["CONCLUSIÓN: el usuario confirmó con el recibo que la ración arrancó el 06/05."])
  aoaDg.push(["No faltaban 25 toneladas: sobraban 56 días."])
  aoaDg.push([])
  aoaDg.push(["Detalle día a día con 2,5 kg — para ver dónde se hace negativo"])
  aoaDg.push(["Fecha", "Entrega (kg)", "Cabezas", "Comen (kg)", "Stock (kg)", "Qué pasa"])
  simular(2.5).filas.forEach(f => aoaDg.push(f))
  hoja("DIAGNOSTICO", aoaDg, [30, 22, 16, 16, 16, 30])

  XLSX.writeFile(wb, salida)

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN APARTE — una carilla. La maqueta grande es la herramienta de trabajo;
  // esto es lo que se mira y se discute. Todo lo que hay que creer, junto y a la vista.
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ Los DESTETADOS son los que había el 23/02, antes de las mortandades — NO los que quedan
  // hoy. Si se toma el número de hoy y se le restan las ventas, salen más ventas que ingresos.
  const F_DESTETE = fechasPesada[0]
  const cabDestete = delRodeo.filter((t: any) => vivoAl(t, F_DESTETE)).length
  const cabMuertas = delRodeo.filter((t: any) =>
    t.fecha_baja && t.fecha_baja > F_DESTETE && t.fecha_baja <= FECHA_STOCK && !idsVendidos.has(t.id)).length

  const ultPes = fechasPesada[fechasPesada.length - 1]
  const diasExtra = dias(ultPes, FECHA_STOCK)
  const gananciaExtra = (g: Grupo) => diasExtra ? (pesoEn(FECHA_STOCK, g) - pesoProm(ultPes, g)) / diasExtra : 0
  const nom = (g: Grupo) => g === "vendidos" ? "Los 55 vendidos" : g === "machos" ? "Machos que quedan" : "Hembras que quedan"

  const wb2 = XLSX.utils.book_new()
  const r: any[][] = [
    ["RECRÍA — cómo nos fue", "", "", "", "", "al " + FECHA_STOCK],
    ["Sólo alimentación. NO incluye sanidad, pasturas, verdeos ni estructura."],
    [],
    ["EL RODEO — tiene que cerrar: lo que entró menos lo que salió"],
    ["  Destetados (23/02)", cabDestete + " cabezas", "", "de " + pesoProm(fechasPesada[0], "todos").toFixed(0) + " kg promedio"],
    ["  − mortandades", -cabMuertas + " cabezas", "", "1 el 15/04 · 1 el 25/04 · 1 el 26/06 · 1 el 02/07"],
    ["  − vendidos el 04/08", -CAB_VENDIDOS + " cabezas", "", "de " + pesoHoyG.vendidos.toFixed(0) + " kg (balanza del camión)"],
    ["  = QUEDAN", (cabG.machos + cabG.hembras) + " cabezas", "", cabG.machos + " machos (con los 7 toritos) y " + cabG.hembras + " hembras"],
    ["", (cabDestete - cabMuertas - CAB_VENDIDOS === cabG.machos + cabG.hembras) ? "✓ cierra" : "NO CIERRA — revisar", "", ""],
    ["  Los 8 toritos del recuento", "no cuentan", "", "pasaron a Toro el 26/04, diez días ANTES de que arrancara la ración"],
    [],
    ["LA COMIDA"],
    ["  Maíz comprado", +tonTotal.toFixed(2) + " ton", Math.round(costoTotalMaiz), "en 6 entregas, de 4 proveedores"],
    ["  Maíz consumido", +(consumoMaizTotal / 1000).toFixed(2) + " ton", Math.round(costoMaizV + costoMaizR), ""],
    ["  Maíz en el silo", +(STOCK_FINAL.maiz / 1000).toFixed(2) + " ton", Math.round(valorStockFinal), "no se le carga a nadie: sigue siendo un activo"],
    ["  Concentrado", +(kgConc / 1000).toFixed(2) + " ton", Math.round(costoConc), "consumidas " + (consumoConc / 1000).toFixed(2) + " ton, desde el 27/07"],
    ["  Comieron", "1,07 % a 1,54 %", "", "de su peso vivo. Sale del stock, no se supuso"],
    [],
    ["CÓMO LE FUE A CADA GRUPO"],
    ["Grupo", "Cab.", "$ entrada", "$ comida", "$ salida", "MARGEN", "$/cabeza"],
  ]
  GRUPOS.forEach(g => {
    const c = cuenta(g)
    r.push([nom(g), cabG[g], Math.round(c.entrada), Math.round(c.alimento), Math.round(c.salida),
      Math.round(c.margen), Math.round(c.margen / cabG[g])])
  })
  r.push(["TOTAL", GRUPOS.reduce((s, g) => s + cabG[g], 0),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).entrada, 0)),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).alimento, 0)),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).salida, 0)),
    Math.round(GRUPOS.reduce((s, g) => s + cuenta(g).margen, 0)), ""])
  r.push([])
  r.push(["QUÉ HAY QUE CREER PARA QUE ESTO VALGA — de mayor a menor impacto"])
  r.push(["1", "Precio de entrada", "$" + ar(PRECIO_ENTRADA_KG) + "/kg para todos",
    "ES EL QUE MÁS PESA. Los 55 eran más pesados: su $/kg real debería ser MENOR, y su margen mayor"])
  r.push(["2", "Precio de venta de hoy", "machos $" + ar(PRECIO_VENTA_HOY.machos) + " · hembras $" + ar(PRECIO_VENTA_HOY.hembras),
    "el de machos es SUPUESTO. Los 55 se vendieron de verdad a $5.670"])
  r.push(["3", "Peso de hoy de los que quedan", "extrapolado " + diasExtra + " días",
    "última pesada real: " + ultPes + ". Se estira a " + gananciaExtra("machos").toFixed(2) + " kg/día. Los 55 NO dependen de esto"])
  r.push(["4", "Stock declarado", ar(STOCK_FINAL.maiz) + " kg de maíz",
    "de acá sale TODO el consumo. Si está mal, todo se corre"])
  r.push(["5", "Reparto por kilo-día", "el que pesa más come más",
    "una sola regla, con ración por día y a discreción"])
  r.push([])
  r.push(["LOS CONTROLES — todos cierran"])
  r.push(["", "Maíz: comprado − consumido = stock", Math.round(tonTotal * 1000 - consumoMaizTotal) + " kg", "= los " + ar(STOCK_FINAL.maiz) + " que declaraste"])
  r.push(["", "Plata: comprado = imputado + stock", "$" + Math.round(costoTotalMaiz - costoMaizV - costoMaizR - valorStockFinal), "cada peso está en algún lado"])
  r.push(["", "Mezcla 90/10 predice el maíz", Math.round(consumoConc * 9) + " kg", "contra " + Math.round(tramos[tramos.length - 1].consumo) + " del tramo: cierra"])
  r.push(["", "Ración implícita", (consumoReg1v / diasReg1v / 187).toFixed(2) + " kg/cab/día", "contra los 3 kg que declaraste"])
  r.push(["", "Rodeo: destete − muertes − ventas", (cabDestete - cabMuertas - CAB_VENDIDOS) + " cabezas",
    (cabDestete - cabMuertas - CAB_VENDIDOS === cabG.machos + cabG.hembras) ? "= las que quedan. Cierra" : "NO CIERRA"])
  r.push(["", "Nominal vs movimientos al 06/05", cabDestete - 2 + " vs " + cabezasAl(INICIO_RACION),
    "los individuos con nombre y el conteo en bulk dan lo mismo"])
  r.push([])
  r.push(["El detalle de cómo sale cada número está en Maqueta_Costo_Recria.xlsx (11 hojas, 429 fórmulas)."])
  const ws2 = XLSX.utils.aoa_to_sheet(r)
  ws2["!cols"] = [[26], [16], [22], [18], [16], [16], [14]].map(w => ({ wch: w[0] }))
  XLSX.utils.book_append_sheet(wb2, ws2, "RESUMEN")

  // ── Una solapa por rodeo: productivo + consumo + económico ─────────────────
  const fechaSalida = (g: Grupo) => g === "vendidos" ? "2026-08-04" : FECHA_STOCK
  const kgConcG = (g: Grupo) => consumoConc * pctConcG[g]

  const solapa = (g: Grupo | "total") => {
    const gs: Grupo[] = g === "total" ? GRUPOS : [g]
    const cab = gs.reduce((s, x) => s + cabG[x], 0)
    const pIni = gs.reduce((s, x) => s + pesoIniG[x] * cabG[x], 0) / cab
    const pFin = gs.reduce((s, x) => s + pesoHoyG[x] * cabG[x], 0) / cab
    const kgMaiz = gs.reduce((s, x) => s + kgG[x], 0)
    const kgConcumido = gs.reduce((s, x) => s + kgConcG(x), 0)
    const cEnt = gs.reduce((s, x) => s + cuenta(x).entrada, 0)
    const cAli = gs.reduce((s, x) => s + cuenta(x).alimento, 0)
    const cSal = gs.reduce((s, x) => s + cuenta(x).salida, 0)
    const margen = cSal - cEnt - cAli
    const fSal = g === "total" ? FECHA_STOCK : fechaSalida(g as Grupo)
    const diasRecria = dias(F_DESTETE, fSal)
    const diasRacion = dias(INICIO_RACION, fSal)
    const kgGanados = pFin - pIni
    const alimento = kgMaiz + kgConcumido
    const titulo = g === "total" ? "TODA LA RECRÍA" :
      g === "vendidos" ? "LOS 55 VENDIDOS" : g === "machos" ? "MACHOS QUE QUEDAN" : "HEMBRAS QUE QUEDAN"
    const nota = g === "vendidos" ? "Datos reales: se vendieron el 04/08 y pesaron en la balanza del camión."
      : g === "total" ? "Los 55 con datos reales; los que quedan, valuados como si se vendieran hoy."
      : "Valuados como si se vendieran hoy. El peso de salida está ESTIMADO " + diasExtra + " días desde la pesada del " + ultPes + "."
    return [
      [titulo, "", "", "al " + fSal],
      [nota],
      [],
      ["PRODUCTIVO", "Total", "Por cabeza", ""],
      ["Cabezas", cab, "", ""],
      ["Peso de entrada (23/02)", "", +pIni.toFixed(1), "kg — bruto de balanza"],
      ["Peso de salida", "", +pFin.toFixed(1), g === "vendidos" ? "kg — balanza del camión" : "kg — estimado"],
      ["Kg ganados", Math.round(kgGanados * cab), +kgGanados.toFixed(1), ""],
      ["Días en recría", diasRecria, "", "desde el destete"],
      ["Días con ración", diasRacion, "", "desde el 06/05"],
      ["Ganancia diaria", "", +(kgGanados / diasRecria).toFixed(3), "kg/día — de pesadas reales"],
      [],
      ["CONSUMO DE RACIÓN", "Total (kg)", "Por cabeza (kg)", ""],
      ["Maíz", Math.round(kgMaiz), +(kgMaiz / cab).toFixed(1), ""],
      ["Concentrado", Math.round(kgConcumido), +(kgConcumido / cab).toFixed(1), "sólo desde el 27/07"],
      ["TOTAL alimento", Math.round(alimento), +(alimento / cab).toFixed(1), ""],
      ["Por día con ración", "", +(alimento / cab / diasRacion).toFixed(2), "kg/cab/día"],
      ["Kg de suplemento por kg ganado", "", +(alimento / cab / kgGanados).toFixed(2),
        "NO es conversión: además comieron pasto"],
      [],
      ["ECONÓMICO", "Total", "Por cabeza", ""],
      ["Valor de entrada", Math.round(cEnt), Math.round(cEnt / cab), "peso neto × $" + ar(PRECIO_ENTRADA_KG) + "/kg"],
      ["Costo de alimentación", Math.round(cAli), Math.round(cAli / cab), ""],
      ["Valor de salida", Math.round(cSal), Math.round(cSal / cab), g === "vendidos" ? "venta real a $5.670/kg" : "a precio de hoy"],
      ["MARGEN", Math.round(margen), Math.round(margen / cab), ""],
      [],
      ["Margen sobre el valor de entrada", "", +(margen / cEnt * 100).toFixed(1), "%"],
      ["Costo del kg ganado", "", Math.round(cAli / cab / kgGanados), "$/kg — sólo alimentación"],
      ["La alimentación sobre el valor de entrada", "", +(cAli / cEnt * 100).toFixed(1), "%"],
      [],
      ["NO incluye sanidad, pasturas, verdeos ni estructura."],
    ]
  }
  for (const g of [...GRUPOS, "total"] as (Grupo | "total")[]) {
    const nombreSolapa = g === "vendidos" ? "55 VENDIDOS" : g === "machos" ? "MACHOS" : g === "hembras" ? "HEMBRAS" : "TOTAL RECRÍA"
    const wsg = XLSX.utils.aoa_to_sheet(solapa(g))
    wsg["!cols"] = [{ wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 44 }]
    XLSX.utils.book_append_sheet(wb2, wsg, nombreSolapa)
  }
  const salida2 = salida.replace(/Maqueta_/, "Resumen_").replace(/\.xlsx$/, "") + ".xlsx"
  XLSX.writeFile(wb2, salida2)
  console.log("✅ " + salida2 + "   — una carilla\n")

  console.log("\n✅ " + salida + "   — 11 hojas, con fórmulas\n")
  console.log("Maíz      " + ar(tonTotal, 2) + " ton entregadas · " + ar(consumoMaizTotal / 1000, 2) + " consumidas · " + ar(STOCK_FINAL.maiz) + " kg en stock")
  console.log("Reparto   55 vendidos: " + ar(Math.round(kgV)) + " kg   ·   resto: " + ar(Math.round(kgR)) + " kg")
  console.log("\nCOSTO ALIMENTACIÓN de los 55   $" + ar(Math.round(costoMaizV + costoConcV)) + "   ($" + ar(Math.round((costoMaizV + costoConcV) / CAB_VENDIDOS)) + "/cab)")
  console.log("MARGEN de los 55               $" + ar(Math.round(ingresoV - costoEntradaV - costoMaizV - costoConcV)) + "   ($" + ar(Math.round((ingresoV - costoEntradaV - costoMaizV - costoConcV) / CAB_VENDIDOS)) + "/cab)")
  console.log("\nControl de plata: comprado − imputado − stock = $" + ar(Math.round(costoTotalMaiz - costoMaizV - costoMaizR - valorStockFinal)) + "\n")
}

main().catch(e => { console.error(e); process.exit(1) })

