/**
 * Version web du module de lecture du texte : Tesseract (tesseract.js), qui
 * tourne dans le navigateur en WebAssembly. La photo ne quitte pas l'appareil.
 * Le moteur et les données du français sont servis avec l'app (public/ocr/,
 * copiés par scripts/ocr-web.mjs) : le navigateur ne les demande à personne
 * d'autre. Pas de recadrage sur le document comme Vision sur iPhone : la photo
 * est seulement réduite pour aller plus vite.
 */

import { createWorker, PSM, type Worker as OcrWorker } from 'tesseract.js';

import { eraseTableLines } from '../../src/scan/table-lines';
import { wordsToTextLines, type OcrLine } from '../../src/scan/words';

export type TextLine = {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextReading = { lines: TextLine[]; uri?: string };

export const isTextRecognitionAvailable = typeof window !== 'undefined' && typeof Worker !== 'undefined';

/** Largeur maximale lue : au-delà, la lecture est plus lente sans être meilleure. */
const MAX_WIDTH = 2000;

const ocrPath = `${process.env.EXPO_BASE_URL ?? ''}/ocr`;

let worker: Promise<OcrWorker> | null = null;

/** Le moteur, chargé une seule fois (environ 6 Mo au premier Scanner, puis gardé en cache par le navigateur). */
function getWorker(): Promise<OcrWorker> {
  worker ??= createWorker('fra', 1, {
    workerPath: `${ocrPath}/worker.min.js`,
    corePath: ocrPath,
    langPath: ocrPath,
  })
    // Analyse automatique de la page (les traits du tableau sont déjà effacés) :
    // c'est le mode qui lit le mieux les numéros seuls d'une colonne « N° ».
    .then(async (engine) => {
      await engine.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      return engine;
    })
    .catch((error: unknown) => {
    worker = null;
    throw error;
  });
  return worker;
}

/** Charge l'image, la réduit à MAX_WIDTH de large si besoin, la passe en gris et efface les traits du tableau. */
async function loadImage(uri: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return canvas;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Niveaux de gris, puis traits du tableau effacés (src/scan/table-lines.ts).
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * pixels.data[i * 4] + 0.587 * pixels.data[i * 4 + 1] + 0.114 * pixels.data[i * 4 + 2];
  }
  eraseTableLines(gray, canvas.width, canvas.height);
  for (let i = 0; i < gray.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = gray[i];
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Lit le texte de l'image `uri` (adresse locale, par exemple celle d'une photo choisie). */
export async function recognizeText(uri: string): Promise<TextReading> {
  const [engine, canvas] = await Promise.all([getWorker(), loadImage(uri)]);
  const { data } = await engine.recognize(canvas, {}, { blocks: true });
  const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
  return { lines: wordsToTextLines(lines, canvas.width, canvas.height) };
}
