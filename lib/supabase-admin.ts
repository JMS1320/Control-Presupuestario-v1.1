import { createClient } from "@supabase/supabase-js"

/**
 *  Cliente “admin” (solo servidor).
 *  – Usa SERVICE_ROLE_KEY  ➜  omite la RLS
 *  – No persiste sesión en cookies
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
