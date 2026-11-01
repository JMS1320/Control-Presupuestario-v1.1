"use client"

/**
 * 🔽 Filtro por columna, tipo Excel (A-FEAT-1441): va en el encabezado de una tabla. Abre la lista de valores sin
 * repetir, con su cantidad, un buscador y casillas. La lógica está en `lib/ui/filtro-columna.ts`.
 * `seleccion` null = sin filtro.
 *
 * ⚠️ cambió 31/10 (A-BUG-1460, JMS: «puse "Ninguna" para después elegir cuál quería y me lo tomó definitivo y quedó
 * mostrando nada; debe funcionar como Excel: pongo Ninguna, después selecciono y le doy OK»): las casillas, «Todas» y
 * «Ninguna» cambian un BORRADOR; recién **Aceptar** filtra. Cancelar (o cerrar) lo descarta.
 */

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import type { OpcionColumna } from "@/lib/ui/filtro-columna"

export function FiltroColumna({ titulo, opciones, seleccion, onChange }: {
  titulo: string
  opciones: OpcionColumna[]
  seleccion: Set<string> | null
  onChange: (s: Set<string> | null) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [abierto, setAbierto] = useState(false)
  /** Lo que se está eligiendo, todavía sin aplicar (null = todas). */
  const [borrador, setBorrador] = useState<Set<string> | null>(seleccion)
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return q ? opciones.filter(o => o.etiqueta.toLowerCase().includes(q) || o.valor.toLowerCase().includes(q)) : opciones
  }, [opciones, busqueda])
  const activo = seleccion !== null
  const marcado = (v: string) => !borrador || borrador.has(v)
  const alternar = (v: string) => {
    const s = new Set(borrador ?? opciones.map(o => o.valor))
    if (s.has(v)) s.delete(v); else s.add(v)
    setBorrador(s.size === opciones.length ? null : s)
  }
  const abrirOCerrar = (a: boolean) => {
    setAbierto(a)
    if (a) setBorrador(seleccion)
    else setBusqueda("")
  }
  const aceptar = () => {
    onChange(borrador && borrador.size === opciones.length ? null : borrador)
    abrirOCerrar(false)
  }
  const elegidos = borrador ? borrador.size : opciones.length

  return (
    <Popover open={abierto} onOpenChange={abrirOCerrar}>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 hover:bg-muted ${activo ? "font-semibold text-primary" : ""}`}
          title={activo ? `Filtrado: ${seleccion!.size} de ${opciones.length}` : `Filtrar por ${titulo.toLowerCase()}`}>
          {titulo}
          <Filter className={`h-3 w-3 ${activo ? "fill-current" : "opacity-50"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-2">
          <Input autoFocus placeholder={`Buscar en ${titulo.toLowerCase()}…`} value={busqueda} onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); aceptar() } }} className="h-7 text-xs" />
        </div>
        <div className="flex gap-1 border-b p-2 text-[11px]">
          <button type="button" className="rounded bg-muted px-2 py-0.5 hover:bg-muted/70" onClick={() => setBorrador(null)}>Todas</button>
          <button type="button" className="rounded bg-muted px-2 py-0.5 hover:bg-muted/70" onClick={() => setBorrador(new Set())}>Ninguna</button>
          {busqueda && visibles.length > 0 && (
            <button type="button" className="rounded bg-muted px-2 py-0.5 hover:bg-muted/70" onClick={() => setBorrador(new Set(visibles.map(o => o.valor)))}>
              Sólo las {visibles.length} que coinciden
            </button>
          )}
          <span className="ml-auto self-center text-muted-foreground">{opciones.length} distintos</span>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {visibles.map(o => (
            <label key={o.valor} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted">
              <input type="checkbox" checked={marcado(o.valor)} onChange={() => alternar(o.valor)} />
              <span className="flex-1 truncate" title={o.valor}>{o.etiqueta}</span>
              <span className="tabular-nums text-muted-foreground">{o.cuenta}</span>
            </label>
          ))}
          {visibles.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nada coincide con «{busqueda}».</p>}
        </div>
        <div className="flex items-center gap-2 border-t p-2 text-xs">
          <span className="text-muted-foreground">{elegidos} de {opciones.length} elegidos</span>
          <button type="button" className="ml-auto rounded border px-2 py-1 hover:bg-muted" onClick={() => abrirOCerrar(false)}>Cancelar</button>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled={elegidos === 0} title={elegidos === 0 ? "Elegí al menos uno" : "Aplicar el filtro"} onClick={aceptar}>Aceptar</button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
