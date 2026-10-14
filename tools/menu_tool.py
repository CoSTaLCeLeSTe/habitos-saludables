# -*- coding: utf-8 -*-
"""Comprueba (y completa) un menú semanal para Hábitos Saludables.

Uso:
  python3 tools/menu_tool.py check menu.json           # valida e informa
  python3 tools/menu_tool.py fix menu.json salida.json # además calcula kcal y macros de las recetas nuevas

Formato del menú (lo que lee la app):
{
  "semana": "2026-10-17",                 # sábado de inicio (la semana va de sábado a viernes)
  "nota": "texto breve para el usuario",
  "dias": [ {"fecha": "2026-10-17", "desayuno": "d1", "media": "s1", "comida": "c1", "merienda": "s6", "cena": "n7"}, ... 7 días ],
  "recetas": [                            # solo las recetas nuevas; las existentes se citan por id
    {"id": "cl-1017-1", "nombre": "...", "emoji": "🍗", "slot": "comida", "min": 30,
     "ings": [["pollo", 180], ["patata", 180], {"n": "Espárragos trigueros", "q": 150, "u": "g", "sec": "Frutería", "kcal": 20, "p": 2.2, "g": 0.2, "hc": 2}],
     "pasos": ["...", "..."]}
  ]
}
Los ingredientes con id usan la tabla de alimentos de build_data.py (cantidad en g, o unidades para "huevo",
"wrap" y latas para "atun"). Los ingredientes libres llevan sus valores por 100 g.
"""
import json, sys, os, datetime
sys.path.insert(0, os.path.dirname(__file__))
import build_data as B  # noqa: E402

SLOT_TIPO = {"desayuno": "desayuno", "media": "tentempie", "comida": "comida", "merienda": "tentempie", "cena": "cena"}
BASE = {r["id"]: r for r in B.RECIPES}


def macros_of(r):
    k = p = g = h = 0.0
    for it in r.get("ings", []):
        if isinstance(it, list):
            fid, q = it
            if fid not in B.FOODS:
                raise ValueError(f'{r["id"]}: alimento desconocido "{fid}"')
            f = B.FOODS[fid]
            gr = B.grams_of(fid, q)
            k += f[1] * gr / 100; p += f[2] * gr / 100; g += f[3] * gr / 100; h += f[4] * gr / 100
        else:
            gr = it.get("q", 0) * (it.get("gpu", 1) if it.get("u") == "ud" else 1)
            for key in ("kcal", "p", "g", "hc"):
                if key not in it:
                    raise ValueError(f'{r["id"]}: al ingrediente libre "{it.get("n")}" le falta "{key}" por 100 g')
            k += it["kcal"] * gr / 100; p += it["p"] * gr / 100; g += it["g"] * gr / 100; h += it["hc"] * gr / 100
    return dict(kcal=round(k), p=round(p), g=round(g), hc=round(h))


def check(menu, fix=False):
    errs, warns = [], []
    sem = menu.get("semana")
    try:
        d0 = datetime.date.fromisoformat(sem)
        if d0.weekday() != 5:
            errs.append('"semana" debe ser un sábado')
    except Exception:
        errs.append('"semana" falta o no es una fecha AAAA-MM-DD'); d0 = None
    nuevas = {}
    for r in menu.get("recetas", []):
        for key in ("id", "nombre", "slot", "ings", "pasos"):
            if key not in r:
                errs.append(f'receta sin "{key}": {r.get("id")}')
        if r.get("slot") not in ("desayuno", "tentempie", "comida", "cena"):
            errs.append(f'{r.get("id")}: slot debe ser desayuno, tentempie, comida o cena')
        if r.get("id") in BASE:
            errs.append(f'{r["id"]}: ese id ya existe en el recetario base; usa otro')
        try:
            m = macros_of(r)
            if fix:
                r.update(m); r.setdefault("emoji", "🍽️"); r.setdefault("min", 20)
            elif any(abs(r.get(k, -999) - v) > max(15, v * 0.1) for k, v in m.items()):
                warns.append(f'{r["id"]}: las macros no cuadran con los ingredientes ({m})')
        except ValueError as e:
            errs.append(str(e))
        nuevas[r.get("id")] = r
    dias = menu.get("dias", [])
    if len(dias) != 7:
        errs.append(f"el menú debe tener 7 días (tiene {len(dias)})")
    for i, d in enumerate(dias):
        if d0 and d.get("fecha") != (d0 + datetime.timedelta(days=i)).isoformat():
            errs.append(f'día {i + 1}: la fecha debería ser {(d0 + datetime.timedelta(days=i)).isoformat()}')
        tot_k = tot_p = 0
        for slot, tipo in SLOT_TIPO.items():
            rid = d.get(slot)
            r = BASE.get(rid) or nuevas.get(rid)
            if not r:
                errs.append(f'{d.get("fecha")} {slot}: receta desconocida "{rid}"'); continue
            if r["slot"] != tipo:
                errs.append(f'{d.get("fecha")} {slot}: "{rid}" es de {r["slot"]}, no de {tipo}')
            mm = r if "kcal" in r else macros_of(r)
            tot_k += mm.get("kcal", 0); tot_p += mm.get("p", 0)
        if tot_k and not (1500 <= tot_k <= 2300):
            warns.append(f'{d.get("fecha")}: {tot_k} kcal sin ajustar (la app escala entre ×0,8 y ×1,3)')
        print(f'{d.get("fecha")}: {tot_k} kcal · {tot_p} g proteína (antes del ajuste a las calorías objetivo)')
    return errs, warns


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("check", "fix"):
        print(__doc__); sys.exit(2)
    menu = json.load(open(sys.argv[2], encoding="utf-8"))
    errs, warns = check(menu, fix=sys.argv[1] == "fix")
    for w in warns: print("AVISO:", w)
    for e in errs: print("ERROR:", e)
    if sys.argv[1] == "fix" and not errs:
        out = sys.argv[3] if len(sys.argv) > 3 else sys.argv[2]
        json.dump(menu, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("Guardado en", out)
    sys.exit(1 if errs else 0)
