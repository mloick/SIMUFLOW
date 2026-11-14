import { describe, expect, it, jest } from '@jest/globals';

import { checkShareAlerts, forgetShareAlerts, markShareAlertsSeen, shareAlertPath } from '../share-alerts-store';
import { setSharedProcesses } from '../shared-store';

jest.mock('@/backend/sharing', () => ({
  listSharingActivity: jest.fn(async () => ({ members: [], reviews: [] })),
}));
jest.mock('@/notifications/notifications', () => ({
  getNotificationPermission: jest.fn(async () => 'granted'),
  notifyNow: jest.fn(async () => undefined),
}));

const shared = (cloudId: string) => ({
  process: { id: `partage-${cloudId}`, name: `Process ${cloudId}`, steps: [], links: [] },
  cloudId,
  actor: null,
  ownerName: 'Julie Martin',
  updatedAt: '2026-11-14T10:00:00Z',
});

const unreadCount = () => {
  const saved = JSON.parse(globalThis.localStorage?.getItem('simuflow.alertes') ?? '{"alerts":[]}');
  return saved.alerts.filter((alert: { at: string }) => !saved.seenAt || alert.at > saved.seenAt).length;
};

describe('alertes du partage sur le téléphone', () => {
  it('note l’existant sans alerter, puis alerte et notifie un nouveau partage', async () => {
    const { notifyNow } = jest.requireMock<{ notifyNow: jest.Mock }>('@/notifications/notifications');
    forgetShareAlerts();
    setSharedProcesses([shared('a')]);
    expect(await checkShareAlerts(new Date('2026-11-14T10:00:00Z'))).toEqual([]);

    setSharedProcesses([shared('a'), shared('b')]);
    const alerts = await checkShareAlerts(new Date('2026-11-14T11:00:00Z'));
    expect(alerts.map((alert) => alert.target.id)).toEqual(['partage-b']);
    expect(shareAlertPath(alerts[0])).toBe('/process/partage-b');
    expect(notifyNow).toHaveBeenCalledWith(expect.objectContaining({ path: '/process/partage-b' }));
    expect(unreadCount()).toBe(1);

    markShareAlertsSeen(new Date('2026-11-14T12:00:00Z'));
    expect(unreadCount()).toBe(0);

    forgetShareAlerts();
    expect(globalThis.localStorage?.getItem('simuflow.alertes')).toBeNull();
  });
});
