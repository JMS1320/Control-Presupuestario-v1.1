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
  /**
   * 🔁 A-FEAT-1499 (JMS 01/11: *«AFA y ACREN se concilian contra su cta cte»*): además de su marca, entran TODOS los
   * movimientos del banco con su CUIT, conciliados o no — los que van contra una factura también son plata de esa cuenta.
   */
  porCuit?: boolean
  /**
   * 👥 A-FEAT-1537 (JMS 04/11 en el papel 14: *«que esto sea sólo clientes y proveedores; las cuentas de socios las
   * veremos después»*): los socios van a una solapa aparte y NO suman a las cuentas a pagar ni a cobrar.
   */
  socio?: boolean
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
    socio: true,
  },
  {
    clave: "AMS", nombre: "Andrés Martínez", cuit: "20287492546",
    aliasHistorico: ["MARTINEZ PLACIDO ANDRES"],
    etiquetasContable: ["CTA AMS"],
    socio: true,
  },
  {
    clave: "MA", nombre: "Mercedes Areco", cuit: "27066824611",
    aliasHistorico: [],
    // ⚠️ cambió 07/11 (A-FEAT-1577): `RET 3 MA` ya no existe — lo que MSA paga por MA (impuestos, terceros, su tarjeta) es «CTA MA»
    // (JMS 06/11: «RET 3 MA sí debe contar en el saldo, son retiros»). El motivo sale del template / factura, no del código.
    etiquetasContable: ["CTA MA"],
    socio: true,
  },
  {
    clave: "PAM", nombre: "Sucesión de Plácido Martínez", cuit: "20044390222",
    aliasHistorico: ["SUCESION DE MARTINEZ PLACIDO ALBERTO"],
    // ⚠️ cambió 07/11 (A-FEAT-1577, esquema de JMS «CTA + quién»): hasta acá iba vacía y `RET PAM` / `RET 1 PAM` / `RET 3 PAM`
    // quedaban «sin tratar». Ahora todo lo de MSA con PAM es «CTA PAM» (script 229); el papel 09 sigue por CATEG, no lo toca.
    etiquetasContable: ["CTA PAM"],
    socio: true,
  },
  // ⚠️ cambió 01/11 (A-FEAT-1499): hasta acá no tenían marca y sus pagos «salían del vínculo con la factura» — pero el
  // papel sólo toma pagos marcados, así que les daba CERO cobrado y pagado (AFA «le debo $ 2.745.698,32» sin serlo).
  // Ahora: marca CTA AFA / CTA ACREN para lo que no va contra una factura, y además todo lo del banco con su CUIT.
  {
    clave: "AFA", nombre: "Agricultores Federados Argentinos", cuit: "30525718626",
    aliasHistorico: ["AGRICULTORES FEDERADOS ARGENTINOS SOC COOP LTDA"],
    etiquetasContable: ["CTA AFA"], porCuit: true,
  },
  {
    clave: "ACREN", nombre: "Agro Centros Región Núcleo", cuit: "33716360429",
    // El nombre es idéntico en las tres fuentes: de las fáciles.
    aliasHistorico: ["AGRO CENTROS REGION NUCLEO S.A."],
    etiquetasContable: ["CTA ACREN"], porCuit: true,
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
  /** 🔁 A-FEAT-1499: las retenciones que sufrió la venta (IVA, IIBB, Ganancias): se cobraron en papel, no en el banco. */
  retenciones?: number
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
  /** 🔁 A-FEAT-1499: el CUIT que informa el banco (`leyendas_adicionales_2`), para las cuentas que van por CUIT. */
  cuit?: string | null
  /** El estado del movimiento: los sin marcar ni conciliar se cuentan aparte (falta encuadrarlos). */
  estado?: string | null
  /** 👥 A-FEAT-1577: de qué cuenta salió («MSA Galicia cta cte», «MA caja de ahorro»…), su agrupadora o template, y si la otra punta está. */
  cuenta?: string
  grupo?: string
  otraPunta?: string
  /**
   * 👥 A-FEAT-1577: `true` = el movimiento es de la cuenta DEL SOCIO (lo pagó él): para MSA el signo se invierte — si MA paga una
   * factura de MSA desde su caja de ahorro, MSA le debe más.
   */
  delSocio?: boolean
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
  /**
   * 🔁 A-FEAT-1499: los movimientos con su CUIT que todavía no están marcados ni conciliados. Ya suman al saldo (son plata
   * de esa cuenta), pero falta encuadrarlos: se muestran, no se esconden.
   */
  sinMarcar?: { movimientos: number; total: number }
  /** 🔁 A-FEAT-1499: lo retenido en las ventas, que cuenta como cobrado. */
  retenciones?: number
  /** ✍️ A-FEAT-1537: el saldo al cierre lo decidió el usuario; acá queda cuánto se ajustó y por qué (no se esconde). */
  ajusteCierre?: { importe: number; motivo: string }
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
 * 💳 ¿Es un pago de la tarjeta? ⚠️ cambió 07/11 (A-FEAT-1577): hasta acá era SÓLO la marca «Desglosar». JMS: «Desglosar» deja de ser
 * marca (el script 229 la vacía) — el pago se reconoce por lo que dice el banco. Sigue valiendo la marca vieja, y un pago marcado para
 * una cuenta («CTA PAM»: otra empresa pagó la tarjeta) NO se abre acá: ése va entero a su cuenta corriente.
 */
const RE_PAGO_TARJETA = /pago (de )?(visa|tarjeta)|visa empresa/i
export function esPagoDeTarjeta(m: MovimientoParaCC): boolean {
  const c = normalizar(m.contable)
  return c === normalizar(ETIQUETA_DESGLOSAR) || (!c && RE_PAGO_TARJETA.test(String(m.descripcion ?? "")))
}

/** Los pagos de la tarjeta agrupados por día (el día en que vence el resumen). */
function pagosDeTarjetaPorFecha(movimientos: MovimientoParaCC[]): Map<string, MovimientoParaCC[]> {
  const porFecha = new Map<string, MovimientoParaCC[]>()
  for (const m of movimientos.filter(esPagoDeTarjeta)) {
    const f = String(m.fecha ?? "").slice(0, 10)
    porFecha.set(f, [...(porFecha.get(f) ?? []), m])
  }
  return porFecha
}

/**
 * Cuánto vale cada consumo de un resumen en pesos: lo pagado en dólares es lo que el banco debitó de más sobre los pesos del resumen,
 * y se reparte entre los consumos en dólares en proporción a su importe en dólares. Una sola cuenta para el desglose y para la cuenta
 * corriente: si fueran dos, darían distinto.
 */
function valoresDelResumen(importe: number, delResumen: ConsumoTarjeta[]): number[] {
  const pesos = delResumen.map(c => Number(c.debitos ?? 0) - Number(c.creditos ?? 0))
  const usd = delResumen.map(c => Number(c.debitosUsd ?? 0))
  const totalUsd = usd.reduce((s, x) => s + x, 0)
  const enDolares = totalUsd > 0 ? r2(importe - pesos.reduce((s, x) => s + x, 0)) : 0
  return delResumen.map((_, i) => r2(pesos[i] + (totalUsd > 0 && enDolares > 0 ? enDolares * usd[i] / totalUsd : 0)))
}

/**
 * 💳 A-FEAT-1577 (esquema de JMS 07/11): los consumos de la tarjeta de MSA marcados para la cuenta de un socio («CTA MA», «CTA JMS»…)
 * SON pagos de MSA por cuenta de ese socio: entran a SU cuenta corriente, como cualquier movimiento del banco con esa marca. Sólo los
 * de resúmenes que cierran contra su pago (si no cierra, no se sabe cuánto fue y queda a la vista en el desglose).
 */
export function consumosDeTarjetaComoMovimientos(
  movimientos: MovimientoParaCC[],
  consumos: ConsumoTarjeta[],
  contrapartes: ContraparteDelBalance[] = CONTRAPARTES_DEL_BALANCE,
): MovimientoParaCC[] {
  const etiquetas = new Set(contrapartes.flatMap(c => c.etiquetasContable.map(normalizar)))
  const out: MovimientoParaCC[] = []
  for (const [fecha, del] of pagosDeTarjetaPorFecha(movimientos)) {
    const importe = r2(del.reduce((s, m) => s + Number(m.debitos ?? 0) - Number(m.creditos ?? 0), 0))
    const delResumen = consumos.filter(c => String(c.vencimiento ?? "").slice(0, 10) === fecha)
    const valores = valoresDelResumen(importe, delResumen)
    if (!delResumen.length || Math.abs(r2(importe - r2(valores.reduce((s, x) => s + x, 0)))) >= 0.01) continue
    delResumen.forEach((c, i) => {
      if (!etiquetas.has(normalizar(c.contable))) return
      out.push({ id: `tarjeta-${fecha}-${i}`, fecha, debitos: valores[i] > 0 ? valores[i] : 0, creditos: valores[i] < 0 ? -valores[i] : 0,
        descripcion: `Tarjeta: ${c.descripcion ?? ""}`.trim(), detalle: c.categ ?? null, contable: c.contable ?? null, estado: "conciliado",
        comprobantes_pagados: `Por la tarjeta (pago del ${fecha})`, cuenta: "MSA VISA", grupo: c.categ ?? undefined })
    })
  }
  return out
}

/**
 * 💳 Abre los pagos de la tarjeta con los consumos de su resumen (el que vence ese día) y corrige
 * `sinTratar`: sale el «Desglosar» abierto, entra cada marca de otra persona con lo suyo.
 * ⚠️ 07/11: una marca que es la cuenta de un socio («CTA MA») ya entró a SU cuenta corriente
 * (`consumosDeTarjetaComoMovimientos`): no va a «sin tratar».
 */
export function abrirDesglosar(
  papel: PapelDeCuentasCorrientes,
  movimientos: MovimientoParaCC[],
  consumos: ConsumoTarjeta[],
  contrapartes: ContraparteDelBalance[] = CONTRAPARTES_DEL_BALANCE,
): PapelDeCuentasCorrientes {
  const etiquetasCC = new Set(contrapartes.flatMap(c => c.etiquetasContable.map(normalizar)))
  const porFecha = pagosDeTarjetaPorFecha(movimientos)
  if (porFecha.size === 0) return papel

  const pagos: PagoDesglosado[] = []
  for (const [fecha, del] of [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const importe = r2(del.reduce((s, m) => s + Number(m.debitos ?? 0) - Number(m.creditos ?? 0), 0))
    const delResumen = consumos.filter(c => String(c.vencimiento ?? "").slice(0, 10) === fecha)
    const valores = valoresDelResumen(importe, delResumen)
    const partes = new Map<string, ParteDesglose>()
    delResumen.forEach((c, i) => {
      const valor = valores[i]
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
  for (const d of destinos.filter(x => x.destino !== DESTINO_PROPIO && !etiquetasCC.has(normalizar(x.destino)))) {
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

/** 👥 A-FEAT-1577: el bloque del detalle donde van las facturas, el sueldo y las retenciones (lo que no es de una cuenta de banco). */
export const CUENTA_FACTURAS = "Facturas y sueldo"

/** Una cuenta de un socio, con todos sus movimientos del ejercicio (para buscar la otra punta y lo que pagó por MSA). */
export interface CuentaDelSocio {
  /** La clave de la contraparte: «MA», «PAM». */
  clave: string
  /** Cómo se llama en el detalle: «MA caja de ahorro». */
  nombre: string
  movimientos: Array<MovimientoParaCC & { cuit?: string | null }>
}

/**
 * 👥 A-FEAT-1577 (JMS 07/11: *«la 14.1 debería sintetizar todo… si MA paga fac de MSA desde cta de MA eso le afecta a MSA»* ·
 * *«que aparezca si está o no la contraparte pero no hace falta listarlo»*).
 *
 * 1. Lo que el socio pagó POR MSA desde SUS cuentas (marcado «CTA MSA») entra a su cuenta corriente, con el signo de MSA (le debe más).
 * 2. La misma plata en las dos puntas (MSA le transfiere a MA y figura en las dos) se cuenta UNA vez, del lado de MSA: la punta del socio
 *    no se lista, y la de MSA dice si la otra está («✅ en MA caja de ahorro 10/11») o falta («🔴 falta en la cuenta de MA»).
 * La otra punta: misma plata en sentido contrario, mismo importe, ±3 días. Sólo se exige en lo que va al CUIT del socio (una transferencia);
 * un pago de MSA a un tercero por cuenta del socio no tiene otra punta.
 */
export function movimientosDeLosSocios(
  movsMSA: MovimientoParaCC[],
  cuentasSocios: CuentaDelSocio[],
  contrapartes: ContraparteDelBalance[] = CONTRAPARTES_DEL_BALANCE,
): { delSocio: MovimientoParaCC[]; msa: MovimientoParaCC[] } {
  const porEtiqueta = new Map<string, ContraparteDelBalance>()
  for (const c of contrapartes) for (const e of c.etiquetasContable) porEtiqueta.set(normalizar(e), c)
  const dias = (a: string | null, b: string | null) => Math.abs((Date.parse(String(a).slice(0, 10)) - Date.parse(String(b).slice(0, 10))) / 86400000)
  const neto = (m: MovimientoParaCC) => r2(Number(m.debitos ?? 0) - Number(m.creditos ?? 0))
  const usados = new Set<string>()
  const msa = movsMSA.map(m => {
    const c = porEtiqueta.get(normalizar(m.contable))
    const suyas = c ? cuentasSocios.filter(x => x.clave === c.clave) : []
    if (!c || !suyas.length) return m
    const imp = neto(m)
    const otra = suyas.flatMap(x => x.movimientos.map(y => ({ x, y })))
      .filter(({ y }) => !usados.has(y.id) && neto(y) === -imp && dias(y.fecha, m.fecha) <= 3)
      .sort((a, b) => dias(a.y.fecha, m.fecha) - dias(b.y.fecha, m.fecha))[0]
    if (otra) { usados.add(otra.y.id); return { ...m, otraPunta: `✅ en ${otra.x.nombre} ${String(otra.y.fecha).slice(8, 10)}/${String(otra.y.fecha).slice(5, 7)}` } }
    const alSocio = String(m.cuit ?? "").replace(/\D/g, "") === c.cuit
    return alSocio ? { ...m, otraPunta: `🔴 falta en la cuenta de ${c.clave}` } : m
  })
  const delSocio: MovimientoParaCC[] = []
  for (const x of cuentasSocios) for (const y of x.movimientos) {
    if (usados.has(y.id) || normalizar(y.contable) !== "CTA MSA") continue           // espejo, o no es algo de MSA
    delSocio.push({ ...y, id: `${x.nombre}:${y.id}`, contable: (contrapartes.find(c => c.clave === x.clave)?.etiquetasContable[0]) ?? y.contable,
      cuenta: x.nombre, delSocio: true })
  }
  return { delSocio, msa }
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
    for (const fa of facturas) fa.cuenta = CUENTA_FACTURAS

    // 🔁 A-FEAT-1499: la marca manda; una cuenta «por CUIT» suma además todo lo de su CUIT que no esté marcado para otra.
    const esDeEsta = (m: MovimientoParaCC) => {
      const deMarca = porEtiqueta.get(normalizar(m.contable))
      if (deMarca) return deMarca.clave === c.clave
      return !!c.porCuit && String(m.cuit ?? "").replace(/\D/g, "") === c.cuit
    }
    const vistos = new Set<string>()
    const suyos = movimientos.filter(m => { if (vistos.has(m.id) || !esDeEsta(m)) return false; vistos.add(m.id); return true })
    let sinMarcarN = 0, sinMarcarT = 0
    for (const m of suyos) {
      const marcado = porEtiqueta.get(normalizar(m.contable))?.clave === c.clave
      if (c.porCuit && !marcado && !/^(conciliado|historico)$/i.test(String(m.estado ?? ""))) {
        sinMarcarN += 1; sinMarcarT = r2(sinMarcarT + Number(m.debitos ?? 0) - Number(m.creditos ?? 0))
      }
    }
    const retenciones: PagoCC[] = ventas.filter(v => v.cuit === c.cuit && Number(v.retenciones) > 0).map(v => ({
      id: `ret-${v.id}`, fecha: v.fecha, monto: -r2(Number(v.retenciones)), cuenta: CUENTA_FACTURAS,
      descripcion: `Retenciones sufridas · ${v.numero}`, comprobantes_pagados: v.numero,
    }))
    const pagos: PagoCC[] = suyos
      .map(m => ({
        id: m.id,
        fecha: m.fecha,
        // 🔑 Un débito del banco es plata que SALE: es un pago a la contraparte. En la cuenta del SOCIO es al revés (lo pagó él por MSA).
        monto: r2((m.delSocio ? -1 : 1) * (Number(m.debitos ?? 0) - Number(m.creditos ?? 0))),
        descripcion: m.descripcion ?? null,
        detalle: m.detalle ?? null,
        comprobantes_pagados: m.comprobantes_pagados ?? null,
        ...(m.cuenta ? { cuenta: m.cuenta } : {}), ...(m.grupo ? { grupo: m.grupo } : {}), ...(m.otraPunta ? { otraPunta: m.otraPunta } : {}),
      }))
    pagos.push(...retenciones)

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
      ...(c.porCuit ? { sinMarcar: { movimientos: sinMarcarN, total: sinMarcarT },
        retenciones: r2(retenciones.reduce((t, x) => t - x.monto, 0)) } : {}),
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

/**
 * ✍️ **Saldos al cierre DECIDIDOS por el usuario** (A-FEAT-1537). El saldo calculado se ve igual: la diferencia queda
 * como ajuste con su motivo, en el papel 14 (§ 🧮: nada se descarta en silencio).
 */
export const CIERRES_DECIDIDOS: Array<{ clave: string; anioCierre: number; saldo: number; motivo: string }> = [
  {
    clave: "ACREN", anioCierre: 2026, saldo: 0,
    // JMS 04/11, mirando la cuenta corriente de la extranet de ACREN: «ACREN igual lo podemos dejar en cero».
    motivo: "cuenta en dólares: al 30/06/26 se le deben US$ 7,28 (ND interna de diferencia de cambio). El saldo en pesos es "
      + "diferencia de cambio (se pagó a un dólar más alto que el facturado), no plata a favor — se deja en 0 (JMS 04/11)",
  },
]

/** ✍️ A-FEAT-1537: aplica los saldos al cierre decididos; el ajuste queda a la vista en `ajusteCierre`. */
export function aplicarCierresDecididos(papel: PapelDeCuentasCorrientes, anioCierre: number,
  decididos = CIERRES_DECIDIDOS): PapelDeCuentasCorrientes {
  return {
    ...papel,
    cuentas: papel.cuentas.map(c => {
      const d = decididos.find(x => x.clave === c.contraparte.clave && x.anioCierre === anioCierre)
      if (!d) return c
      const importe = r2(d.saldo - c.saldoAlCierre)
      return Math.abs(importe) < 0.005 ? c : { ...c, saldoAlCierre: d.saldo, ajusteCierre: { importe, motivo: d.motivo } }
    }),
  }
}

/** 👥 A-FEAT-1537: el papel 14 sólo con clientes y proveedores; los socios, aparte. */
export function separarSocios(papel: PapelDeCuentasCorrientes): { terceros: PapelDeCuentasCorrientes; socios: CuentaCorrienteDelBalance[] } {
  return {
    terceros: { ...papel, cuentas: papel.cuentas.filter(c => !c.contraparte.socio) },
    socios: papel.cuentas.filter(c => c.contraparte.socio),
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 👷 EL SUELDO PENDIENTE va a la cuenta corriente del socio (A-FEAT-1422 nota 8, 2026-10-29)
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Un mes de sueldo, con lo mínimo para llevarlo a la cuenta corriente. */
export interface SueldoParaCC {
  id: string
  anio: number
  mes: number
  fecha_fin_periodo?: string | null
  saldo_pendiente?: number | string | null
  empleado?: { nombre?: string | null; cuit_empleado?: string | null } | null
}

/**
 * JMS 29/10, sobre el sueldo de MA: *«ella cobra pero no por recibo: es una cuenta corriente y esto entra
 * dentro de su cuenta corriente. Marcá el recibo como entero a pagar por MSA»*.
 *
 * Cada mes del ejercicio con **saldo pendiente** de un empleado cuyo CUIT es el de una contraparte del papel
 * entra a su cuenta como **deuda de MSA** (igual que una factura de compra). Sólo lo pendiente: lo ya pagado
 * por la vía de sueldos no se repite. Lo une el CUIT, nunca el nombre.
 */
export function sueldosPendientesComoCompras(
  periodos: SueldoParaCC[],
  meses: string[],
  contrapartes: ContraparteDelBalance[] = CONTRAPARTES_DEL_BALANCE,
): CompraParaCC[] {
  const delEjercicio = new Set(meses)
  const cuits = new Set(contrapartes.map(c => c.cuit))
  const out: CompraParaCC[] = []
  for (const p of periodos) {
    const cuit = String(p.empleado?.cuit_empleado ?? "").replace(/\D/g, "")
    const mm = `${p.anio}-${String(p.mes).padStart(2, "0")}`
    const pendiente = r2(Number(p.saldo_pendiente) || 0)
    // ⚠️ cambió 07/11 (JMS, sobre los $ 34,29 de AMS en enero 2026: «no se debe poner ese saldo»): sólo entra lo que MSA DEBE (pendiente
    // positivo). Un sueldo pagado de más no es una deuda del socio con MSA: es una diferencia de Sueldos y se corrige ahí.
    if (!cuits.has(cuit) || !delEjercicio.has(mm) || pendiente < 1) continue
    const fin = p.fecha_fin_periodo
      ? String(p.fecha_fin_periodo).slice(0, 10)
      : new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10)
    out.push({
      id: `sueldo-${p.id}`, fecha: fin, cuit, total: pendiente,
      numero: `Sueldo ${String(p.mes).padStart(2, "0")}/${p.anio} (a pagar)`,
    })
  }
  return out
}
