"use client"

// Presupuesto → Variables de costo.
//
// La pantalla donde el usuario arma un costo sin pedirle código a nadie. Ése es el criterio de
// aceptación, y lo puso él: *"yo no debería necesariamente contarte cómo hacerlo, sino que esté
// la matriz para crearlo"*.
//
// Todo costo se arma igual —CANTIDAD × PRECIO, más una cadena de ajustes— y lo que cambia es de
// dónde sale cada pieza. Por eso la fila no pregunta "¿qué tipo de costo es?" sino las tres cosas
// que de verdad varían: de dónde sale la cantidad, de dónde sale el precio, y cuándo cae.
//
// La cadena de ajustes se muestra como pasos editables y no como una fórmula escondida: el
// usuario pidió *"encadenar etapas de la cuenta para la conformación del precio final"*, y un
// número que no se puede explicar no sirve para decidir.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronRight, Calculator, AlertTriangle, Flag,
} from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import {
  calcularVariable, ETIQUETA_FUENTE_CANTIDAD, ETIQUETA_FUENTE_PRECIO, ETIQUETA_DISTRIBUCION,
  ETIQUETA_AJUSTE, AVISO_CUPO_ANUAL_SIN_VALIDAR,
  type Variable, type Ajuste, type FuenteCantidad, type FuentePrecio, type Distribucion,
  type TipoAjuste, type ContextoVariable,
} from "@/lib/presupuesto/variables"

const FUENTES_CANT = Object.keys(ETIQUETA_FUENTE_CANTIDAD) as FuenteCantidad[]
const FUENTES_PRECIO = Object.keys(ETIQUETA_FUENTE_PRECIO) as FuentePrecio[]
const DISTRIBUCIONES = Object.keys(ETIQUETA_DISTRIBUCION) as Distribucion[]
const TIPOS_AJUSTE = Object.keys(ETIQUETA_AJUSTE) as TipoAjuste[]
const MESES_TXT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

interface FilaVariable extends Variable { id: string; campana: string | null }
interface Actividad { id: string; nombre: string }

export function ConfiguradorVariables({ onCambio }: { onCambio?: () => void } = {}) {
  const [cargando, setCargando] = useState(true)
  const [vars, setVars] = useState<FilaVariable[]>([])
  const [ajustes, setAjustes] = useState<Record<string, Ajuste[]>>({})
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [cuentas, setCuentas] = useState<{ nro_cuenta: string; cuenta_contable: string; categ: string }[]>([])
  const [categoriasHacienda, setCategoriasHacienda] = useState<string[]>([])
  const [ctx, setCtx] = useState<ContextoVariable>({})
  const [campana, setCampana] = useState("26/27")
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [v, a, act, cc, ipc] = await Promise.all([
        supabase.from("presupuesto_variables").select("*")
          .eq("empresa", "MSA").eq("escenario", "base").eq("activo", true).order("concepto"),
        supabase.from("presupuesto_variable_ajustes").select("*").order("orden"),
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true).order("nombre"),
        supabase.from("cuentas_contables").select("nro_cuenta, cuenta_contable, categ").not("nro_cuenta", "is", null).order("nro_cuenta"),
        supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
      ])
      const { data: cats } = await supabase.schema("productivo")
        .from("categorias_hacienda").select("nombre").order("nombre")
      setCategoriasHacienda(((cats || []) as any[]).map(c => String(c.nombre)))
      setVars(((v.data || []) as any[]) as FilaVariable[])
      const porVar: Record<string, Ajuste[]> = {}
      for (const x of ((a.data || []) as any[])) {
        (porVar[x.variable_id] ||= []).push({
          id: x.id, orden: x.orden, tipo: x.tipo, valor: x.valor == null ? null : Number(x.valor),
          referencia: x.referencia, nota: x.nota,
        })
      }
      setAjustes(porVar)
      setActividades((act.data || []) as Actividad[])
      setCuentas(((cc.data || []) as any[]).map(r => ({
        nro_cuenta: String(r.nro_cuenta), cuenta_contable: String(r.cuenta_contable ?? ""),
        categ: String(r.categ ?? ""),
      })))
      // IPC acumulado de los últimos 12 meses cargados — el mismo criterio que el panel de cuentas.
      const serie = ((ipc.data || []) as any[])
        .sort((x, y) => (x.anio * 12 + x.mes) - (y.anio * 12 + y.mes)).slice(-12)
      const factor = serie.reduce((f, p) => f * (1 + (Number(p.valor_ipc) || 0) / 100), 1)
      setCtx({ ipcAcumulado: serie.length > 0 ? factor - 1 : null })
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (id: string, cambios: Partial<Variable>) => {
    setVars(prev => prev.map(v => (v.id === id ? { ...v, ...cambios } : v)))
    const { error } = await supabase.from("presupuesto_variables")
      .update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) { alert("Error: " + error.message); await cargar() }
  }

  const crear = async () => {
    const { data, error } = await supabase.from("presupuesto_variables").insert({
      empresa: "MSA", campana, escenario: "base", concepto: "Costo nuevo",
      fuente_cantidad: "manual", fuente_precio: "manual", distribucion: "mensual",
    }).select().single()
    if (error) { alert("Error: " + error.message); return }
    await cargar()
    setAbierta((data as any).id)
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar esta variable? Se van también sus ajustes.")) return
    await supabase.from("presupuesto_variables").delete().eq("id", id)
    await cargar()
    onCambio?.()
  }

  const agregarAjuste = async (variableId: string) => {
    const orden = (ajustes[variableId]?.length ?? 0) + 1
    await supabase.from("presupuesto_variable_ajustes")
      .insert({ variable_id: variableId, orden, tipo: "porcentaje", valor: 0 })
    await cargar()
    onCambio?.()
  }

  const guardarAjuste = async (id: string, cambios: Partial<Ajuste>) => {
    await supabase.from("presupuesto_variable_ajustes").update(cambios).eq("id", id)
    await cargar()
    onCambio?.()
  }

  const borrarAjuste = async (id: string) => {
    await supabase.from("presupuesto_variable_ajustes").delete().eq("id", id)
    await cargar()
    onCambio?.()
  }

  const delCampana = useMemo(
    () => vars.filter(v => v.campana == null || v.campana === campana),
    [vars, campana])

  const incompletas = useMemo(() => delCampana.filter(v =>
    calcularVariable(v, ajustes[v.id] ?? [], ctx).faltantes.length > 0 && !v.pendiente_a_proposito
  ).length, [delCampana, ajustes, ctx])

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo las variables…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" /> Variables de costo
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Cada costo es <strong>cantidad × precio</strong> más los ajustes que se le encadenen.
              Lo que cambia es de dónde sale cada pieza.
            </p>
          </div>
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={crear}>
            <Plus className="h-3 w-3" /> Nueva variable
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {ctx.ipcAcumulado == null && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            ⚠️ No hay IPC cargado: los ajustes por IPC no se pueden calcular. Se carga en <strong>Precios y TC</strong>.
          </p>
        )}
        {delCampana.some(v => v.distribucion === "cupo_anual") && (
          <p className="rounded border border-orange-300 bg-orange-50 px-3 py-1.5 text-[11px] text-orange-900">
            ⚠️ <strong>Cupo anual — forma de presupuestar sin validar.</strong>{" "}
            {AVISO_CUPO_ANUAL_SIN_VALIDAR}
          </p>
        )}
        {incompletas > 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            <strong>{incompletas}</strong> {incompletas === 1 ? "variable" : "variables"} sin terminar.
            Si alguna la dejás así a propósito, marcala — así deja de contarse como olvido.
          </p>
        )}

        {delCampana.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Todavía no hay variables. Con <strong>Nueva variable</strong> se crea una y se completa acá mismo.
          </p>
        )}

        {/* Agrupadas por ACTIVIDAD, no en una lista plana. El usuario lo pidió así: un costo
            directo se piensa como "costos productivos → cría → rollos", no como una cuenta
            contable suelta. La cuenta que alimenta sigue estando, pero es el destino contable,
            no la forma de encontrarlo. */}
        {(() => {
          const porActividad = new Map<string, typeof delCampana>()
          for (const v of delCampana) {
            const act = actividades.find(a => a.id === v.centro_costo_id)?.nombre ?? "Sin actividad"
            if (!porActividad.has(act)) porActividad.set(act, [])
            porActividad.get(act)!.push(v)
          }
          const orden = Array.from(porActividad.keys()).sort(
            (a, b) => (a === "Sin actividad" ? 1 : 0) - (b === "Sin actividad" ? 1 : 0) || a.localeCompare(b))
          return orden.map(act => (
            <div key={act} className="space-y-1.5">
              <p className="mt-2 text-[11px] font-medium text-gray-500">
                {act === "Sin actividad" ? "Sin actividad asignada" : act}
                <span className="ml-1 font-normal text-gray-400">
                  {porActividad.get(act)!.length}
                </span>
              </p>
              {(() => {
                const grupo = porActividad.get(act)!
                return grupo.map(v => {
            const misAjustes = ajustes[v.id] ?? []
            const r = calcularVariable(v, misAjustes, ctx)
            const open = abierta === v.id
            return (
              <div key={v.id} className="rounded border">
                <button type="button" onClick={() => setAbierta(open ? null : v.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                  {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                  <span className="text-sm font-medium text-gray-800">{v.concepto}</span>
                  {v.unidad && <Badge variant="outline" className="text-[9px]">{v.unidad}</Badge>}
                  <Badge variant="outline" className="text-[9px] text-gray-500">
                    {ETIQUETA_DISTRIBUCION[v.distribucion]}
                  </Badge>
                  {v.pendiente_a_proposito && (
                    <Badge variant="outline" className="border-blue-300 text-[9px] text-blue-700">
                      <Flag className="mr-0.5 h-2.5 w-2.5" /> pendiente a propósito
                    </Badge>
                  )}
                  <span className="ml-auto text-xs font-medium text-gray-700">
                    {r.faltantes.length > 0 && !v.pendiente_a_proposito
                      ? <span className="text-amber-600">sin terminar</span>
                      : pesos(r.monto)}
                  </span>
                </button>

                {open && (
                  <div className="space-y-3 border-t bg-slate-50 px-3 py-3">
                    {/* Qué es */}
                    <div className="flex flex-wrap items-end gap-3">
                      <Campo label="Concepto" ancho="w-56">
                        <Input className="h-7 text-xs" defaultValue={v.concepto}
                          onBlur={e => guardar(v.id, { concepto: e.target.value })} />
                      </Campo>
                      <Campo label="Unidad" ancho="w-28" ayuda="cabeza · ha · ton · litro · jornal · kg novillo">
                        <Input className="h-7 text-xs" defaultValue={v.unidad ?? ""}
                          onBlur={e => guardar(v.id, { unidad: e.target.value || null })} />
                      </Campo>
                      <Campo label="Actividad" ancho="w-40">
                        <select className="h-7 w-full rounded border px-1 text-xs"
                          defaultValue={v.centro_costo_id ?? ""}
                          onChange={e => guardar(v.id, { centro_costo_id: e.target.value || null })}>
                          <option value="">— sin actividad —</option>
                          {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </Campo>
                      {/* Buscador con jerarquía, reusando el selector estándar del proyecto en
                          vez de un <select> con 120 cuentas, que era imposible de usar. */}
                      <Campo label="Alimenta la cuenta" ancho="w-64"
                        ayuda="Si se elige una cuenta, esa cuenta deja de proyectarse por historia: así no se cuenta dos veces.">
                        <SelectorCuentaContable
                          value={cuentas.find(c => c.nro_cuenta === v.nro_cuenta)?.categ ?? null}
                          placeholder="Buscar cuenta…"
                          autoFocus={false}
                          onSelect={cta => guardar(v.id, { nro_cuenta: (cta as any)?.nro_cuenta ?? null })}
                        />
                      </Campo>
                    </div>

                    {/* Cantidad × Precio */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded border bg-white px-2 py-2">
                        <p className="mb-1.5 text-[11px] font-medium text-gray-700">Cantidad</p>
                        <div className="flex flex-wrap items-end gap-2">
                          <Campo label="De dónde sale" ancho="w-44">
                            <select className="h-7 w-full rounded border px-1 text-xs"
                              defaultValue={v.fuente_cantidad}
                              onChange={e => guardar(v.id, { fuente_cantidad: e.target.value as FuenteCantidad })}>
                              {FUENTES_CANT.map(f => (
                                <option key={f} value={f}>{ETIQUETA_FUENTE_CANTIDAD[f]}</option>
                              ))}
                            </select>
                          </Campo>
                          {v.fuente_cantidad === "manual" || v.fuente_cantidad === "dias" ? (
                            <Campo label="Cantidad" ancho="w-24">
                              <Input className="h-7 text-right text-xs"
                                defaultValue={v.cantidad != null ? fmtNumeroAR(v.cantidad, 0) : ""}
                                onBlur={e => guardar(v.id, { cantidad: parseNumeroAR(e.target.value) })} />
                            </Campo>
                          ) : (
                            <>
                            {v.fuente_cantidad === "cabezas" && (
                              <Campo label="¿De qué categoría?" ancho="w-44"
                                ayuda="Sin categoría suma TODO el rodeo. Un costo por vaca no lo consumen los terneros al pie.">
                                <select className="h-7 w-full rounded border px-1 text-xs"
                                  defaultValue={v.categoria_hacienda ?? ""}
                                  onChange={e => guardar(v.id, { categoria_hacienda: e.target.value || null })}>
                                  <option value="">todo el rodeo</option>
                                  {categoriasHacienda.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </Campo>
                            )}
                            <Campo label="× factor" ancho="w-24"
                              ayuda="Ej.: 1 rollo por vaca → factor 1. 9 kg de novillo por cabeza → factor 9.">
                              <Input className="h-7 text-right text-xs"
                                defaultValue={v.factor != null ? fmtNumeroAR(v.factor, 2) : ""}
                                onBlur={e => guardar(v.id, { factor: parseNumeroAR(e.target.value) || null })} />
                            </Campo>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded border bg-white px-2 py-2">
                        <p className="mb-1.5 text-[11px] font-medium text-gray-700">Precio</p>
                        <div className="flex flex-wrap items-end gap-2">
                          <Campo label="De dónde sale" ancho="w-44">
                            <select className="h-7 w-full rounded border px-1 text-xs"
                              defaultValue={v.fuente_precio}
                              onChange={e => guardar(v.id, { fuente_precio: e.target.value as FuentePrecio })}>
                              {FUENTES_PRECIO.map(f => (
                                <option key={f} value={f}>{ETIQUETA_FUENTE_PRECIO[f]}</option>
                              ))}
                            </select>
                          </Campo>
                          {v.fuente_precio === "manual" ? (
                            <Campo label="Precio" ancho="w-28">
                              <Input className="h-7 text-right text-xs" placeholder="0,00"
                                defaultValue={v.precio != null ? fmtNumeroAR(v.precio) : ""}
                                onBlur={e => guardar(v.id, { precio: parseNumeroAR(e.target.value) })} />
                            </Campo>
                          ) : (
                            <Campo label="Referencia" ancho="w-32"
                              ayuda="Qué grano, qué categoría de hacienda o qué insumo.">
                              <Input className="h-7 text-xs" defaultValue={v.referencia_precio ?? ""}
                                onBlur={e => guardar(v.id, { referencia_precio: e.target.value || null })} />
                            </Campo>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* La cadena de ajustes — visible y editable, que es el punto */}
                    <div className="rounded border bg-white px-2 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[11px] font-medium text-gray-700">
                          Ajustes encadenados
                          <span className="ml-1 font-normal text-gray-400">se aplican en orden</span>
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]"
                          onClick={() => agregarAjuste(v.id)}>
                          <Plus className="h-3 w-3" /> Agregar paso
                        </Button>
                      </div>
                      {misAjustes.length === 0 && (
                        <p className="text-[10px] text-gray-400">Sin ajustes: el monto es cantidad × precio.</p>
                      )}
                      <div className="space-y-1">
                        {misAjustes.map(a => (
                          <div key={a.id} className="flex items-center gap-2">
                            <span className="w-4 text-[10px] text-gray-400">{a.orden}.</span>
                            <select className="h-7 w-52 rounded border px-1 text-xs" defaultValue={a.tipo}
                              onChange={e => guardarAjuste(a.id!, { tipo: e.target.value as TipoAjuste })}>
                              {TIPOS_AJUSTE.map(t => <option key={t} value={t}>{ETIQUETA_AJUSTE[t]}</option>)}
                            </select>
                            {a.tipo !== "ipc" && (
                              <>
                                <Input className="h-7 w-20 text-right text-xs" placeholder="0"
                                  defaultValue={a.valor != null ? fmtNumeroAR(a.valor, 1) : ""}
                                  onBlur={e => guardarAjuste(a.id!, { valor: parseNumeroAR(e.target.value) })} />
                                <span className="text-[10px] text-gray-400">%</span>
                              </>
                            )}
                            <Input className="h-7 flex-1 text-xs" placeholder="nota del paso (opcional)"
                              defaultValue={a.nota ?? ""}
                              onBlur={e => guardarAjuste(a.id!, { nota: e.target.value || null })} />
                            <button type="button" onClick={() => borrarAjuste(a.id!)}
                              className="text-gray-300 hover:text-red-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cuándo cae */}
                    <div className="flex flex-wrap items-end gap-3">
                      <Campo label="Cuándo cae" ancho="w-48">
                        <select className="h-7 w-full rounded border px-1 text-xs"
                          defaultValue={v.distribucion}
                          onChange={e => guardar(v.id, { distribucion: e.target.value as Distribucion })}>
                          {DISTRIBUCIONES.map(d => (
                            <option key={d} value={d}>{ETIQUETA_DISTRIBUCION[d]}</option>
                          ))}
                        </select>
                      </Campo>
                      {v.distribucion !== "mensual" && (
                        <div>
                          <label className="block text-[10px] text-gray-500">
                            {v.distribucion === "calendario" ? "Meses" : "Mes"}
                          </label>
                          <div className="flex flex-wrap gap-0.5">
                            {MESES_TXT.map((txt, i) => {
                              const n = i + 1
                              const elegido = (v.meses ?? []).includes(n)
                              return (
                                <button key={n} type="button"
                                  onClick={() => {
                                    const act = v.meses ?? []
                                    const nuevo = v.distribucion === "calendario"
                                      ? (elegido ? act.filter(x => x !== n) : [...act, n].sort((a, b) => a - b))
                                      : [n]
                                    guardar(v.id, { meses: nuevo })
                                  }}
                                  className={`rounded border px-1 py-0.5 text-[9px] ${
                                    elegido ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                                  {txt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* El fundamento: por qué se estimó así */}
                    <Campo label="Fundamento — por qué se estima así" ancho="w-full"
                      ayuda="Dentro de seis meses, un ×30 % sin el porqué es un número que nadie se anima a tocar.">
                      <Input className="h-7 text-xs" defaultValue={v.fundamento ?? ""}
                        placeholder="Ej.: el año pasado se gastó X y este año hay 20 % más de cabezas"
                        onBlur={e => guardar(v.id, { fundamento: e.target.value || null })} />
                    </Campo>

                    {/* Cómo se armó el número */}
                    <div className="rounded border border-blue-200 bg-blue-50/50 px-2 py-1.5">
                      <p className="mb-1 text-[11px] font-medium text-blue-900">Cómo se arma</p>
                      <div className="space-y-0.5">
                        {r.pasos.map((p, i) => (
                          <p key={i} className="text-[10px] text-blue-800">
                            <span className="text-blue-600">{p.etiqueta}:</span> {p.detalle}
                            {i >= 2 && <strong className="ml-1">= {pesos(p.acumulado)}</strong>}
                          </p>
                        ))}
                      </div>
                      {r.faltantes.length > 0 && (
                        <p className="mt-1 text-[10px] text-amber-700">
                          ⚠️ Falta: {r.faltantes.join(" · ")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <input type="checkbox" className="h-3 w-3"
                          defaultChecked={v.pendiente_a_proposito ?? false}
                          onChange={e => guardar(v.id, { pendiente_a_proposito: e.target.checked })} />
                        La dejo sin terminar a propósito
                      </label>
                      <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px] text-red-600"
                        onClick={() => borrar(v.id)}>
                        <Trash2 className="h-3 w-3" /> Borrar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
                )
                })
              })()}
            </div>
          ))
        })()}
      </CardContent>
    </Card>
  )
}

function Campo({ label, ancho, ayuda, children }: {
  label: string; ancho: string; ayuda?: string; children: React.ReactNode
}) {
  return (
    <div className={ancho}>
      <label className="block text-[10px] text-gray-500" title={ayuda}>
        {label}{ayuda && <span className="ml-0.5 text-gray-300">ⓘ</span>}
      </label>
      {children}
    </div>
  )
}
