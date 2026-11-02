import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';
import { HBars, d10 } from '../../shared';

@Component({ selector: 'app-seances', standalone: true, imports: [FormsModule, HBars], templateUrl: './seances.html' })
export class Seances {
  list: any[] = []; anat: any[] = []; ind: any = {}; exos: any[] = []; s: any = null;
  ns: any = {}; ni: any = {}; ne: any = {}; d10 = d10;
  cs = [['series', 'Séries'], ['rep_temps', 'Répétitions / temps (15, 20sec, 15mn)'], ['charge', 'Charge / niveau / vitesse (4kg, Lvl 2…)'], ['repos_secondes', 'Repos (s)'], ['cibles', 'Muscles ciblés (ex. CHEST, LATS)'], ['infos', 'Notes']];
  rechercheExercice = ''; filtreGroupe = ''; filtreMethode = '';
  constructor(public api: Api) { this.load(); }
  async load() {
    try { [this.list, this.anat, this.ind] = await Promise.all([this.api.get('/seances?limit=100'), this.api.get('/vue-anatomique'), this.api.get('/indicateurs-athletiques/histogramme')]); } catch (e: any) { this.api.toast(e.message); }
  }

  /** Liste filtrée : le nom, le groupe et la méthode se recoupent entre eux. */
  exercicesFiltres() {
    const q = this.rechercheExercice.trim().toLocaleLowerCase();
    return this.exos.filter(x =>
      (!q || String(x.nom || '').toLocaleLowerCase().includes(q)) &&
      (!this.filtreGroupe || x.groupe_musculaire === this.filtreGroupe) &&
      (!this.filtreMethode || x.methode === this.filtreMethode)
    );
  }
  groupesDisponibles() {
    const q = this.rechercheExercice.trim().toLocaleLowerCase();
    return [...new Set(this.exos.filter(x =>
      (!q || String(x.nom || '').toLocaleLowerCase().includes(q)) &&
      (!this.filtreMethode || x.methode === this.filtreMethode)
    ).map(x => x.groupe_musculaire).filter(Boolean))].sort();
  }
  methodesDisponibles() {
    const q = this.rechercheExercice.trim().toLocaleLowerCase();
    return [...new Set(this.exos.filter(x =>
      (!q || String(x.nom || '').toLocaleLowerCase().includes(q)) &&
      (!this.filtreGroupe || x.groupe_musculaire === this.filtreGroupe)
    ).map(x => x.methode).filter(Boolean))].sort();
  }
  exerciceSelectionne() { return this.exos.find(x => x.id == this.ne.exercice_id) || null; }
  selectionnerExercice(id: any) {
    const x = this.exos.find(e => e.id == id);
    if (x) this.ne.exercice_id = x.id;
    if (!x) { this.ne.methode = ''; return; }
    this.filtreGroupe = x.groupe_musculaire || '';
    this.filtreMethode = x.methode || '';
    this.ne.methode = x.methode || '';
    this.ne.cibles = x.groupe_musculaire || '';
  }
  rechercherExerciceChange() {
    if (!this.exercicesFiltres().some(x => x.id == this.ne.exercice_id)) {
      this.ne.exercice_id = null; this.ne.methode = ''; this.ne.cibles = '';
    }
  }
  changerGroupe(g: string) {
    this.filtreGroupe = g;
    if (!this.exercicesFiltres().some(x => x.id == this.ne.exercice_id)) {
      this.ne.exercice_id = null; this.ne.methode = ''; this.ne.cibles = '';
    }
  }
  changerMethode(m: string) {
    this.filtreMethode = m;
    if (!this.exercicesFiltres().some(x => x.id == this.ne.exercice_id)) {
      this.ne.exercice_id = null; this.ne.methode = ''; this.ne.cibles = '';
    }
  }
    anatRows(): [string, number][] { return this.anat.map(a => [a.groupe_musculaire || 'autre', Number(a.nb_series_total) || Number(a.nb_exercices)]); }
  indRows(): [string, number][] { const l = (a: any[]) => Number(a[a.length - 1]) || 0; return [['Force', l(this.ind.force)], ['Endurance', l(this.ind.endurance)], ['Résistance', l(this.ind.resistance)], ['Puissance', l(this.ind.puissance)]]; }
  nx: any = {};
  async creerExo() { try { await this.api.post('/exercices', this.api.clean(this.nx)); this.nx = {}; this.api.toast('Exercice ajouté'); } catch (e: any) { this.api.toast(e.message); } }
  async creer() { try { const r = await this.api.post('/seances', this.api.clean(this.ns)); this.ns = {}; this.ouvrir(r.id); } catch (e: any) { this.api.toast(e.message); } }
  async ouvrir(id: number) { try { [this.s, this.exos] = await Promise.all([this.api.get('/seances/' + id), this.api.get('/exercices')]); this.rechercheExercice = ''; this.filtreGroupe = ''; this.filtreMethode = ''; this.ne = { exercice_id: null }; } catch (e: any) { this.api.toast(e.message); } }
  async ajouter() { try { await this.api.post(`/seances/${this.s.id}/exercices`, this.api.clean(this.ne)); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async fait(e: any, v: boolean) { try { await this.api.patch(`/seance-exercices/${e.id}/fait`, { fait: v }); e.fait = v; } catch (x: any) { this.api.toast(x.message); } }
  async retirer(id: number) { try { await this.api.del('/seance-exercices/' + id); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async saveInd() { try { await this.api.post('/indicateurs-athletiques', this.api.clean(this.ni)); this.ni = {}; this.api.toast('Enregistré'); this.load(); } catch (e: any) { this.api.toast(e.message); } }
}
