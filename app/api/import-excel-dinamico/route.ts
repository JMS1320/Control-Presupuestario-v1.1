import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseNumber(value: any): number {
  if (typeof value === "string") {
    value = value.replace(/\./g, "").replace(",", ".")
    if (/^\(.*\)$/.test(value)) {
      value = "-" + value.replace(/[()]/g, "")
    }
  }
  const num = Number.parseFloat(value)
  return isNaN(num) ? 0 : num
}

function parseDate(value: any): string | null {
  if (!value) return null
  try {
    let date: Date
    if (typeof value === "number") {
      date = new Date((value - 25569) * 86400 * 1000)
    } else if (typeof value === "string") {
      date = new Date(value)
    } else if (value instanceof Date) {
      date = value
    } else {
      return null
    }
    if (isNaN(date.getTime())) return null
    return date.toISOString().split("T")[0]
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const tabla = (formData.get("tabla") as string)?.toLowerCase()
    const saldoInicio = Number(formData.get("saldo_inicio"))

    if (!file || !tabla || isNaN(saldoInicio)) {
      return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)

    const hoy = new Date()
    const filtrados = (json as any[]).filter((row) => {
      const fecha = parseDate(row["Fecha"])
      return fecha && new Date(fecha) < hoy
    })

    const filasOrdenadas = filtrados.reverse()

    let controlAnterior = saldoInicio
    const rows = filasOrdenadas.map((row, index) => {
      const debitos = parseNumber(row["Débitos"])
      const creditos = parseNumber(row["Créditos"])
      const saldo = parseNumber(row["Saldo"])
      const controlCalculado = controlAnterior + creditos - debitos
      const diferencia = controlCalculado - saldo
      controlAnterior = controlCalculado

      return {
        fecha: parseDate(row["Fecha"]),
        descripcion: row["Descripción"] || null,
        debitos,
        creditos,
        saldo,
        categ: row["CATEG"] || null,
        detalle: row["Detalle"] || null,
        contable: row["Contable"] || null,
        interno: row["Interno"] || null,
        centro_de_costo: row["Centro de Costo"] || null,
        cuenta: row["Cuenta"] || null,
        orden: index + 1,
        control: diferencia
      }
    })

    const { error } = await supabase.from(tabla).insert(rows)
    if (error) throw error

    return NextResponse.json({
      message: "Importación completa",
      cantidad: rows.length
    })
  } catch (error: any) {
    console.error("Error en importación:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
