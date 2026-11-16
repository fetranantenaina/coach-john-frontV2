import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../api';

/** Admin : recherche des clients, création de comptes, récupération d'un compte (identifiant, email, mot de passe), choix du client à gérer. */
@Component({ selector: 'app-clients', standalone: true, imports: [FormsModule, DatePipe], templateUrl: './clients.html' })
export class Clients {
  list: any[] = []; f: any = {}; q = '';
  edition: any = null; voirMdp = false;
  info: { name: string; mdp: string } | null = null; // nouveaux identifiants à transmettre au client
  constructor(public api: Api, private router: Router) { this.load(); }
  filtres() { const q = this.q.toLowerCase(); return this.list.filter(u => (u.name + ' ' + u.email).toLowerCase().includes(q)); }
  async load() { try { this.list = (await this.api.get('/utilisateurs')).filter((u: any) => u.role === 'user'); } catch (e: any) { this.api.toast(e.message); } }
  async creer() { try { await this.api.post('/register', this.f); this.f = {}; this.api.toast('Client créé'); this.load(); this.api.loadClients(); } catch (e: any) { this.api.toast(e.message); } }
  gerer(u: any) { this.api.setCible({ id: u.id, name: u.name }); this.router.navigate(['/profil']); }

  ouvrir(u: any) { this.voirMdp = false; this.edition = this.edition?.id === u.id ? null : { id: u.id, name: u.name, email: u.email, mdp: '' }; }
  /** Mot de passe lisible de 10 caractères (sans caractères ambigus 0/O, 1/l/I). */
  generer() {
    const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint32Array(10));
    this.edition.mdp = Array.from(r, (n) => a[n % a.length]).join('');
    this.voirMdp = true;
  }
  async enregistrer() {
    const e = this.edition;
    if (!e.name?.trim() || !e.email?.trim()) { this.api.toast('Identifiant et email sont requis'); return; }
    try {
      await this.api.put('/utilisateur/' + e.id, this.api.clean({ name: e.name.trim(), email: e.email.trim(), mdp: e.mdp }));
      this.api.toast('Compte mis à jour');
      if (e.mdp) this.info = { name: e.name.trim(), mdp: e.mdp };
      this.edition = null; this.load(); this.api.loadClients();
    } catch (err: any) { this.api.toast(err.message); }
  }
}
