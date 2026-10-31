/**
 * 🗂️ DÓNDE SE ARCHIVA cada tipo de documento — A-FEAT-1442 (JMS 31/10).
 *
 * La carpeta se pide EN EL PROCESO: si la app tiene el documento y no sabe dónde va, muestra el ícono rojo; el usuario
 * escribe la ruta como la ve en su PC y el GAS (`gas-buscar-pdf/Carpetas.gs`) la busca en el Drive. Se guarda el ID
 * (`public.archivo_destinos`, script 148): si después la carpeta se mueve, el id sigue valiendo y la app la encuentra sola.
 *
 * `partesDeRuta` es la MISMA regla que `partesDeRuta_` del GAS (un caso de `npm run probar` vigila que coincidan).
 */

export interface DestinoArchivo {
  clave: string
  nombre: string
  ruta: string | null
  drive_folder_id: string | null
  ruta_drive: string | null
  por_anio: boolean
}

/** Pura: la ruta como la escribe el usuario → las carpetas a recorrer desde «Mi unidad». Igual que el GAS. */
export function partesDeRuta(ruta: string): string[] {
  const t = String(ruta ?? "").trim().replace(/^["']|["']$/g, "")
  const partes = t.split(/[\\/]+/).map(p => p.trim()).filter(Boolean)
  if (partes.length && /^[A-Za-z]:$/.test(partes[0])) partes.shift()
  if (partes.length && /^(mi unidad|my drive)$/i.test(partes[0])) partes.shift()
  return partes
}

/** Pura: por qué no se puede buscar esa ruta, o null. */
export function problemaDeRuta(ruta: string): string | null {
  if (!ruta.trim()) return "Escribí la ruta de la carpeta, como la ves en tu PC."
  if (/^https?:\/\//i.test(ruta.trim())) return null   // un link de Drive también sirve
  if (!partesDeRuta(ruta).length) return "La ruta no tiene ninguna carpeta adentro de «Mi unidad»."
  return null
}

/** Pura: lo que se muestra de un destino. `falta` = el ícono rojo (hay que decir dónde va). */
export function estadoDestino(d: Pick<DestinoArchivo, "drive_folder_id" | "ruta_drive" | "ruta" | "por_anio"> | null, anio?: number): { falta: boolean; texto: string } {
  if (!d?.drive_folder_id) return { falta: true, texto: "Falta la carpeta: decime dónde va" }
  const base = d.ruta_drive || d.ruta || "carpeta elegida"
  return { falta: false, texto: d.por_anio && anio ? `${base} / ${anio}` : base }
}

/** Pura: el id de una carpeta si lo que se pegó es un link de Drive (`…/folders/<id>`), o null. */
export function idDeLinkDrive(v: string): string | null {
  const m = String(v ?? "").match(/\/folders\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}
