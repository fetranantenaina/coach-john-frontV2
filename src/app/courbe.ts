import { Component, Input, OnChanges } from '@angular/core';

export interface SerieCourbe { nom: string; valeurs: (number | null)[]; couleur: string; }
let compteur = 0;

/** Courbe lissée (interpolation monotone) avec axes, grille, points et info-bulle ; une ou plusieurs séries. */
@Component({ selector: 'app-courbe', standalone: true, template: `
  <div class="courbe">
    @if (series.length > 1) { <div class="legende">@for (s of series; track s.nom) { <span><i [style.background]="s.couleur"></i>{{ s.nom }}</span> }</div> }
    <svg [attr.viewBox]="'0 0 ' + L + ' ' + H" role="img" aria-label="Courbe d'évolution" (mouseleave)="actif = null">
      @if (series.length === 1) {
        <defs><linearGradient [attr.id]="id" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [style.stop-color]="series[0].couleur" stop-opacity="0.35" /><stop offset="100%" [style.stop-color]="series[0].couleur" stop-opacity="0" />
        </linearGradient></defs>
      }
      @for (t of vue.ticks; track $index) {
        <line class="grille" [attr.x1]="mg" [attr.x2]="L - md" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axe" text-anchor="end" [attr.x]="mg - 8" [attr.y]="t.y + 4">{{ t.label }}</text>
      }
      @for (e of vue.etiquettes; track $index) { <text class="axe" text-anchor="middle" [attr.x]="e.x" [attr.y]="H - 10">{{ e.label }}</text> }
      @if (vue.aire) { <path [attr.d]="vue.aire" [attr.fill]="'url(#' + id + ')'" /> }
      @for (c of vue.chemins; track c.nom) { <path class="trait" [attr.d]="c.d" [style.stroke]="c.couleur" /> }
      @for (p of vue.points; track $index) { <circle class="pt" r="4.5" [attr.cx]="p.x" [attr.cy]="p.y" [style.fill]="p.couleur" /> }
      @for (p of vue.points; track $index) { <circle r="14" fill="transparent" [attr.cx]="p.x" [attr.cy]="p.y" (mouseenter)="actif = p" (click)="actif = p" /> }
      @if (actif) {
        <g class="bulle"><rect rx="8" width="150" height="40" [attr.x]="bx()" [attr.y]="by()" />
          <text [attr.x]="bx() + 10" [attr.y]="by() + 16">{{ actif.date }}</text><text [attr.x]="bx() + 10" [attr.y]="by() + 31">{{ actif.texte }}</text></g>
      }
    </svg>
  </div>` })
export class Courbe implements OnChanges {
  @Input() dates: string[] = [];
  @Input() series: SerieCourbe[] = [];
  @Input() unite = '';
  readonly L = 640; readonly H = 260; readonly mg = 46; readonly md = 16; readonly mh = 14; readonly mb = 34;
  id = 'degrade' + compteur++;
  vue: any = { chemins: [], points: [], ticks: [], etiquettes: [], aire: '' };
  actif: any = null;

  ngOnChanges() { this.actif = null; this.vue = this.construire(); }
  bx() { return Math.min(Math.max(this.actif.x - 75, this.mg), this.L - this.md - 150); }
  by() { return this.actif.y > 100 ? this.actif.y - 52 : this.actif.y + 12; }

  private r = (n: number) => Math.round(n * 10) / 10;
  private fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  private pasJoli(brut: number) { const e = Math.pow(10, Math.floor(Math.log10(brut))), f = brut / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }

  /** Courbe lissée qui passe par tous les points sans dépassement (interpolation cubique monotone). */
  chemin(pts: { x: number; y: number }[]): string {
    const n = pts.length;
    if (n < 2) return '';
    const dx: number[] = [], m: number[] = [], t: number[] = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M ${this.r(pts[0].x)} ${this.r(pts[0].y)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i];
      d += ` C ${this.r(pts[i].x + h / 3)} ${this.r(pts[i].y + (t[i] * h) / 3)}, ${this.r(pts[i + 1].x - h / 3)} ${this.r(pts[i + 1].y - (t[i + 1] * h) / 3)}, ${this.r(pts[i + 1].x)} ${this.r(pts[i + 1].y)}`;
    }
    return d;
  }

  construire() {
    const vide = { chemins: [], points: [], ticks: [], etiquettes: [], aire: '' };
    const x0 = this.mg, x1 = this.L - this.md, y0 = this.H - this.mb, y1 = this.mh;
    const ts = this.dates.map((d) => Date.parse(String(d).slice(0, 10)));
    const nombres = this.series.flatMap((s) => s.valeurs.filter((v) => v !== null && v !== undefined && !isNaN(v as number))) as number[];
    if (!nombres.length) return vide;
    let min = Math.min(...nombres), max = Math.max(...nombres);
    if (min === max) { min -= 1; max += 1; } else { const marge = (max - min) * 0.12; min -= marge; max += marge; }
    const pas = this.pasJoli((max - min) / 4);
    const bas = Math.floor(min / pas) * pas, haut = Math.ceil(max / pas) * pas;
    const y = (v: number) => y0 - ((v - bas) / (haut - bas)) * (y0 - y1);
    const tmin = Math.min(...ts), tmax = Math.max(...ts);
    const x = (t: number) => (tmax === tmin ? (x0 + x1) / 2 : x0 + ((t - tmin) / (tmax - tmin)) * (x1 - x0));

    const ticks = [];
    for (let i = 0, n = Math.round((haut - bas) / pas); i <= n; i++) ticks.push({ y: this.r(y(bas + i * pas)), label: this.fmt(bas + i * pas) });

    const points: any[] = [], chemins: any[] = [];
    let aire = '';
    for (const s of this.series) {
      const pts = s.valeurs.map((v, i) => (v === null || v === undefined || isNaN(v as number) ? null : { x: this.r(x(ts[i])), y: this.r(y(v as number)), v: v as number, i })).filter((p) => p) as any[];
      chemins.push({ nom: s.nom, couleur: s.couleur, d: this.chemin(pts) });
      for (const p of pts) points.push({ x: p.x, y: p.y, couleur: s.couleur, date: new Date(ts[p.i]).toLocaleDateString('fr-FR'), texte: `${this.series.length > 1 ? s.nom + ' : ' : ''}${this.fmt(p.v)} ${this.unite}`.trim() });
      if (this.series.length === 1 && pts.length > 1) aire = `${chemins[0].d} L ${pts[pts.length - 1].x} ${y0} L ${pts[0].x} ${y0} Z`;
    }
    // étiquettes de dates : 5 au plus, réparties sur les dates distinctes
    const distinctes = [...new Set(ts.filter((t) => !isNaN(t)))].sort((a, b) => a - b);
    const nb = Math.min(5, distinctes.length), long = tmax - tmin > 150 * 86400000;
    const etiquettes = Array.from({ length: nb }, (_, k) => {
      const t = distinctes[nb === 1 ? 0 : Math.round((k * (distinctes.length - 1)) / (nb - 1))];
      return { x: this.r(x(t)), label: new Date(t).toLocaleDateString('fr-FR', long ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }).replace('.', '') };
    });
    return { chemins, points, ticks, etiquettes, aire };
  }
}
