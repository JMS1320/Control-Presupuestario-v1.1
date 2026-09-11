"use client"

/**
 * 🧪 LO QUE HAY QUE MIRAR EN ESTA CORRIDA — el test viaja con el proceso (A-FEAT-129).
 *
 * ## Qué es
 * Un renglón dentro del modal donde el usuario **corre el proceso de verdad**, con los `A-TEST`
 * abiertos de ese proceso. La idea es suya: *«dejamos el test en el modal de SICORE, cuando corro
 * la próxima vez el mismo proceso me lo muestra, y yo puedo dejar notas para verlo con vos»*.
 *
 * ## Por qué acá y no en un documento
 * Porque es **el único momento en que el test se puede ejecutar**. Un `A-TEST` que dice *«pagar en
 * lote y verificar que la estimada se mueva»* no se prueba abriendo un `.md`: se prueba pagando.
 * Y resuelve el agujero de escritura de `A-DEC-18`/`A-DEC-22` sin que ningún test escriba en la
 * base — **el que escribe es el trabajo real**, que es el único con derecho.
 *
 * ## 🚨 Los tres modos de falla que tiene que evitar, y cómo
 *
 * **1 · Un aviso que no se puede cerrar se vuelve invisible.** Por eso cada ítem tiene
 * **✅ anduvo / 🔴 falló**, y al responderlo **desaparece de la lista en el acto**. Es el final que
 * tuvieron los 🟡 desparramados por el manual: nadie los sacaba y dejaron de leerse.
 *
 * **2 · No puede interrumpir el trabajo.** El usuario abre este modal para pagar. Arranca
 * **colapsado**, no tapa ningún botón, y **si lo ignora el proceso sigue igual**. Nada de esto
 * bloquea nada.
 *
 * **3 · No puede volverse la fuente de verdad.** `PENDIENTES.md` manda (§ dimensión 1). Esto es una
 * **vista**: lee de `/api/pendientes`, que parsea el archivo, y la respuesta vuelve por
 * `pendientes_comentarios` —el canal 2 de los tres del usuario, que Claude ya mira al abrir
 * sesión—. **Cero tablas nuevas, cero listas paralelas.**
 *
 * ## El círculo, sin inventar nada
 * ```
 * A-TEST en PENDIENTES.md → este renglón al correr el proceso
 *         ↑                                ↓
 *   Claude lo cierra ← pendientes_comentarios ← ✅ anduvo / 🔴 falló
 * ```
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { esDelProceso, type Pendiente } from "@/lib/pendientes/parse"

interface Props {
  /** El proceso, como se marca en `PENDIENTES.md`: `@cashflow/sicore` → `"cashflow/sicore"`. */
  proceso: string
  /** Para el comentario, así Claude sabe desde dónde se respondió. */
  pantalla?: string
}

/**
 * Los estados que ya acepta `/api/pendientes/comentarios`. **No se agregó ninguno**: `chequeado` y
 * `revisar` decían exactamente esto desde antes.
 */
const RESPUESTAS = [
  { estado: "chequeado", etiqueta: "✅ Anduvo", clase: "border-green-600 text-green-700 hover:bg-green-50" },
  { estado: "revisar", etiqueta: "🔴 Falló", clase: "border-red-600 text-red-700 hover:bg-red-50" },
] as const

/**
 * ¿Es un test? **Por el ID, no por la columna `tipo`.**
 *
 * 🐞 La primera versión filtraba `p.tipo === 'Test'` y traía **cero ítems** con los cinco bien
 * marcados: el índice tiene 16 tablas con encabezados distintos, y en varias la celda que dice
 * «Test» **no está mapeada a la columna `tipo`** — llega `null`. El prefijo del ID es la única
 * señal que no depende de cómo esté armada la tabla.
 *
 * 📌 Lo agarró probarlo contra el archivo real antes de mirar la pantalla. Con fixtures habría
 * pasado: es exactamente A-BUG-134 otra vez —*la señal cocinada no prueba quién la cocina*—.
 */
const esTest = (p: Pendiente) => /^A-TEST-/i.test(p.id)

/**
 * Un `A-TEST` cuenta como abierto salvo que ya esté cerrado. El crudo del `.md` es el estado.
 * ⚠️ **🟢 SÍ está abierto**: en este proyecto significa *«Claude terminó sus pruebas, aguarda test
 * manual»* (§ 🚦 Los cuatro estados) — que es justo lo que este cartel viene a pedir.
 */
const estaAbierto = (p: Pendiente) => !["✅", "⚰️", "⏸️"].some(e => (p.estado || "").includes(e))

export function TestsDelProceso({ proceso, pantalla }: Props) {
  const [items, setItems] = useState<Pendiente[]>([])
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  /** Respondidos en esta corrida: salen de la lista sin esperar a que Claude toque el `.md`. */
  const [respondidos, setRespondidos] = useState<Set<string>>(new Set())
  /** Cuál tiene el detalle desplegado. Uno por vez: el cartel se tiene que poder barrer. */
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch("/api/pendientes?rol=admin")
        if (!r.ok) return
        const d = await r.json()
        const todos: Pendiente[] = d.pendientes ?? []
        if (!vivo) return
        setItems(todos.filter(p => esDelProceso(p, proceso) && esTest(p) && estaAbierto(p)))
      } catch {
        // 🔑 Silencio a propósito, y es la decisión más importante del componente: esto es un
        // ACOMPAÑANTE del proceso. Si el endpoint falla, el usuario tiene que poder pagar igual.
        // Un cartel de error acá convertiría un problema del panel en un problema del pago.
      }
    })()
    return () => { vivo = false }
  }, [proceso])

  const responder = async (p: Pendiente, estado: string, etiqueta: string) => {
    setEnviando(p.id)
    try {
      const r = await fetch("/api/pendientes/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendiente_id: p.id,
          texto: `${etiqueta} — probado al correr el proceso (${proceso}).`,
          estado_usuario: estado,
          pantalla: pantalla ?? proceso.split("/")[0],
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      setRespondidos(prev => new Set(prev).add(p.id))
      toast.success(`${p.id}: anotado`, {
        description: estado === "revisar"
          ? "Queda marcado para revisar con Claude. Si podés, dejá una nota con lo que viste."
          : "Claude lo cierra en PENDIENTES la próxima sesión.",
      })
    } catch (e) {
      toast.error(`No se pudo anotar ${p.id}`, { description: (e as Error).message.slice(0, 120) })
    } finally {
      setEnviando(null)
    }
  }

  const visibles = items.filter(p => !respondidos.has(p.id))
  // Sin nada que probar, el componente no ocupa lugar. Un cartel "no hay tests" es ruido.
  if (visibles.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-medium text-amber-900">
          🧪 {visibles.length} {visibles.length === 1 ? "cosa" : "cosas"} para mirar en esta corrida
        </span>
        <span className="text-[11px] text-amber-700">{abierto ? "ocultar ▲" : "ver ▼"}</span>
      </button>

      {!abierto && (
        // Arranca colapsado (modo de falla 2): se ve que hay algo, no tapa el trabajo.
        <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
          Son pruebas pendientes de este mismo proceso. Podés ignorarlas: el pago sigue igual.
        </p>
      )}

      {abierto && (
        <div className="mt-2 space-y-2">
          {visibles.map(p => (
            <div key={p.id} className="rounded border border-amber-200 bg-white px-2.5 py-2">
              <div className="text-[11px] font-medium text-gray-800">
                <span className="font-mono text-amber-700">{p.id}</span> · {p.titulo}
              </div>
              {/* 🔴 El detalle va RECORTADO a dos líneas, y se abre el que interese.
                  Mirando la primera versión renderizada: los detalles de `PENDIENTES.md` son
                  párrafos enteros, y cinco juntos tapaban el modal. Cumplía la letra del modo de
                  falla 2 —arranca colapsado, no bloquea— pero no el espíritu: **un cartel que no
                  se puede barrer con la vista se cierra sin leer**, que es el modo de falla 1 por
                  la puerta de al lado. Lo encontró verlo, no un caso. */}
              {p.detalle && (
                <p
                  onClick={() => setExpandido(e => (e === p.id ? null : p.id))}
                  title={expandido === p.id ? 'Contraer' : 'Ver el detalle completo'}
                  className={`mt-1 cursor-pointer text-[11px] leading-4 text-gray-600 ${
                    expandido === p.id ? '' : 'line-clamp-2'
                  }`}
                >
                  {p.detalle}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {RESPUESTAS.map(r => (
                  <Button
                    key={r.estado}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={enviando === p.id}
                    className={`h-6 px-2 text-[11px] ${r.clase}`}
                    onClick={() => responder(p, r.estado, r.etiqueta)}
                  >
                    {r.etiqueta}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] leading-4 text-amber-800">
            Lo que respondas va a <strong>comentarios del pendiente</strong>, que Claude lee al abrir
            sesión. Para contar algo más largo o con captura, usá 📝 <strong>Notas</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
