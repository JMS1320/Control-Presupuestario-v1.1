"use client"

/**
 * 📓 EL CUADERNO DE TRABAJO — piloto (A-FEAT-1410).
 *
 * JMS 2026-10-28: «anotaciones de trabajo… formato Word y formato Excel. Simularía un cuaderno en mi mano. El
 * documento puede ser una combinación de Word con Excel intercalados».
 *
 * Un cuaderno es una lista de bloques que se intercalan: TEXTO (con # títulos, **negrita**, - listas) y TABLA
 * (celdas con fórmulas, ver `lib/cuaderno/formulas.ts`). Se guarda solo (cada ~1 s sin escribir) en
 * `public.cuadernos`, que es PERSONAL (cada uno ve los suyos). Se baja a Excel entero, en orden.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { calcularTabla, letraColumna, mostrarValor } from "@/lib/cuaderno/formulas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ArrowUp, ArrowDown, Download, Type, Table2, Loader2, Check } from "lucide-react"

type Bloque = { id: string; tipo: "texto"; texto: string } | { id: string; tipo: "tabla"; celdas: string[][] }
interface Cuaderno { id: string; titulo: string; bloques: Bloque[]; updated_at: string }

const nuevoId = () => Math.random().toString(36).slice(2, 10)
const tablaVacia = (): string[][] => Array.from({ length: 3 }, () => ["", "", ""])

/** Markdown mínimo y seguro: se escapa todo y después se aplican # / ** / - */
function textoAHtml(t: string): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const negrita = (x: string) => x.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  const lineas = esc(t).split("\n")
  let html = "", enLista = false
  for (const l of lineas) {
    const item = /^\s*[-•]\s+(.*)$/.exec(l)
    if (item) { if (!enLista) { html += "<ul class='list-disc pl-5'>"; enLista = true } html += `<li>${negrita(item[1])}</li>`; continue }
    if (enLista) { html += "</ul>"; enLista = false }
    if (l.startsWith("## ")) html += `<h3 class='font-semibold text-base mt-1'>${negrita(l.slice(3))}</h3>`
    else if (l.startsWith("# ")) html += `<h2 class='font-bold text-lg mt-1'>${negrita(l.slice(2))}</h2>`
    else html += l.trim() ? `<p>${negrita(l)}</p>` : "<div class='h-2'></div>"
  }
  if (enLista) html += "</ul>"
  return html
}

function BloqueTexto({ texto, onCambio }: { texto: string; onCambio: (t: string) => void }) {
  const [editando, setEditando] = useState(!texto)
  if (editando) {
    return (
      <Textarea autoFocus value={texto} rows={Math.max(3, texto.split("\n").length + 1)}
        placeholder={"# Título\nTexto libre. **negrita**\n- un ítem"}
        onChange={e => onCambio(e.target.value)} onBlur={() => setEditando(false)}
        className="font-mono text-sm" />
    )
  }
  return (
    <div className="min-h-[2.5rem] cursor-text rounded px-2 py-1 text-sm hover:bg-muted/40" onClick={() => setEditando(true)}
      title="Tocá para editar" dangerouslySetInnerHTML={{ __html: textoAHtml(texto) || "<span class='text-muted-foreground'>Texto vacío — tocá para escribir</span>" }} />
  )
}

function BloqueTabla({ celdas, onCambio }: { celdas: string[][]; onCambio: (c: string[][]) => void }) {
  const [foco, setFoco] = useState<string | null>(null)
  const valores = calcularTabla(celdas)
  const nCols = Math.max(1, ...celdas.map(f => f.length))
  const set = (f: number, c: number, v: string) => onCambio(celdas.map((fila, i) => i === f ? fila.map((x, j) => (j === c ? v : x)) : fila))
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-8 border bg-muted/50 text-[10px] text-muted-foreground"></th>
              {Array.from({ length: nCols }, (_, c) => <th key={c} className="min-w-[90px] border bg-muted/50 px-1 text-[10px] font-normal text-muted-foreground">{letraColumna(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {celdas.map((fila, f) => (
              <tr key={f}>
                <td className="border bg-muted/50 text-center text-[10px] text-muted-foreground">{f + 1}</td>
                {Array.from({ length: nCols }, (_, c) => {
                  const k = `${f},${c}`
                  const crudo = fila[c] ?? ""
                  const esFormula = crudo.trim().startsWith("=")
                  const v = valores[f]?.[c] ?? ""
                  return (
                    <td key={c} className="border p-0">
                      <input
                        className={`w-full min-w-[90px] bg-transparent px-1 py-1 outline-none focus:bg-blue-50 ${typeof v === "number" ? "text-right tabular-nums" : ""} ${String(v).startsWith("#") ? "text-red-600" : ""} ${esFormula && foco !== k ? "text-blue-800" : ""}`}
                        value={foco === k ? crudo : String(mostrarValor(v))}
                        onFocus={() => setFoco(k)} onBlur={() => setFoco(null)}
                        onChange={e => set(f, c, e.target.value)}
                        title={esFormula ? crudo : undefined}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={() => onCambio([...celdas, Array(nCols).fill("")])}>+ fila</button>
        <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={() => onCambio(celdas.map(f => [...f, ...Array(Math.max(0, nCols - f.length)).fill(""), ""]))}>+ columna</button>
        {celdas.length > 1 && <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={() => onCambio(celdas.slice(0, -1))}>− fila</button>}
        {nCols > 1 && <button type="button" className="rounded border px-2 py-0.5 hover:bg-muted" onClick={() => onCambio(celdas.map(f => f.slice(0, nCols - 1)))}>− columna</button>}
        <span className="text-muted-foreground">Fórmulas: <code>=B2*C2</code> · <code>=SUMA(B2:B5)</code> · PROMEDIO · MIN · MAX</span>
      </div>
    </div>
  )
}

export function PanelCuaderno() {
  const [lista, setLista] = useState<Cuaderno[] | null>(null)
  const [actual, setActual] = useState<Cuaderno | null>(null)
  const [estado, setEstado] = useState<"guardado" | "guardando" | "sin guardar">("guardado")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("cuadernos").select("id, titulo, bloques, updated_at").order("updated_at", { ascending: false })
    if (error) { toast.error("No se pudieron leer los cuadernos: " + error.message); setLista([]); return }
    setLista((data ?? []) as Cuaderno[])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const guardar = useCallback(async (c: Cuaderno) => {
    setEstado("guardando")
    const { error } = await supabase.from("cuadernos").update({ titulo: c.titulo, bloques: c.bloques, updated_at: new Date().toISOString() }).eq("id", c.id)
    if (error) { setEstado("sin guardar"); toast.error("No se pudo guardar: " + error.message); return }
    setEstado("guardado")
    setLista(prev => (prev ?? []).map(x => (x.id === c.id ? { ...c, updated_at: new Date().toISOString() } : x)))
  }, [])

  // se guarda solo, ~1 s después de dejar de escribir
  const cambiar = (c: Cuaderno) => {
    setActual(c)
    setEstado("sin guardar")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => guardar(c), 900)
  }

  const crear = async () => {
    const { data, error } = await supabase.from("cuadernos")
      .insert({ titulo: "Nuevo cuaderno", bloques: [{ id: nuevoId(), tipo: "texto", texto: "" }] })
      .select("id, titulo, bloques, updated_at").single()
    if (error || !data) { toast.error("No se pudo crear: " + (error?.message ?? "")); return }
    setLista(prev => [data as Cuaderno, ...(prev ?? [])])
    setActual(data as Cuaderno)
  }

  const borrar = async (c: Cuaderno) => {
    if (!window.confirm(`¿Borrar el cuaderno «${c.titulo}»? No se puede deshacer.`)) return
    const { error } = await supabase.from("cuadernos").delete().eq("id", c.id)
    if (error) { toast.error("No se pudo borrar: " + error.message); return }
    setLista(prev => (prev ?? []).filter(x => x.id !== c.id))
    if (actual?.id === c.id) setActual(null)
  }

  const bajarExcel = (c: Cuaderno) => {
    const filas: (string | number)[][] = [[c.titulo], []]
    for (const b of c.bloques) {
      if (b.tipo === "texto") { for (const l of b.texto.split("\n")) filas.push([l.replace(/^#+\s*/, "").replace(/\*\*/g, "")]) }
      else { const v = calcularTabla(b.celdas); for (const f of v) filas.push(f.map(x => x)) }
      filas.push([])
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Cuaderno")
    XLSX.writeFile(wb, `${c.titulo.replace(/[\\/:*?"<>|]/g, "-") || "cuaderno"}.xlsx`)
  }

  const setBloques = (bloques: Bloque[]) => actual && cambiar({ ...actual, bloques })
  const mover = (i: number, d: -1 | 1) => {
    if (!actual) return
    const b = [...actual.bloques]; const j = i + d
    if (j < 0 || j >= b.length) return
    ;[b[i], b[j]] = [b[j], b[i]]
    setBloques(b)
  }
  const agregar = (tipo: "texto" | "tabla", despuesDe?: number) => {
    if (!actual) return
    const nuevo: Bloque = tipo === "texto" ? { id: nuevoId(), tipo, texto: "" } : { id: nuevoId(), tipo, celdas: tablaVacia() }
    const b = [...actual.bloques]
    b.splice(despuesDe === undefined ? b.length : despuesDe + 1, 0, nuevo)
    setBloques(b)
  }

  if (lista === null) return <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>

  if (!actual) {
    return (
      <div className="space-y-3">
        <Button onClick={crear}><Plus className="mr-1 h-4 w-4" /> Nuevo cuaderno</Button>
        {lista.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no tenés cuadernos.</p> : (
          <ul className="divide-y rounded border bg-white">
            {lista.map(c => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActual(c)}>
                  <span className="block truncate font-medium">{c.titulo}</span>
                  <span className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {c.bloques.length} bloque(s)</span>
                </button>
                <Button variant="ghost" size="sm" onClick={() => bajarExcel(c)} title="Bajar a Excel"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => borrar(c)} title="Borrar"><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => { if (timer.current) { clearTimeout(timer.current); guardar(actual) } setActual(null) }}>← Mis cuadernos</Button>
        <Input className="h-9 max-w-md flex-1 text-base font-semibold" value={actual.titulo} onChange={e => cambiar({ ...actual, titulo: e.target.value })} />
        <span className="text-xs text-muted-foreground">
          {estado === "guardando" ? <><Loader2 className="inline h-3 w-3 animate-spin" /> guardando…</> : estado === "guardado" ? <><Check className="inline h-3 w-3" /> guardado</> : "sin guardar"}
        </span>
        <Button variant="outline" size="sm" onClick={() => bajarExcel(actual)}><Download className="mr-1 h-4 w-4" /> Excel</Button>
      </div>

      {actual.bloques.map((b, i) => (
        <div key={b.id} className="group rounded-md border bg-white p-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            {b.tipo === "texto" ? <Type className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            <span>{b.tipo === "texto" ? "Texto" : "Tabla"}</span>
            <span className="ml-auto flex gap-1">
              <button type="button" title="Subir" onClick={() => mover(i, -1)} className="rounded p-0.5 hover:bg-muted"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" title="Bajar" onClick={() => mover(i, 1)} className="rounded p-0.5 hover:bg-muted"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" title="+ texto debajo" onClick={() => agregar("texto", i)} className="rounded px-1 hover:bg-muted">+ texto</button>
              <button type="button" title="+ tabla debajo" onClick={() => agregar("tabla", i)} className="rounded px-1 hover:bg-muted">+ tabla</button>
              <button type="button" title="Borrar bloque" onClick={() => { if (window.confirm("¿Borrar este bloque?")) setBloques(actual.bloques.filter(x => x.id !== b.id)) }} className="rounded p-0.5 hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
            </span>
          </div>
          {b.tipo === "texto"
            ? <BloqueTexto texto={b.texto} onCambio={t => setBloques(actual.bloques.map(x => (x.id === b.id ? { ...x, texto: t } as Bloque : x)))} />
            : <BloqueTabla celdas={b.celdas} onCambio={cs => setBloques(actual.bloques.map(x => (x.id === b.id ? { ...x, celdas: cs } as Bloque : x)))} />}
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => agregar("texto")}><Type className="mr-1 h-4 w-4" /> + Texto</Button>
        <Button variant="outline" size="sm" onClick={() => agregar("tabla")}><Table2 className="mr-1 h-4 w-4" /> + Tabla</Button>
      </div>
    </div>
  )
}
