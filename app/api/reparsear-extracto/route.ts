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
} from "@/lib/extractos/parseo-movimiento"

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
  try {
    const body = await req.json().catch(() => ({}))
    const cuenta = String(body.cuenta ?? "")
    const aplicar = body.aplicar === true
    const tipoFiltro = body.tipo ? String(body.tipo).toUpperCase() : null

    const cfg = CUENTAS[cuenta]
    if (!cfg) {
      return NextResponse.json(
        { error: `Cuenta no soportada: ${cuenta}. El re-parseo es para extractos de Caja de Ahorro.` },
        { status: 400 }
      )
    }

    const db = cfg.schema === "public" ? supabase : supabase.schema(cfg.schema)
    const mapaReglas = await cargarReglasParseo(supabase, cuenta)

    const { data: movs, error } = await db
      .from(cuenta)
      .select("id, fecha, concepto, descripcion, grupo_de_conceptos, tipo_de_movimiento, numero_de_comprobante, numero_de_terminal, observaciones_cliente, leyendas_adicionales_1, leyendas_adicionales_2, leyendas_adicionales_3, leyendas_adicionales_4")
      .not("concepto", "is", null)
      .neq("concepto", "")
      .order("fecha", { ascending: true })

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

    // Resumen por tipo, lo que más se necesita para decidir qué regla escribir
    const tipos = [...porTipo.entries()]
      .map(([tipo, v]) => ({ tipo, movimientos: v.total, conRegla: v.conRegla }))
      .sort((a, b) => Number(a.conRegla) - Number(b.conRegla) || b.movimientos - a.movimientos)

    if (!aplicar) {
      return NextResponse.json({
        ok: true,
        modo: "seco",
        message: cambios.length === 0
          ? "Nada que cambiar: el desglose guardado ya coincide con lo que dan las reglas actuales."
          : `${cambios.length} movimiento(s) cambiarían. Nada se modificó todavía.`,
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
      message: `${aplicados} movimiento(s) re-parseados`
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
 * Devuelve qué tipos de movimiento hay y cuáles no tienen regla propia. Lo usa la alerta.
 */
export async function GET(req: Request) {
  try {
    const cuenta = new URL(req.url).searchParams.get("cuenta") ?? ""
    const cfg = CUENTAS[cuenta]
    if (!cfg) return NextResponse.json({ error: `Cuenta no soportada: ${cuenta}` }, { status: 400 })

    const db = cfg.schema === "public" ? supabase : supabase.schema(cfg.schema)
    const mapaReglas = await cargarReglasParseo(supabase, cuenta)

    const { data, error } = await db.from(cuenta).select("concepto, grupo_de_conceptos")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Un ejemplo por tipo **y por forma**, tenga regla o no.
    //
    // ⚠️ Antes se guardaba el PRIMER movimiento de cada tipo y se lo mostraba como si fuera
    // representativo. No lo es: un tipo puede llegar con formas distintas, y una regla escrita
    // mirando una de ellas falla en las otras sin avisar (PENDIENTES § A-BUG-17). Ahora se
    // agrupa además por firma, así la pantalla puede mostrar TODAS las formas.
    const porTipo = new Map<string, {
      n: number; conRegla: boolean
      formas: Map<string, { n: number; ejemplo: string }>
    }>()
    let sinDesglosar = 0

    for (const m of (data ?? []) as any[]) {
      const tipo = tipoDeMovimiento(m.concepto)
      if (!tipo) continue
      const conRegla = tieneReglaPropia(m.concepto, mapaReglas)
      if (!porTipo.has(tipo)) porTipo.set(tipo, { n: 0, conRegla, formas: new Map() })
      const t = porTipo.get(tipo)!
      t.n++

      const lineas = splitMovimiento(String(m.concepto))
      const firma = firmaDeMovimiento(lineas)
      const f = t.formas.get(firma)
      t.formas.set(firma, { n: (f?.n ?? 0) + 1, ejemplo: f?.ejemplo ?? String(m.concepto) })

      if (!conRegla) sinDesglosar++
    }

    const tipos = [...porTipo.entries()]
      .map(([tipo, v]) => {
        // Las formas van ordenadas por cantidad: la mayoritaria manda como ejemplo por defecto
        const formatos = [...v.formas.entries()]
          .map(([firma, f]) => ({
            firma,
            lineas: lineasDeFirma(firma),
            movimientos: f.n,
            texto: splitMovimiento(f.ejemplo),
          }))
          .sort((a, b) => b.movimientos - a.movimientos)

        return {
          tipo,
          movimientos: v.n,
          conRegla: v.conRegla,
          /** Ejemplo de la forma mayoritaria. Se mantiene el nombre para no romper consumidores. */
          lineas: formatos[0]?.texto ?? [],
          /** Todas las formas del tipo. `length > 1` = ojo con las reglas por número de línea. */
          formatos,
        }
      })
      .sort((a, b) => b.movimientos - a.movimientos)

    return NextResponse.json({
      ok: true,
      cuenta,
      totalMovimientos: data?.length ?? 0,
      sinDesglosar,
      /** Todos los tipos presentes, con ejemplo. Lo usa el configurador. */
      tipos,
      /** Sólo los que no tienen regla. Lo usa la alerta de Principal — no cambiar la forma. */
      tiposSinRegla: tipos.filter(t => !t.conRegla).map(({ tipo, movimientos, lineas }) => ({ tipo, movimientos, lineas })),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
