"use client"
/**
 * 📱 **El acceso de CAMPO — abrir directo una orden desde el celular** (A-FEAT-1409 etapa 3).
 *
 * JMS 2026-10-28: *«¿el widget de crear labor se podría hacer para el cel? Tiene crear o editar labor y
 * le abrí el modal directo; para editar deberá elegir dentro de las no confirmadas»* → OK al diseño.
 *
 * El link `/?seccion=productivo&campo=1` muestra arriba de Productivo un panel con «Nueva orden agrícola»,
 * «Nueva orden ganadera» y las no confirmadas para editar. Al tocar uno se deja un PEDIDO acá; cada
 * solapa de la cadena (Productivo → Insumos → Órdenes → Agrícola/Ganadero) lo mira para ponerse en su
 * lugar, y la orden lo TOMA (lo consume) y abre su formulario. Es el mismo formulario de siempre: un solo
 * lugar donde se carga la orden.
 *
 * Vive en un módulo (no en el estado de React) porque las solapas se montan DESPUÉS de cambiar de solapa:
 * si el pedido viajara sólo como evento, la orden recién montada no lo vería.
 */
import { useEffect, useRef } from "react"

export type TipoOrden = "agricola" | "ganadero"
export interface PedidoCampo { tipo: TipoOrden; ordenId?: string }

let pendiente: PedidoCampo | null = null
const EVENTO = "campo:pedido"

export function pedirCampo(p: PedidoCampo) {
  pendiente = p
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO))
}

/** Mirar sin consumir: para las solapas intermedias, que sólo se acomodan. */
export const verPedidoCampo = (): PedidoCampo | null => pendiente

/** Consumir: lo hace la orden que abre el formulario. */
export function tomarPedidoCampo(tipo: TipoOrden): PedidoCampo | null {
  if (pendiente?.tipo !== tipo) return null
  const p = pendiente
  pendiente = null
  return p
}

/** ¿La app se abrió con el link de campo? */
export const esModoCampo = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("campo") === "1"

/**
 * Llama a `alPedido` cuando hay un pedido (al montar y cada vez que llega uno). `listo` permite esperar
 * a que la solapa tenga sus datos (para editar hace falta la lista de órdenes cargada).
 */
export function usePedidoCampo(alPedido: (p: PedidoCampo) => void, listo = true) {
  const cb = useRef(alPedido)
  cb.current = alPedido
  useEffect(() => {
    if (!listo) return
    const mirar = () => { const p = verPedidoCampo(); if (p) cb.current(p) }
    mirar()
    window.addEventListener(EVENTO, mirar)
    return () => window.removeEventListener(EVENTO, mirar)
  }, [listo])
}
