/**
 * 💵 **LOS VALORES AL CIERRE — los bloques que les faltaban a los papeles 03 y 04 (A-FEAT-1195).**
 *
 * `cuentas-al-cierre.ts` armó el cuerpo de los dos papeles: el listado de comprobantes impagos.
 * Pero los papeles que él mandó el año pasado tienen **cuatro bloques más**, y sin ellos el número
 * de deuda y de crédito al cierre está incompleto:
 *
 * | Papel | Bloque | De dónde sale |
 * |---|---|---|
 * | **04.1** | Cheques dados y diferidos **no debitados** al cierre | `<empresa>.cheques` |
 * | **04.2** | Anticipos a proveedores con saldo al cierre | `anticipos_proveedores` (`tipo = pago`) |
 * | **03.1** | Provisión de **cobros** | el libro: ventas con fecha ≤ cierre y subdiario posterior |
 * | **03.1** | Cheques **en cartera** | 🚫 **no existe en el sistema** — ver abajo |
 *
 * ## 🔑 La regla que gobierna los bloques nuevos es la MISMA del papel 03/04
 *
 * **El estado de hoy no contesta la pregunta del cierre.** Ya se aprendió con los comprobantes
 * (*«una factura que hoy figura paga pero se pagó después del cierre, al cierre era deuda»*), y acá
 * vuelve a pasar **dos veces**:
 *
 * 1. 🧨 **El `estado` de los cheques no se mantiene.** Medido el 2026-09-30 sobre MSA: **los 10
 *    cheques figuran `vigente`**, incluidos los que se debitaron en abril y mayo. Si el papel
 *    preguntara por el estado, listaría como *«no debitado»* todo lo que se pagó hace medio año.
 *    **Manda `fecha_cobro`** — la fecha en que debita en la cuenta.
 * 2. 🧨 **`monto_restante` de un anticipo es la foto de HOY.** Un anticipo que hoy está consumido
 *    pudo tener saldo al 30/06. El saldo al cierre **se recalcula** con las aplicaciones que
 *    existían a esa fecha; `monto_restante` no se usa para el papel — se usa como **control**.
 *
 * ## 🧮 El control del camino inverso, que además destapó la fórmula correcta
 *
 * Recalcular el saldo **a hoy** tiene que dar exactamente `monto_restante`: son dos caminos
 * independientes al mismo número (§ 🧮 de `CLAUDE.md`, *el mejor control es el camino inverso*).
 *
 * Y la primera versión **no cerraba en 5 de 32 anticipos**. No era un error de datos: faltaba un
 * término. Un anticipo se consume por **tres** vías, no una:
 *
 * ```
 * saldo = monto − aplicaciones a facturas − retención de SICORE − descuento
 * ```
 *
 * Los 5 descuadres daban **exactamente** `monto_sicore` (SJC ENERGY $87.916,03 · Grupo Campo
 * $14.720,00 · La Mercure $20.352,47 · Biscayart $45.810,20 · STRINGHINI $11.766,60). O sea: la
 * plata que se le retuvo al proveedor **también consume el anticipo**, porque el anticipo se pagó
 * bruto y se transfirió neto. Sin ese término el papel habría inventado saldo a favor.
 *
 * ## 🧨 `tipo`: `pago` es un anticipo A PROVEEDOR; `cobro` es un anticipo DE UN CLIENTE
 *
 * **Y es la diferencia entre un activo y un pasivo.** La tabla se llama `anticipos_proveedores`,
 * pero guarda las dos cosas. Al 30/06/2026, de los $147,2 M con saldo, **$131,5 M son `cobro`** —
 * casi todo de **Pedro Genta y Cía** ($116,4 M en una sola fila del 26/02). Meterlos en el bloque de
 * anticipos a proveedores habría puesto **$131,5 M de plata que se debe** en la columna de la plata
 * que se tiene a favor.
 *
 * Por eso salen **separados** y cada uno con su nombre. Y los de `tipo` desconocido no se reparten:
 * van a su propia lista (§ 🧮 *nada se descarta en silencio*).
 *
 * ## ⚠️ `empresa` viene en NULL en 15 de 38 anticipos
 *
 * La columna se agregó después, así que las filas viejas no la tienen: al cierre son **$137,4 M sin
 * empresa asignada**. Filtrar por `empresa = 'MSA'` los habría hecho desaparecer **sin una sola
 * advertencia**, que es el modo de falla que más veces apareció en este proyecto.
 *
 * Criterio, y es declarado, no silencioso: **en el papel de MSA entran, marcados `(sin empresa)`**
 * —el módulo de anticipos nació siendo de MSA y las filas viejas son de ahí—; en PAM y MA **no
 * entran**, y el papel dice cuántas quedaron afuera. → `A-DAT-73`.
 *
 * ## 🚫 Cheques EN CARTERA: no hay de dónde sacarlos, y eso también se informa
 *
 * `cheques` existe **sólo en el schema `msa`** y guarda **los que emitimos** (el beneficiario es el
 * proveedor). **No hay ninguna tabla de valores recibidos de clientes**, así que el bloque no se
 * puede calcular. El papel del año pasado se llama, textual,
 * *«CUENTAS A COBRAR - prov cobros - ch en cartera - **no habia**»*: el año pasado tampoco hubo.
 *
 * 📌 **Se muestra el bloque diciendo que no hay registro**, en vez de omitirlo: un bloque ausente se
 * lee como *«no había»*, y *«no había»* y *«no lo sabemos»* no son lo mismo. → `A-DAT-74`.
 */

/** Una fila de `<empresa>.cheques`, tal como viene. */
export interface ChequeCrudo {
  id?: string
  numero: string | null
  banco: string | null
  monto: number | null
  moneda?: string | null
  fecha_emision: string | null
  /** Cuándo debita en la cuenta. **Es el dato que decide**, no el estado. */
  fecha_cobro: string | null
  beneficiario_nombre: string | null
  beneficiario_cuit?: string | null
  estado?: string | null
  concepto?: string | null
  factura_id?: string | null
  anticipo_id?: string | null
}

/** Por qué un cheque quedó en el papel. Se muestra: el criterio tiene que ser auditable. */
export type MotivoCheque =
  | "emitido antes del cierre y debitado después"
  | "emitido antes del cierre y sin fecha de débito"

export interface ChequeAlCierre {
  cheque: ChequeCrudo
  motivo: MotivoCheque
}

export interface ChequesDados {
  /** Los que al cierre estaban emitidos y todavía no habían debitado. */
  filas: ChequeAlCierre[]
  total: number
  /**
   * Emitidos antes del cierre y **sin fecha de débito**: no se puede afirmar si debitaron.
   * Se listan aparte con su total — nunca se descartan en silencio.
   */
  sinFechaDeDebito: ChequeAlCierre[]
  totalSinFecha: number
  /** Cuántos se descartaron **con certeza** porque debitaron antes del cierre. Cierra el conteo. */
  debitadosAntes: number
  /** Cuántos son posteriores al cierre (de otro ejercicio). */
  posteriores: number
  /** Avisos que no frenan nada pero hay que ver (§ 🚦 *avisa y deja seguir*). */
  avisos: string[]
  mirados: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null)
const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

/**
 * 💳 **Papel 04.1 — cheques dados y diferidos no debitados al cierre.**
 *
 * @param cheques      los de la empresa (la tabla vive en su schema)
 * @param fechaCierre  `AAAA-MM-DD`
 * @param hoy          para el aviso de estados sin actualizar. Se pasa para poder probarlo
 */
export function armarChequesDados(
  cheques: ChequeCrudo[],
  fechaCierre: string,
  hoy: string,
): ChequesDados {
  const filas: ChequeAlCierre[] = []
  const sinFechaDeDebito: ChequeAlCierre[] = []
  let debitadosAntes = 0
  let posteriores = 0

  for (const c of cheques) {
    const emision = dia(c.fecha_emision)
    // Sin fecha de emisión no se puede ubicar: se trata como candidato y se avisa (ver abajo).
    if (emision && emision > fechaCierre) { posteriores += 1; continue }

    const cobro = dia(c.fecha_cobro)
    if (!cobro) {
      sinFechaDeDebito.push({ cheque: c, motivo: "emitido antes del cierre y sin fecha de débito" })
      continue
    }
    if (cobro <= fechaCierre) { debitadosAntes += 1; continue }
    filas.push({ cheque: c, motivo: "emitido antes del cierre y debitado después" })
  }

  const sumar = (f: ChequeAlCierre[]) => r2(f.reduce((s, x) => s + (x.cheque.monto ?? 0), 0))

  /**
   * 🚦 Los avisos. **Ninguno frena**: son cosas que el dato dice y alguien tiene que mirar, no
   * contradicciones internas del papel (§ 🚦 de `CLAUDE.md`).
   */
  const avisos: string[] = []

  /**
   * 🧨 El estado no se mantiene: un cheque `vigente` con la fecha de débito ya pasada. El papel no
   * lo usa —manda la fecha—, pero **la pantalla de cheques sí lo muestra**, y ahí miente.
   */
  const vigentesYaDebitados = cheques.filter(c => {
    const cobro = dia(c.fecha_cobro)
    return (c.estado ?? "").toLowerCase() === "vigente" && cobro != null && cobro < hoy
  })
  if (vigentesYaDebitados.length > 0) {
    avisos.push(
      `${vigentesYaDebitados.length} cheque(s) figuran «vigente» con la fecha de débito ya pasada. `
      + "El papel no usa el estado (manda la fecha de débito), pero el estado está sin actualizar.",
    )
  }

  /** Dos cheques con el mismo número en el mismo banco: o se repitió al cargar, o falta un dato. */
  const porNumero = new Map<string, number>()
  for (const c of cheques) {
    if (!c.numero) continue
    const k = `${(c.banco ?? "").trim()}|${String(c.numero).trim()}`
    porNumero.set(k, (porNumero.get(k) ?? 0) + 1)
  }
  const repetidos = [...porNumero.entries()].filter(([, n]) => n > 1).map(([k]) => k.split("|")[1])
  if (repetidos.length > 0) {
    avisos.push(`Número de cheque repetido en el mismo banco: ${repetidos.join(", ")}.`)
  }

  const sinEmision = cheques.filter(c => !dia(c.fecha_emision)).length
  if (sinEmision > 0) {
    avisos.push(`${sinEmision} cheque(s) sin fecha de emisión: se los trató como anteriores al cierre.`)
  }

  return {
    filas: filas.sort((a, b) =>
      (dia(a.cheque.fecha_cobro) ?? "").localeCompare(dia(b.cheque.fecha_cobro) ?? "")),
    total: sumar(filas),
    sinFechaDeDebito,
    totalSinFecha: sumar(sinFechaDeDebito),
    debitadosAntes,
    posteriores,
    avisos,
    mirados: cheques.length,
  }
}

/** Una fila de `public.anticipos_proveedores`. */
export interface AnticipoCrudo {
  id: string
  /** ⚠️ Puede venir `null`: la columna se agregó después. Ver la § del encabezado. */
  empresa: string | null
  nombre_proveedor: string | null
  cuit_proveedor: string | null
  monto: number | null
  /** La foto de HOY. **No se usa para el papel**: sólo como control del camino inverso. */
  monto_restante: number | null
  /** La retención que se le practicó al pagar el anticipo. **También consume el anticipo.** */
  monto_sicore?: number | null
  descuento_aplicado?: number | null
  fecha_pago: string | null
  /** `pago` = anticipo a un proveedor (activo) · `cobro` = anticipo de un cliente (pasivo). */
  tipo: string | null
  estado?: string | null
  estado_pago?: string | null
  descripcion?: string | null
}

/** Una fila de `public.anticipos_facturas`: el anticipo consumiéndose contra una factura. */
export interface AplicacionDeAnticipo {
  anticipo_id: string
  monto_aplicado: number | null
  /**
   * ⚠️ Es un `timestamp` sin zona. Se compara por día (`slice(0,10)`) y **puede estar corrido si se
   * grabó con `toISOString()` después de las 21:00** hora argentina → `A-OP-23`.
   */
  fecha_aplicacion: string | null
}

export interface AnticipoAlCierre {
  anticipo: AnticipoCrudo
  /** Lo que se había aplicado a facturas **hasta la fecha de cierre**. */
  aplicadoAlCierre: number
  /** Lo que se aplicó después: es la razón de que la foto de hoy no sirva. */
  aplicadoDespues: number
  /** `monto − aplicado al cierre − SICORE − descuento`. Es el número del papel. */
  saldoAlCierre: number
  /** `true` si la fila no tiene empresa asignada. Se marca en el papel. */
  sinEmpresa: boolean
}

/** Un anticipo donde los dos caminos al saldo de hoy no dan lo mismo. */
export interface DescuadreAnticipo {
  nombre: string
  monto: number
  /** Lo que dice la columna. */
  guardado: number
  /** Lo que da recalcular: `monto − todas las aplicaciones − SICORE − descuento`. */
  recalculado: number
  diferencia: number
}

export interface AnticiposAlCierre {
  /** `tipo = pago`: plata adelantada a un proveedor. Es un **activo** al cierre. */
  aProveedores: AnticipoAlCierre[]
  totalAProveedores: number
  /** `tipo = cobro`: plata que un cliente adelantó. Es un **pasivo** al cierre. */
  deClientes: AnticipoAlCierre[]
  totalDeClientes: number
  /** Sin `tipo` reconocido: no se reparten a ninguno de los dos lados. */
  sinTipo: AnticipoAlCierre[]
  totalSinTipo: number
  /** Cuántas filas entraron sin empresa asignada, y cuánto pesan. */
  sinEmpresa: number
  totalSinEmpresa: number
  /** Cuántas quedaron **afuera** por ser de otra empresa (o por no tener, según el criterio). */
  deOtraEmpresa: number
  /** 🧮 El control: recalcular a hoy tiene que dar `monto_restante`. */
  descuadres: DescuadreAnticipo[]
  /** Los `tipo` que no se reconocieron, para poder agregarlos. */
  tiposSinClasificar: string[]
  avisos: string[]
  /** Cuántos anticipos de esta empresa existían al cierre. Cierra el conteo. */
  mirados: number
}

/**
 * 💰 **Papeles 04.2 y 03.2 — anticipos con saldo al cierre.**
 *
 * @param anticipos     los de `anticipos_proveedores` (la tabla es de `public`, se filtra acá)
 * @param aplicaciones  las de `anticipos_facturas`
 * @param fechaCierre   `AAAA-MM-DD`
 * @param empresa       `MSA` / `PAM` / `MA`
 * @param nullEsDeEstaEmpresa  si las filas **sin empresa** se cuentan como de ésta. Ver el encabezado
 */
export function armarAnticiposAlCierre(
  anticipos: AnticipoCrudo[],
  aplicaciones: AplicacionDeAnticipo[],
  fechaCierre: string,
  empresa: string,
  nullEsDeEstaEmpresa: boolean,
): AnticiposAlCierre {
  /** Las aplicaciones agrupadas por anticipo, partidas por el cierre. */
  const porAnticipo = new Map<string, { hasta: number; despues: number }>()
  for (const ap of aplicaciones) {
    if (!ap.anticipo_id) continue
    const acc = porAnticipo.get(ap.anticipo_id) ?? { hasta: 0, despues: 0 }
    const f = dia(ap.fecha_aplicacion)
    const monto = ap.monto_aplicado ?? 0
    // 🔑 Una aplicación **sin fecha** se cuenta como anterior al cierre: es lo conservador para el
    //    papel (baja el saldo, no lo infla). Si apareciera alguna, la delata el control de abajo.
    if (!f || f <= fechaCierre) acc.hasta += monto
    else acc.despues += monto
    porAnticipo.set(ap.anticipo_id, acc)
  }

  const aProveedores: AnticipoAlCierre[] = []
  const deClientes: AnticipoAlCierre[] = []
  const sinTipo: AnticipoAlCierre[] = []
  const descuadres: DescuadreAnticipo[] = []
  const tiposSinClasificar = new Set<string>()
  let deOtraEmpresa = 0
  let mirados = 0

  for (const a of anticipos) {
    const suya = a.empresa ? a.empresa.toUpperCase() === empresa.toUpperCase() : nullEsDeEstaEmpresa
    if (!suya) { deOtraEmpresa += 1; continue }

    /** Un anticipo pagado **después** del cierre no existía al cierre. */
    const fp = dia(a.fecha_pago)
    if (fp && fp > fechaCierre) continue
    mirados += 1

    const apl = porAnticipo.get(a.id) ?? { hasta: 0, despues: 0 }
    const monto = a.monto ?? 0
    const consumoFijo = (a.monto_sicore ?? 0) + (a.descuento_aplicado ?? 0)
    const saldoAlCierre = r2(monto - apl.hasta - consumoFijo)

    /**
     * 🧮 **El control del camino inverso.** Recalcular con **todas** las aplicaciones tiene que dar
     * la columna `monto_restante`. Si no da, o falta una vía de consumo o hay una aplicación sin
     * registrar — y en los dos casos el saldo al cierre también está mal.
     */
    const recalculadoHoy = r2(monto - apl.hasta - apl.despues - consumoFijo)
    const guardado = r2(a.monto_restante ?? 0)
    if (Math.abs(recalculadoHoy - guardado) > 0.01) {
      descuadres.push({
        nombre: a.nombre_proveedor ?? "(sin nombre)",
        monto, guardado, recalculado: recalculadoHoy,
        diferencia: r2(recalculadoHoy - guardado),
      })
    }

    // Sin saldo al cierre no va al papel: el papel lista lo que quedaba pendiente.
    if (saldoAlCierre <= 0.01) continue

    const fila: AnticipoAlCierre = {
      anticipo: a,
      aplicadoAlCierre: r2(apl.hasta),
      aplicadoDespues: r2(apl.despues),
      saldoAlCierre,
      sinEmpresa: !a.empresa,
    }

    const tipo = (a.tipo ?? "").toLowerCase()
    if (tipo === "pago") aProveedores.push(fila)
    else if (tipo === "cobro") deClientes.push(fila)
    else { tiposSinClasificar.add(tipo || "(vacío)"); sinTipo.push(fila) }
  }

  const sumar = (f: AnticipoAlCierre[]) => r2(f.reduce((s, x) => s + x.saldoAlCierre, 0))
  const orden = (f: AnticipoAlCierre[]) => f.sort((a, b) => b.saldoAlCierre - a.saldoAlCierre)
  const todos = [...aProveedores, ...deClientes, ...sinTipo]
  const conNull = todos.filter(x => x.sinEmpresa)

  const avisos: string[] = []
  if (conNull.length > 0) {
    avisos.push(
      `${conNull.length} anticipo(s) por ${pesos(sumar(conNull))} no tienen empresa asignada y se `
      + `cuentan como de ${empresa} (la columna se agregó después). Ver A-DAT-73.`,
    )
  }
  if (descuadres.length > 0) {
    avisos.push(
      `🧮 En ${descuadres.length} anticipo(s) el saldo recalculado no coincide con el guardado: `
      + descuadres.map(d => `${d.nombre} ${pesos(d.diferencia)}`).join(" · "),
    )
  }
  if (sinTipo.length > 0) {
    avisos.push(
      `${sinTipo.length} anticipo(s) por ${pesos(sumar(sinTipo))} no dicen si son a proveedor o de `
      + `cliente (tipo: ${[...tiposSinClasificar].join(", ")}): no se suman a ninguno de los dos.`,
    )
  }

  return {
    aProveedores: orden(aProveedores), totalAProveedores: sumar(aProveedores),
    deClientes: orden(deClientes), totalDeClientes: sumar(deClientes),
    sinTipo: orden(sinTipo), totalSinTipo: sumar(sinTipo),
    sinEmpresa: conNull.length, totalSinEmpresa: sumar(conNull),
    deOtraEmpresa,
    descuadres,
    tiposSinClasificar: [...tiposSinClasificar].sort(),
    avisos,
    mirados,
  }
}
