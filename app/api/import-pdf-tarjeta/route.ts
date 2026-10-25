import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { exigirCuentaExtracto } from "@/lib/auth/guard-recurso"
import { parsearResumen, calcularControl, normalizarTextoResumen, type ResumenParsed, type ControlSaldo } from "@/lib/tarjetas/parseo-resumen-pdf"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Forzar runtime Node (no edge) — unpdf/pdfjs necesitan APIs de Node
export const runtime = "nodejs"

// Mapa cuenta → { schema, tabla }
const CUENTAS_VALIDAS: Record<string, { schema: string; tabla: string }> = {
  tarjeta_visa_business_msa: { schema: "msa", tabla: "tarjeta_visa_business" },
  tarjeta_visa_pam: { schema: "pam", tabla: "tarjeta_visa" },
  tarjeta_visa_ma: { schema: "ma", tabla: "tarjeta_visa" },
}


// -----------------------------------------------------------------------------
// Generar Excel de auditoría
// -----------------------------------------------------------------------------

function generarExcelAuditoria(r: ResumenParsed, control: ControlSaldo, cuentaId: string): string {
  const datos: any[][] = []

  datos.push(["RESUMEN TARJETA — AUDITORÍA"])
  datos.push([])
  datos.push(["Cuenta destino", cuentaId])
  datos.push(["Nro Resumen", r.nro_resumen || ""])
  datos.push(["Fecha Cierre", r.fecha_cierre || ""])
  datos.push(["Fecha Vencimiento", r.fecha_vencimiento || ""])
  datos.push([])
  datos.push(["", "PESOS", "DÓLARES"])
  datos.push(["Saldo anterior", r.saldo_anterior_pesos, r.saldo_anterior_usd])
  datos.push(["Suma movimientos detectados", control.suma_pesos, control.suma_usd])
  datos.push(["Total a pagar (PDF)", r.total_a_pagar_pesos, r.total_a_pagar_usd])
  datos.push([
    "Diferencia de control",
    control.diferencia_pesos,
    control.diferencia_usd,
  ])
  datos.push(["Estado del control", control.ok ? "OK" : "ERROR — revisar manualmente"])
  datos.push([])
  datos.push([
    "FECHA",
    "REFERENCIA",
    "DESCRIPCIÓN",
    "CUOTA",
    "COMPROBANTE",
    "PESOS",
    "DÓLARES",
    "TARJETA",
    "TITULAR",
  ])

  for (const m of r.movimientos) {
    datos.push([
      m.fecha,
      m.referencia || "",
      m.descripcion,
      m.cuota || "",
      m.comprobante || "",
      m.pesos,
      m.dolares,
      m.tarjeta.tarjeta_nro || "",
      m.tarjeta.titular || "",
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Auditoría")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buffer).toString("base64")
}

// -----------------------------------------------------------------------------
// Endpoint
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const cuentaId = (formData.get("tabla") as string | null)?.trim() || ""
    // 🏦 A-FEAT-1336: la cuenta tiene que estar habilitada para el rol.
    const cuentaOk = await exigirCuentaExtracto(cuentaId)
    if (!cuentaOk.ok) return NextResponse.json({ ok: false, message: cuentaOk.motivo }, { status: cuentaOk.status })
    const forzar = (formData.get("forzar") as string | null) === "true"
    const peek = (formData.get("peek") as string | null) === "true"  // solo parsear y devolver fecha_cierre (para ordenar multi)

    if (!file) {
      return NextResponse.json({ ok: false, message: "Falta el archivo PDF" }, { status: 400 })
    }
    const config = CUENTAS_VALIDAS[cuentaId]
    if (!config) {
      return NextResponse.json(
        { ok: false, message: `Cuenta inválida: ${cuentaId}. Permitidas: ${Object.keys(CUENTAS_VALIDAS).join(", ")}` },
        { status: 400 }
      )
    }

    // Extraer texto del PDF con unpdf (compatible con Node/serverless — evita el error
    // "DOMMatrix is not defined" que da pdfjs-dist v5 fuera del navegador).
    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(data)
    const extracted = await extractText(pdf, { mergePages: true })
    const texto: string = Array.isArray(extracted.text) ? extracted.text.join("\n") : (extracted.text || "")

    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, message: "El PDF no contiene texto extraíble. ¿Es escaneado / imagen?" },
        { status: 400 }
      )
    }

    const textoNorm = normalizarTextoResumen(texto)

    // Parsear
    const resumen = parsearResumen(textoNorm)
    const control = calcularControl(resumen)

    // Modo peek: solo devolver fecha de cierre + nro (para ordenar varios resúmenes). NO inserta.
    if (peek) {
      return NextResponse.json({
        ok: true,
        peek: true,
        fecha_cierre: resumen.fecha_cierre,
        nro_resumen: resumen.nro_resumen,
        movimientos: resumen.movimientos.length,
        control,
      })
    }

    const excelBase64 = generarExcelAuditoria(resumen, control, cuentaId)

    if (resumen.movimientos.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No se detectaron movimientos en el PDF. Descargá el Excel para revisar.",
        excel_base64: excelBase64,
        resumen: { ...resumen, movimientos: undefined },
        control,
      })
    }

    // Si control NO cuadra y no se forzó → no insertar
    if (!control.ok && !forzar) {
      return NextResponse.json({
        ok: false,
        message: `Control de saldos NO cuadra. Diferencia pesos: ${control.diferencia_pesos}, USD: ${control.diferencia_usd}. Revisá el Excel.`,
        excel_base64: excelBase64,
        resumen: { ...resumen, movimientos: undefined },
        control,
        movimientos_detectados: resumen.movimientos.length,
      })
    }

    // Insertar en BD
    const client = supabase.schema(config.schema)

    // Dedup a nivel RESUMEN (no por movimiento). Cada resumen es un extracto self-contained:
    // un cargo de un mes NUNCA es duplicado de otro mes, aunque coincidan fecha/desc/monto.
    // Lo único duplicable es el resumen entero (mismo nro_resumen importado dos veces).
    if (resumen.nro_resumen) {
      const { data: yaImportado } = await client
        .from(config.tabla)
        .select("id")
        .eq("nro_resumen", resumen.nro_resumen)
        .limit(1)
        .maybeSingle()
      if (yaImportado) {
        return NextResponse.json({
          ok: false,
          message: `El resumen ${resumen.nro_resumen} ya estaba importado. Para re-importarlo, borralo primero.`,
          excel_base64: excelBase64,
          control,
        })
      }
    }

    const { data: maxOrden } = await client
      .from(config.tabla)
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextOrden = (maxOrden?.orden ?? 0) + 1

    const paraInsertar: any[] = []
    for (const m of resumen.movimientos) {
      const debitos = m.pesos > 0 ? m.pesos : 0
      const creditos = m.pesos < 0 ? Math.abs(m.pesos) : 0
      const debitos_usd = m.dolares > 0 ? m.dolares : 0
      const creditos_usd = m.dolares < 0 ? Math.abs(m.dolares) : 0
      paraInsertar.push({
        fecha: m.fecha,
        descripcion: m.descripcion,
        debitos,
        creditos,
        debitos_usd,
        creditos_usd,
        referencia: m.referencia,
        cuota: m.cuota,
        comprobante: m.comprobante,
        nro_resumen: resumen.nro_resumen,
        fecha_cierre: resumen.fecha_cierre,
        fecha_vencimiento: resumen.fecha_vencimiento,
        tarjeta_adicional: m.tarjeta.tarjeta_nro,
        titular_adicional: m.tarjeta.titular,
        categ: null,
        detalle: null,
        contable: null,
        interno: null,
        centro_de_costo: null,
        cuenta: config.tabla,
        orden: nextOrden++,
        estado: "pendiente",
        // 'pago' (SU PAGO → concilia contra cta cte) | 'movimiento' (concilia contra template/factura)
        tipo_fila: /SU\s+PAGO/i.test(m.descripcion) ? "pago" : "movimiento",
      })
    }

    if (paraInsertar.length === 0) {
      return NextResponse.json({
        ok: false,
        message: `No se detectaron movimientos en el PDF.`,
        excel_base64: excelBase64,
        control,
      })
    }

    const { error: errInsert } = await client.from(config.tabla).insert(paraInsertar)
    if (errInsert) {
      return NextResponse.json(
        { ok: false, message: `Error al insertar: ${errInsert.message}`, excel_base64: excelBase64 },
        { status: 500 }
      )
    }

    // Fila "resumen": guarda el total a pagar + saldo anterior del PDF (para el audit y el desplegable).
    // tipo_fila='resumen', estado='total' → excluida del motor y de las sumas de movimientos.
    // Convención: debitos = total a pagar, creditos = saldo anterior (ídem USD).
    if (resumen.nro_resumen) {
      const { data: resExist } = await client.from(config.tabla)
        .select("id").eq("nro_resumen", resumen.nro_resumen).eq("tipo_fila", "resumen").maybeSingle()
      if (!resExist) {
        await client.from(config.tabla).insert({
          fecha: resumen.fecha_cierre,
          descripcion: `RESUMEN ${resumen.nro_resumen}`,
          debitos: resumen.total_a_pagar_pesos,
          creditos: resumen.saldo_anterior_pesos,
          debitos_usd: resumen.total_a_pagar_usd,
          creditos_usd: resumen.saldo_anterior_usd,
          nro_resumen: resumen.nro_resumen,
          fecha_cierre: resumen.fecha_cierre,
          fecha_vencimiento: resumen.fecha_vencimiento,
          cuenta: config.tabla,
          orden: nextOrden++,
          estado: "total",
          tipo_fila: "resumen",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${paraInsertar.length} movimiento(s) importado(s) desde el PDF a ${config.schema}.${config.tabla}.`,
      insertados: paraInsertar.length,
      control,
      resumen: {
        nro_resumen: resumen.nro_resumen,
        fecha_cierre: resumen.fecha_cierre,
        fecha_vencimiento: resumen.fecha_vencimiento,
        saldo_anterior_pesos: resumen.saldo_anterior_pesos,
        saldo_anterior_usd: resumen.saldo_anterior_usd,
        total_a_pagar_pesos: resumen.total_a_pagar_pesos,
        total_a_pagar_usd: resumen.total_a_pagar_usd,
      },
      excel_base64: excelBase64,
    })
  } catch (e: any) {
    console.error("Error en import-pdf-tarjeta:", e)
    return NextResponse.json(
      { ok: false, message: `Error inesperado: ${e?.message || "desconocido"}` },
      { status: 500 }
    )
  }
}
