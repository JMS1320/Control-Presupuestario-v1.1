import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Mapeos de normalización ─────────────────────────────────────────────────

const PELO_MAP: Record<string, string> = {
  'C': 'Colorado',
  'N': 'Negro',
  'CC': 'Careta Colorado',
  'CN': 'Careta Negro',
  'Colorado': 'Colorado',
  'Negro': 'Negro',
  'Careta Colorado': 'Careta Colorado',
  'Careta Negro': 'Careta Negro',
  'Otros': 'Otros',
}

const SEXO_MAP: Record<string, string> = {
  'M': 'Macho',
  'H': 'Hembra',
  'Macho': 'Macho',
  'Hembra': 'Hembra',
  'MACHO': 'Macho',
  'HEMBRA': 'Hembra',
}

function normalizarPelo(val: any): string | null {
  if (!val) return null
  return PELO_MAP[String(val).trim()] ?? null
}

function normalizarSexo(val: any): string | null {
  if (!val) return null
  return SEXO_MAP[String(val).trim()] ?? null
}

function normalizarCaravana(val: any): string | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 's/c') return null
  return s
}

function normalizarBool(val: any): boolean {
  if (!val) return false
  const s = String(val).trim().toLowerCase()
  return s === 'si' || s === 'sí' || s === 'true' || s === '1' || s === 'yes'
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

    const resultados = {
      procesados: 0,
      insertados: 0,
      omitidos: 0,
      duplicados_en_archivo: [] as string[],   // duplicados dentro del Excel importado
      duplicados_en_bd: [] as string[],         // caravanas que ya existían en BD
      errores: [] as string[],
    }

    // ── Pre-scan: detectar duplicados dentro del propio archivo ──────────────
    const internasArchivo = new Map<string, number[]>()
    const oficialesArchivo = new Map<string, number[]>()

    rows.forEach((row, idx) => {
      const nroFila = idx + 1
      const interna = normalizarCaravana(row['Carav_Nacim'] ?? row['Caravana Interna'] ?? row['Carav Int'] ?? row['caravana_interna'])
      const oficial = normalizarCaravana(row['Carav_Oficial'] ?? row['Caravana Oficial'] ?? row['Carav Of'] ?? row['caravana_oficial'])
      if (interna) {
        const lista = internasArchivo.get(interna) ?? []
        lista.push(nroFila)
        internasArchivo.set(interna, lista)
      }
      if (oficial) {
        const lista = oficialesArchivo.get(oficial) ?? []
        lista.push(nroFila)
        oficialesArchivo.set(oficial, lista)
      }
    })

    for (const [val, filas] of internasArchivo) {
      if (filas.length > 1) {
        resultados.duplicados_en_archivo.push(`Carav. interna ${val} aparece ${filas.length} veces (filas: ${filas.join(', ')})`)
      }
    }
    for (const [val, filas] of oficialesArchivo) {
      if (filas.length > 1) {
        resultados.duplicados_en_archivo.push(`Carav. oficial ${val} aparece ${filas.length} veces (filas: ${filas.join(', ')})`)
      }
    }

    // ── Pre-scan: detectar caravanas que ya existen en BD ────────────────────
    const todasInternas = [...internasArchivo.keys()]
    const todasOficiales = [...oficialesArchivo.keys()]

    if (todasInternas.length > 0) {
      const { data: existentesInt } = await supabase
        .schema('productivo')
        .from('terneros')
        .select('caravana_interna')
        .in('caravana_interna', todasInternas)
      if (existentesInt && existentesInt.length > 0) {
        existentesInt.forEach(r => {
          resultados.duplicados_en_bd.push(`Carav. interna ${r.caravana_interna} ya existe en BD`)
        })
      }
    }

    if (todasOficiales.length > 0) {
      const { data: existentesOf } = await supabase
        .schema('productivo')
        .from('terneros')
        .select('caravana_oficial')
        .in('caravana_oficial', todasOficiales)
      if (existentesOf && existentesOf.length > 0) {
        existentesOf.forEach(r => {
          resultados.duplicados_en_bd.push(`Carav. oficial ${r.caravana_oficial} ya existe en BD`)
        })
      }
    }

    // ── Insertar todas las filas (sin upsert, sin bloquear por duplicados) ───
    for (const row of rows) {
      resultados.procesados++

      const caravanaOficial = normalizarCaravana(
        row['Carav_Oficial'] ?? row['Caravana Oficial'] ?? row['Carav Of'] ?? row['caravana_oficial']
      )
      const caravanaInterna = normalizarCaravana(
        row['Carav_Nacim'] ?? row['Caravana Interna'] ?? row['Carav Int'] ?? row['caravana_interna']
      )

      if (!caravanaOficial && !caravanaInterna) {
        resultados.omitidos++
        continue
      }

      const sexo = normalizarSexo(row['Sexo'] ?? row['sexo'])
      const pelo = normalizarPelo(row['Pelo'] ?? row['pelo'])
      const esTorito = normalizarBool(row['Torito'] ?? row['torito'])
      const obs = row['Obs'] ?? row['Observaciones'] ?? row['observaciones'] ?? null
      const observaciones = obs ? String(obs).trim() : null

      const payload: Record<string, any> = {}
      if (caravanaOficial !== null) payload.caravana_oficial = caravanaOficial
      if (caravanaInterna !== null) payload.caravana_interna = caravanaInterna
      if (sexo !== null) payload.sexo = sexo
      if (pelo !== null) payload.pelo = pelo
      if (esTorito) payload.es_torito = true
      if (observaciones) payload.observaciones = observaciones

      try {
        const { error } = await supabase
          .schema('productivo')
          .from('terneros')
          .insert(payload)
        if (error) throw error
        resultados.insertados++
      } catch (err: any) {
        resultados.errores.push(`Fila ${resultados.procesados}: ${err.message}`)
      }
    }

    return NextResponse.json(resultados)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
