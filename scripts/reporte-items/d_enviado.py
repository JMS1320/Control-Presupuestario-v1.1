# -*- coding: utf-8 -*-
"""Hoja «Enviado vs hoy»: lo que se le mandó al contador contra el export de la app del 15/11/2026.

Los importes de «Enviado» salen de la auditoría hecha el 15/11/2026 sobre la carpeta
«- Enviados/2026/Enviar» (papel por papel, renglón por renglón donde se pudo). Son valores fijos con su
fuente: el reporte no vuelve a leer los archivos enviados."""

FILAS = [
    # papel, enviado, hoy, veredicto, qué explica la diferencia
    ("Ventas (A - Diario Ventas)", 466959423.73, 466959423.73, "13 comprobantes iguales, celda por celda"),
    ("Cuentas a pagar (B - Deudas, créditos…)", 6486568.02, 6486568.02, "11 facturas iguales"),
    ("Provisión para gastos (Provision)", 778144.76, 778144.76, "10 facturas iguales; hoy agrega un bloque informativo del 24/25"),
    ("Provisión de cobros (Provision)", 50000850.00, 50000850.00, "igual"),
    ("Stock de hacienda, valor neto al cierre", 738642403.90, 738642403.90, "414 cabezas; igual recalculando (el export guardaba 738.642.404,07 sin recalcular)"),
    ("Templates «por mes», las 14 categorías enviadas (H)", 11731863.62, 11731863.62, "igual mes por mes"),
    ("Gastos bancarios, detalle (H)", 3630918.20, 3630918.20, "225 renglones iguales"),
    ("Impuestos bancarios, detalle (H)", 7504936.07, 7504936.07, "767 renglones iguales"),
    ("Impuesto inmobiliario, cuotas", 9311023.80, 9311023.80, "igual (sólo cambian notas)"),
    ("Red vial, cuotas", 4137813.07, 4137813.07, "igual (sólo cambian notas)"),
    ("Créditos bancarios", 235091.41, 235091.41, "31 renglones iguales"),
    ("Bancos y saldos, total en pesos al cierre", -2231608.58, -1603394.90,
     "Los bancos coinciden. La diferencia es la caja, que en lo enviado iba «Pendiente de informar»: según la planilla de cajas al "
     "30/06/2026 son 628.213,68 (General 0,00 + AMS 197.340,68 + Sigot 430.873,00). El export de la app muestra otra cifra "
     "(1.766.085,92) que no es el saldo real: ver D5."),
    ("Cuentas con socios, saldo total", -90123846.86, -86594765.00,
     "Andrés +628.914,00 (2 pagos por Santander del 01/08 y 01/09/2025 que hoy no están en su cuenta); Mercedes Areco +1.134.572,86 "
     "(albañil del chalet por Caja Sigot 800.000,00; 2 consumos de seguro del chalet 243.272,86 y 1 de internet 91.300,00 que la tarjeta cobra "
     "después del cierre); Cotitulares 1.756.595,00 y Hermanos 9.000,00 figuran sólo en lo enviado."),
    ("Automotores (papel del export; en este reporte el ítem 3d sigue en 1.087.669,69)", 1087669.69, 2255426.69,
     "Hoy entra «Multas Amarok»: dos transferencias del 01/12/2025 por 531.059,00 y 636.698,00 (cuenta Automotores rep. y mantenimiento). "
     "Amarok y Voyage, iguales."),
    ("Gastos bancarios por cuenta (al TC comprador, el elegido)", 3629838.20, 3630918.20,
     "El export sigue al TC vendedor: 12 débitos de US$ 10 de la cuenta en dólares, $ 9 por dólar de diferencia."),
    ("Impuestos bancarios por cuenta (al TC comprador)", 7502758.61, 7504936.07, "Misma causa: tipo de cambio de la cuenta en dólares."),
]


def construir(lib, src):
    h = lib.hoja("Enviado vs hoy", [50, 19, 19, 17, 12, 78], horizontal=True)
    h.titulo("Lo enviado al contador contra el export de hoy (control de correspondencia)")
    h.nota("Fuente: auditoría del 15/11/2026 sobre los archivos de la carpeta «- Enviados/2026/Enviar», comparados papel por papel "
           "con el export de la app del mismo día. «Enviado» es el número que el contador ya tiene; «Hoy» es el que usa este reporte. "
           "Donde difieren, este reporte muestra el de hoy: en la reunión hay que saber cuál de los dos se toma. "
           "El libro de Compras no estaba en esa carpeta (se envió antes) y no se auditó.")
    h.blanco()
    h.encabezado(["Papel", "Enviado al contador", "Export de hoy", "Diferencia", "Estado", "Qué la explica"], repetir=True)
    for papel, env, hoy, exp in FILAS:
        r = h.fila([papel, float(env), float(hoy), None, None, exp])
        h._pon(4, r, f"={h.cel(3, r)}-{h.cel(2, r)}")
        h._pon(5, r, f'=IF(ABS({h.cel(4, r)})<0.01,"Coincide","DIFIERE")')
        if abs(hoy - env) >= 0.01:
            lib.pendiente("Difiere de lo enviado al contador: " + papel, exp, f"{hoy - env:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                          "Enviado vs hoy")
    h.blanco()
    h.nota("Sin cambio de total, pero con avisos nuevos en el export de hoy que pueden aparecer en la reunión: "
           "Anticipos (lo enviado dice «No hubo»; hoy avisa que no cierra 1 de 33 — Penino, $ 2.000.000 — y que hay 11 anticipos por "
           "$ 137.368.912,29 sin empresa asignada) · Cuentas a cobrar (hoy lista fuera del total la factura a Parra por $ 25.000.000,11, "
           "cobrada sin fecha, y 3 liquidaciones de AFA por $ 7.328.488,75) · Cheques (9 «vigentes» con fecha de débito pasada y el "
           "número 103 repetido).")
