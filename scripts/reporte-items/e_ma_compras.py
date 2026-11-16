# -*- coding: utf-8 -*-
"""MA · D2 Compras — los comprobantes de compra de MA del ejercicio, por cuenta contable, hasta el comprobante.

Fuente: ma/compras.json (comprobantes recibidos de MA con fecha de emisión entre el 01/07/2025 y el 30/06/2026).
Los comprobantes en dólares van en una tabla aparte y NO se suman a los pesos."""
import collections

from core import ENTERO
from e_ma_comun import GRUPO_A, TC_FMT, ar, cerca, dma, fecha, fila, hoja, leer, pon

D = 'D2 Compras'
SIN = 'SIN CUENTA CONTABLE ASIGNADA'
ENC = ['Fecha', 'Comprobante', 'Proveedor', 'CUIT', 'Estado de pago', 'Fecha de pago', 'Total',
       'Pagado o conciliado', 'Pendiente de pago']


def _comp(v):
    return f"{v[1]} {int(v[2]):04d}-{int(v[3]):08d}"


def _ficha(v):
    mon = 'US$' if v[6] == 'USD' else '$'
    return (f"{dma(v[0])} · {_comp(v)} · {v[5]} (CUIT {v[4]}) · {mon} {ar(v[8])} · "
            f"{v[9] or 'sin cuenta contable'} · estado «{v[11]}»" + (f" · pagado el {dma(v[12])}" if v[12] else ''))


def construir(lib, src):
    d = leer(src, 'compras')
    todas = d['filas']
    pesos = [v for v in todas if v[6] != 'USD']
    usd = [v for v in todas if v[6] == 'USD']
    pend = [v for v in pesos if v[11] == 'pendiente']

    por_cta = collections.defaultdict(list)
    nro = {}
    for v in pesos:
        k = (v[9] or SIN).upper()
        por_cta[k].append(v)
        if v[10]:
            nro[k] = v[10]
    cuentas = sorted(k for k in por_cta if k != SIN) + ([SIN] if SIN in por_cta else [])

    #               1 Fecha 2 Comp 3 Proveedor 4 CUIT 5 Estado 6 F.pago 7 Total 8 Pagado 9 Pendiente
    h = hoja(lib, D, [10, 27, 34, 13, 11, 10, 15, 15, 15])
    h.titulo('D2 · Compras de MA — ejercicio 01/07/2025 al 30/06/2026, por cuenta contable')
    h.nota(f"Fuente: los comprobantes recibidos de MA cargados en el sistema (importados de «Mis comprobantes recibidos» de ARCA), "
           f"con fecha de emisión dentro del ejercicio: {len(todas)} comprobantes ({len(pesos)} en pesos y {len(usd)} en dólares). "
           "MA no está inscripta en IVA: el total del comprobante es todo gasto. Las notas de crédito van en negativo.")
    h.nota('Cómo se lee: el «Total compras» del resumen suma el total de cada cuenta; el total de cada cuenta está más abajo, en su '
           'bloque, y suma los comprobantes que tiene arriba. «Pendiente de pago» = el sistema todavía no le vinculó un pago; '
           '«pagado» o «conciliado» = sí.')

    # 1) resumen por cuenta
    h.blanco()
    h.seccion('1 · Resumen por cuenta contable (en pesos)')
    h.encabezado(['N° cuenta', 'Cuenta contable', '', '', 'Compro-bantes', '', 'Total', 'Pagado o conciliado', 'Pendiente de pago'])
    FM = {5: ENTERO}
    r_res = {}
    for k in cuentas:
        r_res[k] = h.fila([nro.get(k, 's/n°'), k.capitalize() if k != SIN else 'Sin cuenta contable asignada', None, None,
                           '=0', None, '=0', '=0', '=0'], fmt=FM)
    r_total = h.total('Total ítem 2 — compras en pesos',
                      {c: h.suma(c, r_res[cuentas[0]], r_res[cuentas[-1]]) for c in (5, 7, 8, 9)}, clave=True, fmt=FM)
    h.control('total de compras en pesos', h.cel(7, r_total), d['control']['total_pesos_sin_usd'],
              'suma de los comprobantes de compra de MA en la base')
    h.control('pendiente de pago en pesos', h.cel(9, r_total), d['control']['pendientes_pesos_sin_usd'],
              'suma de los comprobantes en estado «pendiente» en la base')

    # 2) detalle por cuenta
    h.blanco()
    h.seccion('2 · DETALLE — un bloque por cuenta contable, cada comprobante')
    r_tot = {}
    primero = True
    for k in cuentas:
        h.blanco()
        h.seccion(f"{nro[k]} · {k}" if k in nro else ('Sin cuenta contable asignada' if k == SIN else k))
        h.encabezado(ENC, repetir=primero)
        primero = False
        a = h.r + 1
        for v in sorted(por_cta[k], key=lambda v: (v[0], v[3])):
            p = v[11] == 'pendiente'
            fila(h, [fecha(v[0]), _comp(v), v[5], v[4], v[11], fecha(v[12]), float(v[8]),
                     None if p else float(v[8]), float(v[8]) if p else None])
        b = h.r
        f = {c: h.suma(c, a, b) for c in (7, 8, 9)}
        f[5] = f"=COUNT({h.cel(7, a)}:{h.cel(7, b)})"
        r_tot[k] = h.total(f"Total {k.capitalize() if k != SIN else 'sin cuenta contable asignada'}", f, clave=True, fmt=FM)
    for k in cuentas:
        for c in (5, 7, 8, 9):
            pon(h, c, r_res[k], f"={h.cel(c, r_tot[k])}")

    # 3) dólares, aparte
    r_usd = None
    if usd:
        h.blanco()
        h.seccion('3 · Comprobantes en DÓLARES — aparte, no se suman a los pesos')
        h.encabezado(['Fecha', 'Comprobante', 'Proveedor', 'CUIT', 'Estado de pago', 'Fecha de pago', 'Total en US$',
                      'Dólar del comprobante', 'Equivalente en $'])
        a = h.r + 1
        for v in usd:
            r = h.r + 1
            fila(h, [fecha(v[0]), _comp(v), v[5], v[4], v[11], fecha(v[12]), float(v[8]), float(v[7]),
                     f"={h.cel(7, r)}*{h.cel(8, r)}"], fmt={8: TC_FMT})
        r_usd = h.total('Total en dólares (y su equivalente en pesos al dólar de cada comprobante)',
                        {7: h.suma(7, a, h.r), 9: h.suma(9, a, h.r)})

    # --- ítems ---
    lib.item('2', 'Compras de MA — comprobantes del ejercicio en pesos', h, h.cel(7, r_total), GRUPO_A,
             f"{len(pesos)} comprobantes en {len(cuentas)} cuentas; detalle por cuenta en D2")
    lib.item('2a', 'De las cuales: pendientes de pago según el sistema', h, h.cel(9, r_total), GRUPO_A,
             f"{len(pend)} comprobantes en estado «pendiente»")
    if r_usd:
        lib.item('2b', 'Compras de MA en dólares (US$, no sumadas a los pesos)', h, h.cel(7, r_usd), GRUPO_A,
                 f"{len(usd)} comprobante(s); equivalente en pesos en la columna de al lado")

    # --- verificación en Python ---
    ctl = d['control']
    malas = []
    if len(todas) != ctl['cantidad']:
        malas.append(f"cantidad {len(todas)} vs {ctl['cantidad']}")
    if not cerca(sum(v[8] for v in pesos), ctl['total_pesos_sin_usd']):
        malas.append(f"total $ {ar(sum(v[8] for v in pesos))} vs {ar(ctl['total_pesos_sin_usd'])}")
    if not cerca(sum(v[8] for v in pend), ctl['pendientes_pesos_sin_usd']):
        malas.append(f"pendiente $ {ar(sum(v[8] for v in pend))} vs {ar(ctl['pendientes_pesos_sin_usd'])}")
    if len(pend) + len([v for v in usd if v[11] == 'pendiente']) != ctl['pendientes']:
        malas.append(f"pendientes {len(pend)} + US$ vs {ctl['pendientes']}")
    if malas:
        lib.pendiente('Compras MA: el extracto no da los totales de la consulta a la base', '; '.join(malas), 'Control en REVISAR', D)

    # --- pendientes ---
    sin = por_cta.get(SIN, [])
    if sin:
        lib.pendiente('Compras MA: comprobantes sin cuenta contable asignada',
                      f"{len(sin)} comprobantes por $ {ar(sum(v[8] for v in sin))} (neto de notas de crédito). Los más grandes: "
                      + ' ‖ '.join(_ficha(v) for v in sorted(sin, key=lambda v: -abs(v[8]))[:8]),
                      'No se puede decir de qué son: falta imputarlos antes de armar un resultado de MA', D)
    grandes = [v for v in pend if abs(v[8]) >= 1000000]
    resto = [v for v in pend if abs(v[8]) < 1000000]
    lib.pendiente('Compras MA: comprobantes que el sistema tiene «pendiente de pago»',
                  f"{len(pend)} comprobantes en pesos por $ {ar(sum(v[8] for v in pend))} neto (más {len(usd)} en dólares, abajo). "
                  f"De $ 1.000.000 o más: " + ' ‖ '.join(_ficha(v) for v in grandes)
                  + f" ‖ y {len(resto)} menores por $ {ar(sum(v[8] for v in resto))} neto (cada uno en D2).",
                  '¿Se deben de verdad al 30/06/2026, se pagaron por otra cuenta (efectivo, cuenta de MSA, Banco Francés) o no '
                  'corresponden a MA? El balance propio de MA no tiene renglón de proveedores a pagar', D)
    pares = collections.defaultdict(list)
    for v in pesos:
        pares[(v[4], round(abs(v[8]), 2))].append(v)
    anul = [vs for vs in pares.values() if any(x[8] > 0 for x in vs) and any(x[8] < 0 for x in vs)]
    if anul:
        lib.pendiente('Compras MA: facturas con una nota de crédito por el mismo importe (parecen anuladas)',
                      ' ‖ '.join(' ↔ '.join(_ficha(x) for x in vs) for vs in anul),
                      'Si se anulan entre sí no son deuda ni gasto; siguen «pendientes» porque nadie las cruzó', D)
    for v in usd:
        lib.pendiente('Compras MA: comprobante en dólares pendiente de pago',
                      f"{_ficha(v)} · dólar del comprobante {ar(v[7])} → $ {ar(v[8] * v[7])}. Mismo proveedor y fecha que la "
                      'factura en pesos de $ 23.747.800,00, también pendiente.',
                      f"US$ {ar(v[8])}: ¿se debe, se pagó por otro lado, o no es de MA?", D)
    sf = [v for v in pesos if v[11] != 'pendiente' and not v[12]]
    if sf:
        lib.pendiente('Compras MA: comprobantes conciliados sin fecha de pago',
                      f"{len(sf)} por $ {ar(sum(v[8] for v in sf))} neto — casi todos de un mismo proveedor (cuenta corriente con "
                      'facturas y notas de crédito). Ej.: ' + ' ‖ '.join(_ficha(v) for v in sf[:3]),
                      'No se puede decir en qué fecha se pagó cada uno', D)
    lib.pendiente('Compras MA: comprobantes fuera del ejercicio que no están en esta hoja',
                  f"{ctl['antes_del_ejercicio']} comprobantes con fecha anterior al 01/07/2025 y {ctl['despues_del_ejercicio']} "
                  'posteriores al 30/06/2026 cargados en el sistema.', 'Informativo', D)
    return h
