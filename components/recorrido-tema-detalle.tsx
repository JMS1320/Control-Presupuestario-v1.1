"use client"

/**
 * 🧭 **Un tema del recorrido, solo** (A-FEAT-1439): qué pasa · 📄 Fuente · 🗂️ En la app · la cuenta · 💡 Propuesta · la
 * respuesta. Lo usan el recorrido (con los botones de responder) y la pestaña aparte «↗ Abrir en otra pestaña» (sólo
 * lectura), para que las dos muestren lo mismo.
 */
import type { ReactNode } from "react"
import { GRUPOS, fuenteDe, linksDeLaApp, type GrupoTema, type Tema } from "@/lib/balance/recorrido"
import { calcularTabla, mostrarValor } from "@/lib/cuaderno/formulas"

export const ICONO = Object.fromEntries(GRUPOS.map(g => [g.id, g.icono])) as Record<GrupoTema, string>
export const TITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo])) as Record<GrupoTema, string>
export const COLOR: Record<GrupoTema, string> = {
  "error": "border-red-300 bg-red-50 text-red-900",
  "decision": "border-amber-300 bg-amber-50 text-amber-900",
  "pregunta": "border-sky-300 bg-sky-50 text-sky-900",
  "arca": "border-rose-300 bg-rose-50 text-rose-900",
  "documento": "border-amber-300 bg-amber-50 text-amber-900",
  "falta inicio": "border-violet-300 bg-violet-50 text-violet-900",
  "sin informacion": "border-slate-300 bg-slate-50 text-slate-800",
  "pendiente desarrollo": "border-teal-300 bg-teal-50 text-teal-900",
  "conciliacion": "border-blue-300 bg-blue-50 text-blue-900",
  "deuda": "border-orange-300 bg-orange-50 text-orange-900",
  "cheque": "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900",
}

export function DetalleTema({ tema, arriba, enAppExtra, propuestaExtra, resolucionExtra }: {
  tema: Tema
  /** A la derecha del encabezado (p. ej. «3 de 419» y el botón de abrir aparte). */
  arriba?: ReactNode
  /** Al lado de los links «En la app» (el papel de trabajo). */
  enAppExtra?: ReactNode
  /** Debajo de la propuesta (⚡ Aplicar). */
  propuestaExtra?: ReactNode
  /** Al lado de la respuesta guardada (reabrir). */
  resolucionExtra?: ReactNode
}) {
  const fuente = fuenteDe(tema)
  const enApp = linksDeLaApp(tema)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded border px-2 py-0.5 ${COLOR[tema.grupo]}`}>{ICONO[tema.grupo]} {TITULO[tema.grupo]}</span>
        <span className="text-muted-foreground">{tema.papel}{tema.solapa ? ` · solapa ${tema.solapa}` : ""}{tema.idPendiente ? ` · ${tema.idPendiente}` : ""}</span>
        {arriba}
      </div>
      <h3 className="text-xl font-semibold leading-snug">{tema.titulo}</h3>
      {tema.valor2425 && <p className="text-sm"><span className="text-muted-foreground">El año pasado:</span> <span className="tabular-nums">{tema.valor2425}</span></p>}

      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qué pasa</div>
        <p className="text-sm">{tema.que}</p>
      </div>

      {/* 📄 A-FEAT-1439 — las TRES vistas: lo objetivo, lo que dice la app, y la propuesta. */}
      <div className={`rounded border p-3 space-y-1 ${fuente ? "border-slate-300 bg-slate-50" : "border-amber-300 bg-amber-50"}`} data-test="recorrido-fuente">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-700">📄 Fuente — lo objetivo{fuente ? `: ${fuente.origen}` : ""}</div>
        {fuente
          ? <p className="text-sm">{fuente.detalle}</p>
          : <p className="text-sm text-amber-900">⚠️ {tema.fuenteEsperada
            ? <><strong>📥 Hace falta: {tema.fuenteEsperada}.</strong> Dejalo en la carpeta de comunicación (o cargalo en la app) y pasa a ser la fuente. Hasta tenerlo, lo que ves es sólo lo que dice la app (y mi propuesta).</>
            : "Este tema no tiene fuente externa todavía: lo que ves es sólo lo que dice la app (y mi propuesta)."}</p>}
        {!!fuente?.links?.length && (
          <div className="flex flex-wrap gap-2 pt-1">
            {fuente.links.map(l => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded border bg-background px-3 py-1.5 text-sm hover:bg-muted">↗ {l.texto}</a>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1" data-test="recorrido-en-la-app">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">🗂️ En la app</div>
        <div className="flex flex-wrap gap-2">
          {enApp.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted">↗ {l.texto}</a>
          ))}
          {!enApp.length && <span className="text-sm text-amber-900">⚠️ Sin link a la pantalla donde vive el dato.</span>}
          {enAppExtra}
        </div>
      </div>

      {tema.comparacion && (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tema.comparacion.titulo}</div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <tbody>
                {calcularTabla(tema.comparacion.celdas).map((fila, f) => (
                  <tr key={f} className={f === 0 ? "bg-muted/50 font-medium" : ""}>
                    {fila.map((v, c) => (
                      <td key={c} className={`border px-2 py-1 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}>{mostrarValor(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tema.propuesta && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-800">💡 Propuesta</div>
          <p className="text-sm text-emerald-950">{tema.propuesta}</p>
          {propuestaExtra}
        </div>
      )}

      {tema.pendiente?.resolucion && (
        <div className="rounded border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">{tema.respondido ? "Respondido" : "Nota"}: </span>{tema.pendiente.resolucion}
          {resolucionExtra}
        </div>
      )}

    </>
  )
}
