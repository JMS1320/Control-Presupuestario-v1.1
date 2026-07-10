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
// PROBLEMA: si la celda es una fecha de Excel guardada con formato US (m/d), un
// "05/06" (5 de junio en es-AR) se guarda como May 6 y se leía mal. FIX: se prioriza
// el TEXTO MOSTRADO de la celda (arg `texto` = `.w`) y se interpreta SIEMPRE como
// dd/mm (es-AR); solo si el mes es imposible (>12) se asume que venía m/d y se da vuelta.
// El texto mostrado conserva el mismo orden de dígitos que el usuario tipeó, así que
// leerlo como dd/mm recupera su intención tanto en Excel argentino como US.
// Fallback: si solo hay serial numérico sin texto, se usa la fecha absoluta del serial.
function parseFecha(val: any, texto?: string): string | null {
  const t = (texto ?? (typeof val === 'string' ? val : '')).trim()
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    let d = parseInt(m[1], 10)
    let mo = parseInt(m[2], 10)
    let y = parseInt(m[3], 10)
    if (y < 100) y += 2000
    // es-AR: default día/mes. Si el mes es imposible (>12) y el día sí podría ser mes, venía m/d → dar vuelta.
    if (mo > 12 && d <= 12) { const tmp = d; d = mo; mo = tmp }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  // YYYY-MM-DD directo
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  // Fallback: serial de Excel (fecha absoluta, sin ambigüedad d/m)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
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
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowFmt = rowsFmt[i] ?? {}
      const rawVal = row['Fecha'] ?? row['fecha'] ?? row['FECHA']
      const txtVal = rowFmt['Fecha'] ?? rowFmt['fecha'] ?? rowFmt['FECHA']
      const f = parseFecha(rawVal, typeof txtVal === 'string' ? txtVal : undefined)
      if (f) fechasUnicas.add(f)
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

    // Clasificar filas
    const sinIdv: number[] = []
    const conIdv: Array<{ fila: number; idv_original: string; caravana_convertida: string; peso: number }> = []

    rows.forEach((row, idx) => {
      const pesoRaw = row['Peso'] ?? row['peso'] ?? row['PESO']
      const peso = parseFloat(String(pesoRaw ?? '').replace(',', '.'))
      if (!peso || isNaN(peso) || peso <= 0) return  // fila sin peso válido

      const idvRaw = row['IDV'] ?? row['idv'] ?? row['Idv']
      const caravana = idvACaravana(idvRaw)

      if (!caravana) {
        sinIdv.push(idx + 1)
        return
      }

      conIdv.push({
        fila: idx + 1,
        idv_original: String(idvRaw),
        caravana_convertida: caravana,
        peso,
      })
    })

    // Buscar todas las caravanas únicas en la BD de una sola vez
    const caravanasUnicas = [...new Set(conIdv.map(r => r.caravana_convertida))]

    const { data: ternerosBD } = await supabase
      .schema('productivo')
      .from('terneros')
      .select('id, caravana_oficial, caravana_interna, sexo, pelo')
      .in('caravana_oficial', caravanasUnicas)
      .eq('activo', true)

    // Mapa caravana_oficial → lista de terneros (puede haber duplicados en BD)
    const mapaCaravana = new Map<string, any[]>()
    ;(ternerosBD ?? []).forEach(t => {
      const lista = mapaCaravana.get(t.caravana_oficial) ?? []
      lista.push(t)
      mapaCaravana.set(t.caravana_oficial, lista)
    })

    const ok: any[] = []
    const no_encontradas: any[] = []
    const duplicadas: any[] = []

    conIdv.forEach(item => {
      const encontrados = mapaCaravana.get(item.caravana_convertida) ?? []
      if (encontrados.length === 1) {
        ok.push({
          idv: item.idv_original,
          caravana_oficial: item.caravana_convertida,
          ternero_id: encontrados[0].id,
          peso: item.peso,
        })
      } else if (encontrados.length > 1) {
        duplicadas.push({
          idv: item.idv_original,
          caravana_oficial: item.caravana_convertida,
          peso: item.peso,
          terneros: encontrados,
        })
      } else {
        no_encontradas.push({
          idv: item.idv_original,
          caravana_oficial: item.caravana_convertida,
          peso: item.peso,
        })
      }
    })

    return NextResponse.json({
      fecha: fechaDetectada,
      sin_idv: sinIdv.length,
      total_con_idv: conIdv.length,
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
