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
    supabase.from("cuentas_contables")
      .select("categ, cuenta_contable, nro_cuenta, tipo, nombre_totalizadora, cta_totalizadora, imputable, activo"),
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
        "Cuenta contable": c?.cuenta_contable ?? "",
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

  // ── Hoja 4: el plan de cuentas tal cual está, para revisar consistencia
  const usadaPorTemplates = new Map<string, number>()
  for (const t of templates) {
    const k = String(t.categ ?? "").trim().toUpperCase()
    if (k) usadaPorTemplates.set(k, (usadaPorTemplates.get(k) ?? 0) + 1)
  }
  const hojaPlan = ((ctas || []) as any[])
    .map(c => ({
      "Nro cuenta": c.nro_cuenta ?? "",
      "Cuenta contable": c.cuenta_contable ?? "",
      "Categoría": c.categ ?? "",
      "Tipo": c.tipo ?? "",
      "Totalizadora": c.nombre_totalizadora ?? "",
      "Cta totalizadora": c.cta_totalizadora ?? "",
      "Imputable": c.imputable === true ? "Sí" : c.imputable === false ? "No" : "",
      "Activa": c.activo === true ? "Sí" : c.activo === false ? "No" : "",
      "Templates que la usan": usadaPorTemplates.get(String(c.categ ?? "").trim().toUpperCase()) ?? 0,
    }))
    .sort((a, b) =>
      String(a["Tipo"]).localeCompare(String(b["Tipo"]))
      || String(a["Totalizadora"]).localeCompare(String(b["Totalizadora"]))
      || String(a["Nro cuenta"]).localeCompare(String(b["Nro cuenta"])))

  // ── Hoja 5: lo que conviene revisar del plan actual
  const revisar: any[] = []

  // Totalizadoras que difieren sólo por mayúsculas: agrupar por nombre partiría la jerarquía
  // en dos, el mismo problema que tuvimos con los nombres de cuenta entre ARCA y el histórico.
  const porTotalizadora = new Map<string, Set<string>>()
  for (const c of (ctas || []) as any[]) {
    const t = c.nombre_totalizadora
    if (!t) continue
    const k = String(t).trim().toUpperCase()
    if (!porTotalizadora.has(k)) porTotalizadora.set(k, new Set())
    porTotalizadora.get(k)!.add(t)
  }
  for (const [k, variantes] of porTotalizadora) {
    if (variantes.size > 1) {
      const filas = ((ctas || []) as any[]).filter(c =>
        String(c.nombre_totalizadora ?? "").trim().toUpperCase() === k).length
      revisar.push({
        "Qué revisar": "Totalizadora escrita de dos formas",
        "Detalle": [...variantes].join("  |  "),
        "Cuentas afectadas": filas,
        "Por qué importa": "Agrupar por el nombre partiría la jerarquía en dos ramas distintas. Unificar a una sola escritura.",
      })
    }
  }
  for (const c of (ctas || []) as any[]) {
    if (!c.tipo) {
      revisar.push({
        "Qué revisar": "Cuenta sin TIPO",
        "Detalle": `${c.nro_cuenta ?? "-"} · ${c.cuenta_contable ?? "-"}`,
        "Cuentas afectadas": 1,
        "Por qué importa": "Sin tipo no se sabe si lo que cuelga de ella se presupuesta.",
      })
    }
  }
  if (revisar.length === 0) {
    revisar.push({ "Qué revisar": "Nada", "Detalle": "El plan de cuentas está consistente",
      "Cuentas afectadas": 0, "Por qué importa": "" })
  }

  const wb = XLSX.utils.book_new()
  const w = (filas: any[], nombre: string, anchos: number[]) => {
    const ws = XLSX.utils.json_to_sheet(filas)
    ws["!cols"] = anchos.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  w(hojaFaltan, "1 - A completar", [32, 10, 30, 60, 14, 32, 12, 32])
  w(hojaTodos, "2 - Todos los templates", [34, 8, 12, 30, 30, 14, 12, 32, 32, 12, 12, 14])
  w(hojaAyuda, "3 - Valores válidos", [26, 70, 90])
  w(hojaPlan, "4 - Plan de cuentas actual", [12, 38, 34, 13, 34, 16, 10, 8, 10])
  w(revisar, "5 - Revisar consistencia", [34, 46, 10, 90])

  // Si el archivo está abierto en Excel, Windows lo bloquea (EBUSY). En vez de fallar se
  // escribe una copia numerada: es más útil que perder el reporte recién generado.
  const base = `Plan_de_cuentas_a_completar_${new Date().toISOString().slice(0, 10)}`
  let archivo = `${base}.xlsx`
  for (let i = 2; i < 20; i++) {
    try { XLSX.writeFile(wb, archivo); break } catch (e: any) {
      if (e?.code !== "EBUSY" && e?.code !== "EPERM") throw e
      console.log(`   (${archivo} está abierto, escribo otra copia)`)
      archivo = `${base}_v${i}.xlsx`
    }
  }

  console.log(`\n✅ ${archivo}`)
  console.log(`   ${templates.length} templates · ${hojaFaltan.length} categorías sin clasificar `
    + `(${hojaFaltan.reduce((s, f) => s + f["Templates que la usan"], 0)} templates afectados)`)
  console.log(`\nCompletá las columnas que empiezan con "→" en la hoja 1 y devolvé el archivo.`)
}

main()
