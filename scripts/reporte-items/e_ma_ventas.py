# -*- coding: utf-8 -*-
"""MA · D1 Ventas — las facturas de arrendamiento de Mercedes Areco, una por una, con su cobro.

Fuente: ma/ventas.json (comprobantes de venta de MA, retenciones sufridas y el cobro del banco vinculado a cada factura).
MA no está inscripta en IVA: factura con Factura C / Factura de crédito electrónica C; el total es todo ingreso."""
from e_ma_comun import GRUPO_A, ar, cerca, dma, fecha, fila, hoja, leer

D = 'D1 Ventas'
ENC = ['Fecha', 'Comprobante', 'Cliente', 'Concepto', 'Estado de cobro', 'Fecha de cobro', 'Importe facturado',
       'Cobrado por el banco', 'Retenciones sufridas', 'Saldo a cobrar']


def _ficha(v):
    return (f"{dma(v[0])} · {v[1]} {v[2]} · {v[4]} (CUIT {v[3]}) · $ {ar(v[6])} · estado «{v[7]}»"
            + (f" · cobro del {dma(v[8])} por $ {ar(v[9])}" if v[8] else " · sin cobro"))


def construir(lib, src):
    d = leer(src, 'ventas')
    ej, post, ant = d['ejercicio'], d['posteriores'], d['anticipo']
    #               1 Fecha 2 Comp 3 Cliente 4 Concepto 5 Estado 6 F.cobro 7 Importe 8 Cobrado 9 Ret 10 Saldo
    h = hoja(lib, D, [10, 22, 24, 18, 11, 10, 15, 14, 13, 13])
    h.titulo('D1 · Ventas de MA — ejercicio 01/07/2025 al 30/06/2026')
    h.nota('Fuente: los comprobantes de venta de MA cargados en el sistema (importados de «Mis comprobantes emitidos» de ARCA), '
           'las retenciones sufridas cargadas y el cobro del banco vinculado a cada factura. Importes en pesos. MA no está '
           'inscripta en IVA: el total de la factura es todo ingreso.')
    h.nota('Cómo se lee: el total del ejercicio suma las facturas que tiene arriba. «Saldo a cobrar» = importe − cobrado por el '
           'banco − retenciones. Lo facturado después del 30/06/2026 va aparte, abajo, y no entra en el total.')

    # 1) ventas del ejercicio
    h.blanco()
    h.seccion('1 · Facturas del ejercicio (01/07/2025 al 30/06/2026)')
    h.encabezado(ENC, repetir=True)
    filas_ej = []
    for v in ej:
        r = h.r + 1
        fila(h, [fecha(v[0]), f"{v[1]} {v[2]}", f"{v[4]} · CUIT {v[3]}", v[5], v[7], fecha(v[8]), float(v[6]),
                 float(v[9]), '=0', f"={h.cel(7, r)}-{h.cel(8, r)}-{h.cel(9, r)}"])
        filas_ej.append(r)
    r_tot = h.total('Total ítem 1 — ventas del ejercicio', {c: h.suma(c, filas_ej[0], filas_ej[-1]) for c in (7, 8, 9, 10)},
                    clave=True)
    h.control('total facturado en el ejercicio', h.cel(7, r_tot), sum(v[6] for v in ej),
              'suma de los comprobantes de venta de MA en la base')
    h.control('saldo a cobrar de lo facturado en el ejercicio (tiene que ser cero)', h.cel(10, r_tot), 0.0,
              'importe − cobrado − retenciones')

    # 2) retenciones del cobro
    h.blanco()
    h.seccion('2 · Retenciones sufridas en el cobro (lo que el cliente retuvo y no entró al banco)')
    h.encabezado(['Fecha', 'Comprobante', 'Cliente', 'Retención', 'Certificado', '', '', '', 'Importe', ''])
    filas_ret = {}
    for i, v in enumerate(ej):
        a = h.r + 1
        for nombre, imp in (('Ganancias', v[10]), ('Ingresos brutos', v[11])):
            if imp:
                fila(h, [fecha(v[8] or v[0]), f"{v[1]} {v[2]}", v[4], nombre, 'Falta', None, None, None, float(imp)])
        if h.r >= a:
            filas_ret[i] = (a, h.r)
    r_ret = h.total('Total retenciones sufridas', {9: h.suma_de(9, [r for a, b in filas_ret.values() for r in range(a, b + 1)])})
    for i, r in enumerate(filas_ej):
        if i in filas_ret:
            a, b = filas_ret[i]
            h.celda(9, r).value = h.suma(9, a, b)
    h.control('retenciones de las facturas del ejercicio contra el total de la tabla 2', h.cel(9, r_tot),
              sum(v[10] + v[11] for v in ej), 'retenciones sufridas cargadas en la base')

    # 3) después del cierre
    h.blanco()
    h.seccion('3 · Facturado DESPUÉS del 30/06/2026 — informativo, no entra en el ítem 1')
    h.encabezado(ENC)
    a = h.r + 1
    for v in post:
        r = h.r + 1
        fila(h, [fecha(v[0]), f"{v[1]} {v[2]}", f"{v[4]} · CUIT {v[3]}", v[5], v[7], fecha(v[8]), float(v[6]),
                 float(v[9]), float(v[10] + v[11]), f"={h.cel(7, r)}-{h.cel(8, r)}-{h.cel(9, r)}"])
    r_post = h.total('Total facturado después del cierre', {c: h.suma(c, a, h.r) for c in (7, 8, 9, 10)})
    h.nota('La factura del 30/09/2026 es la que el balance propio de MA (D12) toma como «arrendamiento a cobrar» al 30/06/2026. '
           'El banco muestra su cobro el 01/10/2026; el sistema todavía la tiene «a cobrar» y sin retenciones cargadas.')

    # 4) anticipo
    h.blanco()
    h.seccion('4 · Cobro a cuenta sin factura — informativo')
    h.encabezado(['Fecha', 'Concepto', '', '', '', '', '', '', 'Importe', ''])
    r_ant = fila(h, [fecha(ant[0]), f"{ant[1]} · CUIT {ant[2]} — {ant[4]}", None, None, None, None, None, None, float(ant[3])],
                 comb={2: 8})

    # --- ítems ---
    lib.item('1', 'Ventas de MA — arrendamientos facturados en el ejercicio', h, h.cel(7, r_tot), GRUPO_A,
             f"{len(ej)} factura(s) a Provinvest S.A.; cobrado por banco + retenciones en D1")
    lib.item('1a', 'Facturado después del cierre (informativo)', h, h.cel(7, r_post), GRUPO_A,
             f"{len(post)} factura(s) de julio a septiembre de 2026; no entra en el ítem 1")

    # --- verificación en Python ---
    for v in ej:
        if not cerca(v[6], v[9] + v[10] + v[11]) and v[7] not in ('a cobrar', 'pendiente'):
            lib.pendiente('Ventas MA: factura cobrada cuyo cobro + retenciones no da el importe', _ficha(v),
                          f"diferencia $ {ar(v[6] - v[9] - v[10] - v[11])}", D)

    # --- pendientes ---
    lib.pendiente('Ventas MA: del 01/07/2025 al 31/12/2025 no hay ninguna factura de venta cargada',
                  'Los comprobantes emitidos de MA se importaron de ARCA desde el 01/01/2026 (archivos «emitidos 2026-01-01 a '
                  '2026-08-18» y «2026-09-01 a 2026-10-01»). No se trajo el segundo semestre de 2025: que no haya facturas cargadas '
                  'no prueba que no se haya facturado. La primera factura cargada es la del 17/06/2026.',
                  'Si se cierra el año 30/06/2025–30/06/2026, el ítem 1 puede estar incompleto. Falta bajar de ARCA los emitidos de '
                  'MA de julio a diciembre de 2025.', D)
    for v in ej:
        if v[10] or v[11]:
            lib.pendiente('Ventas MA: retenciones sufridas sin certificado',
                          f"{_ficha(v)}. Retención de Ganancias $ {ar(v[10])} e Ingresos brutos $ {ar(v[11])}, informadas por "
                          'JMS el 03/11/2026; con el cobro cierran al centavo la factura. Falta el certificado de las dos.',
                          f"$ {ar(v[10] + v[11])} a cuenta de impuestos de MA sin comprobante", D)
    for v in post:
        if v[8] and not cerca(v[6], v[9] + v[10] + v[11]):
            lib.pendiente('Ventas MA: factura posterior al cierre con cobro en el banco y todavía «a cobrar»',
                          f"{_ficha(v)}. Entre lo facturado y lo que entró al banco faltan $ {ar(v[6] - v[9] - v[10] - v[11])}: "
                          'no hay retenciones cargadas para esta factura. ¿Son retenciones (faltan los certificados) o quedó un '
                          'saldo a cobrar?',
                          f"$ {ar(v[6] - v[9] - v[10] - v[11])} sin explicar; es la factura que el balance propio toma como a "
                          'cobrar al 30/06/2026', D)
        elif not v[8]:
            lib.pendiente('Ventas MA: factura posterior al cierre sin cobro y sin cuenta contable',
                          f"{_ficha(v)}. {v[5]}.", f"$ {ar(v[6])} a cobrar", D)
    lib.pendiente('Ventas MA: cobro a cuenta de Provinvest sin factura',
                  f"{dma(ant[0])} · {ant[1]} (CUIT {ant[2]}) · $ {ar(ant[3])} · caja de ahorro Galicia de MA. {ant[4]}",
                  f"$ {ar(ant[3])}: ¿se descuenta de una factura o es un ingreso aparte?", D)
    return h
