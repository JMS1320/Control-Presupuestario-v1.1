# -*- coding: utf-8 -*-
"""PAM (Sucesión de Plácido Alberto Martínez) — piezas comunes de los módulos e_pam_*.

Los datos salen de extractos JSON de la base (sólo lectura), en <carpeta de fuentes>/pam/*.json. No van al repo.
Sólo usa la API de core.py."""
import datetime
import json
import os

EJERCICIO = '01/07/2025 al 30/06/2026'
G_MOV = 'A · Movimientos del ejercicio'
G_SALDOS = 'B · Saldos al cierre (30/06/2026)'
G_CUENTAS = 'C · Cuentas entre empresas y socios'
G_REF = 'D · Referencia'
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']


def cargar(src, nombre):
    ruta = os.path.join(src.carpeta, 'pam', nombre + '.json')
    if not os.path.exists(ruta):
        raise SystemExit(f'Falta el extracto de PAM: {ruta}')
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def fch(s):
    """'2025-08-19' -> datetime.date (None si no hay)."""
    if not s:
        return None
    return datetime.date(int(s[0:4]), int(s[5:7]), int(s[8:10]))


def dma(s):
    d = fch(s)
    return d.strftime('%d/%m/%Y') if d else 's/f'


def ar(x, dec=2):
    s = f'{abs(x):,.{dec}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return ('−' if x < 0 else '') + s


def mes_txt(clave):
    """'2025-07' -> 'julio 2025'."""
    return f'{MESES[int(clave[5:7]) - 1]} {clave[0:4]}'


def hoja(lib, nombre, anchos):
    """Hoja horizontal con el encabezado de página de PAM (core pone el de MSA)."""
    h = lib.hoja(nombre, anchos, horizontal=True)
    h.ws.oddHeader.right.text = '&"Arial,Italic"&8PAM — Ítems del balance 25/26 (borrador)'
    return h


def refs(lib):
    """Celdas que un módulo de PAM deja a disposición de los otros (D12 las vincula). Vive en el libro."""
    if not hasattr(lib, 'pam_refs'):
        lib.pam_refs = {}
    return lib.pam_refs


def fila(h, valores, comb=None, negrita=False, fmt=None):
    """h.fila + celdas combinadas para textos (comb = {col_desde: col_hasta}) + alto del renglón según el texto."""
    r = h.fila(valores, negrita=negrita, fmt=fmt)
    for c1, c2 in (comb or {}).items():
        if c2 > c1:
            h.ws.merge_cells(start_row=r, start_column=c1 + 1, end_row=r, end_column=c2 + 1)
    lineas = 1
    for i, v in enumerate(valores):
        if isinstance(v, str) and not v.startswith('='):
            c1 = i + 1
            c2 = (comb or {}).get(c1, c1)
            ancho = sum(h.ws.column_dimensions[h.col(k)].width for k in range(c1, c2 + 1))
            lineas = max(lineas, -(-len(v) // max(4, int(ancho))))
    if lineas > 1:
        h.ws.row_dimensions[r].height = 13 * lineas
    return r


def control(h, descripcion, celda, valor, fuente):
    """h.control con el texto combinado a lo ancho (no se monta sobre los importes)."""
    from openpyxl.styles import Alignment
    r = h.control(descripcion, celda, valor, fuente)
    fin = h.ncols - 3
    if fin > 1:
        h.ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=fin + 1)
    x = h.celda(1, r)
    x.alignment = Alignment(wrap_text=True, vertical='top')
    ancho = sum(h.ws.column_dimensions[h.col(k)].width for k in range(1, fin + 1))
    h.ws.row_dimensions[r].height = 12.5 * max(1, -(-len(str(x.value)) // max(10, int(ancho * 1.15))))
    return r
