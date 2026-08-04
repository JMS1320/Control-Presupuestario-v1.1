"use client"

// La MUESTRA: qué datos reales entraron en el cálculo, y qué dio.
//
// El pedido del usuario fue literal: *"que muestre el ejemplo de lo que presupuesta; si elijo del
// último mes, que me muestre la muestra y el resultado"*. La fórmula sola no alcanza —
// "$1.200.000 ÷ 3" no distingue tres meses parecidos de dos ceros y un mes enorme.
//
// ⚠️ Vive acá y no adentro de una pantalla porque la usan DOS: el panel de cuentas contables y el
// margen por actividad. El usuario lo pidió explícito (2026-08-04): *"me gusta cuando se ven las
// facturas recibidas del pasado (lo histórico); sucede en cuentas contables pero no acá"*.
// Duplicarla habría hecho que la misma historia se viera distinta en dos lugares.

import type { CeldaPresupuesto, ModoPresupuesto } from "@/lib/presupuesto/modos"

const MESES_TXT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** "2027-01" → "Ene 27". */
export function etiquetaClave(k: string) {
  const [a, m] = k.split("-")
  return `${MESES_TXT[Number(m) - 1]} ${a!.slice(-2)}`
}

/**
 * Dos formas según el modo:
 *  - **Muestra común** (última FC, promedio, por cabeza): los mismos datos alimentan todos los
 *    meses proyectados → se muestra una sola vez, con el resultado del primer mes.
 *  - **Muestra por mes** (estacional): cada mes toma SU mes del año anterior → se muestra el
 *    par origen → proyectado, y sólo los meses que tienen dato.
 */
export function MuestraDelCalculo({ celdas, modo }: {
  celdas: CeldaPresupuesto[]; modo: ModoPresupuesto
}) {
  if (modo === "manual" || modo === "excluida") return null
  const conMuestra = celdas.filter(c => (c.muestra?.length ?? 0) > 0)
  if (conMuestra.length === 0) {
    return (
      <p className="mt-1 text-[10px] text-blue-700">
        Sin muestra: no hay datos históricos que hayan entrado en este cálculo.
      </p>
    )
  }

  if (modo === "estacional") {
    return (
      <div className="mt-1.5 border-t border-blue-200 pt-1.5">
        <p className="mb-1 text-[10px] font-medium text-blue-900">
          Muestra — cada mes sale del mismo mes del año anterior:
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {conMuestra.map(c => {
            const src = c.muestra![0]!
            return (
              <span key={c.mes} className="text-[10px] text-blue-800">
                <span className="text-blue-600">{src.etiqueta}</span> {pesos(src.monto)}
                {" → "}
                <strong>{etiquetaClave(c.mes)}</strong> {pesos(c.monto)}
              </span>
            )
          })}
        </div>
        {conMuestra.length < celdas.length && (
          <p className="mt-1 text-[10px] text-blue-600">
            Los otros {celdas.length - conMuestra.length} meses no tienen dato del año anterior:
            quedan en cero a propósito. Un gasto anual muestra un solo mes con monto.
          </p>
        )}
      </div>
    )
  }

  const muestra = conMuestra[0]!.muestra!
  const suma = muestra.reduce((a, p) => a + p.monto, 0)
  return (
    <div className="mt-1.5 border-t border-blue-200 pt-1.5">
      <p className="mb-1 text-[10px] font-medium text-blue-900">
        Muestra — los {muestra.length} {muestra.length === 1 ? "dato" : "datos"} que se usaron:
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {muestra.map((p, i) => (
          <span key={i} className={`text-[10px] ${p.cero ? "text-blue-400 line-through" : "text-blue-800"}`}
            title={p.cero ? "Mes sin factura: entra como cero en el promedio" : undefined}>
            {p.etiqueta} {pesos(p.monto)}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-blue-800">
        {muestra.length > 1 && <>Suma <strong>{pesos(suma)}</strong> · </>}
        Resultado {etiquetaClave(conMuestra[0]!.mes)}:{" "}
        <strong>{pesos(conMuestra[0]!.monto)}</strong>
      </p>
    </div>
  )
}
