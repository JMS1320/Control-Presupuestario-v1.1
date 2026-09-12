/**
 * 🪪 **A-FEAT-137 — el identificador de una cuota se GENERA; el detalle se guarda.**
 *
 * Enunciado por el usuario el 2026-09-12, y es la regla entera:
 * > *«Detalle es detalle y descripción es lo que es un identificador.»*
 *
 * ## El patrón no es nuevo: es el de las facturas ARCA
 * `useMultiCashFlowData` ya lo hace desde antes, y bien:
 *
 * ```ts
 * detalle: f.detalle ? `${generarDetalleBase(f)} · ${f.detalle}` : generarDetalleBase(f)
 * ```
 *
 * `generarDetalleBase()` **construye** `FC A 0001-000123 - LUMINATUS SA` a partir de campos
 * estructurados —no lo lee de ninguna columna— y `f.detalle` guarda **sólo lo que escribió el
 * usuario**. Los dos se **componen al mostrar**.
 *
 * ## ⚠️ Por qué NO se copia el identificador al detalle cuando está vacío
 * Era la duda del usuario: *«el tema es que detalle se debería llenar con descripción si no hay
 * nada, entonces es como un bucle»*. **No hace falta, y además hace daño.** Si `detalle` está
 * vacío, `detalleCompleto()` muestra sólo el identificador — el usuario ve lo mismo que si se
 * hubiera copiado, sin ninguno de los dos costos:
 *
 * 1. **Copiar borra la distinción.** Una vez copiado, nadie puede decir si ese texto lo escribió
 *    una persona o lo armó el sistema. Y esa diferencia es la que decide si se puede pisar.
 * 2. **Copiar congela.** El identificador cambia solo cuando cambia el nombre del template, el
 *    responsable o el período. Copiado, queda adentro del detalle la versión vieja, para siempre.
 *    Es el mismo error que un `id` de template hardcodeado, que en este proyecto ya rompió dos
 *    cosas al renovar una campaña.
 *
 * 🔑 **Un dato derivado no se guarda: se deriva.** Guardarlo es cambiar «siempre correcto» por
 * «correcto el día que se escribió».
 *
 * ## De dónde sale cada pedazo
 * Todo estaba ya en la cuota y su template — por eso «generarlo» no costó una columna nueva:
 *
 * | Pedazo | Origen |
 * |---|---|
 * | nombre | `egresos_sin_factura.nombre_referencia` |
 * | responsable | `egresos_sin_factura.responsable` — **se omite si el nombre ya lo contiene** |
 * | período | mes y año de `cuotas_egresos_sin_factura.fecha_estimada` |
 *
 * ⚠️ Lo de omitir el responsable no es cosmético: pasa en **20 templates activos** que llevan la
 * empresa en el propio nombre, y sin eso sale *«Tarjeta Visa Business MSA **MSA** - Agosto 2026»*.
 * La regla ya estaba resuelta en `generador-renovacion-campana.tsx`; acá se centraliza para que
 * **la etiqueta que genera la campaña y la que se muestra sean la misma** (§ ♻️ Centralizar).
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Lo mínimo que hace falta de la cuota. */
export interface CuotaParaIdentificar {
  fecha_estimada?: string | null
  numero_cuota?: number | null
}

/** Lo mínimo que hace falta del template. */
export interface TemplateParaIdentificar {
  nombre_referencia?: string | null
  responsable?: string | null
}

/** El separador entre identificador y detalle. El mismo que usa el Cash Flow para ARCA. */
export const SEP = ' · '

/**
 * `"UATRE MSA - Septiembre 2026"`.
 *
 * Devuelve `''` si no hay nombre — nunca una etiqueta a medias como `" - Septiembre 2026"`, que
 * parece un dato roto en vez de un dato ausente.
 */
export function identificadorDeCuota(
  cuota: CuotaParaIdentificar,
  template: TemplateParaIdentificar,
): string {
  const nombre = String(template?.nombre_referencia ?? '').trim()
  if (!nombre) return ''

  const resp = String(template?.responsable ?? '').trim()
  // El responsable NO se repite si el nombre ya lo lleva ("Tarjeta Visa Business MSA").
  const yaLoTiene = resp !== '' && nombre.toUpperCase().includes(resp.toUpperCase())
  const encabezado = (yaLoTiene || resp === '') ? nombre : `${nombre} ${resp}`

  const f = String(cuota?.fecha_estimada ?? '').slice(0, 10)
  const [y, m] = f.split('-').map(Number)
  const periodo = (y && m && m >= 1 && m <= 12) ? `${MESES[m - 1]} ${y}` : ''

  return (periodo ? `${encabezado} - ${periodo}` : encabezado).replace(/\s+/g, ' ').trim()
}

/**
 * Lo que se muestra: **identificador · detalle**, con lo que haya.
 *
 * - con las dos → `"UATRE MSA - Septiembre 2026 · 1.740 Kg maíz"`
 * - sin detalle → `"UATRE MSA - Septiembre 2026"`
 * - sin identificador (falta el nombre) → el detalle solo
 * - sin nada → `''`
 *
 * 📌 **Nunca duplica.** Si el detalle **ya empieza con el identificador** —porque venía copiado de
 * antes de esta separación, que es justo el estado de las 436 filas de [A-DAT-37]— se muestra el
 * detalle solo. Sin esto, el período aparecería dos veces en la misma línea mientras dure la
 * migración, y se leería como un bug nuevo.
 */
export function detalleCompleto(
  cuota: CuotaParaIdentificar,
  template: TemplateParaIdentificar,
  detalle?: string | null,
): string {
  const id = identificadorDeCuota(cuota, template)
  const d = String(detalle ?? '').trim()
  if (!d) return id
  if (!id) return d
  if (d.toLowerCase().startsWith(id.toLowerCase())) return d
  return `${id}${SEP}${d}`
}

/**
 * ¿Este texto de `descripcion` es el identificador generado, o es algo que escribió el usuario?
 *
 * La usa la migración ([A-DAT-37](../../PENDIENTES.md#a-dat-37)) para repartir las 543 filas
 * existentes **sin decidir a ojo**: lo que reproduce exactamente el identificador se puede vaciar,
 * porque se regenera solo; todo lo demás es del usuario y va a `detalle`.
 *
 * ⚠️ **Ante la duda dice `false`** — o sea, «es del usuario». El sesgo es deliberado: equivocarse
 * hacia este lado deja un texto redundante a la vista, que se corrige mirando; equivocarse hacia el
 * otro **borra algo que escribió una persona**, y eso no se recupera.
 */
export function esElIdentificadorGenerado(
  descripcion: string | null | undefined,
  cuota: CuotaParaIdentificar,
  template: TemplateParaIdentificar,
): boolean {
  const d = String(descripcion ?? '').trim()
  if (!d) return false
  const id = identificadorDeCuota(cuota, template)
  if (!id) return false
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim()
  return norm(d) === norm(id)
}
