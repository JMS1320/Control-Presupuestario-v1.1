/**
 * 🗂️ A-FEAT-1567 — el NOMBRE y la CARPETA de cada boleta de ARBA en el Drive, con la convención de JMS.
 *
 * JMS 05/11: *«¿cómo quedaron archivadas en las carpetas? y nombres de los pdf?»*. En la cuota 4 2026, 23 de 26 quedaron
 * en «_Sin asignar» como «ARBA 2026-C4 - LUk….pdf»: el robot nombra con la tabla del mail y en 6 mails no coincidía con
 * los links. La app sí sabe de quién es cada una (lee la partida adentro del PDF), así que la app decide el nombre y la
 * carpeta, y el robot sólo renombra y mueve. Es la MISMA regla que usa el robot cuando la tabla del mail sí alcanza
 * (`nombreUsuario_` y `nombreCarpeta_` de `gas-buscar-pdf/BoletasArba.gs`): «2026 - Inmob - Cuota 4 - Rojas.pdf» en la
 * carpeta del responsable, o en «MSA - viene PAM» si es de MSA pero llegó en el mail de PAM.
 */

/** «Inmobiliario Cuota Tango Parra 1» → «Tango Parra 1» (el nombre del campo, sin el prefijo del template). */
export const nombreCorto = (n: string) => n.replace(/^Inmobiliario\s+(Cuota|Anual)\s+/i, "").trim() || n

/** La carpeta: la del responsable, o «MSA - viene PAM» si llegó en el mail de otra empresa. */
export function carpetaBoleta(responsable: string, empresaDelMail: string | null): string {
  const vino = (empresaDelMail ?? "").trim()
  return vino && vino !== responsable ? `${responsable} - viene ${vino}` : responsable
}

/** El nombre: «2026 - Inmob - Cuota 4 - Rojas.pdf». Drive no acepta «/». */
export function nombreBoleta(anio: number, cuota: string, campo: string): string {
  return `${anio} - Inmob - Cuota ${cuota} - ${campo.split("/").join("-")}.pdf`
}

/** ¿Ya sigue la convención? (los complementarios y los que el robot nombró bien no se tocan) */
export const sigueConvencion = (archivo: string) => /^\d{4} - (Inmob|Complementario) - Cuota \S+/.test(archivo)

export interface ParaOrdenar {
  archivo: string
  fileId: string | null
  anio: number | null
  cuota: string | null
  complementario: boolean
  /** El nombre del template (null = no se sabe de quién es: no se mueve). */
  template: string | null
  responsable: string | null
  /** El dueño real cuando no es quien paga (ERM: Quinta Rosello y El Relincho los paga PAM). Manda en la carpeta. */
  responsableInterno?: string | null
  /** La carpeta donde está hoy (si se sabe): un archivo con el nombre bien pero en otra carpeta también se mueve. */
  carpetaActual?: string | null
  empresaDelMail: string | null
}

/** Lo que hay que pedirle al robot: sólo las que tienen dueño conocido y no están ya con su nombre en su carpeta. */
export function pedidoDeOrden(filas: ParaOrdenar[]): { file_id: string; nombre: string; carpeta: string; archivo: string }[] {
  const vistos = new Set<string>()
  const out: { file_id: string; nombre: string; carpeta: string; archivo: string }[] = []
  for (const f of filas) {
    if (!f.fileId || vistos.has(f.fileId) || f.complementario) continue
    if (!f.template || !f.responsable || !f.anio || !f.cuota || f.cuota === "?") continue
    const nombre = nombreBoleta(f.anio, f.cuota, nombreCorto(f.template))
    const carpeta = f.responsableInterno ? f.responsableInterno : carpetaBoleta(f.responsable, f.empresaDelMail)
    // Ya está bien: mismo nombre (o el «(2)» de una repetida) y la carpeta es la que va, o no se sabe dónde está
    const mismoNombre = f.archivo === nombre || (sigueConvencion(f.archivo) && f.archivo.replace(/ \(\d+\)\.pdf$/i, ".pdf") === nombre)
    if (mismoNombre && (!f.carpetaActual || f.carpetaActual === carpeta)) continue
    vistos.add(f.fileId)
    out.push({ file_id: f.fileId, archivo: f.archivo, nombre, carpeta })
  }
  return out
}
