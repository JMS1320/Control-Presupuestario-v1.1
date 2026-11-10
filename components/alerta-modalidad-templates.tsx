"use client"

/**
 * 🔁 Aviso en Principal: errores de ESTRUCTURA de los templates — ANUAL o CUOTAS (A-FEAT-1582).
 *
 * JMS 09/11: *«no sé si debe ser una regla en Excel sino más bien una regla en la app que salte desde Principal. Es un error de
 * estructura directa, una inconsistencia grande»*. El control es uno solo (`lib/templates/modalidad.ts`) y lo usa también la
 * solapa «Inconsistencias» del H para auditar.
 *
 * Rojo: lo que es un error (las dos modalidades activas o ninguna, la activa sin cuotas, cuotas vivas en el template inactivo,
 * una desactivada con pago, una conciliada con importe y sin pago). Gris: las cuotas en $ 0 marcadas «conciliado» (un mes sin
 * nada que pagar) — van plegadas, para que no tapen a las rojas.
 */

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Repeat } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { hoyArgentina } from "@/lib/fechas"
import { cargarProblemasDeModalidad, GRAVES_MODALIDAD, type ProblemaModalidad } from "@/lib/templates/modalidad"

const money = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (f: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

export function AlertaModalidadTemplates() {
  const [problemas, setProblemas] = useState<ProblemaModalidad[]>([])
  const [fallaron, setFallaron] = useState<string[]>([])
  const [verCeros, setVerCeros] = useState(false)

  useEffect(() => {
    let cancelado = false
    cargarProblemasDeModalidad(supabase as any, Number(hoyArgentina().slice(0, 4)))
      .then(r => { if (!cancelado) { setProblemas(r.problemas); setFallaron(r.tablasQueFallaron) } })
      .catch(e => console.error("Alerta anual o cuotas:", e))
    return () => { cancelado = true }
  }, [])

  const graves = problemas.filter(p => GRAVES_MODALIDAD.includes(p.tipo))
  const ceros = problemas.filter(p => !GRAVES_MODALIDAD.includes(p.tipo))
  if (!graves.length && !ceros.length && !fallaron.length) return null

  const fila = (p: ProblemaModalidad, i: number) => (
    <div key={`${p.tipo}-${p.templateId}-${i}`} className="text-[12px] leading-5">
      <span className="font-medium text-gray-900">{p.template}</span>
      {p.anio ? <span className="text-gray-500"> ({p.anio})</span> : null}
      {p.cuotas.length > 0 && (
        <span className="text-gray-600"> · {p.cuotas.slice(0, 4).map(c => `${dmy(c.fecha)} $ ${money(c.monto)}`).join(" · ")}
          {p.cuotas.length > 4 ? ` · +${p.cuotas.length - 4}` : ""}</span>
      )}
    </div>
  )
  const porTipo = (lista: ProblemaModalidad[]) => {
    const m = new Map<string, ProblemaModalidad[]>()
    for (const p of lista) m.set(p.titulo, [...(m.get(p.titulo) ?? []), p])
    return [...m.entries()]
  }

  return (
    <Card className={`entrada-suave ${graves.length ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Repeat className={`h-5 w-5 shrink-0 mt-0.5 ${graves.length ? "text-red-700" : "text-gray-500"}`} />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${graves.length ? "text-red-900" : "text-gray-800"}`}>
              Templates: {graves.length ? `${graves.length} error${graves.length === 1 ? "" : "es"} de estructura (anual o cuotas, pagos)` : "sin errores de estructura"}
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Cada vehículo o partida se paga de UNA manera por año: anual o cuotas, la otra desactivada. Y una cuota conciliada tiene
              que tener su pago; una desactivada, ninguno.
            </p>

            {porTipo(graves).map(([titulo, ps]) => (
              <div key={titulo} className="mt-2.5 rounded border border-red-200 bg-white px-2 py-1.5">
                <div className="text-[12px] font-medium text-red-800">{ps.length} · {titulo} — {ps[0].accion}</div>
                {ps.map(fila)}
              </div>
            ))}

            {ceros.length > 0 && (
              <div className="mt-2.5">
                <button className="text-[12px] text-gray-600 underline" onClick={() => setVerCeros(v => !v)}>
                  {verCeros ? "▾" : "▸"} {ceros.length} template{ceros.length === 1 ? "" : "s"} con cuotas en $ 0 marcadas «conciliado» sin pago (deberían estar desactivadas)
                </button>
                {verCeros && <div className="mt-1 rounded border border-gray-200 bg-white px-2 py-1.5">{ceros.map(fila)}</div>}
              </div>
            )}

            {fallaron.length > 0 && (
              <p className="text-[11px] text-amber-800 mt-2">⚠️ No se pudieron leer: {fallaron.join(", ")} — un pago ahí no se ve, y puede aparecer como «sin pago».</p>
            )}
            <p className="text-[11px] text-gray-500 mt-2">Se corrige en Templates. El mismo control está en la solapa «Inconsistencias» del H para auditar.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
