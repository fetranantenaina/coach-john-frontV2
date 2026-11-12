import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import type * as THREE_NS from 'three';

/** Muscle tel que renvoyé par l'API (/anatomie/muscles ou /anatomie/vue). */
export interface Muscle3D { code: string; objets_3d: string[]; vue?: string; }

type Three = typeof THREE_NS;
type Vue = 'face' | 'dos' | 'gauche' | 'droite';

const MODELE = '/modeles/corps.glb';
// Le modèle regarde vers +Z ; le côté gauche du corps est en +X (corps.glb, voir scripts/modele3d)
const AZIMUTS: Record<Vue, number> = { face: 0, dos: Math.PI, gauche: Math.PI / 2, droite: -Math.PI / 2 };
const CIBLE_Y = 0.95;
const DISTANCE = 3.7;

/** WebGL disponible sur cet appareil ? (sinon : liste texte à la place du corps) */
export function webglDisponible(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

// Modèle chargé une seule fois pour toute l'app (chaque visionneuse en fait une copie)
let modele: Promise<{ three: Three; scene: THREE_NS.Group }> | null = null;
function chargerModele() {
  if (!modele) {
    modele = (async () => {
      const [three, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(MODELE);
      return { three, scene: gltf.scene };
    })();
    modele.catch(() => (modele = null)); // nouvel essai possible après une erreur réseau
  }
  return modele;
}

/**
 * Visionneuse 3D du corps : rotation au doigt, zoom, boutons face / dos / côtés.
 * Le parent fournit la couleur de chaque muscle ; toucher un muscle émet son code.
 * Rendu à la demande (rien n'est calculé quand rien ne bouge) et hors de la détection de changements Angular.
 */
@Component({
  selector: 'app-corps3d', standalone: true,
  template: `
  <div class="c3d" [style.height]="hauteur">
    <canvas #toile aria-label="Corps en 3D : fais glisser pour tourner, pince pour zoomer, touche un muscle pour sa fiche"></canvas>
    @if (etat === 'chargement') { <div class="c3d-msg"><i class="spinner"></i>Chargement du corps en 3D…</div> }
    @if (etat === 'erreur') { <div class="c3d-msg">Le modèle 3D n'a pas pu être chargé.<button class="sec" (click)="demarrer()">Réessayer</button></div> }
    @if (etat === 'pret') {
      <div class="c3d-vues">@for (v of vues; track v[0]) { <button class="chip" type="button" (click)="tourner(v[0])">{{ v[1] }}</button> }</div>
      <div class="c3d-zoom"><button type="button" class="sec" (click)="zoomer(0.8)" aria-label="Zoomer">+</button><button type="button" class="sec" (click)="zoomer(1.25)" aria-label="Dézoomer">−</button></div>
    }
  </div>`,
})
export class Corps3d implements AfterViewInit, OnChanges, OnDestroy {
  /** Muscles du référentiel (pour relier les objets 3D aux codes). */
  @Input() muscles: Muscle3D[] = [];
  /** Couleur CSS (#rrggbb) par code muscle ; absent = couleurNeutre. */
  @Input() couleurs: Record<string, string> = {};
  @Input() couleurNeutre = '#8a8478';
  /** Muscle sélectionné : mis en avant, les autres sont atténués. */
  @Input() selection: string | null = null;
  /** Tourner automatiquement vers le muscle sélectionné. */
  @Input() suivreSelection = true;
  /** Muscle vers lequel tourner sans atténuer les autres (fiche d'exercice). */
  @Input() focus: string | null = null;
  @Input() hauteur = '62vh';
  @Output() choix = new EventEmitter<string | null>();
  @Output() indisponible = new EventEmitter<void>();
  @ViewChild('toile', { static: true }) toile!: ElementRef<HTMLCanvasElement>;

  etat: 'chargement' | 'pret' | 'erreur' | 'indisponible' = 'chargement';
  vues: [Vue, string][] = [['face', 'Face'], ['dos', 'Dos'], ['gauche', 'Gauche'], ['droite', 'Droite']];

  private zone = inject(NgZone);
  private T?: Three;
  private renderer?: THREE_NS.WebGLRenderer;
  private scene?: THREE_NS.Scene;
  private camera?: THREE_NS.PerspectiveCamera;
  private controles?: any;
  private parCode = new Map<string, THREE_NS.Mesh[]>();
  private codeDe = new Map<THREE_NS.Object3D, string>();
  private cliquables: THREE_NS.Object3D[] = [];
  private contexte?: THREE_NS.Mesh;
  private silhouette?: THREE_NS.Mesh;
  private aRendre = true;
  private anim: { t0: number; duree: number; de: number[]; vers: number[] } | null = null;
  private observateurs: { disconnect(): void }[] = [];
  private detruit = false;
  private appui: { x: number; y: number } | null = null;

  ngAfterViewInit() { this.demarrer(); }

  async demarrer() {
    if (!webglDisponible()) { this.etat = 'indisponible'; this.indisponible.emit(); return; }
    this.etat = 'chargement';
    try {
      const { three, scene } = await chargerModele();
      if (this.detruit) return;
      this.zone.runOutsideAngular(() => this.construire(three, scene.clone(true)));
      this.etat = 'pret';
    } catch (e) {
      console.error(e);
      this.etat = 'erreur';
    }
  }

  private construire(T: Three, corps: THREE_NS.Group) {
    this.T = T;
    const toile = this.toile.nativeElement;
    let renderer: THREE_NS.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      this.zone.run(() => { this.etat = 'indisponible'; this.indisponible.emit(); });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.05, 50);
    camera.position.set(0, CIBLE_Y + 0.1, DISTANCE);
    scene.add(camera);
    scene.add(new T.HemisphereLight(0xffffff, 0x444033, 1.6));
    const lampe = new T.DirectionalLight(0xffffff, 1.9); // suit la caméra : le côté regardé est toujours éclairé
    lampe.position.set(1.5, 2, 3);
    camera.add(lampe);
    this.scene = scene;
    this.camera = camera;

    // Objets 3D -> codes muscles (référentiel de l'API, sinon nom "code_g" / "code_d")
    const objetVersCode = new Map<string, string>();
    for (const m of this.muscles) for (const o of m.objets_3d || []) objetVersCode.set(o, m.code);
    corps.traverse((o) => {
      const mesh = o as THREE_NS.Mesh;
      if (!mesh.isMesh) return;
      if (o.name === 'silhouette') {
        // contour de la peau : faces arrière seulement, il dessine le bord du corps sans voiler les muscles
        mesh.material = new T.MeshBasicMaterial({ transparent: true, opacity: 0.12, side: T.BackSide, depthWrite: false });
        mesh.renderOrder = 2;
        this.silhouette = mesh;
        return;
      }
      mesh.material = new T.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
      if (o.name === 'contexte') { this.contexte = mesh; this.cliquables.push(mesh); return; }
      const code = objetVersCode.get(o.name) || o.name.replace(/_[gd]$/, '');
      this.codeDe.set(mesh, code);
      this.parCode.set(code, [...(this.parCode.get(code) || []), mesh]);
      this.cliquables.push(mesh);
    });
    scene.add(corps);
    this.appliquerTheme();
    this.appliquerCouleurs();

    import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
      if (this.detruit) return;
      const c = new OrbitControls(camera, toile);
      c.target.set(0, CIBLE_Y, 0);
      c.enablePan = false;
      c.enableDamping = true;
      c.dampingFactor = 0.12;
      c.minDistance = 1.2;
      c.maxDistance = 6.5;
      c.minPolarAngle = 0.35;
      c.maxPolarAngle = Math.PI - 0.35;
      c.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_ROTATE };
      c.addEventListener('change', () => (this.aRendre = true));
      c.addEventListener('start', () => (this.anim = null)); // le doigt reprend la main sur l'animation
      c.update();
      this.controles = c;
      const vise = (this.suivreSelection && this.selection) || this.focus;
      if (vise) this.montrer(vise);
    });

    // Toucher / cliquer : un appui sans glissement sélectionne le muscle sous le doigt
    toile.addEventListener('pointerdown', (e) => (this.appui = { x: e.clientX, y: e.clientY }));
    toile.addEventListener('pointerup', (e) => {
      if (!this.appui || Math.hypot(e.clientX - this.appui.x, e.clientY - this.appui.y) > 6) return;
      this.appui = null;
      const code = this.toucher(e);
      this.zone.run(() => this.choix.emit(code));
    });

    const ro = new ResizeObserver(() => this.redimensionner());
    ro.observe(toile.parentElement!);
    const mo = new MutationObserver(() => { this.appliquerTheme(); this.appliquerCouleurs(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const surMq = () => { this.appliquerTheme(); this.appliquerCouleurs(); };
    mq.addEventListener('change', surMq);
    this.observateurs.push(ro, mo, { disconnect: () => mq.removeEventListener('change', surMq) });
    this.redimensionner();

    renderer.setAnimationLoop((t) => this.image(t));
  }

  private image(t: number) {
    if (!this.renderer || !this.scene || !this.camera) return;
    if (this.anim) this.avancerAnim(t);
    if (this.controles?.update()) this.aRendre = true; // vrai tant que l'inertie fait tourner
    if (!this.aRendre) return;
    this.aRendre = false;
    this.renderer.render(this.scene, this.camera);
  }

  private redimensionner() {
    const parent = this.toile.nativeElement.parentElement;
    if (!parent || !this.renderer || !this.camera) return;
    const l = parent.clientWidth, h = parent.clientHeight;
    if (!l || !h) return;
    this.renderer.setSize(l, h, false);
    this.camera.aspect = l / h;
    // sur écran étroit, on recule pour garder le corps entier
    this.camera.fov = l / h < 0.6 ? 36 : 30;
    this.camera.updateProjectionMatrix();
    this.aRendre = true;
  }

  private toucher(e: PointerEvent): string | null {
    if (!this.T || !this.camera) return null;
    const r = this.toile.nativeElement.getBoundingClientRect();
    const p = new this.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new this.T.Raycaster();
    ray.setFromCamera(p, this.camera);
    const premier = ray.intersectObjects(this.cliquables, false)[0];
    return premier ? this.codeDe.get(premier.object) || null : null; // muscle de contexte touché : aucune sélection
  }

  // ---------------- Couleurs et thème ----------------

  ngOnChanges(ch: SimpleChanges) {
    if (!this.renderer) return;
    if (ch['couleurs'] || ch['selection'] || ch['couleurNeutre']) this.appliquerCouleurs();
    if (ch['selection'] && this.selection && this.suivreSelection) this.montrer(this.selection);
    if (ch['focus'] && this.focus) this.montrer(this.focus);
  }

  private sombre() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private appliquerTheme() {
    if (!this.T) return;
    const sombre = this.sombre();
    (this.contexte?.material as THREE_NS.MeshStandardMaterial | undefined)?.color.set(sombre ? '#34332d' : '#d8d5cc');
    const sil = this.silhouette?.material as THREE_NS.MeshBasicMaterial | undefined;
    if (sil) { sil.color.set(sombre ? '#f3f1e7' : '#14140f'); sil.opacity = sombre ? 0.1 : 0.08; }
    this.aRendre = true;
  }

  private appliquerCouleurs() {
    if (!this.T) return;
    const fond = new this.T.Color(this.sombre() ? '#1b1b16' : '#ffffff');
    for (const [code, meshes] of this.parCode) {
      const base = new this.T.Color(this.couleurs[code] || this.couleurNeutre);
      const choisi = this.selection === code;
      // Sélection : le muscle garde sa couleur et s'illumine, le reste se fond vers le fond de carte
      if (this.selection && !choisi) base.lerp(fond, 0.62);
      for (const m of meshes) {
        const mat = m.material as THREE_NS.MeshStandardMaterial;
        mat.color.copy(base);
        mat.emissive.set(choisi ? (this.sombre() ? '#6b4a10' : '#5a3a00') : '#000000');
      }
    }
    const ctx = this.contexte?.material as THREE_NS.MeshStandardMaterial | undefined;
    if (ctx) { ctx.transparent = !!this.selection; ctx.opacity = this.selection ? 0.45 : 1; }
    this.aRendre = true;
  }

  // ---------------- Caméra ----------------

  /** Position actuelle : [azimut, élévation, distance, hauteur visée] */
  private etatCamera(): number[] {
    const c = this.controles;
    const T = this.T!;
    const s = new T.Spherical().setFromVector3(this.camera!.position.clone().sub(c.target));
    return [s.theta, s.phi, s.radius, c.target.y];
  }

  private animerVers(vers: number[], duree = 650) {
    if (!this.controles) return;
    const de = this.etatCamera();
    // plus court chemin pour l'azimut
    let d = vers[0] - de[0];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.anim = { t0: performance.now(), duree, de, vers: [de[0] + d, ...vers.slice(1)] };
    this.aRendre = true;
  }

  private avancerAnim(t: number) {
    const a = this.anim!;
    const k = Math.min(1, (t - a.t0) / a.duree);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const v = a.de.map((x, i) => x + (a.vers[i] - x) * e);
    const T = this.T!;
    const c = this.controles;
    c.target.set(0, v[3], 0);
    this.camera!.position.copy(new T.Vector3().setFromSpherical(new T.Spherical(v[2], v[1], v[0])).add(c.target));
    this.camera!.lookAt(c.target);
    this.aRendre = true;
    if (k >= 1) this.anim = null;
  }

  tourner(vue: Vue) {
    if (!this.controles) return;
    const [, , dist] = this.etatCamera();
    this.animerVers([AZIMUTS[vue], Math.PI / 2 - 0.03, Math.max(dist, 3.2), CIBLE_Y]);
  }

  zoomer(facteur: number) {
    if (!this.controles) return;
    const [az, pol, dist, y] = this.etatCamera();
    const nd = Math.min(this.controles.maxDistance, Math.max(this.controles.minDistance, dist * facteur));
    this.animerVers([az, pol, nd, nd > 3.5 ? CIBLE_Y : y], 300);
  }

  /** Tourne le corps vers un muscle et s'en rapproche. */
  montrer(code: string) {
    const meshes = this.parCode.get(code);
    if (!meshes?.length || !this.T || !this.controles) return;
    const boite = new this.T.Box3();
    for (const m of meshes) boite.expandByObject(m);
    const centre = boite.getCenter(new this.T.Vector3());
    const taille = boite.getSize(new this.T.Vector3()).length();
    const vueMuscle = this.muscles.find((m) => m.code === code)?.vue;
    const az = vueMuscle === 'dos' ? AZIMUTS.dos : vueMuscle === 'cote' ? AZIMUTS.gauche : AZIMUTS.face;
    const dist = Math.min(4.2, Math.max(1.8, taille * 2.6));
    const y = Math.min(1.5, Math.max(0.4, centre.y));
    this.animerVers([az, Math.PI / 2 - 0.05, dist, y]);
  }

  ngOnDestroy() {
    this.detruit = true;
    this.observateurs.forEach((o) => o.disconnect());
    this.controles?.dispose();
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      // libère les matériaux de cette copie (la géométrie est partagée avec le modèle en cache)
      this.scene?.traverse((o) => { const m = (o as THREE_NS.Mesh).material as THREE_NS.Material | undefined; m?.dispose?.(); });
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}
