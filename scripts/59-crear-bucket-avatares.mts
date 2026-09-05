/**
 * Crea el bucket `avatares` — el equivalente de `59-storage-avatares.sql`, para correr desde acá.
 *
 *     npx tsx scripts/59-crear-bucket-avatares.mts
 *
 * Existe porque un bucket de Storage se puede crear por la API de administración, sin abrir el
 * editor SQL. Hace exactamente lo mismo que el .sql y **es idempotente**: si el bucket ya existe,
 * actualiza sus límites y **no toca ni un archivo**. No borra nada, nunca.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

// Se leen del .env.local sin dependencias extra.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const OPCIONES = {
  public: true,
  fileSizeLimit: 2 * 1024 * 1024, // 2 MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
}

const { data: existentes } = await supabase.storage.listBuckets()
const yaEsta = existentes?.some((b) => b.id === "avatares")

if (yaEsta) {
  console.log("• El bucket «avatares» ya existía — se actualizan sus límites, sin tocar archivos.")
  const { error } = await supabase.storage.updateBucket("avatares", OPCIONES)
  if (error) { console.error("❌", error.message); process.exit(1) }
} else {
  const { error } = await supabase.storage.createBucket("avatares", OPCIONES)
  if (error) { console.error("❌", error.message); process.exit(1) }
  console.log("• Bucket «avatares» creado.")
}

// Control: se relee de la base, no se confía en que el comando anterior haya dicho que sí.
const { data: final } = await supabase.storage.listBuckets()
const b = final?.find((x) => x.id === "avatares")
if (!b) { console.error("❌ El bucket no aparece al releer."); process.exit(1) }

console.log("\n✅ Control OK — leído de la base:")
console.log(`   público: ${b.public}  ·  límite: ${b.file_size_limit} bytes  ·  tipos: ${(b.allowed_mime_types ?? []).join(", ")}`)
