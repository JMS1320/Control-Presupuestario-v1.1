import * as XLSX from "xlsx"

// Descarga el workbook en el navegador evitando llamadas a APIs de Node/Deno.
function saveWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  // Generar un ArrayBuffer con el contenido XLSX
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

  // Crear un Blob y disparar la descarga
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()

  // Limpieza
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(link)
  }, 0)
}

export async function exportarReporteDetallado(
  datos: any[],
  tipo: "distribucion" | "cuentas",
  año: number,
  semestre?: number,
  mostrarDecimales = true,
) {
  const workbook = XLSX.utils.book_new()

  // Función para formatear números
  const formatNumber = (num: number) => {
    if (mostrarDecimales) {
      return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return Math.round(num).toLocaleString("es-AR")
  }

  // Función para formatear fechas
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-AR")
  }

  // Crear una sola hoja con formato de lista continua
  const filas: any[][] = []

  // Encabezados principales
  filas.push(["Fecha", "Detalle", "Crédito", "Débito", "Neto"])
  filas.push([]) // Fila vacía después de encabezados

  if (tipo === "distribucion") {
    // Ordenar por concepto alfabéticamente
    const datosOrdenados = [...datos].sort((a, b) => a.concepto.localeCompare(b.concepto))

    datosOrdenados.forEach((concepto: any, index: number) => {
      // TÍTULO DE LA CATEGORÍA/CONCEPTO
      filas.push([concepto.concepto.toUpperCase(), `${concepto.movimientos.length} movimientos`, "", "", ""])

      // MOVIMIENTOS DE ESTA CATEGORÍA
      concepto.movimientos.forEach((mov: any) => {
        filas.push([
          formatDate(mov.fecha),
          mov.detalle,
          mov.creditos > 0 ? formatNumber(mov.creditos) : "",
          mov.debitos > 0 ? formatNumber(mov.debitos) : "",
          formatNumber(mov.neto),
        ])
      })

      // FILA DE TOTAL
      filas.push([
        "TOTAL",
        concepto.concepto,
        formatNumber(concepto.totalCreditos),
        formatNumber(concepto.totalDebitos),
        formatNumber(concepto.totalNeto),
      ])

      // FILA VACÍA (separador)
      filas.push([])

      // Si no es el último, agregar otra fila vacía para más separación
      if (index < datosOrdenados.length - 1) {
        filas.push([])
      }
    })
  } else {
    // Reporte de cuentas contables - ordenar por tipo y luego por cuenta
    const datosOrdenados = [...datos].sort((a, b) => a.tipo.localeCompare(b.tipo))

    datosOrdenados.forEach((tipoData: any, tipoIndex: number) => {
      // TÍTULO DEL TIPO DE CUENTA
      filas.push([`=== ${tipoData.tipo.toUpperCase()} ===`, `${tipoData.cuentas.length} cuentas`, "", "", ""])
      filas.push([]) // Fila vacía después del título del tipo

      // Ordenar cuentas dentro del tipo
      const cuentasOrdenadas = [...tipoData.cuentas].sort((a: any, b: any) => a.cuenta.localeCompare(b.cuenta))

      cuentasOrdenadas.forEach((cuenta: any, cuentaIndex: number) => {
        // TÍTULO DE LA CUENTA
        filas.push([cuenta.cuenta.toUpperCase(), `${cuenta.movimientos.length} movimientos`, "", "", ""])

        // MOVIMIENTOS DE ESTA CUENTA
        cuenta.movimientos.forEach((mov: any) => {
          filas.push([
            formatDate(mov.fecha),
            mov.detalle,
            mov.creditos > 0 ? formatNumber(mov.creditos) : "",
            mov.debitos > 0 ? formatNumber(mov.debitos) : "",
            formatNumber(mov.neto),
          ])
        })

        // FILA DE TOTAL DE LA CUENTA
        filas.push([
          "TOTAL",
          cuenta.cuenta,
          formatNumber(cuenta.totalCreditos),
          formatNumber(cuenta.totalDebitos),
          formatNumber(cuenta.totalNeto),
        ])

        // FILA VACÍA (separador entre cuentas)
        filas.push([])
      })

      // FILA VACÍA ADICIONAL entre tipos (si no es el último tipo)
      if (tipoIndex < datosOrdenados.length - 1) {
        filas.push([])
      }
    })
  }

  // Crear worksheet con todas las filas
  const ws = XLSX.utils.aoa_to_sheet(filas)

  // Configurar ancho de columnas
  const columnWidths = [
    { wch: 12 }, // Fecha
    { wch: 50 }, // Detalle
    { wch: 15 }, // Crédito
    { wch: 15 }, // Débito
    { wch: 15 }, // Neto
  ]
  ws["!cols"] = columnWidths

  // Aplicar estilos a las filas de títulos y totales
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:E1")

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[cellAddress]) continue

      const cellValue = ws[cellAddress].v

      // Aplicar formato a títulos de categorías/cuentas (texto en mayúsculas)
      if (
        typeof cellValue === "string" &&
        (cellValue.includes("===") ||
          (cellValue === cellValue.toUpperCase() &&
            cellValue !== "TOTAL" &&
            cellValue !== "FECHA" &&
            cellValue !== "DETALLE" &&
            cellValue !== "CRÉDITO" &&
            cellValue !== "DÉBITO" &&
            cellValue !== "NETO"))
      ) {
        ws[cellAddress].s = {
          font: { bold: true, sz: 12 },
          fill: { fgColor: { rgb: "E6F3FF" } },
        }
      }

      // Aplicar formato a filas de TOTAL
      if (typeof cellValue === "string" && cellValue === "TOTAL") {
        ws[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "F0F0F0" } },
        }
      }

      // Aplicar formato a encabezados
      if (R === 0) {
        ws[cellAddress].s = {
          font: { bold: true, sz: 11 },
          fill: { fgColor: { rgb: "D9D9D9" } },
          alignment: { horizontal: "center" },
        }
      }
    }
  }

  // Generar nombre de archivo y hoja
  const tipoTexto = tipo === "distribucion" ? "Distribucion-Socios" : "Cuentas-Contables"
  const semestreTexto = semestre ? `-S${semestre}` : ""
  const nombreArchivo = `Reporte-Detallado-${tipoTexto}-${año}${semestreTexto}.xlsx`
  const nombreHoja = tipo === "distribucion" ? "Distribución Socios" : "Cuentas Contables"

  XLSX.utils.book_append_sheet(workbook, ws, nombreHoja)

  // Descargar archivo
  saveWorkbook(workbook, nombreArchivo)
}
