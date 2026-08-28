// El puente ENTREGA ↔ FACTURA de un insumo, y sus controles.
//
// ── Los tres momentos ────────────────────────────────────────────────────────
//
//     "compré tanto"   →   "recibí este día"   →   llegó la factura
//                          MUEVE EL STOCK          TRAE EL PRECIO
//
// Son tres, no dos, y cada uno trae un conocimiento distinto. Confundirlos es lo que hoy hace
// que el maíz caiga como gasto del mes y nunca llegue al lote.
//
// ── Y no coinciden ───────────────────────────────────────────────────────────
// El caso Longo, real: la FC del 13/07 facturó 25 t de las que se habían entregado 20,1 el
// 24/06, y la FC del 14/08 facturó 20,1 t de las 25 entregadas el 24/07. Las 4,9 t de
// diferencia son un ANTICIPO que viaja con su propio precio.
//
// ⚠️ **El stock lo mueve la ENTREGA.** Si dependiera de la fecha de factura, los tramos de
// consumo saldrían mal — y de los tramos sale el costo de cada grupo.

export interface EntregaInsumo {
  id: string
  fecha: string
  cantidad: number
  proveedor?: string | null
  /** El precio tipeado a mano, cuando todavía no hay factura vinculada. */
  costoUnitarioManual: number | null
}

/**
 * El respaldo de una entrega. **No siempre es una factura de ARCA**: también puede ser la cuota
 * de un template de egresos sin factura — el maíz del 16/03 entró así.
 *
 * Se llama `FacturaCompra` por historia; lo que representa es *el papel que respalda el gasto*.
 */
export interface FacturaCompra {
  id: string
  fecha: string
  proveedor: string
  /** Nº visible: `0003-00001234`, o la descripción de la cuota si es un template. */
  numero: string
  /** Neto gravado: es sobre lo que se calcula el costo, sin IVA. */
  neto: number
  total: number
  /** De qué tabla salió. Un template no tiene IVA discriminado: su neto ES el monto. */
  origen?: 'arca' | 'template'
}

/** Un pedazo de una entrega cubierto por una factura. */
export interface Vinculo {
  id: string
  movimientoId: string
  facturaId: string
  cantidad: number
  precioUnitario: number | null
  origen?: 'arca' | 'template'
}

export interface EntregaConciliada {
  entrega: EntregaInsumo
  vinculos: (Vinculo & { factura: FacturaCompra | null })[]
  /** Lo cubierto por facturas. */
  cantidadFacturada: number
  /** Lo entregado que todavía no tiene factura. */
  sinFacturar: number
  /**
   * $ por unidad de la entrega: promedio ponderado de las facturas que la cubren.
   *
   * Si no hay vínculos cae al precio tipeado a mano. `null` si no hay ninguno de los dos — y
   * entonces el costo del tramo queda en `—`, nunca en cero.
   */
  precioUnitario: number | null
  /** De dónde salió el precio, para que se note cuando es a mano. */
  origenPrecio: 'facturas' | 'manual' | 'sin dato'
  faltantes: string[]
}

export interface FacturaConciliada {
  factura: FacturaCompra
  cantidadAplicada: number
  /** Facturado y todavía NO entregado: un anticipo. */
  anticipo: number | null
  montoAplicado: number
}

export interface ControlEntregasFacturas {
  entregas: EntregaConciliada[]
  facturas: FacturaConciliada[]
  /** Cantidad total entregada, esté facturada o no. */
  totalEntregado: number
  totalFacturado: number
  /** Lo entregado sin respaldo de factura. */
  totalSinFacturar: number
  controles: { nombre: string; cierra: boolean; detalle: string }[]
}

const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

/**
 * Cruza entregas con facturas y devuelve los dos lados con sus faltantes.
 *
 * `cantidadFacturadaDe(facturaId)` dice cuántas unidades declara la factura. Se pasa desde
 * afuera porque el comprobante de ARCA guarda importes, no toneladas: la cantidad la carga el
 * usuario al vincular.
 */
export function conciliarEntregasFacturas(
  entregas: EntregaInsumo[],
  facturas: FacturaCompra[],
  vinculos: Vinculo[],
): ControlEntregasFacturas {
  const facPorId = new Map(facturas.map(f => [f.id, f]))

  const conc: EntregaConciliada[] = entregas.map(e => {
    const mios = vinculos.filter(v => v.movimientoId === e.id)
      .map(v => ({ ...v, factura: facPorId.get(v.facturaId) ?? null }))
    const cantidadFacturada = mios.reduce((s, v) => s + v.cantidad, 0)
    const sinFacturar = Math.max(0, e.cantidad - cantidadFacturada)
    const faltantes: string[] = []

    // El precio: ponderado por lo que cubre cada factura. Un vínculo sin precio invalida el
    // promedio entero — mezclarlo con los que sí tienen daría un número que parece bueno.
    let precioUnitario: number | null = null
    let origenPrecio: EntregaConciliada['origenPrecio'] = 'sin dato'
    if (mios.length > 0 && cantidadFacturada > 0) {
      if (mios.some(v => v.precioUnitario == null)) {
        faltantes.push('hay una factura vinculada sin precio unitario')
      } else {
        precioUnitario = mios.reduce((s, v) => s + v.cantidad * (v.precioUnitario ?? 0), 0) / cantidadFacturada
        origenPrecio = 'facturas'
      }
    }
    if (precioUnitario == null && e.costoUnitarioManual != null) {
      precioUnitario = e.costoUnitarioManual
      origenPrecio = 'manual'
    }

    if (cantidadFacturada > e.cantidad + 0.001) {
      faltantes.push(`las facturas cubren ${num(cantidadFacturada)} y sólo se entregaron ${num(e.cantidad)}`)
    } else if (sinFacturar > 0.001) {
      faltantes.push(`${num(sinFacturar)} sin factura ni template todavía`)
    }

    return { entrega: e, vinculos: mios, cantidadFacturada, sinFacturar, precioUnitario, origenPrecio, faltantes }
  })

  const facs: FacturaConciliada[] = facturas.map(f => {
    const mios = vinculos.filter(v => v.facturaId === f.id)
    const cantidadAplicada = mios.reduce((s, v) => s + v.cantidad, 0)
    const montoAplicado = mios.reduce((s, v) => s + v.cantidad * (v.precioUnitario ?? 0), 0)
    // El anticipo se ve comparando el neto de la factura con lo aplicado: lo que sobra es
    // mercadería pagada y todavía no recibida.
    const anticipo = f.neto > 0 && montoAplicado > 0
      ? Math.round((f.neto - montoAplicado) * 100) / 100 : null
    return { factura: f, cantidadAplicada, anticipo, montoAplicado }
  })

  const totalEntregado = entregas.reduce((s, e) => s + e.cantidad, 0)
  const totalFacturado = vinculos.reduce((s, v) => s + v.cantidad, 0)
  const totalSinFacturar = conc.reduce((s, c) => s + c.sinFacturar, 0)

  const netoFacturas = facturas.reduce((s, f) => s + f.neto, 0)
  const aplicado = facs.reduce((s, f) => s + f.montoAplicado, 0)
  const cercaPlata = Math.abs(netoFacturas - aplicado) < Math.max(1, netoFacturas * 0.001)

  return {
    entregas: conc, facturas: facs,
    totalEntregado, totalFacturado, totalSinFacturar,
    controles: [
      {
        nombre: 'Lo entregado tiene respaldo',
        cierra: totalSinFacturar < 0.001,
        detalle: totalSinFacturar < 0.001
          ? `las ${num(totalEntregado)} entregadas tienen su factura o su template`
          : `${num(totalSinFacturar)} de ${num(totalEntregado)} sin respaldo`,
      },
      {
        nombre: 'Lo facturado está aplicado',
        cierra: cercaPlata,
        detalle: cercaPlata
          ? 'el neto de las facturas coincide con lo imputado a las entregas'
          : `facturado $${num(netoFacturas)} · aplicado $${num(aplicado)}`
            + ` · diferencia $${num(netoFacturas - aplicado)} (anticipos o entregas por venir)`,
      },
    ],
  }
}

/**
 * Las entregas listas para `consumo.ts`, con el precio que sale de las facturas.
 *
 * Es el punto donde el puente sirve para algo: el precio del tramo deja de ser un número
 * tipeado y pasa a ser **el de la factura**, rastreable hasta el comprobante.
 */
export function entregasParaConsumo(c: ControlEntregasFacturas) {
  return c.entregas.map(e => ({
    fecha: e.entrega.fecha,
    cantidad: e.entrega.cantidad,
    precioUnitario: e.precioUnitario,
    detalle: [e.entrega.proveedor, e.origenPrecio === 'manual' ? 'precio a mano' : null]
      .filter(Boolean).join(' · ') || undefined,
  }))
}

// ── De dónde salen los respaldos ─────────────────────────────────────────────

/**
 * Trae los dos orígenes posibles del respaldo de una entrega, en una sola lista.
 *
 * Vive acá y no en cada pantalla porque **lo usan tres**: el panel de Facturas, el modal de
 * compra de insumos y el margen. Tres consultas distintas al mismo concepto es como terminan
 * mostrando cosas distintas.
 *
 * `sb` se pasa como parámetro para no importar el cliente acá — este archivo es lógica pura y
 * se testea sin base.
 */
export async function traerRespaldos(
  sb: {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          order: (c: string, o?: { ascending?: boolean }) => {
            limit: (n: number) => PromiseLike<{ data: unknown[] | null }>
          }
        }
      }
    }
  },
  limite = 400,
): Promise<FacturaCompra[]> {
  const [arca, cuotas] = await Promise.all([
    sb.schema('msa').from('comprobantes_arca')
      .select('id, fecha_emision, denominacion_emisor, punto_venta, numero_desde, imp_neto_gravado, imp_total')
      .order('fecha_emision', { ascending: false }).limit(limite),
    // La CUOTA, no el template: es la que tiene fecha y monto concretos.
    sb.schema('public').from('cuotas_egresos_sin_factura')
      .select('id, fecha_pago, fecha_estimada, monto, descripcion, categ, egreso_id')
      .order('fecha_estimada', { ascending: false }).limit(limite),
  ])

  const deArca: FacturaCompra[] = (((arca.data ?? []) as Record<string, unknown>[])).map(f => ({
    id: String(f.id),
    fecha: String(f.fecha_emision ?? ''),
    proveedor: String(f.denominacion_emisor ?? ''),
    numero: `${String(f.punto_venta ?? 0).padStart(4, '0')}-${String(f.numero_desde ?? 0).padStart(8, '0')}`,
    neto: Number(f.imp_neto_gravado) || 0,
    total: Number(f.imp_total) || 0,
    origen: 'arca',
  }))

  // ⚠️ En un template el **monto ES el neto**: no hay IVA discriminado que descontar.
  const deTemplate: FacturaCompra[] = (((cuotas.data ?? []) as Record<string, unknown>[])).map(c => ({
    id: String(c.id),
    fecha: String(c.fecha_pago ?? c.fecha_estimada ?? ''),
    proveedor: String(c.categ ?? 'template'),
    numero: String(c.descripcion ?? '').slice(0, 60) || 'cuota sin descripción',
    neto: Number(c.monto) || 0,
    total: Number(c.monto) || 0,
    origen: 'template',
  }))

  return [...deArca, ...deTemplate].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
