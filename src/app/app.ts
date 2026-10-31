import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Api } from './api';
import { Icon } from './shared';
import { Outils } from './outils';
import { ChoixClient } from './pages/choix-client/choix-client';

@Component({
  selector: 'app-root', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ChoixClient, Outils],
  template: `
  @if (api.toastMsg) { <div class="toast">{{ api.toastMsg }}</div> }
  @if (!api.token) { <div style="position:fixed;top:12px;right:12px;z-index:6;display:flex;gap:8px"><app-outils /></div> }
  @if (api.token) {
    <header><span class="logo"><span class="logo-mark"></span>COACH <b>JOHN</b></span>
      <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <a class="hicon" routerLink="/chat" routerLinkActive="on" aria-label="Chat"><app-icon name="chat" />@if (api.nonLus) { <i class="badge">{{ api.nonLus }}</i> }</a>
        <app-outils /><button class="sec" (click)="api.logout()">Déconnexion</button></span></header>
  }
  @if (api.isAdmin && api.cible) {
    <div style="background:var(--olive);color:var(--clair);padding:8px 16px;font-size:.85rem;display:flex;gap:8px;align-items:center;flex-wrap:wrap">Client :
      <select style="width:auto;padding:4px 8px" (change)="changer($any($event.target).value)">@for (c of api.clients; track c.id) { <option [value]="c.id" [selected]="c.id === api.cible.id">{{ c.name }}</option> }</select>
      <a routerLink="/clients" (click)="api.setCible(null)" style="color:var(--clair);margin-left:auto">Tous les clients</a></div>
  }
  @for (k of [api.cible?.id]; track k) { @if (needsClient()) { <app-choix-client /> } @else { <router-outlet /> } }
  @if (api.token) {
    <nav>@for (t of tabs(); track t[0]) {
      <a [routerLink]="'/' + t[0]" routerLinkActive="on"><span><app-icon [name]="t[0]" /></span>{{ t[1] }}</a> }
    </nav>
  }`,
})
export class App {
  api = inject(Api);
  router = inject(Router);
  base = [['profil', 'Profil'], ['seances', 'Séances'], ['nutrition', 'Nutrition'], ['ebook', 'E-book'], ['glossaire', 'Glossaire']];
  tabs() { return this.api.isAdmin ? [['clients', 'Clients'], ...this.base] : this.base; }
  changer(id: any) { const u = this.api.clients.find(c => c.id == id); if (u) this.api.setCible({ id: u.id, name: u.name }); }
  /** Admin sans client sélectionné sur une page de données : on propose de choisir un client. */
  needsClient() { return this.api.isAdmin && !this.api.cible && /^\/(profil|seances|nutrition)/.test(this.router.url); }
  constructor() { this.api.connect(); }
}
