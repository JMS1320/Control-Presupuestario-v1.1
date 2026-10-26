/**
 * Lado pantalla del camino único (A-DEC-1021): los cinco lugares que cambian la cuenta de una factura
 * llaman a esto, y muestran el mismo aviso. Ver `lib/conciliacion/asignar-cuenta.ts`.
 */
import type { EmpresaFactura } from "./asignar-cuenta"
import type { ParDeCuenta } from "@/lib/facturas/nro-de-cuenta"

export interface RespuestaAsignacion {
  actualizados: number
  cuenta: ParDeCuenta | null
  propagacion?: { propagados?: number; salteados?: number; aviso?: string | null }
}

/** Tira error con el mensaje de la ruta si no se guardó. */
export async function pedirAsignacionDeCuenta(args: {
  empresa: EmpresaFactura
  ids: string[]
  nro_cuenta?: string | null
  cuenta_contable?: string | null
}): Promise<RespuestaAsignacion> {
  const res = await fetch("/api/arca-asignar", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      empresa: args.empresa,
      ids: args.ids,
      nro_cuenta: args.nro_cuenta ?? null,
      cuenta_contable: args.cuenta_contable ?? null,
    }),
  })
  const data = await res.json().catch(() => ({ success: false, message: `Error ${res.status}` }))
  if (!data.success) throw new Error(data.message || "No se pudo guardar la cuenta")
  return data as RespuestaAsignacion
}

/**
 * 🧮 Qué decirle al usuario sobre los movimientos del extracto. `tipo: null` = nada que decir.
 * Nada en silencio: si algo quedó sin tocar o falló, sale como advertencia.
 */
export function mensajeDePropagacion(r: RespuestaAsignacion): { tipo: "ok" | "aviso" | null; texto: string } {
  const p = r.propagacion
  if (p?.aviso) return { tipo: "aviso", texto: p.aviso }
  if ((p?.propagados ?? 0) > 0) return { tipo: "ok", texto: `La cuenta llegó a ${p!.propagados} movimiento(s) ya conciliados.` }
  return { tipo: null, texto: "" }
}
