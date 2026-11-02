import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Api } from './api';

/** Écran affiché quand le serveur ne répond pas encore ou qu'une requête est très lente. */
@Component({ selector: 'app-chargement', standalone: true, template: `
  <div class="voile"><div class="voile-carte">
    <div class="logo-mark big"></div>
    @if (api.reveilEchec) {
      <h2>Le serveur ne répond pas</h2>
      <p class="muted">Vérifie ta connexion Internet, puis réessaie.</p>
      <button (click)="api.reveil()">Réessayer</button>
    } @else {
      <div class="spinner"></div>
      <h2>Connexion au serveur…</h2>
      <p class="muted">Le serveur gratuit se met en veille quand il n'est pas utilisé : le réveil peut prendre jusqu'à une minute.</p>
      <p class="muted">{{ secondes }} s @if (api.tentative > 1) { · tentative {{ api.tentative }} }</p>
    }
  </div></div>` })
export class Chargement implements OnInit, OnDestroy {
  api = inject(Api);
  secondes = 0;
  private minuteur: any;
  ngOnInit() { this.minuteur = setInterval(() => this.secondes++, 1000); }
  ngOnDestroy() { clearInterval(this.minuteur); }
}
