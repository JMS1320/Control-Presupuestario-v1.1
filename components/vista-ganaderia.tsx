"use client"

// INGRESOS → Ganadería. Las ventas de hacienda, presupuestadas y por vender.
//
// ── Qué pasó con la tabla "Venta Destete" ────────────────────────────────────
// Hasta 2026-08-05 esta pantalla mostraba `public.presupuesto_ganaderia`: una proyección
// PARAMÉTRICA del destete (vientres × % destete × peso × precio). **Se retiró de la pantalla.**
//
// Estaba **desconectada del presupuesto**: `cargarGanaderia()` en `tab-presupuesto.tsx` existe
// pero nadie la llama — se dejó de usar cuando mostraba un ingreso fantasma en abr-27 desde una
// fila con los porcentajes cargados como fracciones (IVA `1,05` = 105 %, machos `0,05` = 5 %).
//
// El presupuesto se alimenta de los **lotes** (`cargarHacienda`), que es lo que se muestra acá
// abajo. Tener las dos en pantalla era peor que una sola: **decían cosas distintas de la misma
// venta**, y la que el usuario veía primero era la que no manda.
//
// ⚠️ La tabla **sigue en la BD** con su fila. No se borró ningún dato: sólo dejó de mostrarse.
// Si alguna vez se quiere recuperar el modelo paramétrico —que tiene sentido para la cría, donde
// los terneros todavía no existen— la decisión pendiente es que **genere los lotes**, en vez de
// convivir con ellos como segunda fuente. Ver `PENDIENTES.md` § G-01.

import { Beef, Info } from "lucide-react"
import { SeccionVentasPorLote } from "@/components/seccion-ventas-por-lote"

export function VistaGanaderia() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <Beef className="h-5 w-5" /> Ganadería — ventas de hacienda
        </h3>
        <p className="text-sm text-gray-500">
          Separadas por <strong>actividad</strong> y por <strong>campaña</strong>. Es la misma
          valuación que usa el Presupuesto, así que los números no pueden diferir.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Las ventas se cargan en <strong>Sector Productivo → Evolución Rodeo</strong> (el panel de
          lotes) y los precios <strong>$/kg</strong> en <strong>Presupuesto → Precios y TC</strong>.
          Acá se ven y se controlan.
        </span>
      </p>

      <SeccionVentasPorLote />
    </div>
  )
}
