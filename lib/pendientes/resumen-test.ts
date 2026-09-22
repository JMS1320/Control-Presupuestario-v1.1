// El cartel de tests del proceso habla en el idioma del usuario (A-FEAT-163).
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// La primera prueba real desde el cartel (A-TEST-133, 2026-09-21) mostraba el dossier crudo: IDs,
// casos de `npm run probar`, adversarios. El usuario: *«menciona muchas cosas que tal vez no
// entiendo»*. Esas líneas son para Claude; lo que él necesita es **qué hacer y qué tiene que ver**.
//
// ── La convención ────────────────────────────────────────────────────────────
// Un `A-TEST` escribe la parte para el usuario después de **«Qué probar vos»** (§ 🧪 CLAUDE.md).
// El cartel muestra eso primero y deja el resto plegado como «detalle técnico». Si un test viejo no
// tiene la marca, no se inventa nada: se muestra el título, como antes.
//
// ⚠️ Sin imports: `npm run probar` no resuelve el alias `@/` dentro de las librerías.

/** Lo que el usuario tiene que hacer, o `null` si el test no lo escribió aparte. */
export function queProbarVos(texto: string | null | undefined): string | null {
  const t = String(texto ?? "")
  const m = t.match(/Qu[ée] probar vos[^:]*:\s*/i)
  if (!m || m.index == null) return null
  const resto = t.slice(m.index + m[0].length).trim()
  return resto || null
}

/** El título corto: hasta el primer « — » o el primer paréntesis, y como mucho 90 caracteres. */
export function tituloCorto(titulo: string): string {
  const t = titulo.replace(/\s+/g, " ").trim()
  const corte = [t.indexOf(" — "), t.indexOf(" (")].filter(i => i > 0)
  const hasta = corte.length ? Math.min(...corte) : t.length
  const corto = t.slice(0, hasta).trim()
  return corto.length > 90 ? corto.slice(0, 89).trimEnd() + "…" : corto
}

/** Las tres respuestas. «En parte» y «Falló» van al mismo estado — `revisar` —, con la nota. */
export const RESPUESTAS_TEST = [
  { clave: "anduvo", estado: "chequeado", etiqueta: "✅ Anduvo" },
  { clave: "parcial", estado: "revisar", etiqueta: "🟡 Anduvo en parte" },
  { clave: "fallo", estado: "revisar", etiqueta: "🔴 Falló" },
] as const

/** El texto que queda en el comentario: la respuesta, la nota del usuario y dónde se probó. */
export function textoRespuesta(etiqueta: string, nota: string, proceso: string): string {
  const n = nota.trim()
  return `${etiqueta}${n ? `: ${n}` : ""} — probado al correr el proceso (${proceso}).`
}
