# -*- coding: utf-8 -*-
"""PAM · Detalle 12 — Borrador de posición (ítem 12): lo ÚNICO que se puede decir con datos, y lo que falta.

La Sucesión no tiene una foto de balance propio en el sistema. Esta hoja junta sólo lo que tiene dato —bancos,
tarjeta, comprobantes sin pagar y la cuenta con MSA— vinculado a sus detalles (D5, D2, D10), y lista de manera
explícita lo que FALTA para que sea un balance, como renglones «sin dato». No inventa valores ni cierra un total
de patrimonio. Si se arma sola (probar.py), los vínculos se reemplazan por los valores de los extractos."""
from e_pam_comun import G_REF, EJERCICIO, ar, cargar, control, dma, fila, hoja, refs

HOJA = 'D12 Posición'
ANCHOS = [46, 44, 20, 20, 20]  # 150
SD = 'sin dato'
ENC = ['Concepto', 'De dónde sale · observación', 'Al 30/06/2025 $', 'Al 31/12/2025 $', 'Al 30/06/2026 $']


def construir(lib, src):
    b = cargar(src, 'bancos')
    c = cargar(src, 'compras')
    q = cargar(src, 'cuentas')
    sm = q['segun_msa']
    fx = q['fuera_de_estos_bloques']
    R = refs(lib)
    suelto = 'bancos_cie' not in R
    h = hoja(lib, HOJA, ANCHOS)
    res = b['visa']['resumenes']
    visa = {x[1]: x for x in res}
    ca, cc = b['cuentas'][0], b['cuentas'][1]

    def v(clave, valor):
        return f'={R[clave]}' if clave in R else float(valor)

    h.titulo('PAM · Detalle 12 — Borrador de posición de la Sucesión (ítem 12)')
    h.nota(f'Sucesión de Plácido Alberto Martínez — ejercicio {EJERCICIO}. NO es un balance: la Sucesión no tiene foto de balance '
           'en el sistema. Arriba va lo único que hoy tiene dato, vinculado a su detalle (D5 Bancos, D2 Compras, D10 Cuentas); '
           'abajo, lo que falta, como renglones «sin dato». No se suma un patrimonio: faltan los bienes, las inversiones, los '
           'dólares y el saldo de inicio con MSA.' + (' (Hoja armada sola: los importes van como valor del extracto, sin vínculo.)'
                                                      if suelto else ''))

    # ---------- 1 · con dato ----------
    h.blanco()
    h.seccion('1 · Lo que se puede decir con datos — saldos')
    h.encabezado(ENC)
    r1 = fila(h, ['Caja de ahorro en pesos — Banco Galicia', 'D5 Bancos, 5a: saldo del extracto', v('5a_ini', ca['saldo_inicio']),
                  v('5a_dic', ca['saldo_dic']), v('5a_cie', ca['saldo_cierre'])])
    r2 = fila(h, ['Cuenta corriente en pesos — Banco Galicia', 'D5 Bancos, 5b: saldo del extracto (abrió el 24/09/2025)',
                  v('5b_ini', cc['saldo_inicio']), v('5b_dic', cc['saldo_dic']), v('5b_cie', cc['saldo_cierre'])])
    r_b = h.total('Total ítem 12 — Bancos en pesos (lo único que se puede sumar)', {k: h.suma(k, r1, r2) for k in (3, 4, 5)},
                  clave=True)
    control(h, 'bancos al 30/06/2026 contra D5', h.cel(5, r_b), ca['saldo_cierre'] + cc['saldo_cierre'], 'D5 Bancos, total ítem 5')
    control(h, 'bancos al 31/12/2025 contra D5', h.cel(4, r_b), ca['saldo_dic'] + cc['saldo_dic'], 'D5 Bancos, total ítem 5')
    control(h, 'bancos al 30/06/2025 contra D5', h.cel(3, r_b), ca['saldo_inicio'] + cc['saldo_inicio'], 'D5 Bancos, total ítem 5')

    h.blanco()
    h.seccion('1.1 · Deudas y cuentas con dato (no se suman a los bancos: cada una con su signo y su salvedad)')
    h.encabezado(ENC)
    ult = res[-1]
    fila(h, ['Tarjeta VISA — a pagar, en pesos (positivo = deuda; negativo = a favor)',
             f"D5 Bancos, 5c: resúmenes cerrados el {dma(res[0][1])} y el 31/12/2025. Al 30/06/2026 no hay resumen cargado: el "
             f"último es del {dma(ult[1])}, con saldo {ar(ult[7])}. Aparte, en dólares: US$ {ar(visa['2025-06-26'][9])}, "
             f"US$ {ar(visa['2025-12-31'][9])} y US$ {ar(ult[9])} al último resumen.",
             v('visa_jun25', visa['2025-06-26'][7]), v('visa_dic', visa['2025-12-31'][7]), SD])
    a_pagar = sum(f[6] for f in c['ejercicio_filas'] if not f[10] or f[10] > c['ejercicio'][1])
    fila(h, ['Comprobantes de compra sin pagar al cierre',
             'D2 Compras, 2a: honorarios de JMS (22.735.000,00) y de AMS (25.500.000,00) facturados en junio 2026 y una factura '
             'del escribano. Antes del 22/06/2026 no hay comprobantes cargados.', SD, SD, v('compras_a_pagar', a_pagar)])
    fila(h, ['Cuenta con MSA (signo de MSA: negativo = la Sucesión le debe a MSA)',
             f"D10 Cuentas, 10a: saldo de la Sucesión en los libros de MSA partiendo de 0. La apertura del contador de MSA traía "
             f"«Socio Plácido Martínez» por {ar(sm['apertura_contador_socio_placido'])} al 30/06/2025, que el sistema no toma.",
             SD, SD, v('msa_saldo', sm['saldo_cierre'])])
    fila(h, ['Cuenta con MA (Mercedes Areco)',
             'No hay saldo: la Sucesión no lleva cuenta con MA. Lo que se ve son los giros del ejercicio (abajo y en D10, 10b).',
             SD, SD, SD])

    h.blanco()
    h.seccion('1.2 · Lo que se puede decir con datos — movimientos del ejercicio (no son saldos)')
    h.encabezado(['Concepto', 'De dónde sale · observación', None, None, 'Del ejercicio $'])
    tq = q['totales_consulta']
    fila(h, ['Giros de PAM a MA', 'D10 Cuentas, 10b: 7 transferencias a Mercedes Areco', None, None, v('ma_giros', tq['giros_a_ma'])])
    fila(h, ['Neto recibido de MSA (retiros − aportes)', 'D10 Cuentas, 10a: 9 retiros menos 2 aportes, por los bancos de PAM', None, None,
             v('msa_neto_bancos', tq['retiros_de_msa'] - tq['aportes_a_msa'])])
    fila(h, ['Pagos «sueldo» a José María y a Andrés Martínez', 'D10 Cuentas, 10e: 4 transferencias desde la cuenta corriente', None,
             None, v('socios_sueldo', tq['pagos_jms'] + tq['pagos_ams'])])
    fci = sum(x['fci_rescates'] - x['fci_suscripciones'] for x in b['cuentas'])
    fila(h, ['Fondo común (FIMA): rescates menos suscripciones', 'D5 Bancos, sección 3: lo que volvió del fondo menos lo que se colocó',
             None, None, v('fci_neto', fci)])
    fila(h, ['Ventas facturadas conocidas', 'D1 Ventas, ítem 1: sólo la Factura C 2-31 a MSA', None, None,
             v('ventas_total', sm['factura_2_31'])])

    # ---------- 2 · lo que falta ----------
    h.blanco()
    h.seccion('2 · Lo que FALTA para que esto sea un balance — sin dato en el sistema')
    h.encabezado(ENC)
    faltan = [
        ('Campos y otros bienes de la Sucesión',
         'Qué bienes quedan y con qué valor: El Relincho y Quinta Rosello; a confirmar el Complementario y el Fondo Educativo. En el '
         'sistema no hay ningún inventario de bienes de la Sucesión.'),
        ('Venta de campos (La Celina y San Ignacio)',
         f"Sólo se ven los gastos de venta pagados el 17/12/2025 ({ar(fx['gastos_de_venta_de_campos']['total'])} al escribano). No está "
         'la operación: qué se vendió, a qué precio, dónde entró la plata y si el bien era de la Sucesión.'),
        ('Fondo común de inversión (FIMA)',
         'Tenencia (cuotapartes y valor) en las tres fechas. Sólo se ven las suscripciones y los rescates por los bancos.'),
        ('Dólares', 'Cuentas o caja en dólares, caja de seguridad. No hay ninguna cargada; de la tarjeta, sólo el saldo en US$.'),
        ('Arrendamientos a cobrar', 'Facturas emitidas y no cobradas en cada fecha: el sistema no tiene las facturas del ejercicio.'),
        ('Deudas impositivas', 'Ingresos brutos, ganancias y bienes personales, inmobiliario y planes de pago de ARBA al cierre.'),
        ('Saldo de inicio con MSA',
         f"El contador de MSA cerró 24/25 con «Socio Plácido Martínez» por {ar(sm['apertura_contador_socio_placido'])}; el sistema "
         'arranca en 0. Falta definir qué pasó con ese saldo.'),
        ('Cuenta con los herederos y cotitulares',
         f"En el ejercicio salieron {ar(fx['distribuciones_a_herederos']['total'])} en distribuciones a los cinco hermanos "
         f"(30/07 al 01/08/2025) y {ar(fx['a_cuenta_cotitulares']['total'])} «a cuenta Cotitulares» (octubre 2025). No hay cuenta "
         'por heredero ni saldo.'),
        ('Tarjeta VISA al 30/06/2026', 'Faltan los resúmenes de mayo y junio de 2026.'),
        ('Patrimonio de la Sucesión', 'No se puede calcular: es la diferencia entre todo lo de arriba, y falta la mayor parte.'),
    ]
    for concepto, det in faltan:
        fila(h, [concepto, det, SD, SD, SD])
    h.nota(f'{len(faltan)} renglones sin dato. Cada uno tiene su pregunta en la hoja de pendientes.')

    lib.item('12', 'Borrador de posición de PAM — bancos en pesos (el resto, sin dato)', h, h.cel(5, r_b), G_REF,
             'caja de ahorro + cuenta corriente; tarjeta, compras sin pagar y cuenta con MSA van aparte; bienes, inversiones y '
             'dólares sin dato', None)

    # ---------- pendientes ----------
    P = lib.pendiente
    P('PAM · ¿Se le arma balance propio?',
      'El 16/10 quedó anotado «PAM deja de tener contabilidad y MA la absorbe». ¿Se le arma igual un balance propio a la Sucesión? '
      '¿Con qué fechas: 30/06/2026 como MSA, 31/12/2025 como MA, o hasta el día en que MA la absorbe? En el sistema la Sucesión no '
      'tiene ninguna foto de balance (MSA tiene tres y MA dos).', 'define todo el reporte de PAM', HOJA)
    P('PAM · Bienes de la Sucesión',
      'Qué bienes quedan en la Sucesión y con qué valor: El Relincho, Quinta Rosello; a confirmar el Complementario y el Fondo '
      'Educativo. No hay inventario cargado. En los bancos se ve el pago de la inscripción de «Quinta Rosello + Casa San Martín» '
      '(900.000,00 el 01/07/2025) y dos reintegros de un tercio (300.000,00 el 16/07 y el 13/08/2025).', 'sin dato', HOJA)
    P('PAM · Venta de La Celina y San Ignacio',
      'El 17/12/2025 la cuenta corriente pagó a Allende Carlos Ig. (CUIT 20131200030) «Gastos Venta La Celina - sin IVA» por '
      '17.721.977,30 y «Gastos Venta San Ignacio - sin IVA» por 2.892.988,00. No hay ningún registro de la venta: ¿los campos eran '
      'de la Sucesión?, ¿a qué precio y en qué moneda?, ¿dónde entró el cobro? (en los bancos en pesos de la Sucesión no está).',
      '20.614.965,30 de gastos; precio de venta sin dato', HOJA)
    P('PAM · Distribuciones a los herederos',
      'Entre el 30/07 y el 01/08/2025 la caja de ahorro transfirió 24.224.046,00 en 10 movimientos: Soledad 5.000.000, Manuel '
      '5.000.000, Mechi 5.000.000, José 5.000.000 y Andrés 4.224.046 (códigos DIST SOLE, DIST MANU, DIST MECHI, DIST JMS, DIST AMS). '
      '¿Son distribución de utilidades de la Sucesión o anticipo de herencia? ¿Por qué Andrés recibió 775.954,00 menos? No están en '
      'ninguna hoja de este reporte.', '24.224.046,00', HOJA)
    P('PAM · Tarjeta: sin saldo al 30/06/2026',
      f"El último resumen cargado es el del {dma(ult[1])} (saldo {ar(ult[7])}, a favor, y US$ {ar(ult[9])}). Para la posición al cierre "
      'hacen falta los resúmenes de mayo y junio de 2026.', 'sin dato', HOJA)
