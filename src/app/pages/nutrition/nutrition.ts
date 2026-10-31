import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Api } from '../../api';
import { HBars } from '../../shared';

@Component({ selector: 'app-nutrition', standalone: true, imports: [FormsModule, HBars, DecimalPipe], templateUrl: './nutrition.html' })
export class Nutrition {
  b: any; f: any = {}; guide: any[] = []; q = ''; na: any = {};
  cs = [['calories', 'Calories'], ['proteines_g', 'Protéines (g)'], ['glucides_g', 'Glucides (g)'], ['lipides_g', 'Lipides (g)'], ['eau_ml', 'Eau (ml)']];
  constructor(public api: Api) { this.load(); }
  filtre() { const q = this.q.toLowerCase(); return this.guide.map(c => ({ ...c, aliments: c.aliments.filter((a: any) => !q || a.nom.toLowerCase().includes(q)) })).filter(c => c.aliments.length); }
  async chargerGuide() { try { this.guide = await this.api.get('/aliments'); } catch (e: any) { this.api.toast(e.message); } }
  async ajouterAliment() { try { await this.api.post('/aliments', this.api.clean(this.na)); this.na = {}; this.api.toast('Aliment ajouté'); this.chargerGuide(); } catch (e: any) { this.api.toast(e.message); } }
  async supprimerAliment(id: number) { try { await this.api.del('/aliments/' + id); this.chargerGuide(); } catch (e: any) { this.api.toast(e.message); } }
  async load() {
    this.chargerGuide(); try { this.b = await this.api.get('/nutrition/bilan'); } catch (e: any) { this.api.toast(e.message); } }
  rows(): [string, number][] { const p = this.b.progression_pct; return [['Calories %', p.calories], ['Protéines %', p.proteines_g], ['Glucides %', p.glucides_g], ['Lipides %', p.lipides_g], ['Eau %', p.eau_ml]]; }
  async add() { try { await this.api.post('/nutrition', this.api.clean(this.f)); this.f = {}; this.api.toast('Ajouté'); this.load(); } catch (e: any) { this.api.toast(e.message); } }
}
