/**
 * 📒 Lo que el libro F (A-FEAT-1509) lee de la base aparte de lo que ya armó la pantalla. Nunca tira: lo que no se pudo leer
 * vuelve `null` y el renglón dice «no se trajo».
 */
import { deudaDeTarjeta, type DeudaTarjeta } from "./balance-propio"
import { TABLA_DATOS_USUARIO } from "./datos-usuario-puro"
import { tcDolarAl } from "@/lib/dolares/tc-cierre"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/**
 * 💳 La deuda de la tarjeta al cierre — la MISMA lectura que usa «Pasar a la foto del balance» (`proponer-foto-balance`).
 */
export async function leerDeudaTarjeta(sb: Cliente, schema: string, fechaCierre: string): Promise<DeudaTarjeta | null> {
  const { data, error } = await sb.schema(schema).from("tarjeta_visa_business")
    .select("tipo_fila, fecha, debitos, creditos, fecha_cierre, fecha_vencimiento")
  if (error) return null
  const filas = (data ?? []) as Record<string, unknown>[]
  return deudaDeTarjeta(
    filas.filter(f => f.tipo_fila === "resumen" && f.fecha_cierre && f.fecha_vencimiento)
      .map(f => ({ cierre: String(f.fecha_cierre), vencimiento: String(f.fecha_vencimiento), total: Number(f.debitos) || 0 })),
    filas.filter(f => f.tipo_fila === "movimiento")
      .map(f => ({ fecha: String(f.fecha), importe: (Number(f.debitos) || 0) - (Number(f.creditos) || 0), cierreResumen: (f.fecha_cierre as string) ?? null })),
    fechaCierre)
}

/**
 * 🧾 SUSS a pagar (JMS: *«poner el template de venc julio/26 en este renglón, es una deuda»*): la cuota del template de
 * cargas sociales de la empresa que vence el mes siguiente al cierre (período del mes de cierre).
 */
export async function leerSussAlCierre(sb: Cliente, empresa: string, fechaCierre: string): Promise<{ concepto: string; vencimiento: string | null; monto: number; estado: string } | null> {
  const [a, m] = fechaCierre.slice(0, 7).split("-").map(Number)
  const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`
  const fin = new Date(Date.UTC(Number(sig.slice(0, 4)), Number(sig.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const { data, error } = await sb.from("cuotas_egresos_sin_factura")
    .select("monto, estado, fecha_vencimiento, fecha_estimada, egreso:egresos_sin_factura!inner(nombre_referencia, responsable)")
    .eq("egreso.responsable", empresa).ilike("egreso.nombre_referencia", "%cargas sociales%")
    .gte("fecha_estimada", `${sig}-01`).lte("fecha_estimada", fin)
  if (error || !(data ?? []).length) return null
  const q = (data as Record<string, unknown>[])[0]
  const e = q.egreso as { nombre_referencia?: string } | null
  return { concepto: String(e?.nombre_referencia ?? "Cargas Sociales"), vencimiento: (q.fecha_vencimiento as string) ?? (q.fecha_estimada as string) ?? null,
    monto: Number(q.monto) || 0, estado: String(q.estado ?? "") }
}

/** Un dato que cargó el usuario (o Claude, con su marca) en la pantalla del balance. */
async function datos(sb: Cliente, empresa: string, anioCierre: number, papel: string): Promise<Record<string, { valor: number | null; por: string | null }> | null> {
  const { data, error } = await sb.from(TABLA_DATOS_USUARIO).select("clave, valor, actualizado_por").eq("empresa", empresa).eq("anio_cierre", anioCierre).eq("papel", papel)
  if (error) return null
  return Object.fromEntries(((data ?? []) as { clave: string; valor: number | string | null; actualizado_por: string | null }[])
    .map(d => [d.clave, { valor: d.valor == null ? null : Number(d.valor), por: d.actualizado_por }]))
}

/** 💰 FCI: cuotapartes y valor al inicio y al cierre (los mismos datos de «Pasar a la foto del balance»). */
export async function leerFci(sb: Cliente, empresa: string, anioCierre: number) {
  const d = await datos(sb, empresa, anioCierre, "fci")
  if (!d) return null
  const nota = (k: string, def: string) => d[k]?.por?.replace(/^\[script \d+\]\s*/, "") ?? def
  return {
    cuotasInicio: d.cuotapartes_inicio?.valor ?? null, valorInicio: d.valor_cuotaparte_inicio?.valor ?? null,
    notaInicio: nota("valor_cuotaparte_inicio", "falta cargar la tenencia al inicio"),
    cuotasCierre: d.cuotapartes?.valor ?? null, valorCierre: d.valor_cuotaparte?.valor ?? null,
    notaCierre: nota("valor_cuotaparte", "falta cargar la tenencia al cierre"),
  }
}

/** 💹 La tenencia del FCI tal como la devuelve `leerFci` (también la usa el papel 07). */
export type TenenciaFci = NonNullable<Awaited<ReturnType<typeof leerFci>>>

/** 🌾 Soja: las toneladas al inicio (el dato del cuadre de granos). */
export async function leerSojaInicio(sb: Cliente, empresa: string, anioCierre: number): Promise<{ tnInicio: number | null; nota: string } | null> {
  const d = await datos(sb, empresa, anioCierre, "granos")
  if (!d) return null
  const i = d.inicio
  return { tnInicio: i?.valor ?? null, nota: i ? (i.por?.startsWith("Claude · TENTATIVO") ? `TENTATIVO — ${i.por}` : (i.por ?? "cargado en la pantalla del balance")) : "falta el stock de soja al inicio" }
}

/** 💵 El dólar al cierre, para pasar la cuenta en dólares a pesos. */
export async function leerTcCierre(sb: Cliente, fechaCierre: string) {
  const t = await tcDolarAl(sb, fechaCierre)
  return t ? { tc: t.tc, fuente: t.fuente } : null
}
