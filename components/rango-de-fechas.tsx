"use client"

/**
 * 📅 **A-FEAT-161 — el rango de fechas para FILTRAR, en un solo lugar.**
 *
 * Pedido del usuario 2026-09-20: *«ese sistema de autollenado de fechas para los filtros de fecha
 * (ej. auditoría, pero hay varios: Cash Flow, etc.)»*, y antes: *«que por default ya sea mes 09 año
 * 2026 porque es el mes y año actual; yo hoy escribiría que quiero ir del 19 06 y ya estará
 * completo 2026»*.
 *
 * ## Por qué un componente y no copiar la lógica
 * Hay **84 campos de fecha** en la app. Copiar esto en cada pantalla es exactamente el error que
 * viene mordiendo todo el proyecto: se arregla en una y quedan las otras (§ 30.9.5). Acá se toca un
 * archivo y valen todas.
 *
 * ## 🛑 Dónde NO va
 * **Sólo para filtrar.** En una fecha que es **dato del negocio** —emisión de una factura, de una
 * venta, de un pago— un valor precargado es peligroso: si nadie lo mira, se guarda una fecha
 * inventada. Ahí el campo tiene que empezar vacío y obligar a elegir.
 *
 * ## Cómo resuelve el autocompletado
 * Un `<input type="date">` **no deja precargar sólo mes y año**. Entonces se cargan las dos fechas
 * del mes en curso: escribir `19/06` sobre `01/09/2026` deja `19/06/2026` — el año ya está puesto.
 *
 * 📌 **Y se precarga cuando el usuario ABRE el panel, no al entrar a la pantalla.** Es lo que lo
 * hace seguro: tener fechas escritas no debe filtrar nada hasta que él lo decida. Por eso
 * `autollenarAlMontar` es opt-in y el que lo usa tiene que saber que su panel no filtra solo.
 */

import { Button } from "@/components/ui/button"
import { useEffect, useRef } from "react"
import { mesCompleto, mesActual, mesAnterior } from "@/lib/format/rango-fechas"

// El cálculo vive en `lib/format/rango-fechas.ts`: es lógica pura y así tiene casos en
// `npm run probar`, que sólo carga `.ts`. Se re-exporta para que quien use el componente no
// tenga que importar de dos lados.
export { mesCompleto, mesActual, mesAnterior }

export interface RangoDeFechasProps {
  desde: string
  hasta: string
  onCambiar: (desde: string, hasta: string) => void
  /** Rellena con el mes actual al montar, **sólo si los dos campos están vacíos**. */
  autollenarAlMontar?: boolean
  /** Texto de ayuda bajo los campos. */
  ayuda?: string
  className?: string
}

export function RangoDeFechas({
  desde, hasta, onCambiar, autollenarAlMontar = false, ayuda, className = "",
}: RangoDeFechasProps) {
  const yaAutollenó = useRef(false)

  useEffect(() => {
    if (!autollenarAlMontar || yaAutollenó.current) return
    yaAutollenó.current = true
    // ⚠️ Nunca pisa un rango que el usuario ya puso.
    if (desde || hasta) return
    const m = mesActual()
    onCambiar(m.desde, m.hasta)
  }, [autollenarAlMontar])

  const ponerMes = (m: { desde: string; hasta: string }) => onCambiar(m.desde, m.hasta)

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Desde</label>
          <input type="date" value={desde} onChange={e => onCambiar(e.target.value, hasta)}
            className="border rounded px-2 py-1 text-xs" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Hasta</label>
          <input type="date" value={hasta} onChange={e => onCambiar(desde, e.target.value)}
            className="border rounded px-2 py-1 text-xs" />
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs"
          onClick={() => ponerMes(mesActual())}>Este mes</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs"
          onClick={() => ponerMes(mesAnterior())}>Mes anterior</Button>
        {(desde || hasta) && (
          <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => onCambiar("", "")}>Limpiar</Button>
        )}
      </div>
      {ayuda && <p className="text-[11px] text-gray-500">{ayuda}</p>}
    </div>
  )
}
