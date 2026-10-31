import { Routes, Router, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Api } from './api';
import { Clients } from './pages/clients/clients';
import { Login } from './pages/login/login';
import { Profil } from './pages/profil/profil';
import { Seances } from './pages/seances/seances';
import { Nutrition } from './pages/nutrition/nutrition';
import { Ebook } from './pages/ebook/ebook';
import { Glossaire } from './pages/glossaire/glossaire';
import { Chat } from './pages/chat/chat';

const auth: CanActivateFn = () => inject(Api).token ? true : inject(Router).createUrlTree(['/login']);

const admin: CanActivateFn = () => inject(Api).isAdmin ? true : inject(Router).createUrlTree(['/profil']);

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'clients', component: Clients, canActivate: [auth, admin] },
  { path: 'profil', component: Profil, canActivate: [auth] },
  { path: 'seances', component: Seances, canActivate: [auth] },
  { path: 'nutrition', component: Nutrition, canActivate: [auth] },
  { path: 'ebook', component: Ebook, canActivate: [auth] },
  { path: 'glossaire', component: Glossaire, canActivate: [auth] },
  { path: 'chat', component: Chat, canActivate: [auth] },
  { path: '**', redirectTo: 'profil' },
];
