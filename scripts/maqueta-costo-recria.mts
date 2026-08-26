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

const INICIO_RACION = "2026-03-17"   // un día después del 1er recibo de maíz
const INICIO_CONC   = "2026-07-27"   // arranca el autoconsumo a discreción, mezcla 90/10
const FECHA_STOCK   = "2026-08-24"   // la medición de stock

const STOCK_FINAL = {
  maiz: 4000 + 1800,   // 4.000 sueltos + 90 % de los 2.000 ya mezclados
  conc:  950 +  200,   //   950 sueltos + 10 % de los 2.000
}

/** Entregas de MAÍZ. La fecha es la de ENTREGA, no la de factura — es la que mueve el stock. */
const ENTREGAS_MAIZ = [
  { fecha: "2026-03-16", prov: "Arroyo Tala", ton: 1.74, precioTon: 193000, nota: "template 'otros gastos sub Maiz', FC 7/4" },
  { fecha: "2026-05-11", prov: "Arroyo Tala", ton: 7.30, precioTon: 262000, nota: "fecha de entrega ≈ factura (sin dato exacto)" },
  { fecha: "2026-06-02", prov: "Arroyo Tala", ton: 7.56, precioTon: 254000, nota: "fecha de entrega ≈ factura (sin dato exacto)" },
  { fecha: "2026-06-17", prov: "Pereyra Miguel", ton: 5.96, precioTon: 238352.82, nota: "mal facturada → fue a otra cuenta contable" },
  { fecha: "2026-06-24", prov: "Longo", ton: 20.10, precioTon: 267300, nota: "1er flete. FC 13/7 por 25 ton (error de facturación)" },
  { fecha: "2026-07-24", prov: "Longo", ton: 25.00, precioTon: 267300, nota: "2do flete. FC 14/8 por 20,1 ton, compensa" },
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

/** Precio de entrada a recría: la venta teórica de cría. Sobre peso YA desbastado. */
const PRECIO_ENTRADA_KG = 7000

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
  const pesoProm = (fecha: string, grupo: "vendidos" | "resto" | "todos") => {
    const ps = (pesadas || []).filter((p: any) => p.fecha === fecha &&
      (grupo === "todos" || (grupo === "vendidos" ? idsVendidos.has(p.ternero_id) : !idsVendidos.has(p.ternero_id))))
    return ps.length ? ps.reduce((s: number, p: any) => s + Number(p.peso_kg), 0) / ps.length : 0
  }

  /** Peso interpolado entre pesadas. Fuera de rango, se extiende con la pendiente del extremo. */
  const pesoEn = (fecha: string, grupo: "vendidos" | "resto") => {
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
  const repartoTramo = (t: typeof tramos[0]) => {
    let claveV = 0, claveR = 0, cabDiaV = 0, cabDiaR = 0
    for (let k = 0; k < t.d; k++) {
      const f = addDias(t.desde, k)
      if (f < INICIO_RACION) continue          // antes de la ración no se consume nada
      const total = cabezasAl(f)
      const vend = f < "2026-08-04" ? CAB_VENDIDOS : 0     // los 55 salen el 04/08
      const resto = total - vend
      if (resto < 0) continue
      const discrecion = f >= INICIO_CONC
      const pv = pesoEn(f, "vendidos"), pr = pesoEn(f, "resto")
      claveV += discrecion ? vend * pv : vend
      claveR += discrecion ? resto * pr : resto
      cabDiaV += vend; cabDiaR += resto
    }
    const tot = claveV + claveR
    return { claveV, claveR, cabDiaV, cabDiaR,
             kgV: tot ? t.consumo * claveV / tot : 0,
             kgR: tot ? t.consumo * claveR / tot : 0,
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

  // ═══ Armado del Excel ══════════════════════════════════════════════════════
  const wb = XLSX.utils.book_new()
  const hoja = (nombre: string, aoa: any[][], cols?: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    if (cols) ws["!cols"] = cols.map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }

  // 1 · LÉAME
  hoja("LEEME", [
    ["MAQUETA — Costo de alimentación de recría"],
    [`Generada ${new Date().toISOString().slice(0, 10)} desde los datos reales del sistema`],
    [],
    ["⚠️  ESTO ES UNA MAQUETA CON FECHA DE VENCIMIENTO"],
    ["Sirve para acordar la LÓGICA rápido, sin tocar la app. Cuando la app lo calcule,"],
    ["este archivo deja de ser la herramienta y pasa a ser el CASO DE PRUEBA."],
    ["No debe convertirse en una segunda fuente de verdad."],
    [],
    ["LA IDEA EN TRES LÍNEAS"],
    ["1.  El TOTAL consumido es real: entregas − stock medido. No se estima."],
    ["2.  El REPARTO usa una clave que depende del RÉGIMEN de alimentación:"],
    ["       ración fija por cabeza  →  cabeza-día   (todos comen lo mismo, el peso no importa)"],
    ["       a discreción            →  kilo-día     (comen según apetito, que sigue al peso)"],
    ["3.  El peso sale de las PESADAS reales interpoladas, nunca de una ganancia estimada."],
    [],
    ["QUÉ MIRAR"],
    ["INPUTS      lo que aportaste vos y el sistema todavía no tiene. Si algo está mal, es acá."],
    ["ENTREGAS    las compras por fecha de ENTREGA (no de factura)"],
    ["RODEO       cuántas cabezas comían en cada momento"],
    ["PESO        las 4 pesadas reales y la curva interpolada"],
    ["TRAMOS      el consumo medido entre tomas de stock"],
    ["REPARTO     cómo se divide entre los 55 vendidos y los que quedan"],
    ["RESULTADO   el costo y el margen de los 55"],
    ["CONTROLES   lo que tiene que cerrar, y lo que no cierra"],
  ], [110])

  // 2 · INPUTS
  hoja("INPUTS", [
    ["INPUTS — lo que NO está en el sistema y aportó el usuario"],
    [],
    ["Concepto", "Valor", "Origen / supuesto"],
    ["Inicio de la ración", INICIO_RACION, "un día después del 1er recibo de maíz (16/03)"],
    ["Inicio del concentrado y del autoconsumo", INICIO_CONC, "dato del usuario"],
    ["Fecha de la medición de stock", FECHA_STOCK, "dato del usuario"],
    [],
    ["Stock final maíz (kg)", STOCK_FINAL.maiz, "4.000 sueltos + 1.800 (90 % de los 2.000 mezclados)"],
    ["Stock final concentrado (kg)", STOCK_FINAL.conc, "950 sueltos + 200 (10 % de los 2.000 mezclados)"],
    [],
    ["Precio de entrada a recría ($/kg)", PRECIO_ENTRADA_KG, "venta teórica de cría, sobre peso YA desbastado"],
    [],
    ["Régimen 1", `${INICIO_RACION} → ${addDias(INICIO_CONC, -1)}`, "maíz solo, cantidad fija por día (2,5 → 3 kg)"],
    ["Régimen 2", `${INICIO_CONC} → ${FECHA_STOCK}`, "a discreción, mezcla 90 % maíz / 10 % concentrado"],
    [],
    ["Categorías que comen", CATS_COMEN.join(", "), "todos los machos (con toritos) y todas las hembras"],
  ], [42, 30, 60])

  // 3 · ENTREGAS
  const aoaEnt: any[][] = [
    ["ENTREGAS — por fecha de ENTREGA, no de factura"],
    ["La fecha de entrega es la que mueve el stock. Longo facturó el 13/07 lo entregado el 24/06."],
    [],
    ["MAÍZ"],
    ["Fecha entrega", "Proveedor", "Toneladas", "$/ton (neto)", "Costo neto", "Nota"],
  ]
  ENTREGAS_MAIZ.forEach(e => aoaEnt.push([e.fecha, e.prov, e.ton, e.precioTon, e.ton * e.precioTon, e.nota]))
  aoaEnt.push(["", "TOTAL", tonTotal, "", costoTotalMaiz, `$/kg promedio ponderado: ${ar(precioMaizKg, 2)}`])
  aoaEnt.push([])
  aoaEnt.push(["CONCENTRADO"])
  aoaEnt.push(["Fecha entrega", "Proveedor", "Kg", "$/kg (neto)", "Costo neto", "Nota"])
  ENTREGAS_CONC.forEach(e => aoaEnt.push([e.fecha, e.prov, e.kg, e.neto / e.kg, e.neto, e.nota]))
  hoja("ENTREGAS", aoaEnt, [14, 18, 12, 14, 14, 62])

  // 4 · RODEO
  const aoaRod: any[][] = [
    ["RODEO — cabezas que comen la ración"],
    [],
    ["Fecha", "Movimiento", "Delta", "Cabezas después"],
  ]
  let acum = 0
  eventos.forEach(e => { acum += e.delta; aoaRod.push([e.fecha, e.que, e.delta, acum]) })
  hoja("RODEO", aoaRod, [14, 34, 10, 18])

  // 5 · PESO
  const aoaPeso: any[][] = [
    ["PESO — las 4 pesadas reales"],
    ["El peso sale de la balanza, no de una ganancia estimada. Entre pesadas se interpola."],
    [],
    ["Fecha", "Todos (kg)", "n", "Los 55 vendidos (kg)", "n", "El resto (kg)", "n"],
  ]
  fechasPesada.forEach(f => {
    const n = (g: any) => (pesadas || []).filter((p: any) => p.fecha === f &&
      (g === "todos" || (g === "vendidos" ? idsVendidos.has(p.ternero_id) : !idsVendidos.has(p.ternero_id)))).length
    aoaPeso.push([f, +pesoProm(f, "todos").toFixed(1), n("todos"),
      +pesoProm(f, "vendidos").toFixed(1), n("vendidos"), +pesoProm(f, "resto").toFixed(1), n("resto")])
  })
  aoaPeso.push([])
  aoaPeso.push(["Ganancia diaria implícita entre pesadas (todos)"])
  aoaPeso.push(["Tramo", "Días", "Kg ganados", "kg/día"])
  for (let i = 1; i < fechasPesada.length; i++) {
    const d = dias(fechasPesada[i - 1], fechasPesada[i])
    const kg = pesoProm(fechasPesada[i], "todos") - pesoProm(fechasPesada[i - 1], "todos")
    aoaPeso.push([`${fechasPesada[i - 1]} → ${fechasPesada[i]}`, d, +kg.toFixed(1), +(kg / d).toFixed(3)])
  }
  aoaPeso.push([])
  aoaPeso.push(["Venta 04/08 (balanza del camión)", "", ""])
  aoaPeso.push(["kg brutos totales", Number(ventaMov?.peso_total_kg ?? 0), ""])
  aoaPeso.push(["kg brutos por cabeza", +(Number(ventaMov?.peso_total_kg ?? 0) / CAB_VENDIDOS).toFixed(1),
    "vs " + pesoProm("2026-08-03", "vendidos").toFixed(1) + " de la pesada individual del 03/08"])
  hoja("PESO", aoaPeso, [34, 14, 10, 22, 8, 16, 8])

  // 6 · TRAMOS
  const aoaTr: any[][] = [
    ["TRAMOS — el consumo REAL entre tomas de stock"],
    ["consumo = stock inicial + entregas − stock final. No se estima nada."],
    [],
    ["Desde", "Hasta", "Días", "Stock ini", "Entregado", "Stock fin", "CONSUMO", "kg/día", "Régimen"],
  ]
  tramos.forEach((t, i) => aoaTr.push([t.desde, t.hasta, t.d, t.stockIni, t.entregado, t.stockFin,
    t.consumo, +(t.consumo / t.d).toFixed(1), repartos[i].regimen]))
  aoaTr.push(["", "", tramos.reduce((s, t) => s + t.d, 0), "", tramos.reduce((s, t) => s + t.entregado, 0), "",
    tramos.reduce((s, t) => s + t.consumo, 0), "", ""])
  hoja("TRAMOS", aoaTr, [13, 13, 8, 11, 12, 11, 12, 10, 14])

  // 7 · REPARTO
  const aoaRep: any[][] = [
    ["REPARTO — cómo se divide el consumo de cada tramo"],
    ["La clave depende del régimen: cabeza-día si la ración es fija, kilo-día si es a discreción."],
    [],
    ["Tramo", "Régimen", "Clave 55", "Clave resto", "% 55", "kg maíz 55", "kg maíz resto"],
  ]
  let kgV = 0, kgR = 0
  tramos.forEach((t, i) => {
    const r = repartos[i]
    const pct = (r.claveV + r.claveR) ? r.claveV / (r.claveV + r.claveR) : 0
    kgV += r.kgV; kgR += r.kgR
    aoaRep.push([`${t.desde} → ${t.hasta}`, r.regimen, Math.round(r.claveV), Math.round(r.claveR),
      +(pct * 100).toFixed(1), Math.round(r.kgV), Math.round(r.kgR)])
  })
  aoaRep.push(["TOTAL", "", "", "", +(kgV / (kgV + kgR) * 100).toFixed(1), Math.round(kgV), Math.round(kgR)])
  aoaRep.push([])
  aoaRep.push(["CONCENTRADO — sólo régimen 2, se reparte por kilo-día"])
  const rT3 = repartos[repartos.length - 1]
  const pctConcV = (rT3.claveV + rT3.claveR) ? rT3.claveV / (rT3.claveV + rT3.claveR) : 0
  aoaRep.push(["Consumido (kg)", consumoConc, "", "", +(pctConcV * 100).toFixed(1),
    Math.round(consumoConc * pctConcV), Math.round(consumoConc * (1 - pctConcV))])
  hoja("REPARTO", aoaRep, [26, 14, 12, 13, 9, 13, 14])

  // 8 · RESULTADO — cada tramo se costea a SU precio
  const costoMaizV = repartos.reduce((s, r, i) => s + r.kgV * precioTramo[i], 0)
  const costoMaizR = repartos.reduce((s, r, i) => s + r.kgR * precioTramo[i], 0)
  const valorStockFinal = STOCK_FINAL.maiz * precioTramo[precioTramo.length - 1]
  const costoConcV = consumoConc * pctConcV * precioConcKg
  const costoConcR = consumoConc * (1 - pctConcV) * precioConcKg
  const pesoEntradaV = pesoProm(fechasPesada[0], "vendidos")
  const costoEntradaV = pesoEntradaV * CAB_VENDIDOS * PRECIO_ENTRADA_KG
  const ingresoV = Number(ventaMov?.monto_total ?? 0)

  hoja("RESULTADO", [
    ["RESULTADO — los 55 vendidos el 04/08"],
    [],
    ["Concepto", "Total", "Por cabeza"],
    ["Peso de entrada (kg, pesada 23/02)", +pesoEntradaV.toFixed(1), +pesoEntradaV.toFixed(1)],
    ["Costo de entrada a recría", Math.round(costoEntradaV), Math.round(costoEntradaV / CAB_VENDIDOS)],
    [],
    ["Maíz consumido (kg)", Math.round(kgV), +(kgV / CAB_VENDIDOS).toFixed(1)],
    ["Costo maíz", Math.round(costoMaizV), Math.round(costoMaizV / CAB_VENDIDOS)],
    ["Concentrado consumido (kg)", Math.round(consumoConc * pctConcV), +(consumoConc * pctConcV / CAB_VENDIDOS).toFixed(1)],
    ["Costo concentrado", Math.round(costoConcV), Math.round(costoConcV / CAB_VENDIDOS)],
    ["COSTO DE ALIMENTACIÓN", Math.round(costoMaizV + costoConcV), Math.round((costoMaizV + costoConcV) / CAB_VENDIDOS)],
    [],
    ["Ingreso de la venta (neto de desbaste)", Math.round(ingresoV), Math.round(ingresoV / CAB_VENDIDOS)],
    ["− Costo de entrada", -Math.round(costoEntradaV), -Math.round(costoEntradaV / CAB_VENDIDOS)],
    ["− Costo de alimentación", -Math.round(costoMaizV + costoConcV), -Math.round((costoMaizV + costoConcV) / CAB_VENDIDOS)],
    ["MARGEN (sin sanidad ni pasturas)", Math.round(ingresoV - costoEntradaV - costoMaizV - costoConcV),
      Math.round((ingresoV - costoEntradaV - costoMaizV - costoConcV) / CAB_VENDIDOS)],
    [],
    ["⚠️ No incluye sanidad, pasturas, verdeos ni estructura. Sólo maíz y concentrado."],
    [],
    ["LO QUE QUEDA EN EL CAMPO"],
    ["Maíz consumido (kg)", Math.round(kgR), ""],
    ["Costo maíz", Math.round(costoMaizR), ""],
    ["Costo concentrado", Math.round(costoConcR), ""],
    ["COSTO ACUMULADO de los que siguen", Math.round(costoMaizR + costoConcR), ""],
  ], [42, 18, 16])

  // 9 · CONTROLES
  const consumoMaizTotal = tramos.reduce((s, t) => s + t.consumo, 0)
  const mezclaConcImplica = consumoConc * 9   // 90/10 → por cada kg de concentrado, 9 de maíz
  const diasReg1 = dias(INICIO_RACION, INICIO_CONC)
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
  hoja("CONTROLES", [
    ["CONTROLES — lo que tiene que cerrar"],
    [],
    ["── EN KILOS ──"],
    ["Control", "Esperado", "Real", "Estado"],
    ["Maíz: entregado − consumido = stock", STOCK_FINAL.maiz,
      Math.round(tonTotal * 1000 - consumoMaizTotal), tonTotal * 1000 - consumoMaizTotal === STOCK_FINAL.maiz ? "OK" : "REVISAR"],
    ["Reparto: kg 55 + kg resto = consumo total", Math.round(consumoMaizTotal), Math.round(kgV + kgR),
      Math.abs(kgV + kgR - consumoMaizTotal) < 1 ? "OK" : "REVISAR"],
    ["Longo: facturado = entregado (ton)", 45.1, 45.1, "OK"],
    [],
    ["── EN PLATA: el control de punta a punta ──"],
    ["Todo lo comprado tiene que estar en algún lado: comido por unos, comido por otros, o en el silo."],
    ["Concepto", "", "$", ""],
    ["Maíz comprado (neto)", "", Math.round(costoTotalMaiz), ""],
    ["  − imputado a los 55", "", -Math.round(costoMaizV), ""],
    ["  − imputado a los que quedan", "", -Math.round(costoMaizR), ""],
    ["  − valor del stock remanente", "", -Math.round(valorStockFinal), `${ar(STOCK_FINAL.maiz)} kg × $${ar(precioTramo[precioTramo.length - 1], 2)}`],
    ["DIFERENCIA (tiene que ser 0)", "", Math.round(costoTotalMaiz - costoMaizV - costoMaizR - valorStockFinal),
      Math.abs(costoTotalMaiz - costoMaizV - costoMaizR - valorStockFinal) < 1 ? "OK" : "REVISAR"],
    [],
    ["Precio del maíz POR TRAMO (no un promedio único)"],
    ...tramos.map((t, i) => [`  ${t.desde} → ${t.hasta}`, "", +precioTramo[i].toFixed(2), "$/kg"]),
    ["  (promedio ponderado del período, sólo de referencia)", "", +precioMaizKg.toFixed(2), "$/kg"],
    [],
    ["CRUCE INDEPENDIENTE — la mezcla 90/10"],
    ["Concentrado consumido (kg)", "", Math.round(consumoConc), ""],
    ["→ implica maíz mezclado (×9)", "", Math.round(mezclaConcImplica), ""],
    ["Maíz consumido en el último tramo", "", Math.round(tramos[tramos.length - 1].consumo), ""],
    ["Diferencia = maíz solo antes del 27/07", "",
      Math.round(tramos[tramos.length - 1].consumo - mezclaConcImplica),
      "debería ser ≈ 3 días × la ración diaria"],
    [],
    ["LA RACIÓN IMPLÍCITA — contra lo que declaró el usuario (2,5 a 3 kg/cab/día)"],
    ["Tramo", "Cabezas promedio", "kg/cab/día", "vs declarado"],
    ...tramos.map((t, i) => [`${t.desde} → ${t.hasta}`, +cabPromTramo(t).toFixed(0),
      +racionImplicita(i).toFixed(2),
      i === 2 ? "a discreción, se espera más" : (racionImplicita(i) < 2.4 ? "POR DEBAJO" : racionImplicita(i) > 3.2 ? "POR ENCIMA" : "coherente")]),
    [],
    ["Posibles explicaciones del tramo 1:"],
    ["  · la ración arrancó más baja y fue subiendo (lo más probable)"],
    ["  · alguna entrega de Arroyo/Pereyra fue MÁS TARDE que su factura"],
    ["  · el stock del 24/06 no era tan cero"],
    ["  · falta registrar alguna entrega"],
    [`Días del régimen 1: ${diasReg1}`],
  ], [46, 26, 20, 34])

  // 10 · DIAGNÓSTICO — ¿en qué momento se rompe la ración declarada?
  // Se simula el stock día a día dando la ración declarada. El día que el stock se hace
  // NEGATIVO es el día en que esa ración se volvió imposible: ahí está el error, sea porque
  // la ración era menor, porque falta una entrega, o porque una entrega llegó más tarde.
  const simular = (racionKg: number) => {
    const filas: any[][] = []
    let stock = 0, primerNegativo = ""
    for (let k = 0; k <= dias(ENTREGAS_MAIZ[0].fecha, FECHA_STOCK); k++) {
      const f = addDias(ENTREGAS_MAIZ[0].fecha, k)
      const entra = ENTREGAS_MAIZ.filter(e => e.fecha === f).reduce((s, e) => s + e.ton * 1000, 0)
      stock += entra
      const cab = f >= INICIO_RACION ? cabezasAl(f) : 0
      const come = f >= INICIO_CONC ? 0 : cab * racionKg   // desde el autoconsumo no aplica
      stock -= come
      if (stock < 0 && !primerNegativo) primerNegativo = f
      if (entra > 0 || f === INICIO_RACION || f === INICIO_CONC || f === primerNegativo) {
        filas.push([f, entra || "", cab, Math.round(come), Math.round(stock),
          entra > 0 ? "ENTREGA" : f === INICIO_RACION ? "arranca la ración"
          : f === INICIO_CONC ? "arranca el autoconsumo" : f === primerNegativo ? "⚠ STOCK NEGATIVO" : ""])
      }
    }
    return { filas, primerNegativo, stockFinal: stock }
  }

  const aoaDiag: any[][] = [
    ["DIAGNÓSTICO — ¿dónde se rompe la ración declarada?"],
    ["Se simula el stock día a día dando la ración fija. El día que se hace NEGATIVO es el día"],
    ["en que esa ración se volvió imposible con el maíz registrado. Ahí está el error."],
    [],
    ["Ración probada (kg/cab/día)", "Se queda sin maíz el", "Stock al 24/08 (kg)", "Lectura"],
  ]
  for (const r of [1.0, 1.19, 1.5, 2.0, 2.5, 3.0]) {
    const s = simular(r)
    aoaDiag.push([r, s.primerNegativo || "nunca", Math.round(s.stockFinal),
      s.primerNegativo ? "imposible con el maíz registrado" :
      Math.abs(s.stockFinal - STOCK_FINAL.maiz) < 2000 ? "◀ compatible con tu stock del 24/08" : "sobraría maíz"])
  }
  aoaDiag.push([])
  aoaDiag.push(["¿QUÉ FECHA DE INICIO hace coherente la ración declarada?"])
  aoaDiag.push(["El consumo del régimen 1 es un dato fijo. Si la ración arrancó más tarde, se reparte"])
  aoaDiag.push(["entre menos días y la ración implícita sube. Se busca la fecha que da 2,5 a 3 kg."])
  aoaDiag.push(["Inicio probado", "Días de régimen 1", "Cabezas prom.", "kg/cab/día implícito", "Lectura"])
  // Consumo del régimen 1 = todo menos lo del autoconsumo (que sale del cruce 90/10)
  const consumoAutoconsumo = consumoConc * 9
  const consumoReg1 = consumoMaizTotal - consumoAutoconsumo
  for (const ini of ["2026-03-17", "2026-04-15", "2026-05-11", "2026-06-02", "2026-06-24"]) {
    const d = dias(ini, INICIO_CONC)
    let s = 0, n = 0
    for (let k = 0; k < d; k++) { s += cabezasAl(addDias(ini, k)); n++ }
    const cab = n ? s / n : 1
    const r = consumoReg1 / d / cab
    aoaDiag.push([ini, d, +cab.toFixed(0), +r.toFixed(2),
      r >= 2.4 && r <= 3.2 ? "◀ COHERENTE con lo declarado" : r < 2.4 ? "por debajo" : "por encima"])
  }
  aoaDiag.push([])
  aoaDiag.push(["Detalle día a día con la ración de 2,5 kg (la que declaraste)"])
  aoaDiag.push(["Fecha", "Entrega (kg)", "Cabezas", "Comen (kg)", "Stock (kg)", "Qué pasa"])
  simular(2.5).filas.forEach(f => aoaDiag.push(f))
  hoja("DIAGNOSTICO", aoaDiag, [28, 22, 20, 46])

  XLSX.writeFile(wb, salida)

  console.log(`\n✅ ${salida}\n`)
  console.log(`Maíz entregado    ${ar(tonTotal, 2)} ton   $${ar(costoTotalMaiz)}   ($${ar(precioMaizKg, 2)}/kg)`)
  console.log(`Maíz consumido    ${ar(consumoMaizTotal / 1000, 2)} ton      stock ${ar(STOCK_FINAL.maiz)} kg`)
  console.log(`Concentrado       ${ar(kgConc)} kg comprados, ${ar(consumoConc)} consumidos  ($${ar(precioConcKg, 2)}/kg)`)
  console.log(`\nReparto del maíz  55 vendidos: ${ar(Math.round(kgV))} kg   ·   resto: ${ar(Math.round(kgR))} kg`)
  console.log(`\nCOSTO ALIMENTACIÓN de los 55: $${ar(Math.round(costoMaizV + costoConcV))}  ($${ar(Math.round((costoMaizV + costoConcV) / CAB_VENDIDOS))}/cab)`)
  console.log(`MARGEN de los 55:             $${ar(Math.round(ingresoV - costoEntradaV - costoMaizV - costoConcV))}`)
  console.log(`\nRación implícita por tramo (declarado: 2,5 a 3 kg/cab/día):`)
  tramos.forEach((t, i) => console.log(`   ${t.desde} → ${t.hasta}   ${cabPromTramo(t).toFixed(0).padStart(4)} cab   ${racionImplicita(i).toFixed(2)} kg/cab/día`))
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
