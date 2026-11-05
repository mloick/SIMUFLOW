/** Tests : lit un fichier fictif de docs/exemples/ (classeurs, CSV) en octets. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

exports.lireExemple = (name) => new Uint8Array(readFileSync(join(__dirname, '..', 'docs', 'exemples', name)));
