// Genera el Excel para completar el plan de cuentas con las categorías que usan los templates
// y todavía no existen en `public.cuentas_contables`.
//
// Sin esa fila, el template se queda sin `tipo` (no se sabe si es gasto o movimiento
// financiero, y por lo tanto si se presupuesta) y sin totalizadora (no se sabe dónde va en el
// reporte). Ver ARQUITECTURA-BD.md § "Las capas que ordenan un egreso".
//
//   npx tsx scripts/reporte-categorias-templates.ts

import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

// Las credenciales salen de .env.local, igual que la app
function env(clave: string): string {
  try {
    const txt = readFileSync(join(process.cwd(), ".env.local"), "utf-8")
    const linea = txt.split(/\r?\n/).find(l => l.startsWith(clave + "="))
    if (linea) return linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, "")
  } catch { /* sigue con process.env */ }
  return process.env[clave] ?? ""
}

const supabase = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
)

async function main() {
  const [{ data: tpl, error: e1 }, { data: ctas, error: e2 }] = await Promise.all([
    supabase.from("egresos_sin_factura")
      .select("nombre_referencia, categ, cuenta_agrupadora, responsable, cuotas, tipo_recurrencia, activo, codigo_contable")
      .not("cuenta_agrupadora", "is", null),
    supabase.from("cuentas_contables").select("categ, cuenta_contable, nro_cuenta, tipo, nombre_totalizadora"),
  ])
  if (e1 || e2) { console.error(e1 || e2); process.exit(1) }

  const porCateg = new Map<string, any>()
  for (const c of (ctas || []) as any[]) {
    if (c.categ) porCateg.set(String(c.categ).trim().toUpperCase(), c)
  }

  const templates = (tpl || []) as any[]

  // ── Hoja 1: lo que hay que completar
  const faltantes = new Map<string, { categ: string; agrupadoras: Set<string>; n: number; ejemplos: string[] }>()
  for (const t of templates) {
    const k = String(t.categ ?? "").trim().toUpperCase()
    if (!k || porCateg.has(k)) continue
    const a = faltantes.get(k) ?? { categ: t.categ, agrupadoras: new Set<string>(), n: 0, ejemplos: [] }
    a.n++
    a.agrupadoras.add(t.cuenta_agrupadora)
    if (a.ejemplos.length < 4) a.ejemplos.push(t.nombre_referencia)
    faltantes.set(k, a)
  }

  const hojaFaltan = [...faltantes.values()]
    .sort((a, b) => b.n - a.n)
    .map(f => ({
      "Categoría del template": f.categ,
      "Templates que la usan": f.n,
      "Agrupadora": [...f.agrupadoras].join(" · "),
      "Ejemplos": f.ejemplos.join(" · "),
      "→ TIPO": "",
      "→ Nombre totalizadora": "",
      "→ Nro cuenta": "",
      "→ Nombre de la cuenta contable": "",
    }))

  // ── Hoja 2: la foto completa, para ver qué sí está clasificado
  const hojaTodos = templates
    .map(t => {
      const c = porCateg.get(String(t.categ ?? "").trim().toUpperCase())
      return {
        "Template": t.nombre_referencia,
        "Activo": t.activo ? "Sí" : "No",
        "Responsable": t.responsable ?? "",
        "Agrupadora": t.cuenta_agrupadora ?? "",
        "Categoría": t.categ ?? "",
        "¿Está en el plan de cuentas?": c ? "Sí" : "NO",
        "Tipo": c?.tipo ?? "",
        "Totalizadora": c?.nombre_totalizadora ?? "",
        "Nro cuenta": c?.nro_cuenta ?? "",
        "Cuotas al año": t.cuotas ?? "",
        "Recurrencia": t.tipo_recurrencia ?? "",
      }
    })
    .sort((a, b) =>
      a["¿Está en el plan de cuentas?"].localeCompare(b["¿Está en el plan de cuentas?"])
      || a["Agrupadora"].localeCompare(b["Agrupadora"])
      || a["Template"].localeCompare(b["Template"]))

  // ── Hoja 3: los valores válidos, para que se complete sin adivinar
  const tipos = [...new Set((ctas || []).map((c: any) => c.tipo).filter(Boolean))]
  const totalizadoras = [...new Set((ctas || []).map((c: any) => c.nombre_totalizadora).filter(Boolean))].sort()
  const hojaAyuda = [
    { "Columna": "→ TIPO", "Valores válidos": tipos.join(" · "),
      "Qué decide": "Si el template se presupuesta. Lo 'financiero' NO se presupuesta (colocaciones, transferencias entre cuentas propias, pago de tarjeta): la plata no sale de la empresa." },
    { "Columna": "→ Nombre totalizadora", "Valores válidos": totalizadoras.join(" · "),
      "Qué decide": "Dónde aparece en el reporte. Es la jerarquía que usa el dashboard; el presupuesto va a usar la misma." },
    { "Columna": "→ Nro cuenta", "Valores válidos": "el código del plan (ej. 422113)",
      "Qué decide": "Es la identidad estable de la cuenta. Opcional pero conviene: los nombres cambian, el número no." },
    { "Columna": "→ Nombre de la cuenta contable", "Valores válidos": "texto libre",
      "Qué decide": "Cómo se llama la cuenta en los reportes." },
  ]

  const wb = XLSX.utils.book_new()
  const w = (filas: any[], nombre: string, anchos: number[]) => {
    const ws = XLSX.utils.json_to_sheet(filas)
    ws["!cols"] = anchos.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  w(hojaFaltan, "1 - A completar", [32, 10, 30, 60, 14, 32, 12, 32])
  w(hojaTodos, "2 - Todos los templates", [34, 8, 12, 30, 30, 14, 12, 32, 12, 12, 14])
  w(hojaAyuda, "3 - Valores válidos", [26, 70, 90])

  const archivo = `Plan_de_cuentas_a_completar_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, archivo)

  console.log(`\n✅ ${archivo}`)
  console.log(`   ${templates.length} templates · ${hojaFaltan.length} categorías sin clasificar `
    + `(${hojaFaltan.reduce((s, f) => s + f["Templates que la usan"], 0)} templates afectados)`)
  console.log(`\nCompletá las columnas que empiezan con "→" en la hoja 1 y devolvé el archivo.`)
}

main()
