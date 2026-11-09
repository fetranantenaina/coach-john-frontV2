import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';
import { HBars, d10 } from '../../shared';

@Component({ selector: 'app-seances', standalone: true, imports: [FormsModule, HBars], templateUrl: './seances.html' })
export class Seances {
  list: any[] = []; anat: any[] = []; ind: any = {}; exos: any[] = []; s: any = null;
  ns: any = {}; ni: any = {}; ne: any = {}; d10 = d10;
  cs = [['series', 'Séries'], ['rep_temps', 'Répétitions / temps (15, 20sec, 15mn)'], ['charge', 'Charge / niveau / vitesse (4kg, Lvl 2…)'], ['repos_secondes', 'Repos (s)'], ['cibles', 'Muscles ciblés (ex. CHEST, LATS)'], ['methode', 'Méthode (STRAIGHT SET, SUPERSET…)'], ['infos', 'Notes']];
  constructor(public api: Api) { this.load(); if (api.isAdmin) this.chargerCatalogue(); }
  // --- Calendrier : séances chargées mois par mois ---
  mois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  jourSel: string | null = null;
  semaine = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  private initialise = false;

  async load() {
    try {
      // Au premier affichage, on ouvre le mois de la dernière séance (plutôt qu'un mois vide)
      if (!this.initialise) {
        const derniere = await this.api.get('/seances?limit=1');
        if (derniere.length) this.mois = this.debutMois(d10(derniere[0].date_seance));
        this.initialise = true;
      }
      const [list, anat, ind] = await Promise.all([this.api.get(this.urlMois()), this.api.get('/vue-anatomique'), this.api.get('/indicateurs-athletiques/histogramme')]);
      this.list = list; this.anat = anat; this.ind = ind;
    } catch (e: any) { this.api.toast(e.message); }
  }
  private pad = (n: number) => String(n).padStart(2, '0');
  private cle(a: number, m: number, j: number) { return `${a}-${this.pad(m + 1)}-${this.pad(j)}`; }
  private debutMois(date: string) { return new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, 1); }
  urlMois() {
    const a = this.mois.getFullYear(), m = this.mois.getMonth(), fin = new Date(a, m + 1, 0).getDate();
    return `/seances?from=${this.cle(a, m, 1)}&to=${this.cle(a, m, fin)}`;
  }
  titreMois() { return this.mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }
  async changerMois(delta: number) {
    this.mois = new Date(this.mois.getFullYear(), this.mois.getMonth() + delta, 1);
    this.jourSel = null; await this.chargerMois();
  }
  async chargerMois() { try { this.list = await this.api.get(this.urlMois()); } catch (e: any) { this.api.toast(e.message); } }
  aujourdhui() {
    const n = new Date(); this.mois = new Date(n.getFullYear(), n.getMonth(), 1);
    this.jourSel = this.cle(n.getFullYear(), n.getMonth(), n.getDate()); this.chargerMois();
  }
  /** Va au mois d'une date et sélectionne ce jour (après la création d'une séance). */
  allerA(date: any) { const d = d10(date); if (d) { this.mois = this.debutMois(d); this.jourSel = d; } }
  choisir(date: string) { this.jourSel = this.jourSel === date ? null : date; }
  /** Cases du mois, du lundi au dimanche : cases vides avant le 1er, puis un objet par jour. */
  cases() {
    const a = this.mois.getFullYear(), m = this.mois.getMonth();
    const decalage = (new Date(a, m, 1).getDay() + 6) % 7, nbJours = new Date(a, m + 1, 0).getDate();
    const nb: Record<string, number> = {};
    for (const x of this.list) { const k = d10(x.date_seance); nb[k] = (nb[k] || 0) + 1; }
    const auj = new Date(), cleAuj = this.cle(auj.getFullYear(), auj.getMonth(), auj.getDate());
    const cases: any[] = Array.from({ length: decalage }, () => ({}));
    for (let j = 1; j <= nbJours; j++) { const date = this.cle(a, m, j); cases.push({ date, jour: j, nb: nb[date] || 0, auj: date === cleAuj }); }
    return cases;
  }
  points(n: number) { return Array(Math.min(n, 3)); }
  /** Séances affichées en cards : le jour choisi, sinon tout le mois (ordre chronologique). */
  listeAffichee() {
    const l = this.jourSel ? this.list.filter(x => d10(x.date_seance) === this.jourSel) : [...this.list];
    return l.sort((x, y) => d10(x.date_seance).localeCompare(d10(y.date_seance)) || x.id - y.id);
  }
  jour(date: any) { return d10(date).slice(8, 10); }
  moisCourt(date: any) { const d = d10(date); return new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''); }
  libelleJour(date: string) { return new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
  // --- Recherche croisée dans le référentiel (nom, groupe musculaire, méthode) ---
  catalogue: any[] = [];
  private cache: any = null;
  private cleCache = '';
  norm = (s: any) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  private uniques(a: string[]) { const vu = new Set<string>(), r: string[] = []; for (const x of a) { const v = String(x || '').trim().toUpperCase(); if (v && !vu.has(v)) { vu.add(v); r.push(v); } } return r; }
  async chargerCatalogue() {
    let lignes: any[] = [];
    try { lignes = await this.api.get('/exercices/catalogue'); }
    catch { try { lignes = await this.api.get('/exercices'); } catch (e: any) { this.api.toast(e.message); } } // ancien backend : groupes et méthodes du référentiel seulement
    this.catalogue = lignes.map((e) => ({
      id: e.id, nom: e.nom, nomN: this.norm(e.nom),
      groupes: this.uniques([...String(e.groupe_musculaire || '').split(','), ...(e.groupes_utilises || [])]),
      methodes: this.uniques([e.methode || '', ...(e.methodes_utilisees || [])]),
    }));
    this.cache = null;
  }
  /** Exercices correspondant aux trois champs, et groupes / méthodes / noms « possibles » déduits de ces résultats. */
  vue() {
    const nom = this.norm(this.nx.nom), grp = this.norm(this.nx.groupe_musculaire), met = this.norm(this.nx.methode);
    const cle = `${nom}|${grp}|${met}|${this.catalogue.length}`;
    if (this.cache && this.cleCache === cle) return this.cache;
    const res = this.catalogue.filter((e) => (!nom || e.nomN.includes(nom)) && (!grp || e.groupes.some((g: string) => this.norm(g).includes(grp))) && (!met || e.methodes.some((m: string) => this.norm(m).includes(met))));
    const compte = (k: 'groupes' | 'methodes') => { const c = new Map<string, number>(); for (const e of res) for (const v of e[k]) c.set(v, (c.get(v) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
    this.cleCache = cle;
    return (this.cache = { n: res.length, exercices: res.slice(0, 20), groupes: compte('groupes'), methodes: compte('methodes'), existant: nom ? this.catalogue.find((e) => e.nomN === nom) || null : null });
  }
  choisirNom(n: string) { this.nx.nom = n; }
  choisirGroupe(g: string) { this.nx.groupe_musculaire = this.norm(this.nx.groupe_musculaire) === this.norm(g) ? '' : g; }
  choisirMethode(m: string) { this.nx.methode = this.norm(this.nx.methode) === this.norm(m) ? '' : m; }
  anatRows(): [string, number][] { return this.anat.map(a => [a.groupe_musculaire || 'autre', Number(a.nb_series_total) || Number(a.nb_exercices)]); }
  indRows(): [string, number][] { const l = (a: any[]) => Number(a[a.length - 1]) || 0; return [['Force', l(this.ind.force)], ['Endurance', l(this.ind.endurance)], ['Résistance', l(this.ind.resistance)], ['Puissance', l(this.ind.puissance)]]; }
  nx: any = {};
  async creerExo() { try { await this.api.post('/exercices', this.api.clean(this.nx)); this.nx = {}; this.api.toast('Exercice ajouté'); this.chargerCatalogue(); } catch (e: any) { this.api.toast(e.message); } }
  async creer() { try { const r = await this.api.post('/seances', this.api.clean(this.ns)); this.ns = {}; this.allerA(r.date_seance); this.ouvrir(r.id); } catch (e: any) { this.api.toast(e.message); } }
  async ouvrir(id: number) { try { [this.s, this.exos] = await Promise.all([this.api.get('/seances/' + id), this.api.get('/exercices')]); this.ne = { exercice_id: this.exos[0]?.id }; } catch (e: any) { this.api.toast(e.message); } }
  async ajouter() { try { await this.api.post(`/seances/${this.s.id}/exercices`, this.api.clean(this.ne)); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async fait(e: any, v: boolean) { try { await this.api.patch(`/seance-exercices/${e.id}/fait`, { fait: v }); e.fait = v; } catch (x: any) { this.api.toast(x.message); } }
  async retirer(id: number) { try { await this.api.del('/seance-exercices/' + id); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async saveInd() { try { await this.api.post('/indicateurs-athletiques', this.api.clean(this.ni)); this.ni = {}; this.api.toast('Enregistré'); this.load(); } catch (e: any) { this.api.toast(e.message); } }
}
