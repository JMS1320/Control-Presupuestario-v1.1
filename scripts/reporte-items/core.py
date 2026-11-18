# -*- coding: utf-8 -*-
"""Reporte de ÍTEMS del balance (A-FEAT-1629) — armazón común.

Sigue `Protocolo de generación de reportes.md`: índice numerado, un detalle por ítem con su
total DEBAJO, cada total suma las celdas que lo forman (nunca SUMIFS), controles a la vista,
hojas listas para imprimir en A4. Prototipo fuera de la app: lee los Excel exportados por la app
(sólo lectura) y escribe archivos nuevos. No toca la base.
"""
import datetime
import glob
import os

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.properties import PageSetupProperties

AZUL = "1F3864"
F_BASE = Font(name="Arial", size=10)
F_TIT = Font(name="Arial", size=14, bold=True, color=AZUL)
F_SEC = Font(name="Arial", size=11, bold=True, underline="single")
F_NOTA = Font(name="Arial", size=9, italic=True, color="595959")
F_B = Font(name="Arial", size=10, bold=True)
F_LINK = Font(name="Arial", size=10, underline="single", color="1F4E9F")
R_ENC = PatternFill("solid", fgColor="DCE6F1")
R_SEC = PatternFill("solid", fgColor="EEF2F7")
R_TOT = PatternFill("solid", fgColor="E4EAF2")
R_CLAVE = PatternFill("solid", fgColor="FFF4D6")
R_GRUPO = PatternFill("solid", fgColor="F5F5F5")
FINO = Side(style="thin", color=AZUL)
MEDIO = Side(style="medium", color=AZUL)
PELO = Side(style="hair", color="C9D3E0")
DOBLE = Side(style="double", color=AZUL)
CAJA = Side(style="thin", color="7F7F7F")
MONEDA = '#,##0.00_);\\(#,##0.00\\);"-"??_);@_)'
ENTERO = '#,##0_);\\(#,##0\\);"-"_);@_)'
FECHA = "dd/mm/yyyy"
TITULO_REPORTE = "MSA — Ítems del balance 25/26"


def num(v):
    """Número de una celda leída (None, vacío o texto -> 0.0)."""
    if isinstance(v, bool):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    return 0.0


class Fuentes:
    """Los Excel exportados por la app, ya descomprimidos en una carpeta (set1, set2, bp)."""

    def __init__(self, carpeta):
        self.carpeta = carpeta
        self._cache = {}

    def ruta(self, fragmento, sub="set2"):
        fs = [f for f in glob.glob(os.path.join(self.carpeta, sub, "*.xlsx"))
              if fragmento.lower() in os.path.basename(f).lower()]
        if len(fs) != 1:
            raise SystemExit(f"Fuente «{fragmento}» en {sub}: {len(fs)} archivos")
        return fs[0]

    def libro(self, fragmento, sub="set2"):
        """Workbook con los VALORES calculados (data_only)."""
        k = (fragmento, sub)
        if k not in self._cache:
            self._cache[k] = openpyxl.load_workbook(self.ruta(fragmento, sub), data_only=True)
        return self._cache[k]

    def hoja(self, fragmento, nombre_hoja, sub="set2"):
        wb = self.libro(fragmento, sub)
        hs = [w for w in wb.worksheets if nombre_hoja.lower() in w.title.lower()]
        if len(hs) != 1:
            raise SystemExit(f"Hoja «{nombre_hoja}» en «{fragmento}»: {len(hs)} ({[w.title for w in wb.worksheets]})")
        return hs[0]

    def nombre(self, fragmento, sub="set2"):
        return os.path.basename(self.ruta(fragmento, sub))


class Hoja:
    """Una hoja del reporte. La columna 1 es la B del Excel (la A es un margen angosto)."""

    def __init__(self, libro, nombre, anchos, horizontal=True):
        self.libro = libro
        self.ws = libro.wb.create_sheet(nombre)
        self.nombre = nombre
        self.r = 0
        self.ncols = len(anchos)
        self._repite = None
        self.filas_control = []
        ws = self.ws
        ws.sheet_view.showGridLines = False
        ws.column_dimensions["A"].width = 2
        for i, a in enumerate(anchos):
            ws.column_dimensions[L(i + 2)].width = a
        ws.page_setup.paperSize = 9
        ws.page_setup.orientation = "landscape" if horizontal else "portrait"
        ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_margins.left = ws.page_margins.right = 0.4
        ws.page_margins.top = 0.6
        ws.page_margins.bottom = 0.6
        ws.page_margins.header = ws.page_margins.footer = 0.25
        ws.print_options.horizontalCentered = True
        ws.oddHeader.right.text = '&"Arial,Italic"&8' + TITULO_REPORTE
        ws.oddFooter.left.text = '&"Arial"&8&A'
        ws.oddFooter.right.text = '&"Arial"&8Página &P de &N'

    def col(self, c):
        return L(c + 1)

    def cel(self, c, r):
        return f"{self.col(c)}{r}"

    def ref(self, c, r):
        return f"'{self.nombre}'!{self.col(c)}{r}"

    def celda(self, c, r):
        return self.ws.cell(row=r, column=c + 1)

    def _pon(self, c, r, v, fuente=F_BASE, fmt=None):
        x = self.celda(c, r)
        x.value = v
        if isinstance(v, str) and v.startswith("= "):
            x.data_type = "s"  # un rótulo que empieza con «= » es texto, no una fórmula
            v = v[1:]
        x.font = fuente
        if fmt:
            x.number_format = fmt
        elif isinstance(v, (datetime.date, datetime.datetime)):
            x.number_format = FECHA
            x.alignment = Alignment(horizontal="center", vertical="top")
        elif isinstance(v, float) or (isinstance(v, str) and v.startswith("=")):
            x.number_format = MONEDA
        elif isinstance(v, int) and not isinstance(v, bool):
            x.number_format = ENTERO
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.startswith("=")):
            x.alignment = Alignment(vertical="top")  # el número arriba, a la altura de la primera línea del texto
        return x

    def titulo(self, texto):
        self.r += 1
        self._pon(1, self.r, texto, F_TIT)
        self.ws.row_dimensions[self.r].height = 22
        return self.r

    def nota(self, texto):
        """Nota larga: celdas combinadas a lo ancho, con ajuste de texto."""
        self.r += 1
        x = self._pon(1, self.r, texto, F_NOTA)
        self.ws.merge_cells(start_row=self.r, start_column=2, end_row=self.r, end_column=self.ncols + 1)
        x.alignment = Alignment(wrap_text=True, vertical="top")
        ancho = sum((self.ws.column_dimensions[L(i + 2)].width or 10) for i in range(self.ncols))
        lineas = max(1, -(-len(texto) // max(20, int(ancho * 1.1))))
        self.ws.row_dimensions[self.r].height = 13 * lineas
        return self.r

    def blanco(self, n=1):
        self.r += n

    def seccion(self, texto):
        self.r += 1
        for c in range(1, self.ncols + 1):
            self.celda(c, self.r).fill = R_SEC
        self._pon(1, self.r, texto, F_SEC)
        return self.r

    def encabezado(self, cols, repetir=False):
        self.r += 1
        for i, t in enumerate(cols):
            x = self._pon(i + 1, self.r, t, F_B)
            x.fill = R_ENC
            x.border = Border(top=FINO, bottom=MEDIO)
            x.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center" if i else "left")
        self.ws.row_dimensions[self.r].height = 28
        if repetir and not self._repite:
            self._repite = self.r
            self.ws.print_title_rows = f"{self.r}:{self.r}"
        return self.r

    def fila(self, valores, negrita=False, fmt=None, sangria=0):
        """Un renglón. `valores` empieza en la columna 1 (None = celda vacía). fmt = {col: formato}."""
        self.r += 1
        # JMS 18/11: «las líneas cortadas molestan… aplica para toda tabla»: la línea del renglón va de punta a punta,
        # también bajo las celdas vacías.
        for c in range(1, self.ncols + 1):
            self.celda(c, self.r).border = Border(bottom=PELO)
        for i, v in enumerate(valores):
            if v is None:
                continue
            x = self._pon(i + 1, self.r, v, F_B if negrita else F_BASE, (fmt or {}).get(i + 1))
            x.border = Border(bottom=PELO)
            if isinstance(v, str) and not v.startswith("="):
                x.alignment = Alignment(wrap_text=True, vertical="top", indent=sangria if i == 0 else 0)
        return self.r

    def total(self, etiqueta, formulas, clave=False, fmt=None, col_etiqueta=1):
        """Renglón de total. formulas = {col: '=...'}; cada fórmula apunta a sus celdas."""
        self.r += 1
        relleno = R_CLAVE if clave else R_TOT
        for c in range(1, self.ncols + 1):
            x = self.celda(c, self.r)
            x.fill = relleno
            x.border = Border(top=FINO, bottom=DOBLE if clave else FINO)
        self._pon(col_etiqueta, self.r, etiqueta, F_B)
        for c, f in formulas.items():
            self._pon(c, self.r, f, F_B, (fmt or {}).get(c))
        return self.r

    def suma(self, c, r1, r2):
        """Suma de un tramo contiguo de renglones de detalle (apunta a sus celdas)."""
        return f"=SUM({self.cel(c, r1)}:{self.cel(c, r2)})" if r2 >= r1 else "=0"

    def suma_de(self, c, filas):
        """Suma de subtotales sueltos: =G12+G30+G41 (se ve cada parte)."""
        if not filas:
            return "=0"
        if len(filas) > 40:
            partes = [filas[i:i + 25] for i in range(0, len(filas), 25)]
            return "=" + "+".join("SUM(" + ",".join(self.cel(c, f) for f in p) + ")" for p in partes)
        return "=" + "+".join(self.cel(c, f) for f in filas)

    def control(self, descripcion, celda_nuestra, valor_fuente, fuente_txt, tolerancia=0.01):
        """Control a la vista: lo que suma esta hoja menos lo que dice el export de la app.

        Ocupa las 3 últimas columnas: valor de la fuente · diferencia · OK/REVISAR.
        celda_nuestra = 'I300' (celda de ESTA hoja con nuestro total)."""
        self.r += 1
        c = self.ncols
        self._pon(1, self.r, f"Control: {descripcion} — fuente: {fuente_txt}", F_NOTA)
        self._pon(c - 2, self.r, float(valor_fuente), F_NOTA, MONEDA)
        self._pon(c - 1, self.r, f"={celda_nuestra}-{self.cel(c - 2, self.r)}", F_NOTA, MONEDA)
        self._pon(c, self.r, f'=IF(ABS({self.cel(c - 1, self.r)})<={tolerancia},"OK","REVISAR")', F_B)
        self.libro.controles.append((descripcion, self.nombre, self.ref(c - 1, self.r), fuente_txt))
        self.filas_control.append(self.r)
        return self.r

    def ocultar_controles(self):
        """JMS 18/11: los controles van sólo en el libro «con controles»; en los de presentación sus renglones se ocultan
        (no se borran: las fórmulas que apuntan a otras celdas siguen en su lugar)."""
        for r in self.filas_control:
            self.ws.row_dimensions[r].hidden = True


class Libro:
    def __init__(self):
        self.wb = openpyxl.Workbook()
        self.wb.remove(self.wb.active)
        self.items = []
        self.controles = []
        self.pendientes = []
        self.hojas = []

    def hoja(self, nombre, anchos, horizontal=True):
        h = Hoja(self, nombre, anchos, horizontal)
        self.hojas.append(h)
        return h

    def item(self, n, nombre, hoja, celda_total, grupo, composicion="", contador_2425=None):
        """Registra un ítem del índice.

        n = '1', '2', '3a'… · celda_total = 'I300' (en `hoja`) · grupo = título del grupo del índice ·
        contador_2425 = importe del balance del contador del año anterior, si hay un renglón comparable."""
        self.items.append(dict(n=str(n), nombre=nombre, hoja=hoja.nombre, celda=celda_total, grupo=grupo,
                               composicion=composicion, contador=contador_2425))

    def pendiente(self, tema, detalle, impacto="", donde=""):
        self.pendientes.append((tema, detalle, impacto, donde))
