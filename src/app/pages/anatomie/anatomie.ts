import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../api';
import { Corps3d, webglDisponible } from '../../anatomie/corps3d';
import { MESURES, Mesure, NEUTRE, NOMS_ACTIVITES, RAMPES, bornes, interpreter, niveau, nf, themeSombre } from '../../anatomie/echelle';

/** Vue anatomique 3D : charge par muscle sur une période, fiche muscle, gestion des intitulés (admin). */
@Component({ selector: 'app-anatomie', standalone: true, imports: [FormsModule, RouterLink, Corps3d], templateUrl: './anatomie.html' })
export class Anatomie {
  api = inject(Api);
  private route = inject(ActivatedRoute);
  Math = Math; nf = nf; mesures = MESURES; nomsActivites = NOMS_ACTIVITES;
  periodes: [string, string][] = [['7j', '7 jours'], ['30j', '30 jours'], ['90j', '3 mois'], ['6m', '6 mois'], ['1an', '1 an'], ['tout', 'Tout']];
  periode = '90j';
  mesure: Mesure = 'nb_series';
  vue: any = null;
  referentiel: any[] = [];
  webgl = webglDisponible();
  selection: string | null = null;
  fiche: any = null;
  phrases: string[] = [];
  couleurs: Record<string, string> = {};
  sombre = themeSombre();
  private themeObs = new MutationObserver(() => { this.sombre = themeSombre(); this.colorer(); });

  constructor() {
    this.themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const q = this.route.snapshot.queryParamMap;
    if (q.get('periode')) this.periode = q.get('periode')!;
    this.selection = q.get('muscle');
    this.charger();
    if (this.selection) this.ouvrirFiche(this.selection);
    if (this.api.isAdmin) this.chargerLibelles();
  }
  ngOnDestroy() { this.themeObs.disconnect(); }

  async charger() {
    try {
      const [vue, ref] = await Promise.all([
        this.api.get(`/anatomie/vue?periode=${this.periode}`),
        this.referentiel.length ? Promise.resolve(this.referentiel) : this.api.get('/anatomie/muscles'),
      ]);
      this.vue = vue; this.referentiel = ref;
      this.colorer();
    } catch (e: any) { this.api.toast(e.message); }
  }

  choisirPeriode(p: string) { this.periode = p; this.charger(); if (this.selection) this.ouvrirFiche(this.selection); }
  choisirMesure(m: Mesure) { this.mesure = m; this.colorer(); }

  unite() { return MESURES.find((m) => m[0] === this.mesure)![2]; }
  max() { return this.vue?.maximums?.[this.mesure] || 0; }
  rampe() { return this.sombre ? RAMPES.sombre : RAMPES.clair; }
  neutre() { return this.sombre ? NEUTRE.sombre : NEUTRE.clair; }
  couleur(v: number) { const n = niveau(v, this.max()); return n < 0 ? this.neutre() : this.rampe()[n]; }
  legende() { return bornes(this.max()).map(([de, a], i) => ({ c: this.rampe()[i], de, a })); }
  /** Une décimale seulement si la légende en a besoin (petits maximums). */
  dec() { return this.max() < 10 ? 1 : 0; }

  private colorer() {
    if (!this.vue) return;
    this.couleurs = Object.fromEntries(this.vue.muscles.map((m: any) => [m.code, this.couleur(m[this.mesure])]));
    this.phrases = interpreter(this.vue, this.mesure, this.unite());
  }

  musclesTries() { return [...(this.vue?.muscles || [])].sort((a, b) => b[this.mesure] - a[this.mesure] || a.nom_fr.localeCompare(b.nom_fr)); }
  travailles() { return (this.vue?.muscles || []).filter((m: any) => m.nb_series > 0).length; }
  /** Des données existent mais pas sur cette période ? */
  videSurPeriode() { return this.vue && this.periode !== 'tout' && !this.travailles(); }
  activitesVisibles() { return (this.vue?.activites || []).filter((a: any) => a.nb_exercices > 0); }

  // ---------- Fiche muscle ----------
  choisir(code: string | null) {
    if (!code || code === this.selection) { this.fermer(); return; }
    this.selection = code;
    this.ouvrirFiche(code);
  }
  async ouvrirFiche(code: string) {
    try {
      const f = await this.api.get(`/anatomie/muscles/${encodeURIComponent(code)}?periode=${this.periode}`);
      if (this.selection === code) { this.fiche = f; this.edition = null; }
      setTimeout(() => document.getElementById('fiche-muscle')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (e: any) { this.api.toast(e.message); }
  }
  fermer() { this.selection = null; this.fiche = null; this.edition = null; }
  dateFr(d: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'; }
  depuis(d: string | null) {
    if (!d) return '';
    const j = Math.round((Date.now() - Date.parse(d + 'T12:00:00')) / 86400000);
    return j <= 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} jours`;
  }

  // ---------- Admin : texte de la fiche ----------
  edition: any = null;
  editer() { const m = this.fiche.muscle; this.edition = { nom_fr: m.nom_fr, description: m.description || '', vue: m.vue }; }
  async enregistrerMuscle() {
    try {
      const m = await this.api.put(`/anatomie/muscles/${this.fiche.muscle.code}`, this.edition);
      this.fiche.muscle = { ...this.fiche.muscle, ...m }; this.edition = null;
      this.referentiel = []; this.charger(); this.api.toast('Muscle enregistré');
    } catch (e: any) { this.api.toast(e.message); }
  }

  // ---------- Admin : intitulés du journal ----------
  libelles: any[] = [];
  filtreLib = '';
  edLib: any = null;
  activites = Object.entries(NOMS_ACTIVITES);
  async chargerLibelles() { try { this.libelles = await this.api.get('/anatomie/libelles'); } catch (e: any) { this.api.toast(e.message); } }
  libellesFiltres() { const f = this.filtreLib.trim().toUpperCase(); return this.libelles.filter((l) => !f || l.libelle.includes(f) || (l.nom_fr || '').toUpperCase().includes(f)); }
  resumeLib(l: any) { return l.type === 'activite' ? NOMS_ACTIVITES[l.activite] : l.muscles.map((m: any) => m.nom_fr + (m.part < 1 ? ` ${Math.round(m.part * 100)} %` : '')).join(', '); }
  editerLib(l: any) {
    this.edLib = l ? { libelle: l.libelle, nom_fr: l.nom_fr || '', type: l.type, activite: l.activite || 'cardio', codes: l.muscles.map((m: any) => m.code), nouveau: false }
      : { libelle: '', nom_fr: '', type: 'muscle', activite: 'cardio', codes: [], nouveau: true };
  }
  rattacher(libelle: string) { this.editerLib(null); this.edLib.libelle = libelle; document.getElementById('gestion-libelles')?.setAttribute('open', ''); }
  basculerCode(c: string) { const i = this.edLib.codes.indexOf(c); i < 0 ? this.edLib.codes.push(c) : this.edLib.codes.splice(i, 1); }
  async enregistrerLib() {
    const e = this.edLib;
    const corps = e.type === 'activite' ? { type: 'activite', activite: e.activite, nom_fr: e.nom_fr || undefined }
      : { type: 'muscle', nom_fr: e.nom_fr || undefined, muscles: e.codes.map((code: string) => ({ code })) };
    try {
      await this.api.put(`/anatomie/libelles/${encodeURIComponent(e.libelle.trim())}`, corps);
      this.edLib = null; this.api.toast('Intitulé enregistré'); this.chargerLibelles(); this.charger();
    } catch (x: any) { this.api.toast(x.message); }
  }
  async supprimerLib(libelle: string) {
    if (!confirm(`Supprimer l'intitulé ${libelle} ? Les exercices qui l'utilisent ne seront plus comptés.`)) return;
    try { await this.api.del(`/anatomie/libelles/${encodeURIComponent(libelle)}`); this.edLib = null; this.chargerLibelles(); this.charger(); }
    catch (x: any) { this.api.toast(x.message); }
  }
}
