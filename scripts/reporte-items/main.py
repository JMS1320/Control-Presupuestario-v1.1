# -*- coding: utf-8 -*-
"""Arma el reporte de ítems completo:  python -P main.py <carpeta_fuentes> <carpeta_salida> <version>

Genera dos Excel: «presentación» (índice, detalles, pendientes) y «con controles» (suma la hoja Controles).
El PDF se saca después imprimiendo el de presentación con Excel (pdf.ps1)."""
import copy
import importlib
import os
import sys
import traceback

from openpyxl.styles import Alignment, Border
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.utils.cell import coordinate_from_string

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # con «python -P» la carpeta del script no entra sola

from core import (CAJA, ENTERO, F_B, F_LINK, F_NOTA, MONEDA, R_CLAVE, R_GRUPO, Fuentes, Libro, num)

sys.stdout.reconfigure(encoding="utf-8")
MODULOS = ["d_ventas", "d_compras", "d_templates", "d_sueldos", "d_caja_bancos", "d_a_cobrar", "d_hacienda",
           "d_granos_insumos", "d_a_pagar", "d_socios"]
GRUPO_REF = "D · Referencia (no interviene)"

# Renglón del balance del contador -> ítem nuestro que le corresponde (sólo donde es claro).
ITEM_DE_LA_CUENTA = {
    "1.1.1/01/01": "5f", "1.1.1/02/01": "5b", "1.1.1/02/02": "5c", "1.1.1/02/03": "9b",
    "1.1.1/02/06": "5e", "1.1.1/02/07": "5a", "1.1.1/02/09": "5d", "1.1.4/02/02": "9c", "1.1.4/02/05": "10d",
    "1.1.5/02/00": "8a", "1.2.2/05/01": "7", "1.2.5/01/04": "8c", "2.1.1/01/01": "9a", "2.1.1/01/04": "9d",
    "2.1.1/01/10": "9e", "2.1.2/02/01": "9f", "4.1.1/01/01": "1a", "4.1.1/01/02": "1b", "4.1.1/01/03": "1c",
    "4.2.1/03/01": "4", "4.2.1/03/02": "3f1", "4.2.1/03/18": "3b", "4.2.1/03/22": "2", "4.2.1/03/23": "2",
    "4.2.1/06/02": "3f2", "4.2.1/06/04": "3g1", "4.2.1/06/05": "3g2", "4.2.1/06/09": "3d",
}


def caja_para_anotar(h, c, r):
    x = h.celda(c, r)
    x.border = Border(top=CAJA, bottom=CAJA, left=CAJA, right=CAJA)
    x.number_format = MONEDA


def balance_contador(lib, src):
    """D11 — el balance del contador del año anterior, renglón por renglón, con lugar para anotar el de este año."""
    ws = src.hoja("Balance en l", "Balance en linea")
    h = lib.hoja("D11 Balance contador", [13, 13, 44, 18, 18, 9, 18, 18], horizontal=True)
    h.titulo("Detalle 11 — Balance del contador 24/25, renglón por renglón (referencia)")
    h.nota("Fuente: " + src.nombre("Balance en l") + " → «F · Balance en linea». Es el balance que entregó el contador al 30/06/2025, "
           "en su formato y con su signo (activo positivo; pasivo, patrimonio y ganancias negativos). «Cierre según la app» es lo que "
           "el sistema puede decir hoy de ese renglón; vacío = lo da el contador. La columna «Contador 25/26» es para anotar a mano "
           "el número que dé en la reunión; la diferencia se calcula sola contra el cierre de la app.")
    h.blanco()
    filas_cap = {}
    cap_actual = None
    ini = None
    totales_fuente = {}
    for row in ws.iter_rows(min_row=6, values_only=True):
        cap, cuenta, den, aper, cierre = row[0], row[1], row[2], row[3], row[4]
        if den and str(den).startswith("Total "):
            totales_fuente[cap_actual] = num(aper)
            continue
        if not cap or not cuenta:
            continue
        if cap != cap_actual:
            if cap_actual is not None:
                filas_cap[cap_actual] = (ini, h.r)
                t = h.total(f"Total {cap_actual} (contador 24/25)", {4: h.suma(4, ini, h.r)})
                filas_cap[cap_actual] += (t,)
                h.blanco()
            cap_actual = cap
            h.seccion(str(cap))
            h.encabezado(["Cuenta", "Ítem nuestro", "Denominación", "Contador 24/25", "Cierre 25/26 según la app",
                          "Ítem", "Contador 25/26 (anotar)", "Diferencia"], repetir=True)
            ini = h.r + 1
        it = ITEM_DE_LA_CUENTA.get(str(cuenta).strip(), "")
        r = h.fila([str(cuenta), ("ítem " + it) if it else "—", str(den), num(aper),
                    float(cierre) if isinstance(cierre, (int, float)) else None, it or None])
        caja_para_anotar(h, 7, r)
        h._pon(8, r, f'=IF({h.cel(7, r)}="","",{h.cel(7, r)}-{h.cel(5, r)})', fmt=MONEDA)
    if cap_actual is not None:
        t = h.total(f"Total {cap_actual} (contador 24/25)", {4: h.suma(4, ini, h.r)})
        filas_cap[cap_actual] = (ini, h.r - 1, t)
    h.blanco()
    for cap, v in filas_cap.items():
        if cap in totales_fuente:
            h.control(f"total {cap} del balance del contador", h.cel(4, v[2]), totales_fuente[cap], "Balance en línea")
    lib.item("11", "Balance del contador 24/25, renglón por renglón", h, None, GRUPO_REF,
             "Referencia: el formato en que habla el contador, con lugar para anotar su número 25/26")


def balance_propio(lib, src):
    """D12 — el balance propio (activo − pasivo en US$), como hoja informativa."""
    ws = src.libro("Balance propio", "bp")["Balance propio"]
    h = lib.hoja("D12 Balance propio", [46, 17, 17, 17, 13, 13, 13, 34], horizontal=True)
    h.titulo("Detalle 12 — Balance propio de MSA: activo menos pasivo, en $ y en US$ (informativo)")
    tc25, tc26 = num(ws["B3"].value), num(ws["C3"].value)
    h.nota("Fuente: " + src.nombre("Balance propio", "bp") + " → «Balance propio». Análisis económico propio, distinto del balance del "
           f"contador. Dólar de cada punta: {tc25:,.2f} al 30/06/2025 y {tc26:,.2f} al 30/06/2026 (BNA divisas, promedio). "
           "Cada subtotal suma sus renglones; la ganancia es la diferencia en US$ del activo menos el pasivo.")
    h.blanco()
    enc = ["Concepto", "$ 30/06/2025", "$ 30/06/2026", "Diferencia $", "US$ 2025", "US$ 2026", "Diferencia US$", "Papel de trabajo"]
    sub_act, sub_pas = [], []
    ini = None
    lado = None
    for row in ws.iter_rows(min_row=6, max_row=78, values_only=True):
        a = row[0]
        if not a:
            continue
        a = str(a)
        if row[1] is None and "(" in a and a.upper() == a.split("(")[0].upper() + "(" + a.split("(", 1)[1]:
            pass
        if row[1] is None:  # título de rubro
            h.blanco()
            h.seccion(a)
            h.encabezado(enc)
            ini = h.r + 1
            lado = "pas" if "pasivo" in a.lower() else "act"
            continue
        if a.startswith("Subtotal"):
            f = {c: h.suma(c, ini, h.r) for c in (2, 3, 4, 5, 6, 7)}
            t = h.total(a, f)
            (sub_pas if lado == "pas" else sub_act).append(t)
            continue
        r = h.fila([a, num(row[1]), num(row[2]), None, num(row[4]), num(row[5]), None,
                    str(row[8]).replace("📄 ", "") if row[8] else None])
        h._pon(4, r, f"={h.cel(3, r)}-{h.cel(2, r)}")
        h._pon(7, r, f"={h.cel(6, r)}-{h.cel(5, r)}")
    h.blanco()
    ta = h.total("ACTIVO", {c: h.suma_de(c, sub_act) for c in (2, 3, 4, 5, 6, 7)})
    tp = h.total("PASIVO", {c: h.suma_de(c, sub_pas) for c in (2, 3, 4, 5, 6, 7)})
    tg = h.total("ACTIVO MENOS PASIVO — la diferencia en US$ es la GANANCIA TOTAL",
                 {c: f"={h.cel(c, ta)}-{h.cel(c, tp)}" for c in (2, 3, 4, 5, 6, 7)}, clave=True)
    h.blanco()
    h.control("ganancia total en US$ del balance propio", h.cel(7, tg), num(ws["G87"].value), "Balance propio → G87", tolerancia=0.05)
    # de la ganancia total a la líquida
    wg = src.libro("Balance propio", "bp")["Ganancia desglosada"]
    h.blanco()
    h.seccion("De la ganancia total a la plata para distribuir (US$)")
    h.encabezado(["Paso", None, None, None, None, None, "US$", "Qué es"])
    pasos = []
    for row in wg.iter_rows(min_row=4, max_row=11, values_only=True):
        if not row[0] or "control" in str(row[0]).lower():
            continue
        etiqueta, v, que = str(row[0]).strip(), num(row[1]), (str(row[2]) if row[2] else None)
        if etiqueta.startswith("="):
            etiqueta = "Resultado: " + etiqueta.lstrip("= ")
            prev = pasos[-1]
            base = pasos[-2] if len(pasos) > 1 else None
            f = f"={h.cel(7, base)}+{h.cel(7, prev)}" if base else f"={h.cel(7, prev)}"
            r = h.total(etiqueta, {7: f})
            if que:
                h._pon(8, r, que, F_NOTA)
            pasos = [r]
        elif etiqueta.startswith("Ganancia total"):
            r = h.fila([etiqueta, None, None, None, None, None, f"={h.cel(7, tg)}", que])
            pasos = [r]
        else:
            r = h.fila([etiqueta, None, None, None, None, None, v, que])
            pasos.append(r)
    lib.item("12", "Balance propio: ganancia total en US$", h, h.cel(7, tg), GRUPO_REF,
             "Análisis propio (activo − pasivo); el resultado contable lo da el contador")
    lib.pendiente("Balance propio — control de socios", "En el Excel del balance propio, solapa «Socios», lo que se llevaron los "
                  "cuatro socios suma $ 61.094.765,00 y el renglón «Distribución de fondos» dice $ 64.623.846,86.",
                  "$ 3.529.082,00 de diferencia", "D12 Balance propio · D10 Socios")


def indice(lib, h):
    h.titulo("MSA — Ítems del balance 25/26 (01/07/2025 al 30/06/2026)")
    h.nota("Cada ítem tiene su hoja de detalle, donde el total se forma con los renglones que están a la vista debajo. "
           "«Contador 24/25» es el renglón comparable del balance del año anterior (referencia). «Contador 25/26» es para anotar a "
           "mano el número que dé el contador; la diferencia se calcula sola. Importes en pesos, salvo el ítem 12 (US$).")
    h.blanco()
    h.encabezado(["N°", "Ítem", "Composición / criterio", "Importe 25/26 (nuestro)", "Contador 24/25 (referencia)",
                  "Contador 25/26 (anotar)", "Diferencia", "Hoja de detalle"], repetir=True)
    grupo = None
    for it in lib.items:
        if it["grupo"] != grupo:
            grupo = it["grupo"]
            h.r += 1
            for c in range(1, h.ncols + 1):
                h.celda(c, h.r).fill = R_GRUPO
            x = h._pon(1, h.r, grupo, F_B)
            x.font = copy.copy(F_B)
        sub = not it["n"].isdigit()
        r = h.fila([it["n"], it["nombre"], it["composicion"] or None,
                    (f"='{it['hoja']}'!{it['celda']}" if it["celda"] else None),
                    float(it["contador"]) if it["contador"] is not None else None], negrita=not sub, sangria=1 if sub else 0)
        if it["celda"]:
            h.celda(4, r).fill = R_CLAVE
            caja_para_anotar(h, 6, r)
            h._pon(7, r, f'=IF({h.cel(6, r)}="","",{h.cel(6, r)}-{h.cel(4, r)})', fmt=MONEDA)
        x = h._pon(8, r, it["hoja"], F_LINK)
        x.hyperlink = f"#'{it['hoja']}'!A1"
        h.ws.row_dimensions[r].height = 30 if (it["composicion"] and len(it["composicion"]) > 48) else 16


def hoja_pendientes(lib):
    h = lib.hoja("Pendientes", [5, 34, 78, 26, 24], horizontal=True)
    h.titulo("Pendientes — lo que no cierra, falta definir o hay que revisar")
    h.nota("Nada se descartó en silencio: lo que un detalle no pudo verificar o encontró raro está acá, con la hoja donde se ve.")
    h.blanco()
    h.encabezado(["N°", "Tema", "Detalle", "Impacto", "Dónde se ve"], repetir=True)
    for i, p in enumerate(lib.pendientes, 1):
        h.fila([i, p[0], p[1], p[2] or None, p[3] or None])
    return h


def hoja_controles(lib):
    h = lib.hoja("Controles", [5, 62, 24, 17, 12, 44], horizontal=True)
    h.titulo("Controles — cada total del reporte contra el export de la app")
    h.nota("Diferencia = lo que suma la hoja del reporte menos el total del export de origen. El estado es el de la propia hoja: "
           "tolerancia de 1 centavo, salvo hacienda (hasta $ 1 a precio de cierre y $ 15 en la interna: el papel de origen redondea "
           "precios y kilos). Estado general abajo.")
    h.blanco()
    h.encabezado(["N°", "Control", "Hoja", "Diferencia", "Estado", "Fuente"], repetir=True)
    ini = h.r + 1
    for i, c in enumerate(lib.controles, 1):
        r = h.fila([i, c[0], c[1], f"={c[2]}", None, c[3]])
        hoja_ref, celda_ref = c[2].rsplit("!", 1)
        col, fila_ref = coordinate_from_string(celda_ref)
        estado = f"{hoja_ref}!{get_column_letter(column_index_from_string(col) + 1)}{fila_ref}"  # el OK/REVISAR de la propia hoja (con su tolerancia)
        h._pon(5, r, f"={estado}", F_B)
    fin = h.r
    h.blanco()
    rango = f"{h.cel(5, ini)}:{h.cel(5, fin)}"
    r = h.total("ESTADO GENERAL", {5: f'=IF(COUNTIF({rango},"REVISAR")=0,"OK","REVISAR")'}, clave=True)
    h._pon(2, r, f'=COUNTIF({rango},"OK")&" de "&COUNTA({rango})&" controles OK"', F_B)
    return h


# Versión corta para imprimir (JMS 16/11: «¿a cuánto se podría achicar? ¿20/30 hojas?»): las mismas hojas, pero de cada una se
# imprime sólo el resumen (hasta la sección que se nombra, sin incluirla). El renglón por renglón queda en el PDF completo.
# Valor: lista de (desde, hasta) donde cada punta es None (principio / fin de la hoja) o el comienzo del título de una sección.
RESUMEN_IMPRESION = {
    "Items": [(None, None)],
    "D1 Ventas": [(None, "DETALLE")],
    "D2 Compras": [(None, "Compras por mes — 1er semestre")],
    "D3 Templates": [(None, "Fuera de estos totales")],
    "D4 Sueldos": [(None, "2 · DEVENGADO")],
    "D5 Caja y bancos": [(None, "5a · Banco Galicia")],
    "D7 Hacienda": [(None, "1.1 ·"), ("2 · Valorizado", "2.1 ·")],
    "D8 Granos insumos": [(None, "8a.1 ·")],
    "D9 A pagar": [(None, "9a.2.1 ·"), ("Resumen del ítem 9", None)],
    "D10 Socios": [(None, "4 · Detalle")],
    "D11 Balance contador": [(None, None)],
    "Enviado vs hoy": [(None, None)],
    "No informado": [(None, "1 · ")],
}


def version_corta(lib):
    """Deja en cada hoja de RESUMEN_IMPRESION el área de impresión del resumen. Devuelve las hojas que se imprimen, en orden."""
    from openpyxl.utils import get_column_letter as _L
    hojas = []
    for ws in lib.wb.worksheets:
        tramos = RESUMEN_IMPRESION.get(ws.title)
        if not tramos:
            continue
        titulos = {}
        for r in range(1, ws.max_row + 1):
            v = ws.cell(row=r, column=2).value
            if isinstance(v, str) and ws.cell(row=r, column=2).font.underline:
                titulos[r] = v
        ultima = _L(ws.max_column)
        areas = []
        for desde, hasta in tramos:
            r1 = 1 if desde is None else next((r for r, t in titulos.items() if t.startswith(desde)), None)
            r2 = ws.max_row if hasta is None else next((r - 1 for r, t in titulos.items() if t.startswith(hasta) and r > (r1 or 0)), None)
            if r1 is None or r2 is None:
                print(f"  versión corta: no encontré el tramo {desde!r} → {hasta!r} en «{ws.title}»: se imprime entera")
                areas = [f"A1:{ultima}{ws.max_row}"]
                break
            while r2 > r1 and all(ws.cell(row=r2, column=c).value is None for c in range(1, ws.max_column + 1)):
                r2 -= 1
            areas.append(f"A{r1}:{ultima}{r2}")
        ws.print_area = ",".join(areas)
        ws.row_breaks.brk = []
        hojas.append(ws.title)
    return hojas


def pulir(lib):
    """Pulido de impresión, igual para todas las hojas:
    · un número que no entra en su columna se achica en vez de salir como #####;
    · los encabezados de tabla toman el alto que necesita su texto."""
    from openpyxl.utils import get_column_letter as _L
    for ws in lib.wb.worksheets:
        combinadas = set()
        for rango in ws.merged_cells.ranges:
            for fila in ws.iter_rows(min_row=rango.min_row, max_row=rango.max_row, min_col=rango.min_col, max_col=rango.max_col):
                for c in fila:
                    combinadas.add(c.coordinate)
        for fila in ws.iter_rows():
            alto = 0
            for c in fila:
                v = c.value
                if v is None:
                    continue
                es_num = isinstance(v, (int, float)) and not isinstance(v, bool)
                es_formula = isinstance(v, str) and v.startswith("=")
                if (es_num or es_formula) and not c.alignment.wrap_text:
                    al = copy.copy(c.alignment)
                    al.shrink_to_fit = True
                    c.alignment = al
                if isinstance(v, str) and not es_formula and c.fill is not None and c.fill.fgColor is not None \
                        and str(c.fill.fgColor.rgb).endswith("DCE6F1") and c.coordinate not in combinadas:
                    ancho = ws.column_dimensions[_L(c.column)].width or 10
                    lineas = max(len(parte) for parte in [v]) / max(4.0, ancho * 0.95)
                    alto = max(alto, 14 * (int(lineas) + 1) + 4)
            if alto:
                actual = ws.row_dimensions[fila[0].row].height or 0
                ws.row_dimensions[fila[0].row].height = max(actual, min(alto, 74))


def main():
    carpeta, salida, version = sys.argv[1], sys.argv[2], sys.argv[3]
    src = Fuentes(carpeta)
    lib = Libro()
    h_items = lib.hoja("Items", [6, 44, 50, 19, 19, 19, 17, 22], horizontal=True)
    for m in MODULOS:
        antes = len(lib.hojas)
        try:
            importlib.import_module(m).construir(lib, src)
            print(f"{m}: ok ({len(lib.hojas) - antes} hoja/s)")
        except ModuleNotFoundError:
            print(f"{m}: TODAVÍA NO EXISTE")
            lib.pendiente(f"Detalle sin armar: {m}", "El módulo de este detalle no estaba listo al generar esta versión.", "", "")
        except Exception as e:  # el reporte sale igual, con el hueco a la vista
            print(f"{m}: FALLÓ — {e}")
            traceback.print_exc()
            for hx in lib.hojas[antes:]:
                lib.wb.remove(hx.ws)
            del lib.hojas[antes:]
            lib.items = [i for i in lib.items if i["hoja"] in [x.nombre for x in lib.hojas]]
            lib.controles = [c for c in lib.controles if c[1] in [x.nombre for x in lib.hojas]]
            lib.pendiente(f"Detalle que falló al armarse: {m}", str(e)[:200], "", "")
    balance_contador(lib, src)
    balance_propio(lib, src)
    importlib.import_module("d_enviado").construir(lib, src)
    importlib.import_module("d_no_informado").construir(lib, src)

    def orden(it):
        n = it["n"]
        i = 0
        while i < len(n) and n[i].isdigit():
            i += 1
        return (int(n[:i] or 0), n[i:])

    lib.items.sort(key=orden)
    indice(lib, h_items)
    hoja_pendientes(lib)
    hoja_controles(lib)
    pulir(lib)
    os.makedirs(salida, exist_ok=True)
    base = os.path.join(salida, f"MSA 25-26 - Items del balance {version}")
    lib.wb.save(base + " - con controles.xlsx")
    lib.wb.remove(lib.wb["Controles"])
    lib.wb.save(base + ".xlsx")
    hojas_cortas = version_corta(lib)
    lib.wb.save(base + " - resumen para imprimir.xlsx")
    with open(base + " - resumen para imprimir.hojas.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(hojas_cortas))
    print("ítems:", len(lib.items), "· controles:", len(lib.controles), "· pendientes:", len(lib.pendientes))
    print("guardado:", base + ".xlsx")


if __name__ == "__main__":
    main()
