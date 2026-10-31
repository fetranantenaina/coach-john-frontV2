// Exécuté automatiquement après « npm run build » (script postbuild) :
// écrit dist/coach-john/browser/config.js avec l'adresse du backend déployé.
// Le fichier public/config.js (utilisé par « npm start ») reste vide : en développement, le proxy appelle le backend local.
import { writeFileSync, existsSync } from 'node:fs';

const BACKEND_PAR_DEFAUT = 'https://coach-john-backend-2.onrender.com';
// Pour changer d'adresse sans modifier le code : variable d'environnement API_URL (ex. sur Cloudflare Pages)
const url = (process.env.API_URL ?? BACKEND_PAR_DEFAUT).replace(/\/+$/, '');

const sortie = 'dist/coach-john/browser';
if (!existsSync(sortie)) { console.error(`Dossier ${sortie} introuvable : le build a échoué.`); process.exit(1); }
writeFileSync(`${sortie}/config.js`, `window.__API_URL__ = ${JSON.stringify(url)};\n`);
console.log(`config.js : le site appelle le backend ${url}`);
