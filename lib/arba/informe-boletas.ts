/**
 * 🗣️ El INFORME de boletas de ARBA — en el idioma del usuario, no en el del sistema.
 *
 * ## Por qué existe
 * Pedido textual (2026-09-08), después de recibir un informe que no le servía:
 * «el informe a mí tiene que ser en mi lenguaje: encontró inmobiliario MSA, Tango 1, Tango 2,
 * Tango 3; tal no encontró; tantos duplicados».
 *
 * Lo que le había mostrado era «8 bajada(s) · 4 link(s) que no dieron PDF». Eso no es un informe:
 * es un log. Cuenta lo que hizo el programa, no lo que pasó con su plata.
 *
 * Acá se traduce: **partida → nombre del campo**, **CUIT → empresa**, y las tres cosas que pidió —
 * qué encontró, **qué NO encontró**, y **cuántas vinieron repetidas**.
 *
 * 📌 Vive en `lib/` y no en el componente porque es lógica pura: así se prueba con datos escritos
 * a mano, que es lo que hace falta para la pieza que decide qué lee el usuario.
 */

/** El objeto imponible del mail es una PARTIDA (`099-015881-9`) y no un CUIT (`20-04439022-2`). */
export const esPartida = (s: string | null | undefined) => !!s && /^\d{3}-\d{6}-\d$/.test(s)

export interface TablaMail {
  asunto?: string
  contribuyente?: string
  filas?: { objeto: string; importe: number | null }[]
}
/** Lo que devuelve el GAS y le sirve al informe. El resto de la respuesta no se usa acá. */
export interface ResGas {
  resumen?: string
  quedaron?: number
  sin_tiempo?: boolean
  ya_estaban?: unknown[]
  descuadres?: { asunto: string; detalle: string }[]
}

/** Las tres empresas, por el CUIT del contribuyente que trae el cuerpo del mail (`A-DAT-27`). */
const EMPRESA_POR_CUIT: Record<string, string> = {
  "30-61778601-6": "MSA",
  "20-04439022-2": "PAM",
  "27-06682461-1": "MA",
}

interface LineaInforme { empresa: string; que: string; lote: string | null; objeto: string; importe: number | null }
export interface Informe {
  lineas: LineaInforme[]
  /** Las que no tienen template activo: son las que hay que mirar. */
  sinTemplate: LineaInforme[]
  repetidas: { objeto: string; veces: number; empresas: string[] }[]
  total: number
  pie: string[]
}

/**
 * 🗣️ El informe **en el idioma del usuario**.
 *
 * *«Encontró inmobiliario MSA: Tango 1, Tango 2, Tango 3. Tal no encontró. Tantos duplicados.»*
 * Nombres de campo, empresa y plata — no cantidades de links ni de archivos.
 *
 * 📌 Aparte del componente para poder probarla con datos escritos a mano: es la pieza que decide
 * qué ve el usuario, y hasta ahora lo que veía era un log.
 */
export function armarInforme(
  tablas: TablaMail[],
  nombrePorPartida: Record<string, string>,
  res?: ResGas,
): Informe {
  const lineas: LineaInforme[] = []
  for (const t of tablas) {
    const cuit = t.contribuyente ?? ""
    const empresa = EMPRESA_POR_CUIT[cuit] ?? (cuit || "sin identificar")
    const asunto = String(t.asunto ?? "")
    const que = /Aviso\s+de\s+d[eé]bito/i.test(asunto) ? "Complementario (aviso de débito)"
      : /Complementario/i.test(asunto) ? "Complementario"
        : "Inmobiliario"
    const cuota = asunto.match(/Cuota\s*(\d+)/i)
    for (const f of t.filas ?? []) {
      lineas.push({
        empresa, que: que + (cuota ? ` cuota ${cuota[1]}` : ""),
        // El complementario grava al contribuyente: su «lote» es la empresa, no un campo.
        lote: nombrePorPartida[f.objeto] ?? (esPartida(f.objeto) ? null : `${empresa} (todo el CUIT)`),
        objeto: f.objeto, importe: f.importe,
      })
    }
  }

  // Una misma partida en dos mails distintos no es un error del lector: puede ser que ARBA se la
  // mande a las dos empresas. Se muestra para que el usuario lo mire, no se descarta ninguna.
  const porObjeto = new Map<string, LineaInforme[]>()
  for (const l of lineas) {
    if (!porObjeto.has(l.objeto)) porObjeto.set(l.objeto, [])
    porObjeto.get(l.objeto)!.push(l)
  }
  const repetidas = [...porObjeto.entries()]
    .filter(([, ls]) => ls.length > 1)
    .map(([objeto, ls]) => ({ objeto, veces: ls.length, empresas: [...new Set(ls.map(x => x.empresa))] }))

  const pie: string[] = []
  if (res?.sin_tiempo) pie.push(`⏳ Quedaron ${res.quedaron} sin bajar por tiempo. Volvé a apretar «Bajar y archivar»: sigue donde iba y no duplica.`)
  if ((res?.ya_estaban ?? []).length) pie.push(`${(res!.ya_estaban as unknown[]).length} ya estaban archivadas de antes.`)
  if ((res?.descuadres ?? []).length) pie.push(`⚠️ En ${res!.descuadres!.length} mail(s) la cantidad de boletas de la tabla no coincide con la de links de descarga.`)

  return {
    lineas, repetidas, pie,
    sinTemplate: lineas.filter(l => l.lote === null),
    total: lineas.reduce((s, l) => s + (l.importe ?? 0), 0),
  }
}

