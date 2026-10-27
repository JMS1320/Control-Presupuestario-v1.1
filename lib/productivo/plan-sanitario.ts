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
  | "previa"           // · anterior a lo último registrado en la app: no se sabe y no reclama (JMS 27/10)
  | "sucede"           // ✔ parición y entore: pasan solos, no hace falta registrarlos (JMS 27/10)

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
  /** Desde cuándo se controla: la fecha de lo ÚLTIMO registrado. Lo anterior sin registro no reclama
   *  (JMS 27/10: «se cuenta desde lo último registrado hasta ahora lo pendiente, no previo»). */
  desde: string | null = null,
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
      if ((t.codigo === "paricion" || t.codigo === "entore") && hoy >= esperada) estado = "sucede"
      else if (!t.obligatoria) estado = "deseable"
      else if (desde && fin < desde) estado = "previa"
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

/** Lo que pide atención: vencidas, hechas sin explicar y próximas (≤ 30 días). Lo hecho fuera de fecha ANTES
 *  de `desde` (lo último registrado) se ve en el calendario pero no reclama acá. */
export function avisos(ocs: Ocurrencia[], desde: string | null = null): Ocurrencia[] {
  const peso: Partial<Record<EstadoOcurrencia, number>> = { vencida: 0, hecha_sin_explicar: 1, proxima: 2 }
  return ocs.filter(o => o.estado in peso && !(o.estado === "hecha_sin_explicar" && desde && (o.fechaReal ?? o.esperada) < desde))
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

// ── Sesiones ──────────────────────────────────────────────────────────────────────────────────
export const GRUPOS = ["Vacas", "Vaquillonas", "Toros", "Terneros al pie", "Recría", "CUT", "Caballos", "Campo"]

/**
 * SESIONES — lo que se hace el mismo día es UN evento (JMS 27/10: «la aftosa se hace todo en un día… tacto a IA y mosca se
 * hace junto. Es un evento»). Se agrupa por la fecha que se muestra: la real si se hizo, si no la esperada (que ya incluye
 * lo juntado a mano). El estado de la sesión es el más urgente de sus tareas.
 */
const URGENCIA: EstadoOcurrencia[] = ["vencida", "hecha_sin_explicar", "proxima", "proyectada", "explicada", "hecha", "sucede", "previa", "deseable"]
export function agruparEnSesiones(ocs: Ocurrencia[]) {
  const m = new Map<string, Ocurrencia[]>()
  for (const o of ocs) { const f = o.fechaReal ?? o.esperada; m.set(f, [...(m.get(f) ?? []), o]) }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, lista]) => {
    const oblig = lista.filter(o => o.tarea.obligatoria)
    const base = oblig.length ? oblig : lista
    const estado = URGENCIA.find(e => base.some(o => o.estado === e)) ?? "proyectada"
    return {
      fecha, estado,
      ocurrencias: [...lista].sort((a, b) => Number(b.tarea.obligatoria) - Number(a.tarea.obligatoria) || a.tarea.orden - b.tarea.orden),
      grupos: GRUPOS.filter(g => lista.some(o => o.tarea.grupos.includes(g))),
    }
  })
}

// ── Encierres por rodeo (JMS 27/10) ───────────────────────────────────────────────────────────
/**
 * «Ideal sería que nunca un rodeo se encierre más de una vez por mes y 2 veces idealmente en 4 meses;
 * nunca más de 2 veces en 3 meses. Idealmente si se encierra un rodeo se encierra otro el mismo día,
 * pero puede que se haga en 2 días si es toda la hacienda o el 70%.»
 *
 * Un ENCIERRE es una sesión que toca a un rodeo con una tarea obligatoria de sanidad o manejo. No cuentan
 * la parición y el entore (suceden en el campo) ni lo que no es hacienda (Caballos, Campo).
 * La IATF cuenta como UN encierre aunque el protocolo pida tres pasos: es un protocolo, no se elige.
 */
export const RODEOS = ["Vacas", "Vaquillonas", "Toros", "Terneros al pie", "Recría", "CUT"]
export const ENCIERRE = { minDias: 30, ventanaDura: 90, maxDura: 2, ventanaIdeal: 120, maxIdeal: 2, juntarDias: 1, porcentajeDosDias: 0.7 }

export function esEncierre(o: Ocurrencia): boolean {
  return o.tarea.obligatoria && (o.tarea.columna === "veterinario" || o.tarea.columna === "manejo" || o.tarea.codigo === "iatf")
    && o.tarea.codigo !== "paricion" && o.tarea.codigo !== "entore"
    && o.tarea.grupos.some(g => RODEOS.includes(g))
}

/** Días en que se encierra cada rodeo. Dos días seguidos cuentan como UN encierre (la hacienda en 2 días). */
export function encierresPorRodeo(items: { fecha: string; grupos: string[] }[]): Record<string, string[]> {
  const m: Record<string, string[]> = {}
  for (const r of RODEOS) {
    const fechas = [...new Set(items.filter(i => i.grupos.includes(r)).map(i => i.fecha))].sort()
    const unidas: string[] = []
    for (const f of fechas) if (!unidas.length || difDias(f, unidas.at(-1)!) > ENCIERRE.juntarDias) unidas.push(f)
    if (unidas.length) m[r] = unidas
  }
  return m
}

export type ProblemaEncierre = { rodeo: string; fechas: string[]; grave: boolean; texto: string }

/** El control: dónde se rompe la regla. `grave` = límite duro; el resto, lo ideal. */
export function controlarEncierres(porRodeo: Record<string, string[]>): ProblemaEncierre[] {
  const out: ProblemaEncierre[] = []
  for (const [rodeo, f] of Object.entries(porRodeo)) {
    for (let i = 1; i < f.length; i++) {
      const d = difDias(f[i], f[i - 1])
      if (d < ENCIERRE.minDias) out.push({ rodeo, fechas: [f[i - 1], f[i]], grave: true, texto: `${rodeo}: dos encierres en ${d} días (${fechaCorta(f[i - 1]).slice(0, 5)} y ${fechaCorta(f[i]).slice(0, 5)}) — máximo 1 por mes` })
    }
    for (let i = 0; i + ENCIERRE.maxDura < f.length; i++) {
      const d = difDias(f[i + ENCIERRE.maxDura], f[i])
      if (d < ENCIERRE.ventanaDura) out.push({ rodeo, fechas: f.slice(i, i + ENCIERRE.maxDura + 1), grave: true, texto: `${rodeo}: ${ENCIERRE.maxDura + 1} encierres en ${d} días — nunca más de 2 en 3 meses` })
      else if (d < ENCIERRE.ventanaIdeal) out.push({ rodeo, fechas: f.slice(i, i + ENCIERRE.maxDura + 1), grave: false, texto: `${rodeo}: ${ENCIERRE.maxDura + 1} encierres en ${d} días — lo ideal es 2 en 4 meses` })
    }
  }
  return out.sort((a, b) => Number(b.grave) - Number(a.grave) || a.fechas[0].localeCompare(b.fechas[0]))
}

export type SesionPropuesta = {
  fecha: string
  ocurrencias: Ocurrencia[]
  rodeos: string[]
  /** tiene una tarea fija (IATF): la fecha no se mueve */
  fija: boolean
  /** tareas que quedan fuera de su margen: piden explicación */
  fuera: Ocurrencia[]
  /** entra ≥70% de la hacienda: se puede hacer en 2 días seguidos */
  dosDias: boolean
}

type Grupo = { ocs: Ocurrencia[]; desde: string; hasta: string; fija: string | null }
const ventana = (o: Ocurrencia, hoy: string, holgura = 0): [string, string] => {
  const d = sumarDias(o.esperada, -o.tarea.tol_antes - holgura)
  return [d < hoy ? hoy : d, sumarDias(o.esperada, o.tarea.tol_despues + holgura)]
}
const fechaDe = (g: Grupo): string => {
  if (g.fija) return g.fija
  const media = g.ocs.map(o => o.esperada).sort()[Math.floor(g.ocs.length / 2)]
  return media < g.desde ? g.desde : media > g.hasta ? g.hasta : media
}

/**
 * La propuesta base de calendario: junta las tareas FUTURAS que se pueden hacer el mismo día (sus márgenes
 * se tocan) y, si aun así un rodeo queda encerrado dos veces en el mes o tres en 3 meses, intenta juntar esas
 * sesiones estirando hasta 30 días — lo que sale del margen de una tarea queda marcado (pide explicación).
 * Es una BASE: el usuario la acepta, la cambia o la descarta.
 */
export function proponerCalendario(ocs: Ocurrencia[], hoy: string): { sesiones: SesionPropuesta[]; problemas: ProblemaEncierre[]; antes: ProblemaEncierre[] } {
  const pend = ocs.filter(o => esEncierre(o) && !o.fechaReal && o.estado !== "explicada" && o.esperada >= hoy)
    .sort((a, b) => a.esperada.localeCompare(b.esperada))
  const antes = controlarEncierres(encierresPorRodeo(pend.map(o => ({ fecha: o.esperada, grupos: o.tarea.grupos }))))

  // 1 · Juntar lo que entra en el margen de todos
  let grupos: Grupo[] = []
  for (const o of pend) {
    const [d, h] = o.tarea.es_fija ? [o.esperada, o.esperada] : ventana(o, hoy)
    const cand = grupos
      .filter(g => (g.fija ? g.fija >= d && g.fija <= h : (d <= g.hasta && h >= g.desde)) && !(o.tarea.es_fija && g.fija))
      .sort((a, b) => Math.abs(difDias(fechaDe(a), o.esperada)) - Math.abs(difDias(fechaDe(b), o.esperada)))[0]
    if (cand) {
      cand.ocs.push(o)
      if (o.tarea.es_fija) cand.fija = o.esperada
      if (!cand.fija) { cand.desde = d > cand.desde ? d : cand.desde; cand.hasta = h < cand.hasta ? h : cand.hasta }
    } else grupos.push({ ocs: [o], desde: d, hasta: h, fija: o.tarea.es_fija ? o.esperada : null })
  }

  // 2 · Lo que todavía rompe la regla: juntar estirando (hasta 30 días de holgura)
  const ESTIRAR = 30
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const items = grupos.map(g => ({ fecha: fechaDe(g), grupos: g.ocs.flatMap(o => o.tarea.grupos) }))
    const graves = controlarEncierres(encierresPorRodeo(items)).filter(p => p.grave)
    let unido = false
    for (const p of graves) {
      const involucrados = grupos.filter(g => p.fechas.some(f => Math.abs(difDias(fechaDe(g), f)) <= ENCIERRE.juntarDias)
        && g.ocs.some(o => o.tarea.grupos.includes(p.rodeo)))
      for (let i = 0; i + 1 < involucrados.length && !unido; i++) {
        const a = involucrados[i], b = involucrados[i + 1]
        if (a.fija && b.fija) continue
        const todos = [...a.ocs, ...b.ocs]
        const ws = todos.map(o => o.tarea.es_fija ? [o.esperada, o.esperada] : ventana(o, hoy, ESTIRAR))
        const d = ws.map(w => w[0]).sort().at(-1)!, h = ws.map(w => w[1]).sort()[0]
        const fija = a.fija ?? b.fija
        if (fija ? (fija >= d && fija <= h) : d <= h) {
          // la fecha: la que deja menos tareas fuera de su margen
          const nuevo: Grupo = { ocs: todos, desde: d, hasta: h, fija }
          if (!fija) {
            const opciones = todos.map(o => o.esperada).filter(f => f >= d && f <= h).concat([d, h])
            const fueraCon = (f: string) => todos.filter(o => moverPideExplicacion(o, f)).length
            const mejor = opciones.sort((x, y) => fueraCon(x) - fueraCon(y) || x.localeCompare(y))[0]
            nuevo.desde = mejor; nuevo.hasta = mejor
          }
          grupos = grupos.filter(g => g !== a && g !== b).concat([nuevo])
          unido = true
        }
      }
      if (unido) break
    }
    if (!unido) break
  }

  const sesiones: SesionPropuesta[] = grupos.map(g => {
    const fecha = fechaDe(g)
    const rodeos = RODEOS.filter(r => g.ocs.some(o => o.tarea.grupos.includes(r)))
    return {
      fecha, ocurrencias: g.ocs.sort((a, b) => a.tarea.orden - b.tarea.orden), rodeos, fija: !!g.fija,
      fuera: g.ocs.filter(o => !o.tarea.es_fija && moverPideExplicacion(o, fecha)),
      dosDias: rodeos.length >= Math.ceil(RODEOS.length * ENCIERRE.porcentajeDosDias),
    }
  }).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const problemas = controlarEncierres(encierresPorRodeo(sesiones.map(s => ({ fecha: s.fecha, grupos: s.rodeos }))))
  return { sesiones, problemas, antes }
}
