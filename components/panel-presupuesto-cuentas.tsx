"use client"

// Presupuesto → Cuentas contables.
//
// Una fila por cuenta, con el modo con el que se la presupuesta y los montos que salen de él.
// Se puede abrir cada cuenta para ver **de dónde salió el número**, cambiarle el modo y
// compararlo contra lo que gastó de verdad mes a mes.
//
// Arriba está el control de cordura: no busca precisión, busca que no se escape nada grande.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, Wand2,
} from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  calcularCuenta, sugerirModo, controlarPresupuesto, historiaUtil, esProduccion,
  ETIQUETA_MODO,
  type ModoPresupuesto, type ConfigCuenta, type PuntoHistorico, type CeldaPresupuesto,
} from "@/lib/presupuesto/modos"

const MODOS = Object.keys(ETIQUETA_MODO) as ModoPresupuesto[]
const MESES_TXT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const pesos = (n: number) => (n === 0 ? "—" : `$${Math.round(n).toLocaleString("es-AR")}`)

const COLOR_CONFIANZA: Record<CeldaPresupuesto["confianza"], string> = {
  alta: "text-gray-800",
  media: "text-gray-600",
  baja: "text-gray-400",
}

function mesesDesdeHoy(cantidad: number) {
  const hoy = new Date()
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, label: `${MESES_TXT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}` }
  })
}

export function PanelPresupuestoCuentas() {
  const [cargando, setCargando] = useState(true)
  const [historia, setHistoria] = useState<PuntoHistorico[]>([])
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [cfgs, setCfgs] = useState<Record<string, ConfigCuenta>>({})
  const [inflacion, setInflacion] = useState(0)
  const [inflacionTxt, setInflacionTxt] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const meses = useMemo(() => mesesDesdeHoy(12), [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: hist, error: e1 }, { data: conf, error: e2 }, { data: gen }] = await Promise.all([
        supabase.from("presupuesto_historia_cuentas")
          .select("nro_cuenta, cuenta_contable, anio, mes, monto, facturas, proveedores"),
        supabase.from("presupuesto_cuenta_config").select("*").eq("empresa", "MSA"),
        supabase.from("presupuesto_config").select("inflacion_mensual").eq("empresa", "MSA").maybeSingle(),
      ])
      if (e1 || e2) { alert("Error cargando: " + (e1 || e2)!.message); return }

      const puntos = ((hist || []) as any[]).map(r => ({
        nro_cuenta: String(r.nro_cuenta),
        anio: Number(r.anio), mes: Number(r.mes),
        monto: Number(r.monto) || 0,
        facturas: Number(r.facturas) || 0,
        proveedores: Number(r.proveedores) || 0,
      }))
      setHistoria(puntos)

      const nom: Record<string, string> = {}
      for (const r of ((hist || []) as any[])) {
        if (r.cuenta_contable) nom[String(r.nro_cuenta)] = String(r.cuenta_contable)
      }
      setNombres(nom)

      const mapa: Record<string, ConfigCuenta> = {}
      for (const c of ((conf || []) as any[])) {
        mapa[String(c.nro_cuenta)] = {
          nro_cuenta: String(c.nro_cuenta),
          modo: c.modo as ModoPresupuesto,
          meses_promedio: c.meses_promedio,
          monto_manual: c.monto_manual == null ? null : Number(c.monto_manual),
          cabezas_referencia: c.cabezas_referencia == null ? null : Number(c.cabezas_referencia),
          cabezas_proyectadas: c.cabezas_proyectadas == null ? null : Number(c.cabezas_proyectadas),
          inflacion_mensual: c.inflacion_mensual == null ? null : Number(c.inflacion_mensual),
          motivo_exclusion: c.motivo_exclusion,
          notas: c.notas,
        }
      }
      setCfgs(mapa)
      setInflacion(Number(gen?.inflacion_mensual) || 0)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /** Las cuentas que tienen historia, de mayor a menor gasto. */
  const cuentas = useMemo(() => {
    const total: Record<string, number> = {}
    for (const p of historia) total[p.nro_cuenta] = (total[p.nro_cuenta] || 0) + p.monto
    return Object.keys(total).sort((a, b) => (total[b] || 0) - (total[a] || 0))
  }, [historia])

  /** Config efectiva: la guardada, o la sugerencia si no se tocó. */
  const cfgDe = useCallback((nro: string): ConfigCuenta & { sugerido: boolean; motivo: string } => {
    const guardada = cfgs[nro]
    const sug = sugerirModo(nro, historia)
    if (guardada) return { ...guardada, sugerido: false, motivo: sug.motivo }
    return {
      nro_cuenta: nro, modo: sug.modo,
      meses_promedio: 3,
      motivo_exclusion: esProduccion(nro),
      sugerido: true, motivo: sug.motivo,
    }
  }, [cfgs, historia])

  const presupuesto = useMemo(() => {
    const ctx = { meses, inflacionMensual: inflacion }
    const out: Record<string, CeldaPresupuesto[]> = {}
    for (const nro of cuentas) out[nro] = calcularCuenta(cfgDe(nro), historia, ctx)
    return out
  }, [cuentas, cfgDe, historia, meses, inflacion])

  const control = useMemo(() => {
    const efectivas: Record<string, ConfigCuenta> = {}
    for (const nro of cuentas) efectivas[nro] = cfgDe(nro)
    return controlarPresupuesto(historia, presupuesto, efectivas, nombres)
  }, [historia, presupuesto, cuentas, cfgDe, nombres])

  const totalPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    for (const celdas of Object.values(presupuesto)) {
      for (const c of celdas) t[c.mes] = (t[c.mes] || 0) + c.monto
    }
    return t
  }, [presupuesto])

  // ── Guardado ────────────────────────────────────────────────────────────────

  const guardar = async (nro: string, cambios: Partial<ConfigCuenta>) => {
    const base = cfgDe(nro)
    const v = { ...base, ...cambios }
    setCfgs(prev => ({ ...prev, [nro]: v }))
    const { error } = await supabase.from("presupuesto_cuenta_config").upsert({
      empresa: "MSA", nro_cuenta: nro, modo: v.modo,
      meses_promedio: v.meses_promedio ?? null,
      monto_manual: v.monto_manual ?? null,
      cabezas_referencia: v.cabezas_referencia ?? null,
      cabezas_proyectadas: v.cabezas_proyectadas ?? null,
      inflacion_mensual: v.inflacion_mensual ?? null,
      motivo_exclusion: v.motivo_exclusion ?? null,
      notas: v.notas ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "empresa,nro_cuenta" })
    if (error) { alert("Error: " + error.message); await cargar() }
  }

  const volverASugerido = async (nro: string) => {
    setCfgs(prev => { const n = { ...prev }; delete n[nro]; return n })
    await supabase.from("presupuesto_cuenta_config").delete().eq("empresa", "MSA").eq("nro_cuenta", nro)
  }

  const guardarInflacion = async (v: number) => {
    setInflacion(v)
    await supabase.from("presupuesto_config")
      .upsert({ empresa: "MSA", inflacion_mensual: v, updated_at: new Date().toISOString() },
        { onConflict: "empresa" })
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo la historia de las cuentas…
      </CardContent></Card>
    )
  }

  const histUtil = historiaUtil(historia)
  const ultimoReal = histUtil[histUtil.length - 1]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">📒 Presupuesto de cuentas contables</CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {cuentas.length} cuentas con historia · {histUtil.length > 0 && ultimoReal
                ? `datos hasta ${MESES_TXT[ultimoReal.mes - 1]} ${ultimoReal.anio}`
                : "sin historia"}.
              {" "}El mes en curso no se usa para calcular: está a medio facturar.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Inflación mensual</span>
            <Input className="h-7 w-16 text-right text-xs"
              value={inflacionTxt ?? fmtNumeroAR(inflacion * 100, 1)}
              onChange={e => setInflacionTxt(e.target.value)}
              onBlur={() => {
                if (inflacionTxt === null) return
                guardarInflacion(parseNumeroAR(inflacionTxt) / 100)
                setInflacionTxt(null)
              }} />
            <span className="text-xs text-gray-500">%</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Control de cordura ── */}
        <ControlPanel control={control} />

        {/* ── Tabla ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-medium">Cuenta</th>
                {meses.map(m => (
                  <th key={`${m.anio}-${m.mes}`} className="px-2 py-1.5 text-right font-medium">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-gray-300 bg-gray-100 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-100 px-2 py-1.5">TOTAL</td>
                {meses.map(m => {
                  const k = `${m.anio}-${String(m.mes).padStart(2, "0")}`
                  return <td key={k} className="px-2 py-1.5 text-right">{pesos(totalPorMes[k] || 0)}</td>
                })}
              </tr>

              {cuentas.map(nro => {
                const cfg = cfgDe(nro)
                const celdas = presupuesto[nro] || []
                const abierto = abierta === nro
                const excluida = cfg.modo === "excluida"
                return (
                  <FilaCuenta
                    key={nro}
                    nro={nro}
                    nombre={nombres[nro] || nro}
                    cfg={cfg}
                    celdas={celdas}
                    meses={meses}
                    abierto={abierto}
                    excluida={excluida}
                    historia={historia.filter(p => p.nro_cuenta === nro)}
                    onToggle={() => setAbierta(abierto ? null : nro)}
                    onGuardar={c => guardar(nro, c)}
                    onSugerido={() => volverASugerido(nro)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Control ───────────────────────────────────────────────────────────────────

function ControlPanel({ control }: { control: ReturnType<typeof controlarPresupuesto> }) {
  const [ver, setVer] = useState(true)
  const sano = control.alertas.length === 0
  return (
    <div className={`rounded border p-2.5 ${sano ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50/60"}`}>
      <button type="button" className="flex w-full items-center gap-2 text-left"
        onClick={() => setVer(!ver)}>
        {sano
          ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
        <span className="text-sm font-medium text-gray-800">
          {sano ? "El presupuesto cierra contra la realidad" : `${control.alertas.length} cosas para mirar`}
        </span>
        <span className="text-xs text-gray-500">
          presupuestás <strong>${Math.round(control.presupuestadoPromedioMes).toLocaleString("es-AR")}</strong>/mes
          {" "}contra <strong>${Math.round(control.realPromedioMes).toLocaleString("es-AR")}</strong>/mes reales
          {" "}({control.variacion > 0 ? "+" : ""}{Math.round(control.variacion * 100)} %)
        </span>
        {ver ? <ChevronDown className="ml-auto h-4 w-4 text-gray-400" /> : <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />}
      </button>

      {ver && control.alertas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {control.alertas.map((a, i) => (
            <li key={i} className="flex gap-2 text-[11px]">
              <span className={a.nivel === "alta" ? "text-red-600" : "text-amber-600"}>●</span>
              <span>
                <strong className="text-gray-800">{a.titulo}.</strong>{" "}
                <span className="text-gray-600">{a.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {ver && sano && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          Comparado contra los últimos {control.mesesReales} meses cerrados. No mira precisión:
          mira que no se escape nada grande.
        </p>
      )}
    </div>
  )
}

// ── Fila ──────────────────────────────────────────────────────────────────────

function FilaCuenta({
  nro, nombre, cfg, celdas, meses, abierto, excluida, historia, onToggle, onGuardar, onSugerido,
}: {
  nro: string
  nombre: string
  cfg: ConfigCuenta & { sugerido: boolean; motivo: string }
  celdas: CeldaPresupuesto[]
  meses: { anio: number; mes: number; label: string }[]
  abierto: boolean
  excluida: boolean
  historia: PuntoHistorico[]
  onToggle: () => void
  onGuardar: (c: Partial<ConfigCuenta>) => void
  onSugerido: () => void
}) {
  const porMes = new Map(celdas.map(c => [c.mes, c]))
  const hist = historiaUtil(historia)
  const totalHist = hist.reduce((s, p) => s + p.monto, 0)

  return (
    <>
      <tr className={`border-b hover:bg-gray-50 ${excluida ? "opacity-50" : ""}`}
        onClick={onToggle}>
        <td className="sticky left-0 z-10 cursor-pointer bg-white px-2 py-1.5">
          <div className="flex items-center gap-1">
            {abierto ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />}
            <span className="text-gray-700">{nombre}</span>
            <Badge variant="outline"
              className={`ml-1 text-[9px] ${cfg.sugerido ? "border-dashed text-gray-400" : "text-gray-600"}`}>
              {ETIQUETA_MODO[cfg.modo]}{cfg.sugerido ? " (auto)" : ""}
            </Badge>
          </div>
        </td>
        {meses.map(m => {
          const k = `${m.anio}-${String(m.mes).padStart(2, "0")}`
          const c = porMes.get(k)
          return (
            <td key={k} className={`cursor-pointer px-2 py-1.5 text-right ${c ? COLOR_CONFIANZA[c.confianza] : "text-gray-300"}`}
              title={c?.explicacion}>
              {c ? pesos(c.monto) : "—"}
            </td>
          )
        })}
      </tr>

      {abierto && (
        <tr className="border-b bg-slate-50">
          <td colSpan={meses.length + 1} className="px-3 py-3">
            <div className="space-y-3">
              {/* De dónde salió el número */}
              <div className="rounded border border-blue-200 bg-blue-50/50 px-2 py-1.5">
                <p className="text-[11px] text-blue-900">
                  <strong>Cómo se calculó:</strong>{" "}
                  {celdas[0]?.explicacion || "sin cálculo"}
                </p>
                {cfg.sugerido && (
                  <p className="mt-0.5 text-[10px] text-blue-700">
                    Modo elegido automáticamente — {cfg.motivo}
                  </p>
                )}
              </div>

              {/* Cambiar el modo */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[10px] text-gray-500">Modo</label>
                  <select className="h-7 rounded border border-gray-200 px-1 text-xs"
                    value={cfg.modo}
                    onChange={e => onGuardar({ modo: e.target.value as ModoPresupuesto })}>
                    {MODOS.map(m => <option key={m} value={m}>{ETIQUETA_MODO[m]}</option>)}
                  </select>
                </div>

                {cfg.modo === "promedio_n" && (
                  <div>
                    <label className="text-[10px] text-gray-500">Meses a promediar</label>
                    <Input className="h-7 w-16 text-right text-xs"
                      defaultValue={String(cfg.meses_promedio ?? 3)}
                      onBlur={e => onGuardar({ meses_promedio: Math.max(1, Math.round(parseNumeroAR(e.target.value))) })} />
                  </div>
                )}
                {cfg.modo === "manual" && (
                  <div>
                    <label className="text-[10px] text-gray-500">Monto por mes</label>
                    <Input className="h-7 w-28 text-right text-xs"
                      defaultValue={fmtNumeroAR(cfg.monto_manual ?? 0)}
                      onBlur={e => onGuardar({ monto_manual: parseNumeroAR(e.target.value) })} />
                  </div>
                )}
                {cfg.modo === "por_cabeza" && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500">Cabezas en el histórico</label>
                      <Input className="h-7 w-20 text-right text-xs"
                        defaultValue={fmtNumeroAR(cfg.cabezas_referencia ?? 0, 0)}
                        onBlur={e => onGuardar({ cabezas_referencia: parseNumeroAR(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Cabezas proyectadas</label>
                      <Input className="h-7 w-20 text-right text-xs"
                        defaultValue={fmtNumeroAR(cfg.cabezas_proyectadas ?? 0, 0)}
                        onBlur={e => onGuardar({ cabezas_proyectadas: parseNumeroAR(e.target.value) })} />
                    </div>
                  </>
                )}
                {cfg.modo === "excluida" && (
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Por qué no se presupuesta</label>
                    <Input className="h-7 text-xs"
                      defaultValue={cfg.motivo_exclusion ?? ""}
                      onBlur={e => onGuardar({ motivo_exclusion: e.target.value })} />
                  </div>
                )}

                {!cfg.sugerido && (
                  <button type="button" className="flex items-center gap-1 text-[11px] text-blue-600 underline"
                    onClick={onSugerido}>
                    <Wand2 className="h-3 w-3" /> volver al automático
                  </button>
                )}
              </div>

              {/* La historia real, para poder comparar contra el presupuesto */}
              <div>
                <p className="mb-1 text-[10px] font-medium text-gray-600">
                  Lo que gastó de verdad — {hist.length} meses cerrados, total ${Math.round(totalHist).toLocaleString("es-AR")}
                </p>
                {hist.length === 0 ? (
                  <p className="text-[11px] text-gray-400">Sin historia.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {hist.map(p => (
                      <span key={`${p.anio}-${p.mes}`}
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          p.monto < 0 ? "bg-red-100 text-red-700" : "bg-white text-gray-600"}`}
                        title={`${p.facturas} ${p.facturas === 1 ? "factura" : "facturas"} · ${p.proveedores} ${p.proveedores === 1 ? "proveedor" : "proveedores"}`}>
                        {MESES_TXT[p.mes - 1]}-{String(p.anio).slice(-2)}:{" "}
                        <strong>${Math.round(p.monto).toLocaleString("es-AR")}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
