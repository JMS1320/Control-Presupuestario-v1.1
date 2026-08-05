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

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  desbasteDe, evaluarOpcion, desgloseCZ, precioDerivado, rindeDe, sugerirVehiculo,
  categoriaDeRinde, rindeDeLoteMixto, compararOpciones, precioResEquivalente,
  type TipoHacienda, type DestinoVenta, type RutaDestino, type IntermediarioVenta,
  type TarifaFlete, type NormaDesbaste, type NormaRinde, type OpcionVenta, type SexoLote,
} from "@/lib/ganaderia/comercializacion"

/** Los parámetros productivos de una actividad. Ya vivían en `productivo.actividades`. */
export interface ParametrosActividad {
  tipo: string
  racion_pct_pv: number
  ganancia_diaria_kg: number
  pct_mortandad: number
}

export interface NormasComercializacion {
  destinos: DestinoVenta[]
  rutas: RutaDestino[]
  intermediarios: IntermediarioVenta[]
  tarifas: TarifaFlete[]
  desbaste: NormaDesbaste[]
  rinde: NormaRinde[]
  /**
   * ⚠️ NO es una tabla nueva. La ración por tipo de etapa —3 % del PV en engorde, 1,5 % en
   * recría— **ya estaba** en `productivo.actividades`, junto con la ganancia diaria y la
   * mortandad. Se lee de ahí en vez de duplicarla en las normas.
   */
  actividades: ParametrosActividad[]
}

const VACIO: NormasComercializacion = {
  destinos: [], rutas: [], intermediarios: [], tarifas: [], desbaste: [], rinde: [],
  actividades: [],
}

/** `invernada` se hace en la RECRÍA y `gordo` en el ENGORDE. */
export const ACTIVIDAD_DE_TIPO: Record<TipoHacienda, string> = {
  invernada: "recria",
  gordo: "engorde",
}

/** Los parámetros productivos que corresponden al tipo de etapa. */
export function parametrosDe(
  normas: NormasComercializacion, tipo: TipoHacienda,
): ParametrosActividad | null {
  return normas.actividades.find(a => a.tipo === ACTIVIDAD_DE_TIPO[tipo]) ?? null
}

// Se cargan UNA vez para toda la pantalla: hay un selector por etapa y por segmento, y cada uno
// consultando por su cuenta serían decenas de queries iguales.
let cache: Promise<NormasComercializacion> | null = null

async function leerNormas(): Promise<NormasComercializacion> {
  const p = supabase.schema("productivo")
  const [d, r, i, t, db, rn, ac] = await Promise.all([
    p.from("destinos_venta").select("*").eq("activo", true).order("nombre"),
    p.from("destino_rutas").select("*").eq("activo", true).order("km"),
    p.from("intermediarios_venta").select("*").eq("activo", true).order("nombre"),
    p.from("tarifas_flete").select("*").eq("activo", true),
    p.from("normas_desbaste").select("*"),
    p.from("normas_rinde").select("*"),
    p.from("actividades").select("tipo, racion_pct_pv, ganancia_diaria_kg, pct_mortandad")
      .eq("activo", true),
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
    actividades: ((ac.data || []) as any[]).map(x => ({
      tipo: String(x.tipo),
      racion_pct_pv: Number(x.racion_pct_pv) || 0,
      ganancia_diaria_kg: Number(x.ganancia_diaria_kg) || 0,
      pct_mortandad: Number(x.pct_mortandad) || 0,
    })),
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
   * ⚠️ La categoría **se deriva** del sexo (viene de la segmentación) y del tipo. Ya no se elige:
   * era un campo de más. Se conserva en el estado sólo por compatibilidad con estudios guardados.
   */
  categoria: string
  /** Vacío = el que sugiere la app por los kilos. Editable: a veces el camión que hay no es el
   *  que corresponde. */
  vehiculo: string
  /**
   * Sólo cuando el sexo NO se pudo deducir de la etiqueta del segmento. De él sale la categoría
   * y de la categoría el rinde, así que sin esto una venta a la res no se puede calcular.
   */
  sexoManual?: string
  /**
   * Categoría elegida a mano, cuando no se trabaja con el lote del segmento. Pisa a la derivada.
   * Hace falta porque **la vaca tiene su propio rinde** (55 % gorda, 45 % conserva) y no se
   * deduce del sexo: una vaca es hembra, pero no es una vaquillona.
   */
  categoriaManual?: string
  /** Rinde puesto a mano, en %. Pisa al de la tabla — el rinde real varía con la terminación. */
  rindeManual?: string
  /**
   * El precio de CADA destino, por id.
   *
   * ⚠️ No hay un "precio de lista" común: **cada uno paga lo suyo y con otras condiciones**. Lo
   * corrigió el usuario (2026-08-04). Comparar a un precio único mostraba sólo la diferencia de
   * comercialización, que es una parte del problema y no la decisión: un frigorífico más caro
   * puede convenir aunque cobre más flete.
   *
   * El precio está en la unidad de cada destino: $/kg de res para los que compran a la res,
   * $/kg vivo para los demás.
   */
  preciosPorDestino?: Record<string, string>
  /**
   * $/kg de RES, cuando el destino compra a la res.
   *
   * Es un precio **aparte** del de venta: el de venta está en $/kg vivo y es el que usa todo el
   * análisis. Sin esto, el precio de la carne se multiplicaba por los kilos vivos — un novillo
   * "a $5.172" daba 72 % de más.
   */
  precioRes: string
}

/**
 * Al elegir destino/intermediario devuelve el **desbaste** y la **CZ total** que corresponden,
 * para que la etapa los use. El usuario los puede pisar después.
 */
export function SelectorComercializacion({
  normas, tipo, sexo, seleccion, lote, onCambio, onTipo, onCalculado,
}: {
  normas: NormasComercializacion
  /** Lo pone el usuario en la etapa: recría → invernada, engorde → gordo. */
  tipo: TipoHacienda
  /**
   * De la segmentación. Con el tipo alcanza para saber la categoría a efectos del rinde.
   * `"mixto"` = machos y hembras juntos, que es un dato, no un faltante.
   */
  sexo: SexoLote
  seleccion: SeleccionComercial
  /** Lo que se va a vender, ya calculado por la etapa. `precioVenta` en $/kg VIVO. */
  lote: { cabezas: number; pesoVivo: number; precioVenta: number }
  onCambio: (s: SeleccionComercial) => void
  onTipo?: (t: TipoHacienda) => void
  /**
   * Lo que la etapa necesita, ya resuelto. `precioVivo` sólo viene cuando el destino compra a la
   * res: es el precio de la carne **ya convertido** a $/kg vivo por el rinde.
   */
  onCalculado?: (v: { desbastePct: number; czPct?: number; precioVivo?: number }) => void
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
  const compraEnRes = destino?.compra_en === "res"

  // ── Los precios, uno por destino ────────────────────────────────────────────
  const preciosDest = seleccion.preciosPorDestino ?? {}

  const setPrecioDe = (id: string, v: string) =>
    onCambio({ ...seleccion, preciosPorDestino: { ...preciosDest, [id]: v } })

  /**
   * El precio de un destino: **lo puesto a mano gana sobre lo derivado**.
   *
   * El caso que lo obliga (usuario, 2026-08-04): *"si mando a Cañuelas no necesariamente tendré
   * el máximo, pero si el matarife paga máximo menos 10,5 %, entonces los precios deben poder
   * ponerse a mano también"*.
   *
   * O sea: la referencia del matarife es el **máximo** de Cañuelas, que no es el precio que uno
   * realmente va a conseguir ahí. Derivarlo del precio proyectado daría un matarife más barato de
   * lo que paga. La derivación sirve para **arrancar**, no para quedar atado.
   */
  const resolverPrecio = (d: DestinoVenta): { valor: number | null; derivado: string | null } => {
    const aMano = parseNumeroAR(preciosDest[d.id] ?? "") || null
    // ⚠️ El destino YA ELEGIDO hereda el precio de venta del análisis. Sin esto, elegir Cañuelas
    // arriba y abrir la comparación te lo volvía a pedir, teniéndolo tipeado a dos centímetros.
    // Lo reportó el usuario. Sólo aplica a los que compran a peso vivo: el precio del análisis
    // está en $/kg vivo y para uno que compra a la res sería otra unidad.
    const heredado = d.id === destino?.id && d.compra_en === "vivo" && lote.precioVenta > 0
      ? lote.precioVenta
      : null
    const refTxt = preciosDest[d.precio_ref_destino_id ?? ""] ?? ""
    const der = precioDerivado(d, normas.destinos, {
      [d.precio_ref_destino_id ?? ""]: parseNumeroAR(refTxt) || heredado,
    })
    return {
      valor: aMano ?? der?.precio ?? heredado,
      derivado: der?.precio != null ? der.motivo : null,
    }
  }

  /** Sólo el valor derivado, para mostrarlo como sugerencia en el input vacío. */
  const precioSugerido = (d?: DestinoVenta): number | null => {
    if (!d?.precio_ref_destino_id) return null
    const refTxt = preciosDest[d.precio_ref_destino_id] ?? ""
    return precioDerivado(d, normas.destinos, {
      [d.precio_ref_destino_id]: parseNumeroAR(refTxt) || null,
    })?.precio ?? null
  }

  // ── El vehículo: se deduce de los kilos, pero se puede cambiar ─────────────
  // Es SI ENTRA O NO ENTRA: chasis cuando hay poco, y si no entra va jaula completa. No se elige
  // por precio — la flota es la que es.
  const kgTotales = lote.cabezas * lote.pesoVivo
  const veh = sugerirVehiculo(normas.tarifas, ruta?.km ?? 0, kgTotales)
  const tarifa = seleccion.vehiculo
    ? normas.tarifas.find(t => t.vehiculo === seleccion.vehiculo) ?? veh.sugerido
    : veh.sugerido

  // La categoría se DERIVA del sexo (viene de la segmentación) y del tipo.
  //
  // ⚠️ Pero el sexo sale de la ETIQUETA de la sección elegida ("A·Machos: …"), y si el segmento
  // se llama de otra forma no se puede deducir. Ahí se pide — no se adivina ni se sigue sin él,
  // porque de la categoría depende el rinde y del rinde el precio entero.
  const sexoEfectivo: SexoLote = sexo ?? ((seleccion.sexoManual || null) as SexoLote)
  const categoriaDerivada = categoriaDeRinde(sexoEfectivo, tipo) ?? ""
  // La elegida a mano manda: la vaca no se deduce del sexo —es hembra, pero no una vaquillona—
  // y tiene su propio rinde.
  const categoria = seleccion.categoriaManual || categoriaDerivada

  // Un lote MIXTO no tiene una categoría: tiene dos. Pero si las dos rinden lo mismo —hoy novillo
  // y vaquillona gorda rinden 58 %— no hay nada que preguntar. Preguntarlo sería pedir un dato
  // que no cambia el resultado.
  const mixto = !seleccion.categoriaManual && sexoEfectivo === "mixto"
  const rindeMix = mixto && tipo === "gordo" ? rindeDeLoteMixto(normas.rinde, tipo) : null
  const rindeTabla = mixto
    ? rindeMix?.pct ?? null
    : (categoria ? rindeDe(normas.rinde, categoria) : null)

  // El rinde puesto a mano gana: el real varía con la terminación del animal y el usuario lo sabe
  // mejor que la tabla.
  const rindeManualNum = parseNumeroAR(seleccion.rindeManual ?? "")
  const rinde = rindeManualNum > 0 ? rindeManualNum / 100 : rindeTabla

  // Sólo se pide el sexo si no se pudo deducir NI es mixto NI se eligió categoría a mano.
  const faltaSexo = compraEnRes && !sexoEfectivo && !seleccion.categoriaManual

  // ── El precio ──────────────────────────────────────────────────────────────
  // Cuando el destino compra a la RES, el precio que se tipea es $/kg de carne y NO se puede
  // multiplicar por los kilos vivos: hay que pasarlo por el rinde. Ese era el bug que reportó el
  // usuario — un novillo "a $5.172" daba 72 % de más.
  // El precio de la res del destino elegido. Se guarda en `preciosPorDestino` —una sola fuente,
  // compartida con la comparación— y `precioRes` queda de respaldo para estudios ya guardados.
  const precioResTxt = (destino ? preciosDest[destino.id] : "") || seleccion.precioRes || ""
  const precioResNum = parseNumeroAR(precioResTxt)
  /** El precio de la res llevado a $/kg vivo. Es lo que consume el análisis. */
  const precioVivoEquivalente = compraEnRes && rinde != null && precioResNum > 0
    ? precioResNum * rinde
    : null

  let precio: number | null = compraEnRes ? precioResNum || null : lote.precioVenta
  let notaPrecio: string | null = null
  if (destino) {
    // Lo puesto a mano gana; lo derivado sólo si no hay nada tipeado.
    const r = resolverPrecio(destino)
    if (r.derivado) {
      precio = r.valor
      notaPrecio = parseNumeroAR(preciosDest[destino.id] ?? "") > 0
        ? `precio puesto a mano (sugerido: ${r.derivado})`
        : `${r.derivado} — se puede pisar`
    }
    else if (compraEnRes) {
      notaPrecio = rinde == null
        ? `${destino.nombre} compra a la RES y falta el rinde${categoria ? " de " + categoria : ""}`
        : `${destino.nombre} compra a la RES · `
          + (mixto ? rindeMix!.motivo : `${categoria} rinde ${(rinde * 100).toFixed(0)} %`)
    }
  }

  const op: OpcionVenta | null = !faltaElegirRuta
    ? { destino, intermediario, ruta, tarifa, precio }
    : null
  const res = op
    ? evaluarOpcion(
        {
          tipo, categoria, cabezas: lote.cabezas, pesoVivo: lote.pesoVivo,
          // En un lote mixto el rinde no sale de la categoría: se resuelve aparte.
          rindeForzado: mixto ? rindeMix?.pct ?? null : null,
        },
        op, { desbaste: normas.desbaste, rinde: normas.rinde })
    : null
  const cz = res ? desgloseCZ(res) : null

  // El desbaste que corresponde. ⚠️ Se aplica SIEMPRE, con destino o sin él: es del animal, no
  // del comprador. Antes sólo se calculaba si había un destino elegido, y por eso al pasar de
  // gordo a invernada el desbaste se quedaba clavado en 8 % — el bug que reportó el usuario.
  const desbastePct = normas.desbaste.length > 0
    ? desbasteDe(normas.desbaste, tipo, lote.pesoVivo)
    : null

  /**
   * ⚠️ La CZ sólo se manda cuando hay **venta bruta**, porque el % del flete se calcula sobre
   * ella. Sin precio cargado, `flete ÷ 0` daba **0 %** y ese cero viajaba a la etapa como si la
   * comercialización fuera gratis — justo al revés de lo que pasa.
   *
   * Es el mismo criterio que en todo el resto: cuando falta un dato se dice, no se calcula cero.
   */
  //
   // Y tampoco si falta CUALQUIER otra cosa. El caso que lo obligó: sin rinde, la venta bruta se
   // calculaba multiplicando el precio de la CARNE por kilos VIVOS —inflada ~72 %— y la CZ salía
   // 0,86 % en vez de ~1,5 %. El número aparecía completo con un cartel de faltante al lado, y el
   // cartel se ignora mientras el número se usa.
  const czListo = !!res && res.ventaBruta > 0 && res.faltantes.length === 0

  // ── Comparar los destinos en vez de elegir uno ──────────────────────────────
  //
  // Lo pidió el usuario: *"al mismo lote, en vez de elegir, tener la posibilidad de comparar;
  // podrían mostrarse los 3 finales alternativos"*.
  //
  // ⚠️ **Cada destino paga SU precio.** Yo los había comparado todos a un precio de lista común,
  // y estaba mal: *"no se comparan a mismo precio, cada cual paga un precio y tienen distintas
  // condiciones"*. Con un precio único la tabla mostraba sólo la diferencia de comercialización
  // —que es una parte del problema, no la decisión—: un frigorífico que paga más puede convenir
  // aunque cobre más flete, y eso no se veía.
  //
  // El precio del que deriva (el matarife) sí se calcula solo, porque ESA es su condición.
  const [comparando, setComparando] = useState(false)
  /** El camino elegido para cada destino DENTRO de la comparación. Es de la sesión: cambiar de
   *  camino ahí es explorar, no decidir — lo que se guarda es el del destino elegido arriba. */
  const [rutasComparacion, setRutasComparacion] = useState<Record<string, string>>({})

  const comparacion = useMemo(() => {
    if (!comparando) return []
    return compararOpciones(
      { tipo, categoria, cabezas: lote.cabezas, pesoVivo: lote.pesoVivo, rindeForzado: rinde },
      destinos.map(d => {
        const rs = normas.rutas.filter(r => r.destino_id === d.id)
        // El camino elegido en la comparación gana; después el del destino ya seleccionado
        // arriba; recién al final el marcado por defecto.
        const rt = rs.find(r => r.id === rutasComparacion[d.id])
          ?? (d.id === destino?.id ? ruta : null)
          ?? rs.find(r => r.por_defecto)
          ?? (rs.length === 1 ? rs[0]! : null)
        const kg = lote.cabezas * lote.pesoVivo
        const v = sugerirVehiculo(normas.tarifas, rt?.km ?? 0, kg)

        return {
          destino: d,
          intermediario: d.id === destino?.id ? intermediario : null,
          ruta: rt, tarifa: v.sugerido,
          // Lo puesto a mano gana sobre lo derivado.
          precio: resolverPrecio(d).valor,
        }
      }),
      { desbaste: normas.desbaste, rinde: normas.rinde },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparando, tipo, categoria, rinde, lote.cabezas, lote.pesoVivo, lote.precioVenta,
      destino?.id, ruta?.id, intermediario?.id, normas,
      JSON.stringify(preciosDest), JSON.stringify(rutasComparacion)])

  // Avisar hacia arriba. Se hace en efecto y no en el render para no escribir en el padre
  // durante el propio render de React.
  useEffect(() => {
    if (desbastePct == null) return
    onCalculado?.({
      desbastePct,
      czPct: czListo ? cz!.total.pct : undefined,
      precioVivo: precioVivoEquivalente ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desbastePct, czListo, cz?.total.pct, precioVivoEquivalente])

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

        {/* La invernada no tiene destino: el comprador es cambiante y sólo se sabe quién
            comercializa. Por eso el selector aparece sólo para gordo. */}
        {tipo === "gordo" && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Destino</span>
            <select className="h-6 rounded border px-1 text-[11px]"
              value={seleccion.destinoId}
              onChange={e => onCambio({ ...seleccion, destinoId: e.target.value, rutaId: "", vehiculo: "" })}>
              <option value="">— sin destino —</option>
              {destinos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </label>
        )}

        <label className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Intermediario</span>
          <select className="h-6 rounded border px-1 text-[11px]"
            value={seleccion.intermediarioId}
            onChange={e => onCambio({ ...seleccion, intermediarioId: e.target.value })}>
            <option value="">— ninguno —</option>
            {normas.intermediarios.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </label>

        {/* El precio de la RES va aparte del de venta: el de venta es $/kg vivo y lo usa todo el
            análisis. Multiplicar el de la carne por los kilos vivos daba 72 % de más. */}
        {compraEnRes && destino && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">$/kg res</span>
            <input type="text" className="h-6 w-20 rounded border px-1 text-right text-[11px]"
              value={precioResTxt} placeholder="0,00"
              onChange={e => setPrecioDe(destino.id, e.target.value)} />
          </label>
        )}

        {/* Los destinos que derivan su precio también se pueden pisar. */}
        {destino && !compraEnRes && destino.precio_ref_destino_id && (
          <label className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">$/kg vivo</span>
            <input type="text"
              className={`h-6 w-20 rounded border px-1 text-right text-[11px] ${
                !preciosDest[destino.id] ? "border-dashed text-gray-500" : ""}`}
              value={preciosDest[destino.id] ?? ""}
              placeholder={precioSugerido(destino) != null ? fmtNumeroAR(precioSugerido(destino)!, 0) : "0,00"}
              onChange={e => setPrecioDe(destino.id, e.target.value)} />
          </label>
        )}

        {/* La categoría: derivada del segmento, pero elegible.
            La VACA no se deduce del sexo —es hembra, pero no una vaquillona— y tiene su propio
            rinde (55 % gorda, 45 % conserva). Y el rinde real varía con la terminación, así que
            se puede pisar a mano. */}
        {/* ⚠️ Aparece cuando el destino compra a la res **o cuando no hay segmento**.
            Sin segmento se está haciendo un hipotético —"¿y si fueran vacas?"— y ahí la categoría
            es lo primero que hay que poder decir. Antes sólo salía con destino a la res, así que
            un ejercicio suelto no tenía dónde elegir. Lo pidió el usuario (2026-08-05). */}
        {(compraEnRes || !sexo) && (
          <>
            <label className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Categoría</span>
              <select className={`h-6 rounded border px-1 text-[11px] ${
                faltaSexo ? "border-amber-400 bg-amber-50" : ""}`}
                value={seleccion.categoriaManual ?? ""}
                onChange={e => onCambio({ ...seleccion, categoriaManual: e.target.value })}>
                <option value="">
                  {mixto ? "mixto (del segmento)"
                    : categoriaDerivada ? `${categoriaDerivada} (del segmento)`
                    : "— elegir —"}
                </option>
                {normas.rinde.map(r => (
                  <option key={r.categoria} value={r.categoria}>
                    {r.categoria} · {(r.pct * 100).toFixed(0)} %
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Rinde</span>
              <input type="text" className="h-6 w-14 rounded border px-1 text-right text-[11px]"
                value={seleccion.rindeManual ?? ""}
                placeholder={rindeTabla != null ? (rindeTabla * 100).toFixed(0) : "—"}
                onChange={e => onCambio({ ...seleccion, rindeManual: e.target.value })} />
              <span className="text-[9px] text-gray-400">%</span>
            </label>
          </>
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
              {veh.opciones.map(o => (
                <option key={o.tarifa.vehiculo} value={o.tarifa.vehiculo}>
                  {o.tarifa.vehiculo}
                  {o.viajes > 1 ? ` ×${o.viajes}` : ""} · {pesos(o.total)}
                  {o.tarifa.capacidad_kg
                    ? `  (hasta ${Math.round(Number(o.tarifa.capacidad_kg)).toLocaleString("es-AR")} kg)`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Por qué ese camión: entra o no entra. */}
      {destino?.requiere_flete && ruta && veh.sugerido && !seleccion.vehiculo && (
        <p className="mt-1 text-[10px] text-gray-500">
          {Math.round(kgTotales).toLocaleString("es-AR")} kg →{" "}
          <strong>{veh.sugerido.vehiculo}</strong>
          {veh.sugerido.capacidad_kg
            ? kgTotales <= Number(veh.sugerido.capacidad_kg)
              ? ` (entra: hasta ${Math.round(Number(veh.sugerido.capacidad_kg)).toLocaleString("es-AR")} kg)`
              : ` (no entra en ninguno de un viaje — van ${Math.ceil(kgTotales / Number(veh.sugerido.capacidad_kg))} viajes)`
            : ""}. Se puede cambiar.
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
        <p className="mt-1 text-[10px] text-blue-700">
          ℹ️ {notaPrecio}
          {precioVivoEquivalente != null && (
            <> → equivale a <strong>{pesos(precioVivoEquivalente)}/kg vivo</strong>,
              que es lo que usa el análisis</>
          )}
        </p>
      )}

      {tipo === "invernada" && (
        <p className="mt-1 text-[10px] text-gray-500">
          La invernada <strong>no tiene destino</strong>: el comprador es cambiante. Lo que define
          la CZ es el intermediario, y no hay flete de venta.
        </p>
      )}

      {/* Sin precio no hay venta bruta, y sin venta bruta el flete no se puede expresar como %.
          Se dice, en vez de mandar un 0 que haría parecer gratis la comercialización. */}
      {res && !czListo && res.flete > 0 && (
        <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          Flete <strong>{pesos(res.flete)}</strong>
          {res.viajes > 1 ? ` (${res.viajes} viajes)` : ""}, pero falta el precio
          {compraEnRes ? " por kg de res" : ""} para poder expresarlo como % de CZ.
          <strong> La CZ de la etapa no se toca hasta entonces.</strong>
        </p>
      )}

      {/* ── COMPARAR los destinos en vez de elegir uno ─────────────────────── */}
      {tipo === "gordo" && destinos.length > 1 && (
        <div className="mt-1.5">
          <button type="button" onClick={() => setComparando(v => !v)}
            className="rounded border bg-white px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50">
            {comparando ? "▾ Ocultar comparación" : "▸ Comparar los destinos"}
          </button>

          {comparando && (
            <div className="mt-1 overflow-x-auto rounded border bg-white">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                    <th className="px-2 py-1 text-left font-medium">Destino</th>
                    <th className="px-2 py-1 text-right font-medium">Precio</th>
                    <th className="px-2 py-1 text-left font-medium">Camino</th>
                    <th className="px-2 py-1 text-right font-medium">CZ</th>
                    <th className="px-2 py-1 text-right font-medium">Ingresa</th>
                    <th className="px-2 py-1 text-right font-medium">$/kg vivo</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacion.map((r, k) => {
                    const d = destinos.find(x => x.nombre === r.destino)
                    const derivado = !!d?.precio_ref_destino_id
                    return (
                      <tr key={r.destino} className={`border-b last:border-0 ${
                        k === 0 && r.faltantes.length === 0 ? "bg-emerald-50/60" : ""}`}>
                        <td className="px-2 py-1 text-gray-700">
                          {r.destino}
                          {k === 0 && r.faltantes.length === 0 && (
                            <span className="ml-1 text-[9px] text-emerald-700">← conviene</span>
                          )}
                          {r.intermediario && (
                            <span className="ml-1 text-[9px] text-gray-400">{r.intermediario}</span>
                          )}
                        </td>
                        {/* Cada destino paga LO SUYO, en SU unidad. Lo derivado se PRECARGA
                            como placeholder pero se puede pisar: la referencia del matarife es
                            el MÁXIMO de Cañuelas, que no es el precio que uno va a conseguir. */}
                        <td className="px-2 py-1 text-right">
                          <span className="inline-flex items-center gap-0.5">
                            <input type="text"
                              className={`h-5 w-20 rounded border px-1 text-right text-[10px] ${
                                derivado && !preciosDest[d?.id ?? ""] ? "border-dashed text-gray-500" : ""}`}
                              value={preciosDest[d?.id ?? ""] ?? ""}
                              placeholder={derivado && precioSugerido(d) != null
                                ? fmtNumeroAR(precioSugerido(d)!, 0)
                                : "0,00"}
                              title={derivado ? `Sugerido: ${d ? resolverPrecio(d).derivado ?? "" : ""}` : undefined}
                              onChange={e => d && setPrecioDe(d.id, e.target.value)} />
                            <span className="text-[8px] text-gray-400">
                              {d?.compra_en === "res" ? "res" : "vivo"}
                            </span>
                          </span>
                        </td>
                        {/* El camino que USÓ esta fila. Antes tomaba el `por_defecto` en
                            silencio, que contradice la regla: la distancia es la pactada con el
                            transportista, no la del mapa. Ahora se ve y se cambia acá mismo. */}
                        <td className="px-2 py-1">
                          {!d?.requiere_flete ? (
                            <span className="text-[9px] text-gray-400">sin flete</span>
                          ) : (() => {
                            const rs = normas.rutas.filter(x => x.destino_id === d.id)
                            if (rs.length === 0) return <span className="text-[9px] text-amber-600">sin ruta</span>
                            if (rs.length === 1) return <span className="text-[9px] text-gray-500">{rs[0]!.km} km</span>
                            return (
                              <select className="h-5 rounded border px-0.5 text-[9px]"
                                value={rutasComparacion[d.id] ?? (rs.find(x => x.por_defecto)?.id ?? "")}
                                onChange={e => setRutasComparacion(p => ({ ...p, [d.id]: e.target.value }))}>
                                {rs.map(x => (
                                  <option key={x.id} value={x.id}>{x.km} km · {x.descripcion.slice(0, 22)}</option>
                                ))}
                              </select>
                            )
                          })()}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          {r.ventaBruta > 0
                            ? pc((r.comision + r.gastoDestino + r.flete) / r.ventaBruta)
                            : "—"}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {r.faltantes.length === 0 ? pesos(r.ingresa) : "—"}
                        </td>
                        <td className="px-2 py-1 text-right font-medium text-gray-800">
                          {r.equivalenteVivo != null ? pesos(r.equivalenteVivo) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="px-2 py-1 text-[9px] leading-tight text-gray-500">
                <strong>Cada destino paga lo suyo</strong>, en su unidad: $/kg de res los que
                compran a la res, $/kg vivo los demás. Los que derivan su precio lo traen{" "}
                <span className="text-gray-400">en gris</span> como sugerencia y{" "}
                <strong>se pueden pisar</strong> — la referencia del matarife es el <em>máximo</em>{" "}
                de Cañuelas, que no es el precio que uno realmente va a conseguir ahí.
                La columna <strong>$/kg vivo</strong> es la comparable: ya tiene descontados flete,
                comisión y gastos, y el rinde pasado a peso vivo. Las filas incompletas nunca ganan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── El desglose de la CZ: pesos, % parcial y total ─────────────────── */}
      {czListo && cz && cz.items.length > 0 && (
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
        <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          ⚠️ {res.faltantes.join(" · ")}.
          {" "}<strong>La CZ de la etapa no se toca</strong> hasta resolverlo — con esto sin
          definir el número saldría mal, no incompleto.
        </p>
      )}

      {destino && !destino.requiere_flete && (
        <p className="mt-0.5 text-[10px] text-gray-500">
          Sin flete: {tipo === "invernada" ? "la invernada no paga flete de venta" : "el destino retira"}.
        </p>
      )}
    </div>
  )
}
