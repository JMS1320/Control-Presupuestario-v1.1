/**
 * 💲 Del DOCUMENTO a la CUOTA — A-FEAT-1442 etapa 3 (JMS 31/10: leer el PDF de cada tipo y proponer el monto de la
 * cuota de su template, editable).
 *
 * Cumple «Importar un documento» (CLAUDE.md): **nunca rechaza** (devuelve lo que pudo leer y los candidatos), **todo
 * se puede corregir** (la pantalla muestra importe y vencimiento editables), **las cuentas se hacen bien igual**, y
 * **deja HUELLA**: lo leído al lado de lo aplicado y de lo que tenía la cuota, en el registro del mail.
 *
 * Un lector GENÉRICO por etiquetas (total a pagar, importe, vencimiento…), no uno por emisor: los documentos de
 * servicios, expensas, ABL, Red Vial y del contador cambian de forma, y la huella dice dónde falla para afinarlo.
 */

export interface CandidatoImporte { monto: number; etiqueta: string; puntaje: number }
export interface CandidatoFecha { fecha: string; etiqueta: string; esVencimiento: boolean }
export interface Lectura {
  importe: number | null
  vencimiento: string | null      // 'AAAA-MM-DD'
  periodo: string | null          // 'MM/AAAA' si se ve
  importes: CandidatoImporte[]
  fechas: CandidatoFecha[]
  aviso: string | null
}

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Pura: '1.234.567,89' → 1234567.89 (es-AR). */
export function montoAr(s: string): number {
  return parseFloat(String(s).replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0
}

// Cuánto pesa cada etiqueta para decidir cuál es «el» importe. Lo primero que diga «a pagar» gana.
const ETIQUETAS_IMPORTE: [RegExp, number][] = [
  [/total a pagar|importe a pagar|monto a pagar|neto a pagar|saldo a pagar/, 100],
  [/1(er|°|º)?\.? ?venc/, 80],
  [/total (del )?(periodo|mes|liquidacion|expensas?|cuota|factura)/, 70],
  [/importe (total|de la cuota)|total general/, 65],
  [/\btotal\b/, 50],
  [/\bimporte\b|\bmonto\b/, 40],
  [/\bsaldo\b/, 30],
]
// Lo que NUNCA es el importe a pagar aunque tenga número con coma
const NO_ES_IMPORTE = /iva|percepcion|retencion|alicuota|valuacion|base imponible|interes|recargo|2(do|°|º)\.? ?venc|anterior|pagado|cuit|telefono|cbu|suministro/

/**
 * Pura: lee importe, vencimiento y período de un texto de documento. Nunca falla: si no está seguro, deja los
 * candidatos para que la pantalla los ofrezca, y lo dice en `aviso`.
 */
export function leerDocumento(texto: string): Lectura {
  const lineas = String(texto ?? "").split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const importes: CandidatoImporte[] = []
  const fechas: CandidatoFecha[] = []
  let periodo: string | null = null
  const reMonto = /\$?\s?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?!\d)/g
  const reFecha = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/g

  lineas.forEach((l, i) => {
    const contexto = sinTildes(`${lineas[i - 1] ?? ""} ${l}`)
    const propia = sinTildes(l)
    // Importes: la etiqueta se busca en la línea y en la anterior (muchas veces el título va arriba del número)
    for (const m of l.matchAll(reMonto)) {
      const monto = montoAr(m[1])
      if (monto <= 0) continue
      const antes = sinTildes(l.slice(0, m.index ?? 0))
      if (NO_ES_IMPORTE.test(antes.slice(-40)) || (NO_ES_IMPORTE.test(propia) && !/a pagar/.test(propia))) continue
      let puntaje = 0, etiqueta = ""
      for (const [re, p] of ETIQUETAS_IMPORTE) {
        if (re.test(antes) || re.test(propia)) { if (p > puntaje) { puntaje = p; etiqueta = (antes.match(re) ?? propia.match(re))?.[0] ?? "" } }
        else if (re.test(contexto) && p - 15 > puntaje) { puntaje = p - 15; etiqueta = (contexto.match(re))?.[0] ?? "" }
      }
      importes.push({ monto, etiqueta, puntaje })
    }
    // Fechas: vencimiento si la línea (o la anterior) lo dice
    for (const m of l.matchAll(reFecha)) {
      const d = Number(m[1]), mes = Number(m[2]), a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      if (d < 1 || d > 31 || mes < 1 || mes > 12 || a < 2000 || a > 2100) continue
      const fecha = `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const antes = sinTildes(l.slice(0, m.index ?? 0))
      // «expiración» es el vencimiento de un VEP; el 2do vencimiento y el «próximo» no son el de esta cuota
      const noEs = /2(do|°|º)\.? ?venc|proximo venc|prox\.? venc/.test(antes)
      const esV = /venc|vto|vence|pagar hasta|fecha limite|expiracion/.test(antes) || /venc|vto|vence|expiracion/.test(sinTildes(lineas[i - 1] ?? ""))
      fechas.push({ fecha, etiqueta: antes.slice(-30).trim(), esVencimiento: esV && !noEs })
    }
    // Período: «período 09/2026», «09/2026», «septiembre 2026»
    if (!periodo) {
      const p1 = propia.match(/(?:periodo|cuota):?\s*(\d{1,2})[/-](\d{4})/)
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
      const p2 = propia.match(new RegExp(`\\b(${meses.join("|")})\\s+(?:de\\s+)?(\\d{4})\\b`))
      if (p1) periodo = `${p1[1].padStart(2, "0")}/${p1[2]}`
      else if (p2) periodo = `${String(meses.indexOf(p2[1]) + 1).padStart(2, "0")}/${p2[2]}`
    }
  })

  // El importe: el de mayor puntaje; a igual puntaje, el más grande (el total suele ser el mayor de su nivel)
  const ordenados = [...importes].sort((a, b) => b.puntaje - a.puntaje || b.monto - a.monto)
  const elegido = ordenados.find(c => c.puntaje > 0) ?? null
  // El vencimiento: el primero rotulado (el 1er vencimiento); si no hay rotulado, ninguno (no adivina con una fecha suelta)
  const venc = fechas.find(f => f.esVencimiento)?.fecha ?? null
  const avisos: string[] = []
  if (!elegido) avisos.push(importes.length ? "No se vio un rótulo de importe: elegí el monto de la lista." : "No se leyó ningún importe.")
  if (!venc) avisos.push("No se vio el vencimiento.")
  // Dedupe de candidatos para mostrar
  const vistos = new Set<number>()
  return {
    importe: elegido?.monto ?? null, vencimiento: venc, periodo,
    importes: ordenados.filter(c => !vistos.has(c.monto) && (vistos.add(c.monto), true)).slice(0, 8),
    fechas, aviso: avisos.length ? avisos.join(" ") : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué template y qué cuota
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateSimple { id: string; nombre_referencia: string; responsable: string | null }
export interface CuotaSimple { id: string; numero_cuota: number | null; fecha_vencimiento: string | null; fecha_estimada: string | null; monto: number | null; estado: string; grupo_pago_id?: string | null }

const tokens = (s: string) => new Set(sinTildes(s).split(/[^a-z0-9]+/).filter(t => t.length > 2 && !["cuota", "mensual", "del", "los", "las", "para", "srl"].includes(t)))

/**
 * Pura: el template propuesto. 1º el que se usó la última vez para la MISMA regla (por nombre, no por id: los templates
 * se renuevan cada campaña con id nuevo), 2º el que más palabras comparte con el asunto, el remitente y el destino.
 */
export function templateSugerido(templates: TemplateSimple[], nombreUsadoAntes: string | null, pistas: string[]): TemplateSimple | null {
  if (nombreUsadoAntes) {
    const t = templates.find(x => sinTildes(x.nombre_referencia) === sinTildes(nombreUsadoAntes))
    if (t) return t
  }
  const p = tokens(pistas.join(" "))
  let mejor: TemplateSimple | null = null, puntos = 0
  for (const t of templates) {
    const n = [...tokens(t.nombre_referencia)].filter(x => p.has(x)).length
    if (n > puntos) { puntos = n; mejor = t }
  }
  return puntos > 0 ? mejor : null
}

/** Pura: la cuota propuesta: sin pagar, la de vencimiento más cercano al leído (o al mail + 15 días). Ignora las agrupadas en un pago. */
export function cuotaSugerida(cuotas: CuotaSimple[], vencimiento: string | null, fechaMail: string): CuotaSimple | null {
  const ref = new Date((vencimiento ?? new Date(new Date(fechaMail).getTime() + 15 * 86400000).toISOString().slice(0, 10)) + "T12:00:00Z").getTime()
  const libres = cuotas.filter(c => ["pendiente", "pagar"].includes(String(c.estado).toLowerCase()) && !c.grupo_pago_id)
  let mejor: CuotaSimple | null = null, dist = Infinity
  for (const c of libres) {
    const f = c.fecha_vencimiento ?? c.fecha_estimada
    if (!f) continue
    const d = Math.abs(new Date(f + "T12:00:00Z").getTime() - ref)
    if (d < dist) { dist = d; mejor = c }
  }
  return dist <= 45 * 86400000 ? mejor : null   // a más de un mes y medio no es «esta» cuota
}

/** Pura: la HUELLA que queda en el mail (lo leído, lo aplicado y lo que tenía la cuota antes). */
export function huellaCuota(p: { cuota_id: string; template: string; leido: Lectura; aplicado: { monto: number; vencimiento: string | null }; antes: { monto: number | null; vencimiento: string | null } }) {
  const corregido = (p.leido.importe ?? null) !== p.aplicado.monto || (p.leido.vencimiento ?? null) !== (p.aplicado.vencimiento ?? null)
  return {
    schema: "public", tabla: "cuotas_egresos_sin_factura", id: p.cuota_id,
    que: JSON.stringify({ template: p.template, leido: { importe: p.leido.importe, vencimiento: p.leido.vencimiento }, aplicado: p.aplicado, antes: p.antes, corregido }),
  }
}

/** Pura: el control que se muestra antes de aplicar: cuánto cambia la cuota (se avisa si es mucho, no se frena). */
export function diferenciaCuota(antes: number | null, nuevo: number): { texto: string; grande: boolean } {
  if (!antes) return { texto: "la cuota no tenía monto", grande: false }
  const pct = ((nuevo - antes) / antes) * 100
  return { texto: `${pct > 0 ? "+" : ""}${pct.toFixed(1)} % sobre lo que tenía la app`, grande: Math.abs(pct) > 30 }
}

// ─────────────────────────────────────────────────────────────────────────────
// La cuota a la que queda ATADA una tarea (para que se cierre sola al conciliarse) — A-FEAT-1449 tanda 2
// ─────────────────────────────────────────────────────────────────────────────

/** Pura: el número de cuota que dice un texto («…complementario cuota 3 del año 2026» → 3), o null. */
export function numeroDeCuota(texto: string | null | undefined): number | null {
  const m = String(texto ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/\bcuota\s*n?[°º.]?\s*(\d{1,2})\b/)
  return m ? Number(m[1]) : null
}

/**
 * Pura: la cuota propuesta para atar una tarea. Si el texto dice el número («cuota 3»), la cuota SIN CONCILIAR con ese
 * número (aunque ya haya vencido: es justo el caso de la mora); si no, la más cercana como en `cuotaSugerida`.
 */
export function cuotaParaCierre(cuotas: CuotaSimple[], texto: string | null, fechaMail: string): CuotaSimple | null {
  const n = numeroDeCuota(texto)
  if (n != null) {
    const conNumero = cuotas.filter(c => c.numero_cuota === n && String(c.estado).toLowerCase() !== "conciliado")
    if (conNumero.length) return conNumero.sort((a, b) => String(b.fecha_vencimiento ?? "").localeCompare(String(a.fecha_vencimiento ?? "")))[0]
  }
  return cuotaSugerida(cuotas, null, fechaMail)
}
