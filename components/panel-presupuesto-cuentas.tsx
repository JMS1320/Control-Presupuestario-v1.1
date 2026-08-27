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
  Loader2, ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, Wand2, RefreshCw,
} from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { SeccionMetodosTemplates } from "@/components/seccion-metodos-templates"
// La muestra vive aparte: la usan esta pantalla Y el margen. Ver `muestra-del-calculo.tsx`.
import { MuestraDelCalculo, etiquetaClave } from "@/components/muestra-del-calculo"
import {
  calcularCuenta, sugerirModo, controlarPresupuesto, historiaUtil, esProduccion, netearExcluidos,
  ETIQUETA_MODO,
  type ModoPresupuesto, type ConfigCuenta, type PuntoHistorico, type CeldaPresupuesto,
  type PuntoMuestra,
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

/**
 * `onCambio` — se dispara cuando cambió algo que el PRESUPUESTO tiene que volver a leer.
 *
 * Este panel y la grilla del presupuesto son componentes hermanos, así que un cambio acá no
 * llegaba allá: había que salir de la pestaña y volver. Se avisa al guardar una cuenta, al
 * volver a la sugerencia y al tocar Actualizar.
 */
export function PanelPresupuestoCuentas({ onCambio }: { onCambio?: () => void } = {}) {
  const [cargando, setCargando] = useState(true)
  const [historia, setHistoria] = useState<PuntoHistorico[]>([])
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [cfgs, setCfgs] = useState<Record<string, ConfigCuenta>>({})
  const [inflacion, setInflacion] = useState(0)
  /**
   * De dónde sale la historia. Son dos maneras legítimas de mirar lo mismo y el usuario
   * presupuestó años con la segunda; ver el dossier en PENDIENTES.
   */
  const [fuente, setFuente] = useState<"facturas" | "canales">("facturas")
  const [ipc, setIpc] = useState<{ anio: number; mes: number; valor: number }[]>([])
  const [cobertura, setCobertura] = useState<any[]>([])
  /** Historia abierta por proveedor: para descontar CUITs y ver de qué se compone la cuenta. */
  const [porProveedor, setPorProveedor] = useState<FilaProveedorCuenta[]>([])
  const [inflacionTxt, setInflacionTxt] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const meses = useMemo(() => mesesDesdeHoy(12), [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const vista = fuente === "facturas"
        ? "presupuesto_historia_cuentas" : "presupuesto_historia_canales"
      const cols = fuente === "facturas"
        ? "nro_cuenta, cuenta_contable, anio, mes, monto, facturas, proveedores"
        : "nro_cuenta, cuenta_contable, anio, mes, monto, movimientos, canales"

      const [{ data: hist, error: e1 }, { data: conf, error: e2 }, { data: gen },
             { data: ip }, { data: cob }] = await Promise.all([
        supabase.from(vista).select(cols),
        supabase.from("presupuesto_cuenta_config").select("*").eq("empresa", "MSA"),
        supabase.from("presupuesto_config").select("inflacion_mensual").eq("empresa", "MSA").maybeSingle(),
        supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
        supabase.from("presupuesto_cobertura_canales").select("*"),
      ])
      // Sólo la fuente por facturas tiene CUIT; los canales no lo traen.
      const { data: pp } = fuente === "facturas"
        ? await supabase.from("presupuesto_historia_cuenta_proveedor")
            .select("nro_cuenta, cuit, proveedor, anio, mes, monto, facturas")
        : { data: [] as any[] }
      setPorProveedor(((pp || []) as any[]).map(r => ({
        nro_cuenta: String(r.nro_cuenta), cuit: String(r.cuit ?? ""),
        proveedor: String(r.proveedor ?? ""), anio: Number(r.anio), mes: Number(r.mes),
        monto: Number(r.monto) || 0, facturas: Number(r.facturas) || 0,
      })))
      if (e1 || e2) { alert("Error cargando: " + (e1 || e2)!.message); return }

      const puntos = ((hist || []) as any[]).map(r => ({
        nro_cuenta: String(r.nro_cuenta),
        anio: Number(r.anio), mes: Number(r.mes),
        monto: Number(r.monto) || 0,
        facturas: Number(r.facturas ?? r.movimientos) || 0,
        proveedores: Number(r.proveedores ?? r.canales) || 0,
      }))
      setIpc(((ip || []) as any[]).map(r => ({
        anio: Number(r.anio), mes: Number(r.mes), valor: Number(r.valor_ipc) || 0,
      })))
      setCobertura((cob || []) as any[])
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
          cuits_excluidos: (c.cuits_excluidos as string[] | null) ?? [],
          motivo_exclusion: c.motivo_exclusion,
          notas: c.notas,
        }
      }
      setCfgs(mapa)
      setInflacion(Number(gen?.inflacion_mensual) || 0)
    } finally { setCargando(false) }
  }, [fuente])

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

  /**
   * Historia neta de los proveedores excluidos.
   *
   * Se resta el gasto del CUIT que ya entra por template en vez de anular la cuenta: así
   * un proveedor nuevo en esa misma cuenta se presupuesta solo.
   */
  const historiaNeta = useMemo(() => {
    const excluidos: Record<string, string[]> = {}
    for (const nro of cuentas) {
      const l = cfgDe(nro).cuits_excluidos ?? []
      if (l.length > 0) excluidos[nro] = l
    }
    return netearExcluidos(historia, porProveedor, excluidos)
  }, [historia, porProveedor, cuentas, cfgDe])

  const presupuesto = useMemo(() => {
    // Si hay IPC cargado manda la serie (con arrastre); si no, la tasa fija.
    const ctx = { meses, inflacionMensual: inflacion, ipc: ipc.length > 0 ? ipc : undefined }
    const out: Record<string, CeldaPresupuesto[]> = {}
    for (const nro of cuentas) out[nro] = calcularCuenta(cfgDe(nro), historiaNeta, ctx)
    return out
  }, [cuentas, cfgDe, historiaNeta, meses, inflacion, ipc])

  const control = useMemo(() => {
    const efectivas: Record<string, ConfigCuenta> = {}
    for (const nro of cuentas) efectivas[nro] = cfgDe(nro)
    return controlarPresupuesto(historiaNeta, presupuesto, efectivas, nombres)
  }, [historiaNeta, presupuesto, cuentas, cfgDe, nombres])

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
      cuits_excluidos: v.cuits_excluidos ?? [],
      motivo_exclusion: v.motivo_exclusion ?? null,
      notas: v.notas ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "empresa,nro_cuenta" })
    if (error) { alert("Error: " + error.message); await cargar(); return }
    onCambio?.()
  }

  const volverASugerido = async (nro: string) => {
    setCfgs(prev => { const n = { ...prev }; delete n[nro]; return n })
    await supabase.from("presupuesto_cuenta_config").delete().eq("empresa", "MSA").eq("nro_cuenta", nro)
    onCambio?.()
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

  // IPC acumulado de los últimos 12 meses cargados. Es el número con el que el usuario compara
  // cuando decide si una suba de proveedor es cara o barata: ver "IPC cargado (14 meses)" no
  // dice nada, ver "últimos 12 meses: 87,4 %" sí.
  const ipc12 = (() => {
    if (ipc.length === 0) return null
    const ord = [...ipc].sort((a, b) => (a.anio * 12 + a.mes) - (b.anio * 12 + b.mes))
    const ultimos = ord.slice(-12)
    const factor = ultimos.reduce((f, p) => f * (1 + (p.valor || 0) / 100), 1)
    return { pct: (factor - 1) * 100, meses: ultimos.length, hasta: ultimos[ultimos.length - 1]! }
  })()

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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Desde</span>
              {(["facturas", "canales"] as const).map(f => (
                <button key={f} type="button" onClick={() => setFuente(f)}
                  className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                    fuente === f ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                  {f === "facturas" ? "Facturas" : "Canales de pago"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">
              {ipc.length > 0 ? "IPC cargado · tasa fija" : "Inflación mensual"}
            </span>
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
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
              onClick={async () => { await cargar(); onCambio?.() }} disabled={cargando}
              title="Volver a leer la historia, la configuración y el IPC — y refrescar también la grilla del presupuesto">
              <RefreshCw className={`h-3 w-3 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {fuente === "canales" && <AvisoCobertura cobertura={cobertura} />}
        {ipc.length > 0 && (
          <p className="text-[11px] text-gray-500">
            La inflación sale del <strong>IPC cargado</strong> ({ipc.length}{" "}
            {ipc.length === 1 ? "mes" : "meses"}), arrastrando el último valor hacia adelante.
            La tasa fija de arriba sólo se usa donde no hay IPC.
            {ipc12 && (
              <>
                {" · "}
                <strong className="text-gray-700">
                  IPC {ipc12.meses === 12 ? "de los últimos 12 meses" : `de ${ipc12.meses} meses`}:{" "}
                  {fmtNumeroAR(ipc12.pct, 1)} %
                </strong>{" "}
                (hasta {MESES_TXT[ipc12.hasta.mes - 1]} {ipc12.hasta.anio})
              </>
            )}
          </p>
        )}
        {ipc.length === 0 && (
          <p className="text-[11px] text-amber-700">
            ⚠️ No hay IPC cargado: se usa la tasa fija de arriba para todo. El IPC se carga en{" "}
            <strong>Precios y TC</strong>.
          </p>
        )}

        {/* ── Control de cordura ── */}
        <ControlPanel control={control} />

        {/* ── Tabla ── */}
        {/* Ver la nota del mismo caso en tab-presupuesto: `sticky top-0` necesita que el scroll
            vertical ocurra DENTRO de este contenedor, y con `overflow-x-auto` solo el div crecía
            con el contenido y nunca scrolleaba vertical. */}
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs">
            <thead>
              {/* Encabezado pegado arriba: con 12 meses y decenas de cuentas, al scrollear se
                  perdía contra qué mes se está mirando el número. La esquina (Cuenta) queda
                  pegada arriba Y a la izquierda, por eso necesita el z mayor. */}
              <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                <th className="sticky left-0 top-0 z-30 bg-gray-50 px-2 py-1.5 text-left font-medium">Cuenta</th>
                {meses.map(m => (
                  <th key={`${m.anio}-${m.mes}`} className="sticky top-0 z-20 bg-gray-50 px-2 py-1.5 text-right font-medium">{m.label}</th>
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
                    historia={historiaNeta.filter(p => p.nro_cuenta === nro)}
                    proveedores={porProveedor.filter(p => p.nro_cuenta === nro)}
                    onToggle={() => setAbierta(abierto ? null : nro)}
                    onGuardar={c => guardar(nro, c)}
                    onSugerido={() => volverASugerido(nro)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Los templates son la otra mitad de "cómo se llena el presupuesto". Van acá y no en
            otro botón porque son la misma pregunta. */}
        <div className="border-t pt-3">
          <SeccionMetodosTemplates
            meses={meses.map(m => ({ anio: m.anio, mes: m.mes }))}
            ipc={ipc}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Cuánto de cada canal está conciliado.
 *
 * Sin esto la fuente "canales" miente por omisión: muestra sólo los movimientos que tienen
 * cuenta imputada, así que parece que se gastó mucho menos de lo que se gastó.
 */
function AvisoCobertura({ cobertura }: { cobertura: any[] }) {
  const total = cobertura.reduce((s, c) => s + (Number(c.debitos_total) || 0), 0)
  const imputado = cobertura.reduce((s, c) => s + (Number(c.debitos_imputados) || 0), 0)
  const pct = total > 0 ? imputado / total : 0
  const flojo = pct < 0.8
  return (
    <div className={`rounded border p-2.5 text-xs ${
      flojo ? "border-amber-300 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/50"}`}>
      <p className={flojo ? "text-amber-900" : "text-emerald-900"}>
        <strong>Conciliación: {Math.round(pct * 100)} % del gasto tiene cuenta imputada.</strong>{" "}
        {flojo
          ? "Con esta cobertura la vista por canales muestra menos de lo que se gastó — falta conciliar. Para presupuestar hoy conviene la fuente por facturas."
          : "La cobertura alcanza para presupuestar desde acá."}
      </p>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-600">
        {cobertura.map(c => {
          const t = Number(c.debitos_total) || 0
          const i = Number(c.debitos_imputados) || 0
          return (
            <span key={c.canal}>
              {c.canal}: <strong>{t > 0 ? Math.round((i / t) * 100) : 0} %</strong>
              <span className="text-gray-400"> ({c.imputados}/{c.movimientos} mov.)</span>
            </span>
          )
        })}
      </div>
    </div>
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
  nro, nombre, cfg, celdas, meses, abierto, excluida, historia, proveedores, onToggle, onGuardar, onSugerido,
}: {
  nro: string
  nombre: string
  cfg: ConfigCuenta & { sugerido: boolean; motivo: string }
  celdas: CeldaPresupuesto[]
  meses: { anio: number; mes: number; label: string }[]
  abierto: boolean
  excluida: boolean
  historia: PuntoHistorico[]
  proveedores: FilaProveedorCuenta[]
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
                <MuestraDelCalculo celdas={celdas} modo={cfg.modo} />
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
                    <label className="text-[10px] text-gray-500">Por qué no se proyecta</label>
                    <Input className="h-7 text-xs"
                      defaultValue={cfg.motivo_exclusion ?? ""}
                      onBlur={e => onGuardar({ motivo_exclusion: e.target.value })} />
                    {/* La distinción que faltaba (A-DEC-04): excluida es de la PROYECCIÓN.
                        La historia son facturas reales y se sigue viendo — esconderlas es peor
                        que duplicarlas, porque de un lado se ve el error y del otro no. */}
                    <p className="mt-1 text-[10px] text-gray-500">
                      Excluida <strong>sólo hacia adelante</strong>: la proyección la aporta el
                      plan productivo. <strong>Lo ya gastado se sigue viendo</strong> — son
                      facturas reales.
                    </p>
                  </div>
                )}

                {!cfg.sugerido && (
                  <button type="button" className="flex items-center gap-1 text-[11px] text-blue-600 underline"
                    onClick={onSugerido}>
                    <Wand2 className="h-3 w-3" /> volver al automático
                  </button>
                )}
              </div>

              {/* De qué se compone la cuenta. Es lo que decide qué modo le sirve, y donde se
                  saca de la cuenta a un proveedor que ya entra por template. */}
              {proveedores.length > 0 && (
                <ComposicionCuenta
                  proveedores={proveedores}
                  excluidos={cfg.cuits_excluidos ?? []}
                  onExcluir={cuits => onGuardar({ cuits_excluidos: cuits })}
                />
              )}

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

// ── Composición de la cuenta ──────────────────────────────────────────────────

export interface FilaProveedorCuenta {
  nro_cuenta: string
  cuit: string
  proveedor: string
  anio: number
  mes: number
  monto: number
  facturas: number
}

/**
 * Quién compone la cuenta, y quién queda afuera del presupuesto.
 *
 * Sacar a un proveedor NO es lo mismo que anular la cuenta: cuando algo ya entra por template
 * (Federación Patronal factura semestral y se paga en cuotas) hay que descontar ese proveedor
 * y dejar viva la cuenta, para que un proveedor nuevo se presupueste solo en vez de
 * desaparecer sin que nadie se entere.
 */
function ComposicionCuenta({ proveedores, excluidos, onExcluir }: {
  proveedores: FilaProveedorCuenta[]
  excluidos: string[]
  onExcluir: (cuits: string[]) => void
}) {
  const porCuit = new Map<string, { proveedor: string; total: number; meses: Set<string>; fc: number }>()
  for (const p of proveedores) {
    const a = porCuit.get(p.cuit) ?? { proveedor: p.proveedor, total: 0, meses: new Set<string>(), fc: 0 }
    a.total += p.monto
    a.meses.add(`${p.anio}-${p.mes}`)
    a.fc += p.facturas
    porCuit.set(p.cuit, a)
  }
  const lista = [...porCuit.entries()].sort((a, b) => b[1].total - a[1].total)
  const set = new Set(excluidos)
  // Un CUIT excluido que ya no aparece: la exclusión quedó colgada
  const huerfanos = excluidos.filter(c => !porCuit.has(c))

  const toggle = (cuit: string) => {
    const n = new Set(set)
    if (n.has(cuit)) n.delete(cuit); else n.add(cuit)
    onExcluir([...n])
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-medium text-gray-600">
        Se compone de {lista.length} {lista.length === 1 ? "proveedor" : "proveedores"}
        {set.size > 0 && <span className="text-amber-700"> · {set.size} fuera del presupuesto</span>}
      </p>
      <table className="w-full text-[11px]">
        <tbody>
          {lista.map(([cuit, v]) => {
            const fuera = set.has(cuit)
            return (
              <tr key={cuit} className={`border-b border-gray-100 last:border-0 ${fuera ? "opacity-50" : ""}`}>
                <td className="py-0.5">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={!fuera} onChange={() => toggle(cuit)}
                      className="h-3 w-3" title="Destildar = no se presupuesta acá (ya entra por otro lado)" />
                    <span className={fuera ? "line-through" : "text-gray-700"}>{v.proveedor}</span>
                    {fuera && <span className="text-[9px] text-amber-700">va por otro lado</span>}
                  </label>
                </td>
                <td className="py-0.5 text-right text-gray-500">
                  {v.meses.size} {v.meses.size === 1 ? "mes" : "meses"} · {v.fc} fc
                </td>
                <td className="py-0.5 text-right text-gray-700">
                  ${Math.round(v.total).toLocaleString("es-AR")}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {huerfanos.length > 0 && (
        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
          {huerfanos.length} CUIT excluido sin facturas en el período: la exclusión puede haber
          quedado colgada.
        </p>
      )}
      {set.size > 0 && lista.length > set.size && (
        <p className="mt-1 text-[10px] text-gray-500">
          La cuenta sigue presupuestándose con los {lista.length - set.size} proveedores restantes.
        </p>
      )}
    </div>
  )
}
