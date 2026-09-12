"use client"

/**
 * ✏️ **A-FEAT-131 — Editar campaña: ver el template, sus cuotas, y editar sus datos.**
 *
 * Pedido del usuario 2026-09-12: *«debería ser una opción de editar con apertura (…) debo poder en
 * la herramienta ver el template, sus cuotas y editar sus datos. El tema caliente es que si hay
 * cosas conciliadas, sea lo que sea que yo haga, los links de códigos deben perdurar.»*
 *
 * ## Cómo está repartido el trabajo
 * - **`lib/templates/editar-campana.ts`** — qué acciones salen de la edición y qué hay que advertir.
 *   Pura, sin React ni Supabase, con 13 casos en `npm run probar`.
 * - **`lib/templates/cargar-vinculos.ts`** — busca los movimientos reales en las 12 tablas.
 * - **este archivo** — la pantalla, y nada más.
 *
 * 🔑 **El aviso se calcula en cada tecla, no al guardar.** El usuario pidió *«hace el check al
 * momento»*, y la diferencia es todo: un control que aparece al apretar Guardar llega cuando la
 * decisión ya se tomó y lo único que puede hacer es dar trabajo de más. Acá el número está a la
 * vista mientras se escribe.
 *
 * 🛑 **Este componente ESCRIBE en la base real.** Sólo cuando el usuario aprieta Guardar, y con el
 * detalle de lo que va a hacer a la vista antes (§ `CLAUDE.md` 🛑 Datos).
 */

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Plus, AlertTriangle, Link2, Loader2, Save, Info } from "lucide-react"
import {
  planificarEdicion, evaluarAvisos, hayQueFrenar,
  type CuotaExistente, type CuotaEditada, type Aviso,
} from "@/lib/templates/editar-campana"
import { cargarVinculos, type VinculosDelTemplate } from "@/lib/templates/cargar-vinculos"

// § 💰 Convención Inputs Monetarios (es-AR): se ingresa como TEXTO y se parsea al guardar.
const aNumero = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0
const aTexto = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface TemplateFila {
  id: string
  nombre_referencia: string | null
  proveedor: string | null
  nombre_quien_cobra: string | null
  cuit_quien_cobra: string | null
  categ: string | null
  centro_costo: string | null
  responsable: string | null
  cuotas: number | null
  tipo_template: string | null
  periodicidad: string | null
  año: string | null
  activo: boolean | null
}

/** Una fila del editor: lo que el usuario ve y toca. `id === null` es una cuota nueva. */
interface FilaEdit {
  id: string | null
  fecha: string
  monto: string        // texto, formato es-AR
  estado: string | null
  quitada: boolean
}

const CAMPOS_TEMPLATE: { k: keyof TemplateFila; label: string }[] = [
  { k: "nombre_referencia", label: "Nombre" },
  { k: "proveedor", label: "Proveedor" },
  { k: "nombre_quien_cobra", label: "Quién cobra" },
  { k: "cuit_quien_cobra", label: "CUIT" },
  { k: "categ", label: "Categoría" },
  { k: "centro_costo", label: "Centro de costo" },
  { k: "responsable", label: "Responsable" },
]

export function EditorCampanaTemplate({
  templateId,
  onClose,
  onGuardado,
}: {
  templateId: string
  onClose: () => void
  onGuardado?: () => void
}) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplateFila | null>(null)
  const [templateOriginal, setTemplateOriginal] = useState<TemplateFila | null>(null)
  const [actuales, setActuales] = useState<CuotaExistente[]>([])
  const [filas, setFilas] = useState<FilaEdit[]>([])
  const [banco, setBanco] = useState<VinculosDelTemplate>({ vinculos: [], candidatos: [], noMiradas: [] })

  // ── Cargar ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError(null)
      try {
        // ⚠️ `select('*')` y no la lista de columnas: el parser de tipos de supabase-js se corta en
        // la `ñ` de `año` y rompe TODO lo que venga después (`ParserError: Unexpected input: ño`).
        // Ya está resuelto así en `app/api/gas/buscar-pdf` por `año_contable`.
        const { data: t, error: eT } = await supabase
          .from("egresos_sin_factura")
          .select("*")
          .eq("id", templateId).single()
        if (eT) throw eT

        const { data: cs, error: eC } = await supabase
          .from("cuotas_egresos_sin_factura")
          .select("id, numero_cuota, fecha_estimada, monto, estado")
          .eq("egreso_id", templateId)
          .order("fecha_estimada", { ascending: true })
        if (eC) throw eC

        const cuotas: CuotaExistente[] = (cs ?? []).map((c: any) => ({
          id: c.id, numero_cuota: c.numero_cuota,
          fecha_estimada: c.fecha_estimada, monto: Number(c.monto) || 0, estado: c.estado,
        }))

        const v = await cargarVinculos(
          cuotas.map(c => c.id),
          cuotas.map(c => c.fecha_estimada || "").filter(Boolean),
        )

        if (!vivo) return
        setTemplate(t as TemplateFila)
        setTemplateOriginal(t as TemplateFila)
        setActuales(cuotas)
        setFilas(cuotas.map(c => ({
          id: c.id, fecha: (c.fecha_estimada || "").slice(0, 10),
          monto: aTexto(c.monto), estado: c.estado, quitada: false,
        })))
        setBanco(v)
      } catch (e: any) {
        if (vivo) setError(e?.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [templateId])

  // ── El check al momento ───────────────────────────────────────────────────
  const editadas: CuotaEditada[] = useMemo(
    () => filas.filter(f => !f.quitada && f.fecha)
      .map(f => ({ id: f.id, fecha_estimada: f.fecha, monto: aNumero(f.monto) })),
    [filas])

  const plan = useMemo(() => planificarEdicion(actuales, editadas), [actuales, editadas])
  const avisos = useMemo(
    () => evaluarAvisos(plan, banco.vinculos, banco.candidatos),
    [plan, banco])

  const avisosDe = (id: string | null) => id ? avisos.filter(a => a.cuotaId === id) : []
  const vinculosDe = (id: string | null) => id ? banco.vinculos.filter(v => v.template_cuota_id === id) : []

  const cambiosTemplate = useMemo(() => {
    if (!template || !templateOriginal) return [] as string[]
    return CAMPOS_TEMPLATE.filter(c => (template[c.k] ?? "") !== (templateOriginal[c.k] ?? "")).map(c => c.label)
      .concat(template.activo !== templateOriginal.activo ? ["Activo"] : [])
  }, [template, templateOriginal])

  const hayCambios = plan.acciones.length > 0 || cambiosTemplate.length > 0
  const frenar = hayQueFrenar(avisos)

  // ── Edición de filas ──────────────────────────────────────────────────────
  const setFila = (i: number, campo: "fecha" | "monto", valor: string) =>
    setFilas(prev => prev.map((f, k) => k === i ? { ...f, [campo]: valor } : f))

  const toggleQuitar = (i: number) =>
    setFilas(prev => prev.map((f, k) => k === i ? { ...f, quitada: !f.quitada } : f))

  const borrarNueva = (i: number) => setFilas(prev => prev.filter((_, k) => k !== i))

  const agregarCuota = () => {
    // Arranca copiando la última: en una campaña las cuotas se parecen entre sí, y partir de cero
    // obliga a tipear lo mismo otra vez.
    const ultima = filas[filas.length - 1]
    const proxima = ultima?.fecha
      ? (() => {
          const [y, m, d] = ultima.fecha.split("-").map(Number)
          const t = new Date(Date.UTC(y, (m || 1) - 1 + 3, d || 1))
          return t.toISOString().slice(0, 10)
        })()
      : ""
    setFilas(prev => [...prev, { id: null, fecha: proxima, monto: ultima?.monto ?? "0,00", estado: null, quitada: false }])
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      // 1 · El template (sólo lo que cambió).
      if (template && templateOriginal && cambiosTemplate.length > 0) {
        const cambios: Record<string, any> = {}
        CAMPOS_TEMPLATE.forEach(c => {
          if ((template[c.k] ?? "") !== (templateOriginal[c.k] ?? "")) cambios[c.k] = template[c.k]
        })
        if (template.activo !== templateOriginal.activo) cambios.activo = template.activo
        const { error: e } = await supabase.from("egresos_sin_factura").update(cambios).eq("id", templateId)
        if (e) throw e
      }

      // 2 · Las cuotas. 🔒 UPDATE por id y DESACTIVAR — ni un solo DELETE (ver el lib).
      for (const a of plan.acciones) {
        if (a.tipo === "modificar") {
          const { error: e } = await supabase.from("cuotas_egresos_sin_factura")
            .update({ fecha_estimada: a.fecha_estimada, monto: a.monto, updated_at: new Date().toISOString() })
            .eq("id", a.id)
          if (e) throw e
        } else if (a.tipo === "desactivar") {
          const { error: e } = await supabase.from("cuotas_egresos_sin_factura")
            .update({ estado: "desactivado", updated_at: new Date().toISOString() })
            .eq("id", a.id)
          if (e) throw e
        } else if (a.tipo === "crear") {
          const { error: e } = await supabase.from("cuotas_egresos_sin_factura").insert({
            egreso_id: templateId,
            numero_cuota: a.numero_cuota,
            fecha_estimada: a.fecha_estimada,
            fecha_vencimiento: a.fecha_estimada,
            monto: a.monto,
            estado: "pendiente",
            categ: template?.categ ?? null,
            centro_costo: template?.centro_costo ?? null,
            mes: Number(a.fecha_estimada.slice(5, 7)),
          })
          if (e) throw e
        }
      }

      // 3 · Renumerar lo que quedó vivo. Es cosmético y va al final, a propósito: si fallara, las
      //     cuotas y sus vínculos ya están bien y sólo queda un número fuera de orden.
      for (const [id, n] of Object.entries(plan.renumerar)) {
        const antes = actuales.find(c => c.id === id)
        if (antes && antes.numero_cuota !== n) {
          await supabase.from("cuotas_egresos_sin_factura").update({ numero_cuota: n }).eq("id", id)
        }
      }

      // 4 · `cuotas` del template, que es cuántas tiene.
      const vivas = editadas.length
      if (template && template.cuotas !== vivas) {
        await supabase.from("egresos_sin_factura").update({ cuotas: vivas }).eq("id", templateId)
      }

      onGuardado?.()
      onClose()
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const colorAviso = (a: Aviso) =>
    a.nivel === "rojo" ? "border-red-300 bg-red-50 text-red-800"
    : a.nivel === "ambar" ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-blue-200 bg-blue-50 text-blue-800"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">✏️ Editar campaña</h3>
            <p className="text-sm text-gray-500">
              {template?.nombre_referencia ?? "…"}
              {template?.año ? <> · campaña <strong>{template.año}</strong></> : null}
              {template?.tipo_template ? <> · {template.tipo_template}</> : null}
              {template?.periodicidad ? <> · {template.periodicidad}</> : null}
            </p>
          </div>
          <button onClick={onClose} disabled={guardando}><X className="h-5 w-5" /></button>
        </div>

        {cargando && (
          <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando el template y sus vínculos…
          </div>
        )}

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {/* ⚠️ Lo que no se pudo mirar se dice: un vínculo no mirado se parece a uno que no existe. */}
        {banco.noMiradas.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>No se pudieron revisar {banco.noMiradas.length} cuenta(s):</strong>{" "}
            {banco.noMiradas.map(n => n.tabla).join(", ")}. Los avisos de abajo pueden estar incompletos.
          </div>
        )}

        {!cargando && template && (
          <>
            {/* ── Datos del template ─────────────────────────────────────── */}
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">DATOS DEL TEMPLATE</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CAMPOS_TEMPLATE.map(c => (
                  <label key={String(c.k)} className="text-xs text-gray-500">
                    {c.label}
                    <Input
                      className="h-8 text-sm mt-0.5"
                      value={(template[c.k] as string) ?? ""}
                      onChange={e => setTemplate({ ...template, [c.k]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="text-xs text-gray-500 flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    checked={!!template.activo}
                    onChange={e => setTemplate({ ...template, activo: e.target.checked })}
                  />
                  Activo
                </label>
              </div>
            </div>

            {/* ── Las cuotas ─────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">
                  CUOTAS ({editadas.length}{editadas.length !== filas.length ? ` de ${filas.length}` : ""})
                </p>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> = conciliada contra un movimiento bancario
                </span>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-[32px_1fr_1fr_110px_70px] gap-2 text-[11px] text-gray-400 px-1">
                  <span>#</span><span>Fecha</span><span className="text-right">Monto</span><span>Estado</span><span></span>
                </div>

                {filas.map((f, i) => {
                  const vs = vinculosDe(f.id)
                  const as = avisosDe(f.id)
                  const peor = as.find(a => a.nivel === "rojo") ?? as.find(a => a.nivel === "ambar") ?? as[0]
                  return (
                    <div key={f.id ?? `nueva-${i}`} className={f.quitada ? "opacity-40" : ""}>
                      <div className="grid grid-cols-[32px_1fr_1fr_110px_70px] gap-2 items-center">
                        <span className="text-xs text-gray-400 text-center">
                          {f.id ? (plan.renumerar[f.id] ?? "·") : "＋"}
                        </span>
                        <Input
                          type="date" value={f.fecha} disabled={f.quitada}
                          onChange={e => setFila(i, "fecha", e.target.value)}
                          className={`h-8 text-sm ${peor?.nivel === "rojo" ? "border-red-400" : ""}`}
                        />
                        <Input
                          value={f.monto} disabled={f.quitada}
                          onChange={e => setFila(i, "monto", e.target.value)}
                          className={`h-8 text-sm text-right ${peor?.nivel === "rojo" ? "border-red-400" : ""}`}
                        />
                        <div className="flex items-center gap-1">
                          {f.estado && <Badge variant="outline" className="text-[10px]">{f.estado}</Badge>}
                          {vs.length > 0 && (
                            <span title={`${vs.length} movimiento(s) conciliado(s) contra esta cuota`}>
                              <Link2 className="h-3.5 w-3.5 text-green-600" />
                            </span>
                          )}
                        </div>
                        {f.id
                          ? (
                            <button
                              onClick={() => toggleQuitar(i)}
                              className="text-xs text-gray-500 hover:text-red-600"
                              title={vs.length > 0 ? "Se desactiva — el vínculo se conserva" : "Se desactiva"}
                            >
                              {f.quitada ? "Volver" : "Quitar"}
                            </button>
                          )
                          : (
                            <button onClick={() => borrarNueva(i)} className="text-gray-400 hover:text-red-600" title="Descartar">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                      </div>

                      {/* 🔴 El check, pegado a la fila que lo provocó. */}
                      {as.map((a, k) => (
                        <div key={k} className={`mt-1 mb-1 ml-8 rounded border px-2 py-1.5 text-xs ${colorAviso(a)}`}>
                          <div className="flex items-start gap-1.5">
                            {a.nivel === "azul" ? <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                            <div>
                              <strong>{a.titulo}</strong>
                              <div className="mt-0.5">{a.detalle}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {filas.length === 0 && <p className="text-sm text-gray-400 px-1">Este template no tiene cuotas.</p>}
              </div>

              <Button variant="outline" size="sm" onClick={agregarCuota} className="mt-2">
                <Plus className="h-4 w-4 mr-1" />Agregar cuota
              </Button>
            </div>

            {/* ── Qué se va a hacer, ANTES de hacerlo ────────────────────── */}
            {hayCambios && (
              <div className="rounded border border-gray-300 bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Al guardar:</p>
                <ul className="text-gray-600 space-y-0.5 text-xs">
                  {cambiosTemplate.length > 0 && <li>· Datos del template: {cambiosTemplate.join(", ")}</li>}
                  {plan.acciones.filter(a => a.tipo === "modificar").map((a: any) => (
                    <li key={a.id}>· Cuota {a.antes.numero_cuota}: cambia {a.cambios.join(" y ")} <strong>(mismo id — el vínculo se conserva)</strong></li>
                  ))}
                  {plan.acciones.filter(a => a.tipo === "crear").map((a: any, k) => (
                    <li key={`c${k}`}>· Cuota nueva el {a.fecha_estimada} por ${aTexto(a.monto)}</li>
                  ))}
                  {plan.acciones.filter(a => a.tipo === "desactivar").map((a: any) => (
                    <li key={a.id}>· Cuota {a.antes.numero_cuota}: se <strong>desactiva</strong> (no se borra)</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-gray-500">
                {banco.vinculos.length > 0
                  ? <>🔗 {banco.vinculos.length} movimiento(s) conciliado(s) contra estas cuotas — se conservan.</>
                  : <>Sin movimientos conciliados contra estas cuotas.</>}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={guardando}>Cancelar</Button>
                <Button
                  size="sm" onClick={guardar}
                  disabled={guardando || !hayCambios}
                  className={frenar ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  {guardando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {frenar ? "Guardar igual (hay avisos en rojo)" : "Guardar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EditorCampanaTemplate
