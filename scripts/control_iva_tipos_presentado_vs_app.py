import sys, re, glob, os
src=open("scripts/control_iva_presentado_vs_app.py",encoding="utf-8").read()
cut=src.index("def norm_app")
end=src.index("def cruzar")
sys.argv=["x","",""]
exec(src[:end])
carpeta="- Comunicacion JMS Claude - Archivos/- libros de iva ARCA"
def cod(t):
    m=re.match(r"\s*(\d+)",str(t or "")); return int(m.group(1)) if m else None
NOM={1:"Factura A",2:"Nota de Débito A",3:"Nota de Crédito A",6:"Factura B",7:"ND B",8:"NC B",11:"Factura C",12:"ND C",13:"NC C",81:"Tique Fac A",82:"Tique Fac B",83:"Tique",109:"Tique C",80:"Informe diario"}
hall=0
for z in sorted(glob.glob(carpeta+"/libro_iva_periodo_*_original.zip")):
    per=re.search(r"(\d{6})",z).group(1); anio,mes=int(per[:4]),int(per[4:])
    pres,_=leer_zip(z)
    fuentes=[("hist",HIST,"anio_contable")] if (anio,mes)<(2026,1) else [("arca",ARCA,"año_contable")]
    if (anio,mes)==(2025,12): fuentes=[("hist",HIST,"anio_contable"),("arca",ARCA,"año_contable")]
    for nom,base,ca in fuentes:
        app=[a for a in base if a.get(ca)==anio and a.get("mes_contable")==mes]
        for p in pres:
            for a in app:
                pv=ent(a.get("punto_de_venta") if nom=="hist" else a.get("punto_venta")); nro=ent(a.get("numero_desde"))
                if pv==p["pv"] and nro==p["nro"] and p["nro"]!=0:
                    ta=cod(a.get("tipo")) if nom=="hist" else cod(a.get("tipo_comprobante"))
                    if ta!=p["tipo"]:
                        hall+=1
                        print(f'{mes:02d}/{anio} [{nom}] {p["fecha"]} {p["den"][:32]:32} PV{p["pv"]} N{p["nro"]} ${p["total"]:,.2f} | presentado: {p["tipo"]} {NOM.get(p["tipo"],"")} | app: {ta} {NOM.get(ta,"")} ({a.get("tipo") if nom=="hist" else a.get("tipo_comprobante_desc")})')
print("diferencias de tipo:",hall)
