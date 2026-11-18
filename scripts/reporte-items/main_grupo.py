# -*- coding: utf-8 -*-
"""Reporte de las tres empresas, primer paso — «Grupo 25-26 — Cuentas entre MSA, MA y PAM (borrador)»:
    python -P main_grupo.py <carpeta_fuentes> <carpeta_salida> <version>

Arma el libro con `g_cuentas_grupo.construir` (matriz de saldos, un detalle por par, gastos cruzados, Libertad y sueldos) y
reusa de `main.py` los pendientes, los controles, el link para volver al índice y el pulido, igual que `main_empresa.py`.
Genera dos Excel: presentación y «con controles». Sólo lee: los exports de la app y los extractos JSON (fuera del repo)."""
import importlib
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import core  # noqa: E402
import main as base  # noqa: E402  (pendientes, controles, volver al índice y pulido)

TITULO = 'Grupo 25/26 — Cuentas entre MSA, MA y PAM (borrador)'
ARCHIVO = 'Grupo 25-26 - Cuentas entre MSA, MA y PAM (borrador)'


def indice(lib, h):
    h.titulo('Grupo 25/26 — Cuentas entre MSA, MA y PAM — ejercicio 01/07/2025 al 30/06/2026 — BORRADOR')
    h.nota('Primer paso del reporte de las tres empresas: lo que cada una dice de las otras, lado a lado, con la diferencia. La hoja '
           '«Matriz» resume los tres pares; G1 a G3 muestran cómo se forma cada saldo, por tipo de movimiento y por mes, con cada '
           'movimiento debajo; G4 a G6 son los movimientos que cruzan empresas (gastos de una pagados por otra, Libertad, sueldos). '
           'No decide nada: lo que falta definir está en la hoja Pendientes. Importes en pesos.')
    h.blanco()
    h.encabezado(['N°', 'Ítem', 'Composición / criterio', 'Importe', '', '', '', 'Hoja de detalle'], repetir=True)
    grupo = None
    for it in lib.items:
        if it['grupo'] != grupo:
            grupo = it['grupo']
            h.r += 1
            for c in range(1, h.ncols + 1):
                h.celda(c, h.r).fill = core.R_GRUPO
            h._pon(1, h.r, grupo, core.F_B)
        sub = not it['n'].isdigit()
        r = h.fila([it['n'], it['nombre'], it['composicion'] or None,
                    (f"='{it['hoja']}'!{it['celda']}" if it['celda'] else None)], negrita=not sub, sangria=1 if sub else 0)
        if it['celda']:
            h.celda(4, r).fill = core.R_CLAVE
        x = h._pon(8, r, it['hoja'], core.F_LINK)
        x.hyperlink = f"#'{it['hoja']}'!{it['celda'] or 'A1'}"
        largo = max(len(it['composicion'] or ''), len(it['nombre']) * 50 // 44)
        h.ws.row_dimensions[r].height = 16 if largo <= 48 else (30 if largo <= 100 else 44)
    r = h.fila([None, 'Resumen de los tres pares, lado a lado', 'los ítems 1, 2 y 3 en una sola tabla, con sus controles'])
    x = h._pon(8, r, 'Matriz', core.F_LINK)
    x.hyperlink = "#'Matriz'!A1"


def main():
    carpeta, salida, version = sys.argv[1], sys.argv[2], sys.argv[3]
    sys.stdout.reconfigure(encoding='utf-8')
    core.TITULO_REPORTE = TITULO
    src = core.Fuentes(carpeta)
    lib = core.Libro()
    h_items = lib.hoja('Items', [6, 44, 48, 19, 4, 4, 4, 21], horizontal=True)
    antes = len(lib.hojas)
    try:
        importlib.import_module('g_cuentas_grupo').construir(lib, src)
        print(f'g_cuentas_grupo: ok ({len(lib.hojas) - antes} hoja/s)')
    except Exception as e:  # el libro sale igual, con el hueco a la vista
        print(f'g_cuentas_grupo: FALLÓ — {e}')
        traceback.print_exc()
        for hx in lib.hojas[antes:]:
            lib.wb.remove(hx.ws)
        del lib.hojas[antes:]
        lib.items, lib.controles = [], []
        lib.pendiente('Detalle que falló al armarse: cuentas entre las tres empresas', str(e)[:200], '', '')

    def orden(it):
        n = it['n']
        i = 0
        while i < len(n) and n[i].isdigit():
            i += 1
        return (int(n[:i] or 0), n[i:])

    lib.items.sort(key=orden)
    indice(lib, h_items)
    hp = base.hoja_pendientes(lib)
    hc = base.hoja_controles(lib)
    for hx, anchos in ((hp, [5, 30, 72, 22, 21]), (hc, [5, 56, 22, 17, 12, 38])):  # como en main.py, llevados a 150 de ancho
        for i, a in enumerate(anchos):
            hx.ws.column_dimensions[hx.col(i + 1)].width = a
    for r in range(1, hp.ws.max_row + 1):  # alto de cada pendiente según su texto más largo
        largos = [len(str(hp.celda(c, r).value or '')) / a for c, a in ((2, 30), (3, 72), (4, 22), (5, 21))]
        if hp.celda(1, r).value is not None and isinstance(hp.celda(1, r).value, int):
            hp.ws.row_dimensions[r].height = 13 * max(1, int(max(largos) * 0.95) + 1)
    base.volver_al_indice(lib)
    base.pulir(lib)
    os.makedirs(salida, exist_ok=True)
    ruta = os.path.join(salida, f'{ARCHIVO} {version}')
    lib.wb.save(ruta + ' - con controles.xlsx')
    lib.wb.remove(lib.wb['Controles'])
    for hx in lib.hojas:
        hx.ocultar_controles()
    lib.wb.save(ruta + '.xlsx')
    print('ítems:', len(lib.items), '· controles:', len(lib.controles), '· pendientes:', len(lib.pendientes))
    print('guardado:', ruta + '.xlsx')


if __name__ == '__main__':
    main()
