/**
 * 🧾 **QUÉ RETENCIONES COMPARTEN UN CERTIFICADO — la regla, en un solo lugar.**
 *
 * Enunciada por el usuario 2026-09-29, al encontrar el bug de BIOFARMA (A-BUG-1222), y **precisada
 * por él** el mismo día después de un primer intento mío que se quedaba corto:
 *
 * > *«El certificado debe ser **por pago y no por día**. Lo que lo agrupa es **la transferencia**, no
 * > el día de pago. Si es pago vía grupo, el certificado es del grupo; si el mismo día luego pago
 * > otra factura, es otra retención.»*
 *
 * > **Un certificado = UN PAGO.** Las facturas que se pagan en una misma transferencia comparten
 * > certificado. Dos pagos distintos son dos certificados, **aunque caigan el mismo día**, sean del
 * > mismo proveedor y del mismo régimen.
 *
 * ## 🧨 Mi primer intento usaba la FECHA, y estaba mal
 *
 * Arreglé el bug original cambiando el alcance de «la quincena» a «la fecha de pago». Mejor, pero
 * insuficiente: **dos pagos directos al mismo proveedor el mismo día seguían compartiendo
 * certificado.** Y el caso estaba en los datos del usuario: el 10/09 le pagó a ALCORTA **dos veces**
 * —un grupo de tres facturas de Bienes y una factura de Servicios suelta—. Lo corrigió él.
 *
 * 🔑 **Por eso `sicore_retenciones` ganó la columna `grupo_pago_id`** (migración
 * `sicore_retenciones_grupo_pago_id`, 2026-09-29, autorizada por el usuario): la retención ahora
 * guarda **de qué pago salió**, que es el dato que la regla necesita y que antes no existía.
 *
 * ## Cómo se decide, y por qué son dos mecanismos y no uno
 *
 * | | Quién decide | Con qué |
 * |---|---|---|
 * | **Al REGISTRAR** una retención: ¿reusa el número o pide uno nuevo? | `registrarEnSicoreRetenciones` | `clavePago` — el grupo de pago |
 * | **Al MOSTRAR o BAJAR** un certificado: ¿qué filas van juntas? | las pantallas | el `nro_certificado` guardado |
 *
 * Parece redundante y no lo es: **el número ES la identidad del certificado** una vez que está bien
 * asignado, y es lo que el proveedor y ARCA ven. Agrupar para mostrar por cualquier otra cosa sería
 * inventar una segunda verdad.
 *
 * 🧮 **Y lo que une los dos mecanismos es un CONTROL, no la fe**: `certificadosConVariosPagos`
 * busca números que cubran más de un pago. Si el registro hace bien su trabajo, devuelve vacío;
 * si algún día vuelve a fallar, lo dice **antes** de que salga un certificado sumado. Es exactamente
 * el control que faltaba y que habría atajado esto: había **dos** casos vivos (BIOFARMA y LONGO) y
 * los encontró el usuario, no el sistema.
 *
 * 📌 **Las filas anteriores al 29/09/2026 tienen `grupo_pago_id` en NULL.** Para ésas el control usa
 * `fecha_pago` como respaldo —no se puede saber más de lo que se guardó— y **se muestran bien igual**,
 * porque se agrupan por su número, que ya está corregido.
 *
 * ⚠️ **Y ese respaldo es la diferencia entre un control útil y uno que se apaga**: la primera versión
 * usaba el comprobante para las filas viejas y marcó **seis grupos legítimos de ALCORTA** como error.
 * Lo destapó el propio control al correrlo sobre el ejercicio entero, antes de que el usuario lo viera.
 */

/** Lo que hace falta saber de una retención para ubicarla. */
export interface RetencionParaClave {
  grupo_pago_id?: string | null
  factura_id?: string | null
  anticipo_id?: string | null
  fecha_pago?: string | null
  cuit_emisor?: string | null
  tipo_sicore?: string | null
  quincena?: string | null
  nro_certificado?: string | null
  /** Cuándo se escribió la fila. Distingue las anteriores a `grupo_pago_id` — ver `clavePago`. */
  created_at?: string | null
}

/**
 * 📅 **Desde cuándo las filas guardan de qué pago salieron.**
 *
 * Es la fecha de la migración `sicore_retenciones_grupo_pago_id`. Antes de esto **no existía el
 * dato**, así que de una fila vieja no se puede saber si fue un pago agrupado o varios directos: lo
 * único que quedó es la fecha.
 *
 * 🧨 **Hace falta y lo demostró el control.** Sin esta frontera, `clavePago` caía en el
 * `factura_id` de las filas viejas y las trataba como pagos separados — así, los grupos legítimos de
 * ALCORTA (3 y hasta 5 facturas pagadas juntas, marzo a junio) salían marcados como error. **Seis
 * falsos positivos.** Un control que grita donde no hay nada se apaga, y entonces no avisa cuando sí.
 */
export const DESDE_CUANDO_HAY_GRUPO_DE_PAGO = "2026-09-29"

const soloDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "")
const texto = (v: unknown) => String(v ?? "").trim().toLowerCase()
const fecha10 = (v: unknown) => String(v ?? "").slice(0, 10)

/**
 * **De qué PAGO salió esta retención.** Es la clave de la regla.
 *
 * - **Con grupo de pago** → `grupo:<id>`. Todas las facturas de esa transferencia comparten pago.
 * - **Sin grupo** (pago directo) → `fc:<id>` o `ant:<id>`, el comprobante que se pagó. Cada pago
 *   directo es **su propio** certificado, y ahí está la corrección del usuario: dos directos del
 *   mismo día son dos certificados.
 * - **Fila anterior a la columna** → `fecha:<AAAA-MM-DD>`, lo único que quedó guardado de aquel pago.
 */
export function clavePago(r: RetencionParaClave): string {
  if (r.grupo_pago_id) return `grupo:${r.grupo_pago_id}`

  /**
   * 📅 **Una fila VIEJA no sabe de qué pago salió**, así que lo más que se puede afirmar es el día.
   * Tratarla por su comprobante la convertiría en «un pago por factura» y marcaría como error
   * cualquier grupo anterior a la columna. Ver `DESDE_CUANDO_HAY_GRUPO_DE_PAGO`.
   */
  const cuando = fecha10(r.created_at)
  if (cuando && cuando < DESDE_CUANDO_HAY_GRUPO_DE_PAGO) return `fecha:${fecha10(r.fecha_pago)}`

  // Fila nueva sin grupo: es un pago DIRECTO, y su identidad es el comprobante que se pagó.
  if (r.factura_id) return `fc:${r.factura_id}`
  if (r.anticipo_id) return `ant:${r.anticipo_id}`
  return `fecha:${fecha10(r.fecha_pago)}`
}

/** El régimen y el período, que también separan certificados: cada régimen declara aparte. */
export function claveRegimen(r: RetencionParaClave): string {
  return `${soloDigitos(r.cuit_emisor)}|${texto(r.tipo_sicore)}|${texto(r.quincena)}`
}

/**
 * ¿Estas dos retenciones son **del mismo pago y del mismo régimen**? Es lo que decide si comparten
 * número de certificado al registrarse.
 *
 * 🛑 Devuelve `false` si falta el CUIT, el régimen o la quincena. **Ante la duda, certificados
 * separados**: emitir dos donde iba uno es un papel de más; emitir uno donde iban dos **le informa al
 * proveedor una retención que no se le hizo en ese pago**, que es lo que pasó y lo que hay que evitar.
 */
export function mismoCertificado(a: RetencionParaClave, b: RetencionParaClave): boolean {
  const ra = claveRegimen(a)
  if (ra.startsWith("|") || ra.endsWith("|") || ra.includes("||")) return false
  return ra === claveRegimen(b) && clavePago(a) === clavePago(b)
}

/**
 * Agrupa retenciones en certificados **para mostrar o bajar**.
 *
 * Usa el **`nro_certificado` guardado**, que es la identidad real del certificado: es lo que el
 * proveedor recibió y lo que ARCA va a ver. Una fila sin número —no debería haberlas— cae en su
 * propio grupo, que es el lado seguro.
 */
export function agruparEnCertificados<T extends RetencionParaClave>(retenciones: T[]): T[][] {
  const porNumero = new Map<string, T[]>()
  const sueltas: T[][] = []
  for (const r of retenciones) {
    if (!r.nro_certificado) { sueltas.push([r]); continue }
    const k = String(r.nro_certificado)
    const g = porNumero.get(k)
    if (g) g.push(r)
    else porNumero.set(k, [r])
  }
  return [...porNumero.values(), ...sueltas]
}

/** Un número de certificado que cubre más de un pago. Es el hallazgo del control. */
export interface CertificadoConVariosPagos {
  nroCertificado: string
  proveedor: string
  /** Un elemento por pago distinto que quedó adentro del mismo número. */
  pagos: Array<{ clave: string; fechaPago: string; retencion: number; filas: number }>
  /** Lo que el certificado informaría sumado, que es el número equivocado que vería el proveedor. */
  totalSumado: number
}

/**
 * 🧮 **EL CONTROL.** Busca números de certificado que abarquen **más de un pago**.
 *
 * Es el camino inverso del registro (§ `CLAUDE.md` 🧮): si la asignación de números respeta
 * «un certificado = un pago», esto devuelve **vacío**. Cualquier resultado es un certificado que
 * saldría sumando pagos distintos.
 *
 * 📌 Corrido el 2026-09-29 sobre agosto y septiembre encontró **dos**: BIOFARMA (`…000065`,
 * $178.983,20 donde iban $69.213,15) y LONGO (`…000055`, $237.691,30). Los dos se renumeraron.
 */
export function certificadosConVariosPagos(
  retenciones: Array<RetencionParaClave & { retencion?: number; denominacion_emisor?: string | null; anulado?: boolean }>,
): CertificadoConVariosPagos[] {
  const porNumero = new Map<string, typeof retenciones>()
  for (const r of retenciones) {
    if (r.anulado || !r.nro_certificado) continue
    const k = String(r.nro_certificado)
    const g = porNumero.get(k)
    if (g) g.push(r)
    else porNumero.set(k, [r])
  }

  const hallazgos: CertificadoConVariosPagos[] = []
  for (const [nroCertificado, filas] of porNumero) {
    const porPago = new Map<string, { clave: string; fechaPago: string; retencion: number; filas: number }>()
    for (const f of filas) {
      const clave = clavePago(f)
      const e = porPago.get(clave) ?? { clave, fechaPago: fecha10(f.fecha_pago), retencion: 0, filas: 0 }
      e.retencion = Math.round((e.retencion + (Number(f.retencion) || 0)) * 100) / 100
      e.filas += 1
      porPago.set(clave, e)
    }
    if (porPago.size <= 1) continue
    hallazgos.push({
      nroCertificado,
      proveedor: String(filas[0].denominacion_emisor ?? ""),
      pagos: [...porPago.values()].sort((a, b) => a.fechaPago.localeCompare(b.fechaPago)),
      totalSumado: Math.round(filas.reduce((s, f) => s + (Number(f.retencion) || 0), 0) * 100) / 100,
    })
  }
  return hallazgos.sort((a, b) => b.totalSumado - a.totalSumado)
}
