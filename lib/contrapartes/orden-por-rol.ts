// El buscador de contrapartes cuando se elige un CLIENTE (A-FEAT-165).
//
// Pedido del usuario 2026-09-21, al crear un contrato de arrendamiento: *«pide cliente y muestra
// también proveedores. Debería mostrar clientes, y debajo, si quiero asignar un proveedor no listado
// como cliente»*. El maestro es uno solo (`public.proveedores`, con `es_cliente` / `es_proveedor`),
// así que no se filtra: se ORDENA — primero los que ya son clientes, después el resto, separado.
// Elegir uno del resto es válido: al guardar, `altaContraparte` le prende `es_cliente`.
//
// ⚠️ Sin imports: `npm run probar` no resuelve `@/` dentro de las librerías.

export interface ConRol { es_cliente?: boolean | null; es_proveedor?: boolean | null }

/** Parte la lista en los que tienen el rol y los que no, conservando el orden de cada parte. */
export function partirPorRol<T extends ConRol>(lista: T[], rol: "cliente" | "proveedor"): { conRol: T[]; otros: T[] } {
  const campo = rol === "cliente" ? "es_cliente" : "es_proveedor"
  const conRol: T[] = [], otros: T[] = []
  for (const p of lista) (p[campo] ? conRol : otros).push(p)
  return { conRol, otros }
}
