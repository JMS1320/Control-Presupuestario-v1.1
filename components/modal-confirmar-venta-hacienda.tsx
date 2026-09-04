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
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
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

/**
 * La ficha productiva de un animal, para revisarla ANTES de confirmar.
 *
 * Lo pidió el usuario (2026-08-05): *"que me haga un preview de las cabezas con sus datos
 * productivos… eso me dará la certeza de que no haya error antes de confirmar"*. Y tiene un
 * efecto que va más allá de mirar: **cruza dos números que hoy nadie compara** — el peso promedio
 * de las últimas pesadas individuales contra los kg totales tipeados de la balanza.
 */
interface FichaAnimal {
  id: string
  caravana: string
  sexo: string | null
  pelo: string | null
  categoria: string | null
  primera: { fecha: string; peso: number } | null
  ultima: { fecha: string; peso: number } | null
}

/**
 * Una venta YA confirmada, para corregirle las condiciones.
 *
 * ⚠️ **Sólo se editan las condiciones COMERCIALES** —desbaste, CZ, flete, precio, plazo, cliente,
 * notas—, que no tocan el stock. Las **cabezas y las caravanas NO**: cambiarlas exigiría revertir
 * la baja de los animales y rehacer el movimiento de hacienda, y hacerlo a medias dejaría el stock
 * mintiendo. Para eso hay que anular la venta y rehacerla — todavía no está.
 */
export interface VentaAEditar {
  id: string
  categoria: string
  cabezas: number
  kgTotales: number
  precioKg: number
  pctDesbaste: number
  pctCz: number
  flete: number | null
  plazoCobro: string | null
  fechaVenta: string
  clienteNombre: string | null
  notas: string | null
}

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

export function ModalConfirmarVentaHacienda({ lote, editar, onCerrar, onConfirmado }: {
  lote: LoteAConfirmar | null
  /** Cuando viene, el modal edita esa venta en vez de crear una nueva. */
  editar?: VentaAEditar | null
  onCerrar: () => void
  onConfirmado: () => void
}) {
  const modoEdicion = !!editar
  const normas = useNormasComercializacion()
  const [guardando, setGuardando] = useState(false)
  const [terneros, setTerneros] = useState<TerneroRef[]>([])
  const [pesadas, setPesadas] = useState<{ fecha: string; prom: number } | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  /** Ficha productiva de cada animal, para el preview previo a confirmar. */
  const [fichas, setFichas] = useState<Record<string, FichaAnimal>>({})

  // Datos reales de la venta
  const [fechaVenta, setFechaVenta] = useState("")
  const [cabezas, setCabezas] = useState("")
  const [kgTotales, setKgTotales] = useState("")
  const [precioKg, setPrecioKg] = useState("")
  const [pctCz, setPctCz] = useState("")
  const [pctDesbaste, setPctDesbaste] = useState("")
  const [flete, setFlete] = useState("")
  const [plazo, setPlazo] = useState("")
  const [cliente, setCliente] = useState("")
  const [clienteCuit, setClienteCuit] = useState("")
  const [notas, setNotas] = useState("")
  const [comercial, setComercial] = useState<SeleccionComercial>({
    destinoId: "", intermediarioId: "", rutaId: "", categoria: "", vehiculo: "", precioRes: "",
  })

  // Caravanas
  const [pegado, setPegado] = useState("")
  const [entradas, setEntradas] = useState<{ original: string; peso?: number | null }[]>([])

  useEffect(() => {
    // Editando: se abre con lo que se guardó, no con la proyección.
    if (editar) {
      setFechaVenta(editar.fechaVenta)
      setCabezas(String(Math.round(editar.cabezas)))
      setKgTotales(fmtNumeroAR(editar.kgTotales, 0))
      setPrecioKg(fmtNumeroAR(editar.precioKg, 0))
      setPctCz(fmtNumeroAR(editar.pctCz * 100, 2))
      setPctDesbaste(fmtNumeroAR(editar.pctDesbaste * 100, 2))
      setFlete(editar.flete ? fmtNumeroAR(editar.flete, 0) : "")
      setPlazo(editar.plazoCobro ?? "")
      setCliente(editar.clienteNombre ?? "")
      setClienteCuit((editar as any).clienteCuit ?? "")
      setNotas(editar.notas ?? "")
      setPegado(""); setEntradas([])
      return
    }
    if (!lote) return
    setFechaVenta(lote.fechaVentaEstimada ?? new Date().toISOString().slice(0, 10))
    setCabezas(String(Math.round(lote.cabezas)))
    setKgTotales(fmtNumeroAR(lote.cabezas * lote.pesoProyectado, 0))
    setPrecioKg(lote.precioProyectado > 0 ? fmtNumeroAR(lote.precioProyectado, 0) : "")
    setPctCz(fmtNumeroAR(lote.pctCz * 100, 2))
    // ⚠️ El desbaste se PRECARGA pero se muestra editable. Antes ni siquiera se pedía: se usaba
    // el del lote en silencio. El usuario lo marcó — *"me lo debería pedir por las dudas"*—, y
    // tiene razón: es lo que decide sobre cuántos kilos se cobra.
    setPctDesbaste(fmtNumeroAR(lote.pctDesbaste * 100, 2))
    setFlete(""); setCliente(""); setNotas(""); setPegado(""); setEntradas([])
  }, [lote?.id, editar?.id])

  const cargar = useCallback(async () => {
    if (!lote) return
    const p = supabase.schema("productivo")
    const [{ data: ts }, { data: ps }, { data: cats }] = await Promise.all([
      p.from("terneros")
        .select("id, caravana_oficial, caravana_interna, sexo, pelo, activo, categoria_id"),
      p.from("pesadas_terneros").select("ternero_id, fecha, peso_kg"),
      p.from("categorias_hacienda").select("id, nombre"),
    ])
    setTerneros((ts || []) as TerneroRef[])
    const catPorId = new Map(((cats || []) as any[]).map(c => [c.id, String(c.nombre)]))
    setCategoriaId(((cats || []) as any[]).find(c => c.nombre === lote.categoria)?.id ?? null)

    // Primera y última pesada de cada animal: es la ficha que se revisa antes de confirmar.
    const porAnimal: Record<string, { fecha: string; peso: number }[]> = {}
    for (const r of ((ps || []) as any[])) {
      if (!r.ternero_id) continue
      ;(porAnimal[r.ternero_id] ||= []).push({ fecha: r.fecha, peso: Number(r.peso_kg) })
    }
    const fs: Record<string, FichaAnimal> = {}
    for (const t of ((ts || []) as any[])) {
      const ps2 = (porAnimal[t.id] ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha))
      fs[t.id] = {
        id: t.id,
        caravana: t.caravana_oficial || t.caravana_interna || "—",
        sexo: t.sexo, pelo: t.pelo,
        categoria: t.categoria_id ? catPorId.get(t.categoria_id) ?? null : null,
        primera: ps2[0] ?? null,
        ultima: ps2[ps2.length - 1] ?? null,
      }
    }
    setFichas(fs)

    // La última pesada del rodeo, para la ganancia real del grupo.
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
  const nDesb = parseNumeroAR(pctDesbaste) / 100
  const nFlete = parseNumeroAR(flete)

  // ── Los kg sobre los que se COBRA ──────────────────────────────────────────
  // Los kg de balanza son brutos; el desbaste es la merma que descuenta el comprador. El precio
  // se aplica sobre los NETOS, así que ése es el número que hay que ver antes de confirmar —
  // antes se calculaba sobre los brutos y la venta salía ~3 % más alta.
  const kgNetos = nKg * (1 - nDesb)
  const cuenta = netoDeVenta(kgNetos, nPrecio, nCz, nFlete)
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

  // ── El preview de la tropa elegida ─────────────────────────────────────────
  //
  // El promedio se calcula sobre las ÚLTIMAS pesadas individuales de los animales elegidos —no
  // sobre el promedio general del rodeo—, así que es el peso de *esta* tropa. Comparado con los
  // kg de balanza que se tipean arriba, delata el error antes de confirmar: si el promedio de
  // balanza queda por debajo del de la pesada, o los animales adelgazaron o la tropa no es ésta.
  const tropa = useMemo(() => {
    const fs = ok.map(m => fichas[m.ternero!.id]).filter(Boolean) as FichaAnimal[]
    const conPeso = fs.filter(f => f.ultima)
    if (conPeso.length === 0) return null
    const brutoProm = conPeso.reduce((s, f) => s + f.ultima!.peso, 0) / conPeso.length
    return {
      fichas: fs,
      conPeso: conPeso.length,
      sinPeso: fs.length - conPeso.length,
      brutoProm,
      netoProm: brutoProm * (1 - nDesb),
      fechaUltima: conPeso.map(f => f.ultima!.fecha).sort().slice(-1)[0]!,
    }
  }, [ok, fichas, nDesb])

  /** El peso promedio que sale de la balanza de venta, para contrastar con la pesada. */
  const promBalanza = nCab > 0 && nKg > 0 ? nKg / nCab : null

  const puedeConfirmar = modoEdicion
    ? (nKg > 0 && nPrecio > 0 && !!fechaVenta && !guardando)
    : (!!lote && nCab > 0 && nKg > 0 && nPrecio > 0 && !!fechaVenta
       && duplicadas.length === 0 && yaVendidas.length === 0 && desfase === 0
       && !guardando)

  /** Corrige las condiciones comerciales. NO toca cabezas, caravanas ni stock. */
  const guardarEdicion = async () => {
    if (!editar) return
    setGuardando(true)
    try {
      const p = supabase.schema("productivo")
      const { error } = await p.from("stock_ventas").update({
        fecha_venta: fechaVenta,
        kg_totales: nKg,
        peso_kg: editar.cabezas > 0 ? nKg / editar.cabezas : 0,
        precio_kg: nPrecio,
        monto_neto: cuenta.neto,
        pct_desbaste: nDesb,
        pct_cz: nCz,
        flete: nFlete || null,
        plazo_cobro: plazo || null,
        cliente_nombre: cliente || null,
        cliente_cuit: clienteCuit || null,
        notas: notas || null,
      }).eq("id", editar.id)
      if (error) { alert("Error al guardar: " + error.message); return }

      // El movimiento de stock refleja el monto: si la venta cambia, tiene que cambiar con ella.
      await p.from("movimientos_hacienda").update({
        fecha: fechaVenta, peso_total_kg: nKg,
        precio_por_kg: nPrecio, monto_total: cuenta.neto,
        proveedor_cliente: cliente || null,
      }).eq("stock_venta_id", editar.id)

      onConfirmado(); onCerrar()
    } finally { setGuardando(false) }
  }

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
        pct_desbaste: nDesb,
        pct_cz: nCz,
        flete: nFlete || null,
        plazo_cobro: plazo || null,
        destino_id: comercial.destinoId || null,
        intermediario_id: comercial.intermediarioId || null,
        cliente_nombre: cliente || null,
        cliente_cuit: clienteCuit || null,
        empresa: lote.empresa,
        notas: [
          notas.trim(),
          `Confirmada desde Ingresos → Ganadería · ${ok.length} caravanas adjudicadas.`,
        ].filter(Boolean).join(" — "),
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

  if (!lote && !editar) return null
  const inp = "h-7 rounded border px-1 text-right text-[11px]"
  const titulo = editar ? editar.categoria : lote!.categoria
  const cabTitulo = editar ? editar.cabezas : lote!.cabezas

  return (
    <Dialog open onOpenChange={o => { if (!o && !guardando) onCerrar() }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {modoEdicion ? "Editar venta" : "Confirmar venta"} — {titulo}
            <Badge variant="outline" className="text-[10px]">
              {Math.round(cabTitulo)} cab {modoEdicion ? "vendidas" : "presupuestadas"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {modoEdicion ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
              Se corrigen las <strong>condiciones comerciales</strong>: desbaste, CZ, flete,
              precio, plazo, cliente y notas. <strong>Las cabezas y las caravanas no se tocan</strong> —
              cambiarlas exigiría revertir la baja de los animales, y hacerlo a medias dejaría el
              stock mintiendo.
            </p>
          ) : (
            <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900">
              Un solo paso: al confirmar se registra la venta, <strong>baja el stock</strong> en
              Productivo y la venta queda firme en <strong>Presupuesto y Cash Flow</strong> con su
              fecha de cobro. La liquidación se vincula después, cuando llegue.
            </p>
          )}

          {/* ── Los datos reales ───────────────────────────────────────────── */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo label="Fecha de venta">
              <input type="date" className="h-7 rounded border px-1 text-[11px]"
                value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} />
            </Campo>
            <Campo label="Cabezas" ayuda={modoEdicion ? "No se edita: ya bajó el stock" : undefined}>
              <input type="text" className={`${inp} w-20 ${modoEdicion ? "bg-gray-100 text-gray-500" : ""}`}
                value={cabezas} disabled={modoEdicion}
                onChange={e => setCabezas(e.target.value)} />
            </Campo>
            <Campo label="Kg totales" ayuda="De la pesada de venta (grupal)">
              <input type="text" className={`${inp} w-28`} value={kgTotales}
                onChange={e => setKgTotales(e.target.value)} />
            </Campo>
            <Campo label="Desbaste %" ayuda="La merma que descuenta el comprador">
              <input type="text" className={`${inp} w-16`} value={pctDesbaste}
                onChange={e => setPctDesbaste(e.target.value)} />
            </Campo>
            <Campo label="$/kg" ayuda="Sobre los kg NETOS">
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
            {/*
              El cliente sale del MAESTRO, no de un campo de texto — 2026-09-04.
              Escribirlo a mano dejaba `cliente_cuit` vacío, y **sin CUIT no hay match posible con
              la factura**: el circuito se cortaba justo ahí. Además lo pide la § Contrapartes de
              CLAUDE.md. El combobox permite crear el cliente si no existe.
            */}
            <div className="col-span-2">
              <ProveedorCombobox
                label="Cliente"
                value={{ cuit: clienteCuit, nombre: cliente }}
                onChange={sel => { setCliente(sel.nombre); setClienteCuit(sel.cuit) }}
              />
            </div>
          </div>

          {/* Siempre tiene que haber dónde escribir: lo que no entra en un campo es justo lo que
              después nadie recuerda. */}
          <div>
            <label className="text-[10px] text-gray-500">Notas</label>
            <textarea className="mt-0.5 h-12 w-full rounded border px-1 py-1 text-[11px]"
              value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Lo que haga falta recordar de esta venta: condiciones, quién la cerró, algo raro…" />
          </div>

          {/* El destino trae la CZ y el flete desde las normas. */}
          {!modoEdicion && lote!.esGordo && (
            <SelectorComercializacion
              normas={normas} tipo="gordo" sexo={null} seleccion={comercial}
              lote={{ cabezas: nCab, pesoVivo: nCab > 0 ? nKg / nCab : 0, precioVenta: nPrecio }}
              onCambio={setComercial}
              onCalculado={v => {
                if (v.czPct != null) setPctCz(fmtNumeroAR(v.czPct * 100, 2))
              }}
            />
          )}

          {/* ── La cuenta, con los KG NETOS a la vista ─────────────────────── */}
          <div className="rounded border bg-slate-50 px-2 py-1.5 text-[11px]">
            {/* Es el número sobre el que se cobra, y hasta ahora no se veía. */}
            <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-1">
              <span className="text-gray-600">
                Brutos <strong className="text-gray-800">{fmtNumeroAR(nKg, 0)} kg</strong>
                {nCab > 0 && (
                  <span className="ml-1 text-[10px] text-gray-400">
                    ({(nKg / nCab).toFixed(1)} /cab)
                  </span>
                )}
              </span>
              <span className="text-amber-700">
                − desbaste {fmtNumeroAR(nDesb * 100, 2)} % = {fmtNumeroAR(nKg - kgNetos, 0)} kg
              </span>
              <span className="text-gray-800">
                <strong>NETOS {fmtNumeroAR(kgNetos, 0)} kg</strong>
                {nCab > 0 && (
                  <span className="ml-1 text-[10px] text-gray-500">
                    ({(kgNetos / nCab).toFixed(1)} /cab)
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Bruto <strong>{pesos(cuenta.bruto)}</strong>
                <span className="ml-1 text-[10px] text-gray-400">netos × $/kg</span>
              </span>
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
          {!modoEdicion && (
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
          )}

          {/* ── PREVIEW: la tropa que se va, animal por animal ────────────────
              Antes de confirmar hay que poder mirar qué son. El promedio sale de las últimas
              pesadas de ESTOS animales, no del rodeo entero, así que es el peso de esta tropa. */}
          {tropa && (
            <div className="rounded border px-2 py-1.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  La tropa que se va — {tropa.fichas.length} animales
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="text-gray-600">
                    Promedio bruto <strong className="text-gray-800">{tropa.brutoProm.toFixed(1)} kg</strong>
                    <span className="ml-1 text-[9px] text-gray-400">
                      (última pesada {tropa.fechaUltima.split("-").reverse().join("/")})
                    </span>
                  </span>
                  <span className="text-gray-600">
                    Neto −{(nDesb * 100).toFixed(0)} %{" "}
                    <strong className="text-gray-800">{tropa.netoProm.toFixed(1)} kg</strong>
                  </span>
                </div>
              </div>

              {/* El cruce que da la certeza: balanza de venta contra última pesada. */}
              {promBalanza != null && (
                <p className={`mb-1 rounded px-2 py-1 text-[10px] ${
                  promBalanza < tropa.brutoProm
                    ? "border border-amber-300 bg-amber-50 text-amber-900"
                    : "bg-slate-50 text-gray-600"}`}>
                  Balanza de venta: <strong>{promBalanza.toFixed(1)} kg</strong> por cabeza ·
                  última pesada: <strong>{tropa.brutoProm.toFixed(1)} kg</strong> ·
                  diferencia <strong>{(promBalanza - tropa.brutoProm).toFixed(1)} kg</strong>
                  {promBalanza < tropa.brutoProm && (
                    <> — <strong>la venta pesa MENOS que la última pesada.</strong> O los animales
                    perdieron peso, o la tropa elegida no es ésta.</>
                  )}
                </p>
              )}

              {tropa.sinPeso > 0 && (
                <p className="mb-1 text-[10px] text-amber-700">
                  ⚠️ {tropa.sinPeso} sin ninguna pesada: no entran en el promedio.
                </p>
              )}

              <div className="max-h-48 overflow-auto rounded border">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b text-[9px] uppercase text-gray-500">
                      <th className="px-2 py-1 text-left font-medium">Caravana</th>
                      <th className="px-2 py-1 text-left font-medium">Qué es</th>
                      <th className="px-2 py-1 text-center font-medium">Sexo</th>
                      <th className="px-2 py-1 text-left font-medium">Pelo</th>
                      <th className="px-2 py-1 text-right font-medium">1ª pesada</th>
                      <th className="px-2 py-1 text-right font-medium">Última</th>
                      <th className="px-2 py-1 text-right font-medium">Ganó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tropa.fichas.map(f => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="px-2 py-0.5 font-mono text-gray-700">{f.caravana}</td>
                        <td className="px-2 py-0.5 text-gray-600">{f.categoria ?? "—"}</td>
                        <td className="px-2 py-0.5 text-center">
                          {f.sexo === "Macho" ? "♂" : f.sexo === "Hembra" ? "♀" : "—"}
                        </td>
                        <td className="px-2 py-0.5 text-gray-500">{f.pelo ?? "—"}</td>
                        <td className="px-2 py-0.5 text-right text-gray-500">
                          {f.primera
                            ? `${f.primera.peso.toFixed(0)} kg`
                            : <span className="text-amber-600">sin pesada</span>}
                          {f.primera && (
                            <span className="ml-1 text-[8px] text-gray-400">
                              {f.primera.fecha.slice(5).split("-").reverse().join("/")}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-right font-medium text-gray-800">
                          {f.ultima ? `${f.ultima.peso.toFixed(0)} kg` : "—"}
                        </td>
                        <td className="px-2 py-0.5 text-right text-emerald-700">
                          {f.primera && f.ultima && f.primera.fecha !== f.ultima.fecha
                            ? `+${(f.ultima.peso - f.primera.peso).toFixed(0)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800"
            disabled={!puedeConfirmar} onClick={modoEdicion ? guardarEdicion : confirmar}>
            {guardando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {modoEdicion ? "Guardar cambios" : "Confirmar venta"}
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
