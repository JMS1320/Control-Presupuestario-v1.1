/**
 * 🛠️ **A-FEAT-159 — el audit PROPONE la corrección, y el usuario la aprueba por grupo.**
 *
 * Pedido del usuario 2026-09-19: *«¿eso no sería lógico que ya lo haga el audit? Ya ve y advierte o
 * reporta; capaz sobre eso es que pueda hacer los update»*. Tenía razón: yo proponía un script
 * suelto, y un script vive fuera de la app — hay que acordarse de correrlo y no deja rastro.
 *
 * ## La regla que NO se rompe
 * El audit **sigue sin corregir solo**. Lo que se agrega es *proponer* y que el usuario **apruebe
 * por causa**, no por fila. Eso conserva la decisión de § 30.9.7 E —*propone, nunca aplica*— y evita
 * el desastre del vaciado masivo: el mismo control puede tener un arreglo obvio para 24 casos y uno
 * destructivo para otros 4.
 *
 * ## 🔑 Qué hace corregible a un hallazgo
 * > **Que el dato ya exista en otro lado y sólo haya que copiarlo o borrarlo.**
 *
 * Si hay que *averiguar* algo —a qué obligación corresponde, qué cuenta contable poner, cuál de dos
 * facturas es— **no es corregible** y no se ofrece botón. Un audit que adivina es peor que uno que
 * calla.
 */

import type { Hallazgo } from './auditoria'

/** Lo que se le escribiría a un movimiento. `null` borra la columna. */
export type Parche = Record<string, string | null>

export interface Correccion {
  movimientoId: string
  cuenta: string
  parche: Parche
  /** Qué se le va a hacer, en una línea, para que el usuario lo lea antes de aprobar. */
  explicacion: string
}

/** Los controles cuyo arreglo es mecánico. El resto se muestra y no se ofrece corregir. */
export const CONTROLES_CORREGIBLES = [
  'sin-proveedor',
  'sin-comprobante',
  'imputacion',
  'detalle-repite',
] as const

/**
 * Lo que hace falta saber del origen para poder corregir. Lo arma el llamador leyendo la base; acá
 * no se consulta nada, para que la decisión sea testeable sin BD.
 */
export interface DatosParaCorregir {
  /** Quién cobra según el template / la factura / el empleado. */
  proveedorDelOrigen?: string | null
  /** El identificador con período, ya calculado (`identificadorDeCuota`). */
  comprobanteDelOrigen?: string | null
  /** Con varios beneficiarios: `Ruben Sigot 1,6M + Wilson Barreto 1,1M` (`repartoDelGrupo`). */
  repartoDeBeneficiarios?: string | null
}

const t = (s: string | null | undefined) => (s ?? '').trim()

/**
 * Decide si un hallazgo se puede corregir solo, y con qué.
 *
 * Devuelve `null` cuando **no** hay nada mecánico que hacer — y eso es la mitad del valor de esta
 * función: `null` significa *«esto lo mira una persona»*, no *«esto está bien»*.
 */
export function corregir(h: Hallazgo, datos: DatosParaCorregir): Correccion | null {
  // Los hallazgos del ORIGEN apuntan a un template o a una factura, no a un movimiento: se
  // arreglan en su propia pantalla y no desde acá.
  if (h.entidad && h.entidad !== 'movimiento') return null

  const base = { movimientoId: h.movimientoId, cuenta: h.cuenta }

  switch (h.control) {
    case 'sin-proveedor': {
      // Con varios beneficiarios manda el reparto, que dice cuánto a cada uno.
      const nombre = t(datos.repartoDeBeneficiarios) || t(datos.proveedorDelOrigen)
      if (!nombre) return null          // el origen tampoco lo tiene: no hay nada que copiar
      return { ...base, parche: { proveedor_nombre: nombre },
               explicacion: `Poner «${nombre}», que es lo que dice el origen` }
    }

    case 'sin-comprobante': {
      const comp = t(datos.comprobanteDelOrigen)
      if (!comp) return null
      return { ...base, parche: { comprobantes_pagados: comp },
               explicacion: `Poner «${comp}»` }
    }

    case 'imputacion': {
      // Sólo el caso simétrico: un origen que NO es ARCA con número de cuenta puesto. El de ARCA
      // **sin** número no se toca acá — el dato falta en la factura y es [A-DAT-48].
      if (!h.causa.includes('con número de cuenta')) return null
      return { ...base, parche: { nro_cuenta: null },
               explicacion: 'Vaciar el número de cuenta: en este origen la imputación viaja por el vínculo' }
    }

    case 'detalle-repite': {
      // 🛑 SÓLO el ruido puro. «Recortar» necesita decidir qué parte se salva y «mover» es el único
      //    lugar donde vive ese dato — los dos se muestran y no se ofrecen (§ 30.9.7 C).
      if (!h.causa.startsWith('Puro ruido')) return null
      return { ...base, parche: { detalle: null },
               explicacion: 'Vaciar el detalle: repite el proveedor o el comprobante y no agrega nada' }
    }

    default:
      return null
  }
}

export interface ResumenCorregible {
  control: string
  causa: string
  /** Cuántos de esa causa se pueden corregir solos. */
  corregibles: number
  /** Cuántos quedan para mirar a mano. */
  manuales: number
  correcciones: Correccion[]
}

/**
 * Agrupa las correcciones **por causa**, que es la unidad con la que el usuario aprueba.
 *
 * 📌 Aprobar por causa y no por control: dentro de *«el detalle repite»* conviven un arreglo obvio
 * (24 casos de ruido puro) y uno que destruiría datos (4 que hay que mover). Un botón por control
 * los mezclaría.
 */
export function agruparCorrecciones(
  hallazgos: Hallazgo[],
  datosPorMovimiento: Map<string, DatosParaCorregir>,
): ResumenCorregible[] {
  const porCausa = new Map<string, ResumenCorregible>()

  for (const h of hallazgos) {
    const clave = `${h.control}|${h.causa}`
    if (!porCausa.has(clave)) {
      porCausa.set(clave, { control: h.control, causa: h.causa, corregibles: 0, manuales: 0, correcciones: [] })
    }
    const g = porCausa.get(clave)!
    const c = corregir(h, datosPorMovimiento.get(h.movimientoId) ?? {})
    if (c) { g.corregibles++; g.correcciones.push(c) } else { g.manuales++ }
  }

  return [...porCausa.values()]
    .filter(g => g.corregibles > 0)
    .sort((a, b) => b.corregibles - a.corregibles)
}
