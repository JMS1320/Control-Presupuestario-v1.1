/**
 * 🧾 **LAS CUENTAS CORRIENTES CON SALDO AL CIERRE — un papel del balance** (A-FEAT-1218).
 *
 * Pedido del usuario 2026-09-30, explicando el caso AMS:
 *
 * > *«Él le factura a la SRL y cobra mensual, pero facturas que agrupan varios pagos. Entonces hay
 * > **saldo de inicio** que depende si había deuda o no con él al inicio del ejercicio, luego está la
 * > facturación vs lo cobrado. **Es una cuenta corriente. Se debería reflejar el saldo a cierre de
 * > balance.** (…) Debe reflejarse para él, para JMS, para MA y los demás socios, y para AFA y
 * > ACREN.»*
 *
 * ## 🔑 La vía de los pagos YA EXISTE: la columna `contable` del extracto
 *
 * No hay que inventar de dónde salen los pagos de cada socio: **el usuario ya los viene marcando a
 * mano**. Medido el 2026-09-30 en `msa_galicia`: `CTA MA` **$37.945.000** · `CTA JMS`
 * **$37.458.124,35** · `CTA AMS` **$13.063.089,73**.
 *
 * 🧨 **Pero las etiquetas no están normalizadas**, y agrupar por el texto literal rompe el papel:
 * **`CTA JMS` y `CUENTA JMS` son la misma cuenta** —él lo confirmó— y, agrupando a lo bruto, **JMS
 * saldría dos veces y ninguna con su total**: los **$2.137.884,27** de `CUENTA JMS` quedarían afuera
 * del saldo, sin que nada lo señale. Por eso el mapa de abajo **se declara**.
 *
 * ## ⚠️ Y por eso ESTE PAPEL SÓLO TOMA LAS `CTA *`
 *
 * Instrucción explícita del usuario, y es la que ordena el trabajo:
 *
 * > *«No es lo mismo todo lo relacionado a `RET`, `RET 3`, `AP`, etc. Más allá de que tienen muchas
 * > cosas en común, **debemos ir tratando cada cosa a la vez para no trabajar mal sobre otras que
 * > pueden tener otros detalles**. Pero iremos viendo cómo tratar esas otras.»*
 *
 * 📌 Entonces `RET*`, `AP*`, `LIB`, `Desglosar` y cualquier otra etiqueta **no se reparten ni se
 * ignoran**: se devuelven en `sinTratar`, con su total, para que el papel las muestre. Es § 🧮 de
 * `CLAUDE.md` — *nada se descarta en silencio* — y además deja ver **cuánta plata falta encuadrar**.
 *
 * 🧨 **Y hay un motivo concreto para no apurarse con `RET`**: si es *retiro*, esa plata **ya está en
 * el papel 09 (Retiros y aportes)**, y meterla también acá **la contaría dos veces**.
 *
 * ## 📄 Las facturas: por CUIT en ARCA, por ALIAS en el histórico
 *
 * 🧨 **`comprobantes_historico` no tiene CUIT** — sólo `denominacion_emisor` — y los nombres **no
 * coinciden** con el maestro: *«MARTINEZ JOSE MARIA»* contra *«Jose Maria Martinez»*. El orden está
 * invertido y las abreviaturas difieren. Un match difuso podría confundir a **Mercedes Martínez con
 * Mercedes Areco**, que es plata de socios atribuida a otra persona. Por eso **cada contraparte
 * declara sus alias exactos**.
 */
import type { ResumenCC, FacturaCC, PagoCC } from "@/lib/proveedores/cuenta-corriente"
import { armarCuentaCorriente } from "@/lib/proveedores/cuenta-corriente"

/** Una contraparte del papel, con todo lo que hace falta para encontrarla en cada fuente. */
export interface ContraparteDelBalance {
  /** Cómo se la llama en el papel. */
  clave: string
  nombre: string
  /** Para unir con `comprobantes_arca` y `comprobantes_venta`. */
  cuit: string
  /**
   * Los nombres con que aparece en **`comprobantes_historico`**, que no tiene CUIT.
   * Se comparan en mayúsculas y sin espacios de más. Vacío = no tiene comprobantes viejos.
   */
  aliasHistorico: string[]
  /**
   * Las etiquetas de la columna `contable` del extracto que son **esta** cuenta corriente.
   * 🔑 Acá está el arreglo de `CTA JMS` / `CUENTA JMS`.
   */
  etiquetasContable: string[]
}

/**
 * 📋 **LA LISTA, declarada y revisada por el usuario** (2026-09-30).
 *
 * ⚠️ **Sólo `CTA *`.** Las etiquetas `RET*`, `AP*`, `LIB` y `Desglosar` **no están acá a propósito**
 * — ver el encabezado: se tratan después, de a una.
 *
 * 📌 **AFA y ACREN no tienen etiqueta en `contable`**: sus pagos salen del vínculo con la factura, no
 * de una marca a mano. Por eso su lista de etiquetas va vacía y no es un olvido.
 */
export const CONTRAPARTES_DEL_BALANCE: ContraparteDelBalance[] = [
  {
    clave: "JMS", nombre: "José María Martínez", cuit: "23342147739",
    aliasHistorico: ["MARTINEZ JOSE MARIA"],
    // 🔑 Las dos: él confirmó que son la misma cuenta. Sin esto, JMS sale partido en dos.
    etiquetasContable: ["CTA JMS", "CUENTA JMS"],
  },
  {
    clave: "AMS", nombre: "Andrés Martínez", cuit: "20287492546",
    aliasHistorico: ["MARTINEZ PLACIDO ANDRES"],
    etiquetasContable: ["CTA AMS"],
  },
  {
    clave: "MA", nombre: "Mercedes Areco", cuit: "27066824611",
    aliasHistorico: [],
    // ⚠️ `RET 3 MA` NO está acá: es otra cosa y se trata aparte.
    etiquetasContable: ["CTA MA"],
  },
  {
    clave: "PAM", nombre: "Sucesión de Plácido Martínez", cuit: "20044390222",
    aliasHistorico: ["SUCESION DE MARTINEZ PLACIDO ALBERTO"],
    // ⚠️ `RET PAM`, `RET 1 PAM` y `RET 3 PAM` tampoco: son retiros, y van en el papel 09.
    etiquetasContable: [],
  },
  {
    clave: "AFA", nombre: "Agricultores Federados Argentinos", cuit: "30525718626",
    aliasHistorico: ["AGRICULTORES FEDERADOS ARGENTINOS SOC COOP LTDA"],
    etiquetasContable: [],
  },
  {
    clave: "ACREN", nombre: "Agro Centros Región Núcleo", cuit: "33716360429",
    // El nombre es idéntico en las tres fuentes: de las fáciles.
    aliasHistorico: ["AGRO CENTROS REGION NUCLEO S.A."],
    etiquetasContable: [],
  },
]

/** Normaliza un nombre o etiqueta para comparar: mayúsculas, sin acentos y sin espacios de más. */
export function normalizar(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim()
}

/** Un comprobante de compra, de cualquiera de las dos fuentes. */
export interface CompraParaCC {
  id: string
  fecha: string | null
  numero: string
  total: number
  /** De ARCA. Vacío en el histórico. */
  cuit?: string | null
  /** El nombre tal como viene; en el histórico es lo único que hay. */
  denominacion?: string | null
}

/** Una venta (MSA le factura a la contraparte). */
export interface VentaParaCC {
  id: string
  fecha: string | null
  numero: string
  total: number
  cuit?: string | null
}

/** Un movimiento del extracto, para los pagos marcados a mano. */
export interface MovimientoParaCC {
  id: string
  fecha: string | null
  debitos?: number | null
  creditos?: number | null
  descripcion?: string | null
  detalle?: string | null
  /** La marca del usuario. Es la que decide de quién es el pago. */
  contable?: string | null
  comprobantes_pagados?: string | null
}

export interface CuentaCorrienteDelBalance {
  contraparte: ContraparteDelBalance
  /** `null` = no se conoce. **No se asume cero** (§ 🎚️): se dice. */
  saldoInicio: number | null
  resumen: ResumenCC
  /** `saldo inicio + lo del ejercicio`. `null` si no se conoce el inicio. */
  saldoAlCierre: number | null
  /** Cuántos comprobantes salieron del histórico, que es el tramo sin CUIT. */
  desdeHistorico: number
}

export interface PapelDeCuentasCorrientes {
  cuentas: CuentaCorrienteDelBalance[]
  /**
   * 🛑 Las etiquetas de `contable` que **no** pertenecen a ninguna cuenta de la lista, con su total.
   *
   * No se reparten ni se esconden: son plata marcada que **todavía no se encuadró**, y el usuario
   * pidió expresamente tratarlas **de a una** — `RET`, `RET 3`, `AP`, `LIB`, `Desglosar`.
   */
  sinTratar: Array<{ etiqueta: string; movimientos: number; total: number }>
  totalSinTratar: number
  /** Los comprobantes del histórico cuyo nombre no matcheó ninguna contraparte. Informativo. */
  historicoSinAtribuir: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 🧾 Arma el papel.
 *
 * @param compras      de `comprobantes_arca` **y** de `comprobantes_historico`, ya del ejercicio
 * @param ventas       de `comprobantes_venta`, ya del ejercicio
 * @param movimientos  los del extracto con `contable` cargado, ya del ejercicio
 * @param saldosInicio por clave de contraparte. Lo que falte queda en `null`
 */
export function armarCuentasCorrientes(
  compras: CompraParaCC[],
  ventas: VentaParaCC[],
  movimientos: MovimientoParaCC[],
  saldosInicio: Record<string, number> = {},
  contrapartes: ContraparteDelBalance[] = CONTRAPARTES_DEL_BALANCE,
): PapelDeCuentasCorrientes {
  /** Qué etiqueta de `contable` corresponde a qué contraparte. Se arma una vez. */
  const porEtiqueta = new Map<string, ContraparteDelBalance>()
  for (const c of contrapartes) {
    for (const e of c.etiquetasContable) porEtiqueta.set(normalizar(e), c)
  }

  const cuentas: CuentaCorrienteDelBalance[] = []
  const usadasEnHistorico = new Set<string>()

  for (const c of contrapartes) {
    const alias = new Set(c.aliasHistorico.map(normalizar))

    const facturas: FacturaCC[] = []
    let desdeHistorico = 0
    for (const co of compras) {
      // Con CUIT, manda el CUIT. Sin CUIT (el histórico), manda el alias declarado.
      const porCuit = !!co.cuit && co.cuit === c.cuit
      const porAlias = !co.cuit && alias.has(normalizar(co.denominacion))
      if (!porCuit && !porAlias) continue
      if (porAlias) { desdeHistorico += 1; usadasEnHistorico.add(co.id) }
      facturas.push({
        id: co.id, fecha: co.fecha, numero: co.numero, total: Number(co.total) || 0, tipo: "compra",
      })
    }
    for (const v of ventas) {
      if (v.cuit !== c.cuit) continue
      facturas.push({
        id: v.id, fecha: v.fecha, numero: v.numero, total: Number(v.total) || 0, tipo: "venta",
      })
    }

    const pagos: PagoCC[] = movimientos
      .filter(m => porEtiqueta.get(normalizar(m.contable))?.clave === c.clave)
      .map(m => ({
        id: m.id,
        fecha: m.fecha,
        // 🔑 Un débito del banco es plata que SALE: es un pago a la contraparte.
        monto: r2(Number(m.debitos ?? 0) - Number(m.creditos ?? 0)),
        descripcion: m.descripcion ?? null,
        detalle: m.detalle ?? null,
        comprobantes_pagados: m.comprobantes_pagados ?? null,
      }))

    const resumen = armarCuentaCorriente(facturas, pagos)
    const inicio = c.clave in saldosInicio ? saldosInicio[c.clave] : null
    cuentas.push({
      contraparte: c,
      saldoInicio: inicio,
      resumen,
      saldoAlCierre: inicio == null ? null : r2(inicio + resumen.saldo),
      desdeHistorico,
    })
  }

  /** 🛑 Lo que quedó sin encuadrar, agrupado por su etiqueta tal cual. */
  const sueltas = new Map<string, { movimientos: number; total: number }>()
  for (const m of movimientos) {
    const etiqueta = (m.contable ?? "").trim()
    if (!etiqueta) continue
    if (porEtiqueta.has(normalizar(etiqueta))) continue
    const acc = sueltas.get(etiqueta) ?? { movimientos: 0, total: 0 }
    acc.movimientos += 1
    acc.total = r2(acc.total + Number(m.debitos ?? 0) - Number(m.creditos ?? 0))
    sueltas.set(etiqueta, acc)
  }
  const sinTratar = [...sueltas.entries()]
    .map(([etiqueta, v]) => ({ etiqueta, ...v }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))

  return {
    cuentas,
    sinTratar,
    totalSinTratar: r2(sinTratar.reduce((s, x) => s + x.total, 0)),
    historicoSinAtribuir: compras.filter(c => !c.cuit && !usadasEnHistorico.has(c.id)).length,
  }
}
