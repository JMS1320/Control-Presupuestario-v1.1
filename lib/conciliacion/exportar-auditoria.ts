/**
 * 📊 **A-FEAT-146 — el reporte Excel del audit.**
 *
 * Pedido del usuario 2026-09-13: *«te iba a pedir que me des un reporte Excel así puedo ver mejor
 * los casos que me proponés y hacer. Me lo podés dar vos, pero sería bueno que un audit ya me
 * muestre los mismos casos»*.
 *
 * ## El motivo es de CONTROL, no de comodidad
 * Hasta acá los casos se los pasaba yo, pegando tablas armadas con consultas aparte. **Eso es una
 * segunda medición**, y puede diferir de la del audit sin que nadie se entere — que es exactamente
 * lo que pasó en [A-BUG-172]: el audit dijo 8 y mi consulta dijo 141.
 *
 * 🔑 Con el export, **la lista que el usuario trabaja es la que produjo la herramienta**. Y el
 * corolario para mí: si necesito un número, se lo pido al audit; no abro una consulta al costado.
 *
 * ## Cómo está armado
 * Una hoja **Resumen** con el conteo por control, y una hoja por control con el detalle. Cada fila
 * dice **dónde se arregla** — extracto u origen —, que es la columna que decide el trabajo.
 */

import * as XLSX from "xlsx"
import type { ResultadoAuditoria, Hallazgo } from "./auditoria"

/** Nombre de hoja seguro para Excel: máximo 31 caracteres y sin `: \ / ? * [ ]`. */
function hoja(nombre: string): string {
  return nombre.replace(/[:\\/?*[\]]/g, "-").slice(0, 31)
}

function filaDe(h: Hallazgo) {
  const esOrigen = h.entidad && h.entidad !== "movimiento"
  return {
    "Dónde se arregla": esOrigen
      ? (h.entidad === "template" ? "EN EL TEMPLATE" : "EN LA FACTURA")
      : (h.enElOrigen ? "EN EL ORIGEN" : "En el extracto"),
    Cuenta: h.cuenta,
    Fecha: h.fecha ?? "",
    Importe: h.importe || "",
    Descripción: h.descripcion ?? "",
    Origen: h.origen,
    "Qué está mal": h.problema,
    Causa: h.causa,
    "Movs. que dependen": h.dependen ?? "",
    id: h.movimientoId,
  }
}

export function exportarAuditoria(res: ResultadoAuditoria, fecha = new Date()) {
  const wb = XLSX.utils.book_new()

  const resumen = [
    { Concepto: "Movimientos en todas las cuentas", Cantidad: res.universo },
    { Concepto: "Auditados (los conciliados)", Cantidad: res.auditados },
    { Concepto: "Sin observaciones", Cantidad: res.limpios },
    { Concepto: "Con observaciones", Cantidad: res.auditados - res.limpios },
    { Concepto: "", Cantidad: "" },
    ...res.grupos.map(g => ({
      Concepto: g.titulo,
      Cantidad: g.total,
      "Se arreglan en el origen": g.enElOrigen || "",
      Regla: g.regla,
    })),
    // ⚠️ Lo que no se pudo verificar viaja en el reporte: nada se descarta en silencio.
    ...(res.noVerificado.length
      ? [{ Concepto: "", Cantidad: "" },
         ...res.noVerificado.map(n => ({ Concepto: "⚠️ NO VERIFICADO", Cantidad: "", Regla: n }))]
      : []),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen")

  // Una hoja por control. El nombre lleva el número para que el orden del Excel sea el de la pantalla.
  res.grupos.forEach((g, i) => {
    const filas = g.causas.flatMap(c => c.ejemplos.map(filaDe))
    XLSX.utils.book_append_sheet(
      wb, XLSX.utils.json_to_sheet(filas),
      hoja(`${i + 1} ${g.titulo.replace(/^🕳️ /, "")}`))
  })

  const d = fecha.toISOString().slice(0, 10)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Auditoria_conciliacion_${d}.xlsx`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
}
