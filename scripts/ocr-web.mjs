// Copie dans public/ocr/ ce qu'il faut pour lire le texte d'une photo dans le
// navigateur (Scanner de la version web) : le moteur Tesseract (worker et
// WebAssembly) et les données de la langue française. Ces fichiers viennent de
// node_modules et ne sont pas versionnés ; ils sont servis avec l'app, si bien
// que le navigateur ne télécharge rien ailleurs que sur le site de SimuFlow.
// Lancé par `npm run web`, `npm run export:web` et la publication (site.yml).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const from = (pkg, file) => join(dirname(require.resolve(`${pkg}/package.json`)), file);

const files = [
  [from('tesseract.js', 'dist/worker.min.js'), 'worker.min.js'],
  // Le moteur « LSTM seul », en trois versions : le worker prend la plus rapide que le navigateur accepte.
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((name) => [
    from('tesseract.js-core', `${name}.wasm.js`),
    `${name}.wasm.js`,
  ]),
  [from('@tesseract.js-data/fra', '4.0.0_best_int/fra.traineddata.gz'), 'fra.traineddata.gz'],
];

mkdirSync(out, { recursive: true });
for (const [source, name] of files) copyFileSync(source, join(out, name));
console.log(`Lecture de texte web : ${files.length} fichiers copiés dans public/ocr/`);
