import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets', 'icon.svg');
const pngPath = path.join(root, 'assets', 'icon.png');
const icoPath = path.join(root, 'assets', 'icon.ico');

console.log('Converting SVG → PNG…');
const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
const pngData = resvg.render().asPng();
fs.writeFileSync(pngPath, pngData);
console.log(`  Written: ${pngPath}`);

console.log('Converting PNG → ICO…');
const icoData = await pngToIco([pngPath]);
fs.writeFileSync(icoPath, icoData);
console.log(`  Written: ${icoPath}`);

console.log('Done.');
