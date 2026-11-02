import { Component, inject } from '@angular/core';
import { Api } from './api';

/** Loader affiché quand le serveur ne répond pas encore ou qu'une requête est très lente. */
@Component({ selector: 'app-chargement', standalone: true, template: `
  <div class="voile"><div class="voile-carte">
    <div class="logo-mark big"></div>
    @if (api.reveilEchec) {
      <h2>Le serveur ne répond pas</h2>
      <p class="muted">Vérifie ta connexion Internet, puis réessaie.</p>
      <button (click)="api.reveil()">Réessayer</button>
    } @else {
      <div class="spinner"></div>
    }
  </div></div>` })
export class Chargement { api = inject(Api); }
