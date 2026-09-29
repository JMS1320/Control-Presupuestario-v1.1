/**
 * 🔗 **LAS TABLAS QUE GUARDAN UN VÍNCULO A UNA FACTURA DE ARCA — una sola lista.**
 *
 * Nace 2026-09-29 con la § 🔁 *La propagación del dato* de `CLAUDE.md`, y con el bug que la originó
 * ([A-BUG-1221](../../PENDIENTES.md#a-bug-1221)): la lista de tablas a las que hay que propagar la
 * cuenta contable estaba **escrita a mano en dos archivos** y nombraba **3 de las 10**. Una tabla ya
 * tenía 7 movimientos enganchados que nunca la recibieron.
 *
 * ## Por qué una constante y no un `grep` cada vez
 *
 * Porque el grafo del código **no puede ver esto**: el nombre de una tabla es un string, y la mitad
 * de las veces una variable de un `for`. Medido el 2026-09-29: el índice tiene 178 aristas `WRITES`
 * y **ninguna** apunta a una tabla. Entonces la única forma de que «¿a dónde más va este dato?» tenga
 * una respuesta confiable es **escribirla una vez y hacer que todos la importen**.
 *
 * ## 🛑 Cómo se verifica que esta lista sigue completa
 *
 * **No se confía en ella: se contrasta contra la base.** La pregunta la contesta el catálogo, no
 * este archivo:
 *
 * ```sql
 * select table_schema, table_name from information_schema.columns
 * where column_name = 'comprobante_arca_id' order by 1,2;
 * ```
 *
 * Si aparece una tabla que no está acá, **la lista quedó vieja** — y eso es exactamente lo que va a
 * chequear el control de [A-FEAT-1194]. Una tabla nueva con el vínculo y sin entrada acá es un hueco
 * que hoy nadie ve.
 *
 * 📌 **Estado al 2026-09-29** (10 tablas, medido en la base): `public.msa_galicia` con **164**
 * movimientos enganchados y `msa.tarjeta_visa_business` con **7**; las otras ocho en cero, pero el
 * día que se enganche una, si no está acá, no recibe nada **y nadie se entera**.
 */

/** Una tabla que puede llevar el vínculo, con el schema en el que vive. */
export interface TablaConVinculoArca {
  /** Schema de Postgres. `public` va sin prefijo en supabase-js. */
  schema: "public" | "msa" | "pam" | "ma"
  tabla: string
  /** Para qué sirve, en el lenguaje de la app. Ayuda a entender qué se rompe si falta. */
  que: string
}

/**
 * Las diez tablas que llevan `comprobante_arca_id`, en el orden en que importan.
 *
 * ⚠️ **`mails_pago` NO está** aunque tenga la columna: no es un movimiento de plata, es la cola de
 * mails al proveedor. Propagarle una cuenta contable no significa nada.
 */
export const TABLAS_CON_VINCULO_ARCA: TablaConVinculoArca[] = [
  { schema: "public", tabla: "msa_galicia", que: "extracto de la cuenta corriente de MSA" },
  { schema: "public", tabla: "pam_galicia", que: "extracto de la caja de ahorro de PAM" },
  { schema: "public", tabla: "pam_galicia_cc", que: "extracto de la cuenta corriente de PAM" },
  { schema: "ma", tabla: "ma_galicia", que: "extracto de MA" },
  { schema: "msa", tabla: "tarjeta_visa_business", que: "resumen de la tarjeta de MSA" },
  { schema: "pam", tabla: "tarjeta_visa", que: "resumen de la tarjeta de PAM" },
  { schema: "ma", tabla: "tarjeta_visa", que: "resumen de la tarjeta de MA" },
  { schema: "msa", tabla: "caja_general", que: "caja general" },
  { schema: "msa", tabla: "caja_ams", que: "caja de AMS" },
  { schema: "msa", tabla: "caja_sigot", que: "caja de Sigot" },
]

/** La columna del vínculo. Se nombra una vez para que un `grep` por ella encuentre todo. */
export const COLUMNA_VINCULO_ARCA = "comprobante_arca_id"
