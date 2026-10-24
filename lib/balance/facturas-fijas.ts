/**
 * 🔢 CONTROL DE CANTIDAD — ¿están todas las facturas de los proveedores FIJOS? (A-FEAT-1332)
 *
 * Usuario 2026-10-23: *«ver la cantidad de facturas que debe haber. Mayor énfasis en las que no
 * informa ARCA porque dependen de imputarlas a mano y pueden ser olvidadas… tomamos 12 facturas por su
 * vencimiento o por su período, pero siempre 12 y nunca 13 ni 11 para algo mensual»*. Y 2026-10-24:
 * *«que se corra en el balance… también durante el año… como una especie de warning»*.
 *
 * 📌 Cuántas trae cada uno por mes vive en la ficha del proveedor (`public.proveedores.facturas_por_mes`,
 * null = no es fijo; editable). Se cuenta lo que es **gasto del ejercicio**: las de sus 12 subdiarios
 * más las provisionadas. El mes de cada factura es el de su **fecha**.
 *
 * 🚦 **AVISA, no frena**: una diferencia puede tener explicación de negocio (la de junio facturada el 1º
 * de julio). Durante el año sólo cuenta los **meses ya terminados**.
 */

export interface ProveedorFijo {
  cuit: string
  nombre: string
  facturasPorMes: number
}

export interface FacturaParaContar {
  cuit: string
  fecha: string | null
  punto_venta: number | null
  numero: number | null
  tipo: number | null
  /** true = cargada a mano («No Informada» en ARCA); undefined = no se sabe (sistema anterior). */
  no_informada?: boolean
}

export interface MesContado { mes: string; hay: number; esperado: number }

export interface FilaFacturasFijas {
  cuit: string
  nombre: string
  facturasPorMes: number
  /** La mayoría de sus facturas se carga a mano: son las que se olvidan (van en rojo). */
  aMano: boolean
  mesesContados: number
  esperado: number
  /** Sin repetidas, dentro de los meses contados. */
  hay: number
  meses: MesContado[]
  /** Gasto del ejercicio con fecha ANTERIOR al ejercicio (ej. el servicio de junio facturado el 1/7). */
  conFechaAnterior: number
  /** Gasto del ejercicio con fecha POSTERIOR a los meses contados (provisiones). No suman a «hay». */
  conFechaPosterior: number
  /** Mismo tipo + punto de venta + número más de una vez. */
  repetidas: number
  ok: boolean
}

const soloDigitos = (s: string) => (s || "").replace(/\D/g, "")

/**
 * @param meses los meses del ejercicio que ya terminaron (`AAAA-MM`), en orden. Al cierre son los 12.
 */
export function controlarFacturasFijas(
  facturas: FacturaParaContar[],
  fijos: ProveedorFijo[],
  meses: string[],
): FilaFacturasFijas[] {
  const primero = meses[0] ?? ""
  const ultimo = meses[meses.length - 1] ?? ""
  return fijos.map(p => {
    const cuit = soloDigitos(p.cuit)
    const suyas = facturas.filter(f => soloDigitos(f.cuit) === cuit)
    const vistos = new Set<string>()
    let repetidas = 0
    const unicas: FacturaParaContar[] = []
    for (const f of suyas) {
      const k = `${f.tipo ?? ""}|${f.punto_venta ?? ""}|${f.numero ?? ""}`
      if (f.numero != null && vistos.has(k)) { repetidas++; continue }
      vistos.add(k); unicas.push(f)
    }
    const mesDe = (f: FacturaParaContar) => (f.fecha ?? "").slice(0, 7)
    const porMes = meses.map(m => ({ mes: m, hay: unicas.filter(f => mesDe(f) === m).length, esperado: p.facturasPorMes }))
    const conFechaAnterior = unicas.filter(f => mesDe(f) && mesDe(f) < primero).length
    const conFechaPosterior = unicas.filter(f => mesDe(f) > ultimo).length
    const hay = porMes.reduce((s, m) => s + m.hay, 0)
    const esperado = p.facturasPorMes * meses.length
    const conDato = suyas.filter(f => f.no_informada !== undefined)
    const aMano = conDato.length > 0 && conDato.filter(f => f.no_informada).length * 2 > conDato.length
    return {
      cuit: p.cuit, nombre: p.nombre, facturasPorMes: p.facturasPorMes, aMano,
      mesesContados: meses.length, esperado, hay, meses: porMes,
      conFechaAnterior, conFechaPosterior, repetidas,
      ok: hay === esperado && repetidas === 0 && conFechaAnterior === 0,
    }
  })
}

/** Lo que pasa con un proveedor, en una línea y en el idioma del usuario. */
export function explicarFila(f: FilaFacturasFijas): string {
  if (f.ok) return `${f.hay} de ${f.esperado}`
  const partes: string[] = [`${f.hay} de ${f.esperado}`]
  const menos = f.meses.filter(m => m.hay < m.esperado).map(m => `${nombreMes(m.mes)} (${m.hay})`)
  const mas = f.meses.filter(m => m.hay > m.esperado).map(m => `${nombreMes(m.mes)} (${m.hay})`)
  if (menos.length) partes.push(`con menos: ${menos.join(", ")}`)
  if (mas.length) partes.push(`con más: ${mas.join(", ")}`)
  if (f.conFechaAnterior) partes.push(`${f.conFechaAnterior} con fecha anterior al ejercicio`)
  if (f.repetidas) partes.push(`${f.repetidas} repetida(s)`)
  return partes.join(" · ")
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1] ?? "?"}-${m.slice(2, 4)}`

/**
 * Los meses del ejercicio que ya terminaron a la fecha `hoy` (`AAAA-MM-DD`, día argentino). Un mes
 * cuenta cuando ya pasó entero: en octubre se controla hasta septiembre.
 */
export function mesesTerminados(subdiarios: string[], hoy: string): string[] {
  const mesActual = hoy.slice(0, 7)
  return subdiarios.filter(m => m < mesActual)
}
