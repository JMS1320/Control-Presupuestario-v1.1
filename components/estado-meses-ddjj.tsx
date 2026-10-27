"use client"

import type { EstadoMes } from "@/lib/subdiarios/estado-ddjj"
import type { MesARectificar } from "@/lib/subdiarios/rectificacion"

/**
 * 📨 El tablero de meses de arriba de Subdiarios (A-FEAT-1295): cada mes con su estado —
 * Imputado, Enviado al contador o DDJJ OK —, para ver de un vistazo qué falta mandar o confirmar.
 * Lo usan Compras y Ventas.
 */
const ESTILO: Record<string, { clase: string; icono: string; nombre: string }> = {
  "Imputado": { clase: "border-yellow-400 bg-yellow-50 text-yellow-800", icono: "📝", nombre: "Imputado" },
  "Enviado": { clase: "border-blue-400 bg-blue-50 text-blue-800", icono: "📨", nombre: "Enviado al contador" },
  "DDJJ OK": { clase: "border-green-500 bg-green-50 text-green-800", icono: "✅", nombre: "DDJJ OK" },
}

export function EstadoMesesDDJJ({ meses, onElegir, ayuda, aRectificar }: {
  meses: EstadoMes[] | null
  onElegir: (periodo: string) => void
  ayuda?: string
  /** 🔁 A-FEAT-1394: los meses que cambiaron después de enviarlos o presentarlos. */
  aRectificar?: Map<string, MesARectificar> | null
}) {
  if (meses === null) {
    return <div className="text-xs text-red-700">⚠️ No se pudo leer el estado de los meses.</div>
  }
  if (meses.length === 0) return null
  const enviados = meses.filter(m => m.estado === "Enviado").length
  return (
    <div className="rounded border bg-white p-3 text-sm space-y-2">
      <div className="font-semibold">🗓️ Estado de los meses</div>
      <div className="flex flex-wrap gap-1.5">
        {meses.map(m => {
          const e = ESTILO[m.estado]
          const r = aRectificar?.get(m.periodo)
          return (
            <button
              key={m.periodo}
              onClick={() => onElegir(m.periodo)}
              className={`rounded border px-2 py-1 text-xs font-mono hover:opacity-80 ${e.clase}`}
              title={`${m.periodo}: ${e.nombre} · ${m.comprobantes} comprobante(s)` +
                (m.sinMandar > 0 ? ` · ${m.sinMandar} imputado(s) después de enviarlo` : "") +
                (r ? ` · 🔁 A RECTIFICAR: ${r.cambios.length} cambio(s) — ${r.modificaIva ? "MODIFICA IVA (subdiario y DDJJ)" : "no modifica IVA (sólo el subdiario)"}` : "")}
            >
              {e.icono} {m.periodo}{m.sinMandar > 0 && <span className="ml-1 text-orange-700">+{m.sinMandar}</span>}
              {r && <span className={`ml-1 font-bold ${r.modificaIva ? "text-red-700" : "text-amber-700"}`}>🔁</span>}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        📝 Imputado · 📨 Enviado al contador · ✅ DDJJ OK · <span className="text-orange-700">+N</span> = comprobantes imputados después de enviarlo
        {" "}· <span className="text-amber-700">🔁</span> = a rectificar (cambió después de enviarlo o presentarlo)
        {enviados > 0 && <> — <b className="text-blue-800">{enviados} mes(es) enviado(s) sin confirmar la presentación</b></>}
        {ayuda && <div className="mt-0.5">{ayuda}</div>}
      </div>
    </div>
  )
}
