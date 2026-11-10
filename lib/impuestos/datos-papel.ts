/**
 * 🧾 Lo que necesitan la PLANILLA DE IMPUESTOS y el PAPEL de inmobiliario / Red Vial / automotores — leído en un solo lugar.
 *
 * A-FEAT-1516: el libro H del balance lleva el mismo papel que se baja desde Egresos → Templates → Planilla de impuestos.
 * Para que den lo mismo, los dos leen con estas funciones (antes la lectura vivía dentro de `planilla-impuestos.tsx`).
 */
import type { CuotaPlanilla } from "./planilla"
import { cuentasRedVialDe, hectareasDe } from "./papel-inmobiliario"
import type { UbicacionPartidas } from "./papel-formato-jms"
import type { TipoCambio } from "@/lib/arrendamientos/calculo"

/** Las columnas de la cuota y su template que usan la planilla y el papel. */
export const SELECT_CUOTAS_IMPUESTOS = "id,estado,fecha_vencimiento,fecha_estimada,fecha_pago,monto,numero_cuota,detalle,descripcion,template:egresos_sin_factura!inner(id,nombre_referencia,responsable,cuenta_agrupadora,categ,solo_conciliacion,activo,partida_arba)"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = { from: (tabla: string) => any }

/** Las cuotas de los templates de impuestos, de a 1000 (el límite por consulta: sin esto, faltarían sin avisar). */
export async function cargarCuotasImpuestos(cliente: Cliente): Promise<CuotaPlanilla[]> {
  const todas: CuotaPlanilla[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await cliente.from("cuotas_egresos_sin_factura").select(SELECT_CUOTAS_IMPUESTOS)
      .ilike("template.cuenta_agrupadora", "impuesto%").order("id").range(desde, desde + 999)
    if (error) throw new Error(error.message)
    todas.push(...((data ?? []) as unknown as CuotaPlanilla[]))
    if (!data || data.length < 1000) break
  }
  return todas
}

export interface AuxiliaresPapel {
  /** Para la columna en U$S. */
  tcs: TipoCambio[]
  /** Para las columnas por hectárea. */
  hectareas: Record<string, number>
  /** El número con que la municipalidad identifica cada campo en Red Vial. */
  cuentasRedVial: Record<string, string>
  /** 🎨 A-FEAT-1516: la ZONA (establecimiento) y la parcela de cada partida, para el papel con la estética de JMS. */
  ubicacion: UbicacionPartidas
}

/** Zona y parcela por partida inmobiliaria, por cuenta de Red Vial y por `campo:<nombre>`. */
export function ubicacionDe(partidas: Array<{ campo?: string | null; establecimiento?: string | null; parcela?: string | null; partida_inmobiliario?: string | null; partida_red_vial?: string | null }>): UbicacionPartidas {
  const r: UbicacionPartidas = {}
  for (const p of partidas) {
    const u = { establecimiento: p.establecimiento ?? null, parcela: p.parcela ?? null }
    if (p.partida_inmobiliario) r[p.partida_inmobiliario] = u
    if (p.partida_red_vial) r[p.partida_red_vial] = u
    if (p.campo) r[`campo:${p.campo.toLowerCase()}`] = u
  }
  return r
}

/** TC, hectáreas y cuentas de Red Vial. Si no se pueden leer, el papel sale igual sin esas columnas (vacío, no error). */
export async function cargarAuxiliaresPapel(cliente: Cliente): Promise<AuxiliaresPapel> {
  const [tc, p, c] = await Promise.all([
    cliente.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
    cliente.from("partidas").select("campo, establecimiento, parcela, partida_inmobiliario, partida_red_vial, has_totales, has_productivas"),
    cliente.from("campo_partidas").select("nombre_partida, nro_partida, has"),
  ])
  return {
    tcs: (tc.data ?? []) as TipoCambio[],
    hectareas: hectareasDe((p.data ?? []) as never[], (c.data ?? []) as never[]),
    cuentasRedVial: cuentasRedVialDe((p.data ?? []) as never[]),
    ubicacion: ubicacionDe((p.data ?? []) as never[]),
  }
}
