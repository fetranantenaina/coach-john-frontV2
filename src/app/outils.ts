import { Component, inject } from '@angular/core';
import { Pwa } from './pwa';
import { Icon } from './shared';

/** Boutons « Installer » et thème clair/sombre (en-tête et page de connexion). */
@Component({ selector: 'app-outils', standalone: true, imports: [Icon], template: `
  @if (pwa.peutInstaller) { <button class="sec ib" (click)="pwa.installer()"><app-icon name="download" />Installer</button> }
  <button class="sec ib" (click)="pwa.basculer()" [attr.aria-label]="pwa.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'"><app-icon [name]="pwa.theme === 'dark' ? 'sun' : 'moon'" /></button>` })
export class Outils { pwa = inject(Pwa); }
