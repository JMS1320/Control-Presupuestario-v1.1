# -*- coding: utf-8 -*-
"""D3.5 Gastos bancarios — cuánto cuesta cada cuenta y cada tarjeta, por tipo de gasto y por mes (JMS 18/11).

JMS: «ocupa muchas páginas pero uno ahí no quiere ver cada movimiento sino saber cuánto nos cuesta cada cuenta, cada tarjeta, y
diferenciar el mantenimiento de la cuenta de la caja de seguridad o de las comisiones por transferencia». Entra en una hoja.

Fuente: «Templates - MSA 25-26» → «H · MSA · Gastos Bancarios», RESUMEN POR CATEGORÍA Y POR MES (un renglón por concepto y cuenta).
El cuadro 1 (cuenta × tipo de gasto) apunta a los renglones del cuadro 2 (concepto y cuenta, mes por mes). El movimiento por
movimiento queda en el libro Templates, solapa «H · MSA · Gastos Bancarios» (filtrando por Nro). Impuestos bancarios: no va acá."""
from openpyxl.styles import Alignment

from core import ENTERO, num

HOJA = "D3.5 Gastos bancarios"
MESES = ["jul-25", "ago-25", "sep-25", "oct-25", "nov-25", "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26"]
# comienzo del nombre de la categoría -> columna del cuadro 1
TIPOS = [("Comision Cuenta Bancaria", "Mantenimiento de cuenta"), ("Comision Caja de Seguridad", "Caja de seguridad"),
         ("Comision Transferencias", "Comisiones por transferencias"), ("Comision Extraccion Efectivo", "Extracción de efectivo"),
         ("Comision Cheques", "Cheques"), ("Tarjetas", "Tarjeta")]


def construir(lib, src):
    ws = src.hoja("Templates", "H · MSA · Gastos Bancarios")
    fuente = src.nombre("Templates")
    r0 = next(r for r in range(1, 30) if str(ws.cell(r, 1).value) == "Nro")
    filas = []
    r = r0 + 1
    while str(ws.cell(r, 2).value or "") != "TOTAL":
        nombre = str(ws.cell(r, 2).value)
        cat, _, cuenta = nombre.partition(" — ")
        filas.append(dict(nro=ws.cell(r, 1).value, cat=cat.strip(), cuenta=cuenta.strip() or "(sin cuenta)",
                          meses=[num(ws.cell(r, 3 + i).value) for i in range(12)], total=num(ws.cell(r, 15).value)))
        r += 1
    total_fuente = num(ws.cell(r, 15).value)

    def tipo_de(cat):
        for pref, nom in TIPOS:
            if cat.startswith(pref):
                return nom
        return "Otros"
    tipos = [nom for _p, nom in TIPOS if any(tipo_de(f["cat"]) == nom for f in filas)]
    if any(tipo_de(f["cat"]) == "Otros" for f in filas):
        tipos.append("Otros")
    cuentas = []
    for f in filas:
        if f["cuenta"] not in cuentas:
            cuentas.append(f["cuenta"])
    if len(tipos) > 9:
        raise SystemExit(f"{HOJA}: {len(tipos)} tipos de gasto; el cuadro 1 está armado para 9 como máximo")

    #            1 Nro  2 Concepto/cuenta  3..14 meses  15 Total
    h = lib.hoja(HOJA, [5, 46] + [12] * 12 + [15])
    h.titulo("D3.5 · Gastos bancarios 25/26 — cuánto cuesta cada cuenta y cada tarjeta")
    h.nota(f"Fuente: «{fuente}» → «H · MSA · Gastos Bancarios» (resumen por categoría y por mes). Importes en pesos; la cuenta en "
           "dólares va al tipo de cambio vendedor (al contador se le envió al comprador: la diferencia es de 1.080,00, ver el anexo de "
           "D3 Templates). Los impuestos bancarios no están acá: son otra agrupadora (ítem 3e).")
    h.nota("Cómo se lee: el cuadro 1 muestra cada cuenta por tipo de gasto; cada importe viene del renglón del cuadro 2 con ese "
           "concepto y esa cuenta, que lo abre mes por mes. El movimiento por movimiento está en el libro Templates, solapa "
           "«H · MSA · Gastos Bancarios», filtrando por el Nro del cuadro 2.")

    # 1) cuenta × tipo de gasto
    h.blanco()
    h.seccion("1 · Por cuenta y por tipo de gasto")
    c_tipo = {t: 3 + i for i, t in enumerate(tipos)}
    c_tot, c_prom = 3 + len(tipos), 4 + len(tipos)
    enc = ["", "Cuenta / tarjeta"] + tipos + ["Total del año", "Promedio por mes"]
    h.encabezado(enc)
    r_cta = {}
    for cta in cuentas:
        rr = h.r + 1
        vals = [None, cta] + ["=0"] * len(tipos) + [f"=SUM({h.cel(3, rr)}:{h.cel(2 + len(tipos), rr)})", f"={h.cel(c_tot, rr)}/12"]
        r_cta[cta] = h.fila(vals)
    r_t1 = h.total("Total", {c: h.suma(c, r_cta[cuentas[0]], r_cta[cuentas[-1]]) for c in range(3, c_prom + 1)}, clave=True, col_etiqueta=2)

    # 2) concepto y cuenta, mes por mes
    h.blanco()
    h.seccion("2 · Por concepto y cuenta, mes por mes")
    h.encabezado(["Nro", "Concepto — cuenta"] + MESES + ["Total"])
    r_fila = {}
    for f in filas:
        rr = h.r + 1
        r_fila[(f["cat"], f["cuenta"])] = h.fila([f["nro"], f"{f['cat']} — {f['cuenta']}"] + [float(x) for x in f["meses"]]
                                               + [f"=SUM({h.cel(3, rr)}:{h.cel(14, rr)})"], fmt={1: ENTERO})
        h.celda(1, rr).alignment = Alignment(horizontal="center", vertical="top")
    a, b = min(r_fila.values()), max(r_fila.values())
    r_t2 = h.total("Total del mes", {c: h.suma(c, a, b) for c in range(3, 16)}, clave=True, col_etiqueta=2)
    h.control("total de gastos bancarios contra el export", h.cel(15, r_t2), total_fuente, "Templates · H · MSA · Gastos Bancarios · TOTAL")
    h.control("cuadro 1 contra cuadro 2", h.cel(c_tot, r_t1), 0.0, "esta hoja")
    h.celda(13, h.r).value = f"={h.cel(15, r_t2)}"

    # 3) vínculos del cuadro 1 a los renglones del cuadro 2
    for cta in cuentas:
        for t in tipos:
            rs = [r_fila[(f["cat"], f["cuenta"])] for f in filas if f["cuenta"] == cta and tipo_de(f["cat"]) == t]
            h.celda(c_tipo[t], r_cta[cta]).value = h.suma_de(15, rs) if rs else None
    # verificación en Python
    s = sum(f["total"] for f in filas)
    if abs(s - total_fuente) > 0.01:
        lib.pendiente("Gastos bancarios: los renglones no suman el TOTAL de la fuente", f"suma {s:,.2f} vs TOTAL {total_fuente:,.2f}",
                      "Control en REVISAR", HOJA)
    return h
