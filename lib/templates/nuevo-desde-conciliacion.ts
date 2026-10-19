/**
 * 🧩 **CREAR UN TEMPLATE DESDE LA CONCILIACIÓN — entero o nada** (A-FEAT-1294, 2026-10-19).
 *
 * Es la mejora del «+ Crear uno acá» que ya existía (`components/modal-crear-template-faltante.tsx`),
 * no algo paralelo: sirve para TODAS las cuentas (cuenta corriente, PAM, tarjetas, cajas) porque el
 * modal de asignar es uno solo. Pedido del usuario:
 *
 * > *«Si se puede crear, siempre debe ser entero o nada… siempre debo poder ver lo existente para elegir,
 * > sino podría crear indefinidamente cosas similares… para mí el template es la cuenta».*
 *
 * ## La cuenta = el nombre del template, por default
 * Medido el 19/10: de 142 templates activos, **96 tienen una «cuenta» que no está en el plan** — es su
 * propio nombre («Expensas Libertad»). El usuario: *«es un claro ejemplo de que la cuenta es el template,
 * sólo que hemos duplicado todo; entonces por default que así sea»*. Se deja escrita (y no vacía) porque
 * un template sin cuenta concilia siempre «a auditar» («sin categ») y las reglas no lo encuentran.
 *
 * ## La campaña sale de la PERIODICIDAD y de la fecha del MOVIMIENTO
 * `anual` = año calendario («2026», PAM y MA cierran al 31/12); `bianual` = campaña jul–jun («25/26», MSA
 * cierra al 30/06). Se usa la fecha del movimiento, no la de hoy: al conciliar el histórico, un consumo de
 * oct-25 es de la campaña 25/26 aunque se cree en oct-26. (El wizard de Templates usa hoy, y está bien
 * ahí: se crea para lo que viene.)
 */
import type { Empresa } from "@/lib/empresas"

export type Periodicidad = "anual" | "bianual"

export interface DatosTemplateNuevo {
  nombre_referencia: string
  categ: string
  responsable: string
  cuenta_agrupadora: string
  centro_costo?: string | null
  periodicidad: Periodicidad
  año: string
  tipo: string
  aplica_generacion: boolean
}

/** La periodicidad que corresponde a una empresa: MSA cierra al 30/06; PAM y MA al 31/12. */
export const periodicidadDeEmpresa = (empresa: string): Periodicidad =>
  String(empresa).trim().toUpperCase() === "MSA" ? "bianual" : "anual"

/** La campaña de un movimiento: «2026» (anual) o «25/26» (bianual, jul–jun). */
export function campanaDeFecha(periodicidad: Periodicidad, fecha: string): string {
  const [a, m] = String(fecha).slice(0, 10).split("-").map(Number)
  if (!a || !m) return ""
  if (periodicidad === "anual") return String(a)
  const yy = a % 100
  const desde = m >= 7 ? yy : yy - 1
  const dos = (n: number) => String((n + 100) % 100).padStart(2, "0")
  return `${dos(desde)}/${dos(desde + 1)}`
}

/** Qué falta para poder crear. Vacío = se puede. Entero o nada: con algo faltante, no se crea. */
export function faltantesTemplateNuevo(d: Partial<DatosTemplateNuevo>): string[] {
  const f: string[] = []
  if (!d.nombre_referencia?.trim()) f.push("nombre")
  if (!d.categ?.trim()) f.push("cuenta")
  if (!d.responsable?.trim()) f.push("responsable")
  if (!d.cuenta_agrupadora?.trim()) f.push("agrupadora")
  if (!d.año?.trim()) f.push("campaña")
  if (!d.tipo?.trim()) f.push("naturaleza")
  return f
}

/** ¿El template es de otra empresa que la cuenta que paga? Se avisa, no se frena (lo decide el usuario). */
export const esDeOtraEmpresa = (responsable: string, empresaCuenta: Empresa | string): boolean =>
  !!responsable && !!empresaCuenta && responsable.trim().toUpperCase() !== String(empresaCuenta).trim().toUpperCase()
