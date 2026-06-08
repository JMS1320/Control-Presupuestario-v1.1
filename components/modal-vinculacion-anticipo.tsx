"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { VinculacionController } from "@/hooks/useVinculacionAnticipo"

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
const fmtFecha = (f: string) => {
  const d = new Date(f + 'T12:00:00')
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

/**
 * Wizard 2 pasos para vincular un anticipo a una factura.
 * Controlado por useVinculacionAnticipo — se monta donde se quiera ofrecer la acción.
 */
export function ModalVinculacionAnticipo({ controller }: { controller: VinculacionController }) {
  const {
    modalVinculacion, anticipoParaVincular, candidatosActivos, facturaElegida,
    pasoWizard, calculo, vinculando, extractoInfo, motivoExterno,
    conflictoCuenta, cuentaPreferida,
    onSeleccionarFactura, avanzarAConfirmacion, volverASeleccion, confirmarVinculacion, cerrarModal,
    iniciarMarcaExterno, volverDeExterno, confirmarMarcaExterno, setMotivoExterno,
    setCuentaPreferida,
  } = controller

  return (
    <Dialog open={modalVinculacion} onOpenChange={cerrarModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🔗 Vincular Anticipo a Factura</DialogTitle>
          <DialogDescription>
            {pasoWizard === 'seleccion'
              ? 'Paso 1 — Seleccioná la factura correspondiente'
              : pasoWizard === 'confirmacion'
                ? 'Paso 2 — Confirmá la vinculación'
                : 'Marcar como vinculado externamente'}
          </DialogDescription>
        </DialogHeader>

        {anticipoParaVincular && (
          <div className="space-y-4">

            {/* Resumen anticipo — siempre visible */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
              <div className="font-semibold">{anticipoParaVincular.nombre_proveedor}</div>
              <div className="text-gray-500 text-xs">{anticipoParaVincular.cuit_proveedor} — pagado {fmtFecha(anticipoParaVincular.fecha_pago)}</div>
              <div className="flex gap-4 mt-1 flex-wrap">
                <span>💰 Monto anticipo: <strong>{fmt(anticipoParaVincular.monto)}</strong></span>
                <span className="text-red-700">🏛️ Retención: <strong>{fmt(anticipoParaVincular.monto_sicore || 0)}</strong> ({anticipoParaVincular.tipo_sicore} — {anticipoParaVincular.sicore})</span>
                {anticipoParaVincular.descuento_aplicado ? (
                  <span className="text-blue-700">📉 Descuento: <strong>{fmt(anticipoParaVincular.descuento_aplicado)}</strong></span>
                ) : null}
              </div>
            </div>

            {/* PASO 1: Selector factura + preview cálculo */}
            {pasoWizard === 'seleccion' && (
              <>
                {candidatosActivos.length > 0 ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Factura a vincular:
                    </label>
                    <Select value={facturaElegida} onValueChange={onSeleccionarFactura}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar factura..." />
                      </SelectTrigger>
                      <SelectContent>
                        {candidatosActivos.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.fecha_emision} — {f.denominacion_emisor} — {fmt(f.imp_total || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                    ⚠️ No se encontraron facturas pendientes de este proveedor.
                  </div>
                )}

                {/* Warning: conflicto de cuenta contable FC vs anticipo */}
                {conflictoCuenta && facturaElegida && (
                  <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm space-y-2">
                    <div className="font-semibold text-orange-900">⚠️ Cuentas contables diferentes</div>
                    <div className="text-xs text-gray-700">
                      La FC y el anticipo tienen cuentas contables distintas. Elegí cuál se conserva al vincular:
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cuenta-preferida"
                          value="fc"
                          checked={cuentaPreferida === 'fc'}
                          onChange={() => setCuentaPreferida('fc')}
                        />
                        <span>Conservar cuenta de la <strong>FC</strong>: <code className="bg-white px-1 rounded">{conflictoCuenta.fc}</code></span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cuenta-preferida"
                          value="anticipo"
                          checked={cuentaPreferida === 'anticipo'}
                          onChange={() => setCuentaPreferida('anticipo')}
                        />
                        <span>Usar cuenta del <strong>anticipo</strong>: <code className="bg-white px-1 rounded">{conflictoCuenta.anticipo}</code></span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Preview cálculo inline */}
                {calculo && facturaElegida && (() => {
                  const fac = candidatosActivos.find(f => f.id === facturaElegida)
                  return (
                    <div className={`rounded-lg p-3 text-sm space-y-1 border ${calculo.caso === 'A' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="font-semibold mb-2">
                        {calculo.caso === 'A' ? '✅ Factura cubierta completamente' : '⚠️ Anticipo cubre parcialmente'}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        <span className="text-gray-600">Total factura:</span>
                        <span className="font-medium">{fmt(fac?.imp_total || 0)}</span>
                        {calculo.sicoreFactura > 0 && (<><span className="text-gray-600">SICORE factura:</span><span className="font-medium text-red-700">− {fmt(calculo.sicoreFactura)}</span></>)}
                        <span className="text-gray-600">Anticipo aplicado:</span>
                        <span className="font-medium text-amber-700">− {fmt(anticipoParaVincular.monto)}</span>
                        {calculo.sicore > 0 && (<><span className="text-gray-600">Retención SICORE (anticipo):</span><span className="font-medium text-red-700">− {fmt(calculo.sicore)}</span></>)}
                        {calculo.descuento > 0 && (<><span className="text-gray-600">Descuento:</span><span className="font-medium text-blue-700">− {fmt(calculo.descuento)}</span></>)}
                        <span className="text-gray-600 border-t pt-1 mt-1">{calculo.caso === 'A' ? 'Neto transferido:' : 'Saldo pendiente:'}</span>
                        <span className={`font-bold border-t pt-1 mt-1 ${calculo.caso === 'A' ? 'text-green-700' : 'text-blue-700'}`}>
                          {calculo.caso === 'A' ? fmt(calculo.neto_pagado) : fmt(calculo.saldo)}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!facturaElegida || !calculo}
                    onClick={avanzarAConfirmacion}
                  >
                    Siguiente →
                  </Button>
                  <Button variant="outline" onClick={cerrarModal}>Cancelar</Button>
                </div>

                <div className="pt-1 border-t mt-2">
                  <button
                    type="button"
                    onClick={iniciarMarcaExterno}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    No tengo la FC en el sistema → marcar como vinculado externamente
                  </button>
                </div>
              </>
            )}

            {/* PASO EXTERNO: explicación obligatoria */}
            {pasoWizard === 'externo' && (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-2">
                  <div className="font-semibold">📝 Marcar como vinculado externamente</div>
                  <p className="text-xs text-gray-600">
                    Usá esta opción si el anticipo fue aplicado contra una factura que <strong>no está cargada en la app</strong>
                    {' '}(p.ej. una FC del sistema anterior). El anticipo dejará de aparecer en la alerta de vinculación pendiente.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Explicación <span className="text-red-600">*</span>
                  </label>
                  <Textarea
                    value={motivoExterno}
                    onChange={(e) => setMotivoExterno(e.target.value)}
                    placeholder="Detalle de la FC externa (nro, fecha, monto, etc.)"
                    rows={4}
                    disabled={vinculando}
                    className="text-sm"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Se guarda en la descripción del anticipo para auditoría.
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={volverDeExterno} disabled={vinculando}>
                    ← Atrás
                  </Button>
                  <Button
                    className="flex-1 bg-gray-700 hover:bg-gray-800"
                    disabled={vinculando || !motivoExterno.trim()}
                    onClick={confirmarMarcaExterno}
                  >
                    {vinculando ? 'Guardando...' : '✅ Confirmar externo'}
                  </Button>
                  <Button variant="outline" onClick={cerrarModal} disabled={vinculando}>Cancelar</Button>
                </div>
              </>
            )}

            {/* PASO 2: Confirmación */}
            {pasoWizard === 'confirmacion' && calculo && (() => {
              const fac = candidatosActivos.find(f => f.id === facturaElegida)
              return (
                <>
                  <div className={`rounded-lg p-4 text-sm space-y-2 border ${calculo.caso === 'A' ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}`}>
                    <div className="font-semibold text-base mb-3">
                      {calculo.caso === 'A'
                        ? (extractoInfo?.estado === 'conciliado' ? '✅ Factura cubierta — se marcará como CONCILIADA (pago ya en banco)' : '✅ Factura cubierta — se marcará como PAGADA')
                        : '📋 Pago parcial — quedará saldo pendiente'}
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-medium text-gray-700 mb-1">Factura: {fac?.denominacion_emisor} — {fac?.fecha_emision}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-gray-600">Total factura:</span>
                        <span>{fmt(fac?.imp_total || 0)}</span>
                        {calculo.sicoreFactura > 0 && (<><span className="text-gray-600">SICORE factura (se conserva):</span><span className="text-red-700">− {fmt(calculo.sicoreFactura)}</span></>)}
                        <span className="text-gray-600">Anticipo aplicado:</span>
                        <span className="text-amber-700">− {fmt(anticipoParaVincular.monto)}</span>
                        {calculo.sicore > 0 && (<><span className="text-gray-600">Retención SICORE anticipo ({anticipoParaVincular.tipo_sicore}):</span><span className="text-red-700">− {fmt(calculo.sicore)}</span></>)}
                        {calculo.descuento > 0 && (<><span className="text-gray-600">Descuento:</span><span className="text-blue-700">− {fmt(calculo.descuento)}</span></>)}
                      </div>
                    </div>

                    <div className="border-t pt-2 mt-2 space-y-1 text-xs">
                      <div className="font-semibold text-gray-700">Lo que va a suceder:</div>
                      {calculo.caso === 'A' ? (
                        <>
                          <div className="flex items-start gap-1"><span className="text-green-600">✓</span> Factura → <strong>{extractoInfo?.estado === 'conciliado' ? 'conciliada' : 'pagada'}</strong> con neto <strong>{fmt(calculo.neto_pagado)}</strong> al {fmtFecha(anticipoParaVincular.fecha_pago)}</div>
                          <div className="flex items-start gap-1"><span className="text-green-600">✓</span> Anticipo → <strong>vinculado</strong> (desaparece del cash flow)</div>
                          <div className="flex items-start gap-1"><span className="text-green-600">✓</span> SICORE, retención y descripción heredados a la factura</div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> Factura → saldo <strong>{fmt(calculo.saldo)}</strong> por pagar</div>
                          <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> Anticipo → <strong>parcial</strong> (permanece en cash flow hasta conciliar en banco)</div>
                          <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> SICORE, retención y descripción copiados a la factura</div>
                        </>
                      )}
                      {/* Info extracto bancario */}
                      {extractoInfo ? (
                        <div className="mt-2 pt-2 border-t border-dashed">
                          <div className="font-semibold text-gray-700 mb-1">Extracto bancario ({extractoInfo.tabla}):</div>
                          <div className="flex items-start gap-1">
                            <span className="text-purple-600">✓</span>
                            Movimiento del {fmtFecha(extractoInfo.fecha)} por {fmt(extractoInfo.monto)} ({extractoInfo.estado})
                            → se actualizará con datos de la FC (categ, cuenta contable, factura_id)
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-dashed text-gray-400">
                          Sin movimiento bancario detectado para este anticipo
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={volverASeleccion} disabled={vinculando}>
                      ← Atrás
                    </Button>
                    <Button
                      className={`flex-1 ${calculo.caso === 'A' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      disabled={vinculando}
                      onClick={confirmarVinculacion}
                    >
                      {vinculando ? 'Vinculando...' : '✅ Confirmar Vinculación'}
                    </Button>
                    <Button variant="outline" onClick={cerrarModal} disabled={vinculando}>Cancelar</Button>
                  </div>
                </>
              )
            })()}

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
