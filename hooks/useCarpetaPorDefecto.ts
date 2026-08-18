"use client"

import { useEffect, useState } from "react"
import { LS_CARPETA_POR_DEFECTO, type CarpetaPorDefecto } from "@/lib/subdiarios/carpeta-destino"

/**
 * La carpeta donde el usuario viene guardando los libros de IVA.
 *
 * ⚠️ El handle del File System Access API **no es serializable**: en localStorage sólo queda el
 * nombre, para poder mostrarlo. Después de recargar la página, lo que se devuelve es un "fantasma"
 * con `isFromStorage: true` — sirve para escribir "usar carpeta X" en el prompt, pero NO para
 * escribir archivos: hay que volver a pedir el permiso. Esa distinción es la que evita el bug de
 * intentar guardar en un handle muerto.
 *
 * (Persistir el handle de verdad se puede, guardándolo en IndexedDB; hoy no está hecho.)
 */
export function useCarpetaPorDefecto() {
  const [carpetaPorDefecto, setEstado] = useState<CarpetaPorDefecto | null>(null)

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(LS_CARPETA_POR_DEFECTO)
      if (guardada) {
        const info = JSON.parse(guardada)
        setEstado({ name: info.name, isFromStorage: true })
      }
    } catch (error) {
      console.log('Error cargando carpeta por defecto:', error)
    }
  }, [])

  const setCarpetaPorDefecto = (carpeta: any) => {
    setEstado(carpeta)
    if (carpeta) {
      localStorage.setItem(LS_CARPETA_POR_DEFECTO, JSON.stringify({ name: carpeta.name }))
    }
  }

  return { carpetaPorDefecto, setCarpetaPorDefecto }
}
