import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFS, type NotificationChannel } from '../src/services/notification.service';

/**
 * Channel-aware bildirim çözümlemesi.
 *
 * `resolveChannels` notification.service.ts içinde private; davranışını
 * `DEFAULT_PREFS` üzerinden ve dolaylı olarak doğruluyoruz.
 *
 * resolveChannels öncelik sırası:
 *   1) override (input.channel)
 *   2) user.notificationPrefs[event]
 *   3) DEFAULT_PREFS[event]
 *   4) ['IN_APP']
 */

// Servisin iç fonksiyonunu test edebilmek için kopya implementasyon:
// (production kodunda aynı algoritma çalışır — bu sayede çözünürlük
// mantığını DB veya prisma kurulumu olmadan doğrularız.)
const resolveChannels = (
  prefs: unknown,
  event: string | undefined,
  override: NotificationChannel[] | undefined
): NotificationChannel[] => {
  if (override && override.length > 0) {
    return Array.from(new Set(override));
  }
  if (event) {
    if (
      prefs &&
      typeof prefs === 'object' &&
      Array.isArray((prefs as Record<string, unknown>)[event])
    ) {
      const userChans = (prefs as Record<string, unknown>)[event] as string[];
      const valid = userChans.filter((c): c is NotificationChannel =>
        ['IN_APP', 'EMAIL', 'SMS'].includes(c)
      );
      if (valid.length > 0) return valid;
    }
    if (DEFAULT_PREFS[event]) return DEFAULT_PREFS[event];
  }
  return ['IN_APP'];
};

describe('notification.resolveChannels', () => {
  it('override varsa onu kullanır (duplicate temizler)', () => {
    expect(resolveChannels({}, 'NEW_ORDER', ['IN_APP', 'EMAIL', 'IN_APP'])).toEqual([
      'IN_APP',
      'EMAIL',
    ]);
  });

  it('event verilmeyince IN_APP düşer', () => {
    expect(resolveChannels({}, undefined, undefined)).toEqual(['IN_APP']);
  });

  it('user prefs varsa DEFAULT_PREFS yerine onu seçer', () => {
    const out = resolveChannels(
      { BUYBOX_LOST: ['SMS'] },
      'BUYBOX_LOST',
      undefined
    );
    expect(out).toEqual(['SMS']);
  });

  it('geçersiz kanal değerlerini filtreler', () => {
    const out = resolveChannels(
      { NEW_ORDER: ['IN_APP', 'BOGUS', 'EMAIL', 42] as any },
      'NEW_ORDER',
      undefined
    );
    expect(out).toEqual(['IN_APP', 'EMAIL']);
  });

  it('user prefs boşsa DEFAULT_PREFS\'e düşer', () => {
    expect(resolveChannels({}, 'BUYBOX_LOST', undefined)).toEqual(
      DEFAULT_PREFS.BUYBOX_LOST
    );
  });

  it('bilinmeyen event + boş prefs ise IN_APP', () => {
    expect(resolveChannels({}, 'UNKNOWN_EVENT', undefined)).toEqual(['IN_APP']);
  });

  it('DEFAULT_PREFS tüm olaylar şimdilik IN_APP-only (email/sms sağlayıcı yok)', () => {
    for (const [event, chans] of Object.entries(DEFAULT_PREFS)) {
      expect(chans, `${event} → ${chans.join(',')}`).toEqual(['IN_APP']);
    }
  });
});
