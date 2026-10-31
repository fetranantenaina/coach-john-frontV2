import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';
import { HBars, d10 } from '../../shared';

@Component({ selector: 'app-seances', standalone: true, imports: [FormsModule, HBars], templateUrl: './seances.html' })
export class Seances {
  list: any[] = []; anat: any[] = []; ind: any = {}; exos: any[] = []; s: any = null;
  ns: any = {}; ni: any = {}; ne: any = {}; d10 = d10;
  cs = [['series', 'Séries'], ['rep_temps', 'Répétitions / temps (15, 20sec, 15mn)'], ['charge', 'Charge / niveau / vitesse (4kg, Lvl 2…)'], ['repos_secondes', 'Repos (s)'], ['cibles', 'Muscles ciblés (ex. CHEST, LATS)'], ['methode', 'Méthode (STRAIGHT SET, SUPERSET…)'], ['infos', 'Notes']];
  constructor(public api: Api) { this.load(); }
  async load() {
    try { [this.list, this.anat, this.ind] = await Promise.all([this.api.get('/seances?limit=100'), this.api.get('/vue-anatomique'), this.api.get('/indicateurs-athletiques/histogramme')]); } catch (e: any) { this.api.toast(e.message); }
  }
  anatRows(): [string, number][] { return this.anat.map(a => [a.groupe_musculaire || 'autre', Number(a.nb_series_total) || Number(a.nb_exercices)]); }
  indRows(): [string, number][] { const l = (a: any[]) => Number(a[a.length - 1]) || 0; return [['Force', l(this.ind.force)], ['Endurance', l(this.ind.endurance)], ['Résistance', l(this.ind.resistance)], ['Puissance', l(this.ind.puissance)]]; }
  nx: any = {};
  async creerExo() { try { await this.api.post('/exercices', this.api.clean(this.nx)); this.nx = {}; this.api.toast('Exercice ajouté'); } catch (e: any) { this.api.toast(e.message); } }
  async creer() { try { const r = await this.api.post('/seances', this.api.clean(this.ns)); this.ns = {}; this.ouvrir(r.id); } catch (e: any) { this.api.toast(e.message); } }
  async ouvrir(id: number) { try { [this.s, this.exos] = await Promise.all([this.api.get('/seances/' + id), this.api.get('/exercices')]); this.ne = { exercice_id: this.exos[0]?.id }; } catch (e: any) { this.api.toast(e.message); } }
  async ajouter() { try { await this.api.post(`/seances/${this.s.id}/exercices`, this.api.clean(this.ne)); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async fait(e: any, v: boolean) { try { await this.api.patch(`/seance-exercices/${e.id}/fait`, { fait: v }); e.fait = v; } catch (x: any) { this.api.toast(x.message); } }
  async retirer(id: number) { try { await this.api.del('/seance-exercices/' + id); this.ouvrir(this.s.id); } catch (e: any) { this.api.toast(e.message); } }
  async saveInd() { try { await this.api.post('/indicateurs-athletiques', this.api.clean(this.ni)); this.ni = {}; this.api.toast('Enregistré'); this.load(); } catch (e: any) { this.api.toast(e.message); } }
}
