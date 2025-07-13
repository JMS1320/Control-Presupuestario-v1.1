// ... (importaciones y funciones iguales que antes)

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

    const saldoInicio = ultimos?.[0]?.saldo ?? parseNumber(formData.get("saldo_inicio"))
    const ultimaFecha = ultimos?.[0]?.fecha ?? null
    const ultimoOrden = ultimos?.[0]?.orden ?? 0

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const filtrados = (json as any[]).filter((row) => {
      const fechaStr = parseDate(row["Fecha"])
      if (!fechaStr) return false

      const fecha = new Date(fechaStr)
      fecha.setHours(0, 0, 0, 0)

      return fecha < hoy && (!ultimaFecha || fecha > new Date(ultimaFecha))
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
