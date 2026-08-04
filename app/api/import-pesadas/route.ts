import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Conversión IDV → caravana_oficial ───────────────────────────────────────
// IDV ejemplo: 32010012326455 (14 dígitos)
// Resultado:  "032 010012326455" (padded a 15, espacio tras posición 3)

function idvACaravana(idv: any): string | null {
  if (idv === null || idv === undefined || idv === '') return null
  const digits = String(Math.round(Number(String(idv).replace(/\D/g, '') || '0'))).replace(/\D/g, '')
  if (!digits || digits === '0') return null
  const padded = digits.padStart(15, '0')
  return `${padded.slice(0, 3)} ${padded.slice(3)}`
}

// ─── Detección de fecha desde valor Excel ────────────────────────────────────
//
// ⚠️ Un "3/8" en una planilla NO SE PUEDE resolver con certeza. Hay dos fuentes y pueden
// contradecirse:
//
//   · el SERIAL (el número que Excel guardó): fecha absoluta, sin ambigüedad — pero es lo que
//     Excel *interpretó* al tipear, que puede no ser lo que el usuario quiso si la planilla
//     estaba en locale US;
//   · el TEXTO MOSTRADO (`.w`): conserva el orden de dígitos, pero ese orden depende del
//     FORMATO de la celda, que puede ser m/d aunque el dato esté bien.
//
// Las dos fallas ya pasaron, y en direcciones opuestas:
//   · 2026-07: US Excel guardó "05/06" (5 de junio) como May 6 → el serial mentía.
//   · 2026-08-03: el usuario cargó 3/8 (agosto), el serial decía Aug 3 y el formato lo mostraba
//     "8/3" → leerlo como dd/mm lo mandó a MARZO. **176 pesadas entraron con fecha equivocada.**
//
// Por eso ya no se adivina: se calculan **las dos lecturas**, se propone el serial (que es la
// fecha absoluta) y, **si difieren, la otra viaja como alternativa** para que el usuario elija.
// Y en cualquier caso la fecha es EDITABLE antes de confirmar — una fecha mal detectada se
// multiplica por 176 filas en silencio, y eso no lo arregla ninguna heurística.

interface FechaDetectada {
  fecha: string
  /** La otra lectura posible, cuando las dos fuentes no coinciden. */
  alternativa: string | null
  /** De dónde salió la propuesta, para poder mostrarlo. */
  origen: 'serial' | 'texto'
  /** El texto tal como lo mostraba la celda. */
  texto: string | null
}

/** El texto de la celda leído como dd/mm (es-AR). Si el mes es imposible (>12), se da vuelta. */
function fechaDesdeTexto(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return null
  let d = parseInt(m[1], 10)
  let mo = parseInt(m[2], 10)
  let y = parseInt(m[3], 10)
  if (y < 100) y += 2000
  if (mo > 12 && d <= 12) { const tmp = d; d = mo; mo = tmp }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseFecha(val: any, texto?: string): FechaDetectada | null {
  const t = (texto ?? (typeof val === 'string' ? val : '')).trim()

  // YYYY-MM-DD no tiene ambigüedad posible.
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return { fecha: val, alternativa: null, origen: 'texto', texto: val }
  }

  const porTexto = t ? fechaDesdeTexto(t) : null

  // El serial es la fecha ABSOLUTA que guardó Excel: manda sobre cómo la muestra el formato.
  let porSerial: string | null = null
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) porSerial = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }

  // ⚠️ El DEFAULT es día/mes/año — lo fijó el usuario (2026-08-03): *"para el tema de pesadas por
  // default es día mes año"*. Así que cuando las dos fuentes difieren se propone la lectura dd/mm
  // y el serial queda como alternativa, no al revés. Es una regla del negocio, no una heurística:
  // las planillas de pesada las arma él y las escribe en es-AR.
  if (porTexto && porSerial && porTexto !== porSerial) {
    return { fecha: porTexto, alternativa: porSerial, origen: 'texto', texto: t || null }
  }
  if (porSerial) {
    return { fecha: porSerial, alternativa: null, origen: 'serial', texto: t || null }
  }
  if (porTexto) {
    // Sin serial: la otra lectura es la inversa (m/d), si es posible.
    const [y, mo, d] = porTexto.split('-').map(Number)
    const inversa = d <= 12 && mo !== d
      ? `${y}-${String(d).padStart(2, '0')}-${String(mo).padStart(2, '0')}`
      : null
    return { fecha: porTexto, alternativa: inversa, origen: 'texto', texto: t || null }
  }
  return null
}

// ─── POST /api/import-pesadas?accion=analizar  (FormData con archivo) ────────
// ─── POST /api/import-pesadas?accion=confirmar (JSON con decisiones)  ────────

export async function POST(request: Request) {
  const url = new URL(request.url)
  const accion = url.searchParams.get('accion') ?? 'analizar'

  if (accion === 'analizar') return handleAnalizar(request)
  if (accion === 'confirmar') return handleConfirmar(request)
  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}

// ─── ANALIZAR ─────────────────────────────────────────────────────────────────
async function handleAnalizar(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
    // 2do pase formateado (raw:false) → da el TEXTO MOSTRADO de la celda de fecha (`.w`),
    // que conserva el orden de dígitos que el usuario tipeó. Se usa SOLO para la fecha
    // (peso/IDV se leen de `rows` raw para no romper números grandes/notación científica).
    const rowsFmt: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // Detectar fechas: debe haber UNA sola por archivo. Si hay distintas, rechazar.
    const fechasUnicas = new Set<string>()
    let deteccion: FechaDetectada | null = null
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowFmt = rowsFmt[i] ?? {}
      const rawVal = row['Fecha'] ?? row['fecha'] ?? row['FECHA']
      const txtVal = rowFmt['Fecha'] ?? rowFmt['fecha'] ?? rowFmt['FECHA']
      const f = parseFecha(rawVal, typeof txtVal === 'string' ? txtVal : undefined)
      if (f) { fechasUnicas.add(f.fecha); deteccion ??= f }
    }
    if (fechasUnicas.size === 0) {
      return NextResponse.json({ error: 'No se pudo detectar la fecha de pesada. Verificá que exista una columna "Fecha".' }, { status: 400 })
    }
    if (fechasUnicas.size > 1) {
      const lista = [...fechasUnicas].sort().map(f => f.split('-').reverse().join('/')).join(', ')
      return NextResponse.json({
        error: `El archivo tiene fechas de pesada distintas (${lista}). Debe haber una sola fecha por archivo: separá las pesadas en un archivo por fecha.`,
      }, { status: 400 })
    }
    const fechaDetectada = [...fechasUnicas][0]

    // Clasificar filas. Cada fila se identifica por:
    //  - columna "Caravana" (no oficial: CUT/Descarte, toros…) → matchea TEXTO EXACTO contra
    //    caravana_oficial o caravana_interna. Tiene prioridad si está presente.
    //  - columna "IDV" (numérica) → se convierte al formato caravana_oficial (15 díg) como antes.
    const sinId: number[] = []
    type Item = { fila: number; tipo: 'idv' | 'caravana'; id_original: string; match: string; peso: number }
    const items: Item[] = []

    rows.forEach((row, idx) => {
      const pesoRaw = row['Peso'] ?? row['peso'] ?? row['PESO']
      const peso = parseFloat(String(pesoRaw ?? '').replace(',', '.'))
      if (!peso || isNaN(peso) || peso <= 0) return  // fila sin peso válido

      const caravanaRaw = row['Caravana'] ?? row['caravana'] ?? row['CARAVANA']
      const caravanaTxt = caravanaRaw == null ? '' : String(caravanaRaw).trim()
      if (caravanaTxt) {
        items.push({ fila: idx + 1, tipo: 'caravana', id_original: caravanaTxt, match: caravanaTxt, peso })
        return
      }

      const idvRaw = row['IDV'] ?? row['idv'] ?? row['Idv']
      const caravana = idvACaravana(idvRaw)
      if (!caravana) {
        sinId.push(idx + 1)
        return
      }
      items.push({ fila: idx + 1, tipo: 'idv', id_original: String(idvRaw), match: caravana, peso })
    })

    // Valores a buscar en la BD
    const oficialesIdv = [...new Set(items.filter(i => i.tipo === 'idv').map(i => i.match))]
    const rawsCaravana = [...new Set(items.filter(i => i.tipo === 'caravana').map(i => i.match))]

    // Query 1: por caravana_oficial (IDV convertido + caravanas no oficiales cargadas en oficial)
    const { data: porOficial } = await supabase
      .schema('productivo')
      .from('terneros')
      .select('id, caravana_oficial, caravana_interna, sexo, pelo')
      .in('caravana_oficial', [...oficialesIdv, ...rawsCaravana])
      .eq('activo', true)

    // Query 2: por caravana_interna (caravanas no oficiales cargadas en interna, ej. toros)
    const { data: porInterna } = rawsCaravana.length
      ? await supabase
          .schema('productivo')
          .from('terneros')
          .select('id, caravana_oficial, caravana_interna, sexo, pelo')
          .in('caravana_interna', rawsCaravana)
          .eq('activo', true)
      : { data: [] as any[] }

    const mapaOficial = new Map<string, any[]>()
    ;(porOficial ?? []).forEach(t => {
      const lista = mapaOficial.get(t.caravana_oficial) ?? []; lista.push(t); mapaOficial.set(t.caravana_oficial, lista)
    })
    const mapaInterna = new Map<string, any[]>()
    ;(porInterna ?? []).forEach(t => {
      if (!t.caravana_interna) return
      const lista = mapaInterna.get(t.caravana_interna) ?? []; lista.push(t); mapaInterna.set(t.caravana_interna, lista)
    })

    const ok: any[] = []
    const no_encontradas: any[] = []
    const duplicadas: any[] = []

    items.forEach(item => {
      // idv: solo caravana_oficial. caravana: caravana_oficial O caravana_interna (dedup por id).
      let encontrados: any[]
      if (item.tipo === 'idv') {
        encontrados = mapaOficial.get(item.match) ?? []
      } else {
        const porO = mapaOficial.get(item.match) ?? []
        const porI = mapaInterna.get(item.match) ?? []
        const vistos = new Set<string>()
        encontrados = [...porO, ...porI].filter(t => (vistos.has(t.id) ? false : (vistos.add(t.id), true)))
      }

      const base = { idv: item.id_original, caravana_oficial: item.match, peso: item.peso }
      if (encontrados.length === 1) ok.push({ ...base, ternero_id: encontrados[0].id })
      else if (encontrados.length > 1) duplicadas.push({ ...base, terneros: encontrados })
      else no_encontradas.push(base)
    })

    return NextResponse.json({
      fecha: fechaDetectada,
      // La otra lectura posible y de dónde salió la propuesta. La UI las muestra para que la
      // fecha se confirme a ojo en vez de darse por buena: es el dato que se multiplica por
      // todas las filas del archivo.
      fecha_alternativa: deteccion?.alternativa ?? null,
      fecha_origen: deteccion?.origen ?? null,
      fecha_texto: deteccion?.texto ?? null,
      sin_idv: sinId.length,
      total_con_idv: items.length,
      ok,
      no_encontradas,
      duplicadas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── CONFIRMAR ────────────────────────────────────────────────────────────────
// Body esperado:
// {
//   fecha: string,
//   rows_ok: Array<{ ternero_id, caravana_oficial, peso }>,
//   no_encontradas_decisiones: Array<{
//     caravana_idv: string, caravana_oficial: string, peso: number,
//     accion: 'sin_vincular' | 'crear_nuevo' | 'ignorar'
//   }>,
//   duplicadas_decisiones: Array<{
//     caravana_idv: string, ternero_id_elegido: string, peso: number
//   }>
// }

async function handleConfirmar(request: Request) {
  try {
    const body = await request.json()
    const { fecha, rows_ok, no_encontradas_decisiones, duplicadas_decisiones } = body

    // La fecha se graba en TODAS las filas del archivo: si viene mal, el error se multiplica en
    // silencio. Se valida acá también y no sólo en la UI, que es la que se puede saltear.
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Falta la fecha de pesada o tiene un formato inválido.' }, { status: 400 })
    }

    let insertadas = 0
    const errores: string[] = []

    // ── Pesadas directas (coincidencia exacta) ────────────────────────────
    for (const row of (rows_ok ?? [])) {
      const { error } = await supabase
        .schema('productivo')
        .from('pesadas_terneros')
        .insert({
          ternero_id: row.ternero_id,
          fecha,
          peso_kg: row.peso,
        })
      if (error) errores.push(`Caravana ${row.caravana_oficial}: ${error.message}`)
      else insertadas++
    }

    // ── Decisiones sobre no encontradas ──────────────────────────────────
    for (const dec of (no_encontradas_decisiones ?? [])) {
      if (dec.accion === 'ignorar') continue

      if (dec.accion === 'sin_vincular') {
        const { error } = await supabase
          .schema('productivo')
          .from('pesadas_terneros')
          .insert({
            ternero_id: null,
            caravana_idv: dec.caravana_idv,
            fecha,
            peso_kg: dec.peso,
          })
        if (error) errores.push(`IDV ${dec.caravana_idv} (sin vincular): ${error.message}`)
        else insertadas++
      } else if (dec.accion === 'crear_nuevo') {
        // Crear ternero mínimo con solo caravana_oficial, luego registrar pesada
        const { data: nuevoTernero, error: errT } = await supabase
          .schema('productivo')
          .from('terneros')
          .insert({ caravana_oficial: dec.caravana_oficial })
          .select('id')
          .single()

        if (errT) {
          errores.push(`Crear ternero ${dec.caravana_idv}: ${errT.message}`)
          continue
        }

        const { error: errP } = await supabase
          .schema('productivo')
          .from('pesadas_terneros')
          .insert({
            ternero_id: nuevoTernero.id,
            caravana_idv: dec.caravana_idv,
            fecha,
            peso_kg: dec.peso,
          })
        if (errP) errores.push(`Pesada ternero nuevo ${dec.caravana_idv}: ${errP.message}`)
        else insertadas++
      }
    }

    // ── Decisiones sobre duplicados ───────────────────────────────────────
    for (const dec of (duplicadas_decisiones ?? [])) {
      if (!dec.ternero_id_elegido) continue
      const { error } = await supabase
        .schema('productivo')
        .from('pesadas_terneros')
        .insert({
          ternero_id: dec.ternero_id_elegido,
          caravana_idv: dec.caravana_idv,
          fecha,
          peso_kg: dec.peso,
        })
      if (error) errores.push(`IDV ${dec.caravana_idv} (dup. resuelto): ${error.message}`)
      else insertadas++
    }

    return NextResponse.json({ insertadas, errores })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
