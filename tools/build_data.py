# -*- coding: utf-8 -*-
"""Genera www/js/data.js: alimentos, recetas con macros, ejercicios, hábitos y textos.

Valores nutricionales aproximados por 100 g de porción comestible (tablas
españolas habituales, tipo BEDCA). Las recetas se calculan sumando ingredientes.
"""
import json, os, math

# id: (nombre, kcal, prot, grasa, hc, fibra, sección compra, unidad, g_por_unidad)
FOODS = {
    # Carne y aves
    "pollo":      ("Pechuga de pollo", 110, 23.0, 1.5, 0.0, 0, "Carnicería", "g", None),
    "pavo":       ("Pechuga de pavo", 105, 24.0, 1.0, 0.0, 0, "Carnicería", "g", None),
    "ternera":    ("Ternera magra (filetes)", 125, 21.0, 4.5, 0.0, 0, "Carnicería", "g", None),
    "picada":     ("Carne picada de ternera 5 %", 125, 21.0, 5.0, 0.0, 0, "Carnicería", "g", None),
    "pavofiam":   ("Pavo en lonchas (≥ 90 % carne)", 100, 20.0, 1.5, 2.0, 0, "Charcutería", "g", None),
    "jamon":      ("Jamón serrano sin tocino", 200, 31.0, 8.0, 0.0, 0, "Charcutería", "g", None),
    # Pescado
    "merluza":    ("Merluza (lomos)", 75, 17.0, 0.8, 0.0, 0, "Pescadería", "g", None),
    "salmon":     ("Salmón (lomos)", 200, 20.0, 13.0, 0.0, 0, "Pescadería", "g", None),
    "bacalao":    ("Bacalao fresco o desalado", 80, 18.0, 0.7, 0.0, 0, "Pescadería", "g", None),
    "lubina":     ("Lubina o dorada (lomos)", 100, 19.0, 3.0, 0.0, 0, "Pescadería", "g", None),
    "sepia":      ("Sepia o calamar", 75, 16.0, 1.0, 0.7, 0, "Pescadería", "g", None),
    "gambas":     ("Gambas peladas", 85, 18.0, 1.0, 0.5, 0, "Pescadería", "g", None),
    "atun":       ("Atún al natural (lata)", 110, 25.0, 1.0, 0.0, 0, "Conservas", "lata", 56),
    # Huevos y lácteos
    "huevo":      ("Huevos", 145, 12.5, 10.0, 0.7, 0, "Lácteos y huevos", "ud", 53),
    "claras":     ("Claras de huevo (brick)", 50, 11.0, 0.2, 0.7, 0, "Lácteos y huevos", "g", None),
    "skyr":       ("Skyr o yogur proteico natural", 60, 10.0, 0.2, 4.0, 0, "Lácteos y huevos", "g", None),
    "yogur":      ("Yogur natural desnatado", 40, 4.5, 0.1, 5.5, 0, "Lácteos y huevos", "g", None),
    "batido":     ("Queso fresco batido 0 %", 46, 8.0, 0.2, 3.5, 0, "Lácteos y huevos", "g", None),
    "mozza":      ("Mozzarella light", 165, 19.0, 9.0, 2.0, 0, "Lácteos y huevos", "g", None),
    "leche":      ("Leche semidesnatada", 46, 3.2, 1.6, 4.7, 0, "Lácteos y huevos", "ml", None),
    # Cereales y panadería
    "avena":      ("Copos de avena", 370, 13.0, 7.0, 59.0, 10, "Despensa", "g", None),
    "pan":        ("Pan integral", 240, 9.0, 3.0, 41.0, 7, "Panadería", "g", None),
    "pita":       ("Pan de pita integral", 250, 9.0, 2.0, 48.0, 6, "Panadería", "g", None),
    "wrap":       ("Tortillas de trigo integral", 300, 9.0, 7.0, 48.0, 6, "Panadería", "ud", 60),
    "arroz":      ("Arroz", 355, 7.0, 0.6, 78.0, 1, "Despensa", "g", None),
    "arrozint":   ("Arroz integral", 350, 7.5, 2.7, 73.0, 3.5, "Despensa", "g", None),
    "pasta":      ("Pasta integral", 345, 13.0, 2.5, 64.0, 8, "Despensa", "g", None),
    "quinoa":     ("Quinoa", 365, 14.0, 6.0, 64.0, 7, "Despensa", "g", None),
    "panrallado": ("Pan rallado", 350, 11.0, 2.0, 72.0, 4, "Despensa", "g", None),
    # Legumbres (cocidas, de bote)
    "lentejas":   ("Lentejas cocidas (bote)", 100, 8.0, 0.5, 14.0, 5, "Legumbres y conservas", "g", None),
    "garbanzos":  ("Garbanzos cocidos (bote)", 120, 7.0, 2.5, 16.0, 5, "Legumbres y conservas", "g", None),
    "alubias":    ("Alubias blancas cocidas (bote)", 95, 7.0, 0.5, 13.0, 6, "Legumbres y conservas", "g", None),
    "hummus":     ("Hummus", 280, 7.0, 22.0, 12.0, 6, "Legumbres y conservas", "g", None),
    "tomatetri":  ("Tomate triturado", 30, 1.3, 0.2, 5.0, 1.5, "Legumbres y conservas", "g", None),
    # Tubérculos
    "patata":     ("Patatas", 80, 2.0, 0.1, 17.0, 1.5, "Frutería", "g", None),
    "boniato":    ("Boniato", 86, 1.6, 0.1, 20.0, 3, "Frutería", "g", None),
    # Verduras
    "verduras":   ("Verduras variadas (pimiento, calabacín, cebolla)", 28, 1.2, 0.2, 4.5, 2, "Frutería", "g", None),
    "ensalada":   ("Ensalada (lechuga, tomate, cebolla)", 20, 1.1, 0.2, 3.0, 1.5, "Frutería", "g", None),
    "tomate":     ("Tomates", 20, 0.9, 0.2, 3.5, 1.2, "Frutería", "g", None),
    "cherry":     ("Tomates cherry", 20, 0.9, 0.2, 3.5, 1.2, "Frutería", "g", None),
    "cebolla":    ("Cebollas", 40, 1.1, 0.1, 8.0, 1.7, "Frutería", "g", None),
    "pimiento":   ("Pimientos", 25, 1.0, 0.3, 4.5, 1.8, "Frutería", "g", None),
    "calabacin":  ("Calabacines", 17, 1.2, 0.3, 2.5, 1.0, "Frutería", "g", None),
    "brocoli":    ("Brócoli", 34, 2.8, 0.4, 4.5, 2.6, "Frutería", "g", None),
    "coliflor":   ("Coliflor", 25, 2.0, 0.3, 3.0, 2.0, "Frutería", "g", None),
    "espinacas":  ("Espinacas", 23, 2.9, 0.4, 1.5, 2.2, "Frutería", "g", None),
    "champi":     ("Champiñones", 22, 3.1, 0.3, 1.0, 1.0, "Frutería", "g", None),
    "zanahoria":  ("Zanahorias", 40, 0.9, 0.2, 8.0, 2.8, "Frutería", "g", None),
    "pepino":     ("Pepino", 12, 0.7, 0.1, 2.0, 0.5, "Frutería", "g", None),
    "judias":     ("Judías verdes", 30, 1.8, 0.2, 4.5, 3.0, "Frutería", "g", None),
    "calabaza":   ("Calabaza", 30, 1.0, 0.1, 6.5, 0.5, "Frutería", "g", None),
    "aguacate":   ("Aguacate", 160, 2.0, 15.0, 2.0, 6.7, "Frutería", "g", None),
    # Fruta
    "manzana":    ("Manzanas", 52, 0.3, 0.2, 12.0, 2.4, "Frutería", "g", None),
    "platano":    ("Plátanos", 90, 1.1, 0.3, 20.0, 2.6, "Frutería", "g", None),
    "naranja":    ("Naranjas", 45, 0.9, 0.1, 9.0, 2.0, "Frutería", "g", None),
    "kiwi":       ("Kiwis", 60, 1.1, 0.5, 12.0, 3.0, "Frutería", "g", None),
    "frutosrojos":("Frutos rojos (frescos o congelados)", 35, 0.7, 0.3, 7.0, 2.5, "Frutería", "g", None),
    "fruta":      ("Fruta de temporada", 50, 0.6, 0.2, 11.0, 2.0, "Frutería", "g", None),
    # Grasas y frutos secos
    "aceite":     ("Aceite de oliva virgen extra", 900, 0.0, 100.0, 0.0, 0, "Despensa", "g", None),
    "nueces":     ("Nueces", 650, 15.0, 65.0, 7.0, 6.5, "Despensa", "g", None),
    "almendras":  ("Almendras", 600, 21.0, 52.0, 9.0, 12, "Despensa", "g", None),
    "cacahuete":  ("Crema de cacahuete 100 %", 600, 25.0, 50.0, 12.0, 6, "Despensa", "g", None),
}

# Ingredientes de despensa que no se pesan en la lista (se compran de vez en cuando)
PANTRY = ["Sal y pimienta", "Especias (pimentón, comino, curry, orégano, canela)",
          "Ajo", "Vinagre y limón", "Caldo de verduras", "Café e infusiones"]

def R(id, nombre, emoji, slot, ings, pasos, minutos, tags=()):
    return dict(id=id, nombre=nombre, emoji=emoji, slot=slot, ings=ings,
                pasos=pasos, min=minutos, tags=list(tags))

RECIPES = [
    # ───────── DESAYUNOS (~400 kcal) ─────────
    R("d1", "Avena con skyr y frutos rojos", "🥣", "desayuno",
      [("avena", 50), ("skyr", 200), ("frutosrojos", 100), ("nueces", 10)],
      ["Pon la avena en un bol con un chorrito de agua o leche y caliéntala 1 minuto en el microondas (opcional).",
       "Añade el skyr encima y los frutos rojos.",
       "Termina con las nueces troceadas y canela al gusto."], 5),
    R("d2", "Tostadas de pavo con revuelto", "🍳", "desayuno",
      [("pan", 70), ("tomate", 60), ("pavofiam", 60), ("huevo", 1), ("claras", 100), ("aceite", 5)],
      ["Tuesta el pan y úntalo con tomate rallado y el aceite.",
       "Haz un revuelto con el huevo y las claras en una sartén antiadherente.",
       "Coloca el pavo sobre las tostadas y sirve el revuelto al lado."], 10),
    R("d3", "Tortilla francesa con pan y kiwi", "🥚", "desayuno",
      [("huevo", 2), ("claras", 100), ("pan", 50), ("aceite", 3), ("kiwi", 80)],
      ["Bate los huevos con las claras y una pizca de sal.",
       "Cuaja la tortilla en sartén antiadherente con unas gotas de aceite.",
       "Acompaña con el pan tostado y el kiwi de postre."], 8),
    R("d4", "Bol de queso batido, avena y plátano", "🍌", "desayuno",
      [("batido", 250), ("avena", 40), ("platano", 100), ("cacahuete", 10)],
      ["Mezcla el queso batido con la avena.",
       "Añade el plátano en rodajas y la crema de cacahuete.",
       "Espolvorea canela. Se puede dejar preparado la noche anterior."], 5),
    R("d5", "Tostada de aguacate con huevos y pavo", "🥑", "desayuno",
      [("pan", 60), ("aguacate", 40), ("huevo", 2), ("pavofiam", 40), ("tomate", 50)],
      ["Tuesta el pan y aplasta el aguacate encima con sal y limón.",
       "Cuece los huevos 9 minutos (o hazlos a la plancha sin aceite).",
       "Monta la tostada con el pavo y los huevos; tomate en rodajas al lado."], 12),
    R("d6", "Skyr con manzana y tostada de jamón", "🍎", "desayuno",
      [("skyr", 150), ("manzana", 150), ("almendras", 10), ("pan", 40), ("jamon", 30), ("tomate", 40)],
      ["Sirve el skyr con la manzana troceada, canela y las almendras.",
       "Tuesta el pan, úntalo con tomate y pon el jamón encima."], 5),

    # ───────── MEDIA MAÑANA Y MERIENDA (~200 kcal) ─────────
    R("s1", "Skyr con fruta y canela", "🍓", "tentempie",
      [("skyr", 170), ("fruta", 150), ("nueces", 5)],
      ["Sirve el skyr con la fruta troceada, canela y las nueces."], 2),
    R("s2", "Bocadillito de pavo y tomate", "🥪", "tentempie",
      [("pan", 40), ("pavofiam", 60), ("tomate", 40)],
      ["Abre el pan, pon el tomate en rodajas y el pavo. Listo para llevar."], 3),
    R("s3", "Queso batido con nueces", "🥄", "tentempie",
      [("batido", 200), ("nueces", 15), ("frutosrojos", 50)],
      ["Mezcla el queso batido con los frutos rojos y las nueces troceadas."], 2),
    R("s4", "Huevos cocidos con tomates cherry", "🥚", "tentempie",
      [("huevo", 2), ("cherry", 120)],
      ["Cuece los huevos 9 minutos (puedes dejar varios cocidos para la semana).",
       "Acompaña con los tomates cherry y sal."], 10),
    R("s5", "Tostas de atún y tomate", "🐟", "tentempie",
      [("atun", 1), ("pan", 30), ("tomate", 60)],
      ["Tuesta el pan, pon el tomate en rodajas y el atún escurrido por encima."], 3),
    R("s6", "Plátano y skyr", "🍌", "tentempie",
      [("platano", 100), ("skyr", 120)],
      ["Un plátano y un skyr natural. Fácil de llevar a cualquier sitio."], 1),
    R("s7", "Hummus con crudités y pavo", "🥕", "tentempie",
      [("hummus", 40), ("zanahoria", 80), ("pepino", 80), ("pavofiam", 40)],
      ["Corta la zanahoria y el pepino en bastones.",
       "Mójalos en el hummus y acompaña con el pavo enrollado."], 5),

    # ───────── COMIDAS (~600 kcal) ─────────
    R("c1", "Pollo al horno con patatas y verduras", "🍗", "comida",
      [("pollo", 180), ("patata", 200), ("verduras", 200), ("aceite", 10), ("manzana", 150)],
      ["Precalienta el horno a 200 °C.",
       "Corta la patata en gajos y las verduras en trozos; alíñalo todo con el aceite, sal y especias.",
       "Hornea 20 minutos, añade el pollo salpimentado y hornea 20 minutos más.",
       "Manzana de postre."], 45, ["horno", "tupper"]),
    R("c2", "Lentejas estofadas con ternera", "🍲", "comida",
      [("lentejas", 250), ("ternera", 100), ("verduras", 150), ("tomatetri", 50), ("aceite", 10), ("naranja", 150)],
      ["Sofríe la verdura picada en el aceite 8 minutos.",
       "Añade la ternera en dados y dórala; incorpora el tomate y el pimentón.",
       "Agrega las lentejas escurridas y un vaso de caldo; cuece 10 minutos.",
       "Naranja de postre. Ideal para cocinar doble ración el domingo."], 30, ["tupper", "batch"]),
    R("c3", "Arroz con pollo y verduras", "🥘", "comida",
      [("arroz", 70), ("pollo", 150), ("verduras", 200), ("aceite", 10)],
      ["Dora el pollo troceado en el aceite y resérvalo.",
       "Sofríe las verduras, añade el arroz y rehógalo un minuto.",
       "Cubre con el triple de caldo caliente, vuelve a poner el pollo y cuece 18 minutos.",
       "Reposa 5 minutos tapado."], 35, ["tupper"]),
    R("c4", "Pasta integral con atún y tomate", "🍝", "comida",
      [("pasta", 75), ("atun", 2), ("tomatetri", 150), ("cebolla", 50), ("aceite", 8), ("ensalada", 100), ("kiwi", 100)],
      ["Cuece la pasta según el paquete.",
       "Pocha la cebolla en el aceite, añade el tomate y cocina 10 minutos con orégano.",
       "Incorpora el atún escurrido y mezcla con la pasta.",
       "Ensalada al lado y kiwi de postre."], 20, ["rapida"]),
    R("c5", "Merluza al horno con patatas", "🐟", "comida",
      [("merluza", 250), ("patata", 200), ("cebolla", 50), ("aceite", 12), ("ensalada", 150), ("fruta", 150)],
      ["Hornea la patata en rodajas finas con la cebolla y la mitad del aceite a 200 °C durante 25 minutos.",
       "Coloca la merluza encima con ajo, perejil y el resto del aceite.",
       "Hornea 10–12 minutos más. Ensalada y fruta para completar."], 40, ["horno"]),
    R("c6", "Garbanzos con espinacas y bacalao", "🥬", "comida",
      [("garbanzos", 250), ("espinacas", 150), ("bacalao", 150), ("tomatetri", 50), ("aceite", 10)],
      ["Sofríe ajo en el aceite, añade el pimentón y el tomate.",
       "Incorpora las espinacas hasta que reduzcan y después los garbanzos.",
       "Añade el bacalao en trozos y cocina 6–8 minutos a fuego suave."], 25, ["tupper", "batch"]),
    R("c7", "Ternera a la plancha con boniato asado", "🥩", "comida",
      [("ternera", 180), ("boniato", 200), ("ensalada", 150), ("aceite", 10), ("fruta", 150)],
      ["Asa el boniato en dados a 200 °C durante 30 minutos (o 8 minutos en el microondas).",
       "Haz la ternera a la plancha bien caliente, 2 minutos por lado.",
       "Sirve con la ensalada aliñada y fruta de postre."], 35),
    R("c8", "Salmón con arroz integral y brócoli", "🍣", "comida",
      [("salmon", 150), ("arrozint", 50), ("brocoli", 200), ("aceite", 5)],
      ["Cuece el arroz integral (unos 30 minutos) o usa uno ya cocido.",
       "Cuece el brócoli al vapor 6 minutos.",
       "Haz el salmón a la plancha 3–4 minutos por lado y aliña todo con el aceite y limón."], 35),
    R("c9", "Pollo al curry suave con arroz", "🍛", "comida",
      [("pollo", 170), ("arroz", 60), ("cebolla", 80), ("tomatetri", 100), ("verduras", 100), ("aceite", 10)],
      ["Pocha la cebolla en el aceite y añade una cucharadita de curry.",
       "Incorpora el pollo en dados, dóralo y añade el tomate y las verduras.",
       "Cocina 15 minutos y sirve con el arroz cocido."], 30, ["tupper", "batch"]),
    R("c10", "Albóndigas de ternera en salsa con patata", "🍝", "comida",
      [("picada", 160), ("panrallado", 10), ("tomatetri", 150), ("cebolla", 50), ("patata", 180), ("aceite", 10), ("ensalada", 100)],
      ["Mezcla la carne con el pan rallado, ajo, perejil y sal; forma albóndigas pequeñas.",
       "Dóralas en el aceite, añade la cebolla y el tomate y cocina 15 minutos.",
       "Acompaña con la patata cocida o al microondas y la ensalada."], 35, ["batch"]),
    R("c11", "Alubias blancas con pollo y verduras", "🫘", "comida",
      [("alubias", 250), ("pollo", 120), ("verduras", 150), ("aceite", 10), ("fruta", 150)],
      ["Sofríe las verduras en el aceite con pimentón.",
       "Añade el pollo en dados y dóralo.",
       "Incorpora las alubias y un poco de caldo; cuece 10 minutos. Fruta de postre."], 30, ["tupper", "batch"]),
    R("c12", "Wrap de pollo con aguacate", "🌯", "comida",
      [("wrap", 1), ("pollo", 160), ("ensalada", 150), ("aguacate", 40), ("yogur", 50), ("fruta", 150)],
      ["Haz el pollo a la plancha en tiras con especias.",
       "Mezcla el yogur con limón, sal y ajo en polvo para la salsa.",
       "Rellena la tortilla con ensalada, aguacate, pollo y salsa. Fruta de postre."], 15, ["rapida"]),
    R("c13", "Lubina con patatas panaderas", "🐠", "comida",
      [("lubina", 200), ("patata", 200), ("verduras", 100), ("aceite", 12), ("ensalada", 100), ("fruta", 150)],
      ["Hornea la patata y la verdura en láminas con el aceite a 200 °C durante 25 minutos.",
       "Pon los lomos de lubina encima y hornea 10 minutos más.",
       "Ensalada al lado y fruta de postre."], 40, ["horno"]),
    R("c14", "Pavo con quinoa y verduras salteadas", "🥗", "comida",
      [("pavo", 170), ("quinoa", 60), ("verduras", 200), ("aceite", 10)],
      ["Lava la quinoa y cuécela 12 minutos.",
       "Saltea las verduras en el aceite a fuego fuerte.",
       "Haz el pavo a la plancha y sirve todo junto con salsa de soja baja en sal si quieres."], 25, ["tupper"]),

    # ───────── CENAS (~500 kcal) ─────────
    R("n1", "Tortilla de espinacas con ensalada", "🥬", "cena",
      [("huevo", 2), ("claras", 150), ("espinacas", 100), ("aceite", 8), ("ensalada", 150), ("pan", 40), ("skyr", 100)],
      ["Saltea las espinacas con ajo y unas gotas de aceite.",
       "Bate los huevos con las claras, añade las espinacas y cuaja la tortilla.",
       "Ensalada y pan de acompañamiento; skyr de postre."], 15),
    R("n2", "Salmón a la plancha con verduras al horno", "🍣", "cena",
      [("salmon", 150), ("verduras", 250), ("aceite", 5), ("pan", 30)],
      ["Hornea las verduras en trozos con el aceite a 200 °C durante 25 minutos.",
       "Haz el salmón a la plancha 3–4 minutos por lado.",
       "Sirve con un trozo de pan."], 30, ["horno"]),
    R("n3", "Ensalada completa con pollo a la plancha", "🥗", "cena",
      [("pollo", 170), ("ensalada", 250), ("aguacate", 50), ("aceite", 8), ("pan", 40)],
      ["Haz el pollo a la plancha y córtalo en tiras.",
       "Monta la ensalada con el aguacate y aliña con el aceite y vinagre.",
       "Añade el pollo templado. Pan de acompañamiento."], 15, ["rapida"]),
    R("n4", "Merluza en papillote con patata", "🐟", "cena",
      [("merluza", 220), ("verduras", 200), ("patata", 150), ("aceite", 10), ("yogur", 125)],
      ["Corta la patata en rodajas finas y las verduras en juliana.",
       "Ponlo todo en papel de horno con la merluza encima, el aceite, sal y limón; cierra el paquete.",
       "Hornea a 200 °C durante 20 minutos. Yogur de postre."], 30, ["horno"]),
    R("n5", "Crema de calabacín y revuelto de gambas", "🍤", "cena",
      [("calabacin", 300), ("cebolla", 50), ("aceite", 10), ("batido", 50), ("huevo", 2), ("gambas", 100), ("champi", 100), ("pan", 30)],
      ["Cuece el calabacín y la cebolla en poca agua 15 minutos; tritura con el queso batido y la mitad del aceite.",
       "Saltea los champiñones y las gambas con ajo y el resto del aceite.",
       "Añade los huevos batidos y cuaja el revuelto. Pan de acompañamiento."], 25, ["batch"]),
    R("n6", "Hamburguesa casera con boniato", "🍔", "cena",
      [("picada", 150), ("ensalada", 200), ("boniato", 150), ("aceite", 8), ("skyr", 100)],
      ["Forma la hamburguesa con la carne, sal, pimienta y ajo en polvo.",
       "Asa el boniato en dados (horno o microondas).",
       "Haz la hamburguesa a la plancha y sirve con la ensalada. Skyr de postre."], 25),
    R("n7", "Sepia a la plancha con ensalada", "🦑", "cena",
      [("sepia", 250), ("ensalada", 200), ("aceite", 10), ("pan", 50), ("fruta", 100)],
      ["Haz la sepia a la plancha muy caliente con ajo y perejil.",
       "Sirve con la ensalada aliñada, el pan y fruta de postre."], 15, ["rapida"]),
    R("n8", "Pizza de tortilla integral", "🍕", "cena",
      [("wrap", 1), ("tomatetri", 50), ("mozza", 60), ("pavofiam", 60), ("champi", 50), ("ensalada", 150), ("skyr", 120)],
      ["Unta la tortilla con el tomate y orégano.",
       "Añade la mozzarella, el pavo y los champiñones laminados.",
       "Hornea a 220 °C durante 8 minutos. Ensalada al lado y skyr de postre."], 15, ["horno", "rapida"]),
    R("n9", "Revuelto de bacalao con patata", "🍳", "cena",
      [("bacalao", 180), ("huevo", 2), ("patata", 150), ("cebolla", 50), ("aceite", 8)],
      ["Cuece la patata en dados en el microondas 5 minutos.",
       "Pocha la cebolla en el aceite, añade la patata y el bacalao desmigado.",
       "Incorpora los huevos batidos y cuaja suavemente."], 20),
    R("n10", "Pavo al horno con champiñones y puré de coliflor", "🍄", "cena",
      [("pavo", 170), ("champi", 150), ("coliflor", 250), ("leche", 50), ("aceite", 8), ("pan", 40)],
      ["Cuece la coliflor 12 minutos y tritúrala con la leche, sal y nuez moscada.",
       "Hornea el pavo con los champiñones y el aceite a 200 °C durante 20 minutos.",
       "Sirve con el puré y el pan."], 30, ["horno"]),
    R("n11", "Ensalada de atún, huevo y garbanzos", "🥗", "cena",
      [("atun", 2), ("huevo", 1), ("garbanzos", 100), ("ensalada", 250), ("aceite", 10)],
      ["Cuece el huevo 9 minutos.",
       "Mezcla la ensalada con los garbanzos escurridos y el atún.",
       "Añade el huevo en cuartos y aliña con el aceite y vinagre."], 12, ["rapida"]),
    R("n12", "Brochetas de pollo con salsa de yogur", "🍢", "cena",
      [("pollo", 170), ("verduras", 250), ("aceite", 8), ("yogur", 100), ("pita", 50)],
      ["Ensarta el pollo y la verdura en brochetas con especias.",
       "Hazlas a la plancha o al horno 12–15 minutos.",
       "Sirve con la salsa de yogur (yogur, ajo, pepino, limón) y el pan de pita."], 25),
    R("n13", "Crema de calabaza con lubina", "🎃", "cena",
      [("calabaza", 300), ("patata", 80), ("cebolla", 50), ("aceite", 10), ("lubina", 180)],
      ["Cuece la calabaza, la patata y la cebolla 20 minutos y tritúralas con la mitad del aceite.",
       "Haz la lubina a la plancha con el resto del aceite.",
       "Sirve la crema y la lubina. La crema aguanta 3 días en la nevera."], 30, ["batch"]),
    R("n14", "Tortilla de patata al horno con ensalada", "🥔", "cena",
      [("patata", 200), ("cebolla", 60), ("huevo", 2), ("claras", 150), ("aceite", 10), ("ensalada", 150)],
      ["Hornea la patata y la cebolla en láminas con el aceite a 200 °C durante 20 minutos.",
       "Mézclalas con los huevos y las claras batidos.",
       "Cuaja en un molde en el horno 15 minutos. Ensalada de acompañamiento."], 40, ["horno"]),
]

def grams_of(food_id, qty):
    f = FOODS[food_id]
    unit, gpu = f[7], f[8]
    if unit in ("ud", "lata"):
        return qty * gpu
    return qty

def recipe_macros(r):
    k = p = g = h = fib = 0.0
    for fid, q in r["ings"]:
        f = FOODS[fid]
        gr = grams_of(fid, q)
        k += f[1] * gr / 100; p += f[2] * gr / 100; g += f[3] * gr / 100
        h += f[4] * gr / 100; fib += f[5] * gr / 100
    return dict(kcal=round(k), p=round(p), g=round(g), hc=round(h), fibra=round(fib))

for r in RECIPES:
    r.update(recipe_macros(r))

# ───────── EJERCICIOS ─────────
EXERCISES = {
    "goblet":   dict(nombre="Sentadilla goblet", emoji="🏋️", material="1 mancuerna (8–10 kg)",
                     como="Sujeta la mancuerna vertical pegada al pecho. Baja como si te sentaras en una silla, con la espalda recta y las rodillas en la línea de los pies. Sube empujando con los talones.",
                     ojo="Baja solo hasta donde mantengas la espalda recta. Si molestan las rodillas, siéntate en una silla y levántate (sentadilla a caja)."),
    "remotrx":  dict(nombre="Remo con entrenador de suspensión", emoji="🧗", material="Entrenador de suspensión (puerta o viga del patio)",
                     como="Agarra las asas, inclínate hacia atrás con el cuerpo recto y tira del pecho hacia las manos juntando los omoplatos.",
                     ojo="Cuanto más vertical estés, más fácil. Empieza casi de pie y ve inclinándote semana a semana."),
    "flexinc":  dict(nombre="Flexiones inclinadas con barras", emoji="💪", material="Barras de flexiones sobre un sofá, banco o escalón",
                     como="Apoya las barras en una superficie elevada, cuerpo recto de cabeza a talones, baja el pecho y empuja.",
                     ojo="Cuanto más alta la superficie, más fácil. Si cuesta, hazlas de rodillas en el suelo."),
    "rdl":      dict(nombre="Peso muerto rumano con mancuernas", emoji="🏋️", material="2 mancuernas (6–8 kg cada una)",
                     como="De pie con las rodillas algo flexionadas, lleva la cadera atrás deslizando las mancuernas por los muslos hasta notar estiramiento detrás de las piernas. Vuelve apretando glúteos.",
                     ojo="La espalda siempre recta. Si se arquea, baja menos."),
    "puente":   dict(nombre="Puente de glúteo con minibanda", emoji="🍑", material="Minibanda por encima de las rodillas",
                     como="Tumbado boca arriba con los pies apoyados, eleva la cadera apretando glúteos y empujando las rodillas hacia fuera contra la banda.",
                     ojo="Aguanta 2 segundos arriba en cada repetición."),
    "plancha":  dict(nombre="Plancha frontal", emoji="🧱", material="Suelo o esterilla",
                     como="Apoya antebrazos y pies (o rodillas), cuerpo recto, abdomen y glúteos apretados.",
                     ojo="Si se hunde la zona lumbar, apoya las rodillas."),
    "zancada":  dict(nombre="Zancada estática asistida", emoji="🦵", material="Entrenador de suspensión o una silla para apoyarte",
                     como="Con un pie adelantado y otro atrás, baja la rodilla trasera hacia el suelo y sube. Ayúdate de las asas para equilibrarte.",
                     ojo="Rango corto al principio; la rodilla delantera no debe ir hacia dentro."),
    "press":    dict(nombre="Press de hombros sentado", emoji="🙌", material="2 mancuernas (4–5 kg cada una)",
                     como="Sentado con la espalda apoyada, empuja las mancuernas desde los hombros hasta arriba sin arquear la espalda.",
                     ojo="Abdomen apretado durante todo el movimiento."),
    "remo1":    dict(nombre="Remo a una mano apoyado", emoji="🚣", material="1 mancuerna (8–10 kg) y una silla",
                     como="Apoya mano y rodilla en la silla, espalda recta, y lleva la mancuerna hacia la cadera.",
                     ojo="Tira con la espalda, no con el brazo. Hombro lejos de la oreja."),
    "facepull": dict(nombre="Aperturas con goma (face pull)", emoji="🏄", material="Goma elástica larga",
                     como="Sujeta la goma a la altura del pecho y sepárala abriendo los brazos y juntando los omoplatos.",
                     ojo="Fortalece hombros y postura: prepara la remada del surf."),
    "abduccion":dict(nombre="Abducción de cadera tumbado", emoji="🦿", material="Tobilleras lastradas",
                     como="Tumbado de lado, eleva la pierna de arriba recta unos 40 cm y baja despacio.",
                     ojo="Las tobilleras, solo para ejercicios en el suelo; nunca para caminar."),
    "deadbug":  dict(nombre="Dead bug", emoji="🪲", material="Suelo o esterilla",
                     como="Boca arriba con brazos al techo y rodillas a 90°, estira un brazo y la pierna contraria sin despegar la zona lumbar del suelo.",
                     ojo="Despacio y respirando. La lumbar siempre pegada al suelo."),
    "cajon":    dict(nombre="Sentadilla a caja con mancuerna", emoji="🪑", material="Una silla y 1 mancuerna",
                     como="Siéntate en la silla controlando la bajada y levántate sin impulso, con la mancuerna pegada al pecho.",
                     ojo="Si es fácil, usa una silla más baja."),
    "pressgoma":dict(nombre="Press de pecho con goma", emoji="🤜", material="Goma con asas anclada a la espalda o a una puerta",
                     como="De pie, empuja las asas hacia delante como en un press de banca y vuelve despacio.",
                     ojo="Alterna con flexiones inclinadas si lo prefieres."),
    "curl":     dict(nombre="Curl de bíceps", emoji="💪", material="2 mancuernas (4–6 kg cada una)",
                     como="De pie, codos pegados al cuerpo, sube las mancuernas sin balancearte.",
                     ojo="Baja en 3 segundos."),
    "triceps":  dict(nombre="Extensión de tríceps con goma", emoji="💪", material="Goma elástica",
                     como="Pisa la goma o ánclala arriba y estira los codos manteniéndolos fijos.",
                     ojo="Movimiento controlado."),
    "pallof":   dict(nombre="Press Pallof con goma", emoji="🎯", material="Goma anclada a la altura del pecho",
                     como="De lado al anclaje, sujeta la goma junto al pecho y estira los brazos al frente sin dejar que el cuerpo gire.",
                     ojo="Trabaja el core para el equilibrio del skate y el surf."),
    "lateral":  dict(nombre="Plancha lateral", emoji="📐", material="Suelo o esterilla",
                     como="Apoyado en un antebrazo y el lateral del pie (o rodilla), cuerpo recto.",
                     ojo="Empieza con rodillas apoyadas."),
    "equilibrio":dict(nombre="Equilibrio a una pierna", emoji="🛹", material="Ninguno",
                     como="De pie sobre una pierna con la rodilla ligeramente flexionada; mantén 30 segundos y cambia.",
                     ojo="Cuando sea fácil, hazlo con los ojos cerrados o sobre un cojín."),
    "popup":    dict(nombre="Pop-up de surf", emoji="🏄", material="Suelo o esterilla",
                     como="Tumbado boca abajo, manos junto al pecho, empuja y sube de un salto a posición de surf (pies separados, rodillas flexionadas).",
                     ojo="Empieza en dos tiempos (rodilla y pie) hasta poder hacerlo de un salto."),
    "remadasurf":dict(nombre="Remada de surf con goma", emoji="🌊", material="Goma elástica larga",
                     como="Tumbado boca abajo con el pecho algo elevado, tira de la goma alternando brazos como si remaras en la tabla.",
                     ojo="Mantén el pecho elevado y la mirada al frente."),
}

ROUTINES = {
    "A": dict(nombre="Fuerza A · cuerpo completo", items=["goblet", "remotrx", "flexinc", "rdl", "puente", "plancha"]),
    "B": dict(nombre="Fuerza B · cuerpo completo", items=["zancada", "press", "remo1", "facepull", "abduccion", "deadbug"]),
    "C": dict(nombre="Fuerza C · cuerpo completo", items=["cajon", "pressgoma", "remotrx", "curl", "triceps", "pallof", "lateral"]),
    "S": dict(nombre="Preparación skate y surf", items=["equilibrio", "popup", "remadasurf", "facepull", "pallof", "lateral"]),
}

MOBILITY = ["Gato-camello (10 repeticiones)", "Rotaciones torácicas a cuatro patas (8 por lado)",
            "Estiramiento de flexor de cadera (30 s por lado)", "Isquiotibiales con goma (30 s por lado)",
            "Círculos de tobillo y hombro (10 por lado)", "Pasos de goma por encima de la cabeza (10)"]

# Bloques por semanas desde el inicio: series, repeticiones, descanso y la semana tipo.
# Cada sesión: (tipo, minutos, detalle). Tipos: fuerza:<rutina>, caminar, movilidad, libre, skate, surf
def week(sesiones):
    return sesiones

BLOCKS = [
    dict(desde=1, hasta=2, nombre="Semanas 1–2 · Base suave", intensidad="Suave: puedes hablar mientras caminas",
         series=3, reps="10–12", descanso="60–90 s",
         dias={
            1: [("fuerza:A", 40, ""), ("caminar", 50, "Paso vivo, terreno llano"), ("movilidad", 10, "")],
            2: [("caminar", 30, "Por la mañana"), ("caminar", 30, "Por la tarde"), ("movilidad", 20, "Rutina completa con estiramientos")],
            3: [("fuerza:B", 40, ""), ("caminar", 50, "Paso vivo"), ("movilidad", 10, "")],
            4: [("caminar", 30, "Por la mañana"), ("caminar", 30, "Por la tarde"), ("movilidad", 20, "Rutina completa con estiramientos")],
            5: [("fuerza:C", 40, ""), ("caminar", 50, "Paso vivo"), ("movilidad", 10, "")],
            6: [("caminar", 85, "Ruta larga a ritmo cómodo"), ("movilidad", 15, "")],
            0: [("caminar", 45, "Paseo suave de recuperación"), ("movilidad", 20, "Estiramientos largos")],
         }),
    dict(desde=3, hasta=4, nombre="Semanas 3–4 · Más ritmo", intensidad="Moderada: hablas con frases cortas",
         series=3, reps="10–12", descanso="60–75 s",
         dias={
            1: [("fuerza:A", 50, ""), ("caminar", 45, "Con alguna cuesta"), ("movilidad", 10, "")],
            2: [("caminar", 60, "Ritmo alegre"), ("movilidad", 15, "Core: plancha y dead bug al final")],
            3: [("fuerza:B", 50, ""), ("caminar", 45, "Con cuestas"), ("movilidad", 10, "")],
            4: [("caminar", 60, "Ritmo alegre"), ("movilidad", 15, "")],
            5: [("fuerza:C", 50, ""), ("caminar", 45, "Con cuestas"), ("movilidad", 10, "")],
            6: [("caminar", 80, "Ruta con desnivel"), ("libre", 30, "Lo que te apetezca: bici, nadar, jugar")],
            0: [("caminar", 45, "Paseo suave"), ("movilidad", 20, "Estiramientos largos")],
         }),
    dict(desde=5, hasta=6, nombre="Semanas 5–6 · Intervalos", intensidad="Moderada con picos cortos",
         series=4, reps="8–12", descanso="60 s",
         dias={
            1: [("fuerza:A", 55, ""), ("caminar", 40, "Intervalos: 2 min rápido / 2 min suave"), ("movilidad", 10, "")],
            2: [("caminar", 60, "Ritmo alegre con cuestas"), ("movilidad", 15, "")],
            3: [("fuerza:B", 55, ""), ("caminar", 40, "Intervalos: 2 min rápido / 2 min suave"), ("movilidad", 10, "")],
            4: [("caminar", 60, "Ritmo alegre"), ("movilidad", 15, "")],
            5: [("fuerza:C", 55, ""), ("caminar", 40, "Intervalos"), ("movilidad", 10, "")],
            6: [("caminar", 75, "Ruta con desnivel"), ("libre", 45, "Actividad libre")],
            0: [("caminar", 45, "Paseo suave"), ("movilidad", 15, "")],
         }),
    dict(desde=7, hasta=999, nombre="Semana 7 en adelante · Plan completo", intensidad="Según la fase",
         series=4, reps="8–12", descanso="60 s",
         dias={
            1: [("fuerza:A", 60, ""), ("caminar", 40, "Intervalos o cuestas"), ("movilidad", 10, "")],
            2: [("caminar", 60, "Cardio continuo"), ("fuerza:S", 20, "Preparación skate y surf")],
            3: [("fuerza:B", 60, ""), ("caminar", 40, "Intervalos o cuestas"), ("movilidad", 10, "")],
            4: [("caminar", 60, "Cardio continuo"), ("movilidad", 15, "")],
            5: [("fuerza:C", 60, ""), ("caminar", 40, "Intervalos"), ("movilidad", 10, "")],
            6: [("caminar", 70, "Ruta con desnivel"), ("libre", 50, "Skate o surf si están desbloqueados")],
            0: [("caminar", 45, "Paseo suave"), ("movilidad", 15, "")],
         }),
]

TESTS = {
    "base": dict(nombre="Test base (skate) 🛹", items=[
        ("sentadillas", "Sentadillas sin peso con buena técnica", "rep", 20),
        ("plancha", "Plancha frontal", "s", 45),
        ("equilibrio", "Equilibrio a una pierna (cada pierna)", "s", 30),
        ("zancadas", "Zancadas con cada pierna", "rep", 10),
        ("caminar", "Caminar rápido sin parar", "min", 40)]),
    "surf": dict(nombre="Test de surf 🏄", items=[
        ("flexiones", "Flexiones completas", "rep", 15),
        ("popups", "Pop-ups en 1 minuto", "rep", 10),
        ("plancha", "Plancha frontal", "s", 90),
        ("remada", "Remada continua con gomas, boca abajo", "min", 3),
        ("nadar", "Nadar seguidos (si tienes piscina)", "m", 200)]),
}

HABITS = [
    dict(id="estudio", nombre="Estudio", emoji="📚", tipo="minutos", meta=600, periodo="semana", unidad="min", texto="10 h a la semana"),
    dict(id="lectura", nombre="Lectura", emoji="📖", tipo="numero", meta=20, periodo="dia", unidad="páginas", texto="20 páginas al día"),
    dict(id="sueno", nombre="Sueño", emoji="😴", tipo="sueno", meta=7, periodo="dia", unidad="h", texto="7–8 h y hora fija de acostarse"),
    dict(id="pausas", nombre="Pausas activas", emoji="🧍", tipo="contador", meta=6, periodo="dia", unidad="pausas", texto="3–5 min de pie por cada hora sentado"),
    dict(id="agua", nombre="Agua", emoji="💧", tipo="contador", meta=10, periodo="dia", unidad="vasos", texto="2,5 L (10 vasos de 250 ml)"),
    dict(id="pasos", nombre="Pasos", emoji="👣", tipo="numero", meta=8000, periodo="dia", unidad="pasos", texto="8.000 al día (Samsung Health)"),
    dict(id="picoteo", nombre="Cero picoteo fuera del plan", emoji="🚫", tipo="auto", meta=1, periodo="dia", unidad="", texto="Automático desde el antipicoteo"),
    dict(id="fruta", nombre="Fruta y verdura", emoji="🥦", tipo="contador", meta=5, periodo="dia", unidad="raciones", texto="5 raciones al día"),
    dict(id="alcohol", nombre="Sin alcohol", emoji="🍷", tipo="check", meta=1, periodo="dia", unidad="", texto="Solo en la comida libre"),
    dict(id="pantallas", nombre="Pantallas fuera antes de dormir", emoji="📵", tipo="check", meta=1, periodo="dia", unidad="", texto="30 min antes de acostarte"),
    dict(id="pesaje", nombre="Pesaje en ayunas", emoji="⚖️", tipo="auto", meta=1, periodo="dia", unidad="", texto="Automático al registrar el peso"),
]

QUOTES = [
    "La constancia vence al talento. 💪",
    "Hoy cuenta. Mañana lo agradecerás. ✨",
    "Cada kilo menos es una ola más cerca. 🏄",
    "No hace falta un día perfecto, solo un buen día. 🌿",
    "Disciplina es elegir lo que quieres más sobre lo que quieres ahora. 🎯",
    "El skate te está esperando. 🛹",
    "Pequeños hábitos, grandes resultados. 📈",
    "Tu yo de dentro de seis meses te lo agradecerá. 🙌",
    "Lo que se mide, mejora. 📏",
    "Entrenar es un regalo que te haces a ti mismo. 🎁",
    "Un paso más que ayer. 👣",
    "La motivación te pone en marcha; el hábito te mantiene. 🔁",
    "Come bien, muévete, descansa. Repite. 🔄",
    "Cada decisión de hoy suma. 🧮",
]

PICOTEO_OK = ["Fruta (1 pieza)", "Yogur natural o skyr", "Bastones de zanahoria o pepino",
              "Encurtidos (pepinillos, cebolletas)", "Huevo cocido", "20 g de frutos secos", "Infusión o café solo"]

data = dict(
    foods={k: dict(n=v[0], kcal=v[1], p=v[2], g=v[3], hc=v[4], fib=v[5], sec=v[6], u=v[7], gpu=v[8]) for k, v in FOODS.items()},
    pantry=PANTRY, recipes=RECIPES, exercises=EXERCISES, routines=ROUTINES, mobility=MOBILITY,
    blocks=BLOCKS, tests=TESTS, habits=HABITS, quotes=QUOTES, picoteoOk=PICOTEO_OK,
)

def write():
    out = os.path.join(os.path.dirname(__file__), "..", "www", "js", "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("// Generado por tools/build_data.py — no editar a mano\n")
        fh.write("window.HS_DATA = ")
        json.dump(data, fh, ensure_ascii=False, indent=0, separators=(",", ":"))
        fh.write(";\n")
    return out

if __name__ == "__main__":
    out = write()
    by = {}
    for r in RECIPES:
        by.setdefault(r["slot"], []).append(r)
        print(f'{r["id"]:4} {r["kcal"]:4} kcal  P{r["p"]:3}  G{r["g"]:3}  HC{r["hc"]:3}  F{r["fibra"]:2}  {r["nombre"]}')
    for s, rs in by.items():
        print(s, "media kcal", round(sum(r["kcal"] for r in rs) / len(rs)), "media P", round(sum(r["p"] for r in rs) / len(rs)))
    print("bytes", os.path.getsize(out))
