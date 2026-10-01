/**
 * 🖱️ **El gesto de los chips de filtro: click suma o resta, CTRL+click deja sólo ése.**
 *
 * Pedido del usuario 2026-10-01, señalando el Cash Flow: *«replicar el buen funcionamiento de Cash
 * Flow donde yo doy ctrl+click en un chip y se selecciona solo ese. Esto hay que llevarlo a todos
 * los chips en general **porque funciona muy bien**»*.
 *
 * ## Por qué vive acá y no adentro de una pantalla
 * Nació dentro de `vista-cash-flow.tsx`, que tiene 5.000 líneas. Cualquier otra pantalla que
 * quisiera el gesto lo iba a reescribir, y el día que el gesto se mejore —por ejemplo, que
 * ctrl+click sobre el único chip encendido vuelva a prender todos— habría que mejorarlo N veces.
 * Es la § ♻️ *Centralizar, no duplicar* de `CLAUDE.md`.
 *
 * ## ⚠️ Las dos semánticas opuestas que conviven, y por qué el gesto sirve igual
 * No todas las pantallas usan el conjunto para lo mismo, y conviene saberlo antes de tocar:
 *
 * | Pantalla | Qué significa el conjunto | Vacío significa |
 * |---|---|---|
 * | Cash Flow (Estado, Origen) | **lo que se muestra** | no se muestra **nada** |
 * | Facturas ARCA (Archivo digital, Tipos) | **el filtro**; si está vacío no filtra | se muestra **todo** |
 *
 * 🔑 **Ctrl+click funciona en las dos sin adaptarse**, porque `new Set([valor])` quiere decir
 * *«sólo éste»* en cualquiera de las dos lecturas. Lo que **no** es portable es el vacío: por eso
 * cada pantalla conserva su propio botón de volver atrás (*todos* / *ninguno* / *limpiar*).
 */

/**
 * Prende o apaga un chip. Con `soloEste` (ctrl+click, o ⌘+click en Mac) reemplaza la selección
 * entera por ese valor.
 */
export function toggleChip<T extends string>(
  setter: (actualizar: (prev: Set<T>) => Set<T>) => void,
  valor: T,
  soloEste = false,
): void {
  if (soloEste) { setter(() => new Set<T>([valor])); return }
  setter(prev => {
    const n = new Set(prev)
    n.has(valor) ? n.delete(valor) : n.add(valor)
    return n
  })
}

/** ¿El click pidió «sólo éste»? Ctrl en Windows/Linux, ⌘ en Mac. */
export const esSoloEste = (e: { ctrlKey?: boolean; metaKey?: boolean }) => !!(e.ctrlKey || e.metaKey)

/**
 * El `title` del chip. Que el gesto exista y no se vea es lo mismo que no tenerlo: el usuario lo
 * descubrió en el Cash Flow porque se lo contamos, no porque estuviera a la vista.
 */
export const tituloChip = (etiqueta: string) =>
  `Click: prender/apagar «${etiqueta}» · Ctrl+click: ver SÓLO «${etiqueta}»`

/** El cartelito que se pone una vez por barra de chips, al lado de los botones de volver atrás. */
export const PISTA_CTRL_CLICK = "ctrl+click = sólo ése"
