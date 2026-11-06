"use client"
/**
 * 🛒 **Comprar desde la orden** (A-FEAT-1557 etapa 1, JMS 06/11: *«registraré la compra antes que me facturen… desde la orden
 * o aparte, poniendo compra… ahí nace todo»*).
 *
 * La orden agrícola deja un PEDIDO acá con sus insumos y cantidades; la solapa de Insumos se pone en «Stock & Movimientos» y
 * abre el formulario de COMPRA de siempre con los renglones precargados y la orden anotada. Es el mismo patrón que el acceso
 * de campo (`pedido-campo.ts`): vive en un módulo porque la solapa de destino se monta después de cambiar de solapa.
 */
import { useEffect, useRef } from "react"

export interface RenglonPedidoCompra { insumo_stock_id: string; cantidad: number }
export interface PedidoCompra { ordenId: string; descripcion: string; renglones: RenglonPedidoCompra[] }

let pendiente: PedidoCompra | null = null
const EVENTO = "compra:pedido"

export function pedirCompra(p: PedidoCompra) {
  pendiente = p
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO))
}

export const verPedidoCompra = (): PedidoCompra | null => pendiente

export function tomarPedidoCompra(): PedidoCompra | null {
  const p = pendiente
  pendiente = null
  return p
}

/**
 * Los renglones de compra de una orden: un renglón por insumo del stock (los que se escribieron a mano, sin insumo del stock,
 * no se pueden comprar desde acá), sumando si el mismo insumo aparece dos veces. Pura (caso en `npm run probar`).
 */
export function renglonesDeOrden(lineas: { insumo_stock_id: string | null; cantidad_total_l: number | null }[]): RenglonPedidoCompra[] {
  const porInsumo = new Map<string, number>()
  for (const l of lineas) {
    const c = Number(l.cantidad_total_l) || 0
    if (!l.insumo_stock_id || c <= 0) continue
    porInsumo.set(l.insumo_stock_id, Math.round(((porInsumo.get(l.insumo_stock_id) ?? 0) + c) * 1000) / 1000)
  }
  return [...porInsumo.entries()].map(([insumo_stock_id, cantidad]) => ({ insumo_stock_id, cantidad }))
}

/** Llama a `alPedido` cuando hay un pedido (al montar y cada vez que llega uno). */
export function usePedidoCompra(alPedido: (p: PedidoCompra) => void, listo = true) {
  const cb = useRef(alPedido)
  cb.current = alPedido
  useEffect(() => {
    if (!listo) return
    const mirar = () => { const p = verPedidoCompra(); if (p) cb.current(p) }
    mirar()
    window.addEventListener(EVENTO, mirar)
    return () => window.removeEventListener(EVENTO, mirar)
  }, [listo])
}

/** Cuántos días lleva una compra sin factura, y si ya llama la atención (pasó la fecha de pago o más de 30 días). */
export function estadoSinFactura(fecha: string, fechaPago: string | null, hoy: string): { dias: number; alerta: boolean } {
  const d = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000)
  const dias = Math.max(0, d(fecha, hoy))
  return { dias, alerta: dias > 30 || (!!fechaPago && fechaPago < hoy) }
}
