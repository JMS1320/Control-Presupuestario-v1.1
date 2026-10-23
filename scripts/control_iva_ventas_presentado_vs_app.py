import sys, re, glob, io, csv, zipfile
src=open("scripts/control_iva_presentado_vs_app.py",encoding="utf-8").read()
sys.argv=["x","",""]
exec(src[:src.index("HIST = get")])
exec(src[src.index("def f2"):src.index("def leer_zip")])
VEN=get("comprobantes_venta",{"select":"*"},"msa")
NOM={1:"Factura A",2:"ND A",3:"NC A",6:"Factura B",7:"ND B",8:"NC B",11:"Factura C",12:"ND C",13:"NC C",186:"Cta Vta y Líq. Prod. A",187:"Cta Vta y Líq. Prod. B",33:"Liq. Primaria Granos",60:"Cta Vta y Líq. Prod. A",61:"Cta Vta y Líq. Prod. B"}
tot_p=tot_a=0
for z in sorted(glob.glob("- Comunicacion JMS Claude - Archivos/- libros de iva ARCA/libro_iva_periodo_*_original.zip")):
    per=re.search(r"(\d{6})",z).group(1); anio,mes=int(per[:4]),int(per[4:])
    zz=zipfile.ZipFile(z); rows=list(csv.DictReader(io.StringIO(zz.read("comprobantes_ventas.csv").decode("latin-1")),delimiter=";"))
    cols=list(rows[0].keys()) if rows else []
    pick=lambda pref:[c for c in cols if c.startswith(pref)][0]
    pres=[{"fecha":r[cols[0]][:10],"tipo":ent(r[pick("Tipo de Comprobante")]),"pv":ent(r[pick("Punto de Venta")]),"nro":ent(r[[c for c in cols if "mero de Comprobante" in c][0]]),"den":r[[c for c in cols if c.startswith("Denominaci")][0]],"total":f2(r["Importe Total"])} for r in rows]
    app=[a for a in VEN if a.get("año_contable")==anio and a.get("mes_contable")==mes]
    sp=sum(p["total"] for p in pres); sa=sum(float(a.get("imp_total") or 0) for a in app)
    print(f"== {mes:02d}/{anio}: presentado {len(pres)} ${sp:,.2f} | app {len(app)} ${sa:,.2f} | dif ${sp-sa:,.2f}")
    libres=list(app)
    for p in pres:
        m=next((a for a in libres if ent(a.get("punto_venta"))==p["pv"] and ent(a.get("numero_desde"))==p["nro"]),None)
        if not m: print(f'   FALTA EN APP: {p["fecha"]} {NOM.get(p["tipo"],p["tipo"])} PV{p["pv"]} N{p["nro"]} {p["den"][:30]} ${p["total"]:,.2f}'); continue
        libres.remove(m); ta=ent(m.get("tipo_comprobante")); at=float(m.get("imp_total") or 0)
        if ta!=p["tipo"] or abs(abs(at)-abs(p["total"]))>0.02:
            print(f'   DISTINTO: {p["fecha"]} PV{p["pv"]} N{p["nro"]} {p["den"][:30]} | presentado {NOM.get(p["tipo"],p["tipo"])} ${p["total"]:,.2f} | app {NOM.get(ta,ta)} ({m.get("tipo_comprobante_desc") or ""}) ${at:,.2f}')
    for a in libres: print(f'   SOBRA EN APP: {a.get("fecha_emision")} {NOM.get(ent(a.get("tipo_comprobante")),a.get("tipo_comprobante"))} PV{a.get("punto_venta")} N{a.get("numero_desde")} {str(a.get("denominacion_cliente"))[:30]} ${float(a.get("imp_total") or 0):,.2f}')
