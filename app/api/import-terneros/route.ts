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
  // También aceptar nombres completos por si viene de otra fuente
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
  const s = String(val).trim()
  return PELO_MAP[s] ?? null
}

function normalizarSexo(val: any): string | null {
  if (!val) return null
  const s = String(val).trim()
  return SEXO_MAP[s] ?? null
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
      actualizados: 0,
      omitidos: 0,
      errores: [] as string[],
    }

    for (const row of rows) {
      resultados.procesados++

      // ── Leer campos del Excel (acepta variantes de nombre de columna) ───────
      const caravanaOficial = normalizarCaravana(
        row['Carav_Oficial'] ?? row['Caravana Oficial'] ?? row['Carav Of'] ?? row['caravana_oficial']
      )
      const caravanaInterna = normalizarCaravana(
        row['Carav_Nacim'] ?? row['Caravana Interna'] ?? row['Carav Int'] ?? row['caravana_interna']
      )
      const sexo = normalizarSexo(row['Sexo'] ?? row['sexo'])
      const pelo = normalizarPelo(row['Pelo'] ?? row['pelo'])
      const esTorito = normalizarBool(row['Torito'] ?? row['torito'])
      const obs = row['Obs'] ?? row['Observaciones'] ?? row['observaciones'] ?? null
      const observaciones = obs ? String(obs).trim() : null

      // ── Validación: al menos una caravana ───────────────────────────────────
      if (!caravanaOficial && !caravanaInterna) {
        resultados.omitidos++
        resultados.errores.push(`Fila ${resultados.procesados}: sin caravana interna ni oficial — omitida`)
        continue
      }

      try {
        // ── Buscar registro existente (oficial → interna como fallback) ────────
        let existenteId: string | null = null

        if (caravanaOficial) {
          const { data } = await supabase
            .schema('productivo')
            .from('terneros')
            .select('id')
            .eq('caravana_oficial', caravanaOficial)
            .maybeSingle()
          if (data) existenteId = data.id
        }

        if (!existenteId && caravanaInterna) {
          const { data } = await supabase
            .schema('productivo')
            .from('terneros')
            .select('id')
            .eq('caravana_interna', caravanaInterna)
            .maybeSingle()
          if (data) existenteId = data.id
        }

        // ── Armar payload — solo campos con valor ─────────────────────────────
        const payload: Record<string, any> = {}
        if (caravanaOficial !== null) payload.caravana_oficial = caravanaOficial
        if (caravanaInterna !== null) payload.caravana_interna = caravanaInterna
        if (sexo !== null) payload.sexo = sexo
        if (pelo !== null) payload.pelo = pelo
        if (esTorito) payload.es_torito = true   // solo sobreescribir si viene en true
        if (observaciones) payload.observaciones = observaciones

        // ── Upsert ────────────────────────────────────────────────────────────
        if (existenteId) {
          const { error } = await supabase
            .schema('productivo')
            .from('terneros')
            .update(payload)
            .eq('id', existenteId)
          if (error) throw error
          resultados.actualizados++
        } else {
          const { error } = await supabase
            .schema('productivo')
            .from('terneros')
            .insert(payload)
          if (error) throw error
          resultados.insertados++
        }
      } catch (err: any) {
        resultados.errores.push(
          `Fila ${resultados.procesados} (int:${caravanaInterna ?? '-'} / of:${caravanaOficial ?? '-'}): ${err.message}`
        )
      }
    }

    return NextResponse.json(resultados)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
