# Prépare le modèle anatomique Coach John à partir de Z-Anatomy (CC BY-SA 4.0).
# Usage : blender -b --factory-startup --python build_glb.py -- muscles.fbx regions.fbx sortie.glb rapport.json
import bpy, sys, json, re

argv = sys.argv[sys.argv.index("--") + 1:]
FBX_MUSCLES, FBX_REGIONS, SORTIE, RAPPORT = argv

# code muscle Coach John -> objets Z-Anatomy (sans suffixe .l / .r)
CARTE = {
    "pectoral_claviculaire": ["Clavicular head of pectoralis major muscle"],
    "grand_pectoral": ["Sternocostal head of pectoralis major muscle", "(Abdominal part of pectoralis major muscle)"],
    "deltoide_anterieur": ["Clavicular part of deltoid muscle"],
    "deltoide_lateral": ["Acromial part of deltoid muscle"],
    "deltoide_posterieur": ["Scapular spinal part of deltoid muscle"],
    "biceps": ["Long head of biceps brachii", "Short head of biceps brachii", "Brachialis muscle"],
    "triceps": ["Long head of triceps brachii", "Lateral head of triceps brachii", "Medial head of triceps brachii"],
    "avant_bras": ["Brachioradialis muscle", "Extensor carpi radialis longus", "Extensor carpi radialis brevis",
                   "Extensor digitorum", "Extensor digiti minimi", "Humeral head of extensor carpi ulnaris",
                   "Ulnar head of extensor carpi ulnaris", "Flexor carpi radialis", "Palmaris longus muscle",
                   "Humeral head of flexor carpi ulnaris", "Ulnar head of flexor carpi ulnaris",
                   "Humero-ulnar head of flexor digitorum superficialis", "Radial head of flexor digitorum superficialis",
                   "Superficial head of pronator teres"],
    "grand_dorsal": ["Latissimus dorsi muscle", "Teres major muscle"],
    "trapeze_superieur": ["Descending part of trapezius muscle"],
    "trapeze_moyen": ["Transverse part of trapezius muscle"],
    "trapeze_inferieur": ["Ascending part of trapezius muscle"],
    "rhomboides": ["Rhomboid major muscle", "Rhomboid minor muscle"],
    "lombaires": ["Iliocostalis lumborum muscle", "Iliocostalis thoracis muscle", "Longissimus thoracis muscle",
                  "Spinalis thoracis muscle"],
    "grand_droit": ["Rectus abdominis muscle"],
    "obliques": ["External abdominal oblique muscle", "Internal abdominal oblique muscle"],
    "grand_fessier": ["Gluteus maximus muscle"],
    "moyen_fessier": ["Gluteus medius muscle"],
    "tenseur_fascia_lata": ["Tensor fasciae latae"],
    "adducteurs": ["Adductor longus", "Adductor brevis", "Adductor magnus", "(Adductor minimus)",
                   "Gracilis muscle", "Pectineus muscle"],
    "quadriceps": ["Rectus femoris muscle", "Vastus lateralis muscle", "Vastus medialis muscle",
                   "Vastus intermedius muscle"],
    "ischio_jambiers": ["Long head of biceps femoris", "Short head of biceps femoris", "Semitendinosus muscle",
                        "Semimembranosus muscle"],
    "mollets": ["Medial head of gastrocnemius", "Lateral head of gastrocnemius", "Soleus muscle"],
}

# Tout ce qui n'est pas du muscle visible (ou trop petit / interne) est retiré
EXCLU_NOM = re.compile(r"fascia|bursa|sheath|ligament|retinacul|septum|tract|aponeuros|tendon|trochlea|"
                       r"raphe|arch|membrane|capsule|band|chiasm|frenul", re.I)
EXCLU_PARENT = re.compile(r"extra-ocular|laryn|tongue|pharyn|palat|auditory|ear|ossicles|perine|pelvic floor|"
                          r"diaphragm|intercostal|thorax|suboccipital|hand|foot|fasciae|bursae|tendon sheaths", re.I)
MAX_FACES_MUSCLE = 2500      # par côté et par muscle Coach John
MAX_FACES_CONTEXTE = 90000   # tous les autres muscles réunis
MAX_FACES_SILHOUETTE = 20000


def importer(chemin):
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=chemin)
    return [o for o in bpy.data.objects if o not in avant]


def base_et_cote(nom):
    m = re.match(r"^(.*)\.([lrgj])(\.\d+)?$", nom)
    return (m.group(1), m.group(2)) if m else (nom, None)


def parents(o):
    p, noms = o.parent, []
    while p:
        noms.append(p.name)
        p = p.parent
    return noms


def joindre(objets, nom):
    objets = [o for o in objets if o.type == "MESH"]
    if not objets:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objets:
        o.select_set(True)
    with bpy.context.temp_override(active_object=objets[0], selected_editable_objects=objets, selected_objects=objets):
        if len(objets) > 1:
            bpy.ops.object.join()
    o = objets[0]
    o.name = nom
    o.data.name = nom
    return o


def simplifier(o, max_faces):
    n = len(o.data.polygons)
    if n <= max_faces:
        return
    mod = o.modifiers.new("dec", "DECIMATE")
    mod.ratio = max_faces / n
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def materiau(nom, couleur, alpha=1.0):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*couleur, 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    return m


bpy.ops.wm.read_factory_settings(use_empty=True)
muscles = importer(FBX_MUSCLES)
noms_muscles = [o.name for o in muscles]
regions = importer(FBX_REGIONS)
for o in bpy.data.objects:
    if o.type == "MESH":
        o["zparents"] = "|".join(parents(o))
        if o.data.users > 1:
            o.data = o.data.copy()  # gauche/droite partagent le maillage source

# Applique les transformations (échelle FBX, rotations) avant toute fusion
for o in bpy.data.objects:
    o.select_set(o.type == "MESH")
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
with bpy.context.temp_override(selected_editable_objects=[o for o in bpy.data.objects if o.type == "MESH"]):
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

par_base = {}
for o in muscles:
    if o.type == "MESH":
        base, cote = base_et_cote(o.name)
        par_base.setdefault(base, []).append((o, cote))
# parents mémorisés avant nettoyage (pour l'exclusion)
# (parent_clear ci-dessus les a retirés : on relit la hiérarchie dans le TSV d'origine si besoin)

rapport = {"muscles": {}, "manquants": [], "exclus": 0, "contexte_objets": 0}
utilises = set()
noeuds = []
mat_muscle = materiau("muscle", (0.62, 0.30, 0.28))
mat_contexte = materiau("contexte", (0.55, 0.52, 0.50))
mat_silhouette = materiau("silhouette", (0.85, 0.80, 0.75), alpha=0.15)

for code, bases in CARTE.items():
    for cote, suffixe in (("l", "g"), ("r", "d")):
        objets = []
        for b in bases:
            trouves = [o for o, c in par_base.get(b, []) if c == cote or (c is None and cote == "l")]
            if not trouves:
                rapport["manquants"].append(f"{b}.{cote}")
            objets += trouves
        utilises.update(x.name for x in objets)
        o = joindre(objets, f"{code}_{suffixe}")
        if o:
            simplifier(o, MAX_FACES_MUSCLE)
            o.data.materials.clear()
            o.data.materials.append(mat_muscle)
            rapport["muscles"][o.name] = {"sources": [x for x in bases], "faces": len(o.data.polygons)}
            noeuds.append(o)

# Muscles de contexte : tout le reste, sauf exclusions
contexte, a_supprimer = [], []
for nom in noms_muscles:
    o = bpy.data.objects.get(nom)
    if o is None or o.type != "MESH" or nom in utilises or o in noeuds:
        continue
    base, _ = base_et_cote(o.name)
    if EXCLU_NOM.search(base) or EXCLU_PARENT.search(o.get("zparents", "")):
        a_supprimer.append(o)
    else:
        contexte.append(o)
rapport["exclus"] = len(a_supprimer)
rapport["contexte_objets"] = len(contexte)
for o in a_supprimer:
    bpy.data.objects.remove(o, do_unlink=True)
ctx = joindre(contexte, "contexte")
if ctx:
    simplifier(ctx, MAX_FACES_CONTEXTE)
    ctx.data.materials.clear()
    ctx.data.materials.append(mat_contexte)
    noeuds.append(ctx)

# Contour du corps : régions de la peau réunies (repères ".j" retirés)
peau = [o for o in regions if o.type == "MESH" and not o.name.endswith(".j")]
for o in regions:
    if o.type == "MESH" and o.name.endswith(".j"):
        bpy.data.objects.remove(o, do_unlink=True)
sil = joindre(peau, "silhouette")
if sil:
    simplifier(sil, MAX_FACES_SILHOUETTE)
    sil.data.materials.clear()
    sil.data.materials.append(mat_silhouette)
    noeuds.append(sil)

# Supprime tout le reste (vides, objets non retenus)
for o in list(bpy.data.objects):
    if o not in noeuds:
        bpy.data.objects.remove(o, do_unlink=True)

# Centre le corps sur l'origine, pieds à y=0 (repère glTF : Y vers le haut)
import mathutils
mins = mathutils.Vector((1e9, 1e9, 1e9)); maxs = -mins
for o in noeuds:
    for v in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(v)
        mins = mathutils.Vector(map(min, mins, w)); maxs = mathutils.Vector(map(max, maxs, w))
decal = mathutils.Vector(((mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2, mins.z))
hauteur = maxs.z - mins.z
echelle = 1.75 / hauteur  # corps ramené à 1,75 m
for o in noeuds:
    o.data.transform(mathutils.Matrix.Scale(echelle, 4) @ mathutils.Matrix.Translation(-decal))
    o.data.update()
rapport["hauteur_origine"] = hauteur
rapport["faces_total"] = sum(len(o.data.polygons) for o in noeuds)

bpy.ops.export_scene.gltf(filepath=SORTIE, export_format="GLB", export_apply=True, export_normals=True,
                          export_materials="EXPORT", export_yup=True,
                          export_animations=False)
json.dump(rapport, open(RAPPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK", rapport["faces_total"], "faces")
