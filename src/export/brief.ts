/**
 * « En bref » : quelques phrases qui racontent le process, pour le PDF.
 * Pas d'IA : le texte est calculé à partir des chemins (familles, délais,
 * étapes de fin) et du diagnostic. Le but est qu'un lecteur comprenne le
 * schéma sans le déchiffrer : par où il commence, en combien de cas il se
 * sépare, ce que donne chaque cas et lequel est le plus rapide ou le plus long.
 */

import { summarize, type Path, type Process } from '@/domain';
import type { ProcessOverview } from '@/simulation/families';
import { formatNumber, plural } from '@/utils/format';

export type BriefOptions = {
  /** Nom de la couleur de chaque famille (« bleu », « vert »…), si le schéma est coloré. */
  colorNames?: readonly string[];
};

/** Au-delà, les cas suivants sont seulement comptés. */
const MAX_CASES = 6;

export type Brief = {
  /** Phrases d'introduction. */
  intro: string[];
  /** Une ligne par cas (famille de chemins). Vide s'il n'y a qu'un chemin. */
  cases: string[];
  /** Phrase de conclusion (anomalies). */
  outro: string;
};

export function briefOf(process: Process, overview: ProcessOverview, options: BriefOptions = {}): Brief {
  const steps = new Map(process.steps.map((step) => [step.id, step]));
  const timed = process.steps.some((step) => (step.duration ?? 0) > 0);
  const summary = summarize(process);
  const title = (id: string) => `« ${steps.get(id)?.title || 'sans titre'} »`;
  // Étapes de travail d'un chemin : sans le départ ni la fin.
  const workCount = (path: Path) =>
    path.steps.filter(({ stepId }) => {
      const kind = steps.get(stepId)?.kind;
      return kind !== 'start' && kind !== 'end';
    }).length;
  const days = (min: number, max: number) =>
    min === max ? `${formatNumber(min)} JO` : `de ${formatNumber(min)} à ${formatNumber(max)} JO`;
  const lastOf = (path: Path) => path.steps[path.steps.length - 1].stepId;
  const isDeadEnd = (path: Path) => steps.get(lastOf(path))?.kind !== 'end';
  /** « jusqu’à « Fin » », ou pour plusieurs chemins « jusqu’à « A » ou « B », dont 1 bloquée à « X » (impasse) ». */
  const endsOf = (list: Path[]) => {
    const done = [...new Set(list.filter((path) => !isDeadEnd(path)).map(lastOf))].map(title);
    const stuck = list.filter(isDeadEnd);
    const where = [...new Set(stuck.map(lastOf))].map(title);
    const blocked = `bloqué${list.length > 1 ? `e${stuck.length > 1 ? 's' : ''}` : ''} à ${listOf(where, 'ou')} (impasse)`;
    if (!done.length) return list.length > 1 ? `toutes ${blocked}` : blocked;
    const reach = `jusqu’à ${listOf(done, 'ou')}`;
    return stuck.length ? `${reach}, dont ${formatNumber(stuck.length)} ${blocked}` : reach;
  };

  const intro: string[] = [];
  const startIds = [...new Set(overview.families.flatMap((f) => f.paths.map((p) => p.steps[0].stepId)))];
  const actors = summary.actors;
  const start = startIds.length ? `Ce process part de ${startIds.map(title).join(' ou ')}` : 'Ce process n’a pas de départ';
  intro.push(
    actors.length
      ? `${start} et fait intervenir ${plural(actors.length, 'acteur')} : ${listOf(actors)}.`
      : `${start}.`,
  );

  const paths = overview.families.flatMap((family) => family.paths);
  if (paths.length === 0) {
    return { intro, cases: [], outro: outroOf(summary.errorCount + summary.warningCount) };
  }

  if (overview.families.length === 1 && paths.length === 1) {
    const path = paths[0];
    intro.push(
      `Un seul chemin : ${plural(workCount(path), 'étape')}${timed ? `, ${days(path.duration, path.duration)}` : ''}, ${endsOf([path])}.`,
    );
    return { intro, cases: [], outro: outroOf(summary.errorCount + summary.warningCount) };
  }

  const fastest = overview.families.reduce((best, f) => (f.minDays < best.minDays ? f : best));
  const longest = overview.families.reduce((best, f) => (f.maxDays > best.maxDays ? f : best));
  const comparable = timed && overview.families.length > 1 && fastest !== longest;

  const firstQuestion = overview.families[0].label.includes(' : ')
    ? overview.families[0].label.split(' : ')[0]
    : null;
  intro.push(
    overview.families.length > 1
      ? `Il se sépare en ${overview.families.length} cas${firstQuestion ? ` à la question « ${firstQuestion} ? »` : ''}${overview.capped ? ' (plus de 500 chemins : seuls les grands cas sont résumés)' : ''} :`
      : `Il compte ${plural(paths.length, 'variante')} :`,
  );

  const cases = overview.families.slice(0, MAX_CASES).map((family, index) => {
    const color = options.colorNames?.length ? options.colorNames[index % options.colorNames.length] : null;
    const name = firstQuestion ? family.label.slice(firstQuestion.length + 3) : family.label;
    const head = `${color ? `En ${color}, ` : ''}« ${name} »`;
    let body: string;
    if (family.paths.length === 1) {
      const path = family.paths[0];
      body = `${plural(workCount(path), 'étape')}${timed ? `, ${days(path.duration, path.duration)}` : ''}, ${endsOf(family.paths)}`;
    } else {
      body = `${plural(family.paths.length, 'variante')}${timed ? `, ${days(family.minDays, family.maxDays)}` : ''}, ${endsOf(family.paths)}`;
    }
    const tags = comparable
      ? [family === fastest ? 'le cas le plus rapide' : '', family === longest ? 'le cas le plus long' : '']
          .filter(Boolean)
          .join(' et ')
      : '';
    return `${head} : ${body}${tags ? `. C’est ${tags}` : ''}.`;
  });
  const rest = overview.families.length - MAX_CASES;
  if (rest > 0) cases.push(`Et ${plural(rest, 'autre cas', 'autres cas')}, détaillés plus bas.`);

  return { intro, cases, outro: outroOf(summary.errorCount + summary.warningCount) };
}

function outroOf(issueCount: number): string {
  return issueCount
    ? `À revoir avant de diffuser : ${plural(issueCount, 'anomalie')}, détaillée${issueCount > 1 ? 's' : ''} dans le diagnostic.`
    : 'Aucune anomalie : le process peut être diffusé tel quel.';
}

/** « A », « A et B », « A, B et C ». */
function listOf(items: string[], last = 'et'): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`;
}
