/**
 * 🏛️ Las DECISIONES sobre una boleta de ARBA — lógica pura, sin base de datos.
 *
 * ## Por qué está separada del panel
 * Acá se decide **si una boleta puede pisar el monto de una cuota del presupuesto**, y eso mueve
 * plata proyectada. Enterrado adentro de un componente que consulta Supabase y dibuja una tabla no
 * se podía probar con números; separado, sí.
 *
 * 🔴 **La regla que manda todo** (textual del usuario): *«no reemplazar los templates, ya que yo debo
 * ver y decidir: cambiar éste sí, éste no, todos»*. Nada de acá aplica nada: sólo **propone** y
 * **explica por qué**. Aplicar es siempre un acto explícito del usuario.
 */

/** La cuota del template contra la que se compara. */
export interface CuotaTemplate {
  monto: number
  /** `proyectado` | `estimado` | `conciliado` … — sólo importa si es `conciliado`. */
  estado: string
  /** ISO. La que hoy tiene el template — puede estar vacía o vieja. */
  fechaVencimiento?: string | null
}

export interface Decision {
  /** ¿Se propone tildada? Nunca se aplica sola. */
  aplicar: boolean
  /** Por qué NO se propone, en palabras del usuario. `null` si no hay nada que decir. */
  problema: string | null
  /** Qué cambiaría al aplicar. Vacío = no hay nada que cambiar. */
  cambia: ("monto" | "vencimiento")[]
}

/** Tolerancia de $1: ARBA redondea, y un centavo no es una diferencia que valga la pena mover. */
export const TOL = 1

/**
 * ¿Se propone aplicar esta boleta a esta cuota?
 *
 * 🔑 Se propone sólo cuando el monto **difiere** y la cuota **no está conciliada**. Una cuota
 * conciliada ya se pagó por ese importe: cambiarla **reescribe un hecho, no una proyección**. Se
 * puede tildar a mano igual —el usuario manda—, pero avisando.
 */
export function decidirAplicar(
  cuota: CuotaTemplate | null,
  importeBoleta: number | null,
  cuotaNro: number | null,
  vencimientoBoleta?: string | null,
): Decision {
  const nada: ("monto" | "vencimiento")[] = []
  if (cuotaNro == null) return { aplicar: false, problema: "boleta anual: no corresponde a una cuota puntual", cambia: nada }
  if (!cuota) return { aplicar: false, problema: `el template no tiene cuota ${cuotaNro}`, cambia: nada }
  if (importeBoleta == null) return { aplicar: false, problema: "no se pudo leer el importe — escribilo a mano", cambia: nada }

  const cambia: ("monto" | "vencimiento")[] = []
  if (Math.abs(cuota.monto - importeBoleta) > TOL) cambia.push("monto")
  // 🔑 **La fecha de vencimiento cuenta igual que el monto.** Si sólo mirara el importe, una boleta
  // que llega con el mismo monto pero **otra fecha de vencimiento** no se propondría, y el usuario
  // pagaría mirando una fecha vieja. Pedido explícito suyo: *«montos y fechas de venc»*.
  if (vencimientoBoleta && vencimientoBoleta !== (cuota.fechaVencimiento ?? null)) cambia.push("vencimiento")

  if (cuota.estado === "conciliado") {
    return {
      aplicar: false,
      problema: cambia.length ? "ya conciliada con otro importe — revisá antes de tocarla" : null,
      cambia,
    }
  }
  return { aplicar: cambia.length > 0, problema: null, cambia }
}

export type EstadoControl = "coincide" | "difiere" | "sin_mail" | "sin_pdf"

export interface ControlDosCaminos {
  estado: EstadoControl
  /** ¿Se puede dar por bueno el número? `false` cuando difieren. */
  cierra: boolean
  diferencia: number | null
  detalle: string
}

/**
 * 🔁 **El mismo importe por dos caminos** — la *pieza 4* del norte administrativo, gratis.
 *
 * El importe de una boleta llega **dos veces**: en la **tabla del cuerpo del mail** (`A-FEAT-107`) y
 * adentro del **PDF**. Son dos lecturas independientes, así que compararlas no cuesta nada y detecta
 * lo que ninguna de las dos detecta sola: un parseo malo, la boleta de otro período, un archivo que
 * no es el que dice ser.
 *
 * ⚠️ **No elige ninguno en silencio.** Si difieren, lo dice y el usuario decide — que es lo mismo
 * que hace el resto del sistema con los descuadres.
 */
export function controlDosCaminos(importePdf: number | null, importeMail: number | null): ControlDosCaminos {
  if (importePdf == null && importeMail == null) {
    return { estado: "sin_pdf", cierra: false, diferencia: null, detalle: "no se pudo leer el importe por ninguna vía" }
  }
  if (importeMail == null) {
    return { estado: "sin_mail", cierra: false, diferencia: null, detalle: "sólo del PDF (esta boleta no vino del mail)" }
  }
  if (importePdf == null) {
    return { estado: "sin_pdf", cierra: false, diferencia: null, detalle: "sólo del mail: el PDF no dio importe" }
  }
  const d = Math.round((importePdf - importeMail) * 100) / 100
  return Math.abs(d) <= TOL
    ? { estado: "coincide", cierra: true, diferencia: d, detalle: "el mail y el PDF dicen lo mismo" }
    : { estado: "difiere", cierra: false, diferencia: d, detalle: "el mail y el PDF NO coinciden — mirá cuál es el bueno" }
}

/**
 * 🐾 **La huella**: lo que leyó el parser junto a lo que puso el usuario.
 *
 * Sin las dos puntas no sirve de nada — saber que un campo se corrigió no dice dónde falla el
 * parser; saber que **leyó `185` y el usuario puso `373`** dice dónde falla y cuánto
 * (§ 📄 Importar un documento, condición 4).
 *
 * Sólo entran los campos que **cambiaron de verdad**: guardar los iguales convierte la huella en
 * ruido y deja de servir para preguntarle qué se corrige más.
 */
export function huellaBoleta(
  leido: Record<string, unknown>,
  puesto: Record<string, unknown>,
): Record<string, { leido: unknown; puesto: unknown }> {
  const h: Record<string, { leido: unknown; puesto: unknown }> = {}
  for (const k of Object.keys(puesto)) {
    const a = leido[k] ?? null
    const b = puesto[k] ?? null
    if (a === b) continue
    // Los números se comparan con la misma tolerancia que el resto: $0,004 no es una corrección.
    if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.005) continue
    h[k] = { leido: a, puesto: b }
  }
  return h
}

/** Un monto es-AR escrito a mano (`1.198.244,20`) a número. Devuelve `null` si no es un número. */
export function aMonto(txt: string): number | null {
  const t = String(txt ?? "").trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? null : n
}
