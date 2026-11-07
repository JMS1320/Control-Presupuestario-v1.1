"use client"

/**
 * 📎 PDFs de las ventas (A-FEAT-1578). JMS 07/11: *«precisaría poder enviar todos los comprobantes de venta… enviar ventas por
 * mail o descargarlas. seleccionar todas o alguna»*.
 *
 * - Lista los comprobantes de venta de un ejercicio con su PDF vinculado (o ❌).
 * - 🔎 Busca los PDFs en el Drive («<campaña>/<aa-mm>/- Ventas») y PROPONE cuál va con cada venta (`proponerPdfs`); el admin confirma.
 * - ⬇️ Descarga los seleccionados en un zip · ✉️ deja un BORRADOR en Gmail con los PDFs adjuntos (no envía nada).
 * Las ventas seleccionadas sin PDF se listan como salteadas: nunca se descartan en silencio.
 */
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { hoyArgentina } from "@/lib/fechas"
import {
  carpetasDeLaVenta, proponerPdfs, nombreEnZip, idDeDrive,
  type ArchivoDeVentas, type EmpresaVenta, type Propuesta,
} from "@/lib/ventas/pdf-ventas"

type Venta = {
  id: string
  fecha_liquidacion: string | null
  denominacion_cliente: string | null
  cuit_cliente: string | null
  tipo_comprobante: number | null
  punto_venta: number | null
  numero_desde: number | null
  imp_total: number | null
  año_contable: number | null
  mes_contable: number | null
  pdf_drive_url: string | null
}

const fmtPlata = (n: number | null) => n == null ? "—" : `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (s: string | null) => { if (!s) return "—"; const [y, m, d] = s.slice(0, 10).split("-"); return `${d}/${m}/${y}` }
const comprobanteDe = (v: Venta) => v.numero_desde == null ? "—"
  : `${v.tipo_comprobante != null ? String(v.tipo_comprobante).padStart(3, "0") + " " : ""}${String(v.punto_venta ?? 0).padStart(4, "0")}-${String(v.numero_desde).padStart(8, "0")}`

/** El ejercicio de una fecha: MSA cierra el 30/06 («2025-2026»); PAM y MA, año calendario («2026»). */
const ejercicioDe = (empresa: EmpresaVenta, fecha: string | null): string | null => {
  if (!fecha) return null
  const a = Number(fecha.slice(0, 4)), m = Number(fecha.slice(5, 7))
  if (!a || !m) return null
  if (empresa !== "MSA") return String(a)
  return m >= 7 ? `${a}-${a + 1}` : `${a - 1}-${a}`
}

const TODAS = "todas"

export function VentasPdfs({ empresa, esAdmin }: { empresa: EmpresaVenta; esAdmin: boolean }) {
  const schema = empresa.toLowerCase()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(false)
  const [ejercicio, setEjercicio] = useState<string>("")
  const [sel, setSel] = useState<Set<string>>(new Set())

  const [buscando, setBuscando] = useState(false)
  const [archivos, setArchivos] = useState<ArchivoDeVentas[] | null>(null)
  const [faltan, setFaltan] = useState<string[]>([])
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [eleccion, setEleccion] = useState<Record<string, string>>({}) // ventaId → file_id elegido
  const [guardando, setGuardando] = useState(false)

  const [progreso, setProgreso] = useState<string>("")
  const [salteadas, setSalteadas] = useState<string[]>([])

  const [mailAbierto, setMailAbierto] = useState(false)
  const [para, setPara] = useState("")
  const [asunto, setAsunto] = useState(`Facturas de venta ${empresa}`)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const { data, error } = await supabase.schema(schema).from("comprobantes_venta")
        .select("id, fecha_liquidacion, denominacion_cliente, cuit_cliente, tipo_comprobante, punto_venta, numero_desde, imp_total, año_contable, mes_contable, pdf_drive_url")
        .order("fecha_liquidacion", { ascending: true })
      if (error) throw error
      setVentas((data ?? []) as unknown as Venta[])
    } catch (e) {
      toast.error(`No se pudieron leer las ventas: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [schema]) // eslint-disable-line react-hooks/exhaustive-deps

  const ejercicios = useMemo(() => {
    const s = new Set<string>()
    for (const v of ventas) { const e = ejercicioDe(empresa, v.fecha_liquidacion); if (e) s.add(e) }
    return [...s].sort()
  }, [ventas, empresa])
  // por default, el último ejercicio con ventas
  useEffect(() => { if (!ejercicio && ejercicios.length) setEjercicio(ejercicios[ejercicios.length - 1]) }, [ejercicios, ejercicio])

  const visibles = useMemo(() => ejercicio === TODAS || !ejercicio ? ventas
    : ventas.filter(v => ejercicioDe(empresa, v.fecha_liquidacion) === ejercicio), [ventas, ejercicio, empresa])
  const porId = useMemo(() => new Map(ventas.map(v => [v.id, v])), [ventas])
  const elegidas = visibles.filter(v => sel.has(v.id))
  const conPdf = elegidas.filter(v => v.pdf_drive_url)
  const sinPdf = elegidas.filter(v => !v.pdf_drive_url)

  // al cambiar de ejercicio se limpia lo que dependía del anterior
  useEffect(() => { setSel(new Set()); setPropuestas([]); setArchivos(null); setFaltan([]); setEleccion({}); setSalteadas([]) }, [ejercicio])

  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todasMarcadas = visibles.length > 0 && visibles.every(v => sel.has(v.id))

  const etiquetaVenta = (v: Venta) => `${fmtFecha(v.fecha_liquidacion)} · ${v.denominacion_cliente ?? "sin cliente"} · ${comprobanteDe(v)}`

  // ── 🔎 Buscar en el Drive ──────────────────────────────────────────────────────────────────
  const buscar = async () => {
    const sinVincular = visibles.filter(v => !v.pdf_drive_url)
    if (!sinVincular.length) { toast.info("Todas las ventas de la lista ya tienen su PDF vinculado"); return }
    const carpetas = sinVincular.flatMap(v => carpetasDeLaVenta(empresa, v))
    const unicas = [...new Map(carpetas.map(c => [c.join("/"), c])).values()]
    setBuscando(true)
    try {
      const r = await fetch("/api/ventas/pdfs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "listar", empresa, carpetas: unicas }) })
      const j = await r.json()
      if (!j.ok) { toast.error(j.error ?? "No se pudo listar el Drive"); return }
      const lista = (j.archivos ?? []) as ArchivoDeVentas[]
      setArchivos(lista); setFaltan(j.faltan ?? [])
      const props = proponerPdfs([...sinVincular, ...ventas.filter(v => v.pdf_drive_url)], lista)
      setPropuestas(props)
      setEleccion(Object.fromEntries(props.filter(p => p.archivo).map(p => [p.ventaId, p.archivo!.file_id])))
      toast.success(`${lista.length} archivos en ${unicas.length - (j.faltan?.length ?? 0)} carpetas · ${props.filter(p => p.archivo).length} propuestas`)
    } catch (e) {
      toast.error(`No se pudo buscar en el Drive: ${(e as Error).message}`)
    } finally { setBuscando(false) }
  }

  /** Los archivos que se pueden elegir a mano para una venta: los de SUS carpetas (o todos si ahí no hay ninguno). */
  const opcionesPara = (v: Venta): ArchivoDeVentas[] => {
    if (!archivos) return []
    const usados = new Set(ventas.map(x => x.pdf_drive_url).filter(Boolean).map(u => idDeDrive(u!)))
    const libres = archivos.filter(a => !usados.has(a.file_id))
    const suyas = new Set(carpetasDeLaVenta(empresa, v).map(c => c.join("/")))
    const propias = libres.filter(a => a.carpeta && suyas.has(a.carpeta))
    return propias.length ? propias : libres
  }

  const guardarVinculo = async (ventaId: string, url: string | null): Promise<boolean> => {
    const { data, error } = await supabase.schema(schema).from("comprobantes_venta").update({ pdf_drive_url: url }).eq("id", ventaId).select("id")
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return false }
    if (!data?.length) { toast.error("No se guardó: la base no devolvió la fila (¿permisos?)"); return false }
    setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, pdf_drive_url: url } : v))
    return true
  }

  const vincular = async (ventaIds: string[]) => {
    if (!archivos) return
    setGuardando(true)
    const hechos: string[] = []
    try {
      for (const id of ventaIds) {
        const a = archivos.find(x => x.file_id === eleccion[id])
        if (!a) continue
        if (await guardarVinculo(id, a.url)) hechos.push(id)
      }
    } finally { setGuardando(false) }
    if (hechos.length) {
      toast.success(`${hechos.length} PDF vinculado${hechos.length === 1 ? "" : "s"}`)
      setPropuestas(prev => prev.filter(p => !hechos.includes(p.ventaId)))
    }
  }

  const quitar = async (v: Venta) => {
    if (!window.confirm(`¿Quitar el PDF vinculado a ${etiquetaVenta(v)}? (el archivo sigue en el Drive)`)) return
    if (await guardarVinculo(v.id, null)) toast.success("Vínculo quitado")
  }

  const propuestasSimples = propuestas.filter(p => p.archivo && eleccion[p.ventaId] === p.archivo.file_id)

  // ── ⬇️ Zip ──────────────────────────────────────────────────────────────────────────────────
  const descargarZip = async () => {
    setSalteadas(sinPdf.map(etiquetaVenta))
    if (!conPdf.length) { toast.error("Ninguna de las seleccionadas tiene PDF vinculado"); return }
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const fallas: string[] = [], usados = new Set<string>()
    let hechos = 0
    setProgreso(`0 de ${conPdf.length}`)
    try {
      for (let i = 0; i < conPdf.length; i += 3) {
        await Promise.all(conPdf.slice(i, i + 3).map(async v => {
          try {
            const r = await fetch("/api/gas/leer-archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: idDeDrive(v.pdf_drive_url!), bytes: true }) })
            const j = await r.json()
            if (!j.ok || !j.b64) { fallas.push(`${etiquetaVenta(v)}: ${j.error ?? "sin contenido"}`); return }
            const bin = atob(j.b64); const u8 = new Uint8Array(bin.length)
            for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k)
            let nombre = nombreEnZip(v, String(j.nombre ?? "archivo.pdf"))
            for (let n = 2; usados.has(nombre); n++) nombre = nombre.replace(/(\s\(\d+\))?(\.[a-z0-9]+)$/i, ` (${n})$2`)
            usados.add(nombre)
            zip.file(nombre, u8)
          } catch (e) { fallas.push(`${etiquetaVenta(v)}: ${(e as Error).message}`) }
          finally { hechos++; setProgreso(`${hechos} de ${conPdf.length}`) }
        }))
      }
      if (!usados.size) { toast.error(`No se pudo leer ningún PDF del Drive`, { description: fallas.join("\n") }); return }
      const blob = await zip.generateAsync({ type: "blob" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `Ventas ${empresa} (${fmtFecha(hoyArgentina()).replace(/\//g, "-")}).zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      toast.success(`Zip con ${usados.size} PDF${usados.size === 1 ? "" : "s"}`)
      if (fallas.length) toast.error(`${fallas.length} no se pudieron leer del Drive`, { description: fallas.join("\n"), duration: 15_000 })
    } finally { setProgreso("") }
  }

  // ── ✉️ Borrador ─────────────────────────────────────────────────────────────────────────────
  const abrirMail = () => {
    setSalteadas(sinPdf.map(etiquetaVenta))
    if (!conPdf.length) { toast.error("Ninguna de las seleccionadas tiene PDF vinculado"); return }
    setTexto(`Hola,\n\nTe adjunto los comprobantes de venta de ${empresa}:\n\n${conPdf.map(v => `• ${etiquetaVenta(v)} · ${fmtPlata(v.imp_total)}`).join("\n")}\n\nSaludos.`)
    setMailAbierto(true)
  }
  const crearBorrador = async () => {
    setEnviando(true)
    try {
      const r = await fetch("/api/ventas/pdfs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "borrador", para, asunto, texto, file_ids: conPdf.map(v => idDeDrive(v.pdf_drive_url!)) }) })
      const j = await r.json()
      if (!j.ok) { toast.error(j.error ?? "No se pudo crear el borrador", { duration: 15_000 }); return }
      toast.success(`Borrador en Gmail con ${j.adjuntos ?? conPdf.length} adjuntos${j.mb != null ? ` (${Number(j.mb).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB)` : ""}`)
      setMailAbierto(false)
    } catch (e) {
      toast.error(`No se pudo crear el borrador: ${(e as Error).message}`)
    } finally { setEnviando(false) }
  }

  const vinculadas = visibles.filter(v => v.pdf_drive_url).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ejercicio</Label>
          <select className="border rounded h-9 px-2 text-sm min-w-[140px]" value={ejercicio} onChange={e => setEjercicio(e.target.value)}>
            {ejercicios.map(e => <option key={e} value={e}>{e}</option>)}
            <option value={TODAS}>Todas</option>
          </select>
        </div>
        <div className="text-sm text-gray-600 pb-2">
          {cargando ? "Cargando…" : `${visibles.length} ventas · ${vinculadas} con PDF · ${elegidas.length} seleccionadas`}
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          {esAdmin && <Button size="sm" variant="outline" onClick={buscar} disabled={buscando || cargando}>{buscando ? "Buscando…" : "🔎 Buscar los PDFs en el Drive"}</Button>}
          <Button size="sm" variant="outline" onClick={descargarZip} disabled={!elegidas.length || !!progreso}>{progreso ? `Bajando ${progreso}…` : `⬇️ Descargar (zip)`}</Button>
          <Button size="sm" variant="outline" onClick={abrirMail} disabled={!elegidas.length}>✉️ Borrador de mail</Button>
        </div>
      </div>

      {salteadas.length > 0 && (
        <div className="text-xs border border-amber-300 bg-amber-50 rounded p-2">
          <strong>⚠️ {salteadas.length} seleccionada{salteadas.length === 1 ? "" : "s"} sin PDF vinculado — no van:</strong>
          <ul className="list-disc ml-5">{salteadas.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}

      {mailAbierto && (
        <div className="border rounded p-3 space-y-2 bg-blue-50/40">
          <div className="text-sm font-medium">✉️ Borrador en Gmail con {conPdf.length} PDF{conPdf.length === 1 ? "" : "s"} — no se envía: lo revisás y lo mandás desde Gmail</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Para (opcional)</Label><Input value={para} onChange={e => setPara(e.target.value)} placeholder="contador@…" /></div>
            <div className="space-y-1"><Label className="text-xs">Asunto</Label><Input value={asunto} onChange={e => setAsunto(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Texto</Label><Textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={crearBorrador} disabled={enviando || !asunto.trim()}>{enviando ? "Creando…" : "Crear borrador"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setMailAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {archivos && (
        <div className="border rounded p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">🔎 Lo que encontré en el Drive: {archivos.length} archivos</div>
            {faltan.length > 0 && <span className="text-xs text-gray-500" title={faltan.join("\n")}>· {faltan.length} carpeta{faltan.length === 1 ? "" : "s"} «- Ventas» no existe{faltan.length === 1 ? "" : "n"}</span>}
            {propuestasSimples.length > 0 && (
              <Button size="sm" className="ml-auto" onClick={() => vincular(propuestasSimples.map(p => p.ventaId))} disabled={guardando}>
                Vincular las propuestas ({propuestasSimples.length})
              </Button>
            )}
          </div>
          {propuestas.length === 0 ? <div className="text-xs text-gray-500">No queda ninguna venta sin PDF.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Venta</TableHead><TableHead>PDF</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {propuestas.map(p => {
                  const v = porId.get(p.ventaId); if (!v) return null
                  const opciones = p.candidatos.length ? p.candidatos : opcionesPara(v)
                  return (
                    <TableRow key={p.ventaId}>
                      <TableCell className="text-xs whitespace-nowrap">{etiquetaVenta(v)}<div className="text-gray-500">{fmtPlata(v.imp_total)}</div></TableCell>
                      <TableCell className="text-xs">
                        {p.archivo ? <span>✓ {p.archivo.archivo} <span className="text-gray-500">({p.motivo})</span></span> : (
                          <div className="space-y-1">
                            <div className={p.candidatos.length ? "text-amber-700" : "text-gray-500"}>{p.candidatos.length ? "⚠️ " : "❌ "}{p.motivo}</div>
                            {opciones.length > 0 && (
                              <select className="border rounded h-8 px-1 text-xs max-w-[420px]" value={eleccion[p.ventaId] ?? ""}
                                onChange={e => setEleccion(prev => ({ ...prev, [p.ventaId]: e.target.value }))}>
                                <option value="">{p.candidatos.length ? "Elegí cuál…" : "Elegir a mano…"}</option>
                                {opciones.map(a => <option key={a.file_id} value={a.file_id}>{a.archivo}{a.carpeta ? ` — ${a.carpeta}` : ""}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {eleccion[p.ventaId] && (
                          <>
                            <a className="text-xs text-blue-600 underline mr-2" href={archivos.find(a => a.file_id === eleccion[p.ventaId])?.url} target="_blank" rel="noreferrer">ver</a>
                            <Button size="sm" variant="outline" onClick={() => vincular([p.ventaId])} disabled={guardando}>✓ Vincular</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <div className="overflow-x-auto max-h-[420px] overflow-y-auto border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={todasMarcadas} onCheckedChange={() => setSel(todasMarcadas ? new Set() : new Set(visibles.map(v => v.id)))}
                  title={todasMarcadas ? "Ninguna" : "Seleccionar todas"} />
              </TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>📎</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map(v => (
              <TableRow key={v.id}>
                <TableCell><Checkbox checked={sel.has(v.id)} onCheckedChange={() => toggle(v.id)} /></TableCell>
                <TableCell className="whitespace-nowrap">{fmtFecha(v.fecha_liquidacion)}</TableCell>
                <TableCell>{v.denominacion_cliente || "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{comprobanteDe(v)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{fmtPlata(v.imp_total)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {v.pdf_drive_url ? (
                    <>
                      <a href={v.pdf_drive_url} target="_blank" rel="noreferrer" title="Abrir el PDF">📎</a>
                      {esAdmin && <button className="ml-2 text-xs text-gray-500 hover:text-red-600 underline" onClick={() => quitar(v)}>quitar</button>}
                    </>
                  ) : <span title="Sin PDF vinculado">❌</span>}
                </TableCell>
              </TableRow>
            ))}
            {!visibles.length && !cargando && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-gray-500">No hay ventas en este ejercicio.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
