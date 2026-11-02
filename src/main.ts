import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config';

// L'écran de lancement (logo) reste affiché un court instant puis disparaît en fondu
const fin = () => { const s = document.getElementById('splash'); s?.classList.add('out'); setTimeout(() => s?.remove(), 500); };
bootstrapApplication(App, config).then(() => setTimeout(fin, 1100)).catch(e => { console.error(e); fin(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
