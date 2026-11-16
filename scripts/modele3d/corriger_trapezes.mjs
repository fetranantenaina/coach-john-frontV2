// Usage : node corriger_trapezes.mjs corps.glb corps.glb
// Dans la source Z-Anatomy, « Descending part » et « Ascending part » du trapèze sont inversés :
// l'objet nommé trapeze_superieur était le bas du muscle (sous les omoplates), trapeze_inferieur le haut (cou).
// Ce script permute les deux noms dans un glb déjà construit (build_glb.py est corrigé pour les prochaines constructions).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);
const permute = (nom) => nom.replace(/^trapeze_(superieur|inferieur)/, (_, p) => 'trapeze_' + (p === 'superieur' ? 'inferieur' : 'superieur'));
// Contrôle : avant correction, le « supérieur » est plus bas que l'« inférieur »
const hautMax = (nom) => {
  const n = doc.getRoot().listNodes().find((x) => x.getName() === nom), v = [0, 0, 0]; let m = -Infinity;
  for (const p of n.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) m = Math.max(m, a.getElement(i, v)[1]); }
  return m * n.getScale()[1] + n.getTranslation()[1];
};
if (hautMax('trapeze_superieur_g') > hautMax('trapeze_inferieur_g')) { console.log('déjà correct, rien à faire'); process.exit(0); }
for (const n of doc.getRoot().listNodes()) { n.setName(permute(n.getName())); n.getMesh()?.setName(permute(n.getMesh().getName())); }
await io.write(dst, doc);
console.log('trapèzes supérieur / inférieur permutés');
