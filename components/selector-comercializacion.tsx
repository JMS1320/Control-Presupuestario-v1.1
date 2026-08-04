"use client"

// Los dos selectores que le dicen al análisis QUÉ se vende y A QUIÉN.
//
// Hasta ahora la pantalla no lo sabía: el desbaste y la CZ se tipeaban a mano en cada etapa. Con
// esto se eligen el destino y el intermediario, y los dos porcentajes se completan solos desde
// `productivo` (normas de comercialización) — pero **siguen siendo editables**, porque el usuario
// lo pidió explícito: *"luego aunque elija algo puedo modificar a mano"*.
//
// ── Por qué el flete entra en la CZ y no aparte ──────────────────────────────
// El flete es un monto absoluto, no un porcentaje, así que no podía ser un input de "CZ %". La
// salida la dio el usuario: *"que muestre los pesos de cada ítem de la CZ, el % parcial y el total
// de CZ"*. Entonces el % **se deriva de los pesos** en vez de tipearse, y el flete convive con la
// comisión en la única unidad comparable entre destinos: el % de CZ total.
//
// Efecto lateral que conviene entender: el % del flete BAJA cuando sube el precio de la hacienda
// —los mismos $960.000 pesan menos sobre una venta mayor—. Es correcto y es parte de lo que hay
// que ver al decidir.
//
// ── El tipo lo dice la ETAPA, no un desplegable ──────────────────────────────
// `actividades.tipo` ya distingue recría de engorde: una etapa de recría vende **invernada** y una
// de engorde vende **gordo**. Se deriva y el usuario corrige, como en el resto del sistema.

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
  desbasteDe, evaluarOpcion, desgloseCZ, precioDerivado, rindeDe,
  type TipoHacienda, type DestinoVenta, type RutaDestino, type IntermediarioVenta,
  type TarifaFlete, type NormaDesbaste, type NormaRinde, type OpcionVenta,
} from "@/lib/ganaderia/comercializacion"

export interface NormasComercializacion {
  destinos: DestinoVenta[]
  rutas: RutaDestino[]
  intermediarios: IntermediarioVenta[]
  tarifas: TarifaFlete[]
  desbaste: NormaDesbaste[]
  rinde: NormaRinde[]
}

const VACIO: NormasComercializacion = {
  destinos: [], rutas: [], intermediarios: [], tarifas: [], desbaste: [], rinde: [],
}

// Se cargan UNA vez para toda la pantalla: hay un selector por etapa y por segmento, y cada uno
// consultando por su cuenta serían decenas de queries iguales.
let cache: Promise<NormasComercializacion> | null = null

async function leerNormas(): Promise<NormasComercializacion> {
  const p = supabase.schema("productivo")
  const [d, r, i, t, db, rn] = await Promise.all([
    p.from("destinos_venta").select("*").eq("activo", true).order("nombre"),
    p.from("destino_rutas").select("*").eq("activo", true).order("km"),
    p.from("intermediarios_venta").select("*").eq("activo", true).order("nombre"),
    p.from("tarifas_flete").select("*").eq("activo", true),
    p.from("normas_desbaste").select("*"),
    p.from("normas_rinde").select("*"),
  ])
  const n = (x: any) => (x == null ? null : Number(x))
  return {
    destinos: ((d.data || []) as any[]).map(x => ({ ...x, pct_gasto: Number(x.pct_gasto) || 0 })),
    rutas: ((r.data || []) as any[]).map(x => ({ ...x, km: Number(x.km) || 0 })),
    intermediarios: ((i.data || []) as any[]).map(x => ({
      ...x, pct_invernada: Number(x.pct_invernada) || 0, pct_gordo: Number(x.pct_gordo) || 0,
    })),
    tarifas: ((t.data || []) as any[]).map(x => ({
      ...x, arranque: Number(x.arranque) || 0, seguro: Number(x.seguro) || 0,
      por_km: Number(x.por_km) || 0, capacidad_kg: n(x.capacidad_kg),
    })),
    desbaste: ((db.data || []) as any[]).map(x => ({
      tipo: String(x.tipo), peso_hasta: n(x.peso_hasta), pct: Number(x.pct) || 0,
    })),
    rinde: ((rn.data || []) as any[]).map(x => ({ categoria: String(x.categoria), pct: Number(x.pct) || 0 })),
  }
}

export function useNormasComercializacion(): NormasComercializacion {
  const [normas, setNormas] = useState<NormasComercializacion>(VACIO)
  useEffect(() => {
    cache ??= leerNormas().catch(() => VACIO)
    let vivo = true
    cache.then(n => { if (vivo) setNormas(n) })
    return () => { vivo = false }
  }, [])
  return normas
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const pc = (n: number) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`

export interface SeleccionComercial {
  destinoId: string
  intermediarioId: string
  rutaId: string
}

/**
 * Al elegir destino/intermediario devuelve el **desbaste** y la **CZ total** que corresponden,
 * para que la etapa los use. El usuario los puede pisar después.
 */
export function SelectorComercializacion({
  normas, tipo, seleccion, lote, onCambio, onCalculado,
}: {
  normas: NormasComercializacion
  /** Lo dice la etapa: recría → invernada, engorde → gordo. */
  tipo: TipoHacienda
  seleccion: SeleccionComercial
  /** Lo que se va a vender, ya calculado por la etapa. */
  lote: { cabezas: number; pesoVivo: number; precioVenta: number; categoria: string }
  onCambio: (s: SeleccionComercial) => void
  /** Los dos porcentajes que la etapa necesita, ya resueltos. */
  onCalculado?: (v: { desbastePct: number; czPct: number }) => void
}) {
  const destinos = normas.destinos.filter(d => d.aplica_a === "ambos" || d.aplica_a === tipo)
  const destino = destinos.find(d => d.id === seleccion.destinoId) ?? null
  const rutas = normas.rutas.filter(r => r.destino_id === destino?.id)
  const ruta = rutas.find(r => r.id === seleccion.rutaId)
    ?? rutas.find(r => r.por_defecto) ?? rutas[0] ?? null
  const intermediario = normas.intermediarios.find(i => i.id === seleccion.intermediarioId) ?? null
  const tarifa = normas.tarifas.find(t => t.vehiculo === destino?.vehiculo) ?? null

  // El precio: si el destino deriva el suyo de otro (el matarife), se resuelve; si compra a la
  // res, el precio de lista es por kg de RES y hay que llevarlo con el rinde.
  let precio: number | null = lote.precioVenta
  let notaPrecio: string | null = null
  if (destino) {
    const der = precioDerivado(destino, normas.destinos, { [destino.precio_ref_destino_id ?? ""]: lote.precioVenta })
    if (der) { precio = der.precio; notaPrecio = der.motivo }
    else if (destino.compra_en === "res") {
      const r = rindeDe(normas.rinde, lote.categoria)
      notaPrecio = r == null
        ? `falta el rinde de ${lote.categoria}`
        : `precio por kg de RES · rinde ${(r * 100).toFixed(0)} %`
    }
  }

  const op: OpcionVenta | null = destino
    ? { destino, intermediario, ruta, tarifa, precio }
    : null
  const res = op
    ? evaluarOpcion(
        { tipo, categoria: lote.categoria, cabezas: lote.cabezas, pesoVivo: lote.pesoVivo },
        op, { desbaste: normas.desbaste, rinde: normas.rinde })
    : null
  const cz = res ? desgloseCZ(res) : null

  // Avisar hacia arriba los dos porcentajes. Se hace en efecto y no en el render para no
  // escribir en el padre durante el propio render de React.
  useEffect(() => {
    if (!res || !cz) return
    onCalculado?.({
      desbastePct: desbasteDe(normas.desbaste, tipo, lote.pesoVivo),
      czPct: cz.total.pct,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res?.ingresa, cz?.total.pct, tipo, lote.pesoVivo])

  return (
    <div className="rounded border bg-slate-50 px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Vende como <strong className="text-gray-700">{tipo}</strong>
          <span className="ml-1 normal-case text-gray-400">(lo dice la etapa)</span>
        </span>

        <label className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Destino</span>
          <select className="h-6 rounded border px-1 text-[11px]"
            value={seleccion.destinoId}
            onChange={e => onCambio({ ...seleccion, destinoId: e.target.value, rutaId: "" })}>
            <option value="">— a mano —</option>
            {destinos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Intermediario</span>
          <select className="h-6 rounded border px-1 text-[11px]"
            value={seleccion.intermediarioId}
            onChange={e => onCambio({ ...seleccion, intermediarioId: e.target.value })}>
            <option value="">— ninguno —</option>
            {normas.intermediarios.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </label>

        {rutas.length > 1 && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Camino</span>
            <select className="h-6 rounded border px-1 text-[11px]"
              value={ruta?.id ?? ""}
              onChange={e => onCambio({ ...seleccion, rutaId: e.target.value })}>
              {rutas.map(r => (
                <option key={r.id} value={r.id}>{r.km} km · {r.descripcion}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {notaPrecio && (
        <p className="mt-1 text-[10px] text-blue-700">ℹ️ {notaPrecio}</p>
      )}

      {/* ── El desglose de la CZ: pesos, % parcial y total ─────────────────── */}
      {cz && cz.items.length > 0 && (
        <table className="mt-1.5 w-full text-[11px]">
          <tbody>
            {cz.items.map((it, k) => (
              <tr key={k} className="border-b border-gray-100 last:border-0">
                <td className="py-0.5 pr-2 text-gray-600">
                  {it.concepto}
                  {it.nota && <span className="ml-1 text-[9px] text-gray-400">{it.nota}</span>}
                </td>
                <td className="py-0.5 pr-3 text-right text-gray-700">{pesos(it.monto)}</td>
                <td className="w-16 py-0.5 text-right text-gray-500">{pc(it.pct)}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold text-gray-800">
              <td className="py-0.5 pr-2">CZ total</td>
              <td className="py-0.5 pr-3 text-right">{pesos(cz.total.monto)}</td>
              <td className="py-0.5 text-right">{pc(cz.total.pct)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {res && res.faltantes.length > 0 && (
        <p className="mt-1 text-[10px] text-amber-700">⚠️ {res.faltantes.join(" · ")}</p>
      )}

      {destino && !destino.requiere_flete && (
        <p className="mt-0.5 text-[10px] text-gray-500">
          Sin flete: {tipo === "invernada" ? "la invernada no paga flete de venta" : "el destino retira"}.
        </p>
      )}
    </div>
  )
}
