"use client"

/**
 * 🔁 PASES ENTRE CAJAS — cada salida con su entrada, y lo que no tiene pareja (A-FEAT-1585, pieza 5). SÓLO LEE.
 * La lógica está en `lib/extractos/pases-entre-cajas.ts`. Avisa, no frena: un pase puede tardar días.
 */
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { traerTodo } from "@/lib/supabase-paginado"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { controlarPases, esExtraccionDelBanco, type ControlPases, type MovPase } from "@/lib/extractos/pases-entre-cajas"
import { NOMBRE_CAJA, type TablaCaja } from "@/lib/extractos/caja-excel"

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtF = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const CUENTA = (c: string) => c === "banco" ? "Galicia CC $ MSA" : NOMBRE_CAJA[c as TablaCaja] ?? c
const CAJAS: TablaCaja[] = ["caja_general", "caja_ams", "caja_sigot"]

/** El ejercicio de MSA que termina el 30/06 del año `y`. */
const rangoDe = (y: number) => ({ desde: `${y - 1}-07-01`, hasta: `${y}-06-30`, rotulo: `${String(y - 1).slice(2)}/${String(y).slice(2)}` })

function Ficha({ m, lado }: { m: MovPase; lado: "sale" | "entra" }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="pr-2 whitespace-nowrap">{fmtF(m.fecha)}</td>
      <td className="pr-2 whitespace-nowrap">{CUENTA(m.cuenta)}</td>
      <td className="pr-2 text-right tabular-nums whitespace-nowrap">$ {fmt(lado === "sale" ? m.debitos : m.creditos)}</td>
      <td className="pr-2">{m.texto || "—"}</td>
      <td className="text-gray-500">{m.descripcion}</td>
    </tr>
  )
}

export function PanelPasesEntreCajas() {
  const hoy = new Date()
  const ejActual = hoy.getMonth() >= 6 ? hoy.getFullYear() + 1 : hoy.getFullYear()
  const [abierto, setAbierto] = useState(false)
  const [ej, setEj] = useState(ejActual - 1)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<ControlPases | null>(null)

  const calcular = async (y: number) => {
    setCargando(true); setError(null); setRes(null)
    const { desde, hasta } = rangoDe(y)
    try {
      const movs: MovPase[] = []
      for (const c of CAJAS) {
        const r = await traerTodo<any>((a, b) => supabase.schema("msa").from(c).select("id, fecha, descripcion, detalle, debitos, creditos").gte("fecha", desde).lte("fecha", hasta).order("id").range(a, b))
        if (r.error) throw new Error(`${NOMBRE_CAJA[c]}: ${r.error.message}`)
        for (const m of r.data) movs.push({ id: m.id, cuenta: c, fecha: String(m.fecha).slice(0, 10), texto: m.detalle || m.descripcion || "", descripcion: m.descripcion ?? "", debitos: Number(m.debitos) || 0, creditos: Number(m.creditos) || 0 })
      }
      const b = await traerTodo<any>((a, z) => supabase.from("msa_galicia").select("id, fecha, descripcion, detalle, categ, estado, debitos").gte("fecha", desde).lte("fecha", hasta).gt("debitos", 0)
        .or("descripcion.ilike.extrac%,categ.eq.CAJA").order("id").range(a, z))
      if (b.error) throw new Error(`Galicia: ${b.error.message}`)
      for (const m of b.data) if (esExtraccionDelBanco(m.descripcion ?? "", m.categ)) movs.push({ id: m.id, cuenta: "banco", fecha: String(m.fecha).slice(0, 10), texto: m.detalle ?? "", descripcion: m.descripcion ?? "", debitos: Number(m.debitos) || 0, creditos: 0, categ: m.categ ?? null, estado: m.estado ?? null })
      setRes(controlarPases(movs))
    } catch (e) { setError((e as Error).message) } finally { setCargando(false) }
  }

  const partidos = res?.pares.filter(p => p.sale.length > 1) ?? []
  const directos = res?.pares.filter(p => p.directo) ?? []
  const sinPar = (res?.salenSinPar.length ?? 0) + (res?.entranSinPar.length ?? 0)
  return (
    <div className="rounded-md border text-sm">
      <button type="button" onClick={() => { const a = !abierto; setAbierto(a); if (a && !res && !cargando) calcular(ej) }} aria-expanded={abierto}
        className="w-full text-left px-3 py-2 font-medium flex items-center gap-2">
        <span>🔁 Pases entre cajas y con el banco</span>
        {res && <span className={`text-xs font-normal ${sinPar ? "text-amber-700" : "text-emerald-700"}`}>{sinPar ? `⚠️ ${sinPar} sin pareja` : "✓ todos con su pareja"}</span>}
        <span className="text-xs font-normal text-gray-500">{abierto ? "ocultar" : "ver"}</span>
      </button>
      {abierto && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-gray-600">Une cada extracción del Galicia con su entrada a una caja, y cada pase de una caja con su entrada en la otra (mismo importe, hasta 7 días). Sólo mira; no cambia nada.</p>
          <div className="flex flex-wrap gap-1">
            {[ejActual - 1, ejActual].map(y => (
              <Button key={y} size="sm" variant={y === ej ? "default" : "outline"} disabled={cargando} onClick={() => { setEj(y); calcular(y) }}>Ejercicio {rangoDe(y).rotulo}</Button>))}
          </div>
          {cargando && <div className="text-gray-500"><Loader2 className="inline h-4 w-4 animate-spin mr-1" />Leyendo las cajas y el banco…</div>}
          {error && <div className="text-red-700">No se pudo leer: {error}</div>}
          {res && (
            <>
              <div className="overflow-x-auto"><table className="text-xs w-full">
                <thead><tr className="text-left text-gray-500"><th className="pr-2">Pase</th><th className="pr-2 text-right">Unidos</th><th className="pr-2 text-right">Importe</th><th className="pr-2 text-right">Salen sin pareja</th><th className="pr-2 text-right">Entran sin pareja</th></tr></thead>
                <tbody>{res.resumen.map(r => (
                  <tr key={r.tipo} className="border-t border-gray-100">
                    <td className="pr-2">{r.tipo === "banco→caja" ? "Del banco a una caja" : "De una caja a otra"}</td>
                    <td className="pr-2 text-right tabular-nums">{r.pares}</td><td className="pr-2 text-right tabular-nums">$ {fmt(r.importe)}</td>
                    <td className={`pr-2 text-right tabular-nums ${r.salenSinPar ? "text-amber-700" : ""}`}>{r.salenSinPar} · $ {fmt(r.importeSalen)}</td>
                    <td className={`pr-2 text-right tabular-nums ${r.entranSinPar ? "text-amber-700" : ""}`}>{r.entranSinPar} · $ {fmt(r.importeEntran)}</td>
                  </tr>))}</tbody>
              </table></div>
              {sinPar > 0 && (
                <div className="space-y-1">
                  <div className="font-medium text-amber-800">⚠️ Sin pareja: salió de un lado y no aparece entrando en el otro (o al revés)</div>
                  <div className="overflow-x-auto"><table className="text-xs w-full">
                    <thead><tr className="text-left text-gray-500"><th className="pr-2">Fecha</th><th className="pr-2">Cuenta</th><th className="pr-2 text-right">Importe</th><th className="pr-2">Detalle</th><th>Descripción</th></tr></thead>
                    <tbody>
                      {res.salenSinPar.map(m => <Ficha key={m.id} m={m} lado="sale" />)}
                      {res.entranSinPar.map(m => <Ficha key={m.id} m={m} lado="entra" />)}
                    </tbody>
                  </table></div>
                </div>)}
              {directos.length > 0 && (
                <details><summary className="cursor-pointer text-xs font-medium text-amber-800">Del banco directo a AMS o Sigot, sin pasar por la General: {directos.length}</summary>
                  <ul className="text-xs pl-4 list-disc">{directos.map((p, i) => <li key={i}>{fmtF(p.sale[0].fecha)} extracción $ {fmt(p.sale[0].debitos)} → {CUENTA(p.entra.cuenta)} {fmtF(p.entra.fecha)} «{p.entra.texto}»</li>)}</ul></details>)}
              {(res.aUnPago?.length ?? 0) > 0 && (
                <details><summary className="cursor-pointer text-xs">Extracciones que fueron directo a pagar algo (ya conciliadas, no pasaron por una caja): {res.aUnPago.length}</summary>
                  <ul className="text-xs pl-4 list-disc">{res.aUnPago.map(m => <li key={m.id}>{fmtF(m.fecha)} $ {fmt(m.debitos)} → {m.categ} «{m.texto}»</li>)}</ul></details>)}
              {partidos.length > 0 && (
                <details><summary className="cursor-pointer text-xs">Entradas que son varias extracciones juntas (tope del cajero): {partidos.length}</summary>
                  <ul className="text-xs pl-4 list-disc">{partidos.map((p, i) => <li key={i}>{CUENTA(p.entra.cuenta)} {fmtF(p.entra.fecha)} $ {fmt(p.entra.creditos)} = {p.sale.map(s => `${fmtF(s.fecha)} $ ${fmt(s.debitos)}`).join(" + ")}</li>)}</ul></details>)}
            </>)}
        </div>)}
    </div>
  )
}
