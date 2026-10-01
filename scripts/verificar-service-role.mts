/**
 * CONTROL DEL USO DE `service_role` — A-SEC-01
 *
 * `service_role` **saltea la RLS por completo**. Una ruta que lo usa sin necesitarlo es una puerta
 * que no pasa por la política de permisos — y no falla, sólo abre.
 *
 * El 2026-09-24 eran **37 de 41 rutas**. Este control existe para que el número no vuelva a subir
 * solo: una ruta nueva que lo use tiene que estar en la lista de excepciones, con su motivo.
 *
 *   npm run verificar:service-role
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** Las únicas razones legítimas, verificadas el 2026-09-24. */
const PERMITIDAS: Record<string, string> = {
  "admin/roles": "Lee y escribe `public.roles`, revocada a `authenticated` a propósito (scripts/60) para que nadie edite sus propios permisos.",
  "admin/usuarios": "auth.admin — crear e invitar cuentas. No hay otra forma.",
  "admin/usuarios/[id]": "auth.admin — cambiar rol, revocar. Y lee `public.roles`.",
  "admin/usuarios/[id]/2fa": "auth.admin — borrar factores de otra persona.",
  "admin/usuarios/[id]/link": "auth.admin — generar un link de acceso.",
  "admin/usuarios/[id]/mail": "auth.admin — reenviar el acceso por mail.",
  "perfil/avatar": "Storage con permisos elevados.",
  // ── Deuda declarada: deberían migrar, pero usan el cliente en helpers de módulo ──
  "notas": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers. Migrar pide refactor.",
  "revisiones": "⏳ PENDIENTE: idem notas.",
  "arca-asignar": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "historico-asignar": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-excel": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-excel-ca": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-excel-caja": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-excel-tarjeta": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-facturas-arca": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-historico": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-pdf-tarjeta": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-pesadas": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-templates": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-terneros": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "import-ventas": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "reparsear-extracto": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
  "verificar-tabla": "⏳ PENDIENTE: define el cliente a nivel módulo y lo usa en helpers; migrar pide refactor por archivo.",
}

function rutas(dir: string, prefijo = ""): { ruta: string; archivo: string }[] {
  const out: { ruta: string; archivo: string }[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rutas(p, prefijo ? `${prefijo}/${e}` : e))
    else if (e === "route.ts") out.push({ ruta: prefijo, archivo: p })
  }
  return out
}

let problemas = 0
const usan: string[] = []

for (const { ruta, archivo } of rutas("app/api")) {
  const src = readFileSync(archivo, "utf8")
  if (!/supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/.test(src)) continue
  usan.push(ruta)
  if (!(ruta in PERMITIDAS)) {
    console.log(`  🚨 ${ruta} usa service_role y no está en la lista de excepciones.`)
    console.log(`       Si sólo toca datos, usá clienteUsuario() (lib/supabase-usuario.ts) y la RLS`)
    console.log(`       gobierna la ruta sola. Si lo necesita de verdad, declaralo acá con el motivo.`)
    problemas++
  }
}

const pendientes = Object.entries(PERMITIDAS).filter(([, m]) => m.startsWith("⏳")).length
console.log(`\n  ${usan.length} ruta(s) con service_role · ${Object.keys(PERMITIDAS).length - pendientes} legítimas · ${pendientes} deuda declarada`)
console.log(
  problemas === 0
    ? "\n✅ Control OK — ninguna ruta se saltea la RLS sin declararlo."
    : `\n🔴 ${problemas} ruta(s) sin declarar.`
)
process.exit(problemas === 0 ? 0 : 1)
