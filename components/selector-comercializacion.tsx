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
  desbasteDe, evaluarOpcion, desgloseCZ, precioDerivado, rindeDe, sugerirVehiculo,
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
  /**
   * ⚠️ La ruta NO se elige sola. Es la **distancia pactada con el transportista**, no la más
   * corta del mapa: el usuario lo marcó (2026-08-04) — *"para Arrebeef deberemos elegir la
   * distancia pactada con el transportista, así que deberé elegirla en la app"*. Arrebeef tiene
   * tres caminos y *"no siempre se pueden usar los mismos"*, así que elegir por él pondría un
   * flete que nadie acordó.
   */
  rutaId: string
  /**
   * La categoría que se vende. **De ella depende el rinde**, no del destino: un novillo gordo
   * rinde 58 % y una vaca conserva 45 %, le vendan a quien le vendan.
   */
  categoria: string
  /** Vacío = el que sugiere la app por los kilos. Editable: a veces el camión que hay no es el
   *  que conviene. */
  vehiculo: string
}

/**
 * Al elegir destino/intermediario devuelve el **desbaste** y la **CZ total** que corresponden,
 * para que la etapa los use. El usuario los puede pisar después.
 */
export function SelectorComercializacion({
  normas, tipo, seleccion, lote, onCambio, onTipo, onCalculado,
}: {
  normas: NormasComercializacion
  /** Lo pone el usuario en la etapa: recría → invernada, engorde → gordo. */
  tipo: TipoHacienda
  seleccion: SeleccionComercial
  /** Lo que se va a vender, ya calculado por la etapa. */
  lote: { cabezas: number; pesoVivo: number; precioVenta: number; categoria: string }
  onCambio: (s: SeleccionComercial) => void
  onTipo?: (t: TipoHacienda) => void
  /** Los dos porcentajes que la etapa necesita, ya resueltos. */
  onCalculado?: (v: { desbastePct: number; czPct: number }) => void
}) {
  const destinos = normas.destinos.filter(d => d.aplica_a === "ambos" || d.aplica_a === tipo)
  const destino = destinos.find(d => d.id === seleccion.destinoId) ?? null
  const rutas = normas.rutas.filter(r => r.destino_id === destino?.id)
  // Con un solo camino se toma ese; con varios hay que ELEGIR. No se pone el más corto por
  // defecto: la distancia es la pactada con el transportista, no la del mapa.
  const ruta = rutas.find(r => r.id === seleccion.rutaId)
    ?? (rutas.length === 1 ? rutas[0]! : null)
  const faltaElegirRuta = !!destino && destino.requiere_flete && rutas.length > 1 && !ruta
  const intermediario = normas.intermediarios.find(i => i.id === seleccion.intermediarioId) ?? null

  // ── El vehículo: se deduce de los kilos, pero se puede cambiar ─────────────
  // No por capacidad sino por COSTO: el arranque y el seguro se pagan por viaje, así que partir
  // la carga en dos chasis puede salir más caro que una jaula sola.
  const kgTotales = lote.cabezas * lote.pesoVivo
  const veh = sugerirVehiculo(normas.tarifas, ruta?.km ?? 0, kgTotales)
  const tarifa = seleccion.vehiculo
    ? normas.tarifas.find(t => t.vehiculo === seleccion.vehiculo) ?? veh.sugerido
    : veh.sugerido

  // La categoría vendida: de ella sale el rinde. Si no se eligió, se usa la que traiga la etapa.
  const categoria = seleccion.categoria || lote.categoria
  const rinde = rindeDe(normas.rinde, categoria)

  // El precio: si el destino deriva el suyo de otro (el matarife), se resuelve; si compra a la
  // res, el precio de lista es por kg de RES y hay que llevarlo con el rinde.
  let precio: number | null = lote.precioVenta
  let notaPrecio: string | null = null
  if (destino) {
    const der = precioDerivado(destino, normas.destinos, { [destino.precio_ref_destino_id ?? ""]: lote.precioVenta })
    if (der) { precio = der.precio; notaPrecio = der.motivo }
    else if (destino.compra_en === "res") {
      notaPrecio = rinde == null
        ? `falta el rinde de ${categoria}`
        : `precio por kg de RES · rinde ${(rinde * 100).toFixed(0)} % (${categoria})`
    }
  }

  const op: OpcionVenta | null = destino && !faltaElegirRuta
    ? { destino, intermediario, ruta, tarifa, precio }
    : null
  const res = op
    ? evaluarOpcion(
        { tipo, categoria, cabezas: lote.cabezas, pesoVivo: lote.pesoVivo },
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
        {/* El tipo es de la ETAPA y de él cuelga todo: qué destinos se ofrecen, qué desbaste
            corresponde y si hay flete. La invernada no paga flete de venta. */}
        <label className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Vende como</span>
          <select className="h-6 rounded border px-1 text-[11px] font-medium"
            value={tipo} onChange={e => onTipo?.(e.target.value as TipoHacienda)}>
            <option value="invernada">invernada</option>
            <option value="gordo">gordo</option>
          </select>
        </label>

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

        {/* La categoría vendida: de ella depende el RINDE, no del destino. Un novillo gordo
            rinde 58 % y una vaca conserva 45 %, le venda a quien le venda. */}
        {normas.rinde.length > 0 && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Categoría</span>
            <select className={`h-6 rounded border px-1 text-[11px] ${
              destino?.compra_en === "res" && rinde == null ? "border-amber-400 bg-amber-50" : ""}`}
              value={categoria}
              onChange={e => onCambio({ ...seleccion, categoria: e.target.value })}>
              <option value="">— elegir —</option>
              {normas.rinde.map(r => (
                <option key={r.categoria} value={r.categoria}>
                  {r.categoria} · rinde {(r.pct * 100).toFixed(0)} %
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Con varios caminos hay que ELEGIR: es la distancia pactada con el transportista,
            no la más corta. Arrebeef tiene tres y no siempre se puede usar el mismo. */}
        {rutas.length > 1 && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Camino</span>
            <select className={`h-6 rounded border px-1 text-[11px] ${
              faltaElegirRuta ? "border-amber-400 bg-amber-50" : ""}`}
              value={ruta?.id ?? ""}
              onChange={e => onCambio({ ...seleccion, rutaId: e.target.value })}>
              <option value="">— elegir el pactado —</option>
              {rutas.map(r => (
                <option key={r.id} value={r.id}>{r.km} km · {r.descripcion}</option>
              ))}
            </select>
          </label>
        )}

        {/* El vehículo: sugerido por costo, editable. Se muestra lo que costaría cada uno para
            que la sugerencia se pueda discutir en vez de aceptarse a ciegas. */}
        {destino?.requiere_flete && ruta && veh.opciones.length > 0 && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Camión</span>
            <select className="h-6 rounded border px-1 text-[11px]"
              value={seleccion.vehiculo || (veh.sugerido?.vehiculo ?? "")}
              onChange={e => onCambio({ ...seleccion, vehiculo: e.target.value })}>
              {veh.opciones.map((o, k) => (
                <option key={o.tarifa.vehiculo} value={o.tarifa.vehiculo}>
                  {o.tarifa.vehiculo}
                  {o.viajes > 1 ? ` ×${o.viajes}` : ""} · {pesos(o.total)}
                  {k === 0 ? "  ← más barato" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Por qué se sugiere ese camión. Con 8.000 kg entran dos chasis, pero una jaula sola sale
          menos: el arranque y el seguro se pagan por viaje. */}
      {destino?.requiere_flete && ruta && veh.opciones.length > 1 && !seleccion.vehiculo && (
        <p className="mt-1 text-[10px] text-gray-500">
          {Math.round(kgTotales).toLocaleString("es-AR")} kg →{" "}
          <strong>{veh.opciones[0]!.tarifa.vehiculo}</strong>
          {veh.opciones[0]!.viajes > 1 ? ` ×${veh.opciones[0]!.viajes}` : ""}{" "}
          ({pesos(veh.opciones[0]!.total)}) contra{" "}
          {veh.opciones[1]!.tarifa.vehiculo}
          {veh.opciones[1]!.viajes > 1 ? ` ×${veh.opciones[1]!.viajes}` : ""}{" "}
          ({pesos(veh.opciones[1]!.total)}). Se puede cambiar.
        </p>
      )}

      {faltaElegirRuta && (
        <p className="mt-1 text-[10px] text-amber-700">
          ⚠️ <strong>{destino!.nombre}</strong> tiene {rutas.length} caminos
          ({rutas.map(r => `${r.km} km`).join(" · ")}). Elegí el <strong>pactado con el
          transportista</strong> — poner el más corto por defecto sería un flete que nadie acordó.
        </p>
      )}

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
