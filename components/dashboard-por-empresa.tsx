"use client"

/**
 * 📊 EL DASHBOARD POR EMPRESA — A-FEAT-1637 (JMS 22/11/2026).
 *
 * *«Cada responsable tiene todos sus canales — el dashboard debe ser total»* y *«así MA cuando quiere se hace un print de sus
 * cosas»*. Lo que agrega a la tabla de siempre:
 *   · **Chips MSA · PAM · MA** (gesto de chips de toda la app: click prende/apaga, Ctrl+click deja sólo ése). Arranca en MSA.
 *     Varios prendidos = la suma. Cada uno con su **candado** (`dashboard.empresa-*`): un chip que el rol no tiene no se ve, y si
 *     estaba elegido sale de la selección.
 *   · Cada empresa suma **todos sus canales en pesos** (`lib/dashboard/canales.ts`), sin dólares ni Cotitulares — se dice abajo.
 *   · **El control a la vista** (§ 🧮): por canal y la identidad total de la tabla = suma de los movimientos.
 *   · **Excel, PDF e Imprimir**, de lo mismo que se ve.
 *   · «Corregir categorías» (ESCRIBE) con su propio candado: a un rol de sólo mirar (MA) se le da el Dashboard sin él.
 */
import { useEffect, useMemo, useState } from "react"
import { Loader2, Settings, FileSpreadsheet, FileText, Printer } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FiltrosFinancieros } from "@/components/filtros-financieros"
import { TablaResumenFinanciero } from "@/components/tabla-resumen-financiero"
import { CorrectorCategorias } from "@/components/corrector-categorias"
import { DashboardPorResponsable } from "@/components/dashboard-por-responsable"
import { Permisable, useSeMuestra } from "@/components/modo-permisos"
import { useModoPermisos } from "@/components/contexto-permisos"
import { vistaInicialDashboard } from "@/lib/dashboard/permiso-responsable"
import { useFinancialData } from "@/hooks/useFinancialData"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { EMPRESAS_DASHBOARD, canalesFueraDelDashboard, type EmpresaDashboard } from "@/lib/dashboard/canales"
import { clasificadorDashboard } from "@/lib/dashboard/resumen"
import { toggleChip, esSoloEste, tituloChip, PISTA_CTRL_CLICK } from "@/lib/ui/chips"
import { formatNumber } from "@/lib/format"
import { hoyArgentina } from "@/lib/fechas"
import { supabase } from "@/lib/supabase"
import { leerPreferencias } from "@/lib/auth/preferencias"
import { guardarPreferencias } from "@/lib/auth/guardar-preferencias"

interface Props {
  año: number
  semestre?: number
  mostrarDecimales: boolean
  onAñoChange: (año: number) => void
  onSemestreChange: (semestre?: number) => void
  onMostrarDecimalesChange: (mostrar: boolean) => void
}

/** El candado de cada chip. Los ids van escritos tal cual en los `<Permisable>` de abajo: los busca `verificar-recursos-permisos`. */
const RECURSO_EMPRESA: Record<EmpresaDashboard, string> = {
  MSA: "dashboard.empresa-msa",
  PAM: "dashboard.empresa-pam",
  MA: "dashboard.empresa-ma",
}

export function DashboardPorEmpresa(p: Props) {
  const seMuestra = useSeMuestra()
  const visibles = useMemo(() => EMPRESAS_DASHBOARD.filter(e => seMuestra(RECURSO_EMPRESA[e])), [seMuestra])
  const [elegidas, setElegidas] = useState<Set<EmpresaDashboard>>(new Set(["MSA"]))
  const [showCategorias, setShowCategorias] = useState(false)
  // 👥 A-FEAT-1637 (JMS 22/11, en evaluación): «Por caja» (lo de siempre) / «Por responsable» (de quién es cada peso). Con candado.
  //    JMS 22/11: para MA (cualquier rol que no es admin) ABRE en «Por responsable»; admin, en «Por caja». Se recuerda la última
  //    elección de cada persona (preferencias, `vistaDashboard`). En «Ver como lo ve ella» se usa el rol que se mira.
  const modo = useModoPermisos()
  const puedeResponsable = seMuestra("dashboard.por-responsable")
  const [vista, setVista] = useState<"caja" | "responsable">("caja")
  const [prefs, setPrefs] = useState<{ rol: string | null; vista: "caja" | "responsable" | null } | null>(null)
  const verResponsable = vista === "responsable" && puedeResponsable
  // 🔀 El orden de los grupos que dejó la persona (JMS 22/11: «reubicar dentro del dashboard y que se quede guardado»).
  const [orden, setOrden] = useState<string[] | null>(null)
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => {
    const pr = leerPreferencias(data.user)
    setOrden(pr.ordenDashboard)
    setPrefs({ rol: String(data.user?.app_metadata?.role ?? "") || null, vista: pr.vistaDashboard })
  }) }, [])
  const enModo = !!modo, comoRol = modo?.soloLoQueVe ? modo.rolId : null
  useEffect(() => {
    if (!prefs) return
    setVista(vistaInicialDashboard(comoRol ?? prefs.rol, enModo ? null : prefs.vista, puedeResponsable))
  }, [prefs, enModo, comoRol, puedeResponsable])
  const elegirVista = (k: "caja" | "responsable") => {
    setVista(k)
    if (!modo) void guardarPreferencias({ vistaDashboard: k }) // en el modo permisos no se toca la preferencia del admin
  }
  const reordenar = async (nuevo: string[] | null) => {
    const antes = orden
    setOrden(nuevo)
    const { error } = await guardarPreferencias({ ordenDashboard: nuevo })
    if (error) { setOrden(antes); toast.error("No se pudo guardar el orden. Probá de nuevo.") }
  }
  const [exportando, setExportando] = useState<"" | "excel" | "pdf">("")
  // 🖨️ Las reglas de impresión se ponen SÓLO mientras imprime este botón: la solapa queda montada aunque se mire otra, y con
  // las reglas siempre puestas un Ctrl+P en otra pantalla imprimiría el Dashboard.
  const [imprimiendo, setImprimiendo] = useState(false)
  useEffect(() => {
    if (!imprimiendo) return
    const t = setTimeout(() => { window.print(); setImprimiendo(false) }, 50)
    return () => clearTimeout(t)
  }, [imprimiendo])

  // 🔒 Un chip que el rol no ve sale de la selección; si se quedó sin ninguna, arranca en la primera que sí ve.
  useEffect(() => {
    setElegidas(prev => {
      const limpia = new Set([...prev].filter(e => visibles.includes(e)))
      if (limpia.size === prev.size) return prev
      return limpia.size ? limpia : new Set(visibles.slice(0, 1))
    })
  }, [visibles])

  const empresas = useMemo(() => EMPRESAS_DASHBOARD.filter(e => elegidas.has(e) && visibles.includes(e)), [elegidas, visibles])
  const { resumen, loading, control, fuera, movimientos, cuentas, templates, canales } = useFinancialData(p.año, p.semestre, empresas)
  const enDolares = useMemo(() => canalesFueraDelDashboard(CUENTAS_BANCARIAS, empresas), [empresas])

  const periodo = p.semestre === 1 ? "1er semestre" : p.semestre === 2 ? "2do semestre" : "año entero"
  const titulo = `Dashboard — ${empresas.join(" + ") || "(sin empresa)"} — ${p.año} (${periodo})`
  const nota = `Suma todos los canales en pesos de ${empresas.join(", ") || "—"}: ${canales.map(c => c.nombre).join(", ") || "—"}. No incluye cuentas en dólares${enDolares.length ? ` (${enDolares.join(", ")})` : ""} ni las de Cotitulares. Importe = créditos − débitos.`
  const nombreArchivo = (ext: string) => `Dashboard ${empresas.join("+")} ${p.año}${p.semestre ? ` S${p.semestre}` : ""} (${hoyArgentina()}).${ext}`

  const bajarExcel = async () => {
    if (!control) return
    setExportando("excel")
    try {
      const { descargarExcelDashboard } = await import("@/lib/dashboard/export-excel")
      const clasificar = clasificadorDashboard(cuentas, templates)
      await descargarExcelDashboard({
        empresas, año: p.año, semestre: p.semestre, control, fueraDelDashboard: enDolares,
        movimientos: movimientos.map(mov => ({ mov, c: clasificar(mov), template: mov.template_id ? templates.get(mov.template_id)?.nombre : undefined })),
      }, nombreArchivo("xlsx"))
    } catch (e) {
      console.error(e); toast.error(`No se pudo armar el Excel: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setExportando("") }
  }
  const bajarPdf = async () => {
    if (!control) return
    setExportando("pdf")
    try {
      const { descargarPdfDashboard } = await import("@/lib/dashboard/export-pdf")
      descargarPdfDashboard({ titulo, nota, resumen, control, decimales: p.mostrarDecimales, orden }, nombreArchivo("pdf"))
    } catch (e) {
      console.error(e); toast.error(`No se pudo armar el PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setExportando("") }
  }

  const chip = (e: EmpresaDashboard) => (
    <button key={e} type="button" title={tituloChip(e)}
      onClick={(ev) => toggleChip(setElegidas, e, esSoloEste(ev))}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${elegidas.has(e) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
      {e}
    </button>
  )
  const sinDatos = !loading && empresas.length === 0

  return (
    <div className="space-y-4">
      {/* 🖨️ Imprimir: sólo el título, la tabla y el control */}
      {imprimiendo && <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #dashboard-imprimible, #dashboard-imprimible * { visibility: visible !important; }
          #dashboard-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          #dashboard-imprimible .overflow-x-auto { overflow: visible !important; }
          #dashboard-imprimible table { font-size: 8px; }
        }
      `}</style>}

      <div className="flex items-start justify-between gap-3 print:hidden">
        <FiltrosFinancieros
          año={p.año}
          semestre={p.semestre}
          mostrarDecimales={p.mostrarDecimales}
          onAñoChange={p.onAñoChange}
          onSemestreChange={p.onSemestreChange}
          onMostrarDecimalesChange={p.onMostrarDecimalesChange}
        />
        <div className="flex shrink-0 flex-col items-end gap-2">
          {orden && orden.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void reordenar(null)} title="Vuelve al orden por nombre">Orden de siempre</Button>
          )}
          <Permisable recurso="dashboard.corregir-categorias">
            <Button variant="secondary" onClick={() => setShowCategorias(!showCategorias)}>
              <Settings className="mr-2 h-4 w-4" />
              {showCategorias ? "Ocultar" : "Corregir categorías"}
            </Button>
          </Permisable>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <span className="mr-1 text-xs font-semibold text-gray-600">Empresa:</span>
          {/* 🔒 Un candado por chip. Los ids van escritos acá: los busca `verificar-recursos-permisos`. */}
          <Permisable recurso="dashboard.empresa-msa">{chip("MSA")}</Permisable>
          <Permisable recurso="dashboard.empresa-pam">{chip("PAM")}</Permisable>
          <Permisable recurso="dashboard.empresa-ma">{chip("MA")}</Permisable>
          {visibles.length > 1 && (
            <>
              <button onClick={() => setElegidas(new Set(visibles))} className="ml-1 text-[10px] text-gray-400 underline">todas</button>
              <span className="ml-1 text-[10px] text-gray-400">{PISTA_CTRL_CLICK}</span>
            </>
          )}
          <Permisable recurso="dashboard.por-responsable">
            <div className="ml-3 flex overflow-hidden rounded-md border text-xs" title="Por caja: lo que se movió en los canales de cada empresa · Por responsable: de quién es cada peso y cuánto se deben los socios">
              {(["caja", "responsable"] as const).map(k => (
                <button key={k} type="button" onClick={() => elegirVista(k)}
                  className={`px-3 py-1 ${vista === k ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  {k === "caja" ? "Por caja" : "Por responsable"}
                </button>
              ))}
            </div>
          </Permisable>
          <div className={`ml-auto flex gap-2 ${verResponsable ? "hidden" : ""}`}>
            <Button size="sm" variant="outline" disabled={loading || !control || !!exportando} onClick={bajarExcel}>
              {exportando === "excel" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}Excel
            </Button>
            <Button size="sm" variant="outline" disabled={loading || !control || !!exportando} onClick={bajarPdf}>
              {exportando === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}PDF
            </Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => setImprimiendo(true)}>
              <Printer className="mr-1 h-4 w-4" />Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {sinDatos ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {visibles.length ? "Elegí al menos una empresa." : "No tenés ninguna empresa habilitada en el Dashboard."}
        </CardContent></Card>
      ) : verResponsable ? (
        <DashboardPorResponsable año={p.año} semestre={p.semestre} empresas={empresas} mostrarDecimales={p.mostrarDecimales} orden={orden} onReordenar={(o) => void reordenar(o)} />
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <span>Cargando datos financieros…</span>
          </CardContent>
        </Card>
      ) : (
        <div id="dashboard-imprimible" className="space-y-3">
          <h2 className="hidden text-base font-semibold print:block">{titulo}</h2>
          {/* En pantalla, como la dejaste; al imprimir, SIEMPRE todo abierto (formato fijo: el grupo y cada cuenta) */}
          <div className="print:hidden"><TablaResumenFinanciero resumen={resumen} mostrarDecimales={p.mostrarDecimales} orden={orden} onReordenar={(o) => void reordenar(o)} /></div>
          {imprimiendo && <div className="hidden print:block"><TablaResumenFinanciero resumen={resumen} mostrarDecimales={p.mostrarDecimales} todoAbierto orden={orden} /></div>}
          {control && <ControlDelDashboard control={control} fuera={fuera} nota={nota} decimales={p.mostrarDecimales} />}
        </div>
      )}

      {showCategorias && <div className="entrada-suave print:hidden"><CorrectorCategorias /></div>}
    </div>
  )
}

function ControlDelDashboard({ control: c, fuera, nota, decimales }: {
  control: NonNullable<ReturnType<typeof useFinancialData>["control"]>
  fuera: ReturnType<typeof useFinancialData>["fuera"]
  nota: string
  decimales: boolean
}) {
  const n = (v: number) => formatNumber(v, decimales)
  return (
    <div className="space-y-2 text-xs">
      {c.cierra ? (
        <p className="text-emerald-700">✓ El total de la tabla ({n(c.totalTabla)}) es la suma de los movimientos de los canales.</p>
      ) : (
        <div className="rounded-md border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">⚠️ El total de la tabla ({n(c.totalTabla)}) no es la suma de los movimientos de los canales ({n(c.totalMovimientos)}): diferencia {n(c.diferencia)}.</p>
          {c.fueraTotal !== 0 && (
            <p className="mt-1">
              {fuera.length} movimiento{fuera.length === 1 ? "" : "s"} por {n(c.fueraTotal)} no entra{fuera.length === 1 ? "" : "n"} en ninguna sección: el tipo que les toca es «NO» o vacío (en cada renglón dice si viene del template o de la cuenta: ahí se corrige).
              {c.explicada ? " Explican toda la diferencia." : " ⚠️ Y aun así no explican toda la diferencia: es un error de la app."}
            </p>
          )}
          {fuera.length > 0 && (
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
              {fuera.slice(0, 50).map((x, i) => (
                <li key={i}>{x.mov.fecha?.split("-").reverse().join("/")} · {x.mov._canal} · {x.mov.descripcion} · categ «{x.mov.categ}» (tipo {x.clasificacion.tipo ?? "vacío"}{x.clasificacion.origenTipo ? `, de ${x.clasificacion.origenTipo}` : ""}) · {n(x.clasificacion.monto)}</li>
              ))}
              {fuera.length > 50 && <li>… y {fuera.length - 50} más (están todos en el Excel, hoja Control).</li>}
            </ul>
          )}
        </div>
      )}
      {c.algunaIncompleta && <p className="font-semibold text-amber-700">⚠️ Algún canal no se leyó entero (ver abajo): los números de ese canal pueden quedar cortos.</p>}
      <table className="w-auto border-collapse">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pr-4 font-medium">Canal</th>
            <th className="pr-4 text-right font-medium">Movimientos</th>
            <th className="pr-4 text-right font-medium">Neto (créditos − débitos)</th>
            <th className="pr-4 text-right font-medium">Sin categoría (no entran)</th>
          </tr>
        </thead>
        <tbody>
          {c.canales.map(k => (
            <tr key={k.nombre} className="border-t">
              <td className="pr-4">{k.nombre}{k.incompleta && <span className="ml-1 text-amber-700">⚠️ incompleta</span>}</td>
              <td className="pr-4 text-right tabular-nums">{k.movimientos}</td>
              <td className="pr-4 text-right tabular-nums">{n(k.neto)}</td>
              <td className={`pr-4 text-right tabular-nums ${k.sinCateg ? "text-amber-700" : "text-gray-400"}`}>{k.sinCateg === null ? "no se pudo contar" : k.sinCateg}</td>
            </tr>
          ))}
          <tr className="border-t font-semibold">
            <td className="pr-4">Total</td>
            <td className="pr-4 text-right tabular-nums">{c.canales.reduce((t, k) => t + k.movimientos, 0)}</td>
            <td className="pr-4 text-right tabular-nums">{n(c.totalMovimientos)}</td>
            <td className="pr-4 text-right tabular-nums">{c.sinCategTotal}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-gray-500">{nota}{c.sinCategTotal ? ` Los ${c.sinCategTotal} movimientos sin categoría no están en la tabla: se categorizan en Extracto bancario.` : ""}</p>
    </div>
  )
}
