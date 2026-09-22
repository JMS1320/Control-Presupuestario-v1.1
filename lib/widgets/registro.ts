import type { ComponentType } from "react"
import { AlertaExtractosDesactualizados } from "@/components/alerta-extractos-desactualizados"
import { AlertaParseoPendiente } from "@/components/alerta-parseo-pendiente"
import { AlertasFcVenta } from "@/components/alertas-fc-venta"
import { WidgetUltimoIPC } from "@/components/widgets/widget-ultimo-ipc"
import { WidgetAlertasPagos } from "@/components/widgets/widget-alertas-pagos"
import { WidgetAlertasVentas } from "@/components/widgets/widget-alertas-ventas"
import { WidgetPendientes } from "@/components/widgets/widget-pendientes"
import { WidgetFichaProveedor } from "@/components/widgets/widget-ficha-proveedor"

/**
 * EL REGISTRO DE WIDGETS (A-FEAT-88).
 *
 * Una sola lista de la que salen las tres cosas: qué se ofrece en el configurador, qué se
 * renderiza en el inicio, y qué se descarta por permisos. Agregar un widget es agregar una fila.
 *
 * ## `seccion` no es una etiqueta: es el permiso
 *
 * Cada widget declara **de qué sección son sus datos**, y eso se cruza con las secciones que el
 * rol tiene habilitadas (`lib/auth/permisos.ts`). Un `contable` no ve el widget de Cash Flow
 * aunque se lo agregue a mano en su `user_metadata` — que es editable por él. Es la misma regla
 * que ya cerró `seccionInicio`: **ninguna preferencia agranda lo que se ve, sólo lo acomoda.**
 *
 * ⚠️ Al agregar un widget nuevo, la `seccion` tiene que ser la de **los datos que muestra**, no la
 * de la pantalla donde a uno le gustaría verlo. Equivocarse acá no rompe nada visible: abre un
 * permiso en silencio, que es el peor modo de falla que tenemos.
 *
 * ## Cada widget carga lo suyo
 *
 * Ninguno recibe datos por props: cada uno consulta por su cuenta. Así uno lento no tapa a los
 * demás, y —más importante— **el widget sigue mostrando lo mismo que la pantalla de la que
 * salió**, porque es literalmente el mismo componente y no una copia que se desactualiza.
 */
export type Widget = {
  id: string
  titulo: string
  /** Para el configurador: qué muestra, en una línea. */
  descripcion: string
  /** La sección de la que salen sus DATOS. Decide quién lo puede ver. */
  seccion: string
  /**
   * Cuánto ocupa en la grilla. `"medio"` entra de a dos por fila; `"completo"` toma la fila
   * entera.
   *
   * Es propiedad del widget y no del usuario a propósito: las alertas anchas **son avisos con
   * texto**, y partirlas a media columna las vuelve ilegibles. Dejar elegir el ancho sonaba más
   * configurable y sólo habría dado más formas de que la pantalla quede mal.
   */
  ancho: "medio" | "completo"
  Componente: ComponentType
}

export const WIDGETS: Widget[] = [
  {
    id: "pendientes",
    titulo: "Pendientes por pantalla",
    descripcion: "Cuántos ítems sin resolver tiene cada sección del sistema.",
    seccion: "principal",
    ancho: "medio",
    Componente: WidgetPendientes,
  },
  {
    id: "ipc",
    titulo: "Último IPC",
    descripcion: "El último índice cargado, con su mes y su fuente.",
    seccion: "principal",
    ancho: "medio",
    Componente: WidgetUltimoIPC,
  },
  {
    id: "ficha-proveedor",
    titulo: "Ficha de proveedor",
    descripcion: "Acceso rápido para buscar un proveedor y ver su cuenta corriente.",
    seccion: "principal",
    ancho: "medio",
    Componente: WidgetFichaProveedor,
  },
  {
    id: "extractos-viejos",
    titulo: "Extractos sin actualizar",
    descripcion: "Avisa si los movimientos bancarios están viejos.",
    seccion: "extracto",
    ancho: "completo",
    Componente: AlertaExtractosDesactualizados,
  },
  {
    id: "parseo-pendiente",
    titulo: "Movimientos sin desglosar",
    descripcion: "Importados a los que les falta pasar por las reglas.",
    seccion: "extracto",
    ancho: "completo",
    Componente: AlertaParseoPendiente,
  },
  {
    id: "fc-venta",
    titulo: "Facturas de crédito de ventas",
    descripcion: "Llegó una FC: ¿corresponde a esta venta?",
    seccion: "ingresos",
    ancho: "completo",
    Componente: AlertasFcVenta,
  },
  {
    id: "alertas-pagos",
    titulo: "Alertas de pagos",
    descripcion: "Anticipos de SICORE sin vincular a su factura.",
    seccion: "egresos",
    ancho: "medio",
    Componente: WidgetAlertasPagos,
  },
  {
    id: "alertas-ventas",
    titulo: "Alertas de ventas",
    descripcion: "Facturas a cobrar y retenciones sin vincular.",
    seccion: "ingresos",
    ancho: "medio",
    Componente: WidgetAlertasVentas,
  },
]

/**
 * Lo que se muestra a quien nunca configuró nada: **el mismo orden que tenía la pantalla fija**.
 * Estrenar la feature no puede cambiarle la home a nadie sin que lo pida.
 */
export const WIDGETS_POR_DEFECTO = [
  "ipc",
  "ficha-proveedor",
  "extractos-viejos",
  "parseo-pendiente",
  "fc-venta",
  "alertas-pagos",
  "alertas-ventas",
]

/**
 * Los widgets a mostrar, ya filtrados por permisos y en el orden elegido.
 *
 * @param elegidos  la preferencia del usuario (`null` = nunca eligió → el default)
 * @param secciones las secciones que el ROL habilita — la única fuente de verdad de qué puede ver
 */
export function widgetsVisibles(
  elegidos: string[] | null,
  secciones: string[]
): Widget[] {
  const permitidas = new Set(secciones)
  const ids = elegidos ?? WIDGETS_POR_DEFECTO

  return ids
    .map((id) => WIDGETS.find((w) => w.id === id))
    // El orden lo da la preferencia, no el registro: si el usuario los ordenó, se respeta.
    .filter((w): w is Widget => Boolean(w) && permitidas.has(w!.seccion))
}
