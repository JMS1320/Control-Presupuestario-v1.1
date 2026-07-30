"use client"

// ABM de las series que alimentan el presupuesto:
//   · precios_granos    → USD/ton por posición
//   · tipos_cambio      → TC presupuestado / real
//   · indices_ipc       → IPC mensual (el ABM detallado sigue en Vista Principal)
//   · precios_hacienda  → ARS/kg por BANDA DE PESO
//
// ⚠️ TODAS ARRASTRAN HACIA ADELANTE (`lib/precios/serie.ts`): alcanza con cargar los
// meses donde el valor CAMBIA y el resto se propaga hasta el próximo input, o hasta el
// final si no hay otro. Las celdas vacías muestran en gris lo que van a heredar.

import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, DollarSign, TrendingUp } from "lucide-react"
import { BANDAS_HACIENDA } from "@/lib/ganaderia/calculo"
import { resolverSerie, explicarOrigen, type PuntoSerie } from "@/lib/precios/serie"

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

// ── Helpers es-AR (convención obligatoria del proyecto) ──────────────────────
const parseAR = (v: string): number =>
  parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0

const fmtAR = (n: number | null | undefined, dec = 2): string =>
  n == null ? "" : Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })

interface Fila {
  anio: number
  mes: number
  precio_usd: string
  tc_presupuestado: string
  tc_real: string
  ipc: string
  /** Precio ARS/kg de hacienda por banda de peso (clave = nombre de la banda). */
  hacienda: Record<string, string>
}

// Categorías de hacienda con precio presupuestable. Ternero/Ternera = destete.
const CATEGORIAS_HACIENDA = BANDAS_HACIENDA.map(b => b.nombre)

function mesesDesde(anioInicio: number, cantidad: number): { anio: number; mes: number }[] {
  const out: { anio: number; mes: number }[] = []
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(anioInicio, i, 1)
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 })
  }
  return out
}

export function ConfiguradorPreciosTC() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [grano, setGrano] = useState("soja")
  const [anioDesde, setAnioDesde] = useState(new Date().getFullYear())
  // 12 bandas de hacienda no entran junto a las macro: se alternan
  const [vista, setVista] = useState<"macro" | "hacienda">("macro")
  const [filas, setFilas] = useState<Record<string, Fila>>({})

  const meses = mesesDesde(anioDesde, 36) // 3 años de horizonte

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: precios }, { data: tcs }, { data: hac }, { data: ipcs }] = await Promise.all([
        supabase.from("precios_granos").select("*").eq("grano", grano),
        supabase.from("tipos_cambio").select("*"),
        supabase.from("precios_hacienda").select("*"),
        supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
      ])

      const mapa: Record<string, Fila> = {}
      for (const m of mesesDesde(anioDesde, 36)) {
        const clave = `${m.anio}-${m.mes}`
        const p = (precios || []).find((x: any) => x.anio === m.anio && x.mes === m.mes)
        const t = (tcs || []).find((x: any) => x.anio === m.anio && x.mes === m.mes)
        const haciendaMes: Record<string, string> = {}
        for (const cat of CATEGORIAS_HACIENDA) {
          const h = (hac || []).find((x: any) => x.categoria === cat && x.anio === m.anio && x.mes === m.mes)
          haciendaMes[cat] = h ? fmtAR(h.precio_pesos_kg) : ""
        }
        const ip = (ipcs || []).find((x: any) => x.anio === m.anio && x.mes === m.mes)
        mapa[clave] = {
          anio: m.anio,
          mes: m.mes,
          precio_usd: p ? fmtAR(p.precio_usd) : "",
          tc_presupuestado: t ? fmtAR(t.tc_presupuestado) : "",
          tc_real: t ? fmtAR(t.tc_real) : "",
          ipc: ip ? fmtAR(ip.valor_ipc) : "",
          hacienda: haciendaMes,
        }
      }
      setFilas(mapa)
    } finally {
      setCargando(false)
    }
  }, [grano, anioDesde])

  useEffect(() => { cargar() }, [cargar])

  const setCampo = (clave: string, campo: keyof Fila, valor: string) => {
    setFilas(prev => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }))
  }

  const setHacienda = (clave: string, categoria: string, valor: string) => {
    setFilas(prev => ({
      ...prev,
      [clave]: { ...prev[clave], hacienda: { ...prev[clave].hacienda, [categoria]: valor } },
    }))
  }

  // Hacienda: ARS por kg. No hay Matba, es carga manual.
  const guardarHacienda = async (clave: string, categoria: string) => {
    const f = filas[clave]
    if (!f) return
    setGuardando(clave)
    try {
      const v = f.hacienda[categoria] ?? ""
      if (v.trim() === "") {
        await supabase.from("precios_hacienda").delete()
          .eq("categoria", categoria).eq("anio", f.anio).eq("mes", f.mes)
      } else {
        const banda = BANDAS_HACIENDA.find(b => b.nombre === categoria)
        await supabase.from("precios_hacienda").upsert({
          categoria, anio: f.anio, mes: f.mes,
          precio_pesos_kg: parseAR(v),
          peso_desde: banda?.peso_desde ?? null,
          peso_hasta: banda?.peso_hasta ?? null,
          fuente: "manual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "categoria,anio,mes" })
      }
    } finally { setGuardando(null) }
  }

  // Guarda al salir del input (upsert por la unique key)
  const guardarPrecio = async (clave: string) => {
    const f = filas[clave]
    if (!f) return
    setGuardando(clave)
    try {
      if (f.precio_usd.trim() === "") {
        await supabase.from("precios_granos").delete()
          .eq("grano", grano).eq("anio", f.anio).eq("mes", f.mes)
      } else {
        await supabase.from("precios_granos").upsert({
          grano, anio: f.anio, mes: f.mes,
          precio_usd: parseAR(f.precio_usd),
          fuente: "manual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "grano,anio,mes" })
      }
    } finally {
      setGuardando(null)
    }
  }

  const guardarIPC = async (clave: string) => {
    const f = filas[clave]
    if (!f) return
    setGuardando(clave)
    try {
      if (f.ipc.trim() === "") {
        await supabase.from("indices_ipc").delete().eq("anio", f.anio).eq("mes", f.mes)
      } else {
        await supabase.from("indices_ipc").upsert({
          anio: f.anio, mes: f.mes,
          valor_ipc: parseAR(f.ipc),
          fuente: "manual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "anio,mes" })
      }
    } finally { setGuardando(null) }
  }

  const guardarTC = async (clave: string) => {
    const f = filas[clave]
    if (!f) return
    setGuardando(clave)
    try {
      const pres = f.tc_presupuestado.trim() === "" ? null : parseAR(f.tc_presupuestado)
      const real = f.tc_real.trim() === "" ? null : parseAR(f.tc_real)
      if (pres == null && real == null) {
        await supabase.from("tipos_cambio").delete().eq("anio", f.anio).eq("mes", f.mes)
      } else {
        await supabase.from("tipos_cambio").upsert({
          anio: f.anio, mes: f.mes,
          tc_presupuestado: pres, tc_real: real,
          fuente: "manual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "anio,mes" })
      }
    } finally {
      setGuardando(null)
    }
  }

  const hoy = new Date()
  const claveHoy = `${hoy.getFullYear()}-${hoy.getMonth() + 1}`

  /**
   * Serie de puntos efectivamente cargados, para poder mostrar en gris lo que cada mes
   * vacío va a heredar. Es el mismo `resolverSerie` que usa el presupuesto, así que lo
   * que se ve acá es exactamente lo que se va a calcular.
   */
  const serieDe = (get: (f: Fila) => string): PuntoSerie[] =>
    Object.values(filas)
      .filter(f => String(get(f) ?? "").trim() !== "")
      .map(f => ({ anio: f.anio, mes: f.mes, valor: parseAR(get(f)) }))

  const cargados = Object.values(filas).filter(f => f.precio_usd !== "").length
  const tcCargados = Object.values(filas).filter(f => f.tc_presupuestado !== "" || f.tc_real !== "").length
  const hacCargados = Object.values(filas).reduce(
    (n, f) => n + Object.values(f.hacienda ?? {}).filter(v => v !== "").length, 0)

  /**
   * Celda editable. Es una FUNCIÓN que devuelve JSX, no un componente: definir un
   * componente adentro haría que React lo remonte en cada tecla y el input pierda el
   * foco (ver KNOWLEDGE.md § Componente definido DENTRO de otro).
   */
  const celda = (
    f: Fila, valor: string, serie: PuntoSerie[],
    onChange: (v: string) => void, onBlur: () => void, tinte?: string,
  ) => {
    const heredado = String(valor ?? "").trim() === "" ? resolverSerie(serie, f.anio, f.mes) : null
    const hayHeredado = heredado && heredado.origen !== "sin_dato"
    return (
      <td className="px-1.5 py-1">
        <Input
          type="text"
          className={`h-8 text-right ${tinte ?? ""}`}
          placeholder={hayHeredado ? fmtAR(heredado!.valor) : "0,00"}
          title={hayHeredado ? explicarOrigen(heredado!) : undefined}
          value={valor}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </td>
    )
  }

  const serieSoja = serieDe(f => f.precio_usd)
  const serieTcP = serieDe(f => f.tc_presupuestado)
  const serieTcR = serieDe(f => f.tc_real)
  const serieIpc = serieDe(f => f.ipc)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Precios, Tipo de Cambio e IPC
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{cargados} soja</Badge>
            <Badge variant="outline">{tcCargados} TC</Badge>
            <Badge variant="outline">{hacCargados} hacienda</Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Series compartidas por MSA, PAM y MA. <strong>Cargá sólo los meses donde el valor
          cambia</strong>: el resto se propaga hacia adelante hasta el próximo dato, o hasta el
          final si no hay otro. Lo que ves en gris es lo que ese mes va a heredar.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={grano} onValueChange={setGrano}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soja">Soja</SelectItem>
              <SelectItem value="maiz">Maíz</SelectItem>
              <SelectItem value="trigo">Trigo</SelectItem>
              <SelectItem value="girasol">Girasol</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(anioDesde)} onValueChange={v => setAnioDesde(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(a => (
                <SelectItem key={a} value={String(a)}>Desde {a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recargar"}
          </Button>

          <div className="ml-auto flex gap-1">
            <Button variant={vista === "macro" ? "default" : "outline"} size="sm"
              onClick={() => setVista("macro")}>Granos · TC · IPC</Button>
            <Button variant={vista === "hacienda" ? "default" : "outline"} size="sm"
              onClick={() => setVista("hacienda")}>Hacienda $/kg</Button>
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando series…
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">
                    Mes
                  </th>
                  {vista === "macro" ? (
                    <>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">
                        {grano} USD/ton
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">TC presup.</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">TC real</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">IPC</th>
                    </>
                  ) : (
                    CATEGORIAS_HACIENDA.map(cat => (
                      <th key={cat}
                        className="px-3 py-2 text-right font-semibold text-emerald-800 whitespace-nowrap">
                        {cat}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {meses.map(m => {
                  const clave = `${m.anio}-${m.mes}`
                  const f = filas[clave]
                  if (!f) return null
                  const esHoy = clave === claveHoy
                  return (
                    <tr key={clave} className={`border-b hover:bg-gray-50 ${esHoy ? "bg-blue-50" : ""}`}>
                      <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap ${esHoy ? "bg-blue-50" : "bg-white"}`}>
                        {MESES[m.mes - 1]} {String(m.anio).slice(-2)}
                        {esHoy && <span className="ml-2 text-[10px] text-blue-600">← hoy</span>}
                        {guardando === clave && (
                          <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-gray-400" />
                        )}
                      </td>

                      {vista === "macro" ? (
                        <>
                          {celda(f, f.precio_usd, serieSoja,
                            v => setCampo(clave, "precio_usd", v), () => guardarPrecio(clave))}
                          {celda(f, f.tc_presupuestado, serieTcP,
                            v => setCampo(clave, "tc_presupuestado", v), () => guardarTC(clave))}
                          {celda(f, f.tc_real, serieTcR,
                            v => setCampo(clave, "tc_real", v), () => guardarTC(clave))}
                          {celda(f, f.ipc, serieIpc,
                            v => setCampo(clave, "ipc", v), () => guardarIPC(clave))}
                        </>
                      ) : (
                        CATEGORIAS_HACIENDA.map(cat => (
                          <React.Fragment key={cat}>
                            {celda(f, f.hacienda?.[cat] ?? "", serieDe(x => x.hacienda?.[cat] ?? ""),
                              v => setHacienda(clave, cat, v), () => guardarHacienda(clave, cat),
                              "bg-emerald-50/40")}
                          </React.Fragment>
                        ))
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Se guarda al salir del campo · vaciar borra el dato · el valor en gris es el que se
          hereda del último mes cargado. El presupuesto usa el TC real si existe; si no, el
          presupuestado.
        </p>
      </CardContent>
    </Card>
  )
}