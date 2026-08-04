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
import { ETIQUETA_BASE_CABEZAS } from "@/lib/presupuesto/margen"

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
}

export function EditorCostoActividad({ costo, pasos, onGuardado }: {
  costo: CostoEditable
  /** Cómo se llegó al número, ya calculado por el margen. */
  pasos?: Paso[]
  onGuardado: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [borrador, setBorrador] = useState<CostoEditable>(costo)
  const sucio = JSON.stringify(borrador) !== JSON.stringify(costo)

  // Al recargar el margen llega un `costo` nuevo (mismo dato, otro objeto). Sin esto el borrador
  // se quedaba con el estado viejo y la fila mostraba "hay cambios sin guardar" recién guardada.
  useEffect(() => { setBorrador(costo) }, [JSON.stringify(costo)])

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
        </div>
      )}

      {/* ── La base del costo ────────────────────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Cómo escala">
          <select className="h-6 w-full rounded border px-1 text-[10px]"
            value={borrador.modo} onChange={e => set("modo", e.target.value)}>
            {MODOS_DEL_MARGEN.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
            {/* Los modos de ración se muestran pero no se editan acá: dependen de la curva de
                peso y de los tramos, que son de la actividad. */}
            {!MODOS_DEL_MARGEN.some(m => m.valor === borrador.modo) && (
              <option value={borrador.modo}>{borrador.modo} (se edita en la actividad)</option>
            )}
          </select>
        </Campo>

        <Campo etiqueta="Valor">
          <div className="flex gap-1">
            <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
              defaultValue={fmtNumeroAR(borrador.valor)} placeholder="0,00"
              onBlur={e => set("valor", parseNumeroAR(e.target.value))} />
            <select className="h-6 w-14 rounded border px-0.5 text-[10px]"
              value={borrador.moneda} onChange={e => set("moneda", e.target.value)}>
              <option value="ARS">$</option>
              <option value="USD">U$S</option>
            </select>
          </div>
        </Campo>

        <Campo etiqueta="Unidad">
          <input type="text" className="h-6 w-full rounded border px-1 text-[10px]"
            defaultValue={borrador.unidad ?? ""} placeholder="U$S/ha · U$S/vaca · U$S/ton"
            onBlur={e => set("unidad", e.target.value || null)} />
        </Campo>

        <Campo etiqueta="Cuándo cae">
          <select className="h-6 w-full rounded border px-1 text-[10px]"
            value={borrador.momento} onChange={e => set("momento", e.target.value)}>
            {MOMENTOS.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>
        </Campo>

        {/* Sobre qué se aplica — cambia según el modo. Es lo que evita que la sanidad de toros
            se cobre sobre las 260 vacas, y que la implantación de pasturas se multiplique por
            las 175 has del campo en vez de por las 15 de pastura. */}
        {borrador.modo === "monto_ha" && (
          <Campo etiqueta="Hectáreas de este costo" ayuda="Vacío = las de la actividad">
            <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
              defaultValue={borrador.has_aplicacion == null ? "" : fmtNumeroAR(borrador.has_aplicacion)}
              placeholder="las de la actividad"
              onBlur={e => set("has_aplicacion", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
          </Campo>
        )}

        {borrador.modo === "monto_cabeza" && (
          <>
            <Campo etiqueta="Sobre qué cabezas">
              <select className="h-6 w-full rounded border px-1 text-[10px]"
                value={borrador.base_cabezas ?? "rodeo"}
                onChange={e => set("base_cabezas", e.target.value)}>
                {Object.entries(ETIQUETA_BASE_CABEZAS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Campo>
            {borrador.base_cabezas === "manual" && (
              <Campo etiqueta="Cantidad fija">
                <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
                  defaultValue={borrador.cabezas_aplicacion == null ? "" : fmtNumeroAR(borrador.cabezas_aplicacion, 0)}
                  placeholder="0"
                  onBlur={e => set("cabezas_aplicacion", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
              </Campo>
            )}
          </>
        )}

        {borrador.modo === "monto_unidad" && (
          <Campo etiqueta="Cantidad al año" ayuda="136,41 ton de silo · 7.000 lts de gasoil">
            <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
              defaultValue={borrador.cantidad_aplicacion == null ? "" : fmtNumeroAR(borrador.cantidad_aplicacion)}
              placeholder="0,00"
              onBlur={e => set("cantidad_aplicacion", e.target.value.trim() ? parseNumeroAR(e.target.value) : null)} />
          </Campo>
        )}

        {/* La amortización es DEL MARGEN. El presupuesto es caja: el año que se siembra paga
            el 100 % y los siguientes cero. Se aclara acá para que no se lea como un descuento. */}
        <Campo etiqueta="Se amortiza en" ayuda="Sólo en el margen — el presupuesto paga el 100 % el año que se hace">
          <div className="flex items-center gap-1">
            <input type="text" className="h-6 w-full rounded border px-1 text-right text-[10px]"
              defaultValue={borrador.amortiza_anios == null ? "" : String(borrador.amortiza_anios)}
              placeholder="—"
              onBlur={e => set("amortiza_anios", e.target.value.trim() ? Math.round(parseNumeroAR(e.target.value)) : null)} />
            <span className="text-[9px] text-gray-400">años</span>
          </div>
        </Campo>
      </div>

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

function Campo({ etiqueta, ayuda, children }: {
  etiqueta: string; ayuda?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-wide text-gray-500" title={ayuda}>
        {etiqueta}
      </label>
      <div className="mt-0.5">{children}</div>
      {ayuda && <p className="mt-0.5 text-[9px] leading-tight text-gray-400">{ayuda}</p>}
    </div>
  )
}
