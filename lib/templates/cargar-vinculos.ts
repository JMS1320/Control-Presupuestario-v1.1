/**
 * 🔗 **A-FEAT-131 — de dónde salen los vínculos que hay que proteger.**
 *
 * La lógica de qué advertir vive en `editar-campana.ts` y es pura. Esto es la otra mitad: ir a
 * buscar los movimientos bancarios reales para dársela.
 *
 * ## Por qué son varias tablas y no una
 * `template_cuota_id` existe en **12 tablas** de 4 schemas: los cuatro bancos, las tres cajas y las
 * cuatro tarjetas. Mirar sólo `msa_galicia` cubriría 472 de los 491 vínculos vivos — y dejaría
 * afuera justo los de PAM y MA, que son los que nadie recuerda. La lista sale de
 * `CUENTAS_BANCARIAS` (§ `CLAUDE.md` ♻️ Centralizar, no duplicar): si mañana se agrega una cuenta,
 * aparece acá sola.
 *
 * ## Y por qué una consulta falla sin romper todo
 * Si una tabla no existe o no está expuesta en PostgREST, se registra el error y se sigue con las
 * demás. Un editor que no abre porque una caja secundaria dio error es peor que uno que abre
 * diciendo qué no pudo mirar — pero **el aviso tiene que verse**, porque un vínculo no mirado se
 * parece demasiado a un vínculo que no existe (§ 🧮 *nada se descarta en silencio*).
 */
import { supabase } from '@/lib/supabase'
import { CUENTAS_BANCARIAS } from '@/hooks/useMotorConciliacion'
import type { MovimientoBancario } from './editar-campana'

const COLS = 'id, fecha, debitos, creditos, descripcion, estado, template_cuota_id, template_id'

/** Ventana alrededor de las cuotas: un mes para cada lado de la cuota más temprana y la más tardía. */
const DIAS_VENTANA = 30

const corrida = (fecha: string, dias: number) => {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + dias * 86_400_000)
  return t.toISOString().slice(0, 10)
}

export interface VinculosDelTemplate {
  /** Movimientos cuyo `template_cuota_id` apunta a una de estas cuotas. Lo que hay que proteger. */
  vinculos: MovimientoBancario[]
  /** Movimientos de la ventana de fechas, vinculados o no. Contra éstos se buscan coincidencias. */
  candidatos: MovimientoBancario[]
  /** Tablas que no se pudieron leer. Se muestra: un vínculo no mirado parece un vínculo que no existe. */
  noMiradas: { tabla: string; motivo: string }[]
}

export async function cargarVinculos(
  cuotaIds: string[],
  fechas: string[],
): Promise<VinculosDelTemplate> {
  const vinculos: MovimientoBancario[] = []
  const candidatos: MovimientoBancario[] = []
  const noMiradas: { tabla: string; motivo: string }[] = []

  const validas = fechas.filter(Boolean).sort()
  const desde = validas.length ? corrida(validas[0], -DIAS_VENTANA) : null
  const hasta = validas.length ? corrida(validas[validas.length - 1], DIAS_VENTANA) : null

  for (const cuenta of CUENTAS_BANCARIAS.filter(c => c.activa)) {
    const base = () => {
      const cli = cuenta.schema_bd && cuenta.schema_bd !== 'public'
        ? (supabase as any).schema(cuenta.schema_bd)
        : supabase
      return cli.from(cuenta.tabla_bd)
    }
    const marca = (m: any): MovimientoBancario => ({
      id: String(m.id), tabla: cuenta.id, fecha: String(m.fecha ?? '').slice(0, 10),
      debitos: Number(m.debitos) || 0, creditos: Number(m.creditos) || 0,
      descripcion: m.descripcion ?? null, estado: m.estado ?? null,
      template_cuota_id: m.template_cuota_id ?? null,
    })

    try {
      if (cuotaIds.length > 0) {
        const { data, error } = await base().select(COLS).in('template_cuota_id', cuotaIds)
        if (error) throw error
        ;(data ?? []).forEach((m: any) => vinculos.push(marca(m)))
      }

      if (desde && hasta) {
        const { data, error } = await base().select(COLS)
          .gte('fecha', desde).lte('fecha', hasta).limit(2000)
        if (error) throw error
        ;(data ?? []).forEach((m: any) => candidatos.push(marca(m)))
      }
    } catch (e: any) {
      noMiradas.push({ tabla: cuenta.nombre, motivo: e?.message || String(e) })
    }
  }

  return { vinculos, candidatos, noMiradas }
}
