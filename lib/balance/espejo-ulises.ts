/**
 * 🔁 A-FEAT-1571 PASO 3 — EL ESPEJO DE ULISES → LA CARPETA SEGURA (JMS 06/11: «bancos y entidades es la que va. Lo que podemos
 * hacer es que el sistema copie a la carpeta segura. Ulises debería trabajar desde un espejo y el sistema llevarlo adentro
 * conservando el espejo»).
 *
 * Ulises baja cada mes los resúmenes de Galicia de MSA a su carpeta («Subdiarios - Documentacion (Ulises) / Martinez Sobrado
 * Agro S.R.L / Banco Galicia / Resumenes y extractos / <año> / CC Pesos · CC Dolares · Inversiones · Tarjetas»). Esto decide,
 * POR EL NOMBRE del archivo, a qué cuenta y a qué mes corresponde, y a qué carpeta de la carpeta segura va
 * («BANCO GALICIA SM / extractos 25-26 / Pesos»…). Lo que ya está vinculado no se vuelve a copiar.
 *
 * Pura (sin Drive ni base): el GAS lista y copia, la ruta del servidor vincula. Nunca mueve ni borra nada del espejo.
 */

export interface ArchivoDelEspejo { id: string; nombre: string }

export interface ReglaDelEspejo {
  /** El nombre del archivo; el primer grupo es el año (AA) y el segundo el mes (MM). */
  patron: RegExp
  cuenta: string
  tipo: "extracto" | "resumen_usd" | "resumen_fci" | "resumen_tarjeta"
  /** La subcarpeta adentro de «extractos AA-AA». */
  subcarpeta: string
}

/** Las reglas de MSA (la convención de nombres de Ulises, la misma de 24-25). */
export const REGLAS_ESPEJO_MSA: ReglaDelEspejo[] = [
  { patron: /^CC_pesos_(\d{2})-(\d{2})\.pdf$/i, cuenta: "BANCO GALICIA (cta cte)", tipo: "extracto", subcarpeta: "Pesos" },
  { patron: /^CA_dolar_(\d{2})-(\d{2})\.pdf$/i, cuenta: "MSA Cuenta Corriente USD", tipo: "resumen_usd", subcarpeta: "USS" },
  { patron: /^Inv_(\d{2})-(\d{2})\.pdf$/i, cuenta: "FCI FIMA Premium A", tipo: "resumen_fci", subcarpeta: "Inversiones" },
  { patron: /^(\d{2})-(\d{2}) - VISA BUISNESS\.pdf$/i, cuenta: "Tarjeta VISA Business MSA", tipo: "resumen_tarjeta", subcarpeta: "Resumenes VISA" },
  { patron: /^(\d{2})-(\d{2}) - VISA RURAL\.pdf$/i, cuenta: "Tarjeta VISA Rural MSA", tipo: "resumen_tarjeta", subcarpeta: "VISA AGRO" },
]

/** «extractos 25-26» para un mes: de julio a junio (ejercicio de MSA). */
export function carpetaDelEjercicio(anio2: number, mes: number): string {
  const desde = mes >= 7 ? anio2 : anio2 - 1
  const dd = (n: number) => String(n).padStart(2, "0")
  return `extractos ${dd(desde)}-${dd(desde + 1)}`
}

export interface CopiaPlaneada {
  file_id: string
  /** Relativa a la carpeta del banco: «extractos 25-26/Pesos». */
  subcarpeta: string
  nombre: string
  cuenta: string
  periodo: string
  tipo: ReglaDelEspejo["tipo"]
}

/**
 * Qué hay que copiar: los archivos del espejo que siguen una regla y cuyo (cuenta, mes, tipo) todavía no está vinculado.
 * `desde` (AAAA-MM) deja afuera lo viejo (por default, el ejercicio 25/26 en adelante). Los que no siguen ninguna regla se
 * devuelven aparte: no se copian, se avisan (un nombre distinto es un archivo que el sistema no sabe ubicar).
 */
export function planDelEspejo(
  archivos: ArchivoDelEspejo[],
  vinculados: Array<{ cuenta: string; periodo: string; tipo: string }>,
  reglas: ReglaDelEspejo[] = REGLAS_ESPEJO_MSA,
  desde = "2025-07",
): { copiar: CopiaPlaneada[]; sinRegla: string[] } {
  const ya = new Set(vinculados.map(v => `${v.cuenta}|${v.periodo}|${v.tipo}`))
  const copiar: CopiaPlaneada[] = [], sinRegla: string[] = []
  const vistos = new Set<string>()
  for (const a of archivos) {
    const r = reglas.find(x => x.patron.test(a.nombre))
    if (!r) { if (/\.pdf$/i.test(a.nombre)) sinRegla.push(a.nombre); continue }
    const m = r.patron.exec(a.nombre)!
    const aa = Number(m[1]), mm = Number(m[2])
    if (!(mm >= 1 && mm <= 12)) { sinRegla.push(a.nombre); continue }
    const periodo = `20${m[1]}-${m[2]}`
    if (periodo < desde) continue
    const clave = `${r.cuenta}|${periodo}|${r.tipo}`
    if (ya.has(clave) || vistos.has(clave)) continue
    vistos.add(clave)
    copiar.push({ file_id: a.id, subcarpeta: `${carpetaDelEjercicio(aa, mm)}/${r.subcarpeta}`, nombre: a.nombre, cuenta: r.cuenta, periodo, tipo: r.tipo })
  }
  copiar.sort((x, y) => x.periodo.localeCompare(y.periodo) || x.cuenta.localeCompare(y.cuenta))
  return { copiar, sinRegla }
}

/**
 * 🔔 La alerta ANTES: qué cuentas no tienen todavía el resumen del mes anterior. A partir del día 15 del mes, el resumen del
 * mes anterior ya tendría que estar (Ulises los baja a mediados de mes). Devuelve «cuenta: AAAA-MM».
 */
export function resumenesQueFaltan(
  vinculados: Array<{ cuenta: string; periodo: string }>,
  hoy: string,
  reglas: ReglaDelEspejo[] = REGLAS_ESPEJO_MSA,
): string[] {
  const [a, m, d] = hoy.split("-").map(Number)
  const atras = d >= 15 ? 1 : 2
  const fecha = new Date(Date.UTC(a, m - 1 - atras, 1))
  const esperado = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`
  const cuentas = [...new Set(reglas.map(r => r.cuenta))]
  return cuentas.filter(c => !vinculados.some(v => v.cuenta === c && v.periodo === esperado)).map(c => `${c}: ${esperado}`)
}
