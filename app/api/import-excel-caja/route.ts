import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { exigirCuentaExtracto } from "@/lib/auth/guard-recurso"
import { analizarCaja, cajaDeHoja, descripcionDeCaja, detalleDeCaja, leerHojaCaja, notaDeCaja, NOMBRE_CAJA,
  type AnalisisCaja, type ExistenteCaja, type FilaAnalizada, type FilaCaja, type TablaCaja } from "@/lib/extractos/caja-excel"

/**
 * 💵 Importar el Excel de cajas de AMS (A-FEAT-1585, JMS 15/11). La lógica vive en `lib/extractos/caja-excel.ts` (pura, con casos);
 * esta ruta lee el archivo, trae lo ya cargado y escribe.
 *
 * - `modo=previa` → NO escribe nada: devuelve qué cargaría en cada caja (nuevos, ya estaban, posibles repetidos, anotados tarde,
 *   cruzan el cierre, cambiados o borrados, control de la cadena del Excel y saldos por fecha).
 * - `modo=cargar` → escribe sólo los nuevos. Frena si la cadena de saldos del Excel no cierra (salvo `forzar`).
 * - `alcance=todas` → todas las hojas del archivo que son una caja (se reconocen por el nombre); `esta` → sólo la caja elegida.
 * - `historico=true` + `desde=AAAA-MM-DD` → la carga inicial: arranca del saldo a esa fecha, entra «histórico», con el renglón
 *   «Saldo al …» y la marca `[carga inicial cajas]` en la nota (el deshacer borra sólo eso).
 */

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const SCHEMA = "msa"
const MARCA_INICIAL = "[carga inicial cajas]"
const TABLAS: TablaCaja[] = ["caja_general", "caja_ams", "caja_sigot"]
const LISTA = 40

const fichaCorta = (f: FilaCaja | FilaAnalizada) => ({ fila: f.fila, fecha: f.fecha, concepto: f.concepto, cat: f.cat, comp: f.comp, salida: f.salida, entrada: f.entrada, saldo: f.saldo,
  ...("difCadena" in f ? { difCadena: f.difCadena, yaEsta: f.yaEsta, textoDistinto: !!f.textoDistinto } : {}) })

function resumen(hoja: string, a: AnalisisCaja, sinFecha: { fila: number; concepto: string; importe: number }[]) {
  return {
    hoja, tabla: a.tabla, caja: NOMBRE_CAJA[a.tabla], corte: a.corte ?? null,
    renglones: a.filas.length, nuevos: a.aCargar.length, yaEstaban: a.yaEstaban,
    yaEstabanConOtroTexto: a.filas.filter(f => f.textoDistinto).map(fichaCorta),
    posiblesRepetidos: a.posiblesRepetidos.slice(0, LISTA).map(fichaCorta), nPosiblesRepetidos: a.posiblesRepetidos.length,
    anotadosTarde: a.anotadosTarde.slice(0, LISTA).map(fichaCorta), nAnotadosTarde: a.anotadosTarde.length,
    cruzanCierre: a.cruzanCierre.map(fichaCorta),
    antesDelCorteConFechaPosterior: a.antesDelCorteConFechaPosterior.map(fichaCorta),
    difsCadena: a.difsCadena.slice(0, LISTA).map(fichaCorta), nDifsCadena: a.difsCadena.length,
    cambiadosOBorrados: a.cambiadosOBorrados.slice(0, LISTA), nCambiadosOBorrados: a.cambiadosOBorrados.length,
    sinFecha, saldoFinalExcel: a.saldoFinalExcel, saldosPorFecha: a.saldosPorFecha,
    muestra: a.aCargar.slice(0, 5).map(f => ({ ...fichaCorta(f), descripcion: descripcionDeCaja(f), detalle: detalleDeCaja(f) })),
  }
}

export async function POST(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  try {
    const fd = await req.formData()
    const file = fd.get("file") as File | null
    const tabla = String(fd.get("tabla") ?? "").trim() as TablaCaja
    const alcance = String(fd.get("alcance") ?? "esta") === "todas" ? "todas" : "esta"
    const modo = String(fd.get("modo") ?? "previa") === "cargar" ? "cargar" : "previa"
    const historico = String(fd.get("historico") ?? "") === "true"
    const desde = String(fd.get("desde") ?? "").trim() || undefined
    const forzar = String(fd.get("forzar") ?? "") === "true"
    if (!file) return NextResponse.json({ ok: false, message: "Falta el archivo" }, { status: 400 })
    if (!TABLAS.includes(tabla)) return NextResponse.json({ ok: false, message: `Caja inválida: ${tabla}` }, { status: 400 })
    if (historico && !desde) return NextResponse.json({ ok: false, message: "La carga inicial necesita la fecha del saldo de arranque (por ejemplo 30/06/2025)." }, { status: 400 })
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return NextResponse.json({ ok: false, message: "La fecha «desde» tiene que ser AAAA-MM-DD" }, { status: 400 })

    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false })
    // qué hojas: las que son una caja (por nombre); si el archivo tiene una sola hoja sin nombre de caja, va a la caja elegida
    let hojas = wb.SheetNames.map(n => ({ hoja: n, tabla: cajaDeHoja(n) })).filter((h): h is { hoja: string; tabla: TablaCaja } => !!h.tabla)
    if (!hojas.length && wb.SheetNames.length === 1) hojas = [{ hoja: wb.SheetNames[0], tabla }]
    if (alcance === "esta") hojas = hojas.filter(h => h.tabla === tabla)
    if (!hojas.length) return NextResponse.json({ ok: false, message: alcance === "esta"
      ? `El archivo no tiene una hoja de ${NOMBRE_CAJA[tabla]} (hojas: ${wb.SheetNames.join(", ")}).` : `Ninguna hoja del archivo es una caja (hojas: ${wb.SheetNames.join(", ")}).` }, { status: 400 })
    for (const h of hojas) {
      const ok = await exigirCuentaExtracto(h.tabla)
      if (!ok.ok) return NextResponse.json({ ok: false, message: `${NOMBRE_CAJA[h.tabla]}: ${ok.motivo}` }, { status: ok.status })
    }

    const client = supabase.schema(SCHEMA)
    const analisis: { hoja: string; a: AnalisisCaja; sinFecha: { fila: number; concepto: string; importe: number }[]; existentes: ExistenteCaja[] }[] = []
    for (const h of hojas) {
      const leida = leerHojaCaja(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[h.hoja], { header: 1, raw: true, defval: null }))
      if (leida.error) return NextResponse.json({ ok: false, message: `Hoja «${h.hoja}»: ${leida.error}` }, { status: 400 })
      const existentes: ExistenteCaja[] = []
      for (let d = 0; ; d += 1000) {
        const { data, error } = await client.from(h.tabla).select("id, fecha, descripcion, detalle, debitos, creditos").order("id").range(d, d + 999)
        if (error) return NextResponse.json({ ok: false, message: `No se pudo leer ${NOMBRE_CAJA[h.tabla]}: ${error.message}` }, { status: 500 })
        existentes.push(...((data ?? []) as ExistenteCaja[])); if (!data || data.length < 1000) break
      }
      // Las subidas de cada mes arrancan del «Saldo al …» de la carga inicial (si no, traería todo el Excel desde el principio)
      const saldoInicial = existentes.filter(e => /^saldo al /i.test(String(e.descripcion ?? ""))).map(e => e.fecha).sort()[0]
      if (!historico && !saldoInicial) return NextResponse.json({ ok: false, message: `${NOMBRE_CAJA[h.tabla]} todavía no tiene su carga inicial: hacela primero tildando «Carga inicial (histórico)» con la fecha del saldo de arranque.` }, { status: 400 })
      const a = analizarCaja(h.tabla, leida.filas, existentes, { desde: historico ? desde : saldoInicial })
      if (historico && desde && !a.corte) return NextResponse.json({ ok: false, message: `Hoja «${h.hoja}»: no encontré el saldo al ${desde} (ningún renglón de esa fecha o anterior seguido de renglones posteriores).` }, { status: 400 })
      analisis.push({ hoja: h.hoja, a, sinFecha: leida.sinFecha, existentes })
    }
    const cajas = analisis.map(x => resumen(x.hoja, x.a, x.sinFecha))
    if (modo === "previa") {
      const nuevos = cajas.reduce((t, c) => t + c.nuevos, 0)
      return NextResponse.json({ ok: true, modo, cajas, message: `Revisión (no se guardó nada): ${nuevos} renglón(es) nuevo(s) en ${cajas.length} caja(s).` })
    }

    const conDifs = cajas.filter(c => c.nDifsCadena > 0)
    if (conDifs.length && !forzar) return NextResponse.json({ ok: false, modo, cajas,
      message: `El saldo del Excel no sigue renglón a renglón en ${conDifs.map(c => `${c.caja} (${c.nDifsCadena})`).join(", ")}. No se cargó nada: revisá el Excel o tildá «Cargar igual».` })

    const cargados: Record<string, number> = {}
    for (const { a, existentes } of analisis) {
      const estado = historico ? "historico" : "pendiente"
      const marca = historico ? MARCA_INICIAL : undefined
      const { data: maxO } = await client.from(a.tabla).select("orden").order("orden", { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
      let orden = Number(maxO?.orden ?? 0)
      const filas: Record<string, unknown>[] = []
      const yaHaySaldo = a.corte && existentes.some(e => e.fecha === a.corte!.fecha && /^saldo al /i.test(String(e.descripcion ?? "")))
      if (historico && a.corte && !yaHaySaldo) {
        const [y, m, d] = a.corte.fecha.split("-")
        filas.push({ fecha: a.corte.fecha, descripcion: `Saldo al ${d}/${m}/${y}`, detalle: null, debitos: 0, creditos: 0, saldo: a.corte.saldo, control: 0,
          categ: null, contable: null, interno: null, centro_de_costo: null, cuenta: a.tabla, orden: a.corte.fila, estado,
          nota_operador: `💵 ${NOMBRE_CAJA[a.tabla]} (Excel de AMS, fila ${a.corte.fila}) — saldo inicial · ${MARCA_INICIAL}` })
      }
      for (const f of a.aCargar) {
        filas.push({ fecha: f.fecha, descripcion: descripcionDeCaja(f), detalle: detalleDeCaja(f) || null, debitos: f.salida, creditos: f.entrada,
          saldo: f.saldo, control: f.difCadena, categ: null, contable: null, interno: null, centro_de_costo: null, cuenta: a.tabla,
          // carga inicial: el orden es la fila del Excel (el de AMS); después, a continuación de lo que hay
          orden: historico ? f.fila : ++orden, estado, nota_operador: notaDeCaja(a.tabla, f, marca) })
      }
      for (let i = 0; i < filas.length; i += 500) {
        const { error } = await client.from(a.tabla).insert(filas.slice(i, i + 500))
        if (error) return NextResponse.json({ ok: false, modo, cajas, cargados,
          message: `Error al guardar en ${NOMBRE_CAJA[a.tabla]} (se guardaron ${Object.entries(cargados).map(([k, v]) => `${k}: ${v}`).join(", ") || "nada"} antes): ${error.message}` }, { status: 500 })
      }
      cargados[NOMBRE_CAJA[a.tabla]] = filas.length
    }
    return NextResponse.json({ ok: true, modo, cajas, cargados,
      message: `Cargado: ${Object.entries(cargados).map(([k, v]) => `${k} ${v}`).join(" · ")}${historico ? " (histórico)" : ""}.` })
  } catch (e: unknown) {
    console.error("Error en import-excel-caja:", e)
    return NextResponse.json({ ok: false, message: `Error inesperado: ${(e as Error)?.message || "desconocido"}` }, { status: 500 })
  }
}
