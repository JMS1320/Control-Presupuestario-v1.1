// Caravanas: normalización para declarar y categoría del animal.
//
// ── El espacio de la caravana oficial ────────────────────────────────────────
// En la BD la caravana oficial viene con un espacio después del prefijo de país:
//
//     "032 010012326481"
//
// Para declarar tiene que ir sin espacio y **conservando el cero de adelante**:
//
//     "032010012326481"
//
// El cero es la trampa: si la celda se escribe como número, Excel lo come y queda
// 32010012326481, que es otra caravana. Por eso el valor va como TEXTO — ver
// `escribirColumnaTexto()`.

/** Saca los espacios (y cualquier separador suelto) sin tocar el cero inicial. */
export function normalizarCaravana(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\s+/g, '')
}

// ── Categoría del animal ──────────────────────────────────────────────────────
//
// Sale de sexo × `es_torito`. Ojo con el nombre del flag: `es_torito` está
// SOBRECARGADO — en un macho significa "torito de reposición", pero en una hembra
// significa "ternera retenida para reposición". Son dos cosas distintas guardadas en
// la misma columna, y confundirlas ya causó un bug (una hembra marcada aparecía como
// "Torito" y se contaba dos veces). Esta función es el único lugar donde se
// interpreta.

export type CategoriaTernero =
  | 'Ternero Recria'
  | 'Torito'
  | 'Ternera Recria'
  | 'Ternera Reposicion'

export const CATEGORIAS_TERNERO: CategoriaTernero[] = [
  'Ternero Recria', 'Torito', 'Ternera Recria', 'Ternera Reposicion',
]

export function categoriaDeTernero(
  sexo: string | null | undefined,
  esTorito: boolean | null | undefined,
): CategoriaTernero {
  const macho = /macho/i.test(String(sexo ?? ''))
  if (macho) return esTorito ? 'Torito' : 'Ternero Recria'
  return esTorito ? 'Ternera Reposicion' : 'Ternera Recria'
}

/** true si la categoría se vende (los de reposición van al rodeo, no a la venta). */
export function esVendible(categoria: CategoriaTernero): boolean {
  return categoria === 'Ternero Recria' || categoria === 'Ternera Recria'
}
