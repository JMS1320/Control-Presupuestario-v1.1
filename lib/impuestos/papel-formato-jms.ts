/**
 * 🎨 **EL PAPEL DE INMOBILIARIO, RED VIAL Y AUTOMOTORES CON LA ESTÉTICA DE JMS** — A-FEAT-1516 (02/11).
 *
 * JMS: *«yo te di mi excel como formato para este papel… en ese formato yo ya reconocía enseguida dónde ir a ver… la idea era
 * conservar la estética del otro»* (planilla «INMOBILIARIO RED VIAL AUTOMOTOR 2026»). Sobre la maqueta: *«la estética está
 * perfecta»*; las partidas, las del sistema.
 *
 * La línea de colores (tema Office de su planilla, translúcidos), para dónde va el ojo:
 * | Color | Qué |
 * |---|---|
 * | salmón | lo del AÑO ANTERIOR y el % de aumento |
 * | verde translúcido | cuotas del año pagadas o conciliadas, y los totales del año |
 * | verde muy claro | cuota a pagar, todavía no vencida |
 * | rojizo | cuota VENCIDA sin pagar |
 * | azul grisáceo | vencimientos |
 * | celeste | el costo anual ($, por ha, u$s, u$s por ha) |
 * | celeste fuerte | encabezados |
 * | gris | identificación (partida, cuenta de la municipalidad, patente) |
 * | amarillo | lo que se carga a mano (el TC) |
 *
 * Pura: recibe los papeles ya armados (`armarPapel`) y devuelve celdas con estilo (xlsx-js-style), uniones y anchos. La usan el
 * botón «Excel» del papel y el libro H del balance — un solo armado (§ Centralizar).
 */
import { estadoDePlanilla } from "./planilla"
import { TITULO_PAPEL, type Papel, type TipoPapel } from "./papel-inmobiliario"

export const COLOR_JMS = {
  anterior: "FFFBD5B5", pagada: "FFD7E4BD", futura: "FFEBF1DE", vencida: "FFF2DCDB", vto: "FFDCE6F2",
  costo: "FFDBEEF4", encabezado: "FFB7DEE8", ident: "FFD9D9D9", manual: "FFFFFF00",
} as const

/** Dónde está cada partida: establecimiento (la ZONA de su planilla) y parcela — del maestro `public.partidas`. */
export type UbicacionPartidas = Record<string, { establecimiento: string | null; parcela: string | null }>

export interface HojaConEstilo {
  filas: unknown[][]
  /** Uniones de celdas en coordenadas de 0 (como `!merges` de SheetJS). */
  uniones: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
  anchos: number[]
  /** Filas a inmovilizar arriba (el encabezado del primer año). */
  congelarFilas: number
}

const PESOS = '_ "$" * #,##0.00_ ;_ "$" * -#,##0.00_ ;_ "$" * "-"??_ ;_ @_ '
const PESOS0 = '_ "$" * #,##0_ ;_ "$" * -#,##0_ ;_ "$" * "-"??_ ;_ @_ '
const fino = { style: "thin", color: { rgb: "FFA6A6A6" } }
const medio = { style: "medium", color: { rgb: "FF000000" } }
const BORDE = { top: fino, bottom: fino, left: fino, right: fino }
const fondo = (rgb?: string) => (rgb ? { fill: { patternType: "solid", fgColor: { rgb } } } : {})
const col = (i: number) => { let s = "", n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }

/** Una celda con estilo: valor o fórmula, fondo, formato, negrita y tamaño. */
function c(v: unknown, o: { rgb?: string; z?: string; b?: boolean; sz?: number; f?: string; borde?: boolean; al?: Record<string, unknown> } = {}) {
  const s: Record<string, unknown> = { font: { name: "Calibri", sz: o.sz ?? 10, bold: !!o.b }, ...fondo(o.rgb), ...(o.borde === false ? {} : { border: BORDE }), ...(o.al ? { alignment: o.al } : {}) }
  if (o.z) s.numFmt = o.z
  if (o.f) return { t: "n", f: o.f, v: typeof v === "number" ? v : undefined, z: o.z, s }
  if (typeof v === "number") return { t: "n", v, z: o.z, s }
  return { t: "s", v: v == null ? "" : String(v), s }
}

const TITULO: Record<TipoPapel, (a: number) => string> = {
  inmobiliario: a => `INMOBILIARIO ${a}`,
  "red-vial": a => `R E D    V I A L    ${a}`,
  automotores: a => `I M P U E S T O   A U T O M O T O R   ${a}`,
}
/** Cómo se arma el papel: el de la app (completo) o el del libro H. */
export interface OpcionesPapelJms {
  /**
   * 🧾 JMS 11/11 (notas en el papel del H): sin TOTAL año anterior · Pago anual · TOTAL en cuotas · AUMENTO % («si no tenemos para
   * llenarlos bien, mejor no lo pongamos»), sin el costo anual en $ / por ha / en US$ ni el TC («es un estudio que nos queda en nuestras
   * vistas de impuestos desde la app; acá molesta») y con sus anchos de columna.
   */
  paraH?: boolean
}

/** Una cuota ADICIONAL (la 5ª que agregó ARBA en 2025, aparte de las 4/4 o del pago anual): va en su columna, no en la 1/4. */
const esAdicional = (q: { adicional?: boolean }) => !!q.adicional

/**
 * Las filas de UN año con la estética de JMS, desde `filaInicial` (base 1). Columnas: ZONA · CAMPO · # · HAS · PARTIDA (o
 * CUENTA / PATENTE) · PARCELA · [TOTAL año ant. · Pago anual · TOTAL en cuotas · AUMENTO %] · Cuota/Vto × n · [ADICIONAL/Vto] ·
 * [(hueco) · Costo anual $ · x ha $ · u$s · x ha u$s]. Lo de corchetes no va en el libro H (`paraH`); la ADICIONAL, sólo si hay.
 */
function anioJms(p: Papel, ubic: UbicacionPartidas, hoy: string, filaInicial: number, nReg: number, nAd: number, uniones: HojaConEstilo["uniones"], H: boolean): unknown[][] {
  const f: unknown[][] = []
  const fila = () => filaInicial + f.length
  const n = Math.max(1, nReg)
  const C_CUOTA = H ? 6 : 10, C_ADIC = C_CUOTA + 2 * n, C_GAP = C_ADIC + 2 * nAd, C_COSTO = C_GAP + 1
  const ident = p.tipo === "red-vial" ? "CUENTA (Municipalidad)" : p.tipo === "automotores" ? "PATENTE" : "PARTIDA"
  const campo = p.tipo === "automotores" ? "VEHÍCULO" : "CAMPO"
  f.push([null, c(TITULO[p.tipo](p.anio), { b: true, sz: p.tipo === "inmobiliario" ? 20 : 18, borde: false })])
  const rTc = fila()
  if (!H) f.push([null, c("TC promedio", { rgb: COLOR_JMS.manual, b: true }), c(p.tcPromedio ?? "", { rgb: COLOR_JMS.manual, z: "#,##0.00" })])
  f.push([])
  const enc: Array<[string, string]> = [["ZONA", COLOR_JMS.encabezado], [campo, COLOR_JMS.encabezado], ["#", COLOR_JMS.encabezado], ["HAS", COLOR_JMS.encabezado],
    [ident, COLOR_JMS.ident], ["PARCELA", COLOR_JMS.ident]]
  if (!H) enc.push([`TOTAL ${p.anio - 1}`, COLOR_JMS.anterior], [`Pago anual ${p.anio}`, COLOR_JMS.pagada], [`TOTAL ${p.anio} en cuotas`, COLOR_JMS.pagada], ["AUMENTO %", COLOR_JMS.anterior])
  for (let k = 0; k < n; k++) enc.push([`CUOTA ${k + 1}/${n}`, COLOR_JMS.pagada], ["Vto.", COLOR_JMS.vto])
  for (let k = 0; k < nAd; k++) enc.push([nAd > 1 ? `CUOTA ADICIONAL ${k + 1}` : "CUOTA ADICIONAL", COLOR_JMS.pagada], ["Vto.", COLOR_JMS.vto])
  const estEnc = (rgb: string) => ({ font: { name: "Calibri", sz: 9, bold: true }, ...fondo(rgb), border: { ...BORDE, bottom: medio }, alignment: { wrapText: true, horizontal: "center", vertical: "center" } })
  const fEnc: unknown[] = enc.map(([t, rgb]) => ({ t: "s", v: t, s: estEnc(rgb) }))
  if (!H) {
    fEnc[C_GAP] = null
    for (const [k, t] of ["Costo anual $", "Costo anual x ha $", "Costo anual u$s", "Costo anual x ha u$s"].entries()) fEnc[C_COSTO + k] = { t: "s", v: t, s: estEnc(COLOR_JMS.encabezado) }
  }
  f.push(fEnc)
  const L = (i: number) => col(i)
  for (const b of p.bloques) {
    f.push([null, c(b.empresa === "MSA" ? "SAN MANUEL (MSA)" : b.empresa, { b: true, sz: 14, borde: false })])
    const desde = fila()
    let zonaDesde = -1, zonaActual: string | null = null, nro = 0
    const cerrarZona = (hasta: number) => { if (zonaDesde >= 0 && hasta > zonaDesde) uniones.push({ s: { r: zonaDesde - 1, c: 0 }, e: { r: hasta - 1, c: 0 } }) }
    const ubicDe = (x: Papel["bloques"][number]["filas"][number]) => (x.partida && ubic[x.partida]) || ubic[`campo:${x.campo.toLowerCase()}`] || { establecimiento: null, parcela: null }
    // Agrupadas por ZONA, como en su planilla (la zona en el orden en que aparece; sin zona al final; el complementario último).
    const ordenZona = new Map<string, number>()
    for (const x of b.filas) { const z = ubicDe(x).establecimiento ?? "~"; if (!ordenZona.has(z)) ordenZona.set(z, ordenZona.size) }
    const filasOrdenadas = b.filas.map((x, i) => ({ x, i })).sort((a, b2) =>
      Number(a.x.complementario) - Number(b2.x.complementario)
      || (ordenZona.get(ubicDe(a.x).establecimiento ?? "~")! + (ubicDe(a.x).establecimiento ? 0 : 1000)) - (ordenZona.get(ubicDe(b2.x).establecimiento ?? "~")! + (ubicDe(b2.x).establecimiento ? 0 : 1000))
      || a.i - b2.i).map(y => y.x)
    const celdaCuota = (q: Papel["bloques"][number]["filas"][number]["cuotas"][number] | undefined): unknown[] => {
      if (!q) return [c("", {}), c("", {})]
      const est = estadoDePlanilla(q.estado)
      const rgb = est === "conciliada" || est === "pagada" ? COLOR_JMS.pagada : q.vencimiento < hoy ? COLOR_JMS.vencida : COLOR_JMS.futura
      return [c(q.monto, { rgb, z: PESOS }), c(q.vencimiento.split("-").reverse().join("/"), { rgb: COLOR_JMS.vto, z: "dd/mm/yyyy" })]
    }
    for (const x of filasOrdenadas) {
      const r = fila()
      const u = ubicDe(x)
      const zona = x.complementario ? null : u.establecimiento
      if (zona !== zonaActual) { cerrarZona(r - 1); zonaActual = zona; zonaDesde = zona ? r : -1 }
      const regulares = x.cuotas.filter(q => !esAdicional(q)), adicionales = x.cuotas.filter(esAdicional)
      const cuotas: unknown[] = []
      for (let k = 0; k < n; k++) cuotas.push(...celdaCuota(regulares[k]))
      for (let k = 0; k < nAd; k++) cuotas.push(...celdaCuota(adicionales[k]))
      const rangoCuotas = Array.from({ length: n + nAd }, (_, k) => `${L(C_CUOTA + 2 * k)}${r}`).join(",")
      const filaX: unknown[] = [
        c(zona === zonaActual && zonaDesde === r ? zona : "", { b: true, al: { vertical: "center", wrapText: true } }),
        c(x.complementario ? "COMPLEMENTARIO" : x.campo.toUpperCase(), { b: x.complementario }), c(x.complementario ? "" : ++nro),
        c(x.has ?? "", { z: "0.00" }), c(x.partida ?? "", { rgb: COLOR_JMS.ident }), c(u.parcela ?? "", { rgb: COLOR_JMS.ident }),
        ...(H ? [] : [
          c(x.totalAnterior, { rgb: COLOR_JMS.anterior, z: PESOS }), c(x.pagoAnual ?? 0, { rgb: COLOR_JMS.pagada, z: PESOS }),
          c(x.totalCuotas, { rgb: COLOR_JMS.pagada, z: PESOS, f: `SUM(${rangoCuotas})` }),
          c(x.aumento ?? "", { rgb: COLOR_JMS.anterior, z: "0%", f: `IF(G${r}>0,(H${r}+I${r})/G${r}-1,"")` })]),
        ...cuotas,
        ...(H ? [] : [null,
          c(x.costoAnual, { rgb: COLOR_JMS.costo, z: PESOS, f: `H${r}+I${r}` }),
          c(x.costoHa ?? "", { rgb: COLOR_JMS.costo, z: PESOS0, f: `IF(N(D${r})>0,${L(C_COSTO)}${r}/D${r},"")` }),
          c(x.costoUsd ?? "", { rgb: COLOR_JMS.costo, z: "#,##0.00", f: `IF(N($C$${rTc})>0,${L(C_COSTO)}${r}/$C$${rTc},"")` }),
          c(x.costoHaUsd ?? "", { rgb: COLOR_JMS.costo, z: "#,##0.00", f: `IF(AND(N(D${r})>0,N($C$${rTc})>0),${L(C_COSTO + 2)}${r}/D${r},"")` })]),
      ]
      f.push(filaX)
    }
    cerrarZona(fila() - 1)
    const hasta = fila() - 1
    const r = fila()
    const tot = (i: number, z: string, v?: number) => ({ t: "n", f: `SUM(${L(i)}${desde}:${L(i)}${hasta})`, v, s: { font: { name: "Calibri", sz: 10, bold: true }, numFmt: z, border: { ...BORDE, top: medio, bottom: { style: "double", color: { rgb: "FF000000" } } } } })
    const filaT: unknown[] = [null, c(`TOTAL ${b.empresa}`, { b: true }), null, tot(3, "0.00"), null, null]
    if (!H) filaT.push(tot(6, PESOS, b.totalAnterior), tot(7, PESOS), tot(8, PESOS), c("", { rgb: COLOR_JMS.anterior, z: "0%", f: `IF(G${r}>0,(H${r}+I${r})/G${r}-1,"")` }))
    for (let k = 0; k < n + nAd; k++) filaT.push(tot(C_CUOTA + 2 * k, PESOS), null)
    if (!H) filaT.push(null, tot(C_COSTO, PESOS, b.total), null, tot(C_COSTO + 2, "#,##0.00"))
    f.push(filaT, [])
  }
  return f
}

/** Los anchos de la planilla de JMS para `maxCuotas` cuotas (+ las adicionales). En el H, sin las columnas de estudio y con sus anchos (11/11). */
export function anchosJms(maxCuotas: number, nAd = 0, H = false): number[] {
  const n = Math.max(1, maxCuotas)
  const cuotas = Array.from({ length: n + nAd }, () => [14, 11]).flat()
  return H ? [18, 26, 8, 9, 13, 8.6, ...cuotas] : [18, 26, 5, 9, 15, 10, 16, 15, 16, 9, ...cuotas, 2, 16, 13, 13, 13]
}

/**
 * La hoja completa: uno o más años apilados con la estética de JMS, y al pie las filas que se le pasen (el control cruzado del
 * libro H). `hoy` decide qué cuota sin pagar está vencida (rojiza) y cuál todavía no (verde muy claro).
 */
export function hojaPapelJms(papeles: Papel[], ubic: UbicacionPartidas, hoy: string, pie: unknown[][] = [], o: OpcionesPapelJms = {}): HojaConEstilo {
  const filasDe = (p: Papel) => p.bloques.flatMap(b => b.filas)
  const nReg = Math.max(1, ...papeles.flatMap(p => filasDe(p).map(x => x.cuotas.filter(q => !esAdicional(q)).length)))
  const nAd = Math.max(0, ...papeles.flatMap(p => filasDe(p).map(x => x.cuotas.filter(esAdicional).length)))
  const uniones: HojaConEstilo["uniones"] = []
  const filas: unknown[][] = []
  for (const p of papeles) {
    if (p.bloques.length === 0) { filas.push([null, c(`${TITULO_PAPEL[p.tipo]} ${p.anio}: sin cuotas`, { b: true, borde: false })], []); continue }
    filas.push(...anioJms(p, ubic, hoy, filas.length + 1, nReg, nAd, uniones, !!o.paraH), [])
  }
  // El pie (control cruzado): texto en negrita la primera fila, montos con formato de pesos.
  pie.forEach((r, i) => filas.push(r.map(v => (v && typeof v === "object") ? v
    : typeof v === "number" ? { t: "n", v, z: PESOS, s: { numFmt: PESOS } }
    : v == null || v === "" ? v : { t: "s", v: String(v), s: { font: { bold: i === 0, sz: i === 0 ? 11 : 10 } } })))
  return { filas, uniones, anchos: anchosJms(nReg, nAd, !!o.paraH), congelarFilas: o.paraH ? 3 : 4 }
}

/** Para un solo papel (el botón «Excel» de la pantalla): misma estética. */
export const hojaPapelJmsUnAnio = (p: Papel, ubic: UbicacionPartidas, hoy: string) => hojaPapelJms([p], ubic, hoy)
