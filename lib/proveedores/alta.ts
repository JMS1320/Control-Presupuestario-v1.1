// Alta de una contraparte en el maestro `public.proveedores`.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// `CLAUDE.md` § Contrapartes obliga a que **toda** vía por la que entra un comprobante deje su
// contraparte en el maestro — "importadores masivos Y ALTAS MANUALES". Hasta 2026-08-31 el único
// `INSERT` sobre `proveedores` en todo el repo era el importador de ARCA: un proveedor **sólo podía
// nacer si llegaba una factura suya**. Todo lo demás quedaba huérfano, y sin fila en el maestro no
// hay dónde guardar CBU ni mail — o sea que el proveedor no entra al export de lotes de pago ni al
// mail de detalle (A-BUG-93).
//
// Se centraliza acá porque la misma regla estaba rota en **tres** lugares distintos (anticipos,
// ventas, venta de hacienda). Tres parches habrían dado tres criterios de normalización de CUIT
// distintos, que es exactamente cómo se dejan de encontrar las cosas.
//
// ── La regla de oro: FIND-OR-CREATE, nunca overwrite ─────────────────────────
// Si el CUIT ya existe **no se pisa nada** — a lo sumo se enciende el flag que falte
// (`es_cliente` / `es_proveedor`), porque una contraparte puede ser las dos cosas. Un alta manual
// no puede tener más autoridad que los datos que ya están cargados: el nombre que tipeó el usuario
// en un apuro no debe reemplazar la razón social que vino de ARCA.

/** Deja el CUIT en dígitos, que es como se guarda en el maestro. */
export function normalizarCuit(cuit: string | null | undefined): string {
  return (cuit ?? '').replace(/\D/g, '')
}

export type ResultadoAlta =
  | { ok: true; accion: 'creado' | 'ya_existia' | 'flag_agregado'; cuit: string; razon_social: string }
  | { ok: false; error: string }

export interface DatosAlta {
  cuit: string
  razon_social: string
  /** Qué es esta contraparte en el circuito que la está dando de alta. */
  como: 'proveedor' | 'cliente'
}

/**
 * Da de alta la contraparte si no existe. Devuelve qué hizo, para poder avisarlo en pantalla:
 * un alta silenciosa es indistinguible de no haber hecho nada.
 *
 * `db` es el cliente de Supabase a usar (admin en las rutas de API). Se recibe por parámetro para
 * no atar este helper a un cliente concreto ni a un runtime.
 */
export async function altaContraparte(db: any, datos: DatosAlta): Promise<ResultadoAlta> {
  const cuit = normalizarCuit(datos.cuit)
  const razon = (datos.razon_social ?? '').trim()

  // ⚠️ Sin CUIT no se da de alta, y no es un capricho de validación: el CUIT es la **identidad**
  // de la contraparte — es por donde matchea el motor de conciliación, por donde se arma el pre-filtro
  // y por donde la busca la ficha. Una fila sin CUIT no la encuentra nadie y hay que borrarla después.
  // Ya pasó: 2 anticipos viejos tienen el placeholder `11111111111` y no sirven para ningún match.
  if (cuit.length < 11) {
    return { ok: false, error: 'Sin CUIT válido (11 dígitos) no se puede dar de alta la contraparte' }
  }
  if (!razon) {
    return { ok: false, error: 'Falta la razón social' }
  }

  const { data: existente, error: errBusca } = await db
    .from('proveedores')
    .select('id, cuit, razon_social, es_proveedor, es_cliente')
    .eq('cuit', cuit)
    .maybeSingle()

  if (errBusca) return { ok: false, error: errBusca.message }

  if (existente) {
    // Ya está: sólo se enciende el flag que falte. NADA más se toca (find-or-create).
    const flag = datos.como === 'cliente' ? 'es_cliente' : 'es_proveedor'
    if (existente[flag] === true) {
      return { ok: true, accion: 'ya_existia', cuit, razon_social: existente.razon_social }
    }
    const { error: errFlag } = await db
      .from('proveedores')
      .update({ [flag]: true })
      .eq('id', existente.id)
    if (errFlag) return { ok: false, error: errFlag.message }
    return { ok: true, accion: 'flag_agregado', cuit, razon_social: existente.razon_social }
  }

  // `es_proveedor` sólo va en true si la contraparte entra COMO proveedor. La regla dice que se
  // marca cuando tiene factura de compra a su nombre; acá se toma el circuito como evidencia
  // (un anticipo de pago es a un proveedor), y el usuario puede corregirlo desde la ficha.
  const { error: errAlta } = await db.from('proveedores').insert({
    cuit,
    razon_social: razon,
    es_proveedor: datos.como === 'proveedor',
    es_cliente: datos.como === 'cliente',
    activo: true,
  })
  if (errAlta) return { ok: false, error: errAlta.message }

  return { ok: true, accion: 'creado', cuit, razon_social: razon }
}
