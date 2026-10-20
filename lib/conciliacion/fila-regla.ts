import type { ReglaConciliacion } from "@/types/conciliacion"

/**
 * 🧾 **LO QUE SE GRABA AL CREAR UNA REGLA** (A-BUG-1296, 2026-10-19).
 *
 * El alta arma la fila campo por campo. Al sumar `template_id` (A-FEAT-1293) no se agregó acá y el
 * template elegido **se descartaba en silencio**: la regla quedaba «vieja» (por cuenta) aunque el
 * usuario lo hubiera elegido. Editar sí lo guardaba, porque el update manda el objeto entero.
 * Lo mismo pasaba con `codigo_contable` / `codigo_interno`.
 */
export function filaNuevaRegla(r: Omit<ReglaConciliacion, "id" | "created_at" | "updated_at">) {
  return {
    orden: r.orden,
    tipo: r.tipo,
    columna_busqueda: r.columna_busqueda,
    texto_buscar: r.texto_buscar,
    tipo_match: r.tipo_match,
    categ: r.categ,
    centro_costo: r.centro_costo,
    detalle: r.detalle,
    activo: r.activo,
    llena_template: r.llena_template,
    cuenta_bancaria_id: r.cuenta_bancaria_id,
    template_id: r.template_id ?? null,
    codigo_contable: r.codigo_contable ?? null,
    codigo_interno: r.codigo_interno ?? null,
  }
}
