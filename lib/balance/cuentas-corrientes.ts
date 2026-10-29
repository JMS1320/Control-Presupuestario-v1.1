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
 * ⚠️ cambió 2026-10-27 (A-FEAT-1388): `Desglosar` SÍ se abre, con los consumos de la tarjeta — ver
 * `abrirDesglosar`. El resto de las etiquetas sigue igual.
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
  /**
   * El saldo al inicio del ejercicio: el que cargó el usuario y, si no hay, **0 marcado «sin dato»**.
   * ⚠️ cambió 2026-10-27 (A-FEAT-1388): hasta acá era `null` y el saldo al cierre quedaba vacío. Usuario,
   * en el papel 14: *«poner saldo de inicio cero y que dé lo que dé, pero luego podremos modificar desde
   * antes de exportar. Para todo este grupo»*. Sigue diciéndose que no se conoce — en `inicioSinDato` —,
   * pero el papel ya da un número (§ 🎚️ default del dato real, siempre editable).
   */
  saldoInicio: number
  /** `true` = nadie cargó el saldo de inicio: el 0 es un default, no un dato. */
  inicioSinDato: boolean
  /** 🤖 A-FEAT-1386: «TENTATIVO (lo puso Claude…) · fuente» mientras el saldo de inicio no tenga el OK. */
  inicioTentativo?: string
  resumen: ResumenCC
  /** `saldo inicio + lo del ejercicio`. */
  saldoAlCierre: number
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
  /**
   * 🛡️ Las aseguradoras (A-FEAT-1385): su saldo sale de las PÓLIZAS contra el banco, no de marcas `CTA *`.
   * Lo agrega la pantalla del balance después de armar el papel; si no está, el papel sale igual.
   */
  aseguradoras?: import("./seguros-al-cierre").AseguradoraAlCierre[]
  /**
   * 💳 Los pagos marcados «Desglosar» abiertos con los consumos de la tarjeta (A-FEAT-1388). Lo agrega
   * `abrirDesglosar`; si no está, «Desglosar» queda entero en `sinTratar`, como antes.
   */
  desgloseTarjeta?: DesgloseTarjeta
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 💳 «DESGLOSAR» — el pago de la tarjeta abierto con su resumen (A-FEAT-1388, 2026-10-27)
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Usuario 27/10, sobre el renglón «Desglosar» del papel 14 ($8.735.419,59): *«¿se puede ya tomar por
 * lo menos lo de pólizas?»*. «Desglosar» es su marca para *«esto hay que repartirlo»*: en 25/26 son los
 * 6 débitos del banco que pagan la **Visa Business de MSA** (feb–jun 2026). Y el reparto **ya está en
 * los datos**: cada resumen trae sus consumos, y cada consumo su marca (`contable`). Medido el 27/10:
 *
 * | Destino | Importe |
 * |---|---|
 * | 🛡️ Pólizas — Seguro Chalet de MA (Chubb), marca RET 3 MA | $729.818,58 |
 * | Otros por cuenta de MA (Orbith), marca RET 3 MA | $431.600,00 |
 * | Gasto propio de MSA (sin marca de otra persona) | $7.574.001,01 |
 * | **= los 6 pagos** | **$8.735.419,59** |
 *
 * 🔑 **Se abre con la marca de cada consumo, no con un criterio nuevo**: lo que él marcó para otra
 * persona sigue «sin tratar» bajo ESA marca (RET 3 MA se trata aparte, por pedido suyo); lo que no
 * tiene marca es gasto de MSA y sale de «sin tratar». Las pólizas se separan adentro de cada destino.
 * 🧮 Control: los consumos (más lo pagado en dólares) tienen que dar el pago del banco. Si un pago no
 * encuentra su resumen, queda entero como «Desglosar», a la vista.
 */
export const ETIQUETA_DESGLOSAR = "Desglosar"
/** El destino de lo que no tiene marca de otra persona. */
export const DESTINO_PROPIO = "Gasto propio de MSA (sin marca de otra persona)"

/** Un consumo del resumen de la tarjeta (fila `movimiento`). */
export interface ConsumoTarjeta {
  /** El vencimiento del resumen: el día en que el banco lo paga. */
  vencimiento: string | null
  descripcion?: string | null
  categ?: string | null
  /** La marca del usuario en la tarjeta (`RET 3 MA`, `CTA JMS`…). Vacía = de MSA. */
  contable?: string | null
  debitos?: number | null
  creditos?: number | null
  /** Consumo en dólares: los pesos van en el pago del banco, no en la fila. */
  debitosUsd?: number | null
  /** Su template está vinculado a una póliza (`polizas_seguro.template_id`). */
  conPoliza?: boolean
}

export interface ParteDesglose {
  destino: string
  /** 🛡️ Es un seguro (póliza): lo que el usuario pidió tomar primero. */
  poliza: boolean
  importe: number
  consumos: number
  /** Qué consumos son, para leerlo sin abrir la tarjeta. */
  ejemplos: string[]
}

export interface PagoDesglosado {
  fecha: string
  importe: number
  /** Cuántos débitos del banco son (el de febrero vino en dos: pesos y dólares). */
  debitos: number
  partes: ParteDesglose[]
  /** `false` = no se encontró el resumen, o sus consumos no dan el pago. */
  cierra: boolean
  /** Pago − consumos. 0 si cierra. */
  diferencia: number
}

export interface DesgloseTarjeta {
  pagos: PagoDesglosado[]
  /** Lo mismo, sumado por destino (y póliza / no póliza). */
  porDestino: ParteDesglose[]
  total: number
  /** Lo de los pagos que no se pudieron abrir: sigue como «Desglosar». */
  sinAbrir: number
}

/** ¿Es un seguro? Por el vínculo con la póliza o por el nombre (una comisión de caja de seguridad, no). */
export function esPoliza(c: Pick<ConsumoTarjeta, "categ" | "descripcion" | "conPoliza">): boolean {
  if (c.conPoliza) return true
  const t = `${c.categ ?? ""} ${c.descripcion ?? ""}`
  return /segur|chubb|federaci|patronal|sancor|allianz|zurich|mapfre|alondra/i.test(t) && !/caja de seguridad/i.test(t)
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 💳 Abre los pagos «Desglosar» con los consumos de su resumen (el que vence ese día) y corrige
 * `sinTratar`: sale el «Desglosar» abierto, entra cada marca de otra persona con lo suyo.
 */
export function abrirDesglosar(
  papel: PapelDeCuentasCorrientes,
  movimientos: MovimientoParaCC[],
  consumos: ConsumoTarjeta[],
): PapelDeCuentasCorrientes {
  const esDesglosar = (m: MovimientoParaCC) => normalizar(m.contable) === normalizar(ETIQUETA_DESGLOSAR)
  const porFecha = new Map<string, MovimientoParaCC[]>()
  for (const m of movimientos.filter(esDesglosar)) {
    const f = String(m.fecha ?? "").slice(0, 10)
    porFecha.set(f, [...(porFecha.get(f) ?? []), m])
  }
  if (porFecha.size === 0) return papel

  const pagos: PagoDesglosado[] = []
  for (const [fecha, del] of [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const importe = r2(del.reduce((s, m) => s + Number(m.debitos ?? 0) - Number(m.creditos ?? 0), 0))
    const delResumen = consumos.filter(c => String(c.vencimiento ?? "").slice(0, 10) === fecha)
    const pesos = delResumen.map(c => Number(c.debitos ?? 0) - Number(c.creditos ?? 0))
    const usd = delResumen.map(c => Number(c.debitosUsd ?? 0))
    const totalUsd = usd.reduce((s, x) => s + x, 0)
    // Lo pagado en dólares es lo que el banco debitó de más sobre los pesos del resumen: se reparte
    // entre los consumos en dólares en proporción a su importe en dólares.
    const enDolares = totalUsd > 0 ? r2(importe - pesos.reduce((s, x) => s + x, 0)) : 0
    const partes = new Map<string, ParteDesglose>()
    delResumen.forEach((c, i) => {
      const valor = r2(pesos[i] + (totalUsd > 0 && enDolares > 0 ? enDolares * usd[i] / totalUsd : 0))
      const marca = (c.contable ?? "").trim()
      const destino = marca || DESTINO_PROPIO
      const poliza = esPoliza(c)
      const k = `${destino}|${poliza}`
      const p = partes.get(k) ?? { destino, poliza, importe: 0, consumos: 0, ejemplos: [] }
      p.importe = r2(p.importe + valor)
      p.consumos += 1
      const ej = String(c.categ || c.descripcion || "").trim()
      if (ej && !p.ejemplos.includes(ej) && p.ejemplos.length < 4) p.ejemplos.push(ej)
      partes.set(k, p)
    })
    const lista = [...partes.values()].sort((a, b) => Number(b.poliza) - Number(a.poliza) || b.importe - a.importe)
    const suma = r2(lista.reduce((s, p) => s + p.importe, 0))
    const diferencia = r2(importe - suma)
    pagos.push({ fecha, importe, debitos: del.length, partes: lista, cierra: delResumen.length > 0 && Math.abs(diferencia) < 0.01, diferencia })
  }

  const porDestino = new Map<string, ParteDesglose>()
  for (const p of pagos.filter(x => x.cierra)) {
    for (const x of p.partes) {
      const k = `${x.destino}|${x.poliza}`
      const acc = porDestino.get(k) ?? { destino: x.destino, poliza: x.poliza, importe: 0, consumos: 0, ejemplos: [] }
      acc.importe = r2(acc.importe + x.importe)
      acc.consumos += x.consumos
      for (const e of x.ejemplos) if (!acc.ejemplos.includes(e) && acc.ejemplos.length < 4) acc.ejemplos.push(e)
      porDestino.set(k, acc)
    }
  }
  const destinos = [...porDestino.values()].sort((a, b) => Number(b.poliza) - Number(a.poliza)
    || Number(a.destino === DESTINO_PROPIO) - Number(b.destino === DESTINO_PROPIO) || b.importe - a.importe)
  const sinAbrir = r2(pagos.filter(p => !p.cierra).reduce((s, p) => s + p.importe, 0))
  const desglose: DesgloseTarjeta = { pagos, porDestino: destinos, total: r2(pagos.reduce((s, p) => s + p.importe, 0)), sinAbrir }

  /**
   * 🛑 «Sin tratar» corregido: el «Desglosar» abierto sale; cada marca de otra persona entra con lo
   * suyo (sigue sin tratar: se trata de a una); lo propio de MSA no entra (no es cuenta corriente).
   * Lo que no se pudo abrir queda como «Desglosar».
   */
  const resto = papel.sinTratar.filter(x => normalizar(x.etiqueta) !== normalizar(ETIQUETA_DESGLOSAR))
  const nuevas: PapelDeCuentasCorrientes["sinTratar"] = []
  const porMarca = new Map<string, { total: number; consumos: number }>()
  for (const d of destinos.filter(x => x.destino !== DESTINO_PROPIO)) {
    const acc = porMarca.get(d.destino) ?? { total: 0, consumos: 0 }
    acc.total = r2(acc.total + d.importe); acc.consumos += d.consumos
    porMarca.set(d.destino, acc)
  }
  for (const [marca, v] of porMarca) nuevas.push({ etiqueta: `${marca} · por la tarjeta (era Desglosar)`, movimientos: v.consumos, total: v.total })
  if (sinAbrir !== 0) {
    nuevas.push({ etiqueta: `${ETIQUETA_DESGLOSAR} · sin resumen que lo abra`, movimientos: pagos.filter(p => !p.cierra).reduce((s, p) => s + p.debitos, 0), total: sinAbrir })
  }
  const sinTratar = [...resto, ...nuevas].sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  return {
    ...papel,
    sinTratar,
    totalSinTratar: r2(sinTratar.reduce((s, x) => s + x.total, 0)),
    desgloseTarjeta: desglose,
  }
}

/**
 * 🧾 Arma el papel.
 *
 * @param compras      de `comprobantes_arca` **y** de `comprobantes_historico`, ya del ejercicio
 * @param ventas       de `comprobantes_venta`, ya del ejercicio
 * @param movimientos  los del extracto con `contable` cargado, ya del ejercicio
 * @param saldosInicio por clave de contraparte. Lo que falte va en 0, marcado `inicioSinDato`
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
    const cargado = saldosInicio[c.clave]
    const inicio = Number.isFinite(cargado) ? r2(cargado) : 0
    cuentas.push({
      contraparte: c,
      saldoInicio: inicio,
      inicioSinDato: !Number.isFinite(cargado),
      resumen,
      saldoAlCierre: r2(inicio + resumen.saldo),
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

/**
 * ✍️ **Pone los saldos de inicio que cargó el usuario** sobre un papel ya armado, sin volver a leer la
 * base (A-FEAT-1388): la pantalla los recalcula al escribirlos, antes de bajar el Excel.
 * Lo que no está cargado (o está vacío) queda en 0 con `inicioSinDato`.
 */
export function aplicarSaldosInicio(
  papel: PapelDeCuentasCorrientes,
  saldos: Record<string, number | null | undefined>,
  /** 🤖 A-FEAT-1386: por clave, la leyenda del saldo que puso Claude y espera el OK. */
  tentativos: Record<string, string> = {},
): PapelDeCuentasCorrientes {
  return {
    ...papel,
    cuentas: papel.cuentas.map(c => {
      const v = saldos[c.contraparte.clave]
      const hay = typeof v === "number" && Number.isFinite(v)
      const inicio = hay ? r2(v) : 0
      return { ...c, saldoInicio: inicio, inicioSinDato: !hay, saldoAlCierre: r2(inicio + c.resumen.saldo),
        inicioTentativo: hay ? tentativos[c.contraparte.clave] : undefined }
    }),
  }
}
