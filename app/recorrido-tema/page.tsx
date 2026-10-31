import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { TemaAparte } from "@/components/recorrido-tema-aparte"

export const metadata = { title: "Tema del balance — Control Presupuestario" }

/**
 * ↗ Un tema del recorrido del balance, solo, en su pestaña (JMS 31/10: «abrir pestaña nueva sólo con el mensaje en sí,
 * su contenido»). Es una foto que deja el recorrido en este navegador al apretar «↗ Abrir en otra pestaña»: no vuelve a
 * calcular nada y no escribe; para responder se vuelve al recorrido.
 */
export default async function RecorridoTemaPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!getRole(user)) redirect("/no-access")
  return <TemaAparte />
}
