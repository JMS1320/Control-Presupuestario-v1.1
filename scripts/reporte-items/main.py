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

from openpyxl.styles import Font

from core import (CAJA, ENTERO, F_B, F_LINK, F_NOTA, MONEDA, R_CLAVE, R_GRUPO, Fuentes, Libro, num)

F_MARCA = Font(name="Arial", size=13, bold=True)

sys.stdout.reconfigure(encoding="utf-8")
MODULOS = ["d_ventas", "d_compras", "d_templates", "d_gastos_bancarios", "d_sueldos", "d_caja_bancos", "d_a_cobrar", "d_hacienda",
           "d_granos_insumos", "d_a_pagar", "d_socios", "d_socios_interno", "d_socios_falta"]
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


# Marca de cada ítem contra lo que YA SE LE ENVIÓ al contador (JMS 16/11: «en ítems va lo enviado, pero con una marca: algún
# asterisco que signifique que encontramos movimientos nuevos y que esa cuenta podría ser alterada»). Sale de la auditoría del
# 15/11/2026 (hoja «Enviado vs hoy»). Sin marca = coincide con lo enviado.
#   "*" = hay diferencia con lo enviado o un anexo con algo nuevo: mirar la hoja      "N" = no se le envió papel de este ítem
#   "?" = no se pudo comparar
MARCA_ENVIADO = {
    "2": ("?", "No se pudo comparar: el libro de compras enviado no estaba en la carpeta de enviados"),
    "2a": ("?", ""), "2b": ("?", ""),
    "3": ("N", "El total no se envió como tal: se enviaron algunos grupos (ver cada renglón)"),
    "3b": ("*", "Enviado «por cuenta» al TC comprador 3.629.838,20; el detalle va al vendedor (anexo en D3)"),
    "3e": ("*", "Enviado «por cuenta» al TC comprador 7.502.758,61; el detalle va al vendedor (anexo en D3)"),
    "3f": ("N", "Grupo no enviado (cargas sociales, IIBB, retenciones: los arma el contador)"),
    "3f1": ("N", ""), "3f2": ("N", ""),
    "3i": ("N", "NO enviado: incluye las multas de la Amarok (1.167.757,00)"),
    "4": ("N", "No se envió papel de sueldos"), "4a": ("N", ""), "4b": ("N", ""), "4c": ("N", ""), "4d": ("N", ""),
    "4e": ("N", "Figura dentro de Cuentas de socios enviado"),
    "5": ("*", "Los bancos coinciden; la Caja iba «pendiente de informar»: anexo con la caja (ver 5f y 5g)"),
    "5f": ("*", "NUEVO: no se había informado"), "5g": ("*", "NUEVO: total enviado + la caja"),
    "8": ("N", "No se envió papel de granos, insumos ni sementeras"), "8a": ("N", ""), "8b": ("N", ""), "8c": ("N", ""),
    "9e": ("N", "No se envió papel de la tarjeta"), "9f": ("N", "No se envió papel de cargas sociales a pagar"),
    "10": ("*", "Va lo enviado. Anexo: 9 renglones que están en lo enviado y todavía no en el sistema (3.529.081,86)"),
    "10b": ("*", "Va lo enviado; el sistema no tiene 2 pagos por Santander (628.914,00)"),
    "10c": ("*", "Va lo enviado; el sistema no tiene albañil y 3 consumos de tarjeta (1.134.572,86)"),
    "10e": ("*", "Va lo enviado; en el sistema no figura como cuenta de socio"),
    "10f": ("*", "Va lo enviado; el sistema lo muestra aparte de las cuentas de socios"),
    "13": ("N", "Nada de esto se le informó"), "13a": ("N", ""), "13b": ("N", ""), "13c": ("N", ""), "13d": ("N", ""),
    "13e": ("N", ""), "13f": ("N", ""), "13g": ("N", ""), "14": ("N", ""), "15": ("N", ""), "16": ("*", "Está en ventas; falta saber dónde puso el cobro"),
    "17": ("N", ""), "18": ("?", "Confirmar si recibió el papel de Libertad"),
}
SIN_MARCA = {"11", "12"}  # referencia: no aplica


def indice(lib, h):
    h.titulo("MSA — Ítems del balance 25/26 (01/07/2025 al 30/06/2026)")
    h.nota("Cada ítem tiene su hoja de detalle, donde el total se forma con los renglones que están a la vista debajo. "
           "«Contador 24/25» es el renglón comparable del balance del año anterior (referencia). «Contador 25/26» es para anotar a "
           "mano el número que dé el contador; la diferencia se calcula sola. Importes en pesos, salvo el ítem 12 (US$).")
    h.nota("Columna MARCA de cada ítem, contra lo que ya se le envió al contador:   sin marca = coincide con lo enviado   ·   "
           "* = hay diferencia o un anexo con algo nuevo (esa cuenta puede cambiar: mirar su hoja)   ·   N = no se le envió papel de "
           "este ítem   ·   ? = no se pudo comparar. El detalle de cada diferencia está en la hoja «Enviado vs hoy».")
    h.blanco()
    h.encabezado(["N°", "Marca", "Ítem", "Composición / criterio", "Importe 25/26 (nuestro)", "Contador 24/25 (referencia)",
                  "Contador 25/26 (anotar)", "Diferencia", "Hoja de detalle", "Pág."], repetir=True)
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
        marca, motivo = MARCA_ENVIADO.get(it["n"], ("", ""))
        if motivo:
            it = dict(it, composicion=(motivo + (" · " + it["composicion"] if it["composicion"] else "")))
        # la marca va en columna propia, grande y centrada (JMS 16/11: que se note más que pegada al número)
        r = h.fila([it["n"], marca or None, it["nombre"], it["composicion"] or None,
                    (f"='{it['hoja']}'!{it['celda']}" if it["celda"] else None),
                    float(it["contador"]) if it["contador"] is not None else None], negrita=not sub, sangria=0)
        if sub:
            h.celda(3, r).alignment = Alignment(wrap_text=True, vertical="top", indent=1)
        if marca:
            x = h.celda(2, r)
            x.font = F_MARCA
            x.alignment = Alignment(horizontal="center", vertical="top")
            x.border = Border(left=CAJA, right=CAJA, top=CAJA, bottom=CAJA)
        if it["celda"]:
            h.celda(5, r).fill = R_CLAVE
            caja_para_anotar(h, 7, r)
            h._pon(8, r, f'=IF({h.cel(7, r)}="","",{h.cel(7, r)}-{h.cel(5, r)})', fmt=MONEDA)
        x = h._pon(9, r, it["hoja"], F_LINK)
        x.hyperlink = f"#'{it['hoja']}'!{it['celda'] or 'A1'}"
        x.alignment = Alignment(vertical="top")
        # JMS 18/11 («súper importante»): el índice dice en qué PÁGINA del PDF empieza la hoja de cada ítem. El número lo pone
        # pdf_paginas.py después de exportar el PDF (recién ahí se sabe); acá queda la celda lista.
        x = h._pon(10, r, "", F_B)
        x.alignment = Alignment(horizontal="center", vertical="top")
        largo = len(it["composicion"] or "")
        h.ws.row_dimensions[r].height = 16 if largo <= 52 else (30 if largo <= 108 else (44 if largo <= 160 else 58))


SIN_EFECTO = ("sólo presentación", "sólo de presentación", "sólo informativo", "no cambia el total", "no cambia el importe",
              "falta el respaldo", "no se pueden identificar", "cantidades", "las tablas por mes", "el último nivel",
              "no toca el ítem")


def no_cambia_numero(p):
    """Un pendiente que no puede mover un número del reporte: sin impacto escrito, o con un impacto que dice que es de
    presentación, de respaldo o informativo. Ante la duda queda en «puede cambiar un número»."""
    impacto = (p[2] or "").strip().lower()
    return not impacto or any(t in impacto for t in SIN_EFECTO)


def hoja_pendientes(lib):
    h = lib.hoja("Pendientes", [5, 34, 78, 26, 24], horizontal=True)
    h.titulo("Pendientes — lo que no cierra, falta definir o hay que revisar")
    h.nota("Nada se descartó en silencio: lo que un detalle no pudo verificar o encontró raro está acá, con la hoja donde se ve.")
    h.blanco()
    # Dos tablas (JMS 16/11: «los pendientes me confunden; quiero estar seguro de que el reporte está bien»): primero lo que puede
    # mover un número del reporte; después lo que es tarea del sistema o de presentación y no mueve ninguno.
    mueve = [p for p in lib.pendientes if not no_cambia_numero(p)]
    tarea = [p for p in lib.pendientes if no_cambia_numero(p)]
    i = 0
    for titulo, lista in ((f"1 · Pueden cambiar un número del reporte ({len(mueve)})", mueve),
                          (f"2 · Tareas del sistema, respaldo o presentación: no cambian ningún número del reporte ({len(tarea)})",
                           tarea)):
        h.seccion(titulo)
        h.encabezado(["N°", "Tema", "Detalle", "Impacto", "Dónde se ve"], repetir=True)
        for p in lista:
            i += 1
            h.fila([i, p[0], p[1], p[2] or None, p[3] or None])
        h.blanco()
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
    "D8 Granos insumos": [(None, "8a · Granos")],
    "D9 A pagar": [("Resumen del ítem 9", None)],
    "D10 Socios": [(None, "3 · Informativo")],
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


def netos_de_iva(lib):
    """En el índice, ventas y compras van NETAS de IVA (JMS 16/11: «para el contador hay que mostrarle todo sin el IVA… en el
    detalle podés poner cuánto es el total con IVA, que sirve como referencia»). No cambia ninguna hoja: sólo a qué celda de la
    hoja apunta cada ítem. El total con IVA queda como sub-ítem de referencia."""
    d = {i["n"]: i for i in lib.items}
    if "1" in d and d["1"]["celda"]:
        col, fila = coordinate_from_string(d["1"]["celda"])          # total con IVA; la columna siguiente es «Sin IVA»
        con_iva = d["1"]["celda"]
        d["1"]["celda"] = f"{get_column_letter(column_index_from_string(col) + 1)}{fila}"
        d["1"]["nombre"] = "Ventas — netas de IVA"
        d["1"]["composicion"] = "Neto gravado + exento; suma de 1a a 1d. " + (d["1"]["composicion"] or "")
        lib.items.append(dict(n="1f", nombre="Ventas — total con IVA (referencia: es el total del subdiario)", hoja=d["1"]["hoja"],
                              celda=con_iva, grupo=d["1"]["grupo"], composicion="Neto + IVA débito fiscal (1e)", contador=None))
    if "2" in d and "2a" in d:
        d["2"]["celda"], d["2a"]["celda"] = d["2a"]["celda"], d["2"]["celda"]
        d["2"]["nombre"] = "Compras — netas de IVA (lo que va al gasto)"
        d["2"]["composicion"] = "Total − IVA: neto gravado + no gravado + exento + monotributo + otros tributos. " + (d["2"]["composicion"] or "")
        d["2a"]["nombre"] = "Compras — total con IVA (referencia: es el total del subdiario)"
        d["2a"]["composicion"] = "Netas + IVA crédito fiscal (2b)"


def volver_al_indice(lib):
    """En cada hoja que no es el índice: link «← Volver al índice» en la fila del título (última columna) y esa fila inmovilizada,
    para que el link quede a la vista aunque se esté al fondo de un detalle largo (JMS 16/11: «faltaría el link para volver»)."""
    for ws in lib.wb.worksheets:
        if ws.title == "Items":
            continue
        c = ws.cell(row=1, column=ws.max_column)
        if c.value is None:
            c.value = "← Volver al índice"
            c.font = F_LINK
            c.alignment = Alignment(horizontal="right", vertical="center")
            c.hyperlink = "#'Items'!A1"
        ws.freeze_panes = "A2"
        # Una hoja que es detalle de OTRA hoja (D3.3 es detalle de D3) lleva además el link para volver a su hoja madre
        # (JMS 16/11: «tiene que tener un link que vuelva a templates, y así para cada caso del estilo»).
        nombre = ws.title.split(" ")[0]
        if nombre.startswith("D") and "." in nombre:
            madre = next((w.title for w in lib.wb.worksheets if w.title.split(" ")[0] == nombre.split(".")[0]), None)
            c2 = ws.cell(row=1, column=ws.max_column - 1)
            if madre and c2.value is None:
                c2.value = "← Volver a " + madre
                c2.font = F_LINK
                c2.alignment = Alignment(horizontal="right", vertical="center")
                c2.hyperlink = f"#'{madre}'!A1"


def pulir(lib):
    """Pulido de impresión, igual para todas las hojas:
    · un número que no entra en su columna se achica en vez de salir como #####;
    · los encabezados de tabla toman el alto que necesita su texto."""
    from openpyxl.utils import get_column_letter as _L
    for ws in lib.wb.worksheets:
        combinadas = set()
        ancho_comb = {}  # celda de arriba a la izquierda de cada combinación de un solo renglón -> ancho total
        encabezados = []
        a_combinar = []
        for rango in ws.merged_cells.ranges:
            for fila in ws.iter_rows(min_row=rango.min_row, max_row=rango.max_row, min_col=rango.min_col, max_col=rango.max_col):
                for c in fila:
                    combinadas.add(c.coordinate)
            if rango.min_row == rango.max_row:
                ancho_comb[f"{_L(rango.min_col)}{rango.min_row}"] = sum(
                    (ws.column_dimensions[_L(k)].width or 10) for k in range(rango.min_col, rango.max_col + 1))
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
            # --- revisión visual del 16/11 ---
            necesita = 0
            firma = []
            forzar = False
            for i, c in enumerate(fila):
                v = c.value
                es_enc = c.fill is not None and c.fill.fgColor is not None and str(c.fill.fgColor.rgb).endswith("DCE6F1")
                if es_enc:
                    firma.append(v)
                if not isinstance(v, str) or v.startswith("="):
                    continue
                if c.coordinate in combinadas:
                    if c.coordinate in ancho_comb and c.alignment.wrap_text:
                        necesita = max(necesita, renglones(v, ancho_comb[c.coordinate], c.font.bold))
                    continue
                if ("↔" in v or "→" in v) and not c.font.bold:  # en Arial normal el PDF las dibuja como « ‹ › »
                    f = copy.copy(c.font)
                    f.name = "Segoe UI"
                    c.font = f
                ancho = ws.column_dimensions[_L(c.column)].width or 10
                # Un rótulo sin ajuste de texto se extiende sobre las celdas vacías de su derecha y se corta en la primera
                # ocupada. Si no entra en ese espacio: se combinan esas celdas, baja de renglón y la fila toma el alto justo.
                j = i + 1
                while j < len(fila) and fila[j].value is None and fila[j].coordinate not in combinadas:
                    ancho += ws.column_dimensions[_L(fila[j].column)].width or 10
                    j += 1
                if not c.alignment.wrap_text and j < len(fila) and len(v) > ancho * (0.85 if c.font.bold else 1.0)                         and not c.hyperlink:
                    al = copy.copy(c.alignment)
                    al.wrap_text = True
                    al.vertical = al.vertical or "top"
                    c.alignment = al
                    if j - 1 > i:
                        a_combinar.append((c.row, c.column, fila[j - 1].column))
                    forzar = True
                elif not c.alignment.wrap_text:
                    continue
                else:
                    ancho = ws.column_dimensions[_L(c.column)].width or 10
                if c.alignment.wrap_text:
                    necesita = max(necesita, renglones(v, ancho, c.font.bold))
            actual = ws.row_dimensions[fila[0].row].height
            # alto fijo que quedó corto para el texto (CUIT tapado), o fila con celdas recién combinadas (Excel no la ajusta sola)
            if necesita > 1 and (actual or forzar) and 12.75 * necesita + 2 > (actual or 0):
                ws.row_dimensions[fila[0].row].height = min(12.75 * necesita + 2, 400)
            if firma:
                encabezados.append((fila[0].row, tuple(firma)))
        for r, c1, c2 in a_combinar:
            ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
        titulos_que_se_repiten(ws, encabezados)


def renglones(texto, ancho, negrita=False):
    """Cuántos renglones ocupa un texto con ajuste en una celda de ese ancho: corta por palabras, como Excel (contar letras
    sobre ancho se queda corto y la última línea sale tapada: el CUIT de G1 del libro del grupo, 16/11)."""
    mayus = sum(1 for ch in texto if ch.isupper()) > 0.5 * max(1, sum(1 for ch in texto if ch.isalpha()))
    cap = max(4, ancho * (0.92 if negrita or mayus else 1.08))
    total = 0
    for parte in texto.split(chr(10)):
        n, largo = 1, 0
        for palabra in parte.split(" "):
            pl = len(palabra)
            if largo and largo + 1 + pl > cap:
                n += 1
                largo = 0
            while pl > cap:  # una palabra más larga que la celda se parte
                n += 1
                pl -= int(cap)
            largo += pl + (1 if largo else 0)
        total += n
    return total


def titulos_que_se_repiten(ws, encabezados):
    """Qué encabezado se repite arriba de cada página impresa. Excel repite UNO solo por hoja: si la hoja tiene tablas con
    columnas distintas, las de abajo salen bajo nombres ajenos (revisión del 16/11: «induce a leer mal»). Se repite el encabezado
    de la tabla que ocupa la hoja sólo si después de él casi no hay renglones de otra tabla; si no, ninguno."""
    if not encabezados:
        return
    bloques = []  # (fila_desde, fila_hasta, firma)
    for r, firma in encabezados:
        if bloques and bloques[-1][1] == r - 1:
            bloques[-1] = (bloques[-1][0], r, bloques[-1][2] + firma)
        else:
            bloques.append((r, r, firma))
    largo = {}
    for i, (a, b, firma) in enumerate(bloques):
        fin = bloques[i + 1][0] - 1 if i + 1 < len(bloques) else ws.max_row
        largo[firma] = largo.get(firma, 0) + (fin - b)
    principal = max(largo, key=lambda k: largo[k])
    primero = next(b for b in bloques if b[2] == principal)
    ajenos = sum((bloques[i + 1][0] - 1 if i + 1 < len(bloques) else ws.max_row) - b
                 for i, (a, b, firma) in enumerate(bloques) if firma != principal and a > primero[0])
    if largo[principal] >= 25 and ajenos <= 0.05 * largo[principal]:
        ws.print_title_rows = f"{primero[0]}:{primero[1]}"
    else:
        ws.print_title_rows = None


def main():
    carpeta, salida, version = sys.argv[1], sys.argv[2], sys.argv[3]
    src = Fuentes(carpeta)
    lib = Libro()
    h_items = lib.hoja("Items", [6, 7, 50, 56, 19, 19, 19, 17, 22, 7], horizontal=True)
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
    netos_de_iva(lib)
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
    volver_al_indice(lib)
    pulir(lib)
    os.makedirs(salida, exist_ok=True)
    base = os.path.join(salida, f"MSA 25-26 - Items del balance {version}")
    lib.wb.save(base + " - con controles.xlsx")
    lib.wb.remove(lib.wb["Controles"])
    for hx in lib.hojas:
        hx.ocultar_controles()
    lib.wb.save(base + ".xlsx")
    hojas_cortas = version_corta(lib)
    lib.wb.save(base + " - resumen para imprimir.xlsx")
    with open(base + " - resumen para imprimir.hojas.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(hojas_cortas))
    print("ítems:", len(lib.items), "· controles:", len(lib.controles), "· pendientes:", len(lib.pendientes))
    print("guardado:", base + ".xlsx")


if __name__ == "__main__":
    main()
