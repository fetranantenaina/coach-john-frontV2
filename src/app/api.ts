import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';

/** Adresse du backend (public/config.js) : vide en développement (proxy), sinon l'adresse du backend déployé. */
const BASE: string = ((window as any).__API_URL__ || '').replace(/\/+$/, '');

/** Accès à l'API backend (via le proxy /api), session JWT, WebSocket et toasts. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private router = inject(Router);
  token = sessionStorage.getItem('t');
  sock?: Socket;
  nonLus = 0;
  /** Client actuellement géré par l'admin (les données affichées/modifiées sont les siennes). */
  cible: any = JSON.parse(sessionStorage.getItem('cible') || 'null');
  clients: any[] = [];
  get isAdmin() { return this.me()?.role === 'admin'; }
  setCible(u: any) { this.cible = u; u ? sessionStorage.setItem('cible', JSON.stringify(u)) : sessionStorage.removeItem('cible'); }
  async loadClients() { if (!this.isAdmin) return; try { this.clients = (await this.get('/utilisateurs')).filter((u: any) => u.role === 'user'); } catch {} }
  toastMsg = '';

  me(): any { try { return JSON.parse(atob(this.token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; } }

  async call<T = any>(m: string, p: string, b?: any): Promise<T> {
    try { return await firstValueFrom(this.http.request<T>(m, BASE + '/api' + p, { body: b })); }
    catch (e: any) {
      if (this.token && (e.status === 401 || e.status === 403)) this.logout();
      throw new Error(typeof e.error === 'string' && e.error ? e.error : e.error?.message || 'Erreur');
    }
  }
  get = <T = any>(p: string) => this.call<T>('GET', p);
  post = <T = any>(p: string, b?: any) => this.call<T>('POST', p, b);
  put = <T = any>(p: string, b?: any) => this.call<T>('PUT', p, b);
  patch = <T = any>(p: string, b?: any) => this.call<T>('PATCH', p, b);
  del = <T = any>(p: string) => this.call<T>('DELETE', p);

  /** Retire les champs vides avant envoi. */
  clean(o: any) { const r: any = {}; for (const k in o) if (o[k] !== '' && o[k] != null) r[k] = o[k]; return r; }

  toast(m: string) { this.toastMsg = m; setTimeout(() => (this.toastMsg = ''), 2800); }

  async login(name: string, mdp: string) {
    const r = await this.post('/login', { name, mdp });
    this.token = r.token; sessionStorage.setItem('t', r.token);
    this.connect(); this.router.navigate([this.isAdmin ? '/clients' : '/profil']);
  }
  connect() {
    if (!this.token || this.sock) return;
    this.loadClients();
    this.sock = io(BASE || '/', { auth: { token: this.token } });
    this.sock.on('notification:new', (n: any) => { this.nonLus++; this.toast('💬 ' + n.contenu); });
    this.get('/notifications/non-lues/count').then(r => (this.nonLus = r.non_lues)).catch(() => {});
  }
  async logout() {
    const t = this.token; this.token = null; sessionStorage.removeItem('t'); this.setCible(null);
    this.sock?.close(); this.sock = undefined; this.nonLus = 0;
    if (t) fetch(BASE + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {});
    this.router.navigate(['/login']);
  }
}
