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

  // ⚠️ **Sólo los respaldos VINCULADOS.** Sumar todos los que se le pasaron era comparar el
  // neto de cientos de facturas del sistema contra lo imputado a un insumo: el control daba
  // una diferencia enorme y constante, o sea que no decía nada. Lo notó el usuario —
  // *"no sé dónde se ve eso"*— y tenía razón: no se veía porque no significaba nada.
  const usados = facs.filter(f => f.cantidadAplicada > 0)
  const netoFacturas = usados.reduce((s, f) => s + f.factura.neto, 0)
  const aplicado = usados.reduce((s, f) => s + f.montoAplicado, 0)
  // ⚠️ **El total no alcanza como control.** Dos errores opuestos se compensan: con una factura
  // imputada de menos por $1.310.750 y otra de más por $1.310.795, la diferencia global da $45 y
  // el control diría que todo cierra. Por eso además se mira **respaldo por respaldo**.
  const cercaPlata = usados.length === 0
    || (Math.abs(netoFacturas - aplicado) < Math.max(1, netoFacturas * 0.001)
        && usados.every(f => Math.abs(f.factura.neto - f.montoAplicado)
          < Math.max(1, f.factura.neto * 0.001)))

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
        detalle: usados.length === 0
          ? 'todavía no hay ningún respaldo vinculado'
          : cercaPlata
            ? `los ${usados.length} respaldos vinculados están imputados enteros`
              + ', uno por uno'
            : (() => {
                const mal = usados.filter(f => Math.abs(f.factura.neto - f.montoAplicado)
                  >= Math.max(1, f.factura.neto * 0.001))
                return `${mal.length} de ${usados.length} respaldos no cierran contra lo imputado`
                  + ` · diferencia global $${num(netoFacturas - aplicado)}`
                  + ' — mirá el detalle de abajo, el total puede cerrar con dos errores que se compensan'
              })(),
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
//
// ⚠️ **Se busca en el servidor, no filtrando una lista precargada.** Precargar "las últimas N"
// y filtrar en el navegador parecía más simple y estaba mal: hay **1.019 cuotas** y la del maíz
// del 16/03 tenía **591 más nuevas encima**, así que con un tope de 400 no se cargaba nunca.
// El usuario la buscó por "maiz", por "otros gastos" y por proveedor, y no aparecía por ningún
// lado — no porque el filtro fallara, sino porque la fila no estaba.
//
// La lección es la de siempre: un tope silencioso no da error, **da menos resultados**.

interface ClienteSb {
  schema: (s: string) => {
    from: (t: string) => {
      select: (c: string) => {
        or: (f: string) => {
          order: (c: string, o?: { ascending?: boolean }) => {
            limit: (n: number) => PromiseLike<{ data: unknown[] | null }>
          }
        }
        order: (c: string, o?: { ascending?: boolean }) => {
          limit: (n: number) => PromiseLike<{ data: unknown[] | null }>
        }
        in: (c: string, v: string[]) => PromiseLike<{ data: unknown[] | null }>
      }
    }
  }
}

const COLS_ARCA =
  'id, fecha_emision, denominacion_emisor, punto_venta, numero_desde, imp_neto_gravado, imp_total'
const COLS_CUOTA = 'id, fecha_pago, fecha_estimada, monto, descripcion, categ'

const deArca = (rows: unknown[] | null): FacturaCompra[] =>
  ((rows ?? []) as Record<string, unknown>[]).map(f => ({
    id: String(f.id),
    fecha: String(f.fecha_emision ?? ''),
    proveedor: String(f.denominacion_emisor ?? ''),
    numero: `${String(f.punto_venta ?? 0).padStart(4, '0')}-${String(f.numero_desde ?? 0).padStart(8, '0')}`,
    neto: Number(f.imp_neto_gravado) || 0,
    total: Number(f.imp_total) || 0,
    origen: 'arca',
  }))

/** ⚠️ En un template el **monto ES el neto**: no hay IVA discriminado que descontar. */
const deTemplate = (rows: unknown[] | null): FacturaCompra[] =>
  ((rows ?? []) as Record<string, unknown>[]).map(c => ({
    id: String(c.id),
    fecha: String(c.fecha_pago ?? c.fecha_estimada ?? ''),
    proveedor: String(c.categ ?? 'template'),
    numero: String(c.descripcion ?? '').slice(0, 70) || 'cuota sin descripción',
    neto: Number(c.monto) || 0,
    total: Number(c.monto) || 0,
    origen: 'template',
  }))

/**
 * Los respaldos **que están vinculados**, traídos por su id — los dos orígenes.
 *
 * ⚠️ **Ésta es la que hay que usar para LEER un vínculo ya hecho** (el margen, el ciclo, los
 * scripts de control). `traerRespaldos()` es sólo para *ofrecerle una lista al usuario*: trae los
 * más recientes y por lo tanto **no alcanza a los viejos**. El maíz del 16/03 se respalda con una
 * cuota de template que tiene 591 más nuevas encima: leerlo con `traerRespaldos()` no lo encuentra,
 * el vínculo queda **sin precio**, y el tramo entero — 21.560 kg — sale del costo **sin decir nada**.
 *
 * Es el mismo tope silencioso de A-BUG-81, del lado de la lectura: no da error, da de menos.
 * Acá no hay tope posible porque se pide exactamente lo que se necesita.
 */
export async function respaldosPorId(
  sb: ClienteSb, vinculos: Vinculo[],
): Promise<FacturaCompra[]> {
  const ids = (o: 'arca' | 'template') =>
    [...new Set(vinculos.filter(v => (v.origen ?? 'arca') === o).map(v => v.facturaId))]
  const idsArca = ids('arca')
  const idsTpl = ids('template')

  const [arca, cuotas] = await Promise.all([
    idsArca.length
      ? sb.schema('msa').from('comprobantes_arca').select(COLS_ARCA).in('id', idsArca)
      : Promise.resolve({ data: [] as unknown[] }),
    idsTpl.length
      ? sb.schema('public').from('cuotas_egresos_sin_factura').select(COLS_CUOTA).in('id', idsTpl)
      : Promise.resolve({ data: [] as unknown[] }),
  ])
  return [...deArca(arca.data), ...deTemplate(cuotas.data)]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Los respaldos más recientes de los dos orígenes. Para mostrar algo sin que se escriba nada. */
export async function traerRespaldos(sb: ClienteSb, limite = 300): Promise<FacturaCompra[]> {
  const [arca, cuotas] = await Promise.all([
    sb.schema('msa').from('comprobantes_arca').select(COLS_ARCA)
      .order('fecha_emision', { ascending: false }).limit(limite),
    sb.schema('public').from('cuotas_egresos_sin_factura').select(COLS_CUOTA)
      .order('fecha_estimada', { ascending: false }).limit(limite),
  ])
  return [...deArca(arca.data), ...deTemplate(cuotas.data)]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * Busca respaldos **en el servidor**, en los dos orígenes.
 *
 * Es lo que hace falta para encontrar algo viejo: la del maíz del 16/03 tiene 591 cuotas más
 * nuevas encima y ninguna lista precargada razonable la alcanza.
 */
export async function buscarRespaldos(
  sb: ClienteSb, q: string, limite = 25,
): Promise<FacturaCompra[]> {
  const t = q.trim()
  if (t.length < 2) return []
  // PostgREST no acepta comas ni paréntesis sueltos dentro de un `or`.
  const safe = t.replace(/[(),]/g, ' ').trim()
  if (!safe) return []
  const soloNum = safe.replace(/\D/g, '')

  const filtroArca = [
    `denominacion_emisor.ilike.*${safe}*`,
    ...(soloNum.length >= 3 ? [`numero_desde.eq.${soloNum}`] : []),
  ].join(',')

  const [arca, cuotas] = await Promise.all([
    sb.schema('msa').from('comprobantes_arca').select(COLS_ARCA).or(filtroArca)
      .order('fecha_emision', { ascending: false }).limit(limite),
    sb.schema('public').from('cuotas_egresos_sin_factura').select(COLS_CUOTA)
      .or(`descripcion.ilike.*${safe}*,categ.ilike.*${safe}*`)
      .order('fecha_estimada', { ascending: false }).limit(limite),
  ])
  return [...deArca(arca.data), ...deTemplate(cuotas.data)]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * ¿Este respaldo ya está aplicado entero?
 *
 * Sirve para **sacarlo del buscador**: si la factura de Arroyo Tala del 11/05 ya cubre su
 * entrega, ofrecerla otra vez sólo invita a vincularla dos veces. Lo pidió el usuario
 * (2026-08-28): *"al ir a cargar la segunda me vuelve a mostrar las 2 FC, debería mostrarme
 * sólo 1"*.
 *
 * Se compara **por monto** y no por cantidad, porque la cantidad del comprobante no está en
 * ningún lado: lo único que se sabe es su neto.
 */
export function estaAplicadaEntera(f: FacturaCompra, vinculos: Vinculo[]): boolean {
  return usoDeRespaldo(f, vinculos).estado === 'entera'
}

/**
 * Cuánto de un respaldo ya está usado, y en qué estado quedó.
 *
 * ⚠️ **`sin precio` no es lo mismo que `libre`.** Un vínculo sin `precioUnitario` no permite
 * calcular cuánto se aplicó — y tratarlo como cero hacía que una factura ya usada se siguiera
 * ofreciendo como si estuviera libre. Se distingue para poder **decirlo** en pantalla en vez de
 * mostrarla igual que una sin usar.
 */
export function usoDeRespaldo(
  f: FacturaCompra, vinculos: Vinculo[],
): { estado: 'libre' | 'parcial' | 'entera' | 'sin precio'; aplicado: number; resto: number } {
  const mios = vinculos.filter(v => v.facturaId === f.id)
  if (mios.length === 0) return { estado: 'libre', aplicado: 0, resto: f.neto }
  if (mios.some(v => v.precioUnitario == null)) {
    return { estado: 'sin precio', aplicado: 0, resto: f.neto }
  }
  const aplicado = mios.reduce((s, v) => s + v.cantidad * (v.precioUnitario ?? 0), 0)
  // Tolerancia del 0,5 %: los precios se cargan redondeados y no tienen por qué dar al peso.
  if (f.neto > 0 && aplicado >= f.neto * 0.995) {
    return { estado: 'entera', aplicado, resto: 0 }
  }
  return { estado: 'parcial', aplicado, resto: Math.max(0, f.neto - aplicado) }
}
