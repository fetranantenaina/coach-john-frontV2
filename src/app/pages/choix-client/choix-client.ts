import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../api';

/** Affiché à l'admin sur Profil / Séances / Nutrition tant qu'aucun client n'est sélectionné. */
@Component({ selector: 'app-choix-client', standalone: true, imports: [FormsModule, RouterLink], templateUrl: './choix-client.html' })
export class ChoixClient {
  clients: any[] = []; id: any;
  constructor(public api: Api) { this.load(); }
  async load() {
    try { this.clients = (await this.api.get('/utilisateurs')).filter((u: any) => u.role === 'user'); this.id = this.clients[0]?.id; }
    catch (e: any) { this.api.toast(e.message); }
  }
  choisir() { const u = this.clients.find(c => c.id === this.id); if (u) this.api.setCible({ id: u.id, name: u.name }); }
}
