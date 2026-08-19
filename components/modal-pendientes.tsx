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
import type { Pendiente, FilaNoParseada, GrupoPendiente, Pantalla } from "@/lib/pendientes/parse"
import { PANTALLAS } from "@/lib/pendientes/parse"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

const REPO = 'https://github.com/JMS1320/Control-Presupuestario-v1.1/blob/desarrollo/PENDIENTES.md'

interface Respuesta {
  grupos: Record<GrupoPendiente, number>
  pendientes: Pendiente[]
  noParseadas: FilaNoParseada[]
  ignoradas: FilaNoParseada[]
  totalDetectadas: number
  marcasDesconocidas: { marca: string; ids: string[] }[]
  generado_at: string
}

/**
 * Orden de arriba hacia abajo. Criterio del usuario: *"siempre se debe mostrar separado lo urgente
 * de lo medio y lo que es sólo testear"*, y lo dudoso/obsoleto **visible pero muy fácil de obviar**.
 *
 * `auditar` y `obsoleto` salen de las secciones C y D del archivo, no de una marca: el índice ya
 * los tenía clasificados. Van plegados — están, pero no compiten con el trabajo real.
 */
const ORDEN: { grupo: GrupoPendiente; titulo: string; clases: string; ayuda: string; plegado?: boolean }[] = [
  { grupo: 'urgente',    titulo: '🔴 Urgente',     clases: 'border-red-300 bg-red-50',     ayuda: 'prioridad Alta o bugs' },
  { grupo: 'secundario', titulo: '🟠 Secundario',  clases: 'border-amber-300 bg-amber-50', ayuda: 'prioridad Media o Baja' },
  { grupo: 'test',       titulo: '🧪 Sin testear', clases: 'border-blue-300 bg-blue-50',   ayuda: 'hecho pero falta probarlo' },
  { grupo: 'auditar',    titulo: '🔍 A auditar juntos', clases: 'border-gray-300 bg-gray-50', ayuda: 'Sección C — dudosos, se revisan con el usuario', plegado: true },
  { grupo: 'obsoleto',   titulo: '🗄️ Probablemente obsoleto', clases: 'border-gray-200 bg-gray-50/60', ayuda: 'Sección D — histórico', plegado: true },
]

export function ModalPendientes({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [verHechos, setVerHechos] = useState(false)
  const [verIgnoradas, setVerIgnoradas] = useState(false)
  /** null = todas. `'__sin__'` = sólo los que no tienen marca de pantalla. */
  const [pantalla, setPantalla] = useState<Pantalla | '__sin__' | null>(null)
  /** Los grupos plegados (auditar / obsoleto) arrancan cerrados. */
  const [desplegado, setDesplegado] = useState<Record<string, boolean>>({})

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch('/api/pendientes?rol=admin')
      const d = await r.json()
      if (!r.ok) { setError(d.error || `Error ${r.status}`); return }
      // Se completan los campos que falten en vez de confiar en la forma de la respuesta.
      // Un campo ausente hacía `undefined.length` en el render → React tiraba el árbol entero y
      // la app mostraba "This page couldn't load". Un panel de consulta NO puede tumbar la app.
      setData({
        grupos: { urgente: 0, secundario: 0, test: 0, auditar: 0, obsoleto: 0, hecho: 0, ...(d.grupos ?? {}) },
        pendientes: d.pendientes ?? [],
        noParseadas: d.noParseadas ?? [],
        ignoradas: d.ignoradas ?? [],
        marcasDesconocidas: d.marcasDesconocidas ?? [],
        totalDetectadas: d.totalDetectadas ?? 0,
        generado_at: d.generado_at ?? '',
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { if (open && !data) cargar() }, [open, data, cargar])

  /** Sin marca de pantalla y sin revisar: se muestra en todas, pero NO es de ninguna. */
  const sinRevisar = (p: Pendiente) =>
    p.pantallas.length === 0 && !p.esGeneral
    && p.grupo !== 'hecho' && p.grupo !== 'auditar' && p.grupo !== 'obsoleto'

  /**
   * Filtra por pantalla y por texto.
   *
   * ⚠️ Al elegir una pantalla se muestran **sólo los que la tienen marcada**, no los sin revisar.
   * Los sin revisar *siguen* apareciendo en todas las solapas — pero van en un bloque **aparte**
   * al pie. Antes se mezclaban acá y el filtro parecía roto: elegías `@ingresos` (13) y seguías
   * viendo 197 ítems, porque los 184 sin ubicar entraban en cualquier filtro.
   */
  /** Sólo el buscador de texto. Se usa suelto en el bloque de "sin ubicar". */
  const filtrarTexto = (lista: Pendiente[]) => {
    const q = normalizarBusqueda(busqueda.trim())
    if (!q) return lista
    return lista.filter(p =>
      normalizarBusqueda(p.id).includes(q)
      || normalizarBusqueda(p.titulo).includes(q)
      || normalizarBusqueda(p.detalle || '').includes(q)
      || normalizarBusqueda(p.seccion || '').includes(q))
  }

  const filtrar = (lista: Pendiente[]) => {
    if (pantalla === '__sin__') lista = lista.filter(sinRevisar)
    else if (pantalla) lista = lista.filter(p => p.pantallas.includes(pantalla) || p.esGeneral)
    return filtrarTexto(lista)
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
        <p className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-gray-400">
          {/* Dónde se muestra: sus pantallas, `general` (revisado, va a todas) o nada (sin revisar). */}
          {p.pantallas.map(s => (
            <span key={s} className="rounded bg-blue-50 px-1 text-blue-700">@{s}</span>
          ))}
          {p.esGeneral && <span className="rounded bg-gray-100 px-1 text-gray-600">general</span>}
          {p.seccion && <span>{p.seccion}</span>}
        </p>
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

        {/* Filtro por pantalla. Sólo se ofrecen las que tienen algo marcado, más "sin ubicar". */}
        {data && (() => {
          const cuenta = (s: Pantalla) => data.pendientes.filter(p => p.pantallas.includes(s)).length
          // "Sin ubicar" = sin revisar. `@general` y las secciones C/D ya tienen su lugar.
          const sinUbicar = data.pendientes.filter(p =>
            p.pantallas.length === 0 && !p.esGeneral
            && p.grupo !== 'hecho' && p.grupo !== 'auditar' && p.grupo !== 'obsoleto').length
          const conAlgo = PANTALLAS.filter(s => cuenta(s) > 0)
          if (conAlgo.length === 0 && sinUbicar === 0) return null
          const chip = (activo: boolean) =>
            `rounded-full border px-2 py-0.5 text-[11px] ${activo ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`
          return (
            <div className="flex flex-wrap items-center gap-1">
              <button className={chip(pantalla === null)} onClick={() => setPantalla(null)}>Todas</button>
              {conAlgo.map(s => (
                <button key={s} className={chip(pantalla === s)} onClick={() => setPantalla(s)}>
                  @{s} <span className="text-gray-400">{cuenta(s)}</span>
                </button>
              ))}
              {sinUbicar > 0 && (
                <button className={chip(pantalla === '__sin__')} onClick={() => setPantalla('__sin__')}
                        title="No tienen marca @pantalla — se muestran en todas las solapas">
                  sin ubicar <span className="text-gray-400">{sinUbicar}</span>
                </button>
              )}
            </div>
          )
        })()}

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

            {/* Marca mal escrita: el único camino por el que un pendiente podría no mostrarse en
                ningún lado. El ítem igual cae a "sin ubicar", pero el tipeo hay que corregirlo. */}
            {data.marcasDesconocidas.length > 0 && (
              <div className="rounded border border-red-400 bg-red-50 p-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Marcas @pantalla mal escritas ({data.marcasDesconocidas.length})
                </div>
                {data.marcasDesconocidas.map(m => (
                  <p key={m.marca} className="mt-1 font-mono text-[10px] text-red-700">
                    @{m.marca} → {m.ids.join(', ')}
                  </p>
                ))}
                <p className="mt-1 text-[10px] text-red-700">
                  Válidas: {PANTALLAS.map(s => '@' + s).join(' · ')}
                </p>
              </div>
            )}

            {ORDEN.map(({ grupo, titulo, clases, ayuda, plegado }) => {
              const filas = filtrar(data.pendientes.filter(p => p.grupo === grupo))
              if (filas.length === 0) return null
              const abierto = !plegado || desplegado[grupo]
              return (
                <div key={grupo} className={`rounded border p-2 ${clases}`}>
                  <button
                    className={`mb-1 flex w-full items-baseline gap-2 text-left ${plegado ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => plegado && setDesplegado(d => ({ ...d, [grupo]: !d[grupo] }))}
                  >
                    <span className="text-sm font-semibold">{titulo}</span>
                    <span className="text-xs text-gray-500">({filas.length}) · {ayuda}</span>
                    {plegado && <span className="ml-auto text-xs text-gray-400">{abierto ? '▲ ocultar' : '▼ ver'}</span>}
                  </button>
                  {abierto && <div className="rounded bg-white/70 px-2">{filas.map(fila)}</div>}
                </div>
              )
            })}

            {/* Con una pantalla elegida: los SIN REVISAR van acá, aparte y plegados.
                Siguen apareciendo en todas las solapas (pedido del usuario) pero no se mezclan
                con los que sí son de esta pantalla — que era lo que hacía parecer roto el filtro. */}
            {pantalla && pantalla !== '__sin__' && (() => {
              const filas = data.pendientes.filter(sinRevisar)
              if (filas.length === 0) return null
              const abierto = desplegado['__sinrevisar__']
              return (
                <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-2">
                  <button className="flex w-full items-baseline gap-2 text-left"
                    onClick={() => setDesplegado(d => ({ ...d, __sinrevisar__: !d.__sinrevisar__ }))}>
                    <span className="text-sm font-semibold text-gray-600">📥 Sin ubicar</span>
                    <span className="text-xs text-gray-500">
                      ({filas.length}) · todavía sin revisar — aparecen en todas las pantallas
                    </span>
                    <span className="ml-auto text-xs text-gray-400">{abierto ? '▲ ocultar' : '▼ ver'}</span>
                  </button>
                  {abierto && <div className="mt-1 rounded bg-white/70 px-2">{filtrarTexto(filas).map(fila)}</div>}
                </div>
              )
            })()}

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
