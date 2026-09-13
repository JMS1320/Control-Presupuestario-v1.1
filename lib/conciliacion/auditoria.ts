/**
 * 🧪 **A-FEAT-145 — EL AUDIT DE CONSISTENCIA: que la app verifique el estándar, no una consulta a mano.**
 *
 * Pedido del usuario 2026-09-13: *«requiere esto hacer chequeo de consistencia de datos, ya que
 * estamos ahora tan finos, para que todo ande bien hacia futuro»*.
 *
 * ## Contra qué audita
 * Contra **`MODULO_CONCILIACION.md` § 30.9.6 — el estándar por origen**, que dice qué debe tener un
 * movimiento conciliado según de dónde viene. Sin ese estándar escrito, cada medición se hacía
 * contra un criterio inventado en el momento: así se reportaron **dos falsas alarmas el mismo día**
 * (*«494 sin nro_cuenta»* y *«28 sueldos sin contable»*), y en los dos casos **no correspondía que
 * lo tuvieran**.
 *
 * ## El alcance, que es la decisión de diseño más importante del archivo
 * **Recorre todos los movimientos, pero sólo le EXIGE el estándar a los CONCILIADOS.** Un movimiento
 * pendiente todavía no tiene decidido qué es: pedirle proveedor o comprobante serían **822 falsos
 * positivos** sobre 1.498 filas, que es la forma más rápida de que nadie vuelva a abrir la pantalla.
 *
 * ## Y lo que NO hace: corregir
 * Propone; no aplica. El arreglo lo decide el usuario (§ 🛑 Datos). Un audit que corrige solo es un
 * script de migración con otro nombre — y este día ya mostró por qué: el control 3 tiene **tres
 * destinos distintos**, y uno de ellos (el detalle que guarda las facturas porque la columna del
 * comprobante está vacía) **se destruiría con un vaciado masivo**.
 *
 * 📏 La expectativa medida ANTES de la primera corrida está en **§ 30.9.7**. Si el audit da otra
 * cosa, o el audit está mal o la medición estaba mal.
 */

/** Un peso de diferencia es cero: los importes vienen con 2 decimales. */
const CERO = 0.005

export type Origen = 'ARCA' | 'template' | 'sueldo' | 'anticipo' | 'venta' | 'sin-vinculo'

export type ControlId =
  | 'vinculo-doble'
  | 'sin-vinculo'
  | 'sin-comprobante'
  | 'detalle-repite'
  | 'categ-fuera-plan'
  | 'imputacion'
  | 'sin-proveedor'
  | 'cuadratura'

export interface MovimientoAuditable {
  id: string
  /** Nombre de la cuenta como se ve en la app, no el nombre de la tabla. */
  cuenta: string
  fecha: string | null
  descripcion: string | null
  debitos: number | null
  creditos: number | null
  estado: string | null
  categ: string | null
  nro_cuenta: string | null
  proveedor_nombre: string | null
  comprobantes_pagados: string | null
  detalle: string | null
  comprobante_arca_id: string | null
  template_cuota_id: string | null
  sueldo_pago_id: string | null
  anticipo_id: string | null
  comprobante_venta_id?: string | null
}

/** Un movimiento conciliado contra un template, con lo que dice el banco y lo que dice el origen. */
export interface ParCuadratura {
  movimientoId: string
  importeBanco: number
  importeOrigen: number
}

export interface Hallazgo {
  control: ControlId
  movimientoId: string
  cuenta: string
  fecha: string | null
  descripcion: string | null
  importe: number
  origen: Origen
  /** Qué está mal, en palabras del usuario. */
  problema: string
  /** Por dónde se agrupa. Dos hallazgos con la misma causa se cuentan juntos. */
  causa: string
  /**
   * 🔑 `true` cuando el hueco **no está en el movimiento sino en el template, el empleado o el
   * maestro**. Mandar a corregir el extracto en estos casos hace trabajar 190 filas en vez de las
   * pocas del origen — y la próxima conciliación vuelve a propagar el vacío.
   */
  enElOrigen?: boolean
}

export interface GrupoHallazgos {
  control: ControlId
  titulo: string
  /** Qué dice el estándar. Va a la pantalla: un hallazgo sin su regla no se puede evaluar. */
  regla: string
  total: number
  /** Cuántos de esos se arreglan en el origen y no en el movimiento. */
  enElOrigen: number
  causas: { causa: string; cantidad: number; ejemplos: Hallazgo[] }[]
}

export interface ResultadoAuditoria {
  /** Todos los movimientos recorridos, conciliados o no. */
  universo: number
  /** Los conciliados: los únicos a los que se les exige el estándar. */
  auditados: number
  porOrigen: Record<Origen, number>
  grupos: GrupoHallazgos[]
  /** Conciliados sin un solo hallazgo. */
  limpios: number
  /**
   * ⚠️ Lo que NO se pudo verificar, y por qué. Nunca se descarta en silencio
   * (§ `CLAUDE.md` 🧮 Todo desarrollo termina con su control).
   */
  noVerificado: string[]
}

const t = (s: string | null | undefined) => (s ?? '').trim()
const norm = (s: string | null | undefined) => t(s).toLowerCase()

/** El importe del movimiento, sea débito o crédito. */
export function importeDe(m: MovimientoAuditable): number {
  const d = Number(m.debitos) || 0
  const c = Number(m.creditos) || 0
  return d !== 0 ? d : c
}

/** Cuántas columnas de vínculo tiene llenas. */
export function vinculosDe(m: MovimientoAuditable): Origen[] {
  const v: Origen[] = []
  if (t(m.comprobante_arca_id)) v.push('ARCA')
  if (t(m.template_cuota_id)) v.push('template')
  if (t(m.sueldo_pago_id)) v.push('sueldo')
  if (t(m.anticipo_id)) v.push('anticipo')
  if (t(m.comprobante_venta_id)) v.push('venta')
  return v
}

/**
 * El origen del movimiento. Con varios vínculos gana el que manda para el estándar: un pago que
 * canceló una factura **usando un anticipo** es, a todos los efectos, de ARCA.
 */
export function origenDe(m: MovimientoAuditable): Origen {
  const v = vinculosDe(m)
  if (v.length === 0) return 'sin-vinculo'
  const prioridad: Origen[] = ['ARCA', 'venta', 'template', 'sueldo', 'anticipo']
  return prioridad.find(p => v.includes(p)) ?? v[0]
}

export function esConciliado(m: MovimientoAuditable): boolean {
  return norm(m.estado) === 'conciliado'
}

/**
 * 🔑 **La única combinación de dos vínculos que es CORRECTA: ARCA + anticipo.**
 *
 * Es el cierre normal del circuito — se adelantó plata, después llegó la factura, y el movimiento
 * apunta a las dos cosas (§ 30.9.6 F: *un anticipo no es un destino, es un estado transitorio*).
 *
 * ⚠️ Sin esta excepción el control daría **7 falsos positivos de 8**, que es lo que se descubrió al
 * medir la expectativa antes de construir esto. Por eso § 30.9.6 se corrigió el mismo día.
 */
export function vinculoDobleEsLegitimo(v: Origen[]): boolean {
  return v.length === 2 && v.includes('ARCA') && v.includes('anticipo')
}

export type DestinoDetalle = 'vaciar' | 'recortar' | 'mover' | null

/**
 * 🧨 **Los tres destinos del detalle repetido — y por qué el audit NO puede vaciarlos todos.**
 *
 * | | Ejemplo real | Qué corresponde |
 * |---|---|---|
 * | `vaciar` | proveedor `GOROSITO OLGA MARIA`, detalle `GOROSITO OLGA MARIA` | es puro ruido |
 * | `recortar` | `Factura 1-236 - CATTANEO \| Anticipo $712.560,9 (28/2/2026)` | el anticipo **sí** aporta |
 * | `mover` | comprobante **vacío** y el detalle con **las 6 facturas de Alcorta** | 🔴 es el **único lugar** donde ese dato existe |
 *
 * El tercero es invisible para el control del comprobante y es el que un vaciado masivo destruiría.
 */
export function destinoDelDetalle(m: MovimientoAuditable): DestinoDetalle {
  const det = t(m.detalle)
  if (!det) return null

  const prov = t(m.proveedor_nombre)
  const comp = t(m.comprobantes_pagados)
  const cat = t(m.categ)
  const dn = norm(det)

  const repiteProv = !!prov && dn.includes(norm(prov))
  const repiteComp = !!comp && dn.includes(norm(comp))
  const esLaCateg = !!cat && dn === norm(cat)

  if (!repiteProv && !repiteComp && !esLaCateg) return null

  // El comprobante está vacío y el detalle habla de comprobantes: el dato existe, pero en la
  // columna equivocada. Mover, nunca borrar.
  if (!comp && /\b(factura|fc|nc|nd|recibo|comprobante)\b/i.test(det)) return 'mover'

  // Si sacando lo repetido no queda nada propio, es ruido. Si queda, hay que recortar.
  let resto = det
  if (repiteProv && prov) resto = resto.replace(new RegExp(escapar(prov), 'gi'), '')
  if (repiteComp && comp) resto = resto.replace(new RegExp(escapar(comp), 'gi'), '')
  if (esLaCateg) resto = ''
  const quedaAlgo = resto.replace(/[\s·|\-–—,.:;]+/g, '').length > 0

  return quedaAlgo ? 'recortar' : 'vaciar'
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** El comprobante identifica **cuál** obligación: lleva un número o un período. */
export function comprobanteIdentifica(comp: string | null | undefined): boolean {
  const c = t(comp)
  if (!c) return false
  if (/\d/.test(c)) return true
  return /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(c)
}

export interface EntradaAuditoria {
  movimientos: MovimientoAuditable[]
  /** Las `categ` que existen en el plan de cuentas. Si viene vacío, el control 5 no corre. */
  categsDelPlan: Set<string>
  /** Pares banco↔origen para el control de cuadratura. Si no viene, se informa como no verificado. */
  cuadratura?: ParCuadratura[]
}

/**
 * Corre los controles del estándar y devuelve los hallazgos **agrupados por causa**.
 *
 * 📌 **Agrupar no es cosmética.** «152 errores de categoría» hace parecer enorme algo que son
 * **18 filas de alta** en el plan de cuentas: la misma categoría faltante aparece 44 veces. El
 * número por fila mide el síntoma; el número por causa mide el trabajo.
 */
export function auditar(entrada: EntradaAuditoria): ResultadoAuditoria {
  const { movimientos, categsDelPlan, cuadratura } = entrada
  const conciliados = movimientos.filter(esConciliado)

  const porOrigen: Record<Origen, number> = {
    ARCA: 0, template: 0, sueldo: 0, anticipo: 0, venta: 0, 'sin-vinculo': 0,
  }
  for (const m of conciliados) porOrigen[origenDe(m)]++

  const hallazgos: Hallazgo[] = []
  const base = (m: MovimientoAuditable) => ({
    movimientoId: m.id,
    cuenta: m.cuenta,
    fecha: m.fecha,
    descripcion: m.descripcion,
    importe: importeDe(m),
    origen: origenDe(m),
  })

  for (const m of conciliados) {
    const v = vinculosDe(m)
    const origen = origenDe(m)

    // 1 · Un solo vínculo — salvo ARCA + anticipo, que es el cierre normal del circuito.
    if (v.length > 1 && !vinculoDobleEsLegitimo(v)) {
      hallazgos.push({
        ...base(m), control: 'vinculo-doble',
        problema: `Apunta a ${v.length} orígenes a la vez: ${v.join(' + ')}`,
        causa: v.join(' + '),
      })
    }

    // 2 · Todo conciliado tiene vínculo. El más grave: el estado dice saldado y no hay obligación.
    if (v.length === 0) {
      hallazgos.push({
        ...base(m), control: 'sin-vinculo',
        problema: 'Figura conciliado y no apunta a ningún origen: no descuenta ninguna obligación',
        causa: t(m.comprobantes_pagados) || t(m.proveedor_nombre)
          ? 'Tiene pistas (proveedor o comprobante) para reconstruirlo'
          : 'Sin ninguna pista: hay que reconstruirlo desde el texto del extracto',
      })
    }

    // 4 · El comprobante dice CUÁL obligación.
    if (!comprobanteIdentifica(m.comprobantes_pagados)) {
      hallazgos.push({
        ...base(m), control: 'sin-comprobante',
        problema: t(m.comprobantes_pagados)
          ? `El comprobante "${t(m.comprobantes_pagados)}" no identifica cuál: no lleva número ni período`
          : 'No dice cuál obligación pagó',
        causa: destinoDelDetalle(m) === 'mover'
          ? 'El dato está en el detalle: se mueve, no se averigua'
          : 'Falta el dato',
      })
    }

    // 3 · El detalle no repite lo que ya dice otra columna.
    const destino = destinoDelDetalle(m)
    if (destino) {
      hallazgos.push({
        ...base(m), control: 'detalle-repite',
        problema: `El detalle repite ${destino === 'mover' ? 'comprobantes que no están en su columna' : 'el proveedor, la categoría o el comprobante'}`,
        causa: destino === 'vaciar' ? 'Puro ruido: se vacía'
          : destino === 'recortar' ? 'Repite y además aporta algo: se recorta'
          : '🔴 Guarda lo que falta en el comprobante: se MUEVE, no se borra',
      })
    }

    // 5 · La categ existe en el plan de cuentas.
    if (categsDelPlan.size > 0 && !categsDelPlan.has(t(m.categ))) {
      hallazgos.push({
        ...base(m), control: 'categ-fuera-plan',
        problema: `La categoría "${t(m.categ) || '(vacía)'}" no está en el plan de cuentas`,
        causa: t(m.categ) || '(vacía)',
        enElOrigen: true,
      })
    }

    // 6 · ARCA lleva nro_cuenta; los demás NO — su imputación viaja por el vínculo.
    const tieneNro = !!t(m.nro_cuenta)
    if (origen === 'ARCA' && !tieneNro) {
      hallazgos.push({
        ...base(m), control: 'imputacion',
        problema: 'Es de una factura y no tiene número de cuenta contable',
        causa: 'ARCA sin número de cuenta',
      })
    } else if (origen !== 'ARCA' && origen !== 'sin-vinculo' && tieneNro) {
      hallazgos.push({
        ...base(m), control: 'imputacion',
        problema: `Es de ${origen} y tiene número de cuenta puesto: su imputación tiene que viajar por el vínculo`,
        causa: `${origen} con número de cuenta`,
      })
    }

    // 8 · El proveedor está lleno cuando el origen lo tiene.
    if (!t(m.proveedor_nombre)) {
      const desdeElOrigen = origen === 'template' || origen === 'sueldo'
      hallazgos.push({
        ...base(m), control: 'sin-proveedor',
        problema: 'No dice quién cobró',
        causa: desdeElOrigen
          ? `El dato sale del ${origen === 'template' ? 'template' : 'empleado'}: si falta ahí, el movimiento no puede tenerlo`
          : 'Falta el proveedor en el movimiento',
        enElOrigen: desdeElOrigen,
      })
    }
  }

  // 7 · El importe del banco cuadra contra su origen.
  const noVerificado: string[] = []
  if (cuadratura && cuadratura.length > 0) {
    const porId = new Map(conciliados.map(m => [m.id, m]))
    for (const par of cuadratura) {
      const m = porId.get(par.movimientoId)
      if (!m) continue
      const dif = Math.abs((par.importeBanco || 0) - (par.importeOrigen || 0))
      if (dif >= CERO) {
        hallazgos.push({
          ...base(m), control: 'cuadratura',
          problema: `El banco dice ${moneda(par.importeBanco)} y el origen suma ${moneda(par.importeOrigen)} — difieren ${moneda(dif)}`,
          causa: 'El importe del banco no coincide con lo que señala el vínculo',
        })
      }
    }
  } else {
    noVerificado.push(
      'Cuadratura de importes: no se pudo verificar porque no se cargaron las cuotas de los vínculos.'
    )
  }

  if (categsDelPlan.size === 0) {
    noVerificado.push('Categorías contra el plan de cuentas: no se pudo verificar porque el plan vino vacío.')
  }

  const grupos = agrupar(hallazgos)
  const conHallazgo = new Set(hallazgos.map(h => h.movimientoId))

  return {
    universo: movimientos.length,
    auditados: conciliados.length,
    porOrigen,
    grupos,
    limpios: conciliados.length - conHallazgo.size,
    noVerificado,
  }
}

const TITULOS: Record<ControlId, { titulo: string; regla: string }> = {
  'sin-vinculo': {
    titulo: 'Conciliados que no apuntan a ningún origen',
    regla: 'Todo movimiento conciliado señala la obligación que saldó. Sin vínculo, el estado dice que está pagado y no descuenta nada de nadie.',
  },
  'vinculo-doble': {
    titulo: 'Apuntan a dos orígenes a la vez',
    regla: 'Un vínculo por movimiento. La única excepción correcta es ARCA + anticipo: es el cierre normal de un anticipo que después recibió su factura.',
  },
  cuadratura: {
    titulo: 'El importe del banco no cuadra con su origen',
    regla: 'El débito del banco tiene que ser igual a la suma de lo que el vínculo señala. El mismo número llega por dos caminos independientes.',
  },
  'sin-comprobante': {
    titulo: 'No dicen cuál obligación pagaron',
    regla: 'El comprobante identifica CUÁL: lleva el número de la factura o el período de la cuota.',
  },
  imputacion: {
    titulo: 'La imputación contable está donde no va',
    regla: 'Sólo las facturas de ARCA llevan número de cuenta. En template, sueldo y anticipo la imputación viaja por el vínculo, y ponerla a mano la duplica.',
  },
  'detalle-repite': {
    titulo: 'El detalle repite lo que ya dice otra columna',
    regla: 'El detalle es lo que NO se deduce del proveedor, la categoría ni el comprobante. Si ya está en otra columna, va vacío.',
  },
  'categ-fuera-plan': {
    titulo: 'Categorías que no están en el plan de cuentas',
    regla: 'Una categoría se usa sólo si existe antes en el plan, con su tipo cargado. Si falta, el sistema la asume gasto y el presupuesto queda mal sin avisar.',
  },
  'sin-proveedor': {
    titulo: 'No dicen quién cobró',
    regla: 'El proveedor sale del origen: el maestro por CUIT en ARCA, el template en las cuotas, el empleado en los sueldos.',
  },
}

/** El orden en que se muestran: primero lo que compromete la plata, después lo que compromete la lectura. */
const ORDEN: ControlId[] = [
  'sin-vinculo', 'vinculo-doble', 'cuadratura', 'sin-comprobante',
  'imputacion', 'detalle-repite', 'categ-fuera-plan', 'sin-proveedor',
]

function agrupar(hallazgos: Hallazgo[]): GrupoHallazgos[] {
  const porControl = new Map<ControlId, Hallazgo[]>()
  for (const h of hallazgos) {
    const l = porControl.get(h.control) ?? []
    l.push(h)
    porControl.set(h.control, l)
  }

  const grupos: GrupoHallazgos[] = []
  for (const control of ORDEN) {
    const lista = porControl.get(control)
    if (!lista || lista.length === 0) continue

    const porCausa = new Map<string, Hallazgo[]>()
    for (const h of lista) {
      const l = porCausa.get(h.causa) ?? []
      l.push(h)
      porCausa.set(h.causa, l)
    }

    grupos.push({
      control,
      titulo: TITULOS[control].titulo,
      regla: TITULOS[control].regla,
      total: lista.length,
      enElOrigen: lista.filter(h => h.enElOrigen).length,
      causas: [...porCausa.entries()]
        .map(([causa, ejemplos]) => ({ causa, cantidad: ejemplos.length, ejemplos }))
        .sort((a, b) => b.cantidad - a.cantidad),
    })
  }
  return grupos
}

function moneda(n: number): string {
  return `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
