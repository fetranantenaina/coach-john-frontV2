import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';

@Component({ selector: 'app-ebook', standalone: true, imports: [FormsModule], templateUrl: './ebook.html' })
export class Ebook {
  list: any[] = []; pr: any; c: any = null;
  constructor(public api: Api) { this.load(); }
  async load() { try { [this.list, this.pr] = await Promise.all([this.api.get('/ebook/chapitres'), this.api.get('/ebook/progression')]); } catch (e: any) { this.api.toast(e.message); } }
  nc: any = {};
  async ajouterChap() { try { await this.api.post('/ebook/chapitres', this.api.clean(this.nc)); this.nc = {}; this.api.toast('Chapitre ajouté'); this.load(); } catch (e: any) { this.api.toast(e.message); } }
  async lire(id: number) { try { this.c = await this.api.get('/ebook/chapitres/' + id); } catch (e: any) { this.api.toast(e.message); } }
  async lu() { try { await this.api.put(`/ebook/chapitres/${this.c.id}/lu`, { lu: !this.c.lu }); this.lire(this.c.id); } catch (e: any) { this.api.toast(e.message); } }
}
