import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../api';

/** Admin : recherche des clients, création de comptes, choix du client à gérer. */
@Component({ selector: 'app-clients', standalone: true, imports: [FormsModule], templateUrl: './clients.html' })
export class Clients {
  list: any[] = []; f: any = {}; q = '';
  constructor(public api: Api, private router: Router) { this.load(); }
  filtres() { const q = this.q.toLowerCase(); return this.list.filter(u => (u.name + ' ' + u.email).toLowerCase().includes(q)); }
  async load() { try { this.list = (await this.api.get('/utilisateurs')).filter((u: any) => u.role === 'user'); } catch (e: any) { this.api.toast(e.message); } }
  async creer() { try { await this.api.post('/register', this.f); this.f = {}; this.api.toast('Client créé'); this.load(); this.api.loadClients(); } catch (e: any) { this.api.toast(e.message); } }
  gerer(u: any) { this.api.setCible({ id: u.id, name: u.name }); this.router.navigate(['/profil']); }
}
