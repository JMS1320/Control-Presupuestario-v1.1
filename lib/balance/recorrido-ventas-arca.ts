/**
 * 🧾 **VENTAS CONTRA LO PRESENTADO A ARCA, EN EL RECORRIDO** — A-FEAT-1439 (JMS 31/10).
 *
 * *«Esto lo deberé ver en el recorrido siempre con la posibilidad de ver lo objetivo, no sólo tu propuesta. Lo objetivo
 * en este caso es el print de ARCA como está declarado… y por otro lado el link a ver los comprobantes en ventas.»*
 *
 * Cada tema trae sus tres vistas:
 *   📄 **Fuente**   — el libro IVA presentado de cada mes, tal cual se guardó en `public.ddjj_presentadas` (las ventas
 *                     del zip que exporta ARCA). La tabla del tema y del papel de trabajo muestra sus importes.
 *   🗂️ **En la app** — link a Ingresos → Comprobantes, sólo esos comprobantes.
 *   💡 **Propuesta** — la misma que el reporte «Diferencias vs ARCA»: el cruce es **el mismo** (`cruzarVentas`), así
 *                     el recorrido y el Excel no pueden decir cosas distintas.
 *
 * Nada en silencio: si no hay nada presentado guardado, o faltan meses, o un mes se guardó sin sus ventas, es un tema.
 */
import type { LibroDiario } from "./libro-diario"
import { claveSubdiario } from "./ejercicio"
import { filasComprasConsensuado, filasVentasConsensuado, LIBRO_DIARIO_CONSENSUADO } from "./libro-diario-consensuado"
import { cruzarVentas, validarZips, GRUPOS_VENTAS, type FilaDiferencia, type ZipLibroIva } from "./diferencias-vs-arca"
import type { ComprobantePresentado, TotalesVentasPresentados } from "@/lib/subdiarios/libro-presentado"
import { celdaNumero, type Comparacion } from "@/lib/cuaderno/papel-de-trabajo"
import { linkComprobantesVenta } from "@/lib/ventas/link"
import type { FuenteTema, Tema } from "./recorrido"

/** Una DDJJ guardada, con lo que el recorrido necesita (`public.ddjj_presentadas`). */
export interface DdjjGuardada {
  periodo: string
  secuencia: number
  codigo_presentacion: string | null
  archivo: string | null
  /** `null` = se guardó antes de que la tabla guardara las ventas (script 145): ese mes no se puede cruzar. */
  ventas: ComprobantePresentado[] | null
  totales_ventas: TotalesVentasPresentados | null
}

const mesDe = (sub: string) => `${sub.slice(5, 7)}/${sub.slice(0, 4)}`
const aSub = (periodo: string) => `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`
const sinNumero = (g: string) => g.replace(/^\d+\.\s*/, "")
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

/** Lo que el grupo deja hacer, en el idioma del usuario (el mismo «Qué hacer» del Excel). */
const QUE_ES: Record<string, string> = {
  [GRUPOS_VENTAS.centavos]: "Diferencias de centavos entre lo presentado y la app.",
  [GRUPOS_VENTAS.ivaGastos]: "El IVA cargado en la app incluye el IVA de la comisión o el almacenaje; el que cuenta es el IVA vendido, y ése coincide.",
  [GRUPOS_VENTAS.identificacion]: "Mismo comprobante y mismos importes, pero en la app figura con otro tipo, punto de venta o número que en lo presentado.",
  [GRUPOS_VENTAS.otroImporte]: "Lo presentado y la app tienen otros importes en el mismo comprobante.",
  [GRUPOS_VENTAS.soloArca]: "Están en lo presentado a ARCA y no se encontraron en la app.",
  [GRUPOS_VENTAS.soloApp]: "Están en la app y no se encontraron en lo presentado a ARCA.",
}

/** La «foto» de lo presentado, comprobante por comprobante, contra la app — con la diferencia como fórmula. */
function tablaDe(filas: FilaDiferencia[]): Comparacion {
  const cab = ["Mes", "Cliente", "Comprobante en la app", "Comprobante presentado", "Neto app", "Neto ARCA", "IVA app", "IVA ARCA", "Total app", "Total ARCA", "Dif. total (ARCA − app)"]
  const cuerpo = filas.map((f, i) => {
    const r = i + 2
    return [mesDe(f.subdiario), f.denominacion, f.compApp || "— (no está)", f.compArca || "— (no está)",
      celdaNumero(f.app?.[0] ?? 0), celdaNumero(f.arca?.[0] ?? 0), celdaNumero(f.app?.[3] ?? 0), celdaNumero(f.arca?.[3] ?? 0),
      celdaNumero(f.app?.[4] ?? 0), celdaNumero(f.arca?.[4] ?? 0), `=J${r}-I${r}`]
  })
  return { titulo: "Lo presentado a ARCA contra la app, comprobante por comprobante", celdas: [cab, ...cuerpo] }
}

function fuenteDeMeses(subs: string[], porSub: Map<string, ZipLibroIva>, guardadas: DdjjGuardada[]): FuenteTema {
  const meses = [...new Set(subs)].sort()
  const partes = meses.map(s => {
    const z = porSub.get(s)
    const g = guardadas.find(d => aSub(d.periodo) === s && d.secuencia === (z?.secuencia ?? 1))
    return `${mesDe(s)} (secuencia ${z?.secuencia ?? "?"}${g?.codigo_presentacion ? `, presentación ${g.codigo_presentacion}` : ""})`
  })
  return {
    origen: "Libro IVA presentado a ARCA",
    detalle: `Las ventas del libro IVA tal cual se presentaron: ${partes.join(" · ")}. La tabla de abajo muestra sus importes al lado de los de la app.`,
  }
}

/**
 * Los temas: uno por cada tipo de diferencia (con todos sus comprobantes), uno por las ventas presentadas que la app
 * no marca como declaradas, y los avisos de lo que falta para poder comparar.
 */
export function temasVentasVsArca(libro: LibroDiario, empresa: string, guardadas: DdjjGuardada[]): Tema[] {
  const ej = libro.ejercicio
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  const papel = "Ventas contra lo presentado a ARCA"
  const temas: Tema[] = []
  const linkVer = (ids: string[]) => ids.length
    ? [{ texto: `${ids.length === 1 ? "El comprobante" : `Los ${ids.length} comprobantes`} en Ingresos → Comprobantes`, href: linkComprobantesVenta(ids, empresa) }]
    : []

  const conVentas = guardadas.filter(g => Array.isArray(g.ventas))
  const sinVentas = guardadas.filter(g => !Array.isArray(g.ventas) && meses.includes(aSub(g.periodo)))
  if (!conVentas.length) {
    return [{
      clave: "arca:ventas:sin-presentado", grupo: "sin informacion", papel, respondido: false, links: [],
      titulo: "Lo presentado a ARCA no está cargado en la app",
      que: `No hay ningún libro IVA presentado guardado para ${empresa} ${ej.etiqueta}: el recorrido no puede comparar las ventas contra lo declarado.`,
      propuesta: "Subir los zips del libro IVA de cada mes en Egresos → Subdiarios → «📥 Lo que devolvió el contador» (o con el script de carga).",
    }]
  }

  const zips: ZipLibroIva[] = conVentas.map(g => ({
    archivo: g.archivo ?? `DDJJ ${g.periodo}`, periodo: g.periodo, secuencia: g.secuencia,
    compras: [], ventas: g.ventas ?? [], totalesVentas: g.totales_ventas,
  }))
  const v = validarZips(zips, ej)
  const k = LIBRO_DIARIO_CONSENSUADO[empresa]?.[ej.anioCierre]
  const ventas = filasVentasConsensuado(libro.ventas).filter(f => meses.includes(f.subdiario))
  const compras = filasComprasConsensuado(libro.compras).filter(f => meses.includes(f.subdiario))
  const cv = cruzarVentas(ventas, v.porSubdiario, compras, k)

  // 🧮 Lo que falta para comparar: se dice, no se saltea.
  const faltan = [...new Set([...v.faltan, ...sinVentas.map(g => aSub(g.periodo))])].sort()
  if (faltan.length) temas.push({
    clave: "arca:ventas:faltan-meses", grupo: "sin informacion", papel, respondido: false, links: [],
    titulo: `Faltan ${faltan.length} mes(es) de lo presentado a ARCA`,
    que: `Sin las ventas presentadas de ${faltan.map(mesDe).join(", ")}: las ventas de la app de esos meses no se comparan.`,
    propuesta: "Subir el zip del libro IVA de esos meses (Subdiarios → «📥 Lo que devolvió el contador»).",
  })

  // Un tema por tipo de diferencia.
  const porGrupo = new Map<string, FilaDiferencia[]>()
  for (const f of cv.filas) porGrupo.set(f.grupo, [...(porGrupo.get(f.grupo) ?? []), f])
  for (const [grupo, filas] of [...porGrupo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ids = [...new Set(filas.map(f => f.appId).filter((x): x is string => !!x))]
    const difTotal = Math.round(filas.reduce((s, f) => s + (f.dif[4] ?? 0), 0) * 100) / 100
    const hacer = [...new Set(filas.map(f => f.queHacer))]
    temas.push({
      clave: `arca:ventas:${slug(grupo)}`, grupo: "arca", papel, respondido: false,
      titulo: `Ventas · ${sinNumero(grupo)} (${filas.length})`,
      etiqueta: sinNumero(grupo).slice(0, 40),
      que: `${QUE_ES[grupo] ?? filas[0].quePasa} ${filas.length} comprobante(s)${difTotal ? `; en total, lo presentado difiere de la app en $ ${difTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "; los totales coinciden"}.`,
      propuesta: hacer.join(" "),
      fuente: fuenteDeMeses(filas.map(f => f.subdiario), v.porSubdiario, conVentas),
      links: linkVer(ids),
      comparacion: tablaDe(filas),
      importe: difTotal,
    })
  }

  // Presentadas en ARCA que la app no marca como declaradas.
  if (cv.ddjjDistinta.length) {
    const ids = [...new Set(cv.ddjjDistinta.map(d => d.appId).filter((x): x is string => !!x))]
    temas.push({
      clave: "arca:ventas:ddjj-no-marcada", grupo: "arca", papel, respondido: false,
      titulo: `Ventas presentadas que en la app no figuran como declaradas (${cv.ddjjDistinta.length})`,
      etiqueta: "Declarada en IVA",
      que: `Están en el libro IVA presentado, pero en la app su estado de DDJJ IVA es otro: ${cv.ddjjDistinta.map(d => `${d.cliente} ${d.comprobante} (${mesDe(d.subdiario)}: «${d.ddjj || "vacío"}»)`).join(" · ")}.`,
      propuesta: "Marcarlas «DDJJ OK» en la app: ya están presentadas. Y que presentar el mes las marque solas, como las compras (A-BUG-1413).",
      fuente: fuenteDeMeses(cv.ddjjDistinta.map(d => d.subdiario), v.porSubdiario, conVentas),
      links: linkVer(ids),
      comparacion: {
        titulo: "Estado en la app de las ventas ya presentadas",
        celdas: [["Mes", "Cliente", "Comprobante", "Estado DDJJ en la app", "En lo presentado"],
          ...cv.ddjjDistinta.map(d => [mesDe(d.subdiario), d.cliente, d.comprobante, d.ddjj || "(vacío)", "presentada"])],
      },
    })
  }

  // Lo que no entra en el cuadro (sólo total, p. ej. una nota de débito): se muestra con su porqué.
  if (cv.noEntra.length) temas.push({
    clave: "arca:ventas:no-entra", grupo: "arca", papel, respondido: false, links: [],
    titulo: `Presentado a ARCA que no entra en el cuadro de ventas (${cv.noEntra.length})`,
    etiqueta: "No entra en el cuadro",
    que: cv.noEntra.map(n => `${n.cliente} ${n.comprobante} (${mesDe(n.subdiario)}, $ ${n.importe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}): ${n.porQue}`).join(" · "),
    // Las retenciones sólo se listan (van en «Retenciones sufridas»); lo que trae sólo total es una pregunta para el contador.
    propuesta: [
      cv.noEntra.some(n => /^Retenciones/.test(n.concepto)) ? "Retenciones / pagos a cuenta: sin acción, no van en la DDJJ de IVA (están en «Retenciones sufridas» del Libro Diario)." : "",
      cv.noEntra.some(n => !/^Retenciones/.test(n.concepto)) ? "Lo que trae sólo total (sin neto ni IVA): preguntarle al contador si corresponde en ventas." : "",
    ].filter(Boolean).join(" "),
    fuente: fuenteDeMeses(cv.noEntra.map(n => n.subdiario), v.porSubdiario, conVentas),
  })

  // Integridad de lo presentado: el CSV del zip contra el XML de la misma DDJJ.
  // Tolerancia de 1 peso: el libro redondea por renglón (los centavos ya tienen su propio tema).
  const csvMal = cv.csvVsXml.filter(c => Math.abs((c.csvNeto - c.xmlNeto) + (c.csvIva - c.xmlIva) + (c.csvExento - c.xmlExento)) >= 1)
  if (csvMal.length) temas.push({
    clave: "arca:ventas:csv-vs-xml", grupo: "error", papel, respondido: false, links: [],
    titulo: `El libro presentado no cierra consigo mismo (${csvMal.length} mes(es))`,
    que: `En ${csvMal.map(c => mesDe(c.subdiario)).join(", ")} el detalle de comprobantes del zip no suma lo mismo que los totales de la DDJJ.`,
    propuesta: "Revisar el zip de esos meses (¿es la última rectificativa?).",
    fuente: fuenteDeMeses(csvMal.map(c => c.subdiario), v.porSubdiario, conVentas),
  })

  return temas
}
