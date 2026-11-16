# -*- coding: utf-8 -*-
"""Reporte de ítems de MA (Mercedes Areco, CUIT 27066824611) — lo común a los módulos e_ma_*.

Los datos NO salen de exports de la app sino de extractos en JSON de la base (sólo lectura), en
<carpeta de fuentes>/ma/<archivo>.json. Sólo usa la API de core.py."""
import datetime
import json
import os

GRUPO_A = 'A · Movimientos del ejercicio'
GRUPO_B = 'B · Saldos al cierre (30/06/2026)'
GRUPO_C = 'C · Cuentas entre empresas y socios'
GRUPO_D = 'D · Referencia'
ENCABEZADO = 'MA — Ítems del cierre 25/26'
EJERCICIO = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
             '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
TC_FMT = '#,##0.00_);\\(#,##0.00\\);"-"??_);@_)'


def leer(src, archivo):
    ruta = os.path.join(src.carpeta, 'ma', archivo + '.json')
    if not os.path.exists(ruta):
        raise SystemExit(f"Falta el extracto de MA: {ruta}")
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def ar(x, dec=2):
    """Número en formato es-AR: 1.234.567,89"""
    return f"{x:,.{dec}f}".replace(',', '§').replace('.', ',').replace('§', '.')


def fecha(s):
    """'2026-06-17' -> date (None si viene vacío)."""
    if not s:
        return None
    return datetime.date(int(s[0:4]), int(s[5:7]), int(s[8:10]))


def dma(s):
    f = fecha(s)
    return f.strftime('%d/%m/%Y') if f else 's/fecha'


def mes_largo(m):
    """'2025-07' -> 'julio 2025'"""
    return f"{MESES[int(m[5:7]) - 1]} {m[0:4]}"


def hoja(lib, nombre, anchos, horizontal=True):
    if sum(anchos) > 150:
        raise SystemExit(f"{nombre}: los anchos suman {sum(anchos)} (máximo 150)")
    h = lib.hoja(nombre, anchos, horizontal)
    h.ws.oddHeader.right.text = '&"Arial,Italic"&8' + ENCABEZADO
    return h


def pon(h, c, r, v):
    """Reemplaza el valor de una celda ya escrita (conserva el formato)."""
    h.celda(c, r).value = v


def alto(h, r, valores, comb=None):
    """Alto del renglón según el texto más largo (comb = {col_desde: col_hasta} ya combinadas)."""
    lineas = 1
    for i, v in enumerate(valores):
        if isinstance(v, str) and not v.startswith('='):
            c1 = i + 1
            c2 = (comb or {}).get(c1, c1)
            ancho = sum(h.ws.column_dimensions[h.col(k)].width for k in range(c1, c2 + 1))
            lineas = max(lineas, -(-len(v) // max(4, int(ancho * 1.05))))
    if lineas > 1:
        h.ws.row_dimensions[r].height = 13 * lineas


def fila(h, valores, comb=None, negrita=False, fmt=None):
    """h.fila + celdas combinadas para los textos largos (comb = {col_desde: col_hasta}) + alto del renglón."""
    r = h.fila(valores, negrita=negrita, fmt=fmt)
    for c1, c2 in (comb or {}).items():
        if c2 > c1:
            h.ws.merge_cells(start_row=r, start_column=c1 + 1, end_row=r, end_column=c2 + 1)
    alto(h, r, valores, comb)
    return r


def cerca(a, b, tol=0.005):
    return abs(a - b) <= tol
