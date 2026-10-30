/**
 * Page HTML du PDF exporté (expo-print la transforme en PDF) : le schéma en
 * couleur, les familles de chemins avec leurs délais, et le diagnostic.
 */

import { explainIssue, summarize, type Process } from '@/domain';
import { overviewOf, paintFamilies } from '@/simulation/families';
import { layoutProcess } from '@/simulation/layout';
import { formatNumber, plural } from '@/utils/format';

import { diagramSvg } from './svg';

export type PdfOptions = {
  /** Une couleur par famille de chemins sur le schéma. */
  colorFamilies: boolean;
  /** Couleurs des familles (FamilyColors.light). */
  colors: readonly string[];
  /** Date affichée en bas de page. */
  date?: Date;
};

const SEVERITY: Record<string, { label: string; color: string; background: string }> = {
  error: { label: 'Erreur', color: '#a8261b', background: '#fbe3e1' },
  warning: { label: 'Avertissement', color: '#9a4510', background: '#fdeedf' },
  info: { label: 'Info', color: '#4a5b70', background: '#eef3f8' },
};

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function processToPdfHtml(process: Process, options: PdfOptions): string {
  const layout = layoutProcess(process);
  const overview = overviewOf(process);
  const summary = summarize(process);
  const strokes = options.colorFamilies ? paintFamilies(overview, options.colors).strokes : undefined;
  const days = (min: number, max: number) =>
    min === max ? `${formatNumber(min)} JO` : `${formatNumber(min)} à ${formatNumber(max)} JO`;

  const facts = [
    plural(summary.stepCount, 'étape'),
    plural(summary.decisionCount, 'décision'),
    plural(summary.actors.length, 'acteur'),
    `${overview.capped ? 'plus de ' : ''}${plural(overview.pathCount, 'chemin')}`,
  ].join(' · ');

  const families = overview.families
    .map(
      (family, index) => `<tr>
        <td><span class="swatch" style="background:${options.colorFamilies ? options.colors[index % options.colors.length] : '#0078bd'}"></span>${escape(family.label)}${family.critical ? ' <span class="badge">critique</span>' : ''}</td>
        <td>${plural(family.paths.length, 'chemin')}</td>
        <td>${days(family.minDays, family.maxDays)}</td>
      </tr>`,
    )
    .join('');

  const top = overview.load[0];
  const notes = [
    overview.critical && overview.families.length > 1
      ? `Chemin critique : ${formatNumber(overview.critical.duration)} JO${options.colorFamilies ? ', en trait épais' : ''}.`
      : '',
    top ? `Charge : ${escape(top.actor)} porte ${plural(top.steps, 'étape')} sur ${summary.stepCount}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const issues = summary.issues.length
    ? `<ul class="issues">${summary.issues
        .map((issue) => {
          const { title, detail } = explainIssue(issue, process);
          const tone = SEVERITY[issue.severity];
          return `<li><span class="tag" style="color:${tone.color};background:${tone.background}">${tone.label}</span> <b>${escape(title)}</b> : ${escape(detail)}</li>`;
        })
        .join('')}</ul>`
    : '<p class="ok">Aucune anomalie : chaque étape est atteignable et mène à une fin.</p>';

  const date = (options.date ?? new Date()).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const edited = process.editedAt
    ? new Date(process.editedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${escape(process.name)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, -apple-system, Helvetica, Arial, sans-serif; color: #0b2540; font-size: 12px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #4a5b70; }
  .facts { color: #4a5b70; margin: 0; }
  .diagram { border: 1px solid #dde5ee; border-radius: 12px; padding: 8px; page-break-inside: avoid; }
  .diagram svg { display: block; width: 100%; height: auto; max-height: 190mm; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 8px; border-bottom: 1px solid #dde5ee; }
  td:not(:first-child) { white-space: nowrap; color: #4a5b70; text-align: right; }
  .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 8px; vertical-align: -1px; }
  .badge { font-size: 10px; font-weight: 600; color: #9a4510; background: #fdeedf; border-radius: 999px; padding: 1px 6px; }
  .note { color: #4a5b70; }
  .issues { padding-left: 0; list-style: none; margin: 0; }
  .issues li { padding: 5px 0; border-bottom: 1px solid #dde5ee; }
  .tag { font-size: 10px; font-weight: 600; border-radius: 999px; padding: 1px 6px; }
  .ok { color: #0b6b4b; }
  footer { margin-top: 24px; color: #4a5b70; font-size: 10px; }
</style></head>
<body>
  <h1>${escape(process.name)}</h1>
  <p class="facts">${facts}</p>
  <h2>Schéma</h2>
  <div class="diagram">${diagramSvg(layout, strokes)}</div>
  <h2>Familles de chemins</h2>
  <table>${families}</table>
  ${notes ? `<p class="note">${notes}</p>` : ''}
  <h2>Diagnostic</h2>
  ${issues}
  <footer>Exporté avec SimuFlow le ${date}.${edited ? ` Corrigé dans l’app le ${edited}.` : ''} Délais en jours ouvrés (JO).</footer>
</body></html>`;
}
