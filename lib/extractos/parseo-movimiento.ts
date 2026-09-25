/**
 * Desglose de la columna "Movimiento" de un extracto de Caja de Ahorro.
 *
 * El banco manda todo apilado en varias líneas dentro de una sola celda:
 *
 *     TRANSFERENCIA A TERCEROS      ← el tipo de movimiento (línea 1)
 *     CU  20208914880               ← CUIT
 *     0170017620000000448154        ← CBU
 *     FNCS                          ← beneficiario
 *     VARIOS                        ← concepto
 *
 * Las reglas de `config_parseo_extracto` dicen, por cuenta y por tipo, qué línea va a qué
 * columna. Así la conciliación puede después buscar por CUIT o por beneficiario en vez de
 * contra un bloque de texto.
 *
 * ⚠️ **Esta lógica es UNA SOLA a propósito.** La usan el importador (al entrar el Excel) y el
 * re-parseo (sobre lo ya guardado en `concepto`). Si fueran dos copias podrían divergir, y un
 * movimiento quedaría desglosado distinto según por dónde entró — sin subtipo de notarlo mirando
 * la grilla. Compartir el código es lo que vuelve verificable al re-parseo: correrlo sobre algo
 * ya importado tiene que dar exactamente lo mismo.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface ReglaParseo {
  campo_destino: string | null
  tipo_regla: string
  numero_linea: number | null
  grupo_de_conceptos: string
  /**
   * Subtipo del movimiento a la que aplica (ver `firmaDeMovimiento`).
   * `null` / ausente = vale para **todas** los subtipos del tipo.
   */
  /**
   * ⚠️ **La columna de la BD se llama `firma_forma` por historia.** El concepto se llama
   * **SUBTIPO** desde el 2026-09-25 (*«mejor ponerle subtipos que formas, es más preciso»*, y la
   * app lo muestra así). La columna NO se renombró: es estructura compartida con el otro clon y
   * el nombre viejo no confunde a nadie mientras esté dicho acá.
   */
  firma_forma?: string | null
}

/** tipo_movimiento → reglas. La clave `*` es el comodín para lo no contemplado. */
export type MapaReglas = Record<string, ReglaParseo[]>

/** Grupo que se asigna cuando ningún set de reglas aplica. Es la marca de "sin desglosar". */
export const GRUPO_SIN_REGLA = "Otros"

/**
 * Grupo que se asigna cuando el tipo TIENE reglas por subtipo pero **ninguna es de este subtipo**.
 *
 * Decisión del usuario (2026-08-10): en ese caso **no se parsea**. Preferimos un movimiento sin
 * desglosar y señalado a uno desglosado con las reglas de otro subtipo — que se vería correcto y
 * estaría mal. Además así un subtipo nuevo del banco **se ve**, en vez de pasar de largo.
 */
export const GRUPO_SUBTIPO_NUEVO = "Subtipo nuevo"

/**
 * Grupo que se asigna cuando **dos reglas reclaman la misma columna**.
 *
 * Decisión del usuario (2026-09-24): *«que directamente no se parsee, así sigue dando alerta y yo
 * veo qué hacer»*. **No alcanzaba con vaciar esa columna**: un movimiento a medio desglosar se ve
 * casi bien y nadie vuelve. Sin desglosar y señalado, en cambio, **queda a la vista** hasta que
 * alguien lo mire — igual que un subtipo nuevo.
 *
 * 📌 Y no se pierde nada: el texto crudo sigue entero en `concepto`, así que arreglada la regla un
 * re-parseo lo resuelve.
 */
export const GRUPO_CHOQUE = "Reglas en conflicto"

/** Divide el texto multilínea en líneas limpias, descartando las vacías. */
export function splitMovimiento(raw: string): string[] {
  return raw
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** ¿La línea es un CUIT? 11 dígitos, con posible prefijo `CU ` o `NO `. */
export function esCuit(linea: string): boolean {
  const limpio = linea.replace(/^(CU|NO)\s+/, "").trim()
  return /^\d{11}$/.test(limpio)
}

/** Primer CUIT que aparezca, sin el prefijo. */
export function extraerCuit(lineas: string[]): string {
  for (const l of lineas) {
    const c = l.replace(/^(CU|NO)\s+/, "").trim()
    if (/^\d{11}$/.test(c)) return c
  }
  return ""
}

/** ¿La línea es un CBU? 22 dígitos. */
export const esCbu = (l: string) => /^\d{22}$/.test(l.trim())
/** ¿La línea es una tarjeta enmascarada? `4517XXXXXXXXXX11`. */
export const esTarjeta = (l: string) => /X{4,}/i.test(l) && /\d/.test(l)
/**
 * ¿La línea nombra la **entidad destino** de la transferencia?
 *
 * Son tres escrituras distintas del mismo dato, y las tres van a la misma columna:
 *
 * | Cómo llega | Ejemplos medidos en MA |
 * |---|---|
 * | nombre completo del banco | `BANCO DE GALICIA Y BUENOS AIRES SAU` |
 * | **código de 4 letras** del Galicia | `FNCS` (BBVA Argentina) · `RIOP` (Santander Río) |
 * | **billetera virtual** | `PERSONAL PAY` · `MERCADO LIBRE SRL` |
 *
 * 🔑 **Confirmado por el usuario 2026-09-25**, después de mirar los 12 movimientos: *«Personal Pay
 * es la billetera virtual de la empresa Personal, Mercado Libre también, FNCS es BBVA Argentina,
 * RIOP es Santander Río. Serían siempre el banco destino entonces.»*
 *
 * 📌 **El código sigue al BANCO, no a la contraparte** — y eso se ve en RIOP: dos personas
 * distintas, dos CBU distintos, los dos empiezan en `072` y los dos dicen `RIOP`.
 *
 * ⚠️ **La lista de códigos va a quedar corta**: hay uno por banco y acá sólo aparecieron dos. El
 * arreglo de fondo es leer la entidad del **prefijo del CBU** (sus 3 primeros dígitos), que además
 * deja el mismo dato llegando por dos caminos → [A-FEAT-1176]. Hasta entonces, lo que no esté en
 * la lista cae como «no sé qué es», que es la falla correcta: pregunta en vez de adivinar.
 */
export const esBanco = (l: string) => {
  const t = l.trim().toUpperCase()
  if (/^BANCO\b/.test(t)) return true
  if (/^(FNCS|RIOP)$/.test(t)) return true                       // códigos del Galicia
  if (/^(PERSONAL PAY|MERCADO LIBRE)\b/.test(t)) return true     // billeteras virtuales
  return false
}

/** Aplica una regla a las líneas del movimiento y devuelve el valor extraído. */
export function aplicarRegla(lineas: string[], regla: ReglaParseo): string {
  switch (regla.tipo_regla) {
    case "linea":
      return lineas[(regla.numero_linea ?? 1) - 1]?.trim() ?? ""

    case "cuit":
      return extraerCuit(lineas)

    case "pre_cuit":
      // La línea ANTERIOR al CUIT — típicamente el nombre. Sólo si el CUIT no viene pegado
      // al tipo: si está en la posición 1 no hay nombre que rescatar.
      for (let i = 1; i < lineas.length; i++) {
        if (esCuit(lineas[i])) {
          return i >= 2 ? lineas[i - 1]?.trim() ?? "" : ""
        }
      }
      return ""

    case "post_cuit":
      for (let i = 0; i < lineas.length - 1; i++) {
        if (esCuit(lineas[i])) return lineas[i + 1]?.trim() ?? ""
      }
      return ""

    case "cbu":
      // 22 dígitos. Igual que `cuit`: lo encuentra esté en la línea que esté, así la regla
      // sobrevive a que el banco corra las líneas.
      for (const l of lineas) if (esCbu(l)) return l.trim()
      return ""

    case "tarjeta":
      for (const l of lineas) if (esTarjeta(l)) return l.trim()
      return ""

    case "nro_operacion":
      for (const l of lineas) {
        const m1 = l.match(/OPERACION\s+(\S+)/i)
        if (m1) return m1[1]
        const m2 = l.match(/OP:(\S+)/i)
        if (m2) return m2[1]
      }
      // Fallback: último segmento numérico que no sea un CUIT
      for (let i = lineas.length - 1; i >= 1; i--) {
        const l = lineas[i].trim()
        if (/^\d+$/.test(l) && !/^\d{11}$/.test(l)) return l
      }
      return ""
  }
  return ""
}

/**
 * Desglosa un movimiento según las reglas. Devuelve un objeto `campo_destino → valor`.
 *
 * Si no hay regla para el tipo (ni comodín), sólo se llena `descripcion` con la primera línea
 * y `grupo_de_conceptos` con `"Otros"`. **El texto completo no se pierde**: el importador lo
 * guarda aparte en `concepto`, y de ahí lo lee el re-parseo.
 */
export function parsearMovimiento(raw: string, mapaReglas: MapaReglas): Record<string, string> {
  const lineas = splitMovimiento(raw)
  const tipoLinea1 = (lineas[0] ?? "").toUpperCase()
  const resultado: Record<string, string> = {}

  const { reglas, subtipoNuevo } = resolverReglas(lineas, mapaReglas)

  if (subtipoNuevo) {
    // No se parsea a propósito. El texto crudo sigue entero en `concepto`, así que un re-parseo
    // posterior lo resuelve apenas se escriba la regla de este subtipo.
    resultado["grupo_de_conceptos"] = GRUPO_SUBTIPO_NUEVO
    resultado["descripcion"] = tipoLinea1 || raw.substring(0, 100)
    return resultado
  }

  resultado["grupo_de_conceptos"] = reglas.length > 0 ? reglas[0].grupo_de_conceptos : GRUPO_SIN_REGLA

  /**
   * 🛑 **Si dos reglas apuntan a la MISMA columna, esa columna queda VACÍA.**
   *
   * Pedido del usuario 2026-09-24: *«en caso de que durante el parseo dos datos quieran ir al mismo
   * lugar —que pensamos que es imposible— sería bueno que el dato quede sin parsear por ese choque»*.
   *
   * 🔑 **Es un control de INTEGRIDAD, y por eso frena en vez de avisar** (§ `CLAUDE.md` 🚦): que dos
   * datos distintos reclamen el mismo destino no tiene explicación de negocio posible — es una regla
   * mal escrita. Antes **ganaba la última en silencio**, que es el peor de los desenlaces: queda un
   * dato creíble en la columna equivocada y nadie lo revisa.
   *
   * 📌 Vaciar **no pierde nada**: el texto crudo sigue entero en `concepto`, así que arreglada la
   * regla, un re-parseo lo recupera.
   */
  const porCampo = new Map<string, string[]>()
  for (const regla of reglas) {
    if (!regla.campo_destino) continue
    const valor = aplicarRegla(lineas, regla)
    porCampo.set(regla.campo_destino, [...(porCampo.get(regla.campo_destino) ?? []), valor])
  }

  // 🛑 Un choque no deja el movimiento a medias: lo deja SIN PARSEAR y señalado, para que se vea.
  const enConflicto = [...porCampo.entries()]
    .filter(([, vs]) => new Set(vs.filter(v => v !== "")).size > 1)
    .map(([campo]) => campo)

  if (enConflicto.length > 0) {
    return {
      grupo_de_conceptos: GRUPO_CHOQUE,
      descripcion: tipoLinea1 || raw.substring(0, 100),
    }
  }

  for (const [campo, valores] of porCampo) {
    resultado[campo] = valores.find(v => v !== "") ?? ""
  }

  // La descripción siempre tiene al menos el tipo
  if (!resultado["descripcion"]) {
    resultado["descripcion"] = tipoLinea1 || raw.substring(0, 100)
  }

  return resultado
}

/**
 * Qué reglas se aplican a este movimiento, y si su subtipo es desconocida.
 *
 * Las reglas de un tipo son de dos clases:
 * - **genéricas** (`firma_forma` vacío): valen para todos los subtipos. Son las de los modos que
 *   buscan — el CUIT y el nombre están donde estén.
 * - **por subtipo**: valen sólo para esa subtipo. Son las que cuentan líneas, porque contar sólo
 *   tiene sentido dentro de un subtipo.
 *
 * Se aplican las genéricas y encima las de el subtipo, así que ante el mismo `campo_destino` **manda
 * la específica**.
 *
 * ⚠️ **Y si el tipo tiene reglas por subtipo pero ninguna es de ESTE subtipo → no se parsea**
 * (`subtipoNuevo`). Ver `GRUPO_SUBTIPO_NUEVO`.
 */
export function resolverReglas(
  lineas: string[],
  mapaReglas: MapaReglas,
): { reglas: ReglaParseo[]; subtipoNuevo: boolean } {
  const tipoLinea1 = (lineas[0] ?? "").toUpperCase()
  // El match del tipo es EXACTO (ignorando mayúsculas). Por eso `COMPRA DEBITO` no encuentra
  // la regla de `COMPRA CON DEBITO`: para el sistema son dos tipos distintos.
  const claveExacta = Object.keys(mapaReglas).find((k) => k.toUpperCase() === tipoLinea1)
  const delTipo = claveExacta ? mapaReglas[claveExacta] : mapaReglas["*"] ?? []

  const firma = firmaDeMovimiento(lineas)
  const genericas = delTipo.filter((r) => !r.firma_forma)
  const propias = delTipo.filter((r) => r.firma_forma === firma)
  const tieneReglasPorForma = delTipo.some((r) => !!r.firma_forma)

  if (tieneReglasPorForma && propias.length === 0) {
    return { reglas: [], subtipoNuevo: true }
  }
  return { reglas: [...genericas, ...propias], subtipoNuevo: false }
}

/** ¿Este movimiento quedó sin parsear por ser de un subtipo no contemplada? */
export function esSubtipoNuevo(raw: string | null | undefined, mapaReglas: MapaReglas): boolean {
  const lineas = splitMovimiento(String(raw ?? ""))
  if (lineas.length === 0) return false
  return resolverReglas(lineas, mapaReglas).subtipoNuevo
}

/** El tipo de movimiento de un texto crudo: su primera línea, normalizada. */
export function tipoDeMovimiento(raw: string | null | undefined): string {
  return splitMovimiento(String(raw ?? ""))[0]?.toUpperCase() ?? ""
}

/** ¿Existe una regla propia para este tipo? (el comodín `*` no cuenta como propia) */
export function tieneReglaPropia(raw: string | null | undefined, mapaReglas: MapaReglas): boolean {
  const tipo = tipoDeMovimiento(raw)
  if (!tipo) return false
  return Object.keys(mapaReglas).some((k) => k !== "*" && k.toUpperCase() === tipo)
}

/** Carga las reglas activas de una cuenta, agrupadas por tipo de movimiento. */
export async function cargarReglasParseo(
  supabase: SupabaseClient,
  cuentaBancariaId: string,
): Promise<MapaReglas> {
  // `select("*")` a propósito: `firma_forma` es una columna nueva y con el listado explícito la
  // consulta fallaría en cualquier entorno donde el ALTER TABLE todavía no se corrió. Así, hasta
  // que exista, `firma_forma` llega `undefined` y todas las reglas se tratan como genéricas —
  // exactamente el comportamiento anterior.
  const { data, error } = await supabase
    .from("config_parseo_extracto")
    .select("*")
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .eq("activo", true)
    .order("orden", { ascending: true })

  if (error || !data) {
    console.error("Error cargando reglas de parseo:", error)
    return {}
  }

  const mapa: MapaReglas = {}
  for (const r of data as any[]) {
    const tipo = r.tipo_movimiento
    if (!mapa[tipo]) mapa[tipo] = []
    mapa[tipo].push({
      campo_destino: r.campo_destino,
      tipo_regla: r.tipo_regla,
      numero_linea: r.numero_linea,
      grupo_de_conceptos: r.grupo_de_conceptos ?? "",
      firma_forma: r.firma_forma ?? null,
    })
  }
  return mapa
}

// ────────────────────────────────────────────────────────────────────────────
// PROPUESTA DE MAPEO — qué es cada línea y a qué columna va
//
// El extracto del Galicia no es texto libre: el mismo tipo de dato aparece siempre de la misma
// subtipo. Un CUIT son 11 dígitos con prefijo `CU`/`NO`; un CBU son 22; el nombre del beneficiario
// va justo antes del CUIT. Eso ya lo sabemos, así que **no tiene por qué preguntarse**.
//
// La convención de columnas, que es la que respetan las 49 reglas ya cargadas:
//
//   descripcion            el tipo de movimiento (línea 1)
//   leyendas_adicionales_1 el nombre / beneficiario / comercio
//   leyendas_adicionales_2 EL CUIT — de acá lo lee el motor de conciliación
//   leyendas_adicionales_3 el concepto
//   leyendas_adicionales_4 el banco de la contraparte
//   numero_de_comprobante  el número de operación o el código de autorización
//   numero_de_terminal     identificadores largos del banco
//   tipo_de_movimiento     EL CBU  ← decisión del usuario 2026-08-10, ver abajo
//
// ⚠️ `tipo_de_movimiento` guarda el CBU **a pesar de su nombre**. Se revisaron las 37 columnas de
// las 4 tablas de extracto y es la única sin dueño: en cuenta corriente el banco manda siempre
// `"Imputado"` (información cero) y en Caja de Ahorro nunca se llena. Todas las demás tienen un
// ocupante legítimo — incluida `observaciones_cliente`, que en CA trae los **comentarios del
// usuario** desde la columna «Comentarios» del Excel. La convención está documentada en
// `ARQUITECTURA-BD.md` § 6b y la pantalla lo rotula como CBU, no por su nombre de columna.
//
// Lo que NO sabemos se propone **sin asignar**, nunca adivinando: un dato creíble en la columna
// equivocada es peor que un dato ausente, porque nadie lo va a revisar.
// ────────────────────────────────────────────────────────────────────────────

/**
 * La columna donde va el CBU. Se nombra acá para que el "por qué" viva junto al valor:
 * es `tipo_de_movimiento` por descarte, no por su nombre. Ver el bloque de arriba.
 */
export const COLUMNA_CBU = "tipo_de_movimiento"

/** Qué contenido reconocimos en una línea. `""` = no lo sabemos. */
export type ContenidoLinea =
  | "tipo" | "cuit" | "nombre" | "concepto" | "operacion"
  | "cbu" | "banco" | "tarjeta" | "autorizacion" | "identificador" | ""

export interface LineaPropuesta {
  /** La línea tal cual vino del banco. */
  texto: string
  /** Qué reconocimos, para mostrarlo. */
  contenido: ContenidoLinea
  /** Columna propuesta. `""` = sin asignar. */
  campo: string
  /** Modo con el que conviene extraerlo. */
  modo: string
  /** Nº de línea (1-based), sólo relevante con modo `linea`. */
  numero: number
  /** `true` cuando el formato del banco no deja lugar a dudas. */
  seguro: boolean
  /** Por qué se propuso esto. Se muestra al usuario. */
  motivo: string
}

/**
 * 📋 **LA ESTRUCTURA — qué reconoce la app y dónde lo guarda.**
 *
 * Es la **misma lista que usa `proponerMapeo`**, expuesta para que la pantalla la muestre. Vive acá
 * y no en el componente **a propósito**: si la tabla que ve el usuario se escribiera aparte,
 * el día que cambie una columna quedarían dos verdades y la pantalla mentiría (§ `CLAUDE.md` ♻️).
 *
 * 📍 La convención está documentada en `ARQUITECTURA-BD.md` § Convención de columnas, y sale de
 * medir los 849 movimientos de MSA que el banco llenó solo. **Vale igual para MA y PAM CA**, que
 * tienen el mismo formato.
 */
/**
 * 🎛️ **QUÉ ES EL DATO → DÓNDE VA.** La tabla que convierte una cosa en la otra.
 *
 * Pedido del usuario 2026-09-24, y es un cambio de fondo en cómo se configura:
 * *«yo audito que el reconocimiento esté ok, pero no le digo dónde guardar. Ya está establecido
 * dónde va cada uno. Editar uno sería editar todos, si no no hay coherencia.»*
 *
 * 🔑 **El destino deja de ser una elección y pasa a ser una consecuencia.** El usuario corrige
 * *«esto no es un identificador, es el concepto»* y la columna se acomoda sola. Así el mismo dato
 * **no puede** terminar en dos columnas distintas según el tipo de movimiento — que es el desorden
 * que esto vino a cerrar.
 */
export const DESTINO_POR_CONTENIDO: Record<string, { campo: string; modo: string; label: string }> = {
  tipo:          { campo: "descripcion",            modo: "linea",         label: "Tipo de movimiento" },
  nombre:        { campo: "leyendas_adicionales_1", modo: "linea",         label: "Nombre / comercio" },
  cuit:          { campo: "leyendas_adicionales_2", modo: "cuit",          label: "CUIT de la contraparte" },
  concepto:      { campo: "leyendas_adicionales_3", modo: "linea",         label: "Concepto — qué se pagó" },
  banco:         { campo: "leyendas_adicionales_4", modo: "linea",         label: "Banco o red (LINK, MODO…)" },
  cbu:           { campo: COLUMNA_CBU,              modo: "cbu",           label: "CBU destino" },
  operacion:     { campo: "numero_de_comprobante",  modo: "nro_operacion", label: "Nº de operación" },
  autorizacion:  { campo: "numero_de_comprobante",  modo: "linea",         label: "Código de autorización" },
  identificador: { campo: "numero_de_terminal",     modo: "linea",         label: "Terminal / sucursal del banco" },
  tarjeta:       { campo: "numero_de_terminal",     modo: "linea",         label: "Tarjeta con la que se pagó" },
}

export const ESTRUCTURA_DATOS: {
  dato: string; ejemplo: string; columna: string; clave?: boolean; nota?: string
}[] = [
  { dato: "Tipo de movimiento", ejemplo: "COMPRA DEBITO", columna: "descripcion",
    nota: "Siempre la primera línea" },
  { dato: "Nombre / beneficiario / comercio", ejemplo: "WILSON SEVERIANO BARRETO", columna: "leyendas_adicionales_1",
    nota: "La línea justo antes del CUIT" },
  { dato: "CUIT de la contraparte", ejemplo: "33716360429", columna: "leyendas_adicionales_2", clave: true,
    nota: "11 dígitos. De acá lo lee el motor de conciliación — si no hay CUIT, queda VACÍA" },
  { dato: "Concepto", ejemplo: "VARIOS", columna: "leyendas_adicionales_3",
    nota: "La línea justo después del CUIT" },
  { dato: "Entidad destino", ejemplo: "BANCO SANTANDER RIO S.A. · RIOP · PERSONAL PAY", columna: "leyendas_adicionales_4",
    nota: "El banco de la contraparte, escrito entero o con el código de 4 letras del Galicia (FNCS = BBVA, RIOP = Santander Río), o la billetera virtual" },
  { dato: "Red por la que salió", ejemplo: "LINK", columna: "leyendas_adicionales_4",
    nota: "Va en la MISMA columna que la entidad: cuando el banco manda LINK no manda además el banco, y los dos contestan por dónde salió" },
  { dato: "CBU destino", ejemplo: "0070999030004012345678", columna: COLUMNA_CBU,
    nota: "22 dígitos. La columna se llama «tipo_de_movimiento» por historia, pero guarda el CBU" },
  { dato: "Nº de operación", ejemplo: "60616565", columna: "numero_de_comprobante" },
  { dato: "Código de autorización", ejemplo: "A837", columna: "numero_de_comprobante",
    nota: "Comparte columna con el nº de operación, y está bien: medido sobre los 21 tipos, NUNCA vienen los dos juntos. Es el mismo dato con dos nombres según el canal" },
  { dato: "Terminal o sucursal del banco", ejemplo: "Terminal: 0500", columna: "numero_de_terminal",
    nota: "El instrumento: por dónde pasó la plata" },
  { dato: "Tarjeta con la que se pagó", ejemplo: "4517XXXXXXXXXX11", columna: "numero_de_terminal",
    nota: "Misma columna que la terminal — nunca vienen las dos. Son sólo 2 tarjetas en 51 movimientos: es TU instrumento, no del comercio" },
  { dato: "No reconocido", ejemplo: "—", columna: "",
    nota: "Se deja sin asignar a propósito: un dato creíble en la columna equivocada es peor que uno ausente" },
]

/** 🛑 Las dos columnas que el parseo NO puede tocar. */
export const COLUMNAS_INTOCABLES: { columna: string; porque: string }[] = [
  { columna: "concepto", porque: "Guarda el TEXTO CRUDO entero del banco. Es lo que hace posible volver a parsear sin re-importar el Excel." },
  { columna: "observaciones_cliente", porque: "Son TUS comentarios, los que escribís en la columna «Comentarios» del Excel. En un gasto sin factura es la única anotación de qué fue." },
]

/**
 * 🎯 **Detectores agregados 2026-09-24, medidos sobre los 462 renglones de MA y PAM CA.**
 *
 * Antes quedaban **58 sin reconocer y 144 dudosos**. Cada uno de estos sale de un caso real que
 * obligaba al usuario a corregir a mano, y el pedido fue explícito: *«que la propuesta de la app
 * sea lo mejor posible y yo no tenga que cambiar muchas cosas»*.
 */

/** `Terminal: 0500` — 12 renglones. Es literalmente la terminal, con el rótulo adelante. */
const esTerminalRotulada = (l: string) => /^terminal\s*:/i.test(l.trim())

/** `Sucursal: 0360` — 12 renglones. Dónde se hizo la operación, no un nombre de contraparte. */
const esSucursal = (l: string) => /^sucursal\s*:/i.test(l.trim())

/**
 * `LINK` — 36 renglones, el caso más grande. Es la **red** por la que viajó la transferencia.
 * Va con el banco porque responde lo mismo: por qué canal salió del otro lado.
 */
const esRed = (l: string) => /^(LINK|BANELCO|MODO|DEBIN|COELSA|INTERBANKING)$/i.test(l.trim())

/**
 * `004105544412`, `007001005392` — 11 renglones. **Empiezan con cero**, y eso los delata: un
 * identificador del banco no se rellena con ceros a la izquierda, un **número de servicio o
 * partida sí** (la partida de AGIP, el nº de cliente de AySA). Es *qué* se pagó → el concepto.
 */
const esNumeroDeServicio = (l: string) => /^0\d{7,}$/.test(l.trim())

/** `CONSUMO`, `TRANSF.PROPIAS` — una sola palabra en mayúsculas y sin dígitos: es el concepto. */
const esConceptoSuelto = (l: string) =>
  /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.\/\s-]{2,24}$/.test(l.trim()) && !/\d/.test(l) && l.trim().split(/\s+/).length <= 2

/** `Enero 2026` — 9 renglones. El período que se liquida, no un nombre. */
const esPeriodo = (l: string) =>
  /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-zé]*\.?\s+\d{4}$/i.test(l.trim())

const esAutorizacion = (l: string) => /^[A-Z]\d{3,4}$/.test(l.trim())
const esIdentificador = (l: string) => /^\d{8,}$/.test(l.trim()) && !esCbu(l) && !/^\d{11}$/.test(l.trim())

// ────────────────────────────────────────────────────────────────────────────
// FIRMA DE SUBTIPO — qué hace que dos movimientos sean "el mismo tipo"
//
// Hasta 2026-08-10 el tipo era **sólo la primera línea**. Alcanzaba hasta que apareció
// `TRANSFERENCIA A TERCEROS`, que llega de dos subtipos: 16 movimientos de 6 líneas con el CUIT en
// la 2, y 7 de 5 líneas con el CUIT en la 3 y con nombre. Mostrados como un tipo homogéneo, las
// reglas por número de línea se escribieron para el subtipo que estaba a la vista y fallan en la
// otra — sin decir nada (ver PENDIENTES § A-BUG-17).
//
// La firma es **cantidad de líneas + qué clase de dato hay en cada una**. Dos movimientos con la
// misma cantidad de líneas pueden ser subtipos distintos si en uno la línea 3 es un CUIT y en el
// otro un texto, así que contar líneas solo no alcanza.
// ────────────────────────────────────────────────────────────────────────────

/** La clase de dato de una línea, para comparar subtipos. */
export function claseDeLinea(l: string, indice: number): string {
  if (indice === 0) return "tipo"
  if (esCuit(l)) return "cuit"
  if (esCbu(l)) return "cbu"
  if (esTarjeta(l)) return "tarjeta"
  if (/^\d+$/.test(l.trim())) return "num"
  return "texto"
}

/** Firma de el subtipo del movimiento. Dos movimientos con la misma firma son intercambiables. */
export function firmaDeMovimiento(lineas: string[]): string {
  return `${lineas.length}:${lineas.map(claseDeLinea).join(",")}`
}

/** Cuántas líneas describe una firma. */
export function lineasDeFirma(firma: string): number {
  return Number(firma.split(":")[0]) || 0
}

/** ¿La línea trae un número de operación, y lo agarra el modo `nro_operacion`? */
function operacionEnLinea(l: string): { hay: boolean; loAgarra: boolean } {
  const loAgarra = /OPERACION\s+\S/i.test(l) || /OP:\S/i.test(l)
  const hay = loAgarra || /OPERACION/i.test(l)
  return { hay, loAgarra }
}

/**
 * Propone, para cada línea del movimiento, qué es y dónde debería guardarse.
 * Es una **propuesta**: la pantalla la muestra editable y el usuario decide.
 */
export function proponerMapeo(lineas: string[]): LineaPropuesta[] {
  const idxCuit = lineas.findIndex((l) => esCuit(l))

  return lineas.map((texto, i) => {
    const base = { texto, numero: i + 1 }

    if (i === 0)
      return { ...base, contenido: "tipo" as const, campo: "descripcion", modo: "linea",
        seguro: true, motivo: "La primera línea es siempre el tipo de movimiento" }

    if (esCuit(texto))
      return { ...base, contenido: "cuit" as const, campo: "leyendas_adicionales_2", modo: "cuit",
        seguro: true, motivo: "11 dígitos: es el CUIT. Va donde el motor lo busca, y con el modo que lo encuentra aunque cambie de línea" }

    if (esCbu(texto))
      return { ...base, contenido: "cbu" as const, campo: COLUMNA_CBU, modo: "cbu",
        seguro: true, motivo: "22 dígitos: es un CBU. Va a la columna acordada para CBU, con el modo que lo encuentra en cualquier subtipo" }

    if (esBanco(texto))
      return { ...base, contenido: "banco" as const, campo: "leyendas_adicionales_4", modo: "linea",
        seguro: true, motivo: "Es la entidad destino: el banco, su código del Galicia (FNCS = BBVA, RIOP = Santander Río) o una billetera (Personal Pay, Mercado Libre)" }

    if (esRed(texto))
      return { ...base, contenido: "banco" as const, campo: "leyendas_adicionales_4", modo: "linea",
        seguro: true, motivo: "Es la RED por la que salió (LINK, MODO…), no un banco. Va en la misma columna porque cuando el banco manda la red no manda además la entidad" }

    if (esTerminalRotulada(texto))
      return { ...base, contenido: "identificador" as const, campo: "numero_de_terminal", modo: "linea",
        seguro: true, motivo: "Dice «Terminal»: es el cajero donde se operó" }

    if (esSucursal(texto))
      return { ...base, contenido: "nombre" as const, campo: "leyendas_adicionales_1", modo: "linea",
        seguro: true, motivo: "Dice «Sucursal»: dónde se hizo la operación. Va donde MSA la guarda" }

    if (esPeriodo(texto))
      return { ...base, contenido: "concepto" as const, campo: "leyendas_adicionales_3", modo: "linea",
        seguro: true, motivo: "Es el período que se liquida, no un nombre" }

    if (esNumeroDeServicio(texto))
      return { ...base, contenido: "concepto" as const, campo: "leyendas_adicionales_3", modo: "linea",
        seguro: true, motivo: "Empieza con cero: es un número de servicio o partida (qué se pagó), no un identificador del banco" }

    if (esTarjeta(texto))
      return { ...base, contenido: "tarjeta" as const, campo: "numero_de_terminal", modo: "linea",
        seguro: true, motivo: "Tarjeta con la que se pagó. Va al instrumento — la misma columna que la terminal del cajero: nunca vienen las dos" }

    const op = operacionEnLinea(texto)
    if (op.hay)
      return { ...base, contenido: "operacion" as const, campo: "numero_de_comprobante",
        modo: op.loAgarra ? "nro_operacion" : "linea", seguro: true,
        motivo: op.loAgarra
          ? "Número de operación"
          : "Dice «Operacion» pero el modo no lo sabe leer (los dos puntos) — se guarda la línea entera" }

    if (idxCuit >= 0 && i === idxCuit - 1 && i >= 1)
      return { ...base, contenido: "nombre" as const, campo: "leyendas_adicionales_1", modo: "pre_cuit",
        seguro: true, motivo: "La línea antes del CUIT es el nombre de la contraparte" }

    if (idxCuit >= 0 && i === idxCuit + 1)
      return { ...base, contenido: "concepto" as const, campo: "leyendas_adicionales_3", modo: "post_cuit",
        seguro: false, motivo: "Después del CUIT suele venir el concepto — conviene mirarlo" }

    if (idxCuit < 0 && i === 1 && !/^\d+$/.test(texto.trim()))
      return { ...base, contenido: "nombre" as const, campo: "leyendas_adicionales_1", modo: "linea",
        seguro: false, motivo: "Sin CUIT en el texto, la línea 2 suele ser el comercio o la contraparte" }

    if (esAutorizacion(texto))
      return { ...base, contenido: "autorizacion" as const, campo: "numero_de_comprobante", modo: "linea",
        seguro: false, motivo: "Parece un código de autorización" }

    if (esIdentificador(texto))
      return { ...base, contenido: "identificador" as const, campo: "numero_de_terminal", modo: "linea",
        seguro: false, motivo: "Número largo del banco" }

    if (esConceptoSuelto(texto))
      return { ...base, contenido: "concepto" as const, campo: "leyendas_adicionales_3", modo: "linea",
        seguro: false, motivo: "Una o dos palabras sin números: suele ser el concepto (CONSUMO, VARIOS…)" }

    return { ...base, contenido: "" as const, campo: "", modo: "linea",
      seguro: false, motivo: "No lo reconocimos — decidilo vos" }
  })
}

/** Los campos que escribe el desglose. Todo lo demás del movimiento no se toca. */
export const CAMPOS_DEL_PARSEO = [
  "descripcion",
  "grupo_de_conceptos",
  "tipo_de_movimiento",
  "numero_de_comprobante",
  "numero_de_terminal",
  "observaciones_cliente",
  "leyendas_adicionales_1",
  "leyendas_adicionales_2",
  "leyendas_adicionales_3",
  "leyendas_adicionales_4",
] as const

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORÍA DE UN SUBTIPO — A-FEAT-1177
//
// 🧮 **El control que faltaba, y por qué está acá y no en la pantalla.**
//
// El 2026-09-25 se midió que **40 de los 96 movimientos de MA quedarían con datos en la columna
// equivocada** si se re-parseaba con las reglas cargadas ([A-BUG-1200](../../PENDIENTES.md)). El
// número salió de un script que corrió una vez y **no lo veía nadie** — que es justamente lo que
// la § 🧮 de `CLAUDE.md` prohíbe: *un control que nadie ve no es un control*.
//
// Vive en el motor para que la pantalla, la API y cualquier script digan **el mismo número**. Si
// la pantalla tuviera su propia cuenta, el día que cambie una regla empiezan a diferir y no hay
// forma de saber cuál miente.
//
// 🔑 **Qué compara, y es objetivo**: lo que la línea **ES** (`proponerMapeo`, que sólo opina
// cuando está seguro) contra **dónde la mandan las reglas de hoy**. No es una opinión de estilo:
// si la línea es un CBU y termina en el número de comprobante, la conciliación por CBU no lo
// encuentra. Punto.
// ─────────────────────────────────────────────────────────────────────────────

/** Una línea sobre la que la app opina distinto de lo que está guardado. */
export interface HallazgoSubtipo {
  /** Número de línea como lo ve el usuario (1 = la primera). */
  linea: number
  texto: string
  /** Qué dice la app que es, en lenguaje de la app. */
  es: string
  /** Columna que propone la app. */
  debeIr: string
  /** Columna donde está guardado hoy. `null` = no se guarda en ningún lado. */
  cayoEn: string | null
}

/** Dos o más líneas peleando la misma columna. **Esto no es opinión: una se pierde.** */
export interface ChoqueSubtipo {
  campo: string
  lineas: number[]
}

/** El estado de un subtipo: qué cierra, qué se discute y qué está roto. */
export interface AuditoriaSubtipo {
  /**
   * 🟠 **Discrepancias, no errores.** La app reconoce la línea con certeza y lo guardado dice
   * otra cosa. **Puede tener razón cualquiera de los dos** — la app no conoce el negocio, y él sí.
   * Por eso se muestran para decidir, y **nada se cambia solo** (§ `CLAUDE.md` 🎚️).
   */
  hallazgos: HallazgoSubtipo[]
  /**
   * 🔴 **Choques: esto SÍ está roto y frena.** Dos líneas guardadas en la misma columna: al
   * parsear **gana una y la otra se pierde**, sin aviso. No hay explicación de negocio posible
   * para que dos datos distintos vayan al mismo lugar — es la § 🚦 *integridad*, que frena.
   */
  choques: ChoqueSubtipo[]
  /** Líneas que la app NO sabe qué son y que no tienen regla. Es su trabajo, y ninguno más. */
  decideElUsuario: number[]
  /** Líneas guardadas y sin discusión. */
  resueltas: number
  /**
   * Reglas que **cuentan renglones y no dicen de qué subtipo son**. Se aplican a todos los
   * subtipos del tipo y aciertan en uno solo — la causa de A-BUG-1200.
   */
  reglasQueCuentanSinSubtipo: number
}

export function auditarSubtipo(lineas: string[], reglas: ReglaParseo[]): AuditoriaSubtipo {
  // El modo `cuit` guarda el número sin el prefijo `CU `/`NO ` del Galicia: hay que normalizar
  // los dos lados o el CUIT bien guardado se reporta como diferencia. (Pasó al medir: 3 falsos.)
  const norm = (s: string) => String(s ?? "").replace(/^(CU|NO)\s+/i, "").trim()

  const propuesta = proponerMapeo(lineas)
  const hallazgos: HallazgoSubtipo[] = []
  const decideElUsuario: number[] = []
  const porCampo = new Map<string, number[]>()
  let resueltas = 0

  propuesta.forEach((p, i) => {
    // La regla que apunta a ESTA línea, según cómo extrae
    const suya = reglas.find(r => {
      if (!r.campo_destino) return false
      return norm(aplicarRegla(lineas, r)) === norm(lineas[i])
    })

    if (suya?.campo_destino) {
      porCampo.set(suya.campo_destino, [...(porCampo.get(suya.campo_destino) ?? []), i + 1])
      /**
       * 🔕 **Una regla atada a su subtipo es una decisión del usuario: no se vuelve a discutir.**
       *
       * Sólo se señala la discrepancia cuando la regla es **vieja y genérica** (`firma_forma`
       * vacío): ésas nadie las eligió mirando este subtipo, son las que arrastran el desorden de
       * A-BUG-1200. Sin este corte, la app le marcaba en ámbar —para siempre— algo que él acababa
       * de decidir y guardar, y eso es ruido que entrena a ignorar los avisos.
       */
      const laDecidioEl = !!suya.firma_forma
      if (!laDecidioEl && p.seguro && p.campo && p.campo !== suya.campo_destino) {
        hallazgos.push({
          linea: i + 1, texto: lineas[i],
          es: DESTINO_POR_CONTENIDO[p.contenido]?.label ?? p.contenido,
          debeIr: p.campo, cayoEn: suya.campo_destino,
        })
      } else {
        resueltas++
      }
      return
    }

    // Sin regla: o la app sabe y falta guardarlo, o no sabe y lo decide él
    if (p.seguro && p.campo) {
      hallazgos.push({
        linea: i + 1, texto: lineas[i],
        es: DESTINO_POR_CONTENIDO[p.contenido]?.label ?? p.contenido,
        debeIr: p.campo, cayoEn: null,
      })
    } else {
      decideElUsuario.push(i + 1)
    }
  })

  const choques = [...porCampo.entries()]
    .filter(([, ls]) => ls.length > 1)
    .map(([campo, ls]) => ({ campo, lineas: ls }))

  return {
    hallazgos,
    choques,
    decideElUsuario,
    resueltas,
    reglasQueCuentanSinSubtipo: reglas.filter(r => r.tipo_regla === "linea" && !r.firma_forma).length,
  }
}


/**
 * De la columna de vuelta a **qué es el dato**. Sirve para no perder una decisión vieja del
 * usuario cuando la app no sabe reconocer la línea. Si una columna admite dos contenidos (el
 * número de comprobante guarda operación *o* autorización), devuelve el primero: van al mismo lado.
 */
export function contenidoDeCampo(campo: string | null | undefined, modo?: string): string {
  if (!campo) return ""
  const candidatos = Object.entries(DESTINO_POR_CONTENIDO).filter(([, d]) => d.campo === campo)
  if (candidatos.length === 0) return ""
  /**
   * ⚠️ **Cuando dos contenidos comparten columna, desempata el MODO.**
   *
   * `numero_de_comprobante` guarda dos cosas distintas: el **nº de operación** (que se busca con
   * el modo `nro_operacion`) y el **código de autorización** (que se toma de una línea, modo
   * `linea`). Sin mirar el modo, la regla del usuario que decía *«código de autorización»* se
   * mostraba como *«Nº de operación»* — el dato terminaba en el mismo lugar, pero el cartel decía
   * otra cosa que la que él había elegido.
   */
  if (modo) {
    const exacto = candidatos.find(([, d]) => d.modo === modo)
    if (exacto) return exacto[0]
  }
  return candidatos[0][0]
}

/**
 * Cómo se abre en el editor una línea que **ya tiene una regla guardada**.
 *
 * 🛑 **LO GUARDADO ES LA VERDAD. La app opina, y su opinión no pisa nada.**
 *
 * Costó tres vueltas llegar acá, las tres encontradas por el usuario el 2026-09-25:
 * 1. se copiaba la columna vieja y el desplegable la contradecía ([A-BUG-1202]);
 * 2. se hizo ganar a la propuesta, y **una corazonada le pisó una decisión** ([A-BUG-1205]);
 * 3. se hizo ganar sólo a la propuesta *segura*, y **le siguió pisando decisiones** — porque la
 *    app está segura de que `0000055193` es un concepto, y él había decidido que era el código de
 *    autorización. Guardaba bien y la pantalla se lo revertía ([A-BUG-1207]).
 *
 * 🔑 **El modelo correcto es el más simple, y ya estaba escrito en `CLAUDE.md` § 🎚️**: *campo
 * lleno = acá mando yo*. Una regla guardada **es** el valor. Cuando la app piensa otra cosa, eso
 * es una **sugerencia** que se muestra al lado y se aplica con un click — nunca sola.
 *
 * 📌 Lo que la app sí aporta siempre: **cómo se llama** lo que él eligió, cuando la columna no
 * alcanza para saberlo (`numero_de_comprobante` es nº de operación *y* código de autorización, y
 * las desempata el modo).
 */
export function resolverFilaExistente(
  propuesta: { contenido: string; campo: string; modo: string; seguro: boolean },
  regla: { campo_destino: string | null; tipo_regla: string }
): {
  contenido: string; campo: string; modo: string; seguro: boolean
  /** Lo que diría la app si mandara ella. `null` = está de acuerdo, o no sabe. */
  sugerencia: { contenido: string; campo: string; modo: string } | null
} {
  const campo = regla.campo_destino ?? ""
  const contenido = contenidoDeCampo(campo, regla.tipo_regla) || propuesta.contenido
  const disiente = propuesta.seguro && !!propuesta.campo && propuesta.campo !== campo
  return {
    contenido,
    campo,
    modo: regla.tipo_regla,
    // Es una decisión guardada: no es «propuesta a confirmar».
    seguro: true,
    sugerencia: disiente
      ? { contenido: propuesta.contenido, campo: propuesta.campo, modo: propuesta.modo }
      : null,
  }
}

