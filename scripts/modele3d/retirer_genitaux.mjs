// Usage : node retirer_genitaux.mjs corps.glb corps.glb compresse pubis (dépendances : @gltf-transform/core, @gltf-transform/extensions, meshoptimizer)
// Retire du maillage "silhouette" les morceaux (composantes connexes) des parties génitales
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder,'meshopt.encoder': MeshoptEncoder});
const [src, dst, mode, pubis] = process.argv.slice(2);
const doc = await io.read(src);
const node = doc.getRoot().listNodes().find(n=>n.getName()==='silhouette');
const p=node.getMesh().listPrimitives()[0]; const pos=p.getAttribute('POSITION'); const ind=p.getIndices(); const idx=ind.getArray();
const t=node.getTranslation(), s=node.getScale(); const v=[0,0,0];
const W=[]; for(let i=0;i<pos.getCount();i++){pos.getElement(i,v);W.push([v[0]*s[0]+t[0],v[1]*s[1]+t[1],v[2]*s[2]+t[2]]);}
const par=W.map((_,i)=>i); const f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};
for(let i=0;i<idx.length;i+=3){const a=f(idx[i]),b=f(idx[i+1]);par[b]=a;par[f(idx[i+2])]=a;}
const bb=new Map();
for(let i=0;i<idx.length;i++){const r=f(idx[i]);if(!bb.has(r))bb.set(r,{mn:[9,9,9],mx:[-9,-9,-9]});const c=bb.get(r),w=W[idx[i]];for(let k=0;k<3;k++){c.mn[k]=Math.min(c.mn[k],w[k]);c.mx[k]=Math.max(c.mx[k],w[k]);}}
// morceau entièrement dans la zone génitale (devant le périnée, sous le pubis)
const dans=(c,{x,yMin,yMax,zMin})=>c.mn[0]>-x&&c.mx[0]<x&&c.mn[1]>yMin&&c.mx[1]<yMax&&c.mn[2]>zMin;
const ZONES=[{x:0.035,yMin:0.74,yMax:0.87,zMin:-0.02}];
if (pubis==='pubis') ZONES.push({x:0.06,yMin:0.84,yMax:0.92,zMin:0.04});
const garde=[]; let retires=0;
for(let i=0;i<idx.length;i+=3){const c=bb.get(f(idx[i])); if(ZONES.some(z=>dans(c,z))){retires++;continue;} garde.push(idx[i],idx[i+1],idx[i+2]);}
ind.setArray(new idx.constructor(garde));
console.log('triangles retirés', retires, 'restants', garde.length/3);
if (mode!=='brut') doc.createExtension(ALL_EXTENSIONS.find(e=>e.EXTENSION_NAME==='EXT_meshopt_compression')).setRequired(true).setEncoderOptions({method:'filter'});
else for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName==='EXT_meshopt_compression') e.dispose();
await io.write(dst, doc);
