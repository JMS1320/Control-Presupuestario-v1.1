/**
 * 📎 EL ARCHIVO DIGITAL DE UNA FACTURA — una sola regla para las dos pantallas (A-FEAT-1185).
 *
 * La lógica vivía como una arrow function dentro de `vista-facturas-arca.tsx` (el subdiario). El
 * usuario pidió lo mismo en el **Cash Flow** — *«que en cash flow tmb pueda visualizar la factura
 * como en subdiarios en caso que esté vinculada»* — así que se centraliza acá en vez de copiarse
 * (§ ♻️ *Centralizar, no duplicar* de `CLAUDE.md`): si mañana cambia el criterio, cambia en las dos.
 *
 * 🚦 **LA DISTINCIÓN QUE HACE FALTA, y es la razón de que haya CINCO estados y no tres.**
 * El pedido del usuario fue explícito: *«en caso de no estar debe ser claro que no está y no que
 * salte un bug»*. Y para eso no alcanza con saber si hay PDF: hay que separar **tres maneras
 * distintas de no tener factura**, porque significan cosas opuestas:
 *
 * | Estado | Qué pasó | Cómo se lee |
 * |---|---|---|
 * | `con`       | tiene el PDF archivado                            | ✅ todo bien |
 * | `portal`    | no tiene PDF **pero es de Portal**                | ✅ esperable — esas no llegan por mail |
 * | `falta`     | no tiene PDF **y debería tenerlo**                | 🔴 falta algo, hay que buscarlo |
 * | `sin-factura` | la fila **no nace de una factura** (template, anticipo, sueldo, venta) | ⚪ por diseño, no es un problema |
 * | `grupo`     | la fila son **varias facturas** pagadas juntas     | ⚪ no hay un PDF único |
 *
 * 🛑 **`falta` y `sin-factura` es la frontera que importa.** Las dos se ven como "no hay factura",
 * pero una es un hueco a completar y la otra es lo normal. Mostrarlas igual —con la cruz roja de
 * `falta`— es exactamente lo que hace que el usuario vea un error donde no hay nada mal, y es lo
 * que pidió evitar.
 */

/** Lo mínimo que hace falta saber de una fila para clasificar su archivo digital. */
export interface FilaConArchivo {
  /** URL del PDF en Drive. Vacío o nulo = no está archivado. */
  pdf_drive_url?: string | null
  /** Estado del circuito de archivo. `'Portal'` = se descarga del portal, no llega por mail. */
  fc?: string | null
  /**
   * De dónde nace la fila. Sólo `'ARCA'` corresponde a una factura; el resto **no tiene factura
   * por diseño** y por eso no puede mostrarse como faltante.
   */
  origen?: 'ARCA' | 'TEMPLATE' | 'ANTICIPO' | 'SUELDO' | 'VENTA' | null
  /** Cuántas facturas hay detrás. `> 1` = pago agrupado: no hay un PDF único. */
  facturas_agrupadas?: number | null
}

export type EstadoArchivo = 'con' | 'portal' | 'falta' | 'sin-factura' | 'grupo'

/**
 * Clasifica el archivo digital de una fila.
 *
 * ⚠️ **El orden de las preguntas no es indistinto.** Primero se descarta que la fila tenga factura
 * (`sin-factura`) y que sea un grupo (`grupo`): si se preguntara antes por el PDF, una cuota de
 * template —que nunca va a tener uno— caería en `falta` y saldría en rojo.
 *
 * 📌 `origen` ausente se trata como `'ARCA'`: en el subdiario todas las filas **son** facturas y no
 * mandan ese campo. Así la pantalla que ya funcionaba no cambia de comportamiento.
 */
export function estadoArchivoDigital(fila: FilaConArchivo): EstadoArchivo {
  const origen = fila.origen ?? 'ARCA'
  if (origen !== 'ARCA') return 'sin-factura'
  if ((fila.facturas_agrupadas ?? 1) > 1) return 'grupo'
  if (fila.pdf_drive_url) return 'con'
  return fila.fc === 'Portal' ? 'portal' : 'falta'
}

/** Ícono, color y explicación de cada estado — para que las dos pantallas se vean igual. */
export const PRESENTACION_ARCHIVO: Record<EstadoArchivo, { icono: string; clase: string; titulo: string }> = {
  'con': {
    icono: '📎',
    clase: 'text-green-600',
    titulo: 'Ver la factura (PDF en Drive)',
  },
  'portal': {
    icono: '🌐',
    clase: 'text-gray-400',
    titulo: 'De Portal — no se archiva por mail, se baja del portal del proveedor',
  },
  'falta': {
    icono: '❌',
    clase: 'text-red-600',
    titulo: 'Falta el PDF en el archivo digital — esta factura debería tenerlo',
  },
  'sin-factura': {
    icono: '–',
    clase: 'text-gray-300',
    titulo: 'Esta fila no viene de una factura (es un template, un anticipo, un sueldo o una venta), así que no le corresponde tener una',
  },
  'grupo': {
    icono: '⧉',
    clase: 'text-blue-500',
    titulo: 'Pago agrupado: son varias facturas juntas. Abrí el grupo para ver cada una',
  },
}
