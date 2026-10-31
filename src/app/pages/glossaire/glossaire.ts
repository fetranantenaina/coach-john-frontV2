import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';

@Component({ selector: 'app-glossaire', standalone: true, imports: [FormsModule], templateUrl: './glossaire.html' })
export class Glossaire {
  q = ''; list: any[] = []; t: any = null; tm: any;
  constructor(public api: Api) { this.rech(); }
  nt: any = {};
  async ajouter() { try { await this.api.post('/glossaire', this.api.clean(this.nt)); this.nt = {}; this.api.toast('Terme ajouté'); this.rech(); } catch (e: any) { this.api.toast(e.message); } }
  async supprimer() { try { await this.api.del('/glossaire/' + this.t.id); this.t = null; this.rech(); } catch (e: any) { this.api.toast(e.message); } }
  chercher() { clearTimeout(this.tm); this.tm = setTimeout(() => this.rech(), 250); }
  async rech() { try { this.list = await this.api.get('/glossaire?q=' + encodeURIComponent(this.q)); } catch (e: any) { this.api.toast(e.message); } }
  async fiche(id: number) { try { this.t = await this.api.get('/glossaire/' + id); } catch (e: any) { this.api.toast(e.message); } }
}
