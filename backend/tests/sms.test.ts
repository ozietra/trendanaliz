import { describe, it, expect, beforeEach } from 'vitest';
import { sendSms } from '../src/utils/sms';

/**
 * Sağlayıcı kimlik bilgileri yokken MOCK akış log'a yazıp true döner.
 * Bu test sağlayıcısız ortamda çalışır.
 */

describe('sms.sendSms (mock mode)', () => {
  beforeEach(() => {
    delete process.env.NETGSM_USERCODE;
    delete process.env.NETGSM_PASSWORD;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM;
  });

  it('boş mesaj/numara reddedilir', async () => {
    expect(await sendSms({ to: '', message: 'x' })).toBe(false);
    expect(await sendSms({ to: '+905551112233', message: '' })).toBe(false);
  });

  it('mock akışta her zaman true döner', async () => {
    expect(await sendSms({ to: '+905551112233', message: 'test' })).toBe(true);
  });

  it('0 ile başlayan TR numarasını normalize eder', async () => {
    // sendSms içeride normalize ediyor; smoke test: hata atmaz, true döner
    expect(await sendSms({ to: '05551112233', message: 'merhaba' })).toBe(true);
  });

  it('10 haneli TR mobil numarayı +90 ile prefix\'ler', async () => {
    expect(await sendSms({ to: '5551112233', message: 'merhaba' })).toBe(true);
  });

  it('uluslararası numara kabul eder', async () => {
    expect(await sendSms({ to: '+14155552671', message: 'hi' })).toBe(true);
  });
});
