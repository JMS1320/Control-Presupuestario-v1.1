/**
 * Corre un archivo .sql contra la base del proyecto.
 *
 *     npx tsx scripts/correr-sql.mts scripts/60-roles-permisos.sql
 *
 * Existe porque la API que ya usamos (`service_role` sobre PostgREST) **no ejecuta DDL**: sirve
 * para filas, no para crear tablas, triggers ni políticas. Verificado además que la Management
 * API rechaza la `service_role` key con 401 — pide un token de cuenta, que es otra cosa.
 *
 * Necesita UNA de estas dos en `.env.local` (la pone el usuario; acá sólo se lee):
 *
 *   DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
 *       ↳ Supabase → Project Settings → Database → Connection string (URI).
 *         Es la más acotada: da acceso a ESTA base y nada más. Recomendada.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *       ↳ https://supabase.com/dashboard/account/tokens
 *         Ojo: un token de cuenta alcanza TODOS tus proyectos, no sólo éste.
 *
 * Cuando termine, se pueden borrar del `.env.local`: no hacen falta para que la app funcione.
 */
import { readFileSync } from "node:fs"

const archivo = process.argv[2]
if (!archivo) {
  console.error("Uso: npx tsx scripts/correr-sql.mts <archivo.sql>")
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    })
)

const sql = readFileSync(archivo, "utf8")
console.log(`▸ ${archivo} (${sql.split("\n").length} líneas)\n`)

if (env.DATABASE_URL) {
  const { default: pg } = await import("pg")
  const cliente = new pg.Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await cliente.connect()
  try {
    // Todo en una transacción: si algo falla, no queda la tabla a medias.
    const res = await cliente.query(sql)
    const ultimo = Array.isArray(res) ? res[res.length - 1] : res
    console.log("✅ Ejecutado.\n")
    if (ultimo?.rows?.length) console.table(ultimo.rows)
  } finally {
    await cliente.end()
  }
} else if (env.SUPABASE_ACCESS_TOKEN) {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) {
    console.error(`❌ HTTP ${r.status}:`, j?.message ?? j)
    process.exit(1)
  }
  console.log("✅ Ejecutado.\n")
  if (Array.isArray(j) && j.length) console.table(j)
} else {
  console.error(
    "❌ Falta DATABASE_URL o SUPABASE_ACCESS_TOKEN en .env.local.\n" +
    "   Ver el comentario de arriba de este archivo: dice de dónde sacar cada una."
  )
  process.exit(1)
}
