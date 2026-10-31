import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';
import { Bars, d10 } from '../../shared';

@Component({ selector: 'app-profil', standalone: true, imports: [FormsModule, Bars], templateUrl: './profil.html' })
export class Profil {
  p: any = {}; info: any; reco: any; r: any = {}; dernier: any; hist: any = {}; d10 = d10;
  champs = [['poids_kg', 'Poids (kg)'], ['taille_cm', 'Taille (cm)'], ['cou_cm', 'Cou'], ['poitrine_cm', 'Poitrine'], ['taille_tour_cm', 'Tour de taille'], ['bras_gauche_cm', 'Bras gauche'], ['bras_droit_cm', 'Bras droit'], ['fessiers_cm', 'Fessiers'], ['cuisses_cm', 'Cuisses'], ['mollet_gauche_cm', 'Mollet gauche'], ['mollet_droit_cm', 'Mollet droit']];
  constructor(public api: Api) { this.load(); }
  get mens() { return this.champs.slice(2); }
  labs() { return this.hist.dates.map((x: any) => d10(x).slice(5)); }
  async load() {
    try { this.info = await this.api.get('/profil'); this.p = { ...this.info, date_naissance: d10(this.info.date_naissance) }; } catch {}
    try { this.reco = await this.api.get('/nutrition/recommandations'); } catch { this.reco = null; }
    try { this.dernier = await this.api.get('/releves/dernier'); } catch {}
    try { this.hist = await this.api.get('/releves/histogramme'); } catch {}
  }
  async saveProfil() {
    try { const { sexe, date_naissance, pal, objectif, statut_sante } = this.p; await this.api.post('/profil', this.api.clean({ sexe, date_naissance, pal, objectif, statut_sante })); this.api.toast('Profil enregistré'); this.load(); }
    catch (e: any) { this.api.toast(e.message); }
  }
  async saveReleve() {
    try { await this.api.post('/releves', this.api.clean(this.r)); this.r = {}; this.api.toast('Relevé ajouté'); this.load(); }
    catch (e: any) { this.api.toast(e.message); }
  }
}
