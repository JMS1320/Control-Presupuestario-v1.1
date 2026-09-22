import { redirect } from "next/navigation"

/**
 * `/usuarios` se mudó adentro de Configuración (2026-09-05).
 *
 * La ruta se mantiene y redirige en vez de borrarse: estaba linkeada desde el menú del avatar y
 * puede estar guardada en algún favorito. Una ruta que desaparece devuelve un 404 sin explicar
 * a dónde se fue.
 */
export default function UsuariosPage() {
  redirect("/configuracion?panel=usuarios")
}
