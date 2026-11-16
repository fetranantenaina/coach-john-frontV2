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

4. Retirer les parties génitales de la silhouette (à lancer depuis un dossier où `@gltf-transform/core@4.1.1`, `@gltf-transform/extensions@4.1.1` et `meshoptimizer@0.22.0` sont installés) :
   `node retirer_genitaux.mjs ../../public/modeles/corps.glb ../../public/modeles/corps.glb compresse pubis`
   (supprime les morceaux de peau du pénis, du scrotum et de la toison pubienne, repérés par leur position).

5. Variante féminine `corps-femme.glb` (même dossier de dépendances que l'étape 4) :
   ```
   node feminiser.mjs ../../public/modeles/corps.glb corps-femme.brut.glb
   npx @gltf-transform/cli@4.1.1 optimize corps-femme.brut.glb ../../public/modeles/corps-femme.glb --compress meshopt --texture-compress false --simplify false --join false --flatten false --instance false --palette false
   ```
   Affine les muscles (face extérieure seulement : haut du corps surtout, abdos, jambes, cou et dentelés), adoucit leur relief (lissage de Taubin), ajoute de la graisse sous-cutanée aux hanches et cuisses, puis déforme tous les maillages avec le même champ (épaules et taille affinées, bassin élargi, fessiers, cuisses convergeant vers les genoux, bras écartés, poitrine en goutte sur la peau, taille ×0,96) :
   un objet `glande_mammaire` (non cliquable, jaune translucide dans l'app) remplit l'espace entre le pectoral et la peau de la poitrine ;
   les autres objets gardent les mêmes noms, donc les mêmes codes muscles. L'app choisit ce modèle quand le profil indique « femme » (bouton ♀/♂ pour changer).

6. Contrôle visuel : `blender -b --factory-startup --python render.py -- ../../public/modeles/corps.glb apercu`
   (produit `apercu_face.png`, `apercu_dos.png`, `apercu_cote.png`).

`corriger_trapezes.mjs` : les parties « Descending / Ascending » du trapèze sont inversées dans Z-Anatomy. `build_glb.py` en tient compte ;
ce script corrige un glb construit avant cette correction (sans effet s'il est déjà correct).

Contenu du glb (1,2 Mo, environ 234 000 faces, corps de 1,75 m, pieds à y = 0) :
- `<code>_g` / `<code>_d` : les 23 muscles Coach John, côté gauche / droit (code = `muscles.code` en base) ;
- `contexte` : le reste de la musculature, non cliquable ;
- `silhouette` : contour de la peau, à afficher en transparence (sans parties génitales).

Le fichier est compressé avec meshopt : côté Three.js, `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`.
La table `CARTE` de `build_glb.py` dit quels muscles Z-Anatomy composent chaque zone.
