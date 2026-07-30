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
import { Loader2, Plus, Trash2, TrendingUp, Info, RotateCcw, Wand2, AlertTriangle } from "lucide-react"
import { PanelLotesHacienda } from "./panel-lotes-hacienda"
import {
  calcularLineaTiempo, fechasCampania, etiquetaFechas, proponerDesdeCiclosCria, fechaDestete,
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
  /**
   * Hembras marcadas para reposición por fecha de pesada. Sirve para avisar cuando el
   * número que se presupuestó en la línea de tiempo no coincide con las que están
   * efectivamente marcadas en Productivo — son dos lugares distintos (cuántas salen del
   * rodeo vs quiénes se quedan) y conviene que no se desincronicen en silencio.
   */
  const [marcadasPorPesada, setMarcadasPorPesada] = useState<Record<string, number>>({})
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

      // Hembras marcadas (es_torito en hembra = reposición) por fecha de pesada
      const { data: pes } = await supabase.schema("productivo")
        .from("pesadas_terneros")
        .select("fecha, ternero:terneros!inner(sexo, es_torito)")
      const marc: Record<string, number> = {}
      for (const r of (pes || []) as any[]) {
        const t = r.ternero
        if (!t) continue
        if (/hembra/i.test(String(t.sexo ?? "")) && t.es_torito) {
          marc[r.fecha] = (marc[r.fecha] ?? 0) + 1
        }
      }
      setMarcadasPorPesada(marc)
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
      peso_descarte_kg: parseNum(String(f.peso_descarte_kg)),
      real_destetados: String(f.real_destetados ?? "").trim() === "" ? null : parseNum(String(f.real_destetados)),
      real_machos: String(f.real_machos ?? "").trim() === "" ? null : parseNum(String(f.real_machos)),
      real_hembras: String(f.real_hembras ?? "").trim() === "" ? null : parseNum(String(f.real_hembras)),
      real_descarte: String(f.real_descarte ?? "").trim() === "" ? null : parseNum(String(f.real_descarte)),
      // Cabezas de reposición cuando el dato se sabe. Pisa a pct_reposicion.
      real_retenidas: String(f.real_retenidas ?? "").trim() === "" ? null : parseNum(String(f.real_retenidas)),
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
   * Compara las terneras retenidas del período contra las marcadas en la pesada de su
   * destete. Sólo aplica a destetes que ya ocurrieron (busca una pesada dentro de ±90
   * días); para los proyectados no hay con qué comparar y devuelve null.
   */
  const chequeoReposicion = (c: CicloCalculado): { marcadas: number; fecha: string } | null => {
    const fd = fechaDestete(c.ciclo)
    if (!fd) return null
    const objetivo = new Date(fd + "T00:00:00").getTime()
    let mejor: { fecha: string; dias: number } | null = null
    for (const fecha of Object.keys(marcadasPorPesada)) {
      const dias = Math.abs(new Date(fecha + "T00:00:00").getTime() - objetivo) / 86400000
      if (dias <= 90 && (!mejor || dias < mejor.dias)) mejor = { fecha, dias }
    }
    if (!mejor) return null
    const marcadas = marcadasPorPesada[mejor.fecha] ?? 0
    return Math.abs(marcadas - c.retenidas) > 0.5 ? { marcadas, fecha: mejor.fecha } : null
  }

  const desincronizados = linea.filter(c => chequeoReposicion(c))

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
          // Derivado del año de servicio para que quede cronológico aunque se cargue
          // un período viejo después de uno nuevo.
          orden: existente?.orden ?? p.anio_servicio,
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
              // 80%: del 15% que no desteta, la mayor parte es falla de la vaca y se vende
              pct_descarte_falladas: 0.80,
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
    // (el orden real de la tabla sale de la campaña; esto es sólo un valor inicial)
    setModal({
      campania: "", orden: sigOrden,
      // El primero arranca con la foto de hoy; los siguientes heredan (apertura vacía)
      vacas_apertura: ciclos.length ? "" : "177",
      vaquillonas_apertura: ciclos.length ? "" : "27",
      pct_destete: ultimo ? fmtPctTxt(ultimo.ciclo.pct_destete) : "85",
      pct_machos: ultimo ? fmtPctTxt(ultimo.ciclo.pct_machos) : "50",
      pct_descarte_falladas: ultimo ? fmtPctTxt(ultimo.ciclo.pct_descarte_falladas) : "80",
      pct_reposicion: ultimo ? fmtPctTxt(ultimo.ciclo.pct_reposicion) : "20",
      peso_destete_kg: ultimo ? String(ultimo.ciclo.peso_destete_kg) : "200",
      peso_descarte_kg: ultimo ? String(ultimo.ciclo.peso_descarte_kg) : "450",
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
    peso_descarte_kg: String(c.peso_descarte_kg ?? 450),
    real_destetados: c.real_destetados ?? "",
    real_machos: c.real_machos ?? "",
    real_hembras: c.real_hembras ?? "",
    real_descarte: c.real_descarte ?? "",
    real_retenidas: c.real_retenidas ?? "",
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
    { label: "Terneras retenidas",    get: c => {
        const chk = chequeoReposicion(c)
        return n1(c.retenidas) + (c.retencion_excede ? " ⚠" : "") + (chk ? ` (marcadas ${n1(chk.marcadas)})` : "")
      }, clase: "text-blue-700", sep: true },
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

      {desincronizados.length > 0 && (
        <p className="flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            La <strong>reposición presupuestada</strong> no coincide con las terneras{" "}
            <strong>marcadas en Productivo</strong>:{" "}
            {desincronizados.map(c => {
              const chk = chequeoReposicion(c)!
              return `${c.ciclo.campania}: presupuesto ${n1(c.retenidas)} vs marcadas ${n1(chk.marcadas)}`
            }).join(" · ")}.
            {" "}Son dos cosas distintas —cuántas salen del rodeo vs <em>quiénes</em> se quedan—
            pero deberían dar el mismo número. Si la decisión cambió, marcá los animales en
            Productivo → Recría y volvé a traer los lotes: ahí se recalcula también el peso.
          </span>
        </p>
      )}

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

      {/* Lo que sale del rodeo y espera venderse */}
      <PanelLotesHacienda linea={linea} />

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

/**
 * ⚠️ A NIVEL DE MÓDULO a propósito. Si se define adentro del componente, cada tecleo
 * crea un tipo de componente nuevo, React desmonta y remonta todo el subárbol, y los
 * inputs PIERDEN EL FOCO y la selección en cada carácter.
 */
function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b bg-gray-50 px-3 py-1.5">
        <p className="text-xs font-semibold text-gray-700">{titulo}</p>
        {nota && <p className="text-[10px] text-gray-400">{nota}</p>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function ModalCiclo({ datos, onCerrar, onGuardar }: {
  datos: any; onCerrar: () => void; onGuardar: (f: any) => Promise<void>
}) {
  const [f, setF] = useState<any>({})
  useEffect(() => { if (datos) setF({ ...datos }) }, [datos])
  if (!datos) return null

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  // ── Vista previa en vivo: el mismo motor que la tabla ──────────────────────
  // Ver el resultado mientras se editan los parámetros evita tener que guardar,
  // mirar la tabla, volver a abrir y corregir.
  const rodeo = parseNum(String(f.vacas_apertura ?? "0")) + parseNum(String(f.vaquillonas_apertura ?? "0"))
  const pDestete = parsePct(String(f.pct_destete ?? "0"))
  const pMachos = parsePct(String(f.pct_machos ?? "0"))
  const pDescarte = parsePct(String(f.pct_descarte_falladas ?? "0"))
  const pRepo = parsePct(String(f.pct_reposicion ?? "0"))

  const destetados = String(f.real_destetados ?? "").trim() !== ""
    ? parseNum(String(f.real_destetados)) : rodeo * pDestete
  const terneros = String(f.real_machos ?? "").trim() !== ""
    ? parseNum(String(f.real_machos)) : destetados * pMachos
  const terneras = String(f.real_hembras ?? "").trim() !== ""
    ? parseNum(String(f.real_hembras)) : destetados - terneros
  const falladas = Math.max(0, rodeo - destetados)
  const descarte = String(f.real_descarte ?? "").trim() !== ""
    ? parseNum(String(f.real_descarte)) : falladas * pDescarte

  const repoEsReal = String(f.real_retenidas ?? "").trim() !== ""
  const retenidasBruto = repoEsReal ? parseNum(String(f.real_retenidas)) : rodeo * pRepo
  const retenidas = Math.min(retenidasBruto, terneras)
  const excede = retenidasBruto > terneras + 0.01

  /**
   * % y cabezas son dos formas de decir lo mismo, así que se mantienen sincronizados.
   * Tocar el % recalcula las cabezas y NO deja override. Tocar las cabezas fija el
   * número como dato firme (`real_retenidas`), porque cuando se sabe la cantidad no
   * debe escalar si después cambia el rodeo.
   */
  const editarPctRepo = (v: string) => {
    setF((p: any) => ({ ...p, pct_reposicion: v, real_retenidas: "" }))
  }
  const editarCabezasRepo = (v: string) => {
    const cab = parseNum(v)
    const pctEquiv = rodeo > 0 ? (cab / rodeo) * 100 : 0
    setF((p: any) => ({
      ...p,
      real_retenidas: v,
      pct_reposicion: v.trim() === "" ? p.pct_reposicion
        : pctEquiv.toLocaleString("es-AR", { maximumFractionDigits: 2 }),
    }))
  }

  const campo = (k: string, label: string, ayuda?: string) => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <Input className="h-8 text-right" value={f[k] ?? ""} onChange={e => set(k, e.target.value)} />
      {ayuda && <p className="mt-1 text-[10px] text-gray-400">{ayuda}</p>}
    </div>
  )

  /** Porcentaje: se escribe en %, se guarda como fracción, con eco en vivo. */
  const campoPct = (k: string, label: string, ayuda?: string, onChange?: (v: string) => void) => {
    const crudo = String(f[k] ?? "")
    const frac = parsePct(crudo)
    const mal = crudo.trim() !== "" && (frac < 0 || frac > 1)
    const sospechoso = crudo.trim() !== "" && frac > 0 && frac < 0.001
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <div className="relative">
          <Input className={`h-8 pr-6 text-right ${mal || sospechoso ? "border-red-400 bg-red-50" : ""}`}
            value={f[k] ?? ""}
            onChange={e => (onChange ?? ((v: string) => set(k, v)))(e.target.value)} />
          <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-gray-400">%</span>
        </div>
        <p className={`mt-1 text-[10px] ${mal || sospechoso ? "text-red-600" : "text-gray-400"}`}>
          {mal ? `${crudo} % no es válido`
            : sospechoso ? `¿Seguro? Se guardaría ${frac.toLocaleString("es-AR", { maximumFractionDigits: 6 })}`
            : ayuda ?? ""}
        </p>
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{datos.id ? `Editar período ${datos.campania}` : "Nuevo período"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          {/* ── Columna izquierda: los datos que se cargan ── */}
          <div className="col-span-2 space-y-3">

            <Seccion titulo="1 · Identificación">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Campaña</label>
                  <Input className="h-8" placeholder="27/28" value={f.campania || ""}
                    onChange={e => set("campania", e.target.value)} />
                </div>
                {campo("orden", "Orden", "posición en la línea de tiempo")}
              </div>
              <div className="mt-2 rounded bg-gray-50 px-2 py-1.5 text-[11px]">
                {(() => {
                  const fc = fechasCampania(String(f.campania ?? ""))
                  if (!fc) return <span className="text-gray-400">Escribí la campaña como AA/BB (ej. 27/28)</span>
                  const mes = (s: string) =>
                    new Date(s + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "numeric" })
                  return (
                    <span className="text-gray-600">
                      Servicio <strong>{mes(fc.servicio)}</strong> · parición <strong>{mes(fc.paricion)}</strong>
                      {" "}· destete <strong>{mes(fc.destete)}</strong>
                    </span>
                  )
                })()}
              </div>
            </Seccion>

            <Seccion titulo="2 · Rodeo de apertura" nota="vacío = hereda del cierre del período anterior">
              <div className="grid grid-cols-3 gap-3">
                {campo("vacas_apertura", "Vacas")}
                {campo("vaquillonas_apertura", "Vaquillonas de rep.")}
                <div className="flex flex-col justify-center rounded bg-emerald-50 px-3 py-2">
                  <span className="text-[10px] text-emerald-700">Base entorada</span>
                  <span className="text-lg font-semibold text-emerald-800">{n1(rodeo)}</span>
                </div>
              </div>
            </Seccion>

            <Seccion titulo="3 · Parámetros de proyección">
              <div className="grid grid-cols-3 gap-3">
                {campoPct("pct_destete", "% Destete", "sobre la base entorada")}
                {campoPct("pct_machos", "% Machos", "del destete")}
                {campoPct("pct_descarte_falladas", "% Descarte", "80 = falla de la vaca")}
              </div>

              {/* Reposición: % y cabezas, sincronizados */}
              <div className="mt-3 rounded border border-blue-200 bg-blue-50/50 p-2.5">
                <p className="mb-2 text-[11px] font-medium text-blue-900">
                  Reposición — poné el % o las cabezas, se completan solas
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {campoPct("pct_reposicion", "% Reposición", "20 mantiene · más, crece", editarPctRepo)}
                  <div>
                    <label className="text-xs text-gray-500">Cabezas</label>
                    <Input className="h-8 text-right" value={f.real_retenidas ?? ""}
                      onChange={e => editarCabezasRepo(e.target.value)} />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {repoEsReal ? "dato firme, no escala" : "vacío = se usa el %"}
                    </p>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] text-gray-500">Se retienen</span>
                    <span className="text-lg font-semibold text-blue-800">
                      {n1(retenidas)}
                      {repoEsReal && <span className="ml-1 text-[10px] font-normal text-blue-600">real</span>}
                    </span>
                    {repoEsReal && (
                      <button type="button" className="mt-0.5 text-left text-[10px] text-blue-600 underline"
                        onClick={() => set("real_retenidas", "")}>
                        volver al %
                      </button>
                    )}
                  </div>
                </div>
                {excede && (
                  <p className="mt-2 text-[11px] text-red-600">
                    ⚠ No se pueden retener {n1(retenidasBruto)}: sólo se destetan {n1(terneras)} terneras.
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {campo("peso_destete_kg", "Peso al destete (kg)")}
                {campo("peso_descarte_kg", "Peso vaca refugo (kg)")}
              </div>
            </Seccion>

            <Seccion titulo="4 · Datos reales del destete"
              nota="cuando llega el dato real pisa el cálculo y recalcula todo lo posterior · vacío = sigue proyectado">
              <div className="grid grid-cols-4 gap-3">
                {campo("real_destetados", "Destetados")}
                {campo("real_machos", "Machos")}
                {campo("real_hembras", "Hembras")}
                {campo("real_descarte", "Descarte")}
              </div>
            </Seccion>

            <div>
              <label className="text-xs text-gray-500">Notas</label>
              <Input className="h-8" value={f.notas || ""} onChange={e => set("notas", e.target.value)} />
            </div>
          </div>

          {/* ── Columna derecha: qué va a dar ── */}
          <div className="space-y-3">
            <div className="sticky top-0 rounded-lg border bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold text-gray-700">Vista previa</p>
              <table className="w-full text-xs">
                <tbody>
                  {[
                    ["Base entorada", n1(rodeo), "font-semibold"],
                    ["Destetados", n1(destetados), ""],
                    ["→ Terneros", n1(terneros), "text-gray-500"],
                    ["→ Terneras", n1(terneras), "text-gray-500"],
                    ["Falladas", n1(falladas), "text-gray-500"],
                    ["Vaca descarte → venta", n1(descarte), "text-amber-700 font-medium"],
                    ["Terneras retenidas", n1(retenidas), "text-blue-700"],
                    ["Terneros a venta", n1(terneros), "text-emerald-700 font-medium"],
                    ["Terneras a venta", n1(Math.max(0, terneras - retenidas)), "text-emerald-700 font-medium"],
                  ].map(([l, v, c]) => (
                    <tr key={l as string} className="border-b border-gray-200 last:border-0">
                      <td className={`py-1 pr-2 ${c}`}>{l}</td>
                      <td className={`py-1 text-right ${c}`}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-2 rounded bg-white p-2">
                <p className="mb-1 text-[10px] font-semibold text-gray-600">Cierre → abre el siguiente</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Vacas</span>
                  <strong>{n1(Math.max(0, parseNum(String(f.vacas_apertura ?? "0")) - descarte
                    + parseNum(String(f.vaquillonas_apertura ?? "0"))))}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Vaquillonas</span>
                  <strong>{n1(retenidas)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={() => onGuardar(f)}>Guardar</Button>
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
