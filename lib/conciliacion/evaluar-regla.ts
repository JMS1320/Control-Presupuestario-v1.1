/**
 * 🎯 ¿UNA REGLA DE CONCILIACIÓN COINCIDE CON UN MOVIMIENTO? — el único evaluador del motor.
 *
 * Vivía adentro de `hooks/useMotorConciliacion.ts`; salió acá (2026-10-24, A-BUG-1344) para poder
 * probarlo con `npm run probar`.
 *
 * 🧨 **A-BUG-1344 — las reglas por CUIT no coincidían NUNCA.** El motor buscaba el CUIT en
 * `numero_de_comprobante` y `observaciones_cliente`, pero el parseo de extractos lo deja en
 * **`leyendas_adicionales_2`** (la convención de `lib/extractos/parseo-movimiento.ts`). Medido el
 * 2026-10-24, ejercicio 25/26: el CUIT está en `leyendas_adicionales_2` en **462** movimientos de MSA,
 * **49** de PAM cta cte, **5** de PAM caja de ahorro y **32** de MA — y en **cero** de las columnas
 * que miraba el motor. Lo vio el usuario: *«no concilió ni interbancaria ni retiro de MSA, y creo que
 * las reglas están bien escritas»*. Lo estaban.
 *
 * Ahora el CUIT se busca en `leyendas_adicionales_2` y, por si un extracto viejo lo trae en otro
 * lado, también en las dos columnas de antes. Se compara **sin guiones ni puntos** (el banco manda
 * `30617786016`; a mano se suele escribir `30-61778601-6`).
 */

export interface ReglaParaEvaluar {
  columna_busqueda: string
  tipo_match: string
  texto_buscar: string
}

const normalizarCuit = (s: unknown): string => String(s ?? "").replace(/[-.\s]/g, "")

/** Los valores del movimiento que se comparan contra la regla, según la columna. */
export function valoresDeColumna(mov: Record<string, unknown>, columna: string): string[] {
  switch (columna) {
    case "descripcion":
      return [String(mov.descripcion ?? "")]
    case "cuit":
      // La columna de la convención primero; las otras dos, por compatibilidad.
      return [mov.leyendas_adicionales_2, mov.leyendas_adicionales2, mov.numero_de_comprobante, mov.observaciones_cliente]
        .map(normalizarCuit).filter(Boolean)
    case "monto_debito":
      return [String(mov.debitos || 0)]
    case "monto_credito":
      return [String(mov.creditos || 0)]
    default:
      return []
  }
}

function coincide(valor: string, texto: string, tipoMatch: string): boolean {
  const v = valor.toLowerCase()
  const t = texto.toLowerCase()
  switch (tipoMatch) {
    case "exacto": return v === t
    case "contiene": return v.includes(t)
    case "inicia_con": return v.startsWith(t)
    case "termina_con": return v.endsWith(t)
    default: return false
  }
}

export function evaluarReglaConciliacion(mov: Record<string, unknown>, regla: ReglaParaEvaluar): boolean {
  const texto = regla.columna_busqueda === "cuit" ? normalizarCuit(regla.texto_buscar) : regla.texto_buscar
  if (!texto) return false
  return valoresDeColumna(mov, regla.columna_busqueda).some(v => coincide(v, texto, regla.tipo_match))
}
