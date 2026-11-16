# -*- coding: utf-8 -*-
"""Reporte de ítems de MA o de PAM (borrador):  python -P main_empresa.py MA|PAM <carpeta_fuentes> <carpeta_salida> <version>

Junta los módulos `e_ma_*.py` / `e_pam_*.py` (datos leídos de la base, sólo lectura, guardados como JSON fuera del repo)
y los templates de esa empresa (`d_templates.construir_empresa`). Mismo armazón, índice, pendientes y controles que MSA."""
import glob
import importlib
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import core  # noqa: E402
import main as base  # noqa: E402  (se reusa el índice, los pendientes, los controles y el pulido)

NOMBRES = {"MA": "Mercedes Areco (MA)", "PAM": "Sucesión de Plácido Martínez (PAM)"}


def indice(lib, h, empresa):
    h.titulo(f"{NOMBRES[empresa]} — Ítems 25/26 (01/07/2025 al 30/06/2026) — BORRADOR")
    h.nota("Borrador armado con lo que el sistema tiene cargado de esta empresa: cada ítem tiene su hoja de detalle, donde el total "
           "se forma con los renglones que están a la vista debajo. No es un balance cerrado: lo que falta definir o cargar está en "
           "la hoja Pendientes. Importes en pesos, salvo donde la hoja diga US$.")
    h.blanco()
    h.encabezado(["N°", "Ítem", "Composición / criterio", "Importe", "", "", "", "Hoja de detalle"], repetir=True)
    grupo = None
    for it in lib.items:
        if it["grupo"] != grupo:
            grupo = it["grupo"]
            h.r += 1
            for c in range(1, h.ncols + 1):
                h.celda(c, h.r).fill = core.R_GRUPO
            h._pon(1, h.r, grupo, core.F_B)
        sub = not it["n"].isdigit()
        r = h.fila([it["n"], it["nombre"], it["composicion"] or None,
                    (f"='{it['hoja']}'!{it['celda']}" if it["celda"] else None)], negrita=not sub, sangria=1 if sub else 0)
        if it["celda"]:
            h.celda(4, r).fill = core.R_CLAVE
        x = h._pon(8, r, it["hoja"], core.F_LINK)
        x.hyperlink = f"#'{it['hoja']}'!A1"
        h.ws.row_dimensions[r].height = 30 if (it["composicion"] and len(it["composicion"]) > 48) else 16


def main():
    empresa, carpeta, salida, version = sys.argv[1].upper(), sys.argv[2], sys.argv[3], sys.argv[4]
    core.TITULO_REPORTE = f"{empresa} — Ítems 25/26 (borrador)"
    src = core.Fuentes(carpeta)
    lib = core.Libro()
    h_items = lib.hoja("Items", [6, 44, 50, 19, 4, 4, 4, 22], horizontal=True)
    aqui = os.path.dirname(os.path.abspath(__file__))
    mods = sorted(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(aqui, f"e_{empresa.lower()}_*.py")))
    mods = [m for m in mods if hasattr(importlib.import_module(m), "construir")]  # los auxiliares (e_ma_comun…) no son hojas
    pasos = [(m, lambda m=m: importlib.import_module(m).construir(lib, src)) for m in mods]
    pasos.append(("templates", lambda: importlib.import_module("d_templates").construir_empresa(lib, src, empresa)))
    for nombre, paso in pasos:
        antes = len(lib.hojas)
        try:
            paso()
            print(f"{nombre}: ok ({len(lib.hojas) - antes} hoja/s)")
        except Exception as e:  # el reporte sale igual, con el hueco a la vista
            print(f"{nombre}: FALLÓ — {e}")
            traceback.print_exc()
            for hx in lib.hojas[antes:]:
                lib.wb.remove(hx.ws)
            del lib.hojas[antes:]
            vivas = [x.nombre for x in lib.hojas]
            lib.items = [i for i in lib.items if i["hoja"] in vivas]
            lib.controles = [c for c in lib.controles if c[1] in vivas]
            lib.pendiente(f"Detalle que falló al armarse: {nombre}", str(e)[:200], "", "")

    def orden(it):
        n = it["n"]
        i = 0
        while i < len(n) and n[i].isdigit():
            i += 1
        return (int(n[:i] or 0), n[i:])

    lib.items.sort(key=orden)
    # las hojas, en el orden de los ítems (D1, D2, D3…): se reordenan por el número del nombre
    def clave_hoja(ws):
        t = ws.title
        if t == "Items":
            return (0, 0, "")
        if t.startswith("D"):
            num = t[1:].split(" ")[0]
            partes = num.split(".")
            try:
                return (1, int(partes[0]) * 100 + (int(partes[1]) if len(partes) > 1 else 0), t)
            except ValueError:
                pass
        return (2, 0, t)

    lib.wb._sheets.sort(key=clave_hoja)
    indice(lib, h_items, empresa)
    base.hoja_pendientes(lib)
    base.hoja_controles(lib)
    base.pulir(lib)
    os.makedirs(salida, exist_ok=True)
    ruta = os.path.join(salida, f"{empresa} 25-26 - Items (borrador) {version}")
    lib.wb.save(ruta + " - con controles.xlsx")
    lib.wb.remove(lib.wb["Controles"])
    lib.wb.save(ruta + ".xlsx")
    print("ítems:", len(lib.items), "· controles:", len(lib.controles), "· pendientes:", len(lib.pendientes))
    print("guardado:", ruta + ".xlsx")


if __name__ == "__main__":
    main()
