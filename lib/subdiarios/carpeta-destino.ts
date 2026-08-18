// ════════════════════════════════════════════════════════════════════════════
// Elegir carpeta destino y guardar archivos (File System Access API)
//
// Extraído tal cual de `vista-facturas-arca.tsx`, sin cambiarle el comportamiento: el flujo del
// Libro IVA Compras es el que el usuario ya tiene aprendido. Vive acá para que el Libro IVA
// Ventas use EXACTAMENTE el mismo, y para que la próxima mejora (por ejemplo cambiar el prompt()
// por un modal, o persistir el handle en IndexedDB) se haga en un solo lugar.
//
// Navegadores sin File System Access API (Firefox, Safari): `elegirCarpetaDestino` devuelve
// `{ directorio: null }` sin preguntar nada y el archivo cae en Descargas, como siempre.
// ════════════════════════════════════════════════════════════════════════════

/** El handle real, o el "fantasma" que queda tras recargar la página (sólo tiene el nombre). */
export interface CarpetaPorDefecto {
  name: string
  /** true = viene de localStorage, NO es un handle usable: hay que volver a pedirlo. */
  isFromStorage?: boolean
  getFileHandle?: (nombre: string, opts?: { create?: boolean }) => Promise<any>
}

export const LS_CARPETA_POR_DEFECTO = 'carpetaPorDefectoDDJJ'

export interface DestinoElegido {
  /** null = descarga normal a la carpeta de Descargas del navegador. */
  directorio: any | null
  /** Para el aviso final: "carpeta por defecto \"Libros IVA\"". */
  ubicacion: string
  /** true = el usuario canceló; no hay que generar nada. */
  cancelado: boolean
}

const soportaPicker = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

/**
 * Pregunta dónde guardar. Mismo prompt de 3 opciones que ya usa el Libro IVA Compras.
 *
 * @param carpetaPorDefecto    la recordada (puede ser el fantasma de localStorage)
 * @param setCarpetaPorDefecto para persistir la nueva elección
 */
export async function elegirCarpetaDestino(
  carpetaPorDefecto: CarpetaPorDefecto | null,
  setCarpetaPorDefecto: (c: any) => void,
): Promise<DestinoElegido> {
  if (!soportaPicker()) {
    return { directorio: null, ubicacion: 'carpeta Descargas', cancelado: false }
  }

  const opciones = [
    '1. Cambiar carpeta por defecto',
    carpetaPorDefecto ? `2. Usar carpeta por defecto actual (${carpetaPorDefecto.name})` : '2. Establecer carpeta por defecto',
    '3. Cancelar descarga',
    '',
    'Elige una opción (1, 2 o 3):',
  ].join('\n')

  try {
    const respuesta = prompt(opciones)

    if (respuesta === '1') {
      const nueva = await (window as any).showDirectoryPicker({
        startIn: carpetaPorDefecto && !carpetaPorDefecto.isFromStorage ? carpetaPorDefecto : 'downloads',
      })
      setCarpetaPorDefecto(nueva)
      return { directorio: nueva, ubicacion: `nueva carpeta por defecto "${nueva.name}"`, cancelado: false }
    }

    if (respuesta === '2') {
      // Tras recargar la página sólo queda el nombre, no el handle: hay que volver a pedirlo.
      if (carpetaPorDefecto && !carpetaPorDefecto.isFromStorage) {
        return { directorio: carpetaPorDefecto, ubicacion: `carpeta por defecto "${carpetaPorDefecto.name}"`, cancelado: false }
      }
      const nueva = await (window as any).showDirectoryPicker()
      setCarpetaPorDefecto(nueva)
      return { directorio: nueva, ubicacion: `carpeta por defecto establecida "${nueva.name}"`, cancelado: false }
    }

    // Opción 3, Escape o cualquier otra cosa = cancelar, sin generar archivos.
    return { directorio: null, ubicacion: '', cancelado: true }
  } catch {
    // El usuario cerró el selector de carpetas.
    return { directorio: null, ubicacion: '', cancelado: true }
  }
}

/**
 * Nombre libre dentro de la carpeta: `LIBRO IVA COMPRAS 26-07.pdf`, `… (1).pdf`, `… (2).pdf`.
 * Sin carpeta elegida no aplica: el navegador ya desambigua solo en Descargas.
 *
 * Nunca sobrescribe — regla del proyecto: nada destructivo, find-or-create.
 */
export async function generarNombreUnico(
  directorio: any,
  nombreBase: string,
  extension: string,
): Promise<string> {
  if (!directorio) return `${nombreBase}.${extension}`

  let contador = 0
  let nombreFinal = `${nombreBase}.${extension}`
  try {
    // getFileHandle con create:false tira si NO existe → ese es el nombre libre.
    while (true) {
      try {
        await directorio.getFileHandle(nombreFinal, { create: false })
        contador++
        nombreFinal = `${nombreBase} (${contador}).${extension}`
      } catch {
        break
      }
    }
  } catch {
    nombreFinal = `${nombreBase}.${extension}`
  }
  return nombreFinal
}

/** Escribe el archivo en la carpeta elegida. */
export async function guardarEnCarpeta(
  directorio: any,
  nombreArchivo: string,
  contenido: ArrayBuffer | Uint8Array,
): Promise<void> {
  const handle = await directorio.getFileHandle(nombreArchivo, { create: true })
  const writable = await handle.createWritable()
  await writable.write(contenido)
  await writable.close()
}
