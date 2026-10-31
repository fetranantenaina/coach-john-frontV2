import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';

export const config: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([(req, next) => {
      const t = sessionStorage.getItem('t');
      const c = JSON.parse(sessionStorage.getItem('cible') || 'null');
      const chemin = req.url.replace(/^https?:\/\/[^/]+/, ''); // fonctionne avec une adresse relative ou absolue
      const headers: any = t ? { Authorization: 'Bearer ' + t } : {};
      // L'admin agit au nom du client sélectionné (sauf chat, notifications et gestion des comptes)
      if (c && !/^\/api\/(conversations|notifications|coachs|login|logout|register|utilisateurs)/.test(chemin)) headers['X-Utilisateur-Id'] = String(c.id);
      return next(req.clone({ setHeaders: headers }));
    }])),
  ],
};
