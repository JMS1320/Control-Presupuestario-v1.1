/**
 * 👥 REGISTRAR LA CONTRAPARTE — el upsert único de `public.proveedores`.
 *
 * ## La regla que implementa
 * `CLAUDE.md` § 👥 Contrapartes: **si entra un comprobante, su contraparte tiene que quedar en
 * `public.proveedores`. Upsert, nunca sólo `UPDATE`.**
 *
 * ## El bug que resuelve (B-BUG-CLIENTE-NO-SE-CREA · A-FEAT-41)
 * Compras auto-creaba; **ventas no**. Había cinco entradas de venta y cada una hacía lo suyo:
 *
 * | Entrada | Qué hacía |
 * |---|---|
 * | `import-ventas` (la vía de VOLUMEN) | ❌ no tocaba `proveedores` en absoluto |
 * | `modal-venta-msa` · `modal-comprobante-venta-msa` · `modal-liquidacion-msa` | ❌ sólo `UPDATE … WHERE cuit=X` |
 * | venta manual de hacienda | ❌ nada (hubo que crear a Ballester a mano) |
 *
 * 🔑 **Un `UPDATE` que no matchea no falla.** Si el cliente no existe, cambia 0 filas, devuelve OK
 * y nadie se entera. Ese es el hueco silencioso, y es el motivo de que la regla diga *«upsert,
 * nunca sólo UPDATE»* con esas palabras.
 *
 * ## ⚠️ La trampa del default, que es de este esquema y no se ve en el código
 * `proveedores.es_proveedor` tiene **`DEFAULT true`**. Crear un cliente puro sin decir nada lo deja
 * marcado como proveedor —contra la regla *«`es_proveedor = true` sólo si tiene factura de compra a
 * su nombre»*—. Por eso acá **los dos flags se escriben siempre, explícitos**: lo que el default
 * decida no puede depender de que alguien se acuerde.
 *
 * ## Qué NO hace
 * No pisa la razón social de una ficha existente. Si el comprobante trae un nombre distinto al
 * cargado, **manda el que ya está**: alguien puede haberlo corregido a mano, y este camino no tiene
 * forma de saber cuál es mejor.
 */

/** Sólo dígitos: en los comprobantes el CUIT viene con guiones, con espacios o pelado. */
export function normalizarCuit(cuit: string | null | undefined): string {
  return String(cuit ?? '').replace(/\D/g, '')
}

export interface ContraparteEntrante {
  cuit: string | null | undefined
  razon_social?: string | null
}

export interface FichaExistente {
  cuit: string
  es_cliente?: boolean | null
  es_proveedor?: boolean | null
}

export interface PlanContrapartes {
  /** Fichas a crear, con los dos flags explícitos. */
  aCrear: Array<{ cuit: string; razon_social: string; es_cliente: boolean; es_proveedor: boolean }>
  /** CUITs que ya tienen ficha pero les falta el flag de este rol. */
  aMarcar: string[]
  /** Entradas descartadas por no traer CUIT. Se devuelven para poder decirlo, no para esconderlas. */
  sinCuit: number
}

/**
 * Decide qué crear y qué marcar. **Pura**: no toca la base, por eso se puede probar.
 *
 * `rol` es el papel que cumple la contraparte **en este comprobante**:
 * - `'cliente'` → se le prende `es_cliente`. Si hay que crearla, nace con `es_proveedor = false`
 *   (cliente puro) — el flag de proveedor se prende sólo cuando aparezca una factura de compra.
 * - `'proveedor'` → al revés.
 */
export function planificarContrapartes(
  entrantes: ContraparteEntrante[],
  existentes: FichaExistente[],
  rol: 'cliente' | 'proveedor',
): PlanContrapartes {
  const porCuit = new Map<string, string>()
  let sinCuit = 0

  for (const e of entrantes) {
    const cuit = normalizarCuit(e.cuit)
    if (!cuit) { sinCuit++; continue }
    // Se queda el primer nombre no vacío que aparezca para ese CUIT.
    const nombre = (e.razon_social ?? '').trim()
    if (!porCuit.has(cuit) || (!porCuit.get(cuit) && nombre)) porCuit.set(cuit, nombre)
  }

  const fichas = new Map(existentes.map(f => [normalizarCuit(f.cuit), f]))
  const campo = rol === 'cliente' ? 'es_cliente' : 'es_proveedor'

  const aCrear: PlanContrapartes['aCrear'] = []
  const aMarcar: string[] = []

  for (const [cuit, nombre] of porCuit) {
    const ficha = fichas.get(cuit)
    if (!ficha) {
      aCrear.push({
        cuit,
        // `razon_social` es NOT NULL: sin nombre, el CUIT es mejor que romper el import.
        razon_social: nombre || cuit,
        es_cliente: rol === 'cliente',
        es_proveedor: rol === 'proveedor',
      })
    } else if (ficha[campo] !== true) {
      aMarcar.push(cuit)
    }
  }

  return { aCrear, aMarcar, sinCuit }
}

export interface ResultadoContrapartes {
  creados: number
  marcados: number
  sinCuit: number
  error?: string
}

/**
 * Aplica el plan contra la base.
 *
 * ⚠️ **Nunca lanza.** Un problema registrando la contraparte **no puede tumbar la importación ni
 * el guardado de la venta**: el comprobante es el dato principal. Se devuelve el error para que
 * quien llama lo muestre — pero **se devuelve**, no se traga en silencio: un hueco invisible acá es
 * exactamente el bug que esto viene a cerrar.
 */
export async function registrarContrapartes(
  // El cliente de Supabase, tipado laxo a propósito: lo llaman rutas de API (service role) y
  // componentes (anon), que no comparten tipo.
  supabase: { from: (t: string) => any },
  entrantes: ContraparteEntrante[],
  rol: 'cliente' | 'proveedor',
): Promise<ResultadoContrapartes> {
  try {
    const cuits = [...new Set(entrantes.map(e => normalizarCuit(e.cuit)).filter(Boolean))]
    if (cuits.length === 0) {
      return { creados: 0, marcados: 0, sinCuit: entrantes.length }
    }

    const { data: existentes, error: errLeer } = await supabase
      .from('proveedores')
      .select('cuit, es_cliente, es_proveedor')
      .in('cuit', cuits)
    if (errLeer) return { creados: 0, marcados: 0, sinCuit: 0, error: errLeer.message }

    const plan = planificarContrapartes(entrantes, (existentes ?? []) as FichaExistente[], rol)

    if (plan.aCrear.length > 0) {
      const { error } = await supabase.from('proveedores').insert(plan.aCrear)
      if (error) return { creados: 0, marcados: 0, sinCuit: plan.sinCuit, error: error.message }
    }

    if (plan.aMarcar.length > 0) {
      const campo = rol === 'cliente' ? 'es_cliente' : 'es_proveedor'
      const { error } = await supabase
        .from('proveedores')
        .update({ [campo]: true })
        .in('cuit', plan.aMarcar)
      if (error) {
        return { creados: plan.aCrear.length, marcados: 0, sinCuit: plan.sinCuit, error: error.message }
      }
    }

    return { creados: plan.aCrear.length, marcados: plan.aMarcar.length, sinCuit: plan.sinCuit }
  } catch (e) {
    return { creados: 0, marcados: 0, sinCuit: 0, error: (e as Error).message }
  }
}
