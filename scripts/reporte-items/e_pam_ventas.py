# -*- coding: utf-8 -*-
"""PAM · Detalle 1 — Ventas (ítem 1): las facturas de venta (arrendamientos, Factura C) del ejercicio, una por una.

Fuente: extracto de la base (pam/ventas.json). Al 15/11/2026 el sistema NO tiene cargada ninguna factura de venta de
la Sucesión con fecha del ejercicio (lo importado de ARCA arranca el 01/01/2026 y trae dos comprobantes de julio 2026).
La única factura del ejercicio que se conoce sale de la cuenta de la Sucesión en el reporte de MSA. Por eso el total
del ítem es PARCIAL y debajo va, como informativo, lo que entró a los bancos con detalle de arrendamiento."""
from e_pam_comun import G_MOV, EJERCICIO, ar, cargar, control, dma, fch, fila, hoja, refs

HOJA = 'D1 Ventas'
ANCHOS = [11, 20, 34, 14, 36, 17, 18]  # 150
ENC = ['Fecha', 'Comprobante', 'Cliente', 'CUIT', 'Concepto', 'Estado de cobro', 'Importe $']


def construir(lib, src):
    d = cargar(src, 'ventas')
    h = hoja(lib, HOJA, ANCHOS)
    cargadas = d['facturas_cargadas_ejercicio']
    conocidas = d['conocidas_por_otra_fuente']
    cobros = d['cobros_en_banco']

    h.titulo('PAM · Detalle 1 — Ventas del ejercicio (ítem 1)')
    h.nota(f'Sucesión de Plácido Alberto Martínez — CUIT 20044390222 — no inscripta en IVA: factura arrendamientos con '
           f'Factura C. Ejercicio {EJERCICIO}. Fuente: el registro de ventas de la Sucesión en el sistema (extraído el '
           f"{dma(d['extraido'])}) y, para la factura a MSA, la cuenta de la Sucesión en el reporte de MSA. ATENCIÓN: el "
           f"sistema tiene cargadas las facturas emitidas recién desde el {dma(d['primera_factura_cargada'])}; del ejercicio "
           'no hay ninguna. El total de esta hoja es PARCIAL: sólo la factura que se conoce por MSA.')

    # ---------- 1 · facturas del ejercicio ----------
    h.blanco()
    h.seccion('1 · Facturas de venta del ejercicio')
    h.encabezado(ENC, repetir=True)
    filas = []
    for f in cargadas:
        filas.append(fila(h, [fch(f['fecha']), f['comprobante'], f['cliente'], f['cuit'], f['concepto'], f['estado'],
                              float(f['importe'])]))
    if not cargadas:
        fila(h, [None, 'Cargadas en el sistema: ninguna', None, None, None, None, None], {2: 6})
    for f in conocidas:
        filas.append(fila(h, [fch(f['fecha']), f['comprobante'], f['cliente'], f['cuit'], f['concepto'], f['estado'],
                              float(f['importe'])]))
    r_tot = h.total('Total ítem 1 — Ventas del ejercicio (PARCIAL: sólo lo conocido)',
                    {7: h.suma(7, filas[0], filas[-1]) if filas else '=0'}, clave=True)
    total_py = sum(f['importe'] for f in cargadas) + sum(f['importe'] for f in conocidas)
    for f in conocidas:
        control(h, f"{f['comprobante']} contra la cuenta de la Sucesión en MSA", h.cel(7, r_tot), total_py,
                'reporte de MSA, «D10 Socios», renglón 19/08/2025 «Facturas y sueldo · 2-31»')
        h.nota(f"De dónde sale la {f['comprobante']}: {f['fuente']}. No está cargada en el registro de ventas de la Sucesión ni "
               'como comprobante recibido por MSA.')

    # ---------- 2 · informativo: cobros de arrendamiento en los bancos ----------
    h.blanco()
    h.seccion('2 · Informativo — lo que ENTRÓ a los bancos de la Sucesión con detalle de arrendamiento (no son facturas)')
    h.nota('No interviene en el total del ítem. Sirve para medir lo que falta: cada cobro debería tener su factura. Son '
           'movimientos del extracto con el detalle que les puso JMS; ninguno está vinculado a un comprobante.')
    h.encabezado(['Fecha', 'Cuenta', 'De quién (según el banco)', None, 'Detalle · descripción del banco', 'Estado',
                  'Importe $'])
    a = None
    s = 0.0
    for cta, fecha, desc, imp, det, est, ley in cobros:
        r = fila(h, [fch(fecha), 'Caja de ahorro' if cta == 'CA' else 'Cuenta corriente', ley or 'sin dato en el extracto',
                     None, f'{det} · {desc}', est, float(imp)], {3: 4})
        a = a or r
        s += imp
    r_cob = h.total(f'Total cobrado por arrendamientos según los bancos — {len(cobros)} movimientos',
                    {7: h.suma(7, a, h.r) if a else '=0'})
    control(h, 'cobros de arrendamiento en los bancos', h.cel(7, r_cob), d['cobros_en_banco_total'],
            'suma de la consulta a los extractos (créditos con detalle de arrendamiento)')

    # ---------- 3 · informativo: posteriores al cierre ----------
    h.blanco()
    h.seccion('3 · Informativo — comprobantes emitidos DESPUÉS del cierre (no son del ejercicio)')
    h.encabezado(ENC)
    a = None
    for f in d['posteriores_al_cierre']:
        r = fila(h, [fch(f['fecha']), f['comprobante'], f['cliente'], f['cuit'], f['concepto'], f['estado'], float(f['importe'])])
        a = a or r
    h.total('Total posterior al cierre', {7: h.suma(7, a, h.r) if a else '=0'})
    if d.get('contratos_cargados'):
        c = d['contratos_cargados'][0]
        h.nota(f"Contrato de arrendamiento cargado para la campaña {c['campania']}: {c['campo']} — {c['cliente']} (CUIT {c['cuit']}), "
               f"{ar(c['has'])} ha a {ar(c['qq_ha'], 0)} qq/ha de {c['grano']}. Es el único contrato de la Sucesión en el sistema.")

    refs(lib)['ventas_total'] = h.ref(7, r_tot)
    lib.item('1', 'Ventas de PAM (parcial: sólo la factura conocida por MSA)', h, h.cel(7, r_tot), G_MOV,
             f'{len(cargadas)} facturas cargadas en el sistema + {len(conocidas)} conocida por la cuenta de MSA', None)

    # ---------- pendientes ----------
    lib.pendiente('PAM · Ventas: faltan las facturas del ejercicio',
                  f"El sistema no tiene ninguna factura de venta de la Sucesión entre el 01/07/2025 y el 30/06/2026 (lo importado "
                  f"de ARCA arranca el 01/01/2026 y la primera cargada es del {dma(d['primera_factura_cargada'])}). En los bancos "
                  f"entraron {ar(s)} con detalle de arrendamiento en {len(cobros)} movimientos (01/07/2025 al 20/11/2025): Rosello de "
                  'Martí (CUIT 30583580529) 11.000.000 el 04/07/2025 y 33.180.000 entre el 17 y el 29/10/2025; PROVINVEST (CUIT '
                  '33710346939) 71.567.988,87 el 20/11/2025; María M. Martínez (CUIT 27148862635) 2.862.039 el 08/07/2025; y dos '
                  'echeq sin nombre por 1.809.629 (01/07/2025) y 2.145.771 (07/07/2025). Hay que bajar de ARCA los comprobantes '
                  'emitidos del 01/07/2025 al 31/12/2025 y cargarlos.',
                  f'ventas del ejercicio informadas {ar(total_py)} contra {ar(s)} cobrados por banco', HOJA)
    lib.pendiente('PAM · Ventas: numeración de la Factura C',
                  'La factura a MSA del 19/08/2025 es la 2-31 y la primera cargada en el sistema es la 2-40 del 24/07/2026: si la '
                  'numeración es corrida, las 2-32 a 2-39 (8 facturas) se emitieron en el medio y no están cargadas. Inferido de '
                  'los números; a confirmar con el listado de ARCA.', '8 facturas sin cargar (inferido)', HOJA)
    lib.pendiente('PAM · Ventas: la Factura C 2-31 a MSA no está en ningún registro',
                  'Factura C 2-31 del 19/08/2025 a Martínez Sobrado Agro SRL (CUIT 30617786016) por 6.228.000,07: figura sólo en la '
                  'cuenta de la Sucesión que lleva MSA. No está en las ventas de PAM ni entre los comprobantes recibidos de MSA; '
                  'falta el concepto (qué campo y qué campaña) y el comprobante.', '6.228.000,07', HOJA)
    lib.pendiente('PAM · Ventas: arrendamientos 24/25 cobrados en julio 2025',
                  'Tres cobros de julio 2025 dicen «24/25» en el detalle (Lote Fondo Girardi cuota 2 de 2 por 1.809.629 el '
                  '01/07/2025; El Relincho por 2.145.771 el 07/07/2025; San Ignacio por 2.862.039 el 08/07/2025): ¿se facturaron '
                  'antes del 30/06/2025 (serían un crédito al inicio) o son venta de este ejercicio?', '6.817.439,00', HOJA)
