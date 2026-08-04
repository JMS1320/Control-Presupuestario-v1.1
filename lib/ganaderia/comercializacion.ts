// Comercialización de hacienda — a quién conviene venderle.
//
// ── Qué es la CZ ─────────────────────────────────────────────────────────────
// CZ = **comercialización** = comisión + flete + otros gastos. NO es sinónimo de comisión; el
// código venía usándola así y por eso había dos tablas de "comisión" que no coincidían.
//
//     CZ = comisión del intermediario  +  gasto del destino  +  flete
//
// Son tres cobros de tres actores distintos y por eso se suman. El caso que lo muestra: *"gordo a
// Cañuelas es 3,5 % más 0,75 %"* — el 3,5 % es de Sáenz Valiente (quien comercializa) y el 0,75 %
// del propio frigorífico. Arrebeef no tiene ninguno de los dos: sólo flete.
//
// ── Lo que hace comparables a los destinos ───────────────────────────────────
// Unos compran a **peso vivo** y otros **a la res**. No se pueden comparar los precios de lista:
// hay que llevar todo a peso vivo. Lo planteó el usuario y es exactamente la cuenta:
//
//     > "si Cañuelas me paga 5.000 un novillo, Arrebeef me tiene que pagar 5.000 / rinde para ser
//     >  el mismo precio"
//
// Por eso el resultado siempre trae `precio_equivalente_vivo`: dos números que se pueden mirar
// uno al lado del otro.
//
// ── Reglas del negocio que no son obvias ─────────────────────────────────────
//   · La INVERNADA no paga flete de venta. El gordo sí.
//   · El desbaste depende del tipo: invernada por banda de peso, gordo siempre 8 %.
//   · "Precio libre de comisión" (campo a campo) significa que el precio YA viene neto:
//     no se descuenta nada, no que la comisión sea cero por casualidad.

export type TipoHacienda = 'invernada' | 'gordo'
export type CompraEn = 'vivo' | 'res'

export interface TarifaFlete {
  vehiculo: string
  arranque: number
  seguro: number
  por_km: number
  capacidad_kg: number | null
  /** Precio del gasoil cuando la tarifa era válida. Ver `proyectarTarifa()`. */
  precio_gasoil_ref?: number | null
  /** Qué fracción sigue al gasoil. El resto va por IPC. */
  pct_atado_gasoil?: number | null
}

/**
 * La tarifa de flete proyectada a futuro, **sin saber cuánto va a cobrar el transportista**.
 *
 * El usuario lo pidió así: *"debemos tener una relación del costo del flete contra otros insumos
 * como el gas oil para poder presupuestar más adelante aunque no sepamos cuánto cobra
 * exactamente"*.
 *
 * La tarifa de hoy vale contra el gasoil de hoy, así que queda expresada implícitamente en litros
 * y mañana se revalúa sola. No hay que preguntarle el consumo a nadie: se deduce de lo que cobra.
 *
 * ⚠️ Sólo una PARTE sigue al gasoil (`pct_atado_gasoil`, 35 % por defecto): el flete también es
 * chofer, peajes, cubiertas y amortización. Suponer el 100 % atado sobreestimaría la suba cada vez
 * que salta el combustible — y el número se usa para decidir a quién venderle.
 *
 * Devuelve `null` cuando falta el precio de referencia: sin él no hay relación que aplicar, y
 * proyectar con la tarifa vieja sin avisar la haría envejecer en silencio.
 */
export function proyectarTarifa(
  t: TarifaFlete,
  precioGasoilHoy: number | null,
  inflacionAcumulada = 0,
): { tarifa: TarifaFlete; motivo: string } | null {
  if (precioGasoilHoy == null || !t.precio_gasoil_ref || t.precio_gasoil_ref <= 0) return null

  const atado = Number(t.pct_atado_gasoil ?? 0.35)
  const factorGasoil = precioGasoilHoy / Number(t.precio_gasoil_ref)
  const factorResto = 1 + inflacionAcumulada
  // La parte atada sigue al combustible; la otra, a la inflación general.
  const f = atado * factorGasoil + (1 - atado) * factorResto

  const n1 = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return {
    tarifa: {
      ...t,
      arranque: t.arranque * f,
      seguro: t.seguro * f,
      por_km: t.por_km * f,
    },
    motivo: `${(atado * 100).toFixed(0)} % sigue al gasoil (× ${n1(factorGasoil)})`
      + ` y ${((1 - atado) * 100).toFixed(0)} % al IPC (× ${n1(factorResto)}) → × ${n1(f)}`,
  }
}

export interface DestinoVenta {
  id: string
  nombre: string
  compra_en: CompraEn
  aplica_a: string
  pct_gasto: number
  requiere_flete: boolean
  vehiculo: string | null
  plazo_dias: number | null
  /** De qué destino sale el precio, cuando no tiene uno propio. */
  precio_ref_destino_id?: string | null
  /** Ajuste sobre ese precio. `-0.105` = "el de Cañuelas menos el 10,5 %". */
  precio_ajuste_pct?: number | null
}

export interface RutaDestino {
  id?: string
  destino_id: string
  descripcion: string
  km: number
  por_defecto: boolean
}

export interface IntermediarioVenta {
  id: string
  nombre: string
  pct_invernada: number
  pct_gordo: number
  precio_libre: boolean
}

export interface NormaDesbaste { tipo: string; peso_hasta: number | null; pct: number }
export interface NormaRinde { categoria: string; pct: number }

/**
 * El desbaste que corresponde. Sale de la tabla, no de constantes en el código.
 *
 * ⚠️ Los cortes de invernada son **300 / 360 / 400** (dato del usuario 2026-08-04). El
 * `pctDesbaste()` viejo usaba 280/330/380 y estaba mal.
 */
export function desbasteDe(
  normas: NormaDesbaste[], tipo: TipoHacienda, peso: number,
): number {
  const dels = normas.filter(n => n.tipo === tipo)
  if (dels.length === 0) return 0
  const conTecho = dels.filter(n => n.peso_hasta != null).sort((a, b) => a.peso_hasta! - b.peso_hasta!)
  for (const n of conTecho) if (peso <= n.peso_hasta!) return Number(n.pct)
  const abierta = dels.find(n => n.peso_hasta == null)
  return Number(abierta?.pct ?? conTecho[conTecho.length - 1]?.pct ?? 0)
}

/** El rinde de una categoría. `null` = no está cargado, y eso NO es cero. */
export function rindeDe(normas: NormaRinde[], categoria: string): number | null {
  const c = categoria.trim().toLowerCase()
  const n = normas.find(x => x.categoria.trim().toLowerCase() === c)
  return n ? Number(n.pct) : null
}

/**
 * El flete de un viaje: **arranque + seguro + km × $/km**.
 *
 * Cada componente se suma; no es un precio por kilómetro a secas. Con 200 km en jaula:
 * `160.000 + 100.000 + 200 × 3.500 = 960.000`.
 */
export function costoDeUnViaje(t: TarifaFlete, km: number): number {
  return Number(t.arranque) + Number(t.seguro) + Number(t.por_km) * Number(km)
}

/**
 * Cuántos viajes hacen falta y cuánto sale el flete total.
 *
 * Los viajes son **enteros**: medio camión se paga igual que uno entero, y prorratear el flete
 * por kilo escondería justamente el salto que hace que convenga esperar a completar la jaula.
 */
export function costoFlete(
  t: TarifaFlete, km: number, kgTotales: number,
): { total: number; viajes: number; porViaje: number; detalle: string } {
  const porViaje = costoDeUnViaje(t, km)
  const cap = Number(t.capacidad_kg) || 0
  const viajes = cap > 0 ? Math.ceil(kgTotales / cap) : 1
  return {
    total: porViaje * viajes,
    viajes,
    porViaje,
    detalle: `${t.vehiculo}: $${Math.round(t.arranque).toLocaleString('es-AR')} arranque`
      + ` + $${Math.round(t.seguro).toLocaleString('es-AR')} seguro`
      + ` + ${km} km × $${Math.round(t.por_km).toLocaleString('es-AR')}`
      + (viajes > 1 ? ` × ${viajes} viajes` : ''),
  }
}

/**
 * Resuelve el precio de un destino que **deriva** el suyo de otro.
 *
 * El caso: *"el matarife zonal paga siempre el máximo de Cañuelas menos el 10,5 %"*. Sin esto
 * habría que recargarlo a mano cada vez que se mueve el de Cañuelas, y en cuanto uno se olvida
 * la comparación miente.
 *
 * ⚠️ Si el destino de referencia compra en otra base que el derivado (uno a la res y el otro a
 * peso vivo), el precio NO se puede arrastrar tal cual: son dos unidades distintas. En ese caso
 * devuelve `null` con el motivo en vez de dar un número que parece bueno.
 */
export function precioDerivado(
  destino: DestinoVenta,
  destinos: DestinoVenta[],
  preciosCargados: Record<string, number | null | undefined>,
): { precio: number | null; motivo: string } | null {
  if (!destino.precio_ref_destino_id) return null
  const ref = destinos.find(d => d.id === destino.precio_ref_destino_id)
  if (!ref) return { precio: null, motivo: 'el destino de referencia ya no existe' }

  const base = preciosCargados[ref.id]
  if (base == null) return { precio: null, motivo: `falta el precio de ${ref.nombre}, del que se deriva` }

  if (ref.compra_en !== destino.compra_en) {
    return {
      precio: null,
      motivo: `${ref.nombre} compra ${ref.compra_en === 'res' ? 'a la res' : 'a peso vivo'}`
        + ` y ${destino.nombre} ${destino.compra_en === 'res' ? 'a la res' : 'a peso vivo'}:`
        + ' hay que pasar por el rinde antes de derivar el precio',
    }
  }

  const ajuste = Number(destino.precio_ajuste_pct ?? 0)
  const pct = Math.abs(ajuste * 100).toFixed(1).replace('.', ',')
  return {
    precio: base * (1 + ajuste),
    motivo: `${ref.nombre} ${ajuste < 0 ? 'menos' : 'más'} ${pct} %`,
  }
}

export interface OpcionVenta {
  destino: DestinoVenta
  intermediario: IntermediarioVenta | null
  ruta: RutaDestino | null
  tarifa: TarifaFlete | null
  /** $/kg que ofrece: de RES si el destino compra a la res, de VIVO si no. */
  precio: number | null
}

export interface DatosLote {
  tipo: TipoHacienda
  categoria: string
  cabezas: number
  /** Peso vivo promedio por cabeza, antes del desbaste. */
  pesoVivo: number
}

export interface ResultadoOpcion {
  destino: string
  intermediario: string | null
  /** Lo que efectivamente ingresa, ya neto de todo. */
  ingresa: number
  ingresaPorCabeza: number
  /**
   * **El número que permite comparar.** Todo llevado a $/kg vivo, neto de comisión, gastos y
   * flete. Un destino que compra a la res y otro a peso vivo se miran acá uno al lado del otro.
   */
  equivalenteVivo: number | null
  kgBrutos: number
  kgNetos: number
  /** Kg de res, cuando el destino compra a la res. */
  kgRes: number | null
  pctDesbaste: number
  rinde: number | null
  ventaBruta: number
  comision: number
  gastoDestino: number
  flete: number
  viajes: number
  /** Cada renglón de la cuenta, para poder auditarla. */
  detalle: { concepto: string; monto: number; nota?: string }[]
  /** Lo que impide confiar en el número. Vacío = está completo. */
  faltantes: string[]
}

/**
 * Cuánto ingresa por una opción de venta, con todo descontado.
 *
 * Cuando falta un dato **no se completa con cero**: se devuelve el faltante. Un comparador que
 * muestra un ganador porque al otro le falta el rinde es peor que uno que dice qué le falta.
 */
export function evaluarOpcion(
  lote: DatosLote,
  op: OpcionVenta,
  normas: { desbaste: NormaDesbaste[]; rinde: NormaRinde[] },
): ResultadoOpcion {
  const faltantes: string[] = []
  const detalle: { concepto: string; monto: number; nota?: string }[] = []

  const kgBrutos = lote.cabezas * lote.pesoVivo
  const pctDesb = desbasteDe(normas.desbaste, lote.tipo, lote.pesoVivo)
  const kgNetos = kgBrutos * (1 - pctDesb)

  detalle.push({ concepto: 'Kg brutos', monto: kgBrutos, nota: `${lote.cabezas} cab × ${lote.pesoVivo} kg` })
  detalle.push({ concepto: `Desbaste ${(pctDesb * 100).toFixed(1)} %`, monto: -(kgBrutos - kgNetos) })

  // ── La base sobre la que se paga ──────────────────────────────────────────
  let rinde: number | null = null
  let kgRes: number | null = null
  let kgQueSePagan = kgNetos

  if (op.destino.compra_en === 'res') {
    rinde = rindeDe(normas.rinde, lote.categoria)
    if (rinde == null) {
      faltantes.push(`falta el rinde de ${lote.categoria}: sin eso no se puede comparar contra una venta a peso vivo`)
    } else {
      kgRes = kgNetos * rinde
      kgQueSePagan = kgRes
      detalle.push({ concepto: `Rinde ${(rinde * 100).toFixed(0)} %`, monto: kgRes, nota: 'kg de res' })
    }
  }

  if (op.precio == null) faltantes.push(`falta el precio de ${op.destino.nombre}`)
  const precio = op.precio ?? 0
  const ventaBruta = kgQueSePagan * precio
  detalle.push({
    concepto: 'Venta bruta', monto: ventaBruta,
    nota: `${Math.round(kgQueSePagan).toLocaleString('es-AR')} kg ${op.destino.compra_en === 'res' ? 'res' : 'vivo'} × $${precio}`,
  })

  // ── Comisión del intermediario ────────────────────────────────────────────
  // "Precio libre" NO es comisión cero por casualidad: es que el precio ya viene neto.
  let comision = 0
  if (op.intermediario && !op.intermediario.precio_libre) {
    const pct = lote.tipo === 'gordo' ? op.intermediario.pct_gordo : op.intermediario.pct_invernada
    comision = ventaBruta * Number(pct)
    if (comision > 0) {
      detalle.push({
        concepto: `Comisión ${op.intermediario.nombre} ${(Number(pct) * 100).toFixed(2)} %`,
        monto: -comision,
      })
    }
  } else if (op.intermediario?.precio_libre) {
    detalle.push({ concepto: `${op.intermediario.nombre}`, monto: 0, nota: 'precio libre de comisión' })
  }

  // ── Gasto propio del destino (Cañuelas 0,75 %) ────────────────────────────
  const gastoDestino = ventaBruta * Number(op.destino.pct_gasto || 0)
  if (gastoDestino > 0) {
    detalle.push({
      concepto: `Gasto ${op.destino.nombre} ${(Number(op.destino.pct_gasto) * 100).toFixed(2)} %`,
      monto: -gastoDestino,
    })
  }

  // ── Flete ─────────────────────────────────────────────────────────────────
  // La invernada NO paga flete de venta.
  let flete = 0
  let viajes = 0
  if (op.destino.requiere_flete) {
    if (!op.tarifa) faltantes.push(`falta la tarifa de flete (${op.destino.vehiculo ?? 'vehículo'})`)
    else if (!op.ruta) faltantes.push(`falta la distancia a ${op.destino.nombre}`)
    else {
      const f = costoFlete(op.tarifa, op.ruta.km, kgBrutos)
      flete = f.total; viajes = f.viajes
      detalle.push({ concepto: `Flete · ${op.ruta.descripcion}`, monto: -flete, nota: f.detalle })
    }
  } else {
    detalle.push({ concepto: 'Flete', monto: 0, nota: 'la invernada no paga flete de venta' })
  }

  const ingresa = ventaBruta - comision - gastoDestino - flete
  detalle.push({ concepto: 'INGRESA', monto: ingresa })

  return {
    destino: op.destino.nombre,
    intermediario: op.intermediario?.nombre ?? null,
    ingresa,
    ingresaPorCabeza: lote.cabezas > 0 ? ingresa / lote.cabezas : 0,
    // El equivalente se calcula sobre los kg VIVOS BRUTOS: es el kilo que uno realmente cargó
    // al camión, y por eso sirve para comparar contra cualquier otra opción.
    equivalenteVivo: faltantes.length === 0 && kgBrutos > 0 ? ingresa / kgBrutos : null,
    kgBrutos, kgNetos, kgRes,
    pctDesbaste: pctDesb, rinde,
    ventaBruta, comision, gastoDestino, flete, viajes,
    detalle, faltantes,
  }
}

export interface ItemCZ {
  concepto: string
  monto: number
  /** Sobre la venta bruta. */
  pct: number
  nota?: string
}

/**
 * El desglose de la CZ: **cada ítem en pesos con su % parcial, y el total**.
 *
 * Lo pidió así el usuario (2026-08-04): *"en vez de ponerse CZ tanto % y muestre los pesos, sería
 * que muestre los pesos de cada ítem de la CZ y muestre el % parcial y el total de CZ"*.
 *
 * Y resuelve el problema del flete, que es un monto absoluto y no un porcentaje: acá el % **se
 * deriva** de los pesos en vez de ser un dato de entrada. Así el flete convive con la comisión en
 * la misma unidad —el % de CZ total, que es lo comparable entre destinos— sin dejar de ser lo que
 * realmente es: un costo del viaje que no cambia si sube el precio de la hacienda.
 *
 * ⚠️ Justamente por eso el % del flete **baja cuando sube el precio**: los mismos $960.000 pesan
 * menos sobre una venta mayor. Es correcto, y es parte de lo que hay que ver al decidir.
 */
export function desgloseCZ(r: ResultadoOpcion): { items: ItemCZ[]; total: ItemCZ } {
  const base = r.ventaBruta
  const pct = (m: number) => (base > 0 ? m / base : 0)
  const items: ItemCZ[] = []

  if (r.comision > 0) {
    items.push({
      concepto: `Comisión${r.intermediario ? ' ' + r.intermediario : ''}`,
      monto: r.comision, pct: pct(r.comision),
    })
  }
  if (r.gastoDestino > 0) {
    items.push({
      concepto: `Gasto ${r.destino}`,
      monto: r.gastoDestino, pct: pct(r.gastoDestino),
    })
  }
  if (r.flete > 0) {
    items.push({
      concepto: 'Flete',
      monto: r.flete, pct: pct(r.flete),
      nota: r.viajes > 1 ? `${r.viajes} viajes` : undefined,
    })
  }

  const suma = items.reduce((s, i) => s + i.monto, 0)
  return { items, total: { concepto: 'CZ total', monto: suma, pct: pct(suma) } }
}

/**
 * Compara varias opciones y las ordena por lo que realmente ingresa.
 *
 * Las incompletas van al final y **nunca ganan**: si a una le falta el precio o el rinde, que
 * aparezca primera con un número inventado sería la peor forma de decidir.
 */
export function compararOpciones(
  lote: DatosLote,
  opciones: OpcionVenta[],
  normas: { desbaste: NormaDesbaste[]; rinde: NormaRinde[] },
): ResultadoOpcion[] {
  return opciones
    .map(o => evaluarOpcion(lote, o, normas))
    .sort((a, b) => {
      if (a.faltantes.length !== b.faltantes.length) return a.faltantes.length - b.faltantes.length
      return b.ingresa - a.ingresa
    })
}

/**
 * El precio a la RES que iguala a un precio a peso vivo.
 *
 * Es la cuenta que pidió el usuario, tal cual: *"si Cañuelas me paga 5.000 un novillo, Arrebeef
 * me tiene que pagar 5.000 / rinde para ser el mismo precio"*. Sirve para negociar: da el piso
 * que tiene que ofrecer el que compra a la res.
 */
export function precioResEquivalente(precioVivo: number, rinde: number): number | null {
  return rinde > 0 ? precioVivo / rinde : null
}
