import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** Histogramme vertical (évolution dans le temps). */
@Component({ selector: 'app-bars', standalone: true, template: `
  <div class="bars">@for (v of vals; track $index) { <div>{{ v }}<i [style.height.%]="pct(v)"></i>{{ labs[$index] }}</div> }</div>` })
export class Bars {
  @Input() vals: any[] = []; @Input() labs: string[] = [];
  pct(v: any) { return ((Number(v) || 0) / Math.max(...this.vals.map(Number), 1)) * 100; }
}

/** Barres horizontales [libellé, valeur]. */
@Component({ selector: 'app-hbars', standalone: true, imports: [DecimalPipe], template: `
  @for (r of rows; track r[0]) { <div class="hb"><span>{{ r[0] }}</span><u><i [style.width.%]="(r[1] / max()) * 100"></i></u><b>{{ r[1] | number: '1.0-0' }}</b></div> }` })
export class HBars {
  @Input() rows: [string, number][] = [];
  max() { return Math.max(...this.rows.map(r => r[1]), 1); }
}

/** Date ISO -> AAAA-MM-JJ */
export const d10 = (d: any) => (d ? String(d).slice(0, 10) : '');

/** Icônes SVG du menu (héritent la couleur du texte via currentColor). */
@Component({ selector: 'app-icon', standalone: true, template: `
  @switch (name) {
    @case ('clients') { <svg class="ic" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
    @case ('profil') { <svg class="ic" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
    @case ('seances') { <svg class="ic" viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg> }
    @case ('nutrition') { <svg class="ic" viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> }
    @case ('ebook') { <svg class="ic" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }
    @case ('glossaire') { <svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> }
    @case ('sun') { <svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> }
    @case ('moon') { <svg class="ic" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> }
    @case ('download') { <svg class="ic" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg> }
    @case ('chat') { <svg class="ic" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg> }
  }` })
export class Icon { @Input() name = ''; }
