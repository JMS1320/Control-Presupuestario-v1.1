"use client"

/**
 * 📄 Cargar el ROMANEO de una carga — A-FEAT-94.
 *
 * ## Qué hace
 * Subís el PDF del frigorífico y la pantalla te muestra **cómo queda frente a los datos de la app**,
 * con todo editable, antes de tocar nada. Vos le das OK a lo que leyó, o lo corregís.
 *
 * ## Las tres cosas que la hacen confiable
 *
 * **1 · El romaneo se controla contra sí mismo.** Trae sus propios totales impresos (cabezas, kilos
 * vivos, kilos gancho, rinde, total), así que lo sumado de las filas se compara contra lo que dice
 * el papel. Si no coinciden, se ve en rojo con los dos números.
 *
 * **2 · Nunca frena.** Aunque un control no cierre, los datos igual se proponen y se pueden editar.
 * *(Criterio del usuario: «si siempre toma los datos y me los propone y yo puedo editar, siempre
 * resultará ante fallas».)* Un importador que se planta deja sin herramienta justo el día que el
 * frigorífico cambia el formato.
 *
 * **3 · No pisa en silencio.** Antes de guardar se lista **qué valor de la venta va a cambiar y por
 * cuál**, con el valor viejo a la vista.
 *
 * Diseño y hallazgos del romaneo real → `MODULO_HACIENDA.md` § 19.
 */

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { parsearRomaneo, type RomaneoParseado } from "@/lib/ganaderia/parsear-romaneo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface VentaDeLaCarga {
  id: string
  cantidad: number | null
  kg_totales: number | null
  kg_carne: number | null
  monto_neto: number | null
  precio_kg: number | null
  categoria_nombre?: string | null
}

const m = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const kg = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`

interface CargaOpcion { id: string; fecha: string | null; cliente_nombre: string | null; peso_bruto: number | null; peso_tara: number | null }

export function ModalRomaneo({
  abierto, onCerrar, cargaId: cargaFija, onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  /** Si se abre desde una venta, la carga viene dada. Si no, se elige adentro. */
  cargaId?: string | null
  onGuardado?: () => void
}) {
  const [cargas, setCargas] = useState<CargaOpcion[]>([])
  const [cargaSel, setCargaSel] = useState<string>("")
  const cargaId = cargaFija ?? (cargaSel || null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [rom, setRom] = useState<RomaneoParseado | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ventas, setVentas] = useState<VentaDeLaCarga[]>([])
  /** tipo del romaneo (VA/TO) → id de la venta a la que se imputa. Propuesto, editable. */
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [cab, setCab] = useState<Record<string, string>>({})
  const [verDetalle, setVerDetalle] = useState(false)
  /** Vivo NUESTRO por grupo de precio. Vacío = usar el propuesto; escrito = «acá mando yo». */
  const [vivoReal, setVivoReal] = useState<Record<string, string>>({})

  const limpiar = () => { setRom(null); setArchivo(null); setMapa({}); setCab({}); setVerDetalle(false) }

  const cargarCargas = async () => {
    if (cargas.length) return
    const { data } = await supabase.schema("productivo").from("cargas")
      .select("id, fecha, cliente_nombre, peso_bruto, peso_tara")
      .order("fecha", { ascending: false }).limit(50)
    setCargas((data ?? []) as CargaOpcion[])
  }

  const subir = async (f: File) => {
    setLeyendo(true)
    setArchivo(f)
    try {
      const r = await parsearRomaneo(await f.arrayBuffer())
      setRom(r)
      setCab({
        frigorifico: r.cabecera.frigorifico ?? "", matricula: r.cabecera.matricula ?? "",
        cuit_frigorifico: r.cabecera.cuit_frigorifico ?? "", vendedor: r.cabecera.vendedor ?? "",
        tropa: r.cabecera.tropa ?? "", fecha_faena: r.cabecera.fecha_faena ?? "",
        guia: r.cabecera.guia ?? "", dta: r.cabecera.dta ?? "",
      })

      // Las ventas de esta carga, para poder comparar contra lo que ya está cargado.
      let vs: VentaDeLaCarga[] = []
      if (cargaId) {
        const { data } = await supabase.schema("productivo").from("stock_ventas")
          .select("id, cantidad, kg_totales, kg_carne, monto_neto, precio_kg, categoria_id")
          .eq("carga_id", cargaId)
        vs = (data ?? []) as VentaDeLaCarga[]
        if (vs.length) {
          const ids = [...new Set(vs.map(v => (v as { categoria_id?: string }).categoria_id).filter(Boolean))]
          if (ids.length) {
            const { data: cats } = await supabase.schema("productivo").from("categorias_hacienda")
              .select("id, nombre").in("id", ids as string[])
            const porId = new Map((cats ?? []).map(c => [c.id as string, c.nombre as string]))
            vs = vs.map(v => ({ ...v, categoria_nombre: porId.get((v as { categoria_id?: string }).categoria_id ?? "") ?? null }))
          }
        }
        setVentas(vs)
      }

      // Propuesta de imputación: se casa cada tipo del romaneo con la venta que tenga la MISMA
      // cantidad de cabezas. Es una propuesta — si hay dudas queda vacío y lo elige el usuario.
      const prop: Record<string, string> = {}
      for (const t of tiposDe(r)) {
        const cabezas = r.lineas.filter(l => l.tipo === t).reduce((s, l) => s + l.cabezas, 0)
        const cand = vs.filter(v => Number(v.cantidad) === cabezas)
        if (cand.length === 1) prop[t] = cand[0].id
      }
      setMapa(prop)
      if (r.avisos.length) toast.warning(`Leído con ${r.avisos.length} aviso(s) — revisá antes de confirmar`)
      else toast.success("Romaneo leído")
    } catch (e) {
      toast.error("No se pudo leer el PDF: " + (e as Error).message)
      setRom(null)
    } finally { setLeyendo(false) }
  }

  const tiposDe = (r: RomaneoParseado) => [...new Set(r.lineas.map(l => l.tipo))]

  /**
   * 🔑 **Los GRUPOS DE PRECIO** — A-FEAT-96, *«el dato más importante para nosotros»*.
   *
   * Un grupo es **un precio dentro de un tipo**. Textual del usuario: *«si vaca y toro tienen mismo
   * precio igual son 2 grupos diferentes; dentro de vaca habrá 2 o 3 precios distintos = 2 o 3
   * grupos distintos»*. Por eso la clave es `tipo|precio` y no la categoría: el precio lo pone la
   * clasificación del frigorífico (clase + dientes), que abre **una categoría nuestra en varias**.
   */
  const gruposPrecio = () => {
    const g = new Map<string, { tipo: string; precio: number; cabezas: number; kg_carne: number; importe: number; clases: string[] }>()
    for (const l of rom!.lineas) {
      const precio = l.precio_kg ?? 0
      const k = `${l.tipo}|${precio}`
      const a = g.get(k) ?? { tipo: l.tipo, precio, cabezas: 0, kg_carne: 0, importe: 0, clases: [] }
      a.cabezas += l.cabezas
      a.kg_carne += l.kg_faena
      a.importe += l.importe
      const et = `${l.clase}${l.dientes ?? ""}`
      if (!a.clases.includes(et)) a.clases.push(et)
      g.set(k, a)
    }
    return [...g.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => a.tipo.localeCompare(b.tipo) || b.precio - a.precio)
  }

  /**
   * El vivo NUESTRO de cada grupo, precargado en proporción al kilo de carne sobre **el total de
   * la venta imputada** — o sea, sobre la balanza del campo, no sobre la del papel.
   *
   * ⚠️ La columna *Vivo* del romaneo **no sirve para esto**: el frigorífico la reparte usando el
   * rinde global, y por eso los 9 grupos del romaneo del 04/09 dan **53,58 % todos**. Un rinde
   * calculado con ese número es circular — devuelve siempre el mismo, para cualquier grupo.
   */
  const vivoPropuesto = (g: { tipo: string; kg_carne: number }): number | null => {
    const venta = ventas.find(v => v.id === mapa[g.tipo])
    const totalTipo = rom!.lineas.filter(l => l.tipo === g.tipo).reduce((s, l) => s + l.kg_faena, 0)
    if (!venta?.kg_totales || !totalTipo) return null
    return Math.round(Number(venta.kg_totales) * (g.kg_carne / totalTipo))
  }
  const vivoDe = (g: { k: string; tipo: string; kg_carne: number }): number | null => {
    const escrito = vivoReal[g.k]
    if (escrito != null && escrito.trim() !== "") {
      const n = parseFloat(escrito.replace(/\./g, "").replace(",", "."))
      return isNaN(n) ? null : n
    }
    return vivoPropuesto(g)
  }

  const resumenPorTipo = (t: string) => {
    const ls = rom!.lineas.filter(l => l.tipo === t)
    return {
      cabezas: ls.reduce((s, l) => s + l.cabezas, 0),
      kg_carne: ls.reduce((s, l) => s + l.kg_faena, 0),
      kg_vivo: ls.reduce((s, l) => s + l.kg_vivo, 0),
      importe: ls.reduce((s, l) => s + l.importe, 0),
    }
  }

  const guardar = async () => {
    if (!rom) return
    setGuardando(true)
    try {
      const prod = supabase.schema("productivo")
      const { data: cabR, error: e1 } = await prod.from("romaneos").insert({
        carga_id: cargaId,
        frigorifico: cab.frigorifico || null, matricula: cab.matricula || null,
        cuit_frigorifico: cab.cuit_frigorifico || null, vendedor: cab.vendedor || null,
        consignatario: rom.cabecera.consignatario, origen_estab: rom.cabecera.origen_estab,
        tropa: cab.tropa || null, fecha_faena: cab.fecha_faena || null,
        guia: cab.guia || null, dta: cab.dta || null,
        cabezas_faenadas: rom.cabezas,
        kilos_vivos: rom.kilos_vivos, kilos_gancho: rom.kilos_gancho,
        rinde: rom.rinde, total_liquidado: rom.total,
        archivo_nombre: archivo?.name ?? null,
        origen: "pdf",
        // Se guarda el resultado de los controles TAL COMO SALIÓ del papel, aunque el usuario haya
        // corregido a mano: después hay que poder distinguir qué venía mal del PDF de qué puso él.
        controles: rom.controles,
        observaciones: rom.avisos.length ? rom.avisos.join(" · ") : null,
      }).select("id").single()
      if (e1) throw e1
      const romaneoId = (cabR as { id: string }).id

      if (rom.medias.length) {
        const { error } = await prod.from("romaneo_medias").insert(rom.medias.map(x => ({
          romaneo_id: romaneoId, garron: x.garron, tipo: x.tipo, clase: x.clase,
          dientes: x.dientes, contenido: x.contenido, peso_kg: x.peso_kg,
          precio_kg: x.precio_kg, orden: x.orden,
        })))
        if (error) throw error
      }
      if (rom.lineas.length) {
        // El vivo NUESTRO se decide por grupo de precio (A-FEAT-96) y se reparte entre las líneas
        // de ese grupo en proporción al kilo de carne, que es el único reparto que no inventa nada.
        const grupos = gruposPrecio()
        const { error } = await prod.from("romaneo_lineas").insert(rom.lineas.map(x => {
          const g = grupos.find(y => y.tipo === x.tipo && y.precio === (x.precio_kg ?? 0))
          const vivoG = g ? vivoDe(g) : null
          const parte = g && g.kg_carne > 0 && vivoG != null
            ? Math.round(vivoG * (x.kg_faena / g.kg_carne)) : null
          return {
            romaneo_id: romaneoId, cabezas: x.cabezas, tipo: x.tipo, clase: x.clase,
            dientes: x.dientes, contenido: x.contenido, kg_faena: x.kg_faena,
            // Se conservan LOS DOS: el que asigna el frigorífico (no es una pesada) y el nuestro.
            kg_vivo: x.kg_vivo,
            kg_vivo_real: parte,
            kg_vivo_real_origen: g && (vivoReal[g.k] ?? "").trim() !== "" ? "manual" : "proporcional",
            precio_kg: x.precio_kg, motivo: x.motivo, importe: x.importe,
            stock_venta_id: mapa[x.tipo] || null, orden: x.orden,
          }
        }))
        if (error) throw error
      }

      // Completar las ventas imputadas: el kilaje de carne es justo lo que faltaba para que el
      // importe se pueda calcular cuando el destino compra A LA RES (MODULO_HACIENDA § 18.3).
      let tocadas = 0
      for (const t of tiposDe(rom)) {
        const ventaId = mapa[t]
        if (!ventaId) continue
        const r = resumenPorTipo(t)
        const { error } = await prod.from("stock_ventas").update({
          kg_carne: r.kg_carne,
          monto_neto: r.importe,
          precio_kg: r.kg_carne > 0 ? Math.round((r.importe / r.kg_carne) * 100) / 100 : null,
        }).eq("id", ventaId)
        if (error) throw error
        tocadas++
      }

      toast.success(`Romaneo guardado${tocadas ? ` · ${tocadas} venta(s) completada(s)` : ""}`)
      onGuardado?.()
      limpiar()
      onCerrar()
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const campo = (k: string, etiqueta: string, ancho = "") => (
    <div className={ancho}>
      <Label className="text-[10px] text-gray-500">{etiqueta}</Label>
      <Input className="h-7 text-xs" value={cab[k] ?? ""}
        onChange={e => setCab(p => ({ ...p, [k]: e.target.value }))} />
    </div>
  )

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) { limpiar(); onCerrar() } }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>📄 Cargar el romaneo del frigorífico</DialogTitle>
        </DialogHeader>

        {!rom ? (
          <div className="space-y-3 py-6">
            {!cargaFija && (
              <div className="rounded border p-2">
                <Label className="text-[10px] text-gray-500">
                  ¿De qué carga es este romaneo? <span className="text-gray-400">— un camión, un romaneo, y adentro las ventas que llevó</span>
                </Label>
                <select className="mt-1 h-8 w-full rounded border px-2 text-xs" value={cargaSel}
                  onFocus={cargarCargas} onChange={e => setCargaSel(e.target.value)}>
                  <option value="">— elegir la carga —</option>
                  {cargas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fecha ?? "sin fecha"} · {c.cliente_nombre ?? "sin cliente"}
                      {c.peso_bruto != null && c.peso_tara != null ? ` · camión ${(c.peso_bruto - c.peso_tara).toLocaleString("es-AR")} kg` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="rounded border-2 border-dashed p-8 text-center">
              <p className="mb-3 text-sm text-gray-600">Subí el PDF del romaneo</p>
              <Input type="file" accept="application/pdf" disabled={leyendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }} />
              {leyendo && (
                <p className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Leyendo…
                </p>
              )}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Se leen la cabecera, la liquidación y el detalle por media res. <b>Todo queda editable</b>:
              lo que lea el PDF es una propuesta, no una decisión.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── CONTROLES ─────────────────────────────────────────────────────────── */}
            <div className="rounded border">
              <div className="border-b bg-gray-50 px-3 py-1.5 text-xs font-medium">
                🧮 Controles — lo sumado contra lo que dice el papel
              </div>
              <div className="grid grid-cols-2 gap-x-4 p-2 text-[11px]">
                {rom.controles.map((c, i) => (
                  <div key={i} className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${c.cierra ? "text-gray-600" : "bg-red-50 font-medium text-red-700"}`}>
                    <span>{c.cierra ? "✓" : "⚠"} {c.nombre}</span>
                    <span className="tabular-nums">
                      {c.cierra ? (c.calculado?.toLocaleString("es-AR") ?? "—")
                        : `papel ${c.impreso?.toLocaleString("es-AR") ?? "—"} · leído ${c.calculado.toLocaleString("es-AR")}`}
                    </span>
                  </div>
                ))}
              </div>
              {rom.avisos.length > 0 && (
                <div className="border-t bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                  {rom.avisos.map((a, i) => <div key={i}>⚠️ {a}</div>)}
                  <div className="mt-1 text-amber-700">
                    Podés guardar igual y corregir los valores a mano — nada se guarda sin que lo confirmes.
                  </div>
                </div>
              )}
            </div>

            {/* ── CABECERA (editable) ───────────────────────────────────────────────── */}
            <div className="rounded border p-2">
              <div className="mb-2 text-xs font-medium">Cabecera <span className="font-normal text-gray-400">— corregí lo que haga falta</span></div>
              <div className="grid grid-cols-4 gap-2">
                {campo("frigorifico", "Frigorífico", "col-span-2")}
                {campo("matricula", "Matrícula")}
                {campo("cuit_frigorifico", "CUIT")}
                {campo("vendedor", "Vendedor", "col-span-2")}
                {campo("tropa", "Tropa")}
                {campo("fecha_faena", "Faena")}
                {campo("guia", "Guía")}
                {campo("dta", "DTA")}
              </div>
            </div>

            {/* ── CONTRA LA APP ─────────────────────────────────────────────────────── */}
            <div className="rounded border">
              <div className="border-b bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900">
                Cómo queda contra lo que ya está cargado
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[10px] text-gray-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Grupo</th>
                    <th className="px-2 py-1 text-right">Cab</th>
                    <th className="px-2 py-1 text-right">kg carne</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                    <th className="px-2 py-1 text-left">Se imputa a la venta…</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposDe(rom).map(t => {
                    const r = resumenPorTipo(t)
                    const v = ventas.find(x => x.id === mapa[t])
                    return (
                      <tr key={t} className="border-t align-top">
                        <td className="px-2 py-1 font-medium">{t === "VA" ? "VA · vacas" : t === "TO" ? "TO · toros" : t}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.cabezas}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{kg(r.kg_carne)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{m(r.importe)}</td>
                        <td className="px-2 py-1">
                          <select className="h-6 w-full rounded border px-1 text-[11px]"
                            value={mapa[t] ?? ""}
                            onChange={e => setMapa(p => ({ ...p, [t]: e.target.value }))}>
                            <option value="">— no imputar —</option>
                            {ventas.map(v2 => (
                              <option key={v2.id} value={v2.id}>
                                {v2.categoria_nombre ?? "venta"} · {v2.cantidad ?? "?"} cab · {kg(v2.kg_totales)}
                              </option>
                            ))}
                          </select>
                          {v && (
                            <div className="mt-1 text-[10px] leading-4 text-gray-500">
                              kg carne: <b>{v.kg_carne == null ? "vacío" : kg(v.kg_carne)}</b> → {kg(r.kg_carne)}<br />
                              importe: <b>{v.monto_neto == null ? "vacío" : m(v.monto_neto)}</b> → {m(r.importe)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ventas.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-amber-700">
                  ⚠️ Esta carga no tiene ventas asociadas: el romaneo se guarda igual, pero no hay a qué imputarlo.
                </p>
              )}
            </div>

            {/* ── GRUPOS DE PRECIO — el rinde real ──────────────────────────────────── */}
            <div className="rounded border">
              <div className="border-b bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">
                Rinde por grupo de precio
                <span className="ml-2 font-normal text-emerald-700">un grupo = un precio dentro de un tipo</span>
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[10px] text-gray-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Grupo</th>
                    <th className="px-2 py-1 text-left">Clases</th>
                    <th className="px-2 py-1 text-right">Cab</th>
                    <th className="px-2 py-1 text-right">kg carne</th>
                    <th className="px-2 py-1 text-right">$/kg</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                    <th className="px-2 py-1 text-right">kg vivo <span className="font-normal">(nuestro)</span></th>
                    <th className="px-2 py-1 text-right">Rinde real</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposPrecio().map(g => {
                    const vivo = vivoDe(g)
                    const rinde = vivo && vivo > 0 ? (g.kg_carne / vivo) * 100 : null
                    const propio = (vivoReal[g.k] ?? "").trim() !== ""
                    return (
                      <tr key={g.k} className="border-t">
                        <td className="px-2 py-1 font-medium">{g.tipo} · {m(g.precio)}</td>
                        <td className="px-2 py-1 text-gray-500">{g.clases.join(", ")}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{g.cabezas}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{g.kg_carne.toLocaleString("es-AR")}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{m(g.precio)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{m(g.importe)}</td>
                        <td className="px-2 py-1 text-right">
                          <Input type="text" className={`h-6 w-24 text-right text-[11px] ${propio ? "font-medium" : "text-gray-500"}`}
                            placeholder={vivoPropuesto(g)?.toLocaleString("es-AR") ?? "—"}
                            value={vivoReal[g.k] ?? ""}
                            onChange={e => setVivoReal(p => ({ ...p, [g.k]: e.target.value }))} />
                        </td>
                        <td className={`px-2 py-1 text-right tabular-nums ${rinde == null ? "text-gray-400" : "font-medium"}`}>
                          {rinde == null ? "—" : `${rinde.toFixed(2).replace(".", ",")} %`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="border-t bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                ⚠️ <b>El vivo del romaneo no sirve para esto.</b> El frigorífico lo reparte entre los grupos
                usando el <b>rinde global</b>, así que calculado con ese número los {rom.lineas.length} grupos dan
                todos <b>{rom.rinde}&nbsp;%</b> — el rinde por grupo saldría siempre igual, para cualquier grupo.
                Por eso acá el vivo se precarga con <b>el kilaje de la venta</b> (la balanza del campo), repartido
                en proporción al kilo de carne. <b>Es una propuesta:</b> pisalo con lo que hayas pesado de verdad
                y el rinde se recalcula.
              </div>
            </div>

            {/* ── DETALLE (plegado) ─────────────────────────────────────────────────── */}
            <div className="rounded border">
              <button type="button" onClick={() => setVerDetalle(v => !v)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                <span>{verDetalle ? "▾" : "▸"} Detalle — {rom.lineas.length} línea(s) de liquidación · {rom.medias.length} media(s) res</span>
                <span className="font-normal text-gray-500">
                  {kg(rom.kilos_gancho)} carne · {kg(rom.kilos_vivos)} vivo · rinde {rom.rinde}%
                </span>
              </button>
              {verDetalle && (
                <div className="border-t p-2">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 text-[10px] text-gray-600">
                      <tr>
                        <th className="px-1 py-1 text-left">Cab</th><th className="px-1 text-left">Tipo</th>
                        <th className="px-1 text-left">Clase</th><th className="px-1 text-left">Dientes</th>
                        <th className="px-1 text-left">Cont.</th>
                        <th className="px-1 text-right">kg vivo</th><th className="px-1 text-right">kg carne</th>
                        <th className="px-1 text-right">$/kg</th><th className="px-1 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rom.lineas.map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-1 py-0.5">{l.cabezas}</td><td className="px-1">{l.tipo}</td>
                          <td className="px-1">{l.clase}</td><td className="px-1">{l.dientes ?? "—"}</td>
                          <td className="px-1">{l.contenido}</td>
                          <td className="px-1 text-right tabular-nums">{l.kg_vivo}</td>
                          <td className="px-1 text-right tabular-nums">{l.kg_faena}</td>
                          <td className="px-1 text-right tabular-nums">{m(l.precio_kg)}</td>
                          <td className="px-1 text-right tabular-nums">{m(l.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                    El <b>$/kg no se lee del papel</b>: sale de <code>importe ÷ kg</code>, que es exacto y no
                    depende de dónde imprima el precio el frigorífico. Los <b>dientes</b> mueven el precio
                    tanto como la clase.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={limpiar}>← Subir otro PDF</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { limpiar(); onCerrar() }}>Cancelar</Button>
                <Button onClick={guardar} disabled={guardando}>
                  {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Confirmar y completar las ventas
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
