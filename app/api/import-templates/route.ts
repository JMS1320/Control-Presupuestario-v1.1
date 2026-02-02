import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as Papa from "papaparse"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Convierte números en formato argentino a decimal estándar
 */
function convertirNumeroArgentino(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return valor
  if (typeof valor !== 'string') return 0
  if (valor.trim() === '') return 0

  let textoLimpio = valor.toString().trim()
  textoLimpio = textoLimpio.replace(/\./g, '')  // Quitar puntos de miles
  textoLimpio = textoLimpio.replace(',', '.')   // Cambiar coma decimal a punto

  return parseFloat(textoLimpio) || 0
}

/**
 * Convierte fecha DD/MM/YYYY a YYYY-MM-DD
 */
function convertirFecha(valor: string | null | undefined): string | null {
  if (!valor || valor.trim() === '') return null

  const valorLimpio = valor.trim()

  // Si ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(valorLimpio)) {
    return valorLimpio
  }

  // Formato DD/MM/YYYY
  const partes = valorLimpio.split('/')
  if (partes.length === 3) {
    const [dia, mes, año] = partes
    const añoCompleto = año.length === 2 ? `20${año}` : año
    return `${añoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  return null
}

/**
 * Normaliza CUIT: quita guiones
 */
function normalizarCuit(cuit: string | null | undefined): string {
  if (!cuit) return ''
  return cuit.replace(/-/g, '').trim()
}

/**
 * Genera fechas de cuotas basado en patrón
 */
function generarFechasCuotas(
  fechaPrimera: string,
  totalCuotas: number,
  patronCuotas: string
): string[] {
  const fechas: string[] = [fechaPrimera]

  if (totalCuotas <= 1) return fechas

  const [año, mes, dia] = fechaPrimera.split('-').map(Number)
  const patronLower = patronCuotas.toLowerCase()

  // Patrón mensual
  if (patronLower.includes('mensual')) {
    for (let i = 1; i < totalCuotas; i++) {
      const nuevaFecha = new Date(año, mes - 1 + i, dia)
      fechas.push(nuevaFecha.toISOString().split('T')[0])
    }
    return fechas
  }

  // Patrón bimensual
  if (patronLower.includes('bimensual')) {
    for (let i = 1; i < totalCuotas; i++) {
      const nuevaFecha = new Date(año, mes - 1 + (i * 2), dia)
      fechas.push(nuevaFecha.toISOString().split('T')[0])
    }
    return fechas
  }

  // Patrón trimestral o meses específicos (marzo/junio/sept/nov)
  if (patronLower.includes('junio') || patronLower.includes('sept') || patronLower.includes('trimestral')) {
    // Cuotas trimestrales: cada 3 meses
    for (let i = 1; i < totalCuotas; i++) {
      const nuevaFecha = new Date(año, mes - 1 + (i * 3), dia)
      fechas.push(nuevaFecha.toISOString().split('T')[0])
    }
    return fechas
  }

  // Patrón semestral
  if (patronLower.includes('semestral') || patronLower.includes('25/07')) {
    for (let i = 1; i < totalCuotas; i++) {
      const nuevaFecha = new Date(año, mes - 1 + (i * 6), dia)
      fechas.push(nuevaFecha.toISOString().split('T')[0])
    }
    return fechas
  }

  // Default: mensual
  for (let i = 1; i < totalCuotas; i++) {
    const nuevaFecha = new Date(año, mes - 1 + i, dia)
    fechas.push(nuevaFecha.toISOString().split('T')[0])
  }

  return fechas
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const fechaCorteStr = formData.get("fechaCorte") as string // YYYY-MM-DD
    const templateMasterId = formData.get("templateMasterId") as string

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })
    }

    if (!templateMasterId) {
      return NextResponse.json({ error: "Falta templateMasterId" }, { status: 400 })
    }

    const fechaCorte = fechaCorteStr ? new Date(fechaCorteStr) : new Date()

    // Leer archivo CSV
    const texto = await file.text()
    const resultado = Papa.parse(texto, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
    })

    if (resultado.errors.length > 0) {
      console.error('Errores parsing CSV:', resultado.errors)
    }

    const registros = resultado.data as Record<string, string>[]

    let templatesCreados = 0
    let cuotasCreadas = 0
    let cuotasHistoricas = 0
    const errores: string[] = []

    for (const row of registros) {
      try {
        // Mapeo CSV → BD
        const nombreRef = row['Nombre Referencia']?.trim()
        if (!nombreRef) continue // Saltar filas vacías

        const totalCuotas = parseInt(row['Cuotas']) || 0
        const esAbierto = totalCuotas === 0

        // Datos del template
        const templateData = {
          template_master_id: templateMasterId,
          nombre: nombreRef,
          año: row['Año/Campaña']?.trim() || null,
          nombre_quien_cobra: row['Proveedor']?.trim() || null,
          cuit: normalizarCuit(row['CUIT']),
          categ: row['CATEG']?.trim() || null,
          centro_costo: row['Centro Costo']?.trim() || null,
          responsable: row['Resp. Contable']?.trim() || null,
          responsable_interno: row['Resp. Interno']?.trim() || null,
          total_renglones: totalCuotas,
          tipo_fecha: row['Tipo Fecha']?.trim() || 'Estimada',
          activo: row['Activo']?.toLowerCase() === 'si' || row['Activo']?.toLowerCase() === 'sí' || row['Activo'] === '1',
          regla_contable: row['Código Contable']?.trim() || null,
          regla_interno: row['Código Interno']?.trim() || null,
          alertas: row['Alertas']?.trim() || null,
          observaciones: row['Atencion']?.trim() || null,
          cuenta_agrupadora: row['Cuenta Agrupadora']?.trim() || null,
          grupo_impuesto_id: row['Grupo Impuesto id']?.trim() || null,
          tipo_template: esAbierto ? 'abierto' : 'fijo',
        }

        // Insertar template
        const { data: template, error: errorTemplate } = await supabase
          .from('egresos_sin_factura')
          .insert(templateData)
          .select('id')
          .single()

        if (errorTemplate) {
          errores.push(`Template "${nombreRef}": ${errorTemplate.message}`)
          continue
        }

        templatesCreados++

        // Si es template abierto o sin cuotas, no generar cuotas
        if (esAbierto || totalCuotas === 0) continue

        // Generar cuotas
        const fechaPrimera = convertirFecha(row['Fecha 1ra Cuota'])
        const montoPorCuota = convertirNumeroArgentino(row[' Monto por Cuota '] || row['Monto por Cuota'])
        const patronCuotas = row['Completar Cuotas'] || 'Mensual'
        const estadoDefault = row['Estado']?.toLowerCase() || 'pendiente'

        if (!fechaPrimera) {
          errores.push(`Template "${nombreRef}": Sin fecha primera cuota`)
          continue
        }

        const fechasCuotas = generarFechasCuotas(fechaPrimera, totalCuotas, patronCuotas)

        for (let i = 0; i < fechasCuotas.length; i++) {
          const fechaCuota = new Date(fechasCuotas[i])
          const esHistorica = fechaCuota < fechaCorte

          const cuotaData = {
            egreso_id: template.id,
            numero_cuota: i + 1,
            fecha_vencimiento: fechasCuotas[i],
            fecha_estimada: fechasCuotas[i],
            monto: esHistorica ? 0 : montoPorCuota,
            estado: esHistorica ? 'conciliado' : estadoDefault,
          }

          const { error: errorCuota } = await supabase
            .from('cuotas_egresos_sin_factura')
            .insert(cuotaData)

          if (errorCuota) {
            errores.push(`Cuota ${i + 1} de "${nombreRef}": ${errorCuota.message}`)
          } else {
            cuotasCreadas++
            if (esHistorica) cuotasHistoricas++
          }
        }

      } catch (e) {
        const mensaje = e instanceof Error ? e.message : 'Error desconocido'
        errores.push(`Error procesando fila: ${mensaje}`)
      }
    }

    return NextResponse.json({
      success: true,
      resumen: {
        templatesCreados,
        cuotasCreadas,
        cuotasHistoricas,
        totalErrores: errores.length,
      },
      errores: errores.slice(0, 20), // Limitar errores mostrados
    })

  } catch (error) {
    console.error('Error en import-templates:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
