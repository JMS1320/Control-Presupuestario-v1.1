/**
 * EL PLAN SANITARIO — A-FEAT-1380. Lógica pura (sin base), la usa la solapa y los casos.
 *
 * Tres capas, como lo planteó el usuario: **plan · lo sucedido · lo proyectado**.
 *   · plan       = `productivo.plan_sanitario_tareas` (fecha óptima, margen, de qué cuelga).
 *   · sucedido   = las ÓRDENES de aplicación ejecutadas (no hay tabla aparte: se reconocen por sus
 *                  labores e insumos) + la huella `plan_sanitario_registro` (hecha / no se hizo y por
 *                  qué / programada). La huella manda sobre lo reconocido (§ default del dato real).
 *   · proyectado = si la tarea cuelga de otra que ya se hizo, su fecha sale de ésa (cadena); si no, de
 *                  su fecha óptima. Si la cadena la aleja del óptimo más que su margen → CONFLICTO, que
 *                  se muestra y no se resuelve solo.
 *
 * La CAMPAÑA va de julio a junio (arranca con la parición): campaña 2026 = jul-2026 → jun-2027.
 * Una fecha 'MM-DD' de jul–dic cae en el año de la campaña; una de ene–jun, en el siguiente.
 */

export type TareaPlan = {
  id: string
  nombre: string
  columna: string
  grupos: string[]
  optimo_mmdd: string
  hasta_mmdd: string | null
  es_fija: boolean
  tol_antes: number
  tol_despues: number
  ancla_id: string | null
  ancla_dias: number | null
  obligatoria: boolean
  claves: string[]
  codigo: string | null
  detalle: string | null
  orden: number
  activa: boolean
}

export type RegistroPlan = {
  tarea_id: string
  campania: number
  estado: "hecha" | "no_se_hizo" | "programada"
  fecha: string | null
  orden_id: string | null
  explicacion: string | null
  autor?: string | null
}

/** Una orden ya hecha, reducida a lo que sirve para reconocerla. */
export type Hecho = {
  orden_id: string
  fecha: string
  /** nombres de labores + insumos de la orden */
  textos: string[]
  /** categorías de hacienda de la orden (para mostrar) */
  categorias?: string[]
}

export type EstadoOcurrencia =
  | "hecha"            // ✅ dentro de su margen, o fuera con explicación
  | "hecha_sin_explicar" // ⚠️ se hizo, pero fuera de su margen y nadie anotó por qué
  | "explicada"        // 📝 no se hizo, con su motivo
  | "vencida"          // 🔴 pasó su margen sin registro ni explicación
  | "proxima"          // 🟡 falta menos de 1 mes (o está en curso)
  | "proyectada"       // ⚪ más adelante
  | "deseable"         // ▫️ no obligatoria y no registrada (no reclama)

export type Ocurrencia = {
  tarea: TareaPlan
  campania: number
  /** la fecha óptima de este año */
  optimo: string
  /** fin de la ventana (parición 30/9), o null */
  hasta: string | null
  /** la fecha que se espera: programada > cadena > óptimo */
  esperada: string
  /** de dónde sale la fecha esperada, en palabras */
  origen: string
  /** días entre la cadena y el óptimo cuando superan el margen (null = sin conflicto) */
  conflicto: number | null
  estado: EstadoOcurrencia
  /** fecha en que se hizo (de la orden o de la huella) */
  fechaReal: string | null
  /** días de diferencia entre lo hecho y lo esperado (+ = después) */
  desvio: number | null
  ordenId: string | null
  /** la orden se reconoció sola (no la vinculó nadie) */
  reconocida: boolean
  registro: RegistroPlan | null
  /** días hasta la esperada (negativo = ya pasó) */
  faltan: number
}

export const AVISO_DIAS = 30
/** cuánto se aleja una orden del óptimo y todavía se la reconoce como «la de esta tarea» */
export const VENTANA_RECONOCER = 45

// ── Fechas (strings ISO 'YYYY-MM-DD', sin zona: son DÍAS) ─────────────────────────────────────
const aUTC = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) }
export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * 86400000).toISOString().slice(0, 10)
}
export function difDias(a: string, b: string): number { return Math.round((aUTC(a) - aUTC(b)) / 86400000) }

/** 'MM-DD' en la campaña: jul–dic → año de la campaña; ene–jun → el siguiente. */
export function fechaEnCampania(mmdd: string, campania: number): string {
  const mes = parseInt(mmdd.slice(0, 2), 10)
  return `${mes >= 7 ? campania : campania + 1}-${mmdd}`
}
/** La campaña de un día: jul-2026 → 2026; mar-2027 → 2026. */
export function campaniaDe(iso: string): number {
  const y = parseInt(iso.slice(0, 4), 10), m = parseInt(iso.slice(5, 7), 10)
  return m >= 7 ? y : y - 1
}
export const nombreCampania = (c: number) => `${String(c).slice(2)}/${String(c + 1).slice(2)}`

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
export function fechaCorta(iso: string | null, conDia = false): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  const base = `${d}/${m}`
  return conDia ? `${DIAS[new Date(aUTC(iso)).getUTCDay()]} ${base}` : `${base}/${y.slice(2)}`
}

// ── Reconocer la orden que cumple una tarea ───────────────────────────────────────────────────
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
export function cumpleClaves(h: Hecho, claves: string[]): boolean {
  if (claves.length === 0) return false
  const textos = h.textos.map(normal)
  return claves.some(c => { const k = normal(c); return textos.some(t => t.includes(k)) })
}

// ── El cálculo central ────────────────────────────────────────────────────────────────────────
/**
 * Las ocurrencias de una campaña. `iatfs` = fechas de IA cargadas por campaña (la IATF no se reconoce
 * por claves: tiene su propia carga). Se recorren las tareas en orden de cadena, así una tarea que
 * cuelga de otra ve la fecha REAL de ésa.
 */
export type IatfCargada = { fecha_ia: string; fecha_entore: string; orden_ia_id: string | null; orden_entore_id: string | null }

export function ocurrenciasDeCampania(
  tareas: TareaPlan[], campania: number, hechos: Hecho[], registros: RegistroPlan[],
  hoy: string, iatfs: Record<number, IatfCargada> = {},
): Ocurrencia[] {
  const activas = tareas.filter(t => t.activa)
  const porId = new Map(activas.map(t => [t.id, t]))
  const cache = new Map<string, Ocurrencia>()

  const calcular = (t: TareaPlan, c: number, pila: Set<string>): Ocurrencia => {
    const llave = `${t.id}|${c}`
    const ya = cache.get(llave)
    if (ya) return ya
    const optimo = fechaEnCampania(t.optimo_mmdd, c)
    let hasta = t.hasta_mmdd ? fechaEnCampania(t.hasta_mmdd, c) : null
    if (hasta && hasta < optimo) hasta = sumarDias(hasta, 365)
    const reg = registros.find(r => r.tarea_id === t.id && r.campania === c) ?? null

    // 1 · La cadena: cuelga de la ÚLTIMA vez que se hizo (o se prevé) la tarea ancla ANTES que ésta.
    //     La campaña corta en julio y la sanidad arranca en marzo: la de septiembre cuelga de la de
    //     junio ANTERIOR (otra campaña), no de la de junio que viene.
    let esperada = optimo
    let origen = t.es_fija ? "fecha fija" : `fecha óptima ${fechaCorta(optimo)}`
    let conflicto: number | null = null
    if (t.ancla_id && t.ancla_dias != null && !pila.has(llave)) {
      const ancla = porId.get(t.ancla_id)
      if (ancla) {
        const cAncla = fechaEnCampania(ancla.optimo_mmdd, c) > optimo ? c - 1 : c
        const oa = calcular(ancla, cAncla, new Set([...pila, llave]))
        const base = oa.fechaReal ?? oa.esperada
        const porCadena = sumarDias(base, t.ancla_dias)
        esperada = porCadena
        origen = `${t.ancla_dias} días después de «${ancla.nombre}» (${oa.fechaReal ? "hecha" : "prevista"} ${fechaCorta(base)})`
        const d = difDias(porCadena, optimo)
        if (d < -t.tol_antes || d > t.tol_despues) conflicto = d
      }
    }
    // 2 · Lo programado a mano manda (se movió o se juntó)
    if (reg?.estado === "programada" && reg.fecha) {
      esperada = reg.fecha
      origen = `programada a mano${reg.explicacion ? ` — ${reg.explicacion}` : ""}`
    }

    // 3 · Lo sucedido: la huella manda; si no hay, se reconoce la orden más cercana
    let fechaReal: string | null = null, ordenId: string | null = null, reconocida = false
    if (reg?.estado === "hecha") { fechaReal = reg.fecha; ordenId = reg.orden_id }
    else if (t.codigo === "iatf" && iatfs[c]) { fechaReal = iatfs[c].fecha_ia; ordenId = iatfs[c].orden_ia_id; reconocida = true }
    else if (t.codigo === "entore" && iatfs[c]) { fechaReal = iatfs[c].fecha_entore; ordenId = iatfs[c].orden_entore_id; reconocida = true }
    else if (reg?.estado !== "no_se_hizo") {
      const desde = sumarDias(optimo, -VENTANA_RECONOCER), hastaR = sumarDias(hasta ?? optimo, VENTANA_RECONOCER)
      const cerca = (f: string) => Math.min(Math.abs(difDias(f, esperada)), Math.abs(difDias(f, optimo)))
      const cand = hechos
        .filter(h => h.fecha >= desde && h.fecha <= hastaR && cumpleClaves(h, t.claves))
        .sort((a, b) => cerca(a.fecha) - cerca(b.fecha))
      if (cand[0]) { fechaReal = cand[0].fecha; ordenId = cand[0].orden_id; reconocida = true }
    }

    // 4 · El estado. El desvío se mide contra la más cercana entre la cadena y el óptimo: si la cadena
    //     la corrió pero se hizo en su fecha óptima, está bien (orbita su óptimo).
    const faltan = difDias(esperada, hoy)
    let desvio: number | null = null
    let estado: EstadoOcurrencia
    if (fechaReal) {
      const contra = (ref: string) => hasta && fechaReal! >= ref && fechaReal! <= hasta ? 0 : difDias(fechaReal!, hasta && fechaReal! > hasta ? hasta : ref)
      const a = contra(esperada), b = contra(optimo)
      desvio = Math.abs(a) <= Math.abs(b) ? a : b
      const fuera = desvio < -t.tol_antes || desvio > t.tol_despues
      estado = fuera && !reg?.explicacion ? "hecha_sin_explicar" : "hecha"
    } else if (reg?.estado === "no_se_hizo") {
      estado = "explicada"
    } else {
      const fin = sumarDias(hasta ?? esperada, t.tol_despues)
      if (!t.obligatoria) estado = "deseable"
      else if (hoy > fin) estado = "vencida"
      else if (faltan <= AVISO_DIAS) estado = "proxima"
      else estado = "proyectada"
    }

    const oc: Ocurrencia = { tarea: t, campania: c, optimo, hasta, esperada, origen, conflicto, estado, fechaReal, desvio, ordenId, reconocida, registro: reg, faltan }
    cache.set(llave, oc)
    return oc
  }

  return activas
    .map(t => calcular(t, campania, new Set()))
    .sort((a, b) => a.esperada.localeCompare(b.esperada) || a.tarea.orden - b.tarea.orden)
}

/** Lo que pide atención: vencidas, hechas sin explicar y próximas (≤ 30 días). */
export function avisos(ocs: Ocurrencia[]): Ocurrencia[] {
  const peso: Partial<Record<EstadoOcurrencia, number>> = { vencida: 0, hecha_sin_explicar: 1, proxima: 2 }
  return ocs.filter(o => o.estado in peso)
    .sort((a, b) => (peso[a.estado]! - peso[b.estado]!) || a.esperada.localeCompare(b.esperada))
}

// ── Juntar tareas ─────────────────────────────────────────────────────────────────────────────
export type Sugerencia = {
  grupo: string
  ocurrencias: Ocurrencia[]
  /** la fecha que entra en el margen de todas; si no hay, la de la más estricta */
  fecha: string
  /** true = alguna queda fuera de su margen: juntar pide explicación */
  pideExplicacion: boolean
  distancia: number
}

/**
 * Tareas pendientes que caen cerca para el MISMO grupo de hacienda → hacerlas juntas (un solo encierre).
 * La fecha sugerida es la que entra en el margen de todas; si no existe, la de la más estricta (la de
 * menor margen), y se avisa que juntar pide explicación.
 */
export function sugerirAgrupar(ocs: Ocurrencia[], hoy: string, horizonte = 90, cerca = 21): Sugerencia[] {
  const pendientes = ocs.filter(o => (o.estado === "proxima" || o.estado === "proyectada") && !o.tarea.es_fija
    && o.faltan <= horizonte && o.esperada >= hoy && o.tarea.columna !== "ventas" && o.tarea.columna !== "pasto")
  const grupos = [...new Set(pendientes.flatMap(o => o.tarea.grupos))]
  const vistas = new Set<string>()
  const out: Sugerencia[] = []
  for (const g of grupos) {
    const del = pendientes.filter(o => o.tarea.grupos.includes(g)).sort((a, b) => a.esperada.localeCompare(b.esperada))
    let i = 0
    while (i < del.length) {
      const racimo = [del[i]]
      let j = i + 1
      while (j < del.length && difDias(del[j].esperada, racimo[0].esperada) <= cerca) { racimo.push(del[j]); j++ }
      i = j
      // mismas tareas ya juntas: dos tareas que caen el mismo día ya «van juntas» en el plan
      if (racimo.length < 2 || racimo.every(o => o.esperada === racimo[0].esperada)) continue
      const clave = racimo.map(o => o.tarea.id).sort().join("|")
      if (vistas.has(clave)) continue
      vistas.add(clave)
      // intersección de los márgenes
      const desde = racimo.map(o => sumarDias(o.esperada, -o.tarea.tol_antes)).sort().at(-1)!
      const hasta = racimo.map(o => sumarDias(o.esperada, o.tarea.tol_despues)).sort()[0]
      const estricta = [...racimo].sort((a, b) => (a.tarea.tol_antes + a.tarea.tol_despues) - (b.tarea.tol_antes + b.tarea.tol_despues))[0]
      const entra = desde <= hasta
      let fecha = entra ? (estricta.esperada >= desde && estricta.esperada <= hasta ? estricta.esperada : desde) : estricta.esperada
      if (fecha < hoy) fecha = hoy
      out.push({ grupo: g, ocurrencias: racimo, fecha, pideExplicacion: !entra, distancia: difDias(racimo.at(-1)!.esperada, racimo[0].esperada) })
    }
  }
  // una sugerencia que es parte de otra más grande (mismo racimo en otro grupo) se descarta
  return out.filter(s => !out.some(o => o !== s && o.ocurrencias.length > s.ocurrencias.length
    && s.ocurrencias.every(x => o.ocurrencias.some(y => y.tarea.id === x.tarea.id))))
}

/** Mover una tarea a otra fecha: ¿queda dentro del margen de su fecha óptima, o pide explicación? */
export function moverPideExplicacion(o: Ocurrencia, nueva: string): boolean {
  return nueva < sumarDias(o.optimo, -o.tarea.tol_antes) || nueva > sumarDias(o.hasta ?? o.optimo, o.tarea.tol_despues)
}

// ── La IATF ───────────────────────────────────────────────────────────────────────────────────
/** Las distancias NO se mueven (usuario 27/10): dispositivos IA−10, retiro IA−2. Entore ~IA+2. */
export const IATF_DISPOSITIVOS = -10
export const IATF_RETIRO = -2
export const IATF_ENTORE = 2

export function fechasIatf(fechaIa: string, entore?: string | null) {
  return {
    dispositivos: sumarDias(fechaIa, IATF_DISPOSITIVOS),
    retiro: sumarDias(fechaIa, IATF_RETIRO),
    ia: fechaIa,
    entore: entore || sumarDias(fechaIa, IATF_ENTORE),
  }
}

export type ChequeoIatf = { dias: number; pideExplicacion: boolean; fueraDeRango: boolean; texto: string }

/**
 * La IA contra su fecha óptima (1/10 de ese año). Regla del usuario 27/10: el grupo se puede mover
 * 1 o 2 días ANTES sin explicación; 3 antes o 1 después, con explicación. Más que eso no está previsto:
 * se deja cargar (puede haber un motivo), pero con explicación y marcado fuera de rango.
 */
export function chequearIatf(fechaIa: string, optimoMmdd = "10-01"): ChequeoIatf {
  const optimo = `${fechaIa.slice(0, 4)}-${optimoMmdd}`
  const dias = difDias(fechaIa, optimo)
  if (dias >= -2 && dias <= 0) return { dias, pideExplicacion: false, fueraDeRango: false, texto: dias === 0 ? "en fecha" : `${-dias} día(s) antes: dentro del margen` }
  if (dias === -3 || dias === 1) return { dias, pideExplicacion: true, fueraDeRango: false, texto: `${Math.abs(dias)} día(s) ${dias < 0 ? "antes" : "después"}: hay que anotar por qué` }
  return { dias, pideExplicacion: true, fueraDeRango: true, texto: `${Math.abs(dias)} días ${dias < 0 ? "antes" : "después"}: fuera de lo previsto (hasta 3 antes o 1 después)` }
}

/** El entore lleva su fecha, «unos 2 días después» de la IA: 1 a 3 días, sin explicación. */
export function chequearEntore(fechaIa: string, fechaEntore: string): ChequeoIatf {
  const dias = difDias(fechaEntore, fechaIa)
  if (dias >= 1 && dias <= 3) return { dias, pideExplicacion: false, fueraDeRango: false, texto: `${dias} día(s) después de la IA` }
  return { dias, pideExplicacion: true, fueraDeRango: dias < 0, texto: `${dias} día(s) después de la IA (lo normal son ~2): hay que anotar por qué` }
}
