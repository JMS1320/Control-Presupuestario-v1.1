"use client"

// El ciclo de RECRÍA — el equivalente de "Evolución del rodeo" para la cría.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// Sin ciclo, los animales entraban a recría **a costo cero** y su margen daba ganancia de más: el
// destete salía de cría y no entraba a ningún lado. La regla la puso el usuario (2026-08-05):
//
//   > "El comienzo de recría es el fin de cría. El fin de cría es el destete. O se vende a
//   >  terceros o se vende a recría. Ahí se define el resultado de cría con la venta a recría."
//
// Y el matiz que importa: **el destete NO entra automáticamente a recría**. Es o venta o ingreso.
//
// ── Dos cosas que no son obvias ──────────────────────────────────────────────
// · El **neto** no se carga: lo calcula la base (`bruto × (1 − desbaste)`). Es lo que se vende.
// · El **precio de entrada** puede faltar, y mientras falte **el margen de recría no cierra**.
//   Se dice en pantalla en vez de completarlo con cero, que es la regla de toda la app.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"

interface CicloRecria {
  id: string
  campania: string
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  cabezas_machos: number | null
  cabezas_hembras: number | null
  peso_bruto_macho_kg: number | null
  peso_bruto_hembra_kg: number | null
  peso_neto_macho_kg: number | null
  peso_neto_hembra_kg: number | null
  pct_desbaste: number
  precio_kg_entrada: number | null
  ganancia_diaria_kg: number | null
  pct_mortandad: number
  notas: string | null
  // ── La vuelta del espejo: las de reposición que pasan a cría (A-FEAT-48) ──
  cabezas_reposicion: number | null
  peso_bruto_reposicion_kg: number | null
  precio_kg_reposicion: number | null
  fecha_reposicion: string | null
}

interface LoteDelCiclo {
  id: string
  categoria: string
  cantidad: number
  fecha_venta_estimada: string | null
  precio_kg_override: number | null
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const kg = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`

export function PanelCicloRecria() {
  const [cargando, setCargando] = useState(true)
  const [ciclos, setCiclos] = useState<CicloRecria[]>([])
  const [lotes, setLotes] = useState<Record<string, LoteDelCiclo[]>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: cs }, { data: ls }] = await Promise.all([
        p.from("ciclos_recria").select("*").eq("activo", true).order("campania"),
        p.from("stock_lotes")
          .select("id, categoria, cantidad, fecha_venta_estimada, precio_kg_override, ciclo_recria_id")
          .not("ciclo_recria_id", "is", null),
      ])
      const n = (x: any) => (x == null ? null : Number(x))
      setCiclos(((cs || []) as any[]).map(c => ({
        ...c,
        cabezas_machos: n(c.cabezas_machos), cabezas_hembras: n(c.cabezas_hembras),
        peso_bruto_macho_kg: n(c.peso_bruto_macho_kg), peso_bruto_hembra_kg: n(c.peso_bruto_hembra_kg),
        peso_neto_macho_kg: n(c.peso_neto_macho_kg), peso_neto_hembra_kg: n(c.peso_neto_hembra_kg),
        pct_desbaste: Number(c.pct_desbaste) || 0,
        precio_kg_entrada: n(c.precio_kg_entrada),
        ganancia_diaria_kg: n(c.ganancia_diaria_kg),
        pct_mortandad: Number(c.pct_mortandad) || 0,
        cabezas_reposicion: n(c.cabezas_reposicion),
        peso_bruto_reposicion_kg: n(c.peso_bruto_reposicion_kg),
        precio_kg_reposicion: n(c.precio_kg_reposicion),
      })))
      const porCiclo: Record<string, LoteDelCiclo[]> = {}
      for (const l of ((ls || []) as any[])) {
        (porCiclo[l.ciclo_recria_id] ||= []).push({
          id: l.id, categoria: String(l.categoria),
          cantidad: Number(l.cantidad) || 0,
          fecha_venta_estimada: l.fecha_venta_estimada,
          precio_kg_override: n(l.precio_kg_override),
        })
      }
      setLotes(porCiclo)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (id: string, campos: Partial<CicloRecria>) => {
    setGuardando(id)
    try {
      const { error } = await supabase.schema("productivo").from("ciclos_recria")
        .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id)
      if (error) { alert("Error: " + error.message); return }
      await cargar()
    } finally { setGuardando(null) }
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo el ciclo de recría…
      </CardContent></Card>
    )
  }

  if (ciclos.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-gray-400">
        No hay ciclos de recría cargados. El ciclo abre con el <strong>destete de la cría</strong>.
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-3">
      {ciclos.map(c => {
        const cabezas = (c.cabezas_machos ?? 0) + (c.cabezas_hembras ?? 0)
        // El valor de entrada es lo que cría le cobra a recría: cierra un resultado y abre el otro.
        const kgBrutos = (c.cabezas_machos ?? 0) * (c.peso_bruto_macho_kg ?? 0)
          + (c.cabezas_hembras ?? 0) * (c.peso_bruto_hembra_kg ?? 0)
        const kgNetos = (c.cabezas_machos ?? 0) * (c.peso_neto_macho_kg ?? 0)
          + (c.cabezas_hembras ?? 0) * (c.peso_neto_hembra_kg ?? 0)
        const valorEntrada = c.precio_kg_entrada != null ? kgNetos * c.precio_kg_entrada : null
        const misLotes = lotes[c.id] ?? []
        const vendidas = misLotes.reduce((s, l) => s + l.cantidad, 0)

        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  🐄 Ciclo de recría {c.campania}
                  {guardando === c.id && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  {c.fecha_inicio && (
                    <Badge variant="outline" className="text-[10px]">
                      abre {c.fecha_inicio.split("-").reverse().join("/")} (destete)
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{cabezas} cabezas</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* ── La apertura, tal como sale de la pesada del destete ───────── */}
              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                      <th className="px-2 py-1 text-left font-medium">Apertura</th>
                      <th className="px-2 py-1 text-right font-medium">Cabezas</th>
                      <th className="px-2 py-1 text-right font-medium">Bruto</th>
                      <th className="px-2 py-1 text-right font-medium">
                        Neto (−{(c.pct_desbaste * 100).toFixed(0)} %)
                      </th>
                      <th className="px-2 py-1 text-right font-medium">Kg netos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["♂ Machos", c.cabezas_machos, c.peso_bruto_macho_kg, c.peso_neto_macho_kg],
                      ["♀ Hembras", c.cabezas_hembras, c.peso_bruto_hembra_kg, c.peso_neto_hembra_kg],
                    ] as const).map(([lbl, cab, bruto, neto]) => (
                      <tr key={lbl} className="border-b last:border-0">
                        <td className="px-2 py-1 text-gray-700">{lbl}</td>
                        <td className="px-2 py-1 text-right text-gray-800">{cab ?? "—"}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{bruto != null ? kg(bruto) : "—"}</td>
                        <td className="px-2 py-1 text-right font-medium text-gray-800">
                          {neto != null ? kg(neto) : "—"}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          {cab != null && neto != null ? kg(cab * neto) : "—"}
                        </td>
                      </tr>
                    ))}
                    {/* El promedio del lote entero: kg totales ÷ cabezas totales.
                        NO es el promedio de los dos promedios — pesa a cada sexo por su cantidad,
                        que es lo que corresponde cuando hay 103 machos y 82 hembras. */}
                    <tr className="border-t bg-gray-50 font-medium">
                      <td className="px-2 py-1 text-gray-700">Promedio ♂+♀</td>
                      <td className="px-2 py-1 text-right text-gray-800">{cabezas}</td>
                      <td className="px-2 py-1 text-right text-gray-600">
                        {cabezas > 0 ? kg(kgBrutos / cabezas) : "—"}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-800">
                        {cabezas > 0 ? kg(kgNetos / cabezas) : "—"}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-600">{kg(kgNetos)}</td>
                    </tr>
                    <tr className="border-t text-[10px] text-gray-500">
                      <td className="px-2 py-1">Kg totales</td>
                      <td />
                      <td className="px-2 py-1 text-right">{kg(kgBrutos)}</td>
                      <td className="px-2 py-1 text-right">{kg(kgNetos)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400">
                El <strong>neto</strong> lo calcula la base — <code>bruto × (1 − desbaste)</code> —
                y es lo que efectivamente se vende. No se carga a mano.
              </p>

              {/* ── La transferencia cría → recría ─────────────────────────────── */}
              <div className={`rounded border px-2 py-1.5 ${
                valorEntrada == null ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50/60"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
                    Cría <ArrowRight className="h-3 w-3" /> Recría
                  </span>
                  <label className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">$/kg de entrada</span>
                    <input type="text" className="h-6 w-24 rounded border px-1 text-right text-[11px]"
                      defaultValue={c.precio_kg_entrada == null ? "" : fmtNumeroAR(c.precio_kg_entrada)}
                      placeholder="0,00"
                      onBlur={e => {
                        const v = e.target.value.trim() ? parseNumeroAR(e.target.value) : null
                        if (v !== c.precio_kg_entrada) guardar(c.id, { precio_kg_entrada: v })
                      }} />
                  </label>
                  {valorEntrada != null && (
                    <span className="text-[11px] text-gray-700">
                      = <strong>{pesos(valorEntrada)}</strong>
                      <span className="ml-1 text-[10px] text-gray-500">
                        ({pesos(valorEntrada / cabezas)} por cabeza)
                      </span>
                    </span>
                  )}
                </div>
                {valorEntrada == null ? (
                  <p className="mt-1 text-[10px] text-amber-900">
                    <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                    <strong>Sin precio de entrada el margen de recría no cierra:</strong> los
                    animales entran a costo cero y la ganancia sale de más. Y del lado de cría,
                    esta venta es lo que define su resultado.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-emerald-800">
                    Este monto es <strong>ingreso de cría</strong> y <strong>costo de entrada de
                    recría</strong>. Es la misma operación vista desde los dos lados.
                  </p>
                )}
              </div>

              {/* ── La vuelta: recría → cría (las de reposición) ───────────────── */}
              {(() => {
                const cab = c.cabezas_reposicion ?? 0
                const bruto = c.peso_bruto_reposicion_kg ?? 0
                const kgNetos = cab * bruto * (1 - c.pct_desbaste)
                const valor = c.precio_kg_reposicion != null && kgNetos > 0
                  ? kgNetos * c.precio_kg_reposicion : null
                return (
                  <div className={`rounded border px-2 py-1.5 ${
                    cab > 0 && valor == null ? "border-amber-300 bg-amber-50" : "border-sky-200 bg-sky-50/60"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
                        Recría <ArrowRight className="h-3 w-3" /> Cría
                        <span className="font-normal text-gray-500">(reposición)</span>
                      </span>
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">cabezas</span>
                        <input type="text" className="h-6 w-14 rounded border px-1 text-right text-[11px]"
                          defaultValue={cab === 0 ? "" : fmtNumeroAR(cab, 0)}
                          placeholder="0"
                          onBlur={e => {
                            const v = e.target.value.trim() ? parseNumeroAR(e.target.value) : null
                            if (v !== c.cabezas_reposicion) guardar(c.id, { cabezas_reposicion: v })
                          }} />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">kg brutos c/u</span>
                        <input type="text" className="h-6 w-20 rounded border px-1 text-right text-[11px]"
                          defaultValue={bruto === 0 ? "" : fmtNumeroAR(bruto)}
                          placeholder="0,00"
                          onBlur={e => {
                            const v = e.target.value.trim() ? parseNumeroAR(e.target.value) : null
                            if (v !== c.peso_bruto_reposicion_kg) guardar(c.id, { peso_bruto_reposicion_kg: v })
                          }} />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">$/kg</span>
                        <input type="text" className="h-6 w-24 rounded border px-1 text-right text-[11px]"
                          defaultValue={c.precio_kg_reposicion == null ? "" : fmtNumeroAR(c.precio_kg_reposicion)}
                          placeholder="0,00"
                          onBlur={e => {
                            const v = e.target.value.trim() ? parseNumeroAR(e.target.value) : null
                            if (v !== c.precio_kg_reposicion) guardar(c.id, { precio_kg_reposicion: v })
                          }} />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">cuándo pasan</span>
                        <input type="date" className="h-6 rounded border px-1 text-[11px]"
                          defaultValue={c.fecha_reposicion ?? ""}
                          onChange={e => guardar(c.id, { fecha_reposicion: e.target.value || null })} />
                      </label>
                      {valor != null && (
                        <span className="text-[11px] text-gray-700">
                          = <strong>{pesos(valor)}</strong>
                          <span className="ml-1 text-[10px] text-gray-500">
                            ({kg(kgNetos)} netos)
                          </span>
                        </span>
                      )}
                    </div>
                    {cab > 0 && valor == null ? (
                      <p className="mt-1 text-[10px] text-amber-900">
                        <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                        <strong>Sin precio, recría regala las vaquillonas y cría las recibe gratis:</strong>{" "}
                        los dos márgenes quedan mal, y en direcciones opuestas.
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-gray-500">
                        Las retenidas <strong>no se venden afuera</strong>: pasan a cría. Es la misma
                        operación que la de arriba pero al revés — <strong>ingreso de recría y costo
                        de entrada de cría</strong>. La fecha define a qué campaña contable cae.
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* ── Parámetros del período ─────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">Ganancia kg/día</span>
                  <input type="text" className="h-6 w-16 rounded border px-1 text-right text-[11px]"
                    defaultValue={c.ganancia_diaria_kg == null ? "" : fmtNumeroAR(c.ganancia_diaria_kg, 3)}
                    onBlur={e => {
                      const v = e.target.value.trim() ? parseNumeroAR(e.target.value) : null
                      if (v !== c.ganancia_diaria_kg) guardar(c.id, { ganancia_diaria_kg: v })
                    }} />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">Mortandad %</span>
                  <input type="text" className="h-6 w-14 rounded border px-1 text-right text-[11px]"
                    defaultValue={fmtNumeroAR(c.pct_mortandad * 100, 2)}
                    onBlur={e => {
                      const v = parseNumeroAR(e.target.value) / 100
                      if (v !== c.pct_mortandad) guardar(c.id, { pct_mortandad: v })
                    }} />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">Cierre estimado</span>
                  <input type="date" className="h-6 rounded border px-1 text-[11px]"
                    defaultValue={c.fecha_fin_estimada ?? ""}
                    onChange={e => guardar(c.id, { fecha_fin_estimada: e.target.value || null })} />
                  <span className="text-[9px] text-gray-400">suele cerrar antes de diciembre</span>
                </label>
              </div>

              {/* ── Los lotes que cuelgan del ciclo ────────────────────────────── */}
              <div className="rounded border bg-slate-50 px-2 py-1.5">
                <p className="mb-1 text-[9px] uppercase tracking-wide text-gray-500">
                  Ventas del ciclo
                  {vendidas > 0 && (
                    <span className="ml-1 normal-case text-gray-400">
                      — {vendidas} de {cabezas} cabezas ({Math.round((vendidas / cabezas) * 100)} %)
                    </span>
                  )}
                </p>
                {misLotes.length === 0 ? (
                  <p className="text-[10px] text-gray-400">
                    Todavía no hay lotes de venta colgados de este ciclo.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {misLotes.map(l => (
                      <div key={l.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-gray-700">{l.categoria}</span>
                        <span className="text-gray-500">{l.cantidad} cab</span>
                        {l.fecha_venta_estimada && (
                          <span className="text-gray-400">
                            {l.fecha_venta_estimada.split("-").reverse().join("/")}
                          </span>
                        )}
                        {l.precio_kg_override != null && (
                          <span className="text-gray-600">{pesos(l.precio_kg_override)}/kg</span>
                        )}
                        <Badge variant="outline" className="text-[9px] text-blue-600">presupuestada</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {c.notas && <p className="text-[10px] leading-tight text-gray-400">{c.notas}</p>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
