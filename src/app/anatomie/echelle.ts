// Échelle de couleur de la charge musculaire et phrases d'interprétation de la vue anatomique.

/** Rampe séquentielle à une teinte (validée : clarté monotone, écarts ≥ 0,06, 1er pas ≥ 2:1 sur le fond).
 *  Clair : du clair au foncé. Sombre : ancrage inversé, du sombre au lumineux. */
export const RAMPES = {
  clair: ['#d9a560', '#c98a3c', '#b06e22', '#8c5216', '#66380c'],
  sombre: ['#6b5331', '#8f6a30', '#b8862f', '#dea545', '#f7c96d'],
};
/** Muscle suivi mais pas travaillé sur la période (gris, hors rampe). */
export const NEUTRE = { clair: '#bfbab0', sombre: '#55534b' };

export type Mesure = 'nb_series' | 'volume_kg' | 'nb_seances';
export const MESURES: [Mesure, string, string][] = [
  ['nb_series', 'Séries', 'séries'],
  ['volume_kg', 'Volume', 'kg'],
  ['nb_seances', 'Séances', 'séances'],
];

export function themeSombre(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Niveau 0..4 d'une valeur (par rapport au maximum de la période), -1 si non travaillé. */
export function niveau(v: number, max: number): number {
  if (!v || !max) return -1;
  return Math.min(4, Math.ceil((v / max) * 5) - 1);
}

/** Bornes des 5 niveaux, pour la légende : [de, à] */
export function bornes(max: number): [number, number][] {
  return [0, 1, 2, 3, 4].map((i) => [(max * i) / 5, (max * (i + 1)) / 5]);
}

export const nf = (v: number, dec = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: dec });

const somme = (m: Record<string, number>, codes: string[]) => codes.reduce((s, c) => s + (m[c] || 0), 0);
const liste = (noms: string[]) => (noms.length <= 1 ? noms.join('') : noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1]);

const HAUT = ['pectoral_claviculaire', 'grand_pectoral', 'deltoide_anterieur', 'deltoide_lateral', 'deltoide_posterieur', 'biceps', 'triceps',
  'avant_bras', 'grand_dorsal', 'trapeze_superieur', 'trapeze_moyen', 'trapeze_inferieur', 'rhomboides'];
const BAS = ['grand_fessier', 'moyen_fessier', 'tenseur_fascia_lata', 'adducteurs', 'quadriceps', 'ischio_jambiers', 'mollets'];
const POUSSEE = ['pectoral_claviculaire', 'grand_pectoral', 'deltoide_anterieur'];
const TIRAGE = ['grand_dorsal', 'trapeze_moyen', 'rhomboides', 'deltoide_posterieur'];

/**
 * Phrases simples sur la période : muscles dominants, oubliés, équilibres haut/bas, poussée/tirage,
 * avant/arrière de cuisse, et activités hors du corps. Fondées sur les séries (comparables d'un muscle à l'autre).
 */
export function interpreter(vue: any, mesure: Mesure, uniteMesure: string): string[] {
  const muscles: any[] = vue?.muscles || [];
  const travailles = muscles.filter((m) => m.nb_series > 0);
  if (!travailles.length) return ['Aucun exercice coché « fait » sur cette période : le corps reste gris.'];

  const phrases: string[] = [];
  const tries = [...travailles].sort((a, b) => b[mesure] - a[mesure]);
  const top = tries.slice(0, 3);
  phrases.push(`Les plus travaillés : ${liste(top.map((m) => `${m.nom_fr} (${nf(m[mesure])} ${uniteMesure})`))}.`);

  const oublies = muscles.filter((m) => !m.nb_series).map((m) => m.nom_fr);
  if (oublies.length && oublies.length <= 6) phrases.push(`Pas travaillés sur la période : ${liste(oublies)}.`);
  else if (oublies.length > 6) phrases.push(`${oublies.length} muscles sur ${muscles.length} n'ont pas été travaillés sur la période.`);

  const s: Record<string, number> = Object.fromEntries(muscles.map((m) => [m.code, m.nb_series]));
  const haut = somme(s, HAUT), bas = somme(s, BAS);
  if (haut + bas > 0) {
    const pBas = Math.round((bas / (haut + bas)) * 100);
    phrases.push(pBas >= 65 ? `Le bas du corps reçoit ${pBas} % des séries des membres : programme centré sur les jambes et les fessiers.`
      : pBas <= 35 ? `Le haut du corps reçoit ${100 - pBas} % des séries des membres : programme centré sur le haut.`
        : `Haut et bas du corps sont travaillés de façon équilibrée (${100 - pBas} % / ${pBas} %).`);
  }

  const pousse = somme(s, POUSSEE), tire = somme(s, TIRAGE);
  if (pousse + tire >= 6) {
    if (pousse > tire * 1.25) phrases.push(`Plus de poussée (pectoraux, épaule avant : ${nf(pousse)} séries) que de tirage (dos : ${nf(tire)}). Ajouter du dos aide à protéger les épaules et la posture.`);
    else if (tire >= pousse) phrases.push(`Le tirage (dos : ${nf(tire)} séries) égale ou dépasse la poussée (${nf(pousse)}) : bon équilibre pour les épaules.`);
  }

  const quad = s['quadriceps'] || 0, ischio = s['ischio_jambiers'] || 0;
  if (quad + ischio >= 6) {
    if (ischio < quad * 0.5) phrases.push(`L'arrière de la cuisse (${nf(ischio)} séries) est bien moins travaillé que l'avant (${nf(quad)}) : à rééquilibrer pour les genoux.`);
    else if (quad < ischio * 0.5) phrases.push(`L'avant de la cuisse (${nf(quad)} séries) est bien moins travaillé que l'arrière (${nf(ischio)}).`);
  }

  const fin = vue?.periode?.to || new Date().toISOString().slice(0, 10);
  const anciens = travailles.filter((m) => m.derniere_sollicitation && jours(m.derniere_sollicitation, fin) > 21);
  if (anciens.length && anciens.length <= 4) {
    phrases.push(`Plus travaillés depuis plus de 3 semaines : ${liste(anciens.map((m) => m.nom_fr))}.`);
  }

  const cardio = (vue?.activites || []).find((a: any) => a.activite === 'cardio');
  if (cardio?.nb_seances) phrases.push(`Cardio : ${cardio.nb_seances} séance${cardio.nb_seances > 1 ? 's' : ''}${cardio.minutes ? `, ${nf(cardio.minutes)} min au total` : ''}.`);
  return phrases;
}

export function jours(de: string, a: string) {
  return Math.round((Date.parse(a) - Date.parse(de)) / 86400000);
}

export const NOMS_ACTIVITES: Record<string, string> = {
  cardio: 'Cardio', echauffement: 'Échauffement', recuperation: 'Récupération', qualite: 'Qualités athlétiques',
};
