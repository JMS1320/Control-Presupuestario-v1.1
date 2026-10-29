"use client"

/**
 * 🤖 La marca de un dato que puso Claude y espera el OK de JMS (A-FEAT-1386). Muestra de dónde salió y un ✓ OK.
 * Si JMS escribe otro valor, también deja de ser tentativo (el historial guarda lo de Claude).
 */
export function MarcaTentativo({ fuente, onOk }: { fuente: string | null | undefined; onOk: () => void }) {
  if (!fuente) return null
  return (
    <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">
      <b>TENTATIVO</b> · lo puso Claude · <span className="italic">{fuente}</span>
      <button type="button" onClick={onOk} className="ml-1 rounded border border-amber-400 bg-white px-1 font-medium hover:bg-amber-50"
        title="Lo revisé: queda a mi nombre">✓ OK</button>
    </span>
  )
}
