# -*- coding: utf-8 -*-
"""Versión INTERMEDIA del reporte (JMS 18/11: «un intermedio entre el grande y el chico»): las mismas hojas y los mismos números,
pero las secciones de renglón por renglón que no aportan en el papel quedan PLEGADAS: se ve el título de la sección y su total, y
los renglones del medio se ocultan (no se borran: las fórmulas que apuntan a ellos siguen andando, y en el Excel se pueden mostrar).

Se aplica al final de main.py cuando la variable de entorno REPORTE_INTERMEDIO vale 1. Qué se pliega está en REGLAS, por hoja."""
import re

UMBRAL_COMPRAS = 500000.0     # una cuenta de compras con menos que esto en el año va sólo con su total


def _es_titulo(c):
    return isinstance(c.value, str) and c.font is not None and bool(c.font.underline) and bool(c.font.bold)


def _relleno(c):
    try:
        return str(c.fill.fgColor.rgb or "")[-6:].upper()
    except Exception:
        return ""


def _es_total(ws, r):
    return any(_relleno(ws.cell(r, k)) in ("E4EAF2", "FFF4D6") for k in (2, 3, 4))


def secciones(ws):
    """[(fila del título, texto, última fila de la sección)]"""
    tit = [(r, str(ws.cell(r, 2).value)) for r in range(1, ws.max_row + 1) if _es_titulo(ws.cell(r, 2))]
    return [(r, t, (tit[i + 1][0] - 1 if i + 1 < len(tit) else ws.max_row)) for i, (r, t) in enumerate(tit)]


def plegar(ws, desde, hasta, conservar_totales=True):
    """Oculta los renglones de una sección, salvo su título y (si se pide) sus renglones de total."""
    n = 0
    for r in range(desde + 1, hasta + 1):
        if conservar_totales and _es_total(ws, r):
            continue
        ws.row_dimensions[r].hidden = True
        n += 1
    return n


def _marcar(ws, r, texto):
    c = ws.cell(r, 2)
    if isinstance(c.value, str) and texto not in c.value:
        c.value = c.value + texto


def aplicar(lib):
    resumen = []
    por_nombre = {h.nombre: h.ws for h in lib.hojas}

    def regla(hoja, condicion, nota=" — plegado: el renglón por renglón está en el Excel"):
        ws = por_nombre.get(hoja)
        if ws is None:
            return
        n = k = 0
        for r, t, fin in secciones(ws):
            if condicion(t, ws, r, fin):
                n += plegar(ws, r, fin)
                _marcar(ws, r, nota)
                k += 1
        resumen.append((hoja, k, n))

    # B2 · No informado: queda el resumen; cada bloque numerado, plegado a su título y su total
    regla("No informado", lambda t, *_: bool(re.match(r"^\d+(\.\d+)? · ", t)))
    # B3 · Socios interno: el detalle de los ajustes de la capa interna, socio por socio
    regla("D10.1 Socios interno", lambda t, *_: t.startswith("3 · 10i"))
    # B4 · Socios: el detalle mes por mes de cada socio · Socios falta: los dudosos
    regla("D10 Socios", lambda t, *_: bool(re.match(r"^4 · 10[a-z] · ", t)))
    regla("D10.2 Socios falta", lambda t, *_: t.startswith("3 · Dudosos"))
    # B5 · A pagar: las cuentas corrientes renglón por renglón y los bloques informativos que no suman
    regla("D9 A pagar", lambda t, *_: "Informativo" in t or bool(re.match(r"^9a\.2\.\d", t)))
    # B6 · Pendientes: sólo quedan los que pueden cambiar un número
    regla("Pendientes", lambda t, *_: t.startswith("2 · "))

    # B1 · Compras: las cuentas chicas van sólo con su total
    def chica(t, ws, r, fin):
        if not re.match(r"^\d{4,} · ", t):
            return False
        tot = sum(float(ws.cell(x, 11).value) for x in range(r + 1, fin + 1)
                  if isinstance(ws.cell(x, 11).value, (int, float)) and not isinstance(ws.cell(x, 11).value, bool))
        return abs(tot) < UMBRAL_COMPRAS
    regla("D2 Compras", chica, " — cuenta de menos de 500.000 en el año: sólo el total (las facturas están en el Excel)")

    # B7 · Impuestos generales y rurales (Templates, egresos): la cuota por cuota
    regla("D3.3 Egresos", lambda t, *_: bool(re.match(r"^3[a-z]\d? · Impuestos (General|Rurales)", t)))
    return resumen
