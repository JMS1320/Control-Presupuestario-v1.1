/**
 * 🏷️ **LOS CÓDIGOS CONTABLE / INTERNO DE UN TEMPLATE NUEVO** (A-FEAT-1302 punto 2, 2026-10-20).
 *
 * Los códigos de un template (Desglosar, No Lleva, RET 3 PAM…) no viven en el template: son reglas
 * «Tipo A» de `reglas_contable_interno`, por **cuenta bancaria + template_id**. Un template nuevo nace
 * con otro id, así que sin copiarlas concilia con contable e interno **vacíos** — el mismo hueco que el
 * generador de campañas ya cubre copiándolas (`generador-renovacion-campana.tsx` § 1.b).
 *
 * El asistente las arma así (pedido del usuario: *«que se puedan poner en el asistente, o copiar con
 * Parecido a…»*):
 * 1. Las del template **de origen** («Parecido a…» o la campaña anterior), en todas sus cuentas.
 * 2. Lo que se escriba a mano **pisa** la de la cuenta que paga (si se abrió desde el extracto).
 *    Campo vacío = se usa la copiada (§ 🎚️ default del dato real, siempre editable).
 */
export interface ReglaCodigo {
  cuenta_bancaria_id: string
  codigo_contable: string | null
  codigo_interno: string | null
  descripcion?: string | null
  orden?: number | null
  activo?: boolean | null
}

export function reglasDelTemplateNuevo(opts: {
  origen: ReglaCodigo[]
  templateId: string
  cuentaBancariaId?: string
  contable?: string
  interno?: string
}): (ReglaCodigo & { tipo_regla: "especifica"; template_id: string })[] {
  const { origen, templateId, cuentaBancariaId } = opts
  const contable = (opts.contable ?? "").trim()
  const interno = (opts.interno ?? "").trim()
  const porCuenta = new Map<string, ReglaCodigo>()
  for (const r of origen) if (r.activo !== false && !porCuenta.has(r.cuenta_bancaria_id)) porCuenta.set(r.cuenta_bancaria_id, r)
  if (cuentaBancariaId && (contable || interno)) {
    const previa = porCuenta.get(cuentaBancariaId)
    porCuenta.set(cuentaBancariaId, {
      cuenta_bancaria_id: cuentaBancariaId,
      codigo_contable: contable || previa?.codigo_contable || null,
      codigo_interno: interno || previa?.codigo_interno || null,
      descripcion: previa?.descripcion ?? null,
      orden: previa?.orden ?? null,
    })
  }
  return [...porCuenta.values()]
    .filter(r => (r.codigo_contable ?? "").trim() || (r.codigo_interno ?? "").trim())
    .map(r => ({
      cuenta_bancaria_id: r.cuenta_bancaria_id,
      codigo_contable: r.codigo_contable ?? null,
      codigo_interno: r.codigo_interno ?? null,
      descripcion: r.descripcion ?? null,
      orden: r.orden ?? 0,
      activo: true,
      tipo_regla: "especifica" as const,
      template_id: templateId,
    }))
}

/**
 * 🏷️ **A-FEAT-1311 — la cuenta del template, al plan de cuentas EN EL MISMO PASO.**
 *
 * La regla de `CLAUDE.md` § 🏷️ pide que la cuenta de un template exista en el plan con su tipo. El
 * asistente avisaba «no está en el plan, conviene darla de alta» pero no ofrecía cómo: el usuario no
 * podía hacerlo (usuario 2026-10-20: *«no debería ser en 2 pasos esto, es una regla, debe ser algo fácil»*).
 * Ahora el asistente la da de alta al guardar, con el TIPO del template y la AGRUPADORA como totalizadora
 * (en mayúsculas, como las del plan: «Impuestos Bancarios» → «IMPUESTOS BANCARIOS»).
 */
export function filaDelPlanParaTemplate(opts: { categ: string; tipo: string; agrupadora?: string | null }) {
  const categ = opts.categ.trim()
  const agrupadora = (opts.agrupadora ?? "").trim()
  return {
    categ,
    cuenta_contable: categ,
    tipo: opts.tipo || "egreso",
    activo: true,
    imputable: true,
    nombre_totalizadora: agrupadora ? agrupadora.toUpperCase() : null,
  }
}
