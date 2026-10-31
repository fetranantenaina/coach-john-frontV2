import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api';

@Component({ selector: 'app-login', standalone: true, imports: [FormsModule], templateUrl: './login.html' })
export class Login {
  f: any = {}; err = '';
  constructor(public api: Api) {}
  async go() {
    this.err = '';
    try {
      await this.api.login(this.f.name, this.f.mdp);
    } catch (e: any) { this.err = e.message; }
  }
}
