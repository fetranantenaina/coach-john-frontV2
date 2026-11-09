import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';
import { d10 } from '../../shared';
import { Courbe } from '../../courbe';

@Component({ selector: 'app-profil', standalone: true, imports: [FormsModule, Courbe], templateUrl: './profil.html' })
export class Profil {
  p: any = {}; info: any; reco: any; r: any = {}; dernier: any; hist: any = {}; d10 = d10;
  champs = [['poids_kg', 'Poids (kg)'], ['taille_cm', 'Taille (cm)'], ['cou_cm', 'Cou'], ['poitrine_cm', 'Poitrine'], ['taille_tour_cm', 'Tour de taille'], ['bras_gauche_cm', 'Bras gauche'], ['bras_droit_cm', 'Bras droit'], ['fessiers_cm', 'Fessiers'], ['cuisses_cm', 'Cuisses'], ['mollet_gauche_cm', 'Mollet gauche'], ['mollet_droit_cm', 'Mollet droit']];
  constructor(public api: Api) { this.load(); }
  groupes: any[] = []; sel = 'poids';
  /** Courbes proposées : poids, IMC, masse grasse, puis les mensurations du haut et du bas du corps. */
  construireCourbes() {
    const h = this.hist;
    if (!h || !h.dates || !h.dates.length) { this.groupes = []; return; }
    const num = (a: any[]) => (a || []).map((v) => (v === null || v === undefined || v === '' ? null : Number(v)));
    const S = (nom: string, cle: string, couleur: string) => ({ nom, valeurs: num(h[cle]), couleur });
    const P = ['#cdaf6c', '#7f9a3e', '#4f8fb0', '#c4663f', '#9a74c0'];
    const defs = [
      { id: 'poids', titre: 'Poids', unite: 'kg', series: [S('Poids', 'poids_kg', P[0])] },
      { id: 'imc', titre: 'IMC', unite: '', series: [S('IMC', 'imc', P[1])] },
      { id: 'graisse', titre: 'Masse grasse', unite: '%', series: [S('Masse grasse', 'taux_graisse', P[3])] },
      { id: 'haut', titre: 'Haut du corps', unite: 'cm', series: [S('Cou', 'cou_cm', P[0]), S('Poitrine', 'poitrine_cm', P[1]), S('Bras gauche', 'bras_gauche_cm', P[2]), S('Bras droit', 'bras_droit_cm', P[4])] },
      { id: 'bas', titre: 'Bas du corps', unite: 'cm', series: [S('Taille', 'taille_tour_cm', P[0]), S('Fessiers', 'fessiers_cm', P[1]), S('Cuisses', 'cuisses_cm', P[2]), S('Mollet gauche', 'mollet_gauche_cm', P[3]), S('Mollet droit', 'mollet_droit_cm', P[4])] },
    ];
    this.groupes = defs.map((g) => ({ ...g, series: g.series.filter((s) => s.valeurs.some((v) => v !== null)) })).filter((g) => g.series.length)
      .map((g) => {
        const v = g.series.length === 1 ? g.series[0].valeurs.filter((x) => x !== null) as number[] : [];
        return { ...g, resume: v.length ? { dernier: v[v.length - 1], variation: Math.round((v[v.length - 1] - v[0]) * 100) / 100 } : null };
      });
    if (!this.groupes.some((g) => g.id === this.sel)) this.sel = this.groupes[0]?.id;
  }
  get mens() { return this.champs.slice(2); }
  labs() { return this.hist.dates.map((x: any) => d10(x).slice(5)); }
  async load() {
    try { this.info = await this.api.get('/profil'); this.p = { ...this.info, date_naissance: d10(this.info.date_naissance) }; } catch {}
    try { this.reco = await this.api.get('/nutrition/recommandations'); } catch { this.reco = null; }
    try { this.dernier = await this.api.get('/releves/dernier'); } catch {}
    try { this.hist = await this.api.get('/releves/histogramme'); this.construireCourbes(); } catch {}
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
