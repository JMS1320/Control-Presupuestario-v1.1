// Propuesta para completar el plan de cuentas.
//
// Sale de tres hallazgos de la sesión del 2026-07-31:
//
//  1. 23 categorías que usan templates no existen en `cuentas_contables`, así que esos
//     templates se quedan sin `tipo` (¿se presupuesta?) y sin totalizadora (¿dónde va?).
//  2. Las 21 cuentas creadas el 2026-06-01 no tienen `nro_cuenta` ni `cta_totalizadora`, y
//     las cuatro totalizadoras que usan no existen como cuenta: son etiquetas sin nodo padre.
//  3. Se creó UNA CUENTA POR TEMPLATE en vez de una por concepto, y por eso el mismo nombre
//     aparece tres veces (nombre_referencia = categ = cuenta_contable en 2/3 de los casos).
//
// Por eso la propuesta CONSOLIDA: 42 templates de inmobiliario van a UNA cuenta, no a 42.
// El template sigue siendo el pago concreto; la cuenta, el concepto.
//
// Todo lo que dice CREAR o COMPLETAR es propuesta, no está aplicado. Las columnas "OK?" y
// "Corrección" son para que el usuario apruebe o corrija.
//
//   npx tsx scripts/propuesta-plan-de-cuentas.ts

import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

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

/** Una fila de la propuesta. `categs` son las categorías de template que colgarían de ella. */
interface Propuesta {
  accion: "CREAR" | "COMPLETAR" | "REUSAR"
  nro: string
  cuenta: string
  totalizadora: string
  tipo: string
  categs: string[]
  nota: string
}

// ── El esquema de numeración que ya usa el plan ──────────────────────────────
//   4 RESULTADOS · 41 INGRESOS · 42 EGRESOS
//     421 AGRICULTURA · 422 ADMIN Y ESTRUCTURA · 423 GANADERIA · 425 MAQUINARIAS
//   Libres a ese nivel: 424, 426, 427 …
//
// Los movimientos financieros NO son resultado (la plata no se gasta, cambia de lugar), así
// que van fuera del árbol 4 — se propone 5.
const PROPUESTAS: Propuesta[] = [
  // ── Nueva rama: impuestos. El plan no tiene ninguna, porque los impuestos siempre se
  //    pagaron por template y nunca tuvieron factura.
  { accion: "CREAR", nro: "424", cuenta: "EGRESOS POR IMPUESTOS Y TASAS", totalizadora: "EGRESOS", tipo: "egreso", categs: [], nota: "Nodo padre de la rama de impuestos" },

  { accion: "CREAR", nro: "4241", cuenta: "IMPUESTOS Y TASAS RURALES", totalizadora: "EGRESOS POR IMPUESTOS Y TASAS", tipo: "egreso", categs: [], nota: "Sub-rama" },
  { accion: "CREAR", nro: "424101", cuenta: "IMPUESTO INMOBILIARIO", totalizadora: "IMPUESTOS Y TASAS RURALES", tipo: "egreso", categs: ["Impuesto inmobiliario"], nota: "Consolida los 42 templates de inmobiliario (rurales + Lote Puerto) en UNA cuenta" },
  { accion: "CREAR", nro: "424102", cuenta: "IMPUESTO INMOBILIARIO COMPLEMENTARIO", totalizadora: "IMPUESTOS Y TASAS RURALES", tipo: "egreso", categs: ["Impuesto inmobiliario Complementario"], nota: "" },
  { accion: "CREAR", nro: "424103", cuenta: "IMPUESTO RED VIAL", totalizadora: "IMPUESTOS Y TASAS RURALES", tipo: "egreso", categs: ["Impuesto Red Vial"], nota: "Consolida los 40 templates de red vial" },

  { accion: "CREAR", nro: "4242", cuenta: "IMPUESTOS AUTOMOTORES", totalizadora: "EGRESOS POR IMPUESTOS Y TASAS", tipo: "egreso", categs: [], nota: "Sub-rama" },
  { accion: "CREAR", nro: "424201", cuenta: "PATENTES AUTOMOTORES", totalizadora: "IMPUESTOS AUTOMOTORES", tipo: "egreso", categs: ["Impuesto Automotores"], nota: "Un solo concepto para los 4 vehículos; el template distingue cuál" },

  { accion: "CREAR", nro: "4243", cuenta: "IMPUESTOS NACIONALES", totalizadora: "EGRESOS POR IMPUESTOS Y TASAS", tipo: "egreso", categs: [], nota: "Sub-rama (ARCA)" },
  { accion: "CREAR", nro: "424301", cuenta: "IMPUESTO A LAS GANANCIAS", totalizadora: "IMPUESTOS NACIONALES", tipo: "egreso", categs: ["Impuestos ARCA"], nota: "Ganancias, anticipos y Acciones y Participaciones" },
  { accion: "CREAR", nro: "424302", cuenta: "CARGAS SOCIALES Y GREMIALES", totalizadora: "IMPUESTOS NACIONALES", tipo: "egreso", categs: ["Impuestos Laborales ARCA"], nota: "Cargas Sociales y UATRE" },
  { accion: "CREAR", nro: "424303", cuenta: "RETENCIONES A DEPOSITAR (SICORE)", totalizadora: "IMPUESTOS NACIONALES", tipo: "egreso", categs: ["Retenciones ARCA"], nota: "Las dos quincenas" },

  { accion: "CREAR", nro: "4244", cuenta: "IMPUESTOS PROVINCIALES", totalizadora: "EGRESOS POR IMPUESTOS Y TASAS", tipo: "egreso", categs: [], nota: "Sub-rama" },
  { accion: "CREAR", nro: "424401", cuenta: "INGRESOS BRUTOS", totalizadora: "IMPUESTOS PROVINCIALES", tipo: "egreso", categs: ["Impuesto IIBB"], nota: "OJO: el presupuesto ya deriva el IIBB de las ventas. Este template va en 'no proyectar'." },

  { accion: "CREAR", nro: "4245", cuenta: "IMPUESTOS Y GASTOS INMUEBLES URBANOS", totalizadora: "EGRESOS POR IMPUESTOS Y TASAS", tipo: "egreso", categs: [], nota: "Sub-rama (Buenos Aires)" },
  { accion: "CREAR", nro: "424501", cuenta: "ABL", totalizadora: "IMPUESTOS Y GASTOS INMUEBLES URBANOS", tipo: "egreso", categs: ["ABL Cochera Posadas", "ABL Libertad", "ABL Libertad Cochera"], nota: "Un concepto; el template distingue el inmueble" },
  { accion: "CREAR", nro: "424502", cuenta: "EXPENSAS", totalizadora: "IMPUESTOS Y GASTOS INMUEBLES URBANOS", tipo: "egreso", categs: ["Expensas Libertad", "Expensas Cochera Posadas", "Fijos Libertad"], nota: "Revisar si 'Fijos Libertad' son expensas u otra cosa" },

  // ── Nodos padre que faltan para las 21 cuentas de junio
  { accion: "CREAR", nro: "426", cuenta: "EGRESOS BANCARIOS", totalizadora: "EGRESOS", tipo: "egreso", categs: [], nota: "Nodo padre: hoy GASTOS BANCARIOS e IMPUESTOS BANCARIOS son etiquetas sin cuenta" },
  { accion: "COMPLETAR", nro: "4261", cuenta: "GASTOS BANCARIOS", totalizadora: "EGRESOS BANCARIOS", tipo: "egreso", categs: [], nota: "Existe como etiqueta de totalizadora, falta la cuenta" },
  { accion: "COMPLETAR", nro: "4262", cuenta: "IMPUESTOS BANCARIOS", totalizadora: "EGRESOS BANCARIOS", tipo: "egreso", categs: [], nota: "Ídem" },

  // ── Retiros de socios: son `distribucion`, salen de la caja
  { accion: "CREAR", nro: "427", cuenta: "RETIROS Y DISTRIBUCION DE SOCIOS", totalizadora: "EGRESOS", tipo: "distribucion", categs: [], nota: "Nodo padre" },
  { accion: "CREAR", nro: "42701", cuenta: "DISTRIBUCION MERCEDES ARECO", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Mama"], nota: "" },
  { accion: "CREAR", nro: "42702", cuenta: "DISTRIBUCION ANDRES MARTINEZ", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Andres"], nota: "" },
  { accion: "CREAR", nro: "42703", cuenta: "DISTRIBUCION JOSE MARTINEZ", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Jose"], nota: "" },
  { accion: "CREAR", nro: "42704", cuenta: "DISTRIBUCION MANUEL MARTINEZ", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Manuel"], nota: "" },
  { accion: "CREAR", nro: "42705", cuenta: "DISTRIBUCION MERCEDES MARTINEZ", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Mechi"], nota: "" },
  { accion: "CREAR", nro: "42706", cuenta: "DISTRIBUCION SOLEDAD MARTINEZ", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Distribucion Soledad"], nota: "" },
  { accion: "CREAR", nro: "42707", cuenta: "RETIRO PAM", totalizadora: "RETIROS Y DISTRIBUCION DE SOCIOS", tipo: "distribucion", categs: ["Retiro PAM"], nota: "Retiro de MSA hacia PAM" },

  // ── Reusar en vez de crear
  { accion: "REUSAR", nro: "42303", cuenta: "GASTOS DE COMERCIALIZACION", totalizadora: "Egresos Por Ganaderia", tipo: "egreso", categs: ["CZ Ganadera"], nota: "Ya existe: la comisión de comercialización ganadera va acá. Sólo hay que apuntarle la categ." },
  { accion: "REUSAR", nro: "422109", cuenta: "GASTOS VARIOS ESTRUCTURA", totalizadora: "ADMINISTRACION Y ESTRUCTURA", tipo: "egreso", categs: ["Gastos Reintegro JMS"], nota: "Revisar: ¿es gasto de estructura o un reintegro que no es gasto?" },

  // ── Los financieros: fuera del árbol de resultados
  { accion: "CREAR", nro: "5", cuenta: "MOVIMIENTOS FINANCIEROS Y ENTRE CANALES", totalizadora: "", tipo: "financiero", categs: [], nota: "Raíz aparte: no son resultado, la plata cambia de lugar y no se gasta" },
  { accion: "COMPLETAR", nro: "51", cuenta: "MOVIMIENTOS FINANCIEROS", totalizadora: "MOVIMIENTOS FINANCIEROS Y ENTRE CANALES", tipo: "financiero", categs: [], nota: "Existe como etiqueta, falta la cuenta" },
  { accion: "COMPLETAR", nro: "52", cuenta: "MOVIMIENTOS ENTRE CANALES", totalizadora: "MOVIMIENTOS FINANCIEROS Y ENTRE CANALES", tipo: "financiero", categs: [], nota: "Ídem" },
]

async function main() {
  const [{ data: tpl, error: e1 }, { data: ctas, error: e2 }] = await Promise.all([
    supabase.from("egresos_sin_factura")
      .select("nombre_referencia, categ, cuenta_agrupadora, responsable, activo")
      .not("cuenta_agrupadora", "is", null),
    supabase.from("cuentas_contables")
      .select("categ, cuenta_contable, nro_cuenta, tipo, nombre_totalizadora, cta_totalizadora"),
  ])
  if (e1 || e2) { console.error(e1 || e2); process.exit(1) }

  const templates = (tpl || []) as any[]
  const cuentas = (ctas || []) as any[]
  const norm = (s: any) => String(s ?? "").trim().toUpperCase()
  const porCateg = new Map(cuentas.filter(c => c.categ).map(c => [norm(c.categ), c]))

  const cuantosUsan = (categs: string[]) =>
    templates.filter(t => categs.some(c => norm(c) === norm(t.categ))).length

  // ── Hoja 1: la propuesta
  const hoja1 = PROPUESTAS.map(p => ({
    "Acción": p.accion,
    "Nro cuenta": p.nro,
    "Cuenta contable": p.cuenta,
    "Totalizadora (padre)": p.totalizadora,
    "Tipo": p.tipo,
    "Categorías que cuelgan": p.categs.join(" · "),
    "Templates que quedan debajo": p.categs.length ? cuantosUsan(p.categs) : "",
    "Por qué": p.nota,
    "OK?": "",
    "Corrección": "",
  }))

  // ── Hoja 2: las 21 cuentas de junio, a las que hay que ponerles número
  const propuestaNro: Record<string, string> = {
    "Comisión Uso ATM": "426101", "Comisión Caja de Seguridad": "426102",
    "Comisión Certificaciones de Firma": "426103", "Comisión Cheques": "426104",
    "Comisión Cuenta Bancaria": "426105", "Comisión Extracción Efectivo": "426106",
    "Comisión Transferencias": "426107",
    "Débitos / Créditos Ley 25413": "426201", "IIBB Bancario": "426202",
    "Impuesto País": "426203", "IVA Bancario": "426204", "Percepción IVA": "426205",
    "Percepción RG 5463/23": "426206", "Sellos Bancario": "426207",
    "Créditos Pagados": "5101", "Créditos Tomados": "5102",
    "Fondos Comunes de Inversión": "5103", "INTERESES": "5104",
    "Movimientos a/desde Caja": "5201", "Transferencias Interbancarias": "5202",
    "Pago Tarjeta MSA": "5203", "Pago Tarjeta PAM": "5204",
  }
  const padrePropuesto: Record<string, string> = {
    "GASTOS BANCARIOS": "4261", "IMPUESTOS BANCARIOS": "4262",
    "MOVIMIENTOS FINANCIEROS": "51", "MOVIMIENTOS ENTRE CANALES": "52",
  }
  const hoja2 = cuentas
    .filter(c => !c.nro_cuenta || !c.cta_totalizadora)
    .map(c => ({
      "Cuenta contable": c.cuenta_contable ?? "",
      "Categoría": c.categ ?? "",
      "Tipo": c.tipo ?? "",
      "Totalizadora": c.nombre_totalizadora ?? "",
      "Nro cuenta HOY": c.nro_cuenta ?? "(falta)",
      "Cta totalizadora HOY": c.cta_totalizadora ?? "(falta)",
      "→ Nro propuesto": propuestaNro[c.cuenta_contable] ?? "",
      "→ Cta totalizadora propuesta": padrePropuesto[c.nombre_totalizadora] ?? "",
      "Templates que la usan": templates.filter(t => norm(t.categ) === norm(c.categ)).length,
      "OK?": "",
    }))
    .sort((a, b) => String(a["→ Nro propuesto"]).localeCompare(String(b["→ Nro propuesto"])))

  // ── Hoja 3: qué template quedaría colgando de qué cuenta
  const destinoPorCateg = new Map<string, Propuesta>()
  for (const p of PROPUESTAS) for (const c of p.categs) destinoPorCateg.set(norm(c), p)

  const hoja3 = templates.map(t => {
    const yaEsta = porCateg.get(norm(t.categ))
    const prop = destinoPorCateg.get(norm(t.categ))
    return {
      "Template": t.nombre_referencia,
      "Activo": t.activo ? "Sí" : "No",
      "Responsable": t.responsable ?? "",
      "Agrupadora": t.cuenta_agrupadora ?? "",
      "Categoría": t.categ ?? "",
      "Situación": yaEsta ? "Ya tiene cuenta" : prop ? "La propuesta se la da" : "SIGUE SIN CUENTA",
      "Cuenta (hoy o propuesta)": yaEsta?.cuenta_contable ?? prop?.cuenta ?? "",
      "Nro": yaEsta?.nro_cuenta ?? prop?.nro ?? "",
      "Tipo": yaEsta?.tipo ?? prop?.tipo ?? "",
      "¿Se presupuesta?": (yaEsta?.tipo ?? prop?.tipo) === "financiero" ? "NO (financiero)" : "Sí",
    }
  }).sort((a, b) =>
    a["Situación"].localeCompare(b["Situación"]) || a["Template"].localeCompare(b["Template"]))

  // ── Hoja 4: el plan como está hoy
  const hoja4 = cuentas.map(c => ({
    "Nro cuenta": c.nro_cuenta ?? "",
    "Cuenta contable": c.cuenta_contable ?? "",
    "Categoría": c.categ ?? "",
    "Tipo": c.tipo ?? "",
    "Totalizadora": c.nombre_totalizadora ?? "",
    "Cta totalizadora": c.cta_totalizadora ?? "",
    "Templates que la usan": templates.filter(t => norm(t.categ) === norm(c.categ)).length,
  })).sort((a, b) => String(a["Nro cuenta"]).localeCompare(String(b["Nro cuenta"])))

  // ── Hoja 5: lo que hay que emprolijar aparte de esto
  const variantes = new Map<string, Set<string>>()
  for (const c of cuentas) {
    if (!c.nombre_totalizadora) continue
    const k = norm(c.nombre_totalizadora)
    if (!variantes.has(k)) variantes.set(k, new Set())
    variantes.get(k)!.add(c.nombre_totalizadora)
  }
  const hoja5: any[] = []
  for (const [k, v] of variantes) {
    if (v.size > 1) hoja5.push({
      "Qué": "Totalizadora escrita de dos formas",
      "Detalle": [...v].join("  |  "),
      "Afecta": cuentas.filter(c => norm(c.nombre_totalizadora) === k).length + " cuentas",
      "Propuesta": `Unificar a "${[...v].sort((a, b) => b.length - a.length)[0]!.toUpperCase()}"`,
    })
  }
  hoja5.push({
    "Qué": "Columna muerta en templates",
    "Detalle": "egresos_sin_factura.codigo_contable",
    "Afecta": "151 de 173 dicen 'No lleva'/null (en dos escrituras)",
    "Propuesta": "Dejar de usarla, o reusarla para guardar el nro_cuenta del plan y dejar de cruzar por texto",
  })
  hoja5.push({
    "Qué": "Columna vacía en el plan",
    "Detalle": "cuentas_contables.grupo_cuenta",
    "Afecta": "143 de 143 vacías",
    "Propuesta": "Borrarla",
  })

  const wb = XLSX.utils.book_new()
  const w = (filas: any[], nombre: string, anchos: number[]) => {
    const ws = XLSX.utils.json_to_sheet(filas)
    ws["!cols"] = anchos.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  w(hoja1, "1 - PROPUESTA cuentas", [12, 12, 42, 40, 14, 46, 12, 70, 8, 30])
  w(hoja2, "2 - Códigos que faltan", [34, 32, 12, 30, 14, 20, 16, 26, 10, 8])
  w(hoja3, "3 - Template a qué cuenta va", [34, 8, 12, 30, 32, 20, 42, 10, 12, 16])
  w(hoja4, "4 - Plan actual", [12, 40, 34, 13, 36, 16, 10])
  w(hoja5, "5 - Emprolijar", [34, 46, 34, 80])

  const base = `Propuesta_plan_de_cuentas_${new Date().toISOString().slice(0, 10)}`
  let archivo = `${base}.xlsx`
  for (let i = 2; i < 20; i++) {
    try { XLSX.writeFile(wb, archivo); break } catch (e: any) {
      if (e?.code !== "EBUSY" && e?.code !== "EPERM") throw e
      console.log(`   (${archivo} está abierto, escribo otra copia)`)
      archivo = `${base}_v${i}.xlsx`
    }
  }

  const sinCuenta = hoja3.filter(r => r["Situación"] === "SIGUE SIN CUENTA").length
  console.log(`\n✅ ${archivo}`)
  console.log(`   ${PROPUESTAS.length} cuentas propuestas (${PROPUESTAS.filter(p => p.accion === "CREAR").length} crear · `
    + `${PROPUESTAS.filter(p => p.accion === "COMPLETAR").length} completar · ${PROPUESTAS.filter(p => p.accion === "REUSAR").length} reusar)`)
  console.log(`   ${hoja2.length} cuentas sin número · ${templates.length} templates, ${sinCuenta} seguirían sin cuenta`)
}

main()
