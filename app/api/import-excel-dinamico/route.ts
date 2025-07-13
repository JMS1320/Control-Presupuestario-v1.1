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

    if (!file || !tabla) {
      return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 })
    }

    // Obtener último saldo y orden de la tabla destino
    const { data: ultimos, error: errorUltimos } = await supabase
      .from(tabla)
      .select("fecha, saldo, orden")
      .order("fecha", { ascending: false })
      .order("orden", { ascending: false })
      .limit(1)

    const saldoInicio = ultimos?.[0]?.saldo ?? 0
    const ultimaFecha = ultimos?.[0]?.fecha ?? null
    const ultimoOrden = ultimos?.[0]?.orden ?? 0

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)

    const hoy = new Date()
    const filtrados = (json as any[]).filter((row) => {
      const fecha = parseDate(row["Fecha"])
      const fechaDate = fecha ? new Date(fecha) : null
      return (
        fecha &&
        fechaDate < hoy && // excluir fechas futuras y hoy
        (!ultimaFecha || new Date(fecha) > new Date(ultimaFecha)) // excluir fechas previas o iguales
      )
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
        orden: ultimoOrden + index + 1,
        control: diferencia
      }
    })

    const { error: insertError } = await supabase.from(tabla).insert(rows)
    if (insertError) {
      console.error(insertError)
      return NextResponse.json({ error: "Error al insertar en la base de datos." }, { status: 500 })
    }

    return NextResponse.json({ status: "ok", cantidad: rows.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
