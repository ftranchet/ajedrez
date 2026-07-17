// Copia el build de Stockfish WASM (single-thread, sin SharedArrayBuffer) del
// paquete npm a public/engine/, junto con un manifest.json con el nombre real
// del archivo .js para que el adaptador cree el Worker. public/engine/ está en
// .gitignore: se regenera en cada install.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// El paquete publica los builds en bin/ (v18+) o src/ (versiones previas).
const srcDir = ['bin', 'src']
  .map((d) => join('node_modules', 'stockfish', d))
  .find((d) => existsSync(d));
const outDir = join('public', 'engine');

if (!srcDir) {
  console.error('copy-engine: no se encontró node_modules/stockfish/{bin,src} — ¿faltó npm install?');
  process.exit(1);
}

const files = readdirSync(srcDir);
// Preferimos el build "lite-single": WASM de un solo hilo con NNUE chica.
// No exige cabeceras COOP/COEP (RNF-3 contempla el fallback a un hilo).
const jsFile =
  files.find((f) => f.includes('lite-single') && f.endsWith('.js') && !f.includes('part')) ??
  files.find((f) => f.includes('single') && f.endsWith('.js') && !f.includes('part'));

if (!jsFile) {
  console.error('copy-engine: no se encontró un build single-thread en el paquete stockfish. Archivos:', files.join(', '));
  process.exit(1);
}

const base = jsFile.replace(/\.js$/, '');
const related = files.filter((f) => f.startsWith(base));

mkdirSync(outDir, { recursive: true });
for (const f of related) {
  copyFileSync(join(srcDir, f), join(outDir, f));
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ file: jsFile }, null, 2));
console.log(`copy-engine: ${related.join(', ')} → ${outDir}`);
