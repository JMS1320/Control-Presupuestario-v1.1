/**
 * 📈 **EL IPC DEL INDEC, MES A MES** (A-FEAT-1215).
 *
 * Pedido del usuario 2026-09-30: *«así como estuvimos desarrollando el scrapeo de precios, hay que
 * hacerlo con el IPC publicado por INDEC, mes a mes»*.
 *
 * ## Por qué urge más de lo que parece
 *
 * `public.indices_ipc` figura en `ARQUITECTURA-BD.md` como **«VACÍA — hay que cargarla para los
 * métodos IPC del presupuesto»**. Mientras lo esté: los sueldos `plano_ipc` y `por_hora_ipc` (JMS y
 * AMS) tienen el IPC **pendiente** —está escrito así en `MODULO_SUELDOS.md`— y los métodos IPC del
 * presupuesto no tienen base.
 *
 * ## 🔄 Se puede correr INCREMENTAL, y eso lo dijo el usuario
 *
 * > *«INDEC publica sobre el mes anterior pero **nunca cambia los ya publicados**»* (2026-09-30).
 *
 * 🔑 **Eso simplifica el circuito entero**: una cifra publicada no se revisa nunca, así que lo ya
 * cargado **no hay que volver a mirarlo** — alcanza con sumar el mes nuevo. Y por lo mismo, para los
 * meses **ya pasados manda el dato real** sobre cualquier proyección (§ 🎚️ *default del dato real*).
 *
 * ## 🔓 La fuente: la API de series de tiempo del Estado, no el PDF
 *
 * `apis.datos.gob.ar/series/api/series` — **abierta, sin token**, y devuelve JSON. La serie del IPC
 * nacional nivel general (base dic-2016) es **`148.3_INIVELNAL_DICI_M_26`**, y la misma llamada puede
 * traer **el nivel, la variación mensual y la interanual** juntos, pidiéndolos como
 * `:percent_change` y `:percent_change_a_year_ago`.
 *
 * 📌 Se eligió la API y no el PDF del informe de prensa por lo obvio: **un PDF que cambia de maqueta
 * rompe el parser**, y acá hay un JSON estable con la misma fuente oficial.
 *
 * ## 🧨 LA TRAMPA, y es la misma familia que las cuatro de los precios
 *
 * **Pedir la serie en orden descendente PIERDE la variación del último mes** — justo el que interesa.
 * Medido el 2026-09-30: con `sort=desc&limit=6`, agosto volvía con la variación en `null`; con orden
 * ascendente, agosto trae **0,016592** (1,66 %). La API calcula el cambio **dentro de la ventana
 * devuelta**, así que la primera fila se queda sin con qué comparar.
 *
 * 👉 **Por eso se pide siempre ASCENDENTE y se recorta después.** Y no se confía: el control de abajo
 * lo verifica solo.
 *
 * ## 🧮 El control de los DOS CAMINOS, que acá sale gratis
 *
 * La misma respuesta trae **el nivel del índice** y **la variación publicada**. Son dos caminos
 * independientes al mismo hecho, así que tienen que cerrar:
 *
 * ```
 * nivel del mes / nivel del mes anterior − 1  =  variación publicada
 * ```
 *
 * Verificado con los números de agosto 2026: `12.276,766 / 12.076,3937 − 1 = 0,0165920…`, que es
 * **exactamente** la variación que publica la serie. Si alguna vez no cierra, **se leyó mal una de
 * las dos** y el mes se marca (§ 🧮 de `CLAUDE.md`).
 *
 * ## ⚠️ Y la unidad, que es donde este módulo se puede romper solo
 *
 * **La API devuelve la variación como FRACCIÓN** (`0,016592`) y **la app guarda PORCENTAJE**: el ABM
 * de `indices_ipc` se llama *«Valor IPC (%)»* y muestra `valor_ipc` con un `%` detrás. Cargar la
 * fracción dejaría un IPC de **0,02 %** mensual; cargar el **nivel** dejaría uno de **12.276 %**.
 * Por eso la conversión vive acá, en un solo lugar y con nombre.
 */

/** Una fila del IPC, ya normalizada y en las unidades que usa la app. */
export interface MesDeIpc {
  anio: number
  mes: number
  /** 🔑 **En PORCENTAJE** (1,66 = 1,66 %), que es lo que guarda `indices_ipc.valor_ipc`. */
  variacionMensual: number
  /** En porcentaje. `null` cuando la serie todavía no tiene 12 meses atrás. */
  variacionInteranual: number | null
  /** El nivel del índice (base dic-2016). Es el dato duro del que salen las variaciones. */
  nivel: number
}

/** Un mes donde el nivel y la variación publicada no cuentan lo mismo. */
export interface DescuadreIpc {
  anio: number
  mes: number
  /** La que publica el INDEC, en %. */
  publicada: number
  /** La que sale de los niveles, en %. */
  calculada: number
  diferencia: number
}

/** La serie entera del IPC, y su primer paso en la mesa. */
export const SERIE_IPC_NACIONAL = "148.3_INIVELNAL_DICI_M_26"

/**
 * El mes anterior a uno dado, en formato `AAAA-MM`.
 *
 * ⚠️ **Se llama `mesAnteriorISO` y no `mesAnterior` a propósito**: ya existe un `mesAnterior` en
 * `lib/format/rango-fechas.ts` que hace otra cosa —toma un `Date` y devuelve el **rango** del mes
 * completo—. Dos funciones con el mismo nombre y distinta firma son una trampa para el que lea; el
 * sufijo dice **qué formato** maneja ésta.
 *
 * 🔑 Hace falta por la misma trampa de la ventana: **la primera fila del rango nunca trae variación**
 * —no tiene con qué compararse—, así que se pide **un mes antes** del que se quiere y el primero útil
 * es el que pidió quien llama. Sin esto, pedir «desde enero» devolvía **desde febrero**.
 */
export function mesAnteriorISO(mes: string): string {
  const [aa, mm] = mes.split("-").map(Number)
  return mm <= 1 ? `${aa - 1}-12` : `${aa}-${String(mm - 1).padStart(2, "0")}`
}

/** La URL de la API, con las tres representaciones en una sola llamada. */
export function urlIpc(desde: string): string {
  const ids = [
    SERIE_IPC_NACIONAL,
    `${SERIE_IPC_NACIONAL}:percent_change`,
    `${SERIE_IPC_NACIONAL}:percent_change_a_year_ago`,
  ].join(",")
  // 🧨 `sort=asc` NO es un detalle: en desc se pierde la variación del último mes. Ver el encabezado.
  return `https://apis.datos.gob.ar/series/api/series/?ids=${ids}`
    // Se pide un mes ANTES: la primera fila de la ventana nunca trae variación. Ver `mesAnteriorISO`.
    + `&start_date=${mesAnteriorISO(desde)}&sort=asc&format=json&limit=1000`
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

/** Lo que devuelve la API: `[fecha, nivel, variación mensual, variación interanual]`. */
type FilaCruda = [string, number | null, number | null, number | null]

/**
 * 📥 Lee la respuesta de la API.
 *
 * 🛑 **Descarta los meses sin nivel o sin variación mensual** en vez de rellenarlos con cero: un IPC
 * en cero es un dato **plausible y falso**, y el presupuesto lo tomaría como que no hubo inflación.
 * Es la misma lección que dejó `Number(null) === 0` en las cotizaciones.
 */
export function leerIpc(data: unknown): MesDeIpc[] {
  const filas = (Array.isArray(data) ? data : []) as FilaCruda[]
  const out: MesDeIpc[] = []
  for (const f of filas) {
    if (!Array.isArray(f) || typeof f[0] !== "string") continue
    const [aa, mm] = f[0].slice(0, 7).split("-").map(Number)
    const nivel = f[1]
    const mensual = f[2]
    if (!Number.isFinite(aa) || !Number.isFinite(mm)) continue
    if (nivel == null || !Number.isFinite(nivel)) continue
    if (mensual == null || !Number.isFinite(mensual)) continue
    out.push({
      anio: aa,
      mes: mm,
      // 🔑 De fracción a porcentaje: la API da 0,016592 y la app guarda 1,6592.
      variacionMensual: r4(mensual * 100),
      variacionInteranual: f[3] != null && Number.isFinite(f[3]) ? r4(f[3] * 100) : null,
      nivel: r4(nivel),
    })
  }
  return out.sort((a, b) => a.anio - b.anio || a.mes - b.mes)
}

/**
 * 🧮 **El control de los dos caminos.** El nivel del mes contra el nivel del anterior tiene que dar
 * la variación publicada.
 *
 * @param tolerancia en puntos porcentuales. `0.01` = un centésimo de punto, que cubre el redondeo de
 *                   los niveles publicados sin dejar pasar un error de lectura.
 */
export function controlarIpc(meses: MesDeIpc[], tolerancia = 0.01): DescuadreIpc[] {
  const out: DescuadreIpc[] = []
  for (let i = 1; i < meses.length; i++) {
    const hoy = meses[i]
    const previo = meses[i - 1]
    // Sólo se comparan meses consecutivos: con un hueco, la cuenta no significa nada.
    const consecutivos = (hoy.anio - previo.anio) * 12 + (hoy.mes - previo.mes) === 1
    if (!consecutivos || previo.nivel === 0) continue
    const calculada = r4((hoy.nivel / previo.nivel - 1) * 100)
    const dif = r4(calculada - hoy.variacionMensual)
    if (Math.abs(dif) > tolerancia) {
      out.push({ anio: hoy.anio, mes: hoy.mes, publicada: hoy.variacionMensual, calculada, diferencia: dif })
    }
  }
  return out
}

/**
 * 📊 **La variación ACUMULADA del año**, que la tabla también guarda.
 *
 * Es `nivel del mes / nivel de diciembre anterior − 1`. **Se calcula, no se pide**: la API no la trae
 * y derivarla del nivel es exacto; encadenar las variaciones mensuales arrastraría redondeo.
 *
 * Devuelve `null` cuando falta el diciembre de referencia, en vez de acumular desde donde empiece la
 * serie — que daría un número plausible y equivocado.
 */
export function acumuladaDelAnio(meses: MesDeIpc[], anio: number, mes: number): number | null {
  const dic = meses.find(m => m.anio === anio - 1 && m.mes === 12)
  const actual = meses.find(m => m.anio === anio && m.mes === mes)
  if (!dic || !actual || dic.nivel === 0) return null
  return r4((actual.nivel / dic.nivel - 1) * 100)
}
