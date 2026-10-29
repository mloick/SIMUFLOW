/**
 * Vue « Tous les cas » : tous les chemins du process, rangés en familles.
 *
 * - Une famille regroupe les chemins qui prennent la même sortie à la première
 *   décision rencontrée (par exemple « Urgent : oui » et « Urgent : non »).
 * - Le chemin critique est le plus long en jours ouvrés : sa famille est
 *   marquée « critique ».
 * - La charge dit quel acteur porte le plus d'étapes.
 */

import { buildGraph, isTerminal, type Path, type PathStep, type Process, type ProcessGraph } from '@/domain';

export type PathFamily = {
  /** Lien de sortie qui définit la famille, ou « unique » sans décision. */
  id: string;
  /** Par exemple « Urgent : oui ». */
  label: string;
  paths: Path[];
  minDays: number;
  maxDays: number;
  steps: Set<string>;
  links: Set<string>;
  /** Contient le chemin critique (seulement s'il y a plusieurs familles). */
  critical: boolean;
};

export type ActorLoad = { actor: string; steps: number };

export type ProcessOverview = {
  families: PathFamily[];
  pathCount: number;
  /** Vrai si le process a trop de chemins pour tous les lister. */
  capped: boolean;
  /** Chemin le plus long en jours ouvrés. */
  critical: Path | null;
  /** Acteurs, du plus chargé au moins chargé. */
  load: ActorLoad[];
};

/** Au-delà, les chemins ne sont plus listés : le schéma serait illisible de toute façon. */
export const MAX_LISTED_PATHS = 500;
const MAX_VISITS = 300_000;

/** Tous les chemins sans boucle, d'un départ à une fin (ou à une impasse). */
export function allPaths(process: Process, max = MAX_LISTED_PATHS): { paths: Path[]; capped: boolean } {
  const graph = buildGraph(process);
  const paths: Path[] = [];
  let visits = 0;
  let capped = false;
  const onPath = new Set<string>();
  const current: PathStep[] = [];

  const keep = () => {
    if (paths.length >= max) {
      capped = true;
      return;
    }
    const steps = [...current];
    const duration = steps.reduce((sum, { stepId }) => sum + (graph.steps.get(stepId)?.duration ?? 0), 0);
    paths.push({ steps, duration });
  };

  const explore = (id: string) => {
    if (capped || visits++ > MAX_VISITS) {
      capped = true;
      return;
    }
    if (isTerminal(graph, id)) return keep();
    onPath.add(id);
    let moved = false;
    for (const link of graph.outgoing.get(id)!) {
      if (onPath.has(link.to)) continue;
      moved = true;
      current.push({ stepId: link.to, linkId: link.id });
      explore(link.to);
      current.pop();
    }
    // Toutes les sorties reviennent en arrière : le chemin s'arrête ici.
    if (!moved) keep();
    onPath.delete(id);
  };

  for (const start of graph.starts) {
    current.push({ stepId: start.id });
    explore(start.id);
    current.pop();
  }
  return { paths, capped };
}

export function overviewOf(process: Process): ProcessOverview {
  const graph = buildGraph(process);
  const { paths, capped } = allPaths(process);

  const families = new Map<string, PathFamily>();
  for (const path of paths) {
    const { id, label } = familyOf(graph, path);
    let family = families.get(id);
    if (!family) {
      family = {
        id,
        label,
        paths: [],
        minDays: Infinity,
        maxDays: 0,
        steps: new Set(),
        links: new Set(),
        critical: false,
      };
      families.set(id, family);
    }
    family.paths.push(path);
    family.minDays = Math.min(family.minDays, path.duration);
    family.maxDays = Math.max(family.maxDays, path.duration);
    for (const { stepId, linkId } of path.steps) {
      family.steps.add(stepId);
      if (linkId) family.links.add(linkId);
    }
  }

  // Familles dans l'ordre des sorties du process (oui avant non, comme dans le fichier).
  const order = new Map(process.links.map((link, index) => [link.id, index]));
  const sorted = [...families.values()].sort((a, b) => (order.get(a.id) ?? -1) - (order.get(b.id) ?? -1));

  let critical: Path | null = null;
  for (const path of paths) {
    if (
      !critical ||
      path.duration > critical.duration ||
      (path.duration === critical.duration && path.steps.length > critical.steps.length)
    )
      critical = path;
  }
  if (critical && sorted.length > 1) {
    const criticalPath = critical;
    const family = sorted.find((item) => item.paths.includes(criticalPath));
    if (family) family.critical = true;
  }

  const counts = new Map<string, number>();
  for (const step of process.steps) {
    if (step.actor) counts.set(step.actor, (counts.get(step.actor) ?? 0) + 1);
  }
  const load = [...counts].map(([actor, steps]) => ({ actor, steps })).sort((a, b) => b.steps - a.steps);

  return { families: sorted, pathCount: paths.length, capped, critical, load };
}

/** Famille d'un chemin : la sortie prise à la première étape qui en a plusieurs. */
function familyOf(graph: ProcessGraph, path: Path): { id: string; label: string } {
  for (let i = 0; i < path.steps.length - 1; i++) {
    const step = graph.steps.get(path.steps[i].stepId)!;
    const exits = graph.outgoing.get(step.id)!;
    if (exits.length < 2) continue;
    const link = exits.find((item) => item.id === path.steps[i + 1].linkId)!;
    const exit = link.label || graph.steps.get(link.to)?.title || 'Sortie';
    const question = step.title.replace(/\s*\?\s*$/, '') || 'Décision';
    return { id: link.id, label: `${question} : ${exit}` };
  }
  return { id: 'unique', label: 'Chemin unique' };
}

/** Trait d'une famille sur une flèche du schéma. */
export type FamilyStroke = { color: string; bold: boolean };

/**
 * Comment dessiner la vue « Tous » : les traits de chaque flèche (un par
 * famille qui l'emprunte, épais sur le chemin critique) et, si une famille est
 * isolée, ce qui est estompé.
 */
export type FamilyPaint = {
  strokes: Map<string, FamilyStroke[]>;
  dimmedSteps?: Set<string>;
  dimmedLinks?: Set<string>;
};

export function paintFamilies(
  overview: ProcessOverview,
  colors: readonly string[],
  isolated: string | null = null,
): FamilyPaint {
  const colorOf = (index: number) => colors[index % colors.length];
  const focus = overview.families.find((family) => family.id === isolated);
  const critical = new Set(
    overview.families.length > 1 && overview.critical
      ? overview.critical.steps.flatMap((step) => (step.linkId ? [step.linkId] : []))
      : [],
  );
  const strokes = new Map<string, FamilyStroke[]>();
  overview.families.forEach((family, index) => {
    if (focus && family !== focus) return;
    for (const linkId of family.links) {
      const list = strokes.get(linkId) ?? [];
      list.push({ color: colorOf(index), bold: family.critical && critical.has(linkId) });
      strokes.set(linkId, list);
    }
  });
  if (!focus) return { strokes };
  return {
    strokes,
    dimmedLinks: new Set(overview.families.flatMap((family) => [...family.links]).filter((id) => !focus.links.has(id))),
    dimmedSteps: new Set(overview.families.flatMap((family) => [...family.steps]).filter((id) => !focus.steps.has(id))),
  };
}
