/**
 * 🧪 Crea el rol **Pruebas** — el banco de ensayo de permisos del usuario.
 *
 *     npx tsx scripts/crear-rol-pruebas.mts            # informe: no toca nada
 *     npx tsx scripts/crear-rol-pruebas.mts --aplicar  # escribe
 *
 * ## Para qué es (pedido del usuario 2026-09-24)
 * *«Le iré dando distintas vistas. Lo usaré yo para probar antes de darle a un usuario algo: hago
 * un usuario con otro mail mío, le voy dando distintos roles para probarlos antes de dárselo al
 * usuario real.»*
 *
 * 🔑 **Arranca SIN secciones, a propósito.** Un rol de ensayo que nace con permisos es peligroso:
 * si algún día se asigna sin ajustar, el error es *«ve de más»*. Naciendo vacío, el peor caso es
 * *«no ve nada»* — que se nota al instante y no expone nada.
 *
 * 📌 **`exige_2fa: false`**: es para entrar y salir probando; pedir el segundo factor cada vez lo
 * haría inusable. **Por eso mismo no sirve para probar el camino del 2FA** — para eso está `admin`.
 *
 * ⚠️ **`es_sistema: false`**: así se puede editar desde Configuración → Roles, que es todo el punto.
 *
 * 🛑 **Idempotente y no destructivo**: si el rol ya existe **no lo pisa** — avisa y sale. Cambiarle
 * las secciones es trabajo de la pantalla, no de este script.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error("❌ Faltan las variables en .env.local"); process.exit(1) }

const db = createClient(url, key, { auth: { persistSession: false } })
const APLICAR = process.argv.includes("--aplicar")

const NUEVO = {
  id: "pruebas",
  descripcion: "Banco de ensayo de permisos. Se le cambian las secciones desde Configuración → Roles para probar una configuración antes de dársela a alguien. Arranca sin ninguna.",
  secciones: [] as string[],
  exige_2fa: false,
  es_sistema: false,
}

const { data: antes, error: eLeer } = await db.from("roles").select("id, descripcion, secciones, exige_2fa, es_sistema").order("id")
if (eLeer) { console.error("❌ No se pudo leer la tabla:", eLeer.message); process.exit(1) }

console.log("📋 ROLES QUE HAY HOY\n")
for (const r of antes ?? []) {
  console.log(`   ${r.id.padEnd(12)} ${String(r.secciones?.length ?? 0).padStart(2)} secciones${r.es_sistema ? "  (de sistema)" : ""}${r.exige_2fa ? "  2FA" : ""}`)
}

if ((antes ?? []).some((r) => r.id === NUEVO.id)) {
  console.log(`\n✅ El rol «${NUEVO.id}» YA EXISTE. No se toca nada.`)
  process.exit(0)
}

console.log(`\n🆕 VA A CREAR el rol «${NUEVO.id}»:`)
console.log(`   secciones : (ninguna) — se le agregan desde la pantalla`)
console.log(`   exige_2fa : no`)
console.log(`   es_sistema: no → editable desde Configuración → Roles`)

if (!APLICAR) {
  console.log("\n⏸️  INFORME, no se escribió nada. Para aplicar:  npx tsx scripts/crear-rol-pruebas.mts --aplicar")
  process.exit(0)
}

// La foto: el estado anterior completo, por si hay que volver.
mkdirSync("respaldos", { recursive: true })
const foto = `respaldos/roles-antes-de-pruebas-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`
writeFileSync(foto, JSON.stringify(antes, null, 2), "utf8")
console.log(`\n📸 Foto del estado anterior: ${foto}`)

const { error } = await db.from("roles").insert(NUEVO)
if (error) { console.error("❌ No se pudo crear:", error.message); process.exit(1) }
console.log(`✅ Rol «${NUEVO.id}» creado.`)
console.log("   Para deshacer:  DELETE FROM public.roles WHERE id = 'pruebas';")
