# -*- coding: utf-8 -*-
"""Prueba UN módulo de detalle suelto:  python -P probar.py d_ventas <carpeta_fuentes> <salida.xlsx>

Arma un libro sólo con ese módulo, lo guarda y lista los ítems, controles y pendientes que registró.
Además revisa que ninguna fórmula filtre (SUMIFS, SUMPRODUCT, COUNTIF…): el protocolo lo prohíbe."""
import importlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # con «python -P» la carpeta del script no entra sola

from core import Fuentes, Libro

sys.stdout.reconfigure(encoding="utf-8")
mod, carpeta, salida = sys.argv[1], sys.argv[2], sys.argv[3]
lib = Libro()
importlib.import_module(mod).construir(lib, Fuentes(carpeta))
lib.wb.save(salida)
malas = 0
for h in lib.hojas:
    n = 0
    for row in h.ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.startswith("="):
                n += 1
                if re.search(r"SUMIFS?|SUMPRODUCT|COUNTIFS?|SUBTOTAL|VLOOKUP|INDEX|MATCH", c.value, re.I):
                    malas += 1
                    print("  FORMULA QUE FILTRA:", h.nombre, c.coordinate, c.value[:80])
    print(f"hoja «{h.nombre}»: {h.r} renglones, {n} fórmulas, {h.ncols} columnas")
for i in lib.items:
    print("ítem", i["n"], "|", i["nombre"], "|", i["hoja"], i["celda"], "|", i["grupo"], "| contador 24/25:", i["contador"])
for c in lib.controles:
    print("control:", c[0], "→", c[2])
for p in lib.pendientes:
    print("pendiente:", p[0], "—", p[1][:100])
print("fórmulas que filtran:", malas, "· guardado en", salida)
