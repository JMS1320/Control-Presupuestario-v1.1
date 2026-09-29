/**
 * 🧾 **QUÉ RETENCIONES COMPARTEN UN CERTIFICADO — la regla, en un solo lugar.**
 *
 * Enunciada por el usuario 2026-09-29, al encontrar el bug de BIOFARMA (A-BUG-1222):
 * > *«La agrupación es cuando lo pago agrupado, **no agrupar siempre**. Si son 2 pagos son 2
 * > retenciones.»*
 *
 * > **Un certificado = UN PAGO.** Varias facturas pagadas juntas comparten certificado. Dos pagos
 * > distintos —aunque sean del mismo proveedor, del mismo régimen y de la misma quincena— son **dos**
 * > retenciones y **dos** certificados.
 *
 * ## Por qué esto es un archivo y no dos `.eq()` en una query
 *
 * Porque la regla estaba escrita **dos veces** —en `registrar-retencion.ts` y, copiada, adentro de
 * `vista-facturas-arca`— y las dos veces estaba mal. Arreglar una sola habría dejado el bug vivo en
 * la mitad de los pagos, según desde qué pantalla se cobrara: § 🗺️ *«se arregló un camino de los
 * dos»* en su forma más pura. Acá la regla es una, y además se puede probar sin tocar la base.
 *
 * ## ⚠️ Y por qué la fecha y no el «origen»
 *
 * La fila que destapó el bug se había guardado con `origen: 'agrupacion'` —era un pago agrupado de
 * verdad, de varias facturas— así que **por ese campo parecía correcta**. Lo que estaba mal no era
 * el origen del pago sino **el alcance** de la reutilización: se reusaba por quincena.
 *
 * 📌 **Limitación conocida, dicha para que no sorprenda**: `sicore_retenciones` no guarda el grupo de
 * pago, así que lo más fino que hay para decir «este pago» es la **fecha**. Dos pagos distintos al
 * mismo proveedor **el mismo día** compartirían certificado. Es mucho más raro que el caso que esto
 * arregla, y el día que haga falta distinguirlos hay que guardar el grupo de pago en la tabla.
 */

/** Los cuatro datos que identifican un certificado. Si coinciden los cuatro, es el mismo. */
export interface ClaveCertificado {
  cuitEmisor: string
  tipoSicore: string
  quincena: string
  /** `AAAA-MM-DD`. **La que faltaba**: sin ella, un segundo pago heredaba el certificado del primero. */
  fechaPago: string
}

/** Normaliza para comparar: el CUIT llega con y sin guiones según quién lo cargó. */
const soloDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "")
const texto = (v: unknown) => String(v ?? "").trim().toLowerCase()
const fecha10 = (v: unknown) => String(v ?? "").slice(0, 10)

export function claveDeCertificado(r: {
  cuit_emisor?: string | null
  tipo_sicore?: string | null
  quincena?: string | null
  fecha_pago?: string | null
}): ClaveCertificado {
  return {
    cuitEmisor: soloDigitos(r.cuit_emisor),
    tipoSicore: texto(r.tipo_sicore),
    quincena: texto(r.quincena),
    fechaPago: fecha10(r.fecha_pago),
  }
}

/**
 * ¿Estas dos retenciones van en el **mismo** certificado?
 *
 * 🔑 **Devuelve `false` si falta cualquiera de los cuatro datos.** Ante la duda, certificados
 * separados: emitir dos certificados donde iba uno es un papel de más; **emitir uno donde iban dos
 * informa al proveedor una retención que no se le hizo en ese pago**, que es lo que pasó y lo que
 * hay que evitar.
 */
export function mismoCertificado(
  a: Parameters<typeof claveDeCertificado>[0],
  b: Parameters<typeof claveDeCertificado>[0],
): boolean {
  const x = claveDeCertificado(a)
  const y = claveDeCertificado(b)
  if (!x.cuitEmisor || !x.tipoSicore || !x.quincena || !x.fechaPago) return false
  if (!y.cuitEmisor || !y.tipoSicore || !y.quincena || !y.fechaPago) return false
  return x.cuitEmisor === y.cuitEmisor && x.tipoSicore === y.tipoSicore
    && x.quincena === y.quincena && x.fechaPago === y.fechaPago
}

/**
 * Agrupa retenciones en certificados. Es lo que tiene que usar cualquier pantalla que emita o
 * descargue certificados, **en vez de agrupar por `nro_certificado` a mano**.
 *
 * @returns un array por certificado, en el orden en que aparecen
 */
export function agruparEnCertificados<T extends Parameters<typeof claveDeCertificado>[0]>(
  retenciones: T[],
): T[][] {
  const grupos: T[][] = []
  for (const r of retenciones) {
    const g = grupos.find(g => mismoCertificado(g[0], r))
    if (g) g.push(r)
    // Una retención con datos incompletos va en su propio certificado: `mismoCertificado` da
    // `false` contra todo, incluida ella misma, y eso es lo que corresponde.
    else grupos.push([r])
  }
  return grupos
}
