import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { delayReport, olaClock, slaClock, splitWorkingTime, warningMoment } from '../delays';
import { remindersFor } from '../reminders';
import { completeStep, startTracking } from '../tracking';

const process: Process = {
  id: 'p',
  name: 'Commande',
  sla: 2,
  steps: [
    { id: '1', kind: 'start', title: 'Demander un devis', duration: 1 },
    { id: '2', kind: 'task', title: 'Commander', duration: 0.5 },
    { id: '3', kind: 'end', title: 'Clore' },
  ],
  links: [
    { id: 'a', from: '1', to: '2' },
    { id: 'b', from: '2', to: '3' },
  ],
};

const d = (day: number, hour: number) => new Date(2026, 10, day, hour); // novembre 2026, le 2 est un lundi

describe('mode Délais d’une demande suivie', () => {
  const tracking = startTracking(process, d(2, 14), 't', 'Demande 1')!;

  it('garde le SLA et son échéance au départ', () => {
    expect(tracking.sla).toBe(2);
    expect(tracking.slaDueAt).toBe(d(4, 14).toISOString());
    expect(startTracking({ ...process, sla: undefined }, d(2, 14), 't', 'x')!.slaDueAt).toBeUndefined();
  });

  it('fait tourner le chrono du SLA : vert, orange aux trois quarts, rouge après l’échéance', () => {
    expect(slaClock(tracking, d(3, 9))).toMatchObject({
      level: 'ok',
      remaining: 1.625,
      budget: 2,
    });
    expect(warningMoment(tracking.startedAt, 2)).toEqual(d(4, 10));
    expect(slaClock(tracking, d(4, 10))?.level).toBe('warning');
    const late = slaClock(tracking, d(4, 16))!;
    expect(late.level).toBe('late');
    expect(late.remaining).toBe(-0.25);
    expect(late.ratio).toBe(1);
  });

  it('fait tourner le chrono de l’OLA de l’étape en cours', () => {
    expect(olaClock(tracking.steps[0], d(2, 15))).toMatchObject({
      level: 'ok',
      budget: 1,
      stopped: false,
    });
    expect(olaClock(tracking.steps[0], d(3, 13))?.level).toBe('warning');
    expect(olaClock({ ...tracking.steps[0], dueAt: undefined }, d(2, 15))).toBeNull();
  });

  it('découpe le temps de travail en jours, heures et minutes', () => {
    expect(splitWorkingTime(1.625)).toEqual({ days: 1, hours: 5, minutes: 0 });
    expect(splitWorkingTime(-0.1)).toEqual({ days: 0, hours: 0, minutes: 48 });
  });

  it('prévient avant et au dépassement du SLA', () => {
    const reminders = remindersFor(process, tracking, d(2, 15));
    expect(reminders.filter((item) => item.id.includes('sla')).map((item) => [item.id, item.date])).toEqual([
      ['t-sla-bientot', d(4, 10)],
      ['t-sla-depasse', d(4, 14)],
    ]);
    expect(reminders.find((item) => item.id === 't-sla-bientot')?.title).toBe('SLA bientôt dépassé : Demande 1');
  });

  it('fait le bilan : SLA tenu et OLA tenus', () => {
    let done = completeStep(process, tracking, d(3, 9));
    done = completeStep(process, done, d(3, 15));
    done = completeStep(process, done, d(3, 16));
    expect(delayReport(tracking)).toBeNull();
    const report = delayReport(done)!;
    expect(report.sla).toMatchObject({ met: true, budget: 2 });
    expect(report.sla!.margin).toBe(0.75);
    expect(report.ola).toEqual({ met: 1, total: 2 });
    expect(report.lateSteps).toEqual(['2']);
    expect(remindersFor(process, done, d(3, 16))).toEqual([]);
  });

  it('fait le bilan : SLA dépassé', () => {
    let done = completeStep(process, tracking, d(5, 9));
    done = completeStep(process, done, d(5, 10));
    done = completeStep(process, done, d(5, 11));
    const report = delayReport(done)!;
    expect(report.sla?.met).toBe(false);
    expect(report.sla!.margin).toBeLessThan(0);
  });
});
