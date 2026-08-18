"use client"

// Panel de pendientes de desarrollo (P-37, etapa 2).
//
// Modal y no solapa nueva: una 13ª rompe el `grid-cols-12` del TabsList de `dashboard.tsx`. Es el
// mismo criterio con el que la ficha de proveedores quedó como modal (ver PENDIENTES § A-TEST-24).
//
// Se abre desde la solapa **Principal**, que ya es admin-only por construcción (`canAccess` en
// dashboard.tsx: contable sólo ve Egresos). Por eso el fetch va con `rol=admin`.
//
// El dato sale de `/api/pendientes`, que parsea `PENDIENTES.md` — la fuente única. Acá no se
// guarda ni se edita nada: es una lectura.

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, Search, RefreshCw, ExternalLink } from "lucide-react"
import type { Pendiente, FilaNoParseada, GrupoPendiente } from "@/lib/pendientes/parse"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

const REPO = 'https://github.com/JMS1320/Control-Presupuestario-v1.1/blob/desarrollo/PENDIENTES.md'

interface Respuesta {
  grupos: Record<GrupoPendiente, number>
  pendientes: Pendiente[]
  noParseadas: FilaNoParseada[]
  ignoradas: FilaNoParseada[]
  totalDetectadas: number
  generado_at: string
}

/** Orden de arriba hacia abajo, tal como lo pidió el usuario: test abajo de todo. */
const ORDEN: { grupo: GrupoPendiente; titulo: string; clases: string; ayuda: string }[] = [
  { grupo: 'urgente',    titulo: '🔴 Urgente',    clases: 'border-red-300 bg-red-50',       ayuda: 'prioridad Alta o bugs' },
  { grupo: 'secundario', titulo: '🟠 Secundario', clases: 'border-amber-300 bg-amber-50',   ayuda: 'prioridad Media o Baja' },
  { grupo: 'test',       titulo: '🧪 Sin testear', clases: 'border-blue-300 bg-blue-50',    ayuda: 'hecho pero falta probarlo' },
]

export function ModalPendientes({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [verHechos, setVerHechos] = useState(false)
  const [verIgnoradas, setVerIgnoradas] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch('/api/pendientes?rol=admin')
      const d = await r.json()
      if (!r.ok) { setError(d.error || `Error ${r.status}`); return }
      setData(d)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { if (open && !data) cargar() }, [open, data, cargar])

  const filtrar = (lista: Pendiente[]) => {
    const q = normalizarBusqueda(busqueda.trim())
    if (!q) return lista
    return lista.filter(p =>
      normalizarBusqueda(p.id).includes(q)
      || normalizarBusqueda(p.titulo).includes(q)
      || normalizarBusqueda(p.detalle || '').includes(q)
      || normalizarBusqueda(p.seccion || '').includes(q))
  }

  const fila = (p: Pendiente) => (
    <div key={`${p.id}-${p.linea}`} className="flex items-start gap-2 border-t py-1.5 first:border-t-0">
      <Badge variant="outline" className="shrink-0 font-mono text-[11px]">{p.id}</Badge>
      <span className="shrink-0 text-sm">{p.estado}</span>
      {(p.prioridad || p.tipo) && (
        <span className="shrink-0 text-[11px] text-gray-500">{p.prioridad || p.tipo}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug">{p.titulo}</p>
        {p.seccion && <p className="mt-0.5 text-[10px] text-gray-400">{p.seccion}</p>}
      </div>
      {/* El dossier vive en el .md del repo: se abre en GitHub, anclado al ítem. */}
      {p.ancla && (
        <a href={`${REPO}#${p.ancla}`} target="_blank" rel="noreferrer"
           className="shrink-0 text-blue-600 hover:text-blue-800" title="Ver el dossier en GitHub">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )

  const bloqueRaro = (titulo: string, filas: FilaNoParseada[], alarma: boolean) => (
    <div className={`rounded border p-2 ${alarma ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${alarma ? 'text-red-800' : 'text-gray-600'}`}>
        {alarma && <AlertTriangle className="h-3.5 w-3.5" />}
        {titulo} ({filas.length})
      </div>
      <div className="mt-1 space-y-1">
        {filas.map(f => (
          <p key={f.linea} className="font-mono text-[10px] text-gray-600">
            L{f.linea} · {f.motivo}<br />
            <span className="text-gray-400">{f.texto.slice(0, 120)}</span>
          </p>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 Pendientes de desarrollo
            {data && <span className="text-sm font-normal text-gray-500">
              {data.grupos.urgente} urgentes · {data.grupos.secundario} secundarios · {data.grupos.test} sin testear
            </span>}
          </DialogTitle>
          <DialogDescription>
            Se leen de <code>PENDIENTES.md</code> del commit publicado. Es sólo lectura: para
            cambiar un pendiente hay que editar el archivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input className="h-9 pl-8 text-sm" placeholder="Buscar por ID, texto o sección…"
                   value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => { setData(null); cargar() }} disabled={cargando}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {cargando && !data && (
            <p className="flex items-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo PENDIENTES.md…
            </p>
          )}

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <strong>No se pudo leer el archivo.</strong> {error}
              <p className="mt-1 text-xs">
                Si pasa sólo en producción, suele ser que el <code>.md</code> no viajó al bundle:
                revisar <code>outputFileTracingIncludes</code> en <code>next.config.mjs</code>.
              </p>
            </div>
          )}

          {data && (<>
            {/* La alarma va PRIMERO: si algo del índice no se pudo leer, hay que saberlo antes
                de mirar la lista — si no, el panel muestra menos de lo que hay y nadie se entera. */}
            {data.noParseadas.length > 0
              && bloqueRaro('🚨 Filas del índice que NO se pudieron leer — el panel está incompleto', data.noParseadas, true)}

            {ORDEN.map(({ grupo, titulo, clases, ayuda }) => {
              const filas = filtrar(data.pendientes.filter(p => p.grupo === grupo))
              if (filas.length === 0) return null
              return (
                <div key={grupo} className={`rounded border p-2 ${clases}`}>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{titulo}</span>
                    <span className="text-xs text-gray-500">({filas.length}) · {ayuda}</span>
                  </div>
                  <div className="rounded bg-white/70 px-2">{filas.map(fila)}</div>
                </div>
              )
            })}

            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              <button className="text-gray-500 underline" onClick={() => setVerHechos(v => !v)}>
                {verHechos ? 'Ocultar' : `Ver ${data.grupos.hecho} hechos`}
              </button>
              {data.ignoradas.length > 0 && (
                <button className="text-gray-500 underline" onClick={() => setVerIgnoradas(v => !v)}>
                  {verIgnoradas ? 'Ocultar' : `Ver ${data.ignoradas.length} filas ignoradas`}
                </button>
              )}
              <span className="ml-auto text-gray-400">
                {data.pendientes.length} de {data.totalDetectadas} filas detectadas
              </span>
            </div>

            {verHechos && (
              <div className="rounded border border-green-200 bg-green-50 p-2">
                <div className="mb-1 text-sm font-semibold">✅ Hechos</div>
                <div className="rounded bg-white/70 px-2">
                  {filtrar(data.pendientes.filter(p => p.grupo === 'hecho')).map(fila)}
                </div>
              </div>
            )}

            {verIgnoradas && bloqueRaro(
              'Filas que mencionan un ID dentro de un dossier (no son del índice)', data.ignoradas, false)}
          </>)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
