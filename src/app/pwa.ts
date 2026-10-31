import { Injectable, inject } from '@angular/core';
import { Api } from './api';

/** Thème clair/sombre (mémorisé) et installation de la PWA. */
@Injectable({ providedIn: 'root' })
export class Pwa {
  private api = inject(Api);
  theme = document.documentElement.dataset['theme'] || 'dark';
  evt: any = (window as any).__bip || null;
  ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

  constructor() {
    window.addEventListener('bip-ready', () => (this.evt = (window as any).__bip));
    window.addEventListener('appinstalled', () => { this.evt = null; this.standalone = true; });
    this.appliquer();
  }
  get peutInstaller() { return !this.standalone && (!!this.evt || this.ios); }
  async installer() {
    if (this.evt) { this.evt.prompt(); await this.evt.userChoice; this.evt = null; }
    else this.api.toast("Sur iPhone : touche Partager, puis « Sur l'écran d'accueil »");
  }
  basculer() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', this.theme); this.appliquer(); }
  private appliquer() {
    document.documentElement.dataset['theme'] = this.theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'dark' ? '#0e0e0c' : '#f6f4ec');
  }
}
