/**
 * 🗣️ El INFORME de boletas de ARBA — **contra nuestro registro**, no contra lo que llegó.
 *
 * ## Las dos versiones, y por qué la segunda es la buena
 * La primera (2026-09-08, mañana) listaba **lo que vino**: agrupaba las boletas por el CUIT del mail
 * y las nombraba por su campo. Mejor que un log, pero seguía teniendo el defecto de fondo: **si una
 * boleta no llegaba, no aparecía en ningún lado.** Un informe que sólo enumera lo presente no puede
 * avisar de lo ausente.
 *
 * La corrección la dio el usuario ese mismo día:
 *
 * > *«La idea es que la app nos diga **en función de nuestro registro**, no mezcle cosas. MSA todas
 * > las partidas, complementario, **alerta si alguna no llegó o llegó alguna de más**. Ídem PAM, MA.
 * > Rápidamente ver si tenemos todo o falta algo. Luego viene: tales vinieron también para PAM.»*
 *
 * Entonces el eje **no es el mail: es la empresa y sus partidas**. Se parte de lo que el sistema
 * sabe que existe —los templates activos, con su `responsable`— y se marca qué llegó y qué no.
 *
 * ## Y de dónde sale el dueño
 * 🔑 **`egresos_sin_factura.responsable`** (`MSA` · `PAM` · `MA`). El usuario lo dijo así: *«los
 * templates ya tenemos su responsable, ese es el dato real»* — y tenía razón; yo había mirado
 * `centro_costo`, que es **el campo y no el dueño**, y por eso creí que el dato no estaba.
 *
 * ⚠️ **El CUIT del mail NO dice de quién es la boleta**, sólo dónde llegó: el mail de PAM del 08/09
 * trajo 13 partidas y **6 eran de MSA**. Por eso el dueño manda y el mail queda como un comentario
 * al costado (*«vino también en el mail de PAM»*), que es información útil pero no la identidad.
 */

/** El objeto imponible del mail es una PARTIDA (`099-015881-9`) y no un CUIT (`20-04439022-2`). */
export const esPartida = (s: string | null | undefined) => !!s && /^\d{3}-\d{6}-\d$/.test(s)

export interface TablaMail {
  asunto?: string
  contribuyente?: string
  filas?: { objeto: string; importe: number | null }[]
}

/** Lo que devuelve el GAS y le sirve al informe. El resto de la respuesta no se usa acá. */
export interface ResGas {
  resumen?: string
  quedaron?: number
  sin_tiempo?: boolean
  ya_estaban?: unknown[]
  descuadres?: { asunto: string; detalle: string }[]
}

/** Un template activo de inmobiliario: lo que el sistema **espera** que llegue. */
export interface TemplateArba {
  nombre: string
  /** `null` en el complementario: grava al contribuyente, no a una parcela. */
  partida: string | null
  /** `MSA` · `PAM` · `MA` — de `egresos_sin_factura.responsable`. */
  responsable: string
  complementario?: boolean
}

/** Las tres empresas, por el CUIT del contribuyente que trae el cuerpo del mail (`A-DAT-27`). */
export const EMPRESA_POR_CUIT: Record<string, string> = {
  "30-61778601-6": "MSA",
  "20-04439022-2": "PAM",
  "27-06682461-1": "MA",
}

export interface Llegada {
  objeto: string
  importe: number | null
  /** En el mail de qué empresa vino. Puede NO ser la dueña. */
  vinoEn: string
  complementario: boolean
  asunto: string
}

export interface FilaEmpresa {
  nombre: string
  partida: string | null
  importe: number | null
  /** ¿Llegó? */
  llego: boolean
  /** Vino en el mail de OTRA empresa. `null` si vino donde correspondía o no vino. */
  vinoEnOtra: string | null
  /** Llegó más de una vez, en estos mails. */
  duplicadaEn: string[]
}

export interface BloqueEmpresa {
  empresa: string
  filas: FilaEmpresa[]
  esperadas: number
  llegaron: number
  faltan: FilaEmpresa[]
  total: number
  /** ✅ todo · ⚠️ falta algo */
  completo: boolean
}

export interface Informe {
  bloques: BloqueEmpresa[]
  /** Llegaron y **no son nuestras** (o les falta el template). Es el «llegó alguna de más». */
  deMas: Llegada[]
  /** Las que vinieron en el mail de otra empresa — el *«tales vinieron también para PAM»*. */
  cruzadas: { nombre: string; duena: string; vinoEn: string[] }[]
  total: number
  totalFaltan: number
  pie: string[]
}

/**
 * El informe, con el registro como eje.
 *
 * @param tablas lo que leyó el GAS de los cuerpos de los mails.
 * @param templates los templates ACTIVOS de inmobiliario, con su `responsable`.
 */
export function armarInforme(
  tablas: TablaMail[],
  templates: TemplateArba[],
  res?: ResGas,
): Informe {
  // ── 1 · Qué llegó, y en el mail de quién ────────────────────────────────────────────────────
  const llegadas: Llegada[] = []
  for (const t of tablas) {
    const cuit = t.contribuyente ?? ""
    const vinoEn = EMPRESA_POR_CUIT[cuit] ?? (cuit || "sin identificar")
    const asunto = String(t.asunto ?? "")
    const complementario = /Complementario/i.test(asunto)
    for (const f of t.filas ?? []) {
      llegadas.push({ objeto: f.objeto, importe: f.importe, vinoEn, complementario, asunto })
    }
  }

  // ── 2 · Cada empresa contra SU lista ────────────────────────────────────────────────────────
  const empresas = [...new Set(templates.map(t => t.responsable))].sort()
  const usadas = new Set<string>()
  const bloques: BloqueEmpresa[] = []

  for (const empresa of empresas) {
    const mios = templates.filter(t => t.responsable === empresa)
    const filas: FilaEmpresa[] = mios.map(t => {
      // El complementario no tiene partida: se lo reconoce por el CUIT de la empresa en el mail.
      const suyas = t.complementario
        ? llegadas.filter(l => l.complementario && l.vinoEn === empresa)
        : llegadas.filter(l => l.objeto === t.partida)
      for (const l of suyas) usadas.add(`${l.objeto}|${l.asunto}`)

      const enOtra = suyas.filter(l => l.vinoEn !== empresa).map(l => l.vinoEn)
      return {
        nombre: t.nombre, partida: t.partida,
        importe: suyas.length ? suyas[0].importe : null,
        llego: suyas.length > 0,
        // Vino SÓLO en el mail de otra: eso es lo que hay que mirar.
        vinoEnOtra: suyas.length && !suyas.some(l => l.vinoEn === empresa) ? enOtra[0] : null,
        duplicadaEn: suyas.length > 1 ? [...new Set(suyas.map(l => l.vinoEn))] : [],
      }
    })
    const faltan = filas.filter(f => !f.llego)
    bloques.push({
      empresa, filas, faltan,
      esperadas: filas.length,
      llegaron: filas.length - faltan.length,
      total: filas.reduce((s, f) => s + (f.importe ?? 0), 0),
      completo: faltan.length === 0,
    })
  }

  // ── 3 · Lo que llegó de MÁS ─────────────────────────────────────────────────────────────────
  // Nunca se descarta en silencio: una boleta que llegó y no es de nadie es justo la que hay que ver.
  const deMas = llegadas.filter(l => !usadas.has(`${l.objeto}|${l.asunto}`))

  // ── 4 · Las cruzadas: «tales vinieron también para PAM» ─────────────────────────────────────
  const cruzadas: Informe["cruzadas"] = []
  for (const b of bloques) {
    for (const f of b.filas) {
      const otras = [...new Set([...(f.duplicadaEn), ...(f.vinoEnOtra ? [f.vinoEnOtra] : [])])]
        .filter(e => e !== b.empresa)
      if (otras.length) cruzadas.push({ nombre: f.nombre, duena: b.empresa, vinoEn: otras })
    }
  }

  const pie: string[] = []
  if (res?.sin_tiempo) pie.push(`⏳ Quedaron ${res.quedaron} sin bajar por tiempo. Volvé a apretar «Bajar y archivar»: sigue donde iba y no duplica.`)
  if ((res?.ya_estaban ?? []).length) pie.push(`${(res!.ya_estaban as unknown[]).length} ya estaban archivadas de antes.`)
  if ((res?.descuadres ?? []).length) pie.push(`⚠️ En ${res!.descuadres!.length} mail(s) la cantidad de boletas de la tabla no coincide con la de links de descarga.`)

  return {
    bloques, deMas, cruzadas, pie,
    total: bloques.reduce((s, b) => s + b.total, 0) + deMas.reduce((s, l) => s + (l.importe ?? 0), 0),
    totalFaltan: bloques.reduce((s, b) => s + b.faltan.length, 0),
  }
}
