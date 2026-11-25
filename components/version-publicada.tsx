"use client"

/**
 * 🏷️ **A-FEAT-1656 — qué versión de la app se está viendo**, arriba a la derecha y discreto.
 *
 * Pedido de JMS 25/11: *«¿hay manera de yo ver en la app (versión desarrollo) algo de la versión que se
 * está probando? así no tengo que entrar en Vercel… algo discreto arriba de todo a la derecha que a vos
 * te dé referencia si ya cargó»*.
 *
 * Muestra el **commit corto** (el mismo que Claude informa al subir) y la **hora del build**. Si coincide
 * con el que Claude dijo, la versión nueva ya está publicada. Pasando el mouse: rama y título del commit.
 *
 * 🔒 **No aparece en producción** (`main`, lo que usan los demás): ahí no le sirve a nadie.
 * Los datos los fija `next.config.mjs` al buildear.
 */
export function VersionPublicada() {
  const entorno = process.env.NEXT_PUBLIC_VERSION_ENTORNO || "local"
  if (entorno === "production") return null
  const commit = process.env.NEXT_PUBLIC_VERSION_COMMIT || ""
  const rama = process.env.NEXT_PUBLIC_VERSION_RAMA || ""
  const hora = process.env.NEXT_PUBLIC_VERSION_HORA || ""
  const mensaje = process.env.NEXT_PUBLIC_VERSION_MENSAJE || ""
  const texto = commit ? `${commit} · ${hora}` : `local · ${hora}`
  const detalle = [
    rama ? `Rama: ${rama}` : "App local (npm run dev)",
    commit ? `Commit: ${commit}` : "",
    hora ? `Publicada: ${hora}` : "",
    mensaje ? `\n${mensaje}` : "",
  ].filter(Boolean).join("\n")
  return (
    <div
      title={detalle}
      className="fixed top-0 right-1 z-[60] select-all font-mono text-[10px] leading-4 text-gray-400 opacity-60 hover:opacity-100 hover:text-gray-600 print:hidden"
    >
      {texto}
    </div>
  )
}
