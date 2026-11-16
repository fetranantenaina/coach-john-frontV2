// Usage : node feminiser.mjs corps.glb corps-femme.brut.glb   (puis compression : voir LISEZMOI.md)
// (dépendances : @gltf-transform/core@4.1.1, @gltf-transform/extensions@4.1.1, meshoptimizer@0.22.0)
//
// Construit la variante féminine du corps à partir de corps.glb, en déformant tous les maillages
// avec le même champ (les muscles restent donc sous la peau et gardent leurs noms / codes) :
//   - tronc : épaules et taille plus étroites, bassin plus large, fessiers plus ronds, cou plus fin ;
//   - bras : translatés avec l'épaule, légèrement écartés (les mains passent au-dessus des hanches), un peu plus fins ;
//   - peau (silhouette) uniquement : poitrine.
//   - taille générale ×0,96 (pieds toujours à y = 0).
// Repère : y vers le haut (pieds à 0, ~1,75 m), le corps regarde vers +Z, gauche du corps en +X.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);

const ECHELLE = 0.96;
const BRAS = /^(biceps|triceps|avant_bras)_[gd]$/;

// --- Outils ---
const lisse = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** Interpolation lisse d'une courbe définie par points [y, valeur]. */
function courbe(pts, y) {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) { const [y0, v0] = pts[i - 1], [y1, v1] = pts[i]; return v0 + (v1 - v0) * lisse(y0, y1, y); }
  }
  return pts[pts.length - 1][1];
}

// Largeur (x) du tronc et des jambes selon la hauteur
const SX = [[0.40, 1.0], [0.70, 1.04], [0.90, 1.08], [1.00, 1.0], [1.10, 0.88], [1.22, 0.90], [1.42, 0.90], [1.50, 0.86], [1.58, 0.94], [1.70, 0.96]];
// Profondeur (z) : taille et cou affinés
const SZ = [[0.95, 1.0], [1.08, 0.92], [1.18, 0.95], [1.30, 1.0], [1.45, 1.0], [1.52, 0.9], [1.60, 1.0]];
// Fessiers : arrière du bassin plus rond (z < 0 seulement)
const FESSES = [[0.70, 1.0], [0.84, 1.14], [0.92, 1.12], [1.02, 1.0]];

function tronc([x, y, z]) {
  let zz = z * courbe(SZ, y);
  if (zz < 0) zz *= courbe(FESSES, y);
  return [x * courbe(SX, y), y, zz];
}

// Bras : l'épaule suit le tronc (x × 0,90 à y = 1,40), puis abduction de 4° autour de l'épaule et bras affiné
const EPAULE = { x: 0.19, y: 1.40, z: -0.02 };
const ANGLE = (4 * Math.PI) / 180;
function bras([x, y, z]) {
  const s = Math.sign(x) || 1, ax = Math.abs(x);
  // axe approximatif du bras : de l'épaule au poignet (0,25 ; 0,80 ; 0)
  const t = Math.min(1, Math.max(0, (EPAULE.y - y) / 0.6));
  const cx = EPAULE.x + (0.25 - EPAULE.x) * t, cz = EPAULE.z + (0 - EPAULE.z) * t;
  let px = cx + (ax - cx) * 0.93, pz = cz + (z - cz) * 0.93; // bras plus fin (−7 %)
  px -= EPAULE.x * 0.10; // l'épaule rentre avec le tronc
  const pivotX = EPAULE.x * 0.90, dx = px - pivotX, dy = y - EPAULE.y;
  const rx = pivotX + dx * Math.cos(ANGLE) - dy * Math.sin(ANGLE);
  const ry = EPAULE.y + dx * Math.sin(ANGLE) + dy * Math.cos(ANGLE);
  return [s * rx, ry, pz];
}

// Poitrine (peau seulement) : deux bosses gaussiennes vers l'avant, posées sur le haut des pectoraux
function poitrine([x, y, z], nz) {
  if (nz <= 0.1) return [x, y, z];
  let d = 0;
  for (const cx of [-0.095, 0.095]) {
    const r2 = ((x - cx) ** 2) / (0.06 ** 2) + ((y - 1.255) ** 2) / (0.055 ** 2);
    d += Math.exp(-r2 / 2);
  }
  d = Math.min(1, d) * nz;
  return [x + Math.sign(x) * 0.008 * d, y - 0.012 * d, z + 0.045 * d];
}

// --- Déquantification : positions et normales en flottants, transformation du nœud appliquée aux sommets
// (sinon les sommets déplacés hors de la boîte d'origine seraient écrêtés par la quantification meshopt) ---
const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
if (new Set(nodes.map((n) => n.getMesh())).size !== nodes.length) throw new Error('maillage partagé entre nœuds : non géré');
for (const n of nodes) {
  const t = n.getTranslation(), s = n.getScale(), v = [0, 0, 0];
  for (const p of n.getMesh().listPrimitives()) {
    for (const nomAttr of ['POSITION', 'NORMAL']) {
      const a = p.getAttribute(nomAttr); if (!a) continue;
      const f = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        for (let k = 0; k < 3; k++) f[i * 3 + k] = nomAttr === 'POSITION' ? v[k] * s[k] + t[k] : v[k];
      }
      a.setArray(f).setNormalized(false);
    }
  }
  n.setTranslation([0, 0, 0]).setScale([1, 1, 1]);
}

// --- Grille de recherche du point de muscle le plus proche (pour savoir si un point de peau est « bras » ou « tronc ») ---
const monde = (n) => { const t = n.getTranslation(), s = n.getScale(); return (v) => [v[0] * s[0] + t[0], v[1] * s[1] + t[1], v[2] * s[2] + t[2]]; };
const local = (n) => { const t = n.getTranslation(), s = n.getScale(); return (w) => [(w[0] - t[0]) / s[0], (w[1] - t[1]) / s[1], (w[2] - t[2]) / s[2]]; };
for (const n of nodes) { const r = n.getRotation(); if (r[0] || r[1] || r[2] || r[3] !== 1) throw new Error('rotation non gérée : ' + n.getName()); }

const CELLULE = 0.02, grille = new Map();
const cle = (x, y, z) => `${Math.floor(x / CELLULE)},${Math.floor(y / CELLULE)},${Math.floor(z / CELLULE)}`;
for (const n of nodes) {
  if (n.getName() === 'silhouette') continue;
  const estBras = BRAS.test(n.getName()), w = monde(n), v = [0, 0, 0];
  for (const p of n.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i += 2) { const q = w(a.getElement(i, v)); const k = cle(...q); if (!grille.has(k)) grille.set(k, []); grille.get(k).push([q[0], q[1], q[2], estBras]); }
  }
}
/** Distances au muscle de bras et au muscle de tronc les plus proches (recherche dans un rayon croissant). */
function distances(q) {
  let dB = Infinity, dT = Infinity;
  const [ix, iy, iz] = q.map((c) => Math.floor(c / CELLULE));
  for (let r = 0; r <= 6 && (dB === Infinity || dT === Infinity || r <= 2); r++) {
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
      if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
      for (const p of grille.get(`${ix + a},${iy + b},${iz + c}`) || []) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        if (p[3]) dB = Math.min(dB, d); else dT = Math.min(dT, d);
      }
    }
  }
  return [dB, dT];
}

// --- Déformation ---
const melange = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);
for (const n of nodes) {
  const nom = n.getName(), w = monde(n), l = local(n), v = [0, 0, 0], nv = [0, 0, 0];
  for (const p of n.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL');
    for (let i = 0; i < a.getCount(); i++) {
      const q = w(a.getElement(i, v));
      let poidsBras = 0;
      if (BRAS.test(nom)) poidsBras = 1;
      else if (nom === 'silhouette' && q[1] < 1.45 && Math.abs(q[0]) > 0.11) {
        const [dB, dT] = distances(q);
        poidsBras = dB === Infinity ? 0 : dT === Infinity ? 1 : lisse(-0.012, 0.012, dT - dB);
      }
      let r = poidsBras === 0 ? tronc(q) : poidsBras === 1 ? bras(q) : melange(tronc(q), bras(q), poidsBras);
      if (nom === 'silhouette' && N) r = poitrine(r, N.getElement(i, nv)[2] * (1 - poidsBras));
      r = r.map((c) => c * ECHELLE);
      a.setElement(i, l(r));
    }
  }
}

// Normales recalculées (moyenne des faces) pour un éclairage correct après déformation
for (const n of nodes) for (const p of n.getMesh().listPrimitives()) {
  const a = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), idx = p.getIndices()?.getArray();
  if (!N || !idx) continue;
  const acc = new Float32Array(a.getCount() * 3), A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (let f = 0; f < idx.length; f += 3) {
    a.getElement(idx[f], A); a.getElement(idx[f + 1], B); a.getElement(idx[f + 2], C);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [idx[f], idx[f + 1], idx[f + 2]]) for (let j = 0; j < 3; j++) acc[k * 3 + j] += c[j];
  }
  for (let i = 0; i < a.getCount(); i++) {
    const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2], m = Math.hypot(x, y, z) || 1;
    N.setElement(i, [x / m, y / m, z / m]);
  }
}

// Écrit sans compression : la compression meshopt se fait ensuite avec gltf-transform optimize (voir LISEZMOI.md)
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
await io.write(dst, doc);
console.log('écrit', dst);
