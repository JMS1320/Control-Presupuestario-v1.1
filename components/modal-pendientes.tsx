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
import { Loader2, AlertTriangle, Search, RefreshCw, ExternalLink, MessageSquare, Plus } from "lucide-react"
import type { Pendiente, FilaNoParseada, GrupoPendiente, Pantalla } from "@/lib/pendientes/parse"
import { PANTALLAS } from "@/lib/pendientes/parse"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

const REPO = 'https://github.com/JMS1320/Control-Presupuestario-v1.1/blob/desarrollo/PENDIENTES.md'

/** Comentario del usuario. Vive en BD (`pendientes_comentarios`), NO en el `.md`. */
interface Comentario {
  id: string
  pendiente_id: string
  texto: string
  estado_usuario: string | null
  created_at: string
  leido_at: string | null
}

/** Pendiente propuesto por el usuario. Todavía NO está en el `.md`: Claude lo incorpora. */
interface Propuesto {
  id: string
  titulo: string
  descripcion: string | null
  prioridad_sugerida: string | null
  pantalla_sugerida: string | null
  created_at: string
}

/** Los 4 estados que puede poner el usuario, al lado del de Claude sin pisarlo. */
const ESTADOS_USUARIO = [
  { v: 'terminado', label: '✅ Yo lo doy por terminado' },
  { v: 'chequeado', label: '👀 Lo chequeé' },
  { v: 'revisar',   label: '🔍 Hay que revisarlo' },
  { v: 'descartar', label: '🗑️ Se puede descartar' },
]

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

  // ── Comentarios del usuario (viven en BD, no en el .md) ───────────────────
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  /** Qué pendiente tiene el cuadro de comentario abierto. */
  const [comentando, setComentando] = useState<string | null>(null)
  const [textoCom, setTextoCom] = useState('')
  const [estadoCom, setEstadoCom] = useState<string>('')
  const [guardandoCom, setGuardandoCom] = useState(false)

  // ── Proponer un pendiente nuevo (bandeja de entrada; Claude lo pasa al .md) ──
  const [propuestos, setPropuestos] = useState<Propuesto[]>([])
  const [proponiendo, setProponiendo] = useState(false)
  const [nuevo, setNuevo] = useState({ titulo: '', descripcion: '', prioridad_sugerida: '', pantalla_sugerida: '' })
  const [guardandoProp, setGuardandoProp] = useState(false)

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

  const cargarComentarios = useCallback(async () => {
    try {
      const r = await fetch('/api/pendientes/comentarios?rol=admin')
      if (!r.ok) return
      const d = await r.json()
      setComentarios(d.comentarios ?? [])
    } catch {
      // Los comentarios son un extra: si fallan, el panel sigue mostrando los pendientes.
    }
  }, [])

  const cargarPropuestos = useCallback(async () => {
    try {
      const r = await fetch('/api/pendientes/propuestos?rol=admin')
      if (!r.ok) return
      const d = await r.json()
      setPropuestos(d.propuestos ?? [])
    } catch { /* extra: si falla, el panel sigue andando */ }
  }, [])

  useEffect(() => {
    if (open && !data) { cargar(); cargarComentarios(); cargarPropuestos() }
  }, [open, data, cargar, cargarComentarios, cargarPropuestos])

  const guardarPropuesto = async () => {
    if (!nuevo.titulo.trim()) return
    setGuardandoProp(true)
    try {
      const r = await fetch('/api/pendientes/propuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: nuevo.titulo.trim(),
          descripcion: nuevo.descripcion.trim() || null,
          prioridad_sugerida: nuevo.prioridad_sugerida || null,
          pantalla_sugerida: nuevo.pantalla_sugerida || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); alert('No se pudo guardar: ' + (d.error ?? r.status)); return }
      setNuevo({ titulo: '', descripcion: '', prioridad_sugerida: '', pantalla_sugerida: '' })
      setProponiendo(false)
      await cargarPropuestos()
    } finally {
      setGuardandoProp(false)
    }
  }

  const guardarComentario = async (pendienteId: string) => {
    if (!textoCom.trim()) return
    setGuardandoCom(true)
    try {
      const r = await fetch('/api/pendientes/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendiente_id: pendienteId,
          texto: textoCom.trim(),
          estado_usuario: estadoCom || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); alert('No se pudo guardar: ' + (d.error ?? r.status)); return }
      setTextoCom(''); setEstadoCom(''); setComentando(null)
      await cargarComentarios()
    } finally {
      setGuardandoCom(false)
    }
  }

  /** Sin marca de pantalla y sin revisar: se muestra en todas, pero NO es de ninguna. */
  const sinRevisar = (p: Pendiente) =>
    p.pantallas.length === 0 && !p.esGeneral
    && p.grupo !== 'hecho' && p.grupo !== 'auditar' && p.grupo !== 'obsoleto'

  /**
   * ¿Este pendiente se muestra al filtrar por esta pantalla?
   *
   * **Una sola definición para el contador del chip y para la lista.** Estaban separadas y decían
   * cosas distintas: el chip contaba sólo `pantallas.includes(s)` y la lista mostraba eso **+ los
   * `@general`**. Resultado: el chip decía 37 y abajo aparecían 48. Un contador que no coincide con
   * lo que hay debajo destruye la confianza en toda la pantalla — y lo detectó el usuario, no el
   * control (ver `CLAUDE.md` § Todo desarrollo termina con su control).
   */
  const enPantalla = (p: Pendiente, s: Pantalla) => p.pantallas.includes(s) || p.esGeneral

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
    else if (pantalla) lista = lista.filter(p => enPantalla(p, pantalla))
    return filtrarTexto(lista)
  }

  const fila = (p: Pendiente) => {
    const mios = comentarios.filter(c => c.pendiente_id === p.id)
    const abierto = comentando === p.id
    return (
    <div key={`${p.id}-${p.linea}`} className="border-t py-1.5 first:border-t-0">
      <div className="flex items-start gap-2">
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
        <button
          onClick={() => { setComentando(abierto ? null : p.id); setTextoCom(''); setEstadoCom('') }}
          title="Dejarle un comentario a Claude sobre este pendiente"
          className={`shrink-0 rounded px-1 text-[11px] ${mios.length ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-100'}`}
        >
          <MessageSquare className="inline h-3.5 w-3.5" />{mios.length > 0 && ` ${mios.length}`}
        </button>
        {/* El dossier vive en el .md del repo: se abre en GitHub, anclado al ítem. */}
        {p.ancla && (
          <a href={`${REPO}#${p.ancla}`} target="_blank" rel="noreferrer"
             className="shrink-0 text-blue-600 hover:text-blue-800" title="Ver el dossier en GitHub">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Los comentarios del usuario: van SIEMPRE visibles si existen, en verde para que se
          distingan de un vistazo del texto del pendiente, que es de Claude y viene del .md. */}
      {mios.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {mios.map(c => (
            <div key={c.id} className="rounded border-l-2 border-green-400 bg-green-50 px-2 py-1 text-[11px]">
              {c.estado_usuario && (
                <span className="mr-1 font-medium text-green-800">
                  {ESTADOS_USUARIO.find(e => e.v === c.estado_usuario)?.label ?? c.estado_usuario}
                </span>
              )}
              <span className="text-gray-700">{c.texto}</span>
              <span className="ml-1 text-gray-400">
                · {new Date(c.created_at).toLocaleDateString('es-AR')}
                {!c.leido_at && <span className="ml-1 text-amber-600">· sin leer</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <div className="ml-6 mt-1 space-y-1 rounded border bg-white p-2">
          <textarea
            className="w-full rounded border px-2 py-1 text-xs" rows={2} autoFocus
            placeholder="Lo que quieras decirme sobre este pendiente…"
            value={textoCom} onChange={e => setTextoCom(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select className="h-7 rounded border px-1 text-[11px]"
                    value={estadoCom} onChange={e => setEstadoCom(e.target.value)}>
              <option value="">— sin cambiar el estado —</option>
              {ESTADOS_USUARIO.map(e => <option key={e.v} value={e.v}>{e.label}</option>)}
            </select>
            <Button size="sm" className="h-7 text-xs" disabled={guardandoCom || !textoCom.trim()}
                    onClick={() => guardarComentario(p.id)}>
              {guardandoCom ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setComentando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
    )
  }

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
          <Button variant="outline" size="sm" onClick={() => setProponiendo(v => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />Proponer
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setData(null); cargar() }} disabled={cargando}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        </div>

        {/* Proponer un pendiente. NO se escribe en el .md: queda como propuesta y Claude lo
            incorpora con su ID, sección y dossier. Bandeja de entrada, igual que las notas. */}
        {proponiendo && (
          <div className="space-y-2 rounded border border-blue-300 bg-blue-50 p-2">
            <p className="text-xs font-semibold text-blue-900">Proponer un pendiente</p>
            <Input className="h-8 text-sm" autoFocus placeholder="Qué hay que hacer (una línea)"
              value={nuevo.titulo} onChange={e => setNuevo(n => ({ ...n, titulo: e.target.value }))} />
            <textarea className="w-full rounded border px-2 py-1 text-xs" rows={2}
              placeholder="Detalle, contexto, por qué… (opcional)"
              value={nuevo.descripcion} onChange={e => setNuevo(n => ({ ...n, descripcion: e.target.value }))} />
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-7 rounded border px-1 text-[11px]" value={nuevo.prioridad_sugerida}
                onChange={e => setNuevo(n => ({ ...n, prioridad_sugerida: e.target.value }))}>
                <option value="">— prioridad —</option>
                <option value="urgente">🔴 Urgente</option>
                <option value="secundario">🟠 Secundario</option>
                <option value="test">🧪 Para testear</option>
              </select>
              <select className="h-7 rounded border px-1 text-[11px]" value={nuevo.pantalla_sugerida}
                onChange={e => setNuevo(n => ({ ...n, pantalla_sugerida: e.target.value }))}>
                <option value="">— pantalla —</option>
                {PANTALLAS.map(s => <option key={s} value={s}>@{s}</option>)}
              </select>
              <Button size="sm" className="h-7 text-xs" disabled={guardandoProp || !nuevo.titulo.trim()}
                onClick={guardarPropuesto}>{guardandoProp ? 'Guardando…' : 'Proponer'}</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setProponiendo(false)}>Cancelar</Button>
            </div>
            <p className="text-[10px] text-blue-700">
              Queda como <strong>propuesta</strong>. Claude la pasa a <code>PENDIENTES.md</code> con
              su ID y dossier — la app no puede escribir ese archivo.
            </p>
          </div>
        )}

        {/* Filtro por pantalla. Sólo se ofrecen las que tienen algo marcado, más "sin ubicar". */}
        {data && (() => {
          // MISMA función que usa la lista: el número del chip es lo que vas a ver al hacer clic.
          const cuenta = (s: Pantalla) => data.pendientes.filter(p => enPantalla(p, s)).length
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

            {/* Propuestas del usuario todavía sin incorporar al .md. Van arriba porque son
                trabajo que Claude no vio: si quedan al pie, se pierden. */}
            {propuestos.length > 0 && (
              <div className="rounded border border-blue-300 bg-blue-50 p-2">
                <p className="mb-1 text-sm font-semibold text-blue-900">
                  ✍️ Propuestos por vos ({propuestos.length}) · esperando que Claude los incorpore
                </p>
                <div className="space-y-1">
                  {propuestos.map(p => (
                    <div key={p.id} className="rounded bg-white/70 px-2 py-1 text-xs">
                      <span className="font-medium">{p.titulo}</span>
                      {p.descripcion && <span className="text-gray-600"> — {p.descripcion}</span>}
                      <span className="ml-1 text-[10px] text-gray-400">
                        {p.prioridad_sugerida && `· ${p.prioridad_sugerida} `}
                        {p.pantalla_sugerida && `· @${p.pantalla_sugerida} `}
                        · {new Date(p.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🚨 Comentarios que apuntan a un ID que ya no está en el .md.
                Pasa cuando un pendiente se borra del archivo (se resolvió, se descartó) — el
                comentario queda flotando y, sin este bloque, DESAPARECE EN SILENCIO junto con lo
                que el usuario había escrito. Es la debilidad de que `pendiente_id` sea texto sin FK:
                no hay tabla de pendientes contra la cual referenciar, así que la integridad la
                tiene que chequear la pantalla. */}
            {(() => {
              const ids = new Set(data.pendientes.map(p => p.id))
              const huerfanos = comentarios.filter(c => !ids.has(c.pendiente_id))
              if (huerfanos.length === 0) return null
              return (
                <div className="rounded border border-red-400 bg-red-50 p-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Comentarios sin pendiente ({huerfanos.length})
                  </div>
                  <p className="mt-0.5 text-[10px] text-red-700">
                    Apuntan a un ID que ya no está en <code>PENDIENTES.md</code>: el pendiente se
                    borró o se renumeró. El comentario sigue acá para no perderlo.
                  </p>
                  {huerfanos.map(c => (
                    <p key={c.id} className="mt-1 text-[11px] text-gray-700">
                      <span className="font-mono text-red-700">{c.pendiente_id}</span> · {c.texto}
                    </p>
                  ))}
                </div>
              )
            })()}

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

            {/* 🧮 CONTROL A LA VISTA (CLAUDE.md § Todo desarrollo termina con su control).
                El chip dice un número y abajo hay una lista: si no coinciden, el panel miente.
                Pasó — el chip decía 37 y la lista mostraba 48 — y lo detectó el usuario, no el
                sistema. Ahora se recuentan las dos cosas y se avisa si difieren. */}
            {pantalla && pantalla !== '__sin__' && (() => {
              const enChip = data.pendientes.filter(p => enPantalla(p, pantalla)).length
              const enLista = ORDEN.reduce((n, { grupo }) =>
                n + data.pendientes.filter(p => p.grupo === grupo && enPantalla(p, pantalla)).length, 0)
              const hechos = data.pendientes.filter(p => p.grupo === 'hecho' && enPantalla(p, pantalla)).length
              if (enChip === enLista + hechos) return null
              return (
                <div className="rounded border border-red-400 bg-red-50 p-2 text-xs text-red-800">
                  🚨 <strong>El contador no cuadra con la lista.</strong> El chip dice {enChip} y
                  abajo hay {enLista} + {hechos} hechos = {enLista + hechos}. Faltan{' '}
                  {Math.abs(enChip - enLista - hechos)}: hay un grupo que no se está mostrando.
                </div>
              )
            })()}

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
