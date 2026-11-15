"use client"

/**
 * 📋 EL PROTOCOLO DEL PASE DE CAJA — a la vista en la pantalla de cada caja (A-FEAT-1585, JMS 15/11: «el protocolo de AMS tendré
 * que verlo en la pantalla de caja y él también, así lo tenemos a mano para recordarlo»).
 * Es el mismo texto que `MANUAL-USO.md` § «💵 El pase de caja — protocolo para AMS»: si cambia uno, cambia el otro.
 */
import { useState } from "react"

export const CAJAS_DE_AMS = new Set(["caja_general", "caja_ams", "caja_sigot"])

export function ProtocoloPaseDeCaja({ abiertoAlInicio = false }: { abiertoAlInicio?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoAlInicio)
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30 text-sm">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
        className="w-full text-left px-3 py-2 font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
        <span>📋 Protocolo del pase de caja (AMS)</span>
        <span className="text-xs font-normal text-emerald-700 dark:text-emerald-300">{abierto ? "ocultar" : "ver"}</span>
      </button>
      {abierto && (
        <div className="px-3 pb-3 space-y-2 text-gray-800 dark:text-gray-200">
          <p className="text-xs text-gray-600 dark:text-gray-400">AMS lleva las tres cajas (General, AMS, Sigot) en su Excel, una hoja por caja. Una vez por mes como máximo «pasa caja» con Sigot: renglón por renglón, con las facturas a la vista.</p>
          <p className="font-medium">En el Excel, al pasar caja</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Cada movimiento con su fecha real</b> (la del día que salió o entró la plata).</li>
            <li><b>La columna «Comp» en las tres hojas</b>: <b>FC + proveedor</b> si tiene factura (ej. «FC Gomería Tala»: con eso la app busca la factura sola) · <b>X</b> sin factura · <b>F fijo</b> fondo fijo · <b>DIST + socio</b> por cuenta de un socio.</li>
            <li><b>Un gasto olvidado</b> (la factura que aparece después): se anota <b>al final</b>, con la fecha real del pago y «(anotado tarde)» en el concepto. No se reordena el Excel. ⚠️ Si la fecha es de <b>antes del 30/06</b> y se anota después del cierre, avisar a JMS: cambia el ejercicio que ya cerró.</li>
            <li><b>Un renglón viejo no se corrige ni se borra</b>: se agrega un renglón «ajuste» con la diferencia.</li>
            <li><b>Los pases entre cajas</b>, como siempre: «a caja AMS» / «a Sigot» en la General y «de caja gral» en la que recibe, mismo importe.</li>
            <li><b>El arqueo</b>: se cuenta la plata; si no da, un renglón «ajuste» por la diferencia.</li>
          </ol>
          <p className="font-medium">En la app, al terminar el pase</p>
          <ol className="list-decimal pl-5 space-y-1" start={7}>
            <li><b>Subir el Excel entero</b> en la solapa Importar de cualquier caja: «Revisar» muestra qué entra (nuevos, anotados tarde, posibles repetidos, cambiados, y si el saldo de cada caja da el del Excel) sin guardar nada; después «Cargar».</li>
            <li><b>Conciliar</b> cada movimiento contra su factura, su template de caja, su sueldo o el pase de la otra caja. Queda <b>a confirmar por JMS</b>. <span className="text-xs text-gray-500">(🚧 en construcción)</span></li>
          </ol>
          <p className="text-xs text-gray-600 dark:text-gray-400"><b>JMS</b> confirma lo que concilió AMS (o lo devuelve con un comentario) y mira las alertas: un mes sin subir las cajas, un gasto que entró en un mes ya confirmado, un renglón que <b>cruza el cierre</b>.</p>
        </div>
      )}
    </div>
  )
}
