/**
 * 📄 **A-BUG-173 — el cuadro 1 del Detalle de Pago: una línea por factura, sin retención parcial.**
 *
 * Observado por el usuario 2026-09-13 sobre el pago a Alcorta del 10/09, que está **frenado** por
 * esto: el circuito de mail se empezó a usar y se detuvo acá.
 *
 * ## Los tres cambios
 *
 * **1 · Una línea por factura.** La fila del Cash Flow es **el grupo de pago**, no la factura: llega
 * con `FC 6347 - ALCORTA | FC 6328 - ALCORTA | FC 6337 - ALCORTA` y **un solo importe sumado**. Por
 * eso no alcanza con cortar el texto — haría tres líneas sin importe. Las facturas viajan aparte, en
 * `ItemPago.facturas`.
 *
 * **2 · Sin repetir el proveedor.** Ya está en el encabezado del documento. Es el mismo criterio del
 * protocolo de registro: *el detalle no repite lo que ya dice otra columna*.
 *
 * **3 · 🛑 Sin retención por factura.** La retención se practica **sobre la orden de pago**; el
 * reparto por factura es un artefacto del cálculo — el mínimo no imponible se consume una vez, así
 * que **empezando por otra factura los parciales cambian con el mismo total**. El TXT de ARCA declara
 * una retención global y el certificado es uno solo.
 * → `MODULO_SICORE_RETENCIONES.md` § 🧠 La retención es de la orden de pago.
 *
 * ⚖️ **El descuento SÍ va por factura**: es lineal y es una condición comercial de ese comprobante.
 */

/** Una factura dentro de un grupo de pago. */
export interface SubFactura {
  comprobante: string
  fecha?: string | null
  imp_total: number
  descuento_aplicado?: number | null
}

export interface LineaDetalle {
  comprobante: string
  fecha: string
  imp_total: number
  descuento: number
}

const t = (s: string | null | undefined) => (s ?? '').trim()

const SEP_COMPROBANTES = ' | '
const SEP_NOTA = ' · '

/**
 * Saca el proveedor de la etiqueta del comprobante: `FC 6347 - ALCORTA EDMUNDO ERNESTO` → `FC 6347`.
 *
 * 📌 Se compara **normalizando**, porque el nombre del encabezado y el de la etiqueta no siempre
 * vienen igual escritos. Y si al sacarlo **no queda nada**, se devuelve la etiqueta entera: perder
 * el renglón es peor que repetir el nombre.
 */
export function sinElProveedor(etiqueta: string, proveedor: string): string {
  const e = t(etiqueta)
  const p = t(proveedor)
  if (!e || !p) return e

  const norm = (x: string) => x.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
  const limpio = e
    .split(/\s[-–—]\s/)
    .filter(parte => norm(parte) !== norm(p))
    .join(' - ')
    .trim()

  return limpio || e
}

/**
 * Las líneas del cuadro 1, ya desagregadas y sin el proveedor repetido.
 *
 * Si el ítem trae `facturas`, se listan una por una. Si no (una factura suelta, o un template), se
 * usa el ítem tal cual — así los llamadores que todavía no mandan el detalle siguen funcionando.
 */
export function lineasDelDetalle(
  items: Array<{
    comprobante?: string | null
    fecha?: string | null
    imp_total: number
    descuento_aplicado?: number | null
    origen?: string
    facturas?: SubFactura[] | null
  }>,
  proveedor: string,
): LineaDetalle[] {
  const salida: LineaDetalle[] = []

  for (const i of items) {
    if (i.facturas && i.facturas.length > 0) {
      for (const f of i.facturas) {
        salida.push({
          comprobante: sinElProveedor(etiquetaLimpia(f.comprobante), proveedor),
          fecha: t(f.fecha) || t(i.fecha),
          imp_total: Number(f.imp_total) || 0,
          descuento: Number(f.descuento_aplicado) || 0,
        })
      }
      continue
    }

    salida.push({
      comprobante: i.origen === 'ANTICIPO'
        ? 'Anticipo'
        : sinElProveedor(etiquetaLimpia(i.comprobante), proveedor) || '-',
      fecha: t(i.fecha),
      imp_total: Number(i.imp_total) || 0,
      descuento: Number(i.descuento_aplicado) || 0,
    })
  }

  return salida
}

/**
 * Saca la nota interna de cada comprobante (lo que va después de ` · `), respetando el separador de
 * comprobantes. Es [A-BUG-151]: cortar en el primer ` · ` se llevaba puesta las otras facturas.
 */
function etiquetaLimpia(txt: string | null | undefined): string {
  const s = t(txt)
  if (!s) return ''
  return s
    .split(SEP_COMPROBANTES)
    .map(parte => parte.split(SEP_NOTA)[0].trim())
    .filter(Boolean)
    .join(SEP_COMPROBANTES)
}

/** Un peso de diferencia es cero. */
const CERO = 0.005

export interface ResultadoControl {
  /** 🛑 Contradicciones internas: el documento no cierra **consigo mismo**. Frenan la emisión. */
  errores: string[]
  /** ⚠️ Diferencias contra el hecho del negocio. Se muestran y **no** frenan. */
  avisos: string[]
  /** `false` sólo si hay errores de integridad. */
  puedeEmitirse: boolean
}

/**
 * 🚦 **Los dos controles, y NO son lo mismo** (§ `CLAUDE.md` 🚦 Un control que frena vs. uno que avisa).
 *
 * *Precisión del usuario, que corrigió mi propuesta de frenar ante cualquier diferencia:* **«me debe
 * advertir si no da el control, pero es posible que yo tenga que pagar más o menos por algún motivo.
 * Pero si se ve un bug de inconsistencia de la app, sí debe avisar y no permitir usar»**.
 *
 * | | Compara | Una diferencia significa | |
 * |---|---|---|---|
 * | **Integridad** | el documento **contra sí mismo** | el papel **miente**: es un bug | 🛑 frena |
 * | **Discrepancia** | el documento contra el **hecho** | pago parcial, o de más | ⚠️ avisa |
 *
 * 🔑 Frenar de más termina en que alguien apague el control; frenar de menos deja salir un número
 * falso. Por eso frena **sólo la contradicción interna**, que es donde el error es seguro del sistema.
 */
export function controlarDetalle(
  lineas: LineaDetalle[],
  totales: { bruto: number; descuento: number; pagado: number; retencion: number },
): ResultadoControl {
  const errores: string[] = []
  const avisos: string[] = []

  const sumaLineas = lineas.reduce((s, l) => s + l.imp_total, 0)
  const sumaDesc = lineas.reduce((s, l) => s + l.descuento, 0)

  // 🛑 INTEGRIDAD — las líneas tienen que sumar el total que el propio comprobante imprime.
  //    Si al desagregar un grupo se pierde o se duplica plata, el documento se contradice.
  if (Math.abs(sumaLineas - totales.bruto) >= CERO) {
    errores.push(
      `Las ${lineas.length} líneas suman ${money(sumaLineas)} y el total del comprobante dice ` +
      `${money(totales.bruto)} (difieren ${money(Math.abs(sumaLineas - totales.bruto))}). ` +
      `El detalle no cierra contra su propio total.`)
  }

  if (Math.abs(sumaDesc - totales.descuento) >= CERO) {
    errores.push(
      `Los descuentos por factura suman ${money(sumaDesc)} y el total dice ${money(totales.descuento)}.`)
  }

  // ⚠️ DISCREPANCIA — lo que se pagó contra lo que se facturó. Puede ser deliberado.
  const cancelado = totales.pagado + totales.retencion + totales.descuento
  const dif = cancelado - totales.bruto
  if (Math.abs(dif) >= CERO) {
    avisos.push(dif < 0
      ? `Se cancela ${money(Math.abs(dif))} MENOS que el total facturado — pago parcial.`
      : `Se cancela ${money(dif)} MÁS que el total facturado.`)
  }

  return { errores, avisos, puedeEmitirse: errores.length === 0 }
}

function money(n: number): string {
  return `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
