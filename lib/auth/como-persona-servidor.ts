import { supabaseAdmin } from "@/lib/supabase-admin"
import type { User } from "@supabase/supabase-js"

/** 👁️ A-BUG-1544 — la cuenta de ese mail (para su nombre y su etiqueta), o null. Sólo servidor. */
export async function usuarioPorMail(mail: string): Promise<User | null> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
  const m = mail.trim().toLowerCase()
  return data?.users.find((u) => (u.email ?? "").toLowerCase() === m) ?? null
}
