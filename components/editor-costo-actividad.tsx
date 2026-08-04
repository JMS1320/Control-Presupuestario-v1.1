"use client"

// El editor de UN costo directo, para desplegar dentro de la fila del margen.
//
// Lo pidió el usuario así: *"cada línea desplegable o colapsable. Desplegable para ver cómo se
// llega al nro y editable. Colapsada muestra el nro final."* La idea de fondo es que el margen
// deje de ser sólo un reporte y pase a ser **el lugar donde se trabajan los costos de producción**,
// sin tener que saltar a otra pantalla para cambiar un número que estás mirando.
//
// ── Lo que se edita acá ──────────────────────────────────────────────────────
// Lo que es propio DEL COSTO: cuánto vale, sobre qué se aplica, en cuántos años se reparte, y la
// cadena de ajustes. Lo que NO se edita acá es el planteo productivo —ganancia diaria, % de
// ración, tramos—, que es de la actividad y el margen consume igual que consume las hectáreas.
//
// ── La cadena ────────────────────────────────────────────────────────────────
// Un costo puede ser un número fijo (30 U$S por vaca) o una cuenta:
// *"lo de los últimos 12 meses × IPC × el aumento de cabezas"*. Los pasos se agregan acá y el
// cálculo lo hace `aplicarAjustes()`, la MISMA función que usa el presupuesto — si hubiera dos,
// el margen y el presupuesto darían distinto sobre el mismo costo.

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { ETIQUETA_AJUSTE, type Ajuste, type TipoAjuste, type Paso } from "@/lib/presupuesto/variables"
import { ETIQUETA_BASE_CABEZAS, type CeldaPresupuesto } from "@/lib/presupuesto/margen"
import { BANDAS_HACIENDA } from "@/lib/ganaderia/calculo"
// La muestra es la MISMA que la de cuentas contables — el usuario la pidió acá también.
import { MuestraDelCalculo } from "@/components/muestra-del-calculo"
import type { ModoPresupuesto } from "@/lib/presupuesto/modos"

/** Los modos que el margen sabe resolver. Los de ración se editan en la actividad. */
const MODOS_DEL_MARGEN: { valor: string; etiqueta: string }[] = [
  { valor: "monto_cabeza", etiqueta: "por cabeza" },
  { valor: "monto_ha", etiqueta: "por hectárea" },
  { valor: "monto_unidad", etiqueta: "cantidad × precio (ton, lts, rollos)" },
]

const MOMENTOS: { valor: string; etiqueta: string }[] = [
  { valor: "ciclo", etiqueta: "en el ciclo (se prorratea)" },
  { valor: "inicio", etiqueta: "al empezar" },
  { valor: "fin", etiqueta: "al terminar" },
  { valor: "mensual", etiqueta: "todos los meses" },
]

export interface CostoEditable {
  id: string
  concepto: string
  modo: string
  valor: number
  unidad: string | null
  moneda: string
  momento: string
  has_aplicacion: number | null
  amortiza_anios: number | null
  base_cabezas: string | null
  cabezas_aplicacion: number | null
  cantidad_aplicacion: number | null
  fundamento: string | null
  notas: string | null
  ajustes: Ajuste[]

  // ── El modelo de 3 ranuras ──────────────────────────────────────────────────
  cantidad: number | null
  cantidad_unidad: string | null
  precio_fuente: string | null
  precio_referencia: string | null
  base_tipo: string | null
  base_categorias: string[] | null
  base_manual: number | null
  historico_modo: string | null
  historico_meses: number | null
  nro_cuentas: string[] | null
  distribucion: string | null
  meses_pct: Record<string, number> | null
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Los meses en orden de CAMPAÑA: jul → jun.
 *
 * Lo pidió el usuario y tiene razón: la campaña va de julio a junio, así que mostrarlos de enero
 * a diciembre obliga a leer la grilla salteado para entender cuándo cae un gasto.
 */
const MESES_CAMPANA = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

/** Las categorías del rodeo que se pueden tildar. La suma sin operador. */
const CATEGORIAS_BASE = ['vacas', 'vaquillonas', 'toritos', 'destetados', 'terneros', 'terneras', 'retenidas']

const BASES: { valor: string; etiqueta: string }[] = [
  { valor: 'cabezas', etiqueta: 'Cabezas del rodeo' },
  { valor: 'hectareas', etiqueta: 'Hectáreas' },
  { valor: 'cantidad', etiqueta: 'Una cantidad fija (ton, lts, rollos)' },
  { valor: 'ninguna', etiqueta: 'Nada — el precio ya es el total' },
]

const FUENTES_PRECIO: { valor: string; etiqueta: string }[] = [
  { valor: 'manual', etiqueta: 'Un número que pongo yo' },
  { valor: 'hacienda', etiqueta: 'Precio de hacienda ($/kg)' },
  { valor: 'historico', etiqueta: 'Lo ya gastado (histórico)' },
]

const MODOS_HISTORICO: { valor: string; etiqueta: string }[] = [
  { valor: 'promedio_n', etiqueta: 'Promedio de los últimos N meses' },
  { valor: 'estacional', etiqueta: 'Mismo mes del año anterior' },
  { valor: 'ultima_fc', etiqueta: 'Propagar la última factura' },
  { valor: 'por_cabeza', etiqueta: '$/cabeza histórico × cabezas proyectadas' },
]

export function EditorCostoActividad({
  costo, pasos, cuentas = [], bandasConPrecio = [], celdas, mesesPeriodo = [],
  onCargarPrecio, onGuardado,
}: {
  costo: CostoEditable
  /** Los meses de la campaña, en orden jul → jun, con su año. */
  mesesPeriodo?: { anio: number; mes: number }[]
  /** Cómo se llegó al número, ya calculado por el margen. */
  pasos?: Paso[]
  /** Las cuentas contables con historia, para elegir en cuáles basarse. */
  cuentas?: { nro: string; nombre: string }[]
  /** Qué bandas de hacienda tienen precio cargado, para no ofrecer las vacías en silencio. */
  bandasConPrecio?: string[]
  /** Las facturas reales que entraron, cuando el arranque es histórico. */
  celdas?: CeldaPresupuesto[]
  onCargarPrecio?: (banda: string) => void
  onGuardado: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [borrador, setBorrador] = useState<CostoEditable>(() => conTresRanuras(costo))
  const sucio = JSON.stringify(borrador) !== JSON.stringify(costo)

  // Al recargar el margen llega un `costo` nuevo (mismo dato, otro objeto). Sin esto el borrador
  // se quedaba con el estado viejo y la fila mostraba "hay cambios sin guardar" recién guardada.
  useEffect(() => { setBorrador(conTresRanuras(costo)) }, [JSON.stringify(costo)])

  /** Los de ración no se editan acá: dependen de la curva de peso y los tramos. */
  const enModoRacion = !borrador.base_tipo
    && ['pct_racion', 'kg_cabeza_dia', 'unid_cabeza_mes', 'dosis_cada_kg'].includes(borrador.modo)

  const sumaPct = Object.values(borrador.meses_pct ?? {}).reduce((s, v) => s + (Number(v) || 0), 0)

  const kmHoy = new Date().getFullYear() * 12 + new Date().getMonth()
  /** Qué % del costo cae en meses que ya pasaron: eso NO se proyecta. */
  const pctPasado = sumaPct > 0
    ? mesesPeriodo
        .filter(p => (p.anio * 12 + p.mes - 1) < kmHoy)
        .reduce((s, p) => s + (Number(borrador.meses_pct?.[String(p.mes)]) || 0), 0) / sumaPct * 100
    : 0

  const set = <K extends keyof CostoEditable>(k: K, v: CostoEditable[K]) =>
    setBorrador(b => ({ ...b, [k]: v }))

  const guardar = async () => {
    setGuardando(true)
    try {
      const { error } = await supabase.schema("productivo").from("actividad_insumos").update({
        modo: borrador.modo,
        valor: borrador.valor,
        unidad: borrador.unidad,
        moneda: borrador.moneda,
        momento: borrador.momento,
        // El precio unitario duplicaba el valor en los modos de monto directo; se mantienen
        // alineados para que Productivo y el margen no lean cosas distintas.
        precio_unitario: borrador.valor,
        has_aplicacion: borrador.has_aplicacion,
        amortiza_anios: borrador.amortiza_anios,
        base_cabezas: borrador.base_cabezas,
        cabezas_aplicacion: borrador.cabezas_aplicacion,
        cantidad_aplicacion: borrador.cantidad_aplicacion,
        fundamento: borrador.fundamento,
        // El modelo de 3 ranuras
        cantidad: borrador.cantidad,
        cantidad_unidad: borrador.cantidad_unidad,
        precio_fuente: borrador.precio_fuente,
        precio_referencia: borrador.precio_referencia,
        base_tipo: borrador.base_tipo,
        base_categorias: borrador.base_categorias,
        base_manual: borrador.base_manual,
        historico_modo: borrador.historico_modo,
        historico_meses: borrador.historico_meses,
        nro_cuentas: borrador.nro_cuentas,
        distribucion: borrador.distribucion,
        meses_pct: borrador.meses_pct,
        updated_at: new Date().toISOString(),
      }).eq("id", costo.id)
      if (error) { alert("Error al guardar: " + error.message); return }
      onGuardado()
    } finally { setGuardando(false) }
  }

  const agregarAjuste = async () => {
    const { error } = await supabase.schema("productivo").from("actividad_insumo_ajustes").insert({
      insumo_id: costo.id,
      orden: (costo.ajustes.length ? Math.max(...costo.ajustes.map(a => a.orden)) : 0) + 1,
      tipo: "porcentaje", valor: 0,
    })
    if (error) { alert("Error: " + error.message); return }
    onGuardado()
  }

  const guardarAjuste = async (id: string, cambios: Partial<Ajuste>) => {
    const { error } = await supabase.schema("productivo").from("actividad_insumo_ajustes")
      .update(cambios).eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    onGuardado()
  }

  const borrarAjuste = async (id: string) => {
    const { error } = await supabase.schema("productivo").from("actividad_insumo_ajustes")
      .delete().eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    onGuardado()
  }

  return (
    <div className="space-y-2 border-t bg-white px-3 py-2.5">
      {/* ── Cómo se arma el número ───────────────────────────────────────── */}
      {pasos && pasos.length > 0 && (
        <div className="rounded border bg-slate-50 px-2 py-1.5">
          <p className="mb-0.5 text-[9px] uppercase tracking-wide text-gray-500">Cómo se arma</p>
          <table className="w-full text-[10px]">
            <tbody>
              {pasos.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-0.5 pr-2 text-gray-600">{p.etiqueta}</td>
                  <td className="py-0.5 pr-2 text-gray-400">{p.detalle}</td>
                  <td className="py-0.5 text-right font-medium text-gray-700">
                    ${Math.round(p.acumulado).toLocaleString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Las facturas reales que entraron. Es lo mismo que muestra el panel de cuentas:
              la fórmula sola no distingue tres meses parecidos de dos ceros y un mes enorme. */}
          {celdas && celdas.length > 0 && (
            <div className="mt-1 rounded border border-blue-200 bg-blue-50/60 px-2 py-1">
              <MuestraDelCalculo celdas={celdas}
                modo={(borrador.historico_modo ?? "promedio_n") as ModoPresupuesto} />
            </div>
          )}
        </div>
      )}

      {/* ══ LAS TRES RANURAS ══════════════════════════════════════════════════
          CUÁNTO × A CUÁNTO × SOBRE QUÉ. La forma es fija; lo que se elige es de dónde sale
          cada pieza. Ver el encabezado del archivo para por qué no es un constructor libre. */}
      {!enModoRacion ? (
        <div className="space-y-2">
          <div className="grid gap-2 lg:grid-cols-3">

            {/* ── 1 · CUÁNTO ─────────────────────────────────────────────── */}
            <Ranura n={1} titulo="CUÁNTO" ayuda="IATF: 9 kg de novillo por vaca. Sanidad: 1.">
              <div className="flex gap-1">
                <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
                  defaultValue={borrador.cantidad == null ? "" : fmtNumeroAR(borrador.cantidad)}
                  placeholder="1,00"
                  onBlur={e => set("cantidad", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
                <input type="text" className="h-6 w-20 rounded border px-1 text-[10px]"
                  defaultValue={borrador.cantidad_unidad ?? ""} placeholder="kg · dosis"
                  onBlur={e => set("cantidad_unidad", e.target.value || null)} />
              </div>
            </Ranura>

            {/* ── 2 · A CUÁNTO ───────────────────────────────────────────── */}
            <Ranura n={2} titulo="A CUÁNTO" ayuda="El punto de arranque. No viene dado: se elige.">
              <select className="h-6 w-full rounded border px-1 text-[10px]"
                value={borrador.precio_fuente ?? "manual"}
                onChange={e => set("precio_fuente", e.target.value)}>
                {FUENTES_PRECIO.map(f => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
              </select>

              {(borrador.precio_fuente ?? "manual") === "manual" && (
                <div className="mt-1 flex gap-1">
                  <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
                    defaultValue={fmtNumeroAR(borrador.valor)} placeholder="0,00"
                    onBlur={e => set("valor", parseNumeroAR(e.target.value))} />
                  <select className="h-6 w-14 rounded border px-0.5 text-[10px]"
                    value={borrador.moneda} onChange={e => set("moneda", e.target.value)}>
                    <option value="ARS">$</option>
                    <option value="USD">U$S</option>
                  </select>
                </div>
              )}

              {/* Se SELECCIONA de la lista, no se tipea. Tipear "Novillo" no daba precio porque
                  esa banda no existe, y el margen sólo decía que faltaba. Las que no tienen
                  precio cargado se marcan, y el faltante ES el acceso: botón para ir a cargarlo. */}
              {borrador.precio_fuente === "hacienda" && (
                <div className="mt-1 space-y-1">
                  <select className="h-6 w-full rounded border px-1 text-[10px]"
                    value={borrador.precio_referencia ?? ""}
                    onChange={e => set("precio_referencia", e.target.value || null)}>
                    <option value="">— elegir precio —</option>
                    {BANDAS_HACIENDA.map(b => (
                      <option key={b.nombre} value={b.nombre}>
                        {b.nombre}{bandasConPrecio.includes(b.nombre) ? "" : "  (sin precio cargado)"}
                      </option>
                    ))}
                  </select>
                  {borrador.precio_referencia
                    && !bandasConPrecio.includes(borrador.precio_referencia) && (
                    <button type="button"
                      onClick={() => onCargarPrecio?.(borrador.precio_referencia!)}
                      className="w-full rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100">
                      ⚠️ {borrador.precio_referencia} no tiene precio — cargarlo →
                    </button>
                  )}
                </div>
              )}

              {borrador.precio_fuente === "historico" && (
                <div className="mt-1 space-y-1">
                  <select className="h-6 w-full rounded border px-1 text-[10px]"
                    value={borrador.historico_modo ?? "promedio_n"}
                    onChange={e => set("historico_modo", e.target.value)}>
                    {MODOS_HISTORICO.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
                  </select>
                  {borrador.historico_modo === "promedio_n" && (
                    <div className="flex items-center gap-1">
                      <input type="text" className="h-6 w-14 rounded border px-1 text-right text-[10px]"
                        defaultValue={String(borrador.historico_meses ?? 12)}
                        onBlur={e => set("historico_meses", Math.round(parseNumeroAR(e.target.value)) || 12)} />
                      <span className="text-[9px] text-gray-400">meses</span>
                    </div>
                  )}
                </div>
              )}
            </Ranura>

            {/* ── 3 · SOBRE QUÉ ──────────────────────────────────────────── */}
            <Ranura n={3} titulo="SOBRE QUÉ"
              ayuda="La suma sin operador: “vaca + vaquillona” son dos tildes, no un +.">
              <select className="h-6 w-full rounded border px-1 text-[10px]"
                value={borrador.base_tipo ?? "cabezas"}
                onChange={e => set("base_tipo", e.target.value)}>
                {BASES.map(b => <option key={b.valor} value={b.valor}>{b.etiqueta}</option>)}
              </select>

              {(borrador.base_tipo ?? "cabezas") === "cabezas" && (
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  {CATEGORIAS_BASE.map(c => (
                    <label key={c} className="flex items-center gap-0.5 text-[9px] text-gray-600">
                      <input type="checkbox"
                        checked={(borrador.base_categorias ?? []).includes(c)}
                        onChange={e => {
                          const act = new Set(borrador.base_categorias ?? [])
                          if (e.target.checked) act.add(c); else act.delete(c)
                          set("base_categorias", Array.from(act))
                        }} />
                      {c}
                    </label>
                  ))}
                </div>
              )}

              {borrador.base_tipo === "hectareas" && (
                <input type="text" className="mt-1 h-6 w-full rounded border px-1 text-right text-[10px]"
                  defaultValue={borrador.has_aplicacion == null ? "" : fmtNumeroAR(borrador.has_aplicacion)}
                  placeholder="las de la actividad"
                  onBlur={e => set("has_aplicacion", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
              )}

              {borrador.base_tipo === "cantidad" && (
                <input type="text" className="mt-1 h-6 w-full rounded border px-1 text-right text-[10px]"
                  defaultValue={borrador.cantidad_aplicacion == null ? "" : fmtNumeroAR(borrador.cantidad_aplicacion)}
                  placeholder="136,41 ton · 7.000 lts"
                  onBlur={e => set("cantidad_aplicacion", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
              )}

              {/* El override: IATF va sobre 240 porque no se inseminan todas. */}
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[9px] text-gray-400">o a mano</span>
                <input type="text" className="h-6 w-20 rounded border px-1 text-right text-[10px]"
                  defaultValue={borrador.base_manual == null ? "" : fmtNumeroAR(borrador.base_manual, 0)}
                  placeholder="—"
                  onBlur={e => set("base_manual", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
              </div>
            </Ranura>
          </div>

          {/* ── Las cuentas contables en las que basarse ───────────────────── */}
          {borrador.precio_fuente === "historico" && (
            <div className="rounded border bg-slate-50 px-2 py-1.5">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-gray-500">
                ¿En qué cuentas contables basarse?
                <span className="ml-1 normal-case text-gray-400">— podés tildar varias, se suman</span>
              </p>
              <div className="max-h-28 space-y-0.5 overflow-y-auto">
                {cuentas.map(c => (
                  <label key={c.nro} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <input type="checkbox"
                      checked={(borrador.nro_cuentas ?? []).includes(c.nro)}
                      onChange={e => {
                        const act = new Set(borrador.nro_cuentas ?? [])
                        if (e.target.checked) act.add(c.nro); else act.delete(c.nro)
                        set("nro_cuentas", Array.from(act))
                      }} />
                    <span className="font-mono text-gray-400">{c.nro}</span> {c.nombre}
                  </label>
                ))}
                {cuentas.length === 0 && (
                  <p className="text-[10px] text-gray-400">No hay cuentas con historia cargada.</p>
                )}
              </div>
            </div>
          )}

          {/* ── CAE EN: meses + % ──────────────────────────────────────────── */}
          <div className="rounded border bg-slate-50 px-2 py-1.5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">
                Cae en
                <span className="ml-1 normal-case text-gray-400">
                  — tildá los meses y poné el % de cada uno. Sin % se reparte parejo.
                </span>
              </p>
              <span className={`text-[10px] ${
                sumaPct === 0 ? "text-gray-400" : sumaPct === 100 ? "text-green-700" : "text-amber-600"}`}>
                {sumaPct === 0 ? "todos los meses, parejo" : `suma ${fmtNumeroAR(sumaPct, 0)} %`}
              </span>
            </div>
            {/* En orden de CAMPAÑA (jul → jun), con el año de cada mes y los que ya pasaron
                atenuados: un % puesto ahí no se proyecta — lo gastado ya está en la contabilidad. */}
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {MESES_CAMPANA.map(mes => {
                const val = borrador.meses_pct?.[String(mes)]
                const p = mesesPeriodo.find(x => x.mes === mes)
                const pasado = p ? (p.anio * 12 + p.mes - 1) < kmHoy : false
                return (
                  <div key={mes} className="text-center">
                    <label className={`block text-[9px] ${pasado ? "text-gray-300" : "text-gray-500"}`}>
                      {MESES_CORTOS[mes - 1]}
                      {p && <span className="ml-0.5 text-[8px] opacity-60">{String(p.anio).slice(-2)}</span>}
                    </label>
                    <input type="text"
                      title={pasado ? "Ya pasó: lo que se puso acá no se proyecta" : undefined}
                      className={`h-6 w-full rounded border px-0.5 text-center text-[10px] ${
                        pasado ? "border-dashed bg-gray-50 text-gray-400"
                          : val ? "border-blue-400 bg-blue-50" : ""}`}
                      defaultValue={val == null ? "" : fmtNumeroAR(val, 0)} placeholder="—"
                      onBlur={e => {
                        const m = { ...(borrador.meses_pct ?? {}) }
                        const v = e.target.value.trim()
                        if (v) m[String(mes)] = parseNumeroAR(v); else delete m[String(mes)]
                        set("meses_pct", Object.keys(m).length ? m : null)
                      }} />
                  </div>
                )
              })}
            </div>
            {pctPasado > 0 && (
              <p className="mt-1 text-[9px] text-gray-500">
                <strong>{fmtNumeroAR(pctPasado, 0)} %</strong> cae en meses que ya pasaron:
                no se proyecta — ese gasto ya está (o no) en la contabilidad. Se presupuesta el{" "}
                <strong>{fmtNumeroAR(100 - pctPasado, 0)} %</strong> restante.
              </p>
            )}
            {sumaPct > 0 && sumaPct !== 100 && (
              <p className="mt-1 text-[9px] text-amber-700">
                No suma 100: se normaliza igual (40/60 y 4/6 dan lo mismo), pero conviene revisarlo.
              </p>
            )}
          </div>

          {/* La amortización es DEL MARGEN. El presupuesto es caja. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-wide text-gray-500">Se amortiza en</span>
            <input type="text" className="h-6 w-16 rounded border px-1 text-right text-[10px]"
              defaultValue={borrador.amortiza_anios == null ? "" : String(borrador.amortiza_anios)}
              placeholder="—"
              onBlur={e => set("amortiza_anios", e.target.value.trim() ? Math.round(parseNumeroAR(e.target.value)) : null)} />
            <span className="text-[9px] text-gray-400">
              años — <strong>sólo en el margen</strong>: el presupuesto paga el 100 % el año que se hace
            </span>
          </div>
        </div>
      ) : (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
          Este costo va por <strong>ración</strong> (<code>{borrador.modo}</code>): depende de la curva
          de peso y de los tramos del lote, que son del <strong>planteo productivo</strong>. Se edita
          en <em>Actividades y costos</em> hasta que el margen sepa resolverlo (M-04).
        </p>
      )}

      {/* ── La cadena de ajustes ─────────────────────────────────────────── */}
      <div className="rounded border bg-slate-50 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wide text-gray-500">
            Ajustes sobre la base
            <span className="ml-1 normal-case text-gray-400">
              — para decir &ldquo;lo del año pasado × IPC × el aumento de cabezas&rdquo;
            </span>
          </p>
          <button type="button" onClick={agregarAjuste}
            className="flex items-center gap-0.5 rounded border bg-white px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50">
            <Plus className="h-3 w-3" /> paso
          </button>
        </div>

        {costo.ajustes.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            Sin ajustes: el valor se toma tal cual.
          </p>
        ) : (
          <div className="space-y-1">
            {[...costo.ajustes].sort((a, b) => a.orden - b.orden).map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-1">
                <select className="h-6 w-40 rounded border px-1 text-[10px]"
                  value={a.tipo}
                  onChange={e => guardarAjuste(a.id!, { tipo: e.target.value as TipoAjuste })}>
                  {(Object.keys(ETIQUETA_AJUSTE) as TipoAjuste[]).map(t => (
                    <option key={t} value={t}>{ETIQUETA_AJUSTE[t]}</option>
                  ))}
                </select>
                {a.tipo !== "ipc" && (
                  <div className="flex items-center gap-0.5">
                    <input type="text" className="h-6 w-16 rounded border px-1 text-right text-[10px]"
                      defaultValue={a.valor == null ? "" : fmtNumeroAR(a.valor)} placeholder="0,00"
                      onBlur={e => guardarAjuste(a.id!, { valor: parseNumeroAR(e.target.value) })} />
                    <span className="text-[9px] text-gray-400">%</span>
                  </div>
                )}
                <input type="text" className="h-6 min-w-0 flex-1 rounded border px-1 text-[10px]"
                  defaultValue={a.nota ?? ""} placeholder="por qué (se ve en el margen)"
                  onBlur={e => guardarAjuste(a.id!, { nota: e.target.value || null })} />
                <button type="button" onClick={() => borrarAjuste(a.id!)}
                  className="rounded p-0.5 text-gray-300 hover:text-red-500" title="Quitar">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── El fundamento ────────────────────────────────────────────────── */}
      <div>
        <label className="text-[9px] uppercase tracking-wide text-gray-500">
          En qué fundamento la estimación
        </label>
        <input type="text" className="mt-0.5 h-6 w-full rounded border px-1 text-[10px]"
          defaultValue={borrador.fundamento ?? ""}
          placeholder="ej: lo gastado en la campaña pasada más 30 % por la suba del combustible"
          onBlur={e => set("fundamento", e.target.value || null)} />
        {costo.notas && (
          <p className="mt-0.5 text-[9px] text-gray-400">Origen del dato: {costo.notas}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {sucio && <span className="text-[10px] text-amber-600">hay cambios sin guardar</span>}
        <Button size="sm" className="h-6 gap-1 text-[10px]" disabled={!sucio || guardando} onClick={guardar}>
          {guardando && <Loader2 className="h-3 w-3 animate-spin" />} Guardar
        </Button>
      </div>
    </div>
  )
}

/**
 * Traduce una fila del modelo VIEJO (`modo` + sus campos sueltos) a las tres ranuras.
 *
 * No toca la base: es lo que se MUESTRA al abrir. Sin esto, una fila vieja mostraba los selects
 * en su default y al guardar se grababa otra cosa — lo que se ve tiene que ser lo que se guarda.
 * La conversión real ocurre recién cuando el usuario aprieta Guardar.
 *
 * Da **exactamente el mismo número** que el camino viejo: `modo_cabeza` con base `rodeo` son
 * vacas + vaquillonas, que es la definición de `rodeo` en `calcularLineaTiempo()`.
 */
function conTresRanuras(c: CostoEditable): CostoEditable {
  if (c.base_tipo) return c
  const base: Partial<CostoEditable> = { cantidad: c.cantidad ?? 1, precio_fuente: c.precio_fuente ?? 'manual' }

  switch (c.modo) {
    case 'monto_cabeza': {
      const b = c.base_cabezas ?? 'rodeo'
      return {
        ...c, ...base, base_tipo: 'cabezas',
        base_categorias: c.base_categorias
          ?? (b === 'rodeo' ? ['vacas', 'vaquillonas'] : b === 'manual' ? [] : [b]),
        base_manual: c.base_manual ?? (b === 'manual' ? c.cabezas_aplicacion : null),
      }
    }
    case 'monto_ha':
      return { ...c, ...base, base_tipo: 'hectareas' }
    case 'monto_unidad':
      return { ...c, ...base, base_tipo: 'cantidad' }
    default:
      return { ...c, ...base }
  }
}

/** Una de las tres ranuras, numerada — el orden es la cuenta y se lee de izquierda a derecha. */
function Ranura({ n, titulo, ayuda, children }: {
  n: number; titulo: string; ayuda?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded border bg-white px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-gray-600">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-200 text-[8px] text-gray-600">
          {n}
        </span>
        {titulo}
      </p>
      <div className="mt-1">{children}</div>
      {ayuda && <p className="mt-1 text-[9px] leading-tight text-gray-400">{ayuda}</p>}
    </div>
  )
}
