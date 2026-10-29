import { describe, expect, it } from '@jest/globals';

import { describeIssue, diagnose, explainIssue } from '../diagnostic';
import type { Process } from '../types';
import { copie, demandeMateriel } from '../exemples';

const codes = (process: Process) => diagnose(process).map((issue) => issue.code);

describe('diagnose', () => {
  it('ne signale rien sur un process correct', () => {
    expect(diagnose(demandeMateriel)).toEqual([]);
  });

  it('signale une impasse', () => {
    const p = copie();
    p.links = p.links.filter((l) => l.id !== 'l6');
    expect(diagnose(p)).toContainEqual({ severity: 'warning', code: 'dead-end', stepId: 'refus' });
  });

  it('signale une décision avec une seule sortie', () => {
    const p = copie();
    p.links = p.links.filter((l) => l.id !== 'l3');
    expect(diagnose(p)).toContainEqual({ severity: 'error', code: 'decision-single-exit', stepId: 'validation' });
  });

  it('signale une branche de décision sans libellé', () => {
    const p = copie();
    delete p.links.find((l) => l.id === 'l2')!.label;
    expect(diagnose(p)).toContainEqual({
      severity: 'warning',
      code: 'unlabeled-branch',
      stepId: 'validation',
      linkId: 'l2',
    });
  });

  it('signale deux branches au même libellé', () => {
    const p = copie();
    p.links.find((l) => l.id === 'l3')!.label = 'Oui';
    expect(codes(p)).toContain('duplicate-label');
  });

  it('signale une étape inatteignable', () => {
    const p = copie();
    p.steps.push({ id: 'archive', kind: 'task', title: 'Archiver' });
    p.links.push({ id: 'l7', from: 'archive', to: 'fin' });
    expect(diagnose(p)).toContainEqual({ severity: 'warning', code: 'unreachable', stepId: 'archive' });
  });

  it('signale une boucle dont on ne sort jamais', () => {
    const p = copie();
    // La livraison renvoie vers la commande au lieu de finir.
    p.links.find((l) => l.id === 'l5')!.to = 'commande';
    const issues = diagnose(p).filter((i) => i.code === 'cannot-finish');
    expect(issues.map((i) => i.stepId)).toEqual(['commande', 'livraison']);
  });

  it('signale une étape isolée, une étape sans titre et un lien cassé', () => {
    const p = copie();
    p.steps.push({ id: 'note', kind: 'task', title: '  ' });
    p.links.push({ id: 'l8', from: 'fin', to: 'inconnue' });
    expect(codes(p)).toEqual(expect.arrayContaining(['isolated-step', 'empty-title', 'dangling-link']));
  });

  it('signale l’absence de départ et de fin', () => {
    const p = copie();
    p.steps = p.steps.map((s) => ({ ...s, kind: 'task' as const }));
    p.links.push({ id: 'l9', from: 'fin', to: 'demande' });
    expect(codes(p)).toEqual(expect.arrayContaining(['no-start', 'no-end']));
  });

  it('range les anomalies de la plus grave à la moins grave', () => {
    const p = copie();
    p.links = p.links.filter((l) => l.id !== 'l3' && l.id !== 'l6');
    p.steps.push({ id: 'aide', kind: 'start', title: 'Demande d’aide' });
    p.links.push({ id: 'l10', from: 'aide', to: 'commande' });
    const severities = diagnose(p).map((i) => i.severity);
    expect(severities).toEqual([...severities].sort((a, b) => 'ewi'.indexOf(a[0]) - 'ewi'.indexOf(b[0])));
    expect(severities[0]).toBe('error');
    expect(severities.at(-1)).toBe('info');
  });

  it('écrit un message en français', () => {
    expect(describeIssue({ severity: 'warning', code: 'duplicate-label', params: { label: 'oui' } })).toBe(
      'Deux branches portent le même libellé « oui ».',
    );
  });
});

describe('explainIssue', () => {
  it('nomme l’étape concernée', () => {
    const p = copie();
    p.links = p.links.filter((l) => l.id !== 'l6');
    const issue = diagnose(p).find((i) => i.code === 'dead-end')!;
    expect(explainIssue(issue, p)).toEqual({ title: 'Impasse', detail: '« Prévenir du refus » n’a aucune sortie.' });
  });

  it('reprend le message général sans étape', () => {
    expect(explainIssue({ severity: 'error', code: 'no-end' }, demandeMateriel).detail).toBe(
      'Aucune étape de fin : le process ne se termine nulle part.',
    );
  });
});
