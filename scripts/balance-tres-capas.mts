/**
 * 🧱 A-FEAT-1632 — LAS TRES CAPAS DEL BALANCE, prueba fuera de la app (tanda sin supervisión del 21/11). SÓLO LEE.
 *
 * Arma, con el MISMO cálculo que la app (libro diario, libro de templates y sueldos de Reportes → Balance), un Excel con:
 *   1. «Balance»: la planilla con la estructura del contador (Activo · Pasivo · Patrimonio · Resultados) y renglones NUESTROS, con
 *      filas agrupadas (+/−): totalizadora → cuenta, agrupadora → template, empleado → partes del sueldo.
 *   2. Los tres CRUDOS detrás («Crudo · Diario», «Crudo · Templates», «Crudo · Sueldos»): un renglón por comprobante / cuota /
 *      sueldo, con el Nro del renglón del balance al que va (o «no va», con el motivo). Filtrando por ese Nro se llega al número.
 *   3. «Control»: cada crudo contra lo que entró al balance + lo que no va, y contra el libro bajado v18.
 *
 * No toca la app ni los libros actuales (JMS 21/11: capa aparte; la verificación del v19 sigue pendiente).
 *
 *     npx tsx scripts/balance-tres-capas.mts            → MSA 25/26
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta, type AsientoLibroDiario } from "../lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "../lib/balance/presentado-arca"
import { desdeCuota, armarTemplatesDelEjercicio, templatesACuentaDeSocio, type CuotaTemplate } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { CONTRAPARTES_DEL_BALANCE, normalizar as normalizarCC } from "../lib/balance/cuentas-corrientes"
import { responsablePrincipal } from "../lib/balance/libros-del-balance"
import { SOCIOS_QUE_FACTURAN, cuentasConLosSocios } from "../lib/balance/export-libro-diario"
import { armarSueldosDelEjercicio, type PeriodoDeSueldo, type FilaSueldo } from "../lib/balance/sueldos-balance"
import { mesesDelEjercicio } from "../lib/balance/papeles-bancarios"
import { RENGLONES, RUBROS } from "../lib/balance/balance-propio"
import { armarCuentasCorrientes, aplicarSaldosInicio, abrirDesglosar, consumosDeTarjetaComoMovimientos, movimientosDeLosSocios, aplicarCierresDecididos, separarSocios, sueldosPendientesComoCompras } from "../lib/balance/cuentas-corrientes"
import { leerNumero } from "../lib/balance/datos-usuario-puro"
import { leerCobrosYRetenciones } from "../lib/balance/cobros-de-ventas"
import { retencionesDeVenta } from "../lib/balance/libro-diario-consensuado"
import { leerMovimientosDeLaCapa } from "../lib/balance/capa-interna-datos"
import { capaInterna } from "../lib/balance/capa-interna"
import { entradaDesde141, compensacionDe, SOCIOS_INTERNO } from "../lib/balance/interno-por-socio"
/** Igual que `components/provision-manual.tsx` (no se importa un componente desde un script). */
const tablaFacturas = (schema: string) => `${schema}.comprobantes_arca`
const tablaVentas = (schema: string) => `${schema}.comprobantes_venta`

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const EMPRESA = "MSA", SCHEMA = "msa", ANIO = 2026, MES_CIERRE = 6
const VERSION = process.argv.find(a => a.startsWith("--v="))?.slice(4) ?? "v1"
const CARPETA = join("..", "Control-Presupuestario-v1.1", "- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude", "Balance formato contador", VERSION)
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
/** ⏱️ JMS 21/11: «chequeá cada tanto si se traba o avanza por etapas» — cada etapa se anota con la hora y los segundos desde el arranque. */
const T0 = Date.now()
const etapa = (q: string) => console.log(`[${new Date().toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · +${Math.round((Date.now() - T0) / 1000)} s] ${q}`)
etapa("arranque")
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }

const ej = armarEjercicio(ANIO, MES_CIERRE)
const INICIO = primerDiaDelEjercicio(ej), CIERRE = ej.fechaCierre, CIERRE_ANT = armarEjercicio(ANIO - 1, MES_CIERRE).fechaCierre
const anios = [ANIO - 1, ANIO, ANIO + 1]

// ═══════════════════════════════ LECTURA (igual que Reportes → Balance) ═══════════════════════════════
etapa("leyendo compras, ventas, cuotas y plan")
const [arca, historico, ventasCrudas, cuotasCrudas, plan] = await Promise.all([
  todo((d, h) => sb.schema(SCHEMA).from("comprobantes_arca").select("*").in("año_contable", anios).order("id").range(d, h)),
  todo((d, h) => sb.schema("msa").from("comprobantes_historico").select("*").in("anio_contable", anios).order("id").range(d, h)),
  todo((d, h) => sb.schema(SCHEMA).from("comprobantes_venta").select("*").in("año_contable", anios).order("id").range(d, h)),
  todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora, año)")
    .gte("fecha_estimada", `${ANIO - 2}-01-01`).order("id").range(d, h)),
  todo((d, h) => sb.from("cuentas_contables").select("categ, tipo, nro_cuenta, cuenta_contable, nombre_totalizadora, cta_totalizadora, imputable, activo").order("nro_cuenta").range(d, h)),
])
// provisiones puestas a mano (A-FEAT-1331 / 1564)
const manuales = { esteEjercicio: [] as AsientoLibroDiario[], anterior: [] as AsientoLibroDiario[] }
{
  const TH = "msa.comprobantes_historico"
  const { data: incl } = await sb.from("ajustes_balance").select("*").eq("empresa", EMPRESA).eq("accion", "incluir")
    .in("tabla", [tablaFacturas(SCHEMA), TH, tablaVentas(SCHEMA)]).in("anio_cierre", [ANIO, ANIO - 1]).is("anulado_at", null)
  const porId = new Map<string, AsientoLibroDiario>()
  const ids = (t: string) => (incl ?? []).filter((a: any) => a.tabla === t).map((a: any) => a.registro_id).filter(Boolean)
  if (ids(tablaFacturas(SCHEMA)).length) for (const f of (await sb.schema(SCHEMA).from("comprobantes_arca").select("*").in("id", ids(tablaFacturas(SCHEMA)))).data ?? []) porId.set(String(f.id), desdeArca(f))
  if (ids(TH).length) for (const f of (await sb.schema("msa").from("comprobantes_historico").select("*").in("id", ids(TH))).data ?? []) porId.set(String(f.id), desdeHistorico(f))
  if (ids(tablaVentas(SCHEMA)).length) for (const f of (await sb.schema(SCHEMA).from("comprobantes_venta").select("*").in("id", ids(tablaVentas(SCHEMA)))).data ?? []) porId.set(String(f.id), desdeVenta(f))
  for (const a of incl ?? []) { const f = porId.get(a.registro_id); if (f) (a.anio_cierre === ANIO ? manuales.esteEjercicio : manuales.anterior).push({ ...f, provision_motivo: a.motivo }) }
}
const libro = armarLibroDiario([...arca.map(desdeArca), ...historico.map(desdeHistorico)], ventasCrudas.map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS[EMPRESA], manuales)

etapa("libro diario armado; templates: banco de cada cuota")
// templates — mismas opciones que la pantalla
const tipoDeCateg = Object.fromEntries(plan.map((x: any) => [x.categ, x.tipo]))
let cuotas: CuotaTemplate[] = cuotasCrudas.map((f: any) => desdeCuota(f, tipoDeCateg as any))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
const { data: conPoliza } = await sb.from("polizas_seguro").select("template_id").not("template_id", "is", null)
const { data: reglasCod } = await sb.from("reglas_contable_interno").select("template_id, codigo_contable, activo").not("template_id", "is", null)
const socioDeCodigo: Record<string, string> = {}
for (const c of CONTRAPARTES_DEL_BALANCE) if ((c as any).socio) for (const e of (c as any).etiquetasContable) socioDeCodigo[normalizarCC(e)] = c.clave
const tpls = new Map<string, { id: string; responsable?: string | null }>()
for (const c of cuotas) if (c.egresoId && !tpls.has(c.egresoId)) tpls.set(c.egresoId, { id: c.egresoId, responsable: c.responsable })
const aCuentaDe = templatesACuentaDeSocio((reglasCod ?? []) as any, [...tpls.values()], socioDeCodigo)
const opciones = { empresa: EMPRESA, plan, aCuentaDe, templatesConPoliza: (conPoliza ?? []).map((p: any) => p.template_id).filter(Boolean) } as any

etapa("templates listos; sueldos")
// sueldos
const meses = mesesDelEjercicio(ANIO, MES_CIERRE)
const [a0] = meses[0].split("-").map(Number), [aN] = meses[11].split("-").map(Number)
const periodos = await todo((d, h) => sb.from("sueldos_periodos").select("*, empleado:sueldos_empleados(nombre, empresa, tipo_empleado, cuit_empleado)").in("anio", a0 === aN ? [a0] : [a0, aN]).order("id").range(d, h))
const sueldos = armarSueldosDelEjercicio(periodos as unknown as PeriodoDeSueldo[], meses)

// saldos: balance propio (versión jms = lo nuestro) y la planilla del contador (fiscal y patrimonio neto)
const { data: fotos } = await sb.from("balance_fotos").select("id, fecha_cierre").eq("empresa", EMPRESA).in("fecha_cierre", [CIERRE_ANT, CIERRE])
const valores = fotos?.length ? (await sb.from("balance_foto_valores").select("foto_id, renglon, version, importe, origen, detalle").in("foto_id", fotos.map((f: any) => f.id))).data ?? [] : []
const fechaDeFoto = new Map((fotos ?? []).map((f: any) => [f.id, f.fecha_cierre]))
const valor = (version: string, renglon: string, fecha: string) => valores.find((v: any) => v.version === version && v.renglon === renglon && fechaDeFoto.get(v.foto_id) === fecha)
const { data: contador } = await sb.from("balance_contador_cuentas").select("orden, capitulo, cuenta, denominacion, saldo, tratamiento").eq("empresa", EMPRESA).order("orden")

// ═══════════════════════════════ LAS FILAS DEL BALANCE ═══════════════════════════════
type Fila = { nro?: string; nivel: number; texto: string; origen?: string; inicio?: number | null; cierre?: number | null; resultado?: number | null; esSubtotal?: boolean; titulo?: boolean; nota?: string; hijos?: Fila[] }
let nro = 0
const nuevoNro = () => `B${String(++nro).padStart(3, "0")}`
const hoja: Fila[] = []
/** Un grupo: sus hijas (nivel+1) primero y abajo el subtotal (nivel), que es lo que queda a la vista plegado. */
function grupo(texto: string, nivel: number, hijos: Fila[], extra: Partial<Fila> = {}): Fila { return { texto, nivel, hijos, esSubtotal: true, ...extra } }
const suma = (fs: Fila[], k: "inicio" | "cierre" | "resultado") => r2(fs.reduce((a, f) => a + (f.hijos ? suma(f.hijos, k) : Number(f[k] ?? 0)), 0))

// ── ACTIVO / PASIVO: de nuestro balance propio (versión jms); lo fiscal y los bienes de uso, del contador ──
const ORIGEN_CONTADOR = new Set(["creditos_impositivos", "deudas_fiscales", "otras_deudas_nc", "bienes_uso"])
const capituloPatrimonial = (lado: "activo" | "pasivo") => RUBROS.filter(r => r.lado === lado).map(rub => {
  const hijos: Fila[] = []
  for (const ren of RENGLONES.filter(x => x.rubro === rub.id)) {
    const delContador = ORIGEN_CONTADOR.has(rub.id) || ren.id === "equinos"
    const ver = delContador ? "contador" : "jms"
    const vi = valor(ver, ren.id, CIERRE_ANT), vc = valor(ver, ren.id, CIERRE)
    if (!vi && !vc) continue
    const signo = lado === "pasivo" ? -1 : 1
    hijos.push({ nro: nuevoNro(), nivel: 2, texto: ren.etiqueta, origen: delContador ? "Contador (dato fiscal / sin interpretar)" : `Nuestro · balance propio (${vc?.origen ?? vi?.origen ?? "—"})`,
      inicio: vi ? r2(signo * Number(vi.importe)) : null, cierre: vc ? r2(signo * Number(vc.importe)) : null,
      nota: String(vc?.detalle ?? vi?.detalle ?? "").replace(/^\[script \d+\]\s*/, "").slice(0, 160) })
  }
  return hijos.length ? grupo(rub.etiqueta, 1, hijos) : null
}).filter(Boolean) as Fila[]

const activo = capituloPatrimonial("activo"), pasivo = capituloPatrimonial("pasivo")
hoja.push(grupo("ACTIVO", 0, activo, { titulo: true }))
hoja.push(grupo("PASIVO", 0, pasivo, { titulo: true }))
const pn = (contador ?? []).filter((c: any) => c.capitulo === "PATRIMONIO NETO").map((c: any) => ({ nro: nuevoNro(), nivel: 1, texto: c.denominacion, origen: "Contador (sin interpretar)", cierre: r2(Number(c.saldo)), nota: c.cuenta } as Fila))
hoja.push(grupo("PATRIMONIO NETO (del contador, sin interpretar)", 0, pn, { titulo: true }))

// ── RESULTADOS ──
type FilaCrudo = Record<string, unknown>
const crudoDiario: FilaCrudo[] = [], crudoTemplates: FilaCrudo[] = [], crudoSueldos: FilaCrudo[] = []
const planPorNro = new Map(plan.map((p: any) => [String(p.nro_cuenta ?? ""), p]))
const planPorCateg = new Map(plan.map((p: any) => [String(p.categ ?? "").trim().toUpperCase(), p]))
const nombreCuenta = (nroC: string, txt: string) => { const p: any = planPorNro.get(nroC) ?? planPorCateg.get(txt.trim().toUpperCase()); return p ? `${p.nro_cuenta ?? ""} ${p.categ}`.trim() : (txt || "(sin cuenta)") }
const totalizadoraDe = (nroC: string, txt: string) => { const p: any = planPorNro.get(nroC) ?? planPorCateg.get(txt.trim().toUpperCase()); if (!p?.cta_totalizadora) return "(sin totalizadora en el plan)"; const t: any = planPorNro.get(String(p.cta_totalizadora)); return t ? `${t.nro_cuenta} ${t.categ}` : String(p.nombre_totalizadora ?? p.cta_totalizadora) }

/** Libro diario: un bloque (ventas, compras o provisión) → totalizadora → cuenta. Importe = total − IVA (otros tributos van al gasto). */
function bloqueDiario(rotulo: string, asientos: AsientoLibroDiario[], signo: 1 | -1, origenCrudo: string): Fila {
  const porTot = new Map<string, Map<string, AsientoLibroDiario[]>>()
  for (const a of asientos) {
    const tot = totalizadoraDe(a.nro_cuenta, a.cuenta_contable), cta = nombreCuenta(a.nro_cuenta, a.cuenta_contable)
    if (!porTot.has(tot)) porTot.set(tot, new Map())
    const m = porTot.get(tot)!; m.set(cta, [...(m.get(cta) ?? []), a])
  }
  const grupos = [...porTot.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([tot, ctas]) => grupo(tot, 2, [...ctas.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([cta, as]) => {
    const f: Fila = { nro: nuevoNro(), nivel: 3, texto: cta, origen: `Libro diario · ${rotulo.toLowerCase()}`, resultado: r2(signo * as.reduce((s, a) => s + (a.total - a.iva), 0)) }
    for (const a of as) crudoDiario.push({ "Nro balance": f.nro, "Va al resultado": "sí", Bloque: rotulo, Totalizadora: tot, Cuenta: cta, Fecha: a.fecha, Subdiario: a.subdiario, Tipo: a.tipo,
      Comprobante: `${a.punto_venta ?? ""}-${a.numero ?? ""}`, CUIT: a.cuit, Contraparte: a.denominacion, "Neto gravado": r2(a.neto_gravado), "No gravado": r2(a.no_gravado), Exento: r2(a.exento),
      "Otros tributos": r2(a.otros_tributos), IVA: r2(a.iva), Total: r2(a.total), "Al resultado (sin IVA)": r2(signo * (a.total - a.iva)), Origen: origenCrudo, Motivo: a.provision_motivo ?? "" })
    return f
  })))
  return grupo(rotulo, 1, grupos)
}
const provComp = libro.provisiones.filter(a => a.fuente !== "venta"), provVent = libro.provisiones.filter(a => a.fuente === "venta")
const resVentas = bloqueDiario("Ventas", libro.ventas, -1, "subdiario de ventas")
const resProvVentas = provVent.length ? bloqueDiario("Provisión de ventas del ejercicio", provVent, -1, "provisión (papel 03.1)") : null
const resCompras = bloqueDiario("Compras", libro.compras, 1, "subdiario de compras")
const resProvCompras = provComp.length ? bloqueDiario("Provisión de compras del ejercicio", provComp, 1, "provisión (papel 05)") : null
for (const a of libro.provisionesEjercicioAnterior) crudoDiario.push({ "Nro balance": "NO VA", "Va al resultado": "no (a definir)", Bloque: "Provisión del ejercicio ANTERIOR", Totalizadora: totalizadoraDe(a.nro_cuenta, a.cuenta_contable),
  Cuenta: nombreCuenta(a.nro_cuenta, a.cuenta_contable), Fecha: a.fecha, Subdiario: a.subdiario, Tipo: a.tipo, Comprobante: `${a.punto_venta ?? ""}-${a.numero ?? ""}`, CUIT: a.cuit, Contraparte: a.denominacion,
  "Neto gravado": r2(a.neto_gravado), "No gravado": r2(a.no_gravado), Exento: r2(a.exento), "Otros tributos": r2(a.otros_tributos), IVA: r2(a.iva), Total: r2(a.total), "Al resultado (sin IVA)": 0,
  Origen: "provisión 24/25 (ya está dentro de Compras de este ejercicio)", Motivo: "Hoy el libro la lista y no la resta: ¿se resta del resultado?" })

// Templates de MSA
const deMSA = cuotas.filter(c => responsablePrincipal(c.responsable) === EMPRESA)
const tMSA = armarTemplatesDelEjercicio(deMSA, ej, opciones)
const SIN = "(sin agrupadora)"
const agrupadoraDe = (c: CuotaTemplate) => (c.agrupadoraTemplate ?? "").trim() || SIN
const filaCuota = (c: CuotaTemplate, nroB: string, va: string, bloque: string, motivo = "") => crudoTemplates.push({ "Nro balance": nroB, "Va al resultado": va, Bloque: bloque, Responsable: c.responsable,
  Agrupadora: agrupadoraDe(c), Template: c.concepto, Proveedor: c.proveedor, "Cuenta contable del template": c.categ, Fecha: c.fecha, Estado: c.estado, Importe: r2(c.monto),
  "Quién pagó": c.banco?.titular ?? "", "Cuenta de pago": c.banco?.cuenta ?? "", "Código contable": c.banco?.contable ?? "", "Código interno": c.banco?.interno ?? "", Detalle: c.detalle ?? c.descripcionCuota ?? "", Motivo: motivo })
/** agrupadora → template, con cada cuota en el crudo. */
function bloqueTemplates(rotulo: string, cs: CuotaTemplate[], nivelBase = 1, valorDe?: (cs: CuotaTemplate[]) => number, motivoCrudo = ""): Fila {
  const porAgr = new Map<string, Map<string, CuotaTemplate[]>>()
  for (const c of cs) { const a = agrupadoraDe(c), k = c.concepto || "(sin nombre)"; if (!porAgr.has(a)) porAgr.set(a, new Map()); const m = porAgr.get(a)!; m.set(k, [...(m.get(k) ?? []), c]) }
  const orden = (a: string) => (a === SIN ? "zzz" : a)
  return grupo(rotulo, nivelBase, [...porAgr.entries()].sort((x, y) => orden(x[0]).localeCompare(orden(y[0]))).map(([agr, ts]) => grupo(agr, nivelBase + 1, [...ts.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([t, cc]) => {
    const f: Fila = { nro: nuevoNro(), nivel: nivelBase + 2, texto: t, origen: "Templates", resultado: r2(valorDe ? valorDe(cc) : cc.reduce((s, c) => s + c.monto, 0)) }
    for (const c of cc) filaCuota(c, f.nro!, "sí", rotulo, motivoCrudo)
    return f
  }))))
}
const det = tMSA.detalle
const porTipo = (t: string) => det.filter(c => (c.tipo ?? "sin clasificar") === t)
const resTplEgresos = bloqueTemplates("Templates — egresos", [...porTipo("egreso"), ...porTipo("ingreso")])
// financiero: sólo la ganancia o pérdida
const fin = porTipo("financiero")
const AL_RESULTADO = /cr[eé]ditos bancarios|intereses/i
const finResultado = fin.filter(c => AL_RESULTADO.test(agrupadoraDe(c)) || AL_RESULTADO.test(c.concepto))
const esDolares = (c: CuotaTemplate) => /d[oó]lar/i.test(c.concepto)
const finDolares = fin.filter(c => !finResultado.includes(c) && /inversi/i.test(agrupadoraDe(c)) && esDolares(c))
const finInversion = fin.filter(c => !finResultado.includes(c) && /inversi/i.test(agrupadoraDe(c)) && !esDolares(c))
const finMovInternos = fin.filter(c => !finResultado.includes(c) && !finInversion.includes(c) && /movimientos internos/i.test(agrupadoraDe(c)))
const finNoVa = fin.filter(c => !finResultado.includes(c) && !finInversion.includes(c) && !finMovInternos.includes(c) && !finDolares.includes(c))
const fciIni = Number(valor("jms", "fci", CIERRE_ANT)?.importe ?? 0), fciFin = Number(valor("jms", "fci", CIERRE)?.importe ?? 0)
const esFCI = (c: CuotaTemplate) => /fci|fondo/i.test(c.concepto)
const hijosFin: Fila[] = []
if (finResultado.length) hijosFin.push(bloqueTemplates("Intereses y cargos financieros", finResultado, 2))
if (finInversion.length) {
  // ganancia = rescates − suscripciones + (saldo final − saldo inicial); con el signo del contador (ganancia negativa): Σ importes − (final − inicial)
  hijosFin.push(bloqueTemplates("Inversiones — ganancia o pérdida (rescates − suscripciones + saldo final − saldo inicial)", finInversion, 2,
    cc => r2(cc.reduce((s, c) => s + c.monto, 0) - (cc.some(esFCI) ? (fciFin - fciIni) : 0)),
    `FCI: saldo inicial ${fciIni.toLocaleString("es-AR")} y final ${fciFin.toLocaleString("es-AR")} (balance propio)`))
}
if (finMovInternos.length) hijosFin.push(bloqueTemplates("Movimientos entre cuentas propias (tiene que dar 0; si no, revisar)", finMovInternos, 2))
const resFinanciero = grupo("Financiero — sólo la ganancia o pérdida", 1, hijosFin)
for (const c of finDolares) filaCuota(c, "NO VA", "no (a revisar)", "Compra / venta de dólares", "Los pesos que salen quedan como dólares (activo): el resultado es la diferencia de cambio, que falta calcular")
for (const c of finNoVa) filaCuota(c, "NO VA", "no", "Financiero que no es resultado", "Pago de tarjeta / otro movimiento de plata: la plata no sale de la empresa")
for (const c of [...porTipo("distribucion")]) filaCuota(c, "NO VA", "no", "Socios — retiros y aportes", "Va a la cuenta de cada socio, no al resultado")
for (const c of [...porTipo("reintegro")]) filaCuota(c, "NO VA", "no", "Reintegros a la cuenta de un socio", "El gasto entra por su factura")
for (const c of [...porTipo("NO"), ...porTipo("sin clasificar")]) filaCuota(c, "NO VA", "no (revisar)", `Tipo «${c.tipo ?? "sin clasificar"}»`, "Sin tipo de resultado")
for (const c of tMSA.enFacturas ?? []) filaCuota(c, "NO VA", "no", "No suma — seguro con póliza", "Ya es gasto por la factura de la aseguradora")
for (const c of tMSA.noIncluidas ?? []) filaCuota(c, "NO VA", "no", "No suma — cuota desactivada", "Se eligió la otra forma de pago")
for (const c of cuotas.filter(c => responsablePrincipal(c.responsable) !== EMPRESA)) {
  const f = c.fecha ?? ""
  if (f >= INICIO && f <= CIERRE) filaCuota(c, "NO VA", "no", `Template de ${responsablePrincipal(c.responsable)}`, "Otro responsable: no es gasto de MSA")
}

// Sueldos: empleado → partes
const esSocio = (x: FilaSueldo) => SOCIOS_QUE_FACTURAN.includes(String(x.empleado).trim().toUpperCase())
const delMSA = (x: FilaSueldo) => !x.empresa || String(x.empresa).toUpperCase().includes(EMPRESA)
const empleados = sueldos.filas.filter(x => !esSocio(x) && delMSA(x))
const porEmp = new Map<string, FilaSueldo[]>()
for (const x of empleados) porEmp.set(x.empleado, [...(porEmp.get(x.empleado) ?? []), x])
/** Las partes del bruto SEGÚN EL TIPO de empleado (la misma fórmula que `brutoDesdePartes`): A+B+francos+extras · jornal+extras · A+extras. */
function partes(x: FilaSueldo): Array<[string, number]> {
  const t = String(x.tipo ?? "")
  const ps: Array<[string, number]> = t === "ab_francos" ? [["Categoría A", x.montoA], ["Categoría B", x.montoB], ["Francos", x.porFrancos], ["Extras (vacaciones, premios, aguinaldo, varios)", x.extras]]
    : t === "por_dia" || t === "por_hora_ipc" ? [["Jornal", x.porJornal], ["Extras (vacaciones, premios, aguinaldo, varios)", x.extras]]
    : t === "plano_ipc" ? [["Categoría A", x.montoA], ["Extras (vacaciones, premios, aguinaldo, varios)", x.extras]]
    : [["Bruto (tipo de empleado sin desglose)", x.brutoGuardado]]
  const suma = ps.reduce((a, [, v]) => a + v, 0)
  if (Math.abs(suma - x.brutoGuardado) >= 0.005) ps.push(["Diferencia entre las partes y el bruto guardado (revisar)", r2(x.brutoGuardado - suma)])
  return ps
}
const resSueldos = grupo("Sueldos (bruto guardado de empleados)", 1, [...porEmp.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([emp, xs]) => {
  const acum = new Map<string, number>()
  for (const x of xs) for (const [rot, v] of partes(x)) acum.set(rot, r2((acum.get(rot) ?? 0) + v))
  const hijos = [...acum.entries()].filter(([, v]) => v !== 0).map(([rot, v]) => ({ nro: nuevoNro(), nivel: 3, texto: rot, origen: "Sueldos", resultado: v } as Fila))
  const g = grupo(emp, 2, hijos)
  for (const x of xs) crudoSueldos.push({ "Nro balance": hijos.map(h => h.nro).join(" "), "Va al resultado": "sí", Bloque: "Empleados", Empleado: x.empleado, Empresa: x.empresa, Período: x.periodo, Tipo: x.tipo,
    "Categoría A": r2(x.montoA), "Categoría B": r2(x.montoB), "de la cual, cuota alim.": r2(x.cuotaAlimentaria), Francos: r2(x.porFrancos), Jornal: r2(x.porJornal), Extras: r2(x.extras),
    "Bruto (partes)": r2(x.brutoCalculado), "Bruto guardado": r2(x.brutoGuardado), Diferencia: r2(x.diferencia), Pagado: r2(x.pagado), Motivo: "" })
  return g
}))
for (const x of sueldos.filas.filter(x => esSocio(x) || !delMSA(x))) crudoSueldos.push({ "Nro balance": "NO VA", "Va al resultado": "no", Bloque: esSocio(x) ? "Socios que facturan" : "Otra empresa",
  Empleado: x.empleado, Empresa: x.empresa, Período: x.periodo, Tipo: x.tipo, "Categoría A": r2(x.montoA), "Categoría B": r2(x.montoB), "de la cual, cuota alim.": r2(x.cuotaAlimentaria), Francos: r2(x.porFrancos), Jornal: r2(x.porJornal),
  Extras: r2(x.extras), "Bruto (partes)": r2(x.brutoCalculado), "Bruto guardado": r2(x.brutoGuardado), Diferencia: r2(x.diferencia), Pagado: r2(x.pagado),
  Motivo: esSocio(x) ? "El pago va a su cuenta corriente; el gasto entra por su factura (compras)" : "No es de MSA" })

// Stocks: lo del balance pasado va a gasto, lo del cierre sale (resultado = inicio − cierre)
const STOCKS = RENGLONES.filter(r => ["bienes_cambio", "insumos", "stock_ganadero"].includes(r.rubro) && r.id !== "equinos")
const resStocks = grupo("Diferencia de stocks (inicio − cierre: lo del balance pasado va a gasto, lo del cierre sale)", 1, STOCKS.map(r => {
  const vi = Number(valor("jms", r.id, CIERRE_ANT)?.importe ?? 0), vc = Number(valor("jms", r.id, CIERRE)?.importe ?? 0)
  if (!vi && !vc) return null
  return { nro: nuevoNro(), nivel: 2, texto: r.etiqueta, origen: "Nuestro · balance propio (stock inicio y cierre)", resultado: r2(vi - vc), nota: `inicio ${vi.toLocaleString("es-AR")} · cierre ${vc.toLocaleString("es-AR")}` } as Fila
}).filter(Boolean) as Fila[])

// Lo que sólo tiene el contador (fiscal)
const SOLO_CONTADOR = /ganancias\(corporate|ingresos brutos|amortizaciones|impuesto diferido|p[eé]rdida por venta bienes de uso/i
const resContador = grupo("Del contador (fiscal, sin interpretar)", 1, (contador ?? []).filter((c: any) => c.capitulo === "RESULTADOS" && SOLO_CONTADOR.test(c.denominacion))
  .map((c: any) => ({ nro: nuevoNro(), nivel: 2, texto: c.denominacion, origen: "Contador", resultado: r2(Number(c.saldo)), nota: c.cuenta } as Fila)))

hoja.push(grupo("RESULTADOS DEL EJERCICIO (signo del contador: ganancia en negativo, gasto en positivo)", 0,
  [resVentas, ...(resProvVentas ? [resProvVentas] : []), resCompras, ...(resProvCompras ? [resProvCompras] : []), resTplEgresos, resFinanciero, resSueldos, resStocks, resContador], { titulo: true }))

// ═══════════════════════════════ CUENTAS CON SOCIOS (14.1 contable + interno) ═══════════════════════════════
// Igual que Reportes → Balance arma la 14.1 (components/papeles-de-balance.tsx), y la capa interna como «I · Interno por socio».
etapa("cuentas con socios: leyendo movimientos")
const crudoSocios: FilaCrudo[] = []
type SocioRes = { clave: string; contable: number; interno: number | null; compensacion: number | null; inicio: number; nroC: string; nroI: string }
const sociosRes: SocioRes[] = []
let socios141Total: number | null = null, capaControl: number | null = null, capaSinResolver = 0
{
  const finEj = CIERRE
  const [aaF2, mmF2] = meses[11].split("-").map(Number)
  const despuesDelCierre = new Date(Date.UTC(aaF2, mmF2, 62)).toISOString().slice(0, 10)
  const comprasCC = libro.compras.map(a2 => ({ id: a2.id, fecha: a2.fecha, numero: `${a2.punto_venta ?? ""}-${a2.numero ?? ""}`, total: a2.total, cuit: a2.fuente === "historico" ? null : a2.cuit, denominacion: a2.denominacion }))
  const leidoRet = await leerCobrosYRetenciones(sb, EMPRESA, SCHEMA)
  const ventasCC = libro.ventas.map(v => { const r = retencionesDeVenta({ asiento: v, retIva: v.detalleVenta?.ret_iva ?? 0, retIibb: v.detalleVenta?.ret_iibb ?? 0 } as any, leidoRet.retenciones ?? [])
    return { id: v.id, fecha: v.fecha, numero: `${v.punto_venta ?? ""}-${v.numero ?? ""}`, total: v.total, cuit: v.cuit, retenciones: r2(r.iva + r.iibb + r.gan) } })
  const colsCC = "id, fecha, debitos, creditos, descripcion, detalle, contable, interno, comprobantes_pagados, estado, cuit:leyendas_adicionales_2, template_cuota_id"
  const leidoCC = await todo((d, h) => sb.from("msa_galicia").select(colsCC).gte("fecha", `${meses[0]}-01`).lte("fecha", finEj).not("contable", "is", null).order("id").range(d, h))
  const cuitsCC = CONTRAPARTES_DEL_BALANCE.filter((c: any) => c.porCuit).map((c: any) => `leyendas_adicionales_2.ilike.*${c.cuit}*`).join(",")
  const leidoCuit = cuitsCC ? await todo((d, h) => sb.from("msa_galicia").select(colsCC).gte("fecha", `${meses[0]}-01`).lte("fecha", finEj).or(cuitsCC).order("id").range(d, h)) : []
  const leidoPagoTj = await todo((d, h) => sb.from("msa_galicia").select(colsCC).gte("fecha", `${meses[0]}-01`).lte("fecha", finEj).is("contable", null).ilike("descripcion", "%visa%").order("id").range(d, h))
  const movsCC = [...leidoCC, ...leidoCuit, ...leidoPagoTj].filter((m, i, t) => t.findIndex(x => x.id === m.id) === i)
  const etiquetasSocio = CONTRAPARTES_DEL_BALANCE.filter((c: any) => c.socio).flatMap((c: any) => c.etiquetasContable)
  const OTRAS = [{ tabla: "santander", nombre: "MSA Santander" }, { tabla: "provincia", nombre: "MSA Provincia" }, { tabla: "caja_general", nombre: "MSA Caja General" },
    { tabla: "caja_ams", nombre: "MSA Caja AMS" }, { tabla: "caja_sigot", nombre: "MSA Caja Sigot" }]
  const deOtras: any[] = []
  for (const x of OTRAS) {
    const fs = await todo((d, h) => sb.schema("msa").from(x.tabla).select(`${colsCC}, sueldo_pago_id`).gte("fecha", `${meses[0]}-01`).lte("fecha", finEj).in("contable", etiquetasSocio).order("id").range(d, h))
    deOtras.push(...fs.map((m: any) => ({ ...m, id: `${x.tabla}:${m.id}`, cuenta: x.nombre })))
  }
  etapa("cuentas con socios: tarjeta")
  const tj = await todo((d, h) => sb.schema("msa").from("tarjeta_visa_business").select("fecha, fecha_vencimiento, descripcion, categ, contable, debitos, creditos, debitos_usd, template_id")
    .eq("tipo_fila", "movimiento").gte("fecha_vencimiento", `${meses[0]}-01`).lte("fecha_vencimiento", despuesDelCierre).order("id").range(d, h))
  const tplConPoliza = new Set((conPoliza ?? []).map((p: any) => p.template_id))
  const consumos = tj.map((x: any) => ({ vencimiento: x.fecha_vencimiento ?? null, fecha: x.fecha ?? null, descripcion: x.descripcion, categ: x.categ, contable: x.contable,
    debitos: Number(x.debitos ?? 0), creditos: Number(x.creditos ?? 0), debitosUsd: Number(x.debitos_usd ?? 0), conPoliza: !!x.template_id && tplConPoliza.has(x.template_id) }))
  const pagoTjDespues = await todo((d, h) => sb.from("msa_galicia").select(colsCC).gt("fecha", finEj).lte("fecha", despuesDelCierre).ilike("descripcion", "%visa%").order("id").range(d, h))
  const porLaTarjeta = consumosDeTarjetaComoMovimientos([...movsCC, ...pagoTjDespues] as any, consumos as any, undefined, { desde: `${meses[0]}-01`, hasta: finEj })
  comprasCC.push(...(sueldosPendientesComoCompras(periodos as any, meses) as any))
  let movsConSocios: any[] = [...movsCC.map((m: any) => ({ ...m, cuenta: "MSA Galicia cta cte" })), ...deOtras, ...porLaTarjeta]
  // la agrupadora o template de cada movimiento (para ordenar el detalle, como la app)
  const idsTpl = [...new Set(movsConSocios.map(m => m.template_cuota_id).filter(Boolean))] as string[]
  const grupoDe = new Map<string, string>()
  for (let i = 0; i < idsTpl.length; i += 100) {
    const lote = idsTpl.slice(i, i + 100)
    const { data } = await sb.from("cuotas_egresos_sin_factura").select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, cuenta_agrupadora)").or(`id.in.(${lote.join(",")}),grupo_pago_id.in.(${lote.join(",")})`)
    for (const c of data ?? []) { const g = String(c.egreso?.cuenta_agrupadora || c.egreso?.nombre_referencia || "").trim(); if (!g) continue; grupoDe.set(c.id, g); if (c.grupo_pago_id && !grupoDe.has(c.grupo_pago_id)) grupoDe.set(c.grupo_pago_id, g) }
  }
  movsConSocios = movsConSocios.map(m => m.grupo ? m : { ...m, grupo: (m.template_cuota_id && grupoDe.get(m.template_cuota_id)) || (/^Factura|^FC/i.test(String(m.comprobantes_pagados ?? "")) ? "Facturas" : "Transferencias y otros (sin template)") })
  etapa("cuentas con socios: cuentas de MA y PAM")
  const CUENTAS_SOCIOS = [{ clave: "MA", nombre: "MA caja de ahorro", schema: "ma", tabla: "ma_galicia" }, { clave: "MA", nombre: "MA VISA", schema: "ma", tabla: "tarjeta_visa", tarjeta: true },
    { clave: "PAM", nombre: "PAM caja de ahorro", schema: "public", tabla: "pam_galicia" }, { clave: "PAM", nombre: "PAM cta cte", schema: "public", tabla: "pam_galicia_cc" },
    { clave: "PAM", nombre: "PAM VISA", schema: "pam", tabla: "tarjeta_visa", tarjeta: true }]
  const cuentasSocios: any[] = []
  for (const x of CUENTAS_SOCIOS) {
    const base = () => (x.schema === "public" ? sb.from(x.tabla) : sb.schema(x.schema).from(x.tabla))
    const fs = await todo((d, h) => { let q = base().select(`id, fecha, debitos, creditos, descripcion, detalle, contable, interno, comprobantes_pagados, estado, categ${x.tarjeta ? "" : ", sueldo_pago_id"}`).gte("fecha", `${meses[0]}-01`).lte("fecha", finEj); if (x.tarjeta) q = q.eq("tipo_fila", "movimiento"); return q.order("id").range(d, h) })
    cuentasSocios.push({ clave: x.clave, nombre: x.nombre, movimientos: fs.map((r: any) => ({ ...r, grupo: String(r.categ ?? "") || undefined })) })
  }
  const conSocios = movimientosDeLosSocios(movsConSocios as any, cuentasSocios)
  let armadoCC = armarCuentasCorrientes(comprasCC as any, ventasCC as any, [...conSocios.msa, ...conSocios.delSocio] as any)
  armadoCC = abrirDesglosar(armadoCC, movsCC as any, consumos as any)
  const { data: inicioCC } = await sb.from("balance_datos_usuario").select("clave, texto").eq("empresa", EMPRESA).eq("anio_cierre", ANIO).eq("papel", "cc.saldo-inicio")
  const saldosIni = Object.fromEntries(CONTRAPARTES_DEL_BALANCE.map((c: any) => [c.clave, leerNumero((inicioCC ?? []).find((x: any) => x.clave === c.clave)?.texto)]))
  const conInicio = aplicarCierresDecididos(aplicarSaldosInicio(armadoCC, saldosIni), ANIO)
  // 🔺 con el renglón «por Libertad» de cada semestre en las cuentas de MA y PAM, como el export (A-FEAT-1595): sale del cuadro final de
  // «Gastos Libertad», que se arma con TODOS los templates (los de MSA, MA y PAM), igual que en la app.
  // el extracto del ejercicio: Libertad suma también las facturas pagadas con la marca LIB (Prosegur), como en la app
  etapa("cuentas con socios: extracto para Libertad")
  const ex = await leerExtractoDelEjercicio(sb, INICIO, CIERRE)
  const tAll = armarTemplatesDelEjercicio(cuotas, ej, { ...opciones, extracto: { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron } })
  const socios = (cuentasConLosSocios(libro, tAll, conInicio) ?? separarSocios(conInicio)).socios
  socios141Total = r2(socios.reduce((t: number, c: any) => t + c.saldoAlCierre, 0))
  // el movimiento de origen de cada asiento (para su código contable e interno)
  const origen = new Map<string, any>()
  for (const m of [...movsConSocios, ...conSocios.delSocio]) origen.set(String(m.id), m)
  etapa("cuentas con socios: capa interna")
  let capa: any = null
  try {
    const capaIn = await leerMovimientosDeLaCapa(sb, INICIO, CIERRE)
    const { fijos } = entradaDesde141(socios as any, EMPRESA)
    capa = capaInterna(capaIn.movs, fijos)
    capaControl = capa.control; capaSinResolver = capa.sinResolver.length
  } catch (e) { console.log("⚠️ capa interna no se pudo leer:", (e as Error).message) }
  for (const c of socios as any[]) {
    const q = String(c.contraparte.clave)
    const nroC = nuevoNro(), nroI = nuevoNro()
    if (c.saldoInicio) crudoSocios.push({ "Nro balance": nroC, Vista: "Contable (14.1)", Socio: q, Fecha: INICIO, Cuenta: "", Grupo: "Saldo de inicio", Concepto: c.inicioSinDato ? "sin dato (0)" : "saldo de inicio cargado", "Código contable": "", "Código interno": "", Importe: r2(c.saldoInicio), Motivo: c.inicioTentativo ?? "" })
    for (const a of c.resumen.asientos) { const m = origen.get(String(a.id))
      crudoSocios.push({ "Nro balance": nroC, Vista: "Contable (14.1)", Socio: q, Fecha: a.fecha, Cuenta: a.cuenta ?? m?.cuenta ?? "", Grupo: a.grupo ?? a.tipo, Concepto: a.concepto, "Código contable": m?.contable ?? "", "Código interno": m?.interno ?? "", Importe: r2(a.importe), Motivo: a.otraPunta ?? "" }) }
    if (c.ajusteCierre) crudoSocios.push({ "Nro balance": nroC, Vista: "Contable (14.1)", Socio: q, Fecha: CIERRE, Cuenta: "", Grupo: "Cierre decidido", Concepto: c.ajusteCierre.motivo, "Código contable": "", "Código interno": "", Importe: r2(c.ajusteCierre.importe), Motivo: "" })
    let comp: number | null = null
    if (capa && (SOCIOS_INTERNO as readonly string[]).includes(q)) {
      comp = compensacionDe(capa, q)
      crudoSocios.push({ "Nro balance": nroI, Vista: "Interno", Socio: q, Fecha: CIERRE, Cuenta: "", Grupo: "Punto de partida", Concepto: "saldo contable de la 14.1", "Código contable": "", "Código interno": "", Importe: r2(c.saldoAlCierre), Motivo: "" })
      for (const a of capa.ajustes.filter((a: any) => a.a === q || a.de === q)) { const m = a.mov
        crudoSocios.push({ "Nro balance": nroI, Vista: "Interno", Socio: q, Fecha: m.fecha, Cuenta: `${m.titular} · ${m.cuenta}`, Grupo: a.a === q ? `viene de ${a.de}` : `va a ${a.a}`, Concepto: m.detalle || m.desc || "", "Código contable": m.contable, "Código interno": m.interno, Importe: -r2(a.a === q ? a.importe : -a.importe), Motivo: a.porque }) }
      for (const x of capa.ajustes.length >= 0 ? (entradaDesde141(socios as any, EMPRESA).fijos.filter(f => f.socio === q)) : []) crudoSocios.push({ "Nro balance": nroI, Vista: "Interno", Socio: q, Fecha: CIERRE, Cuenta: "14.1", Grupo: "ajuste fijo", Concepto: x.porque, "Código contable": "", "Código interno": "", Importe: -r2(x.importe), Motivo: "en lo real no es sueldo: es dividendo (JMS 14/11)" })
    }
    sociosRes.push({ clave: q, contable: r2(c.saldoAlCierre), compensacion: comp, interno: comp == null ? null : r2(c.saldoAlCierre - comp), inicio: r2(c.saldoInicio ?? 0), nroC, nroI })
  }
  for (const s0 of conInicio.sinTratar ?? []) crudoSocios.push({ "Nro balance": "NO VA", Vista: "Sin tratar", Socio: "", Fecha: "", Cuenta: "", Grupo: "marca sin encuadrar", Concepto: s0.etiqueta, "Código contable": s0.etiqueta, "Código interno": "", Importe: r2(s0.total), Motivo: `${s0.movimientos} movimiento(s): marca del extracto que todavía no es de nadie` })
}
const resSocios: Fila[] = [
  grupo("CUENTAS CON SOCIOS · CONTABLE — la 14.1 (fuera de la ecuación · + = MSA le debe al socio · − = el socio se llevó de más)", 0, sociosRes.map(s => ({ nro: s.nroC, nivel: 1, texto: s.clave, origen: "14.1 (como Reportes → Balance)", inicio: s.inicio || null, cierre: s.contable } as Fila)), { titulo: true }),
  grupo("CUENTAS CON SOCIOS · INTERNO — la realidad (14.1 − compensación interna)", 0, sociosRes.filter(s => s.interno != null).map(s => ({ nro: s.nroI, nivel: 1, texto: s.clave, origen: "Capa interna", cierre: s.interno, nota: `compensación ${(s.compensacion ?? 0).toLocaleString("es-AR")}` } as Fila)), { titulo: true }),
]
etapa("cuentas con socios: listas; armando el Excel")
hoja.push(...resSocios)

// ═══════════════════════════════ EXCEL ═══════════════════════════════
const MONEDA = '#,##0.00;[Red]-#,##0.00;"-"'
const borde = { top: { style: "thin", color: { rgb: "BFBFBF" } } }
const wb = XLSX.utils.book_new()
const filas: unknown[][] = [], niveles: number[] = [], estilos: Array<"titulo" | "sub" | "hoja" | "cap"> = []
const HEAD = ["Nro", "Renglón", "Origen", `Inicio ${CIERRE_ANT.split("-").reverse().join("/")}`, `Cierre ${CIERRE.split("-").reverse().join("/")}`, "Resultado del ejercicio", "Control: suma del crudo", "✓", "Nota"]
filas.push([`BALANCE EN LÍNEA — FORMATO DEL CONTADOR CON NUESTROS RENGLONES — ${EMPRESA} ${ej.etiqueta} — ${VERSION} (prueba, A-FEAT-1632)`]); niveles.push(0); estilos.push("cap")
filas.push(["Los [+] / [−] de la izquierda abren y cierran cada grupo. Cada renglón con Nro se busca por ese Nro en la columna «Nro balance» de los crudos. Signo del contador: activo +, pasivo / patrimonio / ganancia −."]); niveles.push(0); estilos.push("hoja")
filas.push([]); niveles.push(0); estilos.push("hoja")
filas.push(HEAD); niveles.push(0); estilos.push("cap")
const filaDe = new Map<Fila, number>()
const crudoDe = (nroB: string): string | null => {
  if (crudoDiario.some(x => x["Nro balance"] === nroB)) return "Crudo · Diario"
  if (crudoTemplates.some(x => x["Nro balance"] === nroB)) return "Crudo · Templates"
  if (crudoSueldos.some(x => String(x["Nro balance"]).split(" ").includes(nroB))) return "Crudo · Sueldos"
  if (crudoSocios.some(x => x["Nro balance"] === nroB)) return "Crudo · Socios"
  return null
}
const COLCTRL: Record<string, string> = { "Crudo · Diario": "R", "Crudo · Templates": "K", "Crudo · Sueldos": "" }
function escribir(f: Fila) {
  if (f.hijos) {
    const desde = filas.length + 1
    for (const h of f.hijos) escribir(h)
    const hasta = filas.length
    const fm = (col: string, k: "inicio" | "cierre" | "resultado") => { const v = suma(f.hijos!, k); const cel = f.hijos!.map(h => `${col}${filaDe.get(h)}`).join("+"); return v === 0 && !f.hijos!.some(h => (h.hijos ? suma(h.hijos, k) : h[k]) != null) ? "" : { t: "n", f: cel, v, z: MONEDA } }
    filas.push(["", f.texto, "", fm("D", "inicio"), fm("E", "cierre"), fm("F", "resultado"), "", "", f.nota ?? ""])
    niveles.push(f.nivel); estilos.push(f.titulo ? "titulo" : "sub")
    filaDe.set(f, filas.length)
    void desde; void hasta
    return
  }
  const fuente = f.nro ? crudoDe(f.nro) : null
  let ctrl: unknown = "", ok: unknown = ""
  if (fuente === "Crudo · Diario" || fuente === "Crudo · Templates" || fuente === "Crudo · Socios") {
    const col = fuente === "Crudo · Diario" ? "R" : fuente === "Crudo · Templates" ? "K" : "J"
    const contra = fuente === "Crudo · Socios" ? "E" : "F"   // los socios son saldo al cierre, no resultado
    const fila = filas.length + 1
    ctrl = { t: "n", f: `SUMIFS('${fuente}'!${col}:${col},'${fuente}'!A:A,A${fila})`, z: MONEDA }
    ok = { t: "s", f: `IF(ROUND(G${fila}-${contra}${fila},2)=0,"✓","⚠️")` }
  }
  filas.push([f.nro ?? "", f.texto, f.origen ?? "", f.inicio == null ? "" : { t: "n", v: f.inicio, z: MONEDA }, f.cierre == null ? "" : { t: "n", v: f.cierre, z: MONEDA },
    f.resultado == null ? "" : { t: "n", v: f.resultado, z: MONEDA }, ctrl, ok, f.nota ?? ""])
  niveles.push(f.nivel); estilos.push("hoja")
  filaDe.set(f, filas.length)
}
for (const f of hoja) { escribir(f); filas.push([]); niveles.push(0); estilos.push("hoja") }
// la ecuación
const fA = filaDe.get(hoja[0])!, fP = filaDe.get(hoja[1])!, fN = filaDe.get(hoja[2])!, fR = filaDe.get(hoja[3])!
const totA = suma(hoja[0].hijos!, "cierre"), totP = suma(hoja[1].hijos!, "cierre"), totN = suma(hoja[2].hijos!, "cierre"), totR = suma(hoja[3].hijos!, "resultado")
filas.push(["", "ECUACIÓN: activo + pasivo + patrimonio + resultado (tiene que dar 0; no se fuerza)", "", "", { t: "n", f: `E${fA}+E${fP}+E${fN}+F${fR}`, v: r2(totA + totP + totN + totR), z: MONEDA }, "", "", "",
  "La diferencia dice cuánto falta o sobra: las cuentas con los socios (tentativas), lo que no se tomó, o diferencias de criterio con el contador."]); niveles.push(0); estilos.push("titulo")
const ws = XLSX.utils.aoa_to_sheet(filas)
ws["!rows"] = niveles.map((n, i) => ({ level: Math.min(n, 7), hidden: false, ...(i === 0 ? { hpt: 22 } : {}) }))
ws["!cols"] = [{ wch: 7 }, { wch: 62 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 4 }, { wch: 70 }]
ws["!freeze"] = { xSplit: 0, ySplit: 4 }
const rango = XLSX.utils.decode_range(ws["!ref"]!)
for (let r = 0; r <= rango.e.r; r++) for (let c = 0; c <= rango.e.c; c++) {
  const a = XLSX.utils.encode_cell({ r, c }); if (!ws[a]) continue
  const e = estilos[r], niv = niveles[r]
  ws[a].s = { font: { name: "Calibri", sz: 10, bold: e === "titulo" || e === "sub" || e === "cap", color: e === "titulo" ? { rgb: "1F3864" } : undefined },
    fill: e === "titulo" ? { fgColor: { rgb: "D9E1F2" } } : e === "sub" ? { fgColor: { rgb: "F2F2F2" } } : undefined,
    alignment: c === 1 ? { indent: niv } : c === 8 ? { wrapText: false } : undefined, border: e === "sub" || e === "titulo" ? borde : undefined }
}
XLSX.utils.book_append_sheet(wb, ws, "Balance")

// los crudos
function hojaCrudo(nombre: string, rows: FilaCrudo[], orden: string[], titulo: string, notas: string[]) {
  rows.sort((a, b) => { for (const k of orden) { const x = String(a[k] ?? ""), y = String(b[k] ?? ""); if (x !== y) return x.localeCompare(y) } return 0 })
  const cols = Object.keys(rows[0] ?? {})
  const aoa: unknown[][] = [[titulo], ...notas.map(n => [n]), [], cols, ...rows.map(r => cols.map(k => { const v = r[k]; return typeof v === "number" ? { t: "n", v, z: MONEDA } : (v ?? "") }))]
  const w = XLSX.utils.aoa_to_sheet(aoa)
  const hdr = notas.length + 2
  w["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: hdr, c: 0 }, e: { r: aoa.length - 1, c: cols.length - 1 } }) }
  w["!freeze"] = { xSplit: 0, ySplit: hdr + 1 }
  w["!cols"] = cols.map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2)) }))
  for (let c = 0; c < cols.length; c++) { const a = XLSX.utils.encode_cell({ r: hdr, c }); if (w[a]) w[a].s = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "D9E1F2" } } } }
  XLSX.utils.book_append_sheet(wb, w, nombre)
}
hojaCrudo("Crudo · Diario", crudoDiario, ["Va al resultado", "Bloque", "Totalizadora", "Cuenta", "Fecha"], `CRUDO · LIBRO DIARIO — ${EMPRESA} ${ej.etiqueta}`,
  ["Un renglón por comprobante. «Al resultado» = total − IVA (otros tributos van al gasto), con el signo del contador. Filtrá «Nro balance» para ver cómo se forma un renglón de la hoja Balance."])
hojaCrudo("Crudo · Templates", crudoTemplates, ["Va al resultado", "Bloque", "Responsable", "Agrupadora", "Template", "Fecha"], `CRUDO · TEMPLATES — todas las cuotas del ejercicio (${INICIO} a ${CIERRE}), todos los responsables`,
  ["Todo es todo: las que van al resultado de MSA tienen su Nro; las que no, «NO VA» con el motivo. Código contable e interno = los del pago conciliado."])
hojaCrudo("Crudo · Socios", crudoSocios, ["Vista", "Socio", "Fecha"], `CRUDO · CUENTAS CON SOCIOS — contable (14.1) e interno (capa) — ${EMPRESA} ${ej.etiqueta}`,
  ["Contable: cada asiento de la 14.1 (con el código contable e interno de su movimiento). Interno: el saldo contable y lo que la compensación interna le suma o le saca. Filtrá «Socio» y «Vista», o «Nro balance»."])
hojaCrudo("Crudo · Sueldos", crudoSueldos, ["Va al resultado", "Bloque", "Empleado", "Período"], `CRUDO · SUELDOS — ${EMPRESA} ${ej.etiqueta}`,
  ["Un renglón por empleado y mes. «Nro balance» lista los renglones (A, B, francos, jornal, extras) a los que suma."])

// ═══════════════════════════════ CONTROL ═══════════════════════════════
const sumaCrudo = (rows: FilaCrudo[], col: string, filtro: (r: FilaCrudo) => boolean = () => true) => r2(rows.filter(filtro).reduce((s, r) => s + Number(r[col] ?? 0), 0))
const v18 = { compras: { n: 563, total: 294180363.99, iva: 32125487.56 }, ventas: { n: 13, total: 466959423.73, iva: 19138735.93 },
  tplMSA: { egreso: 66914486.47, financiero: -32644262.55, distribucion: 54906595.00, reintegro: 2619146.77, total: 91795965.69, n: 1445 },
  sueldos: { empleados: 62865712.75, socios: 81154400.28, total: 144020113.03 } }
const tipoTot = (t: string) => r2(porTipo(t).reduce((s, c) => s + c.monto, 0))
const control: Array<[string, number | string, number | string, string]> = [
  ["Compras: cantidad de comprobantes (libro de este ejercicio)", libro.compras.length, v18.compras.n, ""],
  ["Compras: total", r2(libro.compras.reduce((s, a) => s + a.total, 0)), v18.compras.total, ""],
  ["Compras: IVA", r2(libro.compras.reduce((s, a) => s + a.iva, 0)), v18.compras.iva, ""],
  ["Ventas: cantidad", libro.ventas.length, v18.ventas.n, ""],
  ["Ventas: total", r2(libro.ventas.reduce((s, a) => s + a.total, 0)), v18.ventas.total, ""],
  ["Templates MSA: cuotas en los bloques", det.length, v18.tplMSA.n, ""],
  ["Templates MSA: egresos", tipoTot("egreso"), v18.tplMSA.egreso, ""],
  ["Templates MSA: financiero (neto de movimientos)", tipoTot("financiero"), v18.tplMSA.financiero, ""],
  ["Templates MSA: socios (retiros y aportes)", tipoTot("distribucion"), v18.tplMSA.distribucion, ""],
  ["Templates MSA: reintegros", tipoTot("reintegro"), v18.tplMSA.reintegro, ""],
  ["Templates MSA: total de los bloques", r2(det.reduce((s, c) => s + c.monto, 0)), v18.tplMSA.total, ""],
  ["Sueldos: bruto empleados (todas las empresas)", r2(sueldos.filas.filter(x => !esSocio(x)).reduce((s, x) => s + x.brutoGuardado, 0)), v18.sueldos.empleados, ""],
  ["Sueldos: bruto socios que facturan", r2(sueldos.filas.filter(esSocio).reduce((s, x) => s + x.brutoGuardado, 0)), v18.sueldos.socios, ""],
  ["Sueldos: total", r2(sueldos.total.bruto), v18.sueldos.total, ""],
  ...(["JMS", "PAM", "AMS", "MA", "COTITULARES"].map(k => { const esp: Record<string, number> = { JMS: -47074051.72, PAM: 12401959.62, AMS: -8092248.73, MA: -45593911.03, COTITULARES: -1756595.00 }
    const s0 = sociosRes.find(x => x.clave.toUpperCase().startsWith(k.slice(0, 5))); return [`Socios 14.1: ${k} (lo esperado en el v19, A-FEAT-1629 punto 43)`, s0 ? s0.contable : "no salió", esp[k], ""] as [string, number | string, number, string] })),
  ["Socios 14.1: total (esperado en el v19)", socios141Total ?? "no salió", -90114846.86, ""],
]
const todasLasCuotasEj = cuotas.filter(c => (c.fecha ?? "") >= INICIO && (c.fecha ?? "") <= CIERRE).length
const enCrudoTpl = crudoTemplates.length
const integridad: Array<[string, number, number]> = [
  ["Diario: lo que entró al balance (Ventas + Compras + provisiones) = crudo con Nro", r2(suma([resVentas, resCompras, ...(resProvVentas ? [resProvVentas] : []), ...(resProvCompras ? [resProvCompras] : [])], "resultado")), sumaCrudo(crudoDiario, "Al resultado (sin IVA)", r => r["Nro balance"] !== "NO VA")],
  ["Templates: lo que entró al balance (egresos + intereses + movimientos internos, sin ajuste FCI) = crudo con Nro", r2(suma([resTplEgresos], "resultado") + (hijosFin.length ? suma(hijosFin.filter(h => !/Inversiones/.test(h.texto)), "resultado") : 0) + r2(finInversion.reduce((s, c) => s + c.monto, 0))), sumaCrudo(crudoTemplates, "Importe", r => r["Nro balance"] !== "NO VA")],
  ["Templates: cuotas del ejercicio en la base (todos los responsables, con fecha en el ejercicio) — cuotas en el crudo", todasLasCuotasEj, enCrudoTpl],
  ...sociosRes.map(s0 => [`Socios: ${s0.clave} contable = su crudo (Nro ${s0.nroC})`, s0.contable, sumaCrudo(crudoSocios, "Importe", r => r["Nro balance"] === s0.nroC)] as [string, number, number]),
  ...sociosRes.filter(s0 => s0.interno != null).map(s0 => [`Socios: ${s0.clave} interno = su crudo (Nro ${s0.nroI})`, s0.interno as number, sumaCrudo(crudoSocios, "Importe", r => r["Nro balance"] === s0.nroI)] as [string, number, number]),
  ["Capa interna: lo que se le pone a uno se le saca a otro (tiene que dar 0)", capaControl ?? 0, 0],
  ["Sueldos: empleados de MSA en el balance = crudo con Nro (bruto guardado)", suma([resSueldos], "resultado"), sumaCrudo(crudoSueldos, "Bruto guardado", r => r["Nro balance"] !== "NO VA")],
]
const ctrl: unknown[][] = [[`CONTROL — ${EMPRESA} ${ej.etiqueta} — ${VERSION}`], [],
  ["1 · Los crudos contra el libro bajado v18 (19/11 02:33). Una diferencia puede venir de un cambio en la base después de esa descarga: se explica abajo."], [],
  ["Qué", "Este crudo", "Libro v18", "Diferencia", "✓"],
  ...control.map(([q, a, b]) => [q, typeof a === "number" ? { t: "n", v: a, z: MONEDA } : a, typeof b === "number" ? { t: "n", v: b, z: MONEDA } : b, typeof a === "number" && typeof b === "number" ? { t: "n", v: r2(a - b), z: MONEDA } : "", typeof a === "number" && typeof b === "number" ? (Math.abs(a - b) < 0.005 ? "✓" : "⚠️") : ""]),
  [], ["2 · Todo el crudo entra a un lugar: lo que va al balance contra la suma del crudo con Nro (y la cantidad contra la base)."], [],
  ["Qué", "En el balance", "En el crudo", "Diferencia", "✓"],
  ...integridad.map(([q, a, b]) => [q, { t: "n", v: a, z: MONEDA }, { t: "n", v: b, z: MONEDA }, { t: "n", v: r2(a - b), z: MONEDA }, Math.abs(a - b) < 0.005 ? "✓" : "⚠️"]),
]
const wc = XLSX.utils.aoa_to_sheet(ctrl)
wc["!cols"] = [{ wch: 95 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 5 }]
XLSX.utils.book_append_sheet(wb, wc, "Control")
wb.SheetNames = ["Balance", "Control", "Crudo · Diario", "Crudo · Templates", "Crudo · Sueldos", "Crudo · Socios"]

if (!process.argv.includes("--sin-excel")) {
  mkdirSync(CARPETA, { recursive: true })
  const archivo = join(CARPETA, `Balance formato contador ${EMPRESA} 25-26 ${VERSION}.xlsx`)
  XLSX.writeFile(wb, archivo, { cellStyles: true })
  console.log("Excel:", archivo)
}

// para la página: el árbol y los controles
const provAnteriorTotal = r2(libro.provisionesEjercicioAnterior.reduce((s, a) => s + (a.total - a.iva), 0))
const plano = (fs: Fila[]): any[] => fs.map(f => ({ nro: f.nro ?? null, texto: f.texto, nivel: f.nivel, origen: f.origen ?? null, inicio: f.hijos ? suma(f.hijos, "inicio") : f.inicio ?? null,
  cierre: f.hijos ? suma(f.hijos, "cierre") : f.cierre ?? null, resultado: f.hijos ? suma(f.hijos, "resultado") : f.resultado ?? null, nota: f.nota ?? null, hijos: f.hijos ? plano(f.hijos) : null }))
const salida = { version: VERSION, generado: new Date().toISOString(), empresa: EMPRESA, ejercicio: ej.etiqueta, arbol: plano(hoja),
  ecuacion: { activo: totA, pasivo: totP, pn: totN, resultado: totR, diferencia: r2(totA + totP + totN + totR) },
  control: control.map(([q, a, b]) => ({ q, a, b })), integridad: integridad.map(([q, a, b]) => ({ q, a, b })),
  financieroNoVa: finNoVa.length, dolares: r2(finDolares.reduce((s, c) => s + c.monto, 0)), inversiones: [...new Set(finInversion.map(c => c.concepto))], provAnterior: libro.provisionesEjercicioAnterior.length, provAnteriorTotal, provAnteriorDetalle: libro.provisionesEjercicioAnterior.map(a => `${a.denominacion} ${a.fecha} $ ${r2(a.total - a.iva).toLocaleString("es-AR")}`),
  crudos: { diario: crudoDiario.length, templates: crudoTemplates.length, sueldos: crudoSueldos.length, socios: crudoSocios.length }, socios: sociosRes, capaSinResolver }
// 🔎 el detalle de cada renglón, para la página (el crudo por Nro): [fecha, quién / qué, importe, bloque]
const CRUDO_OUT = process.argv.find(a => a.startsWith("--crudo="))?.slice(8)
if (CRUDO_OUT) {
  const porNro: Record<string, unknown[][]> = {}
  const push = (k: string, fila: unknown[]) => { (porNro[k] ??= []).push(fila) }
  for (const r of crudoDiario) push(String(r["Nro balance"]) === "NO VA" ? "NO VA · " + r.Bloque : String(r["Nro balance"]), [r.Fecha, `${r.Contraparte} · ${r.Comprobante}`, r["Al resultado (sin IVA)"] || r.Total, r.Motivo || ""])
  for (const r of crudoTemplates) push(String(r["Nro balance"]) === "NO VA" ? "NO VA · " + r.Bloque : String(r["Nro balance"]), [r.Fecha, `${r.Template} · ${r["Quién pagó"] || "sin pago"}${r["Código contable"] ? " · " + r["Código contable"] : ""}`, r.Importe, r.Motivo || r.Estado || ""])
  for (const r of crudoSocios) push(String(r["Nro balance"]) === "NO VA" ? "NO VA · " + r.Grupo : String(r["Nro balance"]), [r.Fecha, `${r.Concepto}${r["Código contable"] ? " · " + r["Código contable"] : ""}${r["Código interno"] ? " / " + r["Código interno"] : ""}`, r.Importe, r.Grupo || ""])
  for (const r of crudoSueldos) for (const k of String(r["Nro balance"]).split(" ")) push(k === "NO VA" ? "NO VA · " + r.Bloque : k, [r["Período"], `${r.Empleado} (${r.Tipo})`, r["Bruto guardado"], r.Motivo || ""])
  writeFileSync(CRUDO_OUT, JSON.stringify(porNro))
}
const JSON_OUT = process.argv.find(a => a.startsWith("--json="))?.slice(7)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(salida, null, 1))
console.log(JSON.stringify({ ecuacion: salida.ecuacion, control: salida.control, integridad: salida.integridad, inversiones: salida.inversiones, crudos: salida.crudos, provAnterior: salida.provAnterior }, null, 1))
