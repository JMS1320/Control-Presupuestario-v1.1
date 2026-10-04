"use client"

/**
 * 📸 PASAR LOS PAPELES A LA FOTO DEL BALANCE PROPIO — A-FEAT-1190 (2026-10-03).
 *
 * Pedido del usuario: *«que la foto del 30/6/26 se arme sola»*. Toma lo que YA calcularon los papeles
 * de trabajo (bancos, cuentas a pagar y a cobrar, cheques, anticipos, hacienda, insumos, granos,
 * sementeras) y lo guarda como la versión **Sistema** de la foto de ese cierre. La versión JMS toma
 * esos valores en los renglones que deja vacíos (default del dato real) y los pisa donde escribe.
 *
 * 🔔 Si la foto ya tenía valores del sistema y hoy el sistema dice otra cosa, **se muestra la
 * diferencia y no se pisa sola**: se actualiza sólo si el usuario aprieta el botón.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  RENGLONES, propuestaDelSistema, cambiosContraLoGuardado,
  type DatosDeLosPapeles, type ValorFoto,
} from "@/lib/balance/balance-propio"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const etiqueta = (id: string) => RENGLONES.find(r => r.id === id)?.etiqueta ?? id
const fmtFecha = (f: string) => f.split("-").reverse().join("/")

export function ProponerFotoBalance({ empresa, fechaCierre, datos }: {
  empresa: string
  fechaCierre: string
  datos: DatosDeLosPapeles
}) {
  const propuesta = useMemo(() => propuestaDelSistema(datos), [datos])
  const [guardado, setGuardado] = useState<ValorFoto[] | null>(null)
  const [fotoId, setFotoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const leer = async () => {
    const { data: f } = await supabase.from("balance_fotos").select("id")
      .eq("empresa", empresa).eq("fecha_cierre", fechaCierre).maybeSingle()
    setFotoId(f?.id ?? null)
    if (!f) { setGuardado([]); return }
    const { data: vs } = await supabase.from("balance_foto_valores").select("renglon, version, importe")
      .eq("foto_id", f.id).eq("version", "sistema")
    setGuardado(((vs || []) as any[]).map(v => ({ ...v, importe: Number(v.importe) })))
  }
  useEffect(() => { void leer() }, [empresa, fechaCierre]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambios = guardado ? cambiosContraLoGuardado(guardado, propuesta) : []
  const yaGuardada = !!guardado && guardado.length > 0

  const guardar = async () => {
    setGuardando(true)
    try {
      let id = fotoId
      if (!id) {
        // El TC se propone del dólar BNA importado a la fecha (o el anterior más cercano).
        const { data: cot } = await supabase.from("cotizaciones").select("valor, fecha")
          .eq("serie", "dolar_bna_divisas").lte("fecha", fechaCierre)
          .order("fecha", { ascending: false }).limit(1).maybeSingle()
        const { data: nueva, error } = await supabase.from("balance_fotos").insert({
          empresa, fecha_cierre: fechaCierre, tc: cot?.valor ?? null,
          tc_fuente: cot ? `dolar_bna_divisas del ${fmtFecha(cot.fecha)}` : null,
          notas: "Armada desde los papeles de trabajo (versión Sistema).",
        }).select("id").single()
        if (error) throw error
        id = nueva.id
      }
      const filas = propuesta.map(p => ({
        foto_id: id, renglon: p.renglon, version: "sistema", importe: p.importe,
        origen: "sistema", valor_sistema: p.importe, detalle: p.detalle, updated_at: new Date().toISOString(),
      }))
      if (filas.length) {
        const { error } = await supabase.from("balance_foto_valores").upsert(filas, { onConflict: "foto_id,renglon,version" })
        if (error) throw error
      }
      // Un renglón que el sistema ya no propone sale de la versión Sistema (no toca las otras).
      const sobran = cambios.filter(c => c.hoy === null).map(c => c.renglon)
      if (sobran.length) {
        const { error } = await supabase.from("balance_foto_valores").delete()
          .eq("foto_id", id).eq("version", "sistema").in("renglon", sobran)
        if (error) throw error
      }
      toast.success(`Foto del ${fmtFecha(fechaCierre)}: ${filas.length} renglón(es) del sistema guardados. Miralos en «📸 Balance propio».`)
      await leer()
    } catch (err) { toast.error("No se pudo guardar en la foto: " + (err as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-sm">📸 Pasar a la foto del balance propio — {empresa} al {fmtFecha(fechaCierre)}</div>
      {propuesta.length === 0 ? (
        <p className="text-gray-600">Todavía no hay nada para proponer: armá el libro y traé stock y precios.</p>
      ) : (
        <>
          <table className="w-full">
            <tbody>
              {propuesta.map(p => {
                const c = cambios.find(x => x.renglon === p.renglon)
                return (
                  <tr key={p.renglon} className="border-b border-sky-100">
                    <td className="py-0.5">{etiqueta(p.renglon)}<div className="text-gray-500">{p.detalle}</div></td>
                    <td className="text-right align-top">{fmt(p.importe)}
                      {yaGuardada && c && <div className="text-amber-700">en la foto: {c.guardado == null ? "—" : fmt(c.guardado)}</div>}
                    </td>
                  </tr>
                )
              })}
              {cambios.filter(c => c.hoy === null).map(c => (
                <tr key={c.renglon} className="text-amber-700">
                  <td>{etiqueta(c.renglon)} — el sistema ya no lo propone</td><td className="text-right">en la foto: {fmt(c.guardado ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-gray-600">
            No se proponen (el sistema no los sabe; van a mano): créditos impositivos, fondo común, deudas fiscales y sociales, impuesto diferido.
          </p>
          {yaGuardada && cambios.length === 0 ? (
            <p className="text-emerald-700">✓ La foto ya tiene exactamente estos valores del sistema.</p>
          ) : (
            <div className="flex items-center gap-2">
              {yaGuardada && <span className="text-amber-700">⚠️ {cambios.length} renglón(es) cambiaron desde que se guardó la foto.</span>}
              <Button size="sm" onClick={() => void guardar()} disabled={guardando || guardado === null}>
                {guardando && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {yaGuardada ? "Actualizar la versión Sistema de la foto" : "Guardar en la foto (versión Sistema)"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
