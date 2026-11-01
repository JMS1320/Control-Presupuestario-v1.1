/**
 * 🧾🏦 **EL ECHEQ DE UN DÉBITO** — A-FEAT-1476 (A-DEC-17; OK de JMS 01/11: *«sí, empezá con eso»*).
 *
 * JMS 01/11: *«si una factura se paga con cheque, los cheques quedan vinculados a la factura… se van conciliando los
 * cheques como si fueran transferencias»*. El motor buscaba sólo contra el Cash Flow, y un echeq muchas veces no tiene
 * fila ahí (el anticipo que paga ya está vinculado a su factura: caso Eduardo Castillo, echeq 102, $ 1.455.755,70). Acá
 * se busca el débito directo contra los echeqs VIGENTES, con la misma regla que el recorrido del balance
 * (`cruzarChequesConDebitos`):
 *   - **por NÚMERO** (el que trae el banco: «Echeq 48 Hs. Nro. 102») + importe exacto → seguro: se concilia;
 *   - **por IMPORTE** exacto, sin número que lo confirme, y debitado entre 3 días antes y **30 días después** de la fecha
 *     pactada (JMS: «se puede pagar hasta 30 días después») → a auditar, nunca solo.
 *
 * Al conciliar, el movimiento queda atado a la factura / anticipo del echeq, y el echeq pasa a «cobrado» con la fecha
 * real del débito (lo hace el trigger del script 144, venga de donde venga la conciliación).
 */
import { cruzarChequesConDebitos, numeroEnDescripcion } from "@/lib/conciliacion/cheques-vencidos"

export interface ChequeVigente {
  id: string
  numero: string | null
  monto: number
  fecha_cobro: string | null
  beneficiario_nombre: string | null
  beneficiario_cuit?: string | null
  factura_id: string | null
  anticipo_id: string | null
  concepto?: string | null
}

export interface EcheqDelDebito {
  cheque: ChequeVigente
  por: "numero" | "importe"
  /** Días entre la fecha pactada y la del débito (positivo = se debitó después). */
  desvioDias: number | null
}

/** Ventana para el cruce por importe: 3 días antes y 30 después de la fecha pactada. */
export const DIAS_ANTES = 3
export const DIAS_DESPUES = 30

const diasEntre = (desde?: string | null, hasta?: string | null) =>
  !desde || !hasta ? null : Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000)

/** ¿La descripción del banco es de un cheque? */
export const esDebitoDeCheque = (descripcion: string | null | undefined) => /echeq|cheque/i.test(descripcion ?? "")

/** Pura: el echeq vigente que corresponde a este débito, o `null`. */
export function echeqDelDebito(
  mov: { id: string; fecha: string; debitos: number | null; descripcion: string | null },
  cheques: ChequeVigente[],
): EcheqDelDebito | null {
  const debitos = Number(mov.debitos) || 0
  if (debitos <= 0 || !esDebitoDeCheque(mov.descripcion)) return null
  const cruces = cruzarChequesConDebitos(cheques, [{ tabla: "", cuentaId: "", id: mov.id, fecha: mov.fecha, debitos, descripcion: mov.descripcion ?? "", estado: "" }])
  const porNumero = cruces.find(c => c.debito && c.por === "numero")
  if (porNumero) return { cheque: porNumero.cheque as ChequeVigente, por: "numero", desvioDias: diasEntre(porNumero.cheque.fecha_cobro, mov.fecha) }
  // Por importe: sólo dentro de la ventana, y si el banco trae un número, el cheque no puede tener OTRO.
  const nroBanco = numeroEnDescripcion(mov.descripcion ?? "")
  // (Se filtra acá y no con el cruce: el cruce le da el débito al primero, y con dos iguales hay que NO elegir.)
  const candidatos = cheques.filter(ch => {
    if (Math.abs((Number(ch.monto) || 0) - debitos) >= 0.01) return false
    const d = diasEntre(ch.fecha_cobro, mov.fecha)
    if (d == null || d < -DIAS_ANTES || d > DIAS_DESPUES) return false
    const propio = (ch.numero ?? "").replace(/^0+/, "")
    return !propio || !nroBanco || propio === nroBanco
  })
  // Dos cheques del mismo importe en la ventana: no se adivina.
  if (candidatos.length !== 1) return null
  const ch = candidatos[0]
  return { cheque: ch, por: "importe", desvioDias: diasEntre(ch.fecha_cobro, mov.fecha) }
}

/** El texto del desvío entre la fecha pactada y la real («debitado 4 días después de lo pactado»). */
export function textoDesvio(desvioDias: number | null): string {
  if (desvioDias == null || desvioDias === 0) return "debitado el día pactado"
  return desvioDias > 0 ? `debitado ${desvioDias} día(s) después de lo pactado` : `debitado ${-desvioDias} día(s) antes de lo pactado`
}
