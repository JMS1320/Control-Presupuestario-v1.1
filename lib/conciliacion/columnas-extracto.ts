/**
 * Las 3 columnas de texto del extracto, armadas en UN solo lugar.
 *
 * La convención está en `MODULO_CONCILIACION.md` § 30.1 y la cerró el usuario el 2026-08-19
 * (→ `PENDIENTES.md` § A-FEAT-31):
 *
 *   proveedor_nombre     → QUIÉN cobró
 *   comprobantes_pagados → QUÉ se pagó (la referencia documental)
 *   detalle              → la ESPECIFICACIÓN, si la hay. Puede quedar vacío.
 *
 * **Los dos primeros datos no se repiten en `detalle`**: ya tienen su columna. Antes el motor
 * derivaba `detalle = "<comprobante> — <proveedor>"`, que es exactamente la duplicación que esta
 * convención prohíbe. Se hacía para que la grilla se leyera (A-BUG-07), pero la grilla ya muestra
 * las dos columnas propias, así que el motivo está saldado.
 *
 * Existe como lib compartida a propósito: hay **4 caminos** que escriben al extracto (motor por
 * Cash Flow, motor por reglas, asignación manual y edición masiva) y hoy no coinciden entre sí.
 * Arreglar cada uno por su lado es reproducir el problema. Se migran de a uno, a medida que
 * aparecen conciliando casos reales — pero todos terminan acá.
 */

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** `Mar 2026` a partir del período. Devuelve `''` si el período no vino. */
export function etiquetaPeriodo(mes?: number | null, anio?: number | null): string {
  if (!mes || !anio) return ''
  return `${MESES_ABREV[Math.min(Math.max(mes, 1), 12) - 1]} ${anio}`
}

/**
 * Referencia documental de un pago de sueldo: **`Haberes <Mes> <Año>`**, distinguiendo si es un
 * pago a cuenta o el del saldo.
 *
 * ⚠️ Vocabulario, corregido por el usuario: lo que el sistema llama `anticipo` **está mal dicho**.
 * De 4 pagos de un mes, 3 son **a cuenta** y el último es el **saldo** — no son "3 anticipos y un
 * sueldo". La columna usa las palabras correctas aunque el campo `tipo` conserve las viejas.
 *
 * Sale del PERÍODO y no de la fecha del pago: abril puede pagarse en junio, y de hecho pasa.
 */
export function comprobanteDeSueldo(
  tipo: string | null | undefined,
  mes?: number | null,
  anio?: number | null,
): string | null {
  const periodo = etiquetaPeriodo(mes, anio)
  if (!periodo) return null
  const sufijo = tipo === 'sueldo' ? 'saldo' : tipo === 'anticipo' ? 'a cuenta' : ''
  return sufijo ? `Haberes ${periodo} — ${sufijo}` : `Haberes ${periodo}`
}

/**
 * Saca de la descripción del pago la parte que **no** es el período, que es la única que aporta
 * algo: `"Anticipo May 2026 - Lucresia"` → `"Lucresia"`.
 *
 * Si después de sacar el período no queda nada, devuelve `null` — un `detalle` vacío es correcto.
 * Si la descripción no tiene la forma esperada (el usuario escribió texto libre), se devuelve
 * **entera**: mejor de más que perder lo que escribió.
 */
export function especificacionDeSueldo(descripcion: string | null | undefined): string | null {
  const d = (descripcion || '').trim()
  if (!d) return null
  // `<Anticipo|Pago Saldo|Pago Francos> <Mes> <Año>` opcionalmente seguido de ` - <resto>`
  const m = d.match(
    /^(?:Anticipo|Pago\s+Saldo|Pago\s+Francos)?\s*(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\w*\s+\d{4}\s*(?:[-–—]\s*)?(.*)$/i,
  )
  if (!m) return d
  const resto = (m[1] || '').trim()
  return resto || null
}

export interface FilaCashFlowMinima {
  nombre_proveedor?: string | null
  comprobante_display?: string | null
  detalle_usuario?: string | null
}

export interface ColumnasExtracto {
  proveedor_nombre: string | null
  comprobantes_pagados: string | null
  detalle: string | null
}

/**
 * Arma las 3 columnas para escribir en el extracto.
 *
 * @param fila               la fila del Cash Flow que matcheó
 * @param nombreDesdeMaestro el nombre resuelto en `public.proveedores`, si el CUIT está ahí
 * @param detalleExistente   lo que el movimiento ya tenía escrito — **nunca se pisa** con nada
 *                           derivado: si el usuario escribió algo, manda
 */
/**
 * 🎭 **A-DAT-54 — un detalle que PARECE del usuario pero lo generó un proceso.**
 *
 * 🧨 Lo destapó el usuario el 2026-09-20: *«me parece que el bug permanece, veo detalles con todo el
 * campo lleno con los datos de proveedor y fc»*. Y tenía razón, pero **el problema no estaba en la
 * conciliación**: el texto `«FC 482 - MASSAGLIA ALDO ENRIQUE»` está guardado **en la propia
 * factura** (`comprobantes_arca.detalle`) — **480 de 530**.
 *
 * 🔑 **Por eso sobrevivió a arreglar los cuatro caminos de la pantalla de asignar**: el motor hace
 * lo correcto —respeta lo que parece escrito a mano— sólo que *eso no lo escribió una persona*.
 * **Es un derivado guardado que después se toma por dato propio**, el mismo patrón que § 30.9.
 *
 * Detecta el patrón `<abrev> <número> - <emisor>` para no propagarlo. **Ante la duda devuelve
 * `false`**: borrar lo que alguien escribió es peor que arrastrar una repetición.
 */
export function pareceDetalleAutogenerado(
  detalle: string | null | undefined,
  emisor: string | null | undefined,
  numero?: string | number | null,
): boolean {
  const d = (detalle ?? '').trim()
  const e = (emisor ?? '').trim()
  if (!d || !e) return false

  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim()
  // Tiene que TERMINAR con el nombre del emisor: si el emisor está en el medio, hay texto propio
  // después y eso hay que conservarlo.
  if (!norm(d).endsWith(norm(e))) return false

  const antes = d.slice(0, d.length - e.length).trim().replace(/[-–—·|]+$/, '').trim()
  // Lo que queda adelante tiene que ser sólo la etiqueta del comprobante: `FC 482`, `T82 12800`.
  // `FC 482`, `NC 15`, `T82 12800` — la abreviatura puede traer dígitos pegados (`T82`).
  if (!/^[A-Za-z]{1,3}\d{0,4}(\s+\d+)?$/.test(antes)) return false
  // Y si se sabe el número, que sea ése.
  if (numero != null && String(numero).trim() && !antes.includes(String(numero).trim())) return false
  return true
}

export function columnasDelExtracto(
  fila: FilaCashFlowMinima,
  nombreDesdeMaestro: string | null,
  detalleExistente?: string | null,
): ColumnasExtracto {
  return {
    // Primero el maestro de proveedores (es el nombre oficial); si el CUIT no está ahí, el de la
    // fila — que para un sueldo es el del empleado, y los empleados no van en `proveedores`.
    proveedor_nombre: nombreDesdeMaestro || fila.nombre_proveedor || null,
    comprobantes_pagados: fila.comprobante_display || null,
    // ⚠️ El `detalle_usuario` de una factura suele ser un **derivado guardado** (A-DAT-54): no se
    //    copia si repite el comprobante y el emisor.
    detalle: detalleExistente?.trim()
      || (pareceDetalleAutogenerado(fila.detalle_usuario, fila.nombre_proveedor)
            ? null
            : fila.detalle_usuario?.trim() || null),
  }
}
