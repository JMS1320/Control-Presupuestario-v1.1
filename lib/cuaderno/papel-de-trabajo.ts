/**
 * 📓 **EL PAPEL DE TRABAJO — un cuaderno que arma el sistema para explicar un tema** (A-FEAT-1430 paso 3, JMS 30/10).
 *
 * *«Notas en Excel o Word guardadas linkeadas con algo… si un control no cierra, usar esos borradores para darme
 * propuestas: diferencia de tanto, tanto por ciento, propuesta conciliar esto contra esto, daría así… no impacta la
 * base, son notas aisladas pero vinculadas como papel de trabajo.»*
 *
 * Es un documento del **Cuaderno** (A-FEAT-1410) con la forma de siempre —bloques de texto y de tabla—, atado al tema
 * por `public.cuadernos.vinculo` (script 141). La tabla de comparación usa las **fórmulas del cuaderno**, así la
 * diferencia y el «daría así» se recalculan si se toca un número: es un borrador para pensar, no un dato.
 */
import type { Tema } from "@/lib/balance/recorrido"

/** Una tabla A contra B, con la diferencia como fórmula. Las celdas son texto del cuaderno («=B2-B3», «12456000,14»). */
export interface Comparacion {
  titulo: string
  celdas: string[][]
}

export type BloquePapel = { id: string; tipo: "texto"; texto: string } | { id: string; tipo: "tabla"; celdas: string[][] }

/** El vínculo con que se guarda: por empresa, ejercicio y tema. */
export const vinculoDe = (empresa: string, anioCierre: number, claveTema: string) => `balance:${empresa}:${anioCierre}:${claveTema}`

/** Un número en el formato del cuaderno (es-AR, sin separador de miles para que la fórmula lo lea siempre igual). */
export const celdaNumero = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ",")

const id = (i: number) => `pt${i}`

/** Arma el cuaderno de un tema: título, qué pasa, la propuesta, dónde verlo y la comparación (si hay). */
export function armarPapelDeTrabajo(t: Tema, empresa: string, etiqueta: string, comparacion?: Comparacion | null): { titulo: string; bloques: BloquePapel[] } {
  const lineas = [
    `# ${t.titulo}`,
    `**Balance ${empresa} ${etiqueta}** · ${t.papel}${t.solapa ? ` · solapa ${t.solapa}` : ""}`,
    "",
    t.valor2425 ? `**El año pasado:** ${t.valor2425}` : "",
    `**Qué pasa:** ${t.que}`,
    t.propuesta ? `**Propuesta:** ${t.propuesta}` : "",
  ].filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== ""))
  const bloques: BloquePapel[] = [{ id: id(1), tipo: "texto", texto: lineas.join("\n") }]
  if (comparacion && comparacion.celdas.length) {
    bloques.push({ id: id(2), tipo: "texto", texto: `## ${comparacion.titulo}` })
    bloques.push({ id: id(3), tipo: "tabla", celdas: comparacion.celdas })
  }
  if (t.links.length) bloques.push({ id: id(4), tipo: "texto", texto: ["## Dónde verlo", ...t.links.map(l => `- ${l.texto}: ${l.href}`)].join("\n") })
  bloques.push({ id: id(5), tipo: "texto", texto: "## Notas\n" })
  return { titulo: `📎 ${t.titulo} — balance ${empresa} ${etiqueta}`.slice(0, 200), bloques }
}
