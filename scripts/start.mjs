// Lance le serveur de développement Angular en HTTPS.
// Avec mkcert (recommandé), le certificat est reconnu par le navigateur : le service worker et
// l'installation de la PWA fonctionnent. Sans mkcert, un certificat auto-signé est utilisé (alerte du navigateur).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CERT = 'certs/local.pem', KEY = 'certs/local-key.pem', IPS = 'certs/adresses.txt';
const mkcert = (args, opts = {}) => spawnSync('mkcert', args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });
const ips = Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address).sort();

let ssl = ['--ssl'];
if (mkcert(['-version']).status === 0) {
  // (Re)génère le certificat s'il n'existe pas ou si l'adresse IP du PC a changé
  const aJour = existsSync(CERT) && existsSync(KEY) && existsSync(IPS) && readFileSync(IPS, 'utf8') === ips.join(',');
  if (!aJour) {
    mkdirSync('certs', { recursive: true });
    mkcert(['-install'], { stdio: 'inherit' });
    const r = mkcert(['-cert-file', CERT, '-key-file', KEY, 'localhost', '127.0.0.1', '::1', ...ips], { stdio: 'inherit' });
    if (r.status === 0) writeFileSync(IPS, ips.join(','));
  }
  if (existsSync(CERT) && existsSync(KEY)) {
    ssl = ['--ssl', '--ssl-cert', CERT, '--ssl-key', KEY];
    console.log(`\n🔒 HTTPS de confiance (mkcert) : https://localhost:4200${ips.map(i => ` · https://${i}:4200`).join('')}`);
    console.log(`   Pour un téléphone, installe le certificat racine : ${mkcert(['-CAROOT']).stdout.trim()}/rootCA.pem\n`);
  }
} else {
  console.warn(`
⚠️  mkcert n'est pas installé : certificat auto-signé (le navigateur affichera une alerte et le service worker / l'installation PWA seront bloqués).
   Installe mkcert pour un HTTPS reconnu :
     Windows : winget install FiloSottile.mkcert   (ou : choco install mkcert / scoop install mkcert)
     macOS   : brew install mkcert
     Linux   : sudo apt install mkcert libnss3-tools
   puis relance : npm start
`);
}

const ng = require.resolve('@angular/cli/bin/ng.js');
const p = spawn(process.execPath, [ng, 'serve', '--host', '0.0.0.0', ...ssl, ...process.argv.slice(2)], { stdio: 'inherit' });
p.on('exit', c => process.exit(c ?? 0));
