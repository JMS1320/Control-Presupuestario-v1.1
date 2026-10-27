"use client"

/**
 * 🔁 Subdiarios → el mes abierto: si cambió después de enviarlo o presentarlo, queda «A RECTIFICAR» (A-FEAT-1394).
 * Muestra qué cambió (comprobante por comprobante), cuánto se mueve cada columna, si toca el IVA, y deja marcarlo
 * rectificado (sólo admin) cuando se mandó el subdiario rectificado. La lógica: `lib/subdiarios/rectificacion.ts`.
 * El registro lo hace la base (trigger del script 119), así que no depende de por dónde se editó.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  mesesARectificar, leyendaRectificacion, queCambio, comprobanteDe, IMPORTES, type CambioSubdiario,
} from "@/lib/subdiarios/rectificacion"

const $ = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })

export function RectificacionDelMes({ empresa, lado, periodo, esAdmin, onCambio }: {
  empresa: "MSA" | "PAM" | "MA"
  lado: "compras" | "ventas"
  /** `MM/AAAA` */
  periodo: string
  esAdmin: boolean
  /** Para que el tablero de meses se actualice al marcarlo rectificado. */
  onCambio?: () => void
}) {
  const [cambios, setCambios] = useState<CambioSubdiario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mes, anio] = periodo.split("/").map(Number)

  const cargar = async () => {
    setError(null)
    const { data, error: e } = await supabase.from("subdiario_cambios").select("*")
      .eq("empresa", empresa).eq("lado", lado).eq("anio", anio).eq("mes", mes).order("creado_at")
    if (e) { setError(e.message); setCambios([]); return }
    setCambios((data ?? []) as CambioSubdiario[])
  }
  useEffect(() => { if (anio && mes) cargar() }, [empresa, lado, periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!anio || !mes || cambios === null) return null
  // Sin la tabla (script 119 sin correr) no se muestra nada: la pantalla anda como antes.
  if (error) return null

  const abierto = mesesARectificar(cambios).get(periodo)
  const rectificados = cambios.filter(c => c.rectificado_at)
  if (!abierto) {
    if (!rectificados.length) return null
    const ult = rectificados[rectificados.length - 1]
    return (
      <div className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">
        ✓ Rectificado: {rectificados.length} cambio(s) de este mes ya se mandaron rectificados
        {ult.rectificado_at && <> — el {fecha(ult.rectificado_at)}{ult.rectificado_por ? ` por ${ult.rectificado_por}` : ""}</>}
        {ult.rectificado_nota && <> · «{ult.rectificado_nota}»</>}
      </div>
    )
  }

  const marcarRectificado = async () => {
    const nota = window.prompt(
      `¿Ya mandaste el subdiario ${periodo} rectificado?` +
      (abierto.modificaIva ? "\n\n⚠️ Este cambio MODIFICA IVA: también hay que rectificar la DDJJ." : "") +
      "\n\nEscribí una nota (a quién, cómo) y Aceptar:", abierto.modificaIva ? "subdiario y DDJJ rectificados" : "subdiario rectificado (no modifica IVA)")
    if (nota === null) return
    setGuardando(true)
    const { data: u } = await supabase.auth.getUser()
    const { error: e } = await supabase.from("subdiario_cambios")
      .update({ rectificado_at: new Date().toISOString(), rectificado_por: u.user?.email ?? null, rectificado_nota: nota || null })
      .in("id", abierto.cambios.map(c => c.id))
    setGuardando(false)
    if (e) { alert("No se pudo marcar: " + e.message); return }
    await cargar()
    onCambio?.()
  }

  const rojo = abierto.modificaIva
  return (
    <div className={`rounded border p-3 text-sm space-y-2 ${rojo ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"}`}>
      <div className={`font-semibold ${rojo ? "text-red-800" : "text-amber-900"}`}>{leyendaRectificacion(abierto)}</div>
      <div className="text-xs text-muted-foreground">
        Estos comprobantes cambiaron después de que el mes se envió al contador o se presentó. Lo que tiene el contador (o
        lo presentado) ya no coincide con la app.
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th>Comprobante</th><th>Qué cambió</th><th>IVA</th><th>Quién · cuándo</th></tr></thead>
        <tbody>
          {abierto.cambios.map(c => (
            <tr key={c.id} className="border-t align-top">
              <td className="font-mono pr-2 whitespace-nowrap">{comprobanteDe(c)}</td>
              <td className="pr-2">{queCambio(c)}</td>
              <td className="pr-2 whitespace-nowrap">{c.modifica_iva ? "modifica" : "no modifica"}</td>
              <td className="whitespace-nowrap">{c.quien ?? "—"} · {fecha(c.creado_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs">
        <b>Cómo se mueve el subdiario del mes:</b>{" "}
        {IMPORTES.filter(i => abierto.efecto[i.clave]).map(i => `${i.nombre} ${abierto.efecto[i.clave] > 0 ? "+" : ""}${$(abierto.efecto[i.clave])}`).join(" · ") || "sin cambio en los importes"}
      </div>
      <div className="flex items-center gap-2">
        {esAdmin ? (
          <button onClick={marcarRectificado} disabled={guardando}
            className="rounded border border-green-600 bg-white px-2 py-1 text-xs text-green-800 hover:bg-green-50 disabled:opacity-50">
            ✓ Ya mandé el subdiario rectificado
          </button>
        ) : <span className="text-xs text-muted-foreground">🔒 Lo marca rectificado el administrador.</span>}
        <span className="text-xs text-muted-foreground">Exportalo con «Generar PDF + Excel»: lo que sale hoy ya es el rectificado.</span>
      </div>
    </div>
  )
}

/** Los meses con cambios sin rectificar, para el tablero de arriba de Subdiarios. `null` si no se pudo leer. */
export async function consultarMesesARectificar(empresa: string, lado: "compras" | "ventas") {
  const { data, error } = await supabase.from("subdiario_cambios").select("*")
    .eq("empresa", empresa).eq("lado", lado).is("rectificado_at", null)
  if (error) return null
  return mesesARectificar((data ?? []) as CambioSubdiario[])
}
