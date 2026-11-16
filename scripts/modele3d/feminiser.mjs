// Usage : node feminiser.mjs corps.glb corps-femme.brut.glb   (puis compression : voir LISEZMOI.md)
// (dépendances : @gltf-transform/core@4.1.1, @gltf-transform/extensions@4.1.1, meshoptimizer@0.22.0)
//
// Construit la variante féminine du corps à partir de corps.glb, en déformant tous les maillages
// avec le même champ (les muscles restent donc sous la peau et gardent leurs noms / codes) :
//   - muscles moins épais (haut du corps surtout, abdos, jambes, cou et dentelés du « contexte ») : seule la face
//     extérieure rentre, d'une fraction de l'épaisseur locale du muscle (il reste collé au corps) ;
//   - relief des muscles adouci (lissage de Taubin, sans perte de volume) ;
//   - peau : graisse sous-cutanée sur les hanches, les fesses et les cuisses ;
//   - tronc : épaules et taille plus étroites, bassin plus large, fessiers plus ronds, cou plus fin ;
//   - jambes : cuisses qui convergent vers les genoux (angle Q plus marqué), genoux plus fins ;
//   - bras : translatés avec l'épaule, légèrement écartés (les mains passent au-dessus des hanches), un peu plus fins ;
//   - peau (silhouette) uniquement : poitrine en goutte (pente douce au-dessus, plus pleine en bas, pli sous-mammaire).
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
// (sous le bassin : x resserré jusqu'aux genoux, ce qui fait converger les cuisses sans croiser les jambes)
const SX = [[0.05, 0.97], [0.25, 0.94], [0.48, 0.91], [0.62, 0.96], [0.76, 1.03], [0.90, 1.08], [1.00, 1.0], [1.10, 0.88], [1.22, 0.90], [1.42, 0.90], [1.50, 0.86], [1.58, 0.94], [1.70, 0.96]];
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
  let px = cx + (ax - cx) * 0.96, pz = cz + (z - cz) * 0.96; // bras plus fin (−4 %, en plus de l'affinage des muscles)
  px -= EPAULE.x * 0.10; // l'épaule rentre avec le tronc
  const pivotX = EPAULE.x * 0.90, dx = px - pivotX, dy = y - EPAULE.y;
  const rx = pivotX + dx * Math.cos(ANGLE) - dy * Math.sin(ANGLE);
  const ry = EPAULE.y + dx * Math.sin(ANGLE) + dy * Math.cos(ANGLE);
  return [s * rx, ry, pz];
}

// Graisse sous-cutanée (peau seulement) : répartition féminine sur les hanches, les fesses et les cuisses (épaisseur en m)
const GRAISSE = [[0.45, 0], [0.62, 0.004], [0.80, 0.007], [0.92, 0.006], [1.02, 0.003], [1.10, 0]];

// Poitrine (peau seulement), en goutte : longue pente douce au-dessus, volume en bas, pli net dessous,
// légèrement tournée vers l'extérieur. Coordonnées après la déformation du tronc.
function poitrine([x, y, z], nz) {
  if (nz <= 0.1) return [x, y, z];
  let d = 0;
  for (const cx of [-0.098, 0.098]) {
    const dy = y - 1.232, sy = dy > 0 ? 0.075 : 0.036;
    const r2 = ((x - cx) ** 2) / (0.056 ** 2) + (dy * dy) / (sy * sy);
    d += Math.exp(-r2 / 2);
  }
  d = Math.min(1, d) * Math.min(1, nz * 1.4);
  return [x + Math.sign(x) * 0.01 * d, y - 0.008 * d, z + 0.05 * d];
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

// --- Muscles moins épais ---
// Repères : chez la femme, la masse musculaire vaut environ 60-70 % de celle de l'homme pour le haut du corps,
// 70-75 % pour le bas. Pour chaque sommet de la face extérieure d'un muscle (celle tournée vers la peau), on mesure
// l'épaisseur du muscle par un rayon lancé vers l'intérieur, puis on recule le sommet d'une fraction de cette
// épaisseur (8 mm max). La face profonde (contre les os) ne bouge pas : le muscle reste attaché au squelette.
const AFFINER = {
  // haut du corps
  grand_pectoral: 0.32, pectoral_claviculaire: 0.32, deltoide_anterieur: 0.28, deltoide_lateral: 0.28, deltoide_posterieur: 0.28,
  biceps: 0.28, triceps: 0.25, avant_bras: 0.15, trapeze_superieur: 0.28, trapeze_moyen: 0.2, trapeze_inferieur: 0.2, grand_dorsal: 0.2,
  rhomboides: 0.12,
  // tronc
  grand_droit: 0.2, obliques: 0.15,
  // bas du corps (moins réduit ; fessiers conservés)
  quadriceps: 0.12, ischio_jambiers: 0.1, adducteurs: 0.08, mollets: 0.12, tenseur_fascia_lata: 0.1,
};
/** « contexte » (tous les autres muscles en un seul maillage) : fraction selon la hauteur (cou, dentelés, coiffe...). */
const AFFINER_CONTEXTE = [[0.5, 0.08], [0.85, 0.1], [1.0, 0.12], [1.15, 0.18], [1.42, 0.25], [1.52, 0.25], [1.6, 0]];
const OFFSET_MAX = 0.008;
{
  const peau = nodes.find((n) => n.getName() === 'silhouette').getMesh().listPrimitives()[0].getAttribute('POSITION');
  const C = 0.02, g = new Map();
  const k = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`;
  for (let i = 0; i < peau.getCount(); i++) { const q = peau.getElement(i, [0, 0, 0]); const c = k(...q); if (!g.has(c)) g.set(c, []); g.get(c).push(q); }
  const distPeau = (q) => {
    let m = Infinity; const [ix, iy, iz] = q.map((c) => Math.floor(c / C));
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++)
      for (const p of g.get(`${ix + a},${iy + b},${iz + c}`) || []) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    return m;
  };
  // Möller–Trumbore : distance le long du rayon (o, d) jusqu'au triangle, ou Infinity
  const rayon = (o, d, A, B, Cc) => {
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-12) return Infinity;
    const inv = 1 / det, s = [o[0] - A[0], o[1] - A[1], o[2] - A[2]];
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv; if (u < 0 || u > 1) return Infinity;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const w = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv; if (w < 0 || u + w > 1) return Infinity;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv; return t > 1e-4 ? t : Infinity;
  };
  const LONG = 0.08, CT = 0.015; // longueur max du rayon, taille des cellules de la grille de triangles
  let bouges = 0;
  for (const n of nodes) {
    const nom = n.getName().replace(/_[gd]$/, '');
    const fracDe = nom === 'contexte' ? (q) => courbe(AFFINER_CONTEXTE, q[1]) : AFFINER[nom] ? () => AFFINER[nom] : null;
    if (!fracDe) continue;
    for (const p of n.getMesh().listPrimitives()) {
      const a = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), idx = p.getIndices().getArray();
      const P = Array.from({ length: a.getCount() }, (_, i) => a.getElement(i, [0, 0, 0]));
      // grille des triangles (chaque triangle rangé dans les cellules que couvre sa boîte)
      const gt = new Map(), kc = (x, y, z) => `${x},${y},${z}`;
      for (let f = 0; f < idx.length; f += 3) {
        const A = P[idx[f]], B = P[idx[f + 1]], D = P[idx[f + 2]];
        const mn = [0, 1, 2].map((j) => Math.floor(Math.min(A[j], B[j], D[j]) / CT)), mx = [0, 1, 2].map((j) => Math.floor(Math.max(A[j], B[j], D[j]) / CT));
        for (let x = mn[0]; x <= mx[0]; x++) for (let y = mn[1]; y <= mx[1]; y++) for (let z = mn[2]; z <= mx[2]; z++) {
          const c = kc(x, y, z); if (!gt.has(c)) gt.set(c, []); gt.get(c).push(f);
        }
      }
      const vu = new Int32Array(idx.length / 3).fill(-1);
      const dep = P.map((q, i) => {
        const frac = fracDe(q); if (!frac) return null;
        const nn = N.getElement(i, [0, 0, 0]);
        const dehors = distPeau([q[0] + nn[0] * 0.004, q[1] + nn[1] * 0.004, q[2] + nn[2] * 0.004]);
        const dedans = distPeau([q[0] - nn[0] * 0.004, q[1] - nn[1] * 0.004, q[2] - nn[2] * 0.004]);
        if (!(dehors < dedans)) return null; // face profonde ou muscle loin de la peau : ne bouge pas
        const d = [-nn[0], -nn[1], -nn[2]]; let t = Infinity;
        for (let s = 0; s <= LONG; s += CT / 2) {
          const c = kc(...[0, 1, 2].map((j) => Math.floor((q[j] + d[j] * s) / CT)));
          for (const f of gt.get(c) || []) {
            if (vu[f / 3] === i) continue; vu[f / 3] = i;
            if (idx[f] === i || idx[f + 1] === i || idx[f + 2] === i) continue;
            t = Math.min(t, rayon(q, d, P[idx[f]], P[idx[f + 1]], P[idx[f + 2]]));
          }
          if (t < s) break;
        }
        if (!isFinite(t) || t > LONG) return null;
        const o = Math.min(frac * t, OFFSET_MAX);
        return [q[0] + d[0] * o, q[1] + d[1] * o, q[2] + d[2] * o];
      });
      dep.forEach((q, i) => { if (q) { a.setElement(i, q); bouges++; } });
    }
  }
  console.log('sommets de muscles affinés :', bouges);
}

// --- Relief adouci : lissage de Taubin (lambda / mu, sans rétrécissement) des muscles ---
// Les muscles féminins paraissent moins « sculptés » (striations, tablette d'abdos). Les sommets en double
// (coutures) sont soudés par position pour ne pas déchirer le maillage ; les bords ouverts ne bougent pas.
{
  const PASSES = 3, LAMBDA = 0.45, MU = -0.47;
  let lisses = 0;
  for (const n of nodes) {
    if (n.getName() === 'silhouette') continue;
    for (const p of n.getMesh().listPrimitives()) {
      const a = p.getAttribute('POSITION'), idx = p.getIndices().getArray(), nb = a.getCount();
      const P = Array.from({ length: nb }, (_, i) => a.getElement(i, [0, 0, 0]));
      const ids = new Map(), soude = new Int32Array(nb);
      P.forEach((q, i) => { const c = q.map((x) => Math.round(x * 1e5)).join(','); if (!ids.has(c)) ids.set(c, ids.size); soude[i] = ids.get(c); });
      const m = ids.size, voisins = Array.from({ length: m }, () => new Set()), aretes = new Map();
      for (let f = 0; f < idx.length; f += 3) for (let e = 0; e < 3; e++) {
        const u = soude[idx[f + e]], v = soude[idx[f + (e + 1) % 3]]; if (u === v) continue;
        voisins[u].add(v); voisins[v].add(u);
        const c = u < v ? u + ',' + v : v + ',' + u; aretes.set(c, (aretes.get(c) || 0) + 1);
      }
      const bord = new Uint8Array(m);
      for (const [c, nbf] of aretes) if (nbf === 1) { const [u, v] = c.split(',').map(Number); bord[u] = bord[v] = 1; }
      let Q = new Array(m); P.forEach((q, i) => (Q[soude[i]] = q.slice()));
      const passe = (f) => {
        Q = Q.map((q, u) => {
          if (bord[u] || !voisins[u].size) return q;
          const c = [0, 0, 0]; for (const v of voisins[u]) for (let j = 0; j < 3; j++) c[j] += Q[v][j];
          return q.map((x, j) => x + f * (c[j] / voisins[u].size - x));
        });
      };
      for (let k = 0; k < PASSES; k++) { passe(LAMBDA); passe(MU); }
      for (let i = 0; i < nb; i++) a.setElement(i, Q[soude[i]]);
      lisses += m;
    }
  }
  console.log('sommets lissés :', lisses);
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
      if (nom === 'silhouette' && N) {
        const nn = N.getElement(i, nv), e = courbe(GRAISSE, q[1]) * (1 - poidsBras);
        r = poitrine([r[0] + nn[0] * e, r[1] + nn[1] * e, r[2] + nn[2] * e], nn[2] * (1 - poidsBras));
      }
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
