"use client"

// ABM de las dos series macro que alimentan el presupuesto de ingresos:
//   · precios_granos  → precio por posición (USD/ton)
//   · tipos_cambio    → TC presupuestado / real por mes
// Carga manual, corrección esporádica. Mejora futura: traer Matba automático.
// Ver DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, DollarSign, TrendingUp } from "lucide-react"

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
  /** Precio ARS/kg de hacienda por categoría (clave = categoría). */
  hacienda: Record<string, string>
}

// Categorías de hacienda con precio presupuestable. Ternero/Ternera = destete.
const CATEGORIAS_HACIENDA = ["Ternero", "Ternera", "Vaca CUT/Descarte"]

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
  const [filas, setFilas] = useState<Record<string, Fila>>({})

  const meses = mesesDesde(anioDesde, 36) // 3 años de horizonte

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: precios }, { data: tcs }, { data: hac }] = await Promise.all([
        supabase.from("precios_granos").select("*").eq("grano", grano),
        supabase.from("tipos_cambio").select("*"),
        supabase.from("precios_hacienda").select("*"),
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
        mapa[clave] = {
          anio: m.anio,
          mes: m.mes,
          precio_usd: p ? fmtAR(p.precio_usd) : "",
          tc_presupuestado: t ? fmtAR(t.tc_presupuestado) : "",
          tc_real: t ? fmtAR(t.tc_real) : "",
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
        await supabase.from("precios_hacienda").upsert({
          categoria, anio: f.anio, mes: f.mes,
          precio_pesos_kg: parseAR(v),
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

  const cargados = Object.values(filas).filter(f => f.precio_usd !== "").length
  const tcCargados = Object.values(filas).filter(f => f.tc_presupuestado !== "" || f.tc_real !== "").length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Precios y Tipo de Cambio
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{cargados} precios</Badge>
            <Badge variant="outline">{tcCargados} TC</Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-gray-500">
          Series macro compartidas por MSA, PAM y MA. Si un mes queda sin precio, el presupuesto
          toma el <strong>siguiente mes cargado</strong> y marca la celda como arrastrada.
          Granos en <strong>USD/ton</strong> por posición; hacienda en <strong>$/kg</strong> por
          categoría (no hay Matba de hacienda: es carga manual).
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={grano} onValueChange={setGrano}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Posición</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">
                    Precio {grano} (USD/ton)
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">TC presupuestado</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">TC real</th>
                  {CATEGORIAS_HACIENDA.map(cat => (
                    <th key={cat} className="px-3 py-2 text-right font-semibold text-emerald-800 whitespace-nowrap">
                      {cat} ($/kg)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meses.map(m => {
                  const clave = `${m.anio}-${m.mes}`
                  const f = filas[clave]
                  if (!f) return null
                  const esHoy = clave === claveHoy
                  return (
                    <tr
                      key={clave}
                      className={`border-b hover:bg-gray-50 ${esHoy ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                        {MESES[m.mes - 1]} {String(m.anio).slice(-2)}
                        {esHoy && <span className="ml-2 text-[10px] text-blue-600">← hoy</span>}
                        {guardando === clave && (
                          <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-gray-400" />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="text"
                          placeholder="0,00"
                          className="h-8 text-right"
                          value={f.precio_usd}
                          onChange={e => setCampo(clave, "precio_usd", e.target.value)}
                          onBlur={() => guardarPrecio(clave)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="text"
                          placeholder="0,00"
                          className="h-8 text-right"
                          value={f.tc_presupuestado}
                          onChange={e => setCampo(clave, "tc_presupuestado", e.target.value)}
                          onBlur={() => guardarTC(clave)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="text"
                          placeholder="0,00"
                          className="h-8 text-right"
                          value={f.tc_real}
                          onChange={e => setCampo(clave, "tc_real", e.target.value)}
                          onBlur={() => guardarTC(clave)}
                        />
                      </td>
                      {CATEGORIAS_HACIENDA.map(cat => (
                        <td key={cat} className="px-2 py-1">
                          <Input
                            type="text"
                            placeholder="0,00"
                            className="h-8 text-right bg-emerald-50/40"
                            value={f.hacienda?.[cat] ?? ""}
                            onChange={e => setHacienda(clave, cat, e.target.value)}
                            onBlur={() => guardarHacienda(clave, cat)}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Se guarda al salir del campo. Vaciar un campo borra el dato. El presupuesto usa el TC
          real si existe; si no, el presupuestado.
        </p>
      </CardContent>
    </Card>
  )
}
