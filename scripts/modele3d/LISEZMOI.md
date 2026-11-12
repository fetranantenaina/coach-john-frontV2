# Préparation du modèle 3D (`public/modeles/corps.glb`)

À refaire seulement si on change le découpage des muscles.

1. Installer Blender (5.x) : `winget install BlenderFoundation.Blender`
2. Télécharger depuis <https://github.com/LluisV/Z-Anatomy/tree/PC-Version/Resources/Models/FBX> :
   `MuscularSystem100.fbx` et `Regions of human body100.fbx`
3. Construire puis compresser :

```
blender -b --factory-startup --python build_glb.py -- MuscularSystem100.fbx "Regions of human body100.fbx" corps.brut.glb rapport.json
npx @gltf-transform/cli@4.1.1 optimize corps.brut.glb ../../public/modeles/corps.glb --compress meshopt --texture-compress false --simplify false --join false --flatten false --instance false --palette false
```

4. Contrôle visuel : `blender -b --factory-startup --python render.py -- ../../public/modeles/corps.glb apercu`
   (produit `apercu_face.png`, `apercu_dos.png`, `apercu_cote.png`).

Contenu du glb (1,2 Mo, environ 234 000 faces, corps de 1,75 m, pieds à y = 0) :
- `<code>_g` / `<code>_d` : les 23 muscles Coach John, côté gauche / droit (code = `muscles.code` en base) ;
- `contexte` : le reste de la musculature, non cliquable ;
- `silhouette` : contour de la peau, à afficher en transparence.

Le fichier est compressé avec meshopt : côté Three.js, `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`.
La table `CARTE` de `build_glb.py` dit quels muscles Z-Anatomy composent chaque zone.
