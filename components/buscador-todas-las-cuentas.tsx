"use client"

/**
 * 🔎 Buscar en TODAS las cuentas a la vez (A-FEAT-1594). Bancos, cajas, tarjetas y dólares de MSA, PAM, MA y Cotitulares,
 * en una sola lista con la cuenta de cada movimiento. Sólo lee. La lógica está en `lib/extracto/buscador-global.ts`.
 */

import { useMemo, useState } from "react"
import { Loader2, Search, ExternalLink } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import { palabrasDeBusqueda, palabraParaLaBase, coincideConTodas, palabraSegura, CAMPOS_DE_TEXTO } from "@/lib/extracto/buscador-global"
import type { CuentaBancaria } from "@/hooks/useMotorConciliacion"
import { FiltroColumna } from "@/components/ui/filtro-columna"
import { opcionesDeColumna, filtrarPorColumnas } from "@/lib/ui/filtro-columna"

const TOPE_POR_CUENTA = 300
const fmt = (n: number) => n ? n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
const fechaAR = (f: string) => f ? f.slice(0, 10).split("-").reverse().join("/") : ""

interface Resultado { cuenta: CuentaBancaria; mov: Record<string, any> }

/**
 * 🔽 JMS 11/11 («agregale por favor los filtros a las columnas»): cada columna con el filtro tipo Excel de la app. Las
 * fechas van por mes y los importes como se ven. La clave es la que usa el encabezado.
 */
const COLUMNAS: { clave: string; titulo: string; valor: (r: Resultado) => string }[] = [
  { clave: "cuenta", titulo: "Cuenta", valor: r => r.cuenta.nombre },
  { clave: "titular", titulo: "Titular", valor: r => r.cuenta.empresa },
  { clave: "fecha", titulo: "Fecha", valor: r => String(r.mov.fecha ?? "").slice(0, 7) },
  { clave: "descripcion", titulo: "Descripción", valor: r => String(r.mov.descripcion ?? "") },
  { clave: "nombre", titulo: "Nombre / comercio", valor: r => String(r.mov.leyendas_adicionales_1 ?? "") },
  { clave: "debito", titulo: "Débito", valor: r => fmt(Number(r.mov.debitos) || 0) },
  { clave: "credito", titulo: "Crédito", valor: r => fmt(Number(r.mov.creditos) || 0) },
  { clave: "categ", titulo: "CATEG", valor: r => String(r.mov.categ ?? "") },
  { clave: "detalle", titulo: "Detalle", valor: r => String(r.mov.detalle ?? "") },
  { clave: "proveedor", titulo: "Proveedor", valor: r => String(r.mov.proveedor_nombre ?? "") },
  { clave: "estado", titulo: "Estado", valor: r => String(r.mov.estado ?? "") },
]
const VALORES = Object.fromEntries(COLUMNAS.map(c => [c.clave, c.valor])) as Record<string, (r: Resultado) => string>

export function BuscadorTodasLasCuentas({ open, onClose, cuentas }: { open: boolean; onClose: () => void; cuentas: CuentaBancaria[] }) {
  const [texto, setTexto] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [filtrosCol, setFiltrosCol] = useState<Record<string, Set<string> | null>>({})
  const vista = useMemo(() => filtrarPorColumnas(resultados ?? [], filtrosCol, VALORES), [resultados, filtrosCol])
  const opcionesCol = (clave: string) => opcionesDeColumna(filtrarPorColumnas(resultados ?? [], { ...filtrosCol, [clave]: null }, VALORES), VALORES[clave])
  const hayFiltroCol = Object.values(filtrosCol).some(Boolean)

  const buscar = async () => {
    const palabras = palabrasDeBusqueda(texto)
    const base = palabraParaLaBase(palabras)
    if (!base) { setAvisos(["Escribí al menos una palabra (un nombre, un concepto): con sólo números o «débito» no se puede buscar en todas las cuentas."]); setResultados([]); return }
    setBuscando(true); setAvisos([])
    const avisosNuevos: string[] = []
    const porCuenta = await Promise.all(cuentas.map(async (c) => {
      const db = c.schema_bd && c.schema_bd !== "public" ? supabase.schema(c.schema_bd) : supabase
      const w = palabraSegura(base)
      // Cada cuenta tiene sus columnas: se prueba con todas y, si alguna no existe en esa tabla, con menos.
      for (const cols of [CAMPOS_DE_TEXTO as readonly string[], ["descripcion", "detalle", "categ"], ["descripcion"]]) {
        let q = db.from(c.tabla_bd).select("*").or(cols.map(k => `${k}.ilike.%${w}%`).join(","))
        if (desde) q = q.gte("fecha", desde)
        if (hasta) q = q.lte("fecha", hasta)
        const { data, error } = await q.order("fecha", { ascending: false }).limit(TOPE_POR_CUENTA)
        if (!error) {
          if ((data ?? []).length >= TOPE_POR_CUENTA) avisosNuevos.push(`${c.nombre}: hay más de ${TOPE_POR_CUENTA}; acotá con más palabras o fechas.`)
          return (data ?? []).filter(m => coincideConTodas(m, palabras)).map(mov => ({ cuenta: c, mov }))
        }
      }
      avisosNuevos.push(`${c.nombre}: no se pudo leer.`)
      return [] as Resultado[]
    }))
    const todos = porCuenta.flat().sort((a, b) => String(b.mov.fecha ?? "").localeCompare(String(a.mov.fecha ?? "")))
    setResultados(todos); setAvisos(avisosNuevos); setBuscando(false); setFiltrosCol({})
  }

  const abrir = (r: Resultado) => {
    const { desde: d, hasta: h } = rangoQueContiene([r.mov.fecha])
    window.open(linkExtracto({ cuenta: r.cuenta.id, movs: [r.mov.id], desde: d, hasta: h }), "_blank")
  }

  // Los totales y la cuenta por titular son de lo que se VE (con los filtros de columna aplicados)
  const totDeb = vista.reduce((t, r) => t + (Number(r.mov.debitos) || 0), 0)
  const totCre = vista.reduce((t, r) => t + (Number(r.mov.creditos) || 0), 0)
  const porTitular = new Map<string, number>()
  for (const r of vista) porTitular.set(r.cuenta.empresa, (porTitular.get(r.cuenta.empresa) ?? 0) + 1)

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-[1400px] w-[96vw] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>🔎 Buscar en todas las cuentas</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[260px]">
            <Input autoFocus placeholder="ej. inmobiliario lima · alcorta · metrogas débito" value={texto}
              onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === "Enter") buscar() }} />
            <p className="mt-0.5 text-[11px] text-gray-500">Varias palabras = tienen que estar todas (en cualquier campo y orden). «débito» / «crédito» eligen el lado. También busca importes (1.234,50).</p>
          </div>
          <div><label className="block text-[11px] text-gray-500">Desde</label><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9" /></div>
          <div><label className="block text-[11px] text-gray-500">Hasta</label><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9" /></div>
          <Button onClick={buscar} disabled={buscando || !texto.trim()}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}Buscar en {cuentas.length} cuentas
          </Button>
        </div>
        {avisos.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{avisos.map((a, i) => <div key={i}>{a}</div>)}</div>}
        {resultados && (
          <div className="text-xs text-gray-600">
            <strong>{vista.length}</strong> movimiento(s){hayFiltroCol && <> de {resultados.length} · <button type="button" className="text-blue-600 hover:underline" onClick={() => setFiltrosCol({})}>quitar filtros de columna</button></>}
            {[...porTitular].map(([t, n]) => <span key={t} className="ml-2 rounded bg-gray-100 px-1.5 py-0.5">{t}: {n}</span>)}
            {vista.length > 0 && <span className="ml-3">débitos <strong className="text-red-700">$ {fmt(totDeb) || "0,00"}</strong> · créditos <strong className="text-green-700">$ {fmt(totCre) || "0,00"}</strong></span>}
          </div>
        )}
        <div className="flex-1 overflow-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {COLUMNAS.filter(c => c.clave !== "titular").map(c => (
                  <th key={c.clave} className="text-left p-2 font-medium text-gray-600 whitespace-nowrap">
                    <FiltroColumna titulo={c.titulo} opciones={opcionesCol(c.clave)} seleccion={filtrosCol[c.clave] ?? null}
                      onChange={sel => setFiltrosCol(prev => ({ ...prev, [c.clave]: sel }))} />
                    {c.clave === "cuenta" && <span className="ml-1"><FiltroColumna titulo="Titular" opciones={opcionesCol("titular")} seleccion={filtrosCol.titular ?? null}
                      onChange={sel => setFiltrosCol(prev => ({ ...prev, titular: sel }))} /></span>}
                  </th>
                ))}
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {vista.map(r => (
                <tr key={`${r.cuenta.id}-${r.mov.id}`} className="hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap"><span className="font-medium">{r.cuenta.nombre}</span> <span className="text-gray-400">{r.cuenta.empresa}</span></td>
                  <td className="p-2 whitespace-nowrap">{fechaAR(r.mov.fecha)}</td>
                  <td className="p-2 max-w-[220px] truncate" title={r.mov.descripcion}>{r.mov.descripcion}</td>
                  <td className="p-2 max-w-[180px] truncate" title={r.mov.leyendas_adicionales_1}>{r.mov.leyendas_adicionales_1}</td>
                  <td className="p-2 text-right whitespace-nowrap text-red-700">{fmt(Number(r.mov.debitos) || 0)}</td>
                  <td className="p-2 text-right whitespace-nowrap text-green-700">{fmt(Number(r.mov.creditos) || 0)}</td>
                  <td className="p-2 max-w-[140px] truncate" title={r.mov.categ}>{r.mov.categ}</td>
                  <td className="p-2 max-w-[200px] truncate" title={r.mov.detalle}>{r.mov.detalle}</td>
                  <td className="p-2 max-w-[160px] truncate" title={r.mov.proveedor_nombre}>{r.mov.proveedor_nombre}</td>
                  <td className="p-2 whitespace-nowrap">{r.mov.estado}</td>
                  <td className="p-2"><button type="button" className="text-blue-600 hover:underline inline-flex items-center gap-0.5" title="Abrir el movimiento en su cuenta (pestaña nueva)" onClick={() => abrir(r)}>abrir <ExternalLink className="h-3 w-3" /></button></td>
                </tr>
              ))}
              {resultados && resultados.length === 0 && avisos.length === 0 && <tr><td colSpan={11} className="p-4 text-center text-gray-400">Nada coincide con «{texto}».</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
