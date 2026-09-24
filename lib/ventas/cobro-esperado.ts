/**
 * 💰 **A-FEAT-167 — cuánto va a acreditar el banco por una venta.**
 *
 * ## Por qué esto vive acá y no en la pantalla
 * El cálculo estaba **dentro de `vista-liquidaciones-msa.tsx`**. El motor de conciliación necesita
 * el mismo número para poder matchear un crédito — y si lo recalcula por su cuenta, **el día que
 * alguien toque una de las dos versiones los números dejan de coincidir** y nadie se entera.
 *
 * Es el caso de `resolverPrecioHacienda`, que lleva un comentario que dice exactamente esto: *«es la
 * que usan tanto Productivo como Presupuesto, para que den lo mismo»* (§ `CLAUDE.md` ♻️).
 *
 * ## 🔑 Lo que el usuario corrigió, y es la clave del match
 * Yo iba a matchear contra el **Importe neto**. Él preguntó si no correspondía el **Pago según
 * condiciones** — *«que afecta más a las ventas de granos, liquidación primaria, ej. de
 * Agricultores Federados»*. **Tenía razón, y la diferencia es el IVA de la RG 2300**: en granos, el
 * comprador **retiene el IVA y lo paga a ARCA**, no al vendedor.
 *
 * | | Importe neto | IVA RG 2300 | **Pago s/cond.** |
 * |---|---|---|---|
 * | AFA 31274417 | $5.635.287,59 | $302.638,70 | **$5.332.648,89** |
 * | Provinvest | $47.001.471 | **0** | **$47.001.471** |
 *
 * 📌 **`pagoCondiciones` es el correcto SIEMPRE**: cuando no hay IVA retenido los dos coinciden, así
 * que no se pierde nada usándolo; el `importeNeto` sólo acierta a veces. **Matchear contra el neto
 * habría fallado en todas las liquidaciones de granos, que son las más grandes.**
 */

export interface ComprobanteVentaParaCobro {
  imp_total?: number | null
  subtotal_neto?: number | null
  imp_neto_gravado?: number | null
  imp_neto_no_gravado?: number | null
  imp_op_exentas?: number | null
  iva?: number | null
  comision_neto?: number | null
  comision_iva?: number | null
  almacenaje_neto?: number | null
  almacenaje_iva?: number | null
  ret_iva?: number | null
  ret_iibb?: number | null
}

export interface CobroEsperado {
  /** Lo facturado. */
  totalOperacion: number
  /** Comisión + almacenaje, con su IVA. Lo que el comprador descuenta por el servicio. */
  deducciones: number
  /** Retenciones de la liquidación **más** las cargadas aparte en `retenciones_recibidas`. */
  retenciones: number
  /** Total − deducciones − retenciones. **No es lo que acredita el banco** si hay IVA RG 2300. */
  importeNeto: number
  /** El IVA que el comprador retiene por RG 2300 y paga a ARCA en vez de al vendedor. */
  ivaRg2300: number
  /** 🎯 **Lo que efectivamente acredita el banco.** Es el número contra el que hay que matchear. */
  pagoCondiciones: number
}

const n = (x: number | null | undefined) => Number(x) || 0

/**
 * @param retencionesAparte suma de `retenciones_recibidas` de ese comprobante — viaja como parámetro
 *        porque vive en otra tabla y acá no se consulta nada.
 */
export function cobroEsperado(
  v: ComprobanteVentaParaCobro,
  retencionesAparte = 0,
): CobroEsperado {
  const neto = n(v.subtotal_neto)
    || (n(v.imp_neto_gravado) + n(v.imp_neto_no_gravado) + n(v.imp_op_exentas))
  const ivaVenta = n(v.iva)

  // `imp_total` es el absoluto de la liquidación; si falta, se reconstruye.
  const totalOperacion = n(v.imp_total) || (neto + ivaVenta)

  const deducciones = n(v.comision_neto) + n(v.comision_iva) + n(v.almacenaje_neto) + n(v.almacenaje_iva)
  const retenciones = n(v.ret_iva) + n(v.ret_iibb) + n(retencionesAparte)

  const importeNeto = totalOperacion - deducciones - retenciones

  // El IVA que queda en juego después de descontar el de los servicios y el ya retenido.
  const ivaTotal = ivaVenta - n(v.comision_iva) - n(v.almacenaje_iva)
  const ivaRg2300 = ivaTotal - n(v.ret_iva)

  return {
    totalOperacion,
    deducciones,
    retenciones,
    importeNeto,
    ivaRg2300,
    pagoCondiciones: importeNeto - ivaRg2300,
  }
}

/** Un peso de diferencia es cero. */
const CERO = 0.005

/**
 * Qué tan lejos está un crédito del banco del cobro esperado.
 *
 * ⚠️ **Una diferencia grande NO es un descuadre: suele ser una retención sin cargar.** Caso real:
 * Sanpa FC-20 figura con **$0 de retenciones** y el banco acreditó **6,5% menos** — el hueco no está
 * en el movimiento, está en las retenciones que nadie cargó todavía.
 */
export function diferenciaContraElBanco(
  acreditado: number,
  esperado: CobroEsperado,
): { diferencia: number; porcentaje: number; exacto: boolean } {
  const diferencia = (Number(acreditado) || 0) - esperado.pagoCondiciones
  const base = esperado.pagoCondiciones || esperado.totalOperacion || 1
  return {
    diferencia,
    porcentaje: (diferencia / base) * 100,
    exacto: Math.abs(diferencia) < CERO,
  }
}
