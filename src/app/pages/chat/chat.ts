import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';

@Component({ selector: 'app-chat', standalone: true, imports: [FormsModule], templateUrl: './chat.html' })
export class Chat implements OnDestroy {
  me: any; coachs: any[] = []; clients: any[] = []; convs: any[] = []; cur: number = 0; msgs: any[] = []; txt = ''; coachId: any;
  private onMsg = (m: any) => {
    if (m.conversation_id !== this.cur) return;
    this.msgs.push(m); this.bas();
    if (m.expediteur_id !== this.me.id) { this.api.sock?.emit('messages:read', { conversation_id: this.cur }); this.api.nonLus = Math.max(0, this.api.nonLus - 1); }
  };
  constructor(public api: Api) { this.me = api.me(); this.load(); api.sock?.on('message:new', this.onMsg); }
  ngOnDestroy() { this.api.sock?.off('message:new', this.onMsg); }
  bas() { setTimeout(() => { const e = document.getElementById('msgs'); if (e) e.scrollTop = e.scrollHeight; }); }
  async load() {
    try { [this.convs, this.coachs] = await Promise.all([this.api.get('/conversations'), this.api.get('/coachs')]); this.coachId = this.coachs[0]?.id;
      if (this.me.role === 'admin') { this.clients = (await this.api.get('/utilisateurs')).filter((u: any) => u.role === 'user'); this.coachId = this.clients[0]?.id; } } catch (e: any) { this.api.toast(e.message); }
  }
  async demarrer() { try { const c = await this.api.post('/conversations', this.me.role === 'admin' ? { utilisateur_id: this.coachId } : { coach_id: this.coachId }); this.ouvrir(c.id); } catch (e: any) { this.api.toast(e.message); } }
  async ouvrir(id: number) {
    try {
      this.msgs = await this.api.get(`/conversations/${id}/messages`); this.cur = id; this.bas();
      const nl = this.msgs.filter(m => m.expediteur_id !== this.me.id && !m.lu).length;
      if (nl) { this.api.sock?.emit('messages:read', { conversation_id: id }); this.api.nonLus = Math.max(0, this.api.nonLus - nl); }
    } catch (e: any) { this.api.toast(e.message); }
  }
  envoyer() {
    if (!this.txt.trim()) return;
    this.api.sock?.emit('message:send', { conversation_id: this.cur, contenu: this.txt }, (r: any) => { if (!r.ok) this.api.toast(r.erreur); });
    this.txt = '';
  }
}
