/**
 * POST /api/reparsear-extracto — vuelve a desglosar movimientos YA importados.
 *
 * Para qué: las reglas de `config_parseo_extracto` sólo corrían al importar. Si una regla no
 * existía en ese momento, el movimiento quedaba sin desglosar y la única salida era volver a
 * subir el Excel. Con esto se escribe la regla y se aplica sobre lo ya cargado.
 *
 * Es posible porque el importador guarda el texto crudo del banco en `concepto`, **siempre**,
 * haya regla o no. De ahí lee este endpoint. Y usa exactamente la misma lógica que el importador
 * (`lib/extractos/parseo-movimiento`), así que re-parsear algo bien importado no lo cambia.
 *
 * Body: { cuenta: "pam_galicia" | "ma_galicia", aplicar?: boolean, tipo?: string }
 *   - sin `aplicar` → **pasada en seco**: informa qué cambiaría, no toca nada.
 *   - `tipo` → limita a un tipo de movimiento, para probar una regla nueva de a una.
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  parsearMovimiento,
  cargarReglasParseo,
  tipoDeMovimiento,
  tieneReglaPropia,
  splitMovimiento,
  firmaDeMovimiento,
  lineasDeFirma,
  resolverReglas,
  GRUPO_SUBTIPO_NUEVO,
  GRUPO_CHOQUE,
} from "@/lib/extractos/parseo-movimiento"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"

/** Las mismas cuentas que acepta el importador de Caja de Ahorro. */
const CUENTAS: Record<string, { schema: string }> = {
  pam_galicia: { schema: "public" },
  ma_galicia: { schema: "ma" },
}

export async function POST(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const body = await req.json().catch(() => ({}))
    const cuenta = String(body.cuenta ?? "")
    const aplicar = body.aplicar === true
    const tipoFiltro = body.tipo ? String(body.tipo).toUpperCase() : null
    /**
     * 🧪 **A-FEAT-1172 — re-parsear sólo lo que el usuario tiene delante.**
     *
     * Pedido suyo: *«si tengo filtrados 15 movimientos en pantalla y le doy a parsear, que me
     * parsee esos 15 únicamente»*. Sin esto, ensayar una regla obliga a correrla sobre la cuenta
     * entera — y entonces no se puede ensayar nada.
     *
     * ⚠️ **La pantalla sólo manda ids cuando hay un filtro puesto.** Sin filtro manda `null` y se
     * toma la cuenta completa, **a propósito**: el Extracto carga por páginas, así que «todo lo
     * visible» sin filtro sería sólo lo cargado, y el re-parseo tocaría menos de lo que dice.
     * Es el bug de A-BUG-189 (el buscador miraba sólo lo cargado) aplicado a una escritura.
     */
    const idsFiltro: string[] | null =
      Array.isArray(body.ids) && body.ids.length > 0 ? body.ids.map(String) : null

    const cfg = CUENTAS[cuenta]
    if (!cfg) {
      return NextResponse.json(
        { error: `Cuenta no soportada: ${cuenta}. El re-parseo es para extractos de Caja de Ahorro.` },
        { status: 400 }
      )
    }

    const db = cfg.schema === "public" ? supabase : supabase.schema(cfg.schema)
    const mapaReglas = await cargarReglasParseo(supabase, cuenta)

    const consulta = db
      .from(cuenta)
      .select("id, fecha, concepto, descripcion, grupo_de_conceptos, tipo_de_movimiento, numero_de_comprobante, numero_de_terminal, observaciones_cliente, leyendas_adicionales_1, leyendas_adicionales_2, leyendas_adicionales_3, leyendas_adicionales_4")
      .not("concepto", "is", null)
      .neq("concepto", "")
      .order("fecha", { ascending: true })
    const { data: movs, error } = idsFiltro
      ? await consulta.in("id", idsFiltro)
      : await consulta

    if (error) {
      return NextResponse.json({ error: `Error leyendo ${cuenta}: ${error.message}` }, { status: 500 })
    }

    const cambios: any[] = []
    // Cuántos movimientos hay por tipo y cuántos de ellos siguen sin regla propia — es el
    // insumo para saber qué regla conviene escribir primero.
    const porTipo = new Map<string, { total: number; conRegla: boolean }>()

    for (const m of (movs ?? []) as any[]) {
      const tipo = tipoDeMovimiento(m.concepto)
      if (!porTipo.has(tipo)) porTipo.set(tipo, { total: 0, conRegla: tieneReglaPropia(m.concepto, mapaReglas) })
      porTipo.get(tipo)!.total++

      if (tipoFiltro && tipo !== tipoFiltro) continue

      const parsed = parsearMovimiento(m.concepto, mapaReglas)

      // Sólo se escriben los campos que el parseo produce. `categ`, `detalle`, `contable`,
      // `interno` y el estado son de la conciliación y NO se tocan.
      const update: Record<string, any> = {}
      for (const [campo, valor] of Object.entries(parsed)) {
        const actual = m[campo] ?? ""
        if (String(valor ?? "") !== String(actual)) update[campo] = valor
      }

      if (Object.keys(update).length > 0) {
        cambios.push({
          id: m.id,
          fecha: m.fecha,
          tipo,
          antes: Object.fromEntries(Object.keys(update).map((k) => [k, m[k] ?? ""])),
          despues: update,
        })
      }
    }

    // Sobre qué universo corrió: la pantalla lo muestra para que no haya dudas de qué se tocó.
    const universo = idsFiltro ? `los ${movs?.length ?? 0} movimientos filtrados` : `la cuenta entera`

    // Resumen por tipo, lo que más se necesita para decidir qué regla escribir
    const tipos = [...porTipo.entries()]
      .map(([tipo, v]) => ({ tipo, movimientos: v.total, conRegla: v.conRegla }))
      .sort((a, b) => Number(a.conRegla) - Number(b.conRegla) || b.movimientos - a.movimientos)

    if (!aplicar) {
      return NextResponse.json({
        ok: true,
        modo: "seco",
        message: cambios.length === 0
          ? `Nada que cambiar en ${universo}: el desglose guardado ya coincide con lo que dan las reglas actuales.`
          : `${cambios.length} movimiento(s) cambiarían. Nada se modificó todavía.`,
        universo,
        soloFiltrados: idsFiltro !== null,
        totalMovimientos: movs?.length ?? 0,
        cambios: cambios.slice(0, 50),
        cambiosTotales: cambios.length,
        tipos,
      })
    }

    // Aplicar: uno por uno para no pisar campos de otros movimientos
    let aplicados = 0
    const fallos: any[] = []
    for (const c of cambios) {
      const { error: errUpd, count } = await db
        .from(cuenta)
        .update(c.despues, { count: "exact" })
        .eq("id", c.id)
      if (errUpd) fallos.push({ id: c.id, error: errUpd.message })
      else if (count === 0) fallos.push({ id: c.id, error: "no se encontró el movimiento" })
      else aplicados++
    }

    return NextResponse.json({
      ok: fallos.length === 0,
      modo: "aplicado",
      universo,
      message: `${aplicados} movimiento(s) re-parseados sobre ${universo}`
        + (fallos.length > 0 ? ` · ${fallos.length} fallaron` : "")
        + ".",
      totalMovimientos: movs?.length ?? 0,
      aplicados,
      fallos,
      tipos,
    })
  } catch (err) {
    console.error("Error en re-parseo:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * GET /api/reparsear-extracto?cuenta=… — sólo el diagnóstico, sin tocar nada.
 *
 * Devuelve qué tipos hay, con qué subtipos, y **cuántos movimientos están hoy sin parsear** —
 * distinguiendo las cuatro causas, porque cada una se arregla distinto. Lo usa la alerta de
 * Principal y el configurador de reglas.
 */
export async function GET(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const cuenta = new URL(req.url).searchParams.get("cuenta") ?? ""
    const cfg = CUENTAS[cuenta]
    if (!cfg) return NextResponse.json({ error: `Cuenta no soportada: ${cuenta}` }, { status: 400 })

    const db = cfg.schema === "public" ? supabase : supabase.schema(cfg.schema)
    const mapaReglas = await cargarReglasParseo(supabase, cuenta)

    /**
     * ⚠️ **Se leen también las columnas del desglose, y no por curiosidad.**
     *
     * Hasta el 2026-09-25 esto pedía sólo `concepto` y preguntaba *«¿el tipo tiene regla?»*.
     * Con eso, **MA daba 0 y la alerta no aparecía nunca** aunque sus 96 movimientos estuvieran
     * guardados en blanco: las 42 reglas se habían escrito **después** de importar y el re-parseo
     * no se corrió jamás. La regla existía; el desglose no. Ver PENDIENTES § A-BUG-1199.
     */
    const { data, error } = await db
      .from(cuenta)
      .select("concepto, descripcion, grupo_de_conceptos, tipo_de_movimiento, numero_de_comprobante, numero_de_terminal, leyendas_adicionales_1, leyendas_adicionales_2, leyendas_adicionales_3, leyendas_adicionales_4")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Un ejemplo por tipo **y por subtipo**, tenga regla o no.
    //
    // ⚠️ Antes se guardaba el PRIMER movimiento de cada tipo y se lo mostraba como si fuera
    // representativo. No lo es: un tipo puede llegar con subtipos distintos, y una regla escrita
    // mirando una de ellas falla en las otras sin avisar (PENDIENTES § A-BUG-17). Ahora se
    // agrupa además por firma, así la pantalla puede mostrar TODAS los subtipos.
    const porTipo = new Map<string, {
      n: number; conRegla: boolean
      subtipos: Map<string, { n: number; ejemplo: string }>
    }>()

    /**
     * 🧮 **Las CUATRO causas por las que un movimiento puede estar sin parsear.**
     *
     * Se cuentan separadas porque cada una se resuelve distinto, y porque juntas mienten: decir
     * *«12 sin parsear»* sin decir por qué manda a escribir reglas que ya están escritas.
     */
    let sinRegla = 0            // el tipo no tiene ninguna regla → escribir la regla
    let subtipoNuevo = 0          // el tipo tiene reglas por subtipo, pero no de ESTE subtipo
    let choque = 0              // dos reglas reclaman la misma columna → hay una mal escrita
    let desglosePendiente = 0   // hay regla y cierra, pero lo guardado no coincide → falta RE-PARSEAR

    for (const m of (data ?? []) as any[]) {
      const tipo = tipoDeMovimiento(m.concepto)
      if (!tipo) continue
      const conRegla = tieneReglaPropia(m.concepto, mapaReglas)
      if (!porTipo.has(tipo)) porTipo.set(tipo, { n: 0, conRegla, subtipos: new Map() })
      const t = porTipo.get(tipo)!
      t.n++

      const lineas = splitMovimiento(String(m.concepto))
      const firma = firmaDeMovimiento(lineas)
      const f = t.subtipos.get(firma)
      t.subtipos.set(firma, { n: (f?.n ?? 0) + 1, ejemplo: f?.ejemplo ?? String(m.concepto) })

      if (!conRegla) { sinRegla++; continue }

      const parsed = parsearMovimiento(String(m.concepto), mapaReglas)
      if (parsed.grupo_de_conceptos === GRUPO_SUBTIPO_NUEVO) { subtipoNuevo++; continue }
      if (parsed.grupo_de_conceptos === GRUPO_CHOQUE) { choque++; continue }

      // Sólo se comparan los campos que el parseo produce: `observaciones_cliente` y `concepto`
      // son del usuario y del banco, y compararlos daría una diferencia falsa en cada fila.
      const distinto = Object.entries(parsed).some(
        ([campo, valor]) => String(valor ?? "") !== String(m[campo] ?? "")
      )
      if (distinto) desglosePendiente++
    }

    const tipos = [...porTipo.entries()]
      .map(([tipo, v]) => {
        // Los subtipos van ordenados por cantidad: la mayoritaria manda como ejemplo por defecto
        const subtipos = [...v.subtipos.entries()]
          .map(([firma, f]) => {
            const texto = splitMovimiento(f.ejemplo)
            // `cubierto: false` = el tipo tiene reglas por subtipo pero ninguna es de ésta, así que
            // sus movimientos NO se parsean. Es la señal de "apareció un subtipo nuevo".
            const { subtipoNuevo } = resolverReglas(texto, mapaReglas)
            return {
              firma,
              lineas: lineasDeFirma(firma),
              movimientos: f.n,
              texto,
              cubierto: !subtipoNuevo,
            }
          })
          .sort((a, b) => b.movimientos - a.movimientos)

        return {
          tipo,
          movimientos: v.n,
          conRegla: v.conRegla,
          /** Ejemplo de el subtipo mayoritario. Se mantiene el nombre para no romper consumidores. */
          lineas: subtipos[0]?.texto ?? [],
          /** Todas los subtipos del tipo. `length > 1` = ojo con las reglas por número de línea. */
          subtipos,
        }
      })
      .sort((a, b) => b.movimientos - a.movimientos)

    const sinParsear = sinRegla + subtipoNuevo + choque + desglosePendiente

    return NextResponse.json({
      ok: true,
      cuenta,
      totalMovimientos: data?.length ?? 0,
      /** 🔑 El número que dispara la alerta: todo lo que hoy NO está desglosado, por cualquier causa. */
      sinParsear,
      /** Las cuatro causas, separadas. Cada una tiene su propio arreglo. */
      causas: { sinRegla, subtipoNuevo, choque, desglosePendiente },
      /** Compat: era `sinDesglosar` = los que no tienen regla del tipo. */
      sinDesglosar: sinRegla,
      subtiposNuevos: subtipoNuevo,
      /** Todos los tipos presentes, con ejemplo. Lo usa el configurador. */
      tipos,
      /** Sólo los que no tienen regla. Lo usa la alerta de Principal — no cambiar el subtipo. */
      tiposSinRegla: tipos.filter(t => !t.conRegla).map(({ tipo, movimientos, lineas }) => ({ tipo, movimientos, lineas })),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
