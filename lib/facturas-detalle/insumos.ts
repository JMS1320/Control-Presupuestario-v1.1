/**
 * 🧾 Qué facturas son «de insumos» y cómo se guarda su detalle — A-FEAT-1651 etapa 2 (JMS 26/11: «Q9 sí, avanzá»).
 *
 * **Sin lista aparte, aprendido del uso** (JMS 26/11, P1 de la página «Compras de insumos sin trabajar»; CLAUDE.md § ⏸️): un
 * proveedor es «de insumos» cuando ya tiene una compra registrada en el stock (o una factura vinculada a una entrada). Y como un
 * mismo proveedor factura otras cosas (AFA: fletes, sellados e intereses del acopio), la factura además tiene que ir a una cuenta
 * de insumos — o no tener cuenta todavía.
 *
 * Veterinarios (42307 insumos veterinarios, 42316 IATF) quedan AFUERA por ahora (JMS 26/11: «Alcorta por ahora no»).
 */
import type { DetalleLeido } from "./leer-detalle"

/** Cuentas de insumos que van al stock: alimento de la hacienda (42305…: maíz, concentrado, sales, rollos — ojo, 42307 es veterinarios), fertilizantes y agroquímicos de ganadería, e insumos agrícolas (4211…). */
export function esCuentaDeInsumos(nroCuenta: string | null | undefined): boolean {
  const n = String(nroCuenta ?? "").trim()
  if (!n) return false
  return n.startsWith("42305") || n.startsWith("4211") || n === "42312" || n === "42322"
}

/**
 * ¿Esta factura tendría que tener su compra en el stock? Proveedor aprendido + cuenta de insumos (o sin cuenta aún).
 * `proveedores`: CUITs (sólo dígitos) con compras registradas o facturas vinculadas a entradas.
 */
export function esFacturaDeInsumos(f: { cuit?: string | null; nro_cuenta?: string | null }, proveedores: Set<string>): boolean {
  const cuit = String(f.cuit ?? "").replace(/\D/g, "")
  if (!cuit || !proveedores.has(cuit)) return false
  const n = String(f.nro_cuenta ?? "").trim()
  return !n || esCuentaDeInsumos(n)
}

/** El id del archivo de Drive a partir del link guardado en la factura (…/file/d/<id>/view…). */
export function fileIdDeDrive(url: string | null | undefined): string | null {
  const m = String(url ?? "").match(/\/d\/([A-Za-z0-9_-]{10,})/) || String(url ?? "").match(/[?&]id=([A-Za-z0-9_-]{10,})/)
  return m ? m[1]! : null
}

/** Las filas a guardar a partir de lo leído: una lectura (cabecera + control) y un renglón por artículo, con `leido` = lo leído tal cual. */
export function filasDeLectura(empresa: string, comprobanteId: string, fileId: string | null, d: DetalleLeido, quien: string | null) {
  const ahora = new Date().toISOString()
  const lectura = {
    empresa, comprobante_id: comprobanteId, file_id: fileId, formato: d.formato, moneda: d.moneda, tipo_cambio: d.tipoCambio,
    estado: d.control.estado, suma_renglones: d.control.sumaRenglones, neto_pie: d.control.netoPie, total_pie: d.control.totalPie,
    total_conocido: d.control.totalConocido, dif_neto: d.control.difNeto, dif_total: d.control.difTotal,
    mensajes: d.control.mensajes, no_leido: d.noLeido, leido_at: ahora, leido_por: quien, updated_at: ahora,
  }
  const renglones = d.renglones.map(r => ({
    empresa, comprobante_id: comprobanteId, n: r.n, codigo: r.codigo, descripcion: r.descripcion, cantidad: r.cantidad, unidad: r.unidad,
    precio_unitario: r.precioUnitario, bonif_pct: r.bonifPct, neto: r.neto, alicuota_iva: r.alicuotaIva, total_con_iva: r.totalConIva,
    origen: "lector" as const, leido: r, avisos: r.avisos, updated_at: ahora,
  }))
  return { lectura, renglones }
}
