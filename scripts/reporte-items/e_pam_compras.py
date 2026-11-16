# -*- coding: utf-8 -*-
"""PAM · Detalle 2 — Compras (ítem 2): comprobantes de compra del ejercicio, por cuenta contable, uno por uno.

Fuente: extracto de la base (pam/compras.json): los comprobantes recibidos de la Sucesión cargados en el sistema.
Al 15/11/2026 el primero cargado es del 22/06/2026: del resto del ejercicio no hay comprobantes (los gastos de la
Sucesión se ven sólo en los bancos y la tarjeta, hoja D5)."""
from e_pam_comun import G_MOV, EJERCICIO, ar, cargar, control, dma, fch, fila, hoja, refs

HOJA = 'D2 Compras'
ANCHOS = [11, 22, 34, 14, 26, 25, 18]  # 150
ENC = ['Fecha', 'Tipo y número', 'Proveedor', 'CUIT', 'Detalle', 'Estado de pago', 'Total $']


def _estado(estado, fecha_pago, fecha_estimada):
    if fecha_pago:
        return f'{estado} · pagado el {dma(fecha_pago)}'
    if estado == 'pendiente':
        return 'pendiente de pago' + (f' · estimado {dma(fecha_estimada)}' if fecha_estimada else '')
    return estado


def _renglon(h, f):
    fecha, tipo, pv, nro, prov, cuit, total, cuenta, nro_cta, estado, f_pago, f_est, det = f
    return fila(h, [fch(fecha), f'{tipo} {pv}-{nro}', prov, cuit, det or 'sin detalle cargado', _estado(estado, f_pago, f_est),
                    float(total)])


def construir(lib, src):
    d = cargar(src, 'compras')
    h = hoja(lib, HOJA, ANCHOS)
    filas = d['ejercicio_filas']

    h.titulo('PAM · Detalle 2 — Compras del ejercicio (ítem 2)')
    h.nota(f'Sucesión de Plácido Alberto Martínez — ejercicio {EJERCICIO}. Fuente: los comprobantes recibidos de la Sucesión '
           f"cargados en el sistema (extraído el {dma(d['extraido'])}): {d['comprobantes_cargados']} en total, del "
           f"{dma(d['primer_comprobante_cargado'])} al {dma(d['ultimo_comprobante_cargado'])}. ATENCIÓN: no hay comprobantes "
           'cargados anteriores al 22/06/2026, así que este detalle cubre sólo los últimos días del ejercicio. Cada cuenta '
           'contable con sus comprobantes debajo y su subtotal; el total del ítem suma los subtotales. «Estado de pago» es el '
           'de hoy: lo pagado después del 30/06/2026 estaba pendiente al cierre.')

    h.blanco()
    h.seccion('1 · Comprobantes del ejercicio, por cuenta contable')
    h.encabezado(ENC, repetir=True)
    cuentas = {}
    for f in filas:
        cuentas.setdefault((f[8] or '', f[7] or 'Sin cuenta contable'), []).append(f)
    subt = []
    pend_filas = []
    total_py = 0.0
    for (nro_cta, cuenta), fs in sorted(cuentas.items()):
        fila(h, [None, f'{cuenta}' + (f' (cuenta {nro_cta})' if nro_cta else ''), None, None, None, None, None], {2: 6},
             negrita=True)
        a = None
        for f in sorted(fs, key=lambda x: (x[0], x[3])):
            r = _renglon(h, f)
            a = a or r
            total_py += f[6]
            if not f[10] or f[10] > d['ejercicio'][1]:
                pend_filas.append(r)
        subt.append(h.total(f'Subtotal {cuenta}', {7: h.suma(7, a, h.r)}, col_etiqueta=2))
    r_tot = h.total('Total ítem 2 — Compras del ejercicio (sólo lo cargado: desde el 22/06/2026)', {7: h.suma_de(7, subt)},
                    clave=True)
    control(h, 'total de compras del ejercicio', h.cel(7, r_tot), d['total_ejercicio'],
            'suma de la consulta a los comprobantes recibidos de la Sucesión con fecha del ejercicio')
    r_pend = h.total('De ese total, sin pagar al 30/06/2026 (comprobantes pendientes o pagados después del cierre)',
                     {7: h.suma_de(7, pend_filas)})
    h.nota('El renglón «sin pagar al 30/06/2026» suma los mismos comprobantes de arriba cuyo pago no se hizo dentro del ejercicio: '
           'es la deuda con proveedores al cierre que surge de lo cargado.')

    h.blanco()
    h.seccion('2 · Informativo — comprobantes recibidos DESPUÉS del cierre (no son del ejercicio)')
    h.encabezado(ENC)
    a = None
    for f in d['posteriores_filas']:
        r = _renglon(h, f)
        a = a or r
    h.total('Total posterior al cierre', {7: h.suma(7, a, h.r) if a else '=0'})

    refs(lib)['compras_total'] = h.ref(7, r_tot)
    refs(lib)['compras_a_pagar'] = h.ref(7, r_pend)
    lib.item('2', 'Compras de PAM (sólo lo cargado: desde el 22/06/2026)', h, h.cel(7, r_tot), G_MOV,
             f'{len(filas)} comprobantes en {len(cuentas)} cuentas contables', None)
    lib.item('2a', 'Compras de PAM sin pagar al 30/06/2026', h, h.cel(7, r_pend), G_MOV,
             'comprobantes del ejercicio pendientes o pagados después del cierre', None)

    lib.pendiente('PAM · Compras: no hay comprobantes cargados antes del 22/06/2026',
                  'Los comprobantes recibidos de la Sucesión en el sistema arrancan el 22/06/2026. Del 01/07/2025 al 21/06/2026 no '
                  'hay ninguno: los gastos de ese período (impuestos, honorarios del escribano por las ventas, sueldos, expensas) '
                  'se ven sólo como pagos en los bancos y en la tarjeta. Hay que bajar de ARCA los comprobantes recibidos del '
                  'ejercicio completo y cargarlos.', f'compras informadas {ar(total_py)}: es sólo junio 2026', HOJA)
    lib.pendiente('PAM · Compras: honorarios de JMS y de AMS facturados a la Sucesión en junio 2026',
                  'Factura C 1-69 del 22/06/2026 de José María Martínez (CUIT 23342147739) por 22.735.000,00 «Honorarios JMS» y '
                  'Factura C 2-61 del 26/06/2026 de Plácido Andrés Martínez (CUIT 20287492546) por 25.500.000,00 «Honorarios AMS»: '
                  'las dos figuran pendientes de pago. ¿Son deuda de la Sucesión al 30/06/2026? ¿Se cancelan contra los pagos '
                  '«sueldo» que la Sucesión les hizo en noviembre y diciembre de 2025 (10.591.786,19 a JMS y 2.000.000,00 a AMS, '
                  'hoja D10) o contra las distribuciones?', '48.235.000,00 a pagar al cierre', HOJA)
    lib.pendiente('PAM · Compras: comprobantes del banco de julio 2026 que parecen repetidos',
                  'Banco Galicia (CUIT 30500001735), 31/07/2026: Liquidación A 2004-4661 por 252.141,24, Liquidación B 2004-29 por '
                  '252.141,24 y Nota de Crédito A 2004-95 por −252.141,24, las tres sin cuenta contable. Son posteriores al cierre; '
                  'a revisar cuál queda.', '252.141,24', HOJA)
