"use client"

// PRODUCTIVO → Evolución del rodeo. Línea de tiempo del stock de cría.
// El rodeo rueda solo año a año: cada período abre con el cierre del anterior.
// Espacio de trabajo interactivo: todo se edita, y lo que se carga como REAL pisa el
// cálculo y recalcula todo lo posterior.
// De acá salen las cabezas vendibles → ventas proyectadas.
// Modelo: solapa "ciclo ganadero" del Excel. Ver PENDIENTES § CICLO GANADERO.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, TrendingUp, Info, RotateCcw, Wand2 } from "lucide-react"
import {
  calcularLineaTiempo, fechasCampania, etiquetaFechas, proponerDesdeCiclosCria,
  type CicloStock, type CicloCalculado, type FilaCicloCria, type PropuestaCiclo,
} from "@/lib/ganaderia/ciclo"

const parseNum = (v: string) => {
  const n = parseFloat(String(v).trim().replace(",", "."))
  return Number.isFinite(n) ? n : 0
}
/** % → fracción. El punto es DECIMAL acá (no es un monto es-AR). */
const parsePct = (v: string) => {
  const n = parseFloat(String(v).trim().replace(",", "."))
  return Number.isFinite(n) ? n / 100 : 0
}
const fmtPctTxt = (frac: number | null | undefined) =>
  frac == null ? "" : (Math.round(Number(frac) * 1e8) / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 4 })
const n0 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })
const n1 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })
const pct = (f: number) => `${(Number(f) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`

export function TabEvolucionRodeo() {
  const [cargando, setCargando] = useState(true)
  const [ciclos, setCiclos] = useState<CicloStock[]>([])
  const [cria, setCria] = useState<FilaCicloCria[]>([])
  const [modal, setModal] = useState<any>(null)
  const [modalPropuesta, setModalPropuesta] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data, error }, { data: cc, error: errCria }] = await Promise.all([
        supabase.schema("productivo")
          .from("stock_ciclos").select("*").eq("empresa", "MSA").order("orden"),
        supabase.schema("productivo").from("ciclos_cria")
          .select("anio_servicio, rodeo, cabezas_servicio, cabezas_prenadas, terneros_destetados, machos_destetados, hembras_destetados, kg_promedio, fecha_servicio, fecha_destete"),
      ])
      if (error) console.error("Error cargando ciclos:", error)
      if (errCria) console.error("Error cargando ciclos_cria:", errCria)
      setCiclos((data || []) as CicloStock[])
      setCria((cc || []) as FilaCicloCria[])
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const linea = calcularLineaTiempo(ciclos)

  const guardar = async (f: any) => {
    const payload = {
      empresa: "MSA",
      campania: f.campania,
      orden: Math.round(parseNum(String(f.orden))),
      // Las fechas proyectadas NO se guardan: se derivan de la campaña. Sólo persisten
      // las REALES, que hoy no se cargan desde acá (vendrán de ciclos_cria).
      fecha_servicio: f.fecha_servicio || null,
      fecha_destete: f.fecha_destete || null,
      // Vacío = hereda del cierre del período anterior
      vacas_apertura: String(f.vacas_apertura ?? "").trim() === "" ? null : parseNum(String(f.vacas_apertura)),
      vaquillonas_apertura: String(f.vaquillonas_apertura ?? "").trim() === "" ? null : parseNum(String(f.vaquillonas_apertura)),
      pct_destete: parsePct(String(f.pct_destete)),
      pct_machos: parsePct(String(f.pct_machos)),
      pct_descarte_falladas: parsePct(String(f.pct_descarte_falladas)),
      pct_reposicion: parsePct(String(f.pct_reposicion)),
      peso_destete_kg: parseNum(String(f.peso_destete_kg)),
      real_destetados: String(f.real_destetados ?? "").trim() === "" ? null : parseNum(String(f.real_destetados)),
      real_machos: String(f.real_machos ?? "").trim() === "" ? null : parseNum(String(f.real_machos)),
      real_hembras: String(f.real_hembras ?? "").trim() === "" ? null : parseNum(String(f.real_hembras)),
      real_descarte: String(f.real_descarte ?? "").trim() === "" ? null : parseNum(String(f.real_descarte)),
      notas: f.notas || null,
      updated_at: new Date().toISOString(),
    }
    if (!payload.campania) { alert("La campaña es obligatoria"); return }
    if (!fechasCampania(payload.campania)) {
      alert(`La campaña debe tener formato AA/BB (ej. 27/28). Recibí: "${payload.campania}"`)
      return
    }
    for (const [k, label] of [["pct_destete","% Destete"],["pct_machos","% Machos"],
      ["pct_descarte_falladas","% Descarte"],["pct_reposicion","% Reposición"]] as [string,string][]) {
      const v = (payload as any)[k]
      if (v < 0 || v > 1) { alert(`${label}: ${f[k]} no es un porcentaje válido (0 a 100)`); return }
    }
    const { error } = f.id
      ? await supabase.schema("productivo").from("stock_ciclos").update(payload).eq("id", f.id)
      : await supabase.schema("productivo").from("stock_ciclos").insert(payload)
    if (error) { alert("Error: " + error.message); return }
    setModal(null)
    await cargar()
  }

  const propuestas = proponerDesdeCiclosCria(cria)

  /**
   * Crea o actualiza los períodos desde los ciclos REALES de Productivo.
   * La apertura sale del rodeo A SERVICIO, y si el ciclo ya cerró se cargan los
   * destetados/machos/hembras como datos reales. Es idempotente: re-correrlo
   * actualiza en vez de duplicar — así se va autocorrigiendo con cada ciclo.
   */
  const aplicarPropuesta = async (seleccionadas: PropuestaCiclo[]) => {
    setAplicando(true)
    try {
      for (const [i, p] of seleccionadas.entries()) {
        const existente = ciclos.find(c => c.campania === p.campania)
        const base = {
          empresa: "MSA",
          campania: p.campania,
          orden: existente?.orden ?? (ciclos.length + i + 1),
          vacas_apertura: p.vacas,
          vaquillonas_apertura: p.vaquillonas,
          // Si el ciclo cerró, los reales pisan el cálculo
          real_destetados: p.destetados,
          real_machos: p.machos,
          real_hembras: p.hembras,
          fecha_servicio: p.fecha_servicio,
          fecha_destete: p.fecha_destete,
          notas: `Propuesto desde ciclos_cria (servicio ${p.anio_servicio}) — ${p.a_servicio} a servicio, ${p.prenadas} preñadas`,
          updated_at: new Date().toISOString(),
        }
        const { error } = existente
          ? await supabase.schema("productivo").from("stock_ciclos").update(base).eq("id", existente.id)
          : await supabase.schema("productivo").from("stock_ciclos").insert({
              ...base,
              // Defaults sólo al crear: si ya existe no le pisamos los parámetros editados
              pct_destete: p.pct_destete_real ?? 0.85,
              pct_machos: p.pct_machos_real ?? 0.50,
              pct_descarte_falladas: 0.50,
              pct_reposicion: 0.20,
              peso_destete_kg: p.kg_promedio ?? 200,
            })
        if (error) { alert(`Error en ${p.campania}: ${error.message}`); return }
      }
      setModalPropuesta(false)
      await cargar()
    } finally { setAplicando(false) }
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este período de la línea de tiempo?")) return
    await supabase.schema("productivo").from("stock_ciclos").delete().eq("id", id)
    await cargar()
  }

  const nuevo = () => {
    const ultimo = linea[linea.length - 1]
    const sigOrden = ciclos.length ? Math.max(...ciclos.map(c => c.orden)) + 1 : 1
    setModal({
      campania: "", orden: sigOrden,
      // El primero arranca con la foto de hoy; los siguientes heredan (apertura vacía)
      vacas_apertura: ciclos.length ? "" : "177",
      vaquillonas_apertura: ciclos.length ? "" : "27",
      pct_destete: ultimo ? fmtPctTxt(ultimo.ciclo.pct_destete) : "85",
      pct_machos: ultimo ? fmtPctTxt(ultimo.ciclo.pct_machos) : "50",
      pct_descarte_falladas: ultimo ? fmtPctTxt(ultimo.ciclo.pct_descarte_falladas) : "50",
      pct_reposicion: ultimo ? fmtPctTxt(ultimo.ciclo.pct_reposicion) : "20",
      peso_destete_kg: ultimo ? String(ultimo.ciclo.peso_destete_kg) : "200",
    })
  }

  const editar = (c: CicloStock) => setModal({
    ...c,
    vacas_apertura: c.vacas_apertura ?? "",
    vaquillonas_apertura: c.vaquillonas_apertura ?? "",
    pct_destete: fmtPctTxt(c.pct_destete),
    pct_machos: fmtPctTxt(c.pct_machos),
    pct_descarte_falladas: fmtPctTxt(c.pct_descarte_falladas),
    pct_reposicion: fmtPctTxt(c.pct_reposicion),
    peso_destete_kg: String(c.peso_destete_kg),
    real_destetados: c.real_destetados ?? "",
    real_machos: c.real_machos ?? "",
    real_hembras: c.real_hembras ?? "",
    real_descarte: c.real_descarte ?? "",
  })

  // Filas de la tabla: concepto + valor por período
  const filas: { label: string; get: (c: CicloCalculado) => string; clase?: string; sep?: boolean }[] = [
    { label: "Vacas",                 get: c => n1(c.vacas) },
    { label: "Vaquillonas de rep.",   get: c => n1(c.vaquillonas) },
    { label: "RODEO (a servicio)",    get: c => n1(c.rodeo), clase: "font-semibold bg-gray-50" },
    { label: "% Destete",             get: c => pct(c.ciclo.pct_destete), clase: "text-gray-500", sep: true },
    { label: "Destetados",            get: c => n1(c.destetados), clase: "font-medium" },
    { label: "→ Terneros",            get: c => n1(c.terneros), clase: "text-gray-600" },
    { label: "→ Terneras",            get: c => n1(c.terneras), clase: "text-gray-600" },
    { label: "Falladas (merma)",      get: c => n1(c.falladas), clase: "text-gray-500", sep: true },
    { label: "Vaca descarte → venta", get: c => n1(c.descarte), clase: "font-medium text-amber-700" },
    { label: "Terneras retenidas",    get: c => n1(c.retenidas), clase: "text-blue-700", sep: true },
    { label: "Terneros a venta",      get: c => n1(c.terneros_venta), clase: "font-medium text-emerald-700" },
    { label: "Terneras a venta",      get: c => n1(c.terneras_venta), clase: "font-medium text-emerald-700" },
    { label: "Vacas (cierre)",        get: c => n1(c.vacas_cierre), clase: "bg-gray-50", sep: true },
    { label: "Vaquillonas (cierre)",  get: c => n1(c.vaquillonas_cierre), clase: "bg-gray-50" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Evolución del rodeo</h3>
          <p className="text-sm text-gray-500">
            Cada período abre con el cierre del anterior. Editá lo que quieras: lo que cargues
            como <strong>real</strong> pisa el cálculo y recalcula todo lo posterior.
          </p>
        </div>
        <div className="flex gap-2">
          {propuestas.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setModalPropuesta(true)}>
              <Wand2 className="mr-1 h-4 w-4" /> Proponer desde Productivo
            </Button>
          )}
          <Button size="sm" onClick={nuevo}><Plus className="mr-1 h-4 w-4" /> Agregar período</Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>El ciclo:</strong> rodeo = vacas + vaquillonas · destete = rodeo × %destete
          (se parte según %machos) · falladas = lo que no destetó · <strong>descarte</strong> =
          falladas × %descarte (sale de vaca <em>y</em> vaquillona) · al cierre las vaquillonas
          <strong> paren y pasan a vaca</strong>, y las terneras retenidas son las vaquillonas del
          año que viene.
        </span>
      </p>

      {cargando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : linea.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          Todavía no hay períodos.
          {propuestas.length > 0
            ? " Usá «Proponer desde Productivo» para traer los ciclos reales que ya están cargados, y de ahí en adelante rueda solo."
            : " Agregá el primero con la foto del stock de hoy (vacas y vaquillonas preñadas)."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 min-w-[200px]">
                    Concepto
                  </th>
                  {linea.map(c => (
                    <th key={c.ciclo.id} className="px-3 py-2 text-right font-semibold text-gray-700 min-w-[110px]">
                      <div className="flex items-center justify-end gap-1">
                        {c.ciclo.campania}
                        {c.tiene_reales && <Badge variant="default" className="text-[9px] px-1">real</Badge>}
                        {c.apertura_manual && !c.tiene_reales && (
                          <span title="Apertura cargada a mano (no hereda del período anterior)">
                            <RotateCcw className="h-3 w-3 text-blue-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-normal text-gray-400 whitespace-nowrap">
                        {etiquetaFechas(c.ciclo.campania)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.label} className={`border-b ${f.sep ? "border-t-2 border-t-gray-200" : ""}`}>
                    <td className={`sticky left-0 z-10 bg-white px-4 py-1.5 text-xs text-gray-700 ${f.clase ?? ""}`}>
                      {f.label}
                    </td>
                    {linea.map(c => (
                      <td key={c.ciclo.id} className={`px-3 py-1.5 text-right text-xs ${f.clase ?? ""}`}>
                        {f.get(c)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2"></td>
                  {linea.map(c => (
                    <td key={c.ciclo.id} className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs"
                          onClick={() => editar(c.ciclo)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-6 px-1"
                          onClick={() => borrar(c.ciclo.id)}>
                          <Trash2 className="h-3 w-3 text-gray-400" />
                        </Button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {linea.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-gray-400">
          <TrendingUp className="h-3.5 w-3.5" />
          De <strong>Vaca descarte</strong>, <strong>Terneros a venta</strong> y{" "}
          <strong>Terneras a venta</strong> salen las cabezas vendibles de cada período.
        </p>
      )}

      <ModalCiclo datos={modal} onCerrar={() => setModal(null)} onGuardar={guardar} />
      <ModalPropuesta
        abierto={modalPropuesta}
        propuestas={propuestas}
        existentes={ciclos}
        aplicando={aplicando}
        onCerrar={() => setModalPropuesta(false)}
        onAplicar={aplicarPropuesta}
      />
    </div>
  )
}

// ── Modal de período ──────────────────────────────────────────────────────────

function ModalCiclo({ datos, onCerrar, onGuardar }: {
  datos: any; onCerrar: () => void; onGuardar: (f: any) => Promise<void>
}) {
  const [f, setF] = useState<any>({})
  useEffect(() => { if (datos) setF({ ...datos }) }, [datos])
  if (!datos) return null

  const campo = (k: string, label: string, ayuda?: string, tipo = "text") => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <Input type={tipo} className="h-8 text-right" value={f[k] ?? ""}
        onChange={e => setF({ ...f, [k]: e.target.value })} />
      {ayuda && <p className="mt-1 text-[10px] text-gray-400">{ayuda}</p>}
    </div>
  )

  /** Porcentaje: se escribe en %, se guarda como fracción, con eco en vivo. */
  const campoPct = (k: string, label: string, ayuda?: string) => {
    const crudo = String(f[k] ?? "")
    const frac = parsePct(crudo)
    const mal = crudo.trim() !== "" && (frac < 0 || frac > 1)
    const sospechoso = crudo.trim() !== "" && frac > 0 && frac < 0.001
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <div className="relative">
          <Input className={`h-8 pr-6 text-right ${mal || sospechoso ? "border-red-400 bg-red-50" : ""}`}
            value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: e.target.value })} />
          <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-gray-400">%</span>
        </div>
        <p className={`mt-1 text-[10px] ${mal || sospechoso ? "text-red-600" : "text-gray-400"}`}>
          {mal ? `${crudo} % no es válido`
            : sospechoso ? `¿Seguro? Se guardaría ${frac.toLocaleString("es-AR", { maximumFractionDigits: 6 })}`
            : `${ayuda ? ayuda + " · " : ""}se guarda ${frac.toLocaleString("es-AR", { maximumFractionDigits: 4 })}`}
        </p>
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{datos.id ? `Editar período ${datos.campania}` : "Nuevo período"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Campaña</label>
              <Input className="h-8" placeholder="27/28" value={f.campania || ""}
                onChange={e => setF({ ...f, campania: e.target.value })} />
            </div>
            {campo("orden", "Orden", "posición en la línea de tiempo")}
          </div>

          {/* Las fechas NO se piden: la campaña ya las determina. Se muestran para que
              se vea qué asume la app y se detecte una campaña mal escrita. */}
          <div className="rounded bg-gray-50 px-3 py-2 text-xs">
            {(() => {
              const fc = fechasCampania(String(f.campania ?? ""))
              if (!fc) return (
                <span className="text-gray-400">
                  Escribí la campaña como <strong>AA/BB</strong> (ej. 27/28) y acá vas a ver
                  el servicio, la parición y el destete que le corresponden.
                </span>
              )
              const mes = (s: string) =>
                new Date(s + "T00:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" })
              return (
                <span className="text-gray-600">
                  Servicio <strong>{mes(fc.servicio)}</strong> · parición{" "}
                  <strong>{mes(fc.paricion)}</strong> · destete <strong>{mes(fc.destete)}</strong>
                  <span className="ml-2 text-gray-400">(el servicio cae en la campaña anterior)</span>
                </span>
              )
            })()}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">Apertura del rodeo</p>
            <div className="grid grid-cols-2 gap-3">
              {campo("vacas_apertura", "Vacas", "vacío = hereda del período anterior")}
              {campo("vaquillonas_apertura", "Vaquillonas de reposición", "vacío = hereda")}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">Parámetros del período</p>
            <div className="grid grid-cols-3 gap-3">
              {campoPct("pct_destete", "% Destete", "sobre el rodeo")}
              {campoPct("pct_machos", "% Machos", "del destete")}
              {campoPct("pct_descarte_falladas", "% Descarte de falladas", "default 50")}
              {campoPct("pct_reposicion", "% Reposición", "20 mantiene · más, crece")}
              {campo("peso_destete_kg", "Peso al destete (kg)")}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Datos reales</p>
            <p className="mb-2 text-[10px] text-gray-400">
              Cuando llega el dato real, cargalo acá: pisa el cálculo y recalcula todo lo
              posterior. Vacío = sigue proyectado.
            </p>
            <div className="grid grid-cols-4 gap-3">
              {campo("real_destetados", "Destetados")}
              {campo("real_machos", "Machos")}
              {campo("real_hembras", "Hembras")}
              {campo("real_descarte", "Descarte")}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Notas</label>
            <Input className="h-8" value={f.notas || ""}
              onChange={e => setF({ ...f, notas: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={() => onGuardar(f)}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal: proponer períodos desde los ciclos reales de Productivo ────────────
// `productivo.ciclos_cria` es la fuente de lo que pasó de verdad. Traerlo de acá evita
// retipear y hace que la línea de tiempo se autocorrija a medida que los ciclos avanzan.

function ModalPropuesta({ abierto, propuestas, existentes, aplicando, onCerrar, onAplicar }: {
  abierto: boolean
  propuestas: PropuestaCiclo[]
  existentes: CicloStock[]
  aplicando: boolean
  onCerrar: () => void
  onAplicar: (sel: PropuestaCiclo[]) => Promise<void>
}) {
  const [sel, setSel] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!abierto) return
    const init: Record<string, boolean> = {}
    propuestas.forEach(p => { init[p.campania] = true })
    setSel(init)
  }, [abierto, propuestas])

  if (!abierto) return null
  const elegidas = propuestas.filter(p => sel[p.campania])

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Proponer desde Productivo</DialogTitle></DialogHeader>

        <p className="text-xs text-gray-500">
          Sale de <strong>ciclos de cría</strong> (lo que pasó de verdad). La apertura del rodeo
          es el <strong>rodeo a servicio</strong>, y si el ciclo ya cerró se cargan los
          destetados como <strong>dato real</strong>. Si la campaña ya existe se{" "}
          <strong>actualiza</strong>, no se duplica — y los parámetros que hayas editado a mano
          no se pisan.
        </p>

        <div className="space-y-2">
          {propuestas.map(p => {
            const yaExiste = existentes.some(c => c.campania === p.campania)
            return (
              <label key={p.campania}
                className="flex cursor-pointer items-start gap-3 rounded border p-3 hover:bg-gray-50">
                <input type="checkbox" className="mt-1"
                  checked={sel[p.campania] ?? false}
                  onChange={e => setSel(s => ({ ...s, [p.campania]: e.target.checked }))} />
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    <strong>{p.campania}</strong>
                    <span className="text-xs text-gray-400">servicio {p.anio_servicio}</span>
                    {p.cerrado
                      ? <Badge variant="default" className="text-[10px]">cerrado</Badge>
                      : <Badge variant="outline" className="text-[10px]">en curso</Badge>}
                    {yaExiste && <Badge variant="outline" className="text-[10px]">actualiza</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Rodeo a servicio: <strong>{p.a_servicio}</strong> ({p.vacas} vacas +{" "}
                    {p.vaquillonas} vaquillonas) · {p.prenadas} preñadas
                  </div>
                  {p.cerrado ? (
                    <div className="mt-0.5 text-xs text-emerald-700">
                      Destete real: <strong>{p.destetados}</strong> ({p.machos} machos /{" "}
                      {p.hembras} hembras) · {pct(p.pct_destete_real ?? 0)} destete ·{" "}
                      {pct(p.pct_machos_real ?? 0)} machos
                      {p.kg_promedio ? ` · ${n1(p.kg_promedio)} kg prom.` : ""}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-amber-700">
                      Todavía sin destete: se proyecta. Cuando cargues el destete en Productivo,
                      volvé a correr esto y pasa a real.
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            {elegidas.length} de {propuestas.length} seleccionadas
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button disabled={aplicando || elegidas.length === 0}
              onClick={() => onAplicar(elegidas)}>
              {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
