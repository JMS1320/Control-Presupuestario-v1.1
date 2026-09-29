"use client"

/**
 * 🧾 **El aviso: hay notas de crédito sin aplicar contra facturas que estás por pagar.**
 *
 * Pedido del usuario 2026-09-29 (A-FEAT-1192):
 * > *«Para cash flow hasta podría haber un alert de si hay FC con NC equivalentes proponga
 * > cancelarlas con la función existente.»*
 *
 * ## Qué hace y qué NO
 *
 * **Avisa y lleva a cancelarlas.** No aplica la nota de crédito acá ni toca la base: el botón
 * **«Cancelarlas»** te deja en **Egresos → Facturas → Pagos** con **el modal de cancelación ya
 * abierto** para ese proveedor — el mismo que usabas, con las notas de crédito ya buscadas.
 *
 * ⚠️ **La primera versión sólo avisaba, y el usuario la marcó 🟡 el 2026-09-29**: *«anduvo en parte,
 * porque no hubo botón para cancelarlas unas con otras como lo teníamos desarrollado»*. Tenía razón:
 * **un aviso que no deja actuar deja el trabajo a mitad** — te dice que hay $2 M mal y después te
 * manda a buscar la pantalla vos.
 *
 * 🛑 **Pero la cancelación NO se copió acá**, que era el riesgo: el botón deja un encargo en
 * `sessionStorage` y navega; **la pantalla de Pagos abre SU modal de siempre**. Si el criterio
 * cambia, cambia en un solo lugar. Dos pantallas que cancelan notas de crédito es § 🗺️ *«se arregló
 * un camino de los dos»* esperando a pasar.
 *
 * ## Por qué es un cartel y no un panel que se abre
 *
 * § 🧮 *un control que nadie ve no es un control*, **y proporcional**: acá hay plata de verdad —al
 * escribirlo, **$1.764.482,50 de una sola nota de crédito de NOVITAS SA** contra $3.621.832,50 de
 * facturas por pagar—. Pagar esas facturas sin aplicarla es pagar de más. Un panel que hay que
 * acordarse de abrir no avisa de nada.
 *
 * Es un aviso que **NO frena** (§ 🚦): que haya una nota de crédito sin aplicar no es una
 * contradicción del sistema, es una decisión del usuario. Puede querer pagar la factura entera y
 * usar la nota de crédito contra la próxima. Se muestra y se sigue.
 *
 * ## ⚠️ Mira facturas individuales, no grupos de pago
 *
 * Sólo considera las filas que son **una factura de ARCA**. Un grupo de pago ya tiene la decisión
 * tomada y, si mezcla tipos, llega con el tipo de comprobante en blanco — lo que lo haría contar
 * como factura. Antes de avisar sobre un grupo hay que poder abrirlo, y eso es otra cosa.
 *
 * ## 🕳️ Y lo que NO puede ver: las empresas apagadas
 *
 * El aviso mira lo que la pantalla cargó, y eso depende del **selector de empresas**: las facturas
 * de **MA vienen apagadas por default**, así que sus notas de crédito no aparecen hasta que las
 * prendas. **Y ahí hay plata**: al escribir esto, MA tenía **$3.285.658,59** sin aplicar —entre
 * ellas PRESTIGIO SA, con $2.054.553,44 contra $2.124.218,90 por pagar— contra $1.911.738,67 de
 * MSA. O sea que **la mayor parte del problema vive en la empresa que viene apagada**.
 *
 * 👉 Para la vista completa de las tres empresas de una vez, sin depender del filtro:
 * `npx tsx scripts/verificar-notas-credito.mts`. Es la misma función, así que no puede discrepar.
 */

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { detectarProveedoresConNC, type ComprobanteParaNC } from "@/lib/pagos/notas-credito"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { dejarEncargoCancelacionNC } from "@/lib/pagos/encargo-cancelacion-nc"

/** Lo que necesita de una fila del Cash Flow. Se tipa al mínimo a propósito: así no se acopla. */
export interface FilaParaAviso {
  id: string
  origen_tabla: string
  cuit_proveedor: string
  nombre_proveedor: string
  comprobante_display?: string | null
  tipo_comprobante?: number | null
  imp_total?: number
  debitos: number
  estado: string
  facturas_agrupadas?: number
}

const pesos = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AvisoNotasCredito({ filas }: { filas: FilaParaAviso[] }) {
  const [abierto, setAbierto] = useState(false)

  const proveedores = useMemo(() => {
    const comprobantes: ComprobanteParaNC[] = filas
      // Sólo facturas individuales de ARCA — ver la nota del encabezado.
      .filter(f => f.origen_tabla.endsWith("comprobantes_arca") && (f.facturas_agrupadas ?? 1) <= 1)
      .map(f => ({
        id: f.id,
        cuit: f.cuit_proveedor,
        proveedor: f.nombre_proveedor,
        display: f.comprobante_display || "",
        tipoComprobante: f.tipo_comprobante,
        // `imp_total` es el importe del comprobante; `debitos` es el respaldo cuando la fila no lo
        // trae. Se usa en absoluto: una NC puede venir guardada en negativo.
        importe: Math.abs(f.imp_total ?? f.debitos ?? 0),
        estado: f.estado,
      }))
    return detectarProveedoresConNC(comprobantes)
  }, [filas])

  if (proveedores.length === 0) return null

  const totalNC = proveedores.reduce((s, p) => s + p.totalNotasCredito, 0)

  return (
    <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-amber-900">
          🧾 <strong>{proveedores.length}</strong>{" "}
          {proveedores.length === 1 ? "proveedor tiene" : "proveedores tienen"} notas de crédito sin
          aplicar contra facturas por pagar, por <strong>${pesos(totalNC)}</strong>.{" "}
          <span className="text-amber-800">
            Si pagás las facturas sin aplicarlas, pagás de más.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAbierto(!abierto)}
          className="border-amber-500 text-amber-800 hover:bg-amber-100"
        >
          {abierto ? "Ocultar" : "Ver cuáles"}
        </Button>
      </div>

      {abierto && (
        <div className="mt-3 space-y-3">
          {proveedores.map(p => (
            <div key={p.cuit} className="rounded border border-amber-300 bg-white px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-medium text-gray-900">{p.proveedor}</span>
                <span className="text-xs text-gray-600">CUIT {p.cuit}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span className="text-gray-700">
                  Por pagar: <strong>${pesos(p.totalFacturas)}</strong>{" "}
                  <span className="text-gray-500">({p.facturas.length})</span>
                </span>
                <span className="text-amber-800">
                  Notas de crédito: <strong>${pesos(p.totalNotasCredito)}</strong>{" "}
                  <span className="text-amber-700">({p.notasCredito.length})</span>
                </span>
                <span className={p.saldo < 0 ? "font-medium text-red-700" : "text-gray-900"}>
                  Quedaría a pagar: <strong>${pesos(p.saldo)}</strong>
                  {/* 🔑 Saldo negativo no es un error: el proveedor debe más de lo que se le va a
                      pagar. Se dice, no se esconde ni se recorta a cero (§ 🧮). */}
                  {p.saldo < 0 && (
                    <span className="ml-1 font-normal">
                      — la nota de crédito es más grande que la factura, queda saldo a favor
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] leading-relaxed text-gray-600">
                  {p.notasCredito.map(nc => nc.display).filter(Boolean).join(" · ")}
                </span>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => dejarEncargoCancelacionNC(p.cuit, p.proveedor)}
                >
                  Cancelarlas
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-amber-900">
            <strong>«Cancelarlas»</strong> te lleva a Egresos → Facturas → <strong>Pagos</strong> con
            el modal de cancelación <strong>ya abierto</strong> para ese proveedor: elegís cuáles
            aplicar y confirmás. Es el mismo modal de siempre — este aviso no cancela nada por su
            cuenta, sólo te deja parado ahí.
          </p>
          {/* El test aparece donde se corre el proceso (§ 🧪 un A-TEST nace con su proceso). */}
          <TestsDelProceso proceso="cashflow/notas-credito" pantalla="cashflow" />
        </div>
      )}
    </div>
  )
}
