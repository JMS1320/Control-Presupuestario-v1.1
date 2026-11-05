/**
 * 🗗 Abrir en OTRA VENTANA lo que la app navega en el lugar — A-FEAT-1546 (nota 🌙 JMS 31/10: *«¿sería posible que
 * abran ventana nueva en caso de pedirlo?»*).
 *
 * El patrón: lo navegable es un `<a href>` de verdad (así Ctrl+clic, Shift+clic, Cmd+clic y la rueda del mouse abren
 * otra pestaña o ventana, como en cualquier página), y el clic NORMAL se intercepta para cambiar de sección sin
 * recargar, como siempre. La rueda no dispara `click` (dispara `auxclick`): ésa la resuelve el navegador sola.
 *
 * Pura: ¿este clic pide otra ventana? Si sí, NO se intercepta.
 */
export function pideOtraVentana(e: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }): boolean {
  return !!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.button !== undefined && e.button !== 0))
}

/** El link de una sección de la app (el mismo que entiende `app/page.tsx`). */
export const linkSeccion = (id: string) => `/?seccion=${encodeURIComponent(id)}`
