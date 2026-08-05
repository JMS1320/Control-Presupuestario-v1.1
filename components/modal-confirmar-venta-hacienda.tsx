"use client"

// CONFIRMAR una venta de hacienda — **un solo paso**.
//
// Lo pidió así el usuario (2026-08-05): *"debe ser un solo paso: confirmar todos los datos reales
// y decir cuáles son las caravanas. Eso debe adjudicar la venta a esas caravanas en productivo y
// dejar la venta firme con los momentos de cobro firmes en presupuesto y cash flow"*.
//
// De un botón salen tres efectos, y ninguno es opcional:
//   · `stock_ventas`         → la venta comercial. De ahí sale a Cash Flow vía `ventas_unificadas`
//   · `movimientos_hacienda` → la baja física del stock y las planillas
//   · `terneros`             → qué caravanas se fueron; el segmentador deja de contarlas
//
// ── Los kg NO se reparten entre los animales ─────────────────────────────────
// La pesada de venta es grupal. Prorratearla exigiría suponer que todos ganaron lo mismo por día
// —lo que el segmentador existe para desmentir— y ese peso inventado quedaría en
// `pesadas_terneros` indistinguible de uno medido. Lo que sí se muestra es la **ganancia real del
// grupo**, que es un dato.

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, CheckCircle2, Upload, ClipboardPaste } from "lucide-react"
import * as XLSX from "xlsx"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  parsearPegado, matchearCaravanas, gananciaRealDelGrupo, netoDeVenta,
  type TerneroRef, type MatchCaravana,
} from "@/lib/ganaderia/confirmar-venta"
import {
  useNormasComercializacion, SelectorComercializacion,
  type SeleccionComercial,
} from "@/components/selector-comercializacion"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

export interface LoteAConfirmar {
  id: string
  categoria: string
  /** Cabezas y peso proyectados: se ofrecen como default y se corrigen con lo real. */
  cabezas: number
  pesoProyectado: number
  precioProyectado: number
  pctDesbaste: number
  pctCz: number
  plazoCobro: string | null
  fechaVentaEstimada: string | null
  empresa: string
  esGordo: boolean
}

export function ModalConfirmarVentaHacienda({ lote, onCerrar, onConfirmado }: {
  lote: LoteAConfirmar | null
  onCerrar: () => void
  onConfirmado: () => void
}) {
  const normas = useNormasComercializacion()
  const [guardando, setGuardando] = useState(false)
  const [terneros, setTerneros] = useState<TerneroRef[]>([])
  const [pesadas, setPesadas] = useState<{ fecha: string; prom: number } | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  // Datos reales de la venta
  const [fechaVenta, setFechaVenta] = useState("")
  const [cabezas, setCabezas] = useState("")
  const [kgTotales, setKgTotales] = useState("")
  const [precioKg, setPrecioKg] = useState("")
  const [pctCz, setPctCz] = useState("")
  const [flete, setFlete] = useState("")
  const [plazo, setPlazo] = useState("")
  const [cliente, setCliente] = useState("")
  const [comercial, setComercial] = useState<SeleccionComercial>({
    destinoId: "", intermediarioId: "", rutaId: "", categoria: "", vehiculo: "", precioRes: "",
  })

  // Caravanas
  const [pegado, setPegado] = useState("")
  const [entradas, setEntradas] = useState<{ original: string; peso?: number | null }[]>([])

  useEffect(() => {
    if (!lote) return
    setFechaVenta(lote.fechaVentaEstimada ?? new Date().toISOString().slice(0, 10))
    setCabezas(String(Math.round(lote.cabezas)))
    setKgTotales(fmtNumeroAR(lote.cabezas * lote.pesoProyectado, 0))
    setPrecioKg(lote.precioProyectado > 0 ? fmtNumeroAR(lote.precioProyectado, 0) : "")
    setPctCz(fmtNumeroAR(lote.pctCz * 100, 2))
    setPlazo(lote.plazoCobro ?? "")
    setFlete(""); setCliente(""); setPegado(""); setEntradas([])
  }, [lote?.id])

  const cargar = useCallback(async () => {
    if (!lote) return
    const p = supabase.schema("productivo")
    const [{ data: ts }, { data: ps }, { data: cats }] = await Promise.all([
      p.from("terneros").select("id, caravana_oficial, caravana_interna, sexo, activo"),
      p.from("pesadas_terneros").select("fecha, peso_kg"),
      p.from("categorias_hacienda").select("id, nombre"),
    ])
    setTerneros((ts || []) as TerneroRef[])
    setCategoriaId(((cats || []) as any[]).find(c => c.nombre === lote.categoria)?.id ?? null)

    // La última pesada, para poder mostrar la ganancia real del grupo.
    const filas = ((ps || []) as any[])
    const ultima = filas.map(f => f.fecha).sort().slice(-1)[0]
    if (ultima) {
      const delDia = filas.filter(f => f.fecha === ultima)
      setPesadas({
        fecha: ultima,
        prom: delDia.reduce((s, f) => s + Number(f.peso_kg), 0) / delDia.length,
      })
    }
  }, [lote?.id])

  useEffect(() => { if (lote) cargar() }, [lote?.id, cargar])

  const matches: MatchCaravana[] = useMemo(
    () => (entradas.length ? matchearCaravanas(entradas, terneros) : []), [entradas, terneros])

  const ok = matches.filter(m => m.estado === "ok")
  const noEncontradas = matches.filter(m => m.estado === "no_encontrada")
  const duplicadas = matches.filter(m => m.estado === "duplicada")
  const yaVendidas = matches.filter(m => m.estado === "ya_vendida")

  const nCab = Math.round(parseNumeroAR(cabezas))
  const nKg = parseNumeroAR(kgTotales)
  const nPrecio = parseNumeroAR(precioKg)
  const nCz = parseNumeroAR(pctCz) / 100
  const nFlete = parseNumeroAR(flete)
  const cuenta = netoDeVenta(nKg, nPrecio, nCz, nFlete)
  const ganancia = gananciaRealDelGrupo(
    nKg, nCab, pesadas?.prom ?? null, pesadas?.fecha ?? null, fechaVenta || null)

  const leerExcel = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "buffer" })
    const filas: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { defval: null })
    setEntradas(filas.map(r => {
      const cara = r["Caravana"] ?? r["caravana"] ?? r["IDV"] ?? r["idv"] ?? Object.values(r)[0]
      const peso = r["Peso"] ?? r["peso"] ?? r["PESO"] ?? null
      return { original: String(cara ?? ""), peso: peso == null ? null : Number(peso) }
    }).filter(e => e.original.trim() !== ""))
  }

  /** ⚠️ Las caravanas y las cabezas tienen que coincidir: si no, uno de los dos está mal. */
  const desfase = entradas.length > 0 ? ok.length - nCab : 0

  const puedeConfirmar =
    !!lote && nCab > 0 && nKg > 0 && nPrecio > 0 && !!fechaVenta
    && duplicadas.length === 0 && yaVendidas.length === 0 && desfase === 0
    && !guardando

  const confirmar = async () => {
    if (!lote) return
    setGuardando(true)
    try {
      const p = supabase.schema("productivo")

      // 1 · La venta comercial. De acá sale a Cash Flow por `ventas_unificadas`.
      const { data: venta, error: e1 } = await p.from("stock_ventas").insert({
        lote_id: lote.id,
        fecha_venta: fechaVenta,
        cantidad: nCab,
        peso_kg: nCab > 0 ? nKg / nCab : 0,
        kg_totales: nKg,
        precio_kg: nPrecio,
        monto_neto: cuenta.neto,
        pct_desbaste: lote.pctDesbaste,
        pct_cz: nCz,
        flete: nFlete || null,
        plazo_cobro: plazo || null,
        destino_id: comercial.destinoId || null,
        intermediario_id: comercial.intermediarioId || null,
        cliente_nombre: cliente || null,
        empresa: lote.empresa,
        notas: `Confirmada desde Ingresos → Ganadería. ${ok.length} caravanas adjudicadas.`,
      }).select("id").single()
      if (e1 || !venta) { alert("Error al registrar la venta: " + (e1?.message ?? "")); return }

      // 2 · El movimiento de stock. Se GENERA desde la venta: si se cargara a mano habría dos
      //     fuentes de verdad sobre la misma salida de animales.
      const { error: e2 } = await p.from("movimientos_hacienda").insert({
        fecha: fechaVenta,
        categoria_id: categoriaId,
        tipo: "venta",
        cantidad: nCab,
        peso_total_kg: nKg,
        precio_por_kg: nPrecio,
        monto_total: cuenta.neto,
        proveedor_cliente: cliente || null,
        stock_venta_id: venta.id,
        observaciones: `Venta confirmada · ${ok.length} caravanas`,
      })
      if (e2) alert("La venta se registró pero falló el movimiento de stock: " + e2.message)

      // 3 · Las caravanas. Esto es lo que hace que el segmentador deje de contarlas.
      if (ok.length > 0) {
        const { error: e3 } = await p.from("terneros").update({
          activo: false, fecha_baja: fechaVenta, motivo_baja: "venta",
          stock_venta_id: venta.id,
        }).in("id", ok.map(m => m.ternero!.id))
        if (e3) alert("La venta se registró pero falló la baja de los animales: " + e3.message)
      }

      onConfirmado()
      onCerrar()
    } finally { setGuardando(false) }
  }

  if (!lote) return null
  const inp = "h-7 rounded border px-1 text-right text-[11px]"

  return (
    <Dialog open onOpenChange={o => { if (!o && !guardando) onCerrar() }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Confirmar venta — {lote.categoria}
            <Badge variant="outline" className="text-[10px]">{Math.round(lote.cabezas)} cab presupuestadas</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900">
            Un solo paso: al confirmar se registra la venta, <strong>baja el stock</strong> en
            Productivo y la venta queda firme en <strong>Presupuesto y Cash Flow</strong> con su
            fecha de cobro. La liquidación se vincula después, cuando llegue.
          </p>

          {/* ── Los datos reales ───────────────────────────────────────────── */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo label="Fecha de venta">
              <input type="date" className="h-7 rounded border px-1 text-[11px]"
                value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} />
            </Campo>
            <Campo label="Cabezas">
              <input type="text" className={`${inp} w-20`} value={cabezas}
                onChange={e => setCabezas(e.target.value)} />
            </Campo>
            <Campo label="Kg totales" ayuda="De la pesada de venta (grupal)">
              <input type="text" className={`${inp} w-28`} value={kgTotales}
                onChange={e => setKgTotales(e.target.value)} />
            </Campo>
            <Campo label="$/kg">
              <input type="text" className={`${inp} w-24`} value={precioKg}
                onChange={e => setPrecioKg(e.target.value)} />
            </Campo>
            <Campo label="CZ %">
              <input type="text" className={`${inp} w-16`} value={pctCz}
                onChange={e => setPctCz(e.target.value)} />
            </Campo>
            <Campo label="Flete $" ayuda="Monto, no %">
              <input type="text" className={`${inp} w-24`} value={flete}
                onChange={e => setFlete(e.target.value)} />
            </Campo>
            <Campo label="Plazo de cobro">
              <input type="text" className="h-7 w-28 rounded border px-1 text-[11px]"
                value={plazo} placeholder="30/60/90" onChange={e => setPlazo(e.target.value)} />
            </Campo>
            <Campo label="Cliente">
              <input type="text" className="h-7 w-full rounded border px-1 text-[11px]"
                value={cliente} onChange={e => setCliente(e.target.value)} />
            </Campo>
          </div>

          {/* El destino trae la CZ y el flete desde las normas. */}
          {lote.esGordo && (
            <SelectorComercializacion
              normas={normas} tipo="gordo" sexo={null} seleccion={comercial}
              lote={{ cabezas: nCab, pesoVivo: nCab > 0 ? nKg / nCab : 0, precioVenta: nPrecio }}
              onCambio={setComercial}
              onCalculado={v => {
                if (v.czPct != null) setPctCz(fmtNumeroAR(v.czPct * 100, 2))
              }}
            />
          )}

          {/* ── La cuenta ──────────────────────────────────────────────────── */}
          <div className="rounded border bg-slate-50 px-2 py-1.5 text-[11px]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Bruto <strong>{pesos(cuenta.bruto)}</strong></span>
              <span className="text-red-600">− CZ {pesos(cuenta.cz)}</span>
              {cuenta.flete > 0 && <span className="text-red-600">− flete {pesos(cuenta.flete)}</span>}
              <span className="text-emerald-800">INGRESA <strong>{pesos(cuenta.neto)}</strong></span>
            </div>
            {ganancia && (
              <p className="mt-1 text-[10px] text-gray-500">
                Peso de venta <strong>{ganancia.pesoVenta.toFixed(1)} kg</strong> ·
                ganancia real del grupo desde la pesada del{" "}
                {pesadas!.fecha.split("-").reverse().join("/")}:{" "}
                <strong>{ganancia.kgPorDia.toFixed(3)} kg/día</strong> en {ganancia.dias} días.
                <span className="ml-1 text-gray-400">
                  Es del grupo — los kg no se reparten entre los animales.
                </span>
              </p>
            )}
          </div>

          {/* ── Las caravanas ──────────────────────────────────────────────── */}
          <div className="rounded border px-2 py-1.5">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">
              Caravanas que se van
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1 rounded border bg-white px-2 py-1 text-[11px] hover:bg-gray-50">
                <Upload className="h-3 w-3" /> Subir Excel
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) leerExcel(f); e.target.value = "" }} />
              </label>
              <span className="text-[10px] text-gray-400">o pegá el listado abajo</span>
            </div>
            <textarea
              className="mt-1 h-20 w-full rounded border px-1 py-1 font-mono text-[10px]"
              placeholder={"Pegá una caravana por línea (opcional: caravana <tab> peso)"}
              value={pegado}
              onChange={e => { setPegado(e.target.value); setEntradas(parsearPegado(e.target.value)) }} />

            {entradas.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <Badge variant="outline" className="border-green-300 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {ok.length} encontradas
                </Badge>
                {noEncontradas.length > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700">
                    {noEncontradas.length} sin encontrar
                  </Badge>
                )}
                {duplicadas.length > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {duplicadas.length} duplicadas
                  </Badge>
                )}
                {yaVendidas.length > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {yaVendidas.length} ya dadas de baja
                  </Badge>
                )}
              </div>
            )}

            {/* Una caravana que ya se fue no es un típeo: es una doble venta. */}
            {yaVendidas.length > 0 && (
              <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-800">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Hay animales <strong>ya dados de baja</strong>: {yaVendidas.map(m => m.original).join(", ")}.
                Venderlos otra vez no es un error de tipeo — revisá el listado.
              </p>
            )}
            {duplicadas.length > 0 && (
              <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-800">
                Estas caravanas matchean con más de un animal:{" "}
                {duplicadas.map(m => m.original).join(", ")}. Hay que resolverlo antes de confirmar.
              </p>
            )}
            {noEncontradas.length > 0 && (
              <p className="mt-1 text-[10px] text-amber-700">
                Sin encontrar: {noEncontradas.map(m => m.original).join(", ")}.
                <strong> No se dan de baja</strong>, pero la venta sí se registra por las cabezas
                que pusiste arriba.
              </p>
            )}
            {desfase !== 0 && entradas.length > 0 && (
              <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                <strong>{ok.length} caravanas contra {nCab} cabezas.</strong> Uno de los dos está
                mal: si vendés {nCab} tienen que ser {nCab} caravanas.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800"
            disabled={!puedeConfirmar} onClick={confirmar}>
            {guardando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Confirmar venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Campo({ label, ayuda, children }: {
  label: string; ayuda?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500" title={ayuda}>{label}</label>
      <div className="mt-0.5">{children}</div>
      {ayuda && <p className="text-[9px] text-gray-400">{ayuda}</p>}
    </div>
  )
}
