/**
 * 🔬 `npm run ensayo:padron` — corre la lógica REAL contra los datos REALES y **predice la
 * pantalla**. Sólo LEE (con `SERVICE_ROLE`, porque `anon` no puede leer estas tablas).
 *
 * ## Por qué existe, y por qué no es una suite más
 * Las suites (`npm run probar*`) le pasan al padrón la señal **ya cocinada** —`{ meses: 24 }`— y
 * prueban que la calcule bien. **El bug estaba en quién la cocina**: `metodoHeredado` devolvía
 * `no_proyectar` *justamente porque* faltaba historia, y el padrón lo leía como decisión tomada.
 * Resultado: **0 huecos de 76 templates**, con 12 proyectando $0 en silencio. Ninguna fixture podía
 * verlo → [A-BUG-134](../PENDIENTES.md#a-bug-134).
 *
 * > **Un test con fixtures prueba la función; sólo el dato real prueba el sistema.**
 *
 * ## Cuándo correrlo
 * Cuando un cálculo nuevo va a cambiar lo que el usuario ve — **antes** de decirle que pruebe. Lo
 * que imprime va derecho a la guía de pruebas: los números que él tiene que ver, medidos y no
 * estimados (§ [A-TEST-107](../PENDIENTES.md#a-test-107)).
 *
 * ⚠️ **No escribe nada.** Si algún día alguien le agrega una escritura, vale la § 🛑 Datos entera.
 */
import fs from "node:fs"
const R = "D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1"
const env = Object.fromEntries(fs.readFileSync(`${R}/.env.local`, "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]))

const api = async (path: string) => {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`)
  return r.json() as Promise<any[]>
}

const T: any = await import(`file:///${R}/lib/presupuesto/templates.ts`)
const P: any = await import(`file:///${R}/lib/presupuesto/padron.ts`)

// ── Los mismos 24 meses que la pantalla ───────────────────────────────────────────────────────
const hoy = new Date()
const meses: { anio: number; mes: number }[] = []
for (let k = 0; k < 24; k++) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1)
  meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 })
}
const clave = (m: any) => `${m.anio}-${String(m.mes).padStart(2, "0")}`
console.log(`Ventana: ${clave(meses[0])} → ${clave(meses[23])}  (${meses.length} meses)\n`)

// ── Mismas queries que cargarTemplates() ──────────────────────────────────────────────────────
const templates = await api("egresos_sin_factura?select=id,nombre_referencia,categ,cuenta_agrupadora,responsable,periodicidad,aplica_generacion,cuotas,tipo_recurrencia,tipo&activo=eq.true&or=(responsable.ilike.*MSA*,responsable.eq.ambas)&cuenta_agrupadora=not.is.null&limit=2000")
console.log(`Templates activos MSA con agrupadora: ${templates.length}`)

const ini = new Date(meses[0].anio, meses[0].mes - 1 - 18, 1)
const desde = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, "0")}-01`
const fin = new Date(meses[23].anio, meses[23].mes, 1)
const hasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-01`

const ids = templates.map(t => t.id)
const cuotas: any[] = []
for (let i = 0; i < ids.length; i += 150) {
  cuotas.push(...await api(`cuotas_egresos_sin_factura?select=egreso_id,fecha_estimada,fecha_vencimiento,monto,estado&egreso_id=in.(${ids.slice(i, i + 150).join(",")})&fecha_estimada=gte.${desde}&fecha_estimada=lt.${hasta}&estado=neq.desactivado&limit=20000`))
}
console.log(`Cuotas en ${desde} → ${hasta}: ${cuotas.length}`)

const historia: Record<string, any[]> = {}
for (const c of cuotas) {
  const f = c.fecha_estimada || c.fecha_vencimiento
  if (!f) continue
  ;(historia[c.egreso_id] ??= []).push({ egreso_id: c.egreso_id, mes: f.slice(0, 7), monto: Number(c.monto || 0) })
}

const cfgs = await api("presupuesto_template_config?select=template_id,metodo,monto_manual&empresa=eq.MSA&limit=2000")
const cfgPor: Record<string, any> = {}
for (const c of cfgs) cfgPor[String(c.template_id)] = { metodo: c.metodo, monto_manual: c.monto_manual == null ? null : Number(c.monto_manual) }

const ctas = await api("cuentas_contables?select=categ,tipo&categ=not.is.null&limit=5000")
const tipoPorCateg: Record<string, string> = {}
for (const c of ctas) if (c.tipo) tipoPorCateg[String(c.categ).trim().toUpperCase()] = c.tipo

// ── Proyectar, igual que la pantalla ──────────────────────────────────────────────────────────
const filas: any[] = []
const cuenta = { cuota: 0, proyectado: 0, no_proyectar: 0, fuera_de_patron: 0, sin_historia: 0 }
for (const t of templates) {
  const info = {
    id: t.id, nombre: t.nombre_referencia, agrupador: t.cuenta_agrupadora ?? null,
    tipo: t.tipo ?? null, tipo_contable: tipoPorCateg[String(t.categ ?? "").trim().toUpperCase()] ?? null,
    cuotas: t.cuotas ?? null, tipo_recurrencia: t.tipo_recurrencia ?? null,
    periodicidad: t.periodicidad ?? null, aplica_generacion: t.aplica_generacion ?? null,
  }
  const r = T.proyectarTemplate(info, historia[t.id] ?? [], meses, { config: cfgPor[t.id] })
  let sinHistoria = 0
  let causa: any = undefined
  for (const c of r.celdas) {
    if (c.origen === "cuota") cuenta.cuota++
    else if (c.origen === "proyectado") cuenta.proyectado++
    else {
      (cuenta as any)[c.motivoVacio ?? "SIN_MOTIVO"] = ((cuenta as any)[c.motivoVacio ?? "SIN_MOTIVO"] ?? 0) + 1
      if (c.motivoVacio === "sin_historia" || c.motivoVacio === "sin_monto") { sinHistoria++; causa = c.motivoVacio }
    }
  }
  const montos = r.celdas.filter((c: any) => c.monto > 0).map((c: any) => c.monto)
  filas.push({
    id: t.id, nombre: t.nombre_referencia, responsable: t.responsable,
    metodo: r.metodo.metodo, sinHistoria, cuotasDeclaradas: t.cuotas,
    cuotasEnHistoria: (historia[t.id] ?? []).length, causa,
    montoTipico: montos.length ? montos.reduce((a: number, b: number) => a + b, 0) / montos.length : null,
  })
}

console.log("\n── Las 24 × %d celdas, por origen ──", templates.length)
for (const [k, v] of Object.entries(cuenta)) console.log(`  ${k.padEnd(16)} ${String(v).padStart(6)}`)

// ── 🔬 Desarmar el `no_proyectar`: son TRES cosas ─────────────────────────────────────────────
const clases: Record<string, any[]> = { elegido_a_mano: [], no_es_gasto: [], sin_historia: [] }
for (const t of templates) {
  const info = {
    id: t.id, nombre: t.nombre_referencia, agrupador: t.cuenta_agrupadora ?? null,
    tipo: t.tipo ?? null, tipo_contable: tipoPorCateg[String(t.categ ?? "").trim().toUpperCase()] ?? null,
    cuotas: t.cuotas ?? null, tipo_recurrencia: t.tipo_recurrencia ?? null,
    periodicidad: t.periodicidad ?? null, aplica_generacion: t.aplica_generacion ?? null,
  }
  const tieneHistoria = (historia[t.id] ?? []).length > 0
  const m = T.resolverMetodo(info, cfgPor[t.id], tieneHistoria)
  if (m.metodo !== "no_proyectar") continue
  const donde = m.manual ? "elegido_a_mano" : (!tieneHistoria ? "sin_historia" : "no_es_gasto")
  clases[donde].push({ nombre: t.nombre_referencia, responsable: t.responsable, categ: t.categ, motivo: m.motivo })
}
console.log(""); console.log("── Los templates en `no_proyectar`, desarmados ──")
for (const [k, v] of Object.entries(clases)) {
  console.log(`  ${k.padEnd(16)} ${String(v.length).padStart(3)} templates ${k === "sin_historia" ? "  ← ESTO ES EL HUECO" : "  (legítimo)"}`)
}
console.log(""); console.log("  Los SIN HISTORIA, que son los que el presupuesto no puede proyectar:")
for (const x of clases.sin_historia) console.log(`    • ${x.nombre}  [${x.responsable}] ${x.categ ?? ""}`)
console.log(""); console.log("  Muestra de los NO ES GASTO (legítimos, no deben aparecer):")
for (const x of clases.no_es_gasto.slice(0, 8)) console.log(`    • ${x.nombre} — ${x.motivo}`)
console.log(`    … y ${Math.max(0, clases.no_es_gasto.length - 8)} más`)

// ── 🔬 Los 4 sospechosos, desarmados ──
const lupa = ["Imp Automotores Toyota 2015 Anual","Imp Automotores Gol 2012 Anual","Anticipo Ganancias MSA","Retiro Jose semestral MSA"]
console.log(""); console.log("── Lupa ──")
for (const t of templates.filter(x => lupa.includes(x.nombre_referencia))) {
  const info = {
    id: t.id, nombre: t.nombre_referencia, agrupador: t.cuenta_agrupadora ?? null,
    tipo: t.tipo ?? null, tipo_contable: tipoPorCateg[String(t.categ ?? "").trim().toUpperCase()] ?? null,
    cuotas: t.cuotas ?? null, tipo_recurrencia: t.tipo_recurrencia ?? null,
    periodicidad: t.periodicidad ?? null, aplica_generacion: t.aplica_generacion ?? null,
  }
  const h = historia[t.id] ?? []
  const conMonto = h.filter((c: any) => c.monto > 0)
  const m = T.resolverMetodo(info, cfgPor[t.id], h.length > 0)
  console.log(`  ${t.nombre_referencia}`)
  console.log(`     tipo=${info.tipo} tipo_contable=${info.tipo_contable} recurrencia=${info.tipo_recurrencia} cuotas=${info.cuotas}`)
  console.log(`     historia=${h.length} conMonto=${conMonto.length} · cfg=${cfgPor[t.id] ? cfgPor[t.id].metodo : "(ninguna)"}`)
  console.log(`     metodo=${m.metodo} manual=${m.manual} causa=${m.causa ?? "-"} | ${m.motivo}`)
}

// ── El padrón, tal cual lo llama la pantalla ──────────────────────────────────────────────────
const pad = P.padronTemplates(filas.map(f => ({
  id: f.id, nombre: f.nombre, responsable: f.responsable,
  mesesSinPoderProyectar: f.sinHistoria, mesesDelPeriodo: 24, montoTipico: f.montoTipico,
  causa: f.causa, cuotasCargadas: f.cuotasEnHistoria,
})), { meses: 24, desde: clave(meses[0]), hasta: clave(meses[23]) })

console.log(`\n══ PADRÓN DE TEMPLATES ══`)
console.log(`  pregunta : ${pad.pregunta}`)
console.log(`  huecos   : ${pad.huecos.length}   (antes de hoy: 52)`)
const conPlata = pad.huecos.filter((h: any) => h.plata != null)
console.log(`  con plata: ${conPlata.length} · sin valorizar: ${pad.huecos.length - conPlata.length}`)
console.log(`  $ total  : ${Math.round(conPlata.reduce((s: number, h: any) => s + h.plata, 0)).toLocaleString("es-AR")}`)

console.log(`\n── Los huecos, uno por uno ──`)
for (const h of pad.huecos.sort((a: any, b: any) => (b.plata ?? -1) - (a.plata ?? -1))) {
  const f = filas.find(x => `template:${x.id}` === h.clave)
  console.log(`  • ${h.que}`)
  console.log(`      ${h.porque}`)
  console.log(`      método=${f.metodo} · cuotas declaradas=${f.cuotasDeclaradas} · en historia=${f.cuotasEnHistoria} · plata=${h.plata == null ? "sin valorizar" : Math.round(h.plata).toLocaleString("es-AR")}`)
}

// ── 🔎 Control cruzado: los que DEJARON de ser huecos ─────────────────────────────────────────
const antes = filas.filter(f => f.cuotasDeclaradas != null && f.cuotasDeclaradas > 0)
console.log(`\n── Contraste con la pregunta VIEJA ──`)
console.log(`  templates con cuotas declaradas > 0 (los que miraba antes): ${antes.length}`)
const viejosHuecos = antes.filter(f => {
  const cargadas = (historia[f.id] ?? []).filter((c: any) => c.mes >= clave(meses[0])).length
  return f.cuotasDeclaradas - cargadas > 0
})
console.log(`  de ésos, la pregunta vieja marcaba hueco en: ${viejosHuecos.length}`)
console.log(`  la pregunta nueva marca: ${pad.huecos.length}`)
